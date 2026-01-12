/**
 * BASIS Policy Validator
 *
 * Validates Policy Bundles against the BASIS JSON Schema.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import type { PolicyBundle } from './types.js';

// Use createRequire for CJS modules
const require = createRequire(import.meta.url);
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Validation error detail
 */
export interface ValidationError {
  path: string;
  message: string;
  keyword: string;
  params?: Record<string, unknown>;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  policy?: PolicyBundle;
}

/**
 * Load the BASIS schema
 */
function loadSchema(): object {
  const schemaPath = join(__dirname, '..', '..', '..', 'schemas', 'basis-schema.json');
  const schemaContent = readFileSync(schemaPath, 'utf-8');
  return JSON.parse(schemaContent);
}

// Validation function type
type ValidateFn = ((data: unknown) => boolean) & { errors?: Array<{ instancePath: string; message?: string; keyword: string; params?: unknown }> };

// Singleton validator instance
let validateFn: ValidateFn | null = null;

/**
 * Initialize the validator (lazy)
 */
function getValidator(): ValidateFn {
  if (!validateFn) {
    const ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strict: true,
    });
    addFormats(ajv);
    const schema = loadSchema();
    validateFn = ajv.compile(schema) as ValidateFn;
  }
  return validateFn!;
}

/**
 * Validate a Policy Bundle against the BASIS schema
 *
 * @param policy - The policy object or JSON string to validate
 * @returns Validation result with errors if any
 *
 * @example
 * ```typescript
 * import { validatePolicy } from '@vorion/basis-core';
 *
 * const result = validatePolicy({
 *   basis_version: '1.0',
 *   policy_id: 'my-policy',
 *   metadata: { name: 'My Policy', version: '1.0.0', created_at: '2026-01-01T00:00:00Z' }
 * });
 *
 * if (result.valid) {
 *   console.log('Policy is valid!');
 * } else {
 *   console.log('Validation errors:', result.errors);
 * }
 * ```
 */
export function validatePolicy(
  policy: unknown | string
): ValidationResult {
  // Parse if string
  let policyObj: unknown;
  if (typeof policy === 'string') {
    try {
      policyObj = JSON.parse(policy);
    } catch {
      return {
        valid: false,
        errors: [
          {
            path: '',
            message: 'Invalid JSON',
            keyword: 'parse',
          },
        ],
      };
    }
  } else {
    policyObj = policy;
  }

  // Validate
  const validate = getValidator();
  const valid = validate(policyObj);

  if (valid) {
    return {
      valid: true,
      errors: [],
      policy: policyObj as PolicyBundle,
    };
  }

  // Map errors
  const errors: ValidationError[] = (validate.errors ?? []).map((err) => ({
    path: err.instancePath || '/',
    message: err.message ?? 'Unknown error',
    keyword: err.keyword,
    params: err.params as Record<string, unknown>,
  }));

  return {
    valid: false,
    errors,
  };
}

/**
 * Check if a policy ID is valid
 */
export function isValidPolicyId(id: string): boolean {
  const pattern = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
  return id.length >= 3 && id.length <= 64 && pattern.test(id);
}

/**
 * Check if a version string is valid
 */
export function isValidVersion(version: string): boolean {
  const pattern = /^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9]+)?$/;
  return pattern.test(version);
}

/**
 * Check if a BASIS version is supported
 */
export function isSupportedBasisVersion(version: string): boolean {
  return ['1.0', '1.1'].includes(version);
}
