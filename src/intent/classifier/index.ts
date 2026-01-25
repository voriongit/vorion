/**
 * Intent Classification System
 *
 * Provides rule-based classification for intents in the Vorion AI Governance Platform.
 * Classifies intents by category, risk level, and required approvals.
 *
 * Architecture:
 * - IntentClassifier: Main entry point for classification
 * - RiskAssessor: Calculates risk scores and required approvals
 * - Patterns: Action patterns and resource sensitivity mappings
 */

import {
  trace,
  SpanKind,
  SpanStatusCode,
} from '@opentelemetry/api';
import {
  RiskAssessor,
  type CreateIntent,
  type RiskAssessment,
  type HistoricalPattern,
  type RiskAssessorConfig,
} from './risk.js';
import {
  type IntentCategory,
  type RiskTier,
  matchActionPattern,
  inferCategoryFromAction,
  requiresApproval,
  scoreToTier,
} from './patterns.js';

// Tracer for classification operations
const TRACER_NAME = 'vorion.intent.classifier';
const TRACER_VERSION = '1.0.0';

/**
 * Get the classifier tracer
 */
function getTracer() {
  return trace.getTracer(TRACER_NAME, TRACER_VERSION);
}

/**
 * Approval requirement type
 */
export type ApprovalType = 'none' | 'auto' | 'human' | 'manager' | 'security' | 'multi-party';

/**
 * Classification result containing category, risk, and approval information
 */
export interface Classification {
  /** Intent category */
  category: IntentCategory;
  /** Risk level classification */
  riskLevel: RiskTier;
  /** Risk score (0-100) */
  riskScore: number;
  /** Required approval types */
  requiredApprovals: ApprovalType[];
  /** Minimum trust level required */
  minTrustLevel: number;
  /** Whether auto-approval is possible */
  canAutoApprove: boolean;
  /** Action pattern that was matched (if any) */
  matchedPattern?: string;
  /** Classification confidence (0-1) */
  confidence: number;
  /** Full risk assessment details */
  riskAssessment: RiskAssessment;
  /** Classification timestamp */
  classifiedAt: string;
}

/**
 * Configuration for the IntentClassifier
 */
export interface IntentClassifierConfig {
  /** Risk assessor configuration */
  riskConfig?: Partial<RiskAssessorConfig>;
  /** Trust level threshold for auto-approval (default: 3) */
  autoApprovalTrustThreshold: number;
  /** Risk score threshold for auto-approval (default: 30) */
  autoApprovalRiskThreshold: number;
  /** Enable strict classification mode (default: false) */
  strictMode: boolean;
}

const DEFAULT_CONFIG: IntentClassifierConfig = {
  autoApprovalTrustThreshold: 3,
  autoApprovalRiskThreshold: 30,
  strictMode: false,
};

/**
 * IntentClassifier for categorizing and assessing intents
 *
 * Provides rule-based classification without external ML dependencies.
 * Classification includes:
 * - Category (data-access, model-operation, external-integration, system-config, user-action)
 * - Risk level (low, medium, high, critical)
 * - Required approvals
 * - Auto-approval eligibility
 */
export class IntentClassifier {
  private config: IntentClassifierConfig;
  private riskAssessor: RiskAssessor;

  constructor(config: Partial<IntentClassifierConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.riskAssessor = new RiskAssessor(this.config.riskConfig);
  }

  /**
   * Classify an intent
   *
   * @param intent - The intent to classify
   * @param historicalPattern - Optional historical pattern data for risk assessment
   * @returns Complete classification result
   */
  async classifyIntent(
    intent: CreateIntent,
    historicalPattern?: HistoricalPattern | null
  ): Promise<Classification> {
    const tracer = getTracer();

    return tracer.startActiveSpan(
      'intent.classify',
      {
        kind: SpanKind.INTERNAL,
        attributes: {
          'intent.action': intent.action,
          'intent.resource': intent.resource,
        },
      },
      async (span) => {
        try {
          // Perform risk assessment
          const riskAssessment = await this.riskAssessor.assessRisk(
            intent,
            historicalPattern
          );

          // Determine matched pattern
          const actionPattern = matchActionPattern(intent.action);
          const matchedPattern = actionPattern?.name;

          // Calculate classification confidence
          const confidence = this.calculateConfidence(intent, actionPattern !== undefined);

          // Determine required approvals
          const requiredApprovals = this.determineApprovalTypes(riskAssessment);

          // Determine auto-approval eligibility
          const canAutoApprove = this.canAutoApprove(riskAssessment, requiredApprovals);

          const classification: Classification = {
            category: riskAssessment.category,
            riskLevel: riskAssessment.riskTier,
            riskScore: riskAssessment.riskScore,
            requiredApprovals,
            minTrustLevel: riskAssessment.requiredApprovals.minTrustLevel,
            canAutoApprove,
            matchedPattern,
            confidence,
            riskAssessment,
            classifiedAt: new Date().toISOString(),
          };

          // Set span attributes
          span.setAttributes({
            'classification.category': classification.category,
            'classification.risk_level': classification.riskLevel,
            'classification.risk_score': classification.riskScore,
            'classification.can_auto_approve': classification.canAutoApprove,
            'classification.confidence': classification.confidence,
            'classification.matched_pattern': matchedPattern ?? 'none',
          });

          span.setStatus({ code: SpanStatusCode.OK });
          return classification;
        } catch (error) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : 'Unknown error',
          });
          if (error instanceof Error) {
            span.recordException(error);
          }
          throw error;
        } finally {
          span.end();
        }
      }
    );
  }

  /**
   * Calculate classification confidence
   *
   * Confidence is based on:
   * - Pattern match: +0.5 if action matches known pattern
   * - Resource specificity: +0.3 if resource is non-empty
   * - Parameters presence: +0.2 if parameters are provided
   */
  private calculateConfidence(intent: CreateIntent, hasPatternMatch: boolean): number {
    let confidence = 0;

    // Pattern match contribution
    if (hasPatternMatch) {
      confidence += 0.5;
    } else {
      // Partial credit for matching category prefix
      const category = inferCategoryFromAction(intent.action);
      if (category !== 'user-action' || intent.action.includes(':')) {
        confidence += 0.25;
      }
    }

    // Resource specificity contribution
    if (intent.resource && intent.resource.length > 0) {
      confidence += 0.3;
    }

    // Parameters contribution
    if (intent.parameters && Object.keys(intent.parameters).length > 0) {
      confidence += 0.2;
    }

    return Math.min(1, confidence);
  }

  /**
   * Determine approval types based on risk assessment
   */
  private determineApprovalTypes(assessment: RiskAssessment): ApprovalType[] {
    const approvals: ApprovalType[] = [];
    const { requiredApprovals } = assessment;

    if (requiredApprovals.securityReview) {
      approvals.push('security');
    }

    if (requiredApprovals.managerApproval) {
      approvals.push('manager');
    }

    if (requiredApprovals.humanReview) {
      approvals.push('human');
    }

    // Determine if multi-party is needed
    if (approvals.length >= 2) {
      approvals.push('multi-party');
    }

    // If no specific approvals, determine based on risk
    if (approvals.length === 0) {
      if (assessment.riskScore <= this.config.autoApprovalRiskThreshold) {
        approvals.push('auto');
      } else {
        approvals.push('human');
      }
    }

    // 'none' is only for very low risk
    if (approvals.length === 0 || (approvals.length === 1 && approvals[0] === 'auto')) {
      if (assessment.riskScore <= 10) {
        return ['none'];
      }
    }

    return approvals;
  }

  /**
   * Determine if an intent can be auto-approved
   *
   * Auto-approval is possible when:
   * - Risk score is below the auto-approval threshold
   * - No human, manager, or security review is required
   * - Trust level requirement is met by the auto-approval trust threshold
   */
  private canAutoApprove(
    assessment: RiskAssessment,
    approvalTypes: ApprovalType[]
  ): boolean {
    // Check risk score threshold
    if (assessment.riskScore > this.config.autoApprovalRiskThreshold) {
      return false;
    }

    // Check if any blocking approval types are required
    const blockingApprovals: ApprovalType[] = ['human', 'manager', 'security', 'multi-party'];
    if (approvalTypes.some((a) => blockingApprovals.includes(a))) {
      return false;
    }

    // Check trust level requirement
    if (assessment.requiredApprovals.minTrustLevel > this.config.autoApprovalTrustThreshold) {
      return false;
    }

    return true;
  }

  /**
   * Get the configured risk assessor
   */
  getRiskAssessor(): RiskAssessor {
    return this.riskAssessor;
  }

  /**
   * Check if an action is known/recognized
   */
  isKnownAction(action: string): boolean {
    return matchActionPattern(action) !== undefined;
  }

  /**
   * Get the category for an action
   */
  getCategoryForAction(action: string): IntentCategory {
    const pattern = matchActionPattern(action);
    return pattern?.category ?? inferCategoryFromAction(action);
  }
}

/**
 * Create a new IntentClassifier instance with optional configuration
 */
export function createIntentClassifier(
  config?: Partial<IntentClassifierConfig>
): IntentClassifier {
  return new IntentClassifier(config);
}

// Re-export types and utilities
export type {
  CreateIntent,
  RiskAssessment,
  HistoricalPattern,
  RiskAssessorConfig,
  RiskFactor,
  RequiredApprovals,
} from './risk.js';

export {
  RiskAssessor,
  createRiskAssessor,
} from './risk.js';

export type {
  IntentCategory,
  RiskTier,
  ActionPattern,
  ResourceSensitivity,
} from './patterns.js';

export {
  ACTION_PATTERNS,
  RESOURCE_SENSITIVITY,
  matchActionPattern,
  matchResourceSensitivity,
  getResourceSensitivityLevel,
  getResourceRiskTier,
  inferCategoryFromAction,
  scoreToTier,
  tierToMinScore,
  requiresApproval,
} from './patterns.js';
