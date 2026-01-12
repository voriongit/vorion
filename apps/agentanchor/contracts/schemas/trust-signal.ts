/**
 * Trust Signal Schema
 *
 * Defines trust and accountability signals emitted by Agent Anchor.
 * Per spec Section IV.7 (Trust & Accountability Signal Engine):
 *
 * Signals Include:
 * - Trust score deltas
 * - Violation frequency
 * - Escalation history
 * - Autonomy reductions
 * - Incident attribution
 *
 * Rules:
 * - Signals are DESCRIPTIVE, not punitive
 * - No hidden scoring logic
 * - Fully auditable
 */

import { z } from 'zod';
import {
  UUIDSchema,
  TimestampSchema,
  SemVerSchema,
  ActorSchema,
  CorrelationIdSchema,
  SeveritySchema,
  AutonomyLevelSchema,
} from './common.js';

// ============================================================================
// SIGNAL TYPES
// ============================================================================

/** Classification of trust signal */
export const TrustSignalTypeSchema = z.enum([
  // Positive signals
  'SUCCESSFUL_EXECUTION',       // Completed without issues
  'CONSTRAINT_COMPLIANCE',      // Stayed within constraints
  'CLEAN_AUDIT',               // No violations found
  'TRUST_RESTORED',            // Trust recovered after incident

  // Neutral signals
  'AUTONOMY_ADJUSTED',         // Autonomy level changed
  'POLICY_UPDATED',            // Policy affecting entity updated
  'CONTEXT_CHANGED',           // Context/environment changed

  // Negative signals
  'CONSTRAINT_VIOLATION',      // Violated a constraint
  'AUTHORIZATION_DENIED',      // Request was denied
  'ESCALATION_REQUIRED',       // Required human escalation
  'RATE_LIMIT_EXCEEDED',       // Hit rate limits
  'BUDGET_EXCEEDED',           // Exceeded budget
  'ERROR_OCCURRED',            // Error during execution
  'TIMEOUT_OCCURRED',          // Execution timed out
  'SECURITY_INCIDENT',         // Security-related issue

  // Accountability signals
  'INCIDENT_ATTRIBUTED',       // Incident attributed to entity
  'REMEDIATION_REQUIRED',      // Remediation action needed
  'REVIEW_REQUIRED',           // Manual review needed
]);

/** Direction of trust impact */
export const TrustImpactDirectionSchema = z.enum([
  'POSITIVE',     // Increases trust
  'NEGATIVE',     // Decreases trust
  'NEUTRAL',      // No trust impact
]);

// ============================================================================
// TRUST SCORE DELTA
// ============================================================================

/** Trust score change details */
export const TrustScoreDeltaSchema = z.object({
  /** Previous trust score */
  previousScore: z.number().min(0).max(1000),
  /** New trust score */
  newScore: z.number().min(0).max(1000),
  /** Delta (can be negative) */
  delta: z.number(),
  /** Impact direction */
  direction: TrustImpactDirectionSchema,
  /** Score component breakdown */
  components: z.record(z.object({
    previousValue: z.number(),
    newValue: z.number(),
    delta: z.number(),
    weight: z.number(),
  })).optional(),
  /** Calculation explanation */
  explanation: z.string(),
});

// ============================================================================
// VIOLATION RECORD
// ============================================================================

/** Record of a violation */
export const ViolationRecordSchema = z.object({
  /** Violation ID */
  id: UUIDSchema,
  /** Violation type */
  type: z.enum([
    'POLICY_VIOLATION',
    'CONSTRAINT_VIOLATION',
    'AUTHORIZATION_VIOLATION',
    'RATE_LIMIT_VIOLATION',
    'BUDGET_VIOLATION',
    'DATA_VIOLATION',
    'SECURITY_VIOLATION',
  ]),
  /** Violation severity */
  severity: SeveritySchema,
  /** What was violated */
  violatedRule: z.string(),
  /** Expected value/behavior */
  expected: z.unknown(),
  /** Actual value/behavior */
  actual: z.unknown(),
  /** Violation description */
  description: z.string(),
  /** Is this violation reversible? */
  isReversible: z.boolean(),
  /** Was violation remediated? */
  wasRemediated: z.boolean().default(false),
  /** Remediation details */
  remediation: z.string().optional(),
  /** Related policy ID */
  policyId: UUIDSchema.optional(),
  /** Related intent ID */
  intentId: UUIDSchema.optional(),
  /** Violation timestamp */
  occurredAt: TimestampSchema,
});

// ============================================================================
// ESCALATION RECORD
// ============================================================================

/** Record of an escalation */
export const EscalationRecordSchema = z.object({
  /** Escalation ID */
  id: UUIDSchema,
  /** Escalation type */
  type: z.string(),
  /** Why escalation was triggered */
  reason: z.string(),
  /** Escalation severity */
  severity: SeveritySchema,
  /** Who escalation was sent to */
  escalatedTo: z.array(z.string()),
  /** Escalation status */
  status: z.enum([
    'PENDING',
    'ACKNOWLEDGED',
    'IN_REVIEW',
    'APPROVED',
    'REJECTED',
    'EXPIRED',
    'CANCELLED',
  ]),
  /** Response time (ms) */
  responseTimeMs: z.number().int().nonnegative().optional(),
  /** Responder */
  respondedBy: ActorSchema.optional(),
  /** Response details */
  response: z.string().optional(),
  /** Created timestamp */
  createdAt: TimestampSchema,
  /** Resolved timestamp */
  resolvedAt: TimestampSchema.optional(),
});

// ============================================================================
// AUTONOMY CHANGE
// ============================================================================

/** Record of autonomy level change */
export const AutonomyChangeSchema = z.object({
  /** Previous autonomy level */
  previousLevel: AutonomyLevelSchema,
  /** New autonomy level */
  newLevel: AutonomyLevelSchema,
  /** Reason for change */
  reason: z.string(),
  /** What triggered the change */
  trigger: z.enum([
    'TRUST_SCORE_CHANGE',
    'POLICY_CHANGE',
    'VIOLATION',
    'ESCALATION',
    'MANUAL_OVERRIDE',
    'TIME_BASED',
    'CONTEXT_CHANGE',
  ]),
  /** Is this a temporary change? */
  isTemporary: z.boolean().default(false),
  /** Revert timestamp (if temporary) */
  revertAt: TimestampSchema.optional(),
  /** Changed timestamp */
  changedAt: TimestampSchema,
});

// ============================================================================
// TRUST SIGNAL (Main Schema)
// ============================================================================

/**
 * TrustSignal represents a single accountability event.
 * Signals are descriptive observations, not punitive measures.
 */
export const TrustSignalSchema = z.object({
  // ─── Identity ───────────────────────────────────────────────────────────────
  /** Unique signal identifier */
  id: UUIDSchema,
  /** Schema version */
  schemaVersion: SemVerSchema.default('1.0.0'),
  /** Correlation ID */
  correlationId: CorrelationIdSchema,

  // ─── Signal Type ────────────────────────────────────────────────────────────
  /** Signal type */
  type: TrustSignalTypeSchema,
  /** Signal severity */
  severity: SeveritySchema,
  /** Impact direction */
  impactDirection: TrustImpactDirectionSchema,

  // ─── Subject ────────────────────────────────────────────────────────────────
  /** Entity this signal is about */
  subject: z.object({
    /** Subject type (e.g., 'AGENT', 'USER', 'TOOL', 'ORGANIZATION') */
    type: z.string(),
    /** Subject identifier */
    id: z.string(),
    /** Subject name */
    name: z.string().optional(),
  }),

  // ─── Context ────────────────────────────────────────────────────────────────
  /** Related intent ID */
  intentId: UUIDSchema.optional(),
  /** Related decision ID */
  decisionId: UUIDSchema.optional(),
  /** Related execution event ID */
  eventId: UUIDSchema.optional(),
  /** Organization context */
  organizationId: z.string().optional(),
  /** Environment */
  environment: z.string().optional(),

  // ─── Signal Details ─────────────────────────────────────────────────────────
  /** Human-readable description */
  description: z.string(),
  /** Detailed explanation (for audit) */
  details: z.string().optional(),
  /** Trust score change (if applicable) */
  trustScoreDelta: TrustScoreDeltaSchema.optional(),
  /** Violation record (if applicable) */
  violation: ViolationRecordSchema.optional(),
  /** Escalation record (if applicable) */
  escalation: EscalationRecordSchema.optional(),
  /** Autonomy change (if applicable) */
  autonomyChange: AutonomyChangeSchema.optional(),

  // ─── Attribution ────────────────────────────────────────────────────────────
  /** What caused this signal */
  causedBy: z.object({
    /** Cause type */
    type: z.enum([
      'INTENT',
      'EXECUTION',
      'POLICY',
      'SYSTEM',
      'HUMAN',
      'EXTERNAL',
    ]),
    /** Cause identifier */
    id: z.string(),
    /** Cause description */
    description: z.string().optional(),
  }),

  // ─── Timing ─────────────────────────────────────────────────────────────────
  /** When the underlying event occurred */
  occurredAt: TimestampSchema,
  /** When the signal was emitted */
  emittedAt: TimestampSchema,
  /** Signal expiry (if applicable) */
  expiresAt: TimestampSchema.optional(),

  // ─── Metadata ───────────────────────────────────────────────────────────────
  /** Tags */
  tags: z.array(z.string()).optional(),
  /** Custom metadata */
  metadata: z.record(z.unknown()).optional(),

  // ─── Visibility ─────────────────────────────────────────────────────────────
  /** Who can see this signal */
  visibility: z.enum([
    'PUBLIC',         // Anyone can see
    'ORGANIZATION',   // Organization members only
    'ADMIN',          // Admins only
    'SYSTEM',         // System use only
  ]).default('ORGANIZATION'),
});

// ============================================================================
// TRUST PROFILE
// ============================================================================

/** Aggregate trust profile for an entity */
export const TrustProfileSchema = z.object({
  /** Profile ID */
  id: UUIDSchema,
  /** Subject of the profile */
  subject: z.object({
    type: z.string(),
    id: z.string(),
    name: z.string().optional(),
  }),
  /** Current trust score */
  currentScore: z.number().min(0).max(1000),
  /** Trust tier */
  tier: z.enum([
    'UNTRUSTED',      // 0-199
    'PROVISIONAL',    // 200-399
    'TRUSTED',        // 400-599
    'VERIFIED',       // 600-799
    'CERTIFIED',      // 800-899
    'LEGENDARY',      // 900-1000
  ]),
  /** Current autonomy level */
  autonomyLevel: AutonomyLevelSchema,
  /** Profile statistics */
  stats: z.object({
    /** Total signals received */
    totalSignals: z.number().int().nonnegative(),
    /** Positive signals */
    positiveSignals: z.number().int().nonnegative(),
    /** Negative signals */
    negativeSignals: z.number().int().nonnegative(),
    /** Total violations */
    totalViolations: z.number().int().nonnegative(),
    /** Total escalations */
    totalEscalations: z.number().int().nonnegative(),
    /** Successful executions */
    successfulExecutions: z.number().int().nonnegative(),
    /** Failed executions */
    failedExecutions: z.number().int().nonnegative(),
    /** Average response time (ms) */
    avgResponseTimeMs: z.number().nonnegative().optional(),
  }),
  /** Recent signals (last N) */
  recentSignals: z.array(TrustSignalSchema).optional(),
  /** Trust score history */
  scoreHistory: z.array(z.object({
    timestamp: TimestampSchema,
    score: z.number().min(0).max(1000),
  })).optional(),
  /** Profile created */
  createdAt: TimestampSchema,
  /** Last updated */
  updatedAt: TimestampSchema,
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type TrustSignalType = z.infer<typeof TrustSignalTypeSchema>;
export type TrustImpactDirection = z.infer<typeof TrustImpactDirectionSchema>;
export type TrustScoreDelta = z.infer<typeof TrustScoreDeltaSchema>;
export type ViolationRecord = z.infer<typeof ViolationRecordSchema>;
export type EscalationRecord = z.infer<typeof EscalationRecordSchema>;
export type AutonomyChange = z.infer<typeof AutonomyChangeSchema>;
export type TrustSignal = z.infer<typeof TrustSignalSchema>;
export type TrustProfile = z.infer<typeof TrustProfileSchema>;
