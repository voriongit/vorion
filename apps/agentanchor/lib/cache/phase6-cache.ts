/**
 * Phase 6 Caching Layer
 *
 * Provides Redis-based caching for Phase 6 Trust Engine data with:
 * - TTL-based expiration
 * - Cache invalidation patterns
 * - Stale-while-revalidate support
 * - Cache warming strategies
 */

// =============================================================================
// TYPES
// =============================================================================

export interface CacheConfig {
  /** Time-to-live in seconds */
  ttlSeconds: number
  /** Stale-while-revalidate window in seconds */
  swrSeconds?: number
  /** Cache key prefix */
  prefix?: string
}

export interface CacheEntry<T> {
  data: T
  cachedAt: number
  expiresAt: number
  staleAt?: number
}

export interface CacheResult<T> {
  hit: boolean
  data: T | null
  stale: boolean
  age: number
}

export interface CacheStats {
  hits: number
  misses: number
  staleHits: number
  size: number
  hitRate: number
}

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Cache configurations for Phase 6 data types
 */
export const PHASE6_CACHE_CONFIG: Record<string, CacheConfig> = {
  // Stats - relatively stable, cache for 30 seconds
  stats: {
    ttlSeconds: 30,
    swrSeconds: 60,
    prefix: 'p6:stats',
  },

  // Tier distribution - changes slowly
  tierDistribution: {
    ttlSeconds: 60,
    swrSeconds: 120,
    prefix: 'p6:tiers',
  },

  // Recent events - fresher data needed
  recentEvents: {
    ttlSeconds: 10,
    swrSeconds: 30,
    prefix: 'p6:events',
  },

  // Presets - rarely change, cache longer
  aciPresets: {
    ttlSeconds: 300,
    swrSeconds: 600,
    prefix: 'p6:presets:aci',
  },
  vorionPresets: {
    ttlSeconds: 300,
    swrSeconds: 600,
    prefix: 'p6:presets:vorion',
  },
  axiomPresets: {
    ttlSeconds: 180,
    swrSeconds: 360,
    prefix: 'p6:presets:axiom',
  },

  // Context - moderately stable
  deploymentContexts: {
    ttlSeconds: 120,
    swrSeconds: 240,
    prefix: 'p6:ctx:deploy',
  },
  orgContexts: {
    ttlSeconds: 120,
    swrSeconds: 240,
    prefix: 'p6:ctx:org',
  },
  agentContexts: {
    ttlSeconds: 60,
    swrSeconds: 120,
    prefix: 'p6:ctx:agent',
  },

  // Role gate evaluations - don't cache (real-time decisions)
  roleGateEvaluations: {
    ttlSeconds: 0,
    prefix: 'p6:rolegate',
  },

  // Ceiling events - short cache for history
  ceilingEvents: {
    ttlSeconds: 15,
    swrSeconds: 30,
    prefix: 'p6:ceiling',
  },

  // Gaming alerts - need fresh data
  gamingAlerts: {
    ttlSeconds: 10,
    swrSeconds: 20,
    prefix: 'p6:alerts',
  },

  // Provenance - very stable, cache longer
  provenance: {
    ttlSeconds: 600,
    swrSeconds: 1200,
    prefix: 'p6:prov',
  },
}

// =============================================================================
// IN-MEMORY CACHE (for single-instance deployments)
// =============================================================================

const memoryCache = new Map<string, CacheEntry<unknown>>()
const cacheStats: CacheStats = {
  hits: 0,
  misses: 0,
  staleHits: 0,
  size: 0,
  hitRate: 0,
}

// Cleanup expired entries every minute
const CLEANUP_INTERVAL = 60 * 1000
let lastCleanup = Date.now()

function cleanupExpiredEntries(): void {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return

  for (const [key, entry] of memoryCache.entries()) {
    // Remove entries that are past their stale window (or TTL if no SWR)
    const expiry = entry.staleAt ? entry.staleAt + 60000 : entry.expiresAt
    if (now > expiry) {
      memoryCache.delete(key)
    }
  }

  cacheStats.size = memoryCache.size
  lastCleanup = now
}

function updateHitRate(): void {
  const total = cacheStats.hits + cacheStats.misses
  cacheStats.hitRate = total > 0 ? cacheStats.hits / total : 0
}

// =============================================================================
// CACHE OPERATIONS
// =============================================================================

/**
 * Get cached value
 */
export function cacheGet<T>(key: string, configName: string): CacheResult<T> {
  cleanupExpiredEntries()

  const config = PHASE6_CACHE_CONFIG[configName] || { ttlSeconds: 60 }
  const fullKey = config.prefix ? `${config.prefix}:${key}` : key

  const entry = memoryCache.get(fullKey) as CacheEntry<T> | undefined
  const now = Date.now()

  if (!entry) {
    cacheStats.misses++
    updateHitRate()
    return { hit: false, data: null, stale: false, age: 0 }
  }

  const age = Math.floor((now - entry.cachedAt) / 1000)

  // Check if expired
  if (now > entry.expiresAt) {
    // Check if within stale-while-revalidate window
    if (entry.staleAt && now <= entry.staleAt) {
      cacheStats.staleHits++
      cacheStats.hits++
      updateHitRate()
      return { hit: true, data: entry.data, stale: true, age }
    }

    // Truly expired
    memoryCache.delete(fullKey)
    cacheStats.size = memoryCache.size
    cacheStats.misses++
    updateHitRate()
    return { hit: false, data: null, stale: false, age: 0 }
  }

  cacheStats.hits++
  updateHitRate()
  return { hit: true, data: entry.data, stale: false, age }
}

/**
 * Set cached value
 */
export function cacheSet<T>(key: string, data: T, configName: string): void {
  const config = PHASE6_CACHE_CONFIG[configName] || { ttlSeconds: 60 }

  // Don't cache if TTL is 0
  if (config.ttlSeconds === 0) return

  const fullKey = config.prefix ? `${config.prefix}:${key}` : key
  const now = Date.now()

  const entry: CacheEntry<T> = {
    data,
    cachedAt: now,
    expiresAt: now + config.ttlSeconds * 1000,
    staleAt: config.swrSeconds
      ? now + (config.ttlSeconds + config.swrSeconds) * 1000
      : undefined,
  }

  memoryCache.set(fullKey, entry)
  cacheStats.size = memoryCache.size
}

/**
 * Invalidate cache entry
 */
export function cacheInvalidate(key: string, configName: string): void {
  const config = PHASE6_CACHE_CONFIG[configName] || {}
  const fullKey = config.prefix ? `${config.prefix}:${key}` : key
  memoryCache.delete(fullKey)
  cacheStats.size = memoryCache.size
}

/**
 * Invalidate all entries with a prefix
 */
export function cacheInvalidatePrefix(prefix: string): number {
  let count = 0
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) {
      memoryCache.delete(key)
      count++
    }
  }
  cacheStats.size = memoryCache.size
  return count
}

/**
 * Clear all cache entries
 */
export function cacheClear(): void {
  memoryCache.clear()
  cacheStats.size = 0
}

/**
 * Get cache statistics
 */
export function getCacheStats(): CacheStats {
  return { ...cacheStats }
}

// =============================================================================
// CACHE-ASIDE PATTERN HELPER
// =============================================================================

/**
 * Get-or-fetch with caching
 *
 * @example
 * ```typescript
 * const stats = await cacheAside(
 *   'global',
 *   'stats',
 *   async () => await phase6Service.getStats()
 * )
 * ```
 */
export async function cacheAside<T>(
  key: string,
  configName: string,
  fetcher: () => Promise<T>,
  options?: { forceRefresh?: boolean }
): Promise<T> {
  // Check cache first (unless force refresh)
  if (!options?.forceRefresh) {
    const cached = cacheGet<T>(key, configName)

    if (cached.hit && !cached.stale) {
      return cached.data!
    }

    // Stale-while-revalidate: return stale data but trigger refresh
    if (cached.hit && cached.stale) {
      // Fire and forget refresh
      fetcher().then((data) => cacheSet(key, data, configName)).catch(() => {})
      return cached.data!
    }
  }

  // Fetch fresh data
  const data = await fetcher()
  cacheSet(key, data, configName)
  return data
}

// =============================================================================
// REDIS CACHE ADAPTER
// =============================================================================

/**
 * Redis cache interface for distributed deployments
 */
export interface RedisCache {
  get<T>(key: string, configName: string): Promise<CacheResult<T>>
  set<T>(key: string, data: T, configName: string): Promise<void>
  invalidate(key: string, configName: string): Promise<void>
  invalidatePrefix(prefix: string): Promise<number>
}

/**
 * Create Redis-based cache
 *
 * @example
 * ```typescript
 * import Redis from 'ioredis'
 *
 * const redis = new Redis(process.env.REDIS_URL)
 * const cache = createRedisCache(redis)
 *
 * await cache.set('stats', statsData, 'stats')
 * const result = await cache.get('stats', 'stats')
 * ```
 */
export function createRedisCache(redis: {
  get: (key: string) => Promise<string | null>
  set: (key: string, value: string, mode: string, ttl: number) => Promise<unknown>
  del: (key: string) => Promise<number>
  keys: (pattern: string) => Promise<string[]>
}): RedisCache {
  return {
    async get<T>(key: string, configName: string): Promise<CacheResult<T>> {
      const config = PHASE6_CACHE_CONFIG[configName] || { ttlSeconds: 60 }
      const fullKey = config.prefix ? `${config.prefix}:${key}` : key

      const raw = await redis.get(fullKey)
      if (!raw) {
        return { hit: false, data: null, stale: false, age: 0 }
      }

      try {
        const entry = JSON.parse(raw) as CacheEntry<T>
        const now = Date.now()
        const age = Math.floor((now - entry.cachedAt) / 1000)

        if (now > entry.expiresAt) {
          if (entry.staleAt && now <= entry.staleAt) {
            return { hit: true, data: entry.data, stale: true, age }
          }
          return { hit: false, data: null, stale: false, age: 0 }
        }

        return { hit: true, data: entry.data, stale: false, age }
      } catch {
        return { hit: false, data: null, stale: false, age: 0 }
      }
    },

    async set<T>(key: string, data: T, configName: string): Promise<void> {
      const config = PHASE6_CACHE_CONFIG[configName] || { ttlSeconds: 60 }
      if (config.ttlSeconds === 0) return

      const fullKey = config.prefix ? `${config.prefix}:${key}` : key
      const now = Date.now()

      const entry: CacheEntry<T> = {
        data,
        cachedAt: now,
        expiresAt: now + config.ttlSeconds * 1000,
        staleAt: config.swrSeconds
          ? now + (config.ttlSeconds + config.swrSeconds) * 1000
          : undefined,
      }

      // Set TTL to include SWR window
      const ttl = config.swrSeconds
        ? config.ttlSeconds + config.swrSeconds + 60
        : config.ttlSeconds + 60

      await redis.set(fullKey, JSON.stringify(entry), 'EX', ttl)
    },

    async invalidate(key: string, configName: string): Promise<void> {
      const config = PHASE6_CACHE_CONFIG[configName] || {}
      const fullKey = config.prefix ? `${config.prefix}:${key}` : key
      await redis.del(fullKey)
    },

    async invalidatePrefix(prefix: string): Promise<number> {
      const keys = await redis.keys(`${prefix}:*`)
      if (keys.length === 0) return 0

      let count = 0
      for (const key of keys) {
        await redis.del(key)
        count++
      }
      return count
    },
  }
}

// =============================================================================
// CACHE WARMING
// =============================================================================

/**
 * Warm commonly accessed caches
 */
export async function warmCaches(
  fetchers: {
    stats: () => Promise<unknown>
    presets: () => Promise<{ aci: unknown[]; vorion: unknown[]; axiom: unknown[] }>
    tierDistribution: () => Promise<unknown[]>
  }
): Promise<void> {
  const warmups = [
    fetchers.stats().then((data) => cacheSet('global', data, 'stats')),
    fetchers.presets().then((data) => {
      cacheSet('all', data.aci, 'aciPresets')
      cacheSet('all', data.vorion, 'vorionPresets')
      cacheSet('all', data.axiom, 'axiomPresets')
    }),
    fetchers.tierDistribution().then((data) => cacheSet('global', data, 'tierDistribution')),
  ]

  await Promise.allSettled(warmups)
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  get: cacheGet,
  set: cacheSet,
  invalidate: cacheInvalidate,
  invalidatePrefix: cacheInvalidatePrefix,
  clear: cacheClear,
  stats: getCacheStats,
  aside: cacheAside,
}
