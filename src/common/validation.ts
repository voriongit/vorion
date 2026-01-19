/**
 * Input Validation and Sanitization Utilities
 *
 * Provides schema-based validation and sanitization for API inputs.
 * Built on top of Zod with additional security features.
 *
 * @packageDocumentation
 */

import { z } from 'zod';

/**
 * Common validation patterns
 */
export const patterns = {
  // UUID v4
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  // ISO 8601 datetime
  isoDateTime: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/,
  // Slug (URL-safe identifier)
  slug: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  // Email (basic)
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  // Alphanumeric with underscores
  identifier: /^[a-zA-Z][a-zA-Z0-9_]*$/,
  // Semantic version
  semver: /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)*)?$/,
};

/**
 * Sanitize a string by removing potentially dangerous characters
 */
export function sanitizeString(input: string): string {
  return input
    // Remove null bytes
    .replace(/\0/g, '')
    // Remove control characters (except newlines and tabs)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Normalize unicode to NFC form
    .normalize('NFC')
    // Trim whitespace
    .trim();
}

/**
 * Sanitize an object recursively
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    // Sanitize keys too
    const sanitizedKey = sanitizeString(key);

    if (typeof value === 'string') {
      result[sanitizedKey] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      result[sanitizedKey] = value.map((item) =>
        typeof item === 'string'
          ? sanitizeString(item)
          : typeof item === 'object' && item !== null
            ? sanitizeObject(item as Record<string, unknown>)
            : item
      );
    } else if (typeof value === 'object' && value !== null) {
      result[sanitizedKey] = sanitizeObject(value as Record<string, unknown>);
    } else {
      result[sanitizedKey] = value;
    }
  }

  return result as T;
}

/**
 * Common Zod schemas
 */
export const schemas = {
  /** UUID v4 */
  uuid: z.string().uuid(),

  /** Entity ID (UUID) */
  entityId: z.string().uuid().describe('Entity identifier'),

  /** Intent ID (UUID) */
  intentId: z.string().uuid().describe('Intent identifier'),

  /** Proof ID (UUID) */
  proofId: z.string().uuid().describe('Proof identifier'),

  /** ISO 8601 timestamp */
  timestamp: z.string().datetime().describe('ISO 8601 timestamp'),

  /** Trust score (0-1000) */
  trustScore: z.number().int().min(0).max(1000).describe('Trust score'),

  /** Trust level (0-5) */
  trustLevel: z.number().int().min(0).max(5).describe('Trust level'),

  /** Non-empty string */
  nonEmptyString: z.string().min(1).max(10000).describe('Non-empty string'),

  /** Safe object (with depth limit) */
  safeObject: z.record(z.unknown()).refine(
    (obj) => {
      // Check depth
      const checkDepth = (o: unknown, depth: number): boolean => {
        if (depth > 10) return false;
        if (typeof o !== 'object' || o === null) return true;
        return Object.values(o).every((v) => checkDepth(v, depth + 1));
      };
      return checkDepth(obj, 0);
    },
    { message: 'Object nesting too deep (max 10 levels)' }
  ),

  /** Pagination parameters */
  pagination: z.object({
    offset: z.number().int().min(0).max(100000).default(0),
    limit: z.number().int().min(1).max(1000).default(100),
  }),

  /** Sort parameters */
  sort: z.object({
    field: z.string().max(100),
    order: z.enum(['asc', 'desc']).default('desc'),
  }),
};

/**
 * Create a validated and sanitized request body parser
 */
export function createBodyParser<T extends z.ZodTypeAny>(schema: T) {
  return {
    parse: (data: unknown): z.infer<T> => {
      // Sanitize if object
      const sanitized =
        typeof data === 'object' && data !== null
          ? sanitizeObject(data as Record<string, unknown>)
          : data;

      // Validate with schema
      return schema.parse(sanitized);
    },

    safeParse: (data: unknown) => {
      // Sanitize if object
      const sanitized =
        typeof data === 'object' && data !== null
          ? sanitizeObject(data as Record<string, unknown>)
          : data;

      // Validate with schema
      return schema.safeParse(sanitized);
    },
  };
}

/**
 * Validate array size
 */
export function validateArraySize<T>(
  arr: T[],
  maxSize: number,
  fieldName: string
): void {
  if (arr.length > maxSize) {
    throw new ValidationError(
      `${fieldName} exceeds maximum size of ${maxSize}`,
      'ARRAY_TOO_LARGE'
    );
  }
}

/**
 * Validate string length
 */
export function validateStringLength(
  str: string,
  maxLength: number,
  fieldName: string
): void {
  if (str.length > maxLength) {
    throw new ValidationError(
      `${fieldName} exceeds maximum length of ${maxLength}`,
      'STRING_TOO_LONG'
    );
  }
}

/**
 * Custom validation error
 */
export class ValidationError extends Error {
  code: string;
  field?: string;

  constructor(message: string, code: string = 'VALIDATION_ERROR', field?: string) {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
    if (field !== undefined) this.field = field;
  }
}

/**
 * Rate limiting helper for validation
 */
export function createRateLimitedValidator<T>(
  validator: (data: T) => void,
  maxPerMinute: number
) {
  const calls: number[] = [];

  return (data: T): void => {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Clean old entries
    while (calls.length > 0 && calls[0]! < oneMinuteAgo) {
      calls.shift();
    }

    // Check rate limit
    if (calls.length >= maxPerMinute) {
      throw new ValidationError(
        'Rate limit exceeded for validation',
        'RATE_LIMIT_EXCEEDED'
      );
    }

    // Record call and validate
    calls.push(now);
    validator(data);
  };
}

/**
 * Validate JSON payload size
 */
export function validatePayloadSize(
  payload: unknown,
  maxSizeBytes: number = 1048576 // 1MB default
): void {
  const size = new TextEncoder().encode(JSON.stringify(payload)).length;
  if (size > maxSizeBytes) {
    throw new ValidationError(
      `Payload size ${size} exceeds maximum of ${maxSizeBytes} bytes`,
      'PAYLOAD_TOO_LARGE'
    );
  }
}

/**
 * Check for potential injection patterns
 */
export function checkInjectionPatterns(input: string): boolean {
  const dangerousPatterns = [
    // SQL injection
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER)\b)/i,
    // Script injection
    /<script[^>]*>/i,
    // Template injection
    /\$\{[^}]+\}/,
    /\{\{[^}]+\}\}/,
    // Command injection
    /[;&|`$]/,
    // Path traversal
    /\.\.\//,
  ];

  return dangerousPatterns.some((pattern) => pattern.test(input));
}

/**
 * Validate that input doesn't contain injection patterns
 */
export function validateNoInjection(input: string, fieldName: string): void {
  if (checkInjectionPatterns(input)) {
    throw new ValidationError(
      `${fieldName} contains potentially dangerous patterns`,
      'INJECTION_DETECTED',
      fieldName
    );
  }
}
