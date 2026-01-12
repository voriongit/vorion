/**
 * Validators index - re-exports all Zod schemas and validation utilities
 */

// Enum validators
export * from './enums.js';

// Trust profile validators
export * from './trust-profile.js';

// Intent validators
export * from './intent.js';

// Decision validators
export * from './decision.js';

// Proof event validators
export * from './proof-event.js';

// Utility functions for validation
import { z } from 'zod';

/**
 * Validate data against a schema
 * @throws ZodError if validation fails
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * Safely validate data, returning result object
 */
export function safeValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodIssue[] } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error.issues };
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(errors: z.ZodIssue[]): string[] {
  return errors.map((issue) => {
    const path = issue.path.join('.');
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}

// Re-export Zod for convenience
export { z } from 'zod';
