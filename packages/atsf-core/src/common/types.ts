/**
 * Common types used throughout Vorion
 *
 * These types provide backwards compatibility with legacy code.
 * For new code, prefer using canonical types from @vorion/contracts.
 *
 * @see {@link @vorion/contracts} for canonical type definitions
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
 * Legacy trust level representation using numeric values 0-5.
 * Maps to canonical TrustBand enum from @vorion/contracts:
 * - L0/T0: Untrusted (0-20)
 * - L1/T1: Supervised (21-40)
 * - L2/T2: Constrained (41-55)
 * - L3/T3: Trusted (56-70)
 * - L4/T4: Autonomous (71-85)
 * - L5/T5: Mission Critical (86-100)
 *
 * @see {@link @vorion/contracts!TrustBand} for canonical enum
 */
export type TrustLevel = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * Trust score (0-1000)
 */
export type TrustScore = number;

/**
 * Entity types that can be governed
 */
export type EntityType = 'agent' | 'user' | 'service' | 'system';

/**
 * Intent status
 *
 * Represents the lifecycle states of an intent through the governance pipeline.
 *
 * @see {@link @vorion/contracts!Intent} for canonical intent definition
 */
export type IntentStatus =
  | 'pending'
  | 'evaluating'
  | 'approved'
  | 'denied'
  | 'escalated'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'cancelled';

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
  entityId: ID;
  goal: string;
  context: Record<string, unknown>;
  metadata: Record<string, unknown>;
  status: IntentStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
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
 * Evaluation result from BASIS
 */
export interface EvaluationResult {
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
  constraintsEvaluated: EvaluationResult[];
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
 *
 * Represents evidence that affects trust score calculation.
 * Maps to canonical TrustEvidence from @vorion/contracts.
 *
 * @see {@link @vorion/contracts!TrustEvidence} for canonical evidence type
 */
export interface TrustSignal {
  id: ID;
  entityId: ID;
  type: string;
  value: number;
  /** Source of the signal (optional for backwards compatibility) */
  source?: string;
  timestamp: Timestamp;
  /** Additional metadata (optional for backwards compatibility) */
  metadata?: Record<string, unknown>;
}

/**
 * Trust score breakdown (Legacy 4-dimension model)
 *
 * @deprecated Prefer using canonical 5-dimension TrustDimensions from @vorion/contracts
 * which includes: CT (Capability), BT (Behavioral), GT (Governance), XT (Contextual), AC (Assurance)
 *
 * @see {@link @vorion/contracts!TrustDimensions} for canonical 5-dimension model
 */
export interface TrustComponents {
  behavioral: number;
  compliance: number;
  identity: number;
  context: number;
}

/**
 * Risk level for operations
 *
 * Maps to canonical RiskProfile from @vorion/contracts.
 *
 * @see {@link @vorion/contracts!RiskProfile} for canonical risk levels
 */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

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
