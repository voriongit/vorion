/**
 * @vorion/basis-core
 *
 * Reference implementation of the BASIS governance standard
 * for autonomous agent policy validation.
 *
 * @packageDocumentation
 */

export { validatePolicy, ValidationResult } from './validator.js';
export { parsePolicy, ParseResult } from './parser.js';
export { evaluateConstraints, ConstraintResult } from './evaluator.js';
export { matchPattern, NamedPattern } from './patterns.js';
export * from './types.js';

/**
 * Library version
 */
export const VERSION = '1.0.0';

/**
 * Supported BASIS specification version
 */
export const SPEC_VERSION = '1.0';
