/**
 * API Error Handling
 *
 * Provides standardized error classes, error handler middleware,
 * and error serialization for consistent API error responses.
 *
 * @packageDocumentation
 */

import type { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { createLogger } from '../common/logger.js';
import { getTraceContext, type TraceContext } from '../common/trace.js';
import { getConfig } from '../common/config.js';
import { VorionError, isVorionError } from '../common/errors.js';
import type { VorionErrorResponse } from '../common/contracts/output.js';

const logger = createLogger({ component: 'api-errors' });
const tracer = trace.getTracer('vorion-api-errors');

/**
 * Standard error codes for API responses
 */
export enum ErrorCode {
  // Client Errors (4xx)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  INVALID_PARAMS = 'INVALID_PARAMS',
  INVALID_QUERY = 'INVALID_QUERY',
  MISSING_FIELD = 'MISSING_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',
  PAYLOAD_TOO_LARGE = 'PAYLOAD_TOO_LARGE',
  INJECTION_DETECTED = 'INJECTION_DETECTED',

  UNAUTHORIZED = 'UNAUTHORIZED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_REVOKED = 'TOKEN_REVOKED',
  MISSING_AUTH = 'MISSING_AUTH',

  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  TENANT_MISMATCH = 'TENANT_MISMATCH',

  NOT_FOUND = 'NOT_FOUND',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  INTENT_NOT_FOUND = 'INTENT_NOT_FOUND',
  POLICY_NOT_FOUND = 'POLICY_NOT_FOUND',
  ESCALATION_NOT_FOUND = 'ESCALATION_NOT_FOUND',

  CONFLICT = 'CONFLICT',
  RESOURCE_EXISTS = 'RESOURCE_EXISTS',
  INVALID_STATE = 'INVALID_STATE',

  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',

  // Server Errors (5xx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  TIMEOUT = 'TIMEOUT',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

/**
 * HTTP status code mapping for error codes
 */
const ERROR_STATUS_MAP: Record<ErrorCode, number> = {
  // 400 Bad Request
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.INVALID_INPUT]: 400,
  [ErrorCode.INVALID_PARAMS]: 400,
  [ErrorCode.INVALID_QUERY]: 400,
  [ErrorCode.MISSING_FIELD]: 400,
  [ErrorCode.INVALID_FORMAT]: 400,
  [ErrorCode.INJECTION_DETECTED]: 400,

  // 401 Unauthorized
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.TOKEN_INVALID]: 401,
  [ErrorCode.TOKEN_EXPIRED]: 401,
  [ErrorCode.TOKEN_REVOKED]: 401,
  [ErrorCode.MISSING_AUTH]: 401,

  // 403 Forbidden
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: 403,
  [ErrorCode.TENANT_MISMATCH]: 403,

  // 404 Not Found
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.RESOURCE_NOT_FOUND]: 404,
  [ErrorCode.INTENT_NOT_FOUND]: 404,
  [ErrorCode.POLICY_NOT_FOUND]: 404,
  [ErrorCode.ESCALATION_NOT_FOUND]: 404,

  // 409 Conflict
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.RESOURCE_EXISTS]: 409,
  [ErrorCode.INVALID_STATE]: 409,

  // 413 Payload Too Large
  [ErrorCode.PAYLOAD_TOO_LARGE]: 413,

  // 429 Too Many Requests
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
  [ErrorCode.QUOTA_EXCEEDED]: 429,

  // 500 Internal Server Error
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.DATABASE_ERROR]: 500,

  // 502 Bad Gateway
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: 502,

  // 503 Service Unavailable
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,

  // 504 Gateway Timeout
  [ErrorCode.TIMEOUT]: 504,
};

/**
 * Base API error class
 */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details?: Record<string, unknown>;
  readonly retryAfter?: number;

  constructor(
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>,
    retryAfter?: number
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = ERROR_STATUS_MAP[code] ?? 500;
    this.details = details;
    this.retryAfter = retryAfter;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Serialize to VorionErrorResponse format
   */
  toResponse(requestId: string, includeDetails: boolean = true): VorionErrorResponse {
    const response: VorionErrorResponse = {
      success: false,
      error: {
        code: this.code,
        message: this.message,
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    };

    if (includeDetails && this.details) {
      response.error.details = this.details;
    }

    if (this.retryAfter !== undefined) {
      response.error.retryAfter = this.retryAfter;
    }

    return response;
  }
}

/**
 * Not Found error (404)
 */
export class NotFoundError extends ApiError {
  constructor(
    resource: string = 'Resource',
    message?: string,
    details?: Record<string, unknown>
  ) {
    super(
      ErrorCode.NOT_FOUND,
      message ?? `${resource} not found`,
      details
    );
    this.name = 'NotFoundError';
  }
}

/**
 * Validation error (400)
 */
export class ValidationError extends ApiError {
  constructor(
    message: string = 'Validation failed',
    details?: Record<string, unknown>
  ) {
    super(ErrorCode.VALIDATION_ERROR, message, details);
    this.name = 'ValidationError';
  }

  /**
   * Create from Zod error
   */
  static fromZodError(error: ZodError): ValidationError {
    const errors = error.errors.map((e) => ({
      path: e.path.join('.') || '(root)',
      message: e.message,
      code: e.code,
    }));

    return new ValidationError('Request validation failed', { errors });
  }
}

/**
 * Authentication error (401)
 */
export class AuthError extends ApiError {
  constructor(
    message: string = 'Authentication required',
    code: ErrorCode = ErrorCode.UNAUTHORIZED,
    details?: Record<string, unknown>
  ) {
    super(code, message, details);
    this.name = 'AuthError';
  }

  static tokenInvalid(message: string = 'Invalid token'): AuthError {
    return new AuthError(message, ErrorCode.TOKEN_INVALID);
  }

  static tokenExpired(message: string = 'Token has expired'): AuthError {
    return new AuthError(message, ErrorCode.TOKEN_EXPIRED);
  }

  static tokenRevoked(message: string = 'Token has been revoked'): AuthError {
    return new AuthError(message, ErrorCode.TOKEN_REVOKED);
  }

  static missingAuth(message: string = 'Authorization header is required'): AuthError {
    return new AuthError(message, ErrorCode.MISSING_AUTH);
  }
}

/**
 * Rate limit error (429)
 */
export class RateLimitError extends ApiError {
  constructor(
    message: string = 'Rate limit exceeded',
    retryAfter: number,
    details?: Record<string, unknown>
  ) {
    super(ErrorCode.RATE_LIMIT_EXCEEDED, message, details, retryAfter);
    this.name = 'RateLimitError';
  }
}

/**
 * Conflict error (409)
 */
export class ConflictError extends ApiError {
  constructor(
    message: string = 'Resource conflict',
    details?: Record<string, unknown>
  ) {
    super(ErrorCode.CONFLICT, message, details);
    this.name = 'ConflictError';
  }

  static invalidState(currentState: string, allowedStates: string[]): ConflictError {
    return new ConflictError(
      `Invalid state transition. Current state: ${currentState}, allowed states: ${allowedStates.join(', ')}`,
      { currentState, allowedStates }
    );
  }
}

/**
 * Forbidden error (403)
 */
export class ForbiddenError extends ApiError {
  constructor(
    message: string = 'Access denied',
    details?: Record<string, unknown>
  ) {
    super(ErrorCode.FORBIDDEN, message, details);
    this.name = 'ForbiddenError';
  }

  static insufficientPermissions(requiredPermission: string): ForbiddenError {
    return new ForbiddenError(
      `Insufficient permissions. Required: ${requiredPermission}`,
      { requiredPermission }
    );
  }

  static tenantMismatch(): ForbiddenError {
    return new ForbiddenError(
      'Access denied. Resource belongs to a different tenant.',
      {}
    );
  }
}

/**
 * Internal server error (500)
 */
export class InternalError extends ApiError {
  constructor(
    message: string = 'An unexpected error occurred',
    details?: Record<string, unknown>
  ) {
    super(ErrorCode.INTERNAL_ERROR, message, details);
    this.name = 'InternalError';
  }
}

/**
 * Get status code for an error code
 */
export function getStatusForErrorCode(code: ErrorCode): number {
  return ERROR_STATUS_MAP[code] ?? 500;
}

/**
 * Check if an error is an API error
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Sanitize error message for production
 * Removes potentially sensitive information
 */
function sanitizeErrorMessage(message: string): string {
  const sensitivePatterns = [
    /password/i,
    /secret/i,
    /token/i,
    /key/i,
    /credential/i,
    /connection string/i,
    /database.*error/i,
    /sql.*error/i,
  ];

  for (const pattern of sensitivePatterns) {
    if (pattern.test(message)) {
      return 'An error occurred while processing your request';
    }
  }

  // Remove stack traces
  const stackIndex = message.indexOf('\n    at ');
  if (stackIndex !== -1) {
    return message.substring(0, stackIndex);
  }

  return message;
}

/**
 * Create error response from any error
 */
export function createErrorResponse(
  error: unknown,
  requestId: string,
  isProduction: boolean = false
): { response: VorionErrorResponse; statusCode: number } {
  const traceContext = getTraceContext();

  // Handle API errors
  if (isApiError(error)) {
    const response = error.toResponse(requestId, !isProduction);

    if (traceContext) {
      response.trace = { traceId: traceContext.traceId };
    }

    return { response, statusCode: error.statusCode };
  }

  // Handle Vorion errors from common/errors.ts
  if (isVorionError(error)) {
    const response: VorionErrorResponse = {
      success: false,
      error: {
        code: error.code,
        message: isProduction ? sanitizeErrorMessage(error.message) : error.message,
        details: !isProduction && error.details ? error.details : undefined,
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    };

    if (traceContext) {
      response.trace = { traceId: traceContext.traceId };
    }

    return { response, statusCode: error.statusCode };
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const validationError = ValidationError.fromZodError(error);
    const response = validationError.toResponse(requestId, !isProduction);

    if (traceContext) {
      response.trace = { traceId: traceContext.traceId };
    }

    return { response, statusCode: 400 };
  }

  // Handle Fastify errors
  if (isFastifyError(error)) {
    let code = ErrorCode.INTERNAL_ERROR;
    let statusCode = error.statusCode ?? 500;
    let message = error.message;

    // Map specific Fastify error codes
    if (error.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER') {
      code = ErrorCode.MISSING_AUTH;
      statusCode = 401;
      message = 'Authorization header is missing';
    } else if (error.code === 'FST_JWT_AUTHORIZATION_TOKEN_INVALID') {
      code = ErrorCode.TOKEN_INVALID;
      statusCode = 401;
      message = 'Invalid authorization token';
    } else if (error.code === 'FST_JWT_AUTHORIZATION_TOKEN_EXPIRED') {
      code = ErrorCode.TOKEN_EXPIRED;
      statusCode = 401;
      message = 'Authorization token has expired';
    } else if (statusCode === 429) {
      code = ErrorCode.RATE_LIMIT_EXCEEDED;
    } else if (statusCode === 413) {
      code = ErrorCode.PAYLOAD_TOO_LARGE;
    }

    const response: VorionErrorResponse = {
      success: false,
      error: {
        code,
        message: isProduction && statusCode >= 500 ? 'An unexpected error occurred' : message,
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    };

    if (traceContext) {
      response.trace = { traceId: traceContext.traceId };
    }

    return { response, statusCode };
  }

  // Handle generic errors
  const message = error instanceof Error ? error.message : 'Unknown error';
  const response: VorionErrorResponse = {
    success: false,
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message: isProduction ? 'An unexpected error occurred' : sanitizeErrorMessage(message),
    },
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
    },
  };

  if (traceContext) {
    response.trace = { traceId: traceContext.traceId };
  }

  return { response, statusCode: 500 };
}

/**
 * Type guard for Fastify errors
 */
function isFastifyError(error: unknown): error is FastifyError {
  return (
    error !== null &&
    typeof error === 'object' &&
    'statusCode' in error &&
    typeof (error as FastifyError).statusCode === 'number'
  );
}

/**
 * Create standard error handler middleware for Fastify
 *
 * @param options - Error handler options
 * @returns Fastify error handler
 */
export function createErrorHandler(options?: {
  /** Include stack traces in non-production */
  includeStack?: boolean;
  /** Custom error transform */
  transformError?: (error: unknown) => unknown;
}): (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  const config = getConfig();
  const isProduction = config.env === 'production';

  return async (error: FastifyError, request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const requestId = request.id || 'unknown';
    const traceContext = (request as FastifyRequest & { traceContext?: TraceContext }).traceContext;

    // Apply custom transform if provided
    const transformedError = options?.transformError?.(error) ?? error;

    // Create error response
    const { response, statusCode } = createErrorResponse(
      transformedError,
      requestId,
      isProduction
    );

    // Add trace context if available
    if (traceContext && response.trace) {
      response.trace.traceId = traceContext.traceId;
    }

    // Log the error
    const logData: Record<string, unknown> = {
      requestId,
      statusCode,
      errorCode: response.error.code,
      url: request.url,
      method: request.method,
    };

    if (traceContext) {
      logData.traceId = traceContext.traceId;
    }

    if (!isProduction && options?.includeStack !== false) {
      logData.stack = error.stack;
    }

    // Log level based on status code
    if (statusCode >= 500) {
      logger.error(logData, error.message);

      // Record exception in trace
      const span = trace.getActiveSpan();
      if (span) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
        span.recordException(error);
      }
    } else if (statusCode >= 400) {
      logger.warn(logData, error.message);
    } else {
      logger.info(logData, error.message);
    }

    // Add Retry-After header for rate limit errors
    if (response.error.retryAfter !== undefined) {
      reply.header('Retry-After', response.error.retryAfter);
    }

    return reply.status(statusCode).send(response);
  };
}

/**
 * Wrap an async handler to catch and format errors
 */
export function wrapHandler<T>(
  handler: (request: FastifyRequest, reply: FastifyReply) => Promise<T>
): (request: FastifyRequest, reply: FastifyReply) => Promise<T | VorionErrorResponse> {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<T | VorionErrorResponse> => {
    try {
      return await handler(request, reply);
    } catch (error) {
      const config = getConfig();
      const { response, statusCode } = createErrorResponse(
        error,
        request.id || 'unknown',
        config.env === 'production'
      );

      reply.status(statusCode);
      return response;
    }
  };
}
