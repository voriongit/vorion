/**
 * Policy Loader
 *
 * Loads and caches policies from the database for runtime evaluation.
 *
 * @packageDocumentation
 */

import { createLogger } from '../common/logger.js';
import { getRedis } from '../common/redis.js';
import { PolicyService, createPolicyService } from './service.js';
import type { Policy, PolicyDefinition } from './types.js';
import type { ID } from '../common/types.js';
import { recordPolicyCacheHit, recordPolicyCacheMiss } from '../intent/metrics.js';

const logger = createLogger({ component: 'policy-loader' });

// Cache TTL in seconds
const DEFAULT_CACHE_TTL = 300; // 5 minutes
const CACHE_PREFIX = 'policy:cache:';

/**
 * Policy Loader service for fetching and caching policies
 */
export class PolicyLoader {
  private policyService: PolicyService;
  private localCache: Map<string, { policies: Policy[]; expires: number }>;
  private cacheTtl: number;

  constructor(options?: { cacheTtl?: number }) {
    this.policyService = createPolicyService();
    this.localCache = new Map();
    this.cacheTtl = options?.cacheTtl ?? DEFAULT_CACHE_TTL;
  }

  /**
   * Get published policies for a tenant, with caching
   */
  async getPolicies(tenantId: ID, namespace?: string): Promise<Policy[]> {
    const cacheKey = this.getCacheKey(tenantId, namespace);
    const effectiveNamespace = namespace ?? 'default';

    // Check local memory cache first (fastest)
    const localCached = this.localCache.get(cacheKey);
    if (localCached && localCached.expires > Date.now()) {
      logger.debug({ tenantId, namespace, source: 'local' }, 'Policy cache hit');
      recordPolicyCacheHit(tenantId, effectiveNamespace);
      return localCached.policies;
    }

    // Check Redis cache (distributed)
    try {
      const redis = getRedis();
      const redisCached = await redis.get(CACHE_PREFIX + cacheKey);

      if (redisCached) {
        const policies = JSON.parse(redisCached) as Policy[];
        // Update local cache
        this.localCache.set(cacheKey, {
          policies,
          expires: Date.now() + this.cacheTtl * 1000,
        });
        logger.debug({ tenantId, namespace, source: 'redis' }, 'Policy cache hit');
        recordPolicyCacheHit(tenantId, effectiveNamespace);
        return policies;
      }
    } catch (error) {
      logger.warn({ error }, 'Failed to check Redis policy cache');
    }

    // Cache miss - fetch from database
    recordPolicyCacheMiss(tenantId, effectiveNamespace);
    const policies = await this.policyService.getPublishedPolicies(tenantId, namespace);

    // Update caches
    this.updateCache(cacheKey, policies);

    logger.debug(
      { tenantId, namespace, count: policies.length, source: 'database' },
      'Policies loaded from database'
    );

    return policies;
  }

  /**
   * Get a specific policy by ID
   */
  async getPolicy(id: ID, tenantId: ID): Promise<Policy | null> {
    return this.policyService.findById(id, tenantId);
  }

  /**
   * Invalidate cache for a tenant (call after policy updates)
   */
  async invalidateCache(tenantId: ID, namespace?: string): Promise<void> {
    const cacheKey = this.getCacheKey(tenantId, namespace);

    // Clear local cache
    this.localCache.delete(cacheKey);

    // Clear Redis cache
    try {
      const redis = getRedis();
      await redis.del(CACHE_PREFIX + cacheKey);
      logger.info({ tenantId, namespace }, 'Policy cache invalidated');
    } catch (error) {
      logger.warn({ error }, 'Failed to invalidate Redis policy cache');
    }

    // Also invalidate the "all namespaces" cache for this tenant
    if (namespace) {
      await this.invalidateCache(tenantId);
    }
  }

  /**
   * Invalidate all caches (call on policy hot-reload)
   */
  async invalidateAll(): Promise<void> {
    this.localCache.clear();

    try {
      const redis = getRedis();
      const keys = await redis.keys(CACHE_PREFIX + '*');
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      logger.info({ keysCleared: keys.length }, 'All policy caches invalidated');
    } catch (error) {
      logger.warn({ error }, 'Failed to invalidate all Redis policy caches');
    }
  }

  /**
   * Preload policies for a tenant (warm the cache)
   */
  async preload(tenantId: ID, namespaces?: string[]): Promise<void> {
    if (namespaces && namespaces.length > 0) {
      await Promise.all(namespaces.map((ns) => this.getPolicies(tenantId, ns)));
    } else {
      await this.getPolicies(tenantId);
    }
    logger.info({ tenantId, namespaces }, 'Policies preloaded');
  }

  /**
   * Get cache key for a tenant/namespace
   */
  private getCacheKey(tenantId: ID, namespace?: string): string {
    return namespace ? `${tenantId}:${namespace}` : tenantId;
  }

  /**
   * Update both local and Redis caches
   */
  private updateCache(cacheKey: string, policies: Policy[]): void {
    // Update local cache
    this.localCache.set(cacheKey, {
      policies,
      expires: Date.now() + this.cacheTtl * 1000,
    });

    // Update Redis cache (fire and forget)
    const redis = getRedis();
    redis
      .setex(CACHE_PREFIX + cacheKey, this.cacheTtl, JSON.stringify(policies))
      .catch((error) => {
        logger.warn({ error }, 'Failed to update Redis policy cache');
      });
  }
}

/**
 * Singleton instance for shared use
 */
let loaderInstance: PolicyLoader | null = null;

/**
 * Get the shared policy loader instance
 */
export function getPolicyLoader(): PolicyLoader {
  if (!loaderInstance) {
    loaderInstance = new PolicyLoader();
  }
  return loaderInstance;
}

/**
 * Create a new policy loader instance
 */
export function createPolicyLoader(options?: { cacheTtl?: number }): PolicyLoader {
  return new PolicyLoader(options);
}

/**
 * Reset the singleton (for testing)
 */
export function resetPolicyLoader(): void {
  loaderInstance = null;
}
