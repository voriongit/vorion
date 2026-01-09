/**
 * BASIS type definitions
 */

import type { ID, Timestamp, ControlAction } from '../common/types.js';

/**
 * Rule namespace for organizing constraints
 */
export interface RuleNamespace {
  id: ID;
  name: string;
  description: string;
  version: string;
  rules: Rule[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Individual rule definition
 */
export interface Rule {
  id: ID;
  name: string;
  description: string;
  priority: number;
  enabled: boolean;
  when: RuleCondition;
  evaluate: RuleEvaluation[];
  metadata: Record<string, unknown>;
}

/**
 * Condition that triggers rule evaluation
 */
export interface RuleCondition {
  intentType?: string | string[];
  entityType?: string | string[];
  conditions?: ConditionExpression[];
}

/**
 * Condition expression
 */
export interface ConditionExpression {
  field: string;
  operator: ConditionOperator;
  value: unknown;
}

/**
 * Supported condition operators
 */
export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'in'
  | 'not_in'
  | 'contains'
  | 'not_contains'
  | 'matches'
  | 'exists'
  | 'not_exists';

/**
 * Rule evaluation step
 */
export interface RuleEvaluation {
  condition: string;
  result: ControlAction;
  reason?: string;
  escalation?: EscalationConfig;
}

/**
 * Escalation configuration
 */
export interface EscalationConfig {
  to: string;
  timeout: string;
  requireJustification?: boolean;
  autoDenyOnTimeout?: boolean;
}

/**
 * Context provided for rule evaluation
 */
export interface EvaluationContext {
  intent: {
    id: ID;
    type: string;
    goal: string;
    context: Record<string, unknown>;
  };
  entity: {
    id: ID;
    type: string;
    trustScore: number;
    trustLevel: number;
    attributes: Record<string, unknown>;
  };
  environment: {
    timestamp: Timestamp;
    timezone: string;
    requestId: ID;
  };
  custom: Record<string, unknown>;
}

/**
 * Result of evaluating a single rule
 */
export interface RuleResult {
  ruleId: ID;
  ruleName: string;
  matched: boolean;
  action: ControlAction;
  reason: string;
  details: Record<string, unknown>;
  durationMs: number;
}

/**
 * Result of evaluating all applicable rules
 */
export interface EvaluationResult {
  passed: boolean;
  finalAction: ControlAction;
  rulesEvaluated: RuleResult[];
  violatedRules: RuleResult[];
  totalDurationMs: number;
  evaluatedAt: Timestamp;
}
