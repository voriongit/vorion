/**
 * Approval Rate Calculator - Calculates and tracks bot approval rates
 */

import { createClient } from '@supabase/supabase-js';
import logger from '@/lib/logger';
import { DecisionTracker } from './decision-tracker';
import { ApprovalRate, RiskLevel, UserResponse } from './types';

export class ApprovalRateCalculator {
  private supabase;
  private decisionTracker: DecisionTracker;

  constructor(supabaseUrl?: string, supabaseKey?: string) {
    this.supabase = createClient(
      supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    this.decisionTracker = new DecisionTracker(supabaseUrl, supabaseKey);
  }

  /**
   * Calculate overall approval rate for a bot
   */
  async calculateOverallRate(botId: string): Promise<number> {
    try {
      const counts = await this.decisionTracker.getDecisionCounts(botId);

      if (counts.total === 0) return 0;

      const approved = counts.approved + counts.modified;
      return approved / counts.total;
    } catch (error) {
      logger.error('calculate_overall_rate_failed', { error, botId });
      throw new Error(`Failed to calculate overall rate: ${error}`);
    }
  }

  /**
   * Calculate approval rate by task type
   */
  async calculateByTaskType(botId: string): Promise<Record<string, number>> {
    try {
      const decisions = await this.decisionTracker.getDecisionHistory(botId);

      const taskTypes: Record<string, { approved: number; total: number }> = {};

      decisions.forEach((decision) => {
        const taskType = decision.action_taken.split(':')[0] || 'other';

        if (!taskTypes[taskType]) {
          taskTypes[taskType] = { approved: 0, total: 0 };
        }

        taskTypes[taskType].total++;

        if (
          decision.user_response === UserResponse.APPROVED ||
          decision.user_response === UserResponse.MODIFIED
        ) {
          taskTypes[taskType].approved++;
        }
      });

      const rates: Record<string, number> = {};
      Object.entries(taskTypes).forEach(([type, counts]) => {
        rates[type] = counts.total > 0 ? counts.approved / counts.total : 0;
      });

      return rates;
    } catch (error) {
      logger.error('calculate_by_task_type_failed', { error, botId });
      throw new Error(`Failed to calculate by task type: ${error}`);
    }
  }

  /**
   * Calculate approval rate by risk level
   */
  async calculateByRiskLevel(
    botId: string
  ): Promise<Record<RiskLevel, number>> {
    try {
      const decisions = await this.decisionTracker.getDecisionHistory(botId);

      const riskLevels: Record<
        RiskLevel,
        { approved: number; total: number }
      > = {
        [RiskLevel.LOW]: { approved: 0, total: 0 },
        [RiskLevel.MEDIUM]: { approved: 0, total: 0 },
        [RiskLevel.HIGH]: { approved: 0, total: 0 },
        [RiskLevel.CRITICAL]: { approved: 0, total: 0 },
      };

      decisions.forEach((decision) => {
        const risk = decision.risk_level as RiskLevel;
        riskLevels[risk].total++;

        if (
          decision.user_response === UserResponse.APPROVED ||
          decision.user_response === UserResponse.MODIFIED
        ) {
          riskLevels[risk].approved++;
        }
      });

      const rates: Record<RiskLevel, number> = {
        [RiskLevel.LOW]: 0,
        [RiskLevel.MEDIUM]: 0,
        [RiskLevel.HIGH]: 0,
        [RiskLevel.CRITICAL]: 0,
      };

      Object.entries(riskLevels).forEach(([level, counts]) => {
        rates[level as RiskLevel] =
          counts.total > 0 ? counts.approved / counts.total : 0;
      });

      return rates;
    } catch (error) {
      logger.error('calculate_by_risk_level_failed', { error, botId });
      throw new Error(`Failed to calculate by risk level: ${error}`);
    }
  }

  /**
   * Calculate approval rate trends over time
   */
  async calculateTrends(botId: string): Promise<{
    last_7_days: number;
    last_30_days: number;
    last_90_days: number;
  }> {
    try {
      const now = new Date();

      const [last7Days, last30Days, last90Days] = await Promise.all([
        this.calculateRateForPeriod(
          botId,
          new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
          now
        ),
        this.calculateRateForPeriod(
          botId,
          new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          now
        ),
        this.calculateRateForPeriod(
          botId,
          new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
          now
        ),
      ]);

      return {
        last_7_days: last7Days,
        last_30_days: last30Days,
        last_90_days: last90Days,
      };
    } catch (error) {
      logger.error('calculate_trends_failed', { error, botId });
      throw new Error(`Failed to calculate trends: ${error}`);
    }
  }

  /**
   * Calculate approval rate for a specific time period
   */
  private async calculateRateForPeriod(
    botId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const counts = await this.decisionTracker.getDecisionCounts(
      botId,
      startDate,
      endDate
    );

    if (counts.total === 0) return 0;

    const approved = counts.approved + counts.modified;
    return approved / counts.total;
  }

  /**
   * Get complete approval rate data for a bot
   */
  async getApprovalRate(botId: string): Promise<ApprovalRate> {
    try {
      const [overall, byTaskType, byRiskLevel, trend] = await Promise.all([
        this.calculateOverallRate(botId),
        this.calculateByTaskType(botId),
        this.calculateByRiskLevel(botId),
        this.calculateTrends(botId),
      ]);

      const approvalRate: ApprovalRate = {
        overall,
        by_task_type: byTaskType,
        by_risk_level: byRiskLevel,
        trend,
      };

      return approvalRate;
    } catch (error) {
      logger.error('get_approval_rate_failed', { error, botId });
      throw new Error(`Failed to get approval rate: ${error}`);
    }
  }

  /**
   * Store approval rate snapshot in database
   */
  async storeApprovalRate(botId: string): Promise<void> {
    try {
      const approvalRate = await this.getApprovalRate(botId);

      const { error } = await this.supabase
        .from('bot_approval_rates')
        .insert({
          bot_id: botId,
          overall_rate: approvalRate.overall,
          by_task_type: approvalRate.by_task_type,
          by_risk_level: approvalRate.by_risk_level,
          trend_7_days: approvalRate.trend.last_7_days,
          trend_30_days: approvalRate.trend.last_30_days,
          trend_90_days: approvalRate.trend.last_90_days,
        });

      if (error) throw error;

      logger.info('approval_rate_stored', {
        bot_id: botId,
        overall_rate: approvalRate.overall,
      });
    } catch (error) {
      logger.error('store_approval_rate_failed', { error, botId });
      throw new Error(`Failed to store approval rate: ${error}`);
    }
  }

  /**
   * Get historical approval rates for charting
   */
  async getApprovalRateHistory(
    botId: string,
    limit: number = 30
  ): Promise<Array<{ timestamp: Date; rate: number }>> {
    try {
      const { data, error } = await this.supabase
        .from('bot_approval_rates')
        .select('created_at, overall_rate')
        .eq('bot_id', botId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (
        data?.map((record) => ({
          timestamp: new Date(record.created_at),
          rate: record.overall_rate,
        })) || []
      ).reverse();
    } catch (error) {
      logger.error('get_approval_rate_history_failed', { error, botId });
      throw new Error(`Failed to get approval rate history: ${error}`);
    }
  }
}

// Export lazy singleton getter (avoids initialization during build)
let _approvalRateCalculator: ApprovalRateCalculator | null = null;
export function getApprovalRateCalculator(): ApprovalRateCalculator {
  if (!_approvalRateCalculator) {
    _approvalRateCalculator = new ApprovalRateCalculator();
  }
  return _approvalRateCalculator;
}
// Deprecated: Use getApprovalRateCalculator() instead
export const approvalRateCalculator = new Proxy({} as ApprovalRateCalculator, {
  get(_target, prop) {
    return (getApprovalRateCalculator() as any)[prop];
  },
});
