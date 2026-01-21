import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  createEnforcementService,
  type SimpleEnforcementContext,
  type EnforcementConfig,
} from '../../../src/enforce/index.js';
import type { Intent, ControlAction } from '../../../src/common/types.js';
import type { EvaluationResult, RuleResult } from '../../../src/basis/types.js';
import type { PolicyEvaluationResult } from '../../../src/policy/types.js';

// Mock circuit breaker to avoid Redis dependency in tests
vi.mock('../../../src/common/circuit-breaker.js', () => {
  class MockCircuitBreaker {
    async execute<T>(fn: () => Promise<T> | T) {
      try {
        const result = await fn();
        return { success: true, result, circuitOpen: false };
      } catch (error) {
        return { success: false, error: error as Error, circuitOpen: false };
      }
    }

    async getStatus() {
      return { state: 'CLOSED', failureCount: 0 };
    }
  }

  const factory = vi.fn(() => new MockCircuitBreaker());

  return {
    CircuitBreaker: MockCircuitBreaker,
    createCircuitBreaker: factory,
  };
});

const now = () => new Date().toISOString();

function createIntent(overrides: Partial<Intent> = {}): Intent {
  return {
    id: overrides.id ?? 'intent-1',
    tenantId: overrides.tenantId ?? 'tenant-1',
    entityId: overrides.entityId ?? 'entity-1',
    goal: overrides.goal ?? 'Test goal',
    intentType: overrides.intentType ?? 'test',
    context: overrides.context ?? {},
    metadata: overrides.metadata ?? {},
    priority: overrides.priority ?? 0,
    trustSnapshot: overrides.trustSnapshot ?? null,
    trustLevel: overrides.trustLevel ?? null,
    trustScore: overrides.trustScore ?? null,
    status: overrides.status ?? 'pending',
    createdAt: overrides.createdAt ?? now(),
    updatedAt: overrides.updatedAt ?? now(),
    deletedAt: overrides.deletedAt ?? null,
    cancellationReason: overrides.cancellationReason ?? null,
  };
}

function createRuleResult(action: ControlAction = 'allow'): RuleResult {
  return {
    ruleId: 'rule-1',
    ruleName: 'Allow rule',
    matched: true,
    action,
    reason: 'rule evaluated',
    details: {},
    durationMs: 1,
  };
}

function createEvaluationResult(overrides: Partial<EvaluationResult> = {}): EvaluationResult {
  return {
    passed: overrides.passed ?? true,
    finalAction: overrides.finalAction ?? 'allow',
    rulesEvaluated: overrides.rulesEvaluated ?? [createRuleResult()],
    violatedRules: overrides.violatedRules ?? [],
    totalDurationMs: overrides.totalDurationMs ?? 2,
    evaluatedAt: overrides.evaluatedAt ?? now(),
  };
}

function createPolicyEvaluation(
  overrides: Partial<PolicyEvaluationResult> = {}
): PolicyEvaluationResult {
  return {
    policyId: overrides.policyId ?? 'policy-1',
    policyName: overrides.policyName ?? 'default',
    policyVersion: overrides.policyVersion ?? 1,
    matched: overrides.matched ?? true,
    action: overrides.action ?? 'allow',
    reason: overrides.reason,
    rulesEvaluated: overrides.rulesEvaluated ?? [],
    matchedRules: overrides.matchedRules ?? [],
    durationMs: overrides.durationMs ?? 1,
    evaluatedAt: overrides.evaluatedAt ?? now(),
  };
}

function createContext(overrides: Partial<SimpleEnforcementContext> = {}): SimpleEnforcementContext {
  return {
    intent: overrides.intent ?? createIntent(),
    evaluation: overrides.evaluation ?? createEvaluationResult(),
    trustScore: overrides.trustScore ?? 650,
    trustLevel: overrides.trustLevel ?? 3,
    policyEvaluation: overrides.policyEvaluation,
  };
}

describe('EnforcementService', () => {
  let config: EnforcementConfig;

  beforeEach(() => {
    config = {
      policy: {
        defaultAction: 'deny',
        requirePolicyMatch: false,
        escalationRules: [],
        decisionCacheTtl: 5_000,
        enableAudit: false,
        enableMetrics: true,
      },
      auditEnabled: false,
      cacheTtlMs: 5_000,
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('allows intents when all constraints pass', () => {
    const service = createEnforcementService(config);
    const decision = service.decide(createContext());

    expect(decision.action).toBe('allow');
    expect(decision.constraintsEvaluated.length).toBeGreaterThan(0);
    expect(decision.trustLevel).toBe(3);
  });

  it('denies when trust level is below requirement', () => {
    const service = createEnforcementService({
      ...config,
      policy: {
        ...config.policy!,
        requireMinTrustLevel: 4,
      },
    });

    const decision = service.decide(createContext({ trustLevel: 1 }));
    expect(decision.action).toBe('deny');
    expect(
      decision.constraintsEvaluated.some((c) => c.constraintId === 'trust-level-check')
    ).toBe(true);
  });

  it('denies when policy evaluation fails even if rules pass', () => {
    const service = createEnforcementService(config);

    const context = createContext({
      policyEvaluation: createPolicyEvaluation({ action: 'deny', reason: 'policy block' }),
    });

    const decision = service.decide(context);
    expect(decision.action).toBe('deny');
    expect(decision.constraintsEvaluated.some((c) => c.constraintId.startsWith('policy-'))).toBe(true);
  });

  it('escalates when escalation rule matches trust criteria', () => {
    const service = createEnforcementService({
      ...config,
      policy: {
        ...config.policy!,
        escalationRules: [
          {
            id: 'esc-1',
            name: 'Low trust manual review',
            condition: { type: 'trust_below', value: 3 },
            escalateTo: 'secops',
            timeout: 'PT15M',
          },
        ],
      },
    });

    const decision = service.decide(createContext({ trustLevel: 1 }));
    expect(decision.action).toBe('escalate');
    expect(decision.escalation).toBeDefined();
  });

  it('caches decisions via decideWithCache', async () => {
    const service = createEnforcementService(config);
    const context = createContext();

    const first = await service.decideWithCache(context);
    const second = await service.decideWithCache(context);

    expect(first.action).toBe('allow');
    expect(second.action).toBe('allow');
    const stats = service.getCacheStats();
    expect(stats.size).toBeGreaterThan(0);
    expect(stats.hitRate).toBeGreaterThan(0);
  });

  it('clears cache when requested', async () => {
    const service = createEnforcementService(config);
    const context = createContext();
    await service.decideWithCache(context);

    let stats = service.getCacheStats();
    expect(stats.size).toBeGreaterThan(0);

    service.clearCache();
    stats = service.getCacheStats();
    expect(stats.size).toBe(0);
  });
});
