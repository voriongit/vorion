/**
 * Expression Evaluator for Vorion DSL
 *
 * Evaluates AST nodes against a context object to produce boolean results.
 *
 * Features:
 * - Dotted identifier resolution (intent.action -> context.intent.action)
 * - Type coercion for comparisons
 * - Null-safe evaluation
 * - LIKE pattern matching with wildcards
 *
 * @packageDocumentation
 */

import {
  ASTNode,
  BinaryExpressionNode,
  UnaryExpressionNode,
  ComparisonExpressionNode,
  InExpressionNode,
  LikeExpressionNode,
  IdentifierNode,
  LiteralNode,
  ArrayExpressionNode,
  LiteralValue,
} from './parser.js';

/**
 * Context type for evaluation
 */
export type EvaluationContext = Record<string, unknown>;

/**
 * Error thrown during evaluation
 */
export class EvaluatorError extends Error {
  constructor(
    message: string,
    public node: ASTNode,
    public context?: EvaluationContext
  ) {
    super(`Evaluation error: ${message}`);
    this.name = 'EvaluatorError';
  }
}

/**
 * Resolve a dotted path in the context object
 *
 * @param path - Dotted path (e.g., "intent.action")
 * @param context - Context object to resolve against
 * @returns The resolved value or undefined if not found
 *
 * @example
 * ```ts
 * const context = { intent: { action: 'read' } };
 * resolvePath('intent.action', context); // 'read'
 * resolvePath('intent.missing', context); // undefined
 * ```
 */
export function resolvePath(path: string, context: EvaluationContext): unknown {
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
 * Convert a value to a comparable primitive for comparison operations
 */
function toComparable(value: unknown): LiteralValue {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  // Convert objects to string representation for comparison
  return String(value);
}

/**
 * Compare two values with type coercion
 *
 * @param left - Left operand
 * @param right - Right operand
 * @param operator - Comparison operator
 * @returns Boolean result of comparison
 */
function compare(
  left: unknown,
  right: unknown,
  operator: ComparisonExpressionNode['operator']
): boolean {
  const leftValue = toComparable(left);
  const rightValue = toComparable(right);

  // Null handling
  if (leftValue === null || rightValue === null) {
    switch (operator) {
      case '==':
        return leftValue === rightValue;
      case '!=':
        return leftValue !== rightValue;
      default:
        // For other operators, null comparisons always return false
        return false;
    }
  }

  // Type coercion for numeric comparisons
  if (typeof leftValue === 'number' || typeof rightValue === 'number') {
    const leftNum = Number(leftValue);
    const rightNum = Number(rightValue);

    // If conversion fails, fall through to string comparison
    if (!isNaN(leftNum) && !isNaN(rightNum)) {
      switch (operator) {
        case '==':
          return leftNum === rightNum;
        case '!=':
          return leftNum !== rightNum;
        case '>':
          return leftNum > rightNum;
        case '<':
          return leftNum < rightNum;
        case '>=':
          return leftNum >= rightNum;
        case '<=':
          return leftNum <= rightNum;
      }
    }
  }

  // String comparison (also handles booleans via string conversion)
  const leftStr = String(leftValue);
  const rightStr = String(rightValue);

  switch (operator) {
    case '==':
      return leftStr === rightStr;
    case '!=':
      return leftStr !== rightStr;
    case '>':
      return leftStr > rightStr;
    case '<':
      return leftStr < rightStr;
    case '>=':
      return leftStr >= rightStr;
    case '<=':
      return leftStr <= rightStr;
  }
}

/**
 * Check if a value is in an array
 *
 * @param value - Value to check
 * @param array - Array to check against
 * @returns true if value is in array
 */
function checkIn(value: unknown, array: unknown[]): boolean {
  const comparableValue = toComparable(value);

  for (const element of array) {
    const comparableElement = toComparable(element);

    // Handle null comparison
    if (comparableValue === null && comparableElement === null) {
      return true;
    }

    // String comparison for other values
    if (comparableValue !== null && comparableElement !== null) {
      if (String(comparableValue) === String(comparableElement)) {
        return true;
      }

      // Also try numeric comparison
      const numValue = Number(comparableValue);
      const numElement = Number(comparableElement);
      if (!isNaN(numValue) && !isNaN(numElement) && numValue === numElement) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if a value matches a LIKE pattern
 *
 * Supports wildcards:
 * - % matches any sequence of characters (including empty)
 * - _ matches any single character
 *
 * @param value - Value to check
 * @param pattern - Pattern to match against
 * @returns true if value matches pattern
 */
function checkLike(value: unknown, pattern: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  const valueStr = String(value);
  const patternStr = String(pattern);

  // Escape regex special characters except % and _
  let regexPattern = patternStr
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/%/g, '.*')
    .replace(/_/g, '.');

  // Anchor the pattern
  regexPattern = `^${regexPattern}$`;

  try {
    const regex = new RegExp(regexPattern, 'i');
    return regex.test(valueStr);
  } catch {
    // Invalid regex, fall back to exact match
    return valueStr.toLowerCase() === patternStr.toLowerCase();
  }
}

/**
 * Evaluate a literal node
 */
function evaluateLiteral(node: LiteralNode): LiteralValue {
  return node.value;
}

/**
 * Evaluate an identifier node
 */
function evaluateIdentifier(node: IdentifierNode, context: EvaluationContext): unknown {
  return resolvePath(node.name, context);
}

/**
 * Evaluate an array expression node
 */
function evaluateArray(node: ArrayExpressionNode, context: EvaluationContext): unknown[] {
  return node.elements.map((element) => evaluateNode(element, context));
}

/**
 * Evaluate a comparison expression node
 */
function evaluateComparison(
  node: ComparisonExpressionNode,
  context: EvaluationContext
): boolean {
  const left = evaluateNode(node.left, context);
  const right = evaluateNode(node.right, context);
  return compare(left, right, node.operator);
}

/**
 * Evaluate an IN expression node
 */
function evaluateIn(node: InExpressionNode, context: EvaluationContext): boolean {
  const value = evaluateNode(node.value, context);
  const array = evaluateArray(node.array, context);
  return checkIn(value, array);
}

/**
 * Evaluate a LIKE expression node
 */
function evaluateLike(node: LikeExpressionNode, context: EvaluationContext): boolean {
  const value = evaluateNode(node.value, context);
  const pattern = evaluateNode(node.pattern, context);
  return checkLike(value, pattern);
}

/**
 * Evaluate a binary expression node (AND, OR)
 */
function evaluateBinary(node: BinaryExpressionNode, context: EvaluationContext): boolean {
  const left = evaluateNode(node.left, context);

  // Short-circuit evaluation
  if (node.operator === 'AND') {
    if (!toBool(left)) {
      return false;
    }
    return toBool(evaluateNode(node.right, context));
  }

  // OR
  if (toBool(left)) {
    return true;
  }
  return toBool(evaluateNode(node.right, context));
}

/**
 * Evaluate a unary expression node (NOT)
 */
function evaluateUnary(node: UnaryExpressionNode, context: EvaluationContext): boolean {
  const operand = evaluateNode(node.operand, context);
  return !toBool(operand);
}

/**
 * Convert a value to boolean
 */
function toBool(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    return value.length > 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return true;
}

/**
 * Evaluate an AST node
 */
function evaluateNode(node: ASTNode, context: EvaluationContext): unknown {
  switch (node.type) {
    case 'Literal':
      return evaluateLiteral(node);

    case 'Identifier':
      return evaluateIdentifier(node, context);

    case 'ArrayExpression':
      return evaluateArray(node, context);

    case 'ComparisonExpression':
      return evaluateComparison(node, context);

    case 'InExpression':
      return evaluateIn(node, context);

    case 'LikeExpression':
      return evaluateLike(node, context);

    case 'BinaryExpression':
      return evaluateBinary(node, context);

    case 'UnaryExpression':
      return evaluateUnary(node, context);

    default:
      throw new EvaluatorError(
        `Unknown node type: ${(node as ASTNode).type}`,
        node,
        context
      );
  }
}

/**
 * Evaluate an AST against a context object
 *
 * @param ast - The AST to evaluate
 * @param context - The context object to evaluate against
 * @returns Boolean result of the evaluation
 * @throws EvaluatorError if evaluation fails
 *
 * @example
 * ```ts
 * const ast = parse(tokenize("intent.action == 'read'"));
 * const context = { intent: { action: 'read' } };
 * evaluate(ast, context); // true
 * ```
 */
export function evaluate(ast: ASTNode, context: EvaluationContext): boolean {
  const result = evaluateNode(ast, context);
  return toBool(result);
}
