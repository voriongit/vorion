/**
 * Tests for Execution Engine
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import {
  TrustBand,
  ObservationTier,
  ActionType,
  DataSensitivity,
  Reversibility,
  type Intent,
  type Decision,
  type TrustProfile,
  type Constraints,
} from '@orion/contracts';
import {
  ExecutionEngine,
  createExecutionEngine,
  type ActionExecutor,
} from '../../src/execution/index.js';
import { createHookManager, abortResult } from '../../src/hooks/index.js';

// Helper to create test intent
function createIntent(overrides: Partial<Intent> = {}): Intent {
  return {
    intentId: uuidv4(),
    agentId: 'test-agent',
    correlationId: uuidv4(),
    action: 'Test action',
    actionType: ActionType.READ,
    resourceScope: ['resource-1'],
    dataSensitivity: DataSensitivity.PUBLIC,
    reversibility: Reversibility.REVERSIBLE,
    context: {},
    createdAt: new Date(),
    ...overrides,
  };
}

// Helper to create test profile
function createProfile(overrides: Partial<TrustProfile> = {}): TrustProfile {
  return {
    profileId: uuidv4(),
    agentId: 'test-agent',
    dimensions: { CT: 70, BT: 70, GT: 70, XT: 70, AC: 70 },
    weights: { CT: 0.25, BT: 0.25, GT: 0.20, XT: 0.15, AC: 0.15 },
    compositeScore: 70,
    observationTier: ObservationTier.WHITE_BOX,
    adjustedScore: 70,
    band: TrustBand.T3_TRUSTED,
    calculatedAt: new Date(),
    evidence: [],
    version: 1,
    ...overrides,
  };
}

// Helper to create test constraints
function createConstraints(overrides: Partial<Constraints> = {}): Constraints {
  return {
    allowedTools: ['read_public'],
    dataScopes: ['public'],
    maxExecutionTimeMs: 5000,
    rateLimits: [],
    requiredApprovals: [],
    reversibilityRequired: false,
    ...overrides,
  };
}

// Helper to create test decision
function createDecision(permitted: boolean, overrides: Partial<Decision> = {}): Decision {
  const intent = createIntent();
  return {
    decisionId: uuidv4(),
    intentId: intent.intentId,
    agentId: intent.agentId,
    correlationId: intent.correlationId,
    permitted,
    trustBand: TrustBand.T3_TRUSTED,
    trustScore: 70,
    constraints: permitted ? createConstraints() : undefined,
    reasoning: ['Test decision'],
    decidedAt: new Date(),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes from now
    policySetId: 'default',
    latencyMs: 10,
    ...overrides,
  };
}

describe('ExecutionEngine', () => {
  let engine: ExecutionEngine;

  beforeEach(() => {
    engine = new ExecutionEngine();
  });

  describe('execute', () => {
    it('should execute action successfully', async () => {
      const intent = createIntent();
      const profile = createProfile();
      const decision = createDecision(true, { intentId: intent.intentId });
      const executor: ActionExecutor = vi.fn().mockResolvedValue({ data: 'result' });

      const result = await engine.execute({
        intent,
        decision,
        profile,
        executor,
      });

      expect(result.success).toBe(true);
      expect(result.result).toEqual({ data: 'result' });
      expect(result.aborted).toBe(false);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.executionId).toBeDefined();
      expect(executor).toHaveBeenCalledWith(intent, decision, undefined);
    });

    it('should reject non-permitted decisions', async () => {
      const intent = createIntent();
      const profile = createProfile();
      const decision = createDecision(false);

      const result = await engine.execute({
        intent,
        decision,
        profile,
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('does not permit');
      expect(result.aborted).toBe(false);
    });

    it('should reject expired decisions', async () => {
      const intent = createIntent();
      const profile = createProfile();
      const decision = createDecision(true, {
        expiresAt: new Date(Date.now() - 1000), // Expired
      });

      const result = await engine.execute({
        intent,
        decision,
        profile,
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('expired');
    });

    it('should allow expired decisions when configured', async () => {
      const engine = new ExecutionEngine({ allowExpiredDecisions: true });
      const intent = createIntent();
      const profile = createProfile();
      const decision = createDecision(true, {
        expiresAt: new Date(Date.now() - 1000), // Expired
      });
      const executor: ActionExecutor = vi.fn().mockResolvedValue({ ok: true });

      const result = await engine.execute({
        intent,
        decision,
        profile,
        executor,
      });

      expect(result.success).toBe(true);
    });

    it('should handle executor errors', async () => {
      const intent = createIntent();
      const profile = createProfile();
      const decision = createDecision(true);
      const executor: ActionExecutor = vi.fn().mockRejectedValue(new Error('Execution failed'));

      const result = await engine.execute({
        intent,
        decision,
        profile,
        executor,
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Execution failed');
      expect(result.aborted).toBe(false);
    });

    it('should mark network errors as retryable', async () => {
      const intent = createIntent();
      const profile = createProfile();
      const decision = createDecision(true);
      const executor: ActionExecutor = vi.fn().mockRejectedValue(new Error('Network timeout'));

      const result = await engine.execute({
        intent,
        decision,
        profile,
        executor,
      });

      expect(result.success).toBe(false);
      expect(result.retryable).toBe(true);
    });

    it('should mark business logic errors as non-retryable', async () => {
      const intent = createIntent();
      const profile = createProfile();
      const decision = createDecision(true);
      const executor: ActionExecutor = vi.fn().mockRejectedValue(new Error('Invalid input'));

      const result = await engine.execute({
        intent,
        decision,
        profile,
        executor,
      });

      expect(result.success).toBe(false);
      expect(result.retryable).toBe(false);
    });

    it('should timeout long-running executions', async () => {
      const intent = createIntent();
      const profile = createProfile();
      const decision = createDecision(true, {
        constraints: createConstraints({ maxExecutionTimeMs: 50 }),
      });
      const executor: ActionExecutor = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 200))
      );

      const result = await engine.execute({
        intent,
        decision,
        profile,
        executor,
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('timeout');
    });

    it('should pass params to executor', async () => {
      const intent = createIntent();
      const profile = createProfile();
      const decision = createDecision(true);
      const params = { key: 'value' };
      const executor: ActionExecutor = vi.fn().mockResolvedValue({ ok: true });

      await engine.execute({
        intent,
        decision,
        profile,
        params,
        executor,
      });

      expect(executor).toHaveBeenCalledWith(intent, decision, params);
    });
  });

  describe('registerExecutor', () => {
    it('should use registered executor for action type', async () => {
      const executor: ActionExecutor = vi.fn().mockResolvedValue({ registered: true });
      engine.registerExecutor(ActionType.READ, executor);

      const intent = createIntent({ actionType: ActionType.READ });
      const profile = createProfile();
      const decision = createDecision(true);

      const result = await engine.execute({
        intent,
        decision,
        profile,
      });

      expect(result.success).toBe(true);
      expect(result.result).toEqual({ registered: true });
      expect(executor).toHaveBeenCalled();
    });

    it('should use default executor when action type not registered', async () => {
      const intent = createIntent({ actionType: ActionType.WRITE });
      const profile = createProfile();
      const decision = createDecision(true);

      const result = await engine.execute({
        intent,
        decision,
        profile,
      });

      // Default executor returns { executed: true }
      expect(result.success).toBe(true);
      expect(result.result).toEqual({ executed: true });
    });

    it('should allow unregistering executor', () => {
      const executor: ActionExecutor = vi.fn();
      engine.registerExecutor(ActionType.READ, executor);
      expect(engine.unregisterExecutor(ActionType.READ)).toBe(true);
      expect(engine.unregisterExecutor(ActionType.READ)).toBe(false);
    });
  });

  describe('with hooks', () => {
    it('should execute pre-execute hooks before action', async () => {
      const hookCalls: string[] = [];
      const hookManager = createHookManager();

      hookManager.onPreExecute('test-pre-hook', async () => {
        hookCalls.push('pre-execute');
        return { success: true, durationMs: 1 };
      });

      const engine = new ExecutionEngine({ hookManager });
      const executor: ActionExecutor = vi.fn().mockImplementation(async () => {
        hookCalls.push('execute');
        return { ok: true };
      });

      const intent = createIntent();
      const profile = createProfile();
      const decision = createDecision(true);

      await engine.execute({
        intent,
        decision,
        profile,
        executor,
      });

      expect(hookCalls).toEqual(['pre-execute', 'execute']);
    });

    it('should execute post-execute hooks after success', async () => {
      const hookCalls: string[] = [];
      const hookManager = createHookManager();

      hookManager.onPostExecute('test-post-hook', async (ctx) => {
        hookCalls.push(`post-execute:${(ctx.result as { ok: boolean }).ok}`);
        return { success: true, durationMs: 1 };
      });

      const engine = new ExecutionEngine({ hookManager });
      const executor: ActionExecutor = vi.fn().mockResolvedValue({ ok: true });

      const intent = createIntent();
      const profile = createProfile();
      const decision = createDecision(true);

      await engine.execute({
        intent,
        decision,
        profile,
        executor,
      });

      expect(hookCalls).toContain('post-execute:true');
    });

    it('should execute execution-failed hooks on error', async () => {
      const hookCalls: string[] = [];
      const hookManager = createHookManager();

      hookManager.onExecutionFailed('test-failed-hook', async (ctx) => {
        hookCalls.push(`failed:${ctx.error.message}:${ctx.retryable}`);
        return { success: true, durationMs: 1 };
      });

      const engine = new ExecutionEngine({ hookManager });
      const executor: ActionExecutor = vi.fn().mockRejectedValue(new Error('Test error'));

      const intent = createIntent();
      const profile = createProfile();
      const decision = createDecision(true);

      await engine.execute({
        intent,
        decision,
        profile,
        executor,
      });

      expect(hookCalls).toContain('failed:Test error:false');
    });

    it('should abort execution when pre-execute hook aborts', async () => {
      const hookManager = createHookManager();

      hookManager.onPreExecute('abort-hook', async () => {
        return abortResult('Custom abort reason');
      });

      const engine = new ExecutionEngine({ hookManager });
      const executor: ActionExecutor = vi.fn().mockResolvedValue({ ok: true });

      const intent = createIntent();
      const profile = createProfile();
      const decision = createDecision(true);

      const result = await engine.execute({
        intent,
        decision,
        profile,
        executor,
      });

      expect(result.success).toBe(false);
      expect(result.aborted).toBe(true);
      expect(result.abortReason).toBe('Custom abort reason');
      expect(executor).not.toHaveBeenCalled();
    });

    it('should not execute hooks when disabled', async () => {
      const hookCalls: string[] = [];
      const hookManager = createHookManager();

      hookManager.onPreExecute('test-hook', async () => {
        hookCalls.push('should-not-be-called');
        return { success: true, durationMs: 1 };
      });

      const engine = new ExecutionEngine({ hookManager, enableHooks: false });
      const executor: ActionExecutor = vi.fn().mockResolvedValue({ ok: true });

      const intent = createIntent();
      const profile = createProfile();
      const decision = createDecision(true);

      await engine.execute({
        intent,
        decision,
        profile,
        executor,
      });

      expect(hookCalls).toHaveLength(0);
    });

    it('should pass context to hooks', async () => {
      let receivedContext: Record<string, unknown> | null = null;
      const hookManager = createHookManager();

      hookManager.onPreExecute('context-hook', async (ctx) => {
        receivedContext = {
          intent: ctx.intent,
          decision: ctx.decision,
          profile: ctx.profile,
          params: ctx.params,
        };
        return { success: true, durationMs: 1 };
      });

      const engine = new ExecutionEngine({ hookManager });
      const executor: ActionExecutor = vi.fn().mockResolvedValue({ ok: true });

      const intent = createIntent();
      const profile = createProfile();
      const decision = createDecision(true);
      const params = { custom: 'param' };

      await engine.execute({
        intent,
        decision,
        profile,
        params,
        executor,
      });

      expect(receivedContext).not.toBeNull();
      expect((receivedContext as Record<string, unknown>).intent).toBeDefined();
      expect((receivedContext as Record<string, unknown>).decision).toBeDefined();
      expect((receivedContext as Record<string, unknown>).profile).toBeDefined();
      expect((receivedContext as Record<string, unknown>).params).toEqual({ custom: 'param' });
    });
  });

  describe('createExecutionEngine factory', () => {
    it('should create engine with default config', () => {
      const engine = createExecutionEngine();
      expect(engine).toBeInstanceOf(ExecutionEngine);
    });

    it('should create engine with custom config', () => {
      const hookManager = createHookManager();
      const engine = createExecutionEngine({
        hookManager,
        defaultTimeoutMs: 10000,
        allowExpiredDecisions: true,
      });
      expect(engine).toBeInstanceOf(ExecutionEngine);
      expect(engine.getHookManager()).toBe(hookManager);
    });
  });
});
