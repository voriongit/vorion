/**
 * Intent State Machine Tests
 */

import { describe, it, expect } from 'vitest';
import {
  isValidTransition,
  getTransitionMeta,
  validateTransition,
  getValidTransitions,
  getTransitionEvent,
  isTerminalState,
  isActiveState,
  canCancel,
  canReplay,
  getNextWorkflowStatus,
  assertValidTransition,
  StateMachineError,
  getStateDiagram,
  TERMINAL_STATES,
  ACTIVE_STATES,
  CANCELLABLE_STATES,
  REPLAYABLE_STATES,
} from '../../../src/intent/state-machine.js';
import type { IntentStatus } from '../../../src/common/types.js';

describe('Intent State Machine', () => {
  describe('isValidTransition', () => {
    it('should allow pending to evaluating', () => {
      expect(isValidTransition('pending', 'evaluating')).toBe(true);
    });

    it('should allow pending to cancelled', () => {
      expect(isValidTransition('pending', 'cancelled')).toBe(true);
    });

    it('should not allow pending to completed', () => {
      expect(isValidTransition('pending', 'completed')).toBe(false);
    });

    it('should allow evaluating to approved', () => {
      expect(isValidTransition('evaluating', 'approved')).toBe(true);
    });

    it('should allow evaluating to denied', () => {
      expect(isValidTransition('evaluating', 'denied')).toBe(true);
    });

    it('should allow evaluating to escalated', () => {
      expect(isValidTransition('evaluating', 'escalated')).toBe(true);
    });

    it('should allow escalated to approved', () => {
      expect(isValidTransition('escalated', 'approved')).toBe(true);
    });

    it('should allow escalated to denied', () => {
      expect(isValidTransition('escalated', 'denied')).toBe(true);
    });

    it('should allow approved to executing', () => {
      expect(isValidTransition('approved', 'executing')).toBe(true);
    });

    it('should allow executing to completed', () => {
      expect(isValidTransition('executing', 'completed')).toBe(true);
    });

    it('should allow executing to failed', () => {
      expect(isValidTransition('executing', 'failed')).toBe(true);
    });

    it('should allow failed to pending (replay)', () => {
      expect(isValidTransition('failed', 'pending')).toBe(true);
    });

    it('should allow denied to pending (replay)', () => {
      expect(isValidTransition('denied', 'pending')).toBe(true);
    });

    it('should not allow transitions from completed', () => {
      expect(isValidTransition('completed', 'pending')).toBe(false);
      expect(isValidTransition('completed', 'failed')).toBe(false);
    });

    it('should not allow transitions from cancelled', () => {
      expect(isValidTransition('cancelled', 'pending')).toBe(false);
      expect(isValidTransition('cancelled', 'evaluating')).toBe(false);
    });
  });

  describe('getTransitionMeta', () => {
    it('should return metadata for valid transition', () => {
      const meta = getTransitionMeta('pending', 'evaluating');
      expect(meta).toBeDefined();
      expect(meta?.description).toBe('Begin evaluation process');
      expect(meta?.event).toBe('intent.evaluation.started');
    });

    it('should indicate when reason is required', () => {
      const meta = getTransitionMeta('pending', 'cancelled');
      expect(meta?.requiresReason).toBe(true);
    });

    it('should indicate when permission is required', () => {
      const meta = getTransitionMeta('escalated', 'approved');
      expect(meta?.requiresPermission).toBe(true);
    });

    it('should return undefined for invalid transition', () => {
      const meta = getTransitionMeta('pending', 'completed');
      expect(meta).toBeUndefined();
    });
  });

  describe('validateTransition', () => {
    it('should validate successful transition', () => {
      const result = validateTransition('pending', 'evaluating');
      expect(result.valid).toBe(true);
      expect(result.meta).toBeDefined();
    });

    it('should reject transition from terminal state', () => {
      const result = validateTransition('completed', 'pending');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('TERMINAL_STATE');
    });

    it('should reject invalid transition', () => {
      const result = validateTransition('pending', 'completed');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_TRANSITION');
      expect(result.error).toContain('Valid transitions');
    });

    it('should require reason when needed', () => {
      const result = validateTransition('pending', 'cancelled', { hasReason: false });
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('REQUIRES_REASON');
    });

    it('should accept transition with required reason', () => {
      const result = validateTransition('pending', 'cancelled', { hasReason: true });
      expect(result.valid).toBe(true);
    });

    it('should require permission when needed', () => {
      const result = validateTransition('escalated', 'approved', { hasPermission: false });
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('REQUIRES_PERMISSION');
    });

    it('should accept transition with required permission', () => {
      const result = validateTransition('escalated', 'approved', { hasPermission: true });
      expect(result.valid).toBe(true);
    });
  });

  describe('getValidTransitions', () => {
    it('should return valid transitions for pending', () => {
      const transitions = getValidTransitions('pending');
      expect(transitions).toContain('evaluating');
      expect(transitions).toContain('cancelled');
      expect(transitions).not.toContain('completed');
    });

    it('should return valid transitions for evaluating', () => {
      const transitions = getValidTransitions('evaluating');
      expect(transitions).toContain('approved');
      expect(transitions).toContain('denied');
      expect(transitions).toContain('escalated');
      expect(transitions).toContain('failed');
      expect(transitions).toContain('cancelled');
    });

    it('should return empty array for terminal states', () => {
      expect(getValidTransitions('completed')).toEqual([]);
      expect(getValidTransitions('cancelled')).toEqual([]);
    });
  });

  describe('getTransitionEvent', () => {
    it('should return event type for transition', () => {
      expect(getTransitionEvent('pending', 'evaluating')).toBe('intent.evaluation.started');
      expect(getTransitionEvent('evaluating', 'approved')).toBe('intent.approved');
      expect(getTransitionEvent('executing', 'completed')).toBe('intent.completed');
    });

    it('should return undefined for invalid transition', () => {
      expect(getTransitionEvent('pending', 'completed')).toBeUndefined();
    });
  });

  describe('State Helpers', () => {
    describe('isTerminalState', () => {
      it('should identify terminal states', () => {
        expect(isTerminalState('completed')).toBe(true);
        expect(isTerminalState('cancelled')).toBe(true);
        expect(isTerminalState('pending')).toBe(false);
        expect(isTerminalState('executing')).toBe(false);
      });
    });

    describe('isActiveState', () => {
      it('should identify active states', () => {
        expect(isActiveState('pending')).toBe(true);
        expect(isActiveState('evaluating')).toBe(true);
        expect(isActiveState('escalated')).toBe(true);
        expect(isActiveState('approved')).toBe(true);
        expect(isActiveState('executing')).toBe(true);
        expect(isActiveState('completed')).toBe(false);
        expect(isActiveState('cancelled')).toBe(false);
        expect(isActiveState('failed')).toBe(false);
      });
    });

    describe('canCancel', () => {
      it('should identify cancellable states', () => {
        expect(canCancel('pending')).toBe(true);
        expect(canCancel('evaluating')).toBe(true);
        expect(canCancel('escalated')).toBe(true);
        expect(canCancel('approved')).toBe(true);
        expect(canCancel('executing')).toBe(false);
        expect(canCancel('completed')).toBe(false);
        expect(canCancel('failed')).toBe(false);
      });
    });

    describe('canReplay', () => {
      it('should identify replayable states', () => {
        expect(canReplay('denied')).toBe(true);
        expect(canReplay('failed')).toBe(true);
        expect(canReplay('pending')).toBe(false);
        expect(canReplay('completed')).toBe(false);
        expect(canReplay('cancelled')).toBe(false);
      });
    });
  });

  describe('getNextWorkflowStatus', () => {
    it('should return expected next status for happy path', () => {
      expect(getNextWorkflowStatus('pending')).toBe('evaluating');
      expect(getNextWorkflowStatus('evaluating')).toBe('approved');
      expect(getNextWorkflowStatus('approved')).toBe('executing');
      expect(getNextWorkflowStatus('executing')).toBe('completed');
    });

    it('should return null for states requiring decisions', () => {
      expect(getNextWorkflowStatus('escalated')).toBeNull();
      expect(getNextWorkflowStatus('denied')).toBeNull();
      expect(getNextWorkflowStatus('failed')).toBeNull();
    });

    it('should return null for terminal states', () => {
      expect(getNextWorkflowStatus('completed')).toBeNull();
      expect(getNextWorkflowStatus('cancelled')).toBeNull();
    });
  });

  describe('assertValidTransition', () => {
    it('should not throw for valid transition', () => {
      expect(() => {
        assertValidTransition('pending', 'evaluating');
      }).not.toThrow();
    });

    it('should throw StateMachineError for invalid transition', () => {
      expect(() => {
        assertValidTransition('pending', 'completed');
      }).toThrow(StateMachineError);
    });

    it('should include details in error', () => {
      try {
        assertValidTransition('pending', 'completed');
      } catch (error) {
        expect(error).toBeInstanceOf(StateMachineError);
        const smError = error as StateMachineError;
        expect(smError.fromStatus).toBe('pending');
        expect(smError.toStatus).toBe('completed');
        expect(smError.errorCode).toBe('INVALID_TRANSITION');
      }
    });
  });

  describe('State Sets', () => {
    it('should have correct terminal states', () => {
      expect(TERMINAL_STATES.has('completed')).toBe(true);
      expect(TERMINAL_STATES.has('cancelled')).toBe(true);
      expect(TERMINAL_STATES.size).toBe(2);
    });

    it('should have correct active states', () => {
      expect(ACTIVE_STATES.has('pending')).toBe(true);
      expect(ACTIVE_STATES.has('evaluating')).toBe(true);
      expect(ACTIVE_STATES.has('escalated')).toBe(true);
      expect(ACTIVE_STATES.has('approved')).toBe(true);
      expect(ACTIVE_STATES.has('executing')).toBe(true);
      expect(ACTIVE_STATES.size).toBe(5);
    });

    it('should have correct cancellable states', () => {
      expect(CANCELLABLE_STATES.has('pending')).toBe(true);
      expect(CANCELLABLE_STATES.has('evaluating')).toBe(true);
      expect(CANCELLABLE_STATES.has('escalated')).toBe(true);
      expect(CANCELLABLE_STATES.has('approved')).toBe(true);
      expect(CANCELLABLE_STATES.size).toBe(4);
    });

    it('should have correct replayable states', () => {
      expect(REPLAYABLE_STATES.has('denied')).toBe(true);
      expect(REPLAYABLE_STATES.has('failed')).toBe(true);
      expect(REPLAYABLE_STATES.size).toBe(2);
    });
  });

  describe('getStateDiagram', () => {
    it('should generate valid mermaid diagram', () => {
      const diagram = getStateDiagram();
      expect(diagram).toContain('stateDiagram-v2');
      expect(diagram).toContain('pending --> evaluating');
      expect(diagram).toContain('evaluating --> approved');
      expect(diagram).toContain('evaluating --> denied');
      expect(diagram).toContain('executing --> completed');
      expect(diagram).toContain('[*] --> pending');
      expect(diagram).toContain('completed --> [*]');
    });
  });

  describe('Full Workflow Paths', () => {
    it('should allow happy path: pending → evaluating → approved → executing → completed', () => {
      const path: IntentStatus[] = ['pending', 'evaluating', 'approved', 'executing', 'completed'];

      for (let i = 0; i < path.length - 1; i++) {
        const from = path[i]!;
        const to = path[i + 1]!;
        expect(isValidTransition(from, to)).toBe(true);
      }
    });

    it('should allow denial path: pending → evaluating → denied', () => {
      expect(isValidTransition('pending', 'evaluating')).toBe(true);
      expect(isValidTransition('evaluating', 'denied')).toBe(true);
    });

    it('should allow escalation path: pending → evaluating → escalated → approved → executing → completed', () => {
      const path: IntentStatus[] = ['pending', 'evaluating', 'escalated', 'approved', 'executing', 'completed'];

      for (let i = 0; i < path.length - 1; i++) {
        const from = path[i]!;
        const to = path[i + 1]!;
        expect(isValidTransition(from, to)).toBe(true);
      }
    });

    it('should allow failure and replay path: pending → evaluating → failed → pending', () => {
      expect(isValidTransition('pending', 'evaluating')).toBe(true);
      expect(isValidTransition('evaluating', 'failed')).toBe(true);
      expect(isValidTransition('failed', 'pending')).toBe(true);
    });

    it('should allow cancellation at various points', () => {
      expect(isValidTransition('pending', 'cancelled')).toBe(true);
      expect(isValidTransition('evaluating', 'cancelled')).toBe(true);
      expect(isValidTransition('escalated', 'cancelled')).toBe(true);
      expect(isValidTransition('approved', 'cancelled')).toBe(true);
    });
  });
});
