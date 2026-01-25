/**
 * Expression Parser Tests
 *
 * Tests for the Vorion governance DSL expression parser including:
 * - Lexer tests for all token types
 * - Parser tests for all operators
 * - Evaluator tests with various contexts
 * - Integration tests for complex expressions
 * - Error handling tests
 */

import { describe, it, expect } from 'vitest';
import {
  // Lexer
  tokenize,
  Token,
  TokenType,
  LexerError,
  // Parser
  parse,
  ASTNode,
  ParserError,
  // Evaluator
  evaluate,
  resolvePath,
  EvaluatorError,
  // Engine
  ExpressionEngine,
  expressionEngine,
  ValidationResult,
} from '../../../src/common/expression/index.js';

describe('Expression Parser', () => {
  describe('Lexer', () => {
    describe('tokenize', () => {
      describe('basic tokens', () => {
        it('should tokenize an empty string', () => {
          const tokens = tokenize('');
          expect(tokens).toHaveLength(1);
          expect(tokens[0].type).toBe('EOF');
        });

        it('should tokenize whitespace-only string', () => {
          const tokens = tokenize('   \t\n  ');
          expect(tokens).toHaveLength(1);
          expect(tokens[0].type).toBe('EOF');
        });

        it('should tokenize a simple identifier', () => {
          const tokens = tokenize('action');
          expect(tokens).toHaveLength(2);
          expect(tokens[0]).toEqual({ type: 'IDENTIFIER', value: 'action', position: 0 });
          expect(tokens[1].type).toBe('EOF');
        });

        it('should tokenize dotted identifiers', () => {
          const tokens = tokenize('intent.action');
          expect(tokens).toHaveLength(2);
          expect(tokens[0]).toEqual({ type: 'IDENTIFIER', value: 'intent.action', position: 0 });
        });

        it('should tokenize deeply nested identifiers', () => {
          const tokens = tokenize('context.user.profile.name');
          expect(tokens).toHaveLength(2);
          expect(tokens[0].value).toBe('context.user.profile.name');
        });

        it('should tokenize identifiers with underscores', () => {
          const tokens = tokenize('_private.user_id');
          expect(tokens).toHaveLength(2);
          expect(tokens[0].value).toBe('_private.user_id');
        });
      });

      describe('string literals', () => {
        it('should tokenize single-quoted strings', () => {
          const tokens = tokenize("'hello'");
          expect(tokens[0]).toEqual({ type: 'STRING', value: 'hello', position: 0 });
        });

        it('should tokenize double-quoted strings', () => {
          const tokens = tokenize('"world"');
          expect(tokens[0]).toEqual({ type: 'STRING', value: 'world', position: 0 });
        });

        it('should tokenize empty strings', () => {
          const tokens = tokenize('""');
          expect(tokens[0]).toEqual({ type: 'STRING', value: '', position: 0 });
        });

        it('should tokenize strings with spaces', () => {
          const tokens = tokenize("'hello world'");
          expect(tokens[0].value).toBe('hello world');
        });

        it('should handle escaped quotes in strings', () => {
          const tokens = tokenize('"hello \\"world\\""');
          expect(tokens[0].value).toBe('hello "world"');
        });

        it('should handle escaped backslashes', () => {
          const tokens = tokenize("'path\\\\to\\\\file'");
          expect(tokens[0].value).toBe('path\\to\\file');
        });

        it('should throw on unterminated string', () => {
          expect(() => tokenize('"unterminated')).toThrow(LexerError);
          expect(() => tokenize("'unterminated")).toThrow('Unterminated string literal');
        });
      });

      describe('numbers', () => {
        it('should tokenize integers', () => {
          const tokens = tokenize('42');
          expect(tokens[0]).toEqual({ type: 'NUMBER', value: '42', position: 0 });
        });

        it('should tokenize decimals', () => {
          const tokens = tokenize('3.14');
          expect(tokens[0]).toEqual({ type: 'NUMBER', value: '3.14', position: 0 });
        });

        it('should tokenize negative numbers', () => {
          const tokens = tokenize('-100');
          expect(tokens[0]).toEqual({ type: 'NUMBER', value: '-100', position: 0 });
        });

        it('should tokenize negative decimals', () => {
          const tokens = tokenize('-0.5');
          expect(tokens[0].value).toBe('-0.5');
        });

        it('should tokenize zero', () => {
          const tokens = tokenize('0');
          expect(tokens[0].value).toBe('0');
        });

        it('should tokenize large numbers', () => {
          const tokens = tokenize('999999999');
          expect(tokens[0].value).toBe('999999999');
        });
      });

      describe('operators', () => {
        it('should tokenize equality operator', () => {
          const tokens = tokenize('==');
          expect(tokens[0]).toEqual({ type: 'OPERATOR', value: '==', position: 0 });
        });

        it('should tokenize inequality operator', () => {
          const tokens = tokenize('!=');
          expect(tokens[0]).toEqual({ type: 'OPERATOR', value: '!=', position: 0 });
        });

        it('should tokenize comparison operators', () => {
          expect(tokenize('>')[0].value).toBe('>');
          expect(tokenize('<')[0].value).toBe('<');
          expect(tokenize('>=')[0].value).toBe('>=');
          expect(tokenize('<=')[0].value).toBe('<=');
        });

        it('should prefer multi-char operators', () => {
          // Should tokenize as >= not > and =
          const tokens = tokenize('>=');
          expect(tokens).toHaveLength(2); // >= and EOF
          expect(tokens[0].value).toBe('>=');
        });
      });

      describe('keywords', () => {
        it('should tokenize AND keyword (case-insensitive)', () => {
          expect(tokenize('AND')[0].type).toBe('AND');
          expect(tokenize('and')[0].type).toBe('AND');
          expect(tokenize('And')[0].type).toBe('AND');
        });

        it('should tokenize OR keyword (case-insensitive)', () => {
          expect(tokenize('OR')[0].type).toBe('OR');
          expect(tokenize('or')[0].type).toBe('OR');
        });

        it('should tokenize NOT keyword', () => {
          expect(tokenize('NOT')[0].type).toBe('NOT');
          expect(tokenize('not')[0].type).toBe('NOT');
        });

        it('should tokenize IN keyword', () => {
          expect(tokenize('IN')[0].type).toBe('IN');
          expect(tokenize('in')[0].type).toBe('IN');
        });

        it('should tokenize LIKE keyword', () => {
          expect(tokenize('LIKE')[0].type).toBe('LIKE');
          expect(tokenize('like')[0].type).toBe('LIKE');
        });

        it('should tokenize boolean literals', () => {
          expect(tokenize('true')[0].type).toBe('TRUE');
          expect(tokenize('TRUE')[0].type).toBe('TRUE');
          expect(tokenize('false')[0].type).toBe('FALSE');
          expect(tokenize('FALSE')[0].type).toBe('FALSE');
        });

        it('should tokenize NULL', () => {
          expect(tokenize('null')[0].type).toBe('NULL');
          expect(tokenize('NULL')[0].type).toBe('NULL');
        });
      });

      describe('parentheses and brackets', () => {
        it('should tokenize parentheses', () => {
          const tokens = tokenize('()');
          expect(tokens[0].type).toBe('LPAREN');
          expect(tokens[1].type).toBe('RPAREN');
        });

        it('should tokenize brackets', () => {
          const tokens = tokenize('[]');
          expect(tokens[0].type).toBe('LBRACKET');
          expect(tokens[1].type).toBe('RBRACKET');
        });

        it('should tokenize comma', () => {
          const tokens = tokenize(',');
          expect(tokens[0].type).toBe('COMMA');
        });
      });

      describe('complete expressions', () => {
        it('should tokenize simple comparison', () => {
          const tokens = tokenize("intent.action == 'read'");
          expect(tokens.map((t) => t.type)).toEqual([
            'IDENTIFIER',
            'OPERATOR',
            'STRING',
            'EOF',
          ]);
        });

        it('should tokenize complex expression', () => {
          const tokens = tokenize("user.role IN ['admin', 'supervisor'] OR trust.score >= 800");
          const types = tokens.map((t) => t.type);
          expect(types).toContain('IDENTIFIER');
          expect(types).toContain('IN');
          expect(types).toContain('LBRACKET');
          expect(types).toContain('STRING');
          expect(types).toContain('COMMA');
          expect(types).toContain('RBRACKET');
          expect(types).toContain('OR');
          expect(types).toContain('OPERATOR');
          expect(types).toContain('NUMBER');
        });
      });

      describe('error handling', () => {
        it('should throw on unexpected character', () => {
          expect(() => tokenize('@')).toThrow(LexerError);
          expect(() => tokenize('a @ b')).toThrow(LexerError);
        });

        it('should include position in error', () => {
          try {
            tokenize('a @ b');
          } catch (error) {
            expect(error).toBeInstanceOf(LexerError);
            expect((error as LexerError).position).toBe(2);
          }
        });
      });
    });
  });

  describe('Parser', () => {
    describe('parse', () => {
      describe('literals', () => {
        it('should parse string literal', () => {
          const tokens = tokenize("'hello'");
          const ast = parse(tokens);
          expect(ast.type).toBe('Literal');
          expect((ast as any).value).toBe('hello');
        });

        it('should parse number literal', () => {
          const tokens = tokenize('42');
          const ast = parse(tokens);
          expect(ast.type).toBe('Literal');
          expect((ast as any).value).toBe(42);
        });

        it('should parse boolean literals', () => {
          expect((parse(tokenize('true')) as any).value).toBe(true);
          expect((parse(tokenize('false')) as any).value).toBe(false);
        });

        it('should parse null literal', () => {
          const ast = parse(tokenize('null'));
          expect(ast.type).toBe('Literal');
          expect((ast as any).value).toBe(null);
        });
      });

      describe('identifiers', () => {
        it('should parse simple identifier', () => {
          const tokens = tokenize('action');
          const ast = parse(tokens);
          expect(ast.type).toBe('Identifier');
          expect((ast as any).name).toBe('action');
        });

        it('should parse dotted identifier', () => {
          const tokens = tokenize('intent.action');
          const ast = parse(tokens);
          expect(ast.type).toBe('Identifier');
          expect((ast as any).name).toBe('intent.action');
        });
      });

      describe('comparison expressions', () => {
        it('should parse equality comparison', () => {
          const tokens = tokenize("action == 'read'");
          const ast = parse(tokens);
          expect(ast.type).toBe('ComparisonExpression');
          expect((ast as any).operator).toBe('==');
          expect((ast as any).left.type).toBe('Identifier');
          expect((ast as any).right.type).toBe('Literal');
        });

        it('should parse inequality comparison', () => {
          const ast = parse(tokenize("status != 'active'"));
          expect((ast as any).operator).toBe('!=');
        });

        it('should parse numeric comparisons', () => {
          expect((parse(tokenize('score > 50')) as any).operator).toBe('>');
          expect((parse(tokenize('score < 100')) as any).operator).toBe('<');
          expect((parse(tokenize('score >= 50')) as any).operator).toBe('>=');
          expect((parse(tokenize('score <= 100')) as any).operator).toBe('<=');
        });
      });

      describe('logical expressions', () => {
        it('should parse AND expression', () => {
          const tokens = tokenize('a == 1 AND b == 2');
          const ast = parse(tokens);
          expect(ast.type).toBe('BinaryExpression');
          expect((ast as any).operator).toBe('AND');
        });

        it('should parse OR expression', () => {
          const tokens = tokenize('a == 1 OR b == 2');
          const ast = parse(tokens);
          expect(ast.type).toBe('BinaryExpression');
          expect((ast as any).operator).toBe('OR');
        });

        it('should parse NOT expression', () => {
          const tokens = tokenize('NOT active');
          const ast = parse(tokens);
          expect(ast.type).toBe('UnaryExpression');
          expect((ast as any).operator).toBe('NOT');
        });

        it('should parse nested NOT', () => {
          const tokens = tokenize('NOT NOT active');
          const ast = parse(tokens);
          expect(ast.type).toBe('UnaryExpression');
          expect((ast as any).operand.type).toBe('UnaryExpression');
        });
      });

      describe('operator precedence', () => {
        it('should give NOT higher precedence than AND', () => {
          // NOT a AND b should be (NOT a) AND b
          const tokens = tokenize('NOT a AND b');
          const ast = parse(tokens);
          expect(ast.type).toBe('BinaryExpression');
          expect((ast as any).operator).toBe('AND');
          expect((ast as any).left.type).toBe('UnaryExpression');
          expect((ast as any).left.operator).toBe('NOT');
        });

        it('should give AND higher precedence than OR', () => {
          // a OR b AND c should be a OR (b AND c)
          const tokens = tokenize('a OR b AND c');
          const ast = parse(tokens);
          expect(ast.type).toBe('BinaryExpression');
          expect((ast as any).operator).toBe('OR');
          expect((ast as any).right.type).toBe('BinaryExpression');
          expect((ast as any).right.operator).toBe('AND');
        });

        it('should respect parentheses', () => {
          // (a OR b) AND c
          const tokens = tokenize('(a OR b) AND c');
          const ast = parse(tokens);
          expect(ast.type).toBe('BinaryExpression');
          expect((ast as any).operator).toBe('AND');
          expect((ast as any).left.type).toBe('BinaryExpression');
          expect((ast as any).left.operator).toBe('OR');
        });
      });

      describe('IN expressions', () => {
        it('should parse IN with array', () => {
          const tokens = tokenize("role IN ['admin', 'user']");
          const ast = parse(tokens);
          expect(ast.type).toBe('InExpression');
          expect((ast as any).value.name).toBe('role');
          expect((ast as any).array.type).toBe('ArrayExpression');
          expect((ast as any).array.elements).toHaveLength(2);
        });

        it('should parse IN with empty array', () => {
          const tokens = tokenize('value IN []');
          const ast = parse(tokens);
          expect((ast as any).array.elements).toHaveLength(0);
        });

        it('should parse IN with numeric array', () => {
          const tokens = tokenize('score IN [1, 2, 3]');
          const ast = parse(tokens);
          expect((ast as any).array.elements).toHaveLength(3);
        });
      });

      describe('LIKE expressions', () => {
        it('should parse LIKE expression', () => {
          const tokens = tokenize("name LIKE 'John%'");
          const ast = parse(tokens);
          expect(ast.type).toBe('LikeExpression');
          expect((ast as any).value.name).toBe('name');
          expect((ast as any).pattern.value).toBe('John%');
        });
      });

      describe('complex expressions', () => {
        it('should parse complex governance expression', () => {
          const expr = "intent.action == 'data:read' AND intent.riskScore > 50";
          const ast = parse(tokenize(expr));
          expect(ast.type).toBe('BinaryExpression');
          expect((ast as any).operator).toBe('AND');
        });

        it('should parse expression with multiple operators', () => {
          const expr = "user.role IN ['admin', 'supervisor'] OR trust.score >= 800";
          const ast = parse(tokenize(expr));
          expect(ast.type).toBe('BinaryExpression');
          expect((ast as any).operator).toBe('OR');
        });

        it('should parse expression with NOT and IN', () => {
          const expr = "NOT intent.approved AND action IN ['delete', 'modify']";
          const ast = parse(tokenize(expr));
          expect(ast.type).toBe('BinaryExpression');
        });
      });

      describe('error handling', () => {
        it('should throw on empty expression', () => {
          expect(() => parse(tokenize(''))).toThrow(ParserError);
        });

        it('should throw on missing operand', () => {
          expect(() => parse(tokenize('a =='))).toThrow(ParserError);
        });

        it('should throw on missing closing paren', () => {
          expect(() => parse(tokenize('(a == 1'))).toThrow(ParserError);
        });

        it('should throw on missing closing bracket', () => {
          expect(() => parse(tokenize('a IN [1, 2'))).toThrow(ParserError);
        });

        it('should throw on trailing tokens', () => {
          expect(() => parse(tokenize('a == 1 b'))).toThrow(ParserError);
        });

        it('should include position in error', () => {
          try {
            parse(tokenize('a == '));
          } catch (error) {
            expect(error).toBeInstanceOf(ParserError);
            expect((error as ParserError).token).toBeDefined();
          }
        });
      });
    });
  });

  describe('Evaluator', () => {
    describe('resolvePath', () => {
      it('should resolve simple paths', () => {
        expect(resolvePath('action', { action: 'read' })).toBe('read');
      });

      it('should resolve nested paths', () => {
        const context = { intent: { action: 'read' } };
        expect(resolvePath('intent.action', context)).toBe('read');
      });

      it('should resolve deeply nested paths', () => {
        const context = { a: { b: { c: { d: 'value' } } } };
        expect(resolvePath('a.b.c.d', context)).toBe('value');
      });

      it('should return undefined for missing paths', () => {
        expect(resolvePath('missing', {})).toBeUndefined();
        expect(resolvePath('a.b', { a: {} })).toBeUndefined();
      });

      it('should handle null in path', () => {
        expect(resolvePath('a.b', { a: null })).toBeUndefined();
      });
    });

    describe('evaluate', () => {
      describe('comparisons', () => {
        it('should evaluate string equality', () => {
          const ast = parse(tokenize("action == 'read'"));
          expect(evaluate(ast, { action: 'read' })).toBe(true);
          expect(evaluate(ast, { action: 'write' })).toBe(false);
        });

        it('should evaluate string inequality', () => {
          const ast = parse(tokenize("action != 'read'"));
          expect(evaluate(ast, { action: 'write' })).toBe(true);
          expect(evaluate(ast, { action: 'read' })).toBe(false);
        });

        it('should evaluate numeric comparisons', () => {
          expect(evaluate(parse(tokenize('score > 50')), { score: 75 })).toBe(true);
          expect(evaluate(parse(tokenize('score > 50')), { score: 50 })).toBe(false);
          expect(evaluate(parse(tokenize('score >= 50')), { score: 50 })).toBe(true);
          expect(evaluate(parse(tokenize('score < 50')), { score: 25 })).toBe(true);
          expect(evaluate(parse(tokenize('score <= 50')), { score: 50 })).toBe(true);
        });

        it('should evaluate dotted identifier comparisons', () => {
          const ast = parse(tokenize("intent.action == 'read'"));
          expect(evaluate(ast, { intent: { action: 'read' } })).toBe(true);
          expect(evaluate(ast, { intent: { action: 'write' } })).toBe(false);
        });

        it('should handle type coercion', () => {
          const ast = parse(tokenize("score == '50'"));
          expect(evaluate(ast, { score: 50 })).toBe(true);
        });
      });

      describe('null handling', () => {
        it('should evaluate null equality', () => {
          const ast = parse(tokenize('value == null'));
          expect(evaluate(ast, { value: null })).toBe(true);
          expect(evaluate(ast, { value: 'something' })).toBe(false);
        });

        it('should evaluate missing values as undefined', () => {
          const ast = parse(tokenize('missing == null'));
          expect(evaluate(ast, {})).toBe(true);
        });

        it('should return false for null comparisons (except ==, !=)', () => {
          const ast = parse(tokenize('value > 50'));
          expect(evaluate(ast, { value: null })).toBe(false);
        });
      });

      describe('logical operators', () => {
        it('should evaluate AND', () => {
          const ast = parse(tokenize('a == 1 AND b == 2'));
          expect(evaluate(ast, { a: 1, b: 2 })).toBe(true);
          expect(evaluate(ast, { a: 1, b: 3 })).toBe(false);
          expect(evaluate(ast, { a: 2, b: 2 })).toBe(false);
        });

        it('should evaluate OR', () => {
          const ast = parse(tokenize('a == 1 OR b == 2'));
          expect(evaluate(ast, { a: 1, b: 3 })).toBe(true);
          expect(evaluate(ast, { a: 2, b: 2 })).toBe(true);
          expect(evaluate(ast, { a: 2, b: 3 })).toBe(false);
        });

        it('should evaluate NOT', () => {
          const ast = parse(tokenize('NOT active'));
          expect(evaluate(ast, { active: true })).toBe(false);
          expect(evaluate(ast, { active: false })).toBe(true);
        });

        it('should short-circuit AND', () => {
          // If left is false, right should not be evaluated
          const ast = parse(tokenize('false AND error'));
          expect(evaluate(ast, {})).toBe(false);
        });

        it('should short-circuit OR', () => {
          // If left is true, right should not be evaluated
          const ast = parse(tokenize('true OR error'));
          expect(evaluate(ast, {})).toBe(true);
        });
      });

      describe('IN operator', () => {
        it('should evaluate IN with matching value', () => {
          const ast = parse(tokenize("role IN ['admin', 'user']"));
          expect(evaluate(ast, { role: 'admin' })).toBe(true);
          expect(evaluate(ast, { role: 'user' })).toBe(true);
          expect(evaluate(ast, { role: 'guest' })).toBe(false);
        });

        it('should evaluate IN with numbers', () => {
          const ast = parse(tokenize('score IN [1, 2, 3]'));
          expect(evaluate(ast, { score: 2 })).toBe(true);
          expect(evaluate(ast, { score: 4 })).toBe(false);
        });

        it('should evaluate IN with empty array', () => {
          const ast = parse(tokenize('value IN []'));
          expect(evaluate(ast, { value: 'anything' })).toBe(false);
        });

        it('should handle type coercion in IN', () => {
          const ast = parse(tokenize("score IN ['50']"));
          expect(evaluate(ast, { score: 50 })).toBe(true);
        });
      });

      describe('LIKE operator', () => {
        it('should match exact strings', () => {
          const ast = parse(tokenize("name LIKE 'John'"));
          expect(evaluate(ast, { name: 'John' })).toBe(true);
          expect(evaluate(ast, { name: 'Jane' })).toBe(false);
        });

        it('should match with % wildcard (any sequence)', () => {
          const ast = parse(tokenize("name LIKE 'John%'"));
          expect(evaluate(ast, { name: 'John' })).toBe(true);
          expect(evaluate(ast, { name: 'Johnny' })).toBe(true);
          expect(evaluate(ast, { name: 'John Doe' })).toBe(true);
          expect(evaluate(ast, { name: 'Jane' })).toBe(false);
        });

        it('should match with _ wildcard (single char)', () => {
          const ast = parse(tokenize("name LIKE 'Jo_n'"));
          expect(evaluate(ast, { name: 'John' })).toBe(true);
          expect(evaluate(ast, { name: 'Joan' })).toBe(true);
          expect(evaluate(ast, { name: 'Jon' })).toBe(false);
        });

        it('should be case-insensitive', () => {
          const ast = parse(tokenize("name LIKE 'john'"));
          expect(evaluate(ast, { name: 'John' })).toBe(true);
          expect(evaluate(ast, { name: 'JOHN' })).toBe(true);
        });

        it('should handle null values', () => {
          const ast = parse(tokenize("name LIKE 'John%'"));
          expect(evaluate(ast, { name: null })).toBe(false);
        });
      });

      describe('boolean literals', () => {
        it('should evaluate true literal', () => {
          const ast = parse(tokenize('true'));
          expect(evaluate(ast, {})).toBe(true);
        });

        it('should evaluate false literal', () => {
          const ast = parse(tokenize('false'));
          expect(evaluate(ast, {})).toBe(false);
        });

        it('should compare with boolean values', () => {
          const ast = parse(tokenize('active == true'));
          expect(evaluate(ast, { active: true })).toBe(true);
          expect(evaluate(ast, { active: false })).toBe(false);
        });
      });

      describe('complex expressions', () => {
        it('should evaluate governance expression', () => {
          const ast = parse(tokenize("intent.action == 'data:read' AND intent.riskScore > 50"));
          expect(evaluate(ast, { intent: { action: 'data:read', riskScore: 75 } })).toBe(true);
          expect(evaluate(ast, { intent: { action: 'data:read', riskScore: 30 } })).toBe(false);
          expect(evaluate(ast, { intent: { action: 'data:write', riskScore: 75 } })).toBe(false);
        });

        it('should evaluate expression with OR and IN', () => {
          const ast = parse(tokenize("user.role IN ['admin', 'supervisor'] OR trust.score >= 800"));
          expect(evaluate(ast, { user: { role: 'admin' }, trust: { score: 500 } })).toBe(true);
          expect(evaluate(ast, { user: { role: 'user' }, trust: { score: 850 } })).toBe(true);
          expect(evaluate(ast, { user: { role: 'user' }, trust: { score: 500 } })).toBe(false);
        });

        it('should evaluate expression with NOT', () => {
          const ast = parse(tokenize("resource.sensitivity == 'high' AND NOT intent.approved"));
          expect(evaluate(ast, { resource: { sensitivity: 'high' }, intent: { approved: false } })).toBe(true);
          expect(evaluate(ast, { resource: { sensitivity: 'high' }, intent: { approved: true } })).toBe(false);
        });

        it('should evaluate deeply nested expression', () => {
          const expr = '(a == 1 OR b == 2) AND (c == 3 OR d == 4) AND NOT disabled';
          const ast = parse(tokenize(expr));
          expect(evaluate(ast, { a: 1, c: 3, disabled: false })).toBe(true);
          expect(evaluate(ast, { b: 2, d: 4, disabled: false })).toBe(true);
          expect(evaluate(ast, { a: 1, c: 3, disabled: true })).toBe(false);
        });
      });
    });
  });

  describe('ExpressionEngine', () => {
    let engine: ExpressionEngine;

    beforeEach(() => {
      engine = new ExpressionEngine();
    });

    describe('compile', () => {
      it('should compile a valid expression', () => {
        const compiled = engine.compile("action == 'read'");
        expect(compiled.expression).toBe("action == 'read'");
        expect(compiled.ast).toBeDefined();
        expect(compiled.tokens).toBeDefined();
        expect(typeof compiled.evaluate).toBe('function');
      });

      it('should evaluate compiled expression multiple times', () => {
        const compiled = engine.compile("score >= 50");
        expect(compiled.evaluate({ score: 75 })).toBe(true);
        expect(compiled.evaluate({ score: 30 })).toBe(false);
        expect(compiled.evaluate({ score: 50 })).toBe(true);
      });

      it('should throw on invalid expression', () => {
        expect(() => engine.compile('a ==')).toThrow();
      });
    });

    describe('evaluate', () => {
      it('should evaluate expression in one step', () => {
        const result = engine.evaluate("action == 'read'", { action: 'read' });
        expect(result).toBe(true);
      });

      it('should handle complex expressions', () => {
        const result = engine.evaluate(
          "user.role == 'admin' OR trust.score >= 800",
          { user: { role: 'user' }, trust: { score: 850 } }
        );
        expect(result).toBe(true);
      });
    });

    describe('validate', () => {
      it('should return valid result for valid expression', () => {
        const result = engine.validate("action == 'read'");
        expect(result.valid).toBe(true);
        expect(result.ast).toBeDefined();
        expect(result.error).toBeUndefined();
      });

      it('should return error for lexer error', () => {
        const result = engine.validate('action @ value');
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.error?.message).toContain('Unexpected character');
      });

      it('should return error for parser error', () => {
        const result = engine.validate('action ==');
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });

      it('should return error for empty expression', () => {
        const result = engine.validate('');
        expect(result.valid).toBe(false);
      });

      it('should include position in error', () => {
        const result = engine.validate('a @ b');
        expect(result.error?.position).toBeDefined();
      });
    });

    describe('tokenize', () => {
      it('should expose tokenization', () => {
        const tokens = engine.tokenize("action == 'read'");
        expect(tokens.length).toBeGreaterThan(1);
        expect(tokens[0].type).toBe('IDENTIFIER');
      });
    });

    describe('parse', () => {
      it('should expose parsing', () => {
        const ast = engine.parse("action == 'read'");
        expect(ast.type).toBe('ComparisonExpression');
      });
    });
  });

  describe('Default engine instance', () => {
    it('should export a default engine instance', () => {
      expect(expressionEngine).toBeInstanceOf(ExpressionEngine);
    });

    it('should be usable directly', () => {
      const result = expressionEngine.evaluate("x == 1", { x: 1 });
      expect(result).toBe(true);
    });
  });

  describe('Integration tests', () => {
    const engine = new ExpressionEngine();

    describe('Governance rule examples', () => {
      it('should evaluate data access rule', () => {
        const rule = "intent.action == 'data:read' AND intent.riskScore > 50";
        expect(engine.evaluate(rule, {
          intent: { action: 'data:read', riskScore: 75 }
        })).toBe(true);
      });

      it('should evaluate role-based access', () => {
        const rule = "user.role IN ['admin', 'supervisor'] OR trust.score >= 800";
        expect(engine.evaluate(rule, {
          user: { role: 'developer' },
          trust: { score: 850 }
        })).toBe(true);
      });

      it('should evaluate sensitivity restriction', () => {
        const rule = "resource.sensitivity == 'high' AND NOT intent.approved";
        expect(engine.evaluate(rule, {
          resource: { sensitivity: 'high' },
          intent: { approved: false }
        })).toBe(true);
      });

      it('should evaluate complex multi-condition rule', () => {
        const rule = `
          (user.clearance >= 3 OR user.role == 'admin')
          AND resource.classification != 'top-secret'
          AND NOT request.denied
        `;
        expect(engine.evaluate(rule, {
          user: { clearance: 2, role: 'admin' },
          resource: { classification: 'secret' },
          request: { denied: false }
        })).toBe(true);
      });

      it('should evaluate trust-based rule', () => {
        const rule = "trust.behavioral >= 600 AND trust.compliance >= 500 AND trust.identity >= 700";
        expect(engine.evaluate(rule, {
          trust: {
            behavioral: 650,
            compliance: 550,
            identity: 750
          }
        })).toBe(true);
      });

      it('should evaluate pattern matching rule', () => {
        const rule = "action LIKE 'data:%' AND NOT action LIKE '%delete%'";
        expect(engine.evaluate(rule, { action: 'data:read' })).toBe(true);
        expect(engine.evaluate(rule, { action: 'data:delete' })).toBe(false);
      });
    });

    describe('Edge cases', () => {
      it('should handle missing context values gracefully', () => {
        const rule = "missing.value == null";
        expect(engine.evaluate(rule, {})).toBe(true);
      });

      it('should handle empty string comparisons', () => {
        const rule = "value == ''";
        expect(engine.evaluate(rule, { value: '' })).toBe(true);
        expect(engine.evaluate(rule, { value: 'something' })).toBe(false);
      });

      it('should handle zero comparisons', () => {
        const rule = "score == 0";
        expect(engine.evaluate(rule, { score: 0 })).toBe(true);
      });

      it('should handle negative numbers', () => {
        const rule = "balance >= -100";
        expect(engine.evaluate(rule, { balance: -50 })).toBe(true);
        expect(engine.evaluate(rule, { balance: -150 })).toBe(false);
      });

      it('should handle decimal numbers', () => {
        const rule = "rate > 0.5";
        expect(engine.evaluate(rule, { rate: 0.75 })).toBe(true);
        expect(engine.evaluate(rule, { rate: 0.25 })).toBe(false);
      });

      it('should handle special characters in strings', () => {
        const rule = "path == 'c:\\\\users\\\\data'";
        expect(engine.evaluate(rule, { path: 'c:\\users\\data' })).toBe(true);
      });

      it('should handle deeply nested context', () => {
        const rule = "a.b.c.d.e == 'deep'";
        expect(engine.evaluate(rule, {
          a: { b: { c: { d: { e: 'deep' } } } }
        })).toBe(true);
      });

      it('should handle array with mixed types', () => {
        const rule = "value IN [1, 'two', true, null]";
        expect(engine.evaluate(rule, { value: 1 })).toBe(true);
        expect(engine.evaluate(rule, { value: 'two' })).toBe(true);
        expect(engine.evaluate(rule, { value: true })).toBe(true);
        expect(engine.evaluate(rule, { value: null })).toBe(true);
        expect(engine.evaluate(rule, { value: 'other' })).toBe(false);
      });
    });

    describe('Performance scenarios', () => {
      it('should compile once and evaluate many times efficiently', () => {
        const compiled = engine.compile("score >= threshold AND enabled == true");

        // Simulate many evaluations
        const contexts = Array.from({ length: 100 }, (_, i) => ({
          score: i,
          threshold: 50,
          enabled: i % 2 === 0
        }));

        const results = contexts.map((ctx) => compiled.evaluate(ctx));
        expect(results.filter(Boolean).length).toBeGreaterThan(0);
      });
    });
  });
});
