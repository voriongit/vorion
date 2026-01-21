/**
 * Common types used throughout Vorion
 *
 * @packageDocumentation
 */

/**
 * Unique identifier type
 */
export type ID = string;

/**
 * Timestamp in ISO 8601 format
 */
export type Timestamp = string;

/**
 * Trust level (L0-L5)
 *
 * Updated to 6 levels per canonical ATSF-Core TrustBand definition:
 * - 0 (T0_UNTRUSTED): No autonomous operations
 * - 1 (T1_SUPERVISED): Human-supervised only
 * - 2 (T2_CONSTRAINED): Limited autonomy with constraints
 * - 3 (T3_TRUSTED): Standard trusted operations
 * - 4 (T4_AUTONOMOUS): High autonomy
 * - 5 (T5_MISSION_CRITICAL): Full autonomy for critical operations
 *
 * @deprecated Prefer importing TrustBand from @vorion/contracts for new code.
 *             This type is maintained for backwards compatibility.
 */
export type TrustLevel = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * Trust score (0-1000)
 *
 * Canonical trust scores use 0-1000 scale for precision:
 * - 0-200: T0_UNTRUSTED
 * - 201-400: T1_SUPERVISED
 * - 401-550: T2_CONSTRAINED
 * - 551-700: T3_TRUSTED
 * - 701-850: T4_AUTONOMOUS
 * - 851-1000: T5_MISSION_CRITICAL
 *
 * All trust dimensions and composite scores use this unified 0-1000 scale.
 */
export type TrustScore = number;

/**
 * Entity types that can be governed
 */
export type EntityType = 'agent' | 'user' | 'service' | 'system';

/**
 * Allowed intent statuses.
 */
export const INTENT_STATUSES = [
  'pending',
  'evaluating',
  'approved',
  'denied',
  'escalated',
  'executing',
  'completed',
  'failed',
  'cancelled',
] as const;

/**
 * Intent status
 */
export type IntentStatus = (typeof INTENT_STATUSES)[number];

/**
 * Control action types for enforcement decisions.
 *
 * @deprecated For governance/authorization actions, use `ControlAction` from
 *             `@vorion/contracts/canonical/governance`. This type is maintained
 *             for backwards compatibility with existing enforcement logic.
 *             Note: The canonical type has different values:
 *             ['allow', 'deny', 'constrain', 'clarify', 'escalate', 'log', 'audit']
 */
export type ControlAction =
  | 'allow'
  | 'deny'
  | 'escalate'
  | 'limit'
  | 'monitor'
  | 'terminate';

/**
 * Entity identity
 *
 * @deprecated Prefer using Component from @vorion/contracts for agent registry.
 *             This interface is maintained for backwards compatibility.
 */
export interface Entity {
  id: ID;
  type: EntityType;
  name: string;
  /** Trust score (0-1000 scale) */
  trustScore: TrustScore;
  /** Trust level (0-5, maps to TrustBand T0-T5) */
  trustLevel: TrustLevel;
  metadata: Record<string, unknown>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Intent representing a goal to be governed
 *
 * Note: This is the legacy internal Intent type. For canonical intent structure,
 * see packages/contracts/src/v2/intent.ts which uses:
 * - intentId (instead of id)
 * - agentId (instead of entityId)
 * - action (instead of goal)
 *
 * @deprecated Prefer using Intent from @vorion/contracts for new integrations.
 *             This interface is maintained for internal backwards compatibility.
 */
export interface Intent {
  /** Unique intent identifier */
  id: ID;
  /** Tenant this intent belongs to */
  tenantId: ID;
  /** Entity (agent) making the request - maps to canonical agentId */
  entityId: ID;
  /** Goal/action to be performed - maps to canonical action */
  goal: string;
  /** Optional intent type categorization */
  intentType?: string | null;
  /** Additional context for evaluation */
  context: Record<string, unknown>;
  /** Additional metadata */
  metadata: Record<string, unknown>;
  /** Priority level (0-10) */
  priority?: number;
  /** Trust state snapshot at intent creation */
  trustSnapshot?: Record<string, unknown> | null;
  /** Trust level at evaluation (0-5) */
  trustLevel?: TrustLevel | null;
  /** Trust score at evaluation (0-1000) */
  trustScore?: TrustScore | null;
  /** Current status */
  status: IntentStatus;
  /** Creation timestamp */
  createdAt: Timestamp;
  /** Last update timestamp */
  updatedAt: Timestamp;
  /** Soft delete timestamp for GDPR compliance */
  deletedAt?: Timestamp | null;
  /** Reason for cancellation if status is 'cancelled' */
  cancellationReason?: string | null;
}

/**
 * Evaluation stages in the intent lifecycle
 */
export type EvaluationStage =
  | 'trust-snapshot'
  | 'trust-gate'
  | 'basis'
  | 'decision'
  | 'error'
  | 'cancelled';

/**
 * Strongly typed evaluation result by stage
 * Note: basis.evaluation and decision.decision use unknown to accept
 * external types (EvaluationResult from BASIS, Decision from ENFORCE)
 */
export type EvaluationPayload =
  | { stage: 'trust-snapshot'; result: Record<string, unknown> | null }
  | { stage: 'trust-gate'; passed: boolean; requiredLevel: number; actualLevel: number }
  | { stage: 'basis'; evaluation: unknown; namespace: string }
  | { stage: 'decision'; decision: unknown }
  | { stage: 'error'; error: { message: string; timestamp: string } }
  | { stage: 'cancelled'; reason: string; cancelledBy?: string };

export interface IntentEvaluationRecord {
  id: ID;
  intentId: ID;
  tenantId: ID;
  /** Strongly typed result payload */
  result: EvaluationPayload;
  createdAt: Timestamp;
}

/**
 * Constraint definition
 */
export interface Constraint {
  id: ID;
  namespace: string;
  name: string;
  description: string;
  version: string;
  rule: ConstraintRule;
  enabled: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Constraint rule definition
 */
export interface ConstraintRule {
  when: ConstraintCondition;
  evaluate: ConstraintEvaluation[];
}

/**
 * Constraint condition
 */
export interface ConstraintCondition {
  intentType?: string;
  entityType?: EntityType;
  conditions?: Record<string, unknown>;
}

/**
 * Constraint evaluation step
 */
export interface ConstraintEvaluation {
  condition: string;
  result: ControlAction;
  reason?: string;
}

/**
 * Result of evaluating a single constraint/rule
 */
export interface ConstraintEvaluationResult {
  constraintId: ID;
  passed: boolean;
  action: ControlAction;
  reason: string;
  details: Record<string, unknown>;
  durationMs: number;
  evaluatedAt: Timestamp;
}

/**
 * Decision from ENFORCE
 *
 * Note: The canonical Decision type in @vorion/contracts uses:
 * - decisionId, intentId, agentId, correlationId
 * - permitted: boolean (instead of action)
 * - constraints: DecisionConstraints
 * - trustBand: TrustBand (instead of trustLevel)
 *
 * @deprecated Prefer using Decision from @vorion/contracts for new integrations.
 *             This interface is maintained for backwards compatibility.
 */
export interface Decision {
  intentId: ID;
  action: ControlAction;
  constraintsEvaluated: ConstraintEvaluationResult[];
  /** Trust score (0-1000 scale) */
  trustScore: TrustScore;
  /** Trust level (0-5, maps to canonical TrustBand) */
  trustLevel: TrustLevel;
  escalation?: EscalationRequest;
  decidedAt: Timestamp;
}

/**
 * Escalation request
 */
export interface EscalationRequest {
  id: ID;
  intentId: ID;
  reason: string;
  escalatedTo: string;
  timeout: string;
  status: 'pending' | 'approved' | 'rejected' | 'timeout';
  createdAt: Timestamp;
}

/**
 * Proof record for audit trail
 */
export interface Proof {
  id: ID;
  chainPosition: number;
  intentId: ID;
  entityId: ID;
  decision: Decision;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  hash: string;
  previousHash: string;
  signature: string;
  createdAt: Timestamp;
}

/**
 * Trust signal for scoring
 *
 * @deprecated Prefer using TrustEvidence from @vorion/contracts for new code.
 *             This interface is maintained for backwards compatibility.
 */
export interface TrustSignal {
  /** Unique signal identifier */
  id: ID;
  /** Entity this signal is for */
  entityId: ID;
  /** Type/category of signal */
  type: string;
  /** Signal value (impact on trust) */
  value: number;
  /** Weight multiplier for this signal (default: 1.0) */
  weight: number;
  /** Source system that generated this signal */
  source: string;
  /** When this signal was recorded */
  timestamp: Timestamp;
  /** Additional context */
  metadata?: Record<string, unknown>;
}

/**
 * Trust score breakdown
 */
export interface TrustComponents {
  behavioral: number;
  compliance: number;
  identity: number;
  context: number;
}

/**
 * Error types
 */
export class VorionError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'VorionError';
  }
}

export class ConstraintViolationError extends VorionError {
  constructor(
    public constraintId: ID,
    public constraintName: string,
    message: string,
    public suggestion?: string
  ) {
    super(message, 'CONSTRAINT_VIOLATION', { constraintId, constraintName });
    this.name = 'ConstraintViolationError';
  }
}

export class TrustInsufficientError extends VorionError {
  constructor(
    public required: TrustLevel,
    public actual: TrustLevel
  ) {
    super(
      `Trust level ${actual} insufficient, requires ${required}`,
      'TRUST_INSUFFICIENT',
      { required, actual }
    );
    this.name = 'TrustInsufficientError';
  }
}
