/**
 * Semantic Governance Module - Layer 5
 *
 * Comprehensive semantic governance for AI agents, addressing the "confused deputy"
 * problem where authenticated agents can be manipulated via prompt injection.
 *
 * This module provides:
 *
 * 1. **Instruction Integrity** - Validates system prompts against approved hashes
 *    and templates to prevent unauthorized instructions.
 *
 * 2. **Output Schema Binding** - Constrains agent output to approved schemas
 *    and scans for prohibited patterns (PII, credentials, etc.).
 *
 * 3. **Inference Scope Controls** - Limits what agents can derive from data
 *    beyond simple data access (e.g., relationship inference, predictions).
 *
 * 4. **Context Authentication** - Validates external context sources (RAG, MCP)
 *    and scans for injection patterns in data plane content.
 *
 * 5. **Dual-Channel Authorization** - Separates control plane (trusted instructions)
 *    from data plane (processed content) to prevent indirect injection.
 *
 * @example
 * ```typescript
 * import {
 *   SemanticGovernanceService,
 *   createSemanticGovernanceService,
 *   SemanticCredentialManager,
 *   InferenceLevel,
 *   TrustTier,
 * } from './semantic-governance';
 *
 * // Create a credential for an agent
 * const credentialManager = new SemanticCredentialManager();
 * const credential = credentialManager.createCredential(
 *   'did:aci:a3i:vorion:banquet-advisor',
 *   'a3i.vorion.banquet-advisor:FHC-L3-T3@1.2.0',
 *   {
 *     inferenceScope: {
 *       globalLevel: InferenceLevel.ENTITY,
 *       piiInference: { allowed: false, handling: 'redact' },
 *     },
 *     contextAuthentication: {
 *       required: true,
 *       minTrustTier: TrustTier.T2_TESTED,
 *     },
 *   }
 * );
 *
 * // Create the service
 * const service = createSemanticGovernanceService(credential);
 *
 * // Validate an interaction
 * const result = await service.validateInteraction({
 *   id: 'interaction-123',
 *   agent: { did: 'did:aci:...', aci: 'a3i.vorion...', trustTier: TrustTier.T3_CERTIFIED, domains: ['F', 'H'] },
 *   message: { source: 'user-direct-input', content: 'Plan a banquet', authenticated: true, timestamp: new Date() },
 * });
 *
 * if (!result.valid) {
 *   console.error('Validation failed:', result.reason);
 * }
 * ```
 *
 * @packageDocumentation
 * @module @vorion/semantic-governance
 */

// =============================================================================
// TYPES
// =============================================================================

export type {
  // Domain types
  DomainCode,

  // Instruction Integrity
  InstructionIntegrity,
  InstructionTemplate,
  InstructionSource,
  InstructionValidationResult,
  TemplateMatchResult,

  // Output Binding
  OutputBinding,
  OutputSchema,
  ProhibitedPattern,
  OutputValidationResult,
  PatternScanResult,
  SanitizedOutput,

  // Inference Scope
  InferenceScope,
  DomainInferenceOverride,
  DerivedKnowledgeHandling,
  PIIInferenceConfig,
  InferenceOperation,
  InferenceOperationType,
  DerivedKnowledge,
  InferenceValidationResult,
  HandlingResult,
  PIICheckResult,

  // Context Authentication
  ContextAuthenticationRequirements,
  ContentIntegrity,
  TrustProfile,
  ProviderValidationResult,
  ContentValidationResult,
  InjectionScanResult,
  ContextValidationResult,

  // Dual Channel
  DualChannelConfig,
  MessageChannel,
  MessageClassification,
  EnforcementResult,

  // Credentials
  SemanticGovernanceCredential,
  SemanticGovernanceConfig,

  // Agent types
  AgentIdentity,
  AgentInteraction,
  ActionRequest,
  ActionRecord,

  // Validation results
  PreActionResult,
  PostActionResult,
  SemanticValidationResult,
} from './types.js';

export {
  // Enums
  TrustTier,
  InferenceLevel,

  // Constants
  INFERENCE_LEVEL_NAMES,

  // Default configurations
  DEFAULT_INSTRUCTION_INTEGRITY,
  DEFAULT_OUTPUT_BINDING,
  DEFAULT_INFERENCE_SCOPE,
  DEFAULT_CONTEXT_AUTHENTICATION,
  DEFAULT_DUAL_CHANNEL,

  // Zod schemas
  DomainCodeSchema,
  TrustTierSchema,
  InferenceLevelSchema,
  InstructionTemplateSchema,
  InstructionSourceSchema,
  InstructionIntegritySchema,
  InstructionValidationResultSchema,
  TemplateMatchResultSchema,
  OutputSchemaSchema,
  ProhibitedPatternSchema,
  OutputBindingSchema,
  PatternScanResultSchema,
  OutputValidationResultSchema,
  SanitizedOutputSchema,
  InferenceOperationTypeSchema,
  InferenceOperationSchema,
  DomainInferenceOverrideSchema,
  DerivedKnowledgeHandlingSchema,
  PIIInferenceConfigSchema,
  InferenceScopeSchema,
  DerivedKnowledgeSchema,
  InferenceValidationResultSchema,
  HandlingResultSchema,
  PIICheckResultSchema,
  ContentIntegritySchema,
  ContextAuthenticationRequirementsSchema,
  TrustProfileSchema,
  ProviderValidationResultSchema,
  ContentValidationResultSchema,
  InjectionScanResultSchema,
  ContextValidationResultSchema,
  MessageChannelSchema,
  DualChannelConfigSchema,
  MessageClassificationSchema,
  EnforcementResultSchema,
  SemanticGovernanceCredentialSchema,
  SemanticGovernanceConfigSchema,
  AgentIdentitySchema,
  ActionRequestSchema,
  ActionRecordSchema,
  AgentInteractionSchema,
  PreActionResultSchema,
  PostActionResultSchema,
  SemanticValidationResultSchema,
} from './types.js';

// =============================================================================
// INSTRUCTION VALIDATOR
// =============================================================================

export {
  InstructionValidator,
  InstructionValidationError,
  createDefaultInstructionValidator,
  detectInjectionPatterns,
  COMMON_INJECTION_PATTERNS,
} from './instruction-validator.js';

// =============================================================================
// OUTPUT VALIDATOR
// =============================================================================

export {
  OutputValidator,
  OutputValidationError,
  createDefaultOutputValidator,
  BUILT_IN_PROHIBITED_PATTERNS,
} from './output-validator.js';

// =============================================================================
// INFERENCE VALIDATOR
// =============================================================================

export {
  InferenceValidator,
  InferenceScopeError,
  createDefaultInferenceValidator,
  createRestrictiveInferenceValidator,
  OPERATION_LEVEL_REQUIREMENTS,
} from './inference-validator.js';

// =============================================================================
// CONTEXT VALIDATOR
// =============================================================================

export {
  ContextValidator,
  ContextValidationError,
  createDefaultContextValidator,
  createStrictContextValidator,
  INJECTION_PATTERNS,
} from './context-validator.js';

// =============================================================================
// DUAL CHANNEL ENFORCER
// =============================================================================

export {
  DualChannelEnforcer,
  DualChannelError,
  createDefaultDualChannelEnforcer,
  createStrictDualChannelEnforcer,
  createPermissiveDualChannelEnforcer,
  DEFAULT_CONTROL_PLANE_SOURCES,
  DEFAULT_DATA_PLANE_SOURCES,
} from './dual-channel.js';

// =============================================================================
// CREDENTIAL MANAGER
// =============================================================================

export {
  SemanticCredentialManager,
  CredentialError,
  getCredentialManager,
  resetCredentialManager,
  type CredentialValidationResult,
} from './credential-manager.js';

// =============================================================================
// SERVICE
// =============================================================================

export {
  SemanticGovernanceService,
  SemanticGovernanceError,
  createSemanticGovernanceService,
  getSemanticGovernanceMetrics,
  getSemanticGovernanceMetricsContentType,
} from './service.js';

// =============================================================================
// CONVENIENCE EXPORTS
// =============================================================================

/**
 * Quick-start function to create a fully configured semantic governance system
 *
 * @param agentId - Agent identifier (DID)
 * @param aci - Agent Classification Identifier
 * @param config - Optional configuration overrides
 * @returns Object containing service, credential manager, and credential
 *
 * @example
 * ```typescript
 * const { service, credential } = createSemanticGovernance(
 *   'did:aci:a3i:vorion:my-agent',
 *   'a3i.vorion.my-agent:BD-L2-T2@1.0.0',
 *   {
 *     inferenceScope: { globalLevel: InferenceLevel.STATISTICAL },
 *     dualChannel: { enforced: true, dataPlaneTreatment: 'block' },
 *   }
 * );
 * ```
 */
export function createSemanticGovernance(
  agentId: string,
  aci: string,
  config?: SemanticGovernanceConfig
): {
  service: SemanticGovernanceService;
  credentialManager: SemanticCredentialManager;
  credential: SemanticGovernanceCredential;
} {
  const credentialManager = new SemanticCredentialManager();
  const credential = credentialManager.createCredential(agentId, aci, config || {});
  const service = createSemanticGovernanceService(credential);

  return { service, credentialManager, credential };
}

// Import types for the convenience function
import type { SemanticGovernanceConfig, SemanticGovernanceCredential } from './types.js';
import { SemanticCredentialManager } from './credential-manager.js';
import { SemanticGovernanceService, createSemanticGovernanceService } from './service.js';
