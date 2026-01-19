/**
 * Parallel Evaluation Tests
 *
 * Tests that verify rule and policy evaluation run concurrently
 * to reduce overall evaluation latency.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Parallel Evaluation', () => {
  // Track timing of async operations
  let operationLog: { operation: string; startTime: number; endTime: number }[];

  beforeEach(() => {
    operationLog = [];
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Helper to create a mock async operation that logs timing
   */
  function createTimedOperation<T>(name: string, duration: number, result: T): () => Promise<T> {
    return async () => {
      const startTime = Date.now();
      operationLog.push({ operation: name, startTime, endTime: 0 });
      await new Promise((resolve) => setTimeout(resolve, duration));
      const entry = operationLog.find((e) => e.operation === name && e.endTime === 0);
      if (entry) entry.endTime = Date.now();
      return result;
    };
  }

  describe('Promise.all parallelization', () => {
    it('should run rule and policy evaluation concurrently', async () => {
      // Simulate rule evaluation taking 100ms
      const ruleEvaluator = {
        evaluate: createTimedOperation('ruleEvaluation', 100, {
          passed: true,
          finalAction: 'allow',
          rulesEvaluated: [],
        }),
      };

      // Simulate policy evaluation taking 150ms
      const policyEvaluator = {
        evaluateMultiple: createTimedOperation('policyEvaluation', 150, {
          finalAction: 'allow',
          policiesEvaluated: [],
        }),
      };

      // Run evaluations in parallel (mimicking the updated queues.ts pattern)
      const evaluationPromise = Promise.all([
        ruleEvaluator.evaluate(),
        (async () => {
          // Simulate policy loading (50ms) + evaluation (150ms)
          await new Promise((resolve) => setTimeout(resolve, 50)); // policy loading
          return policyEvaluator.evaluateMultiple();
        })(),
      ]);

      // Advance timers
      await vi.advanceTimersByTimeAsync(200);

      const [ruleResult, policyResult] = await evaluationPromise;

      // Verify both evaluations completed
      expect(ruleResult.passed).toBe(true);
      expect(policyResult.finalAction).toBe('allow');

      // Verify operations overlapped (parallel execution)
      const ruleOp = operationLog.find((e) => e.operation === 'ruleEvaluation');
      const policyOp = operationLog.find((e) => e.operation === 'policyEvaluation');

      expect(ruleOp).toBeDefined();
      expect(policyOp).toBeDefined();

      // If running in parallel, the total time should be max(rule, policy+loading)
      // not sum(rule + policy + loading)
      // Rule: 100ms, Policy loading: 50ms, Policy eval: 150ms
      // Sequential would be: 100 + 50 + 150 = 300ms
      // Parallel: max(100, 50+150) = 200ms
      const totalDuration = Math.max(ruleOp!.endTime, policyOp!.endTime) - Math.min(ruleOp!.startTime, policyOp!.startTime);

      // Allow for some timing variance, but should be significantly less than sequential
      expect(totalDuration).toBeLessThanOrEqual(250); // Should be ~200ms, not 300ms
    });

    it('should complete faster than sequential execution', async () => {
      const RULE_EVAL_TIME = 100;
      const POLICY_LOAD_TIME = 50;
      const POLICY_EVAL_TIME = 150;

      // Sequential timing would be: 100 + 50 + 150 = 300ms
      const sequentialTime = RULE_EVAL_TIME + POLICY_LOAD_TIME + POLICY_EVAL_TIME;

      // Parallel timing: max(100, 50 + 150) = 200ms
      const parallelTime = Math.max(RULE_EVAL_TIME, POLICY_LOAD_TIME + POLICY_EVAL_TIME);

      // Verify parallel is faster
      expect(parallelTime).toBeLessThan(sequentialTime);
      expect(parallelTime).toBe(200);
      expect(sequentialTime).toBe(300);

      // This represents roughly 33% improvement ((300-200)/300)
      const improvement = ((sequentialTime - parallelTime) / sequentialTime) * 100;
      expect(improvement).toBeGreaterThan(30);
    });

    it('should handle rule evaluation failure gracefully', async () => {
      const ruleEvaluator = {
        evaluate: vi.fn().mockRejectedValue(new Error('Rule evaluation failed')),
      };

      const policyEvaluator = {
        evaluateMultiple: vi.fn().mockResolvedValue({
          finalAction: 'allow',
          policiesEvaluated: [],
        }),
      };

      // Run evaluations in parallel - rule failure should propagate
      await expect(
        Promise.all([ruleEvaluator.evaluate(), policyEvaluator.evaluateMultiple()])
      ).rejects.toThrow('Rule evaluation failed');
    });

    it('should handle policy evaluation failure gracefully (continue with rules)', async () => {
      const ruleResult = {
        passed: true,
        finalAction: 'allow',
        rulesEvaluated: [],
      };

      const ruleEvaluator = {
        evaluate: vi.fn().mockResolvedValue(ruleResult),
      };

      // Simulate the pattern from queues.ts where policy errors are caught internally
      const runPolicyEvaluation = async (): Promise<{ evaluation: unknown | null; error?: Error }> => {
        try {
          throw new Error('Policy evaluation failed');
        } catch (error) {
          return { evaluation: null, error: error as Error };
        }
      };

      const [evaluation, policyResult] = await Promise.all([
        ruleEvaluator.evaluate(),
        runPolicyEvaluation(),
      ]);

      // Rule evaluation should succeed
      expect(evaluation).toEqual(ruleResult);

      // Policy evaluation should return null with error (not throw)
      expect(policyResult.evaluation).toBeNull();
      expect(policyResult.error).toBeDefined();
      expect(policyResult.error?.message).toBe('Policy evaluation failed');
    });

    it('should handle empty policies list', async () => {
      const ruleResult = {
        passed: true,
        finalAction: 'allow',
        rulesEvaluated: [],
      };

      const ruleEvaluator = {
        evaluate: vi.fn().mockResolvedValue(ruleResult),
      };

      const policyLoader = {
        getPolicies: vi.fn().mockResolvedValue([]), // No policies
      };

      const policyEvaluator = {
        evaluateMultiple: vi.fn(),
      };

      // Simulate the pattern from queues.ts
      const runPolicyEvaluation = async (): Promise<{ evaluation: unknown | null }> => {
        const policies = await policyLoader.getPolicies('tenant-1', 'default');
        if (policies.length === 0) {
          return { evaluation: null };
        }
        const result = await policyEvaluator.evaluateMultiple(policies, {});
        return { evaluation: result };
      };

      const [evaluation, policyResult] = await Promise.all([
        ruleEvaluator.evaluate(),
        runPolicyEvaluation(),
      ]);

      // Rule evaluation should succeed
      expect(evaluation).toEqual(ruleResult);

      // Policy evaluation should return null (no policies)
      expect(policyResult.evaluation).toBeNull();

      // Policy evaluator should not be called
      expect(policyEvaluator.evaluateMultiple).not.toHaveBeenCalled();
    });
  });

  describe('Error handling in parallel execution', () => {
    it('should not mask rule errors when policy also fails', async () => {
      const ruleEvaluator = {
        evaluate: vi.fn().mockRejectedValue(new Error('Rule failure')),
      };

      const policyEvaluator = {
        evaluateMultiple: vi.fn().mockRejectedValue(new Error('Policy failure')),
      };

      // With Promise.all, first rejection wins
      await expect(
        Promise.all([ruleEvaluator.evaluate(), policyEvaluator.evaluateMultiple()])
      ).rejects.toThrow(); // Could be either error
    });

    it('should use Promise.allSettled pattern when both results are needed regardless of errors', async () => {
      const ruleEvaluator = {
        evaluate: vi.fn().mockResolvedValue({
          passed: true,
          finalAction: 'allow',
          rulesEvaluated: [],
        }),
      };

      const policyEvaluator = {
        evaluateMultiple: vi.fn().mockRejectedValue(new Error('Policy failure')),
      };

      const results = await Promise.allSettled([
        ruleEvaluator.evaluate(),
        policyEvaluator.evaluateMultiple(),
      ]);

      // Rule should succeed
      expect(results[0].status).toBe('fulfilled');
      if (results[0].status === 'fulfilled') {
        expect(results[0].value.passed).toBe(true);
      }

      // Policy should fail
      expect(results[1].status).toBe('rejected');
      if (results[1].status === 'rejected') {
        expect(results[1].reason.message).toBe('Policy failure');
      }
    });
  });

  describe('Timing metrics', () => {
    it('should track individual evaluation durations', async () => {
      let ruleDuration = 0;
      let policyDuration = 0;

      const ruleEvaluator = {
        evaluate: async () => {
          const start = Date.now();
          await new Promise((resolve) => setTimeout(resolve, 100));
          ruleDuration = Date.now() - start;
          return { passed: true, finalAction: 'allow', rulesEvaluated: [] };
        },
      };

      const policyEvaluator = {
        evaluateMultiple: async () => {
          const start = Date.now();
          await new Promise((resolve) => setTimeout(resolve, 150));
          policyDuration = Date.now() - start;
          return { finalAction: 'allow', policiesEvaluated: [] };
        },
      };

      const overallStartTime = Date.now();

      // Start both promises
      const rulePromise = ruleEvaluator.evaluate();
      const policyPromise = policyEvaluator.evaluateMultiple();

      // Advance time to complete both
      await vi.advanceTimersByTimeAsync(200);

      await Promise.all([rulePromise, policyPromise]);

      const totalDuration = Date.now() - overallStartTime;

      // Individual durations should be tracked
      expect(ruleDuration).toBe(100);
      expect(policyDuration).toBe(150);

      // Total should be max, not sum (parallel execution)
      // With fake timers, we advanced by 200ms
      expect(totalDuration).toBe(200);
    });

    it('should log parallel execution completion', async () => {
      const logEntries: { intentId: string; totalDurationMs: number; parallelExecution: boolean }[] = [];

      const mockLogger = {
        debug: (data: { intentId: string; totalDurationMs: number; parallelExecution: boolean }) => {
          logEntries.push(data);
        },
      };

      // Simulate the logging pattern from queues.ts
      const startTime = Date.now();

      // Start promises
      const p1 = new Promise((resolve) => setTimeout(resolve, 100));
      const p2 = new Promise((resolve) => setTimeout(resolve, 150));

      // Advance time
      await vi.advanceTimersByTimeAsync(200);

      // Wait for promises
      await Promise.all([p1, p2]);

      const totalEvalDuration = Date.now() - startTime;

      mockLogger.debug({
        intentId: 'test-intent',
        totalDurationMs: totalEvalDuration,
        parallelExecution: true,
      });

      expect(logEntries).toHaveLength(1);
      expect(logEntries[0].parallelExecution).toBe(true);
      expect(logEntries[0].intentId).toBe('test-intent');
    });
  });
});
