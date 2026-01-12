/**
 * End-to-End Integration Tests for Orchestration
 *
 * These tests verify the complete orchestration flow including:
 * - Trust profile management
 * - Authorization decisions
 * - Execution with hooks
 * - Logging via OrchestratorLogger
 * - Multiple agent scenarios
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
  type Decision,
  type ProofEvent,
} from '@orion/contracts';
import {
  Orchestrator,
  orchestratorBuilder,
  type OrchestratorLogger,
  type ActionExecutor,
  ProofPlaneAdapter,
  type ProofPlaneInterface,
} from '../../src/orchestrator/index.js';
import { TrustProfileService } from '../../src/trust/profile-service.js';
import { createHookManager, abortResult, type HookManager } from '../../src/hooks/index.js';

// ============================================================================
// Test Helpers
// ============================================================================

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

function createEvidence(
  dimension: 'CT' | 'BT' | 'GT' | 'XT' | 'AC',
  impact: number
): TrustEvidence {
  return {
    evidenceId: uuidv4(),
    dimension,
    impact,
    source: 'integration-test',
    collectedAt: new Date(),
  };
}

function createMockProofPlane(): ProofPlaneInterface {
  const events: ProofEvent[] = [];
  return {
    logIntentReceived: vi.fn().mockImplementation(async () => {
      const event = { eventId: uuidv4(), eventType: 'INTENT_RECEIVED' } as ProofEvent;
      events.push(event);
      return { event };
    }),
    logDecisionMade: vi.fn().mockImplementation(async () => {
      const event = { eventId: uuidv4(), eventType: 'DECISION_MADE' } as ProofEvent;
      events.push(event);
      return { event };
    }),
    logExecutionStarted: vi.fn().mockImplementation(async () => {
      const event = { eventId: uuidv4(), eventType: 'EXECUTION_STARTED' } as ProofEvent;
      events.push(event);
      return { event };
    }),
    logExecutionCompleted: vi.fn().mockImplementation(async () => {
      const event = { eventId: uuidv4(), eventType: 'EXECUTION_COMPLETED' } as ProofEvent;
      events.push(event);
      return { event };
    }),
    logExecutionFailed: vi.fn().mockImplementation(async () => {
      const event = { eventId: uuidv4(), eventType: 'EXECUTION_FAILED' } as ProofEvent;
      events.push(event);
      return { event };
    }),
  };
}

// ============================================================================
// End-to-End Tests
// ============================================================================

describe('Orchestration E2E', () => {
  let profileService: TrustProfileService;
  let hookManager: HookManager;

  beforeEach(async () => {
    profileService = new TrustProfileService();
    hookManager = createHookManager();
  });

  describe('Complete Orchestration Flow', () => {
    it('should process intent through full lifecycle: authorize -> execute -> log', async () => {
      // Setup: Create agent with T3 trust
      await profileService.create('workflow-agent', ObservationTier.WHITE_BOX, [
        createEvidence('CT', 20),
        createEvidence('BT', 20),
        createEvidence('GT', 20),
        createEvidence('XT', 20),
        createEvidence('AC', 20),
      ]);

      // Setup: Track all events
      const lifecycle: string[] = [];
      const logger: OrchestratorLogger = {
        logIntentReceived: vi.fn().mockImplementation(async () => {
          lifecycle.push('intent_received');
        }),
        logDecisionMade: vi.fn().mockImplementation(async () => {
          lifecycle.push('decision_made');
        }),
        logExecutionStarted: vi.fn().mockImplementation(async () => {
          lifecycle.push('execution_started');
        }),
        logExecutionCompleted: vi.fn().mockImplementation(async () => {
          lifecycle.push('execution_completed');
        }),
      };

      // Setup: Executor that does real work
      const executor: ActionExecutor = vi.fn().mockImplementation(
        async (intent: Intent, decision: Decision) => {
          lifecycle.push('executing');
          return {
            status: 'completed',
            agentId: intent.agentId,
            band: TrustBand[decision.trustBand],
          };
        }
      );

      // Build orchestrator
      const orchestrator = orchestratorBuilder()
        .withProfileService(profileService)
        .withHookManager(hookManager)
        .withLogger(logger)
        .build();

      orchestrator.registerExecutor(ActionType.READ, executor);

      // Execute
      const intent = createIntent({ agentId: 'workflow-agent' });
      const result = await orchestrator.processIntent(intent);

      // Verify complete flow
      expect(result.success).toBe(true);
      expect(result.authorization.decision.permitted).toBe(true);
      expect(result.authorization.decision.trustBand).toBe(TrustBand.T3_TRUSTED);
      expect(result.execution?.success).toBe(true);
      expect(result.execution?.result).toEqual({
        status: 'completed',
        agentId: 'workflow-agent',
        band: 'T3_TRUSTED',
      });

      // Verify lifecycle order
      expect(lifecycle).toEqual([
        'intent_received',
        'decision_made',
        'execution_started',
        'executing',
        'execution_completed',
      ]);

      // Verify timing data
      expect(result.timing.profileLookupMs).toBeGreaterThanOrEqual(0);
      expect(result.timing.authorizationMs).toBeGreaterThanOrEqual(0);
      expect(result.timing.executionMs).toBeGreaterThanOrEqual(0);
      expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle authorization denial correctly', async () => {
      // Setup: Create agent with T1 trust (minimal)
      await profileService.create('low-trust-agent', ObservationTier.BLACK_BOX, [
        createEvidence('CT', 5),
      ]);

      const logger: OrchestratorLogger = {
        logIntentReceived: vi.fn(),
        logDecisionMade: vi.fn(),
        logExecutionStarted: vi.fn(),
      };

      const executor: ActionExecutor = vi.fn();

      const orchestrator = orchestratorBuilder()
        .withProfileService(profileService)
        .withLogger(logger)
        .build();

      orchestrator.registerExecutor(ActionType.TRANSFER, executor);

      // Try to perform action requiring higher trust (TRANSFER requires T3)
      const intent = createIntent({
        agentId: 'low-trust-agent',
        actionType: ActionType.TRANSFER,
      });

      const result = await orchestrator.processIntent(intent);

      // Verify denial
      expect(result.success).toBe(false);
      expect(result.authorization.decision.permitted).toBe(false);
      expect(result.execution).toBeUndefined();

      // Verify logging - should log intent and decision, but NOT execution
      expect(logger.logIntentReceived).toHaveBeenCalled();
      expect(logger.logDecisionMade).toHaveBeenCalled();
      expect(logger.logExecutionStarted).not.toHaveBeenCalled();

      // Verify executor was never called
      expect(executor).not.toHaveBeenCalled();
    });

    it('should handle execution failure with proper logging', async () => {
      // Setup: Create agent with T3 trust
      await profileService.create('failing-agent', ObservationTier.WHITE_BOX, [
        createEvidence('CT', 20),
        createEvidence('BT', 20),
        createEvidence('GT', 20),
        createEvidence('XT', 20),
        createEvidence('AC', 20),
      ]);

      const logger: OrchestratorLogger = {
        logIntentReceived: vi.fn(),
        logDecisionMade: vi.fn(),
        logExecutionStarted: vi.fn(),
        logExecutionCompleted: vi.fn(),
        logExecutionFailed: vi.fn(),
      };

      const executor: ActionExecutor = vi.fn().mockRejectedValue(
        new Error('Database connection timeout')
      );

      const orchestrator = orchestratorBuilder()
        .withProfileService(profileService)
        .withLogger(logger)
        .build();

      orchestrator.registerExecutor(ActionType.READ, executor);

      const intent = createIntent({ agentId: 'failing-agent' });
      const result = await orchestrator.processIntent(intent);

      // Verify failure handling
      expect(result.success).toBe(false);
      expect(result.authorization.decision.permitted).toBe(true);
      expect(result.execution?.success).toBe(false);
      expect(result.execution?.error?.message).toBe('Database connection timeout');
      expect(result.execution?.retryable).toBe(true); // timeout errors are retryable

      // Verify logging - should log failure, not completion
      expect(logger.logExecutionStarted).toHaveBeenCalled();
      expect(logger.logExecutionFailed).toHaveBeenCalled();
      expect(logger.logExecutionCompleted).not.toHaveBeenCalled();
    });
  });

  describe('Multi-Agent Scenarios', () => {
    it('should handle multiple agents with different trust levels', async () => {
      // Setup: Create agents with different trust levels
      await profileService.create('t1-agent', ObservationTier.BLACK_BOX, [
        createEvidence('CT', 5),
      ]);

      await profileService.create('t3-agent', ObservationTier.WHITE_BOX, [
        createEvidence('CT', 20),
        createEvidence('BT', 20),
        createEvidence('GT', 20),
        createEvidence('XT', 20),
        createEvidence('AC', 20),
      ]);

      await profileService.create('t4-agent', ObservationTier.WHITE_BOX, [
        createEvidence('CT', 25),
        createEvidence('BT', 25),
        createEvidence('GT', 25),
        createEvidence('XT', 25),
        createEvidence('AC', 25),
      ]);

      const orchestrator = orchestratorBuilder()
        .withProfileService(profileService)
        .build();

      const executor: ActionExecutor = vi.fn().mockResolvedValue({ ok: true });
      orchestrator.registerExecutor(ActionType.READ, executor);

      // Low-trust agent can read PUBLIC data
      const t1Result = await orchestrator.processIntent(
        createIntent({
          agentId: 't1-agent',
          actionType: ActionType.READ,
          dataSensitivity: DataSensitivity.PUBLIC,
        })
      );
      expect(t1Result.success).toBe(true);
      expect(t1Result.authorization.decision.trustBand).toBeLessThan(TrustBand.T3_TRUSTED);

      // Low-trust agent cannot read CONFIDENTIAL data (requires T3)
      const t1DeniedResult = await orchestrator.processIntent(
        createIntent({
          agentId: 't1-agent',
          actionType: ActionType.READ,
          dataSensitivity: DataSensitivity.CONFIDENTIAL,
        })
      );
      expect(t1DeniedResult.success).toBe(false);

      // T3 agent can read CONFIDENTIAL data
      const t3Result = await orchestrator.processIntent(
        createIntent({
          agentId: 't3-agent',
          actionType: ActionType.READ,
          dataSensitivity: DataSensitivity.CONFIDENTIAL,
        })
      );
      expect(t3Result.success).toBe(true);
      expect(t3Result.authorization.decision.trustBand).toBe(TrustBand.T3_TRUSTED);

      // T4 agent can read RESTRICTED data
      const t4Result = await orchestrator.processIntent(
        createIntent({
          agentId: 't4-agent',
          actionType: ActionType.READ,
          dataSensitivity: DataSensitivity.RESTRICTED,
        })
      );
      expect(t4Result.success).toBe(true);
      expect(t4Result.authorization.decision.trustBand).toBe(TrustBand.T4_AUTONOMOUS);
    });

    it('should process concurrent intents from different agents', async () => {
      // Setup: Create multiple agents
      for (const agentId of ['agent-1', 'agent-2', 'agent-3']) {
        await profileService.create(agentId, ObservationTier.WHITE_BOX, [
          createEvidence('CT', 20),
          createEvidence('BT', 20),
          createEvidence('GT', 20),
          createEvidence('XT', 20),
          createEvidence('AC', 20),
        ]);
      }

      const executionOrder: string[] = [];
      const executor: ActionExecutor = vi.fn().mockImplementation(
        async (intent: Intent) => {
          // Simulate some async work
          await new Promise((resolve) => setTimeout(resolve, 10));
          executionOrder.push(intent.agentId);
          return { agentId: intent.agentId };
        }
      );

      const orchestrator = orchestratorBuilder()
        .withProfileService(profileService)
        .build();

      orchestrator.registerExecutor(ActionType.READ, executor);

      // Process intents concurrently
      const intents = [
        createIntent({ agentId: 'agent-1' }),
        createIntent({ agentId: 'agent-2' }),
        createIntent({ agentId: 'agent-3' }),
      ];

      const results = await Promise.all(
        intents.map((intent) => orchestrator.processIntent(intent))
      );

      // All should succeed
      expect(results.every((r) => r.success)).toBe(true);
      expect(executionOrder).toHaveLength(3);
      expect(executionOrder.sort()).toEqual(['agent-1', 'agent-2', 'agent-3']);
    });
  });

  describe('Hook Integration', () => {
    it('should execute hooks at each phase of orchestration', async () => {
      await profileService.create('hooked-agent', ObservationTier.WHITE_BOX, [
        createEvidence('CT', 20),
        createEvidence('BT', 20),
        createEvidence('GT', 20),
        createEvidence('XT', 20),
        createEvidence('AC', 20),
      ]);

      const hookPhases: string[] = [];

      hookManager.onPreAuthorize('tracking-pre-auth', async () => {
        hookPhases.push('pre-authorize');
        return { success: true, durationMs: 1 };
      });

      hookManager.onPostAuthorize('tracking-post-auth', async () => {
        hookPhases.push('post-authorize');
        return { success: true, durationMs: 1 };
      });

      hookManager.onPreExecute('tracking-pre-exec', async () => {
        hookPhases.push('pre-execute');
        return { success: true, durationMs: 1 };
      });

      hookManager.onPostExecute('tracking-post-exec', async () => {
        hookPhases.push('post-execute');
        return { success: true, durationMs: 1 };
      });

      const executor: ActionExecutor = vi.fn().mockImplementation(async () => {
        hookPhases.push('execution');
        return { ok: true };
      });

      const orchestrator = orchestratorBuilder()
        .withProfileService(profileService)
        .withHookManager(hookManager)
        .build();

      orchestrator.registerExecutor(ActionType.READ, executor);

      const intent = createIntent({ agentId: 'hooked-agent' });
      const result = await orchestrator.processIntent(intent);

      expect(result.success).toBe(true);
      expect(hookPhases).toEqual([
        'pre-authorize',
        'post-authorize',
        'pre-execute',
        'execution',
        'post-execute',
      ]);
    });

    it('should abort execution when pre-execute hook aborts', async () => {
      await profileService.create('abort-agent', ObservationTier.WHITE_BOX, [
        createEvidence('CT', 20),
        createEvidence('BT', 20),
        createEvidence('GT', 20),
        createEvidence('XT', 20),
        createEvidence('AC', 20),
      ]);

      hookManager.onPreExecute('rate-limiter', async () => {
        return abortResult('Rate limit exceeded');
      });

      const executor: ActionExecutor = vi.fn();

      const orchestrator = orchestratorBuilder()
        .withProfileService(profileService)
        .withHookManager(hookManager)
        .build();

      orchestrator.registerExecutor(ActionType.READ, executor);

      const intent = createIntent({ agentId: 'abort-agent' });
      const result = await orchestrator.processIntent(intent);

      // Should be authorized but execution aborted
      expect(result.authorization.decision.permitted).toBe(true);
      expect(result.execution?.success).toBe(false);
      expect(result.execution?.aborted).toBe(true);
      expect(result.execution?.abortReason).toBe('Rate limit exceeded');
      expect(executor).not.toHaveBeenCalled();
    });

    it('should abort authorization when pre-authorize hook aborts', async () => {
      await profileService.create('blocked-agent', ObservationTier.WHITE_BOX, [
        createEvidence('CT', 20),
        createEvidence('BT', 20),
        createEvidence('GT', 20),
        createEvidence('XT', 20),
        createEvidence('AC', 20),
      ]);

      hookManager.onPreAuthorize('ip-blocker', async (context) => {
        if (context.intent.context?.blockedIp) {
          return abortResult('IP address is blocked');
        }
        return { success: true, durationMs: 1 };
      });

      const executor: ActionExecutor = vi.fn();

      const orchestrator = orchestratorBuilder()
        .withProfileService(profileService)
        .withHookManager(hookManager)
        .build();

      orchestrator.registerExecutor(ActionType.READ, executor);

      const intent = createIntent({
        agentId: 'blocked-agent',
        context: { blockedIp: true },
      });

      const result = await orchestrator.processIntent(intent);

      expect(result.success).toBe(false);
      expect(result.authorization.decision.permitted).toBe(false);
      expect(result.execution).toBeUndefined();
      expect(executor).not.toHaveBeenCalled();
    });
  });

  describe('ProofPlane Adapter Integration', () => {
    it('should log all events through ProofPlane adapter', async () => {
      await profileService.create('audited-agent', ObservationTier.WHITE_BOX, [
        createEvidence('CT', 20),
        createEvidence('BT', 20),
        createEvidence('GT', 20),
        createEvidence('XT', 20),
        createEvidence('AC', 20),
      ]);

      const mockProofPlane = createMockProofPlane();
      const adapter = new ProofPlaneAdapter({ proofPlane: mockProofPlane });

      const executor: ActionExecutor = vi.fn().mockResolvedValue({ data: 'result' });

      const orchestrator = orchestratorBuilder()
        .withProfileService(profileService)
        .withLogger(adapter)
        .build();

      orchestrator.registerExecutor(ActionType.READ, executor);

      const intent = createIntent({ agentId: 'audited-agent' });
      await orchestrator.processIntent(intent);

      // Verify all ProofPlane methods were called
      expect(mockProofPlane.logIntentReceived).toHaveBeenCalledWith(
        intent,
        expect.any(String)
      );
      expect(mockProofPlane.logDecisionMade).toHaveBeenCalledWith(
        expect.objectContaining({ permitted: true }),
        expect.any(String)
      );
      expect(mockProofPlane.logExecutionStarted).toHaveBeenCalled();
      expect(mockProofPlane.logExecutionCompleted).toHaveBeenCalled();
      expect(mockProofPlane.logExecutionFailed).not.toHaveBeenCalled();
    });

    it('should log execution failure through ProofPlane adapter', async () => {
      await profileService.create('failing-audited-agent', ObservationTier.WHITE_BOX, [
        createEvidence('CT', 20),
        createEvidence('BT', 20),
        createEvidence('GT', 20),
        createEvidence('XT', 20),
        createEvidence('AC', 20),
      ]);

      const mockProofPlane = createMockProofPlane();
      const adapter = new ProofPlaneAdapter({ proofPlane: mockProofPlane });

      const executor: ActionExecutor = vi.fn().mockRejectedValue(
        new Error('Service unavailable')
      );

      const orchestrator = orchestratorBuilder()
        .withProfileService(profileService)
        .withLogger(adapter)
        .build();

      orchestrator.registerExecutor(ActionType.READ, executor);

      const intent = createIntent({ agentId: 'failing-audited-agent' });
      await orchestrator.processIntent(intent);

      expect(mockProofPlane.logExecutionFailed).toHaveBeenCalledWith(
        expect.any(String), // executionId
        intent.intentId,
        'Service unavailable',
        expect.any(Number), // durationMs
        true, // retryable (service unavailable is retryable)
        intent.agentId,
        expect.any(String) // correlationId
      );
      expect(mockProofPlane.logExecutionCompleted).not.toHaveBeenCalled();
    });

    it('should respect ProofPlane adapter configuration', async () => {
      await profileService.create('configured-agent', ObservationTier.WHITE_BOX, [
        createEvidence('CT', 20),
        createEvidence('BT', 20),
        createEvidence('GT', 20),
        createEvidence('XT', 20),
        createEvidence('AC', 20),
      ]);

      const mockProofPlane = createMockProofPlane();
      const adapter = new ProofPlaneAdapter({
        proofPlane: mockProofPlane,
        logIntentReceived: true,
        logDecisionMade: true,
        logExecutionEvents: false, // Disable execution logging
      });

      const executor: ActionExecutor = vi.fn().mockResolvedValue({ ok: true });

      const orchestrator = orchestratorBuilder()
        .withProfileService(profileService)
        .withLogger(adapter)
        .build();

      orchestrator.registerExecutor(ActionType.READ, executor);

      await orchestrator.processIntent(createIntent({ agentId: 'configured-agent' }));

      // Should log intent and decision
      expect(mockProofPlane.logIntentReceived).toHaveBeenCalled();
      expect(mockProofPlane.logDecisionMade).toHaveBeenCalled();

      // Should NOT log execution events
      expect(mockProofPlane.logExecutionStarted).not.toHaveBeenCalled();
      expect(mockProofPlane.logExecutionCompleted).not.toHaveBeenCalled();
    });
  });

  describe('Authorization Constraints', () => {
    it('should apply constraints based on trust band', async () => {
      await profileService.create('constrained-agent', ObservationTier.WHITE_BOX, [
        createEvidence('CT', 10),
        createEvidence('BT', 10),
      ]);

      const orchestrator = orchestratorBuilder()
        .withProfileService(profileService)
        .build();

      const intent = createIntent({ agentId: 'constrained-agent' });
      const result = await orchestrator.processIntent(intent, { authorizeOnly: true });

      expect(result.authorization.decision.permitted).toBe(true);
      expect(result.authorization.decision.constraints).toBeDefined();

      // Lower trust bands should have stricter constraints
      const constraints = result.authorization.decision.constraints;
      expect(constraints).toHaveProperty('requiredApprovals');
      expect(constraints).toHaveProperty('rateLimits');
    });
  });

  describe('Error Resilience', () => {
    it('should handle unknown agents gracefully', async () => {
      const orchestrator = orchestratorBuilder()
        .withProfileService(profileService)
        .build();

      const intent = createIntent({ agentId: 'nonexistent-agent' });
      const result = await orchestrator.processIntent(intent);

      expect(result.success).toBe(false);
      expect(result.authorization.decision.permitted).toBe(false);
      expect(result.authorization.remediations).toBeDefined();
    });

    it('should handle expired intents', async () => {
      await profileService.create('expired-intent-agent', ObservationTier.WHITE_BOX, [
        createEvidence('CT', 20),
        createEvidence('BT', 20),
        createEvidence('GT', 20),
        createEvidence('XT', 20),
        createEvidence('AC', 20),
      ]);

      const orchestrator = orchestratorBuilder()
        .withProfileService(profileService)
        .build();

      const expiredIntent = createIntent({
        agentId: 'expired-intent-agent',
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      });

      const result = await orchestrator.processIntent(expiredIntent);

      expect(result.success).toBe(false);
      expect(result.authorization.decision.permitted).toBe(false);
    });

    it('should continue processing when logger fails', async () => {
      await profileService.create('logger-fail-agent', ObservationTier.WHITE_BOX, [
        createEvidence('CT', 20),
        createEvidence('BT', 20),
        createEvidence('GT', 20),
        createEvidence('XT', 20),
        createEvidence('AC', 20),
      ]);

      const failingLogger: OrchestratorLogger = {
        logIntentReceived: vi.fn().mockRejectedValue(new Error('Logger down')),
        logDecisionMade: vi.fn().mockRejectedValue(new Error('Logger down')),
        logExecutionStarted: vi.fn().mockRejectedValue(new Error('Logger down')),
        logExecutionCompleted: vi.fn().mockRejectedValue(new Error('Logger down')),
      };

      const executor: ActionExecutor = vi.fn().mockResolvedValue({ ok: true });

      const orchestrator = orchestratorBuilder()
        .withProfileService(profileService)
        .withLogger(failingLogger)
        .build();

      orchestrator.registerExecutor(ActionType.READ, executor);

      // Should succeed despite logger failures
      const result = await orchestrator.processIntent(
        createIntent({ agentId: 'logger-fail-agent' })
      );

      expect(result.success).toBe(true);
      expect(executor).toHaveBeenCalled();
    });
  });

  describe('End-to-End Workflow', () => {
    it('should support complete agent registration and action workflow', async () => {
      // Step 1: Create and configure orchestrator
      const eventLog: { type: string; timestamp: Date; data: unknown }[] = [];

      const logger: OrchestratorLogger = {
        logIntentReceived: async (intent) => {
          eventLog.push({ type: 'INTENT', timestamp: new Date(), data: intent.intentId });
        },
        logDecisionMade: async (decision) => {
          eventLog.push({
            type: 'DECISION',
            timestamp: new Date(),
            data: { permitted: decision.permitted, band: decision.trustBand },
          });
        },
        logExecutionCompleted: async (_, intent, result) => {
          eventLog.push({
            type: 'COMPLETED',
            timestamp: new Date(),
            data: { intentId: intent.intentId, result },
          });
        },
      };

      const orchestrator = orchestratorBuilder()
        .withProfileService(profileService)
        .withHookManager(hookManager)
        .withLogger(logger)
        .build();

      // Step 2: Register action executors
      orchestrator.registerExecutor(ActionType.READ, async (intent) => ({
        action: 'read',
        resource: intent.resourceScope[0],
        data: { content: 'file contents' },
      }));

      orchestrator.registerExecutor(ActionType.WRITE, async (intent, decision, params) => ({
        action: 'write',
        resource: intent.resourceScope[0],
        bytesWritten: (params as { content?: string })?.content?.length ?? 0,
        constraints: decision.constraints,
      }));

      // Step 3: Register a new agent
      await profileService.create('new-agent', ObservationTier.GREY_BOX, [
        createEvidence('CT', 15),
        createEvidence('BT', 15),
        createEvidence('GT', 15),
      ]);

      // Step 4: Agent performs a READ action
      const readResult = await orchestrator.processIntent(
        createIntent({
          agentId: 'new-agent',
          actionType: ActionType.READ,
          resourceScope: ['docs/readme.md'],
        })
      );

      expect(readResult.success).toBe(true);
      expect(readResult.execution?.result).toEqual({
        action: 'read',
        resource: 'docs/readme.md',
        data: { content: 'file contents' },
      });

      // Step 5: Agent builds trust through successful operations
      await profileService.update('new-agent', [
        createEvidence('BT', 10),
        createEvidence('GT', 10),
      ]);

      // Step 6: Agent attempts WRITE action with params
      const writeResult = await orchestrator.processIntent(
        createIntent({
          agentId: 'new-agent',
          actionType: ActionType.WRITE,
          dataSensitivity: DataSensitivity.INTERNAL,
          resourceScope: ['config/settings.json'],
        }),
        { params: { content: 'new configuration' } }
      );

      expect(writeResult.success).toBe(true);
      expect(writeResult.execution?.result).toMatchObject({
        action: 'write',
        resource: 'config/settings.json',
        bytesWritten: 17,
      });

      // Step 7: Verify complete audit trail
      expect(eventLog.length).toBe(6); // 2 intents × (intent + decision + completed)
      expect(eventLog.filter((e) => e.type === 'INTENT').length).toBe(2);
      expect(eventLog.filter((e) => e.type === 'DECISION').length).toBe(2);
      expect(eventLog.filter((e) => e.type === 'COMPLETED').length).toBe(2);
    });
  });
});
