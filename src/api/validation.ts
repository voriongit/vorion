/**
 * API Input Validation
 *
 * Provides Zod-based validation middleware for Fastify routes.
 * Integrates with the validation utilities from common/validation.ts.
 *
 * @packageDocumentation
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { z, ZodError, ZodSchema } from 'zod';
import { createLogger } from '../common/logger.js';
import {
  sanitizeObject,
  checkInjectionPatterns,
  validatePayloadSize,
  ValidationError,
  schemas as commonSchemas,
} from '../common/validation.js';

const logger = createLogger({ component: 'validation' });

/**
 * Validation options
 */
export interface ValidationOptions {
  /** Maximum payload size in bytes */
  maxPayloadSize?: number;
  /** Check for injection patterns */
  checkInjection?: boolean;
  /** Sanitize input strings */
  sanitize?: boolean;
  /** Strip unknown properties */
  stripUnknown?: boolean;
}

const DEFAULT_OPTIONS: ValidationOptions = {
  maxPayloadSize: 1048576, // 1MB
  checkInjection: true,
  sanitize: true,
  stripUnknown: true,
};

/**
 * Create validation middleware for request body
 */
export function validateBody<T extends ZodSchema>(
  schema: T,
  options: ValidationOptions = {}
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      const body = request.body;

      // Check payload size
      if (opts.maxPayloadSize) {
        validatePayloadSize(body, opts.maxPayloadSize);
      }

      // Sanitize if enabled
      let sanitized = body;
      if (opts.sanitize && typeof body === 'object' && body !== null) {
        sanitized = sanitizeObject(body as Record<string, unknown>);
      }

      // Check for injection patterns
      if (opts.checkInjection) {
        checkObjectForInjection(sanitized as Record<string, unknown>);
      }

      // Validate with schema
      const result = schema.safeParse(sanitized);

      if (!result.success) {
        const errors = formatZodErrors(result.error);

        logger.warn(
          { errors, path: request.url },
          'Request validation failed'
        );

        reply.status(422).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: errors,
          },
        });
        return;
      }

      // Replace body with validated/sanitized version
      (request as { body: z.infer<T> }).body = result.data;
    } catch (error) {
      if (error instanceof ValidationError) {
        reply.status(400).send({
          error: {
            code: error.code,
            message: error.message,
            field: error.field,
          },
        });
        return;
      }
      throw error;
    }
  };
}

/**
 * Create validation middleware for query parameters
 */
export function validateQuery<T extends ZodSchema>(
  schema: T
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const result = schema.safeParse(request.query);

    if (!result.success) {
      const errors = formatZodErrors(result.error);

      reply.status(400).send({
        error: {
          code: 'INVALID_QUERY',
          message: 'Invalid query parameters',
          details: errors,
        },
      });
      return;
    }

    // Replace query with validated version
    (request as { query: z.infer<T> }).query = result.data;
  };
}

/**
 * Create validation middleware for route parameters
 */
export function validateParams<T extends ZodSchema>(
  schema: T
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const result = schema.safeParse(request.params);

    if (!result.success) {
      const errors = formatZodErrors(result.error);

      reply.status(400).send({
        error: {
          code: 'INVALID_PARAMS',
          message: 'Invalid route parameters',
          details: errors,
        },
      });
      return;
    }

    // Replace params with validated version
    (request as { params: z.infer<T> }).params = result.data;
  };
}

/**
 * Format Zod errors into a user-friendly structure
 */
function formatZodErrors(error: ZodError): Array<{
  path: string;
  message: string;
  code: string;
}> {
  return error.errors.map((err) => ({
    path: err.path.join('.'),
    message: err.message,
    code: err.code,
  }));
}

/**
 * Recursively check object for injection patterns
 */
function checkObjectForInjection(obj: Record<string, unknown>, path = ''): void {
  for (const [key, value] of Object.entries(obj)) {
    const fieldPath = path ? `${path}.${key}` : key;

    if (typeof value === 'string' && checkInjectionPatterns(value)) {
      throw new ValidationError(
        `Potentially dangerous pattern detected in ${fieldPath}`,
        'INJECTION_DETECTED',
        fieldPath
      );
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === 'string' && checkInjectionPatterns(item)) {
          throw new ValidationError(
            `Potentially dangerous pattern detected in ${fieldPath}[${index}]`,
            'INJECTION_DETECTED',
            `${fieldPath}[${index}]`
          );
        }
        if (typeof item === 'object' && item !== null) {
          checkObjectForInjection(item as Record<string, unknown>, `${fieldPath}[${index}]`);
        }
      });
    }

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      checkObjectForInjection(value as Record<string, unknown>, fieldPath);
    }
  }
}

// ============================================================
// API-specific schemas
// ============================================================

/**
 * Escalation schemas
 */
export const escalationSchemas = {
  create: z.object({
    intentId: commonSchemas.uuid,
    entityId: commonSchemas.uuid,
    reason: z.string().min(1).max(1000),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    escalatedTo: z.string().min(1).max(100),
    context: z.record(z.unknown()).optional(),
    requestedAction: z.string().max(500).optional(),
    timeoutMinutes: z.number().int().min(1).max(10080).optional(), // max 1 week
  }),

  resolve: z.object({
    resolution: z.enum(['approved', 'rejected']),
    notes: z.string().max(2000).optional(),
  }),

  cancel: z.object({
    reason: z.string().max(1000).optional(),
  }),

  query: z.object({
    status: z.enum(['pending', 'approved', 'rejected', 'timeout', 'cancelled']).optional(),
    intentId: commonSchemas.uuid.optional(),
    entityId: commonSchemas.uuid.optional(),
    escalatedTo: z.string().max(100).optional(),
    limit: z.coerce.number().int().min(1).max(1000).optional(),
    offset: z.coerce.number().int().min(0).optional(),
  }),

  idParam: z.object({
    id: commonSchemas.uuid,
  }),
};

/**
 * Intent schemas
 */
export const intentSchemas = {
  submit: z.object({
    entityId: commonSchemas.uuid,
    goal: z.string().min(1).max(10000),
    context: z.record(z.unknown()),
    metadata: z.record(z.unknown()).optional(),
    priority: z.number().int().min(-100).max(100).optional(),
  }),

  query: z.object({
    entityId: commonSchemas.uuid.optional(),
    status: z.enum([
      'pending', 'evaluating', 'approved', 'denied',
      'escalated', 'executing', 'completed', 'failed'
    ]).optional(),
    limit: z.coerce.number().int().min(1).max(1000).optional(),
    offset: z.coerce.number().int().min(0).optional(),
  }),

  idParam: z.object({
    id: commonSchemas.uuid,
  }),
};

/**
 * Trust schemas
 */
export const trustSchemas = {
  signal: z.object({
    entityId: commonSchemas.uuid,
    type: z.string().min(1).max(100).regex(/^[a-z]+\.[a-z_]+$/),
    value: z.number().min(0).max(1),
    weight: z.number().min(0).max(10).optional(),
    source: z.string().max(100).optional(),
    metadata: z.record(z.unknown()).optional(),
  }),

  entityIdParam: z.object({
    entityId: commonSchemas.uuid,
  }),
};

/**
 * Proof schemas
 */
export const proofSchemas = {
  query: z.object({
    entityId: commonSchemas.uuid.optional(),
    intentId: commonSchemas.uuid.optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    limit: z.coerce.number().int().min(1).max(1000).optional(),
    offset: z.coerce.number().int().min(0).optional(),
  }),

  idParam: z.object({
    id: commonSchemas.uuid,
  }),
};

/**
 * Common pagination schema
 */
export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

// ============================================================
// ATSF-Core Consolidation Schemas
// ============================================================

/**
 * Intent submission schema (from atsf-core)
 */
export const intentSubmissionSchema = z.object({
  entityId: z.string().uuid(),
  goal: z.string().min(1).max(10000).transform(s => s.trim()),
  context: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Trust signal schema (from atsf-core)
 */
export const trustSignalSchema = z.object({
  signalType: z.enum(['success', 'failure', 'compliance', 'violation', 'verification']),
  impact: z.number().min(-100).max(100),
  context: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Constraint validation schema (from atsf-core)
 */
export const constraintValidationSchema = z.object({
  constraints: z.array(z.object({
    field: z.string(),
    operator: z.enum(['equals', 'not_equals', 'greater_than', 'less_than', 'in', 'not_in', 'contains', 'matches']),
    value: z.unknown(),
  })),
  context: z.record(z.unknown()),
});
