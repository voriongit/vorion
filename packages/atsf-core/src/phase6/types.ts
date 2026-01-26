/**
 * Phase 6 Type System - Trust Engine Hardening
 *
 * Implements all 5 architecture decisions:
 * - Q1: Ceiling Enforcement (Hybrid Dual-Layer + Regulatory Observability)
 * - Q2: Hierarchical Context (4-Tier with Tiered Immutability)
 * - Q3: Stratified Role Gates (3-Layer Enforcement)
 * - Q4: Federated Weight Presets (3-Tier with Derivation Chains)
 * - Q5: Provenance Capture + Policy Interpretation
 *
 * Critical Path: Q2 → Q4 → Q5 → Q1 → Q3
 *
 * @packageDocumentation
 */

import { z } from 'zod';

// =============================================================================
// COMMON ENUMS & CONSTANTS
// =============================================================================

/**
 * Trust tiers (0-5) with score ranges
 */
export enum TrustTier {
  T0 = 'T0', // 0-99: Sandbox
  T1 = 'T1', // 100-299: Supervised
  T2 = 'T2', // 300-499: Constrained
  T3 = 'T3', // 500-699: Trusted
  T4 = 'T4', // 700-899: Autonomous
  T5 = 'T5', // 900-1000: Sovereign
}

export const TRUST_TIER_BOUNDARIES: Record<TrustTier, { min: number; max: number }> = {
  [TrustTier.T0]: { min: 0, max: 99 },
  [TrustTier.T1]: { min: 100, max: 299 },
  [TrustTier.T2]: { min: 300, max: 499 },
  [TrustTier.T3]: { min: 500, max: 699 },
  [TrustTier.T4]: { min: 700, max: 899 },
  [TrustTier.T5]: { min: 900, max: 1000 },
};

/**
 * Agent role levels (structural capability, not earned trust)
 */
export enum AgentRole {
  R_L0 = 'R-L0', // Listener (observe only)
  R_L1 = 'R-L1', // Executor (simple tasks)
  R_L2 = 'R-L2', // Planner (multi-step)
  R_L3 = 'R-L3', // Orchestrator (coordinate agents)
  R_L4 = 'R-L4', // Architect (design systems)
  R_L5 = 'R-L5', // Leader (strategic decisions)
  R_L6 = 'R-L6', // Domain Authority
  R_L7 = 'R-L7', // Strategic
  R_L8 = 'R-L8', // Steward
}

/**
 * Context types with ceiling implications
 */
export enum ContextType {
  LOCAL = 'local',           // Development - ceiling 700
  ENTERPRISE = 'enterprise', // Production - ceiling 900
  SOVEREIGN = 'sovereign',   // Government/Critical - ceiling 1000
}

export const CONTEXT_CEILINGS: Record<ContextType, number> = {
  [ContextType.LOCAL]: 700,
  [ContextType.ENTERPRISE]: 900,
  [ContextType.SOVEREIGN]: 1000,
};

/**
 * Creation types for provenance tracking
 */
export enum CreationType {
  FRESH = 'fresh',       // New agent, no history
  CLONED = 'cloned',     // Copy of existing agent
  EVOLVED = 'evolved',   // Has verifiable history
  PROMOTED = 'promoted', // Earned advancement
  IMPORTED = 'imported', // External, unknown provenance
}

/**
 * Regulatory frameworks for compliance tracking
 */
export enum RegulatoryFramework {
  NONE = 'none',
  HIPAA = 'hipaa',
  GDPR = 'gdpr',
  EU_AI_ACT = 'eu-ai-act',
  SOC2 = 'soc2',
  ISO_42001 = 'iso-42001',
}

// =============================================================================
// Q2: HIERARCHICAL CONTEXT (4-Tier with Tiered Immutability)
// =============================================================================

/**
 * Tier 1: Deployment Context (IMMUTABLE)
 * Set at deployment time, cannot be changed without redeployment.
 * Example: HIPAA compliance mode cannot be disabled at runtime.
 */
export interface DeploymentContext {
  readonly deploymentId: string;
  readonly deploymentHash: string; // Cryptographic proof of deployment config
  readonly regulatoryFramework: RegulatoryFramework;
  readonly maxAllowedTier: TrustTier; // Deployment-wide ceiling
  readonly allowedContextTypes: readonly ContextType[];
  readonly deployedAt: Date;
  readonly deployedBy: string;
  readonly immutable: true; // Type-level marker
}

export const deploymentContextSchema = z.object({
  deploymentId: z.string().min(1),
  deploymentHash: z.string().min(64),
  regulatoryFramework: z.nativeEnum(RegulatoryFramework),
  maxAllowedTier: z.nativeEnum(TrustTier),
  allowedContextTypes: z.array(z.nativeEnum(ContextType)),
  deployedAt: z.date(),
  deployedBy: z.string().min(1),
  immutable: z.literal(true),
});

/**
 * Tier 2: Organizational Context (LOCKED POST-STARTUP)
 * Can be configured during startup, then frozen.
 * Example: Tenant isolation settings locked after initialization.
 */
export interface OrganizationalContext {
  readonly orgId: string;
  readonly tenantId: string;
  readonly parentDeployment: DeploymentContext;
  readonly lockedAt?: Date; // undefined = not yet locked
  readonly constraints: OrganizationalConstraints;
  readonly orgHash: string; // Cryptographic proof including parent
}

export interface OrganizationalConstraints {
  readonly maxTrustTier: TrustTier;
  readonly deniedDomains: readonly string[]; // ACI domain codes
  readonly requiredAttestations: readonly string[];
  readonly dataClassification: 'public' | 'internal' | 'confidential' | 'restricted';
  readonly auditLevel: 'minimal' | 'standard' | 'comprehensive' | 'forensic';
}

export const organizationalContextSchema = z.object({
  orgId: z.string().min(1),
  tenantId: z.string().min(1),
  parentDeployment: deploymentContextSchema,
  lockedAt: z.date().optional(),
  constraints: z.object({
    maxTrustTier: z.nativeEnum(TrustTier),
    deniedDomains: z.array(z.string()),
    requiredAttestations: z.array(z.string()),
    dataClassification: z.enum(['public', 'internal', 'confidential', 'restricted']),
    auditLevel: z.enum(['minimal', 'standard', 'comprehensive', 'forensic']),
  }),
  orgHash: z.string().min(64),
});

/**
 * Tier 3: Agent Context (FROZEN AT CREATION)
 * Set when agent is instantiated, cannot be modified.
 * Example: Agent's assigned context type is permanent.
 */
export interface AgentContext {
  readonly agentId: string;
  readonly parentOrg: OrganizationalContext;
  readonly contextType: ContextType;
  readonly createdAt: Date;
  readonly createdBy: string;
  readonly contextHash: string; // Cryptographic proof including parent chain
}

export const agentContextSchema = z.object({
  agentId: z.string().min(1),
  parentOrg: organizationalContextSchema,
  contextType: z.nativeEnum(ContextType),
  createdAt: z.date(),
  createdBy: z.string().min(1),
  contextHash: z.string().min(64),
});

/**
 * Tier 4: Operation Context (EPHEMERAL)
 * Created per-request, discarded after operation.
 * Example: Request-specific metadata, correlation IDs.
 */
export interface OperationContext {
  readonly operationId: string;
  readonly parentAgent: AgentContext;
  readonly requestMetadata: Record<string, unknown>;
  readonly correlationId: string;
  readonly startedAt: Date;
  readonly expiresAt: Date;
  readonly ephemeral: true; // Type-level marker
}

export const operationContextSchema = z.object({
  operationId: z.string().min(1),
  parentAgent: agentContextSchema,
  requestMetadata: z.record(z.unknown()),
  correlationId: z.string().min(1),
  startedAt: z.date(),
  expiresAt: z.date(),
  ephemeral: z.literal(true),
});

/**
 * Context hierarchy validation result
 */
export interface ContextValidationResult {
  readonly valid: boolean;
  readonly tier: 'deployment' | 'organizational' | 'agent' | 'operation';
  readonly reason?: string;
  readonly constraintViolations: readonly string[];
  readonly hashChainValid: boolean;
  readonly validatedAt: Date;
}

// =============================================================================
// Q4: FEDERATED WEIGHT PRESETS (3-Tier with Derivation Chains)
// =============================================================================

/**
 * Preset source tier
 */
export type PresetSource = 'aci' | 'vorion' | 'axiom';

/**
 * Trust dimension weights (sum to 1.0)
 */
export interface TrustWeights {
  readonly observability: number;  // How much can we see?
  readonly capability: number;     // Technical ability
  readonly behavior: number;       // Historical reliability
  readonly governance: number;     // Policy compliance
  readonly context: number;        // Environmental fit
}

export const trustWeightsSchema = z.object({
  observability: z.number().min(0).max(1),
  capability: z.number().min(0).max(1),
  behavior: z.number().min(0).max(1),
  governance: z.number().min(0).max(1),
  context: z.number().min(0).max(1),
}).refine(
  (w) => Math.abs(w.observability + w.capability + w.behavior + w.governance + w.context - 1.0) < 0.001,
  { message: 'Weights must sum to 1.0' }
);

/**
 * Trust preset with derivation chain
 */
export interface TrustPreset {
  readonly presetId: string;
  readonly name: string;
  readonly description: string;
  readonly source: PresetSource;
  readonly version: number;
  readonly weights: TrustWeights;
  readonly parentPresetId?: string;      // Link to ACI/Vorion preset
  readonly parentHash?: string;           // Cryptographic proof of parent
  readonly derivationDelta?: Partial<TrustWeights>; // What changed from parent
  readonly createdAt: Date;
  readonly createdBy: string;
  readonly presetHash: string;            // Immutable identifier
  readonly comment?: string;              // Derivation rationale
}

export const trustPresetSchema = z.object({
  presetId: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  source: z.enum(['aci', 'vorion', 'axiom']),
  version: z.number().int().positive(),
  weights: trustWeightsSchema,
  parentPresetId: z.string().optional(),
  parentHash: z.string().min(64).optional(),
  derivationDelta: z.object({
    observability: z.number().optional(),
    capability: z.number().optional(),
    behavior: z.number().optional(),
    governance: z.number().optional(),
    context: z.number().optional(),
  }).optional(),
  createdAt: z.date(),
  createdBy: z.string().min(1),
  presetHash: z.string().min(64),
  comment: z.string().optional(),
});

/**
 * Preset lineage tracking (cryptographic chain of custody)
 */
export interface PresetLineage {
  readonly leafPresetId: string;          // Axiom deployment preset
  readonly chain: readonly string[];       // [aciPresetId, vorionPresetId, axiomPresetId]
  readonly hashes: readonly string[];      // Cryptographic chain
  readonly verified: boolean;              // Regulator validated
  readonly verifiedAt?: Date;
  readonly verifiedBy?: string;
}

export const presetLineageSchema = z.object({
  leafPresetId: z.string().min(1),
  chain: z.array(z.string()),
  hashes: z.array(z.string().min(64)),
  verified: z.boolean(),
  verifiedAt: z.date().optional(),
  verifiedBy: z.string().optional(),
});

// =============================================================================
// Q5: PROVENANCE CAPTURE + POLICY INTERPRETATION
// =============================================================================

/**
 * Agent provenance (IMMUTABLE - captured at instantiation)
 */
export interface AgentProvenance {
  readonly agentId: string;
  readonly creationType: CreationType;
  readonly parentAgentId?: string;
  readonly parentProvenanceHash?: string;
  readonly createdAt: Date;
  readonly createdBy: string;
  readonly provenanceHash: string; // Tamper-proof
}

export const agentProvenanceSchema = z.object({
  agentId: z.string().min(1),
  creationType: z.nativeEnum(CreationType),
  parentAgentId: z.string().optional(),
  parentProvenanceHash: z.string().min(64).optional(),
  createdAt: z.date(),
  createdBy: z.string().min(1),
  provenanceHash: z.string().min(64),
});

/**
 * Creation modifier policy (MUTABLE - can evolve independently)
 */
export interface CreationModifierPolicy {
  readonly policyId: string;
  readonly version: number;
  readonly creationType: CreationType;
  readonly baselineModifier: number;
  readonly conditions?: CreationModifierConditions;
  readonly effectiveFrom: Date;
  readonly effectiveUntil?: Date;
  readonly createdAt: Date;
  readonly createdBy: string;
  readonly policyHash: string;
  readonly supersedes?: string; // Previous policy version
}

export interface CreationModifierConditions {
  readonly parentCreationType?: CreationType;
  readonly parentTrustScore?: { min: number; max: number };
  readonly trustedSources?: readonly string[]; // Organization IDs
  readonly requiredAttestations?: readonly string[];
}

export const creationModifierPolicySchema = z.object({
  policyId: z.string().min(1),
  version: z.number().int().positive(),
  creationType: z.nativeEnum(CreationType),
  baselineModifier: z.number().min(-200).max(200),
  conditions: z.object({
    parentCreationType: z.nativeEnum(CreationType).optional(),
    parentTrustScore: z.object({ min: z.number(), max: z.number() }).optional(),
    trustedSources: z.array(z.string()).optional(),
    requiredAttestations: z.array(z.string()).optional(),
  }).optional(),
  effectiveFrom: z.date(),
  effectiveUntil: z.date().optional(),
  createdAt: z.date(),
  createdBy: z.string().min(1),
  policyHash: z.string().min(64),
  supersedes: z.string().optional(),
});

/**
 * Modifier evaluation record (AUDIT TRAIL)
 */
export interface ModifierEvaluationRecord {
  readonly evaluationId: string;
  readonly agentId: string;
  readonly provenanceHash: string;
  readonly policyId: string;
  readonly policyVersion: number;
  readonly computedModifier: number;
  readonly conditionsMatched: readonly string[];
  readonly evaluatedAt: Date;
  readonly evaluationHash: string;
}

export const modifierEvaluationRecordSchema = z.object({
  evaluationId: z.string().min(1),
  agentId: z.string().min(1),
  provenanceHash: z.string().min(64),
  policyId: z.string().min(1),
  policyVersion: z.number().int().positive(),
  computedModifier: z.number(),
  conditionsMatched: z.array(z.string()),
  evaluatedAt: z.date(),
  evaluationHash: z.string().min(64),
});

// =============================================================================
// Q1: CEILING ENFORCEMENT (Hybrid Dual-Layer + Regulatory Observability)
// =============================================================================

/**
 * Enforcement layer designation
 */
export type EnforcementLayer = 'kernel' | 'policy' | 'regulatory';

/**
 * Trust computation event with dual logging
 */
export interface TrustComputationEvent {
  readonly eventId: string;
  readonly agentId: string;
  readonly timestamp: Date;

  // Dual logging (Q1 decision)
  readonly rawScore: number;              // Pre-ceiling (for analytics/gaming detection)
  readonly clampedScore: number;          // Post-ceiling (operational)
  readonly ceilingApplied: boolean;
  readonly ceilingSource?: CeilingSource;

  // Enforcement tracking
  readonly enforcementLayer: EnforcementLayer;
  readonly kernelValidated: boolean;
  readonly policyValidated: boolean;
  readonly regulatoryLogged: boolean;

  // Context
  readonly contextType: ContextType;
  readonly contextCeiling: number;
  readonly effectiveTier: TrustTier;

  // Audit
  readonly eventHash: string;
  readonly previousEventHash?: string;
}

export interface CeilingSource {
  readonly type: 'context' | 'organizational' | 'deployment' | 'attestation';
  readonly value: number;
  readonly constraint: string;
}

export const trustComputationEventSchema = z.object({
  eventId: z.string().min(1),
  agentId: z.string().min(1),
  timestamp: z.date(),
  rawScore: z.number().min(0),
  clampedScore: z.number().min(0).max(1000),
  ceilingApplied: z.boolean(),
  ceilingSource: z.object({
    type: z.enum(['context', 'organizational', 'deployment', 'attestation']),
    value: z.number(),
    constraint: z.string(),
  }).optional(),
  enforcementLayer: z.enum(['kernel', 'policy', 'regulatory']),
  kernelValidated: z.boolean(),
  policyValidated: z.boolean(),
  regulatoryLogged: z.boolean(),
  contextType: z.nativeEnum(ContextType),
  contextCeiling: z.number(),
  effectiveTier: z.nativeEnum(TrustTier),
  eventHash: z.string().min(64),
  previousEventHash: z.string().min(64).optional(),
});

/**
 * Regulatory audit ledger entry (SEPARATE from operational events)
 */
export interface RegulatoryAuditEntry {
  readonly entryId: string;
  readonly agentId: string;
  readonly timestamp: Date;

  // Raw data preserved for gaming detection
  readonly rawScore: number;
  readonly clampedScore: number;
  readonly variance: number; // rawScore - clampedScore

  // Gaming detection flags
  readonly varianceAnomaly: boolean;     // Unusual raw/clamped gap
  readonly frequencyAnomaly: boolean;    // Unusual score change rate
  readonly patternAnomaly: boolean;      // Suspicious score patterns

  // Compliance tracking
  readonly regulatoryFramework: RegulatoryFramework;
  readonly complianceStatus: 'compliant' | 'warning' | 'violation';
  readonly retentionRequired: boolean;
  readonly retentionUntil?: Date;

  // Immutability
  readonly entryHash: string;
  readonly previousEntryHash?: string;
  readonly ledgerSequence: number;
}

export const regulatoryAuditEntrySchema = z.object({
  entryId: z.string().min(1),
  agentId: z.string().min(1),
  timestamp: z.date(),
  rawScore: z.number(),
  clampedScore: z.number(),
  variance: z.number(),
  varianceAnomaly: z.boolean(),
  frequencyAnomaly: z.boolean(),
  patternAnomaly: z.boolean(),
  regulatoryFramework: z.nativeEnum(RegulatoryFramework),
  complianceStatus: z.enum(['compliant', 'warning', 'violation']),
  retentionRequired: z.boolean(),
  retentionUntil: z.date().optional(),
  entryHash: z.string().min(64),
  previousEntryHash: z.string().min(64).optional(),
  ledgerSequence: z.number().int().nonnegative(),
});

// =============================================================================
// Q3: STRATIFIED ROLE GATES (3-Layer Enforcement)
// =============================================================================

/**
 * Role gate matrix entry
 */
export interface RoleGateEntry {
  readonly role: AgentRole;
  readonly minimumTier: TrustTier;
  readonly allowedTiers: readonly TrustTier[];
}

/**
 * Pre-computed role gate matrix
 * Higher-capability roles require higher trust.
 */
export const ROLE_GATE_MATRIX: Record<AgentRole, Record<TrustTier, boolean>> = {
  [AgentRole.R_L0]: { [TrustTier.T0]: true, [TrustTier.T1]: true, [TrustTier.T2]: true, [TrustTier.T3]: true, [TrustTier.T4]: true, [TrustTier.T5]: true },
  [AgentRole.R_L1]: { [TrustTier.T0]: true, [TrustTier.T1]: true, [TrustTier.T2]: true, [TrustTier.T3]: true, [TrustTier.T4]: true, [TrustTier.T5]: true },
  [AgentRole.R_L2]: { [TrustTier.T0]: false, [TrustTier.T1]: true, [TrustTier.T2]: true, [TrustTier.T3]: true, [TrustTier.T4]: true, [TrustTier.T5]: true },
  [AgentRole.R_L3]: { [TrustTier.T0]: false, [TrustTier.T1]: false, [TrustTier.T2]: true, [TrustTier.T3]: true, [TrustTier.T4]: true, [TrustTier.T5]: true },
  [AgentRole.R_L4]: { [TrustTier.T0]: false, [TrustTier.T1]: false, [TrustTier.T2]: false, [TrustTier.T3]: true, [TrustTier.T4]: true, [TrustTier.T5]: true },
  [AgentRole.R_L5]: { [TrustTier.T0]: false, [TrustTier.T1]: false, [TrustTier.T2]: false, [TrustTier.T3]: false, [TrustTier.T4]: true, [TrustTier.T5]: true },
  [AgentRole.R_L6]: { [TrustTier.T0]: false, [TrustTier.T1]: false, [TrustTier.T2]: false, [TrustTier.T3]: false, [TrustTier.T4]: false, [TrustTier.T5]: true },
  [AgentRole.R_L7]: { [TrustTier.T0]: false, [TrustTier.T1]: false, [TrustTier.T2]: false, [TrustTier.T3]: false, [TrustTier.T4]: false, [TrustTier.T5]: true },
  [AgentRole.R_L8]: { [TrustTier.T0]: false, [TrustTier.T1]: false, [TrustTier.T2]: false, [TrustTier.T3]: false, [TrustTier.T4]: false, [TrustTier.T5]: true },
};

/**
 * Policy rule for role gate (policy-as-code layer)
 */
export interface RoleGatePolicy {
  readonly policyId: string;
  readonly version: number;
  readonly rules: readonly RoleGatePolicyRule[];
  readonly effectiveFrom: Date;
  readonly effectiveUntil?: Date;
  readonly createdAt: Date;
  readonly createdBy: string;
  readonly policyHash: string;
}

export interface RoleGatePolicyRule {
  readonly ruleId: string;
  readonly name: string;
  readonly condition: RoleGateCondition;
  readonly action: 'ALLOW' | 'DENY' | 'ESCALATE';
  readonly priority: number;
  readonly reason: string;
}

export interface RoleGateCondition {
  readonly roles?: readonly AgentRole[];
  readonly tiers?: readonly TrustTier[];
  readonly contextTypes?: readonly ContextType[];
  readonly domains?: readonly string[];
  readonly timeWindow?: { start: string; end: string }; // HH:MM format
  readonly requiresAttestation?: readonly string[];
}

export const roleGatePolicySchema = z.object({
  policyId: z.string().min(1),
  version: z.number().int().positive(),
  rules: z.array(z.object({
    ruleId: z.string().min(1),
    name: z.string().min(1),
    condition: z.object({
      roles: z.array(z.nativeEnum(AgentRole)).optional(),
      tiers: z.array(z.nativeEnum(TrustTier)).optional(),
      contextTypes: z.array(z.nativeEnum(ContextType)).optional(),
      domains: z.array(z.string()).optional(),
      timeWindow: z.object({ start: z.string(), end: z.string() }).optional(),
      requiresAttestation: z.array(z.string()).optional(),
    }),
    action: z.enum(['ALLOW', 'DENY', 'ESCALATE']),
    priority: z.number().int(),
    reason: z.string(),
  })),
  effectiveFrom: z.date(),
  effectiveUntil: z.date().optional(),
  createdAt: z.date(),
  createdBy: z.string().min(1),
  policyHash: z.string().min(64),
});

/**
 * Role gate evaluation result (3-layer)
 */
export interface RoleGateEvaluation {
  readonly evaluationId: string;
  readonly agentId: string;
  readonly role: AgentRole;
  readonly tier: TrustTier;
  readonly timestamp: Date;

  // Layer 1: Kernel (structure validation)
  readonly kernelResult: {
    readonly valid: boolean;
    readonly matrixAllows: boolean;
    readonly reason?: string;
  };

  // Layer 2: Policy (authorization via policy-as-code)
  readonly policyResult: {
    readonly valid: boolean;
    readonly appliedRuleId?: string;
    readonly appliedPolicyVersion?: number;
    readonly action: 'ALLOW' | 'DENY' | 'ESCALATE';
    readonly reason: string;
  };

  // Layer 3: BASIS/ENFORCE (runtime context)
  readonly basisResult: {
    readonly valid: boolean;
    readonly requiresOverride: boolean;
    readonly overrideSignatures?: readonly string[]; // Dual-control
    readonly contextConstraintsMet: boolean;
    readonly reason?: string;
  };

  // Final decision
  readonly decision: 'ALLOW' | 'DENY' | 'ESCALATE';
  readonly decidedAt: Date;
  readonly evaluationHash: string;
}

export const roleGateEvaluationSchema = z.object({
  evaluationId: z.string().min(1),
  agentId: z.string().min(1),
  role: z.nativeEnum(AgentRole),
  tier: z.nativeEnum(TrustTier),
  timestamp: z.date(),
  kernelResult: z.object({
    valid: z.boolean(),
    matrixAllows: z.boolean(),
    reason: z.string().optional(),
  }),
  policyResult: z.object({
    valid: z.boolean(),
    appliedRuleId: z.string().optional(),
    appliedPolicyVersion: z.number().optional(),
    action: z.enum(['ALLOW', 'DENY', 'ESCALATE']),
    reason: z.string(),
  }),
  basisResult: z.object({
    valid: z.boolean(),
    requiresOverride: z.boolean(),
    overrideSignatures: z.array(z.string()).optional(),
    contextConstraintsMet: z.boolean(),
    reason: z.string().optional(),
  }),
  decision: z.enum(['ALLOW', 'DENY', 'ESCALATE']),
  decidedAt: z.date(),
  evaluationHash: z.string().min(64),
});

// =============================================================================
// INTEGRATED TRUST SCORE COMPUTATION
// =============================================================================

/**
 * Trust score computation configuration
 */
export interface TrustScoreConfig {
  readonly agentContext: AgentContext;
  readonly provenance: AgentProvenance;
  readonly preset: TrustPreset;
  readonly role: AgentRole;
}

/**
 * Trust metrics input
 */
export interface TrustMetrics {
  readonly observability: number;  // 0-1: How much can we see?
  readonly capability: number;     // 0-1: Technical ability score
  readonly behavior: number;       // 0-1: Historical reliability
  readonly governance: number;     // 0-1: Policy compliance
  readonly context: number;        // 0-1: Environmental fit
}

export const trustMetricsSchema = z.object({
  observability: z.number().min(0).max(1),
  capability: z.number().min(0).max(1),
  behavior: z.number().min(0).max(1),
  governance: z.number().min(0).max(1),
  context: z.number().min(0).max(1),
});

/**
 * Complete trust computation result
 */
export interface TrustComputationResult {
  readonly agentId: string;
  readonly computedAt: Date;

  // Scores
  readonly rawScore: number;      // Pre-ceiling
  readonly finalScore: number;    // Post-ceiling (clamped)
  readonly effectiveTier: TrustTier;

  // Ceiling
  readonly ceilingApplied: boolean;
  readonly ceilingValue: number;
  readonly ceilingSource: CeilingSource;

  // Modifiers
  readonly creationModifier: number;
  readonly modifierPolicyVersion: number;

  // Weights applied
  readonly weightsUsed: TrustWeights;
  readonly presetId: string;
  readonly presetLineage: PresetLineage;

  // Validation
  readonly contextValid: boolean;
  readonly roleGateValid: boolean;
  readonly overallValid: boolean;

  // Audit
  readonly computationHash: string;
  readonly auditTrail: readonly string[]; // Event IDs
}

export const trustComputationResultSchema = z.object({
  agentId: z.string().min(1),
  computedAt: z.date(),
  rawScore: z.number(),
  finalScore: z.number().min(0).max(1000),
  effectiveTier: z.nativeEnum(TrustTier),
  ceilingApplied: z.boolean(),
  ceilingValue: z.number(),
  ceilingSource: z.object({
    type: z.enum(['context', 'organizational', 'deployment', 'attestation']),
    value: z.number(),
    constraint: z.string(),
  }),
  creationModifier: z.number(),
  modifierPolicyVersion: z.number().int().positive(),
  weightsUsed: trustWeightsSchema,
  presetId: z.string().min(1),
  presetLineage: presetLineageSchema,
  contextValid: z.boolean(),
  roleGateValid: z.boolean(),
  overallValid: z.boolean(),
  computationHash: z.string().min(64),
  auditTrail: z.array(z.string()),
});

// =============================================================================
// CANONICAL PRESETS (ACI Spec - Immutable)
// =============================================================================

export const ACI_CANONICAL_PRESETS: Record<string, TrustPreset> = {
  'aci:preset:balanced': {
    presetId: 'aci:preset:balanced',
    name: 'Balanced',
    description: 'Equal weight across all trust dimensions',
    source: 'aci',
    version: 1,
    weights: {
      observability: 0.20,
      capability: 0.20,
      behavior: 0.20,
      governance: 0.20,
      context: 0.20,
    },
    createdAt: new Date('2025-01-01T00:00:00Z'),
    createdBy: '@aci-spec',
    presetHash: 'aci:sha256:b2c4e6a8f0d2b4c6e8a0d2b4c6e8a0d2b4c6e8a0d2b4c6e8a0d2b4c6e8a0d2b4',
  },
  'aci:preset:conservative': {
    presetId: 'aci:preset:conservative',
    name: 'Conservative (High Governance)',
    description: 'Prioritizes governance compliance and observability',
    source: 'aci',
    version: 1,
    weights: {
      observability: 0.30,
      capability: 0.15,
      behavior: 0.20,
      governance: 0.25,
      context: 0.10,
    },
    createdAt: new Date('2025-01-01T00:00:00Z'),
    createdBy: '@aci-spec',
    presetHash: 'aci:sha256:c3d5e7a9f1d3b5c7e9a1d3b5c7e9a1d3b5c7e9a1d3b5c7e9a1d3b5c7e9a1d3b5',
  },
  'aci:preset:capability-focused': {
    presetId: 'aci:preset:capability-focused',
    name: 'Capability Focused',
    description: 'Prioritizes technical ability and behavior history',
    source: 'aci',
    version: 1,
    weights: {
      observability: 0.15,
      capability: 0.35,
      behavior: 0.25,
      governance: 0.15,
      context: 0.10,
    },
    createdAt: new Date('2025-01-01T00:00:00Z'),
    createdBy: '@aci-spec',
    presetHash: 'aci:sha256:d4e6f8a0b2d4c6e8f0a2b4d6c8e0f2a4b6d8c0e2f4a6b8d0c2e4f6a8b0d2c4e6',
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get trust tier from score
 */
export function getTierFromScore(score: number): TrustTier {
  if (score < 100) return TrustTier.T0;
  if (score < 300) return TrustTier.T1;
  if (score < 500) return TrustTier.T2;
  if (score < 700) return TrustTier.T3;
  if (score < 900) return TrustTier.T4;
  return TrustTier.T5;
}

/**
 * Get ceiling for context type
 */
export function getCeilingForContext(contextType: ContextType): number {
  return CONTEXT_CEILINGS[contextType];
}

/**
 * Validate role+tier combination against kernel matrix
 */
export function validateRoleGateKernel(role: AgentRole, tier: TrustTier): boolean {
  return ROLE_GATE_MATRIX[role]?.[tier] ?? false;
}

/**
 * Clamp score to ceiling
 */
export function clampToCeiling(score: number, ceiling: number): number {
  return Math.min(Math.max(0, score), ceiling);
}

/**
 * Generate SHA-256 hash (placeholder - use crypto in implementation)
 */
export function generateHash(data: string): string {
  // In real implementation, use crypto.subtle.digest or Node's crypto
  // This is a placeholder that should be replaced
  return `sha256:${Buffer.from(data).toString('base64').slice(0, 64)}`;
}
