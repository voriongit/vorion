/**
 * Semantic Governance Types - Layer 5
 *
 * Core types for semantic governance addressing the "confused deputy" problem
 * where authenticated agents can be manipulated via prompt injection.
 *
 * This module provides:
 * - Instruction Integrity (binding agents to approved prompts)
 * - Output Schema Binding (constraining agent output)
 * - Inference Scope Controls (limiting derived knowledge)
 * - Context Authentication (securing the data plane)
 * - Dual-Channel Authorization (separating control from data)
 *
 * @packageDocumentation
 * @module @vorion/semantic-governance
 */

import { z } from 'zod';

// =============================================================================
// DOMAIN TYPES (imported from ACI spec)
// =============================================================================

/**
 * Domain codes representing capability areas
 */
export type DomainCode = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'S';

export const DomainCodeSchema = z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'S']);

/**
 * Trust tiers indicating verification level
 */
export enum TrustTier {
  /** No external verification */
  T0_UNVERIFIED = 0,
  /** Organization identity verified */
  T1_REGISTERED = 1,
  /** Passed automated capability tests */
  T2_TESTED = 2,
  /** Independent audit completed */
  T3_CERTIFIED = 3,
  /** Continuous behavioral monitoring */
  T4_VERIFIED = 4,
  /** Highest assurance level */
  T5_SOVEREIGN = 5,
}

export const TrustTierSchema = z.nativeEnum(TrustTier);

// =============================================================================
// INSTRUCTION INTEGRITY TYPES
// =============================================================================

/**
 * Instruction template definition with parameter schema
 */
export interface InstructionTemplate {
  /** Template identifier */
  id: string;
  /** SHA-256 hash of the template */
  hash: string;
  /** Human-readable description */
  description: string;
  /** JSON Schema for allowed parameters */
  parameterSchema: object;
}

export const InstructionTemplateSchema = z.object({
  id: z.string().min(1),
  hash: z.string().regex(/^sha256:[a-f0-9]{64}$/, 'Must be a valid SHA-256 hash'),
  description: z.string(),
  parameterSchema: z.record(z.unknown()),
});

/**
 * Instruction source configuration
 */
export interface InstructionSource {
  /** Allowed source DIDs or identifiers */
  allowedSources: string[];
  /** Whether signature verification is required */
  requireSignature: boolean;
}

export const InstructionSourceSchema = z.object({
  allowedSources: z.array(z.string()),
  requireSignature: z.boolean(),
});

/**
 * Instruction integrity configuration
 * Binds an agent to approved system prompts
 */
export interface InstructionIntegrity {
  /** SHA-256 hashes of allowed system prompts */
  allowedInstructionHashes: string[];
  /** Instruction templates with parameter schemas */
  instructionTemplates: InstructionTemplate[];
  /** Allowed instruction sources */
  instructionSource: InstructionSource;
}

export const InstructionIntegritySchema = z.object({
  allowedInstructionHashes: z.array(
    z.string().regex(/^sha256:[a-f0-9]{64}$/, 'Must be a valid SHA-256 hash')
  ),
  instructionTemplates: z.array(InstructionTemplateSchema),
  instructionSource: InstructionSourceSchema,
});

/**
 * Result of instruction validation
 */
export interface InstructionValidationResult {
  /** Whether instruction is valid */
  valid: boolean;
  /** Validation method used */
  method?: 'exact-match' | 'template-match' | 'signed-source';
  /** Template ID if template-matched */
  templateId?: string;
  /** Reason for rejection */
  reason?: string;
  /** SHA-256 hash of the instruction */
  instructionHash?: string;
  /** Extracted parameters if template-matched */
  extractedParams?: Record<string, unknown>;
}

export const InstructionValidationResultSchema = z.object({
  valid: z.boolean(),
  method: z.enum(['exact-match', 'template-match', 'signed-source']).optional(),
  templateId: z.string().optional(),
  reason: z.string().optional(),
  instructionHash: z.string().optional(),
  extractedParams: z.record(z.unknown()).optional(),
});

/**
 * Template match result
 */
export interface TemplateMatchResult {
  /** Whether the template matched */
  matches: boolean;
  /** Template ID if matched */
  templateId?: string;
  /** Extracted parameters */
  extractedParams?: Record<string, unknown>;
  /** Match confidence score (0-1) */
  confidence?: number;
}

export const TemplateMatchResultSchema = z.object({
  matches: z.boolean(),
  templateId: z.string().optional(),
  extractedParams: z.record(z.unknown()).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

// =============================================================================
// OUTPUT BINDING TYPES
// =============================================================================

/**
 * Output schema definition
 */
export interface OutputSchema {
  /** Schema identifier */
  id: string;
  /** Human-readable description */
  description: string;
  /** JSON Schema for output validation */
  jsonSchema: object;
}

export const OutputSchemaSchema = z.object({
  id: z.string().min(1),
  description: z.string(),
  jsonSchema: z.record(z.unknown()),
});

/**
 * Prohibited pattern definition
 */
export interface ProhibitedPattern {
  /** Pattern type */
  type: 'regex' | 'keyword' | 'semantic';
  /** Pattern value (regex string, keyword, or semantic description) */
  pattern: string;
  /** Human-readable description */
  description: string;
  /** Severity level */
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

export const ProhibitedPatternSchema = z.object({
  type: z.enum(['regex', 'keyword', 'semantic']),
  pattern: z.string().min(1),
  description: z.string(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
});

/**
 * Output schema binding configuration
 * Constrains what an agent can produce as output
 */
export interface OutputBinding {
  /** Allowed output schemas */
  allowedSchemas: OutputSchema[];
  /** Prohibited patterns (e.g., PII, credentials) */
  prohibitedPatterns: ProhibitedPattern[];
  /** Allowed external endpoints (glob patterns) */
  allowedExternalEndpoints: string[];
  /** Blocked external endpoints (glob patterns) */
  blockedExternalEndpoints: string[];
}

export const OutputBindingSchema = z.object({
  allowedSchemas: z.array(OutputSchemaSchema),
  prohibitedPatterns: z.array(ProhibitedPatternSchema),
  allowedExternalEndpoints: z.array(z.string()),
  blockedExternalEndpoints: z.array(z.string()),
});

/**
 * Pattern scan result
 */
export interface PatternScanResult {
  /** Whether prohibited patterns were detected */
  detected: boolean;
  /** List of detected patterns */
  patterns: Array<{
    type: 'regex' | 'keyword' | 'semantic';
    pattern: string;
    description: string;
    matches: string[];
    severity?: 'low' | 'medium' | 'high' | 'critical';
  }>;
  /** Overall severity */
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

export const PatternScanResultSchema = z.object({
  detected: z.boolean(),
  patterns: z.array(
    z.object({
      type: z.enum(['regex', 'keyword', 'semantic']),
      pattern: z.string(),
      description: z.string(),
      matches: z.array(z.string()),
      severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    })
  ),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
});

/**
 * Output validation result
 */
export interface OutputValidationResult {
  /** Whether output is valid */
  valid: boolean;
  /** Whether output was modified */
  modified?: boolean;
  /** Modified output (if applicable) */
  output?: unknown;
  /** Matched schema ID */
  schemaId?: string;
  /** Reason for rejection */
  reason?: string;
  /** Pattern scan results */
  patternScan?: PatternScanResult;
}

export const OutputValidationResultSchema = z.object({
  valid: z.boolean(),
  modified: z.boolean().optional(),
  output: z.unknown().optional(),
  schemaId: z.string().optional(),
  reason: z.string().optional(),
  patternScan: PatternScanResultSchema.optional(),
});

/**
 * Sanitized output result
 */
export interface SanitizedOutput {
  /** Sanitized content */
  content: unknown;
  /** Whether content was modified */
  modified: boolean;
  /** List of redactions made */
  redactions: Array<{
    type: string;
    description: string;
    count: number;
  }>;
}

export const SanitizedOutputSchema = z.object({
  content: z.unknown(),
  modified: z.boolean(),
  redactions: z.array(
    z.object({
      type: z.string(),
      description: z.string(),
      count: z.number(),
    })
  ),
});

// =============================================================================
// INFERENCE SCOPE TYPES
// =============================================================================

/**
 * Inference scope levels
 */
export enum InferenceLevel {
  /** No inference; raw data passthrough only */
  NONE = 0,
  /** Aggregates, counts, averages */
  STATISTICAL = 1,
  /** Named entity extraction */
  ENTITY = 2,
  /** Relationship inference */
  RELATIONAL = 3,
  /** Pattern prediction */
  PREDICTIVE = 4,
  /** Full inference capability */
  UNRESTRICTED = 5,
}

export const InferenceLevelSchema = z.nativeEnum(InferenceLevel);

/**
 * Inference level names for display
 */
export const INFERENCE_LEVEL_NAMES: Record<InferenceLevel, string> = {
  [InferenceLevel.NONE]: 'None',
  [InferenceLevel.STATISTICAL]: 'Statistical',
  [InferenceLevel.ENTITY]: 'Entity',
  [InferenceLevel.RELATIONAL]: 'Relational',
  [InferenceLevel.PREDICTIVE]: 'Predictive',
  [InferenceLevel.UNRESTRICTED]: 'Unrestricted',
};

/**
 * Domain-specific inference override
 */
export interface DomainInferenceOverride {
  /** Domain code */
  domain: DomainCode;
  /** Override level */
  level: InferenceLevel;
  /** Reason for override */
  reason: string;
}

export const DomainInferenceOverrideSchema = z.object({
  domain: DomainCodeSchema,
  level: InferenceLevelSchema,
  reason: z.string(),
});

/**
 * Derived knowledge handling configuration
 */
export interface DerivedKnowledgeHandling {
  /** Retention policy */
  retention: 'none' | 'session' | 'persistent';
  /** Allowed recipients (DIDs or identifiers) */
  allowedRecipients: string[];
  /** Whether cross-context sharing is allowed */
  crossContextSharing: boolean;
}

export const DerivedKnowledgeHandlingSchema = z.object({
  retention: z.enum(['none', 'session', 'persistent']),
  allowedRecipients: z.array(z.string()),
  crossContextSharing: z.boolean(),
});

/**
 * PII inference configuration
 */
export interface PIIInferenceConfig {
  /** Whether PII inference is allowed */
  allowed: boolean;
  /** How to handle PII if not allowed */
  handling: 'block' | 'redact' | 'hash';
}

export const PIIInferenceConfigSchema = z.object({
  allowed: z.boolean(),
  handling: z.enum(['block', 'redact', 'hash']),
});

/**
 * Inference scope configuration
 * Controls what can be derived from accessed data
 */
export interface InferenceScope {
  /** Global inference level limit */
  globalLevel: InferenceLevel;
  /** Domain-specific overrides */
  domainOverrides: DomainInferenceOverride[];
  /** How to handle derived knowledge */
  derivedKnowledgeHandling: DerivedKnowledgeHandling;
  /** PII inference controls */
  piiInference: PIIInferenceConfig;
}

export const InferenceScopeSchema = z.object({
  globalLevel: InferenceLevelSchema,
  domainOverrides: z.array(DomainInferenceOverrideSchema),
  derivedKnowledgeHandling: DerivedKnowledgeHandlingSchema,
  piiInference: PIIInferenceConfigSchema,
});

/**
 * Inference operation types
 */
export type InferenceOperationType =
  | 'aggregate'
  | 'count'
  | 'average'
  | 'entity-extraction'
  | 'relationship-inference'
  | 'pattern-prediction'
  | 'sentiment-analysis'
  | 'classification'
  | 'summarization'
  | 'custom';

export const InferenceOperationTypeSchema = z.enum([
  'aggregate',
  'count',
  'average',
  'entity-extraction',
  'relationship-inference',
  'pattern-prediction',
  'sentiment-analysis',
  'classification',
  'summarization',
  'custom',
]);

/**
 * Inference operation definition
 */
export interface InferenceOperation {
  /** Operation type */
  type: InferenceOperationType;
  /** Source domains */
  sourceDomains: DomainCode[];
  /** Description of the inference */
  description?: string;
  /** Custom inference level requirement (for custom operations) */
  customLevel?: InferenceLevel;
}

export const InferenceOperationSchema = z.object({
  type: InferenceOperationTypeSchema,
  sourceDomains: z.array(DomainCodeSchema),
  description: z.string().optional(),
  customLevel: InferenceLevelSchema.optional(),
});

/**
 * Derived knowledge representation
 */
export interface DerivedKnowledge {
  /** Unique identifier */
  id: string;
  /** Type of knowledge */
  type: InferenceOperationType;
  /** Source data identifiers */
  sourceIds: string[];
  /** Source domains */
  sourceDomains: DomainCode[];
  /** The derived content */
  content: unknown;
  /** Creation timestamp */
  createdAt: Date;
  /** Inference level used */
  inferenceLevel: InferenceLevel;
}

export const DerivedKnowledgeSchema = z.object({
  id: z.string(),
  type: InferenceOperationTypeSchema,
  sourceIds: z.array(z.string()),
  sourceDomains: z.array(DomainCodeSchema),
  content: z.unknown(),
  createdAt: z.date(),
  inferenceLevel: InferenceLevelSchema,
});

/**
 * Inference validation result
 */
export interface InferenceValidationResult {
  /** Whether inference is valid */
  valid: boolean;
  /** Reason for rejection */
  reason?: string;
  /** Required level */
  requiredLevel?: InferenceLevel;
  /** Agent's effective level */
  agentLevel?: InferenceLevel;
  /** Domain that caused restriction */
  restrictedDomain?: DomainCode;
}

export const InferenceValidationResultSchema = z.object({
  valid: z.boolean(),
  reason: z.string().optional(),
  requiredLevel: InferenceLevelSchema.optional(),
  agentLevel: InferenceLevelSchema.optional(),
  restrictedDomain: DomainCodeSchema.optional(),
});

/**
 * Handling result for derived knowledge
 */
export interface HandlingResult {
  /** Action taken */
  action: 'stored' | 'discarded' | 'shared' | 'redacted';
  /** Reason for action */
  reason: string;
  /** Modified knowledge (if redacted) */
  modifiedKnowledge?: DerivedKnowledge;
}

export const HandlingResultSchema = z.object({
  action: z.enum(['stored', 'discarded', 'shared', 'redacted']),
  reason: z.string(),
  modifiedKnowledge: DerivedKnowledgeSchema.optional(),
});

/**
 * PII check result
 */
export interface PIICheckResult {
  /** Whether PII was detected */
  containsPII: boolean;
  /** Types of PII detected */
  piiTypes: string[];
  /** Action taken */
  action: 'allowed' | 'blocked' | 'redacted' | 'hashed';
  /** Modified data (if redacted or hashed) */
  modifiedData?: unknown;
}

export const PIICheckResultSchema = z.object({
  containsPII: z.boolean(),
  piiTypes: z.array(z.string()),
  action: z.enum(['allowed', 'blocked', 'redacted', 'hashed']),
  modifiedData: z.unknown().optional(),
});

// =============================================================================
// CONTEXT AUTHENTICATION TYPES
// =============================================================================

/**
 * Content integrity requirements
 */
export interface ContentIntegrity {
  /** Whether signature is required */
  signatureRequired: boolean;
  /** Maximum age in seconds */
  maxAge: number;
  /** Allowed content formats */
  allowedFormats: string[];
}

export const ContentIntegritySchema = z.object({
  signatureRequired: z.boolean(),
  maxAge: z.number().positive(),
  allowedFormats: z.array(z.string()),
});

/**
 * Context provider authentication requirements
 */
export interface ContextAuthenticationRequirements {
  /** Whether authentication is required */
  required: boolean;
  /** Minimum trust tier for providers */
  minTrustTier: TrustTier;
  /** Required domains for providers */
  requiredDomains?: DomainCode[];
  /** Allowed provider DIDs */
  allowedProviders: string[];
  /** Blocked provider DIDs */
  blockedProviders: string[];
  /** Content integrity requirements */
  contentIntegrity: ContentIntegrity;
}

export const ContextAuthenticationRequirementsSchema = z.object({
  required: z.boolean(),
  minTrustTier: TrustTierSchema,
  requiredDomains: z.array(DomainCodeSchema).optional(),
  allowedProviders: z.array(z.string()),
  blockedProviders: z.array(z.string()),
  contentIntegrity: ContentIntegritySchema,
});

/**
 * Trust profile for context providers
 */
export interface TrustProfile {
  /** Provider DID */
  did: string;
  /** Trust tier */
  trustTier: TrustTier;
  /** Capability domains */
  domains: DomainCode[];
  /** Trust score (0-1000) */
  trustScore: number;
  /** Attestations */
  attestations?: string[];
}

export const TrustProfileSchema = z.object({
  did: z.string(),
  trustTier: TrustTierSchema,
  domains: z.array(DomainCodeSchema),
  trustScore: z.number().min(0).max(1000),
  attestations: z.array(z.string()).optional(),
});

/**
 * Provider validation result
 */
export interface ProviderValidationResult {
  /** Whether provider is valid */
  valid: boolean;
  /** Provider DID */
  providerId: string;
  /** Trust tier */
  trustTier?: TrustTier;
  /** Reason for rejection */
  reason?: string;
  /** Whether provider is on blocklist */
  blocked?: boolean;
}

export const ProviderValidationResultSchema = z.object({
  valid: z.boolean(),
  providerId: z.string(),
  trustTier: TrustTierSchema.optional(),
  reason: z.string().optional(),
  blocked: z.boolean().optional(),
});

/**
 * Content validation result
 */
export interface ContentValidationResult {
  /** Whether content is valid */
  valid: boolean;
  /** Signature verification status */
  signatureValid?: boolean;
  /** Content age in seconds */
  ageSeconds?: number;
  /** Content format */
  format?: string;
  /** Reason for rejection */
  reason?: string;
}

export const ContentValidationResultSchema = z.object({
  valid: z.boolean(),
  signatureValid: z.boolean().optional(),
  ageSeconds: z.number().optional(),
  format: z.string().optional(),
  reason: z.string().optional(),
});

/**
 * Injection scan result
 */
export interface InjectionScanResult {
  /** Whether injection patterns were detected */
  detected: boolean;
  /** Detected patterns */
  patterns: string[];
  /** Severity level */
  severity?: 'low' | 'medium' | 'high' | 'critical';
  /** Matched pattern descriptions */
  descriptions?: string[];
}

export const InjectionScanResultSchema = z.object({
  detected: z.boolean(),
  patterns: z.array(z.string()),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  descriptions: z.array(z.string()).optional(),
});

/**
 * Context validation result
 */
export interface ContextValidationResult {
  /** Whether context is valid */
  valid: boolean;
  /** Reason for rejection */
  reason?: string;
  /** Provider validation result */
  providerValidation?: ProviderValidationResult;
  /** Content validation result */
  contentValidation?: ContentValidationResult;
  /** Injection scan results */
  injectionScan?: InjectionScanResult;
}

export const ContextValidationResultSchema = z.object({
  valid: z.boolean(),
  reason: z.string().optional(),
  providerValidation: ProviderValidationResultSchema.optional(),
  contentValidation: ContentValidationResultSchema.optional(),
  injectionScan: InjectionScanResultSchema.optional(),
});

// =============================================================================
// DUAL-CHANNEL AUTHORIZATION TYPES
// =============================================================================

/**
 * Message channel classification
 */
export type MessageChannel = 'control' | 'data';

export const MessageChannelSchema = z.enum(['control', 'data']);

/**
 * Dual-channel authorization configuration
 */
export interface DualChannelConfig {
  /** Whether dual-channel is enforced */
  enforced: boolean;
  /** Control plane sources */
  controlPlaneSources: string[];
  /** How to treat data plane content */
  dataPlaneTreatment: 'block' | 'sanitize' | 'warn';
}

export const DualChannelConfigSchema = z.object({
  enforced: z.boolean(),
  controlPlaneSources: z.array(z.string()),
  dataPlaneTreatment: z.enum(['block', 'sanitize', 'warn']),
});

/**
 * Message classification result
 */
export interface MessageClassification {
  /** Detected channel */
  channel: MessageChannel;
  /** Message source */
  source: string;
  /** Whether source is authenticated */
  authenticated: boolean;
  /** Whether instructions are allowed from this channel */
  instructionAllowed: boolean;
  /** Confidence in classification (0-1) */
  confidence?: number;
}

export const MessageClassificationSchema = z.object({
  channel: MessageChannelSchema,
  source: z.string(),
  authenticated: z.boolean(),
  instructionAllowed: z.boolean(),
  confidence: z.number().min(0).max(1).optional(),
});

/**
 * Channel enforcement result
 */
export interface EnforcementResult {
  /** Whether message is allowed to proceed */
  allowed: boolean;
  /** Action taken */
  action: 'pass' | 'block' | 'sanitize' | 'warn';
  /** Reason for action */
  reason?: string;
  /** Sanitized content (if applicable) */
  sanitizedContent?: string;
  /** Stripped instructions (for audit) */
  strippedInstructions?: string[];
}

export const EnforcementResultSchema = z.object({
  allowed: z.boolean(),
  action: z.enum(['pass', 'block', 'sanitize', 'warn']),
  reason: z.string().optional(),
  sanitizedContent: z.string().optional(),
  strippedInstructions: z.array(z.string()).optional(),
});

// =============================================================================
// SEMANTIC GOVERNANCE CREDENTIAL
// =============================================================================

/**
 * Complete semantic governance credential
 * Combines all semantic governance controls into a single verifiable credential
 */
export interface SemanticGovernanceCredential {
  /** Credential ID (typically the agent DID) */
  id: string;
  /** Full ACI string */
  aci: string;
  /** Instruction integrity rules */
  instructionIntegrity: InstructionIntegrity;
  /** Output binding rules */
  outputBinding: OutputBinding;
  /** Inference scope rules */
  inferenceScope: InferenceScope;
  /** Context authentication rules */
  contextAuthentication: ContextAuthenticationRequirements;
  /** Dual-channel configuration */
  dualChannel: DualChannelConfig;
  /** Credential metadata */
  metadata?: {
    /** Issuer DID */
    issuer?: string;
    /** Issuance date */
    issuedAt?: Date;
    /** Expiration date */
    expiresAt?: Date;
    /** Credential version */
    version?: string;
  };
}

export const SemanticGovernanceCredentialSchema = z.object({
  id: z.string().min(1),
  aci: z.string().min(1),
  instructionIntegrity: InstructionIntegritySchema,
  outputBinding: OutputBindingSchema,
  inferenceScope: InferenceScopeSchema,
  contextAuthentication: ContextAuthenticationRequirementsSchema,
  dualChannel: DualChannelConfigSchema,
  metadata: z
    .object({
      issuer: z.string().optional(),
      issuedAt: z.date().optional(),
      expiresAt: z.date().optional(),
      version: z.string().optional(),
    })
    .optional(),
});

// =============================================================================
// AGENT INTERACTION TYPES
// =============================================================================

/**
 * Agent identity for semantic governance
 */
export interface AgentIdentity {
  /** Agent DID */
  did: string;
  /** Full ACI string */
  aci: string;
  /** Trust tier */
  trustTier: TrustTier;
  /** Capability domains */
  domains: DomainCode[];
  /** Service endpoint URL */
  serviceEndpoint?: string;
}

export const AgentIdentitySchema = z.object({
  did: z.string(),
  aci: z.string(),
  trustTier: TrustTierSchema,
  domains: z.array(DomainCodeSchema),
  serviceEndpoint: z.string().url().optional(),
});

/**
 * Action request for pre-action validation
 */
export interface ActionRequest {
  /** Action type/name */
  type: string;
  /** Target resource */
  target?: string;
  /** Action parameters */
  params?: Record<string, unknown>;
  /** System instruction */
  instruction?: string;
  /** Context sources */
  contextSources?: Array<{
    providerId: string;
    content: unknown;
    signature?: string;
  }>;
  /** Requested inference operations */
  inferenceOperations?: InferenceOperation[];
}

export const ActionRequestSchema = z.object({
  type: z.string(),
  target: z.string().optional(),
  params: z.record(z.unknown()).optional(),
  instruction: z.string().optional(),
  contextSources: z
    .array(
      z.object({
        providerId: z.string(),
        content: z.unknown(),
        signature: z.string().optional(),
      })
    )
    .optional(),
  inferenceOperations: z.array(InferenceOperationSchema).optional(),
});

/**
 * Action record for post-action validation
 */
export interface ActionRecord {
  /** Action type/name */
  type: string;
  /** Target resource */
  target?: string;
  /** Action output */
  output: unknown;
  /** Derived knowledge produced */
  derivedKnowledge?: DerivedKnowledge[];
  /** External endpoints accessed */
  externalEndpoints?: string[];
  /** Execution duration in ms */
  durationMs?: number;
}

export const ActionRecordSchema = z.object({
  type: z.string(),
  target: z.string().optional(),
  output: z.unknown(),
  derivedKnowledge: z.array(DerivedKnowledgeSchema).optional(),
  externalEndpoints: z.array(z.string()).optional(),
  durationMs: z.number().optional(),
});

/**
 * Complete agent interaction for validation
 */
export interface AgentInteraction {
  /** Interaction ID */
  id: string;
  /** Agent identity */
  agent: AgentIdentity;
  /** Incoming message */
  message: {
    source: string;
    content: string;
    authenticated: boolean;
    timestamp: Date;
  };
  /** System instruction */
  instruction?: string;
  /** Context data */
  context?: Array<{
    providerId: string;
    content: unknown;
    signature?: string;
    timestamp?: Date;
  }>;
  /** Planned/executed action */
  action?: ActionRequest | ActionRecord;
}

export const AgentInteractionSchema = z.object({
  id: z.string(),
  agent: AgentIdentitySchema,
  message: z.object({
    source: z.string(),
    content: z.string(),
    authenticated: z.boolean(),
    timestamp: z.date(),
  }),
  instruction: z.string().optional(),
  context: z
    .array(
      z.object({
        providerId: z.string(),
        content: z.unknown(),
        signature: z.string().optional(),
        timestamp: z.date().optional(),
      })
    )
    .optional(),
  action: z.union([ActionRequestSchema, ActionRecordSchema]).optional(),
});

// =============================================================================
// VALIDATION RESULT TYPES
// =============================================================================

/**
 * Pre-action validation result
 */
export interface PreActionResult {
  /** Whether action is allowed to proceed */
  allowed: boolean;
  /** Reason for rejection */
  reason?: string;
  /** Instruction validation result */
  instructionValidation?: InstructionValidationResult;
  /** Context validation results */
  contextValidations?: ContextValidationResult[];
  /** Inference validation results */
  inferenceValidations?: InferenceValidationResult[];
  /** Channel enforcement result */
  channelEnforcement?: EnforcementResult;
  /** Warnings (action allowed but with caveats) */
  warnings?: string[];
}

export const PreActionResultSchema = z.object({
  allowed: z.boolean(),
  reason: z.string().optional(),
  instructionValidation: InstructionValidationResultSchema.optional(),
  contextValidations: z.array(ContextValidationResultSchema).optional(),
  inferenceValidations: z.array(InferenceValidationResultSchema).optional(),
  channelEnforcement: EnforcementResultSchema.optional(),
  warnings: z.array(z.string()).optional(),
});

/**
 * Post-action validation result
 */
export interface PostActionResult {
  /** Whether action result is valid */
  valid: boolean;
  /** Reason for rejection */
  reason?: string;
  /** Output validation result */
  outputValidation?: OutputValidationResult;
  /** Inference validation results */
  inferenceValidations?: InferenceValidationResult[];
  /** PII check results */
  piiChecks?: PIICheckResult[];
  /** Sanitized output (if modified) */
  sanitizedOutput?: unknown;
  /** Warnings */
  warnings?: string[];
}

export const PostActionResultSchema = z.object({
  valid: z.boolean(),
  reason: z.string().optional(),
  outputValidation: OutputValidationResultSchema.optional(),
  inferenceValidations: z.array(InferenceValidationResultSchema).optional(),
  piiChecks: z.array(PIICheckResultSchema).optional(),
  sanitizedOutput: z.unknown().optional(),
  warnings: z.array(z.string()).optional(),
});

/**
 * Complete semantic validation result
 */
export interface SemanticValidationResult {
  /** Whether interaction is valid */
  valid: boolean;
  /** Interaction ID */
  interactionId: string;
  /** Agent DID */
  agentDid: string;
  /** Pre-action result */
  preAction?: PreActionResult;
  /** Post-action result */
  postAction?: PostActionResult;
  /** Overall reason for failure */
  reason?: string;
  /** Validation timestamp */
  validatedAt: Date;
  /** Validation duration in ms */
  durationMs: number;
}

export const SemanticValidationResultSchema = z.object({
  valid: z.boolean(),
  interactionId: z.string(),
  agentDid: z.string(),
  preAction: PreActionResultSchema.optional(),
  postAction: PostActionResultSchema.optional(),
  reason: z.string().optional(),
  validatedAt: z.date(),
  durationMs: z.number(),
});

// =============================================================================
// CONFIGURATION TYPES
// =============================================================================

/**
 * Semantic governance configuration for creating credentials
 */
export interface SemanticGovernanceConfig {
  /** Instruction integrity configuration */
  instructionIntegrity?: Partial<InstructionIntegrity>;
  /** Output binding configuration */
  outputBinding?: Partial<OutputBinding>;
  /** Inference scope configuration */
  inferenceScope?: Partial<InferenceScope>;
  /** Context authentication configuration */
  contextAuthentication?: Partial<ContextAuthenticationRequirements>;
  /** Dual-channel configuration */
  dualChannel?: Partial<DualChannelConfig>;
}

export const SemanticGovernanceConfigSchema = z.object({
  instructionIntegrity: InstructionIntegritySchema.partial().optional(),
  outputBinding: OutputBindingSchema.partial().optional(),
  inferenceScope: InferenceScopeSchema.partial().optional(),
  contextAuthentication: ContextAuthenticationRequirementsSchema.partial().optional(),
  dualChannel: DualChannelConfigSchema.partial().optional(),
});

// =============================================================================
// DEFAULT CONFIGURATIONS
// =============================================================================

/**
 * Default instruction integrity configuration
 */
export const DEFAULT_INSTRUCTION_INTEGRITY: InstructionIntegrity = {
  allowedInstructionHashes: [],
  instructionTemplates: [],
  instructionSource: {
    allowedSources: [],
    requireSignature: false,
  },
};

/**
 * Default output binding configuration
 */
export const DEFAULT_OUTPUT_BINDING: OutputBinding = {
  allowedSchemas: [],
  prohibitedPatterns: [
    {
      type: 'regex',
      pattern: '\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b',
      description: 'Email addresses',
      severity: 'medium',
    },
    {
      type: 'regex',
      pattern: '\\b\\d{3}-\\d{2}-\\d{4}\\b',
      description: 'Social Security Numbers',
      severity: 'critical',
    },
    {
      type: 'regex',
      pattern: '\\b\\d{16}\\b',
      description: 'Credit card numbers (basic)',
      severity: 'critical',
    },
  ],
  allowedExternalEndpoints: [],
  blockedExternalEndpoints: ['*'],
};

/**
 * Default inference scope configuration
 */
export const DEFAULT_INFERENCE_SCOPE: InferenceScope = {
  globalLevel: InferenceLevel.ENTITY,
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
};

/**
 * Default context authentication configuration
 */
export const DEFAULT_CONTEXT_AUTHENTICATION: ContextAuthenticationRequirements = {
  required: true,
  minTrustTier: TrustTier.T2_TESTED,
  allowedProviders: [],
  blockedProviders: [],
  contentIntegrity: {
    signatureRequired: false,
    maxAge: 300,
    allowedFormats: ['application/json', 'text/plain'],
  },
};

/**
 * Default dual-channel configuration
 */
export const DEFAULT_DUAL_CHANNEL: DualChannelConfig = {
  enforced: true,
  controlPlaneSources: ['user-direct-input', 'signed-system-instruction', 'authenticated-api-command'],
  dataPlaneTreatment: 'sanitize',
};
