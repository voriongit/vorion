/**
 * BASIS Rule Evaluator
 *
 * Core evaluation engine for processing constraints against intents.
 */

import { createLogger } from '../common/logger.js';
import type {
  Rule,
  RuleNamespace,
  EvaluationContext,
  EvaluationResult,
  RuleResult,
} from './types.js';
import type { ControlAction } from '../common/types.js';

const logger = createLogger({ component: 'basis-evaluator' });

/**
 * Rule evaluator class
 */
export class RuleEvaluator {
  private namespaces: Map<string, RuleNamespace> = new Map();

  /**
   * Register a rule namespace
   */
  registerNamespace(namespace: RuleNamespace): void {
    this.namespaces.set(namespace.name, namespace);
    logger.info({ namespace: namespace.name }, 'Namespace registered');
  }

  /**
   * Unregister a rule namespace
   */
  unregisterNamespace(name: string): void {
    this.namespaces.delete(name);
    logger.info({ namespace: name }, 'Namespace unregistered');
  }

  /**
   * Evaluate all applicable rules against the context
   */
  async evaluate(context: EvaluationContext): Promise<EvaluationResult> {
    const startTime = performance.now();
    const rulesEvaluated: RuleResult[] = [];
    const violatedRules: RuleResult[] = [];

    // Collect all applicable rules
    const applicableRules = this.getApplicableRules(context);

    // Sort by priority (lower number = higher priority)
    applicableRules.sort((a, b) => a.priority - b.priority);

    // Evaluate each rule
    for (const rule of applicableRules) {
      const result = await this.evaluateRule(rule, context);
      rulesEvaluated.push(result);

      if (!result.matched || result.action === 'deny') {
        violatedRules.push(result);
      }

      // Stop on first deny
      if (result.action === 'deny') {
        break;
      }
    }

    const totalDurationMs = performance.now() - startTime;

    // Determine final action
    const finalAction = this.determineFinalAction(rulesEvaluated);
    const passed = finalAction === 'allow';

    logger.info(
      {
        intentId: context.intent.id,
        rulesEvaluated: rulesEvaluated.length,
        violations: violatedRules.length,
        finalAction,
        durationMs: totalDurationMs,
      },
      'Evaluation completed'
    );

    return {
      passed,
      finalAction,
      rulesEvaluated,
      violatedRules,
      totalDurationMs,
      evaluatedAt: new Date().toISOString(),
    };
  }

  /**
   * Get rules that apply to the given context
   */
  private getApplicableRules(context: EvaluationContext): Rule[] {
    const applicable: Rule[] = [];

    for (const namespace of this.namespaces.values()) {
      for (const rule of namespace.rules) {
        if (!rule.enabled) continue;
        if (this.ruleMatches(rule, context)) {
          applicable.push(rule);
        }
      }
    }

    return applicable;
  }

  /**
   * Check if a rule's conditions match the context
   */
  private ruleMatches(rule: Rule, context: EvaluationContext): boolean {
    const { when } = rule;

    // Check intent type
    if (when.intentType) {
      const types = Array.isArray(when.intentType)
        ? when.intentType
        : [when.intentType];
      if (!types.includes(context.intent.type) && !types.includes('*')) {
        return false;
      }
    }

    // Check entity type
    if (when.entityType) {
      const types = Array.isArray(when.entityType)
        ? when.entityType
        : [when.entityType];
      if (!types.includes(context.entity.type) && !types.includes('*')) {
        return false;
      }
    }

    // Check additional conditions
    if (when.conditions) {
      for (const condition of when.conditions) {
        if (!this.evaluateCondition(condition, context)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Evaluate a single condition expression
   */
  private evaluateCondition(
    condition: { field: string; operator: string; value: unknown },
    context: EvaluationContext
  ): boolean {
    const fieldValue = this.resolveField(condition.field, context);
    const targetValue = condition.value;

    switch (condition.operator) {
      case 'equals':
        return fieldValue === targetValue;
      case 'not_equals':
        return fieldValue !== targetValue;
      case 'greater_than':
        return (fieldValue as number) > (targetValue as number);
      case 'less_than':
        return (fieldValue as number) < (targetValue as number);
      case 'greater_than_or_equal':
        return (fieldValue as number) >= (targetValue as number);
      case 'less_than_or_equal':
        return (fieldValue as number) <= (targetValue as number);
      case 'in':
        return (targetValue as unknown[]).includes(fieldValue);
      case 'not_in':
        return !(targetValue as unknown[]).includes(fieldValue);
      case 'contains':
        return String(fieldValue).includes(String(targetValue));
      case 'exists':
        return fieldValue !== undefined && fieldValue !== null;
      case 'not_exists':
        return fieldValue === undefined || fieldValue === null;
      default:
        logger.warn({ operator: condition.operator }, 'Unknown operator');
        return false;
    }
  }

  /**
   * Resolve a field path to its value in the context
   */
  private resolveField(field: string, context: EvaluationContext): unknown {
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
   * Evaluate a single rule against the context
   */
  private async evaluateRule(
    rule: Rule,
    context: EvaluationContext
  ): Promise<RuleResult> {
    const startTime = performance.now();
    let action: ControlAction = 'allow';
    let reason = 'No conditions matched';

    // Evaluate each evaluation step
    for (const evaluation of rule.evaluate) {
      // TODO: Implement expression evaluation
      // For now, use simple condition matching
      const conditionMet = this.evaluateExpression(evaluation.condition, context);

      if (conditionMet) {
        action = evaluation.result;
        reason = evaluation.reason ?? `Condition matched: ${evaluation.condition}`;
        break;
      }
    }

    const durationMs = performance.now() - startTime;

    return {
      ruleId: rule.id,
      ruleName: rule.name,
      matched: action !== 'deny',
      action,
      reason,
      details: {
        priority: rule.priority,
        evaluationsChecked: rule.evaluate.length,
      },
      durationMs,
    };
  }

  /**
   * Evaluate a condition expression string
   */
  private evaluateExpression(
    expression: string,
    _context: EvaluationContext
  ): boolean {
    // Simple implementation - expand as needed
    // Supports: "true", "false", field comparisons
    if (expression === 'true') return true;
    if (expression === 'false') return false;

    // TODO: Implement full expression parser
    // For now, return true to allow
    return true;
  }

  /**
   * Determine the final action from all rule results
   */
  private determineFinalAction(results: RuleResult[]): ControlAction {
    // Priority: deny > escalate > limit > monitor > allow
    const priorities: Record<ControlAction, number> = {
      deny: 0,
      terminate: 1,
      escalate: 2,
      limit: 3,
      monitor: 4,
      allow: 5,
    };

    let finalAction: ControlAction = 'allow';
    let lowestPriority = priorities['allow'];

    for (const result of results) {
      const priority = priorities[result.action];
      if (priority < lowestPriority) {
        finalAction = result.action;
        lowestPriority = priority;
      }
    }

    return finalAction;
  }
}

/**
 * Create a new rule evaluator instance
 */
export function createEvaluator(): RuleEvaluator {
  return new RuleEvaluator();
}
