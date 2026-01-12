/**
 * Pre-Action Verification Gate Types - ATSF v2.0 Section 4.4
 *
 * Per ATSF v2.0: "Trust score gates CAPABILITY, not just post-hoc scoring"
 *
 * Key insight: At the moment of a "Treacherous Turn," an agent's trust
 * is maximal because trust is updated AFTER action. Pre-action gating
 * prevents high-risk actions by low-trust agents BEFORE execution.
 *
 * Trust must be earned through demonstrated success on low-risk actions first.
 */

import type { ActionType, DataSensitivity, Reversibility } from './enums.js';

/**
 * Risk levels for action classification
 * Per ATSF v2.0 Section 4.4
 */
export enum RiskLevel {
  /** Read-only operations - anyone can do */
  READ = 'READ',
  /** Low-risk modifications */
  LOW = 'LOW',
  /** Medium-risk operations */
  MEDIUM = 'MEDIUM',
  /** High-risk operations - requires verification */
  HIGH = 'HIGH',
  /** Critical operations - requires human approval */
  CRITICAL = 'CRITICAL',
}

/**
 * Trust thresholds per risk level
 * Per ATSF v2.0 Section 4.4
 */
export const TRUST_THRESHOLDS: Record<RiskLevel, number> = {
  [RiskLevel.READ]: 0.0,      // Anyone can read
  [RiskLevel.LOW]: 20,        // Minimal trust required (0.2 * 100)
  [RiskLevel.MEDIUM]: 40,     // Moderate trust required (0.4 * 100)
  [RiskLevel.HIGH]: 60,       // Significant trust required (0.6 * 100)
  [RiskLevel.CRITICAL]: 80,   // Maximum trust + human approval (0.8 * 100)
};

/**
 * Gate decision status
 */
export enum GateStatus {
  /** Action approved - proceed with execution */
  APPROVED = 'APPROVED',
  /** Action rejected - trust below threshold */
  REJECTED = 'REJECTED',
  /** Action pending - requires additional verification */
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  /** Action pending - requires human approval */
  PENDING_HUMAN_APPROVAL = 'PENDING_HUMAN_APPROVAL',
}

/**
 * Request to verify an action before execution
 */
export interface GateVerificationRequest {
  /** Agent requesting the action */
  agentId: string;
  /** Description of the action */
  action: string;
  /** Type of action */
  actionType: ActionType;
  /** Resources being accessed/modified */
  resourceScope: string[];
  /** Data sensitivity level */
  dataSensitivity: DataSensitivity;
  /** Whether the action is reversible */
  reversibility: Reversibility;
  /** Estimated magnitude/impact (for risk calculation) */
  magnitude?: number;
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Result of pre-action gate verification
 */
export interface GateVerificationResult {
  /** Status of the verification */
  status: GateStatus;
  /** Calculated risk level */
  riskLevel: RiskLevel;
  /** Required trust threshold */
  requiredTrust: number;
  /** Agent's current trust score */
  currentTrust: number;
  /** Trust deficit (how much more trust needed) */
  trustDeficit: number;
  /** Whether action passed the gate */
  passed: boolean;
  /** Human-readable reasoning */
  reasoning: string[];
  /** If pending, what's needed to proceed */
  requirements?: GateRequirement[];
  /** When the verification was performed */
  verifiedAt: Date;
  /** Verification expires at (must re-verify after) */
  expiresAt: Date;
  /** Unique verification ID for tracking */
  verificationId: string;
}

/**
 * Requirement to proceed when pending
 */
export interface GateRequirement {
  /** Type of requirement */
  type: 'MULTI_PROVER_VERIFICATION' | 'HUMAN_APPROVAL' | 'ADDITIONAL_TRUST';
  /** Description of what's needed */
  description: string;
  /** Who needs to fulfill this */
  fulfiller?: string;
  /** Timeout for this requirement */
  timeoutMs?: number;
}

/**
 * Configuration for the pre-action gate
 */
export interface PreActionGateConfig {
  /** Custom trust thresholds (override defaults) */
  trustThresholds?: Partial<Record<RiskLevel, number>>;
  /**
   * Risk level that requires multi-prover verification
   * Default: HIGH
   */
  verificationThreshold: RiskLevel;
  /**
   * Risk level that requires human approval
   * Default: CRITICAL
   */
  humanApprovalThreshold: RiskLevel;
  /**
   * Verification validity period (ms)
   * Default: 5 minutes
   */
  verificationValidityMs: number;
  /**
   * Whether to allow pending states or just approve/reject
   * Default: true
   */
  allowPendingStates: boolean;
  /**
   * Risk multipliers for specific action types
   */
  actionTypeRiskMultipliers?: Partial<Record<ActionType, number>>;
  /**
   * Risk multipliers for data sensitivity
   */
  dataSensitivityRiskMultipliers?: Partial<Record<DataSensitivity, number>>;
}

/**
 * Default pre-action gate configuration per ATSF v2.0
 */
export const DEFAULT_GATE_CONFIG: PreActionGateConfig = {
  trustThresholds: TRUST_THRESHOLDS,
  verificationThreshold: RiskLevel.HIGH,
  humanApprovalThreshold: RiskLevel.CRITICAL,
  verificationValidityMs: 5 * 60 * 1000, // 5 minutes
  allowPendingStates: true,
};

/**
 * Action risk factors for classification
 */
export interface ActionRiskFactors {
  /** Base action type risk */
  actionTypeRisk: number;
  /** Data sensitivity risk */
  dataSensitivityRisk: number;
  /** Reversibility risk (irreversible = higher) */
  reversibilityRisk: number;
  /** Magnitude/impact risk */
  magnitudeRisk: number;
  /** Combined risk score (0-100) */
  combinedScore: number;
  /** Resulting risk level */
  riskLevel: RiskLevel;
}

/**
 * Gate event for audit trail
 */
export interface GateEvent {
  /** Event type */
  type: 'GATE_CHECK' | 'GATE_APPROVED' | 'GATE_REJECTED' | 'GATE_PENDING';
  /** Agent involved */
  agentId: string;
  /** Action that was checked */
  action: string;
  /** Risk level determined */
  riskLevel: RiskLevel;
  /** Trust score at time of check */
  trustScore: number;
  /** Whether the check passed */
  passed: boolean;
  /** Timestamp */
  timestamp: Date;
  /** Verification ID */
  verificationId: string;
}
