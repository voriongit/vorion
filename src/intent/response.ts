/**
 * Standardized API Response Envelope for INTENT Module
 *
 * Provides consistent API response formatting for better client integration.
 * Includes success/error envelopes, pagination, and trace context support.
 *
 * @packageDocumentation
 */

import { randomUUID } from 'node:crypto';
import { getTraceContext } from '../common/trace.js';
import { getConfig } from '../common/config.js';
import {
  VorionError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  RateLimitError,
  ConfigurationError,
  DatabaseError,
  ExternalServiceError,
  TimeoutError,
  isVorionError,
} from '../common/errors.js';

/**
 * Standard HTTP status codes used in API responses
 */
export const HttpStatus = {
  // Success
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,

  // Client errors
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,

  // Server errors
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

export type HttpStatusCode = (typeof HttpStatus)[keyof typeof HttpStatus];

/**
 * Error information in the response envelope
 */
export interface ApiError {
  /** Machine-readable error code */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Additional error details for debugging */
  details?: Record<string, unknown>;
  /** Trace ID for distributed tracing correlation */
  traceId?: string;
}

/**
 * Pagination information for list responses
 */
export interface PaginationInfo {
  /** Current page number (1-indexed) */
  page: number;
  /** Number of items per page */
  pageSize: number;
  /** Total number of items across all pages */
  totalItems: number;
  /** Total number of pages */
  totalPages: number;
}

/**
 * Cursor-based pagination information
 */
export interface CursorPaginationInfo {
  /** Cursor for the next page */
  nextCursor?: string | undefined;
  /** Cursor for the previous page */
  prevCursor?: string | undefined;
  /** Whether there are more items */
  hasMore: boolean;
  /** Number of items returned */
  count: number;
}

/**
 * Response metadata
 */
export interface ResponseMeta {
  /** Unique request identifier for tracking */
  requestId: string;
  /** ISO 8601 timestamp when response was generated */
  timestamp: string;
  /** Page-based pagination information */
  pagination?: PaginationInfo;
  /** Cursor-based pagination information */
  cursor?: CursorPaginationInfo;
}

/**
 * Standard API response envelope
 *
 * @typeParam T - The type of the response data
 */
export interface ApiResponse<T> {
  /** Whether the request was successful */
  success: boolean;
  /** Response data (present on success) */
  data?: T;
  /** Error information (present on failure) */
  error?: ApiError;
  /** Response metadata */
  meta?: ResponseMeta;
}

/**
 * Options for creating response metadata
 */
export interface MetaOptions {
  /** Custom request ID (generated if not provided) */
  requestId?: string | undefined;
  /** Page-based pagination info */
  pagination?: PaginationInfo | undefined;
  /** Cursor-based pagination info */
  cursor?: CursorPaginationInfo | undefined;
}

/**
 * Options for paginated responses
 */
export interface PaginatedOptions {
  /** Current page number */
  page: number;
  /** Items per page */
  pageSize: number;
  /** Total items count */
  totalItems: number;
  /** Custom request ID */
  requestId?: string | undefined;
}

/**
 * Options for cursor-based paginated responses
 */
export interface CursorPaginatedOptions {
  /** Next page cursor */
  nextCursor?: string | undefined;
  /** Previous page cursor */
  prevCursor?: string | undefined;
  /** Whether more items exist */
  hasMore: boolean;
  /** Custom request ID */
  requestId?: string | undefined;
}

/**
 * Generate response metadata
 */
function createMeta(options?: MetaOptions): ResponseMeta {
  const meta: ResponseMeta = {
    requestId: options?.requestId ?? randomUUID(),
    timestamp: new Date().toISOString(),
  };

  if (options?.pagination) {
    meta.pagination = options.pagination;
  }

  if (options?.cursor) {
    meta.cursor = options.cursor;
  }

  return meta;
}

/**
 * Get trace ID from current context or generate a new one
 */
function getOrCreateTraceId(): string | undefined {
  const traceContext = getTraceContext();
  return traceContext?.traceId;
}

/**
 * Create a successful API response
 *
 * @typeParam T - The type of the response data
 * @param data - The response data
 * @param options - Optional metadata configuration
 * @returns Standardized success response
 *
 * @example
 * ```typescript
 * const response = successResponse({ id: '123', name: 'Test' });
 * // { success: true, data: { id: '123', name: 'Test' }, meta: { requestId: '...', timestamp: '...' } }
 * ```
 */
export function successResponse<T>(data: T, options?: MetaOptions): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: createMeta(options),
  };
}

/**
 * Create an error API response
 *
 * @param code - Machine-readable error code
 * @param message - Human-readable error message
 * @param details - Additional error details
 * @param requestId - Optional request ID for tracking
 * @returns Standardized error response
 *
 * @example
 * ```typescript
 * const response = errorResponse('VALIDATION_ERROR', 'Invalid input', { field: 'email' });
 * // { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: {...}, traceId: '...' }, meta: {...} }
 * ```
 */
export function errorResponse(
  code: string,
  message: string,
  details?: Record<string, unknown>,
  requestId?: string
): ApiResponse<never> {
  const config = getConfig();
  const traceId = getOrCreateTraceId();

  const error: ApiError = {
    code,
    message,
  };

  // Include details in non-production environments or if explicitly allowed
  if (details && config.env !== 'production') {
    error.details = details;
  }

  if (traceId) {
    error.traceId = traceId;
  }

  return {
    success: false,
    error,
    meta: createMeta({ requestId }),
  };
}

/**
 * Create a paginated API response (page-based)
 *
 * @typeParam T - The type of items in the response
 * @param items - Array of items for the current page
 * @param options - Pagination options including page, pageSize, and totalItems
 * @returns Standardized paginated response
 *
 * @example
 * ```typescript
 * const response = paginatedResponse(items, { page: 1, pageSize: 20, totalItems: 100 });
 * // { success: true, data: [...], meta: { pagination: { page: 1, pageSize: 20, totalItems: 100, totalPages: 5 }, ... } }
 * ```
 */
export function paginatedResponse<T>(
  items: T[],
  options: PaginatedOptions
): ApiResponse<T[]> {
  const totalPages = Math.ceil(options.totalItems / options.pageSize);

  return {
    success: true,
    data: items,
    meta: createMeta({
      requestId: options.requestId,
      pagination: {
        page: options.page,
        pageSize: options.pageSize,
        totalItems: options.totalItems,
        totalPages,
      },
    }),
  };
}

/**
 * Create a cursor-based paginated API response
 *
 * @typeParam T - The type of items in the response
 * @param items - Array of items for the current page
 * @param options - Cursor pagination options
 * @returns Standardized cursor-paginated response
 *
 * @example
 * ```typescript
 * const response = cursorPaginatedResponse(items, { nextCursor: 'abc123', hasMore: true });
 * // { success: true, data: [...], meta: { cursor: { nextCursor: 'abc123', hasMore: true, count: 10 }, ... } }
 * ```
 */
export function cursorPaginatedResponse<T>(
  items: T[],
  options: CursorPaginatedOptions
): ApiResponse<T[]> {
  const cursor: CursorPaginationInfo = {
    hasMore: options.hasMore,
    count: items.length,
  };

  if (options.nextCursor) {
    cursor.nextCursor = options.nextCursor;
  }

  if (options.prevCursor) {
    cursor.prevCursor = options.prevCursor;
  }

  return {
    success: true,
    data: items,
    meta: createMeta({
      requestId: options.requestId,
      cursor,
    }),
  };
}

/**
 * Create a "created" response (HTTP 201)
 *
 * @typeParam T - The type of the created resource
 * @param data - The created resource data
 * @param options - Optional metadata configuration
 * @returns Standardized success response for created resources
 */
export function createdResponse<T>(data: T, options?: MetaOptions): ApiResponse<T> {
  return successResponse(data, options);
}

/**
 * Create an "accepted" response (HTTP 202) for async operations
 *
 * @typeParam T - The type of the response data
 * @param data - Optional response data (e.g., tracking information)
 * @param options - Optional metadata configuration
 * @returns Standardized success response for accepted requests
 */
export function acceptedResponse<T>(data?: T, options?: MetaOptions): ApiResponse<T | undefined> {
  return {
    success: true,
    data,
    meta: createMeta(options),
  };
}

/**
 * Map VorionError to appropriate HTTP status code
 *
 * @param error - The VorionError instance
 * @returns HTTP status code
 */
export function getHttpStatusFromError(error: VorionError): HttpStatusCode {
  // Use the error's statusCode if available
  if (error.statusCode) {
    return error.statusCode as HttpStatusCode;
  }

  // Fallback based on error type
  if (error instanceof ValidationError) return HttpStatus.BAD_REQUEST;
  if (error instanceof NotFoundError) return HttpStatus.NOT_FOUND;
  if (error instanceof UnauthorizedError) return HttpStatus.UNAUTHORIZED;
  if (error instanceof ForbiddenError) return HttpStatus.FORBIDDEN;
  if (error instanceof ConflictError) return HttpStatus.CONFLICT;
  if (error instanceof RateLimitError) return HttpStatus.TOO_MANY_REQUESTS;
  if (error instanceof ConfigurationError) return HttpStatus.INTERNAL_SERVER_ERROR;
  if (error instanceof DatabaseError) return HttpStatus.INTERNAL_SERVER_ERROR;
  if (error instanceof ExternalServiceError) return HttpStatus.BAD_GATEWAY;
  if (error instanceof TimeoutError) return HttpStatus.GATEWAY_TIMEOUT;

  return HttpStatus.INTERNAL_SERVER_ERROR;
}

/**
 * Map error code to HTTP status code
 *
 * @param code - The error code string
 * @returns HTTP status code
 */
export function getHttpStatusFromCode(code: string): HttpStatusCode {
  const codeMap: Record<string, HttpStatusCode> = {
    // Validation errors
    VALIDATION_ERROR: HttpStatus.BAD_REQUEST,
    INVALID_INPUT: HttpStatus.BAD_REQUEST,
    INVALID_STATE_TRANSITION: HttpStatus.BAD_REQUEST,
    INVALID_STATE: HttpStatus.BAD_REQUEST,
    POLICY_VALIDATION_ERROR: HttpStatus.BAD_REQUEST,
    ESCALATION_ERROR: HttpStatus.BAD_REQUEST,

    // Authentication errors
    UNAUTHORIZED: HttpStatus.UNAUTHORIZED,
    TOKEN_INVALID: HttpStatus.UNAUTHORIZED,
    TOKEN_REVOKED: HttpStatus.UNAUTHORIZED,
    TOKEN_EXPIRED: HttpStatus.UNAUTHORIZED,

    // Authorization errors
    FORBIDDEN: HttpStatus.FORBIDDEN,
    TRUST_INSUFFICIENT: HttpStatus.FORBIDDEN,

    // Not found errors
    NOT_FOUND: HttpStatus.NOT_FOUND,
    INTENT_NOT_FOUND: HttpStatus.NOT_FOUND,
    ESCALATION_NOT_FOUND: HttpStatus.NOT_FOUND,
    POLICY_NOT_FOUND: HttpStatus.NOT_FOUND,
    AUDIT_RECORD_NOT_FOUND: HttpStatus.NOT_FOUND,
    WEBHOOK_NOT_FOUND: HttpStatus.NOT_FOUND,
    JOB_NOT_FOUND: HttpStatus.NOT_FOUND,
    APPROVER_NOT_FOUND: HttpStatus.NOT_FOUND,

    // Conflict errors
    CONFLICT: HttpStatus.CONFLICT,
    INTENT_LOCKED: HttpStatus.CONFLICT,
    POLICY_NOT_DRAFT: HttpStatus.CONFLICT,

    // Rate limit errors
    RATE_LIMIT_EXCEEDED: HttpStatus.TOO_MANY_REQUESTS,
    INTENT_RATE_LIMIT: HttpStatus.TOO_MANY_REQUESTS,

    // Server errors
    INTERNAL_ERROR: HttpStatus.INTERNAL_SERVER_ERROR,
    VORION_ERROR: HttpStatus.INTERNAL_SERVER_ERROR,
    DATABASE_ERROR: HttpStatus.INTERNAL_SERVER_ERROR,
    CONFIGURATION_ERROR: HttpStatus.INTERNAL_SERVER_ERROR,
    ENCRYPTION_ERROR: HttpStatus.INTERNAL_SERVER_ERROR,
    ENQUEUE_FAILED: HttpStatus.INTERNAL_SERVER_ERROR,

    // External service errors
    EXTERNAL_SERVICE_ERROR: HttpStatus.BAD_GATEWAY,

    // Timeout errors
    TIMEOUT: HttpStatus.GATEWAY_TIMEOUT,
  };

  return codeMap[code] ?? HttpStatus.INTERNAL_SERVER_ERROR;
}

/**
 * Create an error response from a VorionError
 *
 * @param error - The VorionError instance
 * @param requestId - Optional request ID for tracking
 * @returns Standardized error response
 */
export function errorResponseFromVorionError(
  error: VorionError,
  requestId?: string
): ApiResponse<never> {
  const config = getConfig();
  const traceId = getOrCreateTraceId();

  const apiError: ApiError = {
    code: error.code,
    message: config.env === 'production' ? sanitizeErrorMessage(error.message) : error.message,
  };

  // Include details in non-production or if error explicitly provides them
  if (error.details && config.env !== 'production') {
    apiError.details = error.details;
  }

  if (traceId) {
    apiError.traceId = traceId;
  }

  return {
    success: false,
    error: apiError,
    meta: createMeta({ requestId }),
  };
}

/**
 * Create an error response from any error (including non-VorionError)
 *
 * @param error - The error (VorionError or standard Error)
 * @param requestId - Optional request ID for tracking
 * @returns Standardized error response with appropriate HTTP status
 */
export function errorResponseFromError(
  error: unknown,
  requestId?: string
): { response: ApiResponse<never>; status: HttpStatusCode } {
  if (isVorionError(error)) {
    return {
      response: errorResponseFromVorionError(error, requestId),
      status: getHttpStatusFromError(error),
    };
  }

  const config = getConfig();
  const traceId = getOrCreateTraceId();
  const message = error instanceof Error ? error.message : 'An unexpected error occurred';

  const apiError: ApiError = {
    code: 'INTERNAL_ERROR',
    message: config.env === 'production' ? 'An unexpected error occurred' : message,
  };

  if (traceId) {
    apiError.traceId = traceId;
  }

  return {
    response: {
      success: false,
      error: apiError,
      meta: createMeta({ requestId }),
    },
    status: HttpStatus.INTERNAL_SERVER_ERROR,
  };
}

/**
 * Sanitize error message for production
 * Removes potentially sensitive information from error messages
 *
 * @param message - The original error message
 * @returns Sanitized message safe for production
 */
function sanitizeErrorMessage(message: string): string {
  // List of patterns that might leak sensitive information
  const sensitivePatterns = [
    /password/i,
    /secret/i,
    /token/i,
    /key/i,
    /credential/i,
    /connection string/i,
    /database.*error/i,
    /sql.*error/i,
    /internal.*error/i,
  ];

  for (const pattern of sensitivePatterns) {
    if (pattern.test(message)) {
      return 'An error occurred while processing your request';
    }
  }

  // Remove stack traces if present
  const stackTraceIndex = message.indexOf('\n    at ');
  if (stackTraceIndex !== -1) {
    return message.substring(0, stackTraceIndex);
  }

  return message;
}

/**
 * Type guard to check if a response is successful
 *
 * @param response - The API response to check
 * @returns True if the response indicates success
 */
export function isSuccessResponse<T>(
  response: ApiResponse<T>
): response is ApiResponse<T> & { success: true; data: T } {
  return response.success === true && response.data !== undefined;
}

/**
 * Type guard to check if a response is an error
 *
 * @param response - The API response to check
 * @returns True if the response indicates an error
 */
export function isErrorResponse<T>(
  response: ApiResponse<T>
): response is ApiResponse<T> & { success: false; error: ApiError } {
  return response.success === false && response.error !== undefined;
}
