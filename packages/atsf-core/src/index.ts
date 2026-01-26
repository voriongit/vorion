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

// Decision Provenance (DPO)
export * from './provenance/index.js';

// Trust Engine
export * from './trust-engine/index.js';

// Typed Security Layers
export * from './layers/index.js';

// Multi-Agent Trust Arbitration
export * from './arbitration/index.js';

// Progressive Containment
export * from './containment/index.js';

// Output Contracts (VorionResponse)
export * from './contracts/index.js';

// Governance & Authority Engine
export * from './governance/index.js';

// Persistence layer
export * from './persistence/index.js';

// LangChain integration
export * from './langchain/index.js';

// Phase 6: Trust Engine Hardening
export * as phase6 from './phase6/index.js';
export {
  createPhase6TrustEngine,
  type Phase6TrustEngine,
  type Phase6Config,
  PHASE6_VERSION,
} from './phase6/index.js';

// Version
export const VERSION = '0.1.0';

// Main entry point for server
export { createServer, startServer } from './api/server.js';
