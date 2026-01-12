/**
 * Trust Score Engine - Calculates FICO-style trust scores (300-1000)
 *
 * Trust Score Components (weighted):
 * - Decision Accuracy (35%): Based on approval rates
 * - Ethics Compliance (25%): Adherence to guardrails and policies
 * - Training Success (20%): How well bot learns from feedback
 * - Operational Stability (15%): Uptime, error rates, performance
 * - Peer Reviews (5%): Reviews from other bots or users
 */

import { createClient } from '@supabase/supabase-js';
import logger from '@/lib/logger';
import { ApprovalRateCalculator } from './approval-rate-calculator';
import { DecisionTracker } from './decision-tracker';
import { TrustScore, RiskLevel } from './types';

interface ComponentWeights {
  decision_accuracy: number;
  ethics_compliance: number;
  training_success: number;
  operational_stability: number;
  peer_reviews: number;
}

const WEIGHTS: ComponentWeights = {
  decision_accuracy: 0.35,
  ethics_compliance: 0.25,
  training_success: 0.20,
  operational_stability: 0.15,
  peer_reviews: 0.05,
};

export class TrustScoreEngine {
  private supabase;
  private approvalRateCalculator: ApprovalRateCalculator;
  private decisionTracker: DecisionTracker;

  constructor(supabaseUrl?: string, supabaseKey?: string) {
    this.supabase = createClient(
      supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    this.approvalRateCalculator = new ApprovalRateCalculator(
      supabaseUrl,
      supabaseKey
    );
    this.decisionTracker = new DecisionTracker(supabaseUrl, supabaseKey);
  }

  /**
   * Calculate Decision Accuracy score (0-100)
   * Based on overall approval rate and risk-weighted performance
   */
  private async calculateDecisionAccuracy(botId: string): Promise<number> {
    try {
      const approvalRate = await this.approvalRateCalculator.getApprovalRate(
        botId
      );

      // Base score from overall approval rate
      let score = approvalRate.overall * 100;

      // Risk-weighted adjustments
      const riskWeights = {
        [RiskLevel.LOW]: 0.5,
        [RiskLevel.MEDIUM]: 1.0,
        [RiskLevel.HIGH]: 1.5,
        [RiskLevel.CRITICAL]: 2.0,
      };

      let weightedSum = 0;
      let totalWeight = 0;

      Object.entries(approvalRate.by_risk_level).forEach(([level, rate]) => {
        const weight = riskWeights[level as RiskLevel];
        weightedSum += rate * 100 * weight;
        totalWeight += weight;
      });

      const riskWeightedScore =
        totalWeight > 0 ? weightedSum / totalWeight : score;

      // Combine base score (60%) with risk-weighted score (40%)
      score = score * 0.6 + riskWeightedScore * 0.4;

      // Trend bonus: reward improving performance
      const { last_7_days, last_30_days } = approvalRate.trend;
      if (last_7_days > last_30_days) {
        score += 5; // 5 point bonus for improving trend
      }

      return Math.min(100, Math.max(0, score));
    } catch (error) {
      logger.error('calculate_decision_accuracy_failed', { error, botId });
      return 0;
    }
  }

  /**
   * Calculate Ethics Compliance score (0-100)
   * Based on policy violations, escalations, and guardrail adherence
   */
  private async calculateEthicsCompliance(botId: string): Promise<number> {
    try {
      // Start with perfect score
      let score = 100;

      const decisions = await this.decisionTracker.getDecisionHistory(botId, {
        limit: 500,
      });

      if (decisions.length === 0) return 100;

      // Count violations
      let criticalViolations = 0;
      let highRiskRejections = 0;
      let escalations = 0;

      decisions.forEach((decision) => {
        // Critical risk decisions that were rejected
        if (
          decision.risk_level === RiskLevel.CRITICAL &&
          decision.user_response === 'rejected'
        ) {
          criticalViolations++;
        }

        // High risk rejections
        if (
          decision.risk_level === RiskLevel.HIGH &&
          decision.user_response === 'rejected'
        ) {
          highRiskRejections++;
        }

        // Escalations indicate uncertainty
        if (decision.decision_type === 'escalate') {
          escalations++;
        }
      });

      // Penalties
      score -= criticalViolations * 10; // -10 per critical violation
      score -= highRiskRejections * 3; // -3 per high risk rejection
      score -= (escalations / decisions.length) * 15; // -15 for high escalation rate

      return Math.min(100, Math.max(0, score));
    } catch (error) {
      logger.error('calculate_ethics_compliance_failed', { error, botId });
      return 50; // Default to middle score on error
    }
  }

  /**
   * Calculate Training Success score (0-100)
   * Based on how well bot learns from feedback over time
   */
  private async calculateTrainingSuccess(botId: string): Promise<number> {
    try {
      const history = await this.approvalRateCalculator.getApprovalRateHistory(
        botId,
        30
      );

      if (history.length < 7) {
        return 50; // Insufficient data, return neutral score
      }

      // Calculate learning trajectory
      const recentRates = history.slice(-7).map((h) => h.rate);
      const olderRates = history.slice(0, 7).map((h) => h.rate);

      const recentAvg =
        recentRates.reduce((a, b) => a + b, 0) / recentRates.length;
      const olderAvg =
        olderRates.reduce((a, b) => a + b, 0) / olderRates.length;

      // Improvement rate
      const improvement = recentAvg - olderAvg;

      // Base score from current performance
      let score = recentAvg * 100;

      // Bonus for improvement (up to +20 points)
      if (improvement > 0) {
        score += Math.min(20, improvement * 200);
      }

      // Penalty for decline
      if (improvement < 0) {
        score += Math.max(-15, improvement * 150);
      }

      // Consistency bonus: low variance is good
      const variance =
        recentRates.reduce((sum, rate) => {
          return sum + Math.pow(rate - recentAvg, 2);
        }, 0) / recentRates.length;

      if (variance < 0.01) {
        score += 10; // Bonus for consistent performance
      }

      return Math.min(100, Math.max(0, score));
    } catch (error) {
      logger.error('calculate_training_success_failed', { error, botId });
      return 50;
    }
  }

  /**
   * Calculate Operational Stability score (0-100)
   * Based on error rates, response times, and uptime
   */
  private async calculateOperationalStability(
    botId: string
  ): Promise<number> {
    try {
      // Query telemetry data
      const { data: telemetry, error } = await this.supabase
        .from('bot_telemetry')
        .select('metric_name, metric_value, timestamp')
        .eq('bot_id', botId)
        .gte(
          'timestamp',
          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        );

      if (error) throw error;

      if (!telemetry || telemetry.length === 0) {
        return 85; // Default good score for new bots
      }

      let score = 100;

      // Error rate analysis
      const errors = telemetry.filter((t) => t.metric_name === 'error_count');
      const requests = telemetry.filter(
        (t) => t.metric_name === 'request_count'
      );

      if (requests.length > 0 && errors.length > 0) {
        const errorCount = errors.reduce((sum, e) => sum + e.metric_value, 0);
        const requestCount = requests.reduce(
          (sum, r) => sum + r.metric_value,
          0
        );
        const errorRate = requestCount > 0 ? errorCount / requestCount : 0;

        // Penalty for high error rate
        score -= errorRate * 100; // -100 points for 100% error rate
      }

      // Response time analysis
      const responseTimes = telemetry.filter(
        (t) => t.metric_name === 'response_time_ms'
      );

      if (responseTimes.length > 0) {
        const avgResponseTime =
          responseTimes.reduce((sum, rt) => sum + rt.metric_value, 0) /
          responseTimes.length;

        // Penalty for slow responses (>5000ms)
        if (avgResponseTime > 5000) {
          score -= Math.min(15, (avgResponseTime - 5000) / 1000);
        }
      }

      return Math.min(100, Math.max(0, score));
    } catch (error) {
      logger.error('calculate_operational_stability_failed', { error, botId });
      return 85;
    }
  }

  /**
   * Calculate Peer Reviews score (0-100)
   * Based on reviews from other bots and human evaluators
   */
  private async calculatePeerReviews(botId: string): Promise<number> {
    try {
      // Query peer review data (to be implemented with review system)
      // For now, return a default score
      return 75;
    } catch (error) {
      logger.error('calculate_peer_reviews_failed', { error, botId });
      return 75;
    }
  }

  /**
   * Calculate complete trust score (300-1000)
   */
  async calculateTrustScore(botId: string): Promise<TrustScore> {
    try {
      logger.info('calculating_trust_score', { bot_id: botId });

      // Calculate all components in parallel
      const [
        decision_accuracy,
        ethics_compliance,
        training_success,
        operational_stability,
        peer_reviews,
      ] = await Promise.all([
        this.calculateDecisionAccuracy(botId),
        this.calculateEthicsCompliance(botId),
        this.calculateTrainingSuccess(botId),
        this.calculateOperationalStability(botId),
        this.calculatePeerReviews(botId),
      ]);

      const components = {
        decision_accuracy,
        ethics_compliance,
        training_success,
        operational_stability,
        peer_reviews,
      };

      // Calculate weighted score (0-100)
      const weightedScore =
        decision_accuracy * WEIGHTS.decision_accuracy +
        ethics_compliance * WEIGHTS.ethics_compliance +
        training_success * WEIGHTS.training_success +
        operational_stability * WEIGHTS.operational_stability +
        peer_reviews * WEIGHTS.peer_reviews;

      // Scale to 300-1000 range (FICO-style)
      const score = Math.round(300 + (weightedScore / 100) * 700);

      const trustScore: TrustScore = {
        score: Math.min(1000, Math.max(300, score)),
        components,
        calculated_at: new Date(),
      };

      logger.info('trust_score_calculated', {
        bot_id: botId,
        score: trustScore.score,
        components,
      });

      return trustScore;
    } catch (error) {
      logger.error('calculate_trust_score_failed', { error, botId });
      throw new Error(`Failed to calculate trust score: ${error}`);
    }
  }

  /**
   * Store trust score in database
   */
  async storeTrustScore(botId: string): Promise<TrustScore> {
    try {
      const trustScore = await this.calculateTrustScore(botId);

      const { error } = await this.supabase.from('bot_trust_scores').insert({
        bot_id: botId,
        score: trustScore.score,
        decision_accuracy: trustScore.components.decision_accuracy,
        ethics_compliance: trustScore.components.ethics_compliance,
        training_success: trustScore.components.training_success,
        operational_stability: trustScore.components.operational_stability,
        peer_reviews: trustScore.components.peer_reviews,
      });

      if (error) throw error;

      return trustScore;
    } catch (error) {
      logger.error('store_trust_score_failed', { error, botId });
      throw new Error(`Failed to store trust score: ${error}`);
    }
  }

  /**
   * Get latest trust score from database
   */
  async getLatestTrustScore(botId: string): Promise<TrustScore | null> {
    try {
      const { data, error } = await this.supabase
        .from('bot_trust_scores')
        .select('*')
        .eq('bot_id', botId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;
      if (!data) return null;

      return {
        score: data.score,
        components: {
          decision_accuracy: data.decision_accuracy,
          ethics_compliance: data.ethics_compliance,
          training_success: data.training_success,
          operational_stability: data.operational_stability,
          peer_reviews: data.peer_reviews,
        },
        calculated_at: new Date(data.created_at),
      };
    } catch (error) {
      logger.error('get_latest_trust_score_failed', { error, botId });
      return null;
    }
  }

  /**
   * Get trust score history for charting
   */
  async getTrustScoreHistory(
    botId: string,
    limit: number = 30
  ): Promise<Array<{ timestamp: Date; score: number }>> {
    try {
      const { data, error } = await this.supabase
        .from('bot_trust_scores')
        .select('created_at, score')
        .eq('bot_id', botId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (
        data?.map((record) => ({
          timestamp: new Date(record.created_at),
          score: record.score,
        })) || []
      ).reverse();
    } catch (error) {
      logger.error('get_trust_score_history_failed', { error, botId });
      throw new Error(`Failed to get trust score history: ${error}`);
    }
  }
}

// Export singleton instance
export const trustScoreEngine = new TrustScoreEngine();
