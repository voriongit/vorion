/**
 * Tests for TrustDynamicsEngine - ATSF v2.0 Asymmetric Trust Updates
 *
 * Key principles tested:
 * - "Trust is hard to gain, easy to lose" (10:1 asymmetry)
 * - Logarithmic gain (slow approach to ceiling)
 * - Exponential loss (proportional to current trust)
 * - 7-day cooldown after any trust drop
 * - Oscillation detection with circuit breaker
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TrustDynamicsEngine,
  createTrustDynamicsEngine,
  type TrustUpdateOptions,
} from '../../src/trust/trust-dynamics.js';
import { DEFAULT_TRUST_DYNAMICS } from '@orion/contracts';

describe('TrustDynamicsEngine', () => {
  let engine: TrustDynamicsEngine;

  beforeEach(() => {
    engine = createTrustDynamicsEngine();
  });

  describe('Configuration', () => {
    it('should use default configuration', () => {
      const config = engine.getConfig();
      expect(config.gainRate).toBe(0.01);
      expect(config.lossRate).toBe(0.10);
      expect(config.cooldownHours).toBe(168); // 7 days
      expect(config.oscillationThreshold).toBe(3);
      expect(config.oscillationWindowHours).toBe(24);
      expect(config.reversalPenaltyMultiplier).toBe(2.0);
      expect(config.circuitBreakerThreshold).toBe(10);
    });

    it('should allow custom configuration', () => {
      const customEngine = createTrustDynamicsEngine({
        gainRate: 0.02,
        lossRate: 0.15,
      });
      const config = customEngine.getConfig();
      expect(config.gainRate).toBe(0.02);
      expect(config.lossRate).toBe(0.15);
    });

    it('should calculate 10:1 asymmetry ratio', () => {
      expect(engine.getAsymmetryRatio()).toBe(10);
    });
  });

  describe('Asymmetric Gain (Logarithmic)', () => {
    it('should gain trust slowly with logarithmic formula', () => {
      const result = engine.updateTrust('agent1', {
        currentScore: 50,
        success: true,
        ceiling: 90,
      });

      // delta = 0.01 * log(1 + (90 - 50)) = 0.01 * log(41) ≈ 0.037
      expect(result.delta).toBeGreaterThan(0);
      expect(result.delta).toBeLessThan(1);
      expect(result.newScore).toBeGreaterThan(50);
    });

    it('should have diminishing returns as trust approaches ceiling', () => {
      const lowResult = engine.updateTrust('agent1', {
        currentScore: 30,
        success: true,
        ceiling: 90,
      });

      const highResult = engine.updateTrust('agent2', {
        currentScore: 80,
        success: true,
        ceiling: 90,
      });

      // Higher starting point = less room = smaller gain
      expect(lowResult.delta).toBeGreaterThan(highResult.delta);
    });

    it('should not gain past ceiling', () => {
      const result = engine.updateTrust('agent1', {
        currentScore: 89,
        success: true,
        ceiling: 90,
      });

      expect(result.newScore).toBeLessThanOrEqual(90);
    });

    it('should have zero gain when at ceiling', () => {
      const result = engine.updateTrust('agent1', {
        currentScore: 90,
        success: true,
        ceiling: 90,
      });

      expect(result.delta).toBe(0);
      expect(result.newScore).toBe(90);
    });
  });

  describe('Asymmetric Loss (Exponential)', () => {
    it('should lose trust quickly with exponential formula', () => {
      const result = engine.updateTrust('agent1', {
        currentScore: 50,
        success: false,
        ceiling: 90,
      });

      // delta = -0.10 * 50 = -5
      expect(result.delta).toBe(-5);
      expect(result.newScore).toBe(45);
    });

    it('should lose proportionally more at higher trust levels', () => {
      const highResult = engine.updateTrust('agent1', {
        currentScore: 80,
        success: false,
        ceiling: 90,
      });

      const lowResult = engine.updateTrust('agent2', {
        currentScore: 40,
        success: false,
        ceiling: 90,
      });

      // Higher trust = bigger absolute loss
      expect(Math.abs(highResult.delta)).toBeGreaterThan(Math.abs(lowResult.delta));
      expect(highResult.delta).toBe(-8); // -0.10 * 80
      expect(lowResult.delta).toBe(-4);  // -0.10 * 40
    });

    it('should not go below zero', () => {
      const result = engine.updateTrust('agent1', {
        currentScore: 5,
        success: false,
        ceiling: 90,
      });

      expect(result.newScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Outcome Reversals', () => {
    it('should apply 2x penalty for reversals', () => {
      const normalResult = engine.updateTrust('agent1', {
        currentScore: 50,
        success: false,
        ceiling: 90,
        isReversal: false,
      });

      const reversalResult = engine.updateTrust('agent2', {
        currentScore: 50,
        success: false,
        ceiling: 90,
        isReversal: true,
      });

      // Reversal should have 2x the loss
      expect(Math.abs(reversalResult.delta)).toBe(Math.abs(normalResult.delta) * 2);
      expect(normalResult.delta).toBe(-5);   // -0.10 * 50
      expect(reversalResult.delta).toBe(-10); // -0.20 * 50
    });
  });

  describe('Cooldown Periods', () => {
    it('should enter cooldown after trust loss', () => {
      const now = new Date('2024-01-01T12:00:00Z');

      engine.updateTrust('agent1', {
        currentScore: 50,
        success: false,
        ceiling: 90,
        now,
      });

      expect(engine.isInCooldown('agent1', now)).toBe(true);
    });

    it('should block trust gain during cooldown', () => {
      const now = new Date('2024-01-01T12:00:00Z');

      // First, cause a loss to trigger cooldown
      engine.updateTrust('agent1', {
        currentScore: 50,
        success: false,
        ceiling: 90,
        now,
      });

      // Try to gain trust immediately after
      const result = engine.updateTrust('agent1', {
        currentScore: 45,
        success: true,
        ceiling: 90,
        now,
      });

      expect(result.blockedByCooldown).toBe(true);
      expect(result.delta).toBe(0);
      expect(result.newScore).toBe(45);
    });

    it('should allow trust gain after cooldown expires', () => {
      const start = new Date('2024-01-01T12:00:00Z');
      const afterCooldown = new Date('2024-01-08T13:00:00Z'); // 7 days + 1 hour later

      // Trigger cooldown
      engine.updateTrust('agent1', {
        currentScore: 50,
        success: false,
        ceiling: 90,
        now: start,
      });

      // Try gain after cooldown
      const result = engine.updateTrust('agent1', {
        currentScore: 45,
        success: true,
        ceiling: 90,
        now: afterCooldown,
      });

      expect(result.blockedByCooldown).toBe(false);
      expect(result.delta).toBeGreaterThan(0);
    });

    it('should report cooldown remaining time', () => {
      const start = new Date('2024-01-01T12:00:00Z');
      const dayLater = new Date('2024-01-02T12:00:00Z');

      engine.updateTrust('agent1', {
        currentScore: 50,
        success: false,
        ceiling: 90,
        now: start,
      });

      const remaining = engine.getCooldownRemainingHours('agent1', dayLater);
      expect(remaining).toBeCloseTo(144, 0); // 168 - 24 = 144 hours
    });

    it('should return cooldown info', () => {
      const now = new Date('2024-01-01T12:00:00Z');

      engine.updateTrust('agent1', {
        currentScore: 50,
        success: false,
        ceiling: 90,
        isReversal: true,
        now,
      });

      const info = engine.getCooldownInfo('agent1', now);
      expect(info.inCooldown).toBe(true);
      expect(info.reason).toBe('outcome_reversal');
    });
  });

  describe('Oscillation Detection', () => {
    it('should track direction changes', () => {
      const engine = createTrustDynamicsEngine({
        oscillationThreshold: 3,
        oscillationWindowHours: 24,
      });

      const baseTime = new Date('2024-01-01T12:00:00Z');

      // Direction change 1: gain → loss
      engine.updateTrust('agent1', {
        currentScore: 50,
        success: true,
        ceiling: 90,
        now: baseTime,
      });
      engine.updateTrust('agent1', {
        currentScore: 50.5,
        success: false,
        ceiling: 90,
        now: new Date(baseTime.getTime() + 1000),
      });

      // Direction change 2: loss → gain (blocked by cooldown, but tracked)
      engine.updateTrust('agent1', {
        currentScore: 45,
        success: true,
        ceiling: 90,
        now: new Date(baseTime.getTime() + 2000),
      });

      // Direction change 3: gain → loss
      engine.updateTrust('agent1', {
        currentScore: 45,
        success: false,
        ceiling: 90,
        now: new Date(baseTime.getTime() + 3000),
      });

      // Circuit breaker should be tripped
      expect(engine.isCircuitBreakerTripped('agent1')).toBe(true);
    });

    it('should trip circuit breaker on oscillation', () => {
      const engine = createTrustDynamicsEngine({
        oscillationThreshold: 3,
        oscillationWindowHours: 24,
      });

      const now = new Date('2024-01-01T12:00:00Z');

      // Create rapid oscillations
      let score = 50;
      for (let i = 0; i < 5; i++) {
        const result = engine.updateTrust('agent1', {
          currentScore: score,
          success: i % 2 === 0,
          ceiling: 90,
          now: new Date(now.getTime() + i * 1000),
        });
        score = result.newScore;

        if (result.circuitBreakerTripped) {
          expect(result.circuitBreakerReason).toBe('oscillation_detected');
          break;
        }
      }

      expect(engine.isCircuitBreakerTripped('agent1')).toBe(true);
    });
  });

  describe('Circuit Breaker', () => {
    it('should trip when trust falls below threshold', () => {
      const result = engine.updateTrust('agent1', {
        currentScore: 15,
        success: false,
        ceiling: 90,
      });

      // After loss: 15 - (0.10 * 15) = 13.5 → still above 10
      // Need to go lower
      const result2 = engine.updateTrust('agent1', {
        currentScore: 8,
        success: false,
        ceiling: 90,
      });

      expect(result2.circuitBreakerTripped).toBe(true);
      expect(result2.circuitBreakerReason).toBe('trust_below_threshold');
    });

    it('should block all updates when circuit breaker is tripped', () => {
      // Trip the circuit breaker
      engine.updateTrust('agent1', {
        currentScore: 5,
        success: false,
        ceiling: 90,
      });

      // Try to gain trust
      const result = engine.updateTrust('agent1', {
        currentScore: 20,
        success: true,
        ceiling: 90,
      });

      expect(result.circuitBreakerTripped).toBe(true);
      expect(result.delta).toBe(0);
    });

    it('should require admin override for immediate circuit breaker reset', () => {
      engine.updateTrust('agent1', {
        currentScore: 5,
        success: false,
        ceiling: 90,
      });

      // Without admin override, the reset behavior depends on internal time tracking
      // With admin override, it should always succeed
      const resetWithOverride = engine.resetCircuitBreaker('agent1', true);
      expect(resetWithOverride).toBe(true);
      expect(engine.isCircuitBreakerTripped('agent1')).toBe(false);
    });

    it('should return false for non-existent agent reset', () => {
      const reset = engine.resetCircuitBreaker('nonexistent', false);
      expect(reset).toBe(false);
    });
  });

  describe('Decay', () => {
    it('should apply time-based decay', () => {
      const score = 80;
      const days = 7;

      const decayed = engine.applyDecay(score, days);

      // decay = 80 * (1 - 0.01)^7 ≈ 80 * 0.932 ≈ 74.6
      expect(decayed).toBeLessThan(score);
      expect(decayed).toBeCloseTo(80 * Math.pow(0.99, 7), 2);
    });

    it('should have no decay for zero days', () => {
      const score = 80;
      const decayed = engine.applyDecay(score, 0);
      expect(decayed).toBe(score);
    });
  });

  describe('State Management', () => {
    it('should create initial state for new agents', () => {
      const state = engine.getState('new-agent');
      expect(state.agentId).toBe('new-agent');
      expect(state.cooldown.inCooldown).toBe(false);
      expect(state.circuitBreakerTripped).toBe(false);
      expect(state.lastDirection).toBe('none');
    });

    it('should maintain separate state per agent', () => {
      engine.updateTrust('agent1', {
        currentScore: 50,
        success: false,
        ceiling: 90,
      });

      expect(engine.isInCooldown('agent1')).toBe(true);
      expect(engine.isInCooldown('agent2')).toBe(false);
    });

    it('should clear all state', () => {
      engine.updateTrust('agent1', {
        currentScore: 50,
        success: false,
        ceiling: 90,
      });

      engine.clearAllState();

      expect(engine.isInCooldown('agent1')).toBe(false);
    });
  });

  describe('Update Result', () => {
    it('should return complete result object', () => {
      const result = engine.updateTrust('agent1', {
        currentScore: 50,
        success: true,
        ceiling: 90,
      });

      expect(result).toHaveProperty('newScore');
      expect(result).toHaveProperty('delta');
      expect(result).toHaveProperty('blockedByCooldown');
      expect(result).toHaveProperty('circuitBreakerTripped');
      expect(result).toHaveProperty('oscillationDetected');
      expect(result).toHaveProperty('state');
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero current score', () => {
      const result = engine.updateTrust('agent1', {
        currentScore: 0,
        success: false,
        ceiling: 90,
      });

      // Note: -0.10 * 0 = -0 in JavaScript, so we check equality more flexibly
      expect(result.delta).toBeCloseTo(0, 10); // -0.10 * 0 ≈ 0
      expect(result.newScore).toBe(0);
    });

    it('should handle maximum score', () => {
      const result = engine.updateTrust('agent1', {
        currentScore: 100,
        success: true,
        ceiling: 100,
      });

      expect(result.delta).toBe(0);
      expect(result.newScore).toBe(100);
    });

    it('should handle non-existent agent for circuit breaker check', () => {
      expect(engine.isCircuitBreakerTripped('nonexistent')).toBe(false);
    });

    it('should handle non-existent agent for cooldown check', () => {
      expect(engine.isInCooldown('nonexistent')).toBe(false);
      expect(engine.getCooldownRemainingHours('nonexistent')).toBe(0);
    });
  });
});
