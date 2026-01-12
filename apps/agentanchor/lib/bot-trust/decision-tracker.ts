/**
 * Decision Tracker - Core module for tracking all bot decisions
 */

import { createClient } from '@supabase/supabase-js';
import logger from '@/lib/logger';
import {
  BotDecision,
  DecisionType,
  RiskLevel,
  UserResponse,
} from './types';

export class DecisionTracker {
  private supabase;

  constructor(supabaseUrl?: string, supabaseKey?: string) {
    this.supabase = createClient(
      supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * Log a new bot decision
   */
  async logDecision(decision: Omit<BotDecision, 'id' | 'created_at'>): Promise<BotDecision> {
    try {
      const { data, error } = await this.supabase
        .from('bot_decisions')
        .insert({
          bot_id: decision.bot_id,
          decision_type: decision.decision_type,
          action_taken: decision.action_taken,
          context_data: decision.context_data || {},
          reasoning: decision.reasoning,
          alternatives_considered: decision.alternatives_considered || [],
          confidence_score: decision.confidence_score,
          risk_level: decision.risk_level,
          user_response: decision.user_response,
          modification_details: decision.modification_details,
          outcome: decision.outcome,
        })
        .select()
        .single();

      if (error) throw error;

      logger.info('bot_decision_tracked', {
        bot_id: decision.bot_id,
        decision_type: decision.decision_type,
        confidence_score: decision.confidence_score,
      });

      return data;
    } catch (error) {
      logger.error('decision_tracking_failed', { error, decision });
      throw new Error(`Failed to log decision: ${error}`);
    }
  }

  /**
   * Update decision with user response
   */
  async updateDecisionResponse(
    decisionId: string,
    userResponse: UserResponse,
    modificationDetails?: string
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('bot_decisions')
        .update({
          user_response: userResponse,
          modification_details: modificationDetails,
        })
        .eq('id', decisionId);

      if (error) throw error;

      logger.info('decision_response_updated', {
        decision_id: decisionId,
        user_response: userResponse,
      });
    } catch (error) {
      logger.error('decision_response_update_failed', { error, decisionId });
      throw new Error(`Failed to update decision response: ${error}`);
    }
  }

  /**
   * Get decision history for a bot
   */
  async getDecisionHistory(
    botId: string,
    options?: {
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
      decisionType?: DecisionType;
      riskLevel?: RiskLevel;
    }
  ): Promise<BotDecision[]> {
    try {
      let query = this.supabase
        .from('bot_decisions')
        .select('*')
        .eq('bot_id', botId)
        .order('created_at', { ascending: false });

      if (options?.startDate) {
        query = query.gte('created_at', options.startDate.toISOString());
      }

      if (options?.endDate) {
        query = query.lte('created_at', options.endDate.toISOString());
      }

      if (options?.decisionType) {
        query = query.eq('decision_type', options.decisionType);
      }

      if (options?.riskLevel) {
        query = query.eq('risk_level', options.riskLevel);
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data || [];
    } catch (error) {
      logger.error('get_decision_history_failed', { error, botId });
      throw new Error(`Failed to get decision history: ${error}`);
    }
  }

  /**
   * Get decision count by status
   */
  async getDecisionCounts(
    botId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    total: number;
    approved: number;
    rejected: number;
    modified: number;
    pending: number;
  }> {
    try {
      let query = this.supabase
        .from('bot_decisions')
        .select('user_response')
        .eq('bot_id', botId);

      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }

      if (endDate) {
        query = query.lte('created_at', endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      const counts = {
        total: data?.length || 0,
        approved: 0,
        rejected: 0,
        modified: 0,
        pending: 0,
      };

      data?.forEach((decision) => {
        switch (decision.user_response) {
          case UserResponse.APPROVED:
            counts.approved++;
            break;
          case UserResponse.REJECTED:
            counts.rejected++;
            break;
          case UserResponse.MODIFIED:
            counts.modified++;
            break;
          default:
            counts.pending++;
        }
      });

      return counts;
    } catch (error) {
      logger.error('get_decision_counts_failed', { error, botId });
      throw new Error(`Failed to get decision counts: ${error}`);
    }
  }

  /**
   * Get decisions grouped by type
   */
  async getDecisionsByType(
    botId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<Record<DecisionType, number>> {
    try {
      let query = this.supabase
        .from('bot_decisions')
        .select('decision_type')
        .eq('bot_id', botId);

      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }

      if (endDate) {
        query = query.lte('created_at', endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      const counts: Record<DecisionType, number> = {
        [DecisionType.ASK]: 0,
        [DecisionType.SUGGEST]: 0,
        [DecisionType.EXECUTE]: 0,
        [DecisionType.ESCALATE]: 0,
      };

      data?.forEach((decision) => {
        counts[decision.decision_type as DecisionType]++;
      });

      return counts;
    } catch (error) {
      logger.error('get_decisions_by_type_failed', { error, botId });
      throw new Error(`Failed to get decisions by type: ${error}`);
    }
  }

  /**
   * Get decisions grouped by risk level
   */
  async getDecisionsByRiskLevel(
    botId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<Record<RiskLevel, number>> {
    try {
      let query = this.supabase
        .from('bot_decisions')
        .select('risk_level')
        .eq('bot_id', botId);

      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }

      if (endDate) {
        query = query.lte('created_at', endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      const counts: Record<RiskLevel, number> = {
        [RiskLevel.LOW]: 0,
        [RiskLevel.MEDIUM]: 0,
        [RiskLevel.HIGH]: 0,
        [RiskLevel.CRITICAL]: 0,
      };

      data?.forEach((decision) => {
        counts[decision.risk_level as RiskLevel]++;
      });

      return counts;
    } catch (error) {
      logger.error('get_decisions_by_risk_level_failed', { error, botId });
      throw new Error(`Failed to get decisions by risk level: ${error}`);
    }
  }
}

// Export singleton instance
export const decisionTracker = new DecisionTracker();
