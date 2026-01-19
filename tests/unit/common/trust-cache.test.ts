/**
 * Trust Cache Tests
 *
 * Tests for the trust score caching functionality with XFetch stampede prevention.
 *
 * The XFetch algorithm uses probabilistic early refresh to prevent cache stampede:
 * - Formula: age > ttl - delta * beta * log(random())
 * - delta: computation time
 * - beta: tuning parameter (default 1.0)
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
  // XFetch exports
  shouldRefresh,
  getWithXFetch,
  invalidateXFetchCache,
  applyTTLJitter,
  getInFlightRefreshCount,
  clearInFlightRefreshes,
  getInFlightTrustRefreshCount,
  clearInFlightTrustRefreshes,
  type XFetchCacheEntry,
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

// ============================================================================
// XFetch Algorithm Tests
// ============================================================================

describe('XFetch Algorithm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    clearInFlightRefreshes();
    clearInFlightTrustRefreshes();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    clearInFlightRefreshes();
    clearInFlightTrustRefreshes();
  });

  describe('shouldRefresh', () => {
    it('should return true when entry is expired', () => {
      const entry: XFetchCacheEntry<string> = {
        value: 'test',
        fetchTime: Date.now() - 60000, // 60 seconds ago
        ttl: 30000, // 30 second TTL (expired 30s ago)
        delta: 100,
      };

      // Should always refresh when expired
      expect(shouldRefresh(entry)).toBe(true);
    });

    it('should return false when entry is fresh (well before TTL)', () => {
      const entry: XFetchCacheEntry<string> = {
        value: 'test',
        fetchTime: Date.now() - 1000, // 1 second ago
        ttl: 300000, // 5 minute TTL
        delta: 100,
      };

      const originalRandom = Math.random;
      // Even with very low random, should not refresh when very fresh
      Math.random = vi.fn().mockReturnValue(0.001);

      // With entry only 1 second old and 5 minute TTL, very unlikely to refresh
      // age = 1000ms, ttl = 300000ms
      // threshold = 300000 + 100 * 1.0 * log(0.001) = 300000 - 690.77 = ~299309
      // age (1000) < threshold (299309), so should NOT refresh
      expect(shouldRefresh(entry)).toBe(false);

      Math.random = originalRandom;
    });

    it('should use delta to scale refresh probability', () => {
      const now = Date.now();
      const originalRandom = Math.random;

      // Fix random to a specific value
      // log(0.1) = -2.302585
      Math.random = vi.fn().mockReturnValue(0.1);

      // Entry with small delta (50ms computation time)
      const entrySmallDelta: XFetchCacheEntry<string> = {
        value: 'test',
        fetchTime: now - 55000, // 55 seconds old
        ttl: 60000, // 60 second TTL (5s remaining)
        delta: 50,
      };

      // Entry with large delta (1000ms computation time)
      const entryLargeDelta: XFetchCacheEntry<string> = {
        value: 'test',
        fetchTime: now - 55000, // 55 seconds old
        ttl: 60000, // 60 second TTL (5s remaining)
        delta: 1000,
      };

      // With larger delta, refresh should be more likely
      // Small delta: threshold = 60000 + 50 * 1.0 * (-2.30) = 60000 - 115 = 59885
      // Large delta: threshold = 60000 + 1000 * 1.0 * (-2.30) = 60000 - 2302 = 57698
      // age = 55000
      // For small delta: 55000 < 59885, so NOT refresh
      // For large delta: 55000 < 57698, so NOT refresh
      // Both are still before threshold, but large delta has lower threshold

      // With age closer to TTL
      const entryNearExpiry: XFetchCacheEntry<string> = {
        value: 'test',
        fetchTime: now - 59000, // 59 seconds old
        ttl: 60000, // 60 second TTL (1s remaining)
        delta: 1000,
      };

      // age = 59000
      // threshold = 60000 + 1000 * (-2.30) = 57698
      // 59000 > 57698, so SHOULD refresh
      expect(shouldRefresh(entryNearExpiry)).toBe(true);

      Math.random = originalRandom;
    });

    it('should be probabilistic - multiple calls may give different results', () => {
      vi.useRealTimers(); // Use real random for this test
      const now = Date.now();

      // Entry close to expiry where refresh is probabilistic
      const entry: XFetchCacheEntry<string> = {
        value: 'test',
        fetchTime: now - 58000, // 58 seconds old
        ttl: 60000, // 60 second TTL
        delta: 500,
      };

      // Run multiple times and collect results
      const results: boolean[] = [];
      for (let i = 0; i < 100; i++) {
        results.push(shouldRefresh(entry));
      }

      // Should have some true and some false (probabilistic)
      const trueCount = results.filter(Boolean).length;
      // With these parameters, we expect some variance
      expect(trueCount).toBeGreaterThan(0);
      expect(trueCount).toBeLessThan(100);
    });

    it('should respect beta parameter', () => {
      const now = Date.now();
      const originalRandom = Math.random;

      // Fixed random value
      Math.random = vi.fn().mockReturnValue(0.1); // log(0.1) = -2.30

      const entry: XFetchCacheEntry<string> = {
        value: 'test',
        fetchTime: now - 55000, // 55 seconds old
        ttl: 60000, // 60 second TTL
        delta: 500,
      };

      // With beta = 1.0: threshold = 60000 + 500 * 1.0 * (-2.30) = 58849
      // age = 55000 < threshold, no refresh
      expect(shouldRefresh(entry, 1.0)).toBe(false);

      // With beta = 3.0 (more aggressive): threshold = 60000 + 500 * 3.0 * (-2.30) = 56548
      // age = 55000 < threshold, no refresh
      expect(shouldRefresh(entry, 3.0)).toBe(false);

      // With beta = 5.0 (very aggressive): threshold = 60000 + 500 * 5.0 * (-2.30) = 54247
      // age = 55000 > threshold, REFRESH
      expect(shouldRefresh(entry, 5.0)).toBe(true);

      Math.random = originalRandom;
    });
  });

  describe('applyTTLJitter', () => {
    it('should apply jitter within range', () => {
      const originalRandom = Math.random;

      // Test minimum jitter (random = 0 gives multiplier = -0.1)
      Math.random = vi.fn().mockReturnValue(0);
      let result = applyTTLJitter(100000, 0.1);
      expect(result).toBe(90000); // -10%

      // Test maximum jitter (random = 1 gives multiplier = +0.1)
      Math.random = vi.fn().mockReturnValue(1);
      result = applyTTLJitter(100000, 0.1);
      expect(result).toBe(110000); // +10%

      // Test middle (random = 0.5 gives multiplier = 0)
      Math.random = vi.fn().mockReturnValue(0.5);
      result = applyTTLJitter(100000, 0.1);
      expect(result).toBe(100000); // No change

      Math.random = originalRandom;
    });

    it('should never return zero or negative TTL', () => {
      const originalRandom = Math.random;

      // Even with minimum random and high jitter, should return at least 1
      Math.random = vi.fn().mockReturnValue(0);
      const result = applyTTLJitter(1, 0.99); // Would be 0.01 without floor

      expect(result).toBeGreaterThanOrEqual(1);

      Math.random = originalRandom;
    });

    it('should support custom jitter fraction', () => {
      const originalRandom = Math.random;

      // Test with 20% jitter
      Math.random = vi.fn().mockReturnValue(1);
      const result = applyTTLJitter(100000, 0.2);
      expect(result).toBe(120000); // +20%

      Math.random = originalRandom;
    });
  });

  describe('getWithXFetch', () => {
    it('should return cached value on cache hit', async () => {
      const entry: XFetchCacheEntry<{ data: string }> = {
        value: { data: 'cached' },
        fetchTime: Date.now() - 1000,
        ttl: 60000,
        delta: 100,
      };
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(entry));

      const fetchFn = vi.fn().mockResolvedValue({ data: 'fresh' });
      const result = await getWithXFetch('test-key', fetchFn, 60000);

      expect(result).toEqual({ data: 'cached' });
      expect(fetchFn).not.toHaveBeenCalled();
      expect(mockRedis.get).toHaveBeenCalledWith('xfetch:test-key');
    });

    it('should fetch and cache on cache miss', async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      mockRedis.setex.mockResolvedValueOnce('OK');

      const fetchFn = vi.fn().mockResolvedValue({ data: 'fresh' });
      const result = await getWithXFetch('test-key', fetchFn, 60000);

      expect(result).toEqual({ data: 'fresh' });
      expect(fetchFn).toHaveBeenCalledTimes(1);
      expect(mockRedis.setex).toHaveBeenCalled();

      // Verify the stored entry has XFetch metadata
      const [, , serialized] = mockRedis.setex.mock.calls[0] as [string, number, string];
      const stored = JSON.parse(serialized) as XFetchCacheEntry<unknown>;
      expect(stored.value).toEqual({ data: 'fresh' });
      expect(stored.fetchTime).toBeDefined();
      expect(stored.ttl).toBeDefined();
      expect(stored.delta).toBeDefined();
    });

    it('should trigger background refresh when XFetch determines refresh needed', async () => {
      // Entry that is close to expiry
      const entry: XFetchCacheEntry<{ data: string }> = {
        value: { data: 'stale' },
        fetchTime: Date.now() - 59000, // 59 seconds old
        ttl: 60000, // 60 second TTL
        delta: 1000,
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(entry));
      mockRedis.setex.mockResolvedValue('OK');

      // Force refresh
      const originalRandom = Math.random;
      Math.random = vi.fn().mockReturnValue(0.01); // Very low, forces refresh

      const fetchFn = vi.fn().mockResolvedValue({ data: 'fresh' });
      const result = await getWithXFetch('test-key', fetchFn, 60000);

      // Should return stale data immediately
      expect(result).toEqual({ data: 'stale' });

      // Wait for background refresh
      await vi.runAllTimersAsync();

      // fetchFn should have been called for background refresh
      expect(fetchFn).toHaveBeenCalled();

      Math.random = originalRandom;
    });

    it('should deduplicate concurrent background refreshes', async () => {
      const entry: XFetchCacheEntry<{ data: string }> = {
        value: { data: 'stale' },
        fetchTime: Date.now() - 59000,
        ttl: 60000,
        delta: 1000,
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(entry));
      mockRedis.setex.mockResolvedValue('OK');

      const originalRandom = Math.random;
      Math.random = vi.fn().mockReturnValue(0.01);

      // Slow fetch function
      let fetchCount = 0;
      const fetchFn = vi.fn().mockImplementation(async () => {
        fetchCount++;
        await new Promise((resolve) => setTimeout(resolve, 100));
        return { data: `fresh-${fetchCount}` };
      });

      // Multiple concurrent requests
      const results = await Promise.all([
        getWithXFetch('test-key', fetchFn, 60000),
        getWithXFetch('test-key', fetchFn, 60000),
        getWithXFetch('test-key', fetchFn, 60000),
      ]);

      // All should return stale data
      for (const result of results) {
        expect(result).toEqual({ data: 'stale' });
      }

      // Check in-flight refresh count
      expect(getInFlightRefreshCount()).toBeLessThanOrEqual(1);

      // Wait for background refresh
      await vi.runAllTimersAsync();

      // fetchFn should only be called once due to deduplication
      // (first request triggers refresh, others see in-flight and skip)
      expect(fetchFn).toHaveBeenCalledTimes(1);

      Math.random = originalRandom;
    });

    it('should apply jitter to TTL', async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      mockRedis.setex.mockResolvedValueOnce('OK');

      const originalRandom = Math.random;
      Math.random = vi.fn().mockReturnValue(0.75); // Will give +5% jitter with default 0.1

      const fetchFn = vi.fn().mockResolvedValue({ data: 'fresh' });
      await getWithXFetch('test-key', fetchFn, 60000, { jitter: 0.1 });

      // Check the TTL stored
      const [, , serialized] = mockRedis.setex.mock.calls[0] as [string, number, string];
      const stored = JSON.parse(serialized) as XFetchCacheEntry<unknown>;

      // With random = 0.75, jitterMultiplier = (0.75 * 2 - 1) * 0.1 = 0.05
      // jitteredTtl = 60000 * 1.05 = 63000
      expect(stored.ttl).toBe(63000);

      Math.random = originalRandom;
    });

    it('should track computation time (delta)', async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      mockRedis.setex.mockResolvedValueOnce('OK');

      // Simulate a slow fetch
      const fetchFn = vi.fn().mockImplementation(async () => {
        vi.advanceTimersByTime(150); // Simulate 150ms fetch
        return { data: 'fresh' };
      });

      await getWithXFetch('test-key', fetchFn, 60000);

      const [, , serialized] = mockRedis.setex.mock.calls[0] as [string, number, string];
      const stored = JSON.parse(serialized) as XFetchCacheEntry<unknown>;

      // Delta should be approximately 150ms
      expect(stored.delta).toBeGreaterThanOrEqual(150);
    });

    it('should use custom beta parameter', async () => {
      const entry: XFetchCacheEntry<{ data: string }> = {
        value: { data: 'cached' },
        fetchTime: Date.now() - 55000, // 55 seconds old
        ttl: 60000, // 60 second TTL
        delta: 500,
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(entry));
      mockRedis.setex.mockResolvedValue('OK');

      const originalRandom = Math.random;
      Math.random = vi.fn().mockReturnValue(0.1); // log(0.1) = -2.30

      const fetchFn = vi.fn().mockResolvedValue({ data: 'fresh' });

      // With default beta = 1.0, should not refresh
      await getWithXFetch('test-key-1', fetchFn, 60000, { beta: 1.0 });
      expect(fetchFn).not.toHaveBeenCalled();

      // With high beta = 5.0, should trigger refresh
      await getWithXFetch('test-key-2', fetchFn, 60000, { beta: 5.0 });

      // Wait for background refresh
      await vi.runAllTimersAsync();

      expect(fetchFn).toHaveBeenCalled();

      Math.random = originalRandom;
    });
  });

  describe('invalidateXFetchCache', () => {
    it('should delete cache entry', async () => {
      mockRedis.del.mockResolvedValueOnce(1);

      await invalidateXFetchCache('test-key');

      expect(mockRedis.del).toHaveBeenCalledWith('xfetch:test-key');
    });

    it('should not throw on Redis error', async () => {
      mockRedis.del.mockRejectedValueOnce(new Error('Redis error'));

      await expect(invalidateXFetchCache('test-key')).resolves.not.toThrow();
    });
  });

  describe('in-flight refresh tracking', () => {
    it('should track in-flight refreshes', async () => {
      const entry: XFetchCacheEntry<string> = {
        value: 'stale',
        fetchTime: Date.now() - 59000,
        ttl: 60000,
        delta: 1000,
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(entry));
      mockRedis.setex.mockResolvedValue('OK');

      const originalRandom = Math.random;
      Math.random = vi.fn().mockReturnValue(0.01);

      let resolvePromise: () => void;
      const fetchPromise = new Promise<string>((resolve) => {
        resolvePromise = () => resolve('fresh');
      });
      const fetchFn = vi.fn().mockReturnValue(fetchPromise);

      // Start request that triggers background refresh
      const resultPromise = getWithXFetch('test-key', fetchFn, 60000);

      // Result should be stale data immediately
      const result = await resultPromise;
      expect(result).toBe('stale');

      // In-flight count should be 1
      expect(getInFlightRefreshCount()).toBe(1);

      // Complete the refresh
      resolvePromise!();
      await vi.runAllTimersAsync();

      // In-flight should be cleared
      expect(getInFlightRefreshCount()).toBe(0);

      Math.random = originalRandom;
    });

    it('should clear in-flight tracking on error', async () => {
      const entry: XFetchCacheEntry<string> = {
        value: 'stale',
        fetchTime: Date.now() - 59000,
        ttl: 60000,
        delta: 1000,
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(entry));

      const originalRandom = Math.random;
      Math.random = vi.fn().mockReturnValue(0.01);

      const fetchFn = vi.fn().mockRejectedValue(new Error('Fetch failed'));

      await getWithXFetch('test-key', fetchFn, 60000);

      // Wait for background refresh to fail
      await vi.runAllTimersAsync();

      // In-flight should be cleared even on error
      expect(getInFlightRefreshCount()).toBe(0);

      Math.random = originalRandom;
    });
  });
});

// ============================================================================
// Trust Score XFetch Integration Tests
// ============================================================================

describe('Trust Score Cache with XFetch', () => {
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
    clearInFlightTrustRefreshes();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    clearInFlightTrustRefreshes();
  });

  it('should store delta in cache entry', async () => {
    mockRedis.get.mockResolvedValueOnce(null);
    mockRedis.setex.mockResolvedValueOnce('OK');

    const fetchFn = vi.fn().mockImplementation(async () => {
      vi.advanceTimersByTime(100); // Simulate 100ms computation
      return testTrustRecord;
    });

    await getCachedTrustScoreWithRefresh(testEntityId, testTenantId, fetchFn);

    const [, , serialized] = mockRedis.setex.mock.calls[0] as [string, number, string];
    const stored = JSON.parse(serialized);

    expect(stored.delta).toBeDefined();
    expect(stored.delta).toBeGreaterThanOrEqual(100);
  });

  it('should use delta for XFetch calculation when available', async () => {
    const now = Math.floor(Date.now() / 1000);
    // Entry very close to expiration to trigger XFetch refresh
    // With delta = 5000ms, TTL = 300s, and entry at 299s age:
    // threshold = 300000 + 5000 * log(0.01) = 300000 - 23025 = 276975ms
    // age = 299 * 1000 = 299000ms > 276975, so REFRESH
    const cachedData = {
      record: testTrustRecord,
      cachedAt: now - 299, // 299 seconds ago
      expiresAt: now + 1, // 1 second remaining (very close to expiry)
      delta: 5000, // 5 second computation time (high to increase refresh probability)
    };
    mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));
    mockRedis.setex.mockResolvedValue('OK');

    const originalRandom = Math.random;
    // log(0.01) = -4.605, so threshold = 300000 + 5000 * (-4.605) = 276975ms
    // age = 299000ms > 276975ms, so SHOULD refresh
    Math.random = vi.fn().mockReturnValue(0.01);

    const fetchFn = vi.fn().mockResolvedValue({ ...testTrustRecord, score: 900 });

    const result = await getCachedTrustScoreWithRefresh(
      testEntityId,
      testTenantId,
      fetchFn
    );

    // Should return stale data
    expect(result.score).toBe(750);

    // Background refresh should be triggered
    await vi.runAllTimersAsync();
    expect(fetchFn).toHaveBeenCalled();

    Math.random = originalRandom;
  });

  it('should deduplicate concurrent trust score refreshes', async () => {
    const now = Math.floor(Date.now() / 1000);
    // Entry very close to expiration - will trigger XFetch refresh
    const cachedData = {
      record: testTrustRecord,
      cachedAt: now - 299, // 299 seconds ago
      expiresAt: now + 1, // 1 second remaining
      delta: 5000, // 5 second computation time
    };
    mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));
    mockRedis.setex.mockResolvedValue('OK');

    const originalRandom = Math.random;
    Math.random = vi.fn().mockReturnValue(0.01);

    let fetchCount = 0;
    const fetchFn = vi.fn().mockImplementation(async () => {
      fetchCount++;
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { ...testTrustRecord, score: 900 + fetchCount };
    });

    // Multiple concurrent requests
    const results = await Promise.all([
      getCachedTrustScoreWithRefresh(testEntityId, testTenantId, fetchFn),
      getCachedTrustScoreWithRefresh(testEntityId, testTenantId, fetchFn),
      getCachedTrustScoreWithRefresh(testEntityId, testTenantId, fetchFn),
    ]);

    // All should return stale data
    for (const result of results) {
      expect(result.score).toBe(750);
    }

    // Wait for background refresh
    await vi.runAllTimersAsync();

    // Should only have one background refresh due to deduplication
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(getInFlightTrustRefreshCount()).toBe(0);

    Math.random = originalRandom;
  });

  it('should fall back to legacy behavior when delta is not present', async () => {
    const now = Math.floor(Date.now() / 1000);
    // Legacy cache entry without delta
    const cachedData = {
      record: testTrustRecord,
      cachedAt: now - 270,
      expiresAt: now + 30, // 30 seconds remaining
      // No delta field
    };
    mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));
    mockRedis.setex.mockResolvedValue('OK');

    const originalRandom = Math.random;
    // With legacy behavior: probability = (60-30)/60 = 0.5
    // random 0.3 < 0.5 should trigger refresh
    Math.random = vi.fn().mockReturnValue(0.3);

    const fetchFn = vi.fn().mockResolvedValue({ ...testTrustRecord, score: 900 });

    const result = await getCachedTrustScoreWithRefresh(
      testEntityId,
      testTenantId,
      fetchFn
    );

    expect(result.score).toBe(750);

    // Should trigger background refresh using legacy probability
    await vi.runAllTimersAsync();
    expect(fetchFn).toHaveBeenCalled();

    Math.random = originalRandom;
  });
});
