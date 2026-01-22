/**
 * Decision Cache for ENFORCE Module
 *
 * Provides two-tier caching (local memory + Redis) for enforcement decisions
 * to reduce latency and database load for repeated evaluations.
 *
 * Features:
 * - Local in-memory cache with LRU eviction
 * - Redis distributed cache for cross-instance sharing
 * - TTL-based expiration with automatic cleanup
 * - Tenant-scoped invalidation support
 * - Prometheus metrics integration
 *
 * @packageDocumentation
 */

import { createLogger } from '../common/logger.js';
import { getRedis } from '../common/redis.js';
import { withCircuitBreakerResult } from '../common/circuit-breaker.js';
import type {
  DecisionCacheKey,
  EnforcementDecision,
  CacheEntry,
  DecisionCacheOptions,
  EnforcementContext,
} from './types.js';
import type { ID } from '../common/types.js';
import {
  recordCacheHit,
  recordCacheMiss,
  setCacheSize,
} from './metrics.js';
import crypto from 'crypto';

/**
 * Runtime validation for cached entries from Redis.
 * Guards against corrupted or malformed cache data.
 */
function isValidCacheEntry(data: unknown): data is CacheEntry {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;

  // Check required CacheEntry fields
  if (typeof obj.expiresAt !== 'number') return false;
  if (typeof obj.accessCount !== 'number') return false;
  if (typeof obj.lastAccessedAt !== 'number') return false;

  // Check decision object exists and has required fields
  const decision = obj.decision;
  if (!decision || typeof decision !== 'object') return false;
  const dec = decision as Record<string, unknown>;

  if (typeof dec.id !== 'string') return false;
  if (typeof dec.intentId !== 'string') return false;
  if (typeof dec.action !== 'string') return false;
  if (!Array.isArray(dec.rulesEvaluated)) return false;
  if (typeof dec.trustScore !== 'number') return false;
  if (typeof dec.trustLevel !== 'number') return false;

  return true;
}

const logger = createLogger({ component: 'decision-cache' });

// ============================================================================
// Configuration Constants
// ============================================================================

/** Default TTL in milliseconds (1 minute) */
const DEFAULT_TTL_MS = 60000;

/** Default maximum local cache size */
const DEFAULT_MAX_SIZE = 10000;

/** Default Redis key prefix */
const DEFAULT_REDIS_PREFIX = 'enforce:decision:';

/** Cleanup interval in milliseconds (30 seconds) */
const CLEANUP_INTERVAL_MS = 30000;

// ============================================================================
// Decision Cache Class
// ============================================================================

/**
 * Two-tier decision cache with local memory and Redis backing
 */
export class DecisionCache {
  private localCache: Map<string, CacheEntry>;
  private ttlMs: number;
  private maxSize: number;
  private redisPrefix: string;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(options?: DecisionCacheOptions) {
    this.localCache = new Map();
    this.ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
    this.maxSize = options?.maxSize ?? DEFAULT_MAX_SIZE;
    this.redisPrefix = options?.redisPrefix ?? DEFAULT_REDIS_PREFIX;

    // Start periodic cleanup
    this.startCleanupTimer();

    logger.info(
      { ttlMs: this.ttlMs, maxSize: this.maxSize, redisPrefix: this.redisPrefix },
      'Decision cache initialized'
    );
  }

  /**
   * Get a cached decision
   *
   * Checks local cache first, then falls back to Redis.
   * Updates access metadata for LRU tracking.
   *
   * @param key - The cache key components
   * @returns The cached decision or null if not found/expired
   */
  async get(key: DecisionCacheKey): Promise<EnforcementDecision | null> {
    const cacheKeyString = this.buildCacheKeyString(key);

    // Check local cache first (fastest)
    const localEntry = this.localCache.get(cacheKeyString);
    if (localEntry) {
      if (this.isExpired(localEntry)) {
        this.localCache.delete(cacheKeyString);
        logger.debug({ key: cacheKeyString }, 'Local cache entry expired');
      } else {
        // Update access metadata
        localEntry.accessCount++;
        localEntry.lastAccessedAt = Date.now();
        recordCacheHit(key.tenantId);
        logger.debug({ key: cacheKeyString, source: 'local' }, 'Decision cache hit');
        return localEntry.decision;
      }
    }

    // Check Redis cache (distributed) with circuit breaker
    const redisResult = await withCircuitBreakerResult('decisionCacheRead', async () => {
      const redis = getRedis();
      const redisCached = await redis.get(this.redisPrefix + cacheKeyString);

      if (redisCached) {
        // Parse and validate cached data
        let parsed: unknown;
        try {
          parsed = JSON.parse(redisCached);
        } catch {
          logger.warn({ key: cacheKeyString }, 'Corrupted JSON in Redis cache, deleting');
          await redis.del(this.redisPrefix + cacheKeyString);
          return null;
        }

        if (!isValidCacheEntry(parsed)) {
          logger.warn({ key: cacheKeyString }, 'Invalid cache entry format in Redis, deleting');
          await redis.del(this.redisPrefix + cacheKeyString);
          return null;
        }

        const entry: CacheEntry = parsed;

        if (this.isExpired(entry)) {
          // Clean up expired Redis entry
          await redis.del(this.redisPrefix + cacheKeyString);
          logger.debug({ key: cacheKeyString }, 'Redis cache entry expired');
          return null;
        }

        // Update entry and store in local cache
        entry.accessCount++;
        entry.lastAccessedAt = Date.now();
        this.storeLocal(cacheKeyString, entry, key.tenantId);
        recordCacheHit(key.tenantId);
        logger.debug({ key: cacheKeyString, source: 'redis' }, 'Decision cache hit');
        return entry.decision;
      }
      return null;
    });

    if (redisResult.success && redisResult.result) {
      return redisResult.result;
    }

    if (redisResult.circuitOpen) {
      logger.warn({ key: cacheKeyString }, 'Decision cache circuit breaker open, skipping Redis');
    } else if (!redisResult.success) {
      logger.warn(
        { error: redisResult.error, key: cacheKeyString },
        'Failed to read from Redis decision cache'
      );
    }

    // Cache miss
    recordCacheMiss(key.tenantId);
    logger.debug({ key: cacheKeyString }, 'Decision cache miss');
    return null;
  }

  /**
   * Store a decision in the cache
   *
   * Stores in both local memory and Redis for distributed access.
   *
   * @param key - The cache key components
   * @param decision - The enforcement decision to cache
   */
  async set(key: DecisionCacheKey, decision: EnforcementDecision): Promise<void> {
    const cacheKeyString = this.buildCacheKeyString(key);
    const now = Date.now();

    const entry: CacheEntry = {
      decision,
      expiresAt: now + this.ttlMs,
      accessCount: 1,
      lastAccessedAt: now,
    };

    // Store in local cache
    this.storeLocal(cacheKeyString, entry, key.tenantId);

    // Store in Redis with circuit breaker
    const writeResult = await withCircuitBreakerResult('decisionCacheWrite', async () => {
      const redis = getRedis();
      const ttlSeconds = Math.ceil(this.ttlMs / 1000);
      await redis.setex(
        this.redisPrefix + cacheKeyString,
        ttlSeconds,
        JSON.stringify(entry)
      );
      return true;
    });

    if (writeResult.success) {
      logger.debug({ key: cacheKeyString, ttlMs: this.ttlMs }, 'Decision cached');
    } else if (writeResult.circuitOpen) {
      logger.warn({ key: cacheKeyString }, 'Decision cache write circuit open, local cache only');
    } else {
      logger.warn(
        { error: writeResult.error, key: cacheKeyString },
        'Failed to write to Redis decision cache'
      );
    }
  }

  /**
   * Invalidate a specific cache entry by intent ID
   *
   * @param intentId - The intent ID to invalidate
   */
  async invalidate(intentId: ID): Promise<void> {
    let localDeleted = 0;

    // Remove from local cache
    for (const [key, entry] of this.localCache.entries()) {
      if (entry.decision.intentId === intentId) {
        this.localCache.delete(key);
        localDeleted++;
      }
    }

    // Remove from Redis
    try {
      const redis = getRedis();
      const pattern = `${this.redisPrefix}*:${intentId}:*`;
      let cursor = '0';
      let redisDeleted = 0;

      do {
        const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;

        if (keys.length > 0) {
          await redis.del(...keys);
          redisDeleted += keys.length;
        }
      } while (cursor !== '0');

      logger.info(
        { intentId, localDeleted, redisDeleted },
        'Decision cache invalidated for intent'
      );
    } catch (error) {
      logger.warn({ error, intentId }, 'Failed to invalidate Redis decision cache for intent');
    }
  }

  /**
   * Invalidate all cache entries for a tenant
   *
   * @param tenantId - The tenant ID to invalidate
   */
  async invalidateTenant(tenantId: ID): Promise<void> {
    let localDeleted = 0;

    // Remove from local cache
    for (const [key, entry] of this.localCache.entries()) {
      if (entry.decision.tenantId === tenantId) {
        this.localCache.delete(key);
        localDeleted++;
      }
    }

    // Update cache size metric
    setCacheSize(tenantId, 0);

    // Remove from Redis
    try {
      const redis = getRedis();
      const pattern = `${this.redisPrefix}${tenantId}:*`;
      let cursor = '0';
      let redisDeleted = 0;

      do {
        const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;

        if (keys.length > 0) {
          await redis.del(...keys);
          redisDeleted += keys.length;
        }
      } while (cursor !== '0');

      logger.info(
        { tenantId, localDeleted, redisDeleted },
        'Decision cache invalidated for tenant'
      );
    } catch (error) {
      logger.warn({ error, tenantId }, 'Failed to invalidate Redis decision cache for tenant');
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    const localSize = this.localCache.size;
    this.localCache.clear();

    // Clear Redis
    try {
      const redis = getRedis();
      const pattern = `${this.redisPrefix}*`;
      let cursor = '0';
      let redisDeleted = 0;

      do {
        const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;

        if (keys.length > 0) {
          await redis.del(...keys);
          redisDeleted += keys.length;
        }
      } while (cursor !== '0');

      logger.info({ localSize, redisDeleted }, 'Decision cache cleared');
    } catch (error) {
      logger.warn({ error }, 'Failed to clear Redis decision cache');
    }
  }

  /**
   * Generate a cache key from an enforcement context
   *
   * @param context - The enforcement context
   * @returns A cache key with all relevant components
   */
  getCacheKey(context: EnforcementContext): DecisionCacheKey {
    const contextHash = this.hashContext(context.intent.context ?? {});

    return {
      tenantId: context.intent.tenantId,
      intentId: context.intent.id,
      entityId: context.entity.id,
      intentType: context.intent.intentType ?? 'default',
      contextHash,
      trustLevel: context.entity.trustLevel,
    };
  }

  /**
   * Get the current size of the local cache
   *
   * @returns Number of entries in the local cache
   */
  size(): number {
    return this.localCache.size;
  }

  /**
   * Shutdown the cache and stop cleanup timers
   */
  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    logger.info('Decision cache shutdown');
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Build a string cache key from key components
   */
  private buildCacheKeyString(key: DecisionCacheKey): string {
    return `${key.tenantId}:${key.intentId}:${key.trustLevel}:${key.contextHash}`;
  }

  /**
   * Check if a cache entry has expired
   */
  private isExpired(entry: CacheEntry): boolean {
    return Date.now() >= entry.expiresAt;
  }

  /**
   * Store an entry in the local cache with LRU eviction
   */
  private storeLocal(key: string, entry: CacheEntry, tenantId: ID): void {
    // Evict oldest entries if at capacity
    if (this.localCache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.localCache.set(key, entry);

    // Update cache size metric
    setCacheSize(tenantId, this.localCache.size);
  }

  /**
   * Evict the least recently accessed entry from the local cache
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestAccessTime = Infinity;

    for (const [key, entry] of this.localCache.entries()) {
      if (entry.lastAccessedAt < oldestAccessTime) {
        oldestAccessTime = entry.lastAccessedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.localCache.delete(oldestKey);
      logger.debug({ key: oldestKey }, 'Evicted oldest cache entry');
    }
  }

  /**
   * Remove all expired entries from the local cache
   */
  private cleanupExpired(): void {
    const now = Date.now();
    let cleaned = 0;
    const tenantSizes = new Map<ID, number>();

    for (const [key, entry] of this.localCache.entries()) {
      if (now >= entry.expiresAt) {
        this.localCache.delete(key);
        cleaned++;
      } else {
        // Track per-tenant sizes
        const tenantId = entry.decision.tenantId;
        tenantSizes.set(tenantId, (tenantSizes.get(tenantId) ?? 0) + 1);
      }
    }

    // Update per-tenant cache size metrics
    for (const [tenantId, size] of tenantSizes.entries()) {
      setCacheSize(tenantId, size);
    }

    if (cleaned > 0) {
      logger.debug({ cleaned, remaining: this.localCache.size }, 'Cleaned expired cache entries');
    }
  }

  /**
   * Start the periodic cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
    }, CLEANUP_INTERVAL_MS);

    // Don't prevent process exit
    this.cleanupTimer.unref();
  }

  /**
   * Hash context for cache key differentiation
   */
  private hashContext(context: Record<string, unknown>): string {
    const keys = Object.keys(context).sort();
    const sortedContext = JSON.stringify(context, keys);
    return crypto.createHash('sha256').update(sortedContext).digest('hex').substring(0, 16);
  }
}

// ============================================================================
// Singleton Pattern
// ============================================================================

/** Singleton instance */
let cacheInstance: DecisionCache | null = null;

/**
 * Get the shared decision cache instance
 *
 * Creates a new instance with default options if one doesn't exist.
 *
 * @returns The shared DecisionCache instance
 */
export function getDecisionCache(): DecisionCache {
  if (!cacheInstance) {
    cacheInstance = new DecisionCache();
  }
  return cacheInstance;
}

/**
 * Create a new decision cache instance with custom options
 *
 * Note: This creates a new instance separate from the singleton.
 * Use getDecisionCache() for the shared instance.
 *
 * @param options - Cache configuration options
 * @returns A new DecisionCache instance
 */
export function createDecisionCache(options?: DecisionCacheOptions): DecisionCache {
  return new DecisionCache(options);
}

/**
 * Reset the singleton decision cache instance
 *
 * Primarily for testing purposes. Shuts down the existing instance
 * and allows a fresh instance to be created on next access.
 */
export function resetDecisionCache(): void {
  if (cacheInstance) {
    cacheInstance.shutdown();
    cacheInstance = null;
  }
}
