import { describe, it, expect, beforeEach } from 'vitest';
import {
  TrustEngine,
  createTrustEngine,
  TrustCallbackHandler,
  createTrustCallback,
  TrustAwareExecutor,
  createTrustAwareExecutor,
  createTrustTools,
  createTrustQueryTool,
  TrustInsufficientError,
  TRUST_LEVEL_NAMES,
} from '../src/index.js';

describe('LangChain Integration', () => {
  let engine: TrustEngine;

  beforeEach(() => {
    engine = createTrustEngine();
  });

  describe('TrustCallbackHandler', () => {
    let callback: TrustCallbackHandler;

    beforeEach(async () => {
      callback = createTrustCallback(engine, {
        agentId: 'test-agent',
        initialTrustLevel: 2,
      });
      await callback.initialize();
    });

    it('should initialize agent in trust engine', async () => {
      const record = await engine.getScore('test-agent');
      expect(record).toBeDefined();
      expect(record!.level).toBe(2);
    });

    it('should have correct agentId', () => {
      expect(callback.agentId).toBe('test-agent');
    });

    it('should track signals recorded', async () => {
      expect(callback.signalsRecorded).toBe(0);

      // Simulate tool completion
      await callback.handleToolStart({ name: 'test-tool' }, 'input', 'run-1');
      await callback.handleToolEnd('output', 'run-1');

      expect(callback.signalsRecorded).toBe(1);
    });

    it('should record tool success signals', async () => {
      await callback.handleToolStart({ name: 'calculator' }, '2+2', 'run-1');
      await callback.handleToolEnd('4', 'run-1');

      const record = await engine.getScore('test-agent');
      expect(record!.signals).toHaveLength(1);
      expect(record!.signals[0]!.type).toContain('tool_success');
    });

    it('should record tool error signals', async () => {
      await callback.handleToolStart({ name: 'calculator' }, 'invalid', 'run-1');
      await callback.handleToolError(new Error('Invalid input'), 'run-1');

      const record = await engine.getScore('test-agent');
      expect(record!.signals).toHaveLength(1);
      expect(record!.signals[0]!.type).toContain('tool_failure');
      expect(record!.signals[0]!.value).toBeLessThan(0.3);
    });

    it('should record LLM success signals', async () => {
      await callback.handleLLMStart({ name: 'gpt-4' }, ['prompt'], 'run-1');
      await callback.handleLLMEnd(
        {
          generations: [[]],
          llmOutput: { tokenUsage: { totalTokens: 100 } },
        },
        'run-1'
      );

      const record = await engine.getScore('test-agent');
      expect(record!.signals).toHaveLength(1);
      expect(record!.signals[0]!.type).toContain('llm_success');
    });

    it('should record chain completion signals', async () => {
      await callback.handleChainStart({ name: 'agent' }, {}, 'run-1');
      await callback.handleChainEnd({ output: 'result' }, 'run-1');

      const record = await engine.getScore('test-agent');
      expect(record!.signals).toHaveLength(1);
      expect(record!.signals[0]!.type).toContain('chain_success');
    });

    it('should respect recordToolUsage config', async () => {
      const noToolCallback = createTrustCallback(engine, {
        agentId: 'no-tool-agent',
        recordToolUsage: false,
      });
      await noToolCallback.initialize();

      await noToolCallback.handleToolStart({ name: 'test' }, 'input', 'run-1');
      await noToolCallback.handleToolEnd('output', 'run-1');

      expect(noToolCallback.signalsRecorded).toBe(0);
    });

    it('should respect recordErrors config', async () => {
      const noErrorCallback = createTrustCallback(engine, {
        agentId: 'no-error-agent',
        recordErrors: false,
      });
      await noErrorCallback.initialize();

      await noErrorCallback.handleToolStart({ name: 'test' }, 'input', 'run-1');
      await noErrorCallback.handleToolError(new Error('Fail'), 'run-1');

      expect(noErrorCallback.signalsRecorded).toBe(0);
    });

    it('should use custom signal weights', async () => {
      const customCallback = createTrustCallback(engine, {
        agentId: 'custom-agent',
        signalWeights: {
          toolSuccess: 0.95,
        },
      });
      await customCallback.initialize();

      await customCallback.handleToolStart({ name: 'test' }, 'input', 'run-1');
      await customCallback.handleToolEnd('output', 'run-1');

      const record = await engine.getScore('custom-agent');
      expect(record!.signals[0]!.value).toBe(0.95);
    });
  });

  describe('TrustAwareExecutor', () => {
    let executor: TrustAwareExecutor;

    beforeEach(async () => {
      executor = createTrustAwareExecutor(engine, {
        agentId: 'executor-agent',
        initialTrustLevel: 2,
        minTrustLevel: 2,
      });
      await executor.initialize();
    });

    it('should have correct agentId', () => {
      expect(executor.agentId).toBe('executor-agent');
    });

    it('should provide callback handler', () => {
      expect(executor.callbackHandler).toBeInstanceOf(TrustCallbackHandler);
    });

    it('should check trust level', async () => {
      const check = await executor.checkTrust();

      expect(check.agentId).toBe('executor-agent');
      expect(check.currentLevel).toBe(2);
      expect(check.requiredLevel).toBe(2);
      expect(check.allowed).toBe(true);
    });

    it('should allow execution when trust is sufficient', async () => {
      const result = await executor.execute(async () => 'success');

      expect(result.result).toBe('success');
      expect(result.trustCheck.allowed).toBe(true);
    });

    it('should block execution when trust is insufficient', async () => {
      // Require L5 trust
      await expect(executor.execute(async () => 'success', 5)).rejects.toThrow(
        TrustInsufficientError
      );
    });

    it('should record execution failures', async () => {
      try {
        await executor.execute(async () => {
          throw new Error('Task failed');
        });
      } catch {
        // Expected
      }

      const record = await engine.getScore('executor-agent');
      const failureSignal = record!.signals.find((s) =>
        s.type.includes('execution_failure')
      );
      expect(failureSignal).toBeDefined();
    });

    it('should get trust record', async () => {
      const record = await executor.getTrustRecord();

      expect(record).toBeDefined();
      expect(record!.entityId).toBe('executor-agent');
    });

    it('should allow manual success recording', async () => {
      await executor.recordSuccess('manual_task', 0.9);

      const record = await engine.getScore('executor-agent');
      const signal = record!.signals.find((s) => s.type.includes('manual_task'));
      expect(signal).toBeDefined();
      expect(signal!.value).toBe(0.9);
    });

    it('should allow manual failure recording', async () => {
      await executor.recordFailure('manual_error', 0.1);

      const record = await engine.getScore('executor-agent');
      const signal = record!.signals.find((s) => s.type.includes('manual_error'));
      expect(signal).toBeDefined();
      expect(signal!.value).toBe(0.1);
    });

    it('should return execution result with trust context', async () => {
      const result = await executor.execute(async () => ({ data: 'test' }));

      expect(result.result).toEqual({ data: 'test' });
      expect(result.trustCheck).toBeDefined();
      expect(result.finalScore).toBeGreaterThan(0);
      expect(result.finalLevel).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Trust Tools', () => {
    beforeEach(async () => {
      await engine.initializeEntity('tool-agent', 3);
    });

    it('should create trust tools array', () => {
      const tools = createTrustTools(engine, 'tool-agent');

      expect(tools).toHaveLength(5);
      expect(tools.map((t) => t.name)).toContain('check_my_trust');
      expect(tools.map((t) => t.name)).toContain('check_trust_requirements');
      expect(tools.map((t) => t.name)).toContain('get_trust_levels');
      expect(tools.map((t) => t.name)).toContain('report_task_success');
      expect(tools.map((t) => t.name)).toContain('report_task_failure');
    });

    it('should check_my_trust return current trust info', async () => {
      const tools = createTrustTools(engine, 'tool-agent');
      const checkTrust = tools.find((t) => t.name === 'check_my_trust')!;

      const result = JSON.parse(await checkTrust.func(''));

      expect(result.agentId).toBe('tool-agent');
      expect(result.level).toBe(3);
      expect(result.levelName).toBe('Trusted'); // BASIS spec: L3 = Trusted
    });

    it('should check_trust_requirements evaluate action requirements', async () => {
      const tools = createTrustTools(engine, 'tool-agent');
      const checkReq = tools.find((t) => t.name === 'check_trust_requirements')!;

      // L3 agent should be able to send email (requires L3)
      const emailResult = JSON.parse(await checkReq.func('send_email'));
      expect(emailResult.allowed).toBe(true);

      // L3 agent should not be able to modify system (requires L5)
      const systemResult = JSON.parse(await checkReq.func('modify_system'));
      expect(systemResult.allowed).toBe(false);
    });

    it('should get_trust_levels return all levels', async () => {
      const tools = createTrustTools(engine, 'tool-agent');
      const getLevels = tools.find((t) => t.name === 'get_trust_levels')!;

      const result = JSON.parse(await getLevels.func(''));

      expect(result.levels).toHaveLength(6);
      expect(result.levels[0].name).toBe('Sandbox'); // BASIS spec: L0 = Sandbox
      expect(result.levels[5].name).toBe('Autonomous'); // BASIS spec: L5 = Autonomous
    });

    it('should report_task_success record positive signal', async () => {
      const tools = createTrustTools(engine, 'tool-agent');
      const reportSuccess = tools.find((t) => t.name === 'report_task_success')!;

      await reportSuccess.func('Completed data analysis');

      const record = await engine.getScore('tool-agent');
      expect(record!.signals.some((s) => s.type.includes('task_completed'))).toBe(
        true
      );
    });

    it('should report_task_failure record negative signal', async () => {
      const tools = createTrustTools(engine, 'tool-agent');
      const reportFailure = tools.find((t) => t.name === 'report_task_failure')!;

      await reportFailure.func('Failed to parse input');

      const record = await engine.getScore('tool-agent');
      expect(record!.signals.some((s) => s.type.includes('task_failed'))).toBe(
        true
      );
    });

    it('should create query tool for any entity', async () => {
      await engine.initializeEntity('other-agent', 4);

      const queryTool = createTrustQueryTool(engine);

      const result = JSON.parse(await queryTool.func('other-agent'));

      expect(result.entityId).toBe('other-agent');
      expect(result.level).toBe(4);
      expect(result.levelName).toBe('Certified'); // BASIS spec: L4 = Certified
    });

    it('should handle non-existent entity in query tool', async () => {
      const queryTool = createTrustQueryTool(engine);

      const result = JSON.parse(await queryTool.func('non-existent'));

      expect(result.error).toBe('Entity not found');
    });
  });

  describe('Integration scenario', () => {
    it('should handle full agent lifecycle', async () => {
      // 1. Create executor for a new agent
      const executor = createTrustAwareExecutor(engine, {
        agentId: 'lifecycle-agent',
        initialTrustLevel: 2,
        minTrustLevel: 2,
      });
      await executor.initialize();

      // 2. Agent performs successful operations
      for (let i = 0; i < 3; i++) {
        await executor.callbackHandler.handleToolStart(
          { name: 'search' },
          'query',
          `run-${i}`
        );
        await executor.callbackHandler.handleToolEnd('results', `run-${i}`);
      }

      // 3. Check trust has improved
      const midRecord = await executor.getTrustRecord();
      expect(midRecord!.signals.length).toBe(3);

      // 4. Agent encounters failures
      await executor.callbackHandler.handleToolStart(
        { name: 'api' },
        'request',
        'fail-1'
      );
      await executor.callbackHandler.handleToolError(
        new Error('API error'),
        'fail-1'
      );

      // 5. Check failure was recorded
      const finalRecord = await executor.getTrustRecord();
      expect(finalRecord!.signals.length).toBe(4);

      const failureSignal = finalRecord!.signals.find((s) =>
        s.type.includes('failure')
      );
      expect(failureSignal).toBeDefined();
    });
  });
});
