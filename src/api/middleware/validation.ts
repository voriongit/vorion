/**
 * API Input Validation Middleware
 *
 * Provides Zod-based validation middleware for Fastify routes with
 * OpenTelemetry tracing, detailed error responses, and security features.
 *
 * @packageDocumentation
 */

import type { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { z, ZodError, ZodSchema, ZodIssue } from 'zod';
import { trace, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { createLogger } from '../../common/logger.js';
import { getTraceContext } from '../../common/trace.js';
import {
  sanitizeObject,
  checkInjectionPatterns,
  validatePayloadSize,
  ValidationError as CommonValidationError,
} from '../../common/validation.js';
import type { VorionErrorResponse } from '../../common/contracts/output.js';

const logger = createLogger({ component: 'api-validation' });
const tracer = trace.getTracer('vorion-api-validation');

/**
 * Validation error details for API responses
 */
export interface ValidationErrorDetail {
  /** JSON path to the invalid field */
  path: string;
  /** Human-readable error message */
  message: string;
  /** Zod error code */
  code: string;
  /** Expected type or value */
  expected?: string;
  /** Received value type */
  received?: string;
}

/**
 * Validation middleware options
 */
export interface ValidationOptions {
  /** Maximum payload size in bytes (default: 1MB) */
  maxPayloadSize?: number;
  /** Check for injection patterns (default: true) */
  checkInjection?: boolean;
  /** Sanitize input strings (default: true) */
  sanitize?: boolean;
  /** Strip unknown properties (default: true) */
  stripUnknown?: boolean;
  /** Custom error message for validation failures */
  customErrorMessage?: string;
  /** Skip validation for certain paths */
  skipPaths?: string[];
}

/**
 * Default validation options
 */
const DEFAULT_OPTIONS: Required<Omit<ValidationOptions, 'customErrorMessage' | 'skipPaths'>> = {
  maxPayloadSize: 1048576, // 1MB
  checkInjection: true,
  sanitize: true,
  stripUnknown: true,
};

/**
 * Format Zod errors into detailed validation error response
 */
function formatZodErrors(error: ZodError): ValidationErrorDetail[] {
  return error.errors.map((err: ZodIssue) => {
    const detail: ValidationErrorDetail = {
      path: err.path.join('.') || '(root)',
      message: err.message,
      code: err.code,
    };

    // Add type information for type errors
    if (err.code === 'invalid_type') {
      const typeErr = err as z.ZodInvalidTypeIssue;
      detail.expected = typeErr.expected;
      detail.received = typeErr.received;
    }

    return detail;
  });
}

/**
 * Create validation error response conforming to VorionErrorResponse
 */
function createValidationErrorResponse(
  errors: ValidationErrorDetail[],
  requestId: string,
  customMessage?: string
): VorionErrorResponse {
  return {
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: customMessage ?? 'Request validation failed',
      details: { errors },
    },
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Recursively check object for injection patterns
 */
function checkObjectForInjection(obj: Record<string, unknown>, path = ''): string | null {
  for (const [key, value] of Object.entries(obj)) {
    const fieldPath = path ? `${path}.${key}` : key;

    if (typeof value === 'string' && checkInjectionPatterns(value)) {
      return fieldPath;
    }

    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        if (typeof item === 'string' && checkInjectionPatterns(item)) {
          return `${fieldPath}[${i}]`;
        }
        if (typeof item === 'object' && item !== null) {
          const result = checkObjectForInjection(item as Record<string, unknown>, `${fieldPath}[${i}]`);
          if (result) return result;
        }
      }
    }

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const result = checkObjectForInjection(value as Record<string, unknown>, fieldPath);
      if (result) return result;
    }
  }

  return null;
}

/**
 * Create validation middleware for request body
 *
 * @param schema - Zod schema to validate against
 * @param options - Validation options
 * @returns Fastify preHandler hook
 *
 * @example
 * ```typescript
 * const createUserSchema = z.object({
 *   name: z.string().min(1).max(100),
 *   email: z.string().email(),
 * });
 *
 * server.post('/users', {
 *   preHandler: validateBody(createUserSchema),
 * }, handler);
 * ```
 */
export function validateBody<T extends ZodSchema>(
  schema: T,
  options: ValidationOptions = {}
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const requestId = request.id || 'unknown';
    const traceContext = getTraceContext();

    return tracer.startActiveSpan(
      'validation.body',
      {
        kind: SpanKind.INTERNAL,
        attributes: {
          'validation.type': 'body',
          'request.id': requestId,
          'request.path': request.url,
          ...(traceContext && { 'trace.id': traceContext.traceId }),
        },
      },
      async (span) => {
        try {
          const body = request.body;

          // Check if body exists
          if (body === undefined || body === null) {
            span.setStatus({ code: SpanStatusCode.ERROR, message: 'Missing request body' });
            span.end();

            const response = createValidationErrorResponse(
              [{ path: '(root)', message: 'Request body is required', code: 'missing_body' }],
              requestId,
              opts.customErrorMessage
            );

            reply.status(400).send(response);
            return;
          }

          // Check payload size
          if (opts.maxPayloadSize) {
            try {
              validatePayloadSize(body, opts.maxPayloadSize);
            } catch (error) {
              span.setStatus({ code: SpanStatusCode.ERROR, message: 'Payload too large' });
              span.setAttribute('validation.error', 'payload_too_large');
              span.end();

              const response = createValidationErrorResponse(
                [{
                  path: '(root)',
                  message: `Payload size exceeds maximum of ${opts.maxPayloadSize} bytes`,
                  code: 'payload_too_large',
                }],
                requestId,
                'Request payload too large'
              );

              reply.status(413).send(response);
              return;
            }
          }

          // Sanitize if enabled
          let sanitized = body;
          if (opts.sanitize && typeof body === 'object' && body !== null) {
            sanitized = sanitizeObject(body as Record<string, unknown>);
            span.setAttribute('validation.sanitized', true);
          }

          // Check for injection patterns
          if (opts.checkInjection && typeof sanitized === 'object' && sanitized !== null) {
            const injectionPath = checkObjectForInjection(sanitized as Record<string, unknown>);
            if (injectionPath) {
              span.setStatus({ code: SpanStatusCode.ERROR, message: 'Injection detected' });
              span.setAttribute('validation.error', 'injection_detected');
              span.setAttribute('validation.injection_path', injectionPath);
              span.end();

              logger.warn(
                { requestId, path: injectionPath, url: request.url },
                'Potential injection attack detected'
              );

              const response = createValidationErrorResponse(
                [{
                  path: injectionPath,
                  message: 'Potentially dangerous pattern detected',
                  code: 'injection_detected',
                }],
                requestId,
                'Request contains potentially dangerous content'
              );

              reply.status(400).send(response);
              return;
            }
          }

          // Validate with schema
          const result = schema.safeParse(sanitized);

          if (!result.success) {
            const errors = formatZodErrors(result.error);

            span.setStatus({ code: SpanStatusCode.ERROR, message: 'Validation failed' });
            span.setAttribute('validation.error_count', errors.length);
            span.end();

            logger.warn(
              { requestId, errors, path: request.url },
              'Request body validation failed'
            );

            const response = createValidationErrorResponse(errors, requestId, opts.customErrorMessage);
            reply.status(400).send(response);
            return;
          }

          // Replace body with validated/sanitized version
          (request as { body: z.infer<T> }).body = result.data;

          span.setStatus({ code: SpanStatusCode.OK });
          span.setAttribute('validation.success', true);
          span.end();
        } catch (error) {
          span.setStatus({ code: SpanStatusCode.ERROR, message: 'Validation error' });
          span.recordException(error as Error);
          span.end();

          if (error instanceof CommonValidationError) {
            const response = createValidationErrorResponse(
              [{ path: error.field ?? '(unknown)', message: error.message, code: error.code }],
              requestId
            );
            reply.status(400).send(response);
            return;
          }

          throw error;
        }
      }
    );
  };
}

/**
 * Create validation middleware for query parameters
 *
 * @param schema - Zod schema to validate against
 * @returns Fastify preHandler hook
 *
 * @example
 * ```typescript
 * const listQuerySchema = z.object({
 *   page: z.coerce.number().int().min(1).default(1),
 *   limit: z.coerce.number().int().min(1).max(100).default(20),
 * });
 *
 * server.get('/users', {
 *   preHandler: validateQuery(listQuerySchema),
 * }, handler);
 * ```
 */
export function validateQuery<T extends ZodSchema>(
  schema: T
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const requestId = request.id || 'unknown';

    return tracer.startActiveSpan(
      'validation.query',
      {
        kind: SpanKind.INTERNAL,
        attributes: {
          'validation.type': 'query',
          'request.id': requestId,
          'request.path': request.url,
        },
      },
      async (span) => {
        const result = schema.safeParse(request.query);

        if (!result.success) {
          const errors = formatZodErrors(result.error);

          span.setStatus({ code: SpanStatusCode.ERROR, message: 'Query validation failed' });
          span.setAttribute('validation.error_count', errors.length);
          span.end();

          logger.warn(
            { requestId, errors, path: request.url },
            'Query parameter validation failed'
          );

          const response = createValidationErrorResponse(
            errors,
            requestId,
            'Invalid query parameters'
          );
          reply.status(400).send(response);
          return;
        }

        // Replace query with validated version
        (request as { query: z.infer<T> }).query = result.data;

        span.setStatus({ code: SpanStatusCode.OK });
        span.setAttribute('validation.success', true);
        span.end();
      }
    );
  };
}

/**
 * Create validation middleware for path parameters
 *
 * @param schema - Zod schema to validate against
 * @returns Fastify preHandler hook
 *
 * @example
 * ```typescript
 * const idParamSchema = z.object({
 *   id: z.string().uuid(),
 * });
 *
 * server.get('/users/:id', {
 *   preHandler: validateParams(idParamSchema),
 * }, handler);
 * ```
 */
export function validateParams<T extends ZodSchema>(
  schema: T
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const requestId = request.id || 'unknown';

    return tracer.startActiveSpan(
      'validation.params',
      {
        kind: SpanKind.INTERNAL,
        attributes: {
          'validation.type': 'params',
          'request.id': requestId,
          'request.path': request.url,
        },
      },
      async (span) => {
        const result = schema.safeParse(request.params);

        if (!result.success) {
          const errors = formatZodErrors(result.error);

          span.setStatus({ code: SpanStatusCode.ERROR, message: 'Params validation failed' });
          span.setAttribute('validation.error_count', errors.length);
          span.end();

          logger.warn(
            { requestId, errors, path: request.url },
            'Path parameter validation failed'
          );

          const response = createValidationErrorResponse(
            errors,
            requestId,
            'Invalid path parameters'
          );
          reply.status(400).send(response);
          return;
        }

        // Replace params with validated version
        (request as { params: z.infer<T> }).params = result.data;

        span.setStatus({ code: SpanStatusCode.OK });
        span.setAttribute('validation.success', true);
        span.end();
      }
    );
  };
}

/**
 * Create combined validation middleware for body, query, and params
 *
 * @param schemas - Object containing schemas for body, query, and/or params
 * @param options - Validation options (applies to body only)
 * @returns Fastify preHandler hook
 *
 * @example
 * ```typescript
 * server.put('/users/:id', {
 *   preHandler: validateRequest({
 *     params: z.object({ id: z.string().uuid() }),
 *     body: z.object({ name: z.string() }),
 *   }),
 * }, handler);
 * ```
 */
export function validateRequest<
  TBody extends ZodSchema = ZodSchema,
  TQuery extends ZodSchema = ZodSchema,
  TParams extends ZodSchema = ZodSchema,
>(
  schemas: {
    body?: TBody;
    query?: TQuery;
    params?: TParams;
  },
  options: ValidationOptions = {}
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  type ValidatorFn = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  const validators: ValidatorFn[] = [];

  if (schemas.params) {
    validators.push(validateParams(schemas.params));
  }

  if (schemas.query) {
    validators.push(validateQuery(schemas.query));
  }

  if (schemas.body) {
    validators.push(validateBody(schemas.body, options));
  }

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    for (const validator of validators) {
      await validator(request, reply);

      // Stop if a response was already sent (validation failed)
      if (reply.sent) {
        return;
      }
    }
  };
}

/**
 * Register validation middleware plugin for Fastify
 *
 * This plugin adds the validation decorators to the Fastify instance.
 *
 * @param server - Fastify instance
 * @param options - Default validation options
 */
export async function registerValidationPlugin(
  server: FastifyInstance,
  options: ValidationOptions = {}
): Promise<void> {
  // Merge with defaults
  const defaultOpts = { ...DEFAULT_OPTIONS, ...options };

  // Create factory functions for validation middleware
  const createBodyValidator = (schema: ZodSchema, opts?: ValidationOptions) =>
    validateBody(schema, { ...defaultOpts, ...opts });

  const createQueryValidator = (schema: ZodSchema) =>
    validateQuery(schema);

  const createParamsValidator = (schema: ZodSchema) =>
    validateParams(schema);

  const createRequestValidator = (
    schemas: { body?: ZodSchema; query?: ZodSchema; params?: ZodSchema },
    opts?: ValidationOptions
  ) => validateRequest(schemas, { ...defaultOpts, ...opts });

  // Decorate server with validation helpers
  server.decorate('validateBody', createBodyValidator);
  server.decorate('validateQuery', createQueryValidator);
  server.decorate('validateParams', createParamsValidator);
  server.decorate('validateRequest', createRequestValidator);

  logger.info({ component: 'api-validation' }, 'Validation plugin registered');
}

// Re-export types for convenience
export type { ZodSchema, ZodError };
