/**
 * Execution Cache for COGNIGATE Module
 *
 * Provides two-tier caching (local memory + Redis) for execution results
 * to reduce latency and database load for repeated or idempotent executions.
 *
 * Features:
 * - Local in-memory cache with LRU eviction
 * - Redis distributed cache for cross-instance sharing
 * - TTL-based expiration with automatic cleanup
 * - Context-based cache key generation with SHA-256 hashing
 * - Tenant and intent scoped invalidation
 * - Circuit breaker protection on Redis operations
 * - Prometheus metrics integration (hit/miss/eviction tracking)
 *
 * @packageDocumentation
 */

import { createLogger } from '../common/logger.js';
import { getRedis } from '../common/redis.js';
import { withCircuitBreakerResult } from '../common/circuit-breaker.js';
import type { ID } from '../common/types.js';
import { createHash } from 'node:crypto';
import {
  recordCacheHit,
  recordCacheMiss,
  setCacheSize,
  recordCacheEviction,
} from './metrics.js';

const logger = createLogger({ component: 'execution-cache' });

// =============================================================================
// CONSTANTS
// =============================================================================

/** Default TTL in milliseconds (5 minutes) */
const DEFAULT_TTL_MS = 300_000;

/** Default maximum local cache size */
const DEFAULT_MAX_SIZE = 5000;

/** Default cleanup interval in milliseconds (60 seconds) */
const DEFAULT_CLEANUP_INTERVAL_MS = 60_000;

/** Redis key prefix for execution cache entries */
const REDIS_KEY_PREFIX = 'cognigate:exec:';

/** Redis key prefix for tenant index */
const REDIS_TENANT_PREFIX = 'cognigate:tenant:';

/** Redis key prefix for intent index */
const REDIS_INTENT_PREFIX = 'cognigate:intent:';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Cached execution result
 */
export interface ExecutionResult {
  /** The intent ID that was executed */
  intentId: ID;
  /** Whether execution was successful */
  success: boolean;
  /** Execution outputs */
  outputs: Record<string, unknown>;
  /** Resource usage during execution */
  resourceUsage: {
    memoryPeakMb: number;
    cpuTimeMs: number;
    wallTimeMs: number;
    networkRequests: number;
    fileSystemOps: number;
  };
  /** When execution started */
  startedAt: string;
  /** When execution completed */
  completedAt: string;
  /** Error message if failed */
  error?: string;
  /** Whether this result came from cache */
  cached?: boolean;
}

/**
 * Internal cache entry wrapping the execution result with metadata
 */
interface ExecutionCacheEntry {
  /** The cached execution result */
  result: ExecutionResult;
  /** When this entry expires (Unix timestamp in ms) */
  expiresAt: number;
  /** Number of times this entry has been accessed */
  accessCount: number;
  /** Last access timestamp (Unix ms) for LRU eviction */
  lastAccessedAt: number;
  /** Tenant ID for invalidation support */
  tenantId: ID;
  /** Intent ID for invalidation support */
  intentId: ID;
  /** Handler name for invalidation support */
  handlerName: string;
}

/**
 * Cache key components for deterministic key generation
 */
export interface ExecutionCacheKey {
  /** Tenant ID */
  tenantId: ID;
  /** Intent ID being executed */
  intentId: ID;
  /** Handler processing the execution */
  handlerName: string;
  /** SHA-256 hash of the execution context */
  contextHash: string;
}

/**
 * Configuration options for the execution cache
 */
export interface ExecutionCacheOptions {
  /** Maximum number of entries in local cache (default: 5000) */
  maxSize?: number;
  /** Time-to-live in milliseconds (default: 300000 / 5 minutes) */
  ttlMs?: number;
  /** Cleanup interval in milliseconds (default: 60000 / 1 minute) */
  cleanupIntervalMs?: number;
}

// =============================================================================
// EXECUTION CACHE CLASS
// =============================================================================

/**
 * Two-tier execution cache with local memory and Redis backing
 *
 * Provides fast local access with LRU eviction and distributed
 * Redis storage for cross-instance cache sharing.
 */
export class ExecutionCache {
  /** Local in-memory cache */
  private localCache: Map<string, ExecutionCacheEntry>;
  /** Maximum local cache size */
  private maxSize: number;
  /** Time-to-live in milliseconds */
  private ttlMs: number;
  /** Periodic cleanup timer */
  private cleanupInterval?: NodeJS.Timeout;

  /** Hit counter for rate calculation */
  private hitCount: number = 0;
  /** Miss counter for rate calculation */
  private missCount: number = 0;

  constructor(options?: ExecutionCacheOptions) {
    this.localCache = new Map();
    this.maxSize = options?.maxSize ?? DEFAULT_MAX_SIZE;
    this.ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;

    // Start periodic cleanup
    const cleanupMs = options?.cleanupIntervalMs ?? DEFAULT_CLEANUP_INTERVAL_MS;
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, cleanupMs);

    // Don't prevent process exit
    this.cleanupInterval.unref();

    logger.info(
      { maxSize: this.maxSize, ttlMs: this.ttlMs, cleanupIntervalMs: cleanupMs },
      'Execution cache initialized'
    );
  }

  // ===========================================================================
  // CORE OPERATIONS
  // ===========================================================================

  /**
   * Get a cached execution result
   *
   * Checks local cache first (L1), then falls back to Redis (L2).
   * Updates access metadata for LRU tracking on each access.
   *
   * @param key - The cache key components
   * @returns The cached execution result or null if not found/expired
   */
  async get(key: ExecutionCacheKey): Promise<ExecutionResult | null> {
    const serializedKey = this.serializeKey(key);

    // L1: Check local cache first (fastest path)
    const localResult = this.getFromLocal(serializedKey);
    if (localResult) {
      this.hitCount++;
      recordCacheHit();
      logger.debug({ key: serializedKey, source: 'local' }, 'Execution cache hit');
      return { ...localResult, cached: true };
    }

    // L2: Check Redis cache (distributed) with circuit breaker protection
    const redisResult = await this.getFromRedis(serializedKey);
    if (redisResult) {
      // Promote to local cache
      this.setLocal(serializedKey, redisResult, key.tenantId, key.intentId, key.handlerName);
      this.hitCount++;
      recordCacheHit();
      logger.debug({ key: serializedKey, source: 'redis' }, 'Execution cache hit');
      return { ...redisResult, cached: true };
    }

    // Cache miss
    this.missCount++;
    recordCacheMiss();
    logger.debug({ key: serializedKey }, 'Execution cache miss');
    return null;
  }

  /**
   * Store an execution result in the cache
   *
   * Stores in both local memory (L1) and Redis (L2) for
   * fast access and cross-instance sharing.
   *
   * @param key - The cache key components
   * @param result - The execution result to cache
   */
  async set(key: ExecutionCacheKey, result: ExecutionResult): Promise<void> {
    const serializedKey = this.serializeKey(key);

    // L1: Store in local cache
    this.setLocal(serializedKey, result, key.tenantId, key.intentId, key.handlerName);

    // L2: Store in Redis with circuit breaker
    await this.setRedis(serializedKey, result, key.tenantId, key.intentId);

    logger.debug({ key: serializedKey, ttlMs: this.ttlMs }, 'Execution result cached');
  }

  // ===========================================================================
  // INVALIDATION
  // ===========================================================================

  /**
   * Invalidate a specific execution from cache
   *
   * Removes all cache entries associated with the given execution ID
   * from both local and Redis caches.
   *
   * @param executionId - The execution ID to invalidate
   */
  async invalidate(executionId: ID): Promise<void> {
    let localDeleted = 0;

    // Remove from local cache - scan for entries with matching intentId
    for (const [key, entry] of this.localCache.entries()) {
      if (entry.result.intentId === executionId || entry.intentId === executionId) {
        this.localCache.delete(key);
        localDeleted++;
      }
    }

    // Remove from Redis
    try {
      const redis = getRedis();
      const pattern = `${REDIS_KEY_PREFIX}*`;
      let cursor = '0';
      let redisDeleted = 0;

      do {
        const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;

        for (const redisKey of keys) {
          const cached = await redis.get(redisKey);
          if (cached) {
            try {
              const entry = JSON.parse(cached);
              if (entry?.result?.intentId === executionId) {
                await redis.del(redisKey);
                redisDeleted++;
              }
            } catch {
              // Skip malformed entries
            }
          }
        }
      } while (cursor !== '0');

      logger.info(
        { executionId, localDeleted, redisDeleted },
        'Execution cache invalidated'
      );
    } catch (error) {
      logger.warn({ error, executionId }, 'Failed to invalidate Redis execution cache');
    }

    this.updateSizeMetric();
  }

  /**
   * Invalidate all cache entries for a specific intent
   *
   * @param intentId - The intent ID to invalidate
   */
  async invalidateByIntent(intentId: ID): Promise<void> {
    let localDeleted = 0;

    // Remove from local cache
    for (const [key, entry] of this.localCache.entries()) {
      if (entry.intentId === intentId) {
        this.localCache.delete(key);
        localDeleted++;
      }
    }

    // Remove from Redis using intent index
    try {
      const redis = getRedis();
      const indexKey = `${REDIS_INTENT_PREFIX}${intentId}`;
      const members = await redis.smembers(indexKey);

      if (members.length > 0) {
        await redis.del(...members);
        await redis.del(indexKey);
      }

      logger.info(
        { intentId, localDeleted, redisDeleted: members.length },
        'Execution cache invalidated by intent'
      );
    } catch (error) {
      logger.warn({ error, intentId }, 'Failed to invalidate Redis cache by intent');
    }

    this.updateSizeMetric();
  }

  /**
   * Invalidate all cache entries for a specific tenant
   *
   * @param tenantId - The tenant ID to invalidate
   */
  async invalidateTenant(tenantId: ID): Promise<void> {
    let localDeleted = 0;

    // Remove from local cache
    for (const [key, entry] of this.localCache.entries()) {
      if (entry.tenantId === tenantId) {
        this.localCache.delete(key);
        localDeleted++;
      }
    }

    // Remove from Redis using tenant index
    try {
      const redis = getRedis();
      const indexKey = `${REDIS_TENANT_PREFIX}${tenantId}`;
      const members = await redis.smembers(indexKey);

      if (members.length > 0) {
        await redis.del(...members);
        await redis.del(indexKey);
      }

      logger.info(
        { tenantId, localDeleted, redisDeleted: members.length },
        'Execution cache invalidated for tenant'
      );
    } catch (error) {
      logger.warn({ error, tenantId }, 'Failed to invalidate Redis cache for tenant');
    }

    this.updateSizeMetric();
  }

  /**
   * Clear all cache entries from both L1 and L2
   */
  async clear(): Promise<void> {
    const localSize = this.localCache.size;
    this.localCache.clear();

    // Clear Redis entries
    try {
      const redis = getRedis();
      const patterns = [
        `${REDIS_KEY_PREFIX}*`,
        `${REDIS_TENANT_PREFIX}*`,
        `${REDIS_INTENT_PREFIX}*`,
      ];

      let redisDeleted = 0;

      for (const pattern of patterns) {
        let cursor = '0';
        do {
          const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
          cursor = nextCursor;
          if (keys.length > 0) {
            await redis.del(...keys);
            redisDeleted += keys.length;
          }
        } while (cursor !== '0');
      }

      logger.info({ localSize, redisDeleted }, 'Execution cache cleared');
    } catch (error) {
      logger.warn({ error }, 'Failed to clear Redis execution cache');
    }

    this.hitCount = 0;
    this.missCount = 0;
    this.updateSizeMetric();
  }

  // ===========================================================================
  // KEY GENERATION
  // ===========================================================================

  /**
   * Generate a cache key from execution parameters
   *
   * Creates a deterministic cache key by hashing the execution context
   * with SHA-256 for consistent key generation across instances.
   *
   * @param tenantId - Tenant identifier
   * @param intentId - Intent identifier
   * @param handlerName - Handler name
   * @param context - Execution context to hash
   * @returns A structured cache key
   */
  getCacheKey(
    tenantId: ID,
    intentId: ID,
    handlerName: string,
    context: Record<string, unknown>
  ): ExecutionCacheKey {
    return {
      tenantId,
      intentId,
      handlerName,
      contextHash: this.hashContext(context),
    };
  }

  // ===========================================================================
  // STATISTICS
  // ===========================================================================

  /**
   * Get the current number of entries in the local cache
   */
  size(): number {
    return this.localCache.size;
  }

  /**
   * Get the cache hit rate (0-1)
   *
   * Returns the ratio of hits to total requests.
   * Returns 0 if no requests have been made.
   */
  hitRate(): number {
    const total = this.hitCount + this.missCount;
    if (total === 0) return 0;
    return this.hitCount / total;
  }

  // ===========================================================================
  // LIFECYCLE
  // ===========================================================================

  /**
   * Shutdown the cache and stop cleanup timers
   *
   * Should be called during graceful shutdown to clean up
   * interval timers and prevent memory leaks.
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      delete this.cleanupInterval;
    }
    logger.info({ size: this.localCache.size }, 'Execution cache shutdown');
  }

  // ===========================================================================
  // PRIVATE: KEY SERIALIZATION
  // ===========================================================================

  /**
   * Serialize a cache key to a string for use as a Map/Redis key
   */
  private serializeKey(key: ExecutionCacheKey): string {
    return `${key.tenantId}:${key.intentId}:${key.handlerName}:${key.contextHash}`;
  }

  // ===========================================================================
  // PRIVATE: LRU EVICTION
  // ===========================================================================

  /**
   * Evict the least recently used entry from the local cache
   *
   * Finds the entry with the oldest lastAccessedAt timestamp
   * and removes it to make room for new entries.
   */
  private evictLRU(): void {
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
      recordCacheEviction();
      logger.debug({ key: oldestKey }, 'Evicted LRU cache entry');
    }
  }

  // ===========================================================================
  // PRIVATE: EXPIRATION
  // ===========================================================================

  /**
   * Check if a cache entry has expired
   */
  private isExpired(entry: ExecutionCacheEntry): boolean {
    return Date.now() >= entry.expiresAt;
  }

  /**
   * Remove all expired entries from the local cache
   */
  private cleanupExpired(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.localCache.entries()) {
      if (now >= entry.expiresAt) {
        this.localCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug({ cleaned, remaining: this.localCache.size }, 'Cleaned expired execution cache entries');
      this.updateSizeMetric();
    }
  }

  // ===========================================================================
  // PRIVATE: CONTEXT HASHING
  // ===========================================================================

  /**
   * Hash an execution context for cache key differentiation
   *
   * Sorts keys deterministically before hashing to ensure the same
   * context always produces the same hash regardless of key order.
   */
  private hashContext(context: Record<string, unknown>): string {
    const keys = Object.keys(context).sort();
    const sortedContext = JSON.stringify(context, keys);
    return createHash('sha256')
      .update(sortedContext)
      .digest('hex')
      .substring(0, 16);
  }

  // ===========================================================================
  // PRIVATE: LOCAL CACHE OPERATIONS
  // ===========================================================================

  /**
   * Get a result from the local cache
   *
   * Returns null if not found or expired. Updates access metadata
   * for LRU tracking on successful access.
   */
  private getFromLocal(key: string): ExecutionResult | null {
    const entry = this.localCache.get(key);
    if (!entry) return null;

    if (this.isExpired(entry)) {
      this.localCache.delete(key);
      logger.debug({ key }, 'Local cache entry expired');
      return null;
    }

    // Update access metadata for LRU
    entry.accessCount++;
    entry.lastAccessedAt = Date.now();

    return entry.result;
  }

  /**
   * Store a result in the local cache with LRU eviction
   */
  private setLocal(
    key: string,
    result: ExecutionResult,
    tenantId: ID,
    intentId: ID,
    handlerName: string
  ): void {
    // Evict if at capacity
    if (this.localCache.size >= this.maxSize && !this.localCache.has(key)) {
      this.evictLRU();
    }

    const now = Date.now();
    const entry: ExecutionCacheEntry = {
      result,
      expiresAt: now + this.ttlMs,
      accessCount: 1,
      lastAccessedAt: now,
      tenantId,
      intentId,
      handlerName,
    };

    this.localCache.set(key, entry);
    this.updateSizeMetric();
  }

  // ===========================================================================
  // PRIVATE: REDIS CACHE OPERATIONS
  // ===========================================================================

  /**
   * Get a result from Redis with circuit breaker protection
   *
   * Validates the structure of cached data before returning
   * to protect against corrupted cache entries.
   */
  private async getFromRedis(key: string): Promise<ExecutionResult | null> {
    const redisKey = `${REDIS_KEY_PREFIX}${key}`;

    const result = await withCircuitBreakerResult('executionCacheRead', async () => {
      const redis = getRedis();
      const cached = await redis.get(redisKey);

      if (!cached) return null;

      // Parse and validate
      let parsed: unknown;
      try {
        parsed = JSON.parse(cached);
      } catch {
        logger.warn({ key: redisKey }, 'Corrupted JSON in Redis execution cache, deleting');
        await redis.del(redisKey);
        return null;
      }

      if (!this.validateCacheEntry(parsed)) {
        logger.warn({ key: redisKey }, 'Invalid execution cache entry format in Redis, deleting');
        await redis.del(redisKey);
        return null;
      }

      const entry = parsed as ExecutionCacheEntry;

      if (this.isExpired(entry)) {
        await redis.del(redisKey);
        logger.debug({ key: redisKey }, 'Redis execution cache entry expired');
        return null;
      }

      return entry.result;
    });

    if (result.success) {
      return result.result ?? null;
    }

    if (result.circuitOpen) {
      logger.warn({ key }, 'Execution cache read circuit breaker open');
    } else if (!result.success) {
      logger.warn({ error: result.error, key }, 'Failed to read from Redis execution cache');
    }

    return null;
  }

  /**
   * Store a result in Redis with circuit breaker protection
   *
   * Also maintains tenant and intent indexes for efficient
   * scoped invalidation.
   */
  private async setRedis(
    key: string,
    result: ExecutionResult,
    tenantId: ID,
    intentId: ID
  ): Promise<void> {
    const redisKey = `${REDIS_KEY_PREFIX}${key}`;
    const ttlSeconds = Math.ceil(this.ttlMs / 1000);

    const now = Date.now();
    const entry: ExecutionCacheEntry = {
      result,
      expiresAt: now + this.ttlMs,
      accessCount: 1,
      lastAccessedAt: now,
      tenantId,
      intentId,
      handlerName: '',
    };

    const writeResult = await withCircuitBreakerResult('executionCacheWrite', async () => {
      const redis = getRedis();

      // Store the cache entry
      await redis.setex(redisKey, ttlSeconds, JSON.stringify(entry));

      // Maintain tenant index for scoped invalidation
      const tenantIndexKey = `${REDIS_TENANT_PREFIX}${tenantId}`;
      await redis.sadd(tenantIndexKey, redisKey);
      await redis.expire(tenantIndexKey, ttlSeconds + 60); // Index lives slightly longer

      // Maintain intent index for scoped invalidation
      const intentIndexKey = `${REDIS_INTENT_PREFIX}${intentId}`;
      await redis.sadd(intentIndexKey, redisKey);
      await redis.expire(intentIndexKey, ttlSeconds + 60);

      return true;
    });

    if (writeResult.circuitOpen) {
      logger.warn({ key }, 'Execution cache write circuit breaker open, local only');
    } else if (!writeResult.success) {
      logger.warn({ error: writeResult.error, key }, 'Failed to write to Redis execution cache');
    }
  }

  // ===========================================================================
  // PRIVATE: VALIDATION
  // ===========================================================================

  /**
   * Validate that a parsed Redis entry has the expected structure
   *
   * Guards against corrupted or malformed cache data that may have
   * been stored by a different version or corrupted in transit.
   */
  private validateCacheEntry(data: unknown): data is ExecutionCacheEntry {
    if (!data || typeof data !== 'object') return false;
    const obj = data as Record<string, unknown>;

    // Check required ExecutionCacheEntry fields
    if (typeof obj.expiresAt !== 'number') return false;
    if (typeof obj.accessCount !== 'number') return false;
    if (typeof obj.lastAccessedAt !== 'number') return false;

    // Check result object exists and has required fields
    const result = obj.result;
    if (!result || typeof result !== 'object') return false;
    const res = result as Record<string, unknown>;

    if (typeof res.intentId !== 'string') return false;
    if (typeof res.success !== 'boolean') return false;
    if (!res.outputs || typeof res.outputs !== 'object') return false;
    if (typeof res.startedAt !== 'string') return false;
    if (typeof res.completedAt !== 'string') return false;

    // Validate resourceUsage structure
    const usage = res.resourceUsage;
    if (!usage || typeof usage !== 'object') return false;
    const usageObj = usage as Record<string, unknown>;
    if (typeof usageObj.memoryPeakMb !== 'number') return false;
    if (typeof usageObj.cpuTimeMs !== 'number') return false;
    if (typeof usageObj.wallTimeMs !== 'number') return false;

    return true;
  }

  // ===========================================================================
  // PRIVATE: METRICS
  // ===========================================================================

  /**
   * Update the cache size metric
   */
  private updateSizeMetric(): void {
    setCacheSize(this.localCache.size);
  }
}

// =============================================================================
// SINGLETON PATTERN
// =============================================================================

/** Singleton cache instance */
let cacheInstance: ExecutionCache | null = null;

/**
 * Get the shared execution cache instance
 *
 * Creates a new instance with default options if one doesn't exist.
 *
 * @returns The shared ExecutionCache instance
 */
export function getExecutionCache(): ExecutionCache {
  if (!cacheInstance) {
    cacheInstance = new ExecutionCache();
  }
  return cacheInstance;
}

/**
 * Create a new execution cache instance with custom options
 *
 * Note: This creates a new instance separate from the singleton.
 * Use getExecutionCache() for the shared instance.
 *
 * @param options - Cache configuration options
 * @returns A new ExecutionCache instance
 */
export function createExecutionCache(options?: ExecutionCacheOptions): ExecutionCache {
  return new ExecutionCache(options);
}

/**
 * Reset the singleton execution cache instance
 *
 * Primarily for testing purposes. Shuts down the existing instance
 * and allows a fresh instance to be created on next access.
 */
export function resetExecutionCache(): void {
  if (cacheInstance) {
    cacheInstance.shutdown();
    cacheInstance = null;
  }
}
