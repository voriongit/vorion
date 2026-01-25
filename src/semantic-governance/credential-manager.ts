/**
 * Semantic Credential Manager - Semantic Governance Credentials
 *
 * Manages the lifecycle of Semantic Governance Credentials that bind agents
 * to their allowed behaviors. These credentials cryptographically bind an agent
 * to approved instructions, output schemas, inference limits, and context requirements.
 *
 * Features:
 * - Credential creation with validation
 * - Credential storage and retrieval
 * - Credential updates with versioning
 * - Credential verification
 *
 * @packageDocumentation
 * @module @vorion/semantic-governance/credential-manager
 */

import { randomUUID } from 'crypto';
import { createLogger } from '../common/logger.js';
import { VorionError, ValidationError } from '../common/errors.js';
import {
  SemanticGovernanceCredentialSchema,
  type SemanticGovernanceCredential,
  type SemanticGovernanceConfig,
  type InstructionIntegrity,
  type OutputBinding,
  type InferenceScope,
  type ContextAuthenticationRequirements,
  type DualChannelConfig,
  DEFAULT_INSTRUCTION_INTEGRITY,
  DEFAULT_OUTPUT_BINDING,
  DEFAULT_INFERENCE_SCOPE,
  DEFAULT_CONTEXT_AUTHENTICATION,
  DEFAULT_DUAL_CHANNEL,
  InferenceLevel,
  TrustTier,
} from './types.js';

const logger = createLogger({ component: 'credential-manager' });

/**
 * Error thrown when credential operations fail
 */
export class CredentialError extends VorionError {
  override code = 'CREDENTIAL_ERROR';
  override statusCode = 400;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details);
    this.name = 'CredentialError';
  }
}

/**
 * Validation result for credentials
 */
export interface CredentialValidationResult {
  /** Whether the credential is valid */
  valid: boolean;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
  /** Expiration status */
  expired?: boolean;
  /** Days until expiration */
  daysUntilExpiration?: number;
}

/**
 * Semantic Credential Manager
 *
 * Manages semantic governance credentials for agents.
 */
export class SemanticCredentialManager {
  private readonly credentials: Map<string, SemanticGovernanceCredential>;
  private readonly agentCredentialIndex: Map<string, string>; // agentId -> credentialId

  /**
   * Create a new SemanticCredentialManager
   */
  constructor() {
    this.credentials = new Map();
    this.agentCredentialIndex = new Map();

    logger.debug('SemanticCredentialManager initialized');
  }

  /**
   * Create a new semantic governance credential
   *
   * @param agentId - Agent identifier (DID)
   * @param aci - Agent Classification Identifier
   * @param config - Semantic governance configuration
   * @returns Created credential
   */
  createCredential(
    agentId: string,
    aci: string,
    config: SemanticGovernanceConfig
  ): SemanticGovernanceCredential {
    const credentialId = `sgc:${randomUUID()}`;

    // Merge with defaults
    const credential: SemanticGovernanceCredential = {
      id: credentialId,
      aci,
      instructionIntegrity: this.mergeWithDefaults(
        config.instructionIntegrity,
        DEFAULT_INSTRUCTION_INTEGRITY
      ),
      outputBinding: this.mergeWithDefaults(config.outputBinding, DEFAULT_OUTPUT_BINDING),
      inferenceScope: this.mergeWithDefaults(config.inferenceScope, DEFAULT_INFERENCE_SCOPE),
      contextAuthentication: this.mergeWithDefaults(
        config.contextAuthentication,
        DEFAULT_CONTEXT_AUTHENTICATION
      ),
      dualChannel: this.mergeWithDefaults(config.dualChannel, DEFAULT_DUAL_CHANNEL),
      metadata: {
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 180 days default
        version: '1.0.0',
      },
    };

    // Validate the credential
    const validation = this.validateCredential(credential);
    if (!validation.valid) {
      throw new ValidationError('Invalid credential configuration', {
        errors: validation.errors,
      });
    }

    // Store the credential
    this.credentials.set(credentialId, credential);
    this.agentCredentialIndex.set(agentId, credentialId);

    logger.info(
      {
        credentialId,
        agentId,
        aci,
      },
      'Created semantic governance credential'
    );

    return credential;
  }

  /**
   * Validate a semantic governance credential
   *
   * @param credential - Credential to validate
   * @returns Validation result
   */
  validateCredential(credential: SemanticGovernanceCredential): CredentialValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Schema validation
    const schemaResult = SemanticGovernanceCredentialSchema.safeParse(credential);
    if (!schemaResult.success) {
      for (const issue of schemaResult.error.issues) {
        errors.push(`${issue.path.join('.')}: ${issue.message}`);
      }
    }

    // Business logic validation
    this.validateInstructionIntegrity(credential.instructionIntegrity, errors, warnings);
    this.validateOutputBinding(credential.outputBinding, errors, warnings);
    this.validateInferenceScope(credential.inferenceScope, errors, warnings);
    this.validateContextAuthentication(credential.contextAuthentication, errors, warnings);
    this.validateDualChannel(credential.dualChannel, errors, warnings);

    // Check expiration
    let expired = false;
    let daysUntilExpiration: number | undefined;
    if (credential.metadata?.expiresAt) {
      const now = new Date();
      const expiresAt = new Date(credential.metadata.expiresAt);
      expired = expiresAt < now;
      daysUntilExpiration = Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

      if (expired) {
        errors.push('Credential has expired');
      } else if (daysUntilExpiration < 30) {
        warnings.push(`Credential expires in ${daysUntilExpiration} days`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      expired,
      daysUntilExpiration,
    };
  }

  /**
   * Update a credential configuration
   *
   * @param credentialId - Credential ID to update
   * @param updates - Partial configuration updates
   * @returns Updated credential
   */
  updateCredential(
    credentialId: string,
    updates: Partial<SemanticGovernanceConfig>
  ): SemanticGovernanceCredential {
    const existing = this.credentials.get(credentialId);
    if (!existing) {
      throw new CredentialError(`Credential not found: ${credentialId}`);
    }

    // Apply updates
    const updated: SemanticGovernanceCredential = {
      ...existing,
      instructionIntegrity: updates.instructionIntegrity
        ? this.mergeWithDefaults(updates.instructionIntegrity, existing.instructionIntegrity)
        : existing.instructionIntegrity,
      outputBinding: updates.outputBinding
        ? this.mergeWithDefaults(updates.outputBinding, existing.outputBinding)
        : existing.outputBinding,
      inferenceScope: updates.inferenceScope
        ? this.mergeWithDefaults(updates.inferenceScope, existing.inferenceScope)
        : existing.inferenceScope,
      contextAuthentication: updates.contextAuthentication
        ? this.mergeWithDefaults(updates.contextAuthentication, existing.contextAuthentication)
        : existing.contextAuthentication,
      dualChannel: updates.dualChannel
        ? this.mergeWithDefaults(updates.dualChannel, existing.dualChannel)
        : existing.dualChannel,
      metadata: {
        ...existing.metadata,
        version: this.incrementVersion(existing.metadata?.version || '1.0.0'),
      },
    };

    // Validate the updated credential
    const validation = this.validateCredential(updated);
    if (!validation.valid) {
      throw new ValidationError('Invalid credential update', {
        errors: validation.errors,
      });
    }

    // Store the updated credential
    this.credentials.set(credentialId, updated);

    logger.info(
      {
        credentialId,
        version: updated.metadata?.version,
      },
      'Updated semantic governance credential'
    );

    return updated;
  }

  /**
   * Get a credential by ID
   *
   * @param credentialId - Credential ID
   * @returns Credential or undefined
   */
  getCredential(credentialId: string): SemanticGovernanceCredential | undefined {
    return this.credentials.get(credentialId);
  }

  /**
   * Get a credential by agent ID
   *
   * @param agentId - Agent identifier
   * @returns Credential or undefined
   */
  getCredentialByAgent(agentId: string): SemanticGovernanceCredential | undefined {
    const credentialId = this.agentCredentialIndex.get(agentId);
    if (!credentialId) {
      return undefined;
    }
    return this.credentials.get(credentialId);
  }

  /**
   * Delete a credential
   *
   * @param credentialId - Credential ID to delete
   * @returns Whether deletion was successful
   */
  deleteCredential(credentialId: string): boolean {
    const credential = this.credentials.get(credentialId);
    if (!credential) {
      return false;
    }

    // Remove from agent index
    for (const [agentId, cid] of Array.from(this.agentCredentialIndex.entries())) {
      if (cid === credentialId) {
        this.agentCredentialIndex.delete(agentId);
        break;
      }
    }

    // Remove credential
    this.credentials.delete(credentialId);

    logger.info({ credentialId }, 'Deleted semantic governance credential');

    return true;
  }

  /**
   * List all credentials
   *
   * @returns Array of all credentials
   */
  listCredentials(): SemanticGovernanceCredential[] {
    return Array.from(this.credentials.values());
  }

  /**
   * Create a default credential for testing/development
   *
   * @param agentId - Agent identifier
   * @param aci - Agent Classification Identifier
   * @returns Default credential
   */
  createDefaultCredential(agentId: string, aci: string): SemanticGovernanceCredential {
    return this.createCredential(agentId, aci, {});
  }

  /**
   * Create a restrictive credential for high-security agents
   *
   * @param agentId - Agent identifier
   * @param aci - Agent Classification Identifier
   * @param allowedInstructionHashes - Allowed instruction hashes
   * @returns Restrictive credential
   */
  createRestrictiveCredential(
    agentId: string,
    aci: string,
    allowedInstructionHashes: string[]
  ): SemanticGovernanceCredential {
    return this.createCredential(agentId, aci, {
      instructionIntegrity: {
        allowedInstructionHashes,
        instructionTemplates: [],
        instructionSource: {
          allowedSources: [],
          requireSignature: true,
        },
      },
      outputBinding: {
        allowedSchemas: [],
        prohibitedPatterns: DEFAULT_OUTPUT_BINDING.prohibitedPatterns,
        allowedExternalEndpoints: [],
        blockedExternalEndpoints: ['*'],
      },
      inferenceScope: {
        globalLevel: InferenceLevel.STATISTICAL,
        domainOverrides: [
          { domain: 'F', level: InferenceLevel.NONE, reason: 'Financial data protected' },
          { domain: 'S', level: InferenceLevel.NONE, reason: 'Security data protected' },
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
      },
      contextAuthentication: {
        required: true,
        minTrustTier: TrustTier.T3_CERTIFIED,
        allowedProviders: [],
        blockedProviders: ['did:*:untrusted:*'],
        contentIntegrity: {
          signatureRequired: true,
          maxAge: 60,
          allowedFormats: ['application/json'],
        },
      },
      dualChannel: {
        enforced: true,
        controlPlaneSources: ['signed-system-instruction', 'admin-console'],
        dataPlaneTreatment: 'block',
      },
    });
  }

  /**
   * Merge partial config with defaults
   */
  private mergeWithDefaults<T extends object>(partial: Partial<T> | undefined, defaults: T): T {
    if (!partial) {
      return { ...defaults };
    }
    return { ...defaults, ...partial } as T;
  }

  /**
   * Increment semantic version
   */
  private incrementVersion(version: string): string {
    const parts = version.split('.').map(Number);
    parts[2] = (parts[2] || 0) + 1; // Increment patch
    return parts.join('.');
  }

  /**
   * Validate instruction integrity configuration
   */
  private validateInstructionIntegrity(
    config: InstructionIntegrity,
    errors: string[],
    warnings: string[]
  ): void {
    // Validate hash format
    for (const hash of config.allowedInstructionHashes) {
      if (!hash.startsWith('sha256:') || hash.length !== 71) {
        errors.push(`Invalid instruction hash format: ${hash}`);
      }
    }

    // Validate templates
    for (const template of config.instructionTemplates) {
      if (!template.id || !template.hash || !template.description) {
        errors.push(`Invalid template: missing required fields`);
      }
    }

    // Warn if no hashes or templates defined
    if (config.allowedInstructionHashes.length === 0 && config.instructionTemplates.length === 0) {
      warnings.push('No instruction hashes or templates defined - all instructions will require signed source');
    }
  }

  /**
   * Validate output binding configuration
   */
  private validateOutputBinding(
    config: OutputBinding,
    errors: string[],
    warnings: string[]
  ): void {
    // Validate schemas
    for (const schema of config.allowedSchemas) {
      if (!schema.id || !schema.jsonSchema) {
        errors.push(`Invalid output schema: missing required fields`);
      }
    }

    // Validate patterns
    for (const pattern of config.prohibitedPatterns) {
      if (pattern.type === 'regex') {
        try {
          new RegExp(pattern.pattern);
        } catch {
          errors.push(`Invalid regex pattern: ${pattern.pattern}`);
        }
      }
    }

    // Warn about endpoint configuration
    if (config.allowedExternalEndpoints.length === 0 && config.blockedExternalEndpoints.includes('*')) {
      // This is fine - no external endpoints allowed
    } else if (config.allowedExternalEndpoints.length === 0 && !config.blockedExternalEndpoints.includes('*')) {
      warnings.push('No external endpoints configured - consider setting allowedExternalEndpoints or blocking all');
    }
  }

  /**
   * Validate inference scope configuration
   */
  private validateInferenceScope(
    config: InferenceScope,
    errors: string[],
    warnings: string[]
  ): void {
    // Validate domain overrides don't exceed global level
    for (const override of config.domainOverrides) {
      if (override.level > config.globalLevel) {
        warnings.push(
          `Domain ${override.domain} override level ${override.level} exceeds global level ${config.globalLevel} - will be capped`
        );
      }
    }

    // Warn about PII settings
    if (config.piiInference.allowed && config.globalLevel >= InferenceLevel.ENTITY) {
      warnings.push('PII inference allowed with entity-level inference - ensure compliance with data protection regulations');
    }
  }

  /**
   * Validate context authentication configuration
   */
  private validateContextAuthentication(
    config: ContextAuthenticationRequirements,
    errors: string[],
    warnings: string[]
  ): void {
    // Validate max age
    if (config.contentIntegrity.maxAge <= 0) {
      errors.push('Content integrity maxAge must be positive');
    }

    // Warn about relaxed settings
    if (!config.required) {
      warnings.push('Context authentication not required - agents may process unauthenticated context');
    }

    if (!config.contentIntegrity.signatureRequired && config.required) {
      warnings.push('Signatures not required for authenticated context - content integrity not guaranteed');
    }
  }

  /**
   * Validate dual channel configuration
   */
  private validateDualChannel(
    config: DualChannelConfig,
    errors: string[],
    warnings: string[]
  ): void {
    // Validate control plane sources
    if (config.enforced && config.controlPlaneSources.length === 0) {
      errors.push('Dual channel enforced but no control plane sources defined');
    }

    // Warn about permissive settings
    if (!config.enforced) {
      warnings.push('Dual channel not enforced - data plane content may contain instructions');
    }

    if (config.dataPlaneTreatment === 'warn') {
      warnings.push('Data plane treatment is "warn" only - instructions in data plane will not be blocked');
    }
  }
}

/**
 * Create a singleton credential manager
 */
let credentialManagerInstance: SemanticCredentialManager | null = null;

export function getCredentialManager(): SemanticCredentialManager {
  if (!credentialManagerInstance) {
    credentialManagerInstance = new SemanticCredentialManager();
  }
  return credentialManagerInstance;
}

/**
 * Reset the credential manager (for testing)
 */
export function resetCredentialManager(): void {
  credentialManagerInstance = null;
}
