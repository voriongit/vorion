/**
 * Replay System Tests
 *
 * Tests for the intent replay system including:
 * - Replay execution
 * - Snapshot capture/restore
 * - Comparison
 * - Simulation
 * - Dry-run mode
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ReplayEngine,
  createReplayEngine,
  SnapshotManager,
  createSnapshotManager,
  ReplayComparator,
  createReplayComparator,
  SimulationEngine,
  createSimulationEngine,
  type ReplayOptions,
  type SystemSnapshot,
  type TrustSnapshot,
  type PolicySnapshot,
  type OriginalExecution,
  type CreateIntent,
  type SimulationContext,
} from '../../../src/intent/replay/index.js';
import type { Intent, TrustLevel } from '../../../src/common/types.js';
import type { Policy } from '../../../src/policy/types.js';

// Mock dependencies
vi.mock('../../../src/common/logger.js', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Mock OpenTelemetry tracing
vi.mock('@opentelemetry/api', () => {
  const mockSpan = {
    setAttributes: vi.fn(),
    setAttribute: vi.fn(),
    setStatus: vi.fn(),
    recordException: vi.fn(),
    addEvent: vi.fn(),
    end: vi.fn(),
  };

  return {
    trace: {
      getTracer: vi.fn(() => ({
        startActiveSpan: vi.fn((name, options, fn) => {
          if (typeof options === 'function') {
            return options(mockSpan);
          }
          return fn(mockSpan);
        }),
      })),
    },
    SpanKind: {
      INTERNAL: 0,
      CLIENT: 1,
      SERVER: 2,
      PRODUCER: 3,
      CONSUMER: 4,
    },
    SpanStatusCode: {
      OK: 1,
      ERROR: 2,
      UNSET: 0,
    },
  };
});

// =============================================================================
// TEST FIXTURES
// =============================================================================

const createTestIntent = (overrides: Partial<Intent> = {}): Intent => ({
  id: 'intent-123',
  tenantId: 'tenant-456',
  entityId: 'entity-789',
  goal: 'Test intent goal',
  intentType: 'test-type',
  context: { key: 'value' },
  metadata: { source: 'test' },
  priority: 5,
  status: 'approved',
  trustSnapshot: { score: 700, level: 3 },
  trustLevel: 3 as TrustLevel,
  trustScore: 700,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

const createTestPolicy = (overrides: Partial<Policy> = {}): Policy => ({
  id: 'policy-123',
  tenantId: 'tenant-456',
  name: 'Test Policy',
  namespace: 'default',
  version: 1,
  status: 'published',
  checksum: 'abc123',
  definition: {
    version: '1.0',
    rules: [
      {
        id: 'rule-1',
        name: 'Test Rule',
        priority: 1,
        enabled: true,
        when: { type: 'trust', level: 3 as TrustLevel, operator: 'greater_than_or_equal' },
        then: { action: 'allow', reason: 'Trust level sufficient' },
      },
    ],
    defaultAction: 'deny',
    defaultReason: 'Default deny',
  },
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

const createTestTrustData = () => ({
  score: 700,
  level: 3 as TrustLevel,
  components: {
    behavioral: 750,
    compliance: 700,
    identity: 650,
    context: 700,
  },
});

// =============================================================================
// SNAPSHOT MANAGER TESTS
// =============================================================================

describe('SnapshotManager', () => {
  let snapshotManager: SnapshotManager;

  beforeEach(async () => {
    snapshotManager = createSnapshotManager();
    await snapshotManager.clear();
  });

  describe('capture', () => {
    it('should capture a complete system snapshot', async () => {
      const intent = createTestIntent();
      const trustData = createTestTrustData();
      const policies = [createTestPolicy()];

      const snapshot = await snapshotManager.capture(intent, trustData, policies);

      expect(snapshot).toBeDefined();
      expect(snapshot.id).toBeDefined();
      expect(snapshot.intentId).toBe(intent.id);
      expect(snapshot.tenantId).toBe(intent.tenantId);
      expect(snapshot.intent).toEqual(intent);
      expect(snapshot.trust.score).toBe(trustData.score);
      expect(snapshot.trust.level).toBe(trustData.level);
      expect(snapshot.policies).toHaveLength(1);
      expect(snapshot.version).toBe('1.0');
    });

    it('should capture snapshot with custom options', async () => {
      const intent = createTestIntent();
      const trustData = createTestTrustData();
      const policies = [createTestPolicy()];

      const snapshot = await snapshotManager.capture(intent, trustData, policies, {
        includePolicyDefinitions: true,
        customContext: { test: 'context' },
        metadata: { audit: 'info' },
      });

      expect(snapshot.environment.custom).toEqual({ test: 'context' });
      expect(snapshot.metadata).toEqual({ audit: 'info' });
      expect(snapshot.policies[0]?.definition.rules).toHaveLength(1);
    });

    it('should store snapshot for retrieval', async () => {
      const intent = createTestIntent();
      const trustData = createTestTrustData();
      const policies = [createTestPolicy()];

      const snapshot = await snapshotManager.capture(intent, trustData, policies);
      const retrieved = await snapshotManager.get(snapshot.id);

      expect(retrieved).toEqual(snapshot);
    });
  });

  describe('get', () => {
    it('should return null for non-existent snapshot', async () => {
      const result = await snapshotManager.get('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('getByIntentId', () => {
    it('should find snapshot by intent ID', async () => {
      const intent = createTestIntent();
      const trustData = createTestTrustData();
      const policies = [createTestPolicy()];

      await snapshotManager.capture(intent, trustData, policies);
      const found = await snapshotManager.getByIntentId(intent.id);

      expect(found).toBeDefined();
      expect(found?.intentId).toBe(intent.id);
    });

    it('should return null for non-existent intent', async () => {
      const result = await snapshotManager.getByIntentId('non-existent-intent');
      expect(result).toBeNull();
    });
  });

  describe('restore', () => {
    it('should restore snapshot to context', async () => {
      const intent = createTestIntent();
      const trustData = createTestTrustData();
      const policies = [createTestPolicy()];

      const snapshot = await snapshotManager.capture(intent, trustData, policies);
      const restored = await snapshotManager.restore(snapshot.id);

      expect(restored).toBeDefined();
      expect(restored?.intent).toEqual(intent);
      expect(restored?.trust.score).toBe(trustData.score);
      expect(restored?.policies).toHaveLength(1);
      expect(restored?.evaluationContext).toBeDefined();
    });

    it('should apply trust overrides', async () => {
      const intent = createTestIntent();
      const trustData = createTestTrustData();
      const policies = [createTestPolicy()];

      const snapshot = await snapshotManager.capture(intent, trustData, policies);
      const restored = await snapshotManager.restore(snapshot.id, {
        trustOverride: { score: 900, level: 4 as TrustLevel },
      });

      expect(restored?.trust.score).toBe(900);
      expect(restored?.trust.level).toBe(4);
    });

    it('should return null for non-existent snapshot', async () => {
      const result = await snapshotManager.restore('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete existing snapshot', async () => {
      const intent = createTestIntent();
      const trustData = createTestTrustData();
      const policies = [createTestPolicy()];

      const snapshot = await snapshotManager.capture(intent, trustData, policies);
      const deleted = await snapshotManager.delete(snapshot.id);

      expect(deleted).toBe(true);
      expect(await snapshotManager.get(snapshot.id)).toBeNull();
    });

    it('should return false for non-existent snapshot', async () => {
      const deleted = await snapshotManager.delete('non-existent-id');
      expect(deleted).toBe(false);
    });
  });

  describe('listByTenant', () => {
    it('should list all snapshots for a tenant', async () => {
      const intent1 = createTestIntent({ id: 'intent-1' });
      const intent2 = createTestIntent({ id: 'intent-2' });
      const trustData = createTestTrustData();
      const policies = [createTestPolicy()];

      await snapshotManager.capture(intent1, trustData, policies);
      await snapshotManager.capture(intent2, trustData, policies);

      const snapshots = await snapshotManager.listByTenant('tenant-456');
      expect(snapshots).toHaveLength(2);
    });

    it('should return empty array for tenant with no snapshots', async () => {
      const snapshots = await snapshotManager.listByTenant('non-existent-tenant');
      expect(snapshots).toHaveLength(0);
    });
  });

  describe('clear', () => {
    it('should clear all snapshots', async () => {
      const intent = createTestIntent();
      const trustData = createTestTrustData();
      const policies = [createTestPolicy()];

      await snapshotManager.capture(intent, trustData, policies);
      await snapshotManager.clear();

      expect(await snapshotManager.count()).toBe(0);
    });
  });
});

// =============================================================================
// COMPARATOR TESTS
// =============================================================================

describe('ReplayComparator', () => {
  let comparator: ReplayComparator;

  beforeEach(() => {
    comparator = createReplayComparator();
  });

  describe('compare', () => {
    it('should detect matching results', async () => {
      const original: OriginalExecution = {
        intentId: 'intent-123',
        action: 'allow',
        policiesApplied: [
          { policyId: 'policy-1', policyName: 'Policy 1', action: 'allow' },
        ],
        trustScore: 700,
        trustLevel: 3,
        durationMs: 100,
        evaluatedAt: '2024-01-01T00:00:00.000Z',
      };

      const replay = {
        replayId: 'replay-123',
        intentId: 'intent-123',
        snapshotId: 'snapshot-123',
        tenantId: 'tenant-456',
        replayedAt: '2024-01-01T00:00:00.000Z',
        success: true,
        dryRun: false,
        steps: [],
        outcome: {
          action: 'allow' as const,
          trustScore: 700,
          trustLevel: 3 as TrustLevel,
          policiesApplied: [
            { policyId: 'policy-1', policyName: 'Policy 1', action: 'allow' as const },
          ],
        },
        differences: [],
        timing: {
          totalDurationMs: 105,
          stepBreakdown: {},
        },
      };

      const report = await comparator.compare(original, replay);

      expect(report.isMatch).toBe(true);
      expect(report.decision.matches).toBe(true);
      expect(report.summary.criticalDifferences).toBe(0);
    });

    it('should detect decision differences', async () => {
      const original: OriginalExecution = {
        intentId: 'intent-123',
        action: 'allow',
        policiesApplied: [],
        trustScore: 700,
        trustLevel: 3,
        durationMs: 100,
        evaluatedAt: '2024-01-01T00:00:00.000Z',
      };

      const replay = {
        replayId: 'replay-123',
        intentId: 'intent-123',
        snapshotId: 'snapshot-123',
        tenantId: 'tenant-456',
        replayedAt: '2024-01-01T00:00:00.000Z',
        success: true,
        dryRun: false,
        steps: [],
        outcome: {
          action: 'deny' as const,
          trustScore: 700,
          trustLevel: 3 as TrustLevel,
          policiesApplied: [],
        },
        differences: [],
        timing: {
          totalDurationMs: 100,
          stepBreakdown: {},
        },
      };

      const report = await comparator.compare(original, replay);

      expect(report.isMatch).toBe(false);
      expect(report.decision.matches).toBe(false);
      expect(report.summary.criticalDifferences).toBe(1);
      expect(report.differences.some((d) => d.type === 'decision')).toBe(true);
    });

    it('should detect trust level changes', async () => {
      const original: OriginalExecution = {
        intentId: 'intent-123',
        action: 'allow',
        policiesApplied: [],
        trustScore: 700,
        trustLevel: 3,
        durationMs: 100,
        evaluatedAt: '2024-01-01T00:00:00.000Z',
      };

      const replay = {
        replayId: 'replay-123',
        intentId: 'intent-123',
        snapshotId: 'snapshot-123',
        tenantId: 'tenant-456',
        replayedAt: '2024-01-01T00:00:00.000Z',
        success: true,
        dryRun: false,
        steps: [],
        outcome: {
          action: 'allow' as const,
          trustScore: 700,
          trustLevel: 4 as TrustLevel,
          policiesApplied: [],
        },
        differences: [],
        timing: {
          totalDurationMs: 100,
          stepBreakdown: {},
        },
      };

      const report = await comparator.compare(original, replay);

      expect(report.differences.some((d) => d.type === 'trust_level')).toBe(true);
    });

    it('should detect policy differences', async () => {
      const original: OriginalExecution = {
        intentId: 'intent-123',
        action: 'allow',
        policiesApplied: [
          { policyId: 'policy-1', policyName: 'Policy 1', action: 'allow' },
          { policyId: 'policy-2', policyName: 'Policy 2', action: 'deny' },
        ],
        trustScore: 700,
        trustLevel: 3,
        durationMs: 100,
        evaluatedAt: '2024-01-01T00:00:00.000Z',
      };

      const replay = {
        replayId: 'replay-123',
        intentId: 'intent-123',
        snapshotId: 'snapshot-123',
        tenantId: 'tenant-456',
        replayedAt: '2024-01-01T00:00:00.000Z',
        success: true,
        dryRun: false,
        steps: [],
        outcome: {
          action: 'allow' as const,
          trustScore: 700,
          trustLevel: 3 as TrustLevel,
          policiesApplied: [
            { policyId: 'policy-1', policyName: 'Policy 1', action: 'allow' as const },
          ],
        },
        differences: [],
        timing: {
          totalDurationMs: 100,
          stepBreakdown: {},
        },
      };

      const report = await comparator.compare(original, replay);

      expect(report.policyComparison.length).toBe(2);
      expect(report.summary.policiesChanged).toBeGreaterThan(0);
    });

    it('should generate recommendations', async () => {
      const original: OriginalExecution = {
        intentId: 'intent-123',
        action: 'allow',
        policiesApplied: [],
        trustScore: 700,
        trustLevel: 3,
        durationMs: 100,
        evaluatedAt: '2024-01-01T00:00:00.000Z',
      };

      const replay = {
        replayId: 'replay-123',
        intentId: 'intent-123',
        snapshotId: 'snapshot-123',
        tenantId: 'tenant-456',
        replayedAt: '2024-01-01T00:00:00.000Z',
        success: true,
        dryRun: false,
        steps: [],
        outcome: {
          action: 'deny' as const,
          trustScore: 700,
          trustLevel: 3 as TrustLevel,
          policiesApplied: [],
        },
        differences: [],
        timing: {
          totalDurationMs: 100,
          stepBreakdown: {},
        },
      };

      const report = await comparator.compare(original, replay, { generateRecommendations: true });

      expect(report.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('summarize', () => {
    it('should generate human-readable summary', async () => {
      const original: OriginalExecution = {
        intentId: 'intent-123',
        action: 'allow',
        policiesApplied: [],
        trustScore: 700,
        trustLevel: 3,
        durationMs: 100,
        evaluatedAt: '2024-01-01T00:00:00.000Z',
      };

      const replay = {
        replayId: 'replay-123',
        intentId: 'intent-123',
        snapshotId: 'snapshot-123',
        tenantId: 'tenant-456',
        replayedAt: '2024-01-01T00:00:00.000Z',
        success: true,
        dryRun: false,
        steps: [],
        outcome: {
          action: 'allow' as const,
          trustScore: 700,
          trustLevel: 3 as TrustLevel,
          policiesApplied: [],
        },
        differences: [],
        timing: {
          totalDurationMs: 100,
          stepBreakdown: {},
        },
      };

      const report = await comparator.compare(original, replay);
      const summary = comparator.summarize(report);

      expect(summary).toContain('Comparison Report');
      expect(summary).toContain('intent-123');
      expect(summary).toContain('Overall Match: YES');
    });
  });
});

// =============================================================================
// SIMULATION ENGINE TESTS
// =============================================================================

describe('SimulationEngine', () => {
  let simulator: SimulationEngine;

  beforeEach(() => {
    simulator = createSimulationEngine();
  });

  describe('simulate', () => {
    it('should simulate a single intent', async () => {
      const intent: CreateIntent = {
        entityId: 'entity-123',
        goal: 'Test simulation',
        intentType: 'test-type',
        context: { key: 'value' },
      };

      const context: SimulationContext = {
        tenantId: 'tenant-456',
        trustScore: 700,
        trustLevel: 3 as TrustLevel,
        policies: [createTestPolicy()],
      };

      const result = await simulator.simulate(intent, context);

      expect(result.success).toBe(true);
      expect(result.simulationId).toBeDefined();
      expect(result.outcome.action).toBeDefined();
      expect(result.outcome.policiesEvaluated).toBe(1);
    });

    it('should evaluate policies correctly', async () => {
      const intent: CreateIntent = {
        entityId: 'entity-123',
        goal: 'Test simulation',
        intentType: 'test-type',
      };

      const denyPolicy = createTestPolicy({
        id: 'deny-policy',
        name: 'Deny Policy',
        definition: {
          version: '1.0',
          rules: [
            {
              id: 'deny-rule',
              name: 'Deny Rule',
              priority: 1,
              enabled: true,
              when: { type: 'trust', level: 0 as TrustLevel, operator: 'greater_than_or_equal' },
              then: { action: 'deny', reason: 'Denied by policy' },
            },
          ],
          defaultAction: 'deny',
        },
      });

      const context: SimulationContext = {
        tenantId: 'tenant-456',
        trustScore: 700,
        trustLevel: 3 as TrustLevel,
        policies: [denyPolicy],
      };

      const result = await simulator.simulate(intent, context);

      expect(result.success).toBe(true);
      expect(result.outcome.action).toBe('deny');
    });

    it('should include policy details in result', async () => {
      const intent: CreateIntent = {
        entityId: 'entity-123',
        goal: 'Test simulation',
      };

      const context: SimulationContext = {
        tenantId: 'tenant-456',
        trustScore: 700,
        trustLevel: 3 as TrustLevel,
        policies: [createTestPolicy()],
      };

      const result = await simulator.simulate(intent, context);

      expect(result.policyDetails).toHaveLength(1);
      expect(result.policyDetails[0]?.policyId).toBe('policy-123');
    });
  });

  describe('simulateBulk', () => {
    it('should simulate multiple intents', async () => {
      const intents: CreateIntent[] = [
        { entityId: 'entity-1', goal: 'Goal 1' },
        { entityId: 'entity-2', goal: 'Goal 2' },
        { entityId: 'entity-3', goal: 'Goal 3' },
      ];

      const context: SimulationContext = {
        tenantId: 'tenant-456',
        trustScore: 700,
        trustLevel: 3 as TrustLevel,
        policies: [createTestPolicy()],
      };

      const result = await simulator.simulateBulk(intents, context);

      expect(result.summary.total).toBe(3);
      expect(result.summary.succeeded).toBe(3);
      expect(result.summary.failed).toBe(0);
      expect(result.results).toHaveLength(3);
    });

    it('should calculate policy impact', async () => {
      const intents: CreateIntent[] = [
        { entityId: 'entity-1', goal: 'Goal 1' },
        { entityId: 'entity-2', goal: 'Goal 2' },
      ];

      const context: SimulationContext = {
        tenantId: 'tenant-456',
        trustScore: 700,
        trustLevel: 3 as TrustLevel,
        policies: [createTestPolicy()],
      };

      const result = await simulator.simulateBulk(intents, context);

      expect(result.policyImpact).toHaveLength(1);
      expect(result.policyImpact[0]?.timesEvaluated).toBe(2);
    });

    it('should continue on error when configured', async () => {
      const intents: CreateIntent[] = [
        { entityId: 'entity-1', goal: 'Goal 1' },
        { entityId: 'entity-2', goal: 'Goal 2' },
      ];

      const context: SimulationContext = {
        tenantId: 'tenant-456',
        trustScore: 700,
        trustLevel: 3 as TrustLevel,
        policies: [createTestPolicy()],
      };

      const result = await simulator.simulateBulk(intents, context, { continueOnError: true });

      expect(result.summary.total).toBe(2);
    });
  });

  describe('whatIf', () => {
    it('should compare baseline and modified simulations', async () => {
      const intent: CreateIntent = {
        entityId: 'entity-123',
        goal: 'Test what-if',
      };

      const context: SimulationContext = {
        tenantId: 'tenant-456',
        trustScore: 700,
        trustLevel: 3 as TrustLevel,
        policies: [createTestPolicy()],
      };

      const result = await simulator.whatIf(intent, context, {
        trustLevelOverride: 5 as TrustLevel,
      });

      expect(result.baseline).toBeDefined();
      expect(result.modified).toBeDefined();
      expect(result.comparison).toBeDefined();
    });

    it('should detect action changes with policy modifications', async () => {
      const intent: CreateIntent = {
        entityId: 'entity-123',
        goal: 'Test what-if',
      };

      const originalPolicy = createTestPolicy({
        definition: {
          version: '1.0',
          rules: [
            {
              id: 'rule-1',
              name: 'Allow Rule',
              priority: 1,
              enabled: true,
              when: { type: 'trust', level: 0 as TrustLevel, operator: 'greater_than_or_equal' },
              then: { action: 'allow', reason: 'Allowed' },
            },
          ],
          defaultAction: 'allow',
        },
      });

      const modifiedPolicy = createTestPolicy({
        definition: {
          version: '1.0',
          rules: [
            {
              id: 'rule-1',
              name: 'Deny Rule',
              priority: 1,
              enabled: true,
              when: { type: 'trust', level: 0 as TrustLevel, operator: 'greater_than_or_equal' },
              then: { action: 'deny', reason: 'Denied' },
            },
          ],
          defaultAction: 'deny',
        },
      });

      const context: SimulationContext = {
        tenantId: 'tenant-456',
        trustScore: 700,
        trustLevel: 3 as TrustLevel,
        policies: [originalPolicy],
      };

      const result = await simulator.whatIf(intent, context, {
        modifiedPolicies: [modifiedPolicy],
      });

      expect(result.comparison.actionChanged).toBe(true);
      expect(result.baseline.outcome.action).toBe('allow');
      expect(result.modified.outcome.action).toBe('deny');
    });
  });
});

// =============================================================================
// REPLAY ENGINE TESTS
// =============================================================================

describe('ReplayEngine', () => {
  let engine: ReplayEngine;
  let snapshotManager: SnapshotManager;

  beforeEach(async () => {
    snapshotManager = createSnapshotManager();
    engine = new ReplayEngine(snapshotManager);
    await snapshotManager.clear();
  });

  describe('replay', () => {
    it('should replay an intent from snapshot', async () => {
      const intent = createTestIntent();
      const trustData = createTestTrustData();
      const policies = [createTestPolicy()];

      // Capture snapshot first
      await snapshotManager.capture(intent, trustData, policies, {
        includePolicyDefinitions: true,
      });

      // Replay
      const result = await engine.replay(intent.id);

      expect(result.success).toBe(true);
      expect(result.intentId).toBe(intent.id);
      expect(result.steps.length).toBeGreaterThan(0);
      expect(result.outcome.action).toBeDefined();
    });

    it('should fail gracefully when snapshot not found', async () => {
      const result = await engine.replay('non-existent-intent');

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Snapshot not found');
    });

    it('should execute dry run without persistence', async () => {
      const intent = createTestIntent();
      const trustData = createTestTrustData();
      const policies = [createTestPolicy()];

      await snapshotManager.capture(intent, trustData, policies, {
        includePolicyDefinitions: true,
      });

      const result = await engine.replay(intent.id, { dryRun: true });

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(result.steps.find((s) => s.step === 'execution')?.status).toBe('skipped');
    });

    it('should stop at specified step', async () => {
      const intent = createTestIntent();
      const trustData = createTestTrustData();
      const policies = [createTestPolicy()];

      await snapshotManager.capture(intent, trustData, policies, {
        includePolicyDefinitions: true,
      });

      const result = await engine.replay(intent.id, { stopAt: 'trust-evaluation' });

      expect(result.success).toBe(true);
      expect(result.steps.find((s) => s.step === 'trust-evaluation')?.status).toBe('completed');
      expect(result.steps.find((s) => s.step === 'policy-evaluation')).toBeUndefined();
    });

    it('should apply trust score override', async () => {
      const intent = createTestIntent();
      const trustData = createTestTrustData();
      const policies = [createTestPolicy()];

      await snapshotManager.capture(intent, trustData, policies, {
        includePolicyDefinitions: true,
      });

      const result = await engine.replay(intent.id, {
        trustScoreOverride: 900,
        trustLevelOverride: 5 as TrustLevel,
      });

      expect(result.success).toBe(true);
      expect(result.outcome.trustScore).toBe(900);
      expect(result.outcome.trustLevel).toBe(5);
    });

    it('should apply policy modifications', async () => {
      const intent = createTestIntent();
      const trustData = createTestTrustData();
      const originalPolicy = createTestPolicy();

      await snapshotManager.capture(intent, trustData, [originalPolicy], {
        includePolicyDefinitions: true,
      });

      const modifiedPolicy = createTestPolicy({
        id: 'new-policy',
        name: 'New Policy',
        definition: {
          version: '1.0',
          rules: [
            {
              id: 'deny-rule',
              name: 'Deny All',
              priority: 1,
              enabled: true,
              when: { type: 'trust', level: 0 as TrustLevel, operator: 'greater_than_or_equal' },
              then: { action: 'deny', reason: 'Denied by new policy' },
            },
          ],
          defaultAction: 'deny',
        },
      });

      const result = await engine.replay(intent.id, {
        modifyPolicy: {
          policies: [modifiedPolicy],
        },
      });

      expect(result.success).toBe(true);
      expect(result.outcome.action).toBe('deny');
    });

    it('should include step details when requested', async () => {
      const intent = createTestIntent();
      const trustData = createTestTrustData();
      const policies = [createTestPolicy()];

      await snapshotManager.capture(intent, trustData, policies, {
        includePolicyDefinitions: true,
      });

      const result = await engine.replay(intent.id, { includeStepDetails: true });

      expect(result.success).toBe(true);
      expect(result.steps[0]?.data).toBeDefined();
    });

    it('should generate comparison report when requested', async () => {
      const intent = createTestIntent();
      const trustData = createTestTrustData();
      const policies = [createTestPolicy()];

      await snapshotManager.capture(intent, trustData, policies, {
        includePolicyDefinitions: true,
      });

      const result = await engine.replay(intent.id, { generateComparison: true });

      expect(result.success).toBe(true);
      expect(result.comparison).toBeDefined();
      expect(result.comparison?.intentId).toBe(intent.id);
    });
  });

  describe('captureSnapshot', () => {
    it('should capture snapshot via engine', async () => {
      const intent = createTestIntent();
      const trustData = createTestTrustData();
      const policies = [createTestPolicy()];

      const snapshot = await engine.captureSnapshot(intent, trustData, policies);

      expect(snapshot.intentId).toBe(intent.id);
    });
  });

  describe('getSnapshotManager', () => {
    it('should return snapshot manager instance', () => {
      const manager = engine.getSnapshotManager();
      expect(manager).toBeInstanceOf(SnapshotManager);
    });
  });

  describe('getComparator', () => {
    it('should return comparator instance', () => {
      const comparator = engine.getComparator();
      expect(comparator).toBeInstanceOf(ReplayComparator);
    });
  });

  describe('getSimulator', () => {
    it('should return simulator instance', () => {
      const simulator = engine.getSimulator();
      expect(simulator).toBeInstanceOf(SimulationEngine);
    });
  });
});

// =============================================================================
// FACTORY FUNCTION TESTS
// =============================================================================

describe('Factory Functions', () => {
  it('createReplayEngine should return ReplayEngine instance', () => {
    const engine = createReplayEngine();
    expect(engine).toBeInstanceOf(ReplayEngine);
  });

  it('createSnapshotManager should return SnapshotManager instance', () => {
    const manager = createSnapshotManager();
    expect(manager).toBeInstanceOf(SnapshotManager);
  });

  it('createReplayComparator should return ReplayComparator instance', () => {
    const comparator = createReplayComparator();
    expect(comparator).toBeInstanceOf(ReplayComparator);
  });

  it('createSimulationEngine should return SimulationEngine instance', () => {
    const simulator = createSimulationEngine();
    expect(simulator).toBeInstanceOf(SimulationEngine);
  });
});

// =============================================================================
// INTEGRATION TESTS
// =============================================================================

describe('Replay System Integration', () => {
  it('should support full replay workflow', async () => {
    const engine = createReplayEngine();
    const snapshotManager = engine.getSnapshotManager();
    await snapshotManager.clear();

    // 1. Create and capture intent
    const intent = createTestIntent();
    const trustData = createTestTrustData();
    const policies = [createTestPolicy()];

    const snapshot = await engine.captureSnapshot(intent, trustData, policies, {
      includePolicyDefinitions: true,
    });

    // 2. Replay the intent
    const replayResult = await engine.replay(intent.id, {
      dryRun: true,
      generateComparison: true,
      includeStepDetails: true,
    });

    expect(replayResult.success).toBe(true);
    expect(replayResult.comparison).toBeDefined();

    // 3. Simulate what-if scenario
    const simulator = engine.getSimulator();
    const whatIfResult = await simulator.whatIf(
      {
        entityId: intent.entityId,
        goal: intent.goal,
        intentType: intent.intentType ?? undefined,
      },
      {
        tenantId: intent.tenantId,
        trustScore: trustData.score,
        trustLevel: trustData.level,
        policies,
      },
      {
        trustLevelOverride: 5 as TrustLevel,
      }
    );

    expect(whatIfResult.baseline).toBeDefined();
    expect(whatIfResult.modified).toBeDefined();
    expect(whatIfResult.comparison).toBeDefined();
  });

  it('should support bulk simulation for policy impact analysis', async () => {
    const simulator = createSimulationEngine();

    // Create multiple test intents
    const intents: CreateIntent[] = Array.from({ length: 10 }, (_, i) => ({
      entityId: `entity-${i}`,
      goal: `Goal ${i}`,
      intentType: i % 2 === 0 ? 'type-a' : 'type-b',
    }));

    // Create policies with different rules
    const allowPolicy = createTestPolicy({
      id: 'allow-policy',
      name: 'Allow Policy',
      definition: {
        version: '1.0',
        target: { intentTypes: ['type-a'] },
        rules: [
          {
            id: 'allow-rule',
            name: 'Allow Type A',
            priority: 1,
            enabled: true,
            when: { type: 'trust', level: 0 as TrustLevel, operator: 'greater_than_or_equal' },
            then: { action: 'allow', reason: 'Type A allowed' },
          },
        ],
        defaultAction: 'allow',
      },
    });

    const denyPolicy = createTestPolicy({
      id: 'deny-policy',
      name: 'Deny Policy',
      definition: {
        version: '1.0',
        target: { intentTypes: ['type-b'] },
        rules: [
          {
            id: 'deny-rule',
            name: 'Deny Type B',
            priority: 1,
            enabled: true,
            when: { type: 'trust', level: 0 as TrustLevel, operator: 'greater_than_or_equal' },
            then: { action: 'deny', reason: 'Type B denied' },
          },
        ],
        defaultAction: 'deny',
      },
    });

    const context: SimulationContext = {
      tenantId: 'tenant-456',
      trustScore: 700,
      trustLevel: 3 as TrustLevel,
      policies: [allowPolicy, denyPolicy],
    };

    const result = await simulator.simulateBulk(intents, context);

    expect(result.summary.total).toBe(10);
    expect(result.summary.succeeded).toBe(10);
    expect(result.policyImpact.length).toBe(2);
  });
});
