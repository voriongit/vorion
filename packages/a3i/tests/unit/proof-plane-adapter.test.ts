/**
 * Tests for ProofPlaneAdapter
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import {
  ActionType,
  DataSensitivity,
  Reversibility,
  TrustBand,
  type Intent,
  type Decision,
  type ProofEvent,
} from '@orion/contracts';
import {
  ProofPlaneAdapter,
  createProofPlaneAdapter,
  type ProofPlaneInterface,
} from '../../src/orchestrator/proof-plane-adapter.js';

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

// Helper to create test decision
function createDecision(overrides: Partial<Decision> = {}): Decision {
  return {
    decisionId: uuidv4(),
    intentId: uuidv4(),
    permitted: true,
    trustBand: TrustBand.T3,
    constraints: {},
    rationale: 'Test decision',
    decidedAt: new Date(),
    ...overrides,
  };
}

// Mock ProofEvent
function createMockEvent(): ProofEvent {
  return {
    eventId: uuidv4(),
    eventType: 'INTENT_RECEIVED',
    timestamp: new Date(),
    agentId: 'test-agent',
    correlationId: uuidv4(),
    version: 1,
    eventHash: 'abc123',
  } as ProofEvent;
}

describe('ProofPlaneAdapter', () => {
  let mockProofPlane: ProofPlaneInterface;
  let adapter: ProofPlaneAdapter;

  beforeEach(() => {
    mockProofPlane = {
      logIntentReceived: vi.fn().mockResolvedValue({ event: createMockEvent() }),
      logDecisionMade: vi.fn().mockResolvedValue({ event: createMockEvent() }),
      logExecutionStarted: vi.fn().mockResolvedValue({ event: createMockEvent() }),
      logExecutionCompleted: vi.fn().mockResolvedValue({ event: createMockEvent() }),
      logExecutionFailed: vi.fn().mockResolvedValue({ event: createMockEvent() }),
    };

    adapter = new ProofPlaneAdapter({ proofPlane: mockProofPlane });
  });

  describe('logIntentReceived', () => {
    it('should log intent to proof plane', async () => {
      const intent = createIntent();
      const correlationId = uuidv4();

      await adapter.logIntentReceived(intent, correlationId);

      expect(mockProofPlane.logIntentReceived).toHaveBeenCalledWith(intent, correlationId);
    });

    it('should skip when disabled', async () => {
      const adapter = new ProofPlaneAdapter({
        proofPlane: mockProofPlane,
        logIntentReceived: false,
      });

      await adapter.logIntentReceived(createIntent(), uuidv4());

      expect(mockProofPlane.logIntentReceived).not.toHaveBeenCalled();
    });
  });

  describe('logDecisionMade', () => {
    it('should log decision to proof plane', async () => {
      const decision = createDecision();
      const intent = createIntent();
      const correlationId = uuidv4();

      await adapter.logDecisionMade(decision, intent, correlationId);

      expect(mockProofPlane.logDecisionMade).toHaveBeenCalledWith(decision, correlationId);
    });

    it('should skip when disabled', async () => {
      const adapter = new ProofPlaneAdapter({
        proofPlane: mockProofPlane,
        logDecisionMade: false,
      });

      await adapter.logDecisionMade(createDecision(), createIntent(), uuidv4());

      expect(mockProofPlane.logDecisionMade).not.toHaveBeenCalled();
    });
  });

  describe('logExecutionStarted', () => {
    it('should log execution start to proof plane', async () => {
      const executionId = uuidv4();
      const intent = createIntent();
      const decision = createDecision();
      const correlationId = uuidv4();

      await adapter.logExecutionStarted(executionId, intent, decision, correlationId);

      expect(mockProofPlane.logExecutionStarted).toHaveBeenCalledWith(
        executionId,
        intent.intentId,
        decision.decisionId,
        'a3i-orchestrator',
        intent.agentId,
        correlationId
      );
    });

    it('should use custom adapter ID', async () => {
      const adapter = new ProofPlaneAdapter({
        proofPlane: mockProofPlane,
        adapterId: 'custom-adapter',
      });

      const executionId = uuidv4();
      const intent = createIntent();
      const decision = createDecision();
      const correlationId = uuidv4();

      await adapter.logExecutionStarted(executionId, intent, decision, correlationId);

      expect(mockProofPlane.logExecutionStarted).toHaveBeenCalledWith(
        executionId,
        intent.intentId,
        decision.decisionId,
        'custom-adapter',
        intent.agentId,
        correlationId
      );
    });

    it('should skip when execution events disabled', async () => {
      const adapter = new ProofPlaneAdapter({
        proofPlane: mockProofPlane,
        logExecutionEvents: false,
      });

      await adapter.logExecutionStarted(uuidv4(), createIntent(), createDecision(), uuidv4());

      expect(mockProofPlane.logExecutionStarted).not.toHaveBeenCalled();
    });
  });

  describe('logExecutionCompleted', () => {
    it('should log execution completion with result hash', async () => {
      const executionId = uuidv4();
      const intent = createIntent();
      const result = { data: 'test result' };
      const durationMs = 100;
      const correlationId = uuidv4();

      await adapter.logExecutionCompleted(executionId, intent, result, durationMs, correlationId);

      expect(mockProofPlane.logExecutionCompleted).toHaveBeenCalledWith(
        executionId,
        intent.intentId,
        durationMs,
        expect.any(String), // Hash of result
        intent.agentId,
        correlationId,
        'success'
      );
    });

    it('should skip when execution events disabled', async () => {
      const adapter = new ProofPlaneAdapter({
        proofPlane: mockProofPlane,
        logExecutionEvents: false,
      });

      await adapter.logExecutionCompleted(uuidv4(), createIntent(), {}, 100, uuidv4());

      expect(mockProofPlane.logExecutionCompleted).not.toHaveBeenCalled();
    });
  });

  describe('logExecutionFailed', () => {
    it('should log execution failure', async () => {
      const executionId = uuidv4();
      const intent = createIntent();
      const error = new Error('Test error');
      const durationMs = 50;
      const retryable = true;
      const correlationId = uuidv4();

      await adapter.logExecutionFailed(
        executionId,
        intent,
        error,
        durationMs,
        retryable,
        correlationId
      );

      expect(mockProofPlane.logExecutionFailed).toHaveBeenCalledWith(
        executionId,
        intent.intentId,
        'Test error',
        durationMs,
        retryable,
        intent.agentId,
        correlationId
      );
    });

    it('should skip when execution events disabled', async () => {
      const adapter = new ProofPlaneAdapter({
        proofPlane: mockProofPlane,
        logExecutionEvents: false,
      });

      await adapter.logExecutionFailed(
        uuidv4(),
        createIntent(),
        new Error('fail'),
        50,
        false,
        uuidv4()
      );

      expect(mockProofPlane.logExecutionFailed).not.toHaveBeenCalled();
    });
  });

  describe('createProofPlaneAdapter', () => {
    it('should create adapter with factory function', () => {
      const adapter = createProofPlaneAdapter({ proofPlane: mockProofPlane });

      expect(adapter).toBeInstanceOf(ProofPlaneAdapter);
    });
  });

  describe('configuration defaults', () => {
    it('should enable all logging by default', async () => {
      const intent = createIntent();
      const decision = createDecision();
      const correlationId = uuidv4();

      await adapter.logIntentReceived(intent, correlationId);
      await adapter.logDecisionMade(decision, intent, correlationId);
      await adapter.logExecutionStarted(uuidv4(), intent, decision, correlationId);
      await adapter.logExecutionCompleted(uuidv4(), intent, {}, 100, correlationId);
      await adapter.logExecutionFailed(uuidv4(), intent, new Error('x'), 50, false, correlationId);

      expect(mockProofPlane.logIntentReceived).toHaveBeenCalled();
      expect(mockProofPlane.logDecisionMade).toHaveBeenCalled();
      expect(mockProofPlane.logExecutionStarted).toHaveBeenCalled();
      expect(mockProofPlane.logExecutionCompleted).toHaveBeenCalled();
      expect(mockProofPlane.logExecutionFailed).toHaveBeenCalled();
    });
  });
});
