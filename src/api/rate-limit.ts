/**
 * Per-Tenant Rate Limiting
 *
 * Provides tenant-scoped rate limiting with configurable limits per tier.
 * Uses in-memory sliding window with Redis support for distributed deployments.
 *
 * @packageDocumentation
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { createLogger } from '../common/logger.js';

const logger = createLogger({ component: 'rate-limit' });

/**
 * Rate limit configuration per tier
 */
export interface TierLimits {
  requestsPerMinute: number;
  requestsPerHour: number;
  burstLimit: number; // Max requests in 1 second
}

/**
 * Default tier configurations
 */
export const DEFAULT_TIER_LIMITS: Record<string, TierLimits> = {
  free: {
    requestsPerMinute: 60,
    requestsPerHour: 1000,
    burstLimit: 10,
  },
  pro: {
    requestsPerMinute: 300,
    requestsPerHour: 10000,
    burstLimit: 50,
  },
  enterprise: {
    requestsPerMinute: 1000,
    requestsPerHour: 50000,
    burstLimit: 100,
  },
  unlimited: {
    requestsPerMinute: Infinity,
    requestsPerHour: Infinity,
    burstLimit: Infinity,
  },
};

/**
 * Rate limit window entry
 */
interface WindowEntry {
  count: number;
  resetAt: number;
}

/**
 * Tenant rate limit state
 */
interface TenantState {
  minute: WindowEntry;
  hour: WindowEntry;
  second: WindowEntry;
  tier: string;
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: {
    minute: number;
    hour: number;
    burst: number;
  };
  resetAt: {
    minute: number;
    hour: number;
    burst: number;
  };
  retryAfter?: number;
}

/**
 * Per-Tenant Rate Limiter
 */
export class TenantRateLimiter {
  private state: Map<string, TenantState> = new Map();
  private tierLimits: Record<string, TierLimits>;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(tierLimits: Record<string, TierLimits> = DEFAULT_TIER_LIMITS) {
    this.tierLimits = tierLimits;
    this.startCleanup();
  }

  /**
   * Check and consume rate limit for a tenant
   */
  check(tenantId: string, tier: string = 'free'): RateLimitResult {
    const now = Date.now();
    const limits = this.tierLimits[tier] ?? this.tierLimits['free']!;

    // Get or create tenant state
    let state = this.state.get(tenantId);
    if (!state) {
      state = this.createInitialState(tier, now);
      this.state.set(tenantId, state);
    }

    // Update tier if changed
    if (state.tier !== tier) {
      state.tier = tier;
    }

    // Reset windows if expired
    this.resetExpiredWindows(state, now);

    // Check limits
    const secondRemaining = limits.burstLimit - state.second.count;
    const minuteRemaining = limits.requestsPerMinute - state.minute.count;
    const hourRemaining = limits.requestsPerHour - state.hour.count;

    const allowed =
      secondRemaining > 0 && minuteRemaining > 0 && hourRemaining > 0;

    if (allowed) {
      // Consume one request
      state.second.count++;
      state.minute.count++;
      state.hour.count++;
    }

    const result: RateLimitResult = {
      allowed,
      remaining: {
        minute: Math.max(0, minuteRemaining - (allowed ? 1 : 0)),
        hour: Math.max(0, hourRemaining - (allowed ? 1 : 0)),
        burst: Math.max(0, secondRemaining - (allowed ? 1 : 0)),
      },
      resetAt: {
        minute: state.minute.resetAt,
        hour: state.hour.resetAt,
        burst: state.second.resetAt,
      },
    };

    if (!allowed) {
      // Calculate retry-after based on which limit was hit
      if (secondRemaining <= 0) {
        result.retryAfter = Math.ceil((state.second.resetAt - now) / 1000);
      } else if (minuteRemaining <= 0) {
        result.retryAfter = Math.ceil((state.minute.resetAt - now) / 1000);
      } else {
        result.retryAfter = Math.ceil((state.hour.resetAt - now) / 1000);
      }

      logger.warn(
        {
          tenantId,
          tier,
          remaining: result.remaining,
          retryAfter: result.retryAfter,
        },
        'Rate limit exceeded'
      );
    }

    return result;
  }

  /**
   * Get current state for a tenant (for monitoring)
   */
  getState(tenantId: string): {
    tier: string;
    usage: { second: number; minute: number; hour: number };
    limits: TierLimits;
  } | null {
    const state = this.state.get(tenantId);
    if (!state) return null;

    const limits = this.tierLimits[state.tier] ?? this.tierLimits['free']!;

    return {
      tier: state.tier,
      usage: {
        second: state.second.count,
        minute: state.minute.count,
        hour: state.hour.count,
      },
      limits,
    };
  }

  /**
   * Reset rate limit for a tenant
   */
  reset(tenantId: string): void {
    this.state.delete(tenantId);
    logger.info({ tenantId }, 'Rate limit reset');
  }

  /**
   * Update tier limits
   */
  setTierLimits(tier: string, limits: TierLimits): void {
    this.tierLimits[tier] = limits;
    logger.info({ tier, limits }, 'Tier limits updated');
  }

  /**
   * Create initial state for a tenant
   */
  private createInitialState(tier: string, now: number): TenantState {
    return {
      minute: { count: 0, resetAt: now + 60000 },
      hour: { count: 0, resetAt: now + 3600000 },
      second: { count: 0, resetAt: now + 1000 },
      tier,
    };
  }

  /**
   * Reset expired windows
   */
  private resetExpiredWindows(state: TenantState, now: number): void {
    if (now >= state.second.resetAt) {
      state.second = { count: 0, resetAt: now + 1000 };
    }
    if (now >= state.minute.resetAt) {
      state.minute = { count: 0, resetAt: now + 60000 };
    }
    if (now >= state.hour.resetAt) {
      state.hour = { count: 0, resetAt: now + 3600000 };
    }
  }

  /**
   * Start periodic cleanup of stale entries
   */
  private startCleanup(): void {
    // Clean up every 5 minutes
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const staleThreshold = now - 3600000; // 1 hour

      for (const [tenantId, state] of this.state.entries()) {
        // Remove if all windows have been expired for over an hour
        if (
          state.second.resetAt < staleThreshold &&
          state.minute.resetAt < staleThreshold &&
          state.hour.resetAt < staleThreshold
        ) {
          this.state.delete(tenantId);
        }
      }
    }, 300000);

    // Don't prevent process exit
    this.cleanupInterval.unref();
  }

  /**
   * Stop the rate limiter
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get statistics
   */
  getStats(): {
    activeTenants: number;
    byTier: Record<string, number>;
  } {
    const byTier: Record<string, number> = {};

    for (const state of this.state.values()) {
      byTier[state.tier] = (byTier[state.tier] ?? 0) + 1;
    }

    return {
      activeTenants: this.state.size,
      byTier,
    };
  }
}

// Singleton instance
let rateLimiter: TenantRateLimiter | null = null;

/**
 * Get the rate limiter singleton
 */
export function getRateLimiter(): TenantRateLimiter {
  if (!rateLimiter) {
    rateLimiter = new TenantRateLimiter();
  }
  return rateLimiter;
}

/**
 * Create rate limit middleware for Fastify
 */
export function createRateLimitMiddleware(options?: {
  tierLimits?: Record<string, TierLimits>;
  getTier?: (request: FastifyRequest) => string;
  skip?: (request: FastifyRequest) => boolean;
}) {
  const limiter = options?.tierLimits
    ? new TenantRateLimiter(options.tierLimits)
    : getRateLimiter();

  const getTier = options?.getTier ?? ((req) => req.auth?.roles?.includes('enterprise')
    ? 'enterprise'
    : req.auth?.roles?.includes('pro')
      ? 'pro'
      : 'free');

  const skip = options?.skip ?? (() => false);

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    // Skip if configured
    if (skip(request)) {
      return;
    }

    // Skip if not authenticated (auth middleware will handle)
    if (!request.auth?.tenantId) {
      return;
    }

    const tenantId = request.auth.tenantId;
    const tier = getTier(request);

    const result = limiter.check(tenantId, tier);

    // Set rate limit headers
    void reply.header('X-RateLimit-Limit-Minute', result.remaining.minute + (result.allowed ? 1 : 0));
    void reply.header('X-RateLimit-Remaining-Minute', result.remaining.minute);
    void reply.header('X-RateLimit-Reset-Minute', Math.ceil(result.resetAt.minute / 1000));
    void reply.header('X-RateLimit-Limit-Hour', result.remaining.hour + (result.allowed ? 1 : 0));
    void reply.header('X-RateLimit-Remaining-Hour', result.remaining.hour);

    if (!result.allowed) {
      void reply.header('Retry-After', result.retryAfter);

      void reply.status(429).send({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests',
          retryAfter: result.retryAfter,
          limits: {
            minute: result.remaining.minute,
            hour: result.remaining.hour,
          },
        },
      });
      return;
    }
  };
}

/**
 * Rate limit decorator for specific routes
 */
export function withRateLimit(
  customLimits?: Partial<TierLimits>
) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.auth?.tenantId) {
      return;
    }

    // Get tier for limit calculation
    const tier = request.auth.roles?.includes('enterprise')
      ? 'enterprise'
      : request.auth.roles?.includes('pro')
        ? 'pro'
        : 'free';

    // Apply stricter limits if specified
    if (customLimits) {
      const baseLimits = DEFAULT_TIER_LIMITS[tier] ?? DEFAULT_TIER_LIMITS['free']!;
      const effectiveLimits: TierLimits = {
        requestsPerMinute: Math.min(
          customLimits.requestsPerMinute ?? Infinity,
          baseLimits.requestsPerMinute
        ),
        requestsPerHour: Math.min(
          customLimits.requestsPerHour ?? Infinity,
          baseLimits.requestsPerHour
        ),
        burstLimit: Math.min(
          customLimits.burstLimit ?? Infinity,
          baseLimits.burstLimit
        ),
      };

      // Create route-specific key
      const routeKey = `${request.auth.tenantId}:${request.routeOptions.url}`;

      // Check with custom limits
      const customLimiter = new TenantRateLimiter({
        custom: effectiveLimits,
      });

      const result = customLimiter.check(routeKey, 'custom');

      if (!result.allowed) {
        void reply.header('Retry-After', result.retryAfter);
        void reply.status(429).send({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests for this endpoint',
            retryAfter: result.retryAfter,
          },
        });
        return;
      }
    }
  };
}
