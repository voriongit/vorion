/**
 * Phase 6 Error Handling Middleware
 *
 * Provides consistent error responses for Phase 6 Trust Engine APIs with:
 * - Standardized error format
 * - Error classification and codes
 * - Request tracing
 * - Sensitive data redaction
 */

import { NextResponse } from 'next/server'

// =============================================================================
// TYPES
// =============================================================================

export type ErrorCategory =
  | 'VALIDATION'
  | 'AUTHENTICATION'
  | 'AUTHORIZATION'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMIT'
  | 'INTERNAL'
  | 'EXTERNAL'
  | 'TIMEOUT'

export interface Phase6Error {
  code: string
  message: string
  category: ErrorCategory
  statusCode: number
  details?: Record<string, unknown>
  retryable: boolean
}

export interface ErrorResponse {
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
    requestId?: string
    timestamp: string
  }
  retryable: boolean
  retryAfter?: number
}

// =============================================================================
// ERROR DEFINITIONS
// =============================================================================

export const PHASE6_ERRORS: Record<string, Phase6Error> = {
  // Validation Errors (400)
  INVALID_REQUEST: {
    code: 'P6_INVALID_REQUEST',
    message: 'The request body is invalid or malformed',
    category: 'VALIDATION',
    statusCode: 400,
    retryable: false,
  },
  INVALID_AGENT_ID: {
    code: 'P6_INVALID_AGENT_ID',
    message: 'The provided agent ID is invalid',
    category: 'VALIDATION',
    statusCode: 400,
    retryable: false,
  },
  INVALID_ROLE: {
    code: 'P6_INVALID_ROLE',
    message: 'The provided role is not a valid agent role',
    category: 'VALIDATION',
    statusCode: 400,
    retryable: false,
  },
  INVALID_TIER: {
    code: 'P6_INVALID_TIER',
    message: 'The provided tier is not a valid trust tier',
    category: 'VALIDATION',
    statusCode: 400,
    retryable: false,
  },
  INVALID_SCORE: {
    code: 'P6_INVALID_SCORE',
    message: 'Trust score must be between 0 and 1000',
    category: 'VALIDATION',
    statusCode: 400,
    retryable: false,
  },
  INVALID_CREATION_TYPE: {
    code: 'P6_INVALID_CREATION_TYPE',
    message: 'Invalid provenance creation type',
    category: 'VALIDATION',
    statusCode: 400,
    retryable: false,
  },
  MISSING_REQUIRED_FIELD: {
    code: 'P6_MISSING_FIELD',
    message: 'A required field is missing from the request',
    category: 'VALIDATION',
    statusCode: 400,
    retryable: false,
  },

  // Authentication Errors (401)
  UNAUTHORIZED: {
    code: 'P6_UNAUTHORIZED',
    message: 'Authentication required to access this resource',
    category: 'AUTHENTICATION',
    statusCode: 401,
    retryable: false,
  },
  INVALID_TOKEN: {
    code: 'P6_INVALID_TOKEN',
    message: 'The provided authentication token is invalid or expired',
    category: 'AUTHENTICATION',
    statusCode: 401,
    retryable: false,
  },

  // Authorization Errors (403)
  FORBIDDEN: {
    code: 'P6_FORBIDDEN',
    message: 'You do not have permission to perform this action',
    category: 'AUTHORIZATION',
    statusCode: 403,
    retryable: false,
  },
  INSUFFICIENT_TIER: {
    code: 'P6_INSUFFICIENT_TIER',
    message: 'Agent trust tier is insufficient for this operation',
    category: 'AUTHORIZATION',
    statusCode: 403,
    retryable: false,
  },
  ROLE_NOT_ALLOWED: {
    code: 'P6_ROLE_NOT_ALLOWED',
    message: 'The requested role is not allowed at the current trust tier',
    category: 'AUTHORIZATION',
    statusCode: 403,
    retryable: false,
  },
  CEILING_EXCEEDED: {
    code: 'P6_CEILING_EXCEEDED',
    message: 'Operation would exceed the trust ceiling',
    category: 'AUTHORIZATION',
    statusCode: 403,
    retryable: false,
  },

  // Not Found Errors (404)
  AGENT_NOT_FOUND: {
    code: 'P6_AGENT_NOT_FOUND',
    message: 'The specified agent was not found',
    category: 'NOT_FOUND',
    statusCode: 404,
    retryable: false,
  },
  CONTEXT_NOT_FOUND: {
    code: 'P6_CONTEXT_NOT_FOUND',
    message: 'The specified context was not found',
    category: 'NOT_FOUND',
    statusCode: 404,
    retryable: false,
  },
  PRESET_NOT_FOUND: {
    code: 'P6_PRESET_NOT_FOUND',
    message: 'The specified preset was not found',
    category: 'NOT_FOUND',
    statusCode: 404,
    retryable: false,
  },
  PROVENANCE_NOT_FOUND: {
    code: 'P6_PROVENANCE_NOT_FOUND',
    message: 'Provenance record not found for this agent',
    category: 'NOT_FOUND',
    statusCode: 404,
    retryable: false,
  },
  ALERT_NOT_FOUND: {
    code: 'P6_ALERT_NOT_FOUND',
    message: 'The specified alert was not found',
    category: 'NOT_FOUND',
    statusCode: 404,
    retryable: false,
  },

  // Conflict Errors (409)
  DUPLICATE_ENTRY: {
    code: 'P6_DUPLICATE',
    message: 'A resource with this identifier already exists',
    category: 'CONFLICT',
    statusCode: 409,
    retryable: false,
  },
  CONTEXT_FROZEN: {
    code: 'P6_CONTEXT_FROZEN',
    message: 'This context is frozen and cannot be modified',
    category: 'CONFLICT',
    statusCode: 409,
    retryable: false,
  },
  LINEAGE_MISMATCH: {
    code: 'P6_LINEAGE_MISMATCH',
    message: 'Lineage hash verification failed',
    category: 'CONFLICT',
    statusCode: 409,
    retryable: false,
  },

  // Rate Limit Errors (429)
  RATE_LIMITED: {
    code: 'P6_RATE_LIMITED',
    message: 'Too many requests. Please try again later.',
    category: 'RATE_LIMIT',
    statusCode: 429,
    retryable: true,
  },

  // Internal Errors (500)
  INTERNAL_ERROR: {
    code: 'P6_INTERNAL_ERROR',
    message: 'An internal error occurred. Please try again later.',
    category: 'INTERNAL',
    statusCode: 500,
    retryable: true,
  },
  DATABASE_ERROR: {
    code: 'P6_DATABASE_ERROR',
    message: 'A database error occurred',
    category: 'INTERNAL',
    statusCode: 500,
    retryable: true,
  },
  CACHE_ERROR: {
    code: 'P6_CACHE_ERROR',
    message: 'A cache error occurred',
    category: 'INTERNAL',
    statusCode: 500,
    retryable: true,
  },

  // External Service Errors (502)
  EXTERNAL_SERVICE_ERROR: {
    code: 'P6_EXTERNAL_ERROR',
    message: 'An external service is unavailable',
    category: 'EXTERNAL',
    statusCode: 502,
    retryable: true,
  },

  // Timeout Errors (504)
  REQUEST_TIMEOUT: {
    code: 'P6_TIMEOUT',
    message: 'The request timed out. Please try again.',
    category: 'TIMEOUT',
    statusCode: 504,
    retryable: true,
  },
}

// =============================================================================
// ERROR CREATION
// =============================================================================

/**
 * Create a Phase 6 error
 */
export function createPhase6Error(
  errorKey: keyof typeof PHASE6_ERRORS,
  details?: Record<string, unknown>,
  overrides?: Partial<Phase6Error>
): Phase6Error {
  const baseError = PHASE6_ERRORS[errorKey]
  return {
    ...baseError,
    ...overrides,
    details: details ? redactSensitiveData(details) : undefined,
  }
}

/**
 * Create custom Phase 6 error
 */
export function createCustomError(
  code: string,
  message: string,
  category: ErrorCategory,
  statusCode: number,
  options?: {
    details?: Record<string, unknown>
    retryable?: boolean
  }
): Phase6Error {
  return {
    code,
    message,
    category,
    statusCode,
    details: options?.details ? redactSensitiveData(options.details) : undefined,
    retryable: options?.retryable ?? false,
  }
}

// =============================================================================
// ERROR RESPONSE
// =============================================================================

/**
 * Generate request ID for tracing
 */
function generateRequestId(): string {
  return `p6_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Redact sensitive data from error details
 */
function redactSensitiveData(data: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = ['password', 'token', 'secret', 'key', 'credential', 'apiKey', 'authorization']
  const redacted: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(data)) {
    const isNested = typeof value === 'object' && value !== null && !Array.isArray(value)
    const isSensitive = sensitiveKeys.some((k) => key.toLowerCase().includes(k))

    if (isSensitive) {
      redacted[key] = '[REDACTED]'
    } else if (isNested) {
      redacted[key] = redactSensitiveData(value as Record<string, unknown>)
    } else {
      redacted[key] = value
    }
  }

  return redacted
}

/**
 * Create error response
 */
export function createErrorResponse(
  error: Phase6Error,
  requestId?: string
): NextResponse<ErrorResponse> {
  const response: ErrorResponse = {
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
      requestId: requestId || generateRequestId(),
      timestamp: new Date().toISOString(),
    },
    retryable: error.retryable,
  }

  // Add retry-after for rate limit errors
  if (error.category === 'RATE_LIMIT') {
    response.retryAfter = 60 // Default to 60 seconds
  }

  const headers = new Headers()
  headers.set('Content-Type', 'application/json')
  headers.set('X-Request-Id', response.error.requestId!)

  if (response.retryAfter) {
    headers.set('Retry-After', String(response.retryAfter))
  }

  return NextResponse.json(response, {
    status: error.statusCode,
    headers,
  })
}

// =============================================================================
// ERROR HANDLING WRAPPER
// =============================================================================

/**
 * Wrap async handler with error handling
 *
 * @example
 * ```typescript
 * export const GET = withErrorHandling(async (request) => {
 *   const data = await phase6Service.getStats()
 *   return NextResponse.json({ data })
 * })
 * ```
 */
export function withErrorHandling<T>(
  handler: (request: Request, context?: T) => Promise<NextResponse>
): (request: Request, context?: T) => Promise<NextResponse> {
  return async (request: Request, context?: T): Promise<NextResponse> => {
    const requestId = generateRequestId()

    try {
      const response = await handler(request, context)

      // Add request ID to successful responses
      response.headers.set('X-Request-Id', requestId)

      return response
    } catch (err) {
      // Log error for debugging
      console.error(`[${requestId}] Phase 6 Error:`, err)

      // Handle known Phase 6 errors
      if (isPhase6Error(err)) {
        return createErrorResponse(err, requestId)
      }

      // Handle Supabase/database errors
      if (isDatabaseError(err)) {
        return createErrorResponse(
          createPhase6Error('DATABASE_ERROR', { originalError: String(err) }),
          requestId
        )
      }

      // Handle timeout errors
      if (isTimeoutError(err)) {
        return createErrorResponse(
          createPhase6Error('REQUEST_TIMEOUT'),
          requestId
        )
      }

      // Handle validation errors (from Zod, etc.)
      if (isValidationError(err)) {
        return createErrorResponse(
          createPhase6Error('INVALID_REQUEST', {
            validationErrors: (err as { errors?: unknown }).errors
          }),
          requestId
        )
      }

      // Default to internal error
      return createErrorResponse(
        createPhase6Error('INTERNAL_ERROR'),
        requestId
      )
    }
  }
}

// =============================================================================
// ERROR TYPE GUARDS
// =============================================================================

function isPhase6Error(err: unknown): err is Phase6Error {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    'category' in err &&
    typeof (err as Phase6Error).code === 'string' &&
    (err as Phase6Error).code.startsWith('P6_')
  )
}

function isDatabaseError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false

  const error = err as { code?: string; name?: string; message?: string }

  return (
    error.code?.startsWith('PGRST') ||
    error.code?.startsWith('22') ||
    error.code?.startsWith('23') ||
    error.name === 'PostgrestError' ||
    error.message?.includes('database') ||
    error.message?.includes('supabase')
  )
}

function isTimeoutError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false

  const error = err as { code?: string; name?: string; message?: string }

  return (
    error.code === 'ETIMEDOUT' ||
    error.code === 'ESOCKETTIMEDOUT' ||
    error.name === 'TimeoutError' ||
    error.message?.toLowerCase().includes('timeout')
  )
}

function isValidationError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false

  const error = err as { name?: string; issues?: unknown; errors?: unknown }

  return (
    error.name === 'ZodError' ||
    error.name === 'ValidationError' ||
    Array.isArray(error.issues) ||
    Array.isArray(error.errors)
  )
}

// =============================================================================
// THROW HELPERS
// =============================================================================

/**
 * Throw a Phase 6 error
 */
export function throwPhase6Error(
  errorKey: keyof typeof PHASE6_ERRORS,
  details?: Record<string, unknown>
): never {
  throw createPhase6Error(errorKey, details)
}

/**
 * Assert condition or throw error
 */
export function assertOrThrow(
  condition: boolean,
  errorKey: keyof typeof PHASE6_ERRORS,
  details?: Record<string, unknown>
): asserts condition {
  if (!condition) {
    throwPhase6Error(errorKey, details)
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  errors: PHASE6_ERRORS,
  create: createPhase6Error,
  createCustom: createCustomError,
  respond: createErrorResponse,
  wrap: withErrorHandling,
  throw: throwPhase6Error,
  assert: assertOrThrow,
}
