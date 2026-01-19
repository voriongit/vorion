/**
 * Trust Score Caching
 *
 * Provides Redis-based caching for trust scores to reduce load on the trust engine
 * for repeated entity lookups.
 *
 * Key pattern: trust:score:${tenantId}:${entityId}
 * TTL: Configured via trust.cacheTtl (default 30 seconds)
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

/**
 * Redis key prefix for trust score cache
 */
const CACHE_KEY_PREFIX = 'trust:score';

/**
 * Build cache key for a trust score
 */
function buildCacheKey(tenantId: string, entityId: string): string {
  return `${CACHE_KEY_PREFIX}:${tenantId}:${entityId}`;
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

// ============================================================================
// Cache Functions
// ============================================================================

/**
 * Get a cached trust score for an entity
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
      const record = JSON.parse(cached) as TrustRecord;
      recordCacheHit();
      logger.debug({ entityId, tenantId, cacheKey }, 'Trust score cache hit');
      return record;
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
 * Cache a trust score for an entity
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
  const ttl = config.trust.cacheTtl; // TTL in seconds

  try {
    await redis.setex(cacheKey, ttl, JSON.stringify(score));
    recordCacheSet();
    logger.debug(
      { entityId, tenantId, cacheKey, ttl },
      'Trust score cached'
    );
  } catch (error) {
    recordCacheError('set');
    logger.warn(
      { error, entityId, tenantId, cacheKey },
      'Error caching trust score'
    );
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
    logger.debug(
      { entityId, tenantId, cacheKey },
      'Trust score cache invalidated'
    );
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

    logger.info(
      { tenantId, keysDeleted },
      'Tenant trust score cache invalidated'
    );
  } catch (error) {
    recordCacheError('invalidate_tenant');
    logger.warn(
      { error, tenantId },
      'Error invalidating tenant trust score cache'
    );
  }
}
