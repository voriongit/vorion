/**
 * Agent Anchor Contract Schemas
 *
 * Canonical schema definitions for the Agent Anchor Trust Validation System.
 * These schemas define the contract between all system components.
 *
 * Schema Categories:
 * 1. Common - Shared primitives and types
 * 2. IntentPackage - Input from strategic layer (AURYN)
 * 3. PolicySet - Declarative policies for enforcement
 * 4. AuthorizationDecision - Output from ACE
 * 5. ExecutionEvent - Telemetry from execution
 * 6. ProofPack - Cryptographic audit bundles
 * 7. TrustSignal - Accountability signals
 * 8. Entitlement - Commercial/operational boundaries
 *
 * All schemas use Zod for runtime validation.
 *
 * @version 1.0.0
 */

// ============================================================================
// COMMON TYPES
// ============================================================================
export {
  // Identifiers
  UUIDSchema,
  SemVerSchema,
  TimestampSchema,
  HashSchema,
  CorrelationIdSchema,
  // Actors
  ActorTypeSchema,
  ActorSchema,
  // Autonomy
  AutonomyLevelSchema,
  AutonomyLevelNumeric,
  // Decisions
  DecisionOutcomeSchema,
  ExecutionOutcomeSchema,
  // Risk & Severity
  SeveritySchema,
  RiskLevelSchema,
  // Scope
  ScopeSchema,
  // Provenance
  ProvenanceSchema,
  // Types
  type UUID,
  type SemVer,
  type Timestamp,
  type Hash,
  type CorrelationId,
  type ActorType,
  type Actor,
  type AutonomyLevel,
  type DecisionOutcome,
  type ExecutionOutcome,
  type Severity,
  type RiskLevel,
  type Scope,
  type Provenance,
} from './common.js';

// ============================================================================
// INTENT PACKAGE
// ============================================================================
export {
  // Schemas
  IntentTypeSchema,
  IntentStatusSchema,
  IntentTargetSchema,
  IntentParametersSchema,
  IntentConstraintsSchema,
  IntentContextSchema,
  IntentPackageSchema,
  IntentValidationResultSchema,
  // Types
  type IntentType,
  type IntentStatus,
  type IntentTarget,
  type IntentParameters,
  type IntentConstraints,
  type IntentContext,
  type IntentPackage,
  type IntentValidationResult,
} from './intent-package.js';

// ============================================================================
// POLICY SET
// ============================================================================
export {
  // Schemas
  PolicyTypeSchema,
  PolicyStatusSchema,
  EnforcementModeSchema,
  PolicyApplicabilitySchema,
  ComparisonOperatorSchema,
  LogicalOperatorSchema,
  RuleConditionSchema,
  RuleActionSchema,
  PolicyRuleSchema,
  PolicyProvenanceSchema,
  PolicySetSchema,
  RuleEvaluationResultSchema,
  PolicyEvaluationResultSchema,
  // Types
  type PolicyType,
  type PolicyStatus,
  type EnforcementMode,
  type PolicyApplicability,
  type ComparisonOperator,
  type LogicalOperator,
  type RuleCondition,
  type RuleAction,
  type PolicyRule,
  type PolicyProvenance,
  type PolicySet,
  type RuleEvaluationResult,
  type PolicyEvaluationResult,
} from './policy-set.js';

// ============================================================================
// AUTHORIZATION DECISION
// ============================================================================
export {
  // Schemas
  EscalationTypeSchema,
  EscalationRequirementSchema,
  ExecutionConstraintsSchema,
  DecisionReasonCodeSchema,
  AuthorizationDecisionSchema,
  DecisionSummarySchema,
  // Types
  type EscalationType,
  type EscalationRequirement,
  type ExecutionConstraints,
  type DecisionReasonCode,
  type AuthorizationDecision,
  type DecisionSummary,
} from './authorization-decision.js';

// ============================================================================
// EXECUTION EVENT
// ============================================================================
export {
  // Schemas
  ExecutionEventTypeSchema,
  ToolInvocationSchema,
  ErrorDetailsSchema,
  ResourceAccessSchema,
  ExecutionMetricsSchema,
  ExecutionEventSchema,
  ExecutionTraceSchema,
  // Types
  type ExecutionEventType,
  type ToolInvocation,
  type ErrorDetails,
  type ResourceAccess,
  type ExecutionMetrics,
  type ExecutionEvent,
  type ExecutionTrace,
} from './execution-event.js';

// ============================================================================
// PROOF PACK
// ============================================================================
export {
  // Schemas
  AuditRecordTypeSchema,
  AuditRecordSchema,
  MerkleNodeSchema,
  MerkleProofSchema,
  ChainVerificationResultSchema,
  RedactionPolicySchema,
  ExportFormatSchema,
  ProofPackSchema,
  ProofPackRequestSchema,
  // Types
  type AuditRecordType,
  type AuditRecord,
  type MerkleNode,
  type MerkleProof,
  type ChainVerificationResult,
  type RedactionPolicy,
  type ExportFormat,
  type ProofPack,
  type ProofPackRequest,
} from './proof-pack.js';

// ============================================================================
// TRUST SIGNAL
// ============================================================================
export {
  // Schemas
  TrustSignalTypeSchema,
  TrustImpactDirectionSchema,
  TrustScoreDeltaSchema,
  ViolationRecordSchema,
  EscalationRecordSchema,
  AutonomyChangeSchema,
  TrustSignalSchema,
  TrustProfileSchema,
  // Types
  type TrustSignalType,
  type TrustImpactDirection,
  type TrustScoreDelta,
  type ViolationRecord,
  type EscalationRecord,
  type AutonomyChange,
  type TrustSignal,
  type TrustProfile,
} from './trust-signal.js';

// ============================================================================
// ENTITLEMENT
// ============================================================================
export {
  // Schemas
  PlanTierSchema,
  FeatureDefinitionSchema,
  FeatureEntitlementSchema,
  UsageEventSchema,
  UsageSummarySchema,
  BudgetAllocationSchema,
  BudgetCheckResultSchema,
  ReceiptLineItemSchema,
  UsageReceiptSchema,
  EntitlementSetSchema,
  EntitlementCheckRequestSchema,
  EntitlementCheckResultSchema,
  // Types
  type PlanTier,
  type FeatureDefinition,
  type FeatureEntitlement,
  type UsageEvent,
  type UsageSummary,
  type BudgetAllocation,
  type BudgetCheckResult,
  type ReceiptLineItem,
  type UsageReceipt,
  type EntitlementSet,
  type EntitlementCheckRequest,
  type EntitlementCheckResult,
} from './entitlement.js';

// ============================================================================
// SCHEMA VERSION
// ============================================================================
export const SCHEMA_VERSION = '1.0.0' as const;
export const SCHEMA_NAMESPACE = 'agent-anchor' as const;
