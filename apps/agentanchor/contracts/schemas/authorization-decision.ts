/**
 * Authorization Decision Schema
 *
 * Defines the output of the Authorization & Constraint Engine (ACE).
 * Per spec Section IV.3 and Section V:
 *
 * For each intent or execution request:
 * - Evaluate applicable policies
 * - Determine APPROVE / MODIFY / REJECT
 * - Assign autonomy level
 * - Gate allowed tools and scopes
 * - Enforce rate limits and budgets
 * - Determine escalation requirements
 *
 * Rules:
 * - Deterministic behavior only
 * - No probabilistic reasoning
 * - No strategic judgment
 * - Every decision must be explainable
 */

import { z } from 'zod';
import {
  UUIDSchema,
  TimestampSchema,
  SemVerSchema,
  DecisionOutcomeSchema,
  AutonomyLevelSchema,
  ScopeSchema,
  CorrelationIdSchema,
  RiskLevelSchema,
} from './common.js';
import { PolicyEvaluationResultSchema } from './policy-set.js';

// ============================================================================
// ESCALATION TYPES
// ============================================================================

/** Types of escalation */
export const EscalationTypeSchema = z.enum([
  'HUMAN_APPROVAL',     // Requires human approval
  'MANAGER_REVIEW',     // Requires manager-level review
  'COMPLIANCE_REVIEW',  // Requires compliance team review
  'SECURITY_REVIEW',    // Requires security team review
  'EMERGENCY',          // Emergency escalation
  'BUDGET_OVERRIDE',    // Budget limit exceeded
  'RISK_THRESHOLD',     // Risk threshold exceeded
  'POLICY_EXCEPTION',   // Policy exception required
]);

/** Escalation requirement */
export const EscalationRequirementSchema = z.object({
  /** Type of escalation */
  type: EscalationTypeSchema,
  /** Why escalation is required */
  reason: z.string(),
  /** Priority level */
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
  /** Timeout for escalation response (ms) */
  timeoutMs: z.number().int().positive().optional(),
  /** Who can approve this escalation */
  approverRoles: z.array(z.string()).optional(),
  /** Minimum approvers required */
  minApprovers: z.number().int().positive().default(1),
  /** Policy/rule that triggered escalation */
  triggeredBy: z.string().optional(),
});

// ============================================================================
// EXECUTION CONSTRAINTS
// ============================================================================

/** Detailed execution constraints applied by authorization */
export const ExecutionConstraintsSchema = z.object({
  // ─── Tool Constraints ───────────────────────────────────────────────────────
  /** Tools explicitly allowed */
  allowedTools: z.array(z.string()).optional(),
  /** Tools explicitly denied */
  deniedTools: z.array(z.string()).optional(),
  /** Required tool configurations */
  toolConfigs: z.record(z.record(z.unknown())).optional(),

  // ─── Resource Constraints ───────────────────────────────────────────────────
  /** Resources that can be accessed */
  allowedResources: z.array(z.string()).optional(),
  /** Resources that cannot be accessed */
  deniedResources: z.array(z.string()).optional(),
  /** Read-only resources (no modification) */
  readOnlyResources: z.array(z.string()).optional(),

  // ─── Action Constraints ─────────────────────────────────────────────────────
  /** Actions explicitly allowed */
  allowedActions: z.array(z.string()).optional(),
  /** Actions explicitly denied */
  deniedActions: z.array(z.string()).optional(),

  // ─── Time Constraints ───────────────────────────────────────────────────────
  /** Maximum execution duration (ms) */
  maxDurationMs: z.number().int().positive().optional(),
  /** Execution must complete by this time */
  deadline: TimestampSchema.optional(),
  /** Earliest time execution can start */
  notBefore: TimestampSchema.optional(),

  // ─── Budget Constraints ─────────────────────────────────────────────────────
  /** Maximum budget for execution */
  maxBudget: z.number().nonnegative().optional(),
  /** Budget unit */
  budgetUnit: z.string().optional(),
  /** Cost tracking required */
  requireCostTracking: z.boolean().optional(),

  // ─── Rate Limits ────────────────────────────────────────────────────────────
  /** Rate limit configuration */
  rateLimit: z.object({
    requests: z.number().int().positive(),
    windowMs: z.number().int().positive(),
    scope: z.enum(['GLOBAL', 'USER', 'SESSION', 'INTENT']).optional(),
  }).optional(),

  // ─── Data Constraints ───────────────────────────────────────────────────────
  /** Maximum input size (bytes) */
  maxInputSize: z.number().int().positive().optional(),
  /** Maximum output size (bytes) */
  maxOutputSize: z.number().int().positive().optional(),
  /** Data retention policy */
  dataRetention: z.enum(['NONE', 'SESSION', 'TEMPORARY', 'PERMANENT']).optional(),
  /** Required data redaction */
  redactionRequired: z.boolean().optional(),
  /** Fields to redact */
  redactFields: z.array(z.string()).optional(),

  // ─── Safety Constraints ─────────────────────────────────────────────────────
  /** Must be reversible */
  mustBeReversible: z.boolean().optional(),
  /** Must be idempotent */
  mustBeIdempotent: z.boolean().optional(),
  /** Sandbox execution required */
  requireSandbox: z.boolean().optional(),
  /** Dry-run mode (no actual execution) */
  dryRunOnly: z.boolean().optional(),

  // ─── Monitoring Constraints ─────────────────────────────────────────────────
  /** Enhanced logging required */
  enhancedLogging: z.boolean().optional(),
  /** Real-time monitoring required */
  realTimeMonitoring: z.boolean().optional(),
  /** Checkpoint frequency (ms) */
  checkpointIntervalMs: z.number().int().positive().optional(),
});

// ============================================================================
// AUTHORIZATION DECISION (Main Schema)
// ============================================================================

/** Reason code for the decision */
export const DecisionReasonCodeSchema = z.enum([
  // Approval reasons
  'POLICY_APPROVED',
  'DEFAULT_ALLOW',
  'PRE_APPROVED',
  'HUMAN_APPROVED',
  'EXCEPTION_GRANTED',

  // Rejection reasons
  'POLICY_DENIED',
  'BUDGET_EXCEEDED',
  'RATE_LIMITED',
  'INSUFFICIENT_TRUST',
  'INVALID_INTENT',
  'EXPIRED_INTENT',
  'UNAUTHORIZED_ACTOR',
  'UNAUTHORIZED_TARGET',
  'RISK_TOO_HIGH',
  'JURISDICTION_BLOCKED',

  // Modification reasons
  'CONSTRAINTS_ADDED',
  'SCOPE_REDUCED',
  'AUTONOMY_REDUCED',

  // Escalation reasons
  'REQUIRES_APPROVAL',
  'REQUIRES_REVIEW',
  'POLICY_CONFLICT',
]);

/**
 * AuthorizationDecision is the canonical output of ACE.
 * Every decision is deterministic and explainable.
 */
export const AuthorizationDecisionSchema = z.object({
  // ─── Identity ───────────────────────────────────────────────────────────────
  /** Unique identifier for this decision */
  id: UUIDSchema,
  /** Schema version */
  schemaVersion: SemVerSchema.default('1.0.0'),
  /** Correlation ID for tracing */
  correlationId: CorrelationIdSchema,

  // ─── Reference ──────────────────────────────────────────────────────────────
  /** Intent ID this decision applies to */
  intentId: UUIDSchema,
  /** Intent type */
  intentType: z.string(),
  /** Actor who requested authorization */
  requestedBy: z.string(),

  // ─── Decision ───────────────────────────────────────────────────────────────
  /** The authorization outcome */
  outcome: DecisionOutcomeSchema,
  /** Primary reason code */
  reasonCode: DecisionReasonCodeSchema,
  /** Human-readable explanation */
  explanation: z.string(),
  /** Detailed reasoning (for audit) */
  detailedReasoning: z.array(z.string()).optional(),

  // ─── Risk Assessment ────────────────────────────────────────────────────────
  /** Assessed risk level */
  riskLevel: RiskLevelSchema,
  /** Risk factors identified */
  riskFactors: z.array(z.object({
    factor: z.string(),
    severity: RiskLevelSchema,
    description: z.string(),
  })).optional(),

  // ─── Autonomy ───────────────────────────────────────────────────────────────
  /** Granted autonomy level */
  grantedAutonomyLevel: AutonomyLevelSchema,
  /** Requested autonomy level (from intent) */
  requestedAutonomyLevel: AutonomyLevelSchema.optional(),
  /** Why autonomy was reduced (if applicable) */
  autonomyReductionReason: z.string().optional(),

  // ─── Constraints ────────────────────────────────────────────────────────────
  /** Execution constraints to apply */
  constraints: ExecutionConstraintsSchema,
  /** Merged scope from all policies */
  effectiveScope: ScopeSchema.optional(),

  // ─── Escalation ─────────────────────────────────────────────────────────────
  /** Escalation requirements (if any) */
  escalations: z.array(EscalationRequirementSchema).optional(),
  /** Is execution blocked pending escalation? */
  blockedPendingEscalation: z.boolean().default(false),

  // ─── Policy Audit ───────────────────────────────────────────────────────────
  /** Policies that were evaluated */
  policiesEvaluated: z.array(PolicyEvaluationResultSchema),
  /** Total policies evaluated */
  policyCount: z.number().int().nonnegative(),
  /** Policies that matched/applied */
  policiesApplied: z.number().int().nonnegative(),

  // ─── Validity ───────────────────────────────────────────────────────────────
  /** When this decision was made */
  decidedAt: TimestampSchema,
  /** When this decision expires */
  validUntil: TimestampSchema.optional(),
  /** Is this a cached decision? */
  isCached: z.boolean().default(false),
  /** Cache key (if cached) */
  cacheKey: z.string().optional(),

  // ─── Integrity ──────────────────────────────────────────────────────────────
  /** Hash of decision content */
  decisionHash: z.string().optional(),
  /** Signature of decision */
  signature: z.string().optional(),
  /** Decision version (for amendments) */
  version: z.number().int().positive().default(1),
  /** Previous decision ID (if amended) */
  amendsDecisionId: UUIDSchema.optional(),
});

// ============================================================================
// DECISION SUMMARY (for reporting)
// ============================================================================

/** Compact decision summary for dashboards/reports */
export const DecisionSummarySchema = z.object({
  decisionId: UUIDSchema,
  intentId: UUIDSchema,
  outcome: DecisionOutcomeSchema,
  reasonCode: DecisionReasonCodeSchema,
  riskLevel: RiskLevelSchema,
  autonomyLevel: AutonomyLevelSchema,
  hasEscalations: z.boolean(),
  decidedAt: TimestampSchema,
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type EscalationType = z.infer<typeof EscalationTypeSchema>;
export type EscalationRequirement = z.infer<typeof EscalationRequirementSchema>;
export type ExecutionConstraints = z.infer<typeof ExecutionConstraintsSchema>;
export type DecisionReasonCode = z.infer<typeof DecisionReasonCodeSchema>;
export type AuthorizationDecision = z.infer<typeof AuthorizationDecisionSchema>;
export type DecisionSummary = z.infer<typeof DecisionSummarySchema>;
