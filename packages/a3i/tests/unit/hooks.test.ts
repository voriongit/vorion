/**
 * Hook System Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import {
  TrustBand,
  ActionType,
  DataSensitivity,
  Reversibility,
  ObservationTier,
  type Intent,
  type Decision,
  type TrustProfile,
} from '@orion/contracts';
import {
  HookManager,
  HookRegistry,
  HookExecutor,
  HookPhase,
  HookPriority,
  createHookManager,
  createHookRegistry,
  createHookExecutor,
  successResult,
  abortResult,
  errorResult,
  HookRegistryError,
  HookRegistryErrorCode,
  type PreAuthorizeContext,
  type PostAuthorizeContext,
  type TrustChangeContext,
} from '../../src/hooks/index.js';

// Test helpers
function createIntent(overrides: Partial<Intent> = {}): Intent {
  return {
    intentId: uuidv4(),
    agentId: uuidv4(),
    correlationId: uuidv4(),
    action: 'read-file',
    actionType: ActionType.READ,
    resourceScope: ['/data/test.txt'],
    dataSensitivity: DataSensitivity.INTERNAL,
    reversibility: Reversibility.REVERSIBLE,
    justification: 'Test intent',
    createdAt: new Date(),
    ...overrides,
  };
}

function createDecision(overrides: Partial<Decision> = {}): Decision {
  return {
    decisionId: uuidv4(),
    intentId: uuidv4(),
    agentId: uuidv4(),
    correlationId: uuidv4(),
    permitted: true,
    trustBand: TrustBand.T2_CONSTRAINED,
    trustScore: 55,
    reasoning: ['Test decision'],
    decidedAt: new Date(),
    expiresAt: new Date(Date.now() + 300000),
    latencyMs: 5,
    version: 1,
    ...overrides,
  };
}

function createProfile(overrides: Partial<TrustProfile> = {}): TrustProfile {
  return {
    profileId: uuidv4(),
    agentId: uuidv4(),
    rawScore: 55,
    adjustedScore: 55,
    band: TrustBand.T2_CONSTRAINED,
    observationTier: ObservationTier.GRAY_BOX,
    dimensionScores: {
      CT: 55,
      RL: 55,
      EC: 55,
      OT: 55,
      SB: 55,
      AC: 55,
      IQ: 55,
    },
    evidence: [],
    calculatedAt: new Date(),
    version: 1,
    ...overrides,
  };
}

describe('HookRegistry', () => {
  let registry: HookRegistry;

  beforeEach(() => {
    registry = createHookRegistry();
  });

  describe('register', () => {
    it('should register a hook', () => {
      const hook = registry.register({
        name: 'test-hook',
        phase: HookPhase.PRE_AUTHORIZE,
        handler: async () => successResult(0),
      });

      expect(hook.id).toBeDefined();
      expect(hook.name).toBe('test-hook');
      expect(hook.phase).toBe(HookPhase.PRE_AUTHORIZE);
      expect(hook.enabled).toBe(true);
    });

    it('should use custom ID if provided', () => {
      const hook = registry.register({
        id: 'custom-id',
        name: 'test-hook',
        phase: HookPhase.PRE_AUTHORIZE,
        handler: async () => successResult(0),
      });

      expect(hook.id).toBe('custom-id');
    });

    it('should reject duplicate IDs', () => {
      registry.register({
        id: 'duplicate',
        name: 'first',
        phase: HookPhase.PRE_AUTHORIZE,
        handler: async () => successResult(0),
      });

      expect(() =>
        registry.register({
          id: 'duplicate',
          name: 'second',
          phase: HookPhase.PRE_AUTHORIZE,
          handler: async () => successResult(0),
        })
      ).toThrow(HookRegistryError);
    });

    it('should use default priority NORMAL', () => {
      const hook = registry.register({
        name: 'test',
        phase: HookPhase.PRE_AUTHORIZE,
        handler: async () => successResult(0),
      });

      expect(hook.priority).toBe(HookPriority.NORMAL);
    });
  });

  describe('unregister', () => {
    it('should unregister a hook', () => {
      const hook = registry.register({
        name: 'test',
        phase: HookPhase.PRE_AUTHORIZE,
        handler: async () => successResult(0),
      });

      const result = registry.unregister(hook.id);
      expect(result).toBe(true);
      expect(registry.has(hook.id)).toBe(false);
    });

    it('should return false for non-existent hook', () => {
      const result = registry.unregister('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('getByPhase', () => {
    it('should return hooks sorted by priority', () => {
      registry.register({
        name: 'low',
        phase: HookPhase.PRE_AUTHORIZE,
        priority: HookPriority.LOW,
        handler: async () => successResult(0),
      });
      registry.register({
        name: 'high',
        phase: HookPhase.PRE_AUTHORIZE,
        priority: HookPriority.HIGH,
        handler: async () => successResult(0),
      });
      registry.register({
        name: 'normal',
        phase: HookPhase.PRE_AUTHORIZE,
        priority: HookPriority.NORMAL,
        handler: async () => successResult(0),
      });

      const hooks = registry.getByPhase(HookPhase.PRE_AUTHORIZE);
      expect(hooks).toHaveLength(3);
      expect(hooks[0].name).toBe('high');
      expect(hooks[1].name).toBe('normal');
      expect(hooks[2].name).toBe('low');
    });

    it('should only return hooks for specified phase', () => {
      registry.register({
        name: 'pre',
        phase: HookPhase.PRE_AUTHORIZE,
        handler: async () => successResult(0),
      });
      registry.register({
        name: 'post',
        phase: HookPhase.POST_AUTHORIZE,
        handler: async () => successResult(0),
      });

      const preHooks = registry.getByPhase(HookPhase.PRE_AUTHORIZE);
      expect(preHooks).toHaveLength(1);
      expect(preHooks[0].name).toBe('pre');
    });
  });

  describe('getEnabledByPhase', () => {
    it('should only return enabled hooks', () => {
      registry.register({
        name: 'enabled',
        phase: HookPhase.PRE_AUTHORIZE,
        enabled: true,
        handler: async () => successResult(0),
      });
      registry.register({
        name: 'disabled',
        phase: HookPhase.PRE_AUTHORIZE,
        enabled: false,
        handler: async () => successResult(0),
      });

      const hooks = registry.getEnabledByPhase(HookPhase.PRE_AUTHORIZE);
      expect(hooks).toHaveLength(1);
      expect(hooks[0].name).toBe('enabled');
    });
  });

  describe('enable/disable', () => {
    it('should enable a disabled hook', () => {
      const hook = registry.register({
        name: 'test',
        phase: HookPhase.PRE_AUTHORIZE,
        enabled: false,
        handler: async () => successResult(0),
      });

      registry.enable(hook.id);
      expect(registry.get(hook.id)?.enabled).toBe(true);
    });

    it('should disable an enabled hook', () => {
      const hook = registry.register({
        name: 'test',
        phase: HookPhase.PRE_AUTHORIZE,
        enabled: true,
        handler: async () => successResult(0),
      });

      registry.disable(hook.id);
      expect(registry.get(hook.id)?.enabled).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return accurate statistics', () => {
      registry.register({
        name: 'pre1',
        phase: HookPhase.PRE_AUTHORIZE,
        priority: HookPriority.HIGH,
        handler: async () => successResult(0),
      });
      registry.register({
        name: 'pre2',
        phase: HookPhase.PRE_AUTHORIZE,
        priority: HookPriority.LOW,
        enabled: false,
        handler: async () => successResult(0),
      });
      registry.register({
        name: 'post1',
        phase: HookPhase.POST_AUTHORIZE,
        handler: async () => successResult(0),
      });

      const stats = registry.getStats();
      expect(stats.totalHooks).toBe(3);
      expect(stats.enabledHooks).toBe(2);
      expect(stats.disabledHooks).toBe(1);
      expect(stats.byPhase[HookPhase.PRE_AUTHORIZE]).toBe(2);
      expect(stats.byPhase[HookPhase.POST_AUTHORIZE]).toBe(1);
    });
  });
});

describe('HookExecutor', () => {
  let registry: HookRegistry;
  let executor: HookExecutor;

  beforeEach(() => {
    registry = createHookRegistry();
    executor = createHookExecutor(registry);
  });

  describe('execute', () => {
    it('should execute hooks in priority order', async () => {
      const order: string[] = [];

      registry.register({
        name: 'low',
        phase: HookPhase.PRE_AUTHORIZE,
        priority: HookPriority.LOW,
        handler: async () => {
          order.push('low');
          return successResult(0);
        },
      });
      registry.register({
        name: 'high',
        phase: HookPhase.PRE_AUTHORIZE,
        priority: HookPriority.HIGH,
        handler: async () => {
          order.push('high');
          return successResult(0);
        },
      });

      await executor.execute(HookPhase.PRE_AUTHORIZE, {
        correlationId: uuidv4(),
        intent: createIntent(),
      });

      expect(order).toEqual(['high', 'low']);
    });

    it('should stop on abort when stopOnAbort is true', async () => {
      const executed: string[] = [];

      registry.register({
        name: 'first',
        phase: HookPhase.PRE_AUTHORIZE,
        priority: HookPriority.HIGH,
        handler: async () => {
          executed.push('first');
          return abortResult('Aborted', 0);
        },
      });
      registry.register({
        name: 'second',
        phase: HookPhase.PRE_AUTHORIZE,
        priority: HookPriority.LOW,
        handler: async () => {
          executed.push('second');
          return successResult(0);
        },
      });

      const summary = await executor.execute(
        HookPhase.PRE_AUTHORIZE,
        { correlationId: uuidv4(), intent: createIntent() },
        { stopOnAbort: true }
      );

      expect(executed).toEqual(['first']);
      expect(summary.aborted).toBe(true);
      expect(summary.abortReason).toBe('Aborted');
    });

    it('should handle hook errors', async () => {
      registry.register({
        name: 'failing',
        phase: HookPhase.PRE_AUTHORIZE,
        handler: async () => {
          throw new Error('Hook error');
        },
      });

      const summary = await executor.execute(HookPhase.PRE_AUTHORIZE, {
        correlationId: uuidv4(),
        intent: createIntent(),
      });

      expect(summary.failed).toBe(1);
      expect(summary.results[0].result.error?.message).toBe('Hook error');
    });

    it('should respect hook filters', async () => {
      const executed: string[] = [];

      registry.register({
        name: 'filtered',
        phase: HookPhase.PRE_AUTHORIZE,
        handler: async () => {
          executed.push('filtered');
          return successResult(0);
        },
        filter: (ctx) => (ctx as PreAuthorizeContext).intent.actionType === ActionType.WRITE,
      });
      registry.register({
        name: 'unfiltered',
        phase: HookPhase.PRE_AUTHORIZE,
        handler: async () => {
          executed.push('unfiltered');
          return successResult(0);
        },
      });

      await executor.execute(HookPhase.PRE_AUTHORIZE, {
        correlationId: uuidv4(),
        intent: createIntent({ actionType: ActionType.READ }),
      });

      expect(executed).toEqual(['unfiltered']);
    });

    it('should handle timeouts', async () => {
      registry.register({
        name: 'slow',
        phase: HookPhase.PRE_AUTHORIZE,
        timeoutMs: 10, // Very short timeout
        handler: async () => {
          // Sleep much longer than timeout
          await new Promise((resolve) => setTimeout(resolve, 500));
          return successResult(0);
        },
      });

      const summary = await executor.execute(
        HookPhase.PRE_AUTHORIZE,
        {
          correlationId: uuidv4(),
          intent: createIntent(),
        },
        { timeoutMs: 10 } // Also set global timeout
      );

      expect(summary.failed).toBe(1);
      expect(summary.results[0].result.error?.message).toContain('timed out');
    }, 10000); // Increase test timeout

    it('should execute hooks in parallel when parallel option is true', async () => {
      const startTimes: number[] = [];

      registry.register({
        name: 'hook1',
        phase: HookPhase.PRE_AUTHORIZE,
        handler: async () => {
          startTimes.push(Date.now());
          await new Promise((resolve) => setTimeout(resolve, 50));
          return successResult(50);
        },
      });
      registry.register({
        name: 'hook2',
        phase: HookPhase.PRE_AUTHORIZE,
        handler: async () => {
          startTimes.push(Date.now());
          await new Promise((resolve) => setTimeout(resolve, 50));
          return successResult(50);
        },
      });

      await executor.execute(
        HookPhase.PRE_AUTHORIZE,
        { correlationId: uuidv4(), intent: createIntent() },
        { parallel: true }
      );

      // In parallel, both should start at roughly the same time
      const timeDiff = Math.abs(startTimes[0] - startTimes[1]);
      expect(timeDiff).toBeLessThan(20);
    });
  });
});

describe('HookManager', () => {
  let manager: HookManager;

  beforeEach(() => {
    manager = createHookManager();
  });

  describe('registration methods', () => {
    it('should register pre-authorize hook', () => {
      const hook = manager.onPreAuthorize('test', async () => successResult(0));
      expect(hook.phase).toBe(HookPhase.PRE_AUTHORIZE);
    });

    it('should register post-authorize hook', () => {
      const hook = manager.onPostAuthorize('test', async () => successResult(0));
      expect(hook.phase).toBe(HookPhase.POST_AUTHORIZE);
    });

    it('should register trust-change hook', () => {
      const hook = manager.onTrustChange('test', async () => successResult(0));
      expect(hook.phase).toBe(HookPhase.TRUST_CHANGE);
    });
  });

  describe('execution methods', () => {
    it('should execute pre-authorize hooks', async () => {
      const handler = vi.fn().mockResolvedValue(successResult(0));
      manager.onPreAuthorize('test', handler);

      const summary = await manager.executePreAuthorize({
        correlationId: uuidv4(),
        intent: createIntent(),
      });

      expect(handler).toHaveBeenCalled();
      expect(summary.succeeded).toBe(1);
    });

    it('should execute post-authorize hooks', async () => {
      const handler = vi.fn().mockResolvedValue(successResult(0));
      manager.onPostAuthorize('test', handler);

      const summary = await manager.executePostAuthorize({
        correlationId: uuidv4(),
        intent: createIntent(),
        decision: createDecision(),
        profile: createProfile(),
      });

      expect(handler).toHaveBeenCalled();
      expect(summary.succeeded).toBe(1);
    });

    it('should execute trust-change hooks', async () => {
      const handler = vi.fn().mockResolvedValue(successResult(0));
      manager.onTrustChange('test', handler);

      const prevProfile = createProfile({ adjustedScore: 50, band: TrustBand.T2_CONSTRAINED });
      const newProfile = createProfile({ adjustedScore: 70, band: TrustBand.T3_TRUSTED });

      const summary = await manager.executeTrustChange({
        correlationId: uuidv4(),
        agentId: uuidv4(),
        previousProfile: prevProfile,
        newProfile: newProfile,
        reason: 'Positive evidence',
      });

      expect(handler).toHaveBeenCalled();
      expect(summary.succeeded).toBe(1);
    });
  });

  describe('management methods', () => {
    it('should unregister hooks', () => {
      const hook = manager.onPreAuthorize('test', async () => successResult(0));
      expect(manager.unregister(hook.id)).toBe(true);
      expect(manager.getHook(hook.id)).toBeUndefined();
    });

    it('should enable/disable hooks', () => {
      const hook = manager.onPreAuthorize('test', async () => successResult(0));

      manager.disable(hook.id);
      expect(manager.getHook(hook.id)?.enabled).toBe(false);

      manager.enable(hook.id);
      expect(manager.getHook(hook.id)?.enabled).toBe(true);
    });

    it('should get hooks for phase', () => {
      manager.onPreAuthorize('pre1', async () => successResult(0));
      manager.onPreAuthorize('pre2', async () => successResult(0));
      manager.onPostAuthorize('post1', async () => successResult(0));

      const preHooks = manager.getHooksForPhase(HookPhase.PRE_AUTHORIZE);
      expect(preHooks).toHaveLength(2);
    });

    it('should clear all hooks', () => {
      manager.onPreAuthorize('pre', async () => successResult(0));
      manager.onPostAuthorize('post', async () => successResult(0));

      manager.clear();

      expect(manager.getStats().totalHooks).toBe(0);
    });
  });
});

describe('Result helpers', () => {
  it('successResult should create success result', () => {
    const result = successResult(10, { data: 'test' });
    expect(result.success).toBe(true);
    expect(result.durationMs).toBe(10);
    expect(result.modified).toEqual({ data: 'test' });
  });

  it('abortResult should create abort result', () => {
    const result = abortResult('Rate limited', 5);
    expect(result.success).toBe(true);
    expect(result.abort).toBe(true);
    expect(result.abortReason).toBe('Rate limited');
    expect(result.durationMs).toBe(5);
  });

  it('errorResult should create error result', () => {
    const error = new Error('Test error');
    const result = errorResult(error, 3);
    expect(result.success).toBe(false);
    expect(result.error).toBe(error);
    expect(result.durationMs).toBe(3);
  });
});
