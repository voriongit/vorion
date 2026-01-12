/**
 * Policy Bundle types - compliance rules as data
 */

import type { DataSensitivity, TrustBand, ActionType } from './enums.js';

/**
 * Operator for policy conditions
 */
export enum PolicyOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  GREATER_OR_EQUAL = 'greater_or_equal',
  LESS_OR_EQUAL = 'less_or_equal',
  IN = 'in',
  NOT_IN = 'not_in',
  CONTAINS = 'contains',
  MATCHES = 'matches',
}

/**
 * Policy condition
 */
export interface PolicyCondition {
  /** Field to evaluate */
  field: string;
  /** Comparison operator */
  operator: PolicyOperator;
  /** Value to compare against */
  value: unknown;
}

/**
 * Policy rule - a single authorization rule
 */
export interface PolicyRule {
  /** Unique rule identifier */
  ruleId: string;
  /** Rule name */
  name: string;
  /** Rule description */
  description: string;
  /** Priority (lower = higher priority) */
  priority: number;
  /** Conditions that must be met */
  conditions: PolicyCondition[];
  /** Effect when conditions match */
  effect: 'permit' | 'deny';
  /** Optional constraints to apply if permitted */
  constraints?: Partial<{
    requiredApprovals: string[];
    allowedTools: string[];
    dataScopes: string[];
    maxExecutionTimeMs: number;
    reversibilityRequired: boolean;
  }>;
  /** Is this rule active? */
  enabled: boolean;
}

/**
 * Jurisdiction restrictions
 */
export interface JurisdictionRestrictions {
  /** Allowed jurisdictions */
  allowedJurisdictions: string[];
  /** Blocked jurisdictions */
  blockedJurisdictions: string[];
  /** Data residency requirements */
  dataResidency?: string[];
  /** Cross-border transfer allowed? */
  crossBorderAllowed: boolean;
}

/**
 * Data classification policy
 */
export interface DataClassificationPolicy {
  /** Sensitivity levels this bundle handles */
  allowedSensitivities: DataSensitivity[];
  /** Minimum trust band for each sensitivity */
  minimumTrustByClassification: Partial<Record<DataSensitivity, TrustBand>>;
  /** Encryption required for these classifications */
  encryptionRequired: DataSensitivity[];
  /** Audit required for these classifications */
  auditRequired: DataSensitivity[];
}

/**
 * Action restrictions by trust band
 */
export interface ActionRestrictions {
  /** Action types allowed per trust band */
  allowedByBand: Partial<Record<TrustBand, ActionType[]>>;
  /** Actions that always require approval */
  alwaysRequireApproval: ActionType[];
  /** Actions that are never allowed */
  neverAllowed: ActionType[];
}

/**
 * Policy bundle - a collection of related policies
 */
export interface PolicyBundle {
  /** Unique bundle identifier */
  bundleId: string;
  /** Bundle name */
  name: string;
  /** Bundle description */
  description: string;
  /** Version (semver) */
  version: string;
  /** Is this bundle active? */
  enabled: boolean;

  /** Domains this bundle applies to */
  applicableDomains: string[];
  /** Environments (prod, staging, dev) */
  applicableEnvironments: string[];
  /** Jurisdictions */
  jurisdictions: JurisdictionRestrictions;

  /** Data classification policies */
  dataClassification: DataClassificationPolicy;

  /** Action restrictions */
  actionRestrictions: ActionRestrictions;

  /** Individual rules */
  rules: PolicyRule[];

  /** Default effect when no rules match */
  defaultEffect: 'permit' | 'deny';

  /** Metadata */
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

/**
 * Policy evaluation result
 */
export interface PolicyEvaluationResult {
  /** Was access permitted? */
  permitted: boolean;
  /** Which rule(s) matched */
  matchedRules: string[];
  /** Combined constraints from all matching rules */
  constraints: PolicyRule['constraints'];
  /** Reasoning for the decision */
  reasoning: string[];
  /** Time to evaluate (ms) */
  evaluationTimeMs: number;
}

/**
 * Request to resolve applicable policies
 */
export interface PolicyResolutionRequest {
  domain?: string;
  environment?: string;
  jurisdictions?: string[];
  dataSensitivity?: DataSensitivity;
  actionType?: ActionType;
  trustBand?: TrustBand;
}

/**
 * Policy bundle summary for listings
 */
export interface PolicyBundleSummary {
  bundleId: string;
  name: string;
  version: string;
  enabled: boolean;
  applicableDomains: string[];
  ruleCount: number;
  updatedAt: Date;
}
