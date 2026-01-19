/**
 * Governance & Authority Engine
 *
 * Implements rule hierarchy with hard disqualifiers, soft constraints,
 * mandatory clarification triggers, and authority management.
 *
 * @packageDocumentation
 */

import { createLogger } from '../common/logger.js';
import type { ID, TrustLevel, ControlAction } from '../common/types.js';
import type {
  GovernanceRule,
  RuleCategory,
  RuleCondition,
  RuleEffect,
  ConditionOperator,
  Authority,
  GovernanceRequest,
  GovernanceResult,
  EvaluatedRule,
  EffectModification,
  EffectConstraint,
  GovernanceConfig,
  RuleQuery,
  ClarificationRequirement,
} from './types.js';

export * from './types.js';

const logger = createLogger({ component: 'governance' });

/**
 * Default governance configuration
 */
const DEFAULT_CONFIG: GovernanceConfig = {
  defaultAction: 'deny',
  strictMode: false,
  maxRulesPerRequest: 100,
  evaluationTimeoutMs: 5000,
  enableCaching: true,
  cacheTtlMs: 60000,
  enabledNamespaces: ['*'],
};

/**
 * Priority values for rule categories (imported from types but defined here for runtime)
 */
const CATEGORY_PRIORITY: Record<RuleCategory, number> = {
  hard_disqualifier: 0,
  regulatory_mandate: 1,
  security_critical: 2,
  policy_enforcement: 3,
  soft_constraint: 4,
  clarification_trigger: 5,
  logging_only: 6,
};

/**
 * Governance Engine - manages and evaluates governance rules
 */
export class GovernanceEngine {
  private config: GovernanceConfig;
  private rules: Map<ID, GovernanceRule> = new Map();
  private rulesByNamespace: Map<string, ID[]> = new Map();
  private authorities: Map<ID, Authority> = new Map();
  private evaluationCache: Map<string, { result: GovernanceResult; expiresAt: number }> = new Map();

  constructor(config: Partial<GovernanceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Register a governance rule
   */
  registerRule(rule: GovernanceRule): void {
    // Validate rule
    this.validateRule(rule);

    this.rules.set(rule.ruleId, rule);

    // Index by namespace
    const namespaceRules = this.rulesByNamespace.get(rule.namespace) ?? [];
    namespaceRules.push(rule.ruleId);
    this.rulesByNamespace.set(rule.namespace, namespaceRules);

    logger.debug(
      {
        ruleId: rule.ruleId,
        name: rule.name,
        category: rule.category,
        namespace: rule.namespace,
      },
      'Rule registered'
    );
  }

  /**
   * Unregister a rule
   */
  unregisterRule(ruleId: ID): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      this.rules.delete(ruleId);

      // Remove from namespace index
      const namespaceRules = this.rulesByNamespace.get(rule.namespace) ?? [];
      const index = namespaceRules.indexOf(ruleId);
      if (index >= 0) {
        namespaceRules.splice(index, 1);
        this.rulesByNamespace.set(rule.namespace, namespaceRules);
      }
    }
  }

  /**
   * Register an authority
   */
  registerAuthority(authority: Authority): void {
    this.authorities.set(authority.authorityId, authority);
    logger.debug(
      {
        authorityId: authority.authorityId,
        name: authority.name,
        type: authority.type,
      },
      'Authority registered'
    );
  }

  /**
   * Evaluate governance rules for a request
   */
  async evaluate(request: GovernanceRequest): Promise<GovernanceResult> {
    const startTime = Date.now();
    const resultId = crypto.randomUUID();

    logger.info(
      {
        requestId: request.requestId,
        entityId: request.entityId,
        action: request.action,
        trustLevel: request.trustLevel,
      },
      'Evaluating governance request'
    );

    // Check cache
    const cacheKey = this.getCacheKey(request);
    if (this.config.enableCaching) {
      const cached = this.evaluationCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        logger.debug({ requestId: request.requestId }, 'Returning cached result');
        return { ...cached.result, resultId };
      }
    }

    // Check authority if provided
    if (request.authority) {
      const authorityCheck = this.checkAuthority(request);
      if (!authorityCheck.valid) {
        return this.createDenialResult(
          resultId,
          request,
          [],
          `Authority check failed: ${authorityCheck.reason}`,
          startTime
        );
      }
    }

    // Get applicable rules
    const applicableRules = this.getApplicableRules(request);

    // Evaluate rules in priority order
    const evaluatedRules: EvaluatedRule[] = [];
    const matchedRules: EvaluatedRule[] = [];
    let decidingRule: EvaluatedRule | null = null;
    let clarificationNeeded: ClarificationRequirement | undefined;
    const allModifications: EffectModification[] = [];
    const allConstraints: EffectConstraint[] = [];

    for (const rule of applicableRules) {
      if (evaluatedRules.length >= this.config.maxRulesPerRequest) {
        logger.warn({ requestId: request.requestId }, 'Max rules limit reached');
        break;
      }

      const evalStart = Date.now();
      const matched = await this.evaluateCondition(rule.condition, request);
      const evalDuration = Date.now() - evalStart;

      const evaluated: EvaluatedRule = {
        ruleId: rule.ruleId,
        ruleName: rule.name,
        category: rule.category,
        matched,
        effect: matched ? rule.effect : undefined,
        matchReason: matched ? 'Condition satisfied' : 'Condition not satisfied',
        evaluationMs: evalDuration,
      };

      evaluatedRules.push(evaluated);

      if (matched) {
        matchedRules.push(evaluated);

        // Apply modifications and constraints
        if (rule.effect.modifications) {
          allModifications.push(...rule.effect.modifications);
        }
        if (rule.effect.constraints) {
          allConstraints.push(...rule.effect.constraints);
        }

        // Check for clarification
        if (rule.effect.clarification) {
          clarificationNeeded = rule.effect.clarification;
        }

        // Hard disqualifiers and regulatory mandates always decide
        if (rule.category === 'hard_disqualifier' || rule.category === 'regulatory_mandate') {
          decidingRule = evaluated;
          break; // Stop evaluation
        }

        // First security_critical or policy_enforcement rule sets the decision
        if (!decidingRule && (rule.category === 'security_critical' || rule.category === 'policy_enforcement')) {
          decidingRule = evaluated;
        }
      }
    }

    // If no deciding rule, use first matched rule or default
    if (!decidingRule && matchedRules.length > 0) {
      decidingRule = matchedRules[0] ?? null;
    }

    // Determine final decision
    const decision = decidingRule?.effect?.action ?? this.config.defaultAction;
    const confidence = this.calculateConfidence(matchedRules, evaluatedRules.length);

    const result: GovernanceResult = {
      resultId,
      requestId: request.requestId,
      decision,
      confidence,
      rulesEvaluated: evaluatedRules,
      rulesMatched: matchedRules,
      decidingRule: decidingRule ?? {
        ruleId: 'default',
        ruleName: 'Default Rule',
        category: 'policy_enforcement',
        matched: false,
        matchReason: 'No rules matched, using default action',
        evaluationMs: 0,
      },
      modifications: allModifications,
      constraints: allConstraints,
      clarificationNeeded,
      explanation: this.generateExplanation(decidingRule, matchedRules, decision),
      evaluatedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
    };

    // Cache result
    if (this.config.enableCaching) {
      this.evaluationCache.set(cacheKey, {
        result,
        expiresAt: Date.now() + this.config.cacheTtlMs,
      });
    }

    logger.info(
      {
        resultId,
        requestId: request.requestId,
        decision,
        confidence,
        rulesEvaluated: evaluatedRules.length,
        rulesMatched: matchedRules.length,
        durationMs: result.durationMs,
      },
      'Governance evaluation completed'
    );

    return result;
  }

  /**
   * Validate a rule
   */
  private validateRule(rule: GovernanceRule): void {
    if (!rule.ruleId) throw new Error('Rule must have an ID');
    if (!rule.name) throw new Error('Rule must have a name');
    if (!rule.condition) throw new Error('Rule must have a condition');
    if (!rule.effect) throw new Error('Rule must have an effect');
  }

  /**
   * Get cache key for a request
   */
  private getCacheKey(request: GovernanceRequest): string {
    return `${request.entityId}:${request.action}:${request.trustLevel}:${JSON.stringify(request.capabilities)}`;
  }

  /**
   * Check if an authority is valid for a request
   */
  private checkAuthority(request: GovernanceRequest): { valid: boolean; reason: string } {
    const authority = this.authorities.get(request.authority!);

    if (!authority) {
      return { valid: false, reason: 'Authority not found' };
    }

    if (!authority.active) {
      return { valid: false, reason: 'Authority is not active' };
    }

    if (authority.expiresAt && new Date(authority.expiresAt) < new Date()) {
      return { valid: false, reason: 'Authority has expired' };
    }

    // Check trust level requirement
    const trustLevelValue = this.getTrustLevelValue(request.trustLevel);
    const requiredValue = this.getTrustLevelValue(authority.requiredTrustLevel);

    if (trustLevelValue < requiredValue) {
      return { valid: false, reason: 'Insufficient trust level for authority' };
    }

    // Check scope
    if (!this.isInScope(request, authority.scope)) {
      return { valid: false, reason: 'Request is outside authority scope' };
    }

    return { valid: true, reason: 'Authority valid' };
  }

  /**
   * Get numeric value for trust level
   */
  private getTrustLevelValue(level: TrustLevel): number {
    // TrustLevel is already numeric (0-5)
    return level;
  }

  /**
   * Check if request is within authority scope
   */
  private isInScope(request: GovernanceRequest, scope: Authority['scope']): boolean {
    // Check namespaces
    if (scope.namespaces.length > 0 && !scope.namespaces.includes('*')) {
      // Would check against request namespace
    }

    // Check resources
    if (scope.resources.length > 0 && !scope.resources.includes('*')) {
      const hasResource = request.resources.some((r) =>
        scope.resources.some((sr) => sr === '*' || sr === r)
      );
      if (!hasResource) return false;
    }

    // Check capabilities
    if (scope.capabilities.length > 0 && !scope.capabilities.includes('*')) {
      const hasCapability = request.capabilities.every((c) =>
        scope.capabilities.some((sc) => sc === '*' || sc === c)
      );
      if (!hasCapability) return false;
    }

    return true;
  }

  /**
   * Get applicable rules for a request
   */
  private getApplicableRules(request: GovernanceRequest): GovernanceRule[] {
    const applicable: GovernanceRule[] = [];

    for (const rule of this.rules.values()) {
      // Check if enabled
      if (!rule.enabled) continue;

      // Check namespace
      if (
        this.config.enabledNamespaces.length > 0 &&
        !this.config.enabledNamespaces.includes('*') &&
        !this.config.enabledNamespaces.includes(rule.namespace)
      ) {
        continue;
      }

      // Check trust level applicability
      if (
        rule.applicableTrustLevels.length > 0 &&
        !rule.applicableTrustLevels.includes(request.trustLevel)
      ) {
        continue;
      }

      // Check schedule
      if (rule.schedule && !this.isInSchedule(rule.schedule)) {
        continue;
      }

      applicable.push(rule);
    }

    // Sort by priority (category)
    applicable.sort((a, b) => {
      const priorityA = CATEGORY_PRIORITY[a.category] ?? 99;
      const priorityB = CATEGORY_PRIORITY[b.category] ?? 99;
      return priorityA - priorityB;
    });

    return applicable;
  }

  /**
   * Check if current time is within schedule
   */
  private isInSchedule(schedule: GovernanceRule['schedule']): boolean {
    if (!schedule) return true;

    const now = new Date();
    const dayOfWeek = now.getDay();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    // Check blackouts first
    for (const blackout of schedule.blackouts) {
      if (
        blackout.daysOfWeek.includes(dayOfWeek) &&
        currentTime >= blackout.startTime &&
        currentTime <= blackout.endTime
      ) {
        return false;
      }
    }

    // Check windows
    for (const window of schedule.windows) {
      if (
        window.daysOfWeek.includes(dayOfWeek) &&
        currentTime >= window.startTime &&
        currentTime <= window.endTime
      ) {
        return true;
      }
    }

    // If no windows defined, assume always active
    return schedule.windows.length === 0;
  }

  /**
   * Evaluate a condition against a request
   */
  private async evaluateCondition(
    condition: RuleCondition,
    request: GovernanceRequest
  ): Promise<boolean> {
    if (condition.type === 'composite' && condition.children) {
      return this.evaluateCompositeCondition(condition, request);
    }

    const fieldValue = this.getFieldValue(condition.field, request);
    return this.compareValues(fieldValue, condition.operator, condition.value);
  }

  /**
   * Evaluate a composite condition
   */
  private async evaluateCompositeCondition(
    condition: RuleCondition,
    request: GovernanceRequest
  ): Promise<boolean> {
    const children = condition.children ?? [];
    const results: boolean[] = [];

    for (const child of children) {
      results.push(await this.evaluateCondition(child, request));
    }

    switch (condition.logicalOperator) {
      case 'AND':
        return results.every((r) => r);
      case 'OR':
        return results.some((r) => r);
      case 'NOT':
        return results.length > 0 && !results[0];
      default:
        return results.every((r) => r);
    }
  }

  /**
   * Get field value from request
   */
  private getFieldValue(field: string, request: GovernanceRequest): unknown {
    const parts = field.split('.');
    let value: unknown = request;

    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = (value as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Compare values using operator
   */
  private compareValues(
    actual: unknown,
    operator: ConditionOperator,
    expected: unknown
  ): boolean {
    switch (operator) {
      case 'equals':
        return actual === expected;
      case 'not_equals':
        return actual !== expected;
      case 'greater_than':
        return Number(actual) > Number(expected);
      case 'less_than':
        return Number(actual) < Number(expected);
      case 'greater_or_equal':
        return Number(actual) >= Number(expected);
      case 'less_or_equal':
        return Number(actual) <= Number(expected);
      case 'contains':
        if (Array.isArray(actual)) {
          return actual.includes(expected);
        }
        return String(actual).includes(String(expected));
      case 'not_contains':
        if (Array.isArray(actual)) {
          return !actual.includes(expected);
        }
        return !String(actual).includes(String(expected));
      case 'matches':
        return new RegExp(String(expected)).test(String(actual));
      case 'in':
        return Array.isArray(expected) && expected.includes(actual);
      case 'not_in':
        return Array.isArray(expected) && !expected.includes(actual);
      case 'exists':
        return actual !== undefined && actual !== null;
      case 'not_exists':
        return actual === undefined || actual === null;
      default:
        return false;
    }
  }

  /**
   * Calculate confidence in decision
   */
  private calculateConfidence(matchedRules: EvaluatedRule[], _totalEvaluated: number): number {
    if (matchedRules.length === 0) {
      return 0.5; // Default confidence when no rules match
    }

    // Higher confidence for hard disqualifiers and regulatory mandates
    const highPriorityMatches = matchedRules.filter(
      (r) => r.category === 'hard_disqualifier' || r.category === 'regulatory_mandate'
    );

    if (highPriorityMatches.length > 0) {
      return 0.95;
    }

    // Calculate based on rule category priorities
    let totalWeight = 0;
    let weightedSum = 0;

    for (const rule of matchedRules) {
      const priority = CATEGORY_PRIORITY[rule.category] ?? 5;
      const weight = 1 - priority / 7; // Higher priority = higher weight
      totalWeight += weight;
      weightedSum += weight;
    }

    return totalWeight > 0 ? Math.min(0.9, weightedSum / totalWeight) : 0.5;
  }

  /**
   * Generate explanation for decision
   */
  private generateExplanation(
    decidingRule: EvaluatedRule | null,
    matchedRules: EvaluatedRule[],
    decision: ControlAction
  ): string {
    if (!decidingRule) {
      return `No rules matched. Default action: ${decision}`;
    }

    const ruleNames = matchedRules.map((r) => r.ruleName).join(', ');
    return `Decision based on rule "${decidingRule.ruleName}" (${decidingRule.category}). ` +
      `${matchedRules.length} rules matched: ${ruleNames}. Final action: ${decision}`;
  }

  /**
   * Create a denial result
   */
  private createDenialResult(
    resultId: ID,
    request: GovernanceRequest,
    evaluatedRules: EvaluatedRule[],
    reason: string,
    startTime: number
  ): GovernanceResult {
    return {
      resultId,
      requestId: request.requestId,
      decision: 'deny',
      confidence: 1.0,
      rulesEvaluated: evaluatedRules,
      rulesMatched: [],
      decidingRule: {
        ruleId: 'authority_check',
        ruleName: 'Authority Check',
        category: 'hard_disqualifier',
        matched: true,
        matchReason: reason,
        evaluationMs: 0,
      },
      modifications: [],
      constraints: [],
      explanation: reason,
      evaluatedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Query rules
   */
  async queryRules(query: RuleQuery): Promise<GovernanceRule[]> {
    let results = Array.from(this.rules.values());

    if (query.namespace) {
      results = results.filter((r) => r.namespace === query.namespace);
    }

    if (query.category) {
      results = results.filter((r) => r.category === query.category);
    }

    if (query.enabled !== undefined) {
      results = results.filter((r) => r.enabled === query.enabled);
    }

    if (query.trustLevel) {
      results = results.filter(
        (r) => r.applicableTrustLevels.length === 0 || r.applicableTrustLevels.includes(query.trustLevel!)
      );
    }

    // Sort by priority
    results.sort((a, b) => CATEGORY_PRIORITY[a.category] - CATEGORY_PRIORITY[b.category]);

    // Apply pagination
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 100;
    return results.slice(offset, offset + limit);
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalRules: number;
    byCategory: Record<RuleCategory, number>;
    byNamespace: Record<string, number>;
    totalAuthorities: number;
    cacheSize: number;
  } {
    const byCategory: Record<RuleCategory, number> = {
      hard_disqualifier: 0,
      regulatory_mandate: 0,
      security_critical: 0,
      policy_enforcement: 0,
      soft_constraint: 0,
      clarification_trigger: 0,
      logging_only: 0,
    };

    const byNamespace: Record<string, number> = {};

    for (const rule of this.rules.values()) {
      byCategory[rule.category]++;
      byNamespace[rule.namespace] = (byNamespace[rule.namespace] ?? 0) + 1;
    }

    return {
      totalRules: this.rules.size,
      byCategory,
      byNamespace,
      totalAuthorities: this.authorities.size,
      cacheSize: this.evaluationCache.size,
    };
  }

  /**
   * Clear evaluation cache
   */
  clearCache(): void {
    this.evaluationCache.clear();
    logger.debug('Evaluation cache cleared');
  }
}

/**
 * Create a new governance engine
 */
export function createGovernanceEngine(config?: Partial<GovernanceConfig>): GovernanceEngine {
  return new GovernanceEngine(config);
}

/**
 * Helper to create a governance rule
 */
export function createGovernanceRule(
  name: string,
  category: RuleCategory,
  condition: RuleCondition,
  effect: RuleEffect,
  options: Partial<GovernanceRule> = {}
): GovernanceRule {
  const now = new Date().toISOString();

  return {
    ruleId: crypto.randomUUID(),
    name,
    description: options.description ?? `Rule: ${name}`,
    category,
    namespace: options.namespace ?? 'default',
    version: options.version ?? '1.0.0',
    condition,
    effect,
    exceptions: options.exceptions ?? [],
    schedule: options.schedule,
    applicableTrustLevels: options.applicableTrustLevels ?? [],
    enabled: options.enabled ?? true,
    audit: {
      createdAt: now,
      createdBy: 'system',
      updatedAt: now,
      updatedBy: 'system',
      changeHistory: [],
    },
  };
}

/**
 * Helper to create a simple field condition
 */
export function createFieldCondition(
  field: string,
  operator: ConditionOperator,
  value: unknown
): RuleCondition {
  return {
    type: 'field_match',
    field,
    operator,
    value,
  };
}

/**
 * Helper to create a composite condition
 */
export function createCompositeCondition(
  logicalOperator: 'AND' | 'OR' | 'NOT',
  children: RuleCondition[]
): RuleCondition {
  return {
    type: 'composite',
    field: '',
    operator: 'equals',
    value: null,
    children,
    logicalOperator,
  };
}

/**
 * Helper to create a rule effect
 */
export function createRuleEffect(
  action: ControlAction,
  reason: string,
  options: Partial<RuleEffect> = {}
): RuleEffect {
  return {
    action,
    reason,
    modifications: options.modifications,
    constraints: options.constraints,
    clarification: options.clarification,
    escalation: options.escalation,
  };
}
