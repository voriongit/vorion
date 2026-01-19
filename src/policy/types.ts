/**
 * Policy Engine Type Definitions
 *
 * Defines the structure for policies, conditions, and evaluation results.
 *
 * @packageDocumentation
 */

import type { ID, Timestamp, ControlAction, TrustLevel, Intent } from '../common/types.js';

// =============================================================================
// POLICY STATUS
// =============================================================================

export const POLICY_STATUSES = ['draft', 'published', 'deprecated', 'archived'] as const;
export type PolicyStatus = (typeof POLICY_STATUSES)[number];

// =============================================================================
// CONDITION OPERATORS
// =============================================================================

export const CONDITION_OPERATORS = [
  'equals',
  'not_equals',
  'greater_than',
  'less_than',
  'greater_than_or_equal',
  'less_than_or_equal',
  'in',
  'not_in',
  'contains',
  'not_contains',
  'starts_with',
  'ends_with',
  'matches', // regex
  'exists',
  'not_exists',
] as const;

export type ConditionOperator = (typeof CONDITION_OPERATORS)[number];

// =============================================================================
// LOGICAL OPERATORS
// =============================================================================

export const LOGICAL_OPERATORS = ['and', 'or', 'not'] as const;
export type LogicalOperator = (typeof LOGICAL_OPERATORS)[number];

// =============================================================================
// CONDITION DEFINITIONS
// =============================================================================

/**
 * Simple field condition
 */
export interface FieldCondition {
  type: 'field';
  field: string;
  operator: ConditionOperator;
  value: unknown;
}

/**
 * Compound condition using logical operators
 */
export interface CompoundCondition {
  type: 'compound';
  operator: LogicalOperator;
  conditions: PolicyCondition[];
}

/**
 * Trust level condition
 */
export interface TrustCondition {
  type: 'trust';
  level: TrustLevel;
  operator: 'equals' | 'greater_than' | 'less_than' | 'greater_than_or_equal' | 'less_than_or_equal';
}

/**
 * Time-based condition
 */
export interface TimeCondition {
  type: 'time';
  field: 'hour' | 'dayOfWeek' | 'date';
  operator: ConditionOperator;
  value: number | number[] | string;
  timezone?: string;
}

/**
 * Union of all condition types
 */
export type PolicyCondition =
  | FieldCondition
  | CompoundCondition
  | TrustCondition
  | TimeCondition;

// =============================================================================
// POLICY RULE DEFINITION
// =============================================================================

/**
 * Action to take when a rule matches
 */
export interface PolicyAction {
  action: ControlAction;
  reason?: string;
  escalation?: {
    to: string;
    timeout: string;
    requireJustification?: boolean;
    autoDenyOnTimeout?: boolean;
  };
  constraints?: Record<string, unknown>;
}

/**
 * Individual rule within a policy
 */
export interface PolicyRule {
  id: string;
  name: string;
  description?: string;
  priority: number;
  enabled: boolean;
  when: PolicyCondition;
  then: PolicyAction;
}

// =============================================================================
// POLICY DEFINITION
// =============================================================================

/**
 * Target scope for policy application
 */
export interface PolicyTarget {
  intentTypes?: string[];
  entityTypes?: string[];
  trustLevels?: TrustLevel[];
  namespaces?: string[];
}

/**
 * Complete policy definition (stored in JSONB)
 */
export interface PolicyDefinition {
  version: '1.0';
  target?: PolicyTarget;
  rules: PolicyRule[];
  defaultAction: ControlAction;
  defaultReason?: string;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// POLICY ENTITY
// =============================================================================

/**
 * Policy entity as stored in the database
 */
export interface Policy {
  id: ID;
  tenantId: ID;
  name: string;
  namespace: string;
  description?: string | null;
  version: number;
  status: PolicyStatus;
  definition: PolicyDefinition;
  checksum: string;
  createdBy?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  publishedAt?: Timestamp | null;
}

/**
 * Policy version record
 */
export interface PolicyVersion {
  id: ID;
  policyId: ID;
  version: number;
  definition: PolicyDefinition;
  checksum: string;
  changeSummary?: string | null;
  createdBy?: string | null;
  createdAt: Timestamp;
}

// =============================================================================
// EVALUATION CONTEXT
// =============================================================================

/**
 * Context provided for policy evaluation
 */
export interface PolicyEvaluationContext {
  intent: Intent;
  entity: {
    id: ID;
    type: string;
    trustScore: number;
    trustLevel: TrustLevel;
    attributes: Record<string, unknown>;
  };
  environment: {
    timestamp: Timestamp;
    timezone: string;
    requestId: ID;
  };
  custom?: Record<string, unknown>;
}

// =============================================================================
// EVALUATION RESULTS
// =============================================================================

/**
 * Result of evaluating a single rule
 */
export interface RuleEvaluationResult {
  ruleId: string;
  ruleName: string;
  matched: boolean;
  conditionsMet: boolean;
  action: ControlAction;
  reason?: string;
  durationMs: number;
}

/**
 * Result of evaluating a complete policy
 */
export interface PolicyEvaluationResult {
  policyId: ID;
  policyName: string;
  policyVersion: number;
  matched: boolean;
  action: ControlAction;
  reason?: string;
  rulesEvaluated: RuleEvaluationResult[];
  matchedRules: RuleEvaluationResult[];
  durationMs: number;
  evaluatedAt: Timestamp;
}

/**
 * Result of evaluating multiple policies
 */
export interface MultiPolicyEvaluationResult {
  passed: boolean;
  finalAction: ControlAction;
  reason?: string;
  policiesEvaluated: PolicyEvaluationResult[];
  appliedPolicy?: PolicyEvaluationResult;
  totalDurationMs: number;
  evaluatedAt: Timestamp;
}

// =============================================================================
// CREATE/UPDATE DTOs
// =============================================================================

export interface CreatePolicyInput {
  name: string;
  namespace?: string;
  description?: string;
  definition: PolicyDefinition;
  createdBy?: string;
}

export interface UpdatePolicyInput {
  description?: string;
  definition?: PolicyDefinition;
  status?: PolicyStatus;
  changeSummary?: string;
  updatedBy?: string;
}

export interface PolicyListFilters {
  tenantId: ID;
  namespace?: string;
  status?: PolicyStatus;
  name?: string;
  limit?: number;
  offset?: number;
}

// =============================================================================
// VALIDATION
// =============================================================================

export interface PolicyValidationError {
  path: string;
  message: string;
  code: string;
}

export interface PolicyValidationResult {
  valid: boolean;
  errors: PolicyValidationError[];
}
