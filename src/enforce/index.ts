/**
 * ENFORCE - Policy Decision Point
 *
 * Makes enforcement decisions based on rule evaluations and trust levels.
 *
 * @packageDocumentation
 */

import { createLogger } from '../common/logger.js';
import type {
  Intent,
  Decision,
  ControlAction,
  TrustLevel,
  TrustScore,
  ID,
} from '../common/types.js';
import type { EvaluationResult, RuleResult } from '../basis/types.js';

const logger = createLogger({ component: 'enforce' });

/**
 * Enforcement context combining intent and evaluation results
 */
export interface EnforcementContext {
  intent: Intent;
  evaluation: EvaluationResult;
  trustScore: TrustScore;
  trustLevel: TrustLevel;
}

/**
 * Enforcement policy configuration
 */
export interface EnforcementPolicy {
  defaultAction: ControlAction;
  requireMinTrustLevel?: TrustLevel;
  escalationRules?: EscalationRule[];
}

/**
 * Escalation rule definition
 */
export interface EscalationRule {
  condition: string;
  escalateTo: string;
  timeout: string;
}

/**
 * Policy enforcement service
 */
export class EnforcementService {
  private policy: EnforcementPolicy;

  constructor(policy?: EnforcementPolicy) {
    this.policy = policy ?? { defaultAction: 'deny' };
  }

  /**
   * Make an enforcement decision
   */
  async decide(context: EnforcementContext): Promise<Decision> {
    const { intent, evaluation, trustScore, trustLevel } = context;

    // Check minimum trust level
    if (
      this.policy.requireMinTrustLevel !== undefined &&
      trustLevel < this.policy.requireMinTrustLevel
    ) {
      logger.info(
        {
          intentId: intent.id,
          required: this.policy.requireMinTrustLevel,
          actual: trustLevel,
        },
        'Trust level insufficient'
      );

      return this.createDecision(
        intent.id,
        'deny',
        evaluation.rulesEvaluated,
        trustScore,
        trustLevel
      );
    }

    // Use evaluation result action
    const action = evaluation.passed ? 'allow' : evaluation.finalAction;

    logger.info(
      {
        intentId: intent.id,
        action,
        rulesEvaluated: evaluation.rulesEvaluated.length,
      },
      'Enforcement decision made'
    );

    return this.createDecision(
      intent.id,
      action,
      evaluation.rulesEvaluated,
      trustScore,
      trustLevel
    );
  }

  /**
   * Create a decision record
   */
  private createDecision(
    intentId: ID,
    action: ControlAction,
    rulesEvaluated: RuleResult[],
    trustScore: TrustScore,
    trustLevel: TrustLevel
  ): Decision {
    return {
      intentId,
      action,
      constraintsEvaluated: rulesEvaluated.map((r) => ({
        constraintId: r.ruleId,
        passed: r.matched,
        action: r.action,
        reason: r.reason,
        details: r.details,
        durationMs: r.durationMs,
        evaluatedAt: new Date().toISOString(),
      })),
      trustScore,
      trustLevel,
      decidedAt: new Date().toISOString(),
    };
  }

  /**
   * Update enforcement policy
   */
  setPolicy(policy: EnforcementPolicy): void {
    this.policy = policy;
    logger.info({ policy }, 'Enforcement policy updated');
  }
}

/**
 * Create a new enforcement service instance
 */
export function createEnforcementService(
  policy?: EnforcementPolicy
): EnforcementService {
  return new EnforcementService(policy);
}
