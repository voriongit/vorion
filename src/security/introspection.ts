/**
 * Token Introspection Service
 *
 * Implements RFC 7662 OAuth 2.0 Token Introspection for real-time token
 * validation. Provides synchronous token status checks for high-value
 * operations per ACI security hardening requirements.
 *
 * Key features:
 * - RFC 7662 compliant introspection
 * - Caching with configurable TTL
 * - DPoP-bound token validation
 * - Metrics and observability
 *
 * @packageDocumentation
 */

import { createLogger } from '../common/logger.js';
import { VorionError, ExternalServiceError } from '../common/errors.js';
import { Counter, Histogram, Gauge } from 'prom-client';
import { intentRegistry } from '../intent/metrics.js';
import {
  type IntrospectionResult,
  introspectionResultSchema,
} from './types.js';

const logger = createLogger({ component: 'security-introspection' });

// =============================================================================
// Metrics
// =============================================================================

const introspectionRequests = new Counter({
  name: 'vorion_security_introspection_requests_total',
  help: 'Total token introspection requests',
  labelNames: ['result', 'cached'] as const, // result: active/inactive/error, cached: true/false
  registers: [intentRegistry],
});

const introspectionDuration = new Histogram({
  name: 'vorion_security_introspection_duration_seconds',
  help: 'Duration of token introspection requests',
  labelNames: ['cached'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [intentRegistry],
});

const introspectionCacheSize = new Gauge({
  name: 'vorion_security_introspection_cache_size',
  help: 'Current size of introspection cache',
  registers: [intentRegistry],
});

const introspectionCacheHits = new Counter({
  name: 'vorion_security_introspection_cache_hits_total',
  help: 'Total introspection cache hits',
  registers: [intentRegistry],
});

const introspectionErrors = new Counter({
  name: 'vorion_security_introspection_errors_total',
  help: 'Total introspection errors',
  labelNames: ['error_type'] as const,
  registers: [intentRegistry],
});

// =============================================================================
// Errors
// =============================================================================

/**
 * Introspection-specific error
 */
export class IntrospectionError extends VorionError {
  override code = 'INTROSPECTION_ERROR';
  override statusCode = 500;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details);
    this.name = 'IntrospectionError';
  }
}

/**
 * Token inactive error
 */
export class TokenInactiveError extends VorionError {
  override code = 'TOKEN_INACTIVE';
  override statusCode = 401;

  constructor(reason?: string) {
    super(`Token is not active${reason ? `: ${reason}` : ''}`, { reason });
    this.name = 'TokenInactiveError';
  }
}

// =============================================================================
// Types
// =============================================================================

/**
 * Introspection endpoint response (RFC 7662)
 */
interface IntrospectionResponse {
  active: boolean;
  scope?: string;
  client_id?: string;
  username?: string;
  token_type?: string;
  exp?: number;
  iat?: number;
  nbf?: number;
  sub?: string;
  aud?: string | string[];
  iss?: string;
  jti?: string;
  cnf?: {
    jkt?: string;
  };
}

/**
 * Cache entry for introspection results
 */
interface CacheEntry {
  result: IntrospectionResult;
  cachedAt: number;
}

/**
 * Introspection service options
 */
export interface IntrospectionServiceOptions {
  /** Default cache TTL in milliseconds (default: 5000 = 5 seconds) */
  defaultCacheTTL?: number;
  /** Maximum cache TTL in milliseconds (default: 60000 = 1 minute) */
  maxCacheTTL?: number;
  /** Request timeout in milliseconds (default: 5000 = 5 seconds) */
  requestTimeout?: number;
  /** Client credentials for introspection endpoint */
  clientId?: string;
  /** Client secret for introspection endpoint */
  clientSecret?: string;
  /** Custom fetch implementation (for testing) */
  fetch?: typeof fetch;
}

// =============================================================================
// Introspection Cache
// =============================================================================

class IntrospectionCache {
  private cache = new Map<string, CacheEntry>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(private defaultTTLMs: number = 5000) {
    // Cleanup expired entries every 10 seconds
    this.cleanupInterval = setInterval(() => this.cleanup(), 10000);
  }

  /**
   * Get cached introspection result
   */
  get(token: string, maxAgeMs?: number): IntrospectionResult | null {
    // Use token hash as key to avoid storing tokens
    const key = this.hashToken(token);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    const effectiveMaxAge = maxAgeMs ?? this.defaultTTLMs;
    const age = Date.now() - entry.cachedAt;

    if (age > effectiveMaxAge) {
      this.cache.delete(key);
      return null;
    }

    introspectionCacheHits.inc();
    return {
      ...entry.result,
      fromCache: true,
    };
  }

  /**
   * Set cached introspection result
   */
  set(token: string, result: IntrospectionResult): void {
    const key = this.hashToken(token);
    this.cache.set(key, {
      result: { ...result, fromCache: false },
      cachedAt: Date.now(),
    });
    introspectionCacheSize.set(this.cache.size);
  }

  /**
   * Clear specific token from cache
   */
  clear(token?: string): void {
    if (token) {
      const key = this.hashToken(token);
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
    introspectionCacheSize.set(this.cache.size);
  }

  /**
   * Hash token for cache key
   */
  private async hashTokenAsync(token: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);
    return Array.from(hashArray)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .substring(0, 32); // Use first 32 chars for cache key
  }

  /**
   * Synchronous hash for cache operations (using simple hash)
   */
  private hashToken(token: string): string {
    // Simple djb2 hash for synchronous operation
    let hash = 5381;
    for (let i = 0; i < token.length; i++) {
      hash = (hash * 33) ^ token.charCodeAt(i);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const maxAge = this.defaultTTLMs * 2; // Keep entries for 2x TTL

    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      if (now - entry.cachedAt > maxAge) {
        this.cache.delete(key);
      }
    }
    introspectionCacheSize.set(this.cache.size);
  }

  /**
   * Destroy the cache
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
    introspectionCacheSize.set(0);
  }
}

// =============================================================================
// Token Introspection Service
// =============================================================================

/**
 * Token Introspection Service for real-time token validation
 *
 * @example
 * ```typescript
 * const introspection = new TokenIntrospectionService(
 *   'https://auth.example.com/oauth2/introspect',
 *   {
 *     clientId: 'my-resource-server',
 *     clientSecret: 'secret',
 *     defaultCacheTTL: 5000,
 *   }
 * );
 *
 * // Introspect a token
 * const result = await introspection.introspect(accessToken);
 *
 * // Cached introspection with custom TTL
 * const cachedResult = await introspection.cachedIntrospect(accessToken, 10000);
 *
 * // Clear cache for a token
 * introspection.clearCache(accessToken);
 * ```
 */
export class TokenIntrospectionService {
  private cache: IntrospectionCache;
  private options: Required<IntrospectionServiceOptions>;

  /**
   * Create a new token introspection service
   *
   * @param introspectionEndpoint - OAuth 2.0 introspection endpoint URL
   * @param options - Service options
   */
  constructor(
    private introspectionEndpoint: string,
    options: IntrospectionServiceOptions = {}
  ) {
    this.options = {
      defaultCacheTTL: options.defaultCacheTTL ?? 5000,
      maxCacheTTL: options.maxCacheTTL ?? 60000,
      requestTimeout: options.requestTimeout ?? 5000,
      clientId: options.clientId ?? '',
      clientSecret: options.clientSecret ?? '',
      fetch: options.fetch ?? fetch,
    };

    this.cache = new IntrospectionCache(this.options.defaultCacheTTL);

    logger.info(
      {
        endpoint: introspectionEndpoint,
        defaultCacheTTL: this.options.defaultCacheTTL,
        requestTimeout: this.options.requestTimeout,
      },
      'Token introspection service initialized'
    );
  }

  /**
   * Introspect a token (synchronous check, bypasses cache)
   *
   * @param token - Access token to introspect
   * @returns Introspection result
   */
  async introspect(token: string): Promise<IntrospectionResult> {
    const startTime = Date.now();

    try {
      const response = await this.callIntrospectionEndpoint(token);
      const result = this.mapResponseToResult(response);

      // Update cache
      this.cache.set(token, result);

      introspectionRequests.inc({
        result: result.active ? 'active' : 'inactive',
        cached: 'false',
      });

      logger.debug(
        { active: result.active, jti: result.jti },
        'Token introspection completed'
      );

      return result;
    } catch (error) {
      const errorType = error instanceof ExternalServiceError ? 'network' : 'internal';
      introspectionErrors.inc({ error_type: errorType });
      introspectionRequests.inc({ result: 'error', cached: 'false' });

      logger.error({ error }, 'Token introspection failed');
      throw error;
    } finally {
      const duration = (Date.now() - startTime) / 1000;
      introspectionDuration.observe({ cached: 'false' }, duration);
    }
  }

  /**
   * Cached introspection with configurable TTL
   *
   * Returns cached result if available and within TTL, otherwise
   * performs fresh introspection.
   *
   * @param token - Access token to introspect
   * @param maxCacheAge - Maximum cache age in milliseconds (default: config value)
   * @returns Introspection result
   */
  async cachedIntrospect(
    token: string,
    maxCacheAge?: number
  ): Promise<IntrospectionResult> {
    const startTime = Date.now();
    const effectiveMaxAge = Math.min(
      maxCacheAge ?? this.options.defaultCacheTTL,
      this.options.maxCacheTTL
    );

    // Check cache first
    const cached = this.cache.get(token, effectiveMaxAge);
    if (cached) {
      introspectionRequests.inc({
        result: cached.active ? 'active' : 'inactive',
        cached: 'true',
      });

      const duration = (Date.now() - startTime) / 1000;
      introspectionDuration.observe({ cached: 'true' }, duration);

      return cached;
    }

    // Cache miss, perform fresh introspection
    return this.introspect(token);
  }

  /**
   * Clear introspection cache
   *
   * @param token - Optional specific token to clear (clears all if not provided)
   */
  clearCache(token?: string): void {
    this.cache.clear(token);
    logger.debug({ token: token ? '[REDACTED]' : 'all' }, 'Introspection cache cleared');
  }

  /**
   * Call the introspection endpoint
   */
  private async callIntrospectionEndpoint(token: string): Promise<IntrospectionResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.requestTimeout);

    try {
      // Build request body
      const body = new URLSearchParams();
      body.append('token', token);
      body.append('token_type_hint', 'access_token');

      // Build headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      };

      // Add client authentication if configured
      if (this.options.clientId && this.options.clientSecret) {
        const credentials = btoa(`${this.options.clientId}:${this.options.clientSecret}`);
        headers['Authorization'] = `Basic ${credentials}`;
      }

      const response = await this.options.fetch(this.introspectionEndpoint, {
        method: 'POST',
        headers,
        body: body.toString(),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new ExternalServiceError(
          `Introspection endpoint returned ${response.status}`,
          { status: response.status, statusText: response.statusText }
        );
      }

      const data = await response.json();
      return data as IntrospectionResponse;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ExternalServiceError('Introspection request timed out', {
          timeout: this.options.requestTimeout,
        });
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Map introspection response to result
   */
  private mapResponseToResult(response: IntrospectionResponse): IntrospectionResult {
    const result: IntrospectionResult = {
      active: response.active,
      introspectedAt: new Date().toISOString(),
      fromCache: false,
    };

    // Map optional fields
    if (response.scope !== undefined) result.scope = response.scope;
    if (response.client_id !== undefined) result.clientId = response.client_id;
    if (response.username !== undefined) result.username = response.username;
    if (response.token_type !== undefined) result.tokenType = response.token_type;
    if (response.exp !== undefined) result.exp = response.exp;
    if (response.iat !== undefined) result.iat = response.iat;
    if (response.nbf !== undefined) result.nbf = response.nbf;
    if (response.sub !== undefined) result.sub = response.sub;
    if (response.aud !== undefined) result.aud = response.aud;
    if (response.iss !== undefined) result.iss = response.iss;
    if (response.jti !== undefined) result.jti = response.jti;
    if (response.cnf !== undefined) result.cnf = response.cnf;

    // Validate result
    introspectionResultSchema.parse(result);

    return result;
  }

  /**
   * Get introspection endpoint URL
   */
  getEndpoint(): string {
    return this.introspectionEndpoint;
  }

  /**
   * Destroy the service (cleanup)
   */
  destroy(): void {
    this.cache.destroy();
  }
}

/**
 * Create a mock introspection service for testing
 *
 * @param mockResponses - Map of token to response
 */
export function createMockIntrospectionService(
  mockResponses: Map<string, Partial<IntrospectionResult>> = new Map()
): TokenIntrospectionService {
  const mockFetch = async (url: string, options: RequestInit): Promise<Response> => {
    // Extract token from body
    const body = options.body?.toString() ?? '';
    const params = new URLSearchParams(body);
    const token = params.get('token') ?? '';

    // Get mock response
    const mockResponse = mockResponses.get(token);

    if (mockResponse) {
      return new Response(JSON.stringify({
        active: mockResponse.active ?? true,
        scope: mockResponse.scope,
        client_id: mockResponse.clientId,
        username: mockResponse.username,
        token_type: mockResponse.tokenType,
        exp: mockResponse.exp,
        iat: mockResponse.iat,
        nbf: mockResponse.nbf,
        sub: mockResponse.sub,
        aud: mockResponse.aud,
        iss: mockResponse.iss,
        jti: mockResponse.jti,
        cnf: mockResponse.cnf,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Default to inactive for unknown tokens
    return new Response(JSON.stringify({ active: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  return new TokenIntrospectionService('https://mock.introspection.endpoint/introspect', {
    fetch: mockFetch as typeof fetch,
  });
}

/**
 * Create a token introspection service
 */
export function createTokenIntrospectionService(
  introspectionEndpoint: string,
  options?: IntrospectionServiceOptions
): TokenIntrospectionService {
  return new TokenIntrospectionService(introspectionEndpoint, options);
}
