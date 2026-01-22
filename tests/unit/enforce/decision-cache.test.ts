/**
 * Decision Cache Tests
 *
 * Tests for the DecisionCache class.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DecisionCache,
  createDecisionCache,
  getDecisionCache,
  resetDecisionCache,
} from '../../../src/enforce/decision-cache.js';
import type { EnforcementDecision, DecisionCacheKey, EnforcementContext } from '../../../src/enforce/types.js';
import type { TrustLevel, TrustScore } from '../../../src/common/types.js';

// Mock Redis
vi.mock('../../../src/common/redis.js', () => ({
  getRedis: () => ({
    get: vi.fn().mockResolvedValue(null),
    setex: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    keys: vi.fn().mockResolvedValue([]),
  }),
}));

// Mock logger
vi.mock('../../../src/common/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock metrics
vi.mock('../../../src/enforce/metrics.js', () => ({
  recordCacheHit: vi.fn(),
  recordCacheMiss: vi.fn(),
  setCacheSize: vi.fn(),
}));

// Helper to create mock decision
function createMockDecision(overrides?: Partial<EnforcementDecision>): EnforcementDecision {
  return {
    id: 'decision-123',
    intentId: 'intent-456',
    tenantId: 'tenant-789',
    action: 'allow',
    reason: 'Test decision',
    confidence: 0.95,
    policiesEvaluated: [],
    constraints: [],
    trustScore: 500 as TrustScore,
    trustLevel: 2 as TrustLevel,
    decidedAt: new Date().toISOString(),
    durationMs: 10,
    cached: false,
    ...overrides,
  };
}

// Helper to create mock cache key
function createMockCacheKey(overrides?: Partial<DecisionCacheKey>): DecisionCacheKey {
  return {
    tenantId: 'tenant-789',
    intentId: 'intent-456',
    entityId: 'entity-123',
    intentType: 'action',
    contextHash: 'abc123',
    trustLevel: 2 as TrustLevel,
    ...overrides,
  };
}

// Helper to create mock context
function createMockContext(): EnforcementContext {
  return {
    intent: {
      id: 'intent-456',
      tenantId: 'tenant-789',
      entityId: 'entity-123',
      action: 'read',
      resource: 'document',
      status: 'pending',
      intentType: 'action',
      context: { foo: 'bar' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    entity: {
      id: 'entity-123',
      type: 'agent',
      trustScore: 500,
      trustLevel: 2 as TrustLevel,
      attributes: {},
    },
    environment: {
      timestamp: new Date().toISOString(),
      timezone: 'UTC',
      requestId: 'req-123',
    },
    evaluation: {
      passed: true,
      finalAction: 'allow',
      rulesEvaluated: [],
    },
    trustScore: 500 as TrustScore,
    trustLevel: 2 as TrustLevel,
  };
}

describe('DecisionCache', () => {
  let cache: DecisionCache;

  beforeEach(() => {
    resetDecisionCache();
    cache = createDecisionCache({ ttlMs: 60000, maxSize: 100 });
  });

  afterEach(() => {
    cache.shutdown();
    resetDecisionCache();
  });

  describe('constructor', () => {
    it('should create cache with default options', () => {
      const c = new DecisionCache();
      expect(c.size()).toBe(0);
      c.shutdown();
    });

    it('should create cache with custom options', () => {
      const c = new DecisionCache({ ttlMs: 30000, maxSize: 50 });
      expect(c.size()).toBe(0);
      c.shutdown();
    });
  });

  describe('get/set', () => {
    it('should store and retrieve a decision', async () => {
      const key = createMockCacheKey();
      const decision = createMockDecision();

      await cache.set(key, decision);
      const retrieved = await cache.get(key);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(decision.id);
      expect(retrieved?.cached).toBe(true); // Should be marked as cached
    });

    it('should return null for missing key', async () => {
      const key = createMockCacheKey({ intentId: 'non-existent' });
      const result = await cache.get(key);
      expect(result).toBeNull();
    });

    it('should update existing entry', async () => {
      const key = createMockCacheKey();
      const decision1 = createMockDecision({ reason: 'First' });
      const decision2 = createMockDecision({ reason: 'Second' });

      await cache.set(key, decision1);
      await cache.set(key, decision2);

      const retrieved = await cache.get(key);
      expect(retrieved?.reason).toBe('Second');
    });
  });

  describe('expiration', () => {
    it('should expire entries after TTL', async () => {
      const shortCache = new DecisionCache({ ttlMs: 50 }); // 50ms TTL
      const key = createMockCacheKey();
      const decision = createMockDecision();

      await shortCache.set(key, decision);

      // Should be available immediately
      let result = await shortCache.get(key);
      expect(result).not.toBeNull();

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should be expired
      result = await shortCache.get(key);
      expect(result).toBeNull();

      shortCache.shutdown();
    });
  });

  describe('eviction', () => {
    it('should evict oldest entries when maxSize exceeded', async () => {
      const smallCache = new DecisionCache({ maxSize: 3, ttlMs: 60000 });

      // Add 4 entries
      for (let i = 0; i < 4; i++) {
        const key = createMockCacheKey({ intentId: `intent-${i}` });
        const decision = createMockDecision({ id: `decision-${i}` });
        await smallCache.set(key, decision);
      }

      // Should have evicted the oldest
      expect(smallCache.size()).toBe(3);

      smallCache.shutdown();
    });
  });

  describe('invalidate', () => {
    it('should invalidate specific intent', async () => {
      const key1 = createMockCacheKey({ intentId: 'intent-1' });
      const key2 = createMockCacheKey({ intentId: 'intent-2' });

      await cache.set(key1, createMockDecision({ id: 'decision-1' }));
      await cache.set(key2, createMockDecision({ id: 'decision-2' }));

      await cache.invalidate('intent-1');

      expect(await cache.get(key1)).toBeNull();
      expect(await cache.get(key2)).not.toBeNull();
    });

    it('should invalidate all entries for tenant', async () => {
      const key1 = createMockCacheKey({ tenantId: 'tenant-A', intentId: 'intent-1' });
      const key2 = createMockCacheKey({ tenantId: 'tenant-A', intentId: 'intent-2' });
      const key3 = createMockCacheKey({ tenantId: 'tenant-B', intentId: 'intent-3' });

      await cache.set(key1, createMockDecision());
      await cache.set(key2, createMockDecision());
      await cache.set(key3, createMockDecision());

      await cache.invalidateTenant('tenant-A');

      expect(await cache.get(key1)).toBeNull();
      expect(await cache.get(key2)).toBeNull();
      expect(await cache.get(key3)).not.toBeNull();
    });
  });

  describe('clear', () => {
    it('should clear all entries', async () => {
      await cache.set(createMockCacheKey({ intentId: '1' }), createMockDecision());
      await cache.set(createMockCacheKey({ intentId: '2' }), createMockDecision());
      await cache.set(createMockCacheKey({ intentId: '3' }), createMockDecision());

      expect(cache.size()).toBe(3);

      await cache.clear();

      expect(cache.size()).toBe(0);
    });
  });

  describe('getCacheKey', () => {
    it('should generate cache key from context', () => {
      const context = createMockContext();
      const key = cache.getCacheKey(context);

      expect(key.tenantId).toBe(context.intent.tenantId);
      expect(key.intentId).toBe(context.intent.id);
      expect(key.entityId).toBe(context.entity.id);
      expect(key.trustLevel).toBe(context.entity.trustLevel);
    });

    it('should generate different keys for different contexts', () => {
      const context1 = createMockContext();
      const context2 = createMockContext();
      context2.intent.context = { different: 'context' };

      const key1 = cache.getCacheKey(context1);
      const key2 = cache.getCacheKey(context2);

      expect(key1.contextHash).not.toBe(key2.contextHash);
    });
  });

  describe('size', () => {
    it('should return current cache size', async () => {
      expect(cache.size()).toBe(0);

      await cache.set(createMockCacheKey({ intentId: '1' }), createMockDecision());
      expect(cache.size()).toBe(1);

      await cache.set(createMockCacheKey({ intentId: '2' }), createMockDecision());
      expect(cache.size()).toBe(2);
    });
  });
});

describe('singleton functions', () => {
  afterEach(() => {
    resetDecisionCache();
  });

  it('should return same instance from getDecisionCache', () => {
    const cache1 = getDecisionCache();
    const cache2 = getDecisionCache();
    expect(cache1).toBe(cache2);
    cache1.shutdown();
  });

  it('should create new instance with createDecisionCache', () => {
    const cache1 = createDecisionCache();
    const cache2 = createDecisionCache();
    expect(cache1).not.toBe(cache2);
    cache1.shutdown();
    cache2.shutdown();
  });

  it('should reset singleton with resetDecisionCache', () => {
    const cache1 = getDecisionCache();
    cache1.shutdown();
    resetDecisionCache();
    const cache2 = getDecisionCache();
    expect(cache1).not.toBe(cache2);
    cache2.shutdown();
  });
});
