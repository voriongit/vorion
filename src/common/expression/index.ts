/**
 * Expression Engine for Vorion Governance DSL
 *
 * Provides a domain-specific language for expressing governance rules and conditions.
 * This module combines lexer, parser, and evaluator into a unified API.
 *
 * Example expressions:
 * - "intent.action == 'data:read' AND intent.riskScore > 50"
 * - "user.role IN ['admin', 'supervisor'] OR trust.score >= 800"
 * - "resource.sensitivity == 'high' AND NOT intent.approved"
 *
 * @packageDocumentation
 */

import { tokenize, Token, TokenType, LexerError } from './lexer.js';
import { parse, ASTNode, ParserError } from './parser.js';
import { evaluate, EvaluationContext, EvaluatorError, resolvePath } from './evaluator.js';

// Re-export all types and errors
export { Token, TokenType, LexerError } from './lexer.js';
export {
  ASTNode,
  ASTNodeType,
  BinaryExpressionNode,
  UnaryExpressionNode,
  ComparisonExpressionNode,
  InExpressionNode,
  LikeExpressionNode,
  IdentifierNode,
  LiteralNode,
  LiteralValue,
  ArrayExpressionNode,
  ParserError,
} from './parser.js';
export { EvaluationContext, EvaluatorError, resolvePath } from './evaluator.js';

// Re-export core functions
export { tokenize } from './lexer.js';
export { parse } from './parser.js';
export { evaluate } from './evaluator.js';

/**
 * Validation error details
 */
export interface ValidationError {
  /** Error message */
  message: string;
  /** Position in the expression where the error occurred */
  position?: number;
  /** The offending token or character */
  token?: string;
}

/**
 * Result of validating an expression
 */
export interface ValidationResult {
  /** Whether the expression is valid */
  valid: boolean;
  /** Error details if invalid */
  error?: ValidationError;
  /** The AST if valid */
  ast?: ASTNode;
}

/**
 * Compiled expression for efficient repeated evaluation
 */
export interface CompiledExpression {
  /** The original expression string */
  expression: string;
  /** The parsed AST */
  ast: ASTNode;
  /** Tokens from lexing */
  tokens: Token[];
  /**
   * Evaluate the expression against a context
   * @param context - The context object to evaluate against
   * @returns Boolean result of the evaluation
   */
  evaluate(context: EvaluationContext): boolean;
}

/**
 * Expression Engine combining lexer, parser, and evaluator
 *
 * Provides a high-level API for working with governance expressions.
 *
 * @example
 * ```ts
 * const engine = new ExpressionEngine();
 *
 * // Validate an expression
 * const result = engine.validate("intent.action == 'read'");
 * if (result.valid) {
 *   console.log('Expression is valid');
 * }
 *
 * // Compile for repeated evaluation
 * const compiled = engine.compile("risk.score > 50 AND role IN ['admin', 'power-user']");
 *
 * // Evaluate against multiple contexts
 * compiled.evaluate({ risk: { score: 75 }, role: 'admin' }); // true
 * compiled.evaluate({ risk: { score: 30 }, role: 'user' });  // false
 *
 * // One-shot evaluation
 * const allowed = engine.evaluate("trust.level >= 3", { trust: { level: 4 } }); // true
 * ```
 */
export class ExpressionEngine {
  /**
   * Compile an expression for efficient repeated evaluation
   *
   * @param expression - The expression string to compile
   * @returns A compiled expression object
   * @throws LexerError if the expression has lexical errors
   * @throws ParserError if the expression has syntax errors
   *
   * @example
   * ```ts
   * const engine = new ExpressionEngine();
   * const compiled = engine.compile("intent.action == 'read'");
   *
   * // Use multiple times
   * compiled.evaluate({ intent: { action: 'read' } }); // true
   * compiled.evaluate({ intent: { action: 'write' } }); // false
   * ```
   */
  compile(expression: string): CompiledExpression {
    const tokens = tokenize(expression);
    const ast = parse(tokens);

    return {
      expression,
      ast,
      tokens,
      evaluate: (context: EvaluationContext) => evaluate(ast, context),
    };
  }

  /**
   * Evaluate an expression against a context in one step
   *
   * For expressions that will be evaluated multiple times, consider using
   * `compile()` instead for better performance.
   *
   * @param expression - The expression string to evaluate
   * @param context - The context object to evaluate against
   * @returns Boolean result of the evaluation
   * @throws LexerError if the expression has lexical errors
   * @throws ParserError if the expression has syntax errors
   * @throws EvaluatorError if evaluation fails
   *
   * @example
   * ```ts
   * const engine = new ExpressionEngine();
   *
   * const result = engine.evaluate(
   *   "user.role == 'admin' OR trust.score >= 800",
   *   { user: { role: 'user' }, trust: { score: 850 } }
   * );
   * console.log(result); // true
   * ```
   */
  evaluate(expression: string, context: EvaluationContext): boolean {
    const compiled = this.compile(expression);
    return compiled.evaluate(context);
  }

  /**
   * Validate an expression without evaluating it
   *
   * This method catches all errors during lexing and parsing and returns
   * a structured validation result instead of throwing.
   *
   * @param expression - The expression string to validate
   * @returns Validation result with error details if invalid
   *
   * @example
   * ```ts
   * const engine = new ExpressionEngine();
   *
   * // Valid expression
   * const valid = engine.validate("intent.action == 'read'");
   * console.log(valid.valid); // true
   * console.log(valid.ast); // AST node
   *
   * // Invalid expression
   * const invalid = engine.validate("intent.action ==");
   * console.log(invalid.valid); // false
   * console.log(invalid.error?.message); // "Unexpected end of expression"
   * ```
   */
  validate(expression: string): ValidationResult {
    try {
      const tokens = tokenize(expression);
      const ast = parse(tokens);

      return {
        valid: true,
        ast,
      };
    } catch (error) {
      if (error instanceof LexerError) {
        return {
          valid: false,
          error: {
            message: error.message,
            position: error.position,
            token: error.input[error.position],
          },
        };
      }

      if (error instanceof ParserError) {
        return {
          valid: false,
          error: {
            message: error.message,
            position: error.token.position,
            token: error.token.value,
          },
        };
      }

      // Unknown error
      return {
        valid: false,
        error: {
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Get the tokens from an expression (useful for debugging)
   *
   * @param expression - The expression string to tokenize
   * @returns Array of tokens
   * @throws LexerError if the expression has lexical errors
   */
  tokenize(expression: string): Token[] {
    return tokenize(expression);
  }

  /**
   * Parse an expression into an AST (useful for debugging)
   *
   * @param expression - The expression string to parse
   * @returns The AST root node
   * @throws LexerError if the expression has lexical errors
   * @throws ParserError if the expression has syntax errors
   */
  parse(expression: string): ASTNode {
    const tokens = tokenize(expression);
    return parse(tokens);
  }
}

/**
 * Default expression engine instance for convenience
 */
export const expressionEngine = new ExpressionEngine();
