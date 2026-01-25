/**
 * Inference Validator - Inference Scope Enforcement
 *
 * Controls what an agent can derive from accessed data.
 * OAuth scopes control DATA ACCESS; Inference Scope controls what can be DERIVED.
 *
 * Features:
 * - Global inference level limits
 * - Domain-specific overrides
 * - Derived knowledge retention policies
 * - PII inference controls
 *
 * @packageDocumentation
 * @module @vorion/semantic-governance/inference-validator
 */

import { createHash } from 'crypto';
import { createLogger } from '../common/logger.js';
import { VorionError } from '../common/errors.js';
import {
  InferenceLevel,
  INFERENCE_LEVEL_NAMES,
  type InferenceScope,
  type InferenceOperation,
  type InferenceOperationType,
  type DomainCode,
  type DerivedKnowledge,
  type InferenceValidationResult,
  type HandlingResult,
  type PIICheckResult,
} from './types.js';

const logger = createLogger({ component: 'inference-validator' });

/**
 * Error thrown when inference validation fails
 */
export class InferenceScopeError extends VorionError {
  override code = 'INFERENCE_SCOPE_ERROR';
  override statusCode = 403;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details);
    this.name = 'InferenceScopeError';
  }
}

/**
 * Mapping of inference operation types to required levels
 */
export const OPERATION_LEVEL_REQUIREMENTS: Record<InferenceOperationType, InferenceLevel> = {
  aggregate: InferenceLevel.STATISTICAL,
  count: InferenceLevel.STATISTICAL,
  average: InferenceLevel.STATISTICAL,
  'entity-extraction': InferenceLevel.ENTITY,
  'relationship-inference': InferenceLevel.RELATIONAL,
  'pattern-prediction': InferenceLevel.PREDICTIVE,
  'sentiment-analysis': InferenceLevel.ENTITY,
  classification: InferenceLevel.ENTITY,
  summarization: InferenceLevel.ENTITY,
  custom: InferenceLevel.UNRESTRICTED,
};

/**
 * Common PII patterns for detection
 */
const PII_PATTERNS: Array<{ type: string; pattern: RegExp }> = [
  { type: 'email', pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi },
  { type: 'ssn', pattern: /\b\d{3}-\d{2}-\d{4}\b/g },
  { type: 'phone', pattern: /\b(?:\+1[-.]?)?\(?[2-9][0-9]{2}\)?[-.]?[2-9][0-9]{2}[-.]?[0-9]{4}\b/g },
  { type: 'credit_card', pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b/g },
  { type: 'dob', pattern: /\b(?:0?[1-9]|1[0-2])[-/](?:0?[1-9]|[12]\d|3[01])[-/](?:19|20)\d{2}\b/g },
  { type: 'address', pattern: /\b\d+\s+[\w\s]+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|way|boulevard|blvd)\b/gi },
  { type: 'name', pattern: /\b(?:Mr|Mrs|Ms|Dr|Prof)\.?\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b/g },
];

/**
 * Inference Validator
 *
 * Validates inference operations against the configured inference scope rules.
 */
export class InferenceValidator {
  private readonly config: InferenceScope;
  private readonly domainLevelCache: Map<DomainCode, InferenceLevel>;

  /**
   * Create a new InferenceValidator
   *
   * @param config - Inference scope configuration
   */
  constructor(config: InferenceScope) {
    this.config = config;
    this.domainLevelCache = new Map();

    // Pre-compute effective levels for all domains
    for (const override of config.domainOverrides) {
      this.domainLevelCache.set(override.domain, override.level);
    }

    logger.debug(
      {
        globalLevel: INFERENCE_LEVEL_NAMES[config.globalLevel],
        domainOverrides: config.domainOverrides.length,
        piiAllowed: config.piiInference.allowed,
        retention: config.derivedKnowledgeHandling.retention,
      },
      'InferenceValidator initialized'
    );
  }

  /**
   * Check if an inference operation is allowed
   *
   * @param operation - The inference operation to validate
   * @returns Validation result
   */
  validateInference(operation: InferenceOperation): InferenceValidationResult {
    const startTime = Date.now();

    try {
      // Determine required level for this operation
      const requiredLevel =
        operation.type === 'custom' && operation.customLevel !== undefined
          ? operation.customLevel
          : OPERATION_LEVEL_REQUIREMENTS[operation.type];

      // Check global level first
      if (requiredLevel > this.config.globalLevel) {
        logger.warn(
          {
            operation: operation.type,
            requiredLevel: INFERENCE_LEVEL_NAMES[requiredLevel],
            globalLevel: INFERENCE_LEVEL_NAMES[this.config.globalLevel],
          },
          'Inference operation exceeds global level'
        );
        return {
          valid: false,
          reason: `Inference operation '${operation.type}' requires level ${INFERENCE_LEVEL_NAMES[requiredLevel]}, but global level is ${INFERENCE_LEVEL_NAMES[this.config.globalLevel]}`,
          requiredLevel,
          agentLevel: this.config.globalLevel,
        };
      }

      // Check domain-specific restrictions
      for (const domain of operation.sourceDomains) {
        const domainLevel = this.getEffectiveLevel(domain);
        if (requiredLevel > domainLevel) {
          logger.warn(
            {
              operation: operation.type,
              domain,
              requiredLevel: INFERENCE_LEVEL_NAMES[requiredLevel],
              domainLevel: INFERENCE_LEVEL_NAMES[domainLevel],
            },
            'Inference operation exceeds domain level'
          );
          return {
            valid: false,
            reason: `Domain '${domain}' restricts inference to level ${INFERENCE_LEVEL_NAMES[domainLevel]}`,
            requiredLevel,
            agentLevel: domainLevel,
            restrictedDomain: domain,
          };
        }
      }

      logger.debug(
        {
          operation: operation.type,
          sourceDomains: operation.sourceDomains,
        },
        'Inference operation allowed'
      );

      return { valid: true };
    } finally {
      const duration = Date.now() - startTime;
      logger.debug({ durationMs: duration }, 'Inference validation completed');
    }
  }

  /**
   * Get the effective inference level for a domain
   *
   * @param domain - Domain code
   * @returns Effective inference level
   */
  getEffectiveLevel(domain: DomainCode): InferenceLevel {
    // Check domain-specific override
    const override = this.domainLevelCache.get(domain);
    if (override !== undefined) {
      // Domain override can only be more restrictive than global
      return Math.min(override, this.config.globalLevel);
    }

    // Fall back to global level
    return this.config.globalLevel;
  }

  /**
   * Handle derived knowledge according to policy
   *
   * @param knowledge - The derived knowledge to handle
   * @returns Handling result
   */
  handleDerivedKnowledge(knowledge: DerivedKnowledge): HandlingResult {
    const { derivedKnowledgeHandling } = this.config;

    // Check retention policy
    if (derivedKnowledgeHandling.retention === 'none') {
      logger.debug({ knowledgeId: knowledge.id }, 'Derived knowledge discarded (retention: none)');
      return {
        action: 'discarded',
        reason: 'Retention policy is set to none',
      };
    }

    // Check if cross-context sharing is attempted
    // This would need additional context about the current session
    // For now, we just log and allow based on the flag
    if (!derivedKnowledgeHandling.crossContextSharing) {
      logger.debug({ knowledgeId: knowledge.id }, 'Cross-context sharing disabled');
    }

    // Check PII in derived knowledge
    const piiResult = this.checkPIIInference(knowledge.content);
    if (piiResult.containsPII && !this.config.piiInference.allowed) {
      if (this.config.piiInference.handling === 'block') {
        return {
          action: 'discarded',
          reason: 'Derived knowledge contains PII and PII inference is not allowed',
        };
      } else if (this.config.piiInference.handling === 'redact') {
        const redactedKnowledge = {
          ...knowledge,
          content: piiResult.modifiedData,
        };
        return {
          action: 'redacted',
          reason: 'PII redacted from derived knowledge',
          modifiedKnowledge: redactedKnowledge,
        };
      } else if (this.config.piiInference.handling === 'hash') {
        const hashedKnowledge = {
          ...knowledge,
          content: piiResult.modifiedData,
        };
        return {
          action: 'redacted',
          reason: 'PII hashed in derived knowledge',
          modifiedKnowledge: hashedKnowledge,
        };
      }
    }

    // Store based on retention policy
    if (derivedKnowledgeHandling.retention === 'session') {
      return {
        action: 'stored',
        reason: 'Derived knowledge stored for session duration',
      };
    } else if (derivedKnowledgeHandling.retention === 'persistent') {
      return {
        action: 'stored',
        reason: 'Derived knowledge stored persistently',
      };
    }

    return {
      action: 'stored',
      reason: 'Derived knowledge stored according to policy',
    };
  }

  /**
   * Check data for PII inference
   *
   * @param data - Data to check
   * @returns PII check result
   */
  checkPIIInference(data: unknown): PIICheckResult {
    const content = typeof data === 'string' ? data : JSON.stringify(data);
    const detectedTypes: string[] = [];
    let modifiedContent = content;

    // Check all PII patterns
    for (const { type, pattern } of PII_PATTERNS) {
      const matches = content.match(pattern);
      if (matches && matches.length > 0) {
        detectedTypes.push(type);

        // Apply handling based on config
        if (this.config.piiInference.handling === 'redact') {
          modifiedContent = modifiedContent.replace(pattern, `[REDACTED_${type.toUpperCase()}]`);
        } else if (this.config.piiInference.handling === 'hash') {
          modifiedContent = modifiedContent.replace(pattern, (match) => {
            const hash = createHash('sha256').update(match).digest('hex').substring(0, 16);
            return `[HASH_${hash}]`;
          });
        }
      }
    }

    const containsPII = detectedTypes.length > 0;

    // Determine action taken
    let action: PIICheckResult['action'];
    if (!containsPII) {
      action = 'allowed';
    } else if (this.config.piiInference.allowed) {
      action = 'allowed';
    } else if (this.config.piiInference.handling === 'block') {
      action = 'blocked';
    } else if (this.config.piiInference.handling === 'redact') {
      action = 'redacted';
    } else {
      action = 'hashed';
    }

    // Parse modified content back if it was JSON
    let modifiedData: unknown;
    try {
      modifiedData = JSON.parse(modifiedContent);
    } catch {
      modifiedData = modifiedContent;
    }

    if (containsPII) {
      logger.debug(
        {
          piiTypes: detectedTypes,
          action,
        },
        'PII detected in data'
      );
    }

    return {
      containsPII,
      piiTypes: detectedTypes,
      action,
      modifiedData: action !== 'allowed' ? modifiedData : undefined,
    };
  }

  /**
   * Get the required inference level for an operation type
   *
   * @param operationType - The operation type
   * @returns Required inference level
   */
  getRequiredLevel(operationType: InferenceOperationType): InferenceLevel {
    return OPERATION_LEVEL_REQUIREMENTS[operationType];
  }

  /**
   * Check if a recipient is allowed to receive derived knowledge
   *
   * @param recipientId - Recipient identifier (DID or URL)
   * @returns Whether the recipient is allowed
   */
  isRecipientAllowed(recipientId: string): boolean {
    const { allowedRecipients } = this.config.derivedKnowledgeHandling;

    // Empty list means no restrictions (or no sharing allowed)
    if (allowedRecipients.length === 0) {
      return false;
    }

    // Check for exact match or wildcard patterns
    return allowedRecipients.some((allowed) => {
      if (allowed.includes('*')) {
        const regex = new RegExp('^' + allowed.replace(/\*/g, '.*') + '$');
        return regex.test(recipientId);
      }
      return allowed === recipientId;
    });
  }

  /**
   * Validate a batch of inference operations
   *
   * @param operations - Array of operations to validate
   * @returns Array of validation results
   */
  validateBatch(operations: InferenceOperation[]): InferenceValidationResult[] {
    return operations.map((op) => this.validateInference(op));
  }

  /**
   * Check if any operations in a batch would fail
   *
   * @param operations - Array of operations to check
   * @returns True if all operations are allowed
   */
  allOperationsAllowed(operations: InferenceOperation[]): boolean {
    return operations.every((op) => this.validateInference(op).valid);
  }
}

/**
 * Create an InferenceValidator with default configuration
 *
 * @param globalLevel - Global inference level limit
 * @returns InferenceValidator with secure defaults
 */
export function createDefaultInferenceValidator(globalLevel: InferenceLevel = InferenceLevel.ENTITY): InferenceValidator {
  return new InferenceValidator({
    globalLevel,
    domainOverrides: [],
    derivedKnowledgeHandling: {
      retention: 'session',
      allowedRecipients: [],
      crossContextSharing: false,
    },
    piiInference: {
      allowed: false,
      handling: 'redact',
    },
  });
}

/**
 * Create a restrictive InferenceValidator for sensitive operations
 *
 * @returns InferenceValidator with minimal inference allowed
 */
export function createRestrictiveInferenceValidator(): InferenceValidator {
  return new InferenceValidator({
    globalLevel: InferenceLevel.STATISTICAL,
    domainOverrides: [
      { domain: 'F', level: InferenceLevel.NONE, reason: 'Financial data: no inference allowed' },
      { domain: 'S', level: InferenceLevel.NONE, reason: 'Security data: no inference allowed' },
    ],
    derivedKnowledgeHandling: {
      retention: 'none',
      allowedRecipients: [],
      crossContextSharing: false,
    },
    piiInference: {
      allowed: false,
      handling: 'block',
    },
  });
}
