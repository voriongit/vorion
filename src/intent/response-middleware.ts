/**
 * Response Middleware for Standardized API Envelopes
 *
 * Provides Fastify hooks and helpers for wrapping responses in the standard
 * API envelope format, adding request context, and handling errors consistently.
 *
 * @packageDocumentation
 */

import type { FastifyInstance, FastifyRequest, FastifyReply, FastifyError } from 'fastify';
import { randomUUID } from 'node:crypto';
import { getTraceContext, type TraceContext } from '../common/trace.js';
import { getConfig } from '../common/config.js';
import { createLogger } from '../common/logger.js';
import {
  isVorionError,
  RateLimitError,
} from '../common/errors.js';
import {
  errorResponseFromError,
  errorResponse,
  type ApiResponse,
  type ResponseMeta,
  type HttpStatusCode,
  HttpStatus,
} from './response.js';
import { ZodError } from 'zod';

const logger = createLogger({ component: 'response-middleware' });

/** Header name for request ID tracking */
export const REQUEST_ID_HEADER = 'X-Request-ID';

/**
 * Extended request interface with trace context
 */
declare module 'fastify' {
  interface FastifyRequest {
    traceContext?: TraceContext;
  }
}

/**
 * Response context stored on request for middleware use
 */
export interface ResponseContext {
  /** Unique request identifier */
  requestId: string;
  /** Trace ID from distributed tracing context */
  traceId?: string | undefined;
  /** Request start time for duration tracking */
  startTime: number;
}

/**
 * Augment FastifyRequest with response context
 */
declare module 'fastify' {
  interface FastifyRequest {
    responseContext?: ResponseContext;
  }
}

/**
 * Register response middleware hooks on a Fastify instance
 *
 * This middleware:
 * 1. Adds request/trace context to each request
 * 2. Provides a standardized error handler
 * 3. Optionally wraps all responses in the standard envelope
 *
 * @param server - The Fastify instance
 * @param options - Middleware configuration options
 *
 * @example
 * ```typescript
 * const server = Fastify();
 * registerResponseMiddleware(server, { wrapAllResponses: false });
 * ```
 */
export function registerResponseMiddleware(
  server: FastifyInstance,
  options?: {
    /** Whether to automatically wrap all responses in the envelope (default: false) */
    wrapAllResponses?: boolean;
  }
): void {
  const config = getConfig();

  // Decorate request with responseContext
  server.decorateRequest('responseContext', null);

  // Add response context to each request and set X-Request-ID header
  server.addHook('onRequest', async (request, reply) => {
    const traceContext = getTraceContext() ?? request.traceContext;
    // Use incoming request ID or generate a new one
    const requestId = (request.headers[REQUEST_ID_HEADER.toLowerCase()] as string) ?? randomUUID();

    request.responseContext = {
      requestId,
      traceId: traceContext?.traceId,
      startTime: Date.now(),
    };

    // Always set X-Request-ID header in response
    reply.header(REQUEST_ID_HEADER, requestId);
  });

  // Optionally wrap all responses in standard envelope
  if (options?.wrapAllResponses) {
    server.addHook('onSend', async (request, _reply, payload) => {
      // Skip if already an API response or if it's not JSON
      if (typeof payload !== 'string') {
        return payload;
      }

      try {
        const parsed = JSON.parse(payload);

        // Skip if already in envelope format
        if ('success' in parsed && 'meta' in parsed) {
          return payload;
        }

        // Skip health/metrics endpoints
        if (request.url === '/health' || request.url === '/ready' || request.url === '/metrics') {
          return payload;
        }

        // Wrap in envelope
        const envelope: ApiResponse<unknown> = {
          success: true,
          data: parsed,
          meta: {
            requestId: request.responseContext?.requestId ?? randomUUID(),
            timestamp: new Date().toISOString(),
          },
        };

        return JSON.stringify(envelope);
      } catch {
        // Not JSON, return as-is
        return payload;
      }
    });
  }

  // Register the standardized error handler
  server.setErrorHandler(createStandardErrorHandler(config.env));
}

/**
 * Create a standardized error handler for Fastify
 *
 * @param env - The environment (development, staging, production)
 * @returns Fastify error handler function
 */
export function createStandardErrorHandler(
  env: string
): (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    const requestId = request.responseContext?.requestId ?? request.id;
    const traceId = request.responseContext?.traceId ?? request.traceContext?.traceId;

    // Handle Zod validation errors
    if (error instanceof ZodError) {
      const validationErrors = error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
        code: e.code,
      }));

      const response = errorResponse(
        'VALIDATION_ERROR',
        'Request validation failed',
        env !== 'production' ? { errors: validationErrors } : undefined,
        requestId
      );

      if (traceId && response.error) {
        response.error.traceId = traceId;
      }

      logger.warn(
        {
          requestId,
          traceId,
          validationErrors,
          url: request.url,
          method: request.method,
        },
        'Validation error'
      );

      return reply.status(HttpStatus.BAD_REQUEST).send(response);
    }

    // Handle VorionError instances
    if (isVorionError(error)) {
      const { response, status } = errorResponseFromError(error, requestId);

      if (traceId && response.error) {
        response.error.traceId = traceId;
      }

      const logLevel = status >= 500 ? 'error' : 'warn';
      logger[logLevel](
        {
          requestId,
          traceId,
          errorCode: error.code,
          errorName: error.name,
          statusCode: status,
          details: error.details,
          url: request.url,
          method: request.method,
        },
        error.message
      );

      // Add Retry-After header for rate limit errors
      if (error instanceof RateLimitError && error.retryAfter !== undefined) {
        reply.header('Retry-After', error.retryAfter.toString());
      }

      return reply.status(status).send(response);
    }

    // Handle generic Fastify/HTTP errors
    let status: HttpStatusCode = (error.statusCode as HttpStatusCode) ?? HttpStatus.INTERNAL_SERVER_ERROR;
    let code = error.code ?? 'INTERNAL_ERROR';
    let message = error.message;

    // Map specific error codes
    if (code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER') {
      status = HttpStatus.UNAUTHORIZED;
      code = 'UNAUTHORIZED';
      message = 'Authorization header is missing';
    } else if (code === 'FST_JWT_AUTHORIZATION_TOKEN_INVALID') {
      status = HttpStatus.UNAUTHORIZED;
      code = 'TOKEN_INVALID';
      message = 'Invalid authorization token';
    } else if (code === 'FST_JWT_AUTHORIZATION_TOKEN_EXPIRED') {
      status = HttpStatus.UNAUTHORIZED;
      code = 'TOKEN_EXPIRED';
      message = 'Authorization token has expired';
    } else if (error.statusCode === 429) {
      status = HttpStatus.TOO_MANY_REQUESTS;
      code = 'RATE_LIMIT_EXCEEDED';
      message = 'Too many requests, please try again later';
    }

    // Sanitize message for production
    if (env === 'production' && status >= 500) {
      message = 'An unexpected error occurred';
    }

    const response = errorResponse(code, message, undefined, requestId);

    if (traceId && response.error) {
      response.error.traceId = traceId;
    }

    const logLevel = status >= 500 ? 'error' : 'warn';
    logger[logLevel](
      {
        requestId,
        traceId,
        errorCode: code,
        statusCode: status,
        stack: env !== 'production' ? error.stack : undefined,
        url: request.url,
        method: request.method,
      },
      message
    );

    return reply.status(status).send(response);
  };
}

/**
 * Helper to send a standardized success response
 *
 * @param reply - Fastify reply object
 * @param data - Response data
 * @param status - HTTP status code (default: 200)
 * @param request - Optional request for context
 */
export function sendSuccess<T>(
  reply: FastifyReply,
  data: T,
  status: HttpStatusCode = HttpStatus.OK,
  request?: FastifyRequest
): FastifyReply {
  const requestId = request?.responseContext?.requestId ?? randomUUID();
  const traceId = request?.responseContext?.traceId ?? request?.traceContext?.traceId;

  const meta: ResponseMeta & { traceId?: string } = {
    requestId,
    timestamp: new Date().toISOString(),
  };

  // Add trace ID to meta if available (for debugging correlation)
  if (traceId) {
    meta.traceId = traceId;
  }

  const response: ApiResponse<T> = {
    success: true,
    data,
    meta,
  };

  return reply.status(status).send(response);
}

/**
 * Helper to send a standardized error response
 *
 * @param reply - Fastify reply object
 * @param code - Error code
 * @param message - Error message
 * @param status - HTTP status code
 * @param details - Optional error details
 * @param request - Optional request for context
 */
export function sendError(
  reply: FastifyReply,
  code: string,
  message: string,
  status: HttpStatusCode,
  details?: Record<string, unknown>,
  request?: FastifyRequest
): FastifyReply {
  const config = getConfig();
  const requestId = request?.responseContext?.requestId ?? randomUUID();
  const traceId = request?.responseContext?.traceId ?? request?.traceContext?.traceId;

  const response = errorResponse(
    code,
    config.env === 'production' && status >= 500 ? 'An unexpected error occurred' : message,
    config.env !== 'production' ? details : undefined,
    requestId
  );

  if (traceId && response.error) {
    response.error.traceId = traceId;
  }

  return reply.status(status).send(response);
}

/**
 * Helper to send a paginated response
 *
 * @param reply - Fastify reply object
 * @param items - Array of items
 * @param pagination - Pagination information
 * @param request - Optional request for context
 */
export function sendPaginated<T>(
  reply: FastifyReply,
  items: T[],
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
  },
  request?: FastifyRequest
): FastifyReply {
  const requestId = request?.responseContext?.requestId ?? randomUUID();
  const totalPages = Math.ceil(pagination.totalItems / pagination.pageSize);

  const response: ApiResponse<T[]> = {
    success: true,
    data: items,
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        totalItems: pagination.totalItems,
        totalPages,
      },
    },
  };

  return reply.status(HttpStatus.OK).send(response);
}

/**
 * Helper to send a cursor-paginated response
 *
 * @param reply - Fastify reply object
 * @param items - Array of items
 * @param cursor - Cursor pagination info
 * @param request - Optional request for context
 */
export function sendCursorPaginated<T>(
  reply: FastifyReply,
  items: T[],
  cursor: {
    nextCursor?: string | undefined;
    prevCursor?: string | undefined;
    hasMore: boolean;
  },
  request?: FastifyRequest
): FastifyReply {
  const requestId = request?.responseContext?.requestId ?? randomUUID();

  const response: ApiResponse<T[]> = {
    success: true,
    data: items,
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
      cursor: {
        ...cursor,
        count: items.length,
      },
    },
  };

  return reply.status(HttpStatus.OK).send(response);
}

/**
 * Helper to send a "not found" error response
 *
 * @param reply - Fastify reply object
 * @param resourceType - Type of resource that was not found
 * @param request - Optional request for context
 */
export function sendNotFound(
  reply: FastifyReply,
  resourceType: string,
  request?: FastifyRequest
): FastifyReply {
  return sendError(
    reply,
    `${resourceType.toUpperCase().replace(/\s+/g, '_')}_NOT_FOUND`,
    `${resourceType} not found`,
    HttpStatus.NOT_FOUND,
    undefined,
    request
  );
}

/**
 * Helper to send a validation error response
 *
 * @param reply - Fastify reply object
 * @param message - Validation error message
 * @param errors - Validation error details
 * @param request - Optional request for context
 */
export function sendValidationError(
  reply: FastifyReply,
  message: string,
  errors?: Record<string, unknown>,
  request?: FastifyRequest
): FastifyReply {
  return sendError(
    reply,
    'VALIDATION_ERROR',
    message,
    HttpStatus.BAD_REQUEST,
    errors,
    request
  );
}

/**
 * Helper to send a forbidden error response
 *
 * @param reply - Fastify reply object
 * @param message - Forbidden error message
 * @param request - Optional request for context
 */
export function sendForbidden(
  reply: FastifyReply,
  message = 'You do not have permission to perform this action',
  request?: FastifyRequest
): FastifyReply {
  return sendError(
    reply,
    'FORBIDDEN',
    message,
    HttpStatus.FORBIDDEN,
    undefined,
    request
  );
}

/**
 * Helper to send an unauthorized error response
 *
 * @param reply - Fastify reply object
 * @param message - Unauthorized error message
 * @param request - Optional request for context
 */
export function sendUnauthorized(
  reply: FastifyReply,
  message = 'Authentication required',
  request?: FastifyRequest
): FastifyReply {
  return sendError(
    reply,
    'UNAUTHORIZED',
    message,
    HttpStatus.UNAUTHORIZED,
    undefined,
    request
  );
}

/**
 * Helper to send a conflict error response
 *
 * @param reply - Fastify reply object
 * @param message - Conflict error message
 * @param request - Optional request for context
 */
export function sendConflict(
  reply: FastifyReply,
  message: string,
  request?: FastifyRequest
): FastifyReply {
  return sendError(
    reply,
    'CONFLICT',
    message,
    HttpStatus.CONFLICT,
    undefined,
    request
  );
}
