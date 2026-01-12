/**
 * Trust System - Score calculation, decay, and tier management
 */

import {
  TrustTier,
  TrustContext,
  RiskLevel,
  RiskAssessment,
  GovernanceDecision,
  TRUST_TIER_THRESHOLDS,
  RISK_AUTONOMY_REQUIREMENTS,
} from './types';

// =============================================================================
// Constants
// =============================================================================

const GRACE_PERIOD_DAYS = 90;
const DECAY_FLOOR_PERCENT = 50;
const FULL_DECAY_PERIOD_DAYS = 365;
const ACCELERATION_1_DAYS = 180; // 6 months - 1.5x decay
const ACCELERATION_2_DAYS = 270; // 9 months - 2x decay

// =============================================================================
// Trust Tier Calculation
// =============================================================================

export function getTrustTier(score: number): TrustTier {
  if (score >= 900) return 'certified';
  if (score >= 800) return 'verified';
  if (score >= 600) return 'trusted';
  if (score >= 400) return 'established';
  if (score >= 200) return 'provisional';
  return 'untrusted';
}

export function getTrustTierInfo(tier: TrustTier): { min: number; max: number; label: string; color: string } {
  const thresholds = TRUST_TIER_THRESHOLDS[tier];
  const labels: Record<TrustTier, { label: string; color: string }> = {
    untrusted: { label: 'Untrusted', color: 'red' },
    provisional: { label: 'Provisional', color: 'orange' },
    established: { label: 'Established', color: 'yellow' },
    trusted: { label: 'Trusted', color: 'blue' },
    verified: { label: 'Verified', color: 'indigo' },
    certified: { label: 'Certified', color: 'green' },
  };
  return { ...thresholds, ...labels[tier] };
}

// =============================================================================
// Decay Calculation
// =============================================================================

export function calculateDecay(rawScore: number, lastActivity: Date): {
  effectiveScore: number;
  decayPercent: number;
  daysInactive: number;
  inGracePeriod: boolean;
} {
  const now = new Date();
  const daysInactive = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));

  // Within grace period - no decay
  if (daysInactive <= GRACE_PERIOD_DAYS) {
    return {
      effectiveScore: rawScore,
      decayPercent: 0,
      daysInactive,
      inGracePeriod: true,
    };
  }

  // Calculate decay time (days past grace period)
  const decayDays = daysInactive - GRACE_PERIOD_DAYS;

  // Calculate base decay percent
  let decayPercent = Math.min((decayDays / FULL_DECAY_PERIOD_DAYS) * 100, 100);

  // Apply acceleration multipliers
  if (decayDays >= ACCELERATION_2_DAYS - GRACE_PERIOD_DAYS) {
    decayPercent = Math.min(decayPercent * 2, 100); // 2x after 9 months
  } else if (decayDays >= ACCELERATION_1_DAYS - GRACE_PERIOD_DAYS) {
    decayPercent = Math.min(decayPercent * 1.5, 100); // 1.5x after 6 months
  }

  // Calculate floor (minimum score retained)
  const floor = (rawScore * DECAY_FLOOR_PERCENT) / 100;
  const decayable = rawScore - floor;
  const decayed = (decayable * decayPercent) / 100;

  const effectiveScore = Math.max(Math.round(rawScore - decayed), floor);

  return {
    effectiveScore,
    decayPercent: Math.round(decayPercent),
    daysInactive,
    inGracePeriod: false,
  };
}

// =============================================================================
// Trust Context Builder
// =============================================================================

export function buildTrustContext(score: number, lastActivity: Date): TrustContext {
  const decay = calculateDecay(score, lastActivity);

  return {
    score,
    tier: getTrustTier(decay.effectiveScore),
    lastActivity,
    decayApplied: !decay.inGracePeriod,
    effectiveScore: decay.effectiveScore,
  };
}

// =============================================================================
// Risk Assessment
// =============================================================================

export function assessRisk(
  actionType: string,
  context: Record<string, unknown> = {}
): RiskAssessment {
  // Define risk levels for different action types
  const riskMap: Record<string, RiskLevel> = {
    // Low risk
    'read': 'low',
    'search': 'low',
    'summarize': 'low',
    'translate': 'low',
    'answer_question': 'low',

    // Medium risk
    'generate_content': 'medium',
    'analyze_data': 'medium',
    'code_assist': 'medium',
    'create_document': 'medium',

    // High risk
    'execute_code': 'high',
    'modify_file': 'high',
    'api_call': 'high',
    'send_message': 'high',
    'database_write': 'high',

    // Critical risk
    'delete_data': 'critical',
    'financial_transaction': 'critical',
    'system_config': 'critical',
    'user_data_access': 'critical',
    'external_api_write': 'critical',
  };

  const level = riskMap[actionType] || 'medium';
  const factors: string[] = [];

  // Add contextual risk factors
  if (context.externalApi) factors.push('External API access');
  if (context.userData) factors.push('User data involved');
  if (context.financial) factors.push('Financial impact');
  if (context.irreversible) factors.push('Irreversible action');
  if (context.publicFacing) factors.push('Public-facing output');

  // Escalation determination
  let escalateTo: 'council' | 'human' | null = null;
  let requiresApproval = false;

  if (level === 'critical') {
    escalateTo = 'human';
    requiresApproval = true;
  } else if (level === 'high') {
    escalateTo = 'council';
    requiresApproval = true;
  }

  return {
    level,
    factors,
    requiresApproval,
    escalateTo,
  };
}

// =============================================================================
// Governance Decision
// =============================================================================

export function evaluateAction(
  trust: TrustContext,
  risk: RiskAssessment,
  actionType: string
): GovernanceDecision {
  const requiredScore = RISK_AUTONOMY_REQUIREMENTS[risk.level];

  // Check if trust score meets requirement
  if (trust.effectiveScore < requiredScore) {
    return {
      allowed: false,
      requiresApproval: true,
      escalateTo: risk.escalateTo || 'council',
      reason: `Trust score ${trust.effectiveScore} below required ${requiredScore} for ${risk.level} risk action`,
      trustImpact: 0,
      auditRequired: true,
    };
  }

  // Critical actions always need human approval regardless of trust
  if (risk.level === 'critical') {
    return {
      allowed: false,
      requiresApproval: true,
      escalateTo: 'human',
      reason: 'Critical risk actions require human approval',
      trustImpact: 0,
      auditRequired: true,
    };
  }

  // High risk with high trust - allow with audit
  if (risk.level === 'high' && trust.tier === 'certified') {
    return {
      allowed: true,
      requiresApproval: false,
      escalateTo: null,
      reason: 'Certified agent has autonomy for high-risk actions',
      trustImpact: 5, // Successful high-risk actions boost trust
      auditRequired: true,
    };
  }

  // Standard approval flow for high risk
  if (risk.level === 'high') {
    return {
      allowed: false,
      requiresApproval: true,
      escalateTo: 'council',
      reason: 'High risk action requires council approval',
      trustImpact: 0,
      auditRequired: true,
    };
  }

  // Medium/low risk within trust bounds
  return {
    allowed: true,
    requiresApproval: false,
    escalateTo: null,
    reason: 'Action within autonomy bounds',
    trustImpact: risk.level === 'medium' ? 2 : 1,
    auditRequired: risk.level === 'medium',
  };
}

// =============================================================================
// Trust Score Updates
// =============================================================================

export interface TrustUpdate {
  previousScore: number;
  newScore: number;
  change: number;
  reason: string;
  source: 'action_success' | 'action_failure' | 'council_decision' | 'user_feedback' | 'decay' | 'manual';
}

export function applyTrustChange(
  currentScore: number,
  change: number,
  reason: string,
  source: TrustUpdate['source']
): TrustUpdate {
  const newScore = Math.max(0, Math.min(1000, currentScore + change));

  return {
    previousScore: currentScore,
    newScore,
    change: newScore - currentScore,
    reason,
    source,
  };
}

// Standard trust impacts
export const TRUST_IMPACTS = {
  // Positive
  action_success_low: 1,
  action_success_medium: 2,
  action_success_high: 5,
  council_approval: 10,
  user_positive_feedback: 15,
  training_completed: 20,
  examination_passed: 50,

  // Negative
  action_failure: -5,
  council_rejection: -20,
  user_negative_feedback: -15,
  policy_violation: -50,
  suspension: -100,
};
