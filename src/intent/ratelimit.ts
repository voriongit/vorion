/**
 * INTENT Rate Limiting
 *
 * Per-tenant rate limiting with sliding window algorithm.
 * Uses Redis for distributed rate limiting across instances.
 */

import { getRedis } from '../common/redis.js';
import { getConfig } from '../common/config.js';
import { createLogger } from '../common/logger.js';
import type { ID } from '../common/types.js';

const logger = createLogger({ component: 'ratelimit' });

export interface RateLimitConfig {
  /** Maximum requests per window */
  limit: number;
  /** Window size in seconds */
  windowSeconds: number;
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Current request count in window */
  current: number;
  /** Maximum requests allowed */
  limit: number;
  /** Remaining requests in window */
  remaining: number;
  /** Seconds until window resets */
  resetIn: number;
  /** Retry after seconds (if not allowed) */
  retryAfter?: number;
}

export interface RateLimitHeaders {
  'X-RateLimit-Limit': string;
  'X-RateLimit-Remaining': string;
  'X-RateLimit-Reset': string;
  'Retry-After'?: string;
}

// Default rate limits per intent type
const DEFAULT_LIMITS: Record<string, RateLimitConfig> = {
  default: { limit: 100, windowSeconds: 60 },
  'high-risk': { limit: 10, windowSeconds: 60 },
  'data-export': { limit: 5, windowSeconds: 60 },
  'admin-action': { limit: 20, windowSeconds: 60 },
};

/**
 * Rate Limiter Service
 */
export class RateLimiter {
  private redis = getRedis();
  private config = getConfig();
  private readonly keyPrefix = 'ratelimit:';

  /**
   * Check and consume rate limit for a tenant
   */
  async checkLimit(
    tenantId: ID,
    intentType?: string | null
  ): Promise<RateLimitResult> {
    const limitConfig = this.getLimitConfig(tenantId, intentType);
    const key = this.buildKey(tenantId, intentType);
    const now = Date.now();
    const windowStart = now - limitConfig.windowSeconds * 1000;

    // Use Redis sorted set for sliding window
    // Score = timestamp, Member = unique request ID
    const multi = this.redis.multi();

    // Remove old entries outside the window
    multi.zremrangebyscore(key, '-inf', windowStart.toString());

    // Count current entries in window
    multi.zcard(key);

    // Add current request (optimistically)
    const requestId = `${now}:${Math.random().toString(36).slice(2)}`;
    multi.zadd(key, now, requestId);

    // Set TTL on the key
    multi.expire(key, limitConfig.windowSeconds + 1);

    const results = await multi.exec();

    // results[1] is the zcard result (count before adding)
    const currentCount = (results?.[1]?.[1] as number) ?? 0;

    const allowed = currentCount < limitConfig.limit;
    const remaining = Math.max(0, limitConfig.limit - currentCount - 1);

    // Calculate reset time
    const oldestEntry = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
    let resetIn = limitConfig.windowSeconds;
    if (oldestEntry.length >= 2) {
      const oldestTimestamp = parseInt(oldestEntry[1] ?? '0', 10);
      resetIn = Math.max(0, Math.ceil((oldestTimestamp + limitConfig.windowSeconds * 1000 - now) / 1000));
    }

    if (!allowed) {
      // Remove the request we just added since it's not allowed
      await this.redis.zrem(key, requestId);

      logger.warn(
        { tenantId, intentType, current: currentCount, limit: limitConfig.limit },
        'Rate limit exceeded'
      );
    }

    const baseResult = {
      allowed,
      current: currentCount + (allowed ? 1 : 0),
      limit: limitConfig.limit,
      remaining: allowed ? remaining : 0,
      resetIn,
    };

    return allowed
      ? baseResult
      : { ...baseResult, retryAfter: resetIn };
  }

  /**
   * Get current rate limit status without consuming
   */
  async getStatus(
    tenantId: ID,
    intentType?: string | null
  ): Promise<RateLimitResult> {
    const limitConfig = this.getLimitConfig(tenantId, intentType);
    const key = this.buildKey(tenantId, intentType);
    const now = Date.now();
    const windowStart = now - limitConfig.windowSeconds * 1000;

    // Clean up old entries
    await this.redis.zremrangebyscore(key, '-inf', windowStart.toString());

    // Get current count
    const currentCount = await this.redis.zcard(key);
    const remaining = Math.max(0, limitConfig.limit - currentCount);

    // Calculate reset time
    const oldestEntry = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
    let resetIn = limitConfig.windowSeconds;
    if (oldestEntry.length >= 2) {
      const oldestTimestamp = parseInt(oldestEntry[1] ?? '0', 10);
      resetIn = Math.max(0, Math.ceil((oldestTimestamp + limitConfig.windowSeconds * 1000 - now) / 1000));
    }

    return {
      allowed: currentCount < limitConfig.limit,
      current: currentCount,
      limit: limitConfig.limit,
      remaining,
      resetIn,
    };
  }

  /**
   * Reset rate limit for a tenant (admin operation)
   */
  async reset(tenantId: ID, intentType?: string | null): Promise<void> {
    const key = this.buildKey(tenantId, intentType);
    await this.redis.del(key);
    logger.info({ tenantId, intentType }, 'Rate limit reset');
  }

  /**
   * Convert rate limit result to HTTP headers
   */
  toHeaders(result: RateLimitResult): RateLimitHeaders {
    const headers: RateLimitHeaders = {
      'X-RateLimit-Limit': result.limit.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': result.resetIn.toString(),
    };

    if (result.retryAfter !== undefined) {
      headers['Retry-After'] = result.retryAfter.toString();
    }

    return headers;
  }

  /**
   * Get limit configuration for tenant/intent type
   */
  private getLimitConfig(tenantId: ID, intentType?: string | null): RateLimitConfig {
    // Check tenant-specific overrides first
    const tenantOverrides = this.config.intent.tenantMaxInFlight;
    const tenantLimit = tenantOverrides[tenantId];
    if (tenantLimit !== undefined) {
      return {
        limit: tenantLimit,
        windowSeconds: 60,
      };
    }

    // Check intent type limits
    if (intentType) {
      const typeLimit = DEFAULT_LIMITS[intentType];
      if (typeLimit) {
        return typeLimit;
      }
    }

    // Use API rate limit from config
    return {
      limit: this.config.api.rateLimit,
      windowSeconds: 60,
    };
  }

  /**
   * Build Redis key for rate limiting
   */
  private buildKey(tenantId: ID, intentType?: string | null): string {
    const type = intentType ?? 'default';
    return `${this.keyPrefix}${tenantId}:${type}`;
  }
}

/**
 * Create rate limiter instance
 */
export function createRateLimiter(): RateLimiter {
  return new RateLimiter();
}

/**
 * Fastify rate limit hook
 */
export function createRateLimitHook(rateLimiter: RateLimiter) {
  return async (request: { headers: Record<string, string | string[] | undefined>; body?: unknown }, reply: { header: (name: string, value: string) => void; status: (code: number) => { send: (body: unknown) => unknown } }): Promise<unknown> => {
    // Extract tenant ID from header or JWT
    const tenantId = request.headers['x-tenant-id'] as string | undefined;
    if (!tenantId) {
      return undefined; // Skip rate limiting if no tenant ID
    }

    // Extract intent type from body if available
    const body = request.body as { intentType?: string } | undefined;
    const intentType = body?.intentType;

    const result = await rateLimiter.checkLimit(tenantId, intentType);
    const headers = rateLimiter.toHeaders(result);

    // Set rate limit headers
    for (const [name, value] of Object.entries(headers)) {
      reply.header(name, value);
    }

    if (!result.allowed) {
      return reply.status(429).send({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Rate limit exceeded. Retry after ${result.retryAfter} seconds.`,
          retryAfter: result.retryAfter,
        },
      });
    }

    return undefined;
  };
}
