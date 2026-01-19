/**
 * INTENT Rate Limiting
 *
 * Per-tenant rate limiting with sliding window algorithm.
 * Uses Redis for distributed rate limiting across instances.
 *
 * Uses atomic Lua script to prevent race conditions under high contention.
 */

import { getRedis } from '../common/redis.js';
import { getConfig } from '../common/config.js';
import { createLogger } from '../common/logger.js';
import type { ID } from '../common/types.js';
import { RateLimitError } from '../common/errors.js';

const logger = createLogger({ component: 'ratelimit' });

/**
 * Lua script for atomic rate limit check-and-increment.
 *
 * This script runs atomically in Redis, preventing race conditions
 * where multiple requests could briefly exceed the limit.
 *
 * KEYS[1] - The rate limit key (sorted set)
 * ARGV[1] - Window start timestamp (entries older than this are removed)
 * ARGV[2] - Current timestamp (now)
 * ARGV[3] - Maximum allowed requests (limit)
 * ARGV[4] - Unique request ID
 * ARGV[5] - TTL for the key in seconds
 *
 * Returns: [allowed (0 or 1), currentCount, oldestTimestamp or 0]
 */
const RATE_LIMIT_LUA_SCRIPT = `
local key = KEYS[1]
local windowStart = tonumber(ARGV[1])
local now = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local requestId = ARGV[4]
local ttl = tonumber(ARGV[5])

-- Step 1: Remove old entries outside the window
redis.call('ZREMRANGEBYSCORE', key, '-inf', windowStart)

-- Step 2: Count current entries in window
local currentCount = redis.call('ZCARD', key)

-- Step 3: Check if we're under the limit
if currentCount < limit then
  -- Under limit: add the new request
  redis.call('ZADD', key, now, requestId)
  redis.call('EXPIRE', key, ttl)

  -- Get oldest entry for reset calculation
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local oldestTimestamp = 0
  if #oldest >= 2 then
    oldestTimestamp = tonumber(oldest[2])
  end

  return {1, currentCount + 1, oldestTimestamp}
else
  -- At or over limit: deny without adding
  -- Get oldest entry for reset calculation
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local oldestTimestamp = 0
  if #oldest >= 2 then
    oldestTimestamp = tonumber(oldest[2])
  end

  return {0, currentCount, oldestTimestamp}
end
`;

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

/**
 * Map intent type names to config property names.
 * Intent types use kebab-case (e.g., 'high-risk'), config uses camelCase (e.g., 'highRisk').
 */
const INTENT_TYPE_TO_CONFIG_KEY: Record<string, 'default' | 'highRisk' | 'dataExport' | 'adminAction'> = {
  'default': 'default',
  'high-risk': 'highRisk',
  'data-export': 'dataExport',
  'admin-action': 'adminAction',
};

/**
 * Rate Limiter Service
 */
export class RateLimiter {
  private redis = getRedis();
  private config = getConfig();
  private readonly keyPrefix = 'ratelimit:';

  /**
   * Check and consume rate limit for a tenant.
   *
   * Uses an atomic Lua script to prevent race conditions under high contention.
   * The script atomically:
   * 1. Removes expired entries outside the sliding window
   * 2. Counts current entries
   * 3. Only adds the new request if under the limit
   *
   * This eliminates the race condition in the previous optimistic add pattern
   * where multiple concurrent requests could briefly exceed the limit.
   */
  async checkLimit(
    tenantId: ID,
    intentType?: string | null
  ): Promise<RateLimitResult> {
    const limitConfig = this.getLimitConfig(tenantId, intentType);
    const key = this.buildKey(tenantId, intentType);
    const now = Date.now();
    const windowStart = now - limitConfig.windowSeconds * 1000;
    const requestId = `${now}:${Math.random().toString(36).slice(2)}`;
    const ttl = limitConfig.windowSeconds + 1;

    // Execute atomic Lua script for rate limiting
    // Returns: [allowed (0 or 1), currentCount, oldestTimestamp]
    const result = await this.redis.eval(
      RATE_LIMIT_LUA_SCRIPT,
      1,
      key,
      windowStart.toString(),
      now.toString(),
      limitConfig.limit.toString(),
      requestId,
      ttl.toString()
    ) as [number, number, number];

    const [allowedFlag, currentCount, oldestTimestamp] = result;
    const allowed = allowedFlag === 1;

    // Calculate reset time based on oldest entry
    let resetIn = limitConfig.windowSeconds;
    if (oldestTimestamp > 0) {
      resetIn = Math.max(0, Math.ceil((oldestTimestamp + limitConfig.windowSeconds * 1000 - now) / 1000));
    }

    const remaining = Math.max(0, limitConfig.limit - currentCount);

    if (!allowed) {
      logger.warn(
        { tenantId, intentType, current: currentCount, limit: limitConfig.limit },
        'Rate limit exceeded'
      );
    }

    const baseResult = {
      allowed,
      current: currentCount,
      limit: limitConfig.limit,
      remaining,
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
   * Get limit configuration for tenant/intent type.
   *
   * Priority order:
   * 1. Tenant-specific overrides (tenantMaxInFlight)
   * 2. Intent type-specific limits from config (rateLimits.highRisk, etc.)
   * 3. Default rate limit from config (rateLimits.default)
   */
  private getLimitConfig(tenantId: ID, intentType?: string | null): RateLimitConfig {
    const rateLimits = this.config.intent.rateLimits;
    // Default values (these are guaranteed by Zod schema defaults)
    const defaultLimit = rateLimits.default.limit ?? 100;
    const defaultWindow = rateLimits.default.windowSeconds ?? 60;

    // Check tenant-specific overrides first
    const tenantOverrides = this.config.intent.tenantMaxInFlight;
    const tenantLimit = tenantOverrides[tenantId];
    if (tenantLimit !== undefined) {
      return {
        limit: tenantLimit,
        windowSeconds: defaultWindow,
      };
    }

    // Check intent type limits from config
    if (intentType) {
      const configKey = INTENT_TYPE_TO_CONFIG_KEY[intentType];
      if (configKey && rateLimits[configKey]) {
        const typeConfig = rateLimits[configKey];
        return {
          limit: typeConfig.limit ?? defaultLimit,
          windowSeconds: typeConfig.windowSeconds ?? defaultWindow,
        };
      }
    }

    // Use default rate limit from config
    return {
      limit: defaultLimit,
      windowSeconds: defaultWindow,
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
      // Throw a typed error for consistent error handling
      const error = new RateLimitError(
        `Rate limit exceeded. Retry after ${result.retryAfter} seconds.`,
        result.retryAfter,
        { tenantId, intentType, current: result.current, limit: result.limit }
      );
      return reply.status(error.statusCode).send({
        error: error.toJSON(),
      });
    }

    return undefined;
  };
}
