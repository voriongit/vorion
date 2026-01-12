/**
 * HITL (Human-in-the-Loop) Types
 *
 * Story 16-5: Proof Accumulation Tracker
 * Story 16-6: HITL Fade Logic
 *
 * Council Priority #2 (42 points)
 */

// =============================================================================
// Proof Accumulation
// =============================================================================

export interface ProofRecord {
  id: string;
  agentId: string;
  actionType: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  agentDecision: string;
  humanDecision?: string;
  agreed: boolean;
  reviewedBy?: string;
  reviewedAt?: Date;
  createdAt: Date;
}

export interface ProofAccumulation {
  agentId: string;
  actionType: string;
  totalReviews: number;
  agreedCount: number;
  disagreedCount: number;
  agreementRate: number; // 0-100
  currentPhase: HITLPhase;
  lastUpdated: Date;
}

// =============================================================================
// HITL Phases
// =============================================================================

export type HITLPhase =
  | 'full_review'       // 0-50% agreement: All actions require human approval
  | 'spot_check'        // 50-80% agreement: Random sampling of actions
  | 'exception_only'    // 80-95% agreement: Only review flagged/unusual actions
  | 'autonomous';       // 95%+ agreement: Fully autonomous (async logging only)

export const HITL_PHASE_THRESHOLDS: Record<HITLPhase, { min: number; max: number }> = {
  full_review: { min: 0, max: 50 },
  spot_check: { min: 50, max: 80 },
  exception_only: { min: 80, max: 95 },
  autonomous: { min: 95, max: 100 },
};

export const HITL_PHASE_CONFIG: Record<HITLPhase, {
  name: string;
  description: string;
  reviewProbability: number; // 0-1, probability of requiring review
  autoApprove: boolean;
}> = {
  full_review: {
    name: 'Full Review',
    description: 'All actions require human approval before execution',
    reviewProbability: 1.0,
    autoApprove: false,
  },
  spot_check: {
    name: 'Spot Check',
    description: 'Random sampling - 30% of actions reviewed',
    reviewProbability: 0.3,
    autoApprove: true,
  },
  exception_only: {
    name: 'Exception Only',
    description: 'Only unusual or flagged actions reviewed',
    reviewProbability: 0.1,
    autoApprove: true,
  },
  autonomous: {
    name: 'Autonomous',
    description: 'Fully autonomous operation with async logging',
    reviewProbability: 0,
    autoApprove: true,
  },
};

// =============================================================================
// Fade Configuration
// =============================================================================

export interface HITLFadeConfig {
  agentId: string;
  actionType: string;
  currentPhase: HITLPhase;
  minimumReviews: number;        // Min reviews before phase transition
  windowDays: number;            // Rolling window for agreement calculation
  requireConsecutiveAgreements: number; // Consecutive agreements for phase up
  disagreementPenalty: number;   // How many agreements lost per disagreement
}

export const DEFAULT_FADE_CONFIG: Omit<HITLFadeConfig, 'agentId' | 'actionType' | 'currentPhase'> = {
  minimumReviews: 20,
  windowDays: 30,
  requireConsecutiveAgreements: 5,
  disagreementPenalty: 3,
};

// =============================================================================
// Review Request
// =============================================================================

export interface HITLReviewRequest {
  id: string;
  agentId: string;
  actionType: string;
  actionData: Record<string, unknown>;
  agentDecision: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'approved' | 'rejected' | 'modified';
  humanDecision?: string;
  humanNotes?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
}

// =============================================================================
// API Types
// =============================================================================

export interface RecordProofRequest {
  agentId: string;
  actionType: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  agentDecision: string;
  humanDecision?: string;
  reviewedBy?: string;
}

export interface GetAccumulationRequest {
  agentId: string;
  actionType?: string;
}

export interface CheckReviewRequiredRequest {
  agentId: string;
  actionType: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface CheckReviewRequiredResult {
  required: boolean;
  phase: HITLPhase;
  reason: string;
  agreementRate?: number;
}
