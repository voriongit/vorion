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
 * Trust level (L0-L4)
 */
export type TrustLevel = 0 | 1 | 2 | 3 | 4;

/**
 * Trust score (0-1000)
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
 * Control action types
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
 */
export interface Entity {
  id: ID;
  type: EntityType;
  name: string;
  trustScore: TrustScore;
  trustLevel: TrustLevel;
  metadata: Record<string, unknown>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Intent representing a goal to be governed
 */
export interface Intent {
  id: ID;
  tenantId: ID;
  entityId: ID;
  goal: string;
  intentType?: string | null;
  context: Record<string, unknown>;
  metadata: Record<string, unknown>;
  priority?: number;
  trustSnapshot?: Record<string, unknown> | null;
  trustLevel?: TrustLevel | null;
  trustScore?: TrustScore | null;
  status: IntentStatus;
  createdAt: Timestamp;
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
 */
export interface Decision {
  intentId: ID;
  action: ControlAction;
  constraintsEvaluated: ConstraintEvaluationResult[];
  trustScore: TrustScore;
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
 */
export interface TrustSignal {
  id: ID;
  entityId: ID;
  type: string;
  value: number;
  weight?: number;
  source?: string;
  timestamp: Timestamp;
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
