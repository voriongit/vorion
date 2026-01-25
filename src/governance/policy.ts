/**
 * Governance Policy Types and Management
 *
 * Defines policy structures for governance engine evaluation.
 *
 * @packageDocumentation
 */

import type { ID, Timestamp, ControlAction } from '../common/types.js';

// =============================================================================
// RULE OPERATORS
// =============================================================================

/**
 * Comparison operators for rule evaluation
 */
export const RULE_OPERATORS = [
  'eq',       // equals
  'ne',       // not equals
  'gt',       // greater than
  'lt',       // less than
  'gte',      // greater than or equal
  'lte',      // less than or equal
  'in',       // value in array
  'contains', // string contains
  'matches',  // regex match
] as const;

export type RuleOperator = (typeof RULE_OPERATORS)[number];

// =============================================================================
// RULE DEFINITION
// =============================================================================

/**
 * Individual rule for policy evaluation
 */
export interface Rule {
  /** Field path to evaluate (e.g., 'intent.goal', 'context.resource') */
  field: string;
  /** Comparison operator */
  operator: RuleOperator;
  /** Value to compare against */
  value: unknown;
}

/**
 * Logical combination of rules
 */
export type RuleLogic = 'AND' | 'OR';

/**
 * Rule group with logical combination
 */
export interface RuleGroup {
  /** Logical operator for combining rules */
  logic: RuleLogic;
  /** Rules to evaluate */
  rules: Rule[];
}

// =============================================================================
// POLICY EFFECTS
// =============================================================================

/**
 * Policy effect - what happens when policy matches
 */
export type PolicyEffect = 'allow' | 'deny';

// =============================================================================
// POLICY DEFINITION
// =============================================================================

/**
 * Policy matching conditions
 */
export interface PolicyConditions {
  /** Match on specific actions/goals */
  actions?: string[];
  /** Match on resource patterns */
  resources?: string[];
  /** Match on intent types */
  intentTypes?: string[];
  /** Match on entity types */
  entityTypes?: string[];
  /** Custom conditions as rule group */
  custom?: RuleGroup;
}

/**
 * Policy definition for governance evaluation
 */
export interface Policy {
  /** Unique policy identifier */
  id: ID;
  /** Human-readable policy name */
  name: string;
  /** Policy description */
  description?: string;
  /** Matching rules as a rule group */
  rules: RuleGroup;
  /** Effect when policy matches */
  effect: PolicyEffect;
  /** Priority (lower number = higher priority) */
  priority: number;
  /** Optional conditions for policy matching */
  conditions?: PolicyConditions;
  /** Is policy enabled */
  enabled: boolean;
  /** Policy metadata */
  metadata?: Record<string, unknown>;
  /** Creation timestamp */
  createdAt?: Timestamp;
  /** Update timestamp */
  updatedAt?: Timestamp;
}

// =============================================================================
// POLICY SET
// =============================================================================

/**
 * A set of policies for evaluation
 */
export interface PolicySet {
  /** Unique identifier */
  id: ID;
  /** Policy set name */
  name: string;
  /** Policies in this set */
  policies: Policy[];
  /** Default effect if no policies match */
  defaultEffect: PolicyEffect;
  /** Evaluation strategy */
  evaluationStrategy: 'first-match' | 'all-match' | 'deny-overrides';
}

// =============================================================================
// POLICY CONFLICT RESOLUTION
// =============================================================================

/**
 * Conflict resolution strategy
 */
export type ConflictResolutionStrategy =
  | 'deny-overrides'    // Any deny wins
  | 'allow-overrides'   // Any allow wins
  | 'first-match'       // First matching policy wins
  | 'priority-based';   // Highest priority wins

/**
 * Resolve policy conflicts
 */
export function resolveConflicts(
  effects: { effect: PolicyEffect; priority: number }[],
  strategy: ConflictResolutionStrategy
): PolicyEffect {
  if (effects.length === 0) {
    return 'allow'; // Default to allow if no policies
  }

  switch (strategy) {
    case 'deny-overrides':
      // Any deny wins
      return effects.some(e => e.effect === 'deny') ? 'deny' : 'allow';

    case 'allow-overrides':
      // Any allow wins
      return effects.some(e => e.effect === 'allow') ? 'allow' : 'deny';

    case 'first-match':
      // First effect in the list
      return effects[0]!.effect;

    case 'priority-based':
      // Sort by priority (lower = higher priority) and take first
      const sorted = [...effects].sort((a, b) => a.priority - b.priority);
      return sorted[0]!.effect;

    default:
      return 'deny'; // Default to deny for safety
  }
}

// =============================================================================
// POLICY MANAGEMENT
// =============================================================================

/**
 * PolicySet manager for organizing and querying policies
 */
export class PolicySetManager {
  private policySets: Map<ID, PolicySet> = new Map();

  /**
   * Add a policy set
   */
  addPolicySet(policySet: PolicySet): void {
    this.policySets.set(policySet.id, policySet);
  }

  /**
   * Remove a policy set
   */
  removePolicySet(id: ID): boolean {
    return this.policySets.delete(id);
  }

  /**
   * Get a policy set by ID
   */
  getPolicySet(id: ID): PolicySet | undefined {
    return this.policySets.get(id);
  }

  /**
   * Get all policy sets
   */
  getAllPolicySets(): PolicySet[] {
    return Array.from(this.policySets.values());
  }

  /**
   * Get all enabled policies from all sets, sorted by priority
   */
  getAllEnabledPolicies(): Policy[] {
    const allPolicies: Policy[] = [];
    for (const policySet of this.policySets.values()) {
      for (const policy of policySet.policies) {
        if (policy.enabled) {
          allPolicies.push(policy);
        }
      }
    }
    return allPolicies.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Find policies matching conditions
   */
  findMatchingPolicies(
    action?: string,
    resource?: string,
    intentType?: string
  ): Policy[] {
    const policies = this.getAllEnabledPolicies();
    return policies.filter(policy => {
      if (!policy.conditions) return true;

      // Check action match
      if (policy.conditions.actions && action) {
        const matches = policy.conditions.actions.some(a =>
          a === '*' || a === action || (a.endsWith('*') && action.startsWith(a.slice(0, -1)))
        );
        if (!matches) return false;
      }

      // Check resource match
      if (policy.conditions.resources && resource) {
        const matches = policy.conditions.resources.some(r =>
          r === '*' || r === resource || (r.endsWith('*') && resource.startsWith(r.slice(0, -1)))
        );
        if (!matches) return false;
      }

      // Check intent type match
      if (policy.conditions.intentTypes && intentType) {
        const matches = policy.conditions.intentTypes.some(t =>
          t === '*' || t === intentType || (t.endsWith('*') && intentType.startsWith(t.slice(0, -1)))
        );
        if (!matches) return false;
      }

      return true;
    });
  }

  /**
   * Clear all policy sets
   */
  clear(): void {
    this.policySets.clear();
  }
}

/**
 * Create a new policy with defaults
 */
export function createPolicy(
  partial: Partial<Policy> & Pick<Policy, 'id' | 'name' | 'rules' | 'effect'>
): Policy {
  return {
    priority: 100,
    enabled: true,
    ...partial,
  };
}

/**
 * Create a new policy set with defaults
 */
export function createPolicySet(
  partial: Partial<PolicySet> & Pick<PolicySet, 'id' | 'name' | 'policies'>
): PolicySet {
  return {
    defaultEffect: 'deny',
    evaluationStrategy: 'deny-overrides',
    ...partial,
  };
}
