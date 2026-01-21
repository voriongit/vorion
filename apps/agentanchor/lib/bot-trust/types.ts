/**
 * Bot Trust System - TypeScript Type Definitions
 *
 * CANONICAL ALIGNMENT NOTE:
 * This module aligns with @vorion/contracts canonical types:
 * - TrustScore: 0-100 scale (not 300-1000)
 * - RiskLevel: 'low' | 'medium' | 'high' | 'critical' string union
 * - AutonomyLevel: Maps to TrustBand T0-T5
 */

export enum DecisionType {
  ASK = 'ask',
  SUGGEST = 'suggest',
  EXECUTE = 'execute',
  ESCALATE = 'escalate',
}

/**
 * Canonical RiskLevel enum aligned with @vorion/contracts
 */
export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Canonical RiskLevel as string union type for type narrowing
 */
export type RiskLevelString = 'low' | 'medium' | 'high' | 'critical';

export enum UserResponse {
  APPROVED = 'approved',
  REJECTED = 'rejected',
  MODIFIED = 'modified',
}

/**
 * AutonomyLevel enum - maps to canonical TrustBand T0-T5
 *
 * Mapping:
 * - LEVEL_1 (ASK_LEARN) -> T0_UNTRUSTED, T1_SUPERVISED
 * - LEVEL_2 (SUGGEST) -> T1_SUPERVISED, T2_CONSTRAINED
 * - LEVEL_3 (EXECUTE_REVIEW) -> T2_CONSTRAINED, T3_TRUSTED
 * - LEVEL_4 (AUTONOMOUS_EXCEPTIONS) -> T4_AUTONOMOUS
 * - LEVEL_5 (FULLY_AUTONOMOUS) -> T5_MISSION_CRITICAL
 */
export enum AutonomyLevel {
  LEVEL_1_ASK_LEARN = 1,
  LEVEL_2_SUGGEST = 2,
  LEVEL_3_EXECUTE_REVIEW = 3,
  LEVEL_4_AUTONOMOUS_EXCEPTIONS = 4,
  LEVEL_5_FULLY_AUTONOMOUS = 5,
}

/**
 * Canonical TrustBand for reference (aligned with @vorion/contracts)
 */
export type TrustBand =
  | 'T0_UNTRUSTED'
  | 'T1_SUPERVISED'
  | 'T2_CONSTRAINED'
  | 'T3_TRUSTED'
  | 'T4_AUTONOMOUS'
  | 'T5_MISSION_CRITICAL';

/**
 * Maps AutonomyLevel to canonical TrustBand
 */
export const AUTONOMY_TO_TRUST_BAND: Record<AutonomyLevel, TrustBand> = {
  [AutonomyLevel.LEVEL_1_ASK_LEARN]: 'T0_UNTRUSTED',
  [AutonomyLevel.LEVEL_2_SUGGEST]: 'T1_SUPERVISED',
  [AutonomyLevel.LEVEL_3_EXECUTE_REVIEW]: 'T2_CONSTRAINED',
  [AutonomyLevel.LEVEL_4_AUTONOMOUS_EXCEPTIONS]: 'T4_AUTONOMOUS',
  [AutonomyLevel.LEVEL_5_FULLY_AUTONOMOUS]: 'T5_MISSION_CRITICAL',
};

/**
 * Maps canonical TrustBand to AutonomyLevel
 */
export const TRUST_BAND_TO_AUTONOMY: Record<TrustBand, AutonomyLevel> = {
  T0_UNTRUSTED: AutonomyLevel.LEVEL_1_ASK_LEARN,
  T1_SUPERVISED: AutonomyLevel.LEVEL_2_SUGGEST,
  T2_CONSTRAINED: AutonomyLevel.LEVEL_3_EXECUTE_REVIEW,
  T3_TRUSTED: AutonomyLevel.LEVEL_3_EXECUTE_REVIEW,
  T4_AUTONOMOUS: AutonomyLevel.LEVEL_4_AUTONOMOUS_EXCEPTIONS,
  T5_MISSION_CRITICAL: AutonomyLevel.LEVEL_5_FULLY_AUTONOMOUS,
};

export interface BotDecision {
  id: string;
  bot_id: string;
  decision_type: DecisionType;
  action_taken: string;
  context_data?: Record<string, any>;
  reasoning?: string;
  alternatives_considered?: Array<{
    alternative: string;
    rejected_reason: string;
  }>;
  confidence_score: number;
  risk_level: RiskLevel;
  user_response?: UserResponse;
  modification_details?: string;
  outcome?: string;
  created_at: Date;
}

export interface ApprovalRate {
  overall: number;
  by_task_type: Record<string, number>;
  by_risk_level: Record<RiskLevel, number>;
  trend: {
    last_7_days: number;
    last_30_days: number;
    last_90_days: number;
  };
}

/**
 * TrustScore aligned with @vorion/contracts
 *
 * CANONICAL RANGE: 0-100 (not 300-1000)
 * - Score represents composite trust from multiple dimensions
 * - Components map to TrustDimensions in @vorion/contracts
 */
export interface TrustScore {
  /**
   * Composite trust score
   * @range 0-100 (canonical scale)
   * @deprecated 300-1000 range - use 0-100 scale
   */
  score: number;
  /**
   * Trust dimension components (each 0-100)
   * Maps to canonical TrustDimensions:
   * - decision_accuracy -> CT (Capability Trust)
   * - ethics_compliance -> GT (Governance Trust)
   * - training_success -> BT (Behavioral Trust)
   * - operational_stability -> XT (Contextual Trust)
   * - peer_reviews -> AC (Assurance Confidence)
   */
  components: {
    decision_accuracy: number;   // 0-100 -> CT
    ethics_compliance: number;   // 0-100 -> GT
    training_success: number;    // 0-100 -> BT
    operational_stability: number; // 0-100 -> XT
    peer_reviews: number;        // 0-100 -> AC
  };
  calculated_at: Date;
}

/**
 * Convert legacy 300-1000 score to canonical 0-100 scale
 */
export function convertLegacyTrustScore(legacyScore: number): number {
  // Legacy range was 300-1000 (700 point range)
  // Canonical range is 0-100
  const normalized = Math.max(0, Math.min(1000, legacyScore));
  if (normalized < 300) return 0;
  return Math.round(((normalized - 300) / 700) * 100);
}

/**
 * Convert canonical 0-100 score to legacy 300-1000 scale
 */
export function convertToLegacyTrustScore(canonicalScore: number): number {
  const normalized = Math.max(0, Math.min(100, canonicalScore));
  return Math.round(300 + (normalized / 100) * 700);
}

export interface AutonomyLevelRequirements {
  level: AutonomyLevel;
  min_decisions: number;
  min_approval_rate: number;
  description: string;
}

export const AUTONOMY_REQUIREMENTS: AutonomyLevelRequirements[] = [
  {
    level: AutonomyLevel.LEVEL_1_ASK_LEARN,
    min_decisions: 0,
    min_approval_rate: 0,
    description: 'Learning mode - asks before every action',
  },
  {
    level: AutonomyLevel.LEVEL_2_SUGGEST,
    min_decisions: 50,
    min_approval_rate: 0.75,
    description: 'Suggests actions with confidence scores',
  },
  {
    level: AutonomyLevel.LEVEL_3_EXECUTE_REVIEW,
    min_decisions: 100,
    min_approval_rate: 0.80,
    description: 'Executes low-risk actions, requires review for others',
  },
  {
    level: AutonomyLevel.LEVEL_4_AUTONOMOUS_EXCEPTIONS,
    min_decisions: 200,
    min_approval_rate: 0.85,
    description: 'Fully autonomous except for high-risk decisions',
  },
  {
    level: AutonomyLevel.LEVEL_5_FULLY_AUTONOMOUS,
    min_decisions: 500,
    min_approval_rate: 0.90,
    description: 'Fully autonomous, can train other bots',
  },
];

export interface TelemetryMetric {
  bot_id: string;
  metric_name: string;
  metric_value: number;
  metric_unit: string;
  tags?: Record<string, string>;
  timestamp: Date;
}

export interface Anomaly {
  id: string;
  bot_id: string;
  anomaly_type: string;
  severity: 'info' | 'warning' | 'critical';
  description: string;
  detected_at: Date;
  resolved_at?: Date;
}

export interface LearnedPattern {
  id: string;
  bot_id: string;
  pattern_type: string;
  pattern_data: Record<string, any>;
  confidence: number;
  learned_at: Date;
  last_validated: Date;
}
