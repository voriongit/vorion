/**
 * Expression Parser for Vorion DSL
 *
 * Recursive descent parser that converts tokens into an AST.
 *
 * Grammar (Syntactic):
 *   expression    := or_expr
 *   or_expr       := and_expr (OR and_expr)*
 *   and_expr      := not_expr (AND not_expr)*
 *   not_expr      := NOT not_expr | comparison
 *   comparison    := primary (OPERATOR primary)?
 *                  | primary IN array
 *                  | primary LIKE primary
 *   primary       := IDENTIFIER | STRING | NUMBER | TRUE | FALSE | NULL
 *                  | LPAREN expression RPAREN
 *                  | array
 *   array         := LBRACKET (primary (COMMA primary)*)? RBRACKET
 *
 * Operator Precedence (lowest to highest):
 *   1. OR
 *   2. AND
 *   3. NOT
 *   4. Comparison operators (==, !=, >, <, >=, <=, IN, LIKE)
 *
 * @packageDocumentation
 */

import { Token, TokenType } from './lexer.js';

/**
 * AST Node types
 */
export type ASTNodeType =
  | 'BinaryExpression'
  | 'UnaryExpression'
  | 'ComparisonExpression'
  | 'InExpression'
  | 'LikeExpression'
  | 'Identifier'
  | 'Literal'
  | 'ArrayExpression';

/**
 * Base AST node interface
 */
export interface BaseASTNode {
  type: ASTNodeType;
}

/**
 * Binary expression node (AND, OR)
 */
export interface BinaryExpressionNode extends BaseASTNode {
  type: 'BinaryExpression';
  operator: 'AND' | 'OR';
  left: ASTNode;
  right: ASTNode;
}

/**
 * Unary expression node (NOT)
 */
export interface UnaryExpressionNode extends BaseASTNode {
  type: 'UnaryExpression';
  operator: 'NOT';
  operand: ASTNode;
}

/**
 * Comparison expression node
 */
export interface ComparisonExpressionNode extends BaseASTNode {
  type: 'ComparisonExpression';
  operator: '==' | '!=' | '>' | '<' | '>=' | '<=';
  left: ASTNode;
  right: ASTNode;
}

/**
 * IN expression node
 */
export interface InExpressionNode extends BaseASTNode {
  type: 'InExpression';
  value: ASTNode;
  array: ArrayExpressionNode;
}

/**
 * LIKE expression node
 */
export interface LikeExpressionNode extends BaseASTNode {
  type: 'LikeExpression';
  value: ASTNode;
  pattern: ASTNode;
}

/**
 * Identifier node (e.g., intent.action)
 */
export interface IdentifierNode extends BaseASTNode {
  type: 'Identifier';
  name: string;
}

/**
 * Literal value types
 */
export type LiteralValue = string | number | boolean | null;

/**
 * Literal node (string, number, boolean, null)
 */
export interface LiteralNode extends BaseASTNode {
  type: 'Literal';
  value: LiteralValue;
  raw: string;
}

/**
 * Array expression node
 */
export interface ArrayExpressionNode extends BaseASTNode {
  type: 'ArrayExpression';
  elements: ASTNode[];
}

/**
 * Union type for all AST nodes
 */
export type ASTNode =
  | BinaryExpressionNode
  | UnaryExpressionNode
  | ComparisonExpressionNode
  | InExpressionNode
  | LikeExpressionNode
  | IdentifierNode
  | LiteralNode
  | ArrayExpressionNode;

/**
 * Error thrown during parsing
 */
export class ParserError extends Error {
  constructor(
    message: string,
    public token: Token,
    public expected?: string
  ) {
    const posInfo = `at position ${token.position}`;
    const expectedInfo = expected ? ` (expected ${expected})` : '';
    super(`Parser error ${posInfo}: ${message}${expectedInfo}`);
    this.name = 'ParserError';
  }
}

/**
 * Parser state
 */
interface ParserState {
  tokens: Token[];
  position: number;
}

/**
 * Get current token without advancing
 */
function peek(state: ParserState): Token {
  return state.tokens[state.position];
}

/**
 * Advance to next token and return current
 */
function advance(state: ParserState): Token {
  const token = state.tokens[state.position];
  if (token.type !== 'EOF') {
    state.position++;
  }
  return token;
}

/**
 * Check if current token matches expected type
 */
function check(state: ParserState, type: TokenType): boolean {
  return peek(state).type === type;
}

/**
 * Consume token if it matches, otherwise throw error
 */
function expect(state: ParserState, type: TokenType, message?: string): Token {
  const token = peek(state);
  if (token.type !== type) {
    throw new ParserError(
      message || `Unexpected token '${token.value}'`,
      token,
      type
    );
  }
  return advance(state);
}

/**
 * Parse an expression (entry point)
 */
function parseExpression(state: ParserState): ASTNode {
  return parseOrExpression(state);
}

/**
 * Parse OR expression (lowest precedence)
 */
function parseOrExpression(state: ParserState): ASTNode {
  let left = parseAndExpression(state);

  while (check(state, 'OR')) {
    advance(state); // consume OR
    const right = parseAndExpression(state);
    left = {
      type: 'BinaryExpression',
      operator: 'OR',
      left,
      right,
    };
  }

  return left;
}

/**
 * Parse AND expression
 */
function parseAndExpression(state: ParserState): ASTNode {
  let left = parseNotExpression(state);

  while (check(state, 'AND')) {
    advance(state); // consume AND
    const right = parseNotExpression(state);
    left = {
      type: 'BinaryExpression',
      operator: 'AND',
      left,
      right,
    };
  }

  return left;
}

/**
 * Parse NOT expression (unary)
 */
function parseNotExpression(state: ParserState): ASTNode {
  if (check(state, 'NOT')) {
    advance(state); // consume NOT
    const operand = parseNotExpression(state);
    return {
      type: 'UnaryExpression',
      operator: 'NOT',
      operand,
    };
  }

  return parseComparison(state);
}

/**
 * Parse comparison expression
 */
function parseComparison(state: ParserState): ASTNode {
  const left = parsePrimary(state);

  // Check for comparison operator
  if (check(state, 'OPERATOR')) {
    const operatorToken = advance(state);
    const operator = operatorToken.value as ComparisonExpressionNode['operator'];
    const right = parsePrimary(state);
    return {
      type: 'ComparisonExpression',
      operator,
      left,
      right,
    };
  }

  // Check for IN
  if (check(state, 'IN')) {
    advance(state); // consume IN
    const array = parseArray(state);
    return {
      type: 'InExpression',
      value: left,
      array,
    };
  }

  // Check for LIKE
  if (check(state, 'LIKE')) {
    advance(state); // consume LIKE
    const pattern = parsePrimary(state);
    return {
      type: 'LikeExpression',
      value: left,
      pattern,
    };
  }

  return left;
}

/**
 * Parse primary expression
 */
function parsePrimary(state: ParserState): ASTNode {
  const token = peek(state);

  switch (token.type) {
    case 'IDENTIFIER': {
      advance(state);
      return {
        type: 'Identifier',
        name: token.value,
      };
    }

    case 'STRING': {
      advance(state);
      return {
        type: 'Literal',
        value: token.value,
        raw: `"${token.value}"`,
      };
    }

    case 'NUMBER': {
      advance(state);
      const numValue = parseFloat(token.value);
      return {
        type: 'Literal',
        value: numValue,
        raw: token.value,
      };
    }

    case 'TRUE': {
      advance(state);
      return {
        type: 'Literal',
        value: true,
        raw: 'true',
      };
    }

    case 'FALSE': {
      advance(state);
      return {
        type: 'Literal',
        value: false,
        raw: 'false',
      };
    }

    case 'NULL': {
      advance(state);
      return {
        type: 'Literal',
        value: null,
        raw: 'null',
      };
    }

    case 'LPAREN': {
      advance(state); // consume (
      const expr = parseExpression(state);
      expect(state, 'RPAREN', 'closing parenthesis');
      return expr;
    }

    case 'LBRACKET': {
      return parseArray(state);
    }

    case 'EOF': {
      throw new ParserError('Unexpected end of expression', token, 'value');
    }

    default: {
      throw new ParserError(`Unexpected token '${token.value}'`, token, 'value');
    }
  }
}

/**
 * Parse array expression
 */
function parseArray(state: ParserState): ArrayExpressionNode {
  expect(state, 'LBRACKET', 'opening bracket');

  const elements: ASTNode[] = [];

  // Handle empty array
  if (!check(state, 'RBRACKET')) {
    elements.push(parsePrimary(state));

    while (check(state, 'COMMA')) {
      advance(state); // consume comma
      elements.push(parsePrimary(state));
    }
  }

  expect(state, 'RBRACKET', 'closing bracket');

  return {
    type: 'ArrayExpression',
    elements,
  };
}

/**
 * Parse tokens into an AST
 *
 * @param tokens - Array of tokens from the lexer
 * @returns Root AST node
 * @throws ParserError if syntax is invalid
 *
 * @example
 * ```ts
 * const tokens = tokenize("intent.action == 'read' AND risk > 50");
 * const ast = parse(tokens);
 * // Returns BinaryExpression with AND operator
 * ```
 */
export function parse(tokens: Token[]): ASTNode {
  if (tokens.length === 0) {
    throw new ParserError(
      'Empty token stream',
      { type: 'EOF', value: '', position: 0 },
      'expression'
    );
  }

  // Handle EOF-only token stream (empty expression)
  if (tokens.length === 1 && tokens[0].type === 'EOF') {
    throw new ParserError(
      'Empty expression',
      tokens[0],
      'expression'
    );
  }

  const state: ParserState = {
    tokens,
    position: 0,
  };

  const ast = parseExpression(state);

  // Ensure we consumed all tokens (except EOF)
  if (!check(state, 'EOF')) {
    const token = peek(state);
    throw new ParserError(
      `Unexpected token '${token.value}' after expression`,
      token,
      'end of expression'
    );
  }

  return ast;
}
