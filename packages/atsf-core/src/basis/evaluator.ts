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
   * Supports: boolean literals, field comparisons, logical operators (AND, OR, NOT)
   * Examples:
   *   - "true", "false"
   *   - "entity.trustScore > 300"
   *   - "intent.context.amount <= 1000"
   *   - "entity.type == 'agent' AND entity.trustScore >= 500"
   *   - "NOT intent.context.restricted"
   */
  private evaluateExpression(
    expression: string,
    context: EvaluationContext
  ): boolean {
    const trimmed = expression.trim();

    // Handle boolean literals
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;

    // Tokenize
    const tokens = this.tokenize(trimmed);
    if (tokens.length === 0) {
      logger.warn({ expression }, 'Empty expression');
      return true;
    }

    // Parse and evaluate
    try {
      const result = this.parseOrExpression(tokens, context);
      return result.value;
    } catch (error) {
      logger.error({ expression, error }, 'Expression evaluation failed');
      return false;
    }
  }

  /**
   * Tokenize expression string
   */
  private tokenize(expr: string): string[] {
    const tokens: string[] = [];
    let i = 0;

    while (i < expr.length) {
      // Skip whitespace
      if (/\s/.test(expr[i]!)) {
        i++;
        continue;
      }

      // String literals
      if (expr[i] === "'" || expr[i] === '"') {
        const quote = expr[i];
        let str = '';
        i++; // Skip opening quote
        while (i < expr.length && expr[i] !== quote) {
          str += expr[i];
          i++;
        }
        i++; // Skip closing quote
        tokens.push(`'${str}'`);
        continue;
      }

      // Multi-char operators
      const twoChar = expr.substring(i, i + 2);
      if (['==', '!=', '>=', '<=', '&&', '||'].includes(twoChar)) {
        tokens.push(twoChar);
        i += 2;
        continue;
      }

      // Single-char operators and parens
      if (['>', '<', '(', ')', '!'].includes(expr[i]!)) {
        tokens.push(expr[i]!);
        i++;
        continue;
      }

      // Words (identifiers, keywords, numbers)
      let word = '';
      while (i < expr.length && /[a-zA-Z0-9_.]/.test(expr[i]!)) {
        word += expr[i];
        i++;
      }
      if (word) {
        tokens.push(word);
      }
    }

    return tokens;
  }

  /**
   * Parse OR expression (lowest precedence)
   */
  private parseOrExpression(
    tokens: string[],
    context: EvaluationContext,
    pos: { index: number } = { index: 0 }
  ): { value: boolean; pos: number } {
    let left = this.parseAndExpression(tokens, context, pos);

    while (pos.index < tokens.length) {
      const token = tokens[pos.index];
      if (token === 'OR' || token === '||') {
        pos.index++;
        const right = this.parseAndExpression(tokens, context, pos);
        left = { value: left.value || right.value, pos: pos.index };
      } else {
        break;
      }
    }

    return left;
  }

  /**
   * Parse AND expression
   */
  private parseAndExpression(
    tokens: string[],
    context: EvaluationContext,
    pos: { index: number }
  ): { value: boolean; pos: number } {
    let left = this.parseNotExpression(tokens, context, pos);

    while (pos.index < tokens.length) {
      const token = tokens[pos.index];
      if (token === 'AND' || token === '&&') {
        pos.index++;
        const right = this.parseNotExpression(tokens, context, pos);
        left = { value: left.value && right.value, pos: pos.index };
      } else {
        break;
      }
    }

    return left;
  }

  /**
   * Parse NOT expression
   */
  private parseNotExpression(
    tokens: string[],
    context: EvaluationContext,
    pos: { index: number }
  ): { value: boolean; pos: number } {
    if (tokens[pos.index] === 'NOT' || tokens[pos.index] === '!') {
      pos.index++;
      const inner = this.parseNotExpression(tokens, context, pos);
      return { value: !inner.value, pos: pos.index };
    }

    return this.parseComparison(tokens, context, pos);
  }

  /**
   * Parse comparison expression
   */
  private parseComparison(
    tokens: string[],
    context: EvaluationContext,
    pos: { index: number }
  ): { value: boolean; pos: number } {
    // Handle parentheses
    if (tokens[pos.index] === '(') {
      pos.index++;
      const inner = this.parseOrExpression(tokens, context, pos);
      if (tokens[pos.index] === ')') {
        pos.index++;
      }
      return inner;
    }

    // Get left operand
    const left = this.parseValue(tokens, context, pos);

    // Check for comparison operator
    const op = tokens[pos.index];
    if (!op || !['==', '!=', '>', '<', '>=', '<=', 'in', 'contains'].includes(op)) {
      // Truthiness check
      return { value: Boolean(left), pos: pos.index };
    }

    pos.index++;
    const right = this.parseValue(tokens, context, pos);

    // Evaluate comparison
    let result: boolean;
    switch (op) {
      case '==':
        result = left === right;
        break;
      case '!=':
        result = left !== right;
        break;
      case '>':
        result = (left as number) > (right as number);
        break;
      case '<':
        result = (left as number) < (right as number);
        break;
      case '>=':
        result = (left as number) >= (right as number);
        break;
      case '<=':
        result = (left as number) <= (right as number);
        break;
      case 'in':
        result = Array.isArray(right) && right.includes(left);
        break;
      case 'contains':
        result = String(left).includes(String(right));
        break;
      default:
        result = false;
    }

    return { value: result, pos: pos.index };
  }

  /**
   * Parse a value (field path, literal, or number)
   */
  private parseValue(
    tokens: string[],
    context: EvaluationContext,
    pos: { index: number }
  ): unknown {
    const token = tokens[pos.index];
    if (!token) return undefined;

    pos.index++;

    // String literal
    if (token.startsWith("'") && token.endsWith("'")) {
      return token.slice(1, -1);
    }

    // Boolean literal
    if (token === 'true') return true;
    if (token === 'false') return false;
    if (token === 'null') return null;

    // Number literal
    if (/^-?\d+(\.\d+)?$/.test(token)) {
      return parseFloat(token);
    }

    // Field path (e.g., entity.trustScore, intent.context.amount)
    return this.resolveField(token, context);
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
