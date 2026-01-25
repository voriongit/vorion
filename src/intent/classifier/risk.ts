/**
 * Intent Risk Assessment
 *
 * Provides rule-based risk assessment for intents in the Vorion AI Governance Platform.
 * Risk is calculated based on action type, resource sensitivity, and historical patterns.
 *
 * Risk Calculation Logic:
 * =======================
 *
 * 1. Base Risk Score (from action pattern):
 *    - Each action type has a predefined base risk score (0-100)
 *    - Unknown actions default to medium risk (40)
 *
 * 2. Resource Sensitivity Modifier:
 *    - Resources are matched against sensitivity patterns
 *    - Highest matching sensitivity level is used
 *    - Applied as: adjustedScore = baseScore * (1 + (sensitivity - 30) / 100)
 *    - This can increase or decrease risk based on resource sensitivity
 *
 * 3. Historical Pattern Adjustment:
 *    - High failure rate (+15 points)
 *    - First-time action/resource combination (+10 points)
 *    - Frequent successful history (-5 points)
 *
 * 4. Parameter-based Adjustments:
 *    - Bulk operations (+20 points)
 *    - Cross-tenant operations (+25 points)
 *    - Elevated privilege requests (+15 points)
 *
 * Final Score: Clamped to 0-100 range
 */

import {
  trace,
  SpanKind,
  SpanStatusCode,
  type Span,
} from '@opentelemetry/api';
import {
  type RiskTier,
  type IntentCategory,
  matchActionPattern,
  getResourceSensitivityLevel,
  scoreToTier,
  inferCategoryFromAction,
} from './patterns.js';

// Tracer for risk assessment operations
const TRACER_NAME = 'vorion.intent.classifier';
const TRACER_VERSION = '1.0.0';

/**
 * Get the risk assessment tracer
 */
function getTracer() {
  return trace.getTracer(TRACER_NAME, TRACER_VERSION);
}

/**
 * Input for risk assessment - matches intent submission shape
 */
export interface CreateIntent {
  /** Action to be performed (e.g., 'data:read', 'model:train') */
  action: string;
  /** Resource being accessed */
  resource: string;
  /** Action-specific parameters */
  parameters?: Record<string, unknown>;
  /** Existing risk score if provided externally */
  riskScore?: number;
}

/**
 * Risk factor that contributed to the assessment
 */
export interface RiskFactor {
  /** Factor identifier */
  name: string;
  /** Points added or subtracted */
  points: number;
  /** Description of why this factor applies */
  reason: string;
}

/**
 * Required approvals based on risk assessment
 */
export interface RequiredApprovals {
  /** Whether human review is required */
  humanReview: boolean;
  /** Whether manager/supervisor approval is needed */
  managerApproval: boolean;
  /** Whether security team review is needed */
  securityReview: boolean;
  /** Minimum trust level required to execute */
  minTrustLevel: number;
}

/**
 * Complete risk assessment result
 */
export interface RiskAssessment {
  /** Final risk score (0-100) */
  riskScore: number;
  /** Risk tier classification */
  riskTier: RiskTier;
  /** Factors that contributed to the score */
  factors: RiskFactor[];
  /** Category of the intent */
  category: IntentCategory;
  /** Required approvals based on risk level */
  requiredApprovals: RequiredApprovals;
  /** Assessment timestamp */
  assessedAt: string;
}

/**
 * Historical pattern information for risk adjustment
 */
export interface HistoricalPattern {
  /** Total number of similar intents processed */
  totalCount: number;
  /** Number of successful completions */
  successCount: number;
  /** Number of failures */
  failureCount: number;
  /** Whether this is a first-time action/resource combination */
  isFirstTime: boolean;
  /** Average processing time in milliseconds */
  avgProcessingTimeMs?: number;
}

/**
 * Configuration for risk assessment
 */
export interface RiskAssessorConfig {
  /** Default risk score for unknown actions (default: 40) */
  defaultRiskScore: number;
  /** Enable historical pattern analysis (default: true) */
  useHistoricalPatterns: boolean;
  /** Provider for historical patterns (optional) */
  historicalPatternProvider?: (intent: CreateIntent) => Promise<HistoricalPattern | null>;
}

const DEFAULT_CONFIG: RiskAssessorConfig = {
  defaultRiskScore: 40,
  useHistoricalPatterns: true,
};

/**
 * RiskAssessor class for evaluating intent risk
 *
 * Provides rule-based risk assessment without external ML dependencies.
 * Risk scores are calculated based on:
 * - Action type and its inherent risk
 * - Resource sensitivity (PII, financial, credentials, etc.)
 * - Historical patterns (optional)
 * - Parameter-based modifiers
 */
export class RiskAssessor {
  private config: RiskAssessorConfig;

  constructor(config: Partial<RiskAssessorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Assess the risk of an intent
   *
   * @param intent - The intent to assess
   * @param historicalPattern - Optional historical pattern data
   * @returns Complete risk assessment
   */
  async assessRisk(
    intent: CreateIntent,
    historicalPattern?: HistoricalPattern | null
  ): Promise<RiskAssessment> {
    const tracer = getTracer();

    return tracer.startActiveSpan(
      'risk.assess',
      {
        kind: SpanKind.INTERNAL,
        attributes: {
          'intent.action': intent.action,
          'intent.resource': intent.resource,
        },
      },
      async (span) => {
        try {
          const result = await this.performAssessment(intent, historicalPattern, span);
          span.setStatus({ code: SpanStatusCode.OK });
          span.setAttributes({
            'risk.score': result.riskScore,
            'risk.tier': result.riskTier,
            'risk.factors_count': result.factors.length,
          });
          return result;
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
   * Perform the actual risk assessment
   */
  private async performAssessment(
    intent: CreateIntent,
    providedPattern?: HistoricalPattern | null,
    span?: Span
  ): Promise<RiskAssessment> {
    const factors: RiskFactor[] = [];
    let score = 0;

    // 1. Get base risk from action pattern
    const actionPattern = matchActionPattern(intent.action);
    if (actionPattern) {
      score = actionPattern.defaultRiskScore;
      factors.push({
        name: 'action_type',
        points: score,
        reason: `Base risk for ${actionPattern.name}: ${actionPattern.description}`,
      });
    } else {
      score = this.config.defaultRiskScore;
      factors.push({
        name: 'unknown_action',
        points: score,
        reason: `Unknown action type '${intent.action}', using default risk score`,
      });
    }

    // 2. Apply resource sensitivity modifier
    const sensitivityLevel = getResourceSensitivityLevel(intent.resource);
    const sensitivityModifier = (sensitivityLevel - 30) / 100;
    const sensitivityAdjustment = Math.round(score * sensitivityModifier);

    if (sensitivityAdjustment !== 0) {
      score += sensitivityAdjustment;
      factors.push({
        name: 'resource_sensitivity',
        points: sensitivityAdjustment,
        reason: `Resource sensitivity level ${sensitivityLevel}: ${sensitivityAdjustment > 0 ? 'increased' : 'decreased'} risk`,
      });
    }

    // 3. Apply historical pattern adjustments
    let historicalPattern = providedPattern;
    if (
      !historicalPattern &&
      this.config.useHistoricalPatterns &&
      this.config.historicalPatternProvider
    ) {
      historicalPattern = await this.config.historicalPatternProvider(intent);
    }

    if (historicalPattern) {
      const patternAdjustments = this.calculateHistoricalAdjustments(historicalPattern);
      for (const adj of patternAdjustments) {
        score += adj.points;
        factors.push(adj);
      }
    }

    // 4. Apply parameter-based adjustments
    const paramAdjustments = this.calculateParameterAdjustments(intent.parameters);
    for (const adj of paramAdjustments) {
      score += adj.points;
      factors.push(adj);
    }

    // 5. Clamp score to 0-100 range
    const finalScore = Math.max(0, Math.min(100, score));

    // 6. Determine risk tier
    const riskTier = scoreToTier(finalScore);

    // 7. Determine category
    const category = actionPattern?.category ?? inferCategoryFromAction(intent.action);

    // 8. Calculate required approvals
    const requiredApprovals = this.calculateRequiredApprovals(finalScore, riskTier, category);

    // Record additional span attributes
    if (span) {
      span.setAttribute('risk.category', category);
      span.setAttribute('risk.sensitivity_level', sensitivityLevel);
      span.setAttribute('risk.has_historical_pattern', historicalPattern !== null);
    }

    return {
      riskScore: finalScore,
      riskTier,
      factors,
      category,
      requiredApprovals,
      assessedAt: new Date().toISOString(),
    };
  }

  /**
   * Calculate risk adjustments based on historical patterns
   *
   * Adjustment Rules:
   * - High failure rate (>30%): +15 points (indicates problematic pattern)
   * - First-time action: +10 points (unknown behavior)
   * - Frequent success (>10 with >90% success): -5 points (established safe pattern)
   */
  private calculateHistoricalAdjustments(pattern: HistoricalPattern): RiskFactor[] {
    const adjustments: RiskFactor[] = [];

    // First-time action adjustment
    if (pattern.isFirstTime) {
      adjustments.push({
        name: 'first_time_action',
        points: 10,
        reason: 'First-time action/resource combination, increased scrutiny',
      });
    }

    // Failure rate analysis
    if (pattern.totalCount > 0) {
      const failureRate = pattern.failureCount / pattern.totalCount;

      if (failureRate > 0.3) {
        adjustments.push({
          name: 'high_failure_rate',
          points: 15,
          reason: `High historical failure rate (${Math.round(failureRate * 100)}%)`,
        });
      } else if (pattern.totalCount >= 10 && failureRate < 0.1) {
        // Established successful pattern
        adjustments.push({
          name: 'established_pattern',
          points: -5,
          reason: `Established successful pattern (${pattern.successCount} successes)`,
        });
      }
    }

    return adjustments;
  }

  /**
   * Calculate risk adjustments based on intent parameters
   *
   * Parameter Flags:
   * - bulk: true -> +20 points (bulk operations have wider impact)
   * - crossTenant: true -> +25 points (cross-tenant requires extra scrutiny)
   * - elevated: true -> +15 points (elevated privilege request)
   * - dryRun: true -> -10 points (dry run is safer)
   */
  private calculateParameterAdjustments(
    parameters?: Record<string, unknown>
  ): RiskFactor[] {
    const adjustments: RiskFactor[] = [];

    if (!parameters) {
      return adjustments;
    }

    // Bulk operation check
    if (parameters.bulk === true || parameters.isBulk === true) {
      adjustments.push({
        name: 'bulk_operation',
        points: 20,
        reason: 'Bulk operation affecting multiple records',
      });
    }

    // Cross-tenant operation check
    if (parameters.crossTenant === true || parameters.isCrossTenant === true) {
      adjustments.push({
        name: 'cross_tenant',
        points: 25,
        reason: 'Cross-tenant operation requires additional security review',
      });
    }

    // Elevated privilege check
    if (parameters.elevated === true || parameters.privileged === true) {
      adjustments.push({
        name: 'elevated_privilege',
        points: 15,
        reason: 'Elevated privilege request',
      });
    }

    // Dry run check (reduces risk)
    if (parameters.dryRun === true || parameters.isDryRun === true) {
      adjustments.push({
        name: 'dry_run',
        points: -10,
        reason: 'Dry run mode - no actual changes will be made',
      });
    }

    // Large batch size check
    const batchSize = parameters.batchSize ?? parameters.count ?? parameters.limit;
    if (typeof batchSize === 'number' && batchSize > 1000) {
      adjustments.push({
        name: 'large_batch',
        points: 10,
        reason: `Large batch size (${batchSize} records)`,
      });
    }

    return adjustments;
  }

  /**
   * Calculate required approvals based on risk assessment
   *
   * Approval Thresholds:
   * - low (0-25): No special approvals, minTrustLevel 1
   * - medium (26-50): Human review recommended, minTrustLevel 2
   * - high (51-75): Human review + manager approval, minTrustLevel 3
   * - critical (76-100): Human review + manager + security review, minTrustLevel 4
   *
   * Additional rules for specific categories:
   * - system-config always requires manager approval if score > 40
   * - external-integration with payments requires security review
   */
  private calculateRequiredApprovals(
    score: number,
    tier: RiskTier,
    category: IntentCategory
  ): RequiredApprovals {
    const approvals: RequiredApprovals = {
      humanReview: false,
      managerApproval: false,
      securityReview: false,
      minTrustLevel: 1,
    };

    // Tier-based approvals
    switch (tier) {
      case 'low':
        approvals.minTrustLevel = 1;
        break;
      case 'medium':
        approvals.humanReview = true;
        approvals.minTrustLevel = 2;
        break;
      case 'high':
        approvals.humanReview = true;
        approvals.managerApproval = true;
        approvals.minTrustLevel = 3;
        break;
      case 'critical':
        approvals.humanReview = true;
        approvals.managerApproval = true;
        approvals.securityReview = true;
        approvals.minTrustLevel = 4;
        break;
    }

    // Category-specific overrides
    if (category === 'system-config' && score > 40) {
      approvals.managerApproval = true;
    }

    if (category === 'external-integration' && score >= 75) {
      approvals.securityReview = true;
    }

    return approvals;
  }
}

/**
 * Create a new RiskAssessor instance with optional configuration
 */
export function createRiskAssessor(
  config?: Partial<RiskAssessorConfig>
): RiskAssessor {
  return new RiskAssessor(config);
}

// Re-export types from patterns for convenience
export type { RiskTier, IntentCategory } from './patterns.js';
