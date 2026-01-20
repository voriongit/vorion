/**
 * Policy Engine
 *
 * Provides policy-based access control for intent governance.
 *
 * @packageDocumentation
 */

// Types
export type {
  PolicyStatus,
  ConditionOperator,
  LogicalOperator,
  FieldCondition,
  CompoundCondition,
  TrustCondition,
  TimeCondition,
  PolicyCondition,
  PolicyAction,
  PolicyRule,
  PolicyTarget,
  PolicyDefinition,
  Policy,
  PolicyVersion,
  PolicyEvaluationContext,
  RuleEvaluationResult,
  PolicyEvaluationResult,
  MultiPolicyEvaluationResult,
  CreatePolicyInput,
  UpdatePolicyInput,
  PolicyListFilters,
  PolicyValidationError,
  PolicyValidationResult,
} from './types.js';

export {
  POLICY_STATUSES,
  CONDITION_OPERATORS,
  LOGICAL_OPERATORS,
} from './types.js';

// Service
export {
  PolicyService,
  PolicyValidationException,
  createPolicyService,
  validatePolicyDefinition,
} from './service.js';

// Evaluator
export {
  PolicyEvaluator,
  createPolicyEvaluator,
} from './evaluator.js';

// Loader
export {
  PolicyLoader,
  getPolicyLoader,
  createPolicyLoader,
  resetPolicyLoader,
} from './loader.js';
