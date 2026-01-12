/**
 * BASIS Type Definitions
 *
 * TypeScript types for the BASIS governance standard.
 */

/**
 * BASIS specification version
 */
export type BasisVersion = '1.0' | '1.1';

/**
 * Trust levels (L0-L4)
 */
export type TrustLevel = 0 | 1 | 2 | 3 | 4;

/**
 * Trust score (0-1000)
 */
export type TrustScore = number;

/**
 * Constraint types
 */
export type ConstraintType =
  | 'egress_whitelist'
  | 'egress_blacklist'
  | 'ingress_whitelist'
  | 'ingress_blacklist'
  | 'data_protection'
  | 'tool_restriction'
  | 'resource_limit'
  | 'time_window'
  | 'rate_limit'
  | 'content_filter'
  | 'scope_boundary'
  | 'custom';

/**
 * Constraint actions
 */
export type ConstraintAction =
  | 'block'
  | 'redact'
  | 'mask'
  | 'truncate'
  | 'warn'
  | 'log';

/**
 * Constraint severity levels
 */
export type ConstraintSeverity = 'critical' | 'high' | 'medium' | 'low';

/**
 * Named patterns for data protection
 */
export type NamedPatternId =
  | 'ssn_us'
  | 'ssn_uk'
  | 'credit_card'
  | 'email'
  | 'phone_us'
  | 'phone_intl'
  | 'ip_address'
  | 'api_key'
  | 'jwt_token'
  | 'password'
  | 'pii_name'
  | 'pii_address'
  | 'pii_dob'
  | 'phi_medical'
  | 'financial_account';

/**
 * Obligation actions
 */
export type ObligationAction =
  | 'require_human_approval'
  | 'require_mfa'
  | 'require_attestation'
  | 'notify'
  | 'audit_log'
  | 'escalate'
  | 'delay'
  | 'checkpoint'
  | 'custom';

/**
 * Permission types
 */
export type PermissionType =
  | 'tool_access'
  | 'endpoint_access'
  | 'data_access'
  | 'resource_access'
  | 'namespace_access'
  | 'capability';

/**
 * Comparison operators for triggers
 */
export type TriggerOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'not_contains'
  | 'matches'
  | 'in'
  | 'not_in';

/**
 * Decision outcomes
 */
export type DecisionAction = 'allow' | 'deny' | 'escalate' | 'pending';

/**
 * Policy metadata
 */
export interface PolicyMetadata {
  name: string;
  description?: string;
  version: string;
  created_at: string;
  updated_at?: string;
  author?: string;
  organization?: string;
  tags?: string[];
  jurisdiction?: string[];
}

/**
 * Trust requirements
 */
export interface TrustRequirements {
  minimum_level?: TrustLevel;
  minimum_score?: TrustScore;
  required_attestations?: string[];
}

/**
 * Constraint threshold
 */
export interface ConstraintThreshold {
  value: number;
  unit:
    | 'count'
    | 'bytes'
    | 'kb'
    | 'mb'
    | 'gb'
    | 'ms'
    | 'seconds'
    | 'minutes'
    | 'hours'
    | 'requests'
    | 'tokens';
  window?: string;
}

/**
 * Constraint scope
 */
export interface ConstraintScope {
  namespaces?: string[];
  tools?: string[];
  trust_levels?: TrustLevel[];
}

/**
 * Constraint definition
 */
export interface Constraint {
  id?: string;
  type: ConstraintType;
  action: ConstraintAction;
  severity?: ConstraintSeverity;
  values?: string[];
  pattern?: string;
  named_pattern?: NamedPatternId;
  threshold?: ConstraintThreshold;
  scope?: ConstraintScope;
  message?: string;
  enabled?: boolean;
}

/**
 * Trigger condition
 */
export interface TriggerCondition {
  field: string;
  operator: TriggerOperator;
  value: unknown;
  and?: TriggerCondition[];
  or?: TriggerCondition[];
}

/**
 * Obligation parameters
 */
export interface ObligationParameters {
  approvers?: string[];
  timeout?: string;
  channels?: string[];
  audit_level?: 'minimal' | 'standard' | 'detailed' | 'forensic';
  delay_duration?: string;
  custom_handler?: string;
}

/**
 * Obligation definition
 */
export interface Obligation {
  id?: string;
  trigger: string | TriggerCondition;
  action: ObligationAction;
  parameters?: ObligationParameters;
  priority?: number;
  message?: string;
  enabled?: boolean;
}

/**
 * Permission definition
 */
export interface Permission {
  id?: string;
  type: PermissionType;
  values: string[];
  conditions?: TriggerCondition[];
  trust_level_required?: TrustLevel;
  expires_at?: string;
  message?: string;
  enabled?: boolean;
}

/**
 * Escalation level
 */
export interface EscalationLevel {
  level: number;
  contacts: string[];
  timeout?: string;
  channels?: ('email' | 'sms' | 'slack' | 'pagerduty' | 'webhook')[];
}

/**
 * Escalation policy
 */
export interface EscalationPolicy {
  default_timeout?: string;
  levels?: EscalationLevel[];
  fallback_action?: 'block' | 'allow_with_audit' | 'queue';
}

/**
 * Inheritance configuration
 */
export interface InheritanceConfig {
  extends?: string[];
  override_mode?: 'merge' | 'replace' | 'strict';
}

/**
 * Complete Policy Bundle
 */
export interface PolicyBundle {
  $schema?: string;
  basis_version: BasisVersion;
  policy_id: string;
  metadata: PolicyMetadata;
  trust_requirements?: TrustRequirements;
  constraints?: Constraint[];
  obligations?: Obligation[];
  permissions?: Permission[];
  escalation?: EscalationPolicy;
  inheritance?: InheritanceConfig;
}

/**
 * Constraint evaluation result
 */
export interface ConstraintEvaluation {
  constraint_id: string;
  passed: boolean;
  action: ConstraintAction;
  reason?: string;
  details?: Record<string, unknown>;
  duration_ms: number;
  evaluated_at: string;
}

/**
 * Obligation evaluation result
 */
export interface ObligationEvaluation {
  obligation_id: string;
  triggered: boolean;
  action: ObligationAction;
  parameters?: ObligationParameters;
  evaluated_at: string;
}

/**
 * Policy decision
 */
export interface PolicyDecision {
  intent_id: string;
  action: DecisionAction;
  policy_id: string;
  constraints_evaluated: ConstraintEvaluation[];
  obligations_triggered: ObligationEvaluation[];
  permissions_granted: string[];
  trust_score: TrustScore;
  trust_level: TrustLevel;
  decided_at: string;
}
