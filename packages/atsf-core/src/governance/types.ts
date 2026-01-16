/**
 * Governance & Authority Engine Types
 *
 * Rule hierarchy with hard disqualifiers, soft constraints,
 * mandatory clarification triggers, and authority management.
 *
 * @packageDocumentation
 */

import type { ID, Timestamp, TrustLevel, ControlAction } from '../common/types.js';

/**
 * Rule categories in priority order
 */
export type RuleCategory =
  | 'hard_disqualifier'     // Absolute blocks, no override possible
  | 'regulatory_mandate'    // Legal/compliance requirements
  | 'security_critical'     // Security-sensitive rules
  | 'policy_enforcement'    // Organizational policy rules
  | 'soft_constraint'       // Preferences, can be overridden
  | 'clarification_trigger' // Requires human clarification
  | 'logging_only';         // Informational, no enforcement

/**
 * Priority values for rule categories
 */
export const RuleCategoryPriority: Record<RuleCategory, number> = {
  hard_disqualifier: 0,     // Highest priority
  regulatory_mandate: 1,
  security_critical: 2,
  policy_enforcement: 3,
  soft_constraint: 4,
  clarification_trigger: 5,
  logging_only: 6,          // Lowest priority
};

/**
 * A governance rule
 */
export interface GovernanceRule {
  /** Unique rule identifier */
  ruleId: ID;

  /** Human-readable name */
  name: string;

  /** Description of what this rule does */
  description: string;

  /** Rule category (determines priority) */
  category: RuleCategory;

  /** Namespace for rule grouping */
  namespace: string;

  /** Version of this rule */
  version: string;

  /** Condition that triggers this rule */
  condition: RuleCondition;

  /** Effect when rule matches */
  effect: RuleEffect;

  /** Exceptions to this rule */
  exceptions: RuleException[];

  /** When the rule is active */
  schedule?: RuleSchedule;

  /** Trust levels this rule applies to */
  applicableTrustLevels: TrustLevel[];

  /** Whether rule is enabled */
  enabled: boolean;

  /** Audit information */
  audit: RuleAudit;
}

/**
 * Condition that triggers a rule
 */
export interface RuleCondition {
  /** Condition type */
  type: ConditionType;

  /** Field to evaluate */
  field: string;

  /** Operator to apply */
  operator: ConditionOperator;

  /** Value to compare against */
  value: unknown;

  /** Nested conditions for complex logic */
  children?: RuleCondition[];

  /** Logical operator for children */
  logicalOperator?: 'AND' | 'OR' | 'NOT';
}

/**
 * Types of conditions
 */
export type ConditionType =
  | 'field_match'       // Simple field comparison
  | 'capability_check'  // Capability requirement
  | 'trust_threshold'   // Trust score check
  | 'resource_limit'    // Resource usage check
  | 'time_window'       // Time-based condition
  | 'pattern_match'     // Regex or pattern matching
  | 'composite'         // Combination of conditions
  | 'custom';           // Custom evaluator

/**
 * Operators for conditions
 */
export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'greater_or_equal'
  | 'less_or_equal'
  | 'contains'
  | 'not_contains'
  | 'matches'
  | 'in'
  | 'not_in'
  | 'exists'
  | 'not_exists';

/**
 * Effect when a rule matches
 */
export interface RuleEffect {
  /** Action to take */
  action: ControlAction;

  /** Reason for this effect */
  reason: string;

  /** Modifications to apply */
  modifications?: EffectModification[];

  /** Constraints to enforce */
  constraints?: EffectConstraint[];

  /** Required clarification (if action is clarify) */
  clarification?: ClarificationRequirement;

  /** Escalation path */
  escalation?: EscalationPath;
}

/**
 * Modification applied by a rule effect
 */
export interface EffectModification {
  target: string;
  operation: 'set' | 'append' | 'remove' | 'redact' | 'transform';
  value?: unknown;
  reason: string;
}

/**
 * Constraint applied by a rule effect
 */
export interface EffectConstraint {
  type: 'scope' | 'rate' | 'capability' | 'data' | 'time';
  constraint: string;
  value: unknown;
  reason: string;
}

/**
 * Clarification requirement
 */
export interface ClarificationRequirement {
  /** What needs clarification */
  question: string;

  /** Options for clarification */
  options: ClarificationOption[];

  /** Timeout for clarification */
  timeoutMs: number;

  /** Action if clarification times out */
  timeoutAction: ControlAction;

  /** Who can provide clarification */
  authorizedResponders: string[];
}

/**
 * Option in a clarification request
 */
export interface ClarificationOption {
  id: string;
  label: string;
  description: string;
  resultingAction: ControlAction;
}

/**
 * Escalation path for a rule
 */
export interface EscalationPath {
  /** Levels of escalation */
  levels: EscalationLevel[];

  /** Default timeout before auto-escalation */
  defaultTimeoutMs: number;

  /** Final action if all escalations timeout */
  finalAction: ControlAction;
}

/**
 * A level in the escalation path
 */
export interface EscalationLevel {
  level: number;
  name: string;
  approvers: string[];
  timeoutMs: number;
  notificationChannels: string[];
}

/**
 * Exception to a rule
 */
export interface RuleException {
  /** Exception identifier */
  exceptionId: ID;

  /** Condition for exception */
  condition: RuleCondition;

  /** Why this exception exists */
  reason: string;

  /** When exception expires */
  expiresAt?: Timestamp;

  /** Who approved this exception */
  approvedBy: string;

  /** When approved */
  approvedAt: Timestamp;
}

/**
 * Schedule for rule activation
 */
export interface RuleSchedule {
  /** Timezone for schedule */
  timezone: string;

  /** Active time windows */
  windows: TimeWindow[];

  /** Blackout periods */
  blackouts: TimeWindow[];
}

/**
 * Time window
 */
export interface TimeWindow {
  /** Days of week (0 = Sunday) */
  daysOfWeek: number[];

  /** Start time (HH:MM) */
  startTime: string;

  /** End time (HH:MM) */
  endTime: string;
}

/**
 * Audit information for a rule
 */
export interface RuleAudit {
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
  approvedAt?: Timestamp;
  approvedBy?: string;
  changeHistory: RuleChange[];
}

/**
 * Change record for a rule
 */
export interface RuleChange {
  timestamp: Timestamp;
  changedBy: string;
  changeType: 'create' | 'update' | 'enable' | 'disable' | 'delete';
  changes: Record<string, { before: unknown; after: unknown }>;
  reason: string;
}

/**
 * Authority definition
 */
export interface Authority {
  /** Authority identifier */
  authorityId: ID;

  /** Authority name */
  name: string;

  /** Authority type */
  type: AuthorityType;

  /** Scope of authority */
  scope: AuthorityScope;

  /** Permissions granted */
  permissions: Permission[];

  /** Delegation chain */
  delegatedFrom?: ID;

  /** Trust level required to use this authority */
  requiredTrustLevel: TrustLevel;

  /** When authority expires */
  expiresAt?: Timestamp;

  /** Is authority active */
  active: boolean;
}

/**
 * Types of authority
 */
export type AuthorityType =
  | 'system'      // Built-in system authority
  | 'role'        // Role-based authority
  | 'delegated'   // Delegated from another authority
  | 'temporary'   // Time-limited authority
  | 'emergency';  // Emergency override authority

/**
 * Scope of authority
 */
export interface AuthorityScope {
  /** Namespaces authority applies to */
  namespaces: string[];

  /** Actions authority can perform */
  actions: ControlAction[];

  /** Resources authority applies to */
  resources: string[];

  /** Capabilities authority can grant */
  capabilities: string[];
}

/**
 * Permission granted by authority
 */
export interface Permission {
  permissionId: ID;
  action: string;
  resource: string;
  conditions: RuleCondition[];
  granted: boolean;
}

/**
 * Request to evaluate governance rules
 */
export interface GovernanceRequest {
  /** Request identifier */
  requestId: ID;

  /** Entity making the request */
  entityId: ID;

  /** Entity's trust level */
  trustLevel: TrustLevel;

  /** Action being requested */
  action: string;

  /** Capabilities required */
  capabilities: string[];

  /** Resources involved */
  resources: string[];

  /** Context for evaluation */
  context: Record<string, unknown>;

  /** Authority being invoked */
  authority?: ID;
}

/**
 * Result of governance evaluation
 */
export interface GovernanceResult {
  /** Result identifier */
  resultId: ID;

  /** Request that was evaluated */
  requestId: ID;

  /** Final decision */
  decision: ControlAction;

  /** Confidence in decision */
  confidence: number;

  /** All rules evaluated */
  rulesEvaluated: EvaluatedRule[];

  /** Rules that matched */
  rulesMatched: EvaluatedRule[];

  /** Rule that determined the decision */
  decidingRule: EvaluatedRule;

  /** Modifications applied */
  modifications: EffectModification[];

  /** Constraints applied */
  constraints: EffectConstraint[];

  /** Clarification needed (if any) */
  clarificationNeeded?: ClarificationRequirement;

  /** Explanation of decision */
  explanation: string;

  /** When evaluated */
  evaluatedAt: Timestamp;

  /** Duration of evaluation */
  durationMs: number;
}

/**
 * A rule that was evaluated
 */
export interface EvaluatedRule {
  ruleId: ID;
  ruleName: string;
  category: RuleCategory;
  matched: boolean;
  effect?: RuleEffect;
  matchReason: string;
  evaluationMs: number;
}

/**
 * Configuration for governance engine
 */
export interface GovernanceConfig {
  /** Default action when no rules match */
  defaultAction: ControlAction;

  /** Enable strict mode (fail on evaluation errors) */
  strictMode: boolean;

  /** Maximum rules to evaluate per request */
  maxRulesPerRequest: number;

  /** Rule evaluation timeout */
  evaluationTimeoutMs: number;

  /** Enable rule caching */
  enableCaching: boolean;

  /** Cache TTL in ms */
  cacheTtlMs: number;

  /** Namespaces to load */
  enabledNamespaces: string[];
}

/**
 * Query for governance rules
 */
export interface RuleQuery {
  namespace?: string;
  category?: RuleCategory;
  enabled?: boolean;
  trustLevel?: TrustLevel;
  limit?: number;
  offset?: number;
}
