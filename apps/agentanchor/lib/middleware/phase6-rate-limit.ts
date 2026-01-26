/**
 * Phase 6 Rate Limiting Middleware
 *
 * Provides endpoint-specific rate limiting for Phase 6 Trust Engine APIs.
 * Uses a sliding window algorithm with configurable limits per endpoint.
 */

import { NextRequest, NextResponse } from 'next/server'

// =============================================================================
// TYPES
// =============================================================================

export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  maxRequests: number
  /** Window size in seconds */
  windowSeconds: number
  /** Optional: Different limits for authenticated users */
  authenticatedMultiplier?: number
  /** Optional: Burst allowance (extra requests allowed momentarily) */
  burstAllowance?: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  retryAfter?: number
}

interface RateLimitEntry {
  count: number
  windowStart: number
  burstUsed: number
}

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Rate limit configurations per Phase 6 endpoint
 */
export const PHASE6_RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Read endpoints - higher limits
  '/api/phase6/stats': {
    maxRequests: 100,
    windowSeconds: 60,
    authenticatedMultiplier: 2,
  },
  '/api/phase6/context': {
    maxRequests: 100,
    windowSeconds: 60,
    authenticatedMultiplier: 2,
  },
  '/api/phase6/presets': {
    maxRequests: 100,
    windowSeconds: 60,
    authenticatedMultiplier: 2,
  },
  '/api/phase6/alerts': {
    maxRequests: 60,
    windowSeconds: 60,
    authenticatedMultiplier: 2,
  },

  // Write endpoints - stricter limits
  '/api/phase6/role-gates': {
    maxRequests: 30,
    windowSeconds: 60,
    authenticatedMultiplier: 3,
    burstAllowance: 10,
  },
  '/api/phase6/ceiling': {
    maxRequests: 30,
    windowSeconds: 60,
    authenticatedMultiplier: 3,
    burstAllowance: 5,
  },
  '/api/phase6/provenance': {
    maxRequests: 20,
    windowSeconds: 60,
    authenticatedMultiplier: 2,
  },

  // Real-time endpoints - special handling
  '/api/phase6/events': {
    maxRequests: 10,
    windowSeconds: 60, // SSE connections
    authenticatedMultiplier: 5,
  },
  '/api/phase6/webhooks': {
    maxRequests: 50,
    windowSeconds: 60,
    authenticatedMultiplier: 2,
  },

  // Metrics endpoint - high limit for scraping
  '/api/phase6/metrics': {
    maxRequests: 120,
    windowSeconds: 60,
  },

  // Default for unlisted endpoints
  default: {
    maxRequests: 60,
    windowSeconds: 60,
    authenticatedMultiplier: 2,
  },
}

// =============================================================================
// IN-MEMORY STORE (for single-instance deployments)
// =============================================================================

const rateLimitStore = new Map<string, RateLimitEntry>()

// Cleanup old entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000
let lastCleanup = Date.now()

function cleanupExpiredEntries(): void {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return

  const maxAge = 300 * 1000 // 5 minutes
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now - entry.windowStart > maxAge) {
      rateLimitStore.delete(key)
    }
  }
  lastCleanup = now
}

// =============================================================================
// RATE LIMITING LOGIC
// =============================================================================

/**
 * Get client identifier from request
 */
function getClientId(request: NextRequest, userId?: string): string {
  // Prefer user ID for authenticated requests
  if (userId) {
    return `user:${userId}`
  }

  // Fall back to IP address
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() ||
             request.headers.get('x-real-ip') ||
             'unknown'

  return `ip:${ip}`
}

/**
 * Get rate limit config for endpoint
 */
function getConfig(path: string): RateLimitConfig {
  // Try exact match first
  if (PHASE6_RATE_LIMITS[path]) {
    return PHASE6_RATE_LIMITS[path]
  }

  // Try prefix match
  for (const [pattern, config] of Object.entries(PHASE6_RATE_LIMITS)) {
    if (pattern !== 'default' && path.startsWith(pattern)) {
      return config
    }
  }

  return PHASE6_RATE_LIMITS.default
}

/**
 * Check rate limit for a request
 */
export function checkRateLimit(
  clientId: string,
  path: string,
  isAuthenticated: boolean = false
): RateLimitResult {
  cleanupExpiredEntries()

  const config = getConfig(path)
  const now = Date.now()
  const windowMs = config.windowSeconds * 1000

  // Calculate effective limit
  let maxRequests = config.maxRequests
  if (isAuthenticated && config.authenticatedMultiplier) {
    maxRequests = Math.floor(maxRequests * config.authenticatedMultiplier)
  }

  const key = `${clientId}:${path}`
  let entry = rateLimitStore.get(key)

  // Initialize or reset window
  if (!entry || now - entry.windowStart >= windowMs) {
    entry = {
      count: 0,
      windowStart: now,
      burstUsed: 0,
    }
  }

  // Check if limit exceeded
  const effectiveMax = maxRequests + (config.burstAllowance || 0) - entry.burstUsed

  if (entry.count >= effectiveMax) {
    const resetAt = entry.windowStart + windowMs
    const retryAfter = Math.ceil((resetAt - now) / 1000)

    return {
      allowed: false,
      remaining: 0,
      resetAt,
      retryAfter,
    }
  }

  // Increment counter
  entry.count++

  // Track burst usage
  if (entry.count > maxRequests && config.burstAllowance) {
    entry.burstUsed++
  }

  rateLimitStore.set(key, entry)

  return {
    allowed: true,
    remaining: Math.max(0, effectiveMax - entry.count),
    resetAt: entry.windowStart + windowMs,
  }
}

/**
 * Create rate limit response headers
 */
export function createRateLimitHeaders(result: RateLimitResult): Headers {
  const headers = new Headers()

  headers.set('X-RateLimit-Remaining', String(result.remaining))
  headers.set('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)))

  if (!result.allowed && result.retryAfter) {
    headers.set('Retry-After', String(result.retryAfter))
  }

  return headers
}

/**
 * Rate limit middleware for Phase 6 endpoints
 */
export async function rateLimitMiddleware(
  request: NextRequest,
  userId?: string
): Promise<NextResponse | null> {
  const path = new URL(request.url).pathname

  // Only apply to Phase 6 endpoints
  if (!path.startsWith('/api/phase6')) {
    return null
  }

  const clientId = getClientId(request, userId)
  const isAuthenticated = !!userId
  const result = checkRateLimit(clientId, path, isAuthenticated)

  if (!result.allowed) {
    const headers = createRateLimitHeaders(result)

    return NextResponse.json(
      {
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Try again in ${result.retryAfter} seconds.`,
        retryAfter: result.retryAfter,
      },
      {
        status: 429,
        headers,
      }
    )
  }

  return null
}

// =============================================================================
// REDIS-BASED RATE LIMITING (for distributed deployments)
// =============================================================================

/**
 * Redis rate limiter interface for distributed deployments
 */
export interface RedisRateLimiter {
  checkLimit(clientId: string, path: string, isAuthenticated?: boolean): Promise<RateLimitResult>
}

/**
 * Create Redis-based rate limiter
 *
 * @example
 * ```typescript
 * import Redis from 'ioredis'
 *
 * const redis = new Redis(process.env.REDIS_URL)
 * const limiter = createRedisRateLimiter(redis)
 *
 * const result = await limiter.checkLimit('user:123', '/api/phase6/stats', true)
 * ```
 */
export function createRedisRateLimiter(redis: {
  eval: (script: string, numkeys: number, ...args: (string | number)[]) => Promise<[number, number]>
}): RedisRateLimiter {
  const script = `
    local key = KEYS[1]
    local max_requests = tonumber(ARGV[1])
    local window_seconds = tonumber(ARGV[2])
    local now = tonumber(ARGV[3])

    local window_start = redis.call('GET', key .. ':start')
    local count = redis.call('GET', key .. ':count')

    if not window_start or (now - tonumber(window_start)) >= (window_seconds * 1000) then
      redis.call('SET', key .. ':start', now)
      redis.call('SET', key .. ':count', 1)
      redis.call('EXPIRE', key .. ':start', window_seconds + 60)
      redis.call('EXPIRE', key .. ':count', window_seconds + 60)
      return {1, max_requests - 1}
    end

    count = tonumber(count) or 0
    if count >= max_requests then
      local reset_at = tonumber(window_start) + (window_seconds * 1000)
      return {0, reset_at}
    end

    redis.call('INCR', key .. ':count')
    return {1, max_requests - count - 1}
  `

  return {
    async checkLimit(clientId, path, isAuthenticated = false): Promise<RateLimitResult> {
      const config = getConfig(path)
      let maxRequests = config.maxRequests

      if (isAuthenticated && config.authenticatedMultiplier) {
        maxRequests = Math.floor(maxRequests * config.authenticatedMultiplier)
      }

      const key = `ratelimit:${clientId}:${path}`
      const now = Date.now()

      const [allowed, value] = await redis.eval(
        script,
        1,
        key,
        maxRequests,
        config.windowSeconds,
        now
      )

      if (allowed === 1) {
        return {
          allowed: true,
          remaining: value,
          resetAt: now + config.windowSeconds * 1000,
        }
      }

      const resetAt = value
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter: Math.ceil((resetAt - now) / 1000),
      }
    },
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export default rateLimitMiddleware
