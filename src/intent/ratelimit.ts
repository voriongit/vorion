/**
 * INTENT Rate Limiting
 *
 * Per-tenant and per-entity rate limiting with sliding window algorithm.
 * Uses Redis for distributed rate limiting across instances.
 *
 * Uses atomic Lua script to prevent race conditions under high contention.
 *
 * Enterprise Features:
 * - Per-tenant rate limiting (existing)
 * - Per-entity rate limiting (new) - prevents single malicious agent from flooding
 */

import { getRedis } from '../common/redis.js';
import { getConfig } from '../common/config.js';
import { createLogger } from '../common/logger.js';
import type { ID } from '../common/types.js';
import { RateLimitError } from '../common/errors.js';
import { Counter, Histogram } from 'prom-client';
import { intentRegistry } from './metrics.js';

const logger = createLogger({ component: 'ratelimit' });

// ============================================================================
// Entity Rate Limiting Metrics
// ============================================================================

/**
 * Entity rate limit checks total
 */
const entityRateLimitChecksTotal = new Counter({
  name: 'vorion_entity_rate_limit_checks_total',
  help: 'Total entity-level rate limit checks',
  labelNames: ['tenant_id', 'outcome'] as const, // outcome: allowed, denied
  registers: [intentRegistry],
});

/**
 * Entity rate limit current usage (as percentage of limit)
 */
const entityRateLimitUsage = new Histogram({
  name: 'vorion_entity_rate_limit_usage_ratio',
  help: 'Entity rate limit usage as ratio of current/limit (0-1+)',
  labelNames: ['tenant_id'] as const,
  buckets: [0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 1.0, 1.5, 2.0],
  registers: [intentRegistry],
});

/**
 * Entity rate limit denials by entity (tracks problem entities)
 */
const entityRateLimitDenialsTotal = new Counter({
  name: 'vorion_entity_rate_limit_denials_total',
  help: 'Total entity-level rate limit denials',
  labelNames: ['tenant_id', 'intent_type'] as const,
  registers: [intentRegistry],
});

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

/**
 * Lua script for atomic dual rate limit check (tenant AND entity).
 *
 * This script checks both tenant-level and entity-level rate limits atomically,
 * only incrementing both counters if both limits allow the request.
 *
 * KEYS[1] - The tenant rate limit key (sorted set)
 * KEYS[2] - The entity rate limit key (sorted set)
 * ARGV[1] - Window start timestamp for tenant
 * ARGV[2] - Current timestamp (now)
 * ARGV[3] - Tenant limit
 * ARGV[4] - Entity limit
 * ARGV[5] - Unique request ID
 * ARGV[6] - Tenant TTL in seconds
 * ARGV[7] - Entity TTL in seconds
 * ARGV[8] - Window start timestamp for entity
 *
 * Returns: [
 *   tenantAllowed (0 or 1),
 *   tenantCurrentCount,
 *   tenantOldestTimestamp,
 *   entityAllowed (0 or 1),
 *   entityCurrentCount,
 *   entityOldestTimestamp
 * ]
 */
const DUAL_RATE_LIMIT_LUA_SCRIPT = `
local tenantKey = KEYS[1]
local entityKey = KEYS[2]
local tenantWindowStart = tonumber(ARGV[1])
local now = tonumber(ARGV[2])
local tenantLimit = tonumber(ARGV[3])
local entityLimit = tonumber(ARGV[4])
local requestId = ARGV[5]
local tenantTtl = tonumber(ARGV[6])
local entityTtl = tonumber(ARGV[7])
local entityWindowStart = tonumber(ARGV[8])

-- Helper function to get oldest timestamp
local function getOldest(key)
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  if #oldest >= 2 then
    return tonumber(oldest[2])
  end
  return 0
end

-- Step 1: Clean up old entries for both keys
redis.call('ZREMRANGEBYSCORE', tenantKey, '-inf', tenantWindowStart)
redis.call('ZREMRANGEBYSCORE', entityKey, '-inf', entityWindowStart)

-- Step 2: Count current entries
local tenantCount = redis.call('ZCARD', tenantKey)
local entityCount = redis.call('ZCARD', entityKey)

-- Step 3: Check both limits
local tenantAllowed = tenantCount < tenantLimit and 1 or 0
local entityAllowed = entityCount < entityLimit and 1 or 0

-- Step 4: Only increment if BOTH are allowed (atomic transaction)
if tenantAllowed == 1 and entityAllowed == 1 then
  redis.call('ZADD', tenantKey, now, requestId)
  redis.call('EXPIRE', tenantKey, tenantTtl)
  redis.call('ZADD', entityKey, now, requestId)
  redis.call('EXPIRE', entityKey, entityTtl)
  tenantCount = tenantCount + 1
  entityCount = entityCount + 1
end

-- Return results for both
return {
  tenantAllowed,
  tenantCount,
  getOldest(tenantKey),
  entityAllowed,
  entityCount,
  getOldest(entityKey)
}
`;

export interface RateLimitConfig {
  /** Maximum requests per window */
  limit: number;
  /** Window size in seconds */
  windowSeconds: number;
}

export interface EntityRateLimitConfig {
  /** Maximum requests per window per entity */
  limit: number;
  /** Window size in seconds */
  windowSeconds: number;
  /** Whether entity rate limiting is enabled */
  enabled: boolean;
}

/** Default entity rate limit configuration */
const DEFAULT_ENTITY_RATE_LIMIT: EntityRateLimitConfig = {
  limit: 100,
  windowSeconds: 60,
  enabled: true,
};

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

export interface EntityRateLimitResult extends RateLimitResult {
  /** The entity that was rate limited */
  entityId: ID;
}

export interface CombinedRateLimitResult {
  /** Tenant-level rate limit result */
  tenant: RateLimitResult;
  /** Entity-level rate limit result (if checked) */
  entity?: EntityRateLimitResult;
  /** Overall allowed status (both must pass) */
  allowed: boolean;
  /** Which limit was exceeded (if any) */
  limitExceeded?: 'tenant' | 'entity' | 'both';
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
 *
 * Provides both per-tenant and per-entity rate limiting for enterprise use cases.
 * Per-entity limiting prevents a single malicious agent from flooding the system
 * even within a trusted tenant.
 */
export class RateLimiter {
  private redis = getRedis();
  private config = getConfig();
  private readonly keyPrefix = 'ratelimit:';
  private readonly entityKeyPrefix = 'ratelimit:entity:';

  /** Cached entity rate limit config for performance */
  private entityRateLimitConfig: EntityRateLimitConfig | null = null;

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
   * Check and consume rate limit for an entity within a tenant.
   *
   * This prevents a single malicious agent from flooding the system
   * even within a trusted tenant. Uses a separate Redis key pattern:
   * `ratelimit:entity:${tenantId}:${entityId}`
   *
   * @param tenantId - The tenant identifier
   * @param entityId - The entity (agent) identifier
   * @param intentType - Optional intent type for type-specific limits
   */
  async checkEntityLimit(
    tenantId: ID,
    entityId: ID,
    intentType?: string | null
  ): Promise<EntityRateLimitResult> {
    const limitConfig = this.getEntityLimitConfig(tenantId, entityId);

    // If entity rate limiting is disabled, always allow
    if (!limitConfig.enabled) {
      return {
        allowed: true,
        current: 0,
        limit: limitConfig.limit,
        remaining: limitConfig.limit,
        resetIn: 0,
        entityId,
      };
    }

    const key = this.buildEntityKey(tenantId, entityId);
    const now = Date.now();
    const windowStart = now - limitConfig.windowSeconds * 1000;
    const requestId = `${now}:${Math.random().toString(36).slice(2)}`;
    const ttl = limitConfig.windowSeconds + 1;

    // Execute atomic Lua script for rate limiting
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

    // Record metrics
    entityRateLimitChecksTotal.inc({
      tenant_id: tenantId,
      outcome: allowed ? 'allowed' : 'denied',
    });

    entityRateLimitUsage.observe(
      { tenant_id: tenantId },
      currentCount / limitConfig.limit
    );

    if (!allowed) {
      entityRateLimitDenialsTotal.inc({
        tenant_id: tenantId,
        intent_type: intentType ?? 'default',
      });

      logger.warn(
        { tenantId, entityId, intentType, current: currentCount, limit: limitConfig.limit },
        'Entity rate limit exceeded'
      );
    }

    const baseResult = {
      allowed,
      current: currentCount,
      limit: limitConfig.limit,
      remaining,
      resetIn,
      entityId,
    };

    return allowed
      ? baseResult
      : { ...baseResult, retryAfter: resetIn };
  }

  /**
   * Check both tenant and entity rate limits atomically.
   *
   * This is the recommended method for enterprise use - it ensures
   * both limits are checked and updated in a single atomic operation,
   * preventing race conditions where one limit passes but the other fails.
   *
   * @param tenantId - The tenant identifier
   * @param entityId - The entity (agent) identifier
   * @param intentType - Optional intent type for type-specific limits
   */
  async checkCombinedLimit(
    tenantId: ID,
    entityId: ID,
    intentType?: string | null
  ): Promise<CombinedRateLimitResult> {
    const tenantConfig = this.getLimitConfig(tenantId, intentType);
    const entityConfig = this.getEntityLimitConfig(tenantId, entityId);

    // If entity rate limiting is disabled, fall back to tenant-only
    if (!entityConfig.enabled) {
      const tenantResult = await this.checkLimit(tenantId, intentType);
      return {
        tenant: tenantResult,
        allowed: tenantResult.allowed,
        limitExceeded: tenantResult.allowed ? undefined : 'tenant',
      };
    }

    const tenantKey = this.buildKey(tenantId, intentType);
    const entityKey = this.buildEntityKey(tenantId, entityId);
    const now = Date.now();
    const tenantWindowStart = now - tenantConfig.windowSeconds * 1000;
    const entityWindowStart = now - entityConfig.windowSeconds * 1000;
    const requestId = `${now}:${Math.random().toString(36).slice(2)}`;
    const tenantTtl = tenantConfig.windowSeconds + 1;
    const entityTtl = entityConfig.windowSeconds + 1;

    // Execute atomic dual rate limit check
    const result = await this.redis.eval(
      DUAL_RATE_LIMIT_LUA_SCRIPT,
      2,
      tenantKey,
      entityKey,
      tenantWindowStart.toString(),
      now.toString(),
      tenantConfig.limit.toString(),
      entityConfig.limit.toString(),
      requestId,
      tenantTtl.toString(),
      entityTtl.toString(),
      entityWindowStart.toString()
    ) as [number, number, number, number, number, number];

    const [
      tenantAllowedFlag,
      tenantCount,
      tenantOldestTimestamp,
      entityAllowedFlag,
      entityCount,
      entityOldestTimestamp,
    ] = result;

    const tenantAllowed = tenantAllowedFlag === 1;
    const entityAllowed = entityAllowedFlag === 1;
    const bothAllowed = tenantAllowed && entityAllowed;

    // Calculate reset times
    let tenantResetIn = tenantConfig.windowSeconds;
    if (tenantOldestTimestamp > 0) {
      tenantResetIn = Math.max(0, Math.ceil((tenantOldestTimestamp + tenantConfig.windowSeconds * 1000 - now) / 1000));
    }

    let entityResetIn = entityConfig.windowSeconds;
    if (entityOldestTimestamp > 0) {
      entityResetIn = Math.max(0, Math.ceil((entityOldestTimestamp + entityConfig.windowSeconds * 1000 - now) / 1000));
    }

    const tenantRemaining = Math.max(0, tenantConfig.limit - tenantCount);
    const entityRemaining = Math.max(0, entityConfig.limit - entityCount);

    // Build tenant result
    const tenantResult: RateLimitResult = {
      allowed: tenantAllowed,
      current: tenantCount,
      limit: tenantConfig.limit,
      remaining: tenantRemaining,
      resetIn: tenantResetIn,
      ...(tenantAllowed ? {} : { retryAfter: tenantResetIn }),
    };

    // Build entity result
    const entityResult: EntityRateLimitResult = {
      allowed: entityAllowed,
      current: entityCount,
      limit: entityConfig.limit,
      remaining: entityRemaining,
      resetIn: entityResetIn,
      entityId,
      ...(entityAllowed ? {} : { retryAfter: entityResetIn }),
    };

    // Record metrics
    entityRateLimitChecksTotal.inc({
      tenant_id: tenantId,
      outcome: entityAllowed ? 'allowed' : 'denied',
    });

    entityRateLimitUsage.observe(
      { tenant_id: tenantId },
      entityCount / entityConfig.limit
    );

    // Determine which limit was exceeded
    let limitExceeded: 'tenant' | 'entity' | 'both' | undefined;
    if (!tenantAllowed && !entityAllowed) {
      limitExceeded = 'both';
    } else if (!tenantAllowed) {
      limitExceeded = 'tenant';
    } else if (!entityAllowed) {
      limitExceeded = 'entity';
      entityRateLimitDenialsTotal.inc({
        tenant_id: tenantId,
        intent_type: intentType ?? 'default',
      });
    }

    if (!bothAllowed) {
      logger.warn(
        {
          tenantId,
          entityId,
          intentType,
          limitExceeded,
          tenantCurrent: tenantCount,
          tenantLimit: tenantConfig.limit,
          entityCurrent: entityCount,
          entityLimit: entityConfig.limit,
        },
        'Rate limit exceeded'
      );
    }

    return {
      tenant: tenantResult,
      entity: entityResult,
      allowed: bothAllowed,
      limitExceeded,
    };
  }

  /**
   * Get current entity rate limit status without consuming
   */
  async getEntityStatus(
    tenantId: ID,
    entityId: ID
  ): Promise<EntityRateLimitResult> {
    const limitConfig = this.getEntityLimitConfig(tenantId, entityId);

    if (!limitConfig.enabled) {
      return {
        allowed: true,
        current: 0,
        limit: limitConfig.limit,
        remaining: limitConfig.limit,
        resetIn: 0,
        entityId,
      };
    }

    const key = this.buildEntityKey(tenantId, entityId);
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
      entityId,
    };
  }

  /**
   * Reset entity rate limit (admin operation)
   */
  async resetEntity(tenantId: ID, entityId: ID): Promise<void> {
    const key = this.buildEntityKey(tenantId, entityId);
    await this.redis.del(key);
    logger.info({ tenantId, entityId }, 'Entity rate limit reset');
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

  /**
   * Build Redis key for entity rate limiting
   */
  private buildEntityKey(tenantId: ID, entityId: ID): string {
    return `${this.entityKeyPrefix}${tenantId}:${entityId}`;
  }

  /**
   * Get entity rate limit configuration.
   *
   * Priority order:
   * 1. Entity-specific overrides (if configured via config.intent.entityRateLimits)
   * 2. Tenant-specific entity limits (if configured)
   * 3. Default entity rate limit
   *
   * @param _tenantId - The tenant identifier (for future tenant-specific limits)
   * @param _entityId - The entity identifier (for future entity-specific limits)
   */
  private getEntityLimitConfig(_tenantId: ID, _entityId: ID): EntityRateLimitConfig {
    // Return cached config if available
    if (this.entityRateLimitConfig) {
      return this.entityRateLimitConfig;
    }

    // Check if entity rate limiting is configured in the config
    // This allows operators to configure entity limits via environment
    const intentConfig = this.config.intent;

    // Look for entityRateLimit config (may be added to config schema)
    const entityRateLimit = (intentConfig as Record<string, unknown>)['entityRateLimit'] as {
      enabled?: boolean;
      limit?: number;
      windowSeconds?: number;
    } | undefined;

    if (entityRateLimit) {
      this.entityRateLimitConfig = {
        enabled: entityRateLimit.enabled ?? DEFAULT_ENTITY_RATE_LIMIT.enabled,
        limit: entityRateLimit.limit ?? DEFAULT_ENTITY_RATE_LIMIT.limit,
        windowSeconds: entityRateLimit.windowSeconds ?? DEFAULT_ENTITY_RATE_LIMIT.windowSeconds,
      };
    } else {
      // Use defaults
      this.entityRateLimitConfig = { ...DEFAULT_ENTITY_RATE_LIMIT };
    }

    return this.entityRateLimitConfig;
  }

  /**
   * Configure entity rate limit settings programmatically.
   * Useful for testing or dynamic configuration.
   */
  setEntityRateLimitConfig(config: Partial<EntityRateLimitConfig>): void {
    this.entityRateLimitConfig = {
      ...DEFAULT_ENTITY_RATE_LIMIT,
      ...config,
    };
    logger.info({ config: this.entityRateLimitConfig }, 'Entity rate limit config updated');
  }

  /**
   * Convert combined rate limit result to HTTP headers
   */
  toCombinedHeaders(result: CombinedRateLimitResult): RateLimitHeaders & {
    'X-RateLimit-Entity-Limit'?: string;
    'X-RateLimit-Entity-Remaining'?: string;
    'X-RateLimit-Entity-Reset'?: string;
  } {
    const headers = this.toHeaders(result.tenant);

    if (result.entity) {
      return {
        ...headers,
        'X-RateLimit-Entity-Limit': result.entity.limit.toString(),
        'X-RateLimit-Entity-Remaining': result.entity.remaining.toString(),
        'X-RateLimit-Entity-Reset': result.entity.resetIn.toString(),
      };
    }

    return headers;
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
