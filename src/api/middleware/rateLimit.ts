/**
 * Rate Limiting Middleware
 *
 * Provides configurable per-tenant and per-endpoint rate limiting with
 * graceful degradation, rate limit headers, and OpenTelemetry tracing.
 *
 * @packageDocumentation
 */

import type { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';

/** Type for preHandler hook function */
type PreHandlerFn = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
import { trace, SpanStatusCode, SpanKind, type Span } from '@opentelemetry/api';
import { createLogger } from '../../common/logger.js';
import { getTraceContext } from '../../common/trace.js';
import type { VorionErrorResponse } from '../../common/contracts/output.js';

const logger = createLogger({ component: 'api-rate-limit' });
const tracer = trace.getTracer('vorion-api-rate-limit');

/**
 * Rate limit configuration for an endpoint
 */
export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  limit: number;
  /** Time window in seconds */
  windowSeconds: number;
  /** Optional burst limit (max requests per second) */
  burstLimit?: number;
  /** Skip rate limiting for certain conditions */
  skip?: (request: FastifyRequest) => boolean;
  /** Custom key generator for rate limiting (default: tenantId) */
  keyGenerator?: (request: FastifyRequest) => string | null;
  /** Custom error message */
  errorMessage?: string;
  /** Enable graceful degradation (allow requests when rate limiter fails) */
  gracefulDegradation?: boolean;
}

/**
 * Per-tenant rate limit configuration
 */
export interface TenantRateLimitConfig extends RateLimitConfig {
  /** Per-tenant limit overrides */
  tenantOverrides?: Record<string, Partial<RateLimitConfig>>;
}

/**
 * Rate limit result
 */
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
  resetInSeconds: number;
  /** Unix timestamp when window resets */
  resetAt: number;
  /** Retry-After value in seconds (only if not allowed) */
  retryAfter?: number;
}

/**
 * Window entry for in-memory rate limiting
 */
interface WindowEntry {
  count: number;
  resetAt: number;
}

/**
 * In-memory rate limit store
 *
 * For production use with multiple instances, use Redis-backed store.
 */
class InMemoryRateLimitStore {
  private windows: Map<string, WindowEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Cleanup stale entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
    this.cleanupInterval.unref();
  }

  /**
   * Check and increment rate limit counter
   */
  check(key: string, limit: number, windowSeconds: number): RateLimitResult {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const resetAt = now + windowMs;

    let entry = this.windows.get(key);

    // Reset if window expired
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt };
      this.windows.set(key, entry);
    }

    const current = entry.count;
    const remaining = Math.max(0, limit - current - 1);
    const allowed = current < limit;

    if (allowed) {
      entry.count++;
    }

    const resetInSeconds = Math.ceil((entry.resetAt - now) / 1000);

    return {
      allowed,
      current: entry.count,
      limit,
      remaining: allowed ? remaining : 0,
      resetInSeconds,
      resetAt: Math.ceil(entry.resetAt / 1000),
      retryAfter: allowed ? undefined : resetInSeconds,
    };
  }

  /**
   * Get current state without incrementing
   */
  peek(key: string, limit: number): RateLimitResult | null {
    const entry = this.windows.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now >= entry.resetAt) return null;

    const remaining = Math.max(0, limit - entry.count);
    const resetInSeconds = Math.ceil((entry.resetAt - now) / 1000);

    return {
      allowed: entry.count < limit,
      current: entry.count,
      limit,
      remaining,
      resetInSeconds,
      resetAt: Math.ceil(entry.resetAt / 1000),
    };
  }

  /**
   * Reset rate limit for a key
   */
  reset(key: string): void {
    this.windows.delete(key);
  }

  /**
   * Reset all rate limits for a tenant (matches keys starting with tenantId)
   */
  resetTenant(tenantId: string): void {
    for (const key of this.windows.keys()) {
      if (key.startsWith(`${tenantId}:`)) {
        this.windows.delete(key);
      }
    }
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.windows.entries()) {
      if (now >= entry.resetAt) {
        this.windows.delete(key);
      }
    }
  }

  /**
   * Get store statistics
   */
  getStats(): { activeKeys: number; totalRequests: number } {
    let totalRequests = 0;
    for (const entry of this.windows.values()) {
      totalRequests += entry.count;
    }
    return {
      activeKeys: this.windows.size,
      totalRequests,
    };
  }

  /**
   * Stop the cleanup timer
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Global rate limit store instance
let globalStore: InMemoryRateLimitStore | null = null;

/**
 * Get or create the global rate limit store
 */
export function getRateLimitStore(): InMemoryRateLimitStore {
  if (!globalStore) {
    globalStore = new InMemoryRateLimitStore();
  }
  return globalStore;
}

/**
 * Reset the global rate limit store (for testing)
 */
export function resetRateLimitStore(): void {
  if (globalStore) {
    globalStore.stop();
    globalStore = null;
  }
}

/**
 * Set rate limit response headers
 */
function setRateLimitHeaders(reply: FastifyReply, result: RateLimitResult): void {
  reply.header('X-RateLimit-Limit', result.limit);
  reply.header('X-RateLimit-Remaining', result.remaining);
  reply.header('X-RateLimit-Reset', result.resetAt);

  if (result.retryAfter !== undefined) {
    reply.header('Retry-After', result.retryAfter);
  }
}

/**
 * Create rate limit error response
 */
function createRateLimitErrorResponse(
  result: RateLimitResult,
  requestId: string,
  customMessage?: string
): VorionErrorResponse {
  return {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: customMessage ?? 'Too many requests. Please retry later.',
      details: {
        limit: result.limit,
        remaining: result.remaining,
        resetAt: new Date(result.resetAt * 1000).toISOString(),
        retryAfter: result.retryAfter,
      },
      retryAfter: result.retryAfter,
    },
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Extract tenant ID from request
 */
function extractTenantId(request: FastifyRequest): string | null {
  // Try to get from JWT payload
  const user = (request as FastifyRequest & { user?: { tenantId?: string } }).user;
  if (user?.tenantId) {
    return user.tenantId;
  }

  // Try to get from auth decorator
  const auth = (request as FastifyRequest & { auth?: { tenantId?: string } }).auth;
  if (auth?.tenantId) {
    return auth.tenantId;
  }

  // Try to get from header
  const headerTenantId = request.headers['x-tenant-id'];
  if (typeof headerTenantId === 'string') {
    return headerTenantId;
  }

  return null;
}

/**
 * Create rate limiting middleware for an endpoint
 *
 * @param config - Rate limit configuration
 * @returns Fastify preHandler hook
 *
 * @example
 * ```typescript
 * // Basic rate limiting
 * server.post('/api/data', {
 *   preHandler: rateLimit({ limit: 100, windowSeconds: 60 }),
 * }, handler);
 *
 * // With per-tenant limits
 * server.post('/api/data', {
 *   preHandler: rateLimitPerTenant({
 *     limit: 100,
 *     windowSeconds: 60,
 *     tenantOverrides: {
 *       'enterprise-tenant': { limit: 1000 },
 *     },
 *   }),
 * }, handler);
 * ```
 */
export function rateLimit(config: RateLimitConfig): PreHandlerFn {
  const store = getRateLimitStore();

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const requestId = request.id || 'unknown';
    const traceContext = getTraceContext();

    // Check skip condition
    if (config.skip?.(request)) {
      return;
    }

    // Generate rate limit key
    const customKey = config.keyGenerator?.(request);
    const key = customKey ?? `global:${request.routeOptions?.url ?? request.url}`;

    return tracer.startActiveSpan(
      'rateLimit.check',
      {
        kind: SpanKind.INTERNAL,
        attributes: {
          'rateLimit.key': key,
          'rateLimit.limit': config.limit,
          'rateLimit.windowSeconds': config.windowSeconds,
          'request.id': requestId,
          ...(traceContext && { 'trace.id': traceContext.traceId }),
        },
      },
      async (span: Span) => {
        try {
          const result = store.check(key, config.limit, config.windowSeconds);

          span.setAttribute('rateLimit.current', result.current);
          span.setAttribute('rateLimit.remaining', result.remaining);
          span.setAttribute('rateLimit.allowed', result.allowed);

          // Always set rate limit headers
          setRateLimitHeaders(reply, result);

          if (!result.allowed) {
            span.setStatus({ code: SpanStatusCode.ERROR, message: 'Rate limit exceeded' });
            span.end();

            logger.warn(
              {
                requestId,
                key,
                limit: config.limit,
                current: result.current,
                retryAfter: result.retryAfter,
              },
              'Rate limit exceeded'
            );

            const response = createRateLimitErrorResponse(result, requestId, config.errorMessage);
            reply.status(429).send(response);
            return;
          }

          span.setStatus({ code: SpanStatusCode.OK });
          span.end();
        } catch (error) {
          span.setStatus({ code: SpanStatusCode.ERROR, message: 'Rate limit check failed' });
          span.recordException(error as Error);
          span.end();

          logger.error({ error, requestId, key }, 'Rate limit check failed');

          // Graceful degradation: allow request if rate limiter fails
          if (config.gracefulDegradation !== false) {
            logger.warn({ requestId, key }, 'Rate limiter failed, allowing request (graceful degradation)');
            return;
          }

          throw error;
        }
      }
    );
  };
}

/**
 * Create per-tenant rate limiting middleware
 *
 * @param config - Per-tenant rate limit configuration
 * @returns Fastify preHandler hook
 */
export function rateLimitPerTenant(config: TenantRateLimitConfig): PreHandlerFn {
  const store = getRateLimitStore();

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const requestId = request.id || 'unknown';
    const traceContext = getTraceContext();

    // Check skip condition
    if (config.skip?.(request)) {
      return;
    }

    // Extract tenant ID
    const tenantId = extractTenantId(request);

    // If no tenant ID, use global limit or skip
    if (!tenantId) {
      // For unauthenticated requests, apply a stricter limit
      const key = `anonymous:${request.ip}:${request.routeOptions?.url ?? request.url}`;

      return tracer.startActiveSpan(
        'rateLimit.checkAnonymous',
        {
          kind: SpanKind.INTERNAL,
          attributes: {
            'rateLimit.key': key,
            'rateLimit.type': 'anonymous',
            'request.id': requestId,
          },
        },
        async (span: Span) => {
          try {
            // Use half the normal limit for anonymous requests
            const anonymousLimit = Math.ceil(config.limit / 2);
            const result = store.check(key, anonymousLimit, config.windowSeconds);

            span.setAttribute('rateLimit.current', result.current);
            span.setAttribute('rateLimit.remaining', result.remaining);
            span.setAttribute('rateLimit.allowed', result.allowed);

            setRateLimitHeaders(reply, result);

            if (!result.allowed) {
              span.setStatus({ code: SpanStatusCode.ERROR, message: 'Rate limit exceeded' });
              span.end();

              const response = createRateLimitErrorResponse(result, requestId, config.errorMessage);
              reply.status(429).send(response);
              return;
            }

            span.setStatus({ code: SpanStatusCode.OK });
            span.end();
          } catch (error) {
            span.setStatus({ code: SpanStatusCode.ERROR, message: 'Rate limit check failed' });
            span.recordException(error as Error);
            span.end();

            if (config.gracefulDegradation !== false) {
              return;
            }
            throw error;
          }
        }
      );
    }

    // Get tenant-specific limits
    const tenantOverride = config.tenantOverrides?.[tenantId];
    const effectiveLimit = tenantOverride?.limit ?? config.limit;
    const effectiveWindow = tenantOverride?.windowSeconds ?? config.windowSeconds;

    // Generate tenant-scoped key
    const customKey = config.keyGenerator?.(request);
    const endpoint = request.routeOptions?.url ?? request.url;
    const key = customKey ?? `tenant:${tenantId}:${endpoint}`;

    return tracer.startActiveSpan(
      'rateLimit.checkTenant',
      {
        kind: SpanKind.INTERNAL,
        attributes: {
          'rateLimit.key': key,
          'rateLimit.type': 'tenant',
          'rateLimit.tenantId': tenantId,
          'rateLimit.limit': effectiveLimit,
          'rateLimit.windowSeconds': effectiveWindow,
          'request.id': requestId,
          ...(traceContext && { 'trace.id': traceContext.traceId }),
        },
      },
      async (span: Span) => {
        try {
          const result = store.check(key, effectiveLimit, effectiveWindow);

          span.setAttribute('rateLimit.current', result.current);
          span.setAttribute('rateLimit.remaining', result.remaining);
          span.setAttribute('rateLimit.allowed', result.allowed);

          // Add tenant-specific headers
          reply.header('X-RateLimit-Limit', result.limit);
          reply.header('X-RateLimit-Remaining', result.remaining);
          reply.header('X-RateLimit-Reset', result.resetAt);
          reply.header('X-RateLimit-Tenant', tenantId);

          if (result.retryAfter !== undefined) {
            reply.header('Retry-After', result.retryAfter);
          }

          if (!result.allowed) {
            span.setStatus({ code: SpanStatusCode.ERROR, message: 'Tenant rate limit exceeded' });
            span.end();

            logger.warn(
              {
                requestId,
                tenantId,
                key,
                limit: effectiveLimit,
                current: result.current,
                retryAfter: result.retryAfter,
              },
              'Tenant rate limit exceeded'
            );

            const response = createRateLimitErrorResponse(result, requestId, config.errorMessage);
            reply.status(429).send(response);
            return;
          }

          span.setStatus({ code: SpanStatusCode.OK });
          span.end();
        } catch (error) {
          span.setStatus({ code: SpanStatusCode.ERROR, message: 'Rate limit check failed' });
          span.recordException(error as Error);
          span.end();

          logger.error({ error, requestId, tenantId, key }, 'Tenant rate limit check failed');

          if (config.gracefulDegradation !== false) {
            logger.warn({ requestId, tenantId }, 'Rate limiter failed, allowing request (graceful degradation)');
            return;
          }

          throw error;
        }
      }
    );
  };
}

/**
 * Create endpoint-specific rate limiter with different limits per method
 *
 * @param configs - Configuration per HTTP method
 * @returns Fastify preHandler hook
 */
export function rateLimitByMethod(
  configs: Partial<Record<'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', RateLimitConfig>>
): PreHandlerFn {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const method = request.method as keyof typeof configs;
    const config = configs[method];

    if (!config) {
      // No rate limit configured for this method
      return;
    }

    const middleware = rateLimit(config);
    return middleware(request, reply);
  };
}

/**
 * Register rate limiting plugin for Fastify
 *
 * @param server - Fastify instance
 * @param defaultConfig - Default rate limit configuration
 */
export async function registerRateLimitPlugin(
  server: FastifyInstance,
  defaultConfig: RateLimitConfig = { limit: 100, windowSeconds: 60 }
): Promise<void> {
  // Create factory functions for rate limiting
  const createRateLimiter = (config?: Partial<RateLimitConfig>) =>
    rateLimit({ ...defaultConfig, ...config });

  const createTenantRateLimiter = (config?: Partial<TenantRateLimitConfig>) =>
    rateLimitPerTenant({ ...defaultConfig, ...config });

  // Decorate server with rate limit helpers
  server.decorate('vorionRateLimit', createRateLimiter);
  server.decorate('vorionRateLimitPerTenant', createTenantRateLimiter);

  // Add global hook for overall API rate limiting
  server.addHook('onRequest', async (request, reply) => {
    // Skip health check endpoints
    if (request.url === '/health' || request.url === '/ready' || request.url === '/metrics') {
      return;
    }

    const tenantId = extractTenantId(request);
    if (!tenantId) return;

    const store = getRateLimitStore();
    const globalKey = `global:${tenantId}`;

    // Check global tenant limit (e.g., 10000 requests per hour)
    const result = store.check(globalKey, 10000, 3600);

    if (!result.allowed) {
      logger.warn({ tenantId, current: result.current }, 'Global tenant rate limit exceeded');

      setRateLimitHeaders(reply, result);
      reply.status(429).send(
        createRateLimitErrorResponse(result, request.id, 'Global rate limit exceeded for tenant')
      );
    }
  });

  logger.info({ defaultLimit: defaultConfig.limit, defaultWindow: defaultConfig.windowSeconds }, 'Rate limit plugin registered');
}

/**
 * Get rate limit statistics
 */
export function getRateLimitStats(): { activeKeys: number; totalRequests: number } {
  return getRateLimitStore().getStats();
}

/**
 * Reset rate limit for a specific tenant
 */
export function resetTenantRateLimit(tenantId: string): void {
  getRateLimitStore().resetTenant(tenantId);
  logger.info({ tenantId }, 'Tenant rate limits reset');
}
