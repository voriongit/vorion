/**
 * Rule Evaluator
 *
 * Evaluates rules against intent context with support for multiple operators.
 *
 * @packageDocumentation
 */

import { createLogger } from '../common/logger.js';
import { withSpan, type TraceSpan } from '../common/trace.js';
import type { Intent } from '../common/types.js';
import type {
  Rule,
  RuleGroup,
  RuleOperator,
  Policy,
  PolicyEffect,
} from './policy.js';

const logger = createLogger({ component: 'rule-evaluator' });

// =============================================================================
// RULE MATCH RESULT
// =============================================================================

/**
 * Result of evaluating a single rule
 */
export interface RuleMatchResult {
  /** The rule that was evaluated */
  rule: Rule;
  /** Whether the rule matched */
  matched: boolean;
  /** Actual field value that was evaluated */
  actualValue: unknown;
  /** Expected value from the rule */
  expectedValue: unknown;
  /** Evaluation duration in milliseconds */
  durationMs: number;
  /** Error message if evaluation failed */
  error?: string;
}

/**
 * Result of evaluating a rule group
 */
export interface RuleGroupResult {
  /** The rule group that was evaluated */
  ruleGroup: RuleGroup;
  /** Whether the group matched */
  matched: boolean;
  /** Individual rule results */
  ruleResults: RuleMatchResult[];
  /** Total evaluation duration */
  durationMs: number;
}

/**
 * Result of evaluating a policy
 */
export interface PolicyMatchResult {
  /** The policy that was evaluated */
  policy: Policy;
  /** Whether the policy matched */
  matched: boolean;
  /** The effect of the policy */
  effect: PolicyEffect;
  /** Rule group evaluation result */
  ruleGroupResult: RuleGroupResult;
  /** Evaluation duration */
  durationMs: number;
}

// =============================================================================
// EVALUATION CONTEXT
// =============================================================================

/**
 * Context for rule evaluation
 */
export interface EvaluationContext {
  /** The intent being evaluated */
  intent: Intent;
  /** Additional context data */
  context?: Record<string, unknown>;
  /** Environment data */
  environment?: {
    timestamp?: string;
    timezone?: string;
  };
}

// =============================================================================
// RULE EVALUATOR
// =============================================================================

/**
 * RuleEvaluator class for evaluating rules against intent context
 */
export class RuleEvaluator {
  /**
   * Evaluate a single rule against the context
   */
  evaluateRule(rule: Rule, context: EvaluationContext): RuleMatchResult {
    const startTime = performance.now();

    try {
      const actualValue = this.resolveFieldPath(rule.field, context);
      const matched = this.compareValues(actualValue, rule.operator, rule.value);

      const durationMs = performance.now() - startTime;

      logger.debug({
        field: rule.field,
        operator: rule.operator,
        actualValue,
        expectedValue: rule.value,
        matched,
        durationMs,
      }, 'Rule evaluated');

      return {
        rule,
        matched,
        actualValue,
        expectedValue: rule.value,
        durationMs,
      };
    } catch (error) {
      const durationMs = performance.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.warn({
        field: rule.field,
        operator: rule.operator,
        error: errorMessage,
      }, 'Rule evaluation failed');

      return {
        rule,
        matched: false,
        actualValue: undefined,
        expectedValue: rule.value,
        durationMs,
        error: errorMessage,
      };
    }
  }

  /**
   * Evaluate a rule group with AND/OR logic
   */
  evaluateRuleGroup(ruleGroup: RuleGroup, context: EvaluationContext): RuleGroupResult {
    const startTime = performance.now();
    const ruleResults: RuleMatchResult[] = [];

    for (const rule of ruleGroup.rules) {
      const result = this.evaluateRule(rule, context);
      ruleResults.push(result);

      // Short-circuit evaluation
      if (ruleGroup.logic === 'AND' && !result.matched) {
        // For AND, if any rule fails, the group fails
        break;
      }
      if (ruleGroup.logic === 'OR' && result.matched) {
        // For OR, if any rule matches, the group matches
        break;
      }
    }

    const matched = ruleGroup.logic === 'AND'
      ? ruleResults.every(r => r.matched)
      : ruleResults.some(r => r.matched);

    const durationMs = performance.now() - startTime;

    logger.debug({
      logic: ruleGroup.logic,
      rulesCount: ruleGroup.rules.length,
      matched,
      durationMs,
    }, 'Rule group evaluated');

    return {
      ruleGroup,
      matched,
      ruleResults,
      durationMs,
    };
  }

  /**
   * Evaluate a policy against the context
   */
  evaluatePolicy(policy: Policy, context: EvaluationContext): PolicyMatchResult {
    const startTime = performance.now();

    // Check if policy is enabled
    if (!policy.enabled) {
      return {
        policy,
        matched: false,
        effect: policy.effect,
        ruleGroupResult: {
          ruleGroup: policy.rules,
          matched: false,
          ruleResults: [],
          durationMs: 0,
        },
        durationMs: 0,
      };
    }

    // Check policy conditions first
    if (!this.checkPolicyConditions(policy, context)) {
      return {
        policy,
        matched: false,
        effect: policy.effect,
        ruleGroupResult: {
          ruleGroup: policy.rules,
          matched: false,
          ruleResults: [],
          durationMs: 0,
        },
        durationMs: performance.now() - startTime,
      };
    }

    // Evaluate rule group
    const ruleGroupResult = this.evaluateRuleGroup(policy.rules, context);
    const durationMs = performance.now() - startTime;

    logger.debug({
      policyId: policy.id,
      policyName: policy.name,
      matched: ruleGroupResult.matched,
      effect: policy.effect,
      durationMs,
    }, 'Policy evaluated');

    return {
      policy,
      matched: ruleGroupResult.matched,
      effect: policy.effect,
      ruleGroupResult,
      durationMs,
    };
  }

  /**
   * Evaluate a policy with tracing
   */
  async evaluatePolicyWithTracing(
    policy: Policy,
    context: EvaluationContext
  ): Promise<PolicyMatchResult> {
    return withSpan(
      'governance.evaluatePolicy',
      async (span: TraceSpan) => {
        span.attributes['policy.id'] = policy.id;
        span.attributes['policy.name'] = policy.name;
        span.attributes['policy.priority'] = policy.priority;

        const result = this.evaluatePolicy(policy, context);

        span.attributes['policy.matched'] = result.matched;
        span.attributes['policy.effect'] = result.effect;
        span.attributes['policy.durationMs'] = result.durationMs;

        return result;
      },
      { 'intent.id': context.intent.id }
    );
  }

  /**
   * Check if policy conditions match the context
   */
  private checkPolicyConditions(policy: Policy, context: EvaluationContext): boolean {
    if (!policy.conditions) return true;

    const { actions, resources, intentTypes, entityTypes } = policy.conditions;
    const intent = context.intent;

    // Check action/goal match
    if (actions && actions.length > 0) {
      const goal = intent.goal;
      const matches = actions.some(a =>
        a === '*' || a === goal || (a.endsWith('*') && goal.startsWith(a.slice(0, -1)))
      );
      if (!matches) return false;
    }

    // Check resource match (from context)
    if (resources && resources.length > 0) {
      const resource = (intent.context as Record<string, unknown>)?.resource as string | undefined;
      if (!resource) return false;
      const matches = resources.some(r =>
        r === '*' || r === resource || (r.endsWith('*') && resource.startsWith(r.slice(0, -1)))
      );
      if (!matches) return false;
    }

    // Check intent type match
    if (intentTypes && intentTypes.length > 0) {
      const intentType = intent.intentType;
      if (!intentType) return false;
      const matches = intentTypes.some(t =>
        t === '*' || t === intentType || (t.endsWith('*') && intentType.startsWith(t.slice(0, -1)))
      );
      if (!matches) return false;
    }

    return true;
  }

  /**
   * Resolve a field path from the evaluation context
   */
  private resolveFieldPath(path: string, context: EvaluationContext): unknown {
    const parts = path.split('.');
    let current: unknown = context;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (typeof current !== 'object') {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  /**
   * Compare values using the specified operator
   */
  private compareValues(actual: unknown, operator: RuleOperator, expected: unknown): boolean {
    switch (operator) {
      case 'eq':
        return actual === expected;

      case 'ne':
        return actual !== expected;

      case 'gt':
        return typeof actual === 'number' &&
               typeof expected === 'number' &&
               actual > expected;

      case 'lt':
        return typeof actual === 'number' &&
               typeof expected === 'number' &&
               actual < expected;

      case 'gte':
        return typeof actual === 'number' &&
               typeof expected === 'number' &&
               actual >= expected;

      case 'lte':
        return typeof actual === 'number' &&
               typeof expected === 'number' &&
               actual <= expected;

      case 'in':
        if (!Array.isArray(expected)) {
          logger.warn({ operator, expected }, 'Invalid "in" operator: expected array');
          return false;
        }
        return expected.includes(actual);

      case 'contains':
        if (typeof actual !== 'string' || typeof expected !== 'string') {
          return false;
        }
        return actual.includes(expected);

      case 'matches':
        if (typeof actual !== 'string' || typeof expected !== 'string') {
          return false;
        }
        try {
          const regex = new RegExp(expected);
          return regex.test(actual);
        } catch (error) {
          logger.warn({ pattern: expected, error }, 'Invalid regex pattern');
          return false;
        }

      default:
        logger.warn({ operator }, 'Unknown operator');
        return false;
    }
  }
}

/**
 * Create a new rule evaluator instance
 */
export function createRuleEvaluator(): RuleEvaluator {
  return new RuleEvaluator();
}
