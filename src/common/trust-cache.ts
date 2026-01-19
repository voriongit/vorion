/**
 * Trust Score Cache with Stampede Prevention
 *
 * Uses probabilistic early refresh to prevent cache stampede:
 * - Items refresh early with probability based on remaining TTL
 * - Prevents thundering herd when cache expires
 * - TTL jitter prevents synchronized expiration
 *
 * Key pattern: trust:${tenantId}:${entityId}
 *
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
 * Default cache TTL in seconds (5 minutes)
 */
const CACHE_TTL_SECONDS = 300;

/**
 * Start early refresh checks in last 60 seconds of TTL
 */
const EARLY_REFRESH_WINDOW_SECONDS = 60;

/**
 * Tuning parameter for early refresh probability (XFetch beta)
 */
const BETA = 1.0;

/**
 * Maximum jitter percentage (0-10% of base TTL)
 */
const JITTER_PERCENTAGE = 0.1;

/**
 * Redis key prefix for trust score cache
 */
const CACHE_KEY_PREFIX = 'trust';

// ============================================================================
// Cache Entry Types
// ============================================================================

/**
 * Cached trust score with timing metadata for PER
 */
interface CachedTrustScore {
  /** The trust record data */
  record: TrustRecord;
  /** Unix timestamp when cached (seconds) */
  cachedAt: number;
  /** Unix timestamp when entry expires (seconds) */
  expiresAt: number;
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
 * Record an early refresh triggered by PER
 */
export function recordEarlyRefresh(): void {
  trustCacheOperations.inc({ operation: 'early_refresh', result: 'triggered' });
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

// ============================================================================
// Probabilistic Early Refresh (XFetch Algorithm)
// ============================================================================

/**
 * Determine if we should refresh early using XFetch algorithm
 *
 * The probability of refresh increases as the cache entry approaches expiration.
 * This spreads out refresh requests over time instead of all hitting at once
 * when the entry expires.
 *
 * @param cachedAt - Unix timestamp when entry was cached (seconds)
 * @param expiresAt - Unix timestamp when entry expires (seconds)
 * @returns true if early refresh should be triggered
 */
export function shouldRefreshEarly(cachedAt: number, expiresAt: number): boolean {
  const now = Date.now() / 1000;
  const remaining = expiresAt - now;

  // If already expired, definitely refresh
  if (remaining <= 0) {
    return true;
  }

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

// ============================================================================
// Cache Functions with Stampede Prevention
// ============================================================================

/**
 * Get a cached trust score with probabilistic early refresh
 *
 * Uses the XFetch algorithm to probabilistically refresh cache entries
 * before they expire, preventing cache stampede.
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

      // Check if we should refresh early (probabilistic)
      if (shouldRefreshEarly(data.cachedAt, data.expiresAt)) {
        recordEarlyRefresh();
        // Refresh in background, return stale data immediately
        refreshInBackground(cacheKey, fetchFn);
        logger.debug(
          { entityId, tenantId, remaining: data.expiresAt - Date.now() / 1000 },
          'Early refresh triggered'
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
  return fetchAndCache(cacheKey, fetchFn);
}

/**
 * Fetch fresh data and store in cache
 */
async function fetchAndCache(
  cacheKey: string,
  fetchFn: () => Promise<TrustRecord>
): Promise<TrustRecord> {
  const record = await fetchFn();
  const now = Math.floor(Date.now() / 1000);
  const ttl = getTTLWithJitter(CACHE_TTL_SECONDS);

  const cacheData: CachedTrustScore = {
    record,
    cachedAt: now,
    expiresAt: now + ttl,
  };

  const redis = getRedis();
  try {
    await redis.setex(cacheKey, ttl, JSON.stringify(cacheData));
    recordCacheSet();
  } catch (error) {
    recordCacheError('set');
    logger.warn({ error, cacheKey }, 'Failed to cache trust score');
  }

  return record;
}

/**
 * Refresh cache in background without blocking
 */
function refreshInBackground(
  cacheKey: string,
  fetchFn: () => Promise<TrustRecord>
): void {
  // Fire and forget - don't await
  fetchAndCache(cacheKey, fetchFn).catch((error) => {
    logger.error({ error, cacheKey }, 'Background cache refresh failed');
  });
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
