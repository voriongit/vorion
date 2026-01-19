/**
 * Trust Score Cache with Stampede Prevention using XFetch Algorithm
 *
 * Implements the XFetch algorithm for probabilistic early refresh to prevent
 * cache stampede (thundering herd problem):
 *
 * XFetch Algorithm:
 * - Each cached item stores: value, fetchTime, ttl, delta (computation time)
 * - On read, calculate: currentTime - fetchTime > ttl - delta * beta * log(random())
 * - If true, proactively refresh in background while returning stale value
 * - beta is typically 1.0
 *
 * Additional features:
 * - TTL jitter to prevent synchronized expiration
 * - Background refresh without blocking the main request
 * - Metrics for monitoring cache behavior
 *
 * Key pattern: trust:${tenantId}:${entityId}
 *
 * @see https://cseweb.ucsd.edu/~avattani/papers/cache_stampede.pdf
 * @packageDocumentation
 */

import { getRedis } from './redis.js';
import { getConfig } from './config.js';
import { createLogger } from './logger.js';
import type { TrustRecord } from '../trust-engine/index.js';
import { Counter } from 'prom-client';
import { intentRegistry } from '../intent/metrics.js';

const logger = createLogger({ component: 'trust-cache' });

// ============================================================================
// Configuration Constants
// ============================================================================

/**
 * Default cache TTL in milliseconds (5 minutes)
 */
const DEFAULT_CACHE_TTL_MS = 300_000;

/**
 * Default cache TTL in seconds (5 minutes) - for legacy functions
 */
const CACHE_TTL_SECONDS = 300;

/**
 * Start early refresh checks in last 60 seconds of TTL (legacy)
 */
const EARLY_REFRESH_WINDOW_SECONDS = 60;

/**
 * Default tuning parameter for XFetch early refresh probability
 * Higher beta = more aggressive early refresh
 */
const DEFAULT_BETA = 1.0;

/**
 * Tuning parameter for early refresh probability (XFetch beta) - legacy alias
 */
const BETA = DEFAULT_BETA;

/**
 * Default jitter range as fraction of TTL (±10%)
 */
const DEFAULT_JITTER_FRACTION = 0.1;

/**
 * Maximum jitter percentage (0-10% of base TTL) - legacy alias
 */
const JITTER_PERCENTAGE = DEFAULT_JITTER_FRACTION;

/**
 * Redis key prefix for trust score cache
 */
const CACHE_KEY_PREFIX = 'trust';

/**
 * Redis key prefix for generic XFetch cache
 */
const XFETCH_KEY_PREFIX = 'xfetch';

/**
 * Default computation time estimate in ms (used when delta is unknown)
 */
const DEFAULT_DELTA_MS = 50;

// ============================================================================
// XFetch Cache Entry Types
// ============================================================================

/**
 * XFetch cache entry with timing metadata for probabilistic early refresh.
 *
 * The XFetch algorithm uses:
 * - fetchTime: when the value was computed/fetched
 * - ttl: time-to-live in milliseconds
 * - delta: computation time in milliseconds (used to scale refresh probability)
 *
 * @template T - The type of the cached value
 */
export interface XFetchCacheEntry<T> {
  /** The cached value */
  value: T;
  /** Unix timestamp when the value was fetched (milliseconds) */
  fetchTime: number;
  /** Time-to-live in milliseconds */
  ttl: number;
  /** Computation time in milliseconds (how long the fetch took) */
  delta: number;
}

/**
 * Options for XFetch cache operations
 */
export interface XFetchOptions {
  /**
   * Beta parameter for XFetch algorithm (default: 1.0)
   * Higher values = more aggressive early refresh
   */
  beta?: number;
  /**
   * Jitter fraction to apply to TTL (default: 0.1 for ±10%)
   * This helps prevent synchronized expiration across keys
   */
  jitter?: number;
}

/**
 * Cached trust score with timing metadata for PER (legacy format)
 */
interface CachedTrustScore {
  /** The trust record data */
  record: TrustRecord;
  /** Unix timestamp when cached (seconds) */
  cachedAt: number;
  /** Unix timestamp when entry expires (seconds) */
  expiresAt: number;
  /** Computation time in milliseconds (optional for backwards compatibility) */
  delta?: number;
}

// ============================================================================
// Cache Metrics
// ============================================================================

/**
 * Trust cache operations counter
 */
export const trustCacheOperations = new Counter({
  name: 'vorion_trust_cache_operations_total',
  help: 'Total trust cache operations',
  labelNames: ['operation', 'result'] as const,
  registers: [intentRegistry],
});

/**
 * XFetch early refresh counter - tracks proactive cache refreshes
 * triggered by the XFetch algorithm before TTL expiration
 */
export const cacheXFetchEarlyRefreshTotal = new Counter({
  name: 'vorion_cache_xfetch_early_refresh_total',
  help: 'Total number of early cache refreshes triggered by XFetch algorithm',
  labelNames: ['cache_type'] as const,
  registers: [intentRegistry],
});

/**
 * XFetch stale serve counter - tracks when stale data was served
 * while a background refresh was triggered
 */
export const cacheXFetchStaleServeTotal = new Counter({
  name: 'vorion_cache_xfetch_stale_serve_total',
  help: 'Total number of times stale data was served during XFetch background refresh',
  labelNames: ['cache_type'] as const,
  registers: [intentRegistry],
});

/**
 * Record a cache hit
 */
export function recordCacheHit(): void {
  trustCacheOperations.inc({ operation: 'get', result: 'hit' });
}

/**
 * Record a cache miss
 */
export function recordCacheMiss(): void {
  trustCacheOperations.inc({ operation: 'get', result: 'miss' });
}

/**
 * Record a cache set operation
 */
export function recordCacheSet(): void {
  trustCacheOperations.inc({ operation: 'set', result: 'success' });
}

/**
 * Record a cache invalidation
 */
export function recordCacheInvalidation(): void {
  trustCacheOperations.inc({ operation: 'invalidate', result: 'success' });
}

/**
 * Record a cache error
 */
export function recordCacheError(operation: string): void {
  trustCacheOperations.inc({ operation, result: 'error' });
}

/**
 * Record an early refresh triggered by PER (legacy)
 */
export function recordEarlyRefresh(): void {
  trustCacheOperations.inc({ operation: 'early_refresh', result: 'triggered' });
}

/**
 * Record an XFetch early refresh for a specific cache type
 */
export function recordXFetchEarlyRefresh(cacheType: string = 'trust'): void {
  cacheXFetchEarlyRefreshTotal.inc({ cache_type: cacheType });
}

/**
 * Record serving stale data during XFetch background refresh
 */
export function recordXFetchStaleServe(cacheType: string = 'trust'): void {
  cacheXFetchStaleServeTotal.inc({ cache_type: cacheType });
}

// ============================================================================
// TTL Jitter
// ============================================================================

/**
 * Add jitter to TTL to prevent synchronized expiration
 *
 * Adds 0-10% random jitter to the base TTL to stagger cache expiration
 * across multiple entries, reducing the chance of thundering herd.
 *
 * @param baseTTL - Base TTL in seconds
 * @returns TTL with jitter added
 */
export function getTTLWithJitter(baseTTL: number): number {
  const jitter = Math.random() * JITTER_PERCENTAGE * baseTTL;
  return Math.floor(baseTTL + jitter);
}

/**
 * Apply jitter to TTL in milliseconds with configurable range
 *
 * Applies random jitter within ±jitterFraction of the base TTL.
 * This staggers cache expiration across entries to prevent thundering herd.
 *
 * @param baseTtlMs - Base TTL in milliseconds
 * @param jitterFraction - Jitter range as fraction of TTL (default: 0.1 for ±10%)
 * @returns TTL with jitter applied (always positive)
 */
export function applyTTLJitter(baseTtlMs: number, jitterFraction: number = DEFAULT_JITTER_FRACTION): number {
  // Generate jitter in range [-jitterFraction, +jitterFraction]
  const jitterMultiplier = (Math.random() * 2 - 1) * jitterFraction;
  const jitteredTtl = baseTtlMs * (1 + jitterMultiplier);
  // Ensure TTL is always positive and at least 1ms
  return Math.max(1, Math.floor(jitteredTtl));
}

// ============================================================================
// XFetch Algorithm Implementation
// ============================================================================

/**
 * Determine if we should refresh early using the XFetch algorithm.
 *
 * The XFetch algorithm formula:
 *   shouldRefresh = currentTime - fetchTime > ttl - delta * beta * log(random())
 *
 * Where:
 * - currentTime: current timestamp
 * - fetchTime: when the cache entry was created
 * - ttl: time-to-live of the entry
 * - delta: computation time of the fetch operation
 * - beta: tuning parameter (typically 1.0)
 * - random(): uniform random value in (0, 1)
 *
 * Since log(random()) is negative (random is in (0,1)), the term
 * `-delta * beta * log(random())` is positive, effectively reducing the
 * TTL threshold. The longer the computation time (delta), the earlier
 * we start probabilistically refreshing.
 *
 * @param entry - The XFetch cache entry with timing metadata
 * @param beta - Tuning parameter (default: 1.0). Higher = more aggressive refresh
 * @returns true if the entry should be refreshed
 */
export function shouldRefresh<T>(entry: XFetchCacheEntry<T>, beta: number = DEFAULT_BETA): boolean {
  const now = Date.now();
  const age = now - entry.fetchTime;
  const expiresAt = entry.ttl;

  // If already expired, definitely refresh
  if (age >= expiresAt) {
    return true;
  }

  // XFetch formula: age > ttl - delta * beta * log(random())
  // Note: Math.random() returns (0, 1), so log(random) is negative
  // We use Math.max to avoid log(0) = -Infinity
  const random = Math.max(Math.random(), 1e-10);
  const logRandom = Math.log(random); // negative value
  const threshold = expiresAt + entry.delta * beta * logRandom; // threshold < expiresAt

  return age > threshold;
}

/**
 * Determine if we should refresh early using XFetch algorithm (legacy signature)
 *
 * The probability of refresh increases as the cache entry approaches expiration.
 * This spreads out refresh requests over time instead of all hitting at once
 * when the entry expires.
 *
 * @param cachedAt - Unix timestamp when entry was cached (seconds)
 * @param expiresAt - Unix timestamp when entry expires (seconds)
 * @param delta - Computation time in milliseconds (optional, defaults to using window-based calculation)
 * @returns true if early refresh should be triggered
 */
export function shouldRefreshEarly(cachedAt: number, expiresAt: number, delta?: number): boolean {
  const now = Date.now() / 1000;
  const remaining = expiresAt - now;

  // If already expired, definitely refresh
  if (remaining <= 0) {
    return true;
  }

  // If delta is provided, use XFetch formula
  if (delta !== undefined) {
    const ttlSeconds = expiresAt - cachedAt;
    const entry: XFetchCacheEntry<unknown> = {
      value: null,
      fetchTime: cachedAt * 1000, // Convert to ms
      ttl: ttlSeconds * 1000, // Convert to ms
      delta: delta, // Already in ms
    };
    return shouldRefresh(entry, BETA);
  }

  // Legacy behavior: window-based probability
  // If not in early refresh window, don't refresh
  if (remaining > EARLY_REFRESH_WINDOW_SECONDS) {
    return false;
  }

  // XFetch probability: increases as remaining decreases
  // probability = (window - remaining) / window * beta
  const probability =
    ((EARLY_REFRESH_WINDOW_SECONDS - remaining) / EARLY_REFRESH_WINDOW_SECONDS) * BETA;

  return Math.random() < probability;
}

// ============================================================================
// Cache Key Functions
// ============================================================================

/**
 * Build cache key for a trust score
 */
function buildCacheKey(tenantId: string, entityId: string): string {
  return `${CACHE_KEY_PREFIX}:${tenantId}:${entityId}`;
}

/**
 * Build cache key for generic XFetch cache
 */
function buildXFetchCacheKey(key: string): string {
  return `${XFETCH_KEY_PREFIX}:${key}`;
}

// ============================================================================
// Generic XFetch Cache-Aside Pattern
// ============================================================================

/**
 * In-flight refresh tracking to prevent duplicate background refreshes
 */
const inFlightRefreshes = new Map<string, Promise<unknown>>();

/**
 * Get a value from cache with XFetch stampede prevention.
 *
 * This implements the cache-aside pattern with the XFetch algorithm for
 * probabilistic early refresh. When a cache entry is approaching expiration,
 * XFetch probabilistically triggers a background refresh while returning the
 * stale value, preventing cache stampede.
 *
 * @template T - The type of the cached value
 * @param key - Cache key (will be prefixed with 'xfetch:')
 * @param fetchFn - Function to fetch fresh data on cache miss or refresh
 * @param ttlMs - Time-to-live in milliseconds
 * @param options - XFetch options (beta, jitter)
 * @returns The cached or fresh value
 *
 * @example
 * ```typescript
 * const user = await getWithXFetch(
 *   `user:${userId}`,
 *   () => fetchUserFromDatabase(userId),
 *   60_000, // 1 minute TTL
 *   { beta: 1.0, jitter: 0.1 }
 * );
 * ```
 */
export async function getWithXFetch<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlMs: number,
  options?: XFetchOptions
): Promise<T> {
  const redis = getRedis();
  const cacheKey = buildXFetchCacheKey(key);
  const beta = options?.beta ?? DEFAULT_BETA;
  const jitter = options?.jitter ?? DEFAULT_JITTER_FRACTION;

  try {
    const cached = await redis.get(cacheKey);

    if (cached) {
      const entry: XFetchCacheEntry<T> = JSON.parse(cached);

      // Check if we should refresh early using XFetch algorithm
      if (shouldRefresh(entry, beta)) {
        recordXFetchEarlyRefresh('generic');

        // Trigger background refresh (deduplicated)
        triggerBackgroundRefresh(cacheKey, key, fetchFn, ttlMs, jitter);

        // Record that we're serving stale data
        recordXFetchStaleServe('generic');

        logger.debug(
          {
            key,
            age: Date.now() - entry.fetchTime,
            ttl: entry.ttl,
            delta: entry.delta,
          },
          'XFetch early refresh triggered, serving stale data'
        );
      }

      recordCacheHit();
      return entry.value;
    }
  } catch (error) {
    recordCacheError('xfetch_get');
    logger.warn({ error, key }, 'XFetch cache read failed, fetching fresh');
  }

  // Cache miss - fetch and cache
  recordCacheMiss();
  return fetchAndCacheXFetch(cacheKey, key, fetchFn, ttlMs, jitter);
}

/**
 * Fetch data and store in cache with XFetch metadata
 */
async function fetchAndCacheXFetch<T>(
  cacheKey: string,
  logKey: string,
  fetchFn: () => Promise<T>,
  ttlMs: number,
  jitter: number
): Promise<T> {
  const startTime = Date.now();

  const value = await fetchFn();

  const delta = Date.now() - startTime;
  const jitteredTtl = applyTTLJitter(ttlMs, jitter);

  const entry: XFetchCacheEntry<T> = {
    value,
    fetchTime: Date.now(),
    ttl: jitteredTtl,
    delta,
  };

  const redis = getRedis();
  try {
    // Redis SETEX takes TTL in seconds
    const ttlSeconds = Math.ceil(jitteredTtl / 1000);
    await redis.setex(cacheKey, ttlSeconds, JSON.stringify(entry));
    recordCacheSet();

    logger.debug(
      { key: logKey, ttlMs: jitteredTtl, deltaMs: delta },
      'XFetch cache entry stored'
    );
  } catch (error) {
    recordCacheError('xfetch_set');
    logger.warn({ error, key: logKey }, 'Failed to cache XFetch entry');
  }

  return value;
}

/**
 * Trigger a background refresh with deduplication
 *
 * Prevents multiple concurrent refreshes for the same key by tracking
 * in-flight refresh operations.
 */
function triggerBackgroundRefresh<T>(
  cacheKey: string,
  logKey: string,
  fetchFn: () => Promise<T>,
  ttlMs: number,
  jitter: number
): void {
  // Check if there's already an in-flight refresh for this key
  if (inFlightRefreshes.has(cacheKey)) {
    logger.debug({ key: logKey }, 'Skipping duplicate background refresh');
    return;
  }

  // Create the refresh promise
  const refreshPromise = fetchAndCacheXFetch(cacheKey, logKey, fetchFn, ttlMs, jitter)
    .catch((error) => {
      logger.error({ error, key: logKey }, 'Background XFetch refresh failed');
    })
    .finally(() => {
      // Remove from in-flight tracking
      inFlightRefreshes.delete(cacheKey);
    });

  // Track the in-flight refresh
  inFlightRefreshes.set(cacheKey, refreshPromise);
}

/**
 * Invalidate an XFetch cache entry
 *
 * @param key - Cache key (will be prefixed with 'xfetch:')
 */
export async function invalidateXFetchCache(key: string): Promise<void> {
  const redis = getRedis();
  const cacheKey = buildXFetchCacheKey(key);

  try {
    await redis.del(cacheKey);
    recordCacheInvalidation();
    logger.debug({ key }, 'XFetch cache entry invalidated');
  } catch (error) {
    recordCacheError('xfetch_invalidate');
    logger.warn({ error, key }, 'Failed to invalidate XFetch cache entry');
  }
}

/**
 * Get the number of in-flight background refreshes
 * Useful for monitoring and testing
 */
export function getInFlightRefreshCount(): number {
  return inFlightRefreshes.size;
}

/**
 * Clear all in-flight refresh tracking
 * Primarily for testing purposes
 */
export function clearInFlightRefreshes(): void {
  inFlightRefreshes.clear();
}

// ============================================================================
// Trust Score Cache with XFetch Stampede Prevention
// ============================================================================

/**
 * In-flight trust score refresh tracking
 */
const inFlightTrustRefreshes = new Map<string, Promise<TrustRecord>>();

/**
 * Get a cached trust score with probabilistic early refresh using XFetch
 *
 * Uses the XFetch algorithm to probabilistically refresh cache entries
 * before they expire, preventing cache stampede. This implementation
 * tracks computation time (delta) to scale the early refresh probability.
 *
 * @param entityId - The entity ID to look up
 * @param tenantId - The tenant ID for namespace isolation
 * @param fetchFn - Function to fetch fresh data on cache miss or early refresh
 * @returns The TrustRecord (cached or fresh)
 */
export async function getCachedTrustScoreWithRefresh(
  entityId: string,
  tenantId: string,
  fetchFn: () => Promise<TrustRecord>
): Promise<TrustRecord> {
  const redis = getRedis();
  const cacheKey = buildCacheKey(tenantId, entityId);

  try {
    const cached = await redis.get(cacheKey);

    if (cached) {
      const data: CachedTrustScore = JSON.parse(cached);

      // Check if we should refresh early using XFetch algorithm
      // Use delta if available, otherwise fall back to legacy behavior
      const shouldDoRefresh = data.delta !== undefined
        ? shouldRefreshEarly(data.cachedAt, data.expiresAt, data.delta)
        : shouldRefreshEarly(data.cachedAt, data.expiresAt);

      if (shouldDoRefresh) {
        recordEarlyRefresh();
        recordXFetchEarlyRefresh('trust');

        // Refresh in background with deduplication
        refreshTrustInBackground(cacheKey, entityId, tenantId, fetchFn);

        // Record serving stale data
        recordXFetchStaleServe('trust');

        logger.debug(
          {
            entityId,
            tenantId,
            remaining: data.expiresAt - Date.now() / 1000,
            delta: data.delta,
          },
          'XFetch early refresh triggered for trust score'
        );
      }

      recordCacheHit();
      return data.record;
    }
  } catch (error) {
    // Cache miss or error - fetch fresh
    recordCacheError('get');
    logger.warn({ error, entityId, tenantId }, 'Cache read failed, fetching fresh');
  }

  // Cache miss - fetch and cache
  recordCacheMiss();
  return fetchAndCacheTrust(cacheKey, entityId, tenantId, fetchFn);
}

/**
 * Fetch fresh trust data and store in cache with XFetch metadata
 */
async function fetchAndCacheTrust(
  cacheKey: string,
  entityId: string,
  tenantId: string,
  fetchFn: () => Promise<TrustRecord>
): Promise<TrustRecord> {
  const startTime = Date.now();

  const record = await fetchFn();

  const delta = Date.now() - startTime;
  const now = Math.floor(Date.now() / 1000);
  const ttl = getTTLWithJitter(CACHE_TTL_SECONDS);

  const cacheData: CachedTrustScore = {
    record,
    cachedAt: now,
    expiresAt: now + ttl,
    delta, // Store computation time for XFetch
  };

  const redis = getRedis();
  try {
    await redis.setex(cacheKey, ttl, JSON.stringify(cacheData));
    recordCacheSet();

    logger.debug(
      { entityId, tenantId, ttl, deltaMs: delta },
      'Trust score cached with XFetch metadata'
    );
  } catch (error) {
    recordCacheError('set');
    logger.warn({ error, cacheKey }, 'Failed to cache trust score');
  }

  return record;
}

/**
 * Refresh trust cache in background with deduplication
 */
function refreshTrustInBackground(
  cacheKey: string,
  entityId: string,
  tenantId: string,
  fetchFn: () => Promise<TrustRecord>
): void {
  // Check if there's already an in-flight refresh for this key
  if (inFlightTrustRefreshes.has(cacheKey)) {
    logger.debug({ entityId, tenantId }, 'Skipping duplicate trust refresh');
    return;
  }

  // Create the refresh promise
  const refreshPromise = fetchAndCacheTrust(cacheKey, entityId, tenantId, fetchFn)
    .catch((error) => {
      logger.error({ error, entityId, tenantId }, 'Background trust refresh failed');
      throw error; // Re-throw to mark promise as rejected
    })
    .finally(() => {
      // Remove from in-flight tracking
      inFlightTrustRefreshes.delete(cacheKey);
    });

  // Track the in-flight refresh
  inFlightTrustRefreshes.set(cacheKey, refreshPromise);
}

/**
 * Get the number of in-flight trust score refreshes
 * Useful for monitoring and testing
 */
export function getInFlightTrustRefreshCount(): number {
  return inFlightTrustRefreshes.size;
}

/**
 * Clear all in-flight trust refresh tracking
 * Primarily for testing purposes
 */
export function clearInFlightTrustRefreshes(): void {
  inFlightTrustRefreshes.clear();
}

// ============================================================================
// Legacy Cache Functions (backwards compatibility)
// ============================================================================

/**
 * Get a cached trust score for an entity (legacy API)
 *
 * @param entityId - The entity ID to look up
 * @param tenantId - The tenant ID for namespace isolation
 * @returns The cached TrustRecord or null if not found
 */
export async function getCachedTrustScore(
  entityId: string,
  tenantId: string
): Promise<TrustRecord | null> {
  const redis = getRedis();
  const cacheKey = buildCacheKey(tenantId, entityId);

  try {
    const cached = await redis.get(cacheKey);

    if (cached) {
      const data: CachedTrustScore = JSON.parse(cached);
      recordCacheHit();
      logger.debug({ entityId, tenantId, cacheKey }, 'Trust score cache hit');
      return data.record;
    }

    recordCacheMiss();
    logger.debug({ entityId, tenantId, cacheKey }, 'Trust score cache miss');
    return null;
  } catch (error) {
    recordCacheError('get');
    logger.warn(
      { error, entityId, tenantId, cacheKey },
      'Error retrieving cached trust score'
    );
    // Return null on error to allow fallback to trust engine
    return null;
  }
}

/**
 * Cache a trust score for an entity (legacy API)
 *
 * @param entityId - The entity ID
 * @param tenantId - The tenant ID for namespace isolation
 * @param score - The TrustRecord to cache
 */
export async function cacheTrustScore(
  entityId: string,
  tenantId: string,
  score: TrustRecord
): Promise<void> {
  const redis = getRedis();
  const config = getConfig();
  const cacheKey = buildCacheKey(tenantId, entityId);
  const baseTtl = config.trust.cacheTtl || CACHE_TTL_SECONDS;
  const ttl = getTTLWithJitter(baseTtl);
  const now = Math.floor(Date.now() / 1000);

  const cacheData: CachedTrustScore = {
    record: score,
    cachedAt: now,
    expiresAt: now + ttl,
  };

  try {
    await redis.setex(cacheKey, ttl, JSON.stringify(cacheData));
    recordCacheSet();
    logger.debug({ entityId, tenantId, cacheKey, ttl }, 'Trust score cached');
  } catch (error) {
    recordCacheError('set');
    logger.warn({ error, entityId, tenantId, cacheKey }, 'Error caching trust score');
    // Don't throw - caching failures should not block the main flow
  }
}

/**
 * Invalidate a cached trust score for an entity
 *
 * Use this when a trust score needs to be refreshed (e.g., after
 * recording new trust signals).
 *
 * @param entityId - The entity ID
 * @param tenantId - The tenant ID for namespace isolation
 */
export async function invalidateTrustScore(
  entityId: string,
  tenantId: string
): Promise<void> {
  const redis = getRedis();
  const cacheKey = buildCacheKey(tenantId, entityId);

  try {
    await redis.del(cacheKey);
    recordCacheInvalidation();
    logger.debug({ entityId, tenantId, cacheKey }, 'Trust score cache invalidated');
  } catch (error) {
    recordCacheError('invalidate');
    logger.warn(
      { error, entityId, tenantId, cacheKey },
      'Error invalidating trust score cache'
    );
    // Don't throw - invalidation failures should not block the main flow
  }
}

/**
 * Invalidate all trust scores for a tenant
 *
 * Use this when tenant-wide trust recalculation is needed.
 *
 * @param tenantId - The tenant ID
 */
export async function invalidateTenantTrustScores(tenantId: string): Promise<void> {
  const redis = getRedis();
  const pattern = `${CACHE_KEY_PREFIX}:${tenantId}:*`;

  try {
    // Use SCAN to find matching keys in a non-blocking way
    let cursor = '0';
    let keysDeleted = 0;

    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;

      if (keys.length > 0) {
        await redis.del(...keys);
        keysDeleted += keys.length;
      }
    } while (cursor !== '0');

    logger.info({ tenantId, keysDeleted }, 'Tenant trust score cache invalidated');
  } catch (error) {
    recordCacheError('invalidate_tenant');
    logger.warn({ error, tenantId }, 'Error invalidating tenant trust score cache');
  }
}
