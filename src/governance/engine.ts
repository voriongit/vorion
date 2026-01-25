/**
 * Governance Engine
 *
 * Core engine for evaluating intents against policies and making governance decisions.
 *
 * @packageDocumentation
 */

import { createLogger } from '../common/logger.js';
import { withSpan, type TraceSpan } from '../common/trace.js';
import type { Intent, ControlAction, ID, Timestamp } from '../common/types.js';
import {
  type Policy,
  type PolicySet,
  type PolicyEffect,
  type ConflictResolutionStrategy,
  resolveConflicts,
  PolicySetManager,
} from './policy.js';
import {
  RuleEvaluator,
  type EvaluationContext,
  type PolicyMatchResult,
  type RuleMatchResult,
} from './evaluator.js';

const logger = createLogger({ component: 'governance-engine' });

// =============================================================================
// EVALUATION RESULT
// =============================================================================

/**
 * Detailed audit trail entry for rule matching
 */
export interface RuleAuditEntry {
  /** Policy ID */
  policyId: ID;
  /** Policy name */
  policyName: string;
  /** Rule field */
  field: string;
  /** Rule operator */
  operator: string;
  /** Expected value */
  expectedValue: unknown;
  /** Actual value */
  actualValue: unknown;
  /** Whether the rule matched */
  matched: boolean;
}

/**
 * Policy evaluation audit entry
 */
export interface PolicyAuditEntry {
  /** Policy ID */
  policyId: ID;
  /** Policy name */
  policyName: string;
  /** Policy priority */
  priority: number;
  /** Whether the policy matched */
  matched: boolean;
  /** Effect if matched */
  effect: PolicyEffect;
  /** Individual rule audit entries */
  ruleAudit: RuleAuditEntry[];
  /** Evaluation duration */
  durationMs: number;
}

/**
 * Result of evaluating an intent against policies
 */
export interface EvaluationResult {
  /** The intent that was evaluated */
  intentId: ID;
  /** Final decision */
  decision: ControlAction;
  /** Reason for the decision */
  reason?: string;
  /** Whether the intent is permitted */
  permitted: boolean;
  /** Policies that were evaluated */
  policiesEvaluated: PolicyAuditEntry[];
  /** Policies that matched */
  matchedPolicies: PolicyAuditEntry[];
  /** Total evaluation duration */
  durationMs: number;
  /** Evaluation timestamp */
  evaluatedAt: Timestamp;
}

// =============================================================================
// ENGINE OPTIONS
// =============================================================================

/**
 * Options for governance engine
 */
export interface GovernanceEngineOptions {
  /** Conflict resolution strategy */
  conflictResolution?: ConflictResolutionStrategy;
  /** Default decision when no policies match */
  defaultDecision?: ControlAction;
  /** Whether to enable tracing */
  enableTracing?: boolean;
}

// =============================================================================
// GOVERNANCE ENGINE
// =============================================================================

/**
 * GovernanceEngine class for evaluating intents against policies
 */
export class GovernanceEngine {
  private ruleEvaluator: RuleEvaluator;
  private policySetManager: PolicySetManager;
  private options: Required<GovernanceEngineOptions>;

  constructor(options: GovernanceEngineOptions = {}) {
    this.ruleEvaluator = new RuleEvaluator();
    this.policySetManager = new PolicySetManager();
    this.options = {
      conflictResolution: options.conflictResolution ?? 'deny-overrides',
      defaultDecision: options.defaultDecision ?? 'allow',
      enableTracing: options.enableTracing ?? true,
    };

    logger.info({
      conflictResolution: this.options.conflictResolution,
      defaultDecision: this.options.defaultDecision,
    }, 'Governance engine initialized');
  }

  /**
   * Evaluate an intent against a set of policies
   */
  evaluateIntent(intent: Intent, policies: Policy[]): EvaluationResult {
    const startTime = performance.now();
    const context: EvaluationContext = {
      intent,
      context: intent.context as Record<string, unknown>,
    };

    const policiesEvaluated: PolicyAuditEntry[] = [];
    const matchedPolicies: PolicyAuditEntry[] = [];
    const matchedEffects: { effect: PolicyEffect; priority: number }[] = [];

    // Sort policies by priority (lower = higher priority)
    const sortedPolicies = [...policies].sort((a, b) => a.priority - b.priority);

    for (const policy of sortedPolicies) {
      const result = this.ruleEvaluator.evaluatePolicy(policy, context);
      const auditEntry = this.createPolicyAuditEntry(result);
      policiesEvaluated.push(auditEntry);

      if (result.matched) {
        matchedPolicies.push(auditEntry);
        matchedEffects.push({
          effect: result.effect,
          priority: policy.priority,
        });

        logger.debug({
          policyId: policy.id,
          policyName: policy.name,
          effect: result.effect,
          intentId: intent.id,
        }, 'Policy matched');

        // Short-circuit on deny if using deny-overrides
        if (this.options.conflictResolution === 'deny-overrides' && result.effect === 'deny') {
          logger.info({
            policyId: policy.id,
            policyName: policy.name,
            intentId: intent.id,
          }, 'Deny policy matched - short-circuiting');
          break;
        }
      }
    }

    // Determine final decision
    let decision: ControlAction;
    let reason: string | undefined;

    if (matchedEffects.length === 0) {
      // No policies matched, use default
      decision = this.options.defaultDecision;
      reason = 'No matching policies found';
    } else {
      const finalEffect = resolveConflicts(matchedEffects, this.options.conflictResolution);
      decision = finalEffect === 'deny' ? 'deny' : 'allow';
      reason = `Resolved by ${this.options.conflictResolution} strategy`;
    }

    const durationMs = performance.now() - startTime;

    logger.info({
      intentId: intent.id,
      decision,
      policiesEvaluated: policiesEvaluated.length,
      policiesMatched: matchedPolicies.length,
      durationMs,
    }, 'Intent evaluation completed');

    return {
      intentId: intent.id,
      decision,
      reason,
      permitted: decision === 'allow',
      policiesEvaluated,
      matchedPolicies,
      durationMs,
      evaluatedAt: new Date().toISOString(),
    };
  }

  /**
   * Evaluate an intent with OpenTelemetry tracing
   */
  async evaluateIntentWithTracing(intent: Intent, policies: Policy[]): Promise<EvaluationResult> {
    if (!this.options.enableTracing) {
      return this.evaluateIntent(intent, policies);
    }

    return withSpan(
      'governance.evaluateIntent',
      async (span: TraceSpan) => {
        span.attributes['intent.id'] = intent.id;
        span.attributes['intent.goal'] = intent.goal;
        span.attributes['intent.type'] = intent.intentType ?? 'unknown';
        span.attributes['policies.count'] = policies.length;

        const result = this.evaluateIntent(intent, policies);

        span.attributes['result.decision'] = result.decision;
        span.attributes['result.permitted'] = result.permitted;
        span.attributes['result.policiesMatched'] = result.matchedPolicies.length;
        span.attributes['result.durationMs'] = result.durationMs;

        return result;
      },
      { 'tenant.id': intent.tenantId }
    );
  }

  /**
   * Load policies from policy sets
   */
  loadPoliciesFromSets(): Policy[] {
    return this.policySetManager.getAllEnabledPolicies();
  }

  /**
   * Add a policy set to the engine
   */
  addPolicySet(policySet: PolicySet): void {
    this.policySetManager.addPolicySet(policySet);
    logger.info({
      policySetId: policySet.id,
      policySetName: policySet.name,
      policiesCount: policySet.policies.length,
    }, 'Policy set added');
  }

  /**
   * Remove a policy set from the engine
   */
  removePolicySet(id: ID): boolean {
    const removed = this.policySetManager.removePolicySet(id);
    if (removed) {
      logger.info({ policySetId: id }, 'Policy set removed');
    }
    return removed;
  }

  /**
   * Get all policy sets
   */
  getPolicySets(): PolicySet[] {
    return this.policySetManager.getAllPolicySets();
  }

  /**
   * Find policies matching specific criteria
   */
  findMatchingPolicies(action?: string, resource?: string, intentType?: string): Policy[] {
    return this.policySetManager.findMatchingPolicies(action, resource, intentType);
  }

  /**
   * Clear all loaded policies
   */
  clearPolicies(): void {
    this.policySetManager.clear();
    logger.info('All policy sets cleared');
  }

  /**
   * Get engine options
   */
  getOptions(): Readonly<Required<GovernanceEngineOptions>> {
    return { ...this.options };
  }

  /**
   * Create an audit entry from a policy match result
   */
  private createPolicyAuditEntry(result: PolicyMatchResult): PolicyAuditEntry {
    const ruleAudit: RuleAuditEntry[] = result.ruleGroupResult.ruleResults.map(
      (ruleResult: RuleMatchResult) => ({
        policyId: result.policy.id,
        policyName: result.policy.name,
        field: ruleResult.rule.field,
        operator: ruleResult.rule.operator,
        expectedValue: ruleResult.expectedValue,
        actualValue: ruleResult.actualValue,
        matched: ruleResult.matched,
      })
    );

    return {
      policyId: result.policy.id,
      policyName: result.policy.name,
      priority: result.policy.priority,
      matched: result.matched,
      effect: result.effect,
      ruleAudit,
      durationMs: result.durationMs,
    };
  }
}

/**
 * Create a new governance engine instance
 */
export function createGovernanceEngine(options?: GovernanceEngineOptions): GovernanceEngine {
  return new GovernanceEngine(options);
}
