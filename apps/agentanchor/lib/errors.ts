/**
 * Error Handling Framework
 *
 * Provides structured error classification and handling for the AgentAnchor platform.
 * All errors should extend ApiError for consistent error responses.
 */

export enum ErrorType {
  // Authentication & Authorization
  AUTH_ERROR = 'AUTH_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',

  // Rate Limiting
  RATE_LIMIT = 'RATE_LIMIT',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',

  // API & External Services
  API_ERROR = 'API_ERROR',
  ANTHROPIC_ERROR = 'ANTHROPIC_ERROR',
  SUPABASE_ERROR = 'SUPABASE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',

  // Validation & Input
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',

  // Resource Management
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',

  // System Errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  TIMEOUT = 'TIMEOUT',
  CIRCUIT_BREAKER_OPEN = 'CIRCUIT_BREAKER_OPEN',
}

export class ApiError extends Error {
  public readonly type: ErrorType
  public readonly statusCode: number
  public readonly retryable: boolean
  public readonly details?: any
  public readonly timestamp: string

  constructor(
    message: string,
    type: ErrorType = ErrorType.INTERNAL_ERROR,
    statusCode: number = 500,
    retryable: boolean = false,
    details?: any
  ) {
    super(message)
    this.name = 'ApiError'
    this.type = type
    this.statusCode = statusCode
    this.retryable = retryable
    this.details = details
    this.timestamp = new Date().toISOString()

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor)
  }

  /**
   * Convert error to JSON response format
   */
  toJSON() {
    return {
      error: {
        type: this.type,
        message: this.message,
        statusCode: this.statusCode,
        retryable: this.retryable,
        details: this.details,
        timestamp: this.timestamp,
      },
    }
  }

  /**
   * Create error response for API routes
   */
  toResponse() {
    return new Response(JSON.stringify(this.toJSON()), {
      status: this.statusCode,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }
}

/**
 * Specific error classes for common scenarios
 */

export class AuthError extends ApiError {
  constructor(message: string = 'Authentication required', details?: any) {
    super(message, ErrorType.AUTH_ERROR, 401, false, details)
    this.name = 'AuthError'
  }
}

export class ForbiddenError extends ApiError {
  constructor(message: string = 'Access forbidden', details?: any) {
    super(message, ErrorType.FORBIDDEN, 403, false, details)
    this.name = 'ForbiddenError'
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string = 'Resource', details?: any) {
    super(`${resource} not found`, ErrorType.NOT_FOUND, 404, false, details)
    this.name = 'NotFoundError'
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, details?: any) {
    super(message, ErrorType.VALIDATION_ERROR, 400, false, details)
    this.name = 'ValidationError'
  }
}

export class RateLimitError extends ApiError {
  constructor(message: string = 'Rate limit exceeded', retryAfter?: number) {
    super(message, ErrorType.RATE_LIMIT, 429, true, { retryAfter })
    this.name = 'RateLimitError'
  }
}

export class AnthropicError extends ApiError {
  constructor(message: string, details?: any) {
    super(message, ErrorType.ANTHROPIC_ERROR, 502, true, details)
    this.name = 'AnthropicError'
  }
}

export class TimeoutError extends ApiError {
  constructor(message: string = 'Request timeout', details?: any) {
    super(message, ErrorType.TIMEOUT, 504, true, details)
    this.name = 'TimeoutError'
  }
}

export class CircuitBreakerError extends ApiError {
  constructor(service: string, details?: any) {
    super(
      `Circuit breaker open for ${service}`,
      ErrorType.CIRCUIT_BREAKER_OPEN,
      503,
      true,
      details
    )
    this.name = 'CircuitBreakerError'
  }
}

/**
 * Error handler utility
 */
export function handleError(error: unknown): ApiError {
  // Already an ApiError
  if (error instanceof ApiError) {
    return error
  }

  // Standard Error
  if (error instanceof Error) {
    // Check for specific error patterns
    if (error.message.includes('ECONNREFUSED')) {
      return new ApiError(
        'Service unavailable',
        ErrorType.NETWORK_ERROR,
        503,
        true
      )
    }

    if (error.message.includes('timeout')) {
      return new TimeoutError(error.message)
    }

    return new ApiError(error.message, ErrorType.INTERNAL_ERROR, 500, false)
  }

  // Unknown error
  return new ApiError(
    'An unknown error occurred',
    ErrorType.INTERNAL_ERROR,
    500,
    false,
    { originalError: String(error) }
  )
}

/**
 * Async error wrapper for API routes
 */
export function catchErrors<T extends any[], R>(
  handler: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R | Response> => {
    try {
      return await handler(...args)
    } catch (error) {
      const apiError = handleError(error)

      // Log error (will be picked up by logger)
      console.error('API Error:', {
        type: apiError.type,
        message: apiError.message,
        statusCode: apiError.statusCode,
        stack: apiError.stack,
      })

      return apiError.toResponse()
    }
  }
}
