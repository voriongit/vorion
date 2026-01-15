/**
 * @vorion/atsf-core - Agentic Trust Scoring Framework
 *
 * Core runtime for AI agent governance, trust scoring, and policy enforcement.
 *
 * @packageDocumentation
 */

// Common types (core primitives)
export * from './common/types.js';

// BASIS - Rule evaluation engine (exclude EvaluationResult to avoid conflict)
export {
  RuleEvaluator,
  createEvaluator,
} from './basis/evaluator.js';
export {
  parseNamespace,
  validateRule,
  validateNamespace,
} from './basis/parser.js';
export type {
  Rule,
  RuleNamespace,
  RuleCondition,
  RuleResult,
  EvaluationContext,
  EvaluationResult as BasisEvaluationResult,
} from './basis/types.js';

// Intent service
export * from './intent/index.js';

// Enforcement service
export * from './enforce/index.js';

// Cognigate execution runtime
export * from './cognigate/index.js';

// Proof/audit chain
export * from './proof/index.js';

// Trust Engine
export * from './trust-engine/index.js';

// Persistence layer
export * from './persistence/index.js';

// LangChain integration
export * from './langchain/index.js';

// Version
export const VERSION = '0.1.0';

// Main entry point for server
export { createServer, startServer } from './api/server.js';
