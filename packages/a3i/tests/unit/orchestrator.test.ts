/**
 * Tests for Orchestrator
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
  type TrustEvidence,
} from '@orion/contracts';
import {
  Orchestrator,
  createOrchestrator,
  orchestratorBuilder,
  type ActionExecutor,
  type OrchestratorLogger,
} from '../../src/orchestrator/index.js';
import { TrustProfileService } from '../../src/trust/profile-service.js';
import { createHookManager } from '../../src/hooks/index.js';

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

// Helper to create test evidence
function createEvidence(
  dimension: 'CT' | 'BT' | 'GT' | 'XT' | 'AC',
  impact: number
): TrustEvidence {
  return {
    evidenceId: uuidv4(),
    dimension,
    impact,
    source: 'test',
    collectedAt: new Date(),
  };
}

describe('Orchestrator', () => {
  let orchestrator: Orchestrator;
  let profileService: TrustProfileService;

  beforeEach(async () => {
    profileService = new TrustProfileService();
    orchestrator = new Orchestrator({ profileService });

    // Create a test agent with T3 trust
    await profileService.create('test-agent', ObservationTier.WHITE_BOX, [
      createEvidence('CT', 20),
      createEvidence('BT', 20),
      createEvidence('GT', 20),
      createEvidence('XT', 20),
      createEvidence('AC', 20),
    ]);
  });

  describe('processIntent', () => {
    it('should authorize and execute an intent successfully', async () => {
      const executor: ActionExecutor = vi.fn().mockResolvedValue({ data: 'result' });
      orchestrator.registerExecutor(ActionType.READ, executor);

      const intent = createIntent({ agentId: 'test-agent' });
      const result = await orchestrator.processIntent(intent);

      expect(result.success).toBe(true);
      expect(result.authorization.decision.permitted).toBe(true);
      expect(result.execution).toBeDefined();
      expect(result.execution!.success).toBe(true);
      expect(result.execution!.result).toEqual({ data: 'result' });
      expect(result.profile).toBeDefined();
      expect(result.orchestrationId).toBeDefined();
    });

    it('should include timing breakdown', async () => {
      const intent = createIntent({ agentId: 'test-agent' });
      const result = await orchestrator.processIntent(intent);

      expect(result.timing.profileLookupMs).toBeGreaterThanOrEqual(0);
      expect(result.timing.authorizationMs).toBeGreaterThanOrEqual(0);
      expect(result.timing.executionMs).toBeGreaterThanOrEqual(0);
      expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
    });

    it('should deny unknown agents', async () => {
      const intent = createIntent({ agentId: 'unknown-agent' });
      const result = await orchestrator.processIntent(intent);

      expect(result.success).toBe(false);
      expect(result.authorization.decision.permitted).toBe(false);
      expect(result.execution).toBeUndefined();
    });

    it('should not execute when authorization fails', async () => {
      const executor: ActionExecutor = vi.fn();
      orchestrator.registerExecutor(ActionType.READ, executor);

      // T3 agent can't access RESTRICTED data (requires T4)
      const intent = createIntent({
        agentId: 'test-agent',
        actionType: ActionType.READ,
        dataSensitivity: DataSensitivity.RESTRICTED,
      });
      const result = await orchestrator.processIntent(intent);

      expect(result.success).toBe(false);
      expect(result.authorization.decision.permitted).toBe(false);
      expect(result.execution).toBeUndefined();
      expect(executor).not.toHaveBeenCalled();
    });

    it('should use custom executor from options', async () => {
      const registeredExecutor: ActionExecutor = vi.fn().mockResolvedValue({ from: 'registered' });
      const customExecutor: ActionExecutor = vi.fn().mockResolvedValue({ from: 'custom' });
      orchestrator.registerExecutor(ActionType.READ, registeredExecutor);

      const intent = createIntent({ agentId: 'test-agent' });
      const result = await orchestrator.processIntent(intent, {
        executor: customExecutor,
      });

      expect(result.success).toBe(true);
      expect(result.execution!.result).toEqual({ from: 'custom' });
      expect(customExecutor).toHaveBeenCalled();
      expect(registeredExecutor).not.toHaveBeenCalled();
    });

    it('should pass params to executor', async () => {
      const executor: ActionExecutor = vi.fn().mockResolvedValue({ ok: true });
      orchestrator.registerExecutor(ActionType.READ, executor);

      const intent = createIntent({ agentId: 'test-agent' });
      const params = { key: 'value' };
      await orchestrator.processIntent(intent, { params });

      expect(executor).toHaveBeenCalledWith(
        intent,
        expect.objectContaining({ permitted: true }),
        params
      );
    });

    it('should skip execution when authorizeOnly is true', async () => {
      const executor: ActionExecutor = vi.fn().mockResolvedValue({ ok: true });
      orchestrator.registerExecutor(ActionType.READ, executor);

      const intent = createIntent({ agentId: 'test-agent' });
      const result = await orchestrator.processIntent(intent, { authorizeOnly: true });

      expect(result.authorization.decision.permitted).toBe(true);
      expect(result.execution).toBeUndefined();
      expect(result.success).toBe(false); // success requires both auth AND execution
      expect(executor).not.toHaveBeenCalled();
    });

    it('should handle execution failures', async () => {
      const executor: ActionExecutor = vi.fn().mockRejectedValue(new Error('Execution failed'));
      orchestrator.registerExecutor(ActionType.READ, executor);

      const intent = createIntent({ agentId: 'test-agent' });
      const result = await orchestrator.processIntent(intent);

      expect(result.authorization.decision.permitted).toBe(true);
      expect(result.execution).toBeDefined();
      expect(result.execution!.success).toBe(false);
      expect(result.execution!.error?.message).toBe('Execution failed');
      expect(result.success).toBe(false);
    });
  });

  describe('authorize', () => {
    it('should authorize intent without executing', async () => {
      const response = await orchestrator.authorize(createIntent({ agentId: 'test-agent' }));

      expect(response.decision.permitted).toBe(true);
      expect(response.decision.constraints).toBeDefined();
    });
  });

  describe('execute', () => {
    it('should execute with provided decision and profile', async () => {
      const executor: ActionExecutor = vi.fn().mockResolvedValue({ ok: true });
      orchestrator.registerExecutor(ActionType.READ, executor);

      const intent = createIntent({ agentId: 'test-agent' });
      const authResponse = await orchestrator.authorize(intent);
      const profile = await profileService.get('test-agent');

      const result = await orchestrator.execute(
        intent,
        authResponse.decision,
        profile!
      );

      expect(result.success).toBe(true);
    });
  });

  describe('component access', () => {
    it('should expose authorization engine', () => {
      expect(orchestrator.getAuthorizationEngine()).toBeDefined();
    });

    it('should expose execution engine', () => {
      expect(orchestrator.getExecutionEngine()).toBeDefined();
    });

    it('should expose profile service', () => {
      expect(orchestrator.getProfileService()).toBeDefined();
    });
  });

  describe('with hooks', () => {
    it('should pass hook manager to all components', async () => {
      const hookCalls: string[] = [];
      const hookManager = createHookManager();

      hookManager.onPreAuthorize('test-pre-auth', async () => {
        hookCalls.push('pre-authorize');
        return { success: true, durationMs: 1 };
      });

      hookManager.onPostAuthorize('test-post-auth', async () => {
        hookCalls.push('post-authorize');
        return { success: true, durationMs: 1 };
      });

      hookManager.onPreExecute('test-pre-exec', async () => {
        hookCalls.push('pre-execute');
        return { success: true, durationMs: 1 };
      });

      hookManager.onPostExecute('test-post-exec', async () => {
        hookCalls.push('post-execute');
        return { success: true, durationMs: 1 };
      });

      const orchestrator = new Orchestrator({
        profileService,
        hookManager,
      });

      const intent = createIntent({ agentId: 'test-agent' });
      await orchestrator.processIntent(intent);

      expect(hookCalls).toContain('pre-authorize');
      expect(hookCalls).toContain('post-authorize');
      expect(hookCalls).toContain('pre-execute');
      expect(hookCalls).toContain('post-execute');
    });
  });
});

describe('createOrchestrator', () => {
  it('should create orchestrator with default config', () => {
    const orchestrator = createOrchestrator();
    expect(orchestrator).toBeInstanceOf(Orchestrator);
  });

  it('should create orchestrator with custom config', () => {
    const hookManager = createHookManager();
    const orchestrator = createOrchestrator({ hookManager });
    expect(orchestrator.getHookManager()).toBe(hookManager);
  });
});

describe('OrchestratorBuilder', () => {
  it('should build orchestrator with fluent API', async () => {
    const hookManager = createHookManager();
    const profileService = new TrustProfileService();

    await profileService.create('builder-agent', ObservationTier.WHITE_BOX, [
      createEvidence('CT', 20),
    ]);

    const orchestrator = orchestratorBuilder()
      .withHookManager(hookManager)
      .withProfileService(profileService)
      .build();

    expect(orchestrator.getHookManager()).toBe(hookManager);
    expect(orchestrator.getProfileService()).toBe(profileService);
  });

  it('should accept config objects', () => {
    const orchestrator = orchestratorBuilder()
      .withAuthorizationConfig({ strictMode: true })
      .withExecutionConfig({ defaultTimeoutMs: 10000 })
      .build();

    expect(orchestrator).toBeInstanceOf(Orchestrator);
  });
});

describe('Orchestrator Logging', () => {
  let profileService: TrustProfileService;

  beforeEach(async () => {
    profileService = new TrustProfileService();
    await profileService.create('test-agent', ObservationTier.WHITE_BOX, [
      createEvidence('CT', 20),
      createEvidence('BT', 20),
      createEvidence('GT', 20),
      createEvidence('XT', 20),
      createEvidence('AC', 20),
    ]);
  });

  it('should call logger methods during successful processing', async () => {
    const logCalls: string[] = [];
    const logger: OrchestratorLogger = {
      logIntentReceived: vi.fn().mockImplementation(async () => {
        logCalls.push('intentReceived');
      }),
      logDecisionMade: vi.fn().mockImplementation(async () => {
        logCalls.push('decisionMade');
      }),
      logExecutionStarted: vi.fn().mockImplementation(async () => {
        logCalls.push('executionStarted');
      }),
      logExecutionCompleted: vi.fn().mockImplementation(async () => {
        logCalls.push('executionCompleted');
      }),
      logExecutionFailed: vi.fn().mockImplementation(async () => {
        logCalls.push('executionFailed');
      }),
    };

    const orchestrator = orchestratorBuilder()
      .withProfileService(profileService)
      .withLogger(logger)
      .build();

    const executor: ActionExecutor = vi.fn().mockResolvedValue({ ok: true });
    orchestrator.registerExecutor(ActionType.READ, executor);

    const intent = createIntent({ agentId: 'test-agent' });
    await orchestrator.processIntent(intent);

    expect(logCalls).toEqual([
      'intentReceived',
      'decisionMade',
      'executionStarted',
      'executionCompleted',
    ]);
  });

  it('should call logExecutionFailed on execution error', async () => {
    const logger: OrchestratorLogger = {
      logIntentReceived: vi.fn(),
      logDecisionMade: vi.fn(),
      logExecutionStarted: vi.fn(),
      logExecutionCompleted: vi.fn(),
      logExecutionFailed: vi.fn(),
    };

    const orchestrator = orchestratorBuilder()
      .withProfileService(profileService)
      .withLogger(logger)
      .build();

    const executor: ActionExecutor = vi.fn().mockRejectedValue(new Error('Failed'));
    orchestrator.registerExecutor(ActionType.READ, executor);

    const intent = createIntent({ agentId: 'test-agent' });
    await orchestrator.processIntent(intent);

    expect(logger.logExecutionStarted).toHaveBeenCalled();
    expect(logger.logExecutionFailed).toHaveBeenCalled();
    expect(logger.logExecutionCompleted).not.toHaveBeenCalled();
  });

  it('should skip execution logging when authorization fails', async () => {
    const logger: OrchestratorLogger = {
      logIntentReceived: vi.fn(),
      logDecisionMade: vi.fn(),
      logExecutionStarted: vi.fn(),
      logExecutionCompleted: vi.fn(),
      logExecutionFailed: vi.fn(),
    };

    const orchestrator = orchestratorBuilder()
      .withProfileService(profileService)
      .withLogger(logger)
      .build();

    // Unknown agent will fail authorization
    const intent = createIntent({ agentId: 'unknown-agent' });
    await orchestrator.processIntent(intent);

    expect(logger.logIntentReceived).toHaveBeenCalled();
    expect(logger.logDecisionMade).toHaveBeenCalled();
    expect(logger.logExecutionStarted).not.toHaveBeenCalled();
    expect(logger.logExecutionCompleted).not.toHaveBeenCalled();
    expect(logger.logExecutionFailed).not.toHaveBeenCalled();
  });

  it('should not log when logging is disabled', async () => {
    const logger: OrchestratorLogger = {
      logIntentReceived: vi.fn(),
      logDecisionMade: vi.fn(),
    };

    const orchestrator = orchestratorBuilder()
      .withProfileService(profileService)
      .withLogger(logger)
      .withLogging(false)
      .build();

    const intent = createIntent({ agentId: 'test-agent' });
    await orchestrator.processIntent(intent);

    expect(logger.logIntentReceived).not.toHaveBeenCalled();
    expect(logger.logDecisionMade).not.toHaveBeenCalled();
  });

  it('should handle logger errors gracefully', async () => {
    const logger: OrchestratorLogger = {
      logIntentReceived: vi.fn().mockRejectedValue(new Error('Logger failed')),
      logDecisionMade: vi.fn(),
    };

    const orchestrator = orchestratorBuilder()
      .withProfileService(profileService)
      .withLogger(logger)
      .build();

    const intent = createIntent({ agentId: 'test-agent' });

    // Should not throw even if logger fails
    const result = await orchestrator.processIntent(intent);
    expect(result.authorization.decision).toBeDefined();
  });

  it('should enable logging automatically when logger is provided', () => {
    const logger: OrchestratorLogger = {};
    const orchestrator = orchestratorBuilder()
      .withProfileService(profileService)
      .withLogger(logger)
      .build();

    expect(orchestrator.isLoggingEnabled()).toBe(true);
  });

  it('should report logging disabled when no logger', () => {
    const orchestrator = orchestratorBuilder()
      .withProfileService(profileService)
      .build();

    expect(orchestrator.isLoggingEnabled()).toBe(false);
  });

  it('should expose the logger via getLogger', () => {
    const logger: OrchestratorLogger = {};
    const orchestrator = orchestratorBuilder()
      .withProfileService(profileService)
      .withLogger(logger)
      .build();

    expect(orchestrator.getLogger()).toBe(logger);
  });
});
