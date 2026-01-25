/**
 * API module exports
 *
 * Provides the Fastify API server with hardening middleware:
 * - Input validation (Zod-based)
 * - Rate limiting (per-tenant and per-endpoint)
 * - Security headers (CORS, CSP, HSTS, etc.)
 * - Standardized error handling
 *
 * @packageDocumentation
 */

export * from './server.js';
export * from './middleware/index.js';
export * from './errors.js';
// Note: validation.ts and rate-limit.ts exports are intentionally omitted
// to avoid naming conflicts with middleware/validation.ts and middleware/rateLimit.ts
// Use the middleware versions for API hardening.
