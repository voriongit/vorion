/**
 * Policy Evaluator
 *
 * Evaluates policies against intents to determine control actions.
 *
 * @packageDocumentation
 */

import { createLogger } from '../common/logger.js';
import type { ControlAction } from '../common/types.js';
import type {
  Policy,
  PolicyRule,
  PolicyCondition,
  PolicyEvaluationContext,
  PolicyEvaluationResult,
  MultiPolicyEvaluationResult,
  RuleEvaluationResult,
  FieldCondition,
  CompoundCondition,
  TrustCondition,
  TimeCondition,
} from './types.js';

const logger = createLogger({ component: 'policy-evaluator' });

/**
 * Action priority (lower number = higher priority)
 */
const ACTION_PRIORITY: Record<ControlAction, number> = {
  deny: 0,
  terminate: 1,
  escalate: 2,
  limit: 3,
  monitor: 4,
  allow: 5,
};

/**
 * Policy Evaluator class
 */
export class PolicyEvaluator {
  /**
   * Evaluate multiple policies against a context
   */
  evaluateMultiple(
    policies: Policy[],
    context: PolicyEvaluationContext
  ): MultiPolicyEvaluationResult {
    const startTime = performance.now();
    const policiesEvaluated: PolicyEvaluationResult[] = [];
    let appliedPolicy: PolicyEvaluationResult | undefined;
    let finalAction: ControlAction = 'allow';
    let reason: string | undefined;

    // Filter policies that apply to this context
    const applicablePolicies = policies.filter((policy) =>
      this.policyApplies(policy, context)
    );

    logger.debug(
      {
        totalPolicies: policies.length,
        applicablePolicies: applicablePolicies.length,
        intentId: context.intent.id,
      },
      'Evaluating applicable policies'
    );

    // Evaluate each applicable policy
    for (const policy of applicablePolicies) {
      const result = this.evaluatePolicy(policy, context);
      policiesEvaluated.push(result);

      // Apply the most restrictive action
      if (ACTION_PRIORITY[result.action] < ACTION_PRIORITY[finalAction]) {
        finalAction = result.action;
        reason = result.reason;
        appliedPolicy = result;

        // Short-circuit on deny
        if (finalAction === 'deny') {
          logger.info(
            {
              policyId: policy.id,
              policyName: policy.name,
              intentId: context.intent.id,
              action: finalAction,
            },
            'Policy denied intent - short-circuiting'
          );
          break;
        }
      }
    }

    const totalDurationMs = performance.now() - startTime;

    logger.info(
      {
        intentId: context.intent.id,
        policiesEvaluated: policiesEvaluated.length,
        finalAction,
        durationMs: totalDurationMs,
      },
      'Multi-policy evaluation completed'
    );

    const result: MultiPolicyEvaluationResult = {
      passed: finalAction === 'allow',
      finalAction,
      policiesEvaluated,
      totalDurationMs,
      evaluatedAt: new Date().toISOString(),
    };
    if (reason !== undefined) {
      result.reason = reason;
    }
    if (appliedPolicy !== undefined) {
      result.appliedPolicy = appliedPolicy;
    }
    return result;
  }

  /**
   * Evaluate a single policy against a context
   */
  evaluatePolicy(
    policy: Policy,
    context: PolicyEvaluationContext
  ): PolicyEvaluationResult {
    const startTime = performance.now();
    const rulesEvaluated: RuleEvaluationResult[] = [];
    const matchedRules: RuleEvaluationResult[] = [];

    // Sort rules by priority (lower = higher priority)
    const sortedRules = [...policy.definition.rules]
      .filter((rule) => rule.enabled !== false)
      .sort((a, b) => a.priority - b.priority);

    // Start with default action; matched rules will override
    let action = policy.definition.defaultAction;
    let reason = policy.definition.defaultReason;
    let matched = false;
    // Track if any rule has set the action (vs still using default)
    let actionSetByRule = false;

    // Evaluate each rule
    for (const rule of sortedRules) {
      const ruleResult = this.evaluateRule(rule, context);
      rulesEvaluated.push(ruleResult);

      if (ruleResult.conditionsMet) {
        matchedRules.push(ruleResult);
        matched = true;

        // First matched rule sets the action, subsequent rules only override if more restrictive
        if (!actionSetByRule) {
          action = ruleResult.action;
          reason = ruleResult.reason;
          actionSetByRule = true;
        } else if (ACTION_PRIORITY[ruleResult.action] < ACTION_PRIORITY[action]) {
          action = ruleResult.action;
          reason = ruleResult.reason;
        }

        // Short-circuit on deny
        if (ruleResult.action === 'deny') {
          break;
        }
      }
    }

    const durationMs = performance.now() - startTime;

    const result: PolicyEvaluationResult = {
      policyId: policy.id,
      policyName: policy.name,
      policyVersion: policy.version,
      matched,
      action,
      rulesEvaluated,
      matchedRules,
      durationMs,
      evaluatedAt: new Date().toISOString(),
    };
    if (reason !== undefined) {
      result.reason = reason;
    }
    return result;
  }

  /**
   * Evaluate a single rule against a context
   */
  private evaluateRule(
    rule: PolicyRule,
    context: PolicyEvaluationContext
  ): RuleEvaluationResult {
    const startTime = performance.now();

    const conditionsMet = this.evaluateCondition(rule.when, context);
    const durationMs = performance.now() - startTime;

    const result: RuleEvaluationResult = {
      ruleId: rule.id,
      ruleName: rule.name,
      matched: conditionsMet,
      conditionsMet,
      action: conditionsMet ? rule.then.action : 'allow',
      durationMs,
    };
    if (conditionsMet && rule.then.reason !== undefined) {
      result.reason = rule.then.reason;
    }
    return result;
  }

  /**
   * Check if a policy applies to the given context
   */
  private policyApplies(policy: Policy, context: PolicyEvaluationContext): boolean {
    const target = policy.definition.target;
    if (!target) return true;

    // Check intent type
    if (target.intentTypes && target.intentTypes.length > 0) {
      const intentType = context.intent.intentType;
      if (
        intentType &&
        !target.intentTypes.includes(intentType) &&
        !target.intentTypes.includes('*')
      ) {
        return false;
      }
    }

    // Check entity type
    if (target.entityTypes && target.entityTypes.length > 0) {
      if (
        !target.entityTypes.includes(context.entity.type) &&
        !target.entityTypes.includes('*')
      ) {
        return false;
      }
    }

    // Check trust level
    if (target.trustLevels && target.trustLevels.length > 0) {
      if (!target.trustLevels.includes(context.entity.trustLevel)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Evaluate a condition against a context
   */
  private evaluateCondition(
    condition: PolicyCondition,
    context: PolicyEvaluationContext
  ): boolean {
    switch (condition.type) {
      case 'field':
        return this.evaluateFieldCondition(condition, context);
      case 'compound':
        return this.evaluateCompoundCondition(condition, context);
      case 'trust':
        return this.evaluateTrustCondition(condition, context);
      case 'time':
        return this.evaluateTimeCondition(condition, context);
      default:
        logger.warn({ condition }, 'Unknown condition type');
        return false;
    }
  }

  /**
   * Evaluate a field condition
   */
  private evaluateFieldCondition(
    condition: FieldCondition,
    context: PolicyEvaluationContext
  ): boolean {
    const fieldValue = this.resolveField(condition.field, context);
    const targetValue = condition.value;

    return this.compareValues(fieldValue, condition.operator, targetValue);
  }

  /**
   * Evaluate a compound condition (AND, OR, NOT)
   */
  private evaluateCompoundCondition(
    condition: CompoundCondition,
    context: PolicyEvaluationContext
  ): boolean {
    const { operator, conditions } = condition;

    switch (operator) {
      case 'and':
        return conditions.every((c) => this.evaluateCondition(c, context));
      case 'or':
        return conditions.some((c) => this.evaluateCondition(c, context));
      case 'not':
        // NOT applies to the first condition
        return conditions.length > 0 && !this.evaluateCondition(conditions[0]!, context);
      default:
        return false;
    }
  }

  /**
   * Evaluate a trust level condition
   */
  private evaluateTrustCondition(
    condition: TrustCondition,
    context: PolicyEvaluationContext
  ): boolean {
    const actualLevel = context.entity.trustLevel;
    const requiredLevel = condition.level;

    return this.compareValues(actualLevel, condition.operator, requiredLevel);
  }

  /**
   * Evaluate a time-based condition
   */
  private evaluateTimeCondition(
    condition: TimeCondition,
    context: PolicyEvaluationContext
  ): boolean {
    const timezone = condition.timezone ?? context.environment.timezone ?? 'UTC';
    const now = new Date(context.environment.timestamp);

    let fieldValue: number | string;

    switch (condition.field) {
      case 'hour':
        // Get hour in the specified timezone
        fieldValue = parseInt(
          now.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: timezone })
        );
        break;
      case 'dayOfWeek':
        // 0 = Sunday, 6 = Saturday
        // Use Intl.DateTimeFormat to get the day of week in the specified timezone
        fieldValue = new Date(
          now.toLocaleString('en-US', { timeZone: timezone })
        ).getDay();
        break;
      case 'date':
        fieldValue = now.toISOString().split('T')[0]!;
        break;
      default:
        return false;
    }

    return this.compareValues(fieldValue, condition.operator, condition.value);
  }

  /**
   * Resolve a field path to its value in the context
   */
  private resolveField(field: string, context: PolicyEvaluationContext): unknown {
    const parts = field.split('.');
    let current: unknown = context;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  /**
   * Compare two values using an operator
   */
  private compareValues(
    fieldValue: unknown,
    operator: string,
    targetValue: unknown
  ): boolean {
    switch (operator) {
      case 'equals':
        return fieldValue === targetValue;

      case 'not_equals':
        return fieldValue !== targetValue;

      case 'greater_than':
        return (
          typeof fieldValue === 'number' &&
          typeof targetValue === 'number' &&
          fieldValue > targetValue
        );

      case 'less_than':
        return (
          typeof fieldValue === 'number' &&
          typeof targetValue === 'number' &&
          fieldValue < targetValue
        );

      case 'greater_than_or_equal':
        return (
          typeof fieldValue === 'number' &&
          typeof targetValue === 'number' &&
          fieldValue >= targetValue
        );

      case 'less_than_or_equal':
        return (
          typeof fieldValue === 'number' &&
          typeof targetValue === 'number' &&
          fieldValue <= targetValue
        );

      case 'in':
        return Array.isArray(targetValue) && targetValue.includes(fieldValue);

      case 'not_in':
        return Array.isArray(targetValue) && !targetValue.includes(fieldValue);

      case 'contains':
        return (
          typeof fieldValue === 'string' &&
          typeof targetValue === 'string' &&
          fieldValue.includes(targetValue)
        );

      case 'not_contains':
        return (
          typeof fieldValue === 'string' &&
          typeof targetValue === 'string' &&
          !fieldValue.includes(targetValue)
        );

      case 'starts_with':
        return (
          typeof fieldValue === 'string' &&
          typeof targetValue === 'string' &&
          fieldValue.startsWith(targetValue)
        );

      case 'ends_with':
        return (
          typeof fieldValue === 'string' &&
          typeof targetValue === 'string' &&
          fieldValue.endsWith(targetValue)
        );

      case 'matches':
        try {
          return (
            typeof fieldValue === 'string' &&
            typeof targetValue === 'string' &&
            new RegExp(targetValue).test(fieldValue)
          );
        } catch {
          logger.warn({ pattern: targetValue }, 'Invalid regex pattern');
          return false;
        }

      case 'exists':
        return fieldValue !== undefined && fieldValue !== null;

      case 'not_exists':
        return fieldValue === undefined || fieldValue === null;

      default:
        logger.warn({ operator }, 'Unknown operator');
        return false;
    }
  }
}

/**
 * Create a new policy evaluator instance
 */
export function createPolicyEvaluator(): PolicyEvaluator {
  return new PolicyEvaluator();
}
