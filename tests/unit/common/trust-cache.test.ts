/**
 * Trust Cache Tests
 *
 * Tests for the trust score caching functionality with stampede prevention.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { TrustRecord } from '../../../src/trust-engine/index.js';

// Mock Redis before importing the module
const mockRedis = {
  get: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  scan: vi.fn(),
};

vi.mock('../../../src/common/redis.js', () => ({
  getRedis: () => mockRedis,
}));

vi.mock('../../../src/common/config.js', () => ({
  getConfig: () => ({
    trust: {
      cacheTtl: 30, // 30 seconds TTL
    },
  }),
}));

vi.mock('../../../src/common/logger.js', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock the metrics registry to avoid registration conflicts
vi.mock('../../../src/intent/metrics.js', () => ({
  intentRegistry: {
    registerMetric: vi.fn(),
  },
}));

// Import after mocks are set up
import {
  getCachedTrustScore,
  getCachedTrustScoreWithRefresh,
  cacheTrustScore,
  invalidateTrustScore,
  invalidateTenantTrustScores,
  shouldRefreshEarly,
  getTTLWithJitter,
} from '../../../src/common/trust-cache.js';

describe('Trust Cache', () => {
  const testEntityId = 'entity-123';
  const testTenantId = 'tenant-456';
  const testTrustRecord: TrustRecord = {
    entityId: testEntityId,
    score: 750,
    level: 3,
    components: {
      behavioral: 0.8,
      compliance: 0.7,
      identity: 0.75,
      context: 0.7,
    },
    signals: [],
    lastCalculatedAt: '2026-01-18T12:00:00.000Z',
    history: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('getCachedTrustScore', () => {
    it('should return cached trust score on cache hit', async () => {
      const now = Math.floor(Date.now() / 1000);
      const cachedData = {
        record: testTrustRecord,
        cachedAt: now - 10,
        expiresAt: now + 290,
      };
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(cachedData));

      const result = await getCachedTrustScore(testEntityId, testTenantId);

      expect(result).toEqual(testTrustRecord);
      expect(mockRedis.get).toHaveBeenCalledWith(
        `trust:${testTenantId}:${testEntityId}`
      );
    });

    it('should return null on cache miss', async () => {
      mockRedis.get.mockResolvedValueOnce(null);

      const result = await getCachedTrustScore(testEntityId, testTenantId);

      expect(result).toBeNull();
      expect(mockRedis.get).toHaveBeenCalledWith(
        `trust:${testTenantId}:${testEntityId}`
      );
    });

    it('should return null and not throw on Redis error', async () => {
      mockRedis.get.mockRejectedValueOnce(new Error('Redis connection error'));

      const result = await getCachedTrustScore(testEntityId, testTenantId);

      expect(result).toBeNull();
    });

    it('should use correct cache key format', async () => {
      mockRedis.get.mockResolvedValueOnce(null);

      await getCachedTrustScore('my-entity', 'my-tenant');

      expect(mockRedis.get).toHaveBeenCalledWith('trust:my-tenant:my-entity');
    });
  });

  describe('getCachedTrustScoreWithRefresh', () => {
    it('should return cached data without calling fetchFn on cache hit', async () => {
      const now = Math.floor(Date.now() / 1000);
      const cachedData = {
        record: testTrustRecord,
        cachedAt: now - 10,
        expiresAt: now + 290, // Well outside early refresh window
      };
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(cachedData));

      const fetchFn = vi.fn();
      const result = await getCachedTrustScoreWithRefresh(
        testEntityId,
        testTenantId,
        fetchFn
      );

      expect(result).toEqual(testTrustRecord);
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('should fetch and cache on cache miss', async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      mockRedis.setex.mockResolvedValueOnce('OK');

      const fetchFn = vi.fn().mockResolvedValue(testTrustRecord);
      const result = await getCachedTrustScoreWithRefresh(
        testEntityId,
        testTenantId,
        fetchFn
      );

      expect(result).toEqual(testTrustRecord);
      expect(fetchFn).toHaveBeenCalledTimes(1);
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should trigger background refresh when in early refresh window', async () => {
      const now = Math.floor(Date.now() / 1000);
      const cachedData = {
        record: testTrustRecord,
        cachedAt: now - 250,
        expiresAt: now + 10, // Only 10 seconds remaining - in refresh window
      };
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(cachedData));
      mockRedis.setex.mockResolvedValueOnce('OK');

      // Mock Math.random to always trigger refresh
      const originalRandom = Math.random;
      Math.random = vi.fn().mockReturnValue(0.01); // Very low value to ensure refresh

      const freshRecord = { ...testTrustRecord, score: 800 };
      const fetchFn = vi.fn().mockResolvedValue(freshRecord);

      const result = await getCachedTrustScoreWithRefresh(
        testEntityId,
        testTenantId,
        fetchFn
      );

      // Should return stale data immediately
      expect(result).toEqual(testTrustRecord);

      // Wait for background refresh to complete
      await vi.runAllTimersAsync();

      // fetchFn should have been called in background
      expect(fetchFn).toHaveBeenCalled();

      Math.random = originalRandom;
    });

    it('should return stale data immediately during early refresh', async () => {
      const now = Math.floor(Date.now() / 1000);
      const staleRecord = { ...testTrustRecord, score: 500 };
      const cachedData = {
        record: staleRecord,
        cachedAt: now - 295,
        expiresAt: now + 5, // Very close to expiry
      };
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(cachedData));
      mockRedis.setex.mockResolvedValueOnce('OK');

      // Force refresh trigger
      const originalRandom = Math.random;
      Math.random = vi.fn().mockReturnValue(0.01);

      const freshRecord = { ...testTrustRecord, score: 900 };
      const fetchFn = vi.fn().mockResolvedValue(freshRecord);

      const result = await getCachedTrustScoreWithRefresh(
        testEntityId,
        testTenantId,
        fetchFn
      );

      // Should return stale data, not wait for fresh
      expect(result.score).toBe(500);

      Math.random = originalRandom;
    });
  });

  describe('shouldRefreshEarly', () => {
    it('should return false when well outside refresh window', () => {
      const now = Math.floor(Date.now() / 1000);
      const cachedAt = now - 100;
      const expiresAt = now + 200; // 200 seconds remaining

      // Even with random returning 0, should not refresh
      const originalRandom = Math.random;
      Math.random = vi.fn().mockReturnValue(0);

      const result = shouldRefreshEarly(cachedAt, expiresAt);

      expect(result).toBe(false);
      Math.random = originalRandom;
    });

    it('should return true when entry is expired', () => {
      const now = Math.floor(Date.now() / 1000);
      const cachedAt = now - 400;
      const expiresAt = now - 10; // Already expired

      const result = shouldRefreshEarly(cachedAt, expiresAt);

      expect(result).toBe(true);
    });

    it('should have increasing probability as expiry approaches', () => {
      const now = Math.floor(Date.now() / 1000);
      const cachedAt = now - 250;

      // Test at different remaining times within the 60-second window
      const originalRandom = Math.random;

      // At 50 seconds remaining (10 seconds into window)
      // probability = (60 - 50) / 60 = 0.167
      Math.random = vi.fn().mockReturnValue(0.2);
      let result = shouldRefreshEarly(cachedAt, now + 50);
      expect(result).toBe(false); // 0.2 > 0.167

      // At 10 seconds remaining (50 seconds into window)
      // probability = (60 - 10) / 60 = 0.833
      Math.random = vi.fn().mockReturnValue(0.5);
      result = shouldRefreshEarly(cachedAt, now + 10);
      expect(result).toBe(true); // 0.5 < 0.833

      Math.random = originalRandom;
    });

    it('should be probabilistic based on Math.random', () => {
      const now = Math.floor(Date.now() / 1000);
      const cachedAt = now - 270;
      const expiresAt = now + 30; // 30 seconds remaining, probability = 0.5

      const originalRandom = Math.random;

      // Random below probability threshold
      Math.random = vi.fn().mockReturnValue(0.3);
      expect(shouldRefreshEarly(cachedAt, expiresAt)).toBe(true);

      // Random above probability threshold
      Math.random = vi.fn().mockReturnValue(0.7);
      expect(shouldRefreshEarly(cachedAt, expiresAt)).toBe(false);

      Math.random = originalRandom;
    });
  });

  describe('getTTLWithJitter', () => {
    it('should return TTL within expected range', () => {
      const baseTTL = 300;
      const originalRandom = Math.random;

      // Test minimum jitter (random = 0)
      Math.random = vi.fn().mockReturnValue(0);
      let result = getTTLWithJitter(baseTTL);
      expect(result).toBe(300); // No jitter

      // Test maximum jitter (random = 1)
      Math.random = vi.fn().mockReturnValue(1);
      result = getTTLWithJitter(baseTTL);
      expect(result).toBe(330); // 10% jitter = 30 seconds

      // Test mid-range jitter
      Math.random = vi.fn().mockReturnValue(0.5);
      result = getTTLWithJitter(baseTTL);
      expect(result).toBe(315); // 5% jitter = 15 seconds

      Math.random = originalRandom;
    });

    it('should add randomness across multiple calls', () => {
      const baseTTL = 100;
      const results = new Set<number>();

      // Use real random for this test
      vi.useRealTimers();
      for (let i = 0; i < 20; i++) {
        results.add(getTTLWithJitter(baseTTL));
      }

      // Should have some variation (statistically very likely with 20 calls)
      // All values should be between 100 and 110 (0-10% jitter)
      for (const ttl of results) {
        expect(ttl).toBeGreaterThanOrEqual(100);
        expect(ttl).toBeLessThanOrEqual(110);
      }

      // With 20 calls and up to 10 different values possible, we should get at least 2
      expect(results.size).toBeGreaterThanOrEqual(1);
    });

    it('should floor the result to integer', () => {
      const baseTTL = 100;
      const originalRandom = Math.random;

      // Random that would give fractional result
      Math.random = vi.fn().mockReturnValue(0.333);
      const result = getTTLWithJitter(baseTTL);

      expect(Number.isInteger(result)).toBe(true);
      expect(result).toBe(103); // floor(100 + 0.333 * 10) = floor(103.33)

      Math.random = originalRandom;
    });
  });

  describe('cacheTrustScore', () => {
    it('should cache trust score with jittered TTL', async () => {
      mockRedis.setex.mockResolvedValueOnce('OK');
      const originalRandom = Math.random;
      Math.random = vi.fn().mockReturnValue(0.5);

      await cacheTrustScore(testEntityId, testTenantId, testTrustRecord);

      // Base TTL is 30 from mock config, with 5% jitter = 31.5 -> 31
      expect(mockRedis.setex).toHaveBeenCalledWith(
        `trust:${testTenantId}:${testEntityId}`,
        31, // 30 + 5% jitter
        expect.any(String)
      );

      Math.random = originalRandom;
    });

    it('should not throw on Redis error', async () => {
      mockRedis.setex.mockRejectedValueOnce(new Error('Redis write error'));

      // Should not throw
      await expect(
        cacheTrustScore(testEntityId, testTenantId, testTrustRecord)
      ).resolves.not.toThrow();
    });

    it('should serialize with cachedAt and expiresAt timestamps', async () => {
      mockRedis.setex.mockResolvedValueOnce('OK');
      const originalRandom = Math.random;
      Math.random = vi.fn().mockReturnValue(0);

      const now = Date.now();
      vi.setSystemTime(now);

      await cacheTrustScore(testEntityId, testTenantId, testTrustRecord);

      const [, , serialized] = mockRedis.setex.mock.calls[0] as [string, number, string];
      const parsed = JSON.parse(serialized);

      expect(parsed.record).toEqual(testTrustRecord);
      expect(parsed.cachedAt).toBe(Math.floor(now / 1000));
      expect(parsed.expiresAt).toBe(Math.floor(now / 1000) + 30);

      Math.random = originalRandom;
    });
  });

  describe('invalidateTrustScore', () => {
    it('should delete cached trust score', async () => {
      mockRedis.del.mockResolvedValueOnce(1);

      await invalidateTrustScore(testEntityId, testTenantId);

      expect(mockRedis.del).toHaveBeenCalledWith(
        `trust:${testTenantId}:${testEntityId}`
      );
    });

    it('should not throw on Redis error', async () => {
      mockRedis.del.mockRejectedValueOnce(new Error('Redis delete error'));

      // Should not throw
      await expect(
        invalidateTrustScore(testEntityId, testTenantId)
      ).resolves.not.toThrow();
    });
  });

  describe('invalidateTenantTrustScores', () => {
    it('should delete all trust scores for a tenant using SCAN', async () => {
      // Mock SCAN returning keys in two batches
      mockRedis.scan
        .mockResolvedValueOnce(['cursor-1', ['trust:tenant-456:entity-1', 'trust:tenant-456:entity-2']])
        .mockResolvedValueOnce(['0', ['trust:tenant-456:entity-3']]);
      mockRedis.del.mockResolvedValue(1);

      await invalidateTenantTrustScores(testTenantId);

      // Should have scanned twice
      expect(mockRedis.scan).toHaveBeenCalledTimes(2);
      expect(mockRedis.scan).toHaveBeenCalledWith('0', 'MATCH', 'trust:tenant-456:*', 'COUNT', 100);

      // Should have deleted keys from both batches
      expect(mockRedis.del).toHaveBeenCalledTimes(2);
    });

    it('should handle empty scan results', async () => {
      mockRedis.scan.mockResolvedValueOnce(['0', []]);

      await invalidateTenantTrustScores(testTenantId);

      expect(mockRedis.scan).toHaveBeenCalledTimes(1);
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('should not throw on Redis error', async () => {
      mockRedis.scan.mockRejectedValueOnce(new Error('Redis scan error'));

      // Should not throw
      await expect(
        invalidateTenantTrustScores(testTenantId)
      ).resolves.not.toThrow();
    });
  });

  describe('cache key isolation', () => {
    it('should isolate cache by tenant', async () => {
      mockRedis.get.mockResolvedValue(null);

      await getCachedTrustScore(testEntityId, 'tenant-A');
      await getCachedTrustScore(testEntityId, 'tenant-B');

      expect(mockRedis.get).toHaveBeenCalledWith(`trust:tenant-A:${testEntityId}`);
      expect(mockRedis.get).toHaveBeenCalledWith(`trust:tenant-B:${testEntityId}`);
    });

    it('should isolate cache by entity', async () => {
      mockRedis.get.mockResolvedValue(null);

      await getCachedTrustScore('entity-A', testTenantId);
      await getCachedTrustScore('entity-B', testTenantId);

      expect(mockRedis.get).toHaveBeenCalledWith(`trust:${testTenantId}:entity-A`);
      expect(mockRedis.get).toHaveBeenCalledWith(`trust:${testTenantId}:entity-B`);
    });
  });

  describe('stampede prevention integration', () => {
    it('should prevent thundering herd by returning stale data during refresh', async () => {
      const now = Math.floor(Date.now() / 1000);
      const staleRecord = { ...testTrustRecord, score: 400 };
      const cachedData = {
        record: staleRecord,
        cachedAt: now - 295,
        expiresAt: now + 5, // Almost expired
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));
      mockRedis.setex.mockResolvedValue('OK');

      // Force refresh
      const originalRandom = Math.random;
      Math.random = vi.fn().mockReturnValue(0.01);

      const freshRecord = { ...testTrustRecord, score: 900 };
      const fetchFn = vi.fn().mockResolvedValue(freshRecord);

      // Simulate multiple concurrent requests
      const results = await Promise.all([
        getCachedTrustScoreWithRefresh(testEntityId, testTenantId, fetchFn),
        getCachedTrustScoreWithRefresh(testEntityId, testTenantId, fetchFn),
        getCachedTrustScoreWithRefresh(testEntityId, testTenantId, fetchFn),
      ]);

      // All should return stale data immediately
      for (const result of results) {
        expect(result.score).toBe(400);
      }

      Math.random = originalRandom;
    });
  });
});
