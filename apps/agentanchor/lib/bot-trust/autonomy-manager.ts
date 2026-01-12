/**
 * Autonomy Manager - Manages bot autonomy levels and progression
 *
 * 5 Autonomy Levels:
 * 1. Ask & Learn: Bot asks before every action
 * 2. Suggest: Bot suggests actions with confidence scores
 * 3. Execute & Review: Bot executes low-risk actions, asks for high-risk
 * 4. Autonomous with Exceptions: Bot handles most decisions autonomously
 * 5. Fully Autonomous: Bot can make all decisions and train other bots
 */

import { createClient } from '@supabase/supabase-js';
import logger from '@/lib/logger';
import { ApprovalRateCalculator } from './approval-rate-calculator';
import { DecisionTracker } from './decision-tracker';
import {
  AutonomyLevel,
  AUTONOMY_REQUIREMENTS,
  DecisionType,
  RiskLevel,
} from './types';

interface AutonomyEvaluation {
  current_level: AutonomyLevel;
  can_progress: boolean;
  next_level?: AutonomyLevel;
  requirements_met: {
    min_decisions: boolean;
    min_approval_rate: boolean;
  };
  progress: {
    decisions: number;
    required_decisions: number;
    approval_rate: number;
    required_approval_rate: number;
  };
  recommendation: string;
}

export class AutonomyManager {
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
   * Get current autonomy level for a bot
   */
  async getCurrentLevel(botId: string): Promise<AutonomyLevel> {
    try {
      const { data, error } = await this.supabase
        .from('bot_autonomy_levels')
        .select('current_level')
        .eq('bot_id', botId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        return AutonomyLevel.LEVEL_1_ASK_LEARN; // Default for new bots
      }

      return data.current_level as AutonomyLevel;
    } catch (error) {
      logger.error('get_current_level_failed', { error, botId });
      return AutonomyLevel.LEVEL_1_ASK_LEARN;
    }
  }

  /**
   * Evaluate if bot can progress to next autonomy level
   */
  async evaluateProgression(botId: string): Promise<AutonomyEvaluation> {
    try {
      const currentLevel = await this.getCurrentLevel(botId);
      const nextLevel = currentLevel + 1;

      // Already at max level
      if (currentLevel === AutonomyLevel.LEVEL_5_FULLY_AUTONOMOUS) {
        return {
          current_level: currentLevel,
          can_progress: false,
          requirements_met: {
            min_decisions: true,
            min_approval_rate: true,
          },
          progress: {
            decisions: 0,
            required_decisions: 0,
            approval_rate: 1,
            required_approval_rate: 1,
          },
          recommendation: 'Bot has reached maximum autonomy level.',
        };
      }

      // Get requirements for next level
      const nextRequirements = AUTONOMY_REQUIREMENTS.find(
        (r) => r.level === nextLevel
      );

      if (!nextRequirements) {
        throw new Error(`Invalid autonomy level: ${nextLevel}`);
      }

      // Get bot statistics
      const [decisionCount, approvalRate] = await Promise.all([
        this.getDecisionCount(botId),
        this.approvalRateCalculator.calculateOverallRate(botId),
      ]);

      // Check requirements
      const meetsDecisionCount = decisionCount >= nextRequirements.min_decisions;
      const meetsApprovalRate =
        approvalRate >= nextRequirements.min_approval_rate;

      const canProgress = meetsDecisionCount && meetsApprovalRate;

      let recommendation = '';
      if (canProgress) {
        recommendation = `Bot is ready to progress to Level ${nextLevel}: ${nextRequirements.description}`;
      } else {
        const missingRequirements = [];
        if (!meetsDecisionCount) {
          const remaining =
            nextRequirements.min_decisions - decisionCount;
          missingRequirements.push(
            `${remaining} more decisions required`
          );
        }
        if (!meetsApprovalRate) {
          const gap = (
            (nextRequirements.min_approval_rate - approvalRate) *
            100
          ).toFixed(1);
          missingRequirements.push(
            `approval rate needs to improve by ${gap}%`
          );
        }
        recommendation = `To reach Level ${nextLevel}, bot needs: ${missingRequirements.join(', ')}.`;
      }

      return {
        current_level: currentLevel,
        can_progress: canProgress,
        next_level: nextLevel as AutonomyLevel,
        requirements_met: {
          min_decisions: meetsDecisionCount,
          min_approval_rate: meetsApprovalRate,
        },
        progress: {
          decisions: decisionCount,
          required_decisions: nextRequirements.min_decisions,
          approval_rate: approvalRate,
          required_approval_rate: nextRequirements.min_approval_rate,
        },
        recommendation,
      };
    } catch (error) {
      logger.error('evaluate_progression_failed', { error, botId });
      throw new Error(`Failed to evaluate progression: ${error}`);
    }
  }

  /**
   * Progress bot to next autonomy level
   */
  async progressToNextLevel(botId: string): Promise<AutonomyLevel> {
    try {
      const evaluation = await this.evaluateProgression(botId);

      if (!evaluation.can_progress) {
        throw new Error(
          `Bot cannot progress: ${evaluation.recommendation}`
        );
      }

      const newLevel = evaluation.next_level!;

      // Store new autonomy level
      const { error } = await this.supabase
        .from('bot_autonomy_levels')
        .insert({
          bot_id: botId,
          current_level: newLevel,
          previous_level: evaluation.current_level,
          decision_count: evaluation.progress.decisions,
          approval_rate: evaluation.progress.approval_rate,
          progression_reason: evaluation.recommendation,
        });

      if (error) throw error;

      logger.info('bot_autonomy_progressed', {
        bot_id: botId,
        from_level: evaluation.current_level,
        to_level: newLevel,
      });

      return newLevel;
    } catch (error) {
      logger.error('progress_to_next_level_failed', { error, botId });
      throw new Error(`Failed to progress autonomy level: ${error}`);
    }
  }

  /**
   * Demote bot to lower autonomy level (e.g., after violations)
   */
  async demoteLevel(botId: string, reason: string): Promise<AutonomyLevel> {
    try {
      const currentLevel = await this.getCurrentLevel(botId);

      if (currentLevel === AutonomyLevel.LEVEL_1_ASK_LEARN) {
        logger.warn('cannot_demote_below_level_1', { bot_id: botId });
        return currentLevel;
      }

      const newLevel = (currentLevel - 1) as AutonomyLevel;

      const { error } = await this.supabase
        .from('bot_autonomy_levels')
        .insert({
          bot_id: botId,
          current_level: newLevel,
          previous_level: currentLevel,
          decision_count: await this.getDecisionCount(botId),
          approval_rate:
            await this.approvalRateCalculator.calculateOverallRate(botId),
          progression_reason: `DEMOTION: ${reason}`,
        });

      if (error) throw error;

      logger.warn('bot_autonomy_demoted', {
        bot_id: botId,
        from_level: currentLevel,
        to_level: newLevel,
        reason,
      });

      return newLevel;
    } catch (error) {
      logger.error('demote_level_failed', { error, botId });
      throw new Error(`Failed to demote autonomy level: ${error}`);
    }
  }

  /**
   * Determine if bot should ask, suggest, or execute based on autonomy level and risk
   */
  async determineDecisionType(
    botId: string,
    riskLevel: RiskLevel,
    confidenceScore: number
  ): Promise<DecisionType> {
    try {
      const autonomyLevel = await this.getCurrentLevel(botId);

      // Level 1: Always ask
      if (autonomyLevel === AutonomyLevel.LEVEL_1_ASK_LEARN) {
        return DecisionType.ASK;
      }

      // Level 2: Always suggest
      if (autonomyLevel === AutonomyLevel.LEVEL_2_SUGGEST) {
        return DecisionType.SUGGEST;
      }

      // Level 3: Execute low-risk, review medium/high
      if (autonomyLevel === AutonomyLevel.LEVEL_3_EXECUTE_REVIEW) {
        if (riskLevel === RiskLevel.LOW && confidenceScore >= 0.8) {
          return DecisionType.EXECUTE;
        }
        return DecisionType.SUGGEST;
      }

      // Level 4: Autonomous except high-risk
      if (autonomyLevel === AutonomyLevel.LEVEL_4_AUTONOMOUS_EXCEPTIONS) {
        if (
          riskLevel === RiskLevel.CRITICAL ||
          (riskLevel === RiskLevel.HIGH && confidenceScore < 0.9)
        ) {
          return DecisionType.ESCALATE;
        }
        if (confidenceScore >= 0.85) {
          return DecisionType.EXECUTE;
        }
        return DecisionType.SUGGEST;
      }

      // Level 5: Fully autonomous
      if (autonomyLevel === AutonomyLevel.LEVEL_5_FULLY_AUTONOMOUS) {
        if (riskLevel === RiskLevel.CRITICAL && confidenceScore < 0.95) {
          return DecisionType.ESCALATE;
        }
        return DecisionType.EXECUTE;
      }

      return DecisionType.ASK;
    } catch (error) {
      logger.error('determine_decision_type_failed', { error, botId });
      return DecisionType.ASK; // Fail safe
    }
  }

  /**
   * Get decision count for a bot
   */
  private async getDecisionCount(botId: string): Promise<number> {
    const counts = await this.decisionTracker.getDecisionCounts(botId);
    return counts.total;
  }

  /**
   * Get autonomy level history for a bot
   */
  async getAutonomyHistory(
    botId: string,
    limit: number = 10
  ): Promise<
    Array<{
      level: AutonomyLevel;
      timestamp: Date;
      reason: string;
    }>
  > {
    try {
      const { data, error } = await this.supabase
        .from('bot_autonomy_levels')
        .select('current_level, created_at, progression_reason')
        .eq('bot_id', botId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (
        data?.map((record) => ({
          level: record.current_level as AutonomyLevel,
          timestamp: new Date(record.created_at),
          reason: record.progression_reason || 'Initial level',
        })) || []
      );
    } catch (error) {
      logger.error('get_autonomy_history_failed', { error, botId });
      throw new Error(`Failed to get autonomy history: ${error}`);
    }
  }

  /**
   * Initialize autonomy level for a new bot
   */
  async initializeBot(botId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('bot_autonomy_levels')
        .insert({
          bot_id: botId,
          current_level: AutonomyLevel.LEVEL_1_ASK_LEARN,
          previous_level: null,
          decision_count: 0,
          approval_rate: 0,
          progression_reason: 'Initial bot creation',
        });

      if (error) throw error;

      logger.info('bot_autonomy_initialized', {
        bot_id: botId,
        level: AutonomyLevel.LEVEL_1_ASK_LEARN,
      });
    } catch (error) {
      logger.error('initialize_bot_failed', { error, botId });
      throw new Error(`Failed to initialize bot autonomy: ${error}`);
    }
  }

  /**
   * Check if bot should be evaluated for auto-progression
   */
  async shouldEvaluateProgression(botId: string): Promise<boolean> {
    try {
      // Get last evaluation time
      const { data: lastLevel, error } = await this.supabase
        .from('bot_autonomy_levels')
        .select('created_at, current_level')
        .eq('bot_id', botId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !lastLevel) return true;

      // Don't evaluate if already at max level
      if (lastLevel.current_level === AutonomyLevel.LEVEL_5_FULLY_AUTONOMOUS) {
        return false;
      }

      // Evaluate if last check was more than 7 days ago
      const lastCheck = new Date(lastLevel.created_at);
      const daysSinceCheck =
        (Date.now() - lastCheck.getTime()) / (1000 * 60 * 60 * 24);

      return daysSinceCheck >= 7;
    } catch (error) {
      logger.error('should_evaluate_progression_failed', { error, botId });
      return false;
    }
  }
}

// Export singleton instance
export const autonomyManager = new AutonomyManager();
