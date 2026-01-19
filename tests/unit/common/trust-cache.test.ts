/**
 * Trust Cache Tests
 *
 * Tests for the trust score caching functionality.
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
  cacheTrustScore,
  invalidateTrustScore,
  invalidateTenantTrustScores,
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
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getCachedTrustScore', () => {
    it('should return cached trust score on cache hit', async () => {
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(testTrustRecord));

      const result = await getCachedTrustScore(testEntityId, testTenantId);

      expect(result).toEqual(testTrustRecord);
      expect(mockRedis.get).toHaveBeenCalledWith(
        `trust:score:${testTenantId}:${testEntityId}`
      );
    });

    it('should return null on cache miss', async () => {
      mockRedis.get.mockResolvedValueOnce(null);

      const result = await getCachedTrustScore(testEntityId, testTenantId);

      expect(result).toBeNull();
      expect(mockRedis.get).toHaveBeenCalledWith(
        `trust:score:${testTenantId}:${testEntityId}`
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

      expect(mockRedis.get).toHaveBeenCalledWith('trust:score:my-tenant:my-entity');
    });
  });

  describe('cacheTrustScore', () => {
    it('should cache trust score with correct TTL', async () => {
      mockRedis.setex.mockResolvedValueOnce('OK');

      await cacheTrustScore(testEntityId, testTenantId, testTrustRecord);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        `trust:score:${testTenantId}:${testEntityId}`,
        30, // TTL from mock config
        JSON.stringify(testTrustRecord)
      );
    });

    it('should not throw on Redis error', async () => {
      mockRedis.setex.mockRejectedValueOnce(new Error('Redis write error'));

      // Should not throw
      await expect(
        cacheTrustScore(testEntityId, testTenantId, testTrustRecord)
      ).resolves.not.toThrow();
    });

    it('should serialize the trust record correctly', async () => {
      mockRedis.setex.mockResolvedValueOnce('OK');

      await cacheTrustScore(testEntityId, testTenantId, testTrustRecord);

      const [, , serialized] = mockRedis.setex.mock.calls[0] as [string, number, string];
      const parsed = JSON.parse(serialized);

      expect(parsed.entityId).toBe(testEntityId);
      expect(parsed.score).toBe(750);
      expect(parsed.level).toBe(3);
      expect(parsed.components.behavioral).toBe(0.8);
    });
  });

  describe('invalidateTrustScore', () => {
    it('should delete cached trust score', async () => {
      mockRedis.del.mockResolvedValueOnce(1);

      await invalidateTrustScore(testEntityId, testTenantId);

      expect(mockRedis.del).toHaveBeenCalledWith(
        `trust:score:${testTenantId}:${testEntityId}`
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
        .mockResolvedValueOnce(['cursor-1', ['trust:score:tenant-456:entity-1', 'trust:score:tenant-456:entity-2']])
        .mockResolvedValueOnce(['0', ['trust:score:tenant-456:entity-3']]);
      mockRedis.del.mockResolvedValue(1);

      await invalidateTenantTrustScores(testTenantId);

      // Should have scanned twice
      expect(mockRedis.scan).toHaveBeenCalledTimes(2);
      expect(mockRedis.scan).toHaveBeenCalledWith('0', 'MATCH', 'trust:score:tenant-456:*', 'COUNT', 100);

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

      expect(mockRedis.get).toHaveBeenCalledWith(`trust:score:tenant-A:${testEntityId}`);
      expect(mockRedis.get).toHaveBeenCalledWith(`trust:score:tenant-B:${testEntityId}`);
    });

    it('should isolate cache by entity', async () => {
      mockRedis.get.mockResolvedValue(null);

      await getCachedTrustScore('entity-A', testTenantId);
      await getCachedTrustScore('entity-B', testTenantId);

      expect(mockRedis.get).toHaveBeenCalledWith(`trust:score:${testTenantId}:entity-A`);
      expect(mockRedis.get).toHaveBeenCalledWith(`trust:score:${testTenantId}:entity-B`);
    });
  });
});
