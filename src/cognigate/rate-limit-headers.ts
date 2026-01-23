/**
 * COGNIGATE Rate Limit Headers
 *
 * Sets standard rate limit response headers on Fastify replies.
 * Implements both IETF draft standard headers and legacy X-RateLimit-*
 * headers for backwards compatibility.
 *
 * Headers set:
 * - RateLimit-Limit: Maximum requests allowed in the current window
 * - RateLimit-Remaining: Requests remaining in the current window
 * - RateLimit-Reset: Seconds until the rate limit window resets
 * - X-RateLimit-Limit: Legacy equivalent of RateLimit-Limit
 * - X-RateLimit-Remaining: Legacy equivalent of RateLimit-Remaining
 * - X-RateLimit-Reset: Legacy equivalent of RateLimit-Reset
 * - Retry-After: Seconds to wait before retrying (only on 429 responses)
 *
 * @packageDocumentation
 */

import type { FastifyReply } from 'fastify';
import type { RateLimitResult } from './ratelimit.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Normalized rate limit information for setting response headers.
 *
 * All time values are in seconds (not milliseconds) to match HTTP header
 * conventions and the IETF rate limit header draft specification.
 */
export interface RateLimitInfo {
  /** Maximum number of requests allowed in the current window */
  limit: number;

  /** Number of requests remaining in the current window */
  remaining: number;

  /** Seconds until the rate limit window resets */
  resetInSeconds: number;

  /**
   * Seconds until the client should retry (only present when rate limited).
   * Used to set the Retry-After header on 429 responses.
   */
  retryAfter?: number;
}

// ============================================================================
// Header Constants
// ============================================================================

/**
 * IETF draft standard rate limit header names.
 * @see https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/
 */
const HEADER_LIMIT = 'RateLimit-Limit';
const HEADER_REMAINING = 'RateLimit-Remaining';
const HEADER_RESET = 'RateLimit-Reset';

/**
 * Legacy rate limit header names for backwards compatibility.
 * These predate the IETF draft and are still widely used.
 */
const HEADER_X_LIMIT = 'X-RateLimit-Limit';
const HEADER_X_REMAINING = 'X-RateLimit-Remaining';
const HEADER_X_RESET = 'X-RateLimit-Reset';

/**
 * Standard HTTP header indicating how long to wait before retrying.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Retry-After
 */
const HEADER_RETRY_AFTER = 'Retry-After';

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default rate limit value used when the limit is not explicitly specified
 * in the RateLimitResult (e.g., when converting from a result that only
 * has remaining count but not the total limit).
 *
 * Uses the "free" tier per-minute limit as a reasonable default.
 */
const DEFAULT_RATE_LIMIT = 30;

// ============================================================================
// Header Functions
// ============================================================================

/**
 * Set standard rate limit headers on a Fastify response.
 *
 * Sets both IETF draft standard headers (RateLimit-Limit, RateLimit-Remaining,
 * RateLimit-Reset) and legacy X-RateLimit-* headers for backwards compatibility.
 * When the request has been rate-limited (retryAfter is present), also sets
 * the Retry-After header.
 *
 * @param reply - The Fastify reply object to set headers on
 * @param info - The normalized rate limit information
 *
 * @example
 * ```typescript
 * const result = await rateLimiter.checkLimit(tenantId, tier);
 * const info = rateLimitResultToInfo(result);
 * setRateLimitHeaders(reply, info);
 *
 * if (!result.allowed) {
 *   reply.status(429).send({ error: { code: 'RATE_LIMIT_EXCEEDED' } });
 * }
 * ```
 */
export function setRateLimitHeaders(reply: FastifyReply, info: RateLimitInfo): void {
  const limitStr = info.limit.toString();
  const remainingStr = Math.max(0, info.remaining).toString();
  const resetStr = Math.max(0, Math.ceil(info.resetInSeconds)).toString();

  // IETF draft standard headers
  reply.header(HEADER_LIMIT, limitStr);
  reply.header(HEADER_REMAINING, remainingStr);
  reply.header(HEADER_RESET, resetStr);

  // Legacy headers for backwards compatibility
  reply.header(HEADER_X_LIMIT, limitStr);
  reply.header(HEADER_X_REMAINING, remainingStr);
  reply.header(HEADER_X_RESET, resetStr);

  // Retry-After header for 429 responses
  if (info.retryAfter !== undefined) {
    reply.header(HEADER_RETRY_AFTER, Math.ceil(info.retryAfter).toString());
  }
}

// ============================================================================
// Conversion Functions
// ============================================================================

/**
 * Convert a CognigateRateLimiter RateLimitResult to a RateLimitInfo
 * suitable for setting response headers.
 *
 * Handles the conversion from:
 * - ISO timestamp `resetAt` to seconds-from-now `resetInSeconds`
 * - Milliseconds `retryAfterMs` to seconds `retryAfter`
 * - Derives the `limit` from `remaining` when the request is allowed,
 *   or uses DEFAULT_RATE_LIMIT as fallback
 *
 * @param result - The result from CognigateRateLimiter.checkLimit() or checkExecutionLimit()
 * @param limit - Optional explicit limit value to use in headers (overrides derivation)
 * @returns Normalized rate limit info for header setting
 *
 * @example
 * ```typescript
 * const result = await rateLimiter.checkLimit(tenantId, tier);
 * const info = rateLimitResultToInfo(result);
 * // info.resetInSeconds is seconds until reset
 * // info.retryAfter is seconds to wait (only if rate limited)
 * ```
 */
export function rateLimitResultToInfo(result: RateLimitResult, limit?: number): RateLimitInfo {
  // Calculate seconds until reset from the ISO timestamp
  const resetAtMs = new Date(result.resetAt).getTime();
  const nowMs = Date.now();
  const resetInSeconds = Math.max(0, Math.ceil((resetAtMs - nowMs) / 1000));

  // Convert retryAfterMs to seconds if present
  const retryAfter = result.retryAfterMs !== undefined
    ? Math.max(0, Math.ceil(result.retryAfterMs / 1000))
    : undefined;

  // Determine the effective limit:
  // 1. Use explicit limit if provided
  // 2. If request was denied, remaining is 0, so we use DEFAULT_RATE_LIMIT
  // 3. If request was allowed, the limit is at least remaining (use as approximation)
  const effectiveLimit = limit ?? (result.allowed
    ? Math.max(result.remaining, DEFAULT_RATE_LIMIT)
    : DEFAULT_RATE_LIMIT);

  const info: RateLimitInfo = {
    limit: effectiveLimit,
    remaining: result.remaining,
    resetInSeconds,
  };

  if (retryAfter !== undefined) {
    info.retryAfter = retryAfter;
  }

  return info;
}

/**
 * Create a RateLimitInfo directly from individual values.
 * Useful when you have the raw values and don't need to convert from a RateLimitResult.
 *
 * @param limit - Maximum requests in the window
 * @param remaining - Remaining requests in the window
 * @param resetInSeconds - Seconds until the window resets
 * @param retryAfter - Optional seconds to wait before retrying
 * @returns A RateLimitInfo object
 */
export function createRateLimitInfo(
  limit: number,
  remaining: number,
  resetInSeconds: number,
  retryAfter?: number
): RateLimitInfo {
  const info: RateLimitInfo = {
    limit,
    remaining: Math.max(0, remaining),
    resetInSeconds: Math.max(0, resetInSeconds),
  };

  if (retryAfter !== undefined) {
    info.retryAfter = Math.max(0, retryAfter);
  }

  return info;
}
