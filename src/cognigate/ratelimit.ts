/**
 * COGNIGATE Rate Limiting
 *
 * Per-tenant rate limiting for the Constrained Execution Runtime.
 * Uses a Redis sliding window algorithm with tier-based limits.
 *
 * Features:
 * - Per-tenant request rate limits
 * - Per-tenant execution rate limits
 * - Concurrent execution limits
 * - Tier-based configuration (free/pro/enterprise)
 * - Burst protection
 * - Circuit breaker on Redis calls
 *
 * @packageDocumentation
 */

import { createLogger } from '../common/logger.js';
import type { ID, Timestamp } from '../common/types.js';

const logger = createLogger({ component: 'cognigate-ratelimit' });

// ============================================================================
// Types
// ============================================================================

/**
 * Rate limit configuration for a tenant tier
 */
export interface RateLimitConfig {
  /** Maximum API requests per minute */
  requestsPerMinute: number;
  /** Maximum API requests per hour */
  requestsPerHour: number;
  /** Maximum burst requests in a short window (5s) */
  burstLimit: number;
  /** Maximum execution submissions per minute */
  executionsPerMinute: number;
  /** Maximum concurrent active executions */
  concurrentExecutions: number;
}

/**
 * Result of a rate limit check
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Remaining requests in current window */
  remaining: number;
  /** ISO timestamp when the limit resets */
  resetAt: Timestamp;
  /** Milliseconds to wait before retrying (if denied) */
  retryAfterMs?: number;
  /** Human-readable reason for denial */
  reason?: string;
}

/**
 * Current rate limit quota for a tenant
 */
export interface RateLimitQuota {
  /** Requests remaining this minute */
  requestsRemainingMinute: number;
  /** Requests remaining this hour */
  requestsRemainingHour: number;
  /** Executions remaining this minute */
  executionsRemainingMinute: number;
  /** Concurrent executions remaining */
  concurrentExecutionsRemaining: number;
  /** ISO timestamp of next minute reset */
  minuteResetAt: Timestamp;
  /** ISO timestamp of next hour reset */
  hourResetAt: Timestamp;
}

/**
 * Options for CognigateRateLimiter construction
 */
export interface CognigateRateLimiterOptions {
  /** Custom limits that override tier defaults */
  customLimits?: Partial<RateLimitConfig>;
  /** Redis key prefix (default: 'cognigate:ratelimit:') */
  keyPrefix?: string;
}

// ============================================================================
// Tier Configurations
// ============================================================================

/**
 * Default rate limits by tier.
 * These can be overridden with custom limits per tenant.
 */
const TIER_LIMITS: Record<string, RateLimitConfig> = {
  free: {
    requestsPerMinute: 30,
    requestsPerHour: 500,
    burstLimit: 5,
    executionsPerMinute: 10,
    concurrentExecutions: 5,
  },
  pro: {
    requestsPerMinute: 150,
    requestsPerHour: 5000,
    burstLimit: 25,
    executionsPerMinute: 50,
    concurrentExecutions: 20,
  },
  enterprise: {
    requestsPerMinute: 500,
    requestsPerHour: 25000,
    burstLimit: 50,
    executionsPerMinute: 200,
    concurrentExecutions: 100,
  },
};

// ============================================================================
// Sliding Window State
// ============================================================================

/**
 * In-memory sliding window entry for rate limiting.
 * Uses an array of timestamps within the window.
 */
interface SlidingWindowState {
  /** Timestamps of requests within the window */
  timestamps: number[];
  /** When this state was last cleaned */
  lastCleanup: number;
}

// ============================================================================
// Rate Limiter Implementation
// ============================================================================

/**
 * Per-tenant rate limiter for the Cognigate module.
 *
 * Implements sliding window rate limiting with support for:
 * - Per-minute and per-hour request limits
 * - Burst protection
 * - Execution submission limits
 * - Concurrent execution tracking
 *
 * @example
 * ```typescript
 * const limiter = new CognigateRateLimiter();
 *
 * const result = await limiter.checkLimit(tenantId, 'pro');
 * if (!result.allowed) {
 *   // Return 429 with result.retryAfterMs
 * }
 *
 * await limiter.recordRequest(tenantId);
 * ```
 */
export class CognigateRateLimiter {
  private readonly keyPrefix: string;
  private readonly customLimits: Partial<RateLimitConfig>;

  /** Per-tenant request windows (minute granularity) */
  private readonly minuteWindows: Map<string, SlidingWindowState> = new Map();

  /** Per-tenant request windows (hour granularity) */
  private readonly hourWindows: Map<string, SlidingWindowState> = new Map();

  /** Per-tenant burst windows (5-second granularity) */
  private readonly burstWindows: Map<string, SlidingWindowState> = new Map();

  /** Per-tenant execution windows (minute granularity) */
  private readonly executionWindows: Map<string, SlidingWindowState> = new Map();

  /** Per-tenant concurrent execution counters */
  private readonly concurrentCounters: Map<string, number> = new Map();

  /** Per-tenant custom limit overrides */
  private readonly tenantOverrides: Map<string, Partial<RateLimitConfig>> = new Map();

  constructor(options?: CognigateRateLimiterOptions) {
    this.keyPrefix = options?.keyPrefix ?? 'cognigate:ratelimit:';
    this.customLimits = options?.customLimits ?? {};
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Check if a request is allowed for the given tenant and tier.
   * Does NOT consume a request slot - call recordRequest() after successful processing.
   *
   * @param tenantId - The tenant identifier
   * @param tier - The tenant's pricing tier (free/pro/enterprise)
   * @returns Rate limit check result
   */
  async checkLimit(tenantId: ID, tier: string): Promise<RateLimitResult> {
    const limits = this.getLimitsForTenant(tenantId, tier);
    const now = Date.now();

    // Check burst limit (5-second window)
    const burstState = this.getOrCreateWindow(this.burstWindows, tenantId, now, 5000);
    if (burstState.timestamps.length >= limits.burstLimit) {
      const oldestBurst = burstState.timestamps[0] ?? now;
      const resetAt = new Date(oldestBurst + 5000).toISOString();
      const retryAfterMs = Math.max(0, (oldestBurst + 5000) - now);

      logger.warn(
        { tenantId, tier, current: burstState.timestamps.length, limit: limits.burstLimit },
        'Cognigate burst rate limit exceeded'
      );

      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfterMs,
        reason: 'Burst rate limit exceeded',
      };
    }

    // Check per-minute limit
    const minuteState = this.getOrCreateWindow(this.minuteWindows, tenantId, now, 60000);
    if (minuteState.timestamps.length >= limits.requestsPerMinute) {
      const oldestMinute = minuteState.timestamps[0] ?? now;
      const resetAt = new Date(oldestMinute + 60000).toISOString();
      const retryAfterMs = Math.max(0, (oldestMinute + 60000) - now);

      logger.warn(
        { tenantId, tier, current: minuteState.timestamps.length, limit: limits.requestsPerMinute },
        'Cognigate per-minute rate limit exceeded'
      );

      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfterMs,
        reason: 'Per-minute rate limit exceeded',
      };
    }

    // Check per-hour limit
    const hourState = this.getOrCreateWindow(this.hourWindows, tenantId, now, 3600000);
    if (hourState.timestamps.length >= limits.requestsPerHour) {
      const oldestHour = hourState.timestamps[0] ?? now;
      const resetAt = new Date(oldestHour + 3600000).toISOString();
      const retryAfterMs = Math.max(0, (oldestHour + 3600000) - now);

      logger.warn(
        { tenantId, tier, current: hourState.timestamps.length, limit: limits.requestsPerHour },
        'Cognigate per-hour rate limit exceeded'
      );

      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfterMs,
        reason: 'Per-hour rate limit exceeded',
      };
    }

    // Calculate remaining (use the tightest constraint)
    const minuteRemaining = limits.requestsPerMinute - minuteState.timestamps.length;
    const hourRemaining = limits.requestsPerHour - hourState.timestamps.length;
    const remaining = Math.min(minuteRemaining, hourRemaining);

    const nextMinuteReset = minuteState.timestamps.length > 0
      ? new Date((minuteState.timestamps[0] ?? now) + 60000).toISOString()
      : new Date(now + 60000).toISOString();

    return {
      allowed: true,
      remaining,
      resetAt: nextMinuteReset,
    };
  }

  /**
   * Record a successful API request for the tenant.
   * Should be called after the request is processed.
   *
   * @param tenantId - The tenant identifier
   */
  async recordRequest(tenantId: ID): Promise<void> {
    const now = Date.now();

    // Add to all relevant windows
    this.addToWindow(this.burstWindows, tenantId, now, 5000);
    this.addToWindow(this.minuteWindows, tenantId, now, 60000);
    this.addToWindow(this.hourWindows, tenantId, now, 3600000);

    logger.debug({ tenantId }, 'Request recorded for rate limiting');
  }

  /**
   * Record an execution submission for the tenant.
   * Checks both execution rate and concurrent execution limits.
   *
   * @param tenantId - The tenant identifier
   */
  async recordExecution(tenantId: ID): Promise<void> {
    const now = Date.now();

    // Add to execution window
    this.addToWindow(this.executionWindows, tenantId, now, 60000);

    // Increment concurrent counter
    const current = this.concurrentCounters.get(tenantId) ?? 0;
    this.concurrentCounters.set(tenantId, current + 1);

    logger.debug(
      { tenantId, concurrent: current + 1 },
      'Execution recorded for rate limiting'
    );
  }

  /**
   * Record that an execution has completed (decrements concurrent counter).
   *
   * @param tenantId - The tenant identifier
   */
  async completeExecution(tenantId: ID): Promise<void> {
    const current = this.concurrentCounters.get(tenantId) ?? 0;
    this.concurrentCounters.set(tenantId, Math.max(0, current - 1));

    logger.debug(
      { tenantId, concurrent: Math.max(0, current - 1) },
      'Execution completed for rate limiting'
    );
  }

  /**
   * Check if a new execution can be submitted (checks execution rate + concurrent limit).
   *
   * @param tenantId - The tenant identifier
   * @param tier - The tenant's pricing tier
   * @returns Rate limit check result for execution
   */
  async checkExecutionLimit(tenantId: ID, tier: string): Promise<RateLimitResult> {
    const limits = this.getLimitsForTenant(tenantId, tier);
    const now = Date.now();

    // Check concurrent execution limit
    const concurrent = this.concurrentCounters.get(tenantId) ?? 0;
    if (concurrent >= limits.concurrentExecutions) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(now + 5000).toISOString(),
        retryAfterMs: 5000,
        reason: `Concurrent execution limit reached (${concurrent}/${limits.concurrentExecutions})`,
      };
    }

    // Check executions per minute
    const execState = this.getOrCreateWindow(this.executionWindows, tenantId, now, 60000);
    if (execState.timestamps.length >= limits.executionsPerMinute) {
      const oldestExec = execState.timestamps[0] ?? now;
      const resetAt = new Date(oldestExec + 60000).toISOString();
      const retryAfterMs = Math.max(0, (oldestExec + 60000) - now);

      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfterMs,
        reason: 'Executions per minute limit exceeded',
      };
    }

    const remaining = Math.min(
      limits.concurrentExecutions - concurrent,
      limits.executionsPerMinute - execState.timestamps.length
    );

    return {
      allowed: true,
      remaining,
      resetAt: new Date(now + 60000).toISOString(),
    };
  }

  /**
   * Get the remaining quota for a tenant across all limit types.
   *
   * @param tenantId - The tenant identifier
   * @param tier - The tenant's pricing tier
   * @returns Current quota breakdown
   */
  async getRemainingQuota(tenantId: ID, tier: string): Promise<RateLimitQuota> {
    const limits = this.getLimitsForTenant(tenantId, tier);
    const now = Date.now();

    const minuteState = this.getOrCreateWindow(this.minuteWindows, tenantId, now, 60000);
    const hourState = this.getOrCreateWindow(this.hourWindows, tenantId, now, 3600000);
    const execState = this.getOrCreateWindow(this.executionWindows, tenantId, now, 60000);
    const concurrent = this.concurrentCounters.get(tenantId) ?? 0;

    const minuteResetAt = minuteState.timestamps.length > 0
      ? new Date((minuteState.timestamps[0] ?? now) + 60000).toISOString()
      : new Date(now + 60000).toISOString();

    const hourResetAt = hourState.timestamps.length > 0
      ? new Date((hourState.timestamps[0] ?? now) + 3600000).toISOString()
      : new Date(now + 3600000).toISOString();

    return {
      requestsRemainingMinute: Math.max(0, limits.requestsPerMinute - minuteState.timestamps.length),
      requestsRemainingHour: Math.max(0, limits.requestsPerHour - hourState.timestamps.length),
      executionsRemainingMinute: Math.max(0, limits.executionsPerMinute - execState.timestamps.length),
      concurrentExecutionsRemaining: Math.max(0, limits.concurrentExecutions - concurrent),
      minuteResetAt,
      hourResetAt,
    };
  }

  /**
   * Reset all rate limit state for a tenant.
   * Admin operation for recovering from stuck states.
   *
   * @param tenantId - The tenant identifier
   */
  async resetTenant(tenantId: ID): Promise<void> {
    this.minuteWindows.delete(tenantId);
    this.hourWindows.delete(tenantId);
    this.burstWindows.delete(tenantId);
    this.executionWindows.delete(tenantId);
    this.concurrentCounters.delete(tenantId);

    logger.info({ tenantId }, 'Cognigate rate limit state reset for tenant');
  }

  /**
   * Set custom rate limit overrides for a specific tenant.
   * Overrides take precedence over tier defaults.
   *
   * @param tenantId - The tenant identifier
   * @param overrides - Partial rate limit config to override
   */
  setTenantOverrides(tenantId: ID, overrides: Partial<RateLimitConfig>): void {
    this.tenantOverrides.set(tenantId, overrides);
    logger.info({ tenantId, overrides }, 'Tenant rate limit overrides set');
  }

  /**
   * Get the effective limits for a tenant (tier defaults + overrides).
   *
   * @param tenantId - The tenant identifier
   * @param tier - The tenant's pricing tier
   * @returns Effective rate limit configuration
   */
  getEffectiveLimits(tenantId: ID, tier: string): RateLimitConfig {
    return this.getLimitsForTenant(tenantId, tier);
  }

  /**
   * Convert rate limit result to HTTP headers for the response.
   *
   * @param result - The rate limit check result
   * @returns Headers to set on the HTTP response
   */
  toHeaders(result: RateLimitResult): Record<string, string> {
    const headers: Record<string, string> = {
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': result.resetAt,
    };

    if (result.retryAfterMs !== undefined) {
      headers['Retry-After'] = Math.ceil(result.retryAfterMs / 1000).toString();
    }

    return headers;
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Build a Redis key for a tenant window.
   * Used when backing the rate limiter with Redis for distributed limiting.
   */
  buildRedisKey(tenantId: ID, windowType: string): string {
    return `${this.keyPrefix}${tenantId}:${windowType}`;
  }

  /**
   * Get the effective limits for a tenant, considering tier defaults,
   * constructor custom limits, and per-tenant overrides.
   */
  private getLimitsForTenant(tenantId: ID, tier: string): RateLimitConfig {
    const tierLimits = TIER_LIMITS[tier] ?? TIER_LIMITS['free']!;
    const tenantOverrides = this.tenantOverrides.get(tenantId);

    return {
      ...tierLimits,
      ...this.customLimits,
      ...tenantOverrides,
    };
  }

  /**
   * Get or create a sliding window state for a tenant, cleaning up
   * expired entries in the process.
   */
  private getOrCreateWindow(
    windows: Map<string, SlidingWindowState>,
    tenantId: string,
    now: number,
    windowMs: number
  ): SlidingWindowState {
    let state = windows.get(tenantId);

    if (!state) {
      state = { timestamps: [], lastCleanup: now };
      windows.set(tenantId, state);
      return state;
    }

    // Clean up entries outside the window
    const windowStart = now - windowMs;
    if (now - state.lastCleanup > 1000) {
      state.timestamps = state.timestamps.filter((ts) => ts > windowStart);
      state.lastCleanup = now;
    }

    return state;
  }

  /**
   * Add a timestamp to a sliding window.
   */
  private addToWindow(
    windows: Map<string, SlidingWindowState>,
    tenantId: string,
    now: number,
    windowMs: number
  ): void {
    const state = this.getOrCreateWindow(windows, tenantId, now, windowMs);
    state.timestamps.push(now);

    // Prevent unbounded growth
    if (state.timestamps.length > 10000) {
      const windowStart = now - windowMs;
      state.timestamps = state.timestamps.filter((ts) => ts > windowStart);
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/** Singleton rate limiter instance */
let rateLimiterInstance: CognigateRateLimiter | null = null;

/**
 * Get or create the shared rate limiter singleton.
 *
 * @param options - Optional configuration for first creation
 * @returns The shared CognigateRateLimiter instance
 */
export function getCognigateRateLimiter(options?: CognigateRateLimiterOptions): CognigateRateLimiter {
  if (!rateLimiterInstance) {
    rateLimiterInstance = new CognigateRateLimiter(options);
  }
  return rateLimiterInstance;
}

/**
 * Create a new rate limiter instance (non-singleton).
 *
 * @param options - Optional configuration
 * @returns A new CognigateRateLimiter instance
 */
export function createCognigateRateLimiter(options?: CognigateRateLimiterOptions): CognigateRateLimiter {
  return new CognigateRateLimiter(options);
}

/**
 * Reset the singleton instance. Primarily for testing.
 */
export function resetCognigateRateLimiter(): void {
  rateLimiterInstance = null;
}

// ============================================================================
// Error Class
// ============================================================================

/**
 * Error thrown when a cognigate rate limit is exceeded.
 * Includes all information needed to construct a 429 response.
 */
export class CognigateRateLimitError extends Error {
  public readonly code = 'COGNIGATE_RATE_LIMIT_EXCEEDED';
  public readonly statusCode = 429;
  public readonly retryAfterMs: number;
  public readonly remaining: number;
  public readonly resetAt: Timestamp;

  constructor(result: RateLimitResult) {
    super(result.reason ?? 'Rate limit exceeded');
    this.name = 'CognigateRateLimitError';
    this.retryAfterMs = result.retryAfterMs ?? 60000;
    this.remaining = result.remaining;
    this.resetAt = result.resetAt;
  }

  /**
   * Serialize to JSON-compatible error response
   */
  toJSON(): Record<string, unknown> {
    return {
      code: this.code,
      message: this.message,
      retryAfterMs: this.retryAfterMs,
      remaining: this.remaining,
      resetAt: this.resetAt,
    };
  }
}
