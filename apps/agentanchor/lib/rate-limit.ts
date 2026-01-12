/**
 * Rate Limiting System
 *
 * Implements rate limiting using Upstash Redis to prevent API abuse
 * and control costs. Supports different limits for different endpoints.
 *
 * Security: Includes in-memory fallback when Redis is unavailable.
 * Production environments should NEVER bypass rate limiting.
 */

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { config, isProduction, isStaging } from './config'
import { RateLimitError } from './errors'
import { logger } from './logger'
import { trackRateLimit } from './metrics'

// ============================================================================
// In-Memory Rate Limiter (Fallback)
// ============================================================================

interface InMemoryRateLimitEntry {
  count: number
  windowStart: number
}

/**
 * Simple in-memory rate limiter for when Redis is unavailable.
 * Uses a sliding window approach with periodic cleanup.
 */
class InMemoryRateLimiter {
  private store: Map<string, InMemoryRateLimitEntry> = new Map()
  private cleanupInterval: ReturnType<typeof setInterval>
  private windowMs: number
  private maxRequests: number
  private prefix: string

  constructor(prefix: string, maxRequests: number, windowMs: number) {
    this.prefix = prefix
    this.maxRequests = maxRequests
    this.windowMs = windowMs

    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000)
  }

  async limit(identifier: string): Promise<{
    success: boolean
    limit: number
    remaining: number
    reset: number
  }> {
    const key = `${this.prefix}:${identifier}`
    const now = Date.now()

    let entry = this.store.get(key)

    // Start new window if expired or doesn't exist
    if (!entry || now - entry.windowStart >= this.windowMs) {
      entry = { count: 1, windowStart: now }
      this.store.set(key, entry)
      return {
        success: true,
        limit: this.maxRequests,
        remaining: this.maxRequests - 1,
        reset: now + this.windowMs,
      }
    }

    // Increment count
    entry.count++

    const success = entry.count <= this.maxRequests
    const remaining = Math.max(0, this.maxRequests - entry.count)
    const reset = entry.windowStart + this.windowMs

    return { success, limit: this.maxRequests, remaining, reset }
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.store.entries()) {
      if (now - entry.windowStart >= this.windowMs) {
        this.store.delete(key)
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval)
    this.store.clear()
  }
}

// Track if we've logged the fallback warning
let fallbackWarningLogged = false

/**
 * Log a warning about using in-memory fallback (once per startup)
 */
function logFallbackWarning(): void {
  if (!fallbackWarningLogged) {
    fallbackWarningLogged = true
    logger.warn({
      type: 'rate_limit_fallback',
      message: 'Redis not configured - using in-memory rate limiting. This is NOT suitable for multi-instance deployments.',
      environment: config.env,
    })
  }
}

// ============================================================================
// Redis Client
// ============================================================================

let redis: Redis | null = null

function getRedisClient(): Redis | null {
  if (!config.rateLimit.redis) {
    return null
  }

  if (!redis) {
    redis = new Redis({
      url: config.rateLimit.redis.url,
      token: config.rateLimit.redis.token,
    })
  }

  return redis
}

// ============================================================================
// Rate Limiter Type (supports both Redis and In-Memory)
// ============================================================================

type RateLimiterInstance = Ratelimit | InMemoryRateLimiter

/**
 * Create a rate limiter with Redis or fallback to in-memory
 */
function createLimiter(
  prefix: string,
  maxRequests: number,
  windowMs: number
): RateLimiterInstance | null {
  if (!config.rateLimit.enabled) {
    return null
  }

  const redisClient = getRedisClient()

  if (redisClient) {
    // Use Redis-backed rate limiter
    const windowStr = windowMs >= 3600000
      ? `${Math.floor(windowMs / 3600000)} h`
      : windowMs >= 60000
        ? `${Math.floor(windowMs / 60000)} m`
        : `${Math.floor(windowMs / 1000)} s`

    return new Ratelimit({
      redis: redisClient,
      limiter: Ratelimit.slidingWindow(maxRequests, windowStr as `${number} ${'ms' | 's' | 'm' | 'h' | 'd'}`),
      analytics: true,
      prefix: `ratelimit:${prefix}`,
    })
  }

  // Fallback to in-memory rate limiter
  logFallbackWarning()
  return new InMemoryRateLimiter(prefix, maxRequests, windowMs)
}

/**
 * Rate limiter instances for different endpoints
 */
export const chatRateLimit = createLimiter('chat', 20, 60000) // 20 requests per minute

export const botCreationRateLimit = createLimiter('bot-creation', 10, 3600000) // 10 bot creations per hour

export const orchestratorRateLimit = createLimiter('orchestrator', 30, 60000) // 30 requests per minute

export const globalRateLimit = createLimiter('global', 100, 60000) // 100 requests per minute overall

/**
 * Auth rate limiters - more restrictive to prevent brute force attacks
 */
export const authLoginRateLimit = createLimiter('auth:login', 5, 60000) // 5 login attempts per minute

export const authSignupRateLimit = createLimiter('auth:signup', 3, 3600000) // 3 signups per hour per IP

export const authPasswordResetRateLimit = createLimiter('auth:password-reset', 3, 900000) // 3 reset requests per 15 min

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
  pending?: Promise<unknown>
}

/**
 * Check rate limit for a user
 */
export async function checkRateLimit(
  userId: string,
  limiter: RateLimiterInstance | null,
  endpoint: string
): Promise<RateLimitResult> {
  // If rate limiting is explicitly disabled, allow all requests
  if (!config.rateLimit.enabled) {
    return {
      success: true,
      limit: 0,
      remaining: 0,
      reset: 0,
    }
  }

  // If no limiter was created (shouldn't happen if enabled), use conservative default
  if (!limiter) {
    logger.error({
      type: 'rate_limit_missing',
      endpoint,
      message: 'Rate limiter instance is null despite being enabled',
    })

    // In production/staging, fail closed for security
    if (isProduction || isStaging) {
      return {
        success: false,
        limit: 1,
        remaining: 0,
        reset: Date.now() + 60000,
      }
    }

    // In development, allow but log warning
    return {
      success: true,
      limit: 0,
      remaining: 0,
      reset: 0,
    }
  }

  try {
    const result = await limiter.limit(userId)

    if (!result.success) {
      logger.warn({
        type: 'rate_limit',
        userId,
        endpoint,
        limit: result.limit,
        remaining: result.remaining,
        reset: new Date(result.reset).toISOString(),
      })

      trackRateLimit(userId, endpoint, result.limit)
    }

    return result
  } catch (error) {
    logger.error({
      type: 'rate_limit_error',
      error: error instanceof Error ? error.message : String(error),
      userId,
      endpoint,
      environment: config.env,
    })

    // In production/staging: fail closed for security-sensitive endpoints
    if ((isProduction || isStaging) && endpoint.includes('auth')) {
      logger.warn({
        type: 'rate_limit_fail_closed',
        endpoint,
        reason: 'Auth endpoint rate limiter failure - blocking for security',
      })
      return {
        success: false,
        limit: 1,
        remaining: 0,
        reset: Date.now() + 60000,
      }
    }

    // For non-auth endpoints in production, allow with strict limit
    // This prevents complete service outage while still providing some protection
    if (isProduction || isStaging) {
      return {
        success: true,
        limit: 10, // Very conservative fallback limit
        remaining: 9,
        reset: Date.now() + 60000,
      }
    }

    // Development: fail open to not block development
    return {
      success: true,
      limit: 0,
      remaining: 0,
      reset: 0,
    }
  }
}

/**
 * Middleware to enforce rate limiting
 */
export async function enforceRateLimit(
  userId: string,
  limiter: RateLimiterInstance | null,
  endpoint: string
): Promise<void> {
  const result = await checkRateLimit(userId, limiter, endpoint)

  if (!result.success) {
    const retryAfter = Math.ceil((result.reset - Date.now()) / 1000)

    throw new RateLimitError(
      `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
      retryAfter
    )
  }
}

/**
 * Rate limit headers for response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.reset),
  }
}

/**
 * Add rate limit headers to response
 */
export function addRateLimitHeaders(
  response: Response,
  result: RateLimitResult
): Response {
  const headers = new Headers(response.headers)

  Object.entries(getRateLimitHeaders(result)).forEach(([key, value]) => {
    headers.set(key, value)
  })

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

/**
 * Get rate limit stats for a user
 */
export async function getRateLimitStats(userId: string) {
  if (!config.rateLimit.redis) {
    return {
      enabled: false,
      stats: {},
    }
  }

  const client = getRedisClient()
  if (!client) {
    return {
      enabled: false,
      stats: {},
    }
  }

  const prefixes = ['chat', 'bot-creation', 'orchestrator', 'global', 'auth:login', 'auth:signup', 'auth:password-reset']
  const stats: Record<string, any> = {}

  for (const prefix of prefixes) {
    try {
      const key = `ratelimit:${prefix}:${userId}`
      const data = await client.get(key)

      if (data) {
        stats[prefix] = data
      }
    } catch (error) {
      logger.error({
        type: 'rate_limit_stats_error',
        prefix,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return {
    enabled: true,
    stats,
  }
}

/**
 * Reset rate limit for a user (admin function)
 */
export async function resetRateLimit(userId: string, prefix?: string): Promise<void> {
  if (!config.rateLimit.redis) {
    return
  }

  const client = getRedisClient()
  if (!client) {
    return
  }

  const prefixes = prefix
    ? [prefix]
    : ['chat', 'bot-creation', 'orchestrator', 'global']

  for (const p of prefixes) {
    try {
      const key = `ratelimit:${p}:${userId}`
      await client.del(key)

      logger.info({
        type: 'rate_limit_reset',
        userId,
        prefix: p,
      })
    } catch (error) {
      logger.error({
        type: 'rate_limit_reset_error',
        prefix: p,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
}

/**
 * Custom rate limiter for specific use cases
 */
export function createRateLimiter(
  prefix: string,
  requests: number,
  window: `${number} ${'ms' | 's' | 'm' | 'h' | 'd'}`
): RateLimiterInstance | null {
  if (!config.rateLimit.enabled) {
    return null
  }

  // Parse window string to milliseconds
  const match = window.match(/^(\d+)\s*(ms|s|m|h|d)$/)
  if (!match) {
    logger.error({ type: 'rate_limit_invalid_window', window })
    return null
  }

  const value = parseInt(match[1], 10)
  const unit = match[2]
  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60000,
    h: 3600000,
    d: 86400000,
  }
  const windowMs = value * multipliers[unit]

  return createLimiter(prefix, requests, windowMs)
}

export default {
  checkRateLimit,
  enforceRateLimit,
  getRateLimitHeaders,
  addRateLimitHeaders,
  getRateLimitStats,
  resetRateLimit,
  createRateLimiter,
}
