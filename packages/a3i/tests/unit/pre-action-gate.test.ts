/**
 * Tests for Pre-Action Verification Gate - ATSF v2.0 Section 4.4
 *
 * Key properties tested:
 * - Trust score gates CAPABILITY before execution
 * - Low-trust agents cannot request high-risk actions
 * - Trust must be earned through low-risk actions first
 * - Risk classification based on action type, sensitivity, reversibility
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  PreActionGate,
  createPreActionGate,
  createMapTrustProvider,
  classifyRisk,
  getRiskLevel,
  isReadOnly,
  isDestructive,
  requiresVerification,
  requiresHumanApproval,
} from '../../src/gate/index.js';
import {
  ActionType,
  DataSensitivity,
  Reversibility,
  RiskLevel,
  GateStatus,
  TRUST_THRESHOLDS,
} from '@orion/contracts';

describe('Risk Classifier', () => {
  describe('classifyRisk', () => {
    it('should classify read operations as low risk', () => {
      const factors = classifyRisk({
        agentId: 'agent1',
        action: 'Read file',
        actionType: ActionType.READ,
        resourceScope: ['files'],
        dataSensitivity: DataSensitivity.PUBLIC,
        reversibility: Reversibility.REVERSIBLE,
      });

      expect(factors.riskLevel).toBe(RiskLevel.READ);
      expect(factors.combinedScore).toBeLessThan(20);
    });

    it('should classify delete operations as high risk', () => {
      const factors = classifyRisk({
        agentId: 'agent1',
        action: 'Delete database',
        actionType: ActionType.DELETE,
        resourceScope: ['database'],
        dataSensitivity: DataSensitivity.CONFIDENTIAL,
        reversibility: Reversibility.IRREVERSIBLE,
      });

      expect(factors.riskLevel).toBe(RiskLevel.CRITICAL);
      expect(factors.combinedScore).toBeGreaterThanOrEqual(80);
    });

    it('should classify transfer operations as high risk', () => {
      const factors = classifyRisk({
        agentId: 'agent1',
        action: 'Transfer funds',
        actionType: ActionType.TRANSFER,
        resourceScope: ['accounts'],
        dataSensitivity: DataSensitivity.RESTRICTED,
        reversibility: Reversibility.IRREVERSIBLE,
      });

      expect(factors.riskLevel).toBe(RiskLevel.CRITICAL);
    });

    it('should increase risk for higher data sensitivity', () => {
      const publicRisk = classifyRisk({
        agentId: 'agent1',
        action: 'Write file',
        actionType: ActionType.WRITE,
        resourceScope: ['files'],
        dataSensitivity: DataSensitivity.PUBLIC,
        reversibility: Reversibility.REVERSIBLE,
      });

      const restrictedRisk = classifyRisk({
        agentId: 'agent1',
        action: 'Write file',
        actionType: ActionType.WRITE,
        resourceScope: ['files'],
        dataSensitivity: DataSensitivity.RESTRICTED,
        reversibility: Reversibility.REVERSIBLE,
      });

      expect(restrictedRisk.combinedScore).toBeGreaterThan(publicRisk.combinedScore);
    });

    it('should increase risk for irreversible actions', () => {
      const reversibleRisk = classifyRisk({
        agentId: 'agent1',
        action: 'Write file',
        actionType: ActionType.WRITE,
        resourceScope: ['files'],
        dataSensitivity: DataSensitivity.INTERNAL,
        reversibility: Reversibility.REVERSIBLE,
      });

      const irreversibleRisk = classifyRisk({
        agentId: 'agent1',
        action: 'Write file',
        actionType: ActionType.WRITE,
        resourceScope: ['files'],
        dataSensitivity: DataSensitivity.INTERNAL,
        reversibility: Reversibility.IRREVERSIBLE,
      });

      expect(irreversibleRisk.combinedScore).toBeGreaterThan(reversibleRisk.combinedScore);
    });

    it('should increase risk for high magnitude actions', () => {
      const lowMagnitude = classifyRisk({
        agentId: 'agent1',
        action: 'Transfer $10',
        actionType: ActionType.TRANSFER,
        resourceScope: ['accounts'],
        dataSensitivity: DataSensitivity.INTERNAL,
        reversibility: Reversibility.REVERSIBLE,
        magnitude: 10,
      });

      const highMagnitude = classifyRisk({
        agentId: 'agent1',
        action: 'Transfer $100,000',
        actionType: ActionType.TRANSFER,
        resourceScope: ['accounts'],
        dataSensitivity: DataSensitivity.INTERNAL,
        reversibility: Reversibility.REVERSIBLE,
        magnitude: 100000,
      });

      expect(highMagnitude.magnitudeRisk).toBeGreaterThan(lowMagnitude.magnitudeRisk);
    });
  });

  describe('Helper functions', () => {
    it('isReadOnly should identify read actions', () => {
      expect(isReadOnly(ActionType.READ)).toBe(true);
      expect(isReadOnly(ActionType.WRITE)).toBe(false);
      expect(isReadOnly(ActionType.DELETE)).toBe(false);
    });

    it('isDestructive should identify destructive actions', () => {
      expect(isDestructive(ActionType.DELETE, Reversibility.IRREVERSIBLE)).toBe(true);
      expect(isDestructive(ActionType.DELETE, Reversibility.REVERSIBLE)).toBe(false);
      expect(isDestructive(ActionType.WRITE, Reversibility.IRREVERSIBLE)).toBe(false);
    });

    it('requiresVerification should be true for HIGH and CRITICAL', () => {
      expect(requiresVerification(RiskLevel.READ)).toBe(false);
      expect(requiresVerification(RiskLevel.LOW)).toBe(false);
      expect(requiresVerification(RiskLevel.MEDIUM)).toBe(false);
      expect(requiresVerification(RiskLevel.HIGH)).toBe(true);
      expect(requiresVerification(RiskLevel.CRITICAL)).toBe(true);
    });

    it('requiresHumanApproval should be true for CRITICAL only', () => {
      expect(requiresHumanApproval(RiskLevel.HIGH)).toBe(false);
      expect(requiresHumanApproval(RiskLevel.CRITICAL)).toBe(true);
    });
  });
});

describe('PreActionGate', () => {
  let gate: PreActionGate;

  beforeEach(() => {
    gate = createPreActionGate();
  });

  describe('Trust Thresholds', () => {
    it('should have correct default thresholds per ATSF v2.0', () => {
      const thresholds = gate.getThresholds();
      expect(thresholds[RiskLevel.READ]).toBe(0);
      expect(thresholds[RiskLevel.LOW]).toBe(20);
      expect(thresholds[RiskLevel.MEDIUM]).toBe(40);
      expect(thresholds[RiskLevel.HIGH]).toBe(60);
      expect(thresholds[RiskLevel.CRITICAL]).toBe(80);
    });

    it('should allow custom thresholds', () => {
      const customGate = createPreActionGate({
        trustThresholds: {
          [RiskLevel.LOW]: 30,
          [RiskLevel.MEDIUM]: 50,
        },
      });

      const thresholds = customGate.getThresholds();
      expect(thresholds[RiskLevel.LOW]).toBe(30);
      expect(thresholds[RiskLevel.MEDIUM]).toBe(50);
      expect(thresholds[RiskLevel.HIGH]).toBe(60); // Default
    });
  });

  describe('Verification', () => {
    it('should approve read actions with zero trust', async () => {
      const result = await gate.verify({
        agentId: 'agent1',
        action: 'Read file',
        actionType: ActionType.READ,
        resourceScope: ['files'],
        dataSensitivity: DataSensitivity.PUBLIC,
        reversibility: Reversibility.REVERSIBLE,
      }, 0);

      expect(result.status).toBe(GateStatus.APPROVED);
      expect(result.passed).toBe(true);
      expect(result.riskLevel).toBe(RiskLevel.READ);
    });

    it('should reject high-risk actions from low-trust agents', async () => {
      const result = await gate.verify({
        agentId: 'agent1',
        action: 'Delete database',
        actionType: ActionType.DELETE,
        resourceScope: ['database'],
        dataSensitivity: DataSensitivity.CONFIDENTIAL,
        reversibility: Reversibility.IRREVERSIBLE,
      }, 30); // Below HIGH threshold of 60

      expect(result.status).toBe(GateStatus.REJECTED);
      expect(result.passed).toBe(false);
      expect(result.trustDeficit).toBeGreaterThan(0);
    });

    it('should require verification for HIGH risk actions', async () => {
      // EXECUTE (50) * INTERNAL (1.0) + PARTIALLY_REVERSIBLE (20) = 70 → HIGH (60-79)
      // Score must be in [60, 80) to be HIGH (not CRITICAL which is >= 80)
      const result = await gate.verify({
        agentId: 'agent1',
        action: 'Execute system command',
        actionType: ActionType.EXECUTE,
        resourceScope: ['system'],
        dataSensitivity: DataSensitivity.INTERNAL,
        reversibility: Reversibility.PARTIALLY_REVERSIBLE,
      }, 65); // Above HIGH threshold of 60

      expect(result.status).toBe(GateStatus.PENDING_VERIFICATION);
      expect(result.requirements).toBeDefined();
      expect(result.requirements!.some(r => r.type === 'MULTI_PROVER_VERIFICATION')).toBe(true);
    });

    it('should require human approval for CRITICAL actions', async () => {
      const result = await gate.verify({
        agentId: 'agent1',
        action: 'Transfer funds',
        actionType: ActionType.TRANSFER,
        resourceScope: ['accounts'],
        dataSensitivity: DataSensitivity.RESTRICTED,
        reversibility: Reversibility.IRREVERSIBLE,
      }, 85); // Above CRITICAL threshold

      expect(result.status).toBe(GateStatus.PENDING_HUMAN_APPROVAL);
      expect(result.requirements!.some(r => r.type === 'HUMAN_APPROVAL')).toBe(true);
    });

    it('should calculate trust deficit', async () => {
      const result = await gate.verify({
        agentId: 'agent1',
        action: 'Write config',
        actionType: ActionType.WRITE,
        resourceScope: ['config'],
        dataSensitivity: DataSensitivity.INTERNAL,
        reversibility: Reversibility.REVERSIBLE,
      }, 25); // Trust = 25, Medium risk requires 40

      expect(result.trustDeficit).toBeGreaterThan(0);
    });
  });

  describe('Trust Provider Integration', () => {
    it('should use trust provider for score lookup', async () => {
      const trustProvider = createMapTrustProvider({
        'agent1': 75,
        'agent2': 25,
      });

      const gateWithProvider = createPreActionGate({}, trustProvider);

      // Agent1 with high trust can do more
      const result1 = await gateWithProvider.verify({
        agentId: 'agent1',
        action: 'Execute command',
        actionType: ActionType.EXECUTE,
        resourceScope: ['system'],
        dataSensitivity: DataSensitivity.INTERNAL,
        reversibility: Reversibility.REVERSIBLE,
      });

      // Agent2 with low trust gets rejected
      const result2 = await gateWithProvider.verify({
        agentId: 'agent2',
        action: 'Execute command',
        actionType: ActionType.EXECUTE,
        resourceScope: ['system'],
        dataSensitivity: DataSensitivity.INTERNAL,
        reversibility: Reversibility.REVERSIBLE,
      });

      expect(result1.currentTrust).toBe(75);
      expect(result2.currentTrust).toBe(25);
    });

    it('should default to zero trust for unknown agents (zero-start principle)', async () => {
      const trustProvider = createMapTrustProvider({
        'known-agent': 50,
      });

      const gateWithProvider = createPreActionGate({}, trustProvider);

      const result = await gateWithProvider.verify({
        agentId: 'unknown-agent',
        action: 'Read file',
        actionType: ActionType.READ,
        resourceScope: ['files'],
        dataSensitivity: DataSensitivity.PUBLIC,
        reversibility: Reversibility.REVERSIBLE,
      });

      expect(result.currentTrust).toBe(0);
    });
  });

  describe('canProceed Quick Check', () => {
    it('should return true when trust is sufficient', async () => {
      const canProceed = await gate.canProceed({
        agentId: 'agent1',
        action: 'Read file',
        actionType: ActionType.READ,
        resourceScope: ['files'],
        dataSensitivity: DataSensitivity.PUBLIC,
        reversibility: Reversibility.REVERSIBLE,
      }, 50);

      expect(canProceed).toBe(true);
    });

    it('should return false when trust is insufficient', async () => {
      const canProceed = await gate.canProceed({
        agentId: 'agent1',
        action: 'Delete file',
        actionType: ActionType.DELETE,
        resourceScope: ['files'],
        dataSensitivity: DataSensitivity.CONFIDENTIAL,
        reversibility: Reversibility.IRREVERSIBLE,
      }, 30);

      expect(canProceed).toBe(false);
    });
  });

  describe('getMaxRiskLevel', () => {
    it('should return correct max risk level for trust scores', () => {
      expect(gate.getMaxRiskLevel(0)).toBe(RiskLevel.READ);
      expect(gate.getMaxRiskLevel(19)).toBe(RiskLevel.READ);
      expect(gate.getMaxRiskLevel(20)).toBe(RiskLevel.LOW);
      expect(gate.getMaxRiskLevel(40)).toBe(RiskLevel.MEDIUM);
      expect(gate.getMaxRiskLevel(60)).toBe(RiskLevel.HIGH);
      expect(gate.getMaxRiskLevel(80)).toBe(RiskLevel.CRITICAL);
      expect(gate.getMaxRiskLevel(100)).toBe(RiskLevel.CRITICAL);
    });
  });

  describe('Event Listeners', () => {
    it('should emit events on verification', async () => {
      const listener = vi.fn();
      gate.addEventListener(listener);

      await gate.verify({
        agentId: 'agent1',
        action: 'Read file',
        actionType: ActionType.READ,
        resourceScope: ['files'],
        dataSensitivity: DataSensitivity.PUBLIC,
        reversibility: Reversibility.REVERSIBLE,
      }, 50);

      expect(listener).toHaveBeenCalled();
      const event = listener.mock.calls[0][0];
      expect(event.agentId).toBe('agent1');
      expect(event.type).toBe('GATE_APPROVED');
    });

    it('should emit GATE_REJECTED for rejected actions', async () => {
      const listener = vi.fn();
      gate.addEventListener(listener);

      await gate.verify({
        agentId: 'agent1',
        action: 'Delete database',
        actionType: ActionType.DELETE,
        resourceScope: ['database'],
        dataSensitivity: DataSensitivity.RESTRICTED,
        reversibility: Reversibility.IRREVERSIBLE,
      }, 10);

      const event = listener.mock.calls[0][0];
      expect(event.type).toBe('GATE_REJECTED');
      expect(event.passed).toBe(false);
    });

    it('should remove listeners', async () => {
      const listener = vi.fn();
      gate.addEventListener(listener);
      gate.removeEventListener(listener);

      await gate.verify({
        agentId: 'agent1',
        action: 'Read file',
        actionType: ActionType.READ,
        resourceScope: ['files'],
        dataSensitivity: DataSensitivity.PUBLIC,
        reversibility: Reversibility.REVERSIBLE,
      }, 50);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('Configuration', () => {
    it('should disable pending states when configured', async () => {
      const strictGate = createPreActionGate({
        allowPendingStates: false,
      });

      // WRITE (40) * INTERNAL (1.0) + REVERSIBLE (0) = 40 → MEDIUM
      // With 45 trust (above 40 threshold), should approve
      const result = await strictGate.verify({
        agentId: 'agent1',
        action: 'Write file',
        actionType: ActionType.WRITE,
        resourceScope: ['files'],
        dataSensitivity: DataSensitivity.INTERNAL,
        reversibility: Reversibility.REVERSIBLE,
      }, 45);

      // Should approve directly since we meet the threshold
      expect(result.status).toBe(GateStatus.APPROVED);
    });

    it('should include verification expiry', async () => {
      const result = await gate.verify({
        agentId: 'agent1',
        action: 'Read file',
        actionType: ActionType.READ,
        resourceScope: ['files'],
        dataSensitivity: DataSensitivity.PUBLIC,
        reversibility: Reversibility.REVERSIBLE,
      }, 50);

      expect(result.expiresAt.getTime()).toBeGreaterThan(result.verifiedAt.getTime());
    });

    it('should include verification ID', async () => {
      const result = await gate.verify({
        agentId: 'agent1',
        action: 'Read file',
        actionType: ActionType.READ,
        resourceScope: ['files'],
        dataSensitivity: DataSensitivity.PUBLIC,
        reversibility: Reversibility.REVERSIBLE,
      }, 50);

      expect(result.verificationId).toBeDefined();
      expect(result.verificationId.length).toBeGreaterThan(0);
    });
  });

  describe('Reasoning', () => {
    it('should provide human-readable reasoning', async () => {
      const result = await gate.verify({
        agentId: 'agent1',
        action: 'Delete file',
        actionType: ActionType.DELETE,
        resourceScope: ['files'],
        dataSensitivity: DataSensitivity.CONFIDENTIAL,
        reversibility: Reversibility.IRREVERSIBLE,
      }, 30);

      expect(result.reasoning.length).toBeGreaterThan(0);
      expect(result.reasoning.some(r => r.includes('Risk level'))).toBe(true);
      expect(result.reasoning.some(r => r.includes('trust'))).toBe(true);
    });
  });
});

describe('Trust Progression Path', () => {
  it('should demonstrate trust building from zero', async () => {
    const trustScores = new Map<string, number>([
      ['new-agent', 0],
    ]);
    const trustProvider = createMapTrustProvider(trustScores);
    const gate = createPreActionGate({}, trustProvider);

    // New agent at zero trust
    // Can only do READ operations
    const readResult = await gate.verify({
      agentId: 'new-agent',
      action: 'Read public data',
      actionType: ActionType.READ,
      resourceScope: ['public'],
      dataSensitivity: DataSensitivity.PUBLIC,
      reversibility: Reversibility.REVERSIBLE,
    });
    expect(readResult.passed).toBe(true);

    // Cannot do LOW risk operations yet
    const writeResult = await gate.verify({
      agentId: 'new-agent',
      action: 'Write file',
      actionType: ActionType.WRITE,
      resourceScope: ['files'],
      dataSensitivity: DataSensitivity.PUBLIC,
      reversibility: Reversibility.REVERSIBLE,
    });
    expect(writeResult.passed).toBe(false);
    expect(writeResult.trustDeficit).toBeGreaterThan(0);

    // After building trust to 25...
    trustScores.set('new-agent', 25);

    // Can now do LOW risk operations
    const writeResult2 = await gate.verify({
      agentId: 'new-agent',
      action: 'Write file',
      actionType: ActionType.WRITE,
      resourceScope: ['files'],
      dataSensitivity: DataSensitivity.PUBLIC,
      reversibility: Reversibility.REVERSIBLE,
    });
    expect(writeResult2.passed).toBe(true);
  });
});
