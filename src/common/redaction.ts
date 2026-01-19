/**
 * Sensitive Data Redaction Utilities
 *
 * Provides deep redaction of sensitive data in objects and arrays.
 * Supports configurable sensitive field patterns and custom redaction functions.
 *
 * @packageDocumentation
 */

/**
 * Default sensitive field patterns (case-insensitive)
 */
const DEFAULT_SENSITIVE_PATTERNS = [
  // Authentication
  /password/i,
  /secret/i,
  /token/i,
  /apikey/i,
  /api_key/i,
  /api-key/i,
  /bearer/i,
  /authorization/i,
  /auth/i,
  /credential/i,
  /private_key/i,
  /privatekey/i,

  // Personal data
  /ssn/i,
  /social_security/i,
  /tax_id/i,
  /passport/i,
  /driver_license/i,
  /credit_card/i,
  /card_number/i,
  /cvv/i,
  /pin/i,

  // Financial
  /account_number/i,
  /routing_number/i,
  /bank_account/i,
  /iban/i,
  /swift/i,

  // Healthcare
  /medical_record/i,
  /diagnosis/i,
  /prescription/i,
  /health_insurance/i,

  // Contact info (partial redaction might be preferred)
  /email/i,
  /phone/i,
  /address/i,
];

/**
 * Redaction configuration
 */
export interface RedactionConfig {
  /** Custom sensitive field patterns */
  sensitivePatterns?: RegExp[];
  /** Replacement value for redacted fields */
  replacement?: string;
  /** Maximum depth for nested redaction */
  maxDepth?: number;
  /** Whether to preserve field type indicators */
  preserveType?: boolean;
  /** Custom redaction function for specific fields */
  customRedactor?: (key: string, value: unknown) => unknown;
  /** Fields to explicitly allow (whitelist) */
  allowedFields?: string[];
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<RedactionConfig> = {
  sensitivePatterns: DEFAULT_SENSITIVE_PATTERNS,
  replacement: '[REDACTED]',
  maxDepth: 20,
  preserveType: false,
  customRedactor: () => undefined,
  allowedFields: [],
};

/**
 * Check if a field name matches any sensitive pattern
 */
function isSensitiveField(
  fieldName: string,
  patterns: RegExp[],
  allowedFields: string[]
): boolean {
  // Check whitelist first
  if (allowedFields.includes(fieldName)) {
    return false;
  }

  // Check against patterns
  return patterns.some((pattern) => pattern.test(fieldName));
}

/**
 * Get type-preserving replacement value
 */
function getTypedReplacement(value: unknown, replacement: string): unknown {
  if (typeof value === 'string') {
    return replacement;
  }
  if (typeof value === 'number') {
    return 0;
  }
  if (typeof value === 'boolean') {
    return false;
  }
  if (Array.isArray(value)) {
    return [replacement];
  }
  if (value === null) {
    return null;
  }
  if (typeof value === 'object') {
    return { redacted: true };
  }
  return replacement;
}

/**
 * Deep clone and redact sensitive data from an object
 */
export function redact<T>(
  data: T,
  config: RedactionConfig = {}
): T {
  const mergedConfig: Required<RedactionConfig> = {
    ...DEFAULT_CONFIG,
    ...config,
    sensitivePatterns: config.sensitivePatterns ?? DEFAULT_SENSITIVE_PATTERNS,
    allowedFields: config.allowedFields ?? [],
  };

  return redactRecursive(data, mergedConfig, 0, '') as T;
}

/**
 * Recursive redaction implementation
 */
function redactRecursive(
  data: unknown,
  config: Required<RedactionConfig>,
  depth: number,
  path: string
): unknown {
  // Check depth limit
  if (depth > config.maxDepth) {
    return config.replacement;
  }

  // Handle null/undefined
  if (data === null || data === undefined) {
    return data;
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map((item, index) =>
      redactRecursive(item, config, depth + 1, `${path}[${index}]`)
    );
  }

  // Handle objects
  if (typeof data === 'object') {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      const fieldPath = path ? `${path}.${key}` : key;

      // Check custom redactor first
      const customResult = config.customRedactor(key, value);
      if (customResult !== undefined) {
        result[key] = customResult;
        continue;
      }

      // Check if field is sensitive
      if (isSensitiveField(key, config.sensitivePatterns, config.allowedFields)) {
        result[key] = config.preserveType
          ? getTypedReplacement(value, config.replacement)
          : config.replacement;
        continue;
      }

      // Recurse into nested objects/arrays
      result[key] = redactRecursive(value, config, depth + 1, fieldPath);
    }

    return result;
  }

  // Return primitives as-is
  return data;
}

/**
 * Redact sensitive data from a string (e.g., log message)
 */
export function redactString(
  text: string,
  config: Partial<RedactionConfig> = {}
): string {
  const replacement = config.replacement ?? DEFAULT_CONFIG.replacement;

  let result = text;

  // Replace Bearer/Basic auth tokens
  result = result.replace(/Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/gi, `Bearer ${replacement}`);
  result = result.replace(/Basic\s+[A-Za-z0-9+/=]+/gi, `Basic ${replacement}`);

  // Replace JWT-like tokens
  result = result.replace(/eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g, replacement);

  // Replace password in URLs
  result = result.replace(/(:\/\/[^:]+:)[^@]+(@)/gi, `$1${replacement}$2`);

  // Partially redact emails (keep first char and domain)
  result = result.replace(
    /([a-zA-Z0-9])[a-zA-Z0-9._%+-]*@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    `$1***@$2`
  );

  // Redact credit card numbers (show last 4)
  result = result.replace(
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?(\d{4})\b/g,
    `****-****-****-$1`
  );

  // Redact SSN (show last 4)
  result = result.replace(/\b\d{3}[-\s]?\d{2}[-\s]?(\d{4})\b/g, `***-**-$1`);

  return result;
}

/**
 * Create a redactor with preset configuration
 */
export function createRedactor(config: RedactionConfig = {}) {
  return {
    redact: <T>(data: T) => redact(data, config),
    redactString: (text: string) => redactString(text, config),
  };
}

/**
 * Safely stringify an object with redaction
 */
export function safeStringify(
  data: unknown,
  config: RedactionConfig = {},
  space?: number
): string {
  const redacted = redact(data, config);
  try {
    return JSON.stringify(redacted, null, space);
  } catch {
    return '[Unable to stringify]';
  }
}

/**
 * Export default patterns for customization
 */
export const SENSITIVE_PATTERNS = DEFAULT_SENSITIVE_PATTERNS;
