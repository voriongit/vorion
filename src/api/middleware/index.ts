/**
 * API Middleware Barrel Export
 *
 * Exports all middleware components for API hardening:
 * - Validation middleware (Zod-based input validation)
 * - Rate limiting middleware (per-tenant and per-endpoint)
 * - Security middleware (headers, request ID, logging)
 *
 * @packageDocumentation
 */

// Validation middleware
export {
  validateBody,
  validateQuery,
  validateParams,
  validateRequest,
  registerValidationPlugin,
  type ValidationOptions,
  type ValidationErrorDetail,
  type ZodSchema,
  type ZodError,
} from './validation.js';

// Rate limiting middleware
export {
  rateLimit,
  rateLimitPerTenant,
  rateLimitByMethod,
  registerRateLimitPlugin,
  getRateLimitStore,
  resetRateLimitStore,
  getRateLimitStats,
  resetTenantRateLimit,
  type RateLimitConfig,
  type TenantRateLimitConfig,
  type RateLimitResult,
} from './rateLimit.js';

// Security middleware
export {
  securityHeaders,
  requestIdInjection,
  requestLogging,
  combinedSecurityMiddleware,
  registerSecurityPlugin,
  maskSensitiveData,
  timingSafeEqual,
  type SecurityHeadersConfig,
  type CorsConfig,
  type CspConfig,
  type HstsConfig,
  type RequestLoggingConfig,
} from './security.js';
