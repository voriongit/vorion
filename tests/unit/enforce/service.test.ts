/**
 * Enforcement Service Tests
 *
 * Tests for the EnforcementService class and related functionality.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  EnforcementService,
  createEnforcementService,
} from '../../../src/enforce/index.js';
import type {
  EnforcementPolicy,
  EscalationRule,
} from '../../../src/enforce/types.js';
import type { Intent, TrustLevel, TrustScore } from '../../../src/common/types.js';
import type { EvaluationResult, RuleResult } from '../../../src/basis/types.js';

// Mock logger
vi.mock('../../../src/common/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Helper to create mock intent
function createMockIntent(overrides?: Partial<Intent>): Intent {
  return {
    id: 'intent-123',
    tenantId: 'tenant-456',
    entityId: 'entity-789',
    action: 'read',
    resource: 'document',
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// Helper to create mock evaluation result
function createMockEvaluation(overrides?: Partial<EvaluationResult>): EvaluationResult {
  return {
    passed: true,
    finalAction: 'allow',
    rulesEvaluated: [],
    ...overrides,
  };
}

// Helper to create mock rule result
function createMockRuleResult(overrides?: Partial<RuleResult>): RuleResult {
  return {
    ruleId: 'rule-1',
    ruleName: 'Test Rule',
    matched: true,
    action: 'allow',
    durationMs: 1,
    ...overrides,
  };
}

describe('EnforcementService', () => {
  let service: EnforcementService;

  beforeEach(() => {
    service = createEnforcementService();
  });

  describe('constructor', () => {
    it('should create with default policy', () => {
      const s = new EnforcementService();
      expect(s.getPolicy().defaultAction).toBe('deny');
    });

    it('should create with custom policy', () => {
      const policy: EnforcementPolicy = {
        defaultAction: 'allow',
        requireMinTrustLevel: 2,
        requirePolicyMatch: true,
        escalationRules: [],
        decisionCacheTtl: 60000,
        enableAudit: true,
        enableMetrics: true,
      };
      const s = new EnforcementService({ policy });
      expect(s.getPolicy().defaultAction).toBe('allow');
      expect(s.getPolicy().requireMinTrustLevel).toBe(2);
    });

    it('should support shorthand configuration', () => {
      const s = new EnforcementService({
        defaultAction: 'allow',
        requireMinTrustLevel: 3,
      });
      expect(s.getPolicy().defaultAction).toBe('allow');
      expect(s.getPolicy().requireMinTrustLevel).toBe(3);
    });
  });

  describe('decide', () => {
    it('should allow intent when evaluation passes and trust is sufficient', () => {
      service.setPolicy({
        defaultAction: 'deny',
        requireMinTrustLevel: 1,
        requirePolicyMatch: false,
        escalationRules: [],
        decisionCacheTtl: 60000,
        enableAudit: false,
        enableMetrics: true,
      });

      const decision = service.decide({
        intent: createMockIntent(),
        evaluation: createMockEvaluation({ passed: true, finalAction: 'allow' }),
        trustScore: 500 as TrustScore,
        trustLevel: 2 as TrustLevel,
      });

      expect(decision.action).toBe('allow');
    });

    it('should deny intent when trust level is below minimum', () => {
      service.setPolicy({
        defaultAction: 'deny',
        requireMinTrustLevel: 3,
        requirePolicyMatch: false,
        escalationRules: [],
        decisionCacheTtl: 60000,
        enableAudit: false,
        enableMetrics: true,
      });

      const decision = service.decide({
        intent: createMockIntent(),
        evaluation: createMockEvaluation({ passed: true }),
        trustScore: 200 as TrustScore,
        trustLevel: 1 as TrustLevel,
      });

      expect(decision.action).toBe('deny');
    });

    it('should use evaluation action when evaluation fails', () => {
      const decision = service.decide({
        intent: createMockIntent(),
        evaluation: createMockEvaluation({ passed: false, finalAction: 'escalate' }),
        trustScore: 500 as TrustScore,
        trustLevel: 2 as TrustLevel,
      });

      expect(decision.action).toBe('escalate');
    });

    it('should include constraints in decision', () => {
      service.setPolicy({
        defaultAction: 'deny',
        requireMinTrustLevel: 1,
        requirePolicyMatch: false,
        escalationRules: [],
        decisionCacheTtl: 60000,
        enableAudit: false,
        enableMetrics: true,
      });

      const decision = service.decide({
        intent: createMockIntent(),
        evaluation: createMockEvaluation({
          passed: true,
          rulesEvaluated: [
            createMockRuleResult({ ruleId: 'rule-1', matched: true, action: 'allow' }),
          ],
        }),
        trustScore: 500 as TrustScore,
        trustLevel: 2 as TrustLevel,
      });

      expect(decision.constraintsEvaluated).toBeDefined();
      expect(decision.constraintsEvaluated.length).toBeGreaterThan(0);
    });

    it('should set decidedAt timestamp', () => {
      const before = new Date().toISOString();
      const decision = service.decide({
        intent: createMockIntent(),
        evaluation: createMockEvaluation(),
        trustScore: 500 as TrustScore,
        trustLevel: 2 as TrustLevel,
      });
      const after = new Date().toISOString();

      expect(decision.decidedAt).toBeDefined();
      expect(decision.decidedAt >= before).toBe(true);
      expect(decision.decidedAt <= after).toBe(true);
    });
  });

  describe('escalation rules', () => {
    it('should not escalate when no rules match', () => {
      service.setPolicy({
        defaultAction: 'deny',
        requireMinTrustLevel: undefined,
        requirePolicyMatch: false,
        escalationRules: [
          {
            id: 'esc-1',
            name: 'Low Trust Escalation',
            condition: { type: 'trust_below', value: 1 },
            escalateTo: 'admin@example.com',
            timeout: 'PT1H',
            priority: 'high',
            requireJustification: true,
            autoDenyOnTimeout: true,
          },
        ],
        decisionCacheTtl: 60000,
        enableAudit: false,
        enableMetrics: true,
      });

      const decision = service.decide({
        intent: createMockIntent(),
        evaluation: createMockEvaluation({ passed: true }),
        trustScore: 500 as TrustScore,
        trustLevel: 3 as TrustLevel, // Above threshold
      });

      expect(decision.action).not.toBe('escalate');
    });

    it('should escalate when trust is below threshold', () => {
      service.setPolicy({
        defaultAction: 'deny',
        requireMinTrustLevel: undefined,
        requirePolicyMatch: false,
        escalationRules: [
          {
            id: 'esc-1',
            name: 'Low Trust Escalation',
            condition: { type: 'trust_below', value: 2 },
            escalateTo: 'admin@example.com',
            timeout: 'PT1H',
            priority: 'high',
            requireJustification: true,
            autoDenyOnTimeout: true,
          },
        ],
        decisionCacheTtl: 60000,
        enableAudit: false,
        enableMetrics: true,
      });

      const decision = service.decide({
        intent: createMockIntent(),
        evaluation: createMockEvaluation({ passed: true }),
        trustScore: 100 as TrustScore,
        trustLevel: 1 as TrustLevel, // Below threshold of 2
      });

      expect(decision.action).toBe('escalate');
    });

    it('should escalate on deny action when rule matches', () => {
      service.setPolicy({
        defaultAction: 'deny',
        requireMinTrustLevel: undefined,
        requirePolicyMatch: false,
        escalationRules: [
          {
            id: 'esc-2',
            name: 'Deny Escalation',
            condition: { type: 'action_type', value: 'deny' },
            escalateTo: 'security@example.com',
            timeout: 'PT30M',
            priority: 'critical',
            requireJustification: false,
            autoDenyOnTimeout: true,
          },
        ],
        decisionCacheTtl: 60000,
        enableAudit: false,
        enableMetrics: true,
      });

      const decision = service.decide({
        intent: createMockIntent(),
        evaluation: createMockEvaluation({ passed: false, finalAction: 'deny' }),
        trustScore: 500 as TrustScore,
        trustLevel: 3 as TrustLevel,
      });

      // Decision should be escalate because the escalation rule matches deny
      expect(decision.action).toBe('escalate');
    });
  });

  describe('setPolicy', () => {
    it('should update the policy', () => {
      const newPolicy: EnforcementPolicy = {
        defaultAction: 'allow',
        requireMinTrustLevel: 4,
        requirePolicyMatch: true,
        escalationRules: [],
        decisionCacheTtl: 120000,
        enableAudit: true,
        enableMetrics: true,
      };

      service.setPolicy(newPolicy);

      expect(service.getPolicy().defaultAction).toBe('allow');
      expect(service.getPolicy().requireMinTrustLevel).toBe(4);
    });
  });

  describe('getPolicy', () => {
    it('should return a copy of the policy', () => {
      const policy = service.getPolicy();
      policy.defaultAction = 'allow';

      // Original should be unchanged
      expect(service.getPolicy().defaultAction).toBe('deny');
    });
  });

  describe('metrics', () => {
    it('should track decision metrics', () => {
      // Make some decisions
      service.decide({
        intent: createMockIntent(),
        evaluation: createMockEvaluation({ passed: true }),
        trustScore: 500 as TrustScore,
        trustLevel: 2 as TrustLevel,
      });

      service.decide({
        intent: createMockIntent(),
        evaluation: createMockEvaluation({ passed: false, finalAction: 'deny' }),
        trustScore: 100 as TrustScore,
        trustLevel: 0 as TrustLevel,
      });

      const metrics = service.getMetrics();

      expect(metrics.decisions.allow).toBe(1);
      expect(metrics.decisions.deny).toBe(1);
      expect(metrics.totalDecisions).toBe(2);
    });
  });

  describe('cache', () => {
    it('should track cache stats', () => {
      const stats = service.getCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.hitRate).toBe(0);
    });

    it('should clear cache', () => {
      service.clearCache();
      expect(service.getCacheStats().size).toBe(0);
    });
  });

  describe('circuit breaker', () => {
    it('should return circuit breaker status', () => {
      const status = service.getCircuitBreakerStatus();
      expect(status.state).toBeDefined();
      expect(['closed', 'open', 'half-open']).toContain(status.state);
    });
  });
});

describe('createEnforcementService', () => {
  it('should create a service with default config', () => {
    const service = createEnforcementService();
    expect(service).toBeInstanceOf(EnforcementService);
  });

  it('should create a service with custom config', () => {
    const service = createEnforcementService({
      defaultAction: 'allow',
      requireMinTrustLevel: 2,
    });
    expect(service.getPolicy().defaultAction).toBe('allow');
  });
});
