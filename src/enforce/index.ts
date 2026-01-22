/**
 * ENFORCE - Policy Decision Point
 *
 * Makes enforcement decisions based on rule evaluations and trust levels.
 * Enterprise-grade implementation with circuit breaker, caching, metrics, and observability.
 *
 * @packageDocumentation
 */

import { createLogger } from '../common/logger.js';
import { CircuitBreaker, createCircuitBreaker } from '../common/circuit-breaker.js';
import type {
  Intent,
  Decision,
  ControlAction,
  TrustLevel,
  TrustScore,
  ID,
  ConstraintEvaluationResult,
} from '../common/types.js';
import type { EvaluationResult, RuleResult } from '../basis/types.js';
import type { PolicyEvaluationResult } from '../policy/types.js';
import type {
  EnforcementPolicy,
  EscalationRule,
  ConstraintResult,
  EscalationCondition,
} from './types.js';

// Re-export types for external consumers
// Note: TrustRecord is intentionally not re-exported to avoid conflict with trust-engine
export type {
  EnforcementPolicy,
  EscalationRule,
  ConstraintResult,
  EnforcementDecision,
  DecisionCacheOptions,
  EntityContext,
  EnvironmentContext,
  EnforcementMetrics,
  EnforcementAuditEntry,
  EscalationCondition,
  EscalationConditionType,
  EscalationPriority,
} from './types.js';

const logger = createLogger({ component: 'enforce' });

// =============================================================================
// CONFIGURATION TYPES
// =============================================================================

/**
 * Enforcement service configuration
 */
export interface EnforcementConfig {
  /** Initial policy configuration */
  policy?: EnforcementPolicy;

  /** Shorthand for policy.defaultAction (for backward compatibility) */
  defaultAction?: ControlAction;

  /** Shorthand for policy.requireMinTrustLevel (for backward compatibility) */
  requireMinTrustLevel?: TrustLevel;

  /** Enable audit logging (default: true) */
  auditEnabled?: boolean;

  /** Decision cache TTL in milliseconds (default: 60000) */
  cacheTtlMs?: number;

  /** Maximum cache size (default: 10000) */
  maxCacheSize?: number;

  /** Circuit breaker configuration */
  circuitBreaker?: {
    /** Number of failures before opening circuit (default: 5) */
    failureThreshold?: number;
    /** Time before attempting to close circuit (default: 30000ms) */
    resetTimeoutMs?: number;
    /** Max attempts in half-open state (default: 3) */
    halfOpenMaxAttempts?: number;
    /** Monitoring window for failures (default: 60000ms) */
    monitorWindowMs?: number;
  };
}

// =============================================================================
// SIMPLIFIED CONTEXT FOR LEGACY COMPATIBILITY
// =============================================================================

/**
 * Simple enforcement context for basic decision making
 * Compatible with the original API
 */
export interface SimpleEnforcementContext {
  intent: Intent;
  evaluation: EvaluationResult;
  trustScore: TrustScore;
  trustLevel: TrustLevel;
  policyEvaluation?: PolicyEvaluationResult;
}

// =============================================================================
// METRICS
// =============================================================================

/**
 * Internal enforcement metrics for observability
 */
interface ServiceMetrics {
  decisionsTotal: { allowed: number; denied: number; escalated: number };
  decisionDurationMs: number[];
  cacheHits: number;
  cacheMisses: number;
  constraintEvaluations: number;
  escalationChecks: number;
}

/**
 * Create initial metrics state
 */
function createMetrics(): ServiceMetrics {
  return {
    decisionsTotal: { allowed: 0, denied: 0, escalated: 0 },
    decisionDurationMs: [],
    cacheHits: 0,
    cacheMisses: 0,
    constraintEvaluations: 0,
    escalationChecks: 0,
  };
}

// =============================================================================
// TRUST LEVEL UTILITIES
// =============================================================================

/**
 * Trust level names for logging
 */
const TRUST_LEVEL_NAMES: Record<TrustLevel, string> = {
  0: 'NONE',
  1: 'LOW',
  2: 'MEDIUM',
  3: 'HIGH',
  4: 'FULL',
};

/**
 * Compare trust levels
 */
function compareTrustLevels(actual: TrustLevel, required: TrustLevel): boolean {
  return actual >= required;
}

// =============================================================================
// INTERNAL CACHE ENTRY TYPE
// =============================================================================

/**
 * Internal cache entry for decision caching
 */
interface DecisionCacheEntry {
  decision: Decision;
  cachedAt: number;
  expiresAt: number;
}

// =============================================================================
// ENFORCEMENT SERVICE
// =============================================================================

/**
 * Enterprise-grade policy enforcement service
 *
 * Provides:
 * - Synchronous and cached decision making
 * - Constraint evaluation with detailed results
 * - Trust level checking
 * - Policy evaluation integration
 * - Escalation rule processing
 * - Comprehensive metrics and logging
 * - Circuit breaker for resilience
 */
export class EnforcementService {
  private policy: EnforcementPolicy;
  private readonly metrics: ServiceMetrics;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly decisionCache: Map<string, DecisionCacheEntry>;
  private readonly auditEnabled: boolean;
  private readonly cacheTtlMs: number;
  private readonly maxCacheSize: number;

  constructor(config?: EnforcementConfig) {
    // Build policy from config, supporting both shorthand and full policy object
    const basePolicy: EnforcementPolicy = {
      defaultAction: config?.defaultAction ?? 'deny',
      requirePolicyMatch: false,
      escalationRules: [],
      decisionCacheTtl: 60000,
      enableAudit: true,
      enableMetrics: true,
    };

    // Add optional trust level requirement if specified
    if (config?.requireMinTrustLevel !== undefined) {
      basePolicy.requireMinTrustLevel = config.requireMinTrustLevel;
    }

    this.policy = config?.policy
      ? { ...basePolicy, ...config.policy }
      : basePolicy;
    this.metrics = createMetrics();
    this.auditEnabled = config?.auditEnabled ?? true;
    this.cacheTtlMs = config?.cacheTtlMs ?? 60000; // 1 minute default
    this.maxCacheSize = config?.maxCacheSize ?? 10000;

    // Initialize circuit breaker for external dependencies
    this.circuitBreaker = createCircuitBreaker({
      name: 'enforcement-service',
      failureThreshold: config?.circuitBreaker?.failureThreshold ?? 5,
      resetTimeoutMs: config?.circuitBreaker?.resetTimeoutMs ?? 30000,
      halfOpenMaxAttempts: config?.circuitBreaker?.halfOpenMaxAttempts ?? 3,
      monitorWindowMs: config?.circuitBreaker?.monitorWindowMs ?? 60000,
    });

    // Initialize decision cache
    this.decisionCache = new Map();

    logger.info(
      {
        auditEnabled: this.auditEnabled,
        cacheTtlMs: this.cacheTtlMs,
        maxCacheSize: this.maxCacheSize,
        defaultAction: this.policy.defaultAction,
      },
      'Enforcement service initialized'
    );
  }

  // ===========================================================================
  // CORE DECISION METHODS
  // ===========================================================================

  /**
   * Make a synchronous enforcement decision
   *
   * This is the primary decision method that evaluates:
   * 1. Minimum trust level requirements
   * 2. Rule evaluation results
   * 3. Policy constraints
   *
   * @param context - The enforcement context containing intent, evaluation, and trust data
   * @returns A complete decision record
   */
  decide(context: SimpleEnforcementContext): Decision {
    const startTime = performance.now();
    const { intent, evaluation, trustScore, trustLevel } = context;

    logger.debug(
      {
        intentId: intent.id,
        trustLevel,
        trustScore,
        rulesEvaluated: evaluation.rulesEvaluated.length,
      },
      'Starting enforcement decision'
    );

    // Evaluate all constraints
    const constraintResults = this.evaluateConstraints(context);

    // Check if any constraint failed
    const failedConstraints = constraintResults.filter((c) => !c.passed);
    const hasFailedConstraints = failedConstraints.length > 0;

    // Determine action based on constraints and evaluation
    let action: ControlAction;
    let reason: string | undefined;

    if (hasFailedConstraints) {
      // Find the most restrictive failed constraint
      const mostRestrictive = this.getMostRestrictiveAction(failedConstraints);
      action = mostRestrictive.action;
      reason = mostRestrictive.reason;
    } else if (!evaluation.passed) {
      action = evaluation.finalAction;
      reason = `Rule evaluation resulted in ${action}`;
    } else {
      action = 'allow';
    }

    // Check for escalation
    const escalationRule = this.shouldEscalate(context, { action } as Decision);
    if (escalationRule && action !== 'deny') {
      action = 'escalate';
      reason = `Escalation required: ${escalationRule.name}`;
    }

    // Calculate confidence score
    const confidence = this.calculateConfidence(constraintResults, evaluation);

    // Create the decision record
    const decision = this.createDecision(
      intent.id,
      action,
      evaluation.rulesEvaluated,
      trustScore,
      trustLevel,
      constraintResults,
      confidence,
      reason,
      escalationRule
    );

    // Record metrics
    const durationMs = performance.now() - startTime;
    this.recordDecisionMetrics(decision, durationMs);

    // Log the decision
    this.logDecision(context, decision, durationMs);

    return decision;
  }

  /**
   * Make an enforcement decision with caching support
   *
   * Caches decisions based on a hash of the context to avoid
   * redundant processing for identical requests.
   *
   * @param context - The enforcement context
   * @returns A promise resolving to the decision
   */
  async decideWithCache(context: SimpleEnforcementContext): Promise<Decision> {
    const cacheKey = this.generateCacheKey(context);

    // Check cache first
    const cached = this.decisionCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      this.metrics.cacheHits++;
      logger.debug(
        { intentId: context.intent.id, cacheKey },
        'Decision cache hit'
      );
      return cached.decision;
    }

    this.metrics.cacheMisses++;

    // Execute decision through circuit breaker for resilience
    const result = await this.circuitBreaker.execute(() => Promise.resolve(this.decide(context)));

    if (result.success && result.result) {
      // Cache the decision
      this.cacheDecision(cacheKey, result.result);
      return result.result;
    }

    // Circuit breaker is open or execution failed - use fallback
    if (result.circuitOpen) {
      logger.warn(
        { intentId: context.intent.id },
        'Circuit breaker open, using default deny action'
      );
      return this.createFallbackDecision(context, 'Circuit breaker open');
    }

    // Execution error - log and return fallback
    logger.error(
      { intentId: context.intent.id, error: result.error?.message },
      'Decision execution failed'
    );
    return this.createFallbackDecision(context, result.error?.message ?? 'Unknown error');
  }

  // ===========================================================================
  // CONSTRAINT EVALUATION
  // ===========================================================================

  /**
   * Evaluate all constraints for a given context
   *
   * Evaluates:
   * 1. Trust level requirements
   * 2. Policy evaluation results (if provided)
   * 3. Custom constraints from rules
   *
   * @param context - The enforcement context
   * @returns Array of constraint evaluation results
   */
  evaluateConstraints(context: SimpleEnforcementContext): ConstraintResult[] {
    const results: ConstraintResult[] = [];
    this.metrics.constraintEvaluations++;

    // Check trust level constraint
    if (this.policy.requireMinTrustLevel !== undefined) {
      const trustResult = this.checkTrustLevel(
        context.trustLevel,
        this.policy.requireMinTrustLevel
      );
      results.push(trustResult);
    }

    // Check policy evaluation if available
    if (context.policyEvaluation) {
      const policyResult = this.checkPolicyEvaluation(context.policyEvaluation);
      results.push(policyResult);
    }

    // Evaluate rule-based constraints from the evaluation result
    for (const rule of context.evaluation.rulesEvaluated) {
      if (!rule.matched) continue;

      results.push({
        constraintId: rule.ruleId,
        constraintType: 'policy_rule',
        passed: rule.action === 'allow',
        action: rule.action,
        reason: rule.reason,
        details: rule.details,
        durationMs: rule.durationMs,
      });
    }

    return results;
  }

  /**
   * Check if the actual trust level meets the required level
   *
   * @param trustLevel - The actual trust level
   * @param required - The required trust level
   * @returns Constraint result for trust level check
   */
  checkTrustLevel(trustLevel: TrustLevel, required: TrustLevel): ConstraintResult {
    const passed = compareTrustLevels(trustLevel, required);

    return {
      constraintId: 'trust-level-check',
      constraintType: 'trust_level',
      passed,
      action: passed ? 'allow' : 'deny',
      reason: passed
        ? `Trust level ${TRUST_LEVEL_NAMES[trustLevel]} meets requirement`
        : `Trust level ${TRUST_LEVEL_NAMES[trustLevel]} below required ${TRUST_LEVEL_NAMES[required]}`,
      details: {
        actualLevel: trustLevel,
        actualLevelName: TRUST_LEVEL_NAMES[trustLevel],
        requiredLevel: required,
        requiredLevelName: TRUST_LEVEL_NAMES[required],
      },
      durationMs: 0,
    };
  }

  /**
   * Check the result of policy evaluation
   *
   * @param evaluation - The policy evaluation result
   * @returns Constraint result for policy check
   */
  checkPolicyEvaluation(evaluation: PolicyEvaluationResult): ConstraintResult {
    const passed = evaluation.action === 'allow';

    return {
      constraintId: `policy-${evaluation.policyId}`,
      constraintType: 'policy_rule',
      passed,
      action: evaluation.action,
      reason: evaluation.reason ?? `Policy ${evaluation.policyName} evaluated to ${evaluation.action}`,
      details: {
        policyId: evaluation.policyId,
        policyVersion: evaluation.policyVersion,
        matched: evaluation.matched,
        rulesEvaluated: evaluation.rulesEvaluated.length,
        matchedRules: evaluation.matchedRules.length,
      },
      durationMs: evaluation.durationMs,
    };
  }

  // ===========================================================================
  // ESCALATION
  // ===========================================================================

  /**
   * Determine if the decision should trigger an escalation
   *
   * Evaluates escalation rules against the context and decision
   * to determine if human review is required.
   *
   * @param context - The enforcement context
   * @param decision - The preliminary decision
   * @returns The matched escalation rule, or null if no escalation needed
   */
  shouldEscalate(context: SimpleEnforcementContext, decision: Decision): EscalationRule | null {
    this.metrics.escalationChecks++;

    if (!this.policy.escalationRules || this.policy.escalationRules.length === 0) {
      return null;
    }

    for (const rule of this.policy.escalationRules) {
      if (this.evaluateEscalationCondition(rule, context, decision)) {
        logger.info(
          {
            intentId: context.intent.id,
            ruleName: rule.name,
            escalateTo: rule.escalateTo,
          },
          'Escalation rule matched'
        );
        return rule;
      }
    }

    return null;
  }

  /**
   * Evaluate an escalation condition
   */
  private evaluateEscalationCondition(
    rule: EscalationRule,
    context: SimpleEnforcementContext,
    decision: Decision
  ): boolean {
    const { condition } = rule;

    // Handle string conditions (simple expressions)
    if (typeof condition === 'string') {
      return this.evaluateStringCondition(condition, context, decision);
    }

    // Handle object conditions (structured)
    const conditionObj: EscalationCondition = condition;
    switch (conditionObj.type) {
      case 'trust_below': {
        const requiredLevel = conditionObj.value as TrustLevel;
        return context.trustLevel < requiredLevel;
      }

      case 'action_type': {
        const targetActions = Array.isArray(conditionObj.value)
          ? conditionObj.value
          : [conditionObj.value];
        return targetActions.includes(decision.action);
      }

      case 'policy_match': {
        if (!context.policyEvaluation) return false;
        const policyId = conditionObj.value as string;
        return context.policyEvaluation.policyId === policyId;
      }

      case 'custom': {
        // Custom conditions can be evaluated by checking context metadata
        return this.evaluateCustomCondition(conditionObj.value, context, decision);
      }

      default:
        return false;
    }
  }

  /**
   * Evaluate a string-based escalation condition
   */
  private evaluateStringCondition(
    condition: string,
    context: SimpleEnforcementContext,
    decision: Decision
  ): boolean {
    const conditionLower = condition.toLowerCase();

    // Trust level conditions
    if (conditionLower.includes('trust_level')) {
      const match = conditionLower.match(/trust_level\s*([<>=]+)\s*(\d)/);
      if (match) {
        const operator = match[1];
        const levelStr = match[2];
        if (!operator || !levelStr) return false;
        const level = parseInt(levelStr, 10) as TrustLevel;
        return this.evaluateComparison(context.trustLevel, operator, level);
      }
    }

    // Action conditions
    if (conditionLower.includes('action')) {
      if (conditionLower.includes('deny') && decision.action === 'deny') return true;
      if (conditionLower.includes('limit') && decision.action === 'limit') return true;
      if (conditionLower.includes('monitor') && decision.action === 'monitor') return true;
    }

    // High risk conditions
    if (conditionLower.includes('high_risk')) {
      return context.trustLevel <= 1 || context.trustScore < 300;
    }

    // Sensitive operation conditions
    if (conditionLower.includes('sensitive')) {
      const intentType = context.intent.intentType?.toLowerCase() ?? '';
      const sensitiveTypes = ['delete', 'admin', 'financial', 'pii', 'security'];
      return sensitiveTypes.some((t) => intentType.includes(t));
    }

    return false;
  }

  /**
   * Evaluate a comparison operation
   */
  private evaluateComparison(left: number, operator: string, right: number): boolean {
    switch (operator) {
      case '<': return left < right;
      case '<=': return left <= right;
      case '>': return left > right;
      case '>=': return left >= right;
      case '==':
      case '=': return left === right;
      case '!=': return left !== right;
      default: return false;
    }
  }

  /**
   * Evaluate a custom escalation condition
   */
  private evaluateCustomCondition(
    value: unknown,
    context: SimpleEnforcementContext,
    _decision: Decision
  ): boolean {
    if (typeof value !== 'string') return false;

    const conditionLower = value.toLowerCase();

    // High risk conditions
    if (conditionLower.includes('high_risk')) {
      return context.trustLevel <= 1 || context.trustScore < 300;
    }

    // Sensitive operation conditions
    if (conditionLower.includes('sensitive')) {
      const intentType = context.intent.intentType?.toLowerCase() ?? '';
      const sensitiveTypes = ['delete', 'admin', 'financial', 'pii', 'security'];
      return sensitiveTypes.some((t) => intentType.includes(t));
    }

    return false;
  }

  // ===========================================================================
  // DECISION BUILDING
  // ===========================================================================

  /**
   * Create a complete decision record
   */
  private createDecision(
    intentId: ID,
    action: ControlAction,
    rulesEvaluated: RuleResult[],
    trustScore: TrustScore,
    trustLevel: TrustLevel,
    constraintResults: ConstraintResult[] = [],
    confidence: number = 1.0,
    reason?: string,
    escalationRule?: EscalationRule | null
  ): Decision {
    const constraintsEvaluated: ConstraintEvaluationResult[] = [
      // Convert rule results to constraint evaluation results
      ...rulesEvaluated.map((r) => ({
        constraintId: r.ruleId,
        passed: r.matched,
        action: r.action,
        reason: r.reason,
        details: r.details,
        durationMs: r.durationMs,
        evaluatedAt: new Date().toISOString(),
      })),
      // Include constraint results
      ...constraintResults.map((c) => ({
        constraintId: c.constraintId,
        passed: c.passed,
        action: c.action,
        reason: c.reason ?? '',
        details: c.details ?? {},
        durationMs: c.durationMs,
        evaluatedAt: new Date().toISOString(),
      })),
    ];

    const decision: Decision = {
      intentId,
      action,
      constraintsEvaluated,
      trustScore,
      trustLevel,
      decidedAt: new Date().toISOString(),
    };

    // Add escalation if applicable
    if (escalationRule && action === 'escalate') {
      decision.escalation = {
        id: `esc-${intentId}-${Date.now()}`,
        intentId,
        reason: reason ?? escalationRule.name ?? 'Escalation required',
        escalatedTo: escalationRule.escalateTo,
        timeout: escalationRule.timeout,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
    }

    // Store confidence in a detail field (extend Decision type if needed)
    if (confidence < 1.0) {
      logger.debug(
        { intentId, confidence },
        'Decision made with reduced confidence'
      );
    }

    return decision;
  }

  /**
   * Create a fallback decision when normal processing fails
   */
  private createFallbackDecision(context: SimpleEnforcementContext, _reason: string): Decision {
    return {
      intentId: context.intent.id,
      action: this.policy.defaultAction,
      constraintsEvaluated: [],
      trustScore: context.trustScore,
      trustLevel: context.trustLevel,
      decidedAt: new Date().toISOString(),
    };
  }

  /**
   * Calculate decision confidence based on constraint results
   *
   * Confidence is reduced when:
   * - Few constraints were evaluated
   * - Trust level is low
   * - There are conflicting signals
   *
   * @param constraints - Evaluated constraint results
   * @param evaluation - Rule evaluation result
   * @returns Confidence score between 0 and 1
   */
  calculateConfidence(
    constraints: ConstraintResult[],
    evaluation: EvaluationResult
  ): number {
    let confidence = 1.0;

    // Reduce confidence if no constraints were evaluated
    if (constraints.length === 0 && evaluation.rulesEvaluated.length === 0) {
      confidence *= 0.5;
    }

    // Reduce confidence for mixed signals (some pass, some fail)
    const passCount = constraints.filter((c) => c.passed).length;
    const failCount = constraints.filter((c) => !c.passed).length;
    if (passCount > 0 && failCount > 0) {
      confidence *= 0.8;
    }

    // Reduce confidence for long evaluation times (potential timeout issues)
    const totalDurationMs = constraints.reduce((sum, c) => sum + c.durationMs, 0);
    if (totalDurationMs > 1000) {
      confidence *= 0.9;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  // ===========================================================================
  // CONFIGURATION
  // ===========================================================================

  /**
   * Update the enforcement policy
   *
   * @param policy - The new policy configuration
   */
  setPolicy(policy: EnforcementPolicy): void {
    this.policy = policy;
    logger.info(
      {
        defaultAction: policy.defaultAction,
        requireMinTrustLevel: policy.requireMinTrustLevel,
        escalationRuleCount: policy.escalationRules?.length ?? 0,
      },
      'Enforcement policy updated'
    );
  }

  /**
   * Get the current enforcement policy
   *
   * @returns The current policy configuration
   */
  getPolicy(): EnforcementPolicy {
    return { ...this.policy };
  }

  // ===========================================================================
  // OBSERVABILITY
  // ===========================================================================

  /**
   * Log a decision with full context
   */
  private logDecision(
    context: SimpleEnforcementContext,
    decision: Decision,
    durationMs: number
  ): void {
    if (!this.auditEnabled) return;

    const logData = {
      intentId: context.intent.id,
      entityId: context.intent.entityId,
      tenantId: context.intent.tenantId,
      action: decision.action,
      trustLevel: context.trustLevel,
      trustScore: context.trustScore,
      constraintsEvaluated: decision.constraintsEvaluated.length,
      rulesMatched: decision.constraintsEvaluated.filter((c) => c.passed).length,
      durationMs: Math.round(durationMs * 100) / 100,
      hasEscalation: !!decision.escalation,
    };

    if (decision.action === 'allow') {
      logger.info(logData, 'Enforcement decision: ALLOWED');
    } else if (decision.action === 'escalate') {
      logger.warn(logData, 'Enforcement decision: ESCALATED');
    } else {
      logger.warn(logData, `Enforcement decision: ${decision.action.toUpperCase()}`);
    }
  }

  /**
   * Record decision metrics
   */
  private recordDecisionMetrics(decision: Decision, durationMs: number): void {
    // Update decision counters
    switch (decision.action) {
      case 'allow':
        this.metrics.decisionsTotal.allowed++;
        break;
      case 'deny':
      case 'terminate':
        this.metrics.decisionsTotal.denied++;
        break;
      case 'escalate':
        this.metrics.decisionsTotal.escalated++;
        break;
    }

    // Record duration
    this.metrics.decisionDurationMs.push(durationMs);

    // Keep only last 1000 duration samples
    if (this.metrics.decisionDurationMs.length > 1000) {
      this.metrics.decisionDurationMs.shift();
    }
  }

  /**
   * Get current metrics snapshot
   */
  getMetrics(): ServiceMetrics {
    return {
      ...this.metrics,
      decisionDurationMs: [...this.metrics.decisionDurationMs],
    };
  }

  /**
   * Get circuit breaker status
   */
  async getCircuitBreakerStatus(): Promise<{
    state: string;
    failureCount: number;
    isOpen: boolean;
  }> {
    const status = await this.circuitBreaker.getStatus();
    return {
      state: status.state,
      failureCount: status.failureCount,
      isOpen: status.state === 'OPEN',
    };
  }

  // ===========================================================================
  // CACHING
  // ===========================================================================

  /**
   * Generate a cache key from the context
   */
  private generateCacheKey(context: SimpleEnforcementContext): string {
    const key = [
      context.intent.id,
      context.intent.entityId,
      context.trustLevel,
      context.evaluation.finalAction,
      context.evaluation.rulesEvaluated.length,
    ].join(':');

    return key;
  }

  /**
   * Cache a decision
   */
  private cacheDecision(key: string, decision: Decision): void {
    // Enforce cache size limit
    if (this.decisionCache.size >= this.maxCacheSize) {
      // Remove oldest entries (simple LRU approximation)
      const keysToDelete = Array.from(this.decisionCache.keys()).slice(
        0,
        Math.floor(this.maxCacheSize * 0.1)
      );
      for (const k of keysToDelete) {
        this.decisionCache.delete(k);
      }
    }

    this.decisionCache.set(key, {
      decision,
      cachedAt: Date.now(),
      expiresAt: Date.now() + this.cacheTtlMs,
    });
  }

  /**
   * Clear the decision cache
   */
  clearCache(): void {
    this.decisionCache.clear();
    logger.info({}, 'Decision cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hitRate: number } {
    const total = this.metrics.cacheHits + this.metrics.cacheMisses;
    return {
      size: this.decisionCache.size,
      hitRate: total > 0 ? this.metrics.cacheHits / total : 0,
    };
  }

  // ===========================================================================
  // UTILITIES
  // ===========================================================================

  /**
   * Get the most restrictive action from constraint results
   */
  private getMostRestrictiveAction(
    constraints: ConstraintResult[]
  ): { action: ControlAction; reason: string } {
    const priority: Record<ControlAction, number> = {
      deny: 0,
      terminate: 1,
      escalate: 2,
      limit: 3,
      monitor: 4,
      allow: 5,
    };

    const firstConstraint = constraints[0];
    if (!firstConstraint) {
      return { action: 'allow', reason: 'No constraints to evaluate' };
    }
    let mostRestrictive = firstConstraint;

    for (const constraint of constraints) {
      if (priority[constraint.action] < priority[mostRestrictive.action]) {
        mostRestrictive = constraint;
      }
    }

    return {
      action: mostRestrictive.action,
      reason: mostRestrictive.reason ?? 'Constraint failed',
    };
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a new enforcement service instance
 *
 * @param config - Optional configuration options
 * @returns A configured EnforcementService instance
 *
 * @example
 * ```typescript
 * const service = createEnforcementService({
 *   policy: {
 *     defaultAction: 'deny',
 *     requireMinTrustLevel: 2,
 *     requirePolicyMatch: false,
 *     escalationRules: [],
 *     decisionCacheTtl: 60000,
 *     enableAudit: true,
 *     enableMetrics: true,
 *   },
 *   auditEnabled: true,
 *   cacheTtlMs: 120000,
 * });
 *
 * const decision = service.decide(context);
 * ```
 */
export function createEnforcementService(config?: EnforcementConfig): EnforcementService {
  return new EnforcementService(config);
}
