/**
 * Bot Trust System - TypeScript Type Definitions
 */

export enum DecisionType {
  ASK = 'ask',
  SUGGEST = 'suggest',
  EXECUTE = 'execute',
  ESCALATE = 'escalate',
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum UserResponse {
  APPROVED = 'approved',
  REJECTED = 'rejected',
  MODIFIED = 'modified',
}

export enum AutonomyLevel {
  LEVEL_1_ASK_LEARN = 1,
  LEVEL_2_SUGGEST = 2,
  LEVEL_3_EXECUTE_REVIEW = 3,
  LEVEL_4_AUTONOMOUS_EXCEPTIONS = 4,
  LEVEL_5_FULLY_AUTONOMOUS = 5,
}

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

export interface TrustScore {
  score: number; // 300-1000
  components: {
    decision_accuracy: number; // 0-100
    ethics_compliance: number; // 0-100
    training_success: number; // 0-100
    operational_stability: number; // 0-100
    peer_reviews: number; // 0-100
  };
  calculated_at: Date;
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
