/**
 * Instruction Validator - Instruction Integrity Validation
 *
 * Validates system prompts and instructions against approved hashes and templates
 * to prevent prompt injection attacks.
 *
 * Features:
 * - Exact hash matching for approved system prompts
 * - Template matching with parameter extraction
 * - Signed instruction source verification
 * - Instruction normalization to prevent bypass attempts
 *
 * @packageDocumentation
 * @module @vorion/semantic-governance/instruction-validator
 */

import { createHash, createVerify } from 'crypto';
import Ajv from 'ajv';
import { createLogger } from '../common/logger.js';
import { VorionError } from '../common/errors.js';
import type {
  InstructionIntegrity,
  InstructionTemplate,
  InstructionValidationResult,
  TemplateMatchResult,
} from './types.js';

const logger = createLogger({ component: 'instruction-validator' });

/**
 * Error thrown when instruction validation fails
 */
export class InstructionValidationError extends VorionError {
  override code = 'INSTRUCTION_VALIDATION_ERROR';
  override statusCode = 403;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details);
    this.name = 'InstructionValidationError';
  }
}

/**
 * Instruction Validator
 *
 * Validates instructions against the configured instruction integrity rules.
 * Supports three validation methods:
 * 1. Exact hash matching - instruction matches a pre-approved hash
 * 2. Template matching - instruction matches a template with valid parameters
 * 3. Signed source verification - instruction comes from a trusted, signed source
 */
export class InstructionValidator {
  private readonly config: InstructionIntegrity;
  private readonly ajv: Ajv;
  private readonly hashSet: Set<string>;
  private readonly templateCache: Map<string, { template: InstructionTemplate; regex: RegExp }>;

  /**
   * Create a new InstructionValidator
   *
   * @param config - Instruction integrity configuration
   */
  constructor(config: InstructionIntegrity) {
    this.config = config;
    this.ajv = new Ajv({ allErrors: true, strict: false });
    this.hashSet = new Set(config.allowedInstructionHashes);
    this.templateCache = new Map();

    // Pre-compile template regexes
    for (const template of config.instructionTemplates) {
      this.compileTemplate(template);
    }

    logger.debug(
      {
        allowedHashes: config.allowedInstructionHashes.length,
        templates: config.instructionTemplates.length,
        requireSignature: config.instructionSource.requireSignature,
      },
      'InstructionValidator initialized'
    );
  }

  /**
   * Validate a system prompt or instruction against allowed configurations
   *
   * @param systemPrompt - The system prompt or instruction to validate
   * @returns Validation result indicating whether the instruction is valid
   */
  validateInstruction(systemPrompt: string): InstructionValidationResult {
    const startTime = Date.now();

    try {
      // Normalize and hash the instruction
      const normalized = this.normalizeInstruction(systemPrompt);
      const instructionHash = this.hashInstruction(normalized);

      // 1. Check against allowed hashes (exact match)
      if (this.hashSet.has(instructionHash)) {
        logger.debug({ instructionHash }, 'Instruction validated via exact hash match');
        return {
          valid: true,
          method: 'exact-match',
          instructionHash,
        };
      }

      // 2. Check against templates
      const templateMatch = this.matchTemplate(systemPrompt);
      if (templateMatch.matches) {
        logger.debug(
          { templateId: templateMatch.templateId, confidence: templateMatch.confidence },
          'Instruction validated via template match'
        );
        return {
          valid: true,
          method: 'template-match',
          templateId: templateMatch.templateId,
          extractedParams: templateMatch.extractedParams,
          instructionHash,
        };
      }

      // 3. Instruction not in approved set
      logger.warn({ instructionHash }, 'Instruction not in approved set');
      return {
        valid: false,
        reason: 'Instruction not in approved set',
        instructionHash,
      };
    } finally {
      const duration = Date.now() - startTime;
      logger.debug({ durationMs: duration }, 'Instruction validation completed');
    }
  }

  /**
   * Match an instruction against configured templates
   *
   * @param instruction - The instruction to match
   * @returns Template match result with extracted parameters
   */
  matchTemplate(instruction: string): TemplateMatchResult {
    const normalized = this.normalizeInstruction(instruction);

    for (const [templateId, { template, regex }] of Array.from(this.templateCache.entries())) {
      const match = normalized.match(regex);
      if (match) {
        // Extract named groups as parameters
        const extractedParams = match.groups || {};

        // Validate parameters against schema
        const validate = this.ajv.compile(template.parameterSchema);
        const paramsValid = validate(extractedParams);

        if (paramsValid) {
          return {
            matches: true,
            templateId,
            extractedParams,
            confidence: this.calculateMatchConfidence(normalized, regex),
          };
        } else {
          logger.debug(
            {
              templateId,
              errors: validate.errors,
            },
            'Template matched but parameters invalid'
          );
        }
      }
    }

    return { matches: false };
  }

  /**
   * Verify a signed instruction from a trusted source
   *
   * @param instruction - The instruction content
   * @param signature - The cryptographic signature (base64)
   * @param source - The source identifier (DID or URL)
   * @returns Whether the signed source is valid
   */
  verifySignedSource(instruction: string, signature: string, source: string): boolean {
    // Check if source is in allowed sources
    if (!this.isSourceAllowed(source)) {
      logger.warn({ source }, 'Instruction source not in allowed list');
      return false;
    }

    // If signature verification is not required, source being allowed is sufficient
    if (!this.config.instructionSource.requireSignature) {
      return true;
    }

    // Verify signature (placeholder - in production, would use proper key management)
    try {
      // For now, we accept signatures in a simple format
      // In production, this would verify against the source's public key
      const verifier = createVerify('RSA-SHA256');
      verifier.update(instruction);

      // Note: In a real implementation, we would fetch the public key
      // associated with the source DID and verify against it
      logger.warn('Signature verification not fully implemented - using placeholder');

      // For now, return true if signature is non-empty and source is allowed
      return signature.length > 0;
    } catch (error) {
      logger.error({ error, source }, 'Error verifying instruction signature');
      return false;
    }
  }

  /**
   * Compute SHA-256 hash of an instruction
   *
   * @param instruction - The instruction to hash
   * @returns SHA-256 hash in the format "sha256:hexstring"
   */
  hashInstruction(instruction: string): string {
    const normalized = this.normalizeInstruction(instruction);
    const hash = createHash('sha256').update(normalized, 'utf8').digest('hex');
    return `sha256:${hash}`;
  }

  /**
   * Normalize an instruction for consistent hashing
   *
   * Prevents bypass attempts via:
   * - Whitespace variations
   * - Unicode tricks
   * - Case differences
   *
   * @param instruction - The instruction to normalize
   * @returns Normalized instruction
   */
  normalizeInstruction(instruction: string): string {
    return instruction
      .toLowerCase() // Normalize case
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\x20-\x7E]/g, '') // Remove non-printable ASCII
      .trim(); // Trim leading/trailing whitespace
  }

  /**
   * Register a new allowed instruction hash
   *
   * @param hash - SHA-256 hash to register
   */
  registerHash(hash: string): void {
    if (!hash.startsWith('sha256:')) {
      throw new InstructionValidationError('Invalid hash format, must start with "sha256:"');
    }
    this.hashSet.add(hash);
    logger.info({ hash }, 'Registered new instruction hash');
  }

  /**
   * Register a new instruction template
   *
   * @param template - Template to register
   */
  registerTemplate(template: InstructionTemplate): void {
    this.config.instructionTemplates.push(template);
    this.compileTemplate(template);
    logger.info({ templateId: template.id }, 'Registered new instruction template');
  }

  /**
   * Check if a source is in the allowed sources list
   *
   * @param source - Source identifier to check
   * @returns Whether the source is allowed
   */
  private isSourceAllowed(source: string): boolean {
    const { allowedSources } = this.config.instructionSource;

    // Empty list means no restrictions
    if (allowedSources.length === 0) {
      return true;
    }

    // Check for exact match or wildcard patterns
    return allowedSources.some((allowed) => {
      if (allowed.includes('*')) {
        const regex = new RegExp('^' + allowed.replace(/\*/g, '.*') + '$');
        return regex.test(source);
      }
      return allowed === source;
    });
  }

  /**
   * Compile a template into a regex for matching
   *
   * @param template - Template to compile
   */
  private compileTemplate(template: InstructionTemplate): void {
    // Convert template description to a regex pattern
    // Templates use {{paramName}} syntax for parameters
    let pattern = this.escapeRegex(template.description);

    // Replace {{paramName}} with named capture groups
    pattern = pattern.replace(/\\\{\\\{(\w+)\\\}\\\}/g, '(?<$1>.+?)');

    // Make whitespace flexible
    pattern = pattern.replace(/\s+/g, '\\s+');

    const regex = new RegExp(pattern, 'i');
    this.templateCache.set(template.id, { template, regex });
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
   * Calculate match confidence based on how well the instruction matches the pattern
   *
   * @param instruction - Normalized instruction
   * @param regex - Template regex
   * @returns Confidence score between 0 and 1
   */
  private calculateMatchConfidence(instruction: string, regex: RegExp): number {
    const match = instruction.match(regex);
    if (!match) return 0;

    // Calculate based on how much of the instruction was matched
    const matchLength = match[0].length;
    const instructionLength = instruction.length;

    return Math.min(1, matchLength / instructionLength);
  }
}

/**
 * Common injection patterns to detect in instructions
 */
export const COMMON_INJECTION_PATTERNS = [
  // Instruction override attempts
  /ignore\s+(previous|prior|above)\s+instructions?/i,
  /disregard\s+(all|any)\s+(previous|prior)/i,
  /forget\s+(everything|all)/i,
  /new\s+instructions?\s*:/i,

  // Role manipulation
  /you\s+are\s+(now|actually)/i,
  /pretend\s+(to\s+be|you're)/i,
  /act\s+as\s+(if|though)/i,
  /your\s+new\s+role/i,

  // System prompt extraction
  /what\s+(is|are)\s+your\s+(system|initial)\s+(prompt|instructions?)/i,
  /reveal\s+(your|the)\s+(system|initial)/i,
  /show\s+me\s+(your|the)\s+(original|system)/i,

  // Jailbreak attempts
  /developer\s+mode/i,
  /dan\s+mode/i,
  /bypass\s+(your|the)\s+(rules|restrictions|safety)/i,
  /enable\s+unrestricted/i,
];

/**
 * Check if content contains potential injection patterns
 *
 * @param content - Content to check
 * @returns Array of detected patterns
 */
export function detectInjectionPatterns(content: string): string[] {
  const detected: string[] = [];

  for (const pattern of COMMON_INJECTION_PATTERNS) {
    if (pattern.test(content)) {
      detected.push(pattern.source);
    }
  }

  return detected;
}

/**
 * Create an InstructionValidator with default configuration
 *
 * @returns InstructionValidator with secure defaults
 */
export function createDefaultInstructionValidator(): InstructionValidator {
  return new InstructionValidator({
    allowedInstructionHashes: [],
    instructionTemplates: [],
    instructionSource: {
      allowedSources: [],
      requireSignature: false,
    },
  });
}
