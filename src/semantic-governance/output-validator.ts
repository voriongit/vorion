/**
 * Output Validator - Output Schema Binding
 *
 * Validates agent output against allowed schemas and scans for prohibited patterns.
 * Prevents data exfiltration and ensures output conforms to expected formats.
 *
 * Features:
 * - JSON Schema validation for structured output
 * - Prohibited pattern detection (PII, credentials, etc.)
 * - External endpoint allowlist/blocklist
 * - Output sanitization
 *
 * @packageDocumentation
 * @module @vorion/semantic-governance/output-validator
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { createLogger } from '../common/logger.js';
import { VorionError } from '../common/errors.js';
import type {
  OutputBinding,
  OutputSchema,
  ProhibitedPattern,
  OutputValidationResult,
  PatternScanResult,
  SanitizedOutput,
} from './types.js';

const logger = createLogger({ component: 'output-validator' });

/**
 * Error thrown when output validation fails
 */
export class OutputValidationError extends VorionError {
  override code = 'OUTPUT_VALIDATION_ERROR';
  override statusCode = 403;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details);
    this.name = 'OutputValidationError';
  }
}

/**
 * Built-in prohibited patterns for common sensitive data
 */
export const BUILT_IN_PROHIBITED_PATTERNS: ProhibitedPattern[] = [
  // Email addresses
  {
    type: 'regex',
    pattern: '\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b',
    description: 'Email addresses',
    severity: 'medium',
  },
  // Social Security Numbers
  {
    type: 'regex',
    pattern: '\\b\\d{3}-\\d{2}-\\d{4}\\b',
    description: 'Social Security Numbers (SSN)',
    severity: 'critical',
  },
  // Credit card numbers (basic patterns)
  {
    type: 'regex',
    pattern: '\\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\\b',
    description: 'Credit card numbers',
    severity: 'critical',
  },
  // API keys (common formats)
  {
    type: 'regex',
    pattern: '\\b(?:api[_-]?key|apikey|api[_-]?secret|api[_-]?token)[\\s:=]+[\'"]?[A-Za-z0-9_-]{20,}[\'"]?',
    description: 'API keys',
    severity: 'critical',
  },
  // AWS access keys
  {
    type: 'regex',
    pattern: '\\bAKIA[0-9A-Z]{16}\\b',
    description: 'AWS Access Key IDs',
    severity: 'critical',
  },
  // Private keys
  {
    type: 'regex',
    pattern: '-----BEGIN\\s+(RSA\\s+)?PRIVATE\\s+KEY-----',
    description: 'Private keys',
    severity: 'critical',
  },
  // JWT tokens
  {
    type: 'regex',
    pattern: '\\beyJ[A-Za-z0-9_-]*\\.[A-Za-z0-9_-]*\\.[A-Za-z0-9_-]*\\b',
    description: 'JWT tokens',
    severity: 'high',
  },
  // Phone numbers (US format)
  {
    type: 'regex',
    pattern: '\\b(?:\\+1[-.]?)?\\(?[2-9][0-9]{2}\\)?[-.]?[2-9][0-9]{2}[-.]?[0-9]{4}\\b',
    description: 'Phone numbers',
    severity: 'medium',
  },
  // IP addresses
  {
    type: 'regex',
    pattern: '\\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\b',
    description: 'IP addresses',
    severity: 'low',
  },
];

/**
 * Output Validator
 *
 * Validates agent output against configured schemas and patterns.
 */
export class OutputValidator {
  private readonly config: OutputBinding;
  private readonly ajv: Ajv;
  private readonly schemaValidators: Map<string, ReturnType<Ajv['compile']>>;
  private readonly compiledPatterns: Map<string, RegExp>;
  private readonly allowedEndpointPatterns: RegExp[];
  private readonly blockedEndpointPatterns: RegExp[];

  /**
   * Create a new OutputValidator
   *
   * @param config - Output binding configuration
   */
  constructor(config: OutputBinding) {
    this.config = config;
    this.ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(this.ajv);
    this.schemaValidators = new Map();
    this.compiledPatterns = new Map();
    this.allowedEndpointPatterns = [];
    this.blockedEndpointPatterns = [];

    // Pre-compile schema validators
    for (const schema of config.allowedSchemas) {
      try {
        const validator = this.ajv.compile(schema.jsonSchema);
        this.schemaValidators.set(schema.id, validator);
      } catch (error) {
        logger.error({ schemaId: schema.id, error }, 'Failed to compile output schema');
      }
    }

    // Pre-compile prohibited patterns
    for (const pattern of config.prohibitedPatterns) {
      if (pattern.type === 'regex') {
        try {
          const regex = new RegExp(pattern.pattern, 'gi');
          this.compiledPatterns.set(pattern.pattern, regex);
        } catch (error) {
          logger.error({ pattern: pattern.pattern, error }, 'Failed to compile prohibited pattern');
        }
      }
    }

    // Compile endpoint patterns
    this.allowedEndpointPatterns = config.allowedExternalEndpoints.map((p) => this.globToRegex(p));
    this.blockedEndpointPatterns = config.blockedExternalEndpoints.map((p) => this.globToRegex(p));

    logger.debug(
      {
        schemas: config.allowedSchemas.length,
        prohibitedPatterns: config.prohibitedPatterns.length,
        allowedEndpoints: config.allowedExternalEndpoints.length,
        blockedEndpoints: config.blockedExternalEndpoints.length,
      },
      'OutputValidator initialized'
    );
  }

  /**
   * Validate output against allowed schemas
   *
   * @param output - Output to validate
   * @returns Validation result
   */
  validateOutput(output: unknown): OutputValidationResult {
    const startTime = Date.now();

    try {
      // If no schemas configured, only check patterns
      if (this.config.allowedSchemas.length === 0) {
        const patternScan = this.scanForProhibitedPatterns(this.stringifyOutput(output));
        if (patternScan.detected) {
          return {
            valid: false,
            reason: `Prohibited patterns detected: ${patternScan.patterns.map((p) => p.description).join(', ')}`,
            patternScan,
          };
        }
        return { valid: true };
      }

      // Try to match against each allowed schema
      for (const [schemaId, validator] of Array.from(this.schemaValidators.entries())) {
        if (validator(output)) {
          // Schema matched, now check for prohibited patterns
          const patternScan = this.scanForProhibitedPatterns(this.stringifyOutput(output));
          if (patternScan.detected) {
            logger.warn(
              { schemaId, patterns: patternScan.patterns.map((p) => p.description) },
              'Output matched schema but contains prohibited patterns'
            );
            return {
              valid: false,
              schemaId,
              reason: `Prohibited patterns detected: ${patternScan.patterns.map((p) => p.description).join(', ')}`,
              patternScan,
            };
          }

          logger.debug({ schemaId }, 'Output validated against schema');
          return { valid: true, schemaId };
        }
      }

      // No schema matched
      logger.warn('Output does not match any allowed schema');
      return {
        valid: false,
        reason: 'Output does not match any allowed schema',
      };
    } finally {
      const duration = Date.now() - startTime;
      logger.debug({ durationMs: duration }, 'Output validation completed');
    }
  }

  /**
   * Scan content for prohibited patterns
   *
   * @param content - Content to scan
   * @returns Pattern scan result
   */
  scanForProhibitedPatterns(content: string): PatternScanResult {
    const detectedPatterns: PatternScanResult['patterns'] = [];
    let maxSeverity: PatternScanResult['severity'] = undefined;

    // Combine configured patterns with built-in patterns
    const allPatterns = [...this.config.prohibitedPatterns, ...BUILT_IN_PROHIBITED_PATTERNS];

    for (const pattern of allPatterns) {
      const matches = this.findPatternMatches(content, pattern);
      if (matches.length > 0) {
        detectedPatterns.push({
          type: pattern.type,
          pattern: pattern.pattern,
          description: pattern.description,
          matches,
          severity: pattern.severity,
        });

        // Track maximum severity
        if (pattern.severity) {
          maxSeverity = this.getHigherSeverity(maxSeverity, pattern.severity);
        }
      }
    }

    return {
      detected: detectedPatterns.length > 0,
      patterns: detectedPatterns,
      severity: maxSeverity,
    };
  }

  /**
   * Check if an external endpoint is allowed
   *
   * @param url - URL to check
   * @returns Whether the endpoint is allowed
   */
  validateExternalEndpoint(url: string): boolean {
    // Check blocklist first
    for (const pattern of this.blockedEndpointPatterns) {
      if (pattern.test(url)) {
        logger.debug({ url }, 'External endpoint blocked');
        return false;
      }
    }

    // If allowlist is empty, allow all (except blocked)
    if (this.allowedEndpointPatterns.length === 0) {
      return true;
    }

    // Check allowlist
    for (const pattern of this.allowedEndpointPatterns) {
      if (pattern.test(url)) {
        return true;
      }
    }

    logger.debug({ url }, 'External endpoint not in allowlist');
    return false;
  }

  /**
   * Sanitize output by removing prohibited content
   *
   * @param output - Output to sanitize
   * @returns Sanitized output
   */
  sanitizeOutput(output: unknown): SanitizedOutput {
    const redactions: SanitizedOutput['redactions'] = [];
    let content = this.stringifyOutput(output);
    let modified = false;

    // Apply all prohibited patterns
    const allPatterns = [...this.config.prohibitedPatterns, ...BUILT_IN_PROHIBITED_PATTERNS];

    for (const pattern of allPatterns) {
      if (pattern.type === 'regex') {
        const regex = this.compiledPatterns.get(pattern.pattern) || new RegExp(pattern.pattern, 'gi');
        const matches = content.match(regex);
        if (matches && matches.length > 0) {
          content = content.replace(regex, '[REDACTED]');
          redactions.push({
            type: pattern.type,
            description: pattern.description,
            count: matches.length,
          });
          modified = true;
        }
      } else if (pattern.type === 'keyword') {
        const regex = new RegExp(`\\b${this.escapeRegex(pattern.pattern)}\\b`, 'gi');
        const matches = content.match(regex);
        if (matches && matches.length > 0) {
          content = content.replace(regex, '[REDACTED]');
          redactions.push({
            type: pattern.type,
            description: pattern.description,
            count: matches.length,
          });
          modified = true;
        }
      }
    }

    // Try to parse back to original type
    let sanitizedContent: unknown;
    try {
      sanitizedContent = JSON.parse(content);
    } catch {
      sanitizedContent = content;
    }

    if (modified) {
      logger.info(
        {
          redactionCount: redactions.reduce((sum, r) => sum + r.count, 0),
          redactionTypes: redactions.map((r) => r.description),
        },
        'Output sanitized'
      );
    }

    return {
      content: sanitizedContent,
      modified,
      redactions,
    };
  }

  /**
   * Extract all URLs from content
   *
   * @param content - Content to scan
   * @returns Array of extracted URLs
   */
  extractUrls(content: string): string[] {
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
    const matches = content.match(urlRegex);
    return matches || [];
  }

  /**
   * Validate all URLs in content against endpoint rules
   *
   * @param content - Content to validate
   * @returns Array of invalid URLs
   */
  validateAllUrls(content: string): string[] {
    const urls = this.extractUrls(content);
    return urls.filter((url) => !this.validateExternalEndpoint(url));
  }

  /**
   * Convert a glob pattern to a regex
   *
   * @param glob - Glob pattern
   * @returns Compiled regex
   */
  private globToRegex(glob: string): RegExp {
    const escaped = glob
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape regex special chars
      .replace(/\*/g, '.*') // Convert * to .*
      .replace(/\?/g, '.'); // Convert ? to .

    return new RegExp(`^${escaped}$`, 'i');
  }

  /**
   * Find all matches for a pattern in content
   *
   * @param content - Content to search
   * @param pattern - Pattern to match
   * @returns Array of matches
   */
  private findPatternMatches(content: string, pattern: ProhibitedPattern): string[] {
    if (pattern.type === 'regex') {
      const regex = this.compiledPatterns.get(pattern.pattern) || new RegExp(pattern.pattern, 'gi');
      const matches = content.match(regex);
      return matches || [];
    } else if (pattern.type === 'keyword') {
      const regex = new RegExp(`\\b${this.escapeRegex(pattern.pattern)}\\b`, 'gi');
      const matches = content.match(regex);
      return matches || [];
    } else if (pattern.type === 'semantic') {
      // Semantic patterns would require ML/NLP - return empty for now
      logger.debug({ pattern: pattern.pattern }, 'Semantic pattern matching not implemented');
      return [];
    }

    return [];
  }

  /**
   * Escape special regex characters
   *
   * @param str - String to escape
   * @returns Escaped string
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Get the higher severity level
   *
   * @param a - First severity
   * @param b - Second severity
   * @returns Higher severity
   */
  private getHigherSeverity(
    a: PatternScanResult['severity'],
    b: PatternScanResult['severity']
  ): PatternScanResult['severity'] {
    const order = ['low', 'medium', 'high', 'critical'];
    const aIndex = a ? order.indexOf(a) : -1;
    const bIndex = b ? order.indexOf(b) : -1;
    return aIndex >= bIndex ? a : b;
  }

  /**
   * Convert output to string for scanning
   *
   * @param output - Output to stringify
   * @returns String representation
   */
  private stringifyOutput(output: unknown): string {
    if (typeof output === 'string') {
      return output;
    }
    try {
      return JSON.stringify(output, null, 2);
    } catch {
      return String(output);
    }
  }
}

/**
 * Create an OutputValidator with default configuration
 *
 * @param additionalPatterns - Additional prohibited patterns to include
 * @returns OutputValidator with secure defaults
 */
export function createDefaultOutputValidator(additionalPatterns: ProhibitedPattern[] = []): OutputValidator {
  return new OutputValidator({
    allowedSchemas: [],
    prohibitedPatterns: [...BUILT_IN_PROHIBITED_PATTERNS, ...additionalPatterns],
    allowedExternalEndpoints: [],
    blockedExternalEndpoints: ['*'],
  });
}
