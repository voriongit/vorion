/**
 * Governance Engine
 *
 * Provides policy-based governance for AI intent evaluation.
 *
 * @packageDocumentation
 */

// Engine
export {
  GovernanceEngine,
  createGovernanceEngine,
  type GovernanceEngineOptions,
  type EvaluationResult,
  type PolicyAuditEntry,
  type RuleAuditEntry,
} from './engine.js';

// Policy types and management
export {
  type Policy,
  type PolicySet,
  type PolicyEffect,
  type PolicyConditions,
  type Rule,
  type RuleGroup,
  type RuleLogic,
  type RuleOperator,
  type ConflictResolutionStrategy,
  RULE_OPERATORS,
  PolicySetManager,
  resolveConflicts,
  createPolicy,
  createPolicySet,
} from './policy.js';

// Evaluator
export {
  RuleEvaluator,
  createRuleEvaluator,
  type EvaluationContext,
  type RuleMatchResult,
  type RuleGroupResult,
  type PolicyMatchResult,
} from './evaluator.js';
