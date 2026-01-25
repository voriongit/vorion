/**
 * Semantic Governance Service - Main Service
 *
 * Orchestrates all semantic governance validators to provide comprehensive
 * protection against the "confused deputy" problem in AI agents.
 *
 * Features:
 * - Complete agent interaction validation
 * - Pre-action checks (before agent acts)
 * - Post-action checks (after agent produces output)
 * - Credential loading and management
 * - Metrics emission for observability
 *
 * @packageDocumentation
 * @module @vorion/semantic-governance/service
 */

import { Registry, Counter, Histogram, Gauge } from 'prom-client';
import { createLogger } from '../common/logger.js';
import { VorionError } from '../common/errors.js';
import { InstructionValidator } from './instruction-validator.js';
import { OutputValidator } from './output-validator.js';
import { InferenceValidator } from './inference-validator.js';
import { ContextValidator } from './context-validator.js';
import { DualChannelEnforcer } from './dual-channel.js';
import { SemanticCredentialManager, getCredentialManager } from './credential-manager.js';
import type {
  AgentIdentity,
  AgentInteraction,
  ActionRequest,
  ActionRecord,
  SemanticGovernanceCredential,
  SemanticValidationResult,
  PreActionResult,
  PostActionResult,
  TrustProfile,
  InferenceOperation,
  DerivedKnowledge,
} from './types.js';

const logger = createLogger({ component: 'semantic-governance-service' });

// =============================================================================
// METRICS
// =============================================================================

const semanticGovernanceRegistry = new Registry();

// Validation counters
const validationTotal = new Counter({
  name: 'vorion_semantic_validation_total',
  help: 'Total semantic governance validations',
  labelNames: ['type', 'result'] as const,
  registers: [semanticGovernanceRegistry],
});

// Validation duration
const validationDuration = new Histogram({
  name: 'vorion_semantic_validation_duration_seconds',
  help: 'Semantic validation duration in seconds',
  labelNames: ['type'] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [semanticGovernanceRegistry],
});

// Injection detection
const injectionDetectedTotal = new Counter({
  name: 'vorion_semantic_injection_detected_total',
  help: 'Total injection attempts detected',
  labelNames: ['severity'] as const,
  registers: [semanticGovernanceRegistry],
});

// PII detection
const piiDetectedTotal = new Counter({
  name: 'vorion_semantic_pii_detected_total',
  help: 'Total PII instances detected',
  labelNames: ['type', 'action'] as const,
  registers: [semanticGovernanceRegistry],
});

// Channel enforcement
const channelEnforcementTotal = new Counter({
  name: 'vorion_semantic_channel_enforcement_total',
  help: 'Total channel enforcement actions',
  labelNames: ['channel', 'action'] as const,
  registers: [semanticGovernanceRegistry],
});

// Active credentials gauge
const activeCredentials = new Gauge({
  name: 'vorion_semantic_active_credentials',
  help: 'Number of active semantic governance credentials',
  registers: [semanticGovernanceRegistry],
});

/**
 * Error thrown when semantic governance validation fails
 */
export class SemanticGovernanceError extends VorionError {
  override code = 'SEMANTIC_GOVERNANCE_ERROR';
  override statusCode = 403;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details);
    this.name = 'SemanticGovernanceError';
  }
}

/**
 * Semantic Governance Service
 *
 * Main service that orchestrates all semantic governance validators.
 */
export class SemanticGovernanceService {
  private readonly instructionValidator: InstructionValidator;
  private readonly outputValidator: OutputValidator;
  private readonly inferenceValidator: InferenceValidator;
  private readonly contextValidator: ContextValidator;
  private readonly dualChannelEnforcer: DualChannelEnforcer;
  private readonly credentialManager: SemanticCredentialManager;
  private readonly credentialCache: Map<string, SemanticGovernanceCredential>;

  /**
   * Create a new SemanticGovernanceService
   *
   * @param instructionValidator - Instruction integrity validator
   * @param outputValidator - Output schema validator
   * @param inferenceValidator - Inference scope validator
   * @param contextValidator - Context authentication validator
   * @param dualChannelEnforcer - Control/data plane enforcer
   * @param credentialManager - Optional credential manager (uses default if not provided)
   */
  constructor(
    instructionValidator: InstructionValidator,
    outputValidator: OutputValidator,
    inferenceValidator: InferenceValidator,
    contextValidator: ContextValidator,
    dualChannelEnforcer: DualChannelEnforcer,
    credentialManager?: SemanticCredentialManager
  ) {
    this.instructionValidator = instructionValidator;
    this.outputValidator = outputValidator;
    this.inferenceValidator = inferenceValidator;
    this.contextValidator = contextValidator;
    this.dualChannelEnforcer = dualChannelEnforcer;
    this.credentialManager = credentialManager || getCredentialManager();
    this.credentialCache = new Map();

    logger.info('SemanticGovernanceService initialized');
  }

  /**
   * Validate a complete agent interaction
   *
   * @param interaction - The agent interaction to validate
   * @returns Semantic validation result
   */
  async validateInteraction(interaction: AgentInteraction): Promise<SemanticValidationResult> {
    const startTime = Date.now();

    try {
      // Load credential for agent
      const credential = await this.loadCredential(interaction.agent.did);
      if (!credential) {
        logger.warn({ agentDid: interaction.agent.did }, 'No credential found for agent');
        return {
          valid: false,
          interactionId: interaction.id,
          agentDid: interaction.agent.did,
          reason: 'No semantic governance credential found for agent',
          validatedAt: new Date(),
          durationMs: Date.now() - startTime,
        };
      }

      // Pre-action validation
      const preActionResult = this.runPreActionChecks(interaction, credential);
      if (!preActionResult.allowed) {
        validationTotal.inc({ type: 'interaction', result: 'rejected' });
        return {
          valid: false,
          interactionId: interaction.id,
          agentDid: interaction.agent.did,
          preAction: preActionResult,
          reason: preActionResult.reason,
          validatedAt: new Date(),
          durationMs: Date.now() - startTime,
        };
      }

      // Post-action validation (if action record provided)
      let postActionResult: PostActionResult | undefined;
      if (interaction.action && 'output' in interaction.action) {
        postActionResult = this.runPostActionChecks(
          interaction.agent,
          interaction.action as ActionRecord,
          credential
        );
        if (!postActionResult.valid) {
          validationTotal.inc({ type: 'interaction', result: 'rejected' });
          return {
            valid: false,
            interactionId: interaction.id,
            agentDid: interaction.agent.did,
            preAction: preActionResult,
            postAction: postActionResult,
            reason: postActionResult.reason,
            validatedAt: new Date(),
            durationMs: Date.now() - startTime,
          };
        }
      }

      validationTotal.inc({ type: 'interaction', result: 'allowed' });
      return {
        valid: true,
        interactionId: interaction.id,
        agentDid: interaction.agent.did,
        preAction: preActionResult,
        postAction: postActionResult,
        validatedAt: new Date(),
        durationMs: Date.now() - startTime,
      };
    } finally {
      validationDuration.observe({ type: 'interaction' }, (Date.now() - startTime) / 1000);
    }
  }

  /**
   * Perform pre-action validation
   *
   * @param agent - Agent identity
   * @param action - Action request
   * @returns Pre-action result
   */
  preActionCheck(agent: AgentIdentity, action: ActionRequest): PreActionResult {
    const startTime = Date.now();

    try {
      const credential = this.credentialCache.get(agent.did);
      if (!credential) {
        return {
          allowed: false,
          reason: 'No credential loaded for agent',
        };
      }

      const interaction: AgentInteraction = {
        id: `pre-action-${Date.now()}`,
        agent,
        message: {
          source: 'pre-action-check',
          content: action.instruction || '',
          authenticated: true,
          timestamp: new Date(),
        },
        instruction: action.instruction,
        context: action.contextSources?.map((cs) => ({
          providerId: cs.providerId,
          content: cs.content,
          signature: cs.signature,
        })),
        action,
      };

      return this.runPreActionChecks(interaction, credential);
    } finally {
      validationDuration.observe({ type: 'pre-action' }, (Date.now() - startTime) / 1000);
    }
  }

  /**
   * Perform post-action validation
   *
   * @param agent - Agent identity
   * @param action - Action record
   * @returns Post-action result
   */
  postActionCheck(agent: AgentIdentity, action: ActionRecord): PostActionResult {
    const startTime = Date.now();

    try {
      const credential = this.credentialCache.get(agent.did);
      if (!credential) {
        return {
          valid: false,
          reason: 'No credential loaded for agent',
        };
      }

      return this.runPostActionChecks(agent, action, credential);
    } finally {
      validationDuration.observe({ type: 'post-action' }, (Date.now() - startTime) / 1000);
    }
  }

  /**
   * Load credential for an agent
   *
   * @param agentId - Agent identifier (DID)
   * @returns Semantic governance credential or undefined
   */
  async loadCredential(agentId: string): Promise<SemanticGovernanceCredential | undefined> {
    // Check cache first
    const cached = this.credentialCache.get(agentId);
    if (cached) {
      return cached;
    }

    // Load from credential manager
    const credential = this.credentialManager.getCredentialByAgent(agentId);
    if (credential) {
      this.credentialCache.set(agentId, credential);
      activeCredentials.set(this.credentialCache.size);
      return credential;
    }

    return undefined;
  }

  /**
   * Clear the credential cache
   */
  clearCredentialCache(): void {
    this.credentialCache.clear();
    activeCredentials.set(0);
  }

  /**
   * Get metrics registry for this service
   */
  getMetricsRegistry(): Registry {
    return semanticGovernanceRegistry;
  }

  /**
   * Run pre-action checks
   */
  private runPreActionChecks(
    interaction: AgentInteraction,
    credential: SemanticGovernanceCredential
  ): PreActionResult {
    const warnings: string[] = [];

    // 1. Classify message channel
    const channelClassification = this.dualChannelEnforcer.classifyMessage({
      source: interaction.message.source,
      authenticated: interaction.message.authenticated,
    });

    // 2. Enforce channel separation
    const channelEnforcement = this.dualChannelEnforcer.enforceChannelSeparation(
      {
        content: interaction.message.content,
        source: interaction.message.source,
        authenticated: interaction.message.authenticated,
      },
      channelClassification.channel
    );

    channelEnforcementTotal.inc({
      channel: channelClassification.channel,
      action: channelEnforcement.action,
    });

    if (!channelEnforcement.allowed) {
      return {
        allowed: false,
        reason: channelEnforcement.reason,
        channelEnforcement,
      };
    }

    if (channelEnforcement.action === 'warn' && channelEnforcement.strippedInstructions) {
      warnings.push(`Warning: Instructions detected in ${channelClassification.channel} plane`);
    }

    // 3. Validate instruction integrity
    if (interaction.instruction) {
      // Create a temporary validator with the credential's config
      const instructionValidator = new InstructionValidator(credential.instructionIntegrity);
      const instructionValidation = instructionValidator.validateInstruction(interaction.instruction);

      if (!instructionValidation.valid) {
        validationTotal.inc({ type: 'instruction', result: 'rejected' });
        return {
          allowed: false,
          reason: instructionValidation.reason || 'Instruction validation failed',
          instructionValidation,
          channelEnforcement,
        };
      }
      validationTotal.inc({ type: 'instruction', result: 'allowed' });
    }

    // 4. Validate context sources
    const contextValidations = [];
    if (interaction.context) {
      const contextValidator = new ContextValidator(credential.contextAuthentication);

      for (const ctx of interaction.context) {
        // Create a mock trust profile - in production, this would be fetched
        const trustProfile: TrustProfile = {
          did: ctx.providerId,
          trustTier: interaction.agent.trustTier,
          domains: interaction.agent.domains,
          trustScore: 500, // Default mid-range score
        };

        const contextValidation = contextValidator.validateContext(
          ctx.providerId,
          trustProfile,
          ctx.content,
          ctx.signature,
          ctx.timestamp
        );

        contextValidations.push(contextValidation);

        if (!contextValidation.valid) {
          validationTotal.inc({ type: 'context', result: 'rejected' });

          // Track injection detection
          if (contextValidation.injectionScan?.detected) {
            injectionDetectedTotal.inc({ severity: contextValidation.injectionScan.severity || 'unknown' });
          }

          return {
            allowed: false,
            reason: contextValidation.reason || 'Context validation failed',
            contextValidations,
            channelEnforcement,
          };
        }
      }
      validationTotal.inc({ type: 'context', result: 'allowed' });
    }

    // 5. Validate inference operations
    const inferenceValidations = [];
    const actionRequest = interaction.action as ActionRequest | undefined;
    if (actionRequest?.inferenceOperations) {
      const inferenceValidator = new InferenceValidator(credential.inferenceScope);

      for (const op of actionRequest.inferenceOperations) {
        const inferenceValidation = inferenceValidator.validateInference(op);
        inferenceValidations.push(inferenceValidation);

        if (!inferenceValidation.valid) {
          validationTotal.inc({ type: 'inference', result: 'rejected' });
          return {
            allowed: false,
            reason: inferenceValidation.reason || 'Inference validation failed',
            inferenceValidations,
            channelEnforcement,
          };
        }
      }
      validationTotal.inc({ type: 'inference', result: 'allowed' });
    }

    return {
      allowed: true,
      channelEnforcement,
      contextValidations: contextValidations.length > 0 ? contextValidations : undefined,
      inferenceValidations: inferenceValidations.length > 0 ? inferenceValidations : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Run post-action checks
   */
  private runPostActionChecks(
    agent: AgentIdentity,
    action: ActionRecord,
    credential: SemanticGovernanceCredential
  ): PostActionResult {
    const warnings: string[] = [];

    // 1. Validate output against schemas
    const outputValidator = new OutputValidator(credential.outputBinding);
    const outputValidation = outputValidator.validateOutput(action.output);

    if (!outputValidation.valid) {
      validationTotal.inc({ type: 'output', result: 'rejected' });
      return {
        valid: false,
        reason: outputValidation.reason || 'Output validation failed',
        outputValidation,
      };
    }
    validationTotal.inc({ type: 'output', result: 'allowed' });

    // 2. Validate external endpoints
    if (action.externalEndpoints) {
      for (const endpoint of action.externalEndpoints) {
        if (!outputValidator.validateExternalEndpoint(endpoint)) {
          return {
            valid: false,
            reason: `Unauthorized external endpoint: ${endpoint}`,
            outputValidation,
          };
        }
      }
    }

    // 3. Validate derived knowledge
    const inferenceValidations = [];
    const piiChecks = [];

    if (action.derivedKnowledge) {
      const inferenceValidator = new InferenceValidator(credential.inferenceScope);

      for (const knowledge of action.derivedKnowledge) {
        // Create inference operation from knowledge
        const op: InferenceOperation = {
          type: knowledge.type,
          sourceDomains: knowledge.sourceDomains,
        };

        const inferenceValidation = inferenceValidator.validateInference(op);
        inferenceValidations.push(inferenceValidation);

        if (!inferenceValidation.valid) {
          return {
            valid: false,
            reason: inferenceValidation.reason || 'Derived knowledge exceeds inference scope',
            outputValidation,
            inferenceValidations,
          };
        }

        // Check PII in derived knowledge
        const piiCheck = inferenceValidator.checkPIIInference(knowledge.content);
        piiChecks.push(piiCheck);

        if (piiCheck.containsPII) {
          for (const piiType of piiCheck.piiTypes) {
            piiDetectedTotal.inc({ type: piiType, action: piiCheck.action });
          }

          if (piiCheck.action === 'blocked') {
            return {
              valid: false,
              reason: `PII detected in derived knowledge: ${piiCheck.piiTypes.join(', ')}`,
              outputValidation,
              inferenceValidations,
              piiChecks,
            };
          }
        }
      }
    }

    // 4. Sanitize output if needed
    let sanitizedOutput: unknown;
    if (outputValidation.patternScan?.detected) {
      const sanitized = outputValidator.sanitizeOutput(action.output);
      if (sanitized.modified) {
        sanitizedOutput = sanitized.content;
        warnings.push(`Output sanitized: ${sanitized.redactions.map((r) => r.description).join(', ')}`);
      }
    }

    return {
      valid: true,
      outputValidation,
      inferenceValidations: inferenceValidations.length > 0 ? inferenceValidations : undefined,
      piiChecks: piiChecks.length > 0 ? piiChecks : undefined,
      sanitizedOutput,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }
}

/**
 * Create a SemanticGovernanceService with default validators
 *
 * @param credential - Optional credential to use for validation
 * @returns Configured SemanticGovernanceService
 */
export function createSemanticGovernanceService(
  credential?: SemanticGovernanceCredential
): SemanticGovernanceService {
  const config = credential || {
    instructionIntegrity: {
      allowedInstructionHashes: [],
      instructionTemplates: [],
      instructionSource: { allowedSources: [], requireSignature: false },
    },
    outputBinding: {
      allowedSchemas: [],
      prohibitedPatterns: [],
      allowedExternalEndpoints: [],
      blockedExternalEndpoints: ['*'],
    },
    inferenceScope: {
      globalLevel: 2, // ENTITY level
      domainOverrides: [],
      derivedKnowledgeHandling: { retention: 'session', allowedRecipients: [], crossContextSharing: false },
      piiInference: { allowed: false, handling: 'redact' },
    },
    contextAuthentication: {
      required: true,
      minTrustTier: 2,
      allowedProviders: [],
      blockedProviders: [],
      contentIntegrity: { signatureRequired: false, maxAge: 300, allowedFormats: ['application/json', 'text/plain'] },
    },
    dualChannel: {
      enforced: true,
      controlPlaneSources: ['user-direct-input', 'signed-system-instruction', 'authenticated-api-command'],
      dataPlaneTreatment: 'sanitize',
    },
  };

  return new SemanticGovernanceService(
    new InstructionValidator(config.instructionIntegrity),
    new OutputValidator(config.outputBinding),
    new InferenceValidator(config.inferenceScope),
    new ContextValidator(config.contextAuthentication),
    new DualChannelEnforcer(config.dualChannel)
  );
}

/**
 * Get metrics as Prometheus text format
 */
export async function getSemanticGovernanceMetrics(): Promise<string> {
  return semanticGovernanceRegistry.metrics();
}

/**
 * Get metrics content type
 */
export function getSemanticGovernanceMetricsContentType(): string {
  return semanticGovernanceRegistry.contentType;
}
