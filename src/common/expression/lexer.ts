/**
 * Expression Lexer for Vorion DSL
 *
 * Tokenizes governance rule expressions into a stream of tokens.
 *
 * Grammar (Lexical):
 *   IDENTIFIER  := [a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*
 *   STRING      := '"' [^"]* '"' | "'" [^']* "'"
 *   NUMBER      := [0-9]+(\.[0-9]+)?
 *   OPERATOR    := '==' | '!=' | '>=' | '<=' | '>' | '<'
 *   LPAREN      := '('
 *   RPAREN      := ')'
 *   LBRACKET    := '['
 *   RBRACKET    := ']'
 *   COMMA       := ','
 *   AND         := 'AND' (case-insensitive)
 *   OR          := 'OR' (case-insensitive)
 *   NOT         := 'NOT' (case-insensitive)
 *   IN          := 'IN' (case-insensitive)
 *   LIKE        := 'LIKE' (case-insensitive)
 *   TRUE        := 'true' | 'TRUE'
 *   FALSE       := 'false' | 'FALSE'
 *   NULL        := 'null' | 'NULL'
 *
 * @packageDocumentation
 */

/**
 * Token types for the expression DSL
 */
export type TokenType =
  | 'IDENTIFIER'
  | 'STRING'
  | 'NUMBER'
  | 'OPERATOR'
  | 'LPAREN'
  | 'RPAREN'
  | 'LBRACKET'
  | 'RBRACKET'
  | 'COMMA'
  | 'AND'
  | 'OR'
  | 'NOT'
  | 'IN'
  | 'LIKE'
  | 'TRUE'
  | 'FALSE'
  | 'NULL'
  | 'EOF';

/**
 * Token representing a single lexeme in the expression
 */
export interface Token {
  /** Type of the token */
  type: TokenType;
  /** Raw string value of the token */
  value: string;
  /** Position in the source string */
  position: number;
}

/**
 * Error thrown during lexical analysis
 */
export class LexerError extends Error {
  constructor(
    message: string,
    public position: number,
    public input: string
  ) {
    super(`Lexer error at position ${position}: ${message}`);
    this.name = 'LexerError';
  }
}

/**
 * Keywords mapping to their token types
 */
const KEYWORDS: Record<string, TokenType> = {
  AND: 'AND',
  OR: 'OR',
  NOT: 'NOT',
  IN: 'IN',
  LIKE: 'LIKE',
  TRUE: 'TRUE',
  FALSE: 'FALSE',
  NULL: 'NULL',
};

/**
 * Single character tokens
 */
const SINGLE_CHAR_TOKENS: Record<string, TokenType> = {
  '(': 'LPAREN',
  ')': 'RPAREN',
  '[': 'LBRACKET',
  ']': 'RBRACKET',
  ',': 'COMMA',
};

/**
 * Comparison operators (multi-character first for greedy matching)
 */
const OPERATORS = ['==', '!=', '>=', '<=', '>', '<'];

/**
 * Checks if a character is a valid identifier start
 */
function isIdentifierStart(char: string): boolean {
  return /[a-zA-Z_]/.test(char);
}

/**
 * Checks if a character is a valid identifier continuation
 */
function isIdentifierPart(char: string): boolean {
  return /[a-zA-Z0-9_]/.test(char);
}

/**
 * Checks if a character is a digit
 */
function isDigit(char: string): boolean {
  return /[0-9]/.test(char);
}

/**
 * Checks if a character is whitespace
 */
function isWhitespace(char: string): boolean {
  return /\s/.test(char);
}

/**
 * Tokenize an expression string into an array of tokens
 *
 * @param input - The expression string to tokenize
 * @returns Array of tokens including EOF
 * @throws LexerError if invalid characters or malformed tokens are found
 *
 * @example
 * ```ts
 * const tokens = tokenize("intent.action == 'read'");
 * // Returns: [
 * //   { type: 'IDENTIFIER', value: 'intent.action', position: 0 },
 * //   { type: 'OPERATOR', value: '==', position: 14 },
 * //   { type: 'STRING', value: 'read', position: 17 },
 * //   { type: 'EOF', value: '', position: 23 }
 * // ]
 * ```
 */
export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let position = 0;

  // Handle empty or whitespace-only input
  if (!input || input.trim() === '') {
    return [{ type: 'EOF', value: '', position: 0 }];
  }

  while (position < input.length) {
    const char = input[position];

    // Skip whitespace
    if (isWhitespace(char)) {
      position++;
      continue;
    }

    // Single character tokens
    if (char in SINGLE_CHAR_TOKENS) {
      tokens.push({
        type: SINGLE_CHAR_TOKENS[char],
        value: char,
        position,
      });
      position++;
      continue;
    }

    // Operators (check multi-char operators first)
    const operatorMatch = OPERATORS.find((op) =>
      input.slice(position, position + op.length) === op
    );
    if (operatorMatch) {
      tokens.push({
        type: 'OPERATOR',
        value: operatorMatch,
        position,
      });
      position += operatorMatch.length;
      continue;
    }

    // String literals (single or double quotes)
    if (char === '"' || char === "'") {
      const quote = char;
      const start = position;
      position++; // Skip opening quote

      let value = '';
      while (position < input.length && input[position] !== quote) {
        // Handle escape sequences
        if (input[position] === '\\' && position + 1 < input.length) {
          const nextChar = input[position + 1];
          if (nextChar === quote || nextChar === '\\') {
            value += nextChar;
            position += 2;
            continue;
          }
        }
        value += input[position];
        position++;
      }

      if (position >= input.length) {
        throw new LexerError('Unterminated string literal', start, input);
      }

      position++; // Skip closing quote
      tokens.push({
        type: 'STRING',
        value,
        position: start,
      });
      continue;
    }

    // Numbers
    if (isDigit(char) || (char === '-' && position + 1 < input.length && isDigit(input[position + 1]))) {
      const start = position;
      let value = '';

      // Handle negative sign
      if (char === '-') {
        value += char;
        position++;
      }

      // Integer part
      while (position < input.length && isDigit(input[position])) {
        value += input[position];
        position++;
      }

      // Decimal part
      if (position < input.length && input[position] === '.' &&
          position + 1 < input.length && isDigit(input[position + 1])) {
        value += '.';
        position++;
        while (position < input.length && isDigit(input[position])) {
          value += input[position];
          position++;
        }
      }

      tokens.push({
        type: 'NUMBER',
        value,
        position: start,
      });
      continue;
    }

    // Identifiers and keywords
    if (isIdentifierStart(char)) {
      const start = position;
      let value = '';

      // Read identifier parts (including dots for property access)
      while (position < input.length) {
        if (isIdentifierPart(input[position])) {
          value += input[position];
          position++;
        } else if (input[position] === '.' &&
                   position + 1 < input.length &&
                   isIdentifierStart(input[position + 1])) {
          // Dot notation for property access
          value += '.';
          position++;
        } else {
          break;
        }
      }

      // Check if it's a keyword
      const upperValue = value.toUpperCase();
      if (upperValue in KEYWORDS) {
        tokens.push({
          type: KEYWORDS[upperValue],
          value: upperValue,
          position: start,
        });
      } else {
        tokens.push({
          type: 'IDENTIFIER',
          value,
          position: start,
        });
      }
      continue;
    }

    // Unknown character
    throw new LexerError(`Unexpected character: '${char}'`, position, input);
  }

  // Add EOF token
  tokens.push({
    type: 'EOF',
    value: '',
    position: input.length,
  });

  return tokens;
}
