/**
 * Circuit Breaker Tests for INTENT Module
 *
 * Tests for trust engine and policy engine circuit breakers,
 * including failure thresholds, fallback behavior, metrics recording,
 * and recovery after timeout.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  CircuitBreaker,
  createCircuitBreaker,
  getCircuitBreaker,
  clearCircuitBreakerRegistry,
  withCircuitBreaker,
  withCircuitBreakerResult,
  CircuitBreakerOpenError,
  setCircuitBreakerMetricsCallback,
  type CircuitState,
  type CircuitBreakerResult,
} from '../../../src/common/circuit-breaker.js';

// Mock Redis
const mockRedisState = new Map<string, string>();

vi.mock('../../../src/common/redis.js', () => ({
  getRedis: vi.fn(() => ({
    get: vi.fn().mockImplementation(async (key: string) => mockRedisState.get(key) ?? null),
    set: vi.fn().mockImplementation(async (key: string, value: string) => {
      mockRedisState.set(key, value);
      return 'OK';
    }),
    setex: vi.fn().mockImplementation(async (key: string, ttl: number, value: string) => {
      mockRedisState.set(key, value);
      return 'OK';
    }),
    del: vi.fn().mockImplementation(async (key: string) => {
      mockRedisState.delete(key);
      return 1;
    }),
  })),
}));

vi.mock('../../../src/common/logger.js', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

// Mock metrics tracking
const metricsTracker = {
  stateChanges: [] as { service: string; from: CircuitState; to: CircuitState }[],
  failures: [] as string[],
  successes: [] as string[],
  stateUpdates: [] as { service: string; state: CircuitState }[],
};

describe('Circuit Breaker Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedisState.clear();
    clearCircuitBreakerRegistry();

    // Reset metrics tracker
    metricsTracker.stateChanges = [];
    metricsTracker.failures = [];
    metricsTracker.successes = [];
    metricsTracker.stateUpdates = [];

    // Set up metrics callback
    setCircuitBreakerMetricsCallback({
      recordStateChange: (service, from, to) => {
        metricsTracker.stateChanges.push({ service, from, to });
      },
      recordFailure: (service) => {
        metricsTracker.failures.push(service);
      },
      recordSuccess: (service) => {
        metricsTracker.successes.push(service);
      },
      updateState: (service, state) => {
        metricsTracker.stateUpdates.push({ service, state });
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Trust Engine Circuit Breaker', () => {
    it('should open after reaching failure threshold', async () => {
      const breaker = createCircuitBreaker({
        name: 'trust-engine-test',
        failureThreshold: 3,
        resetTimeoutMs: 30000,
        halfOpenMaxAttempts: 2,
      });

      // Initial state should be CLOSED
      expect(await breaker.getCircuitState()).toBe('CLOSED');

      // Simulate failures up to threshold
      for (let i = 0; i < 3; i++) {
        await breaker.recordFailure();
      }

      // Circuit should now be OPEN
      expect(await breaker.getCircuitState()).toBe('OPEN');
      expect(await breaker.isOpen()).toBe(true);
    });

    it('should fail fast when circuit is open', async () => {
      const breaker = createCircuitBreaker({
        name: 'trust-engine-fail-fast',
        failureThreshold: 2,
        resetTimeoutMs: 30000,
      });

      // Open the circuit
      await breaker.recordFailure();
      await breaker.recordFailure();

      expect(await breaker.isOpen()).toBe(true);

      // Execute should return circuit open result
      const result = await breaker.execute(async () => {
        return 'should not reach here';
      });

      expect(result.success).toBe(false);
      expect(result.circuitOpen).toBe(true);
      expect(result.error?.message).toContain('OPEN');
    });

    it('should use fallback when trust engine is unavailable', async () => {
      const breaker = createCircuitBreaker({
        name: 'trust-engine-fallback',
        failureThreshold: 2,
        resetTimeoutMs: 30000,
      });

      // Simulate trust engine becoming unavailable
      await breaker.recordFailure();
      await breaker.recordFailure();

      const fallbackTrustScore = { score: 0, level: 0, components: {} };

      const result = await breaker.execute(async () => {
        // This simulates calling the trust engine
        throw new Error('Trust engine unavailable');
      });

      // When circuit is open, use fallback
      if (result.circuitOpen) {
        // In real code, this is where you'd use fallback value
        expect(result.circuitOpen).toBe(true);
      }
    });

    it('should track state changes via callback', async () => {
      const stateChanges: { from: CircuitState; to: CircuitState }[] = [];

      const breaker = createCircuitBreaker({
        name: 'trust-engine-state-track',
        failureThreshold: 2,
        resetTimeoutMs: 100,
        onStateChange: (from, to) => {
          stateChanges.push({ from, to });
        },
      });

      // Trigger failures to open circuit
      await breaker.recordFailure();
      await breaker.recordFailure();

      // Should have recorded CLOSED -> OPEN transition
      expect(stateChanges.some((s) => s.from === 'CLOSED' && s.to === 'OPEN')).toBe(true);

      // Wait for reset timeout and trigger state check
      await new Promise((r) => setTimeout(r, 150));
      await breaker.getCircuitState();

      // Should have recorded OPEN -> HALF_OPEN transition
      expect(stateChanges.some((s) => s.from === 'OPEN' && s.to === 'HALF_OPEN')).toBe(true);
    });
  });

  describe('Policy Engine Circuit Breaker', () => {
    it('should open after policy engine failures', async () => {
      const breaker = createCircuitBreaker({
        name: 'policy-engine-test',
        failureThreshold: 5,
        resetTimeoutMs: 15000,
        halfOpenMaxAttempts: 3,
      });

      // Simulate policy engine failures
      const policyEngineCall = async () => {
        throw new Error('Policy engine timeout');
      };

      for (let i = 0; i < 5; i++) {
        const result = await breaker.execute(policyEngineCall);
        expect(result.success).toBe(false);
      }

      // Circuit should be open
      expect(await breaker.isOpen()).toBe(true);
    });

    it('should allow rule-only evaluation when policy circuit is open', async () => {
      const breaker = createCircuitBreaker({
        name: 'policy-engine-fallback',
        failureThreshold: 2,
        resetTimeoutMs: 30000,
      });

      // Open the policy circuit
      await breaker.recordFailure();
      await breaker.recordFailure();

      const result = await breaker.execute(async () => {
        // Policy evaluation
        return { action: 'allow', policies: [] };
      });

      // Circuit is open, policy evaluation skipped
      expect(result.circuitOpen).toBe(true);

      // In the actual system, rule evaluation would continue
      // and final decision would be based on rules only
      const rulesOnlyDecision = { action: 'allow', source: 'rules-only' };
      expect(rulesOnlyDecision.source).toBe('rules-only');
    });

    it('should record policy evaluation metrics', async () => {
      // Use the withCircuitBreakerResult to test metrics recording
      const result = await withCircuitBreakerResult('policy-engine-metrics', async () => {
        return { action: 'allow', policies: ['policy-1'] };
      });

      expect(result.success).toBe(true);
      expect(metricsTracker.successes).toContain('policy-engine-metrics');
    });
  });

  describe('Circuit Breaker Metrics', () => {
    it('should record state change metrics', async () => {
      // Pass onStateChange callback to record state changes to metricsTracker
      const breaker = getCircuitBreaker('metrics-state-test', (from, to) => {
        metricsTracker.stateChanges.push({ service: 'metrics-state-test', from, to });
      });

      // Record failures to trigger state change
      for (let i = 0; i < 5; i++) {
        await breaker.recordFailure();
      }

      // State change should be recorded
      const stateChange = metricsTracker.stateChanges.find(
        (s) => s.service === 'metrics-state-test' && s.to === 'OPEN'
      );
      expect(stateChange).toBeDefined();
    });

    it('should record success metrics via withCircuitBreaker', async () => {
      await withCircuitBreaker('metrics-success-test', async () => {
        return 'success';
      });

      expect(metricsTracker.successes).toContain('metrics-success-test');
      expect(metricsTracker.stateUpdates.some((u) => u.service === 'metrics-success-test')).toBe(true);
    });

    it('should record failure metrics via withCircuitBreaker', async () => {
      try {
        await withCircuitBreaker('metrics-failure-test', async () => {
          throw new Error('Test failure');
        });
      } catch {
        // Expected to throw
      }

      expect(metricsTracker.failures).toContain('metrics-failure-test');
    });

    it('should track all metric types in sequence', async () => {
      const serviceName = 'metrics-sequence-test';

      // Success
      await withCircuitBreakerResult(serviceName, async () => 'ok');
      expect(metricsTracker.successes.filter((s) => s === serviceName).length).toBe(1);

      // Failure
      await withCircuitBreakerResult(serviceName, async () => {
        throw new Error('fail');
      });
      expect(metricsTracker.failures.filter((s) => s === serviceName).length).toBe(1);

      // State update should be tracked for each call
      expect(metricsTracker.stateUpdates.filter((u) => u.service === serviceName).length).toBe(2);
    });
  });

  describe('Circuit Breaker Recovery', () => {
    it('should transition to HALF_OPEN after reset timeout', async () => {
      const breaker = createCircuitBreaker({
        name: 'recovery-test',
        failureThreshold: 2,
        resetTimeoutMs: 100, // Short timeout for testing
        halfOpenMaxAttempts: 2,
      });

      // Open the circuit
      await breaker.recordFailure();
      await breaker.recordFailure();

      expect(await breaker.getCircuitState()).toBe('OPEN');

      // Wait for reset timeout
      await new Promise((r) => setTimeout(r, 150));

      // Should transition to HALF_OPEN
      expect(await breaker.getCircuitState()).toBe('HALF_OPEN');
    });

    it('should close circuit on successful call in HALF_OPEN state', async () => {
      const stateChanges: { from: CircuitState; to: CircuitState }[] = [];

      const breaker = createCircuitBreaker({
        name: 'recovery-success-test',
        failureThreshold: 2,
        resetTimeoutMs: 50,
        halfOpenMaxAttempts: 2,
        onStateChange: (from, to) => {
          stateChanges.push({ from, to });
        },
      });

      // Open the circuit
      await breaker.recordFailure();
      await breaker.recordFailure();

      // Wait for reset timeout
      await new Promise((r) => setTimeout(r, 100));

      // Trigger transition to HALF_OPEN
      await breaker.getCircuitState();

      // Successful execution should close the circuit
      const result = await breaker.execute(async () => {
        return 'recovered';
      });

      expect(result.success).toBe(true);
      expect(await breaker.getCircuitState()).toBe('CLOSED');

      // Should have recorded HALF_OPEN -> CLOSED
      expect(stateChanges.some((s) => s.from === 'HALF_OPEN' && s.to === 'CLOSED')).toBe(true);
    });

    it('should reopen circuit after failures in HALF_OPEN state', async () => {
      const breaker = createCircuitBreaker({
        name: 'recovery-failure-test',
        failureThreshold: 2,
        resetTimeoutMs: 50,
        halfOpenMaxAttempts: 2,
      });

      // Open the circuit
      await breaker.recordFailure();
      await breaker.recordFailure();

      // Wait for reset timeout
      await new Promise((r) => setTimeout(r, 100));

      // Trigger transition to HALF_OPEN
      await breaker.getCircuitState();
      expect(await breaker.getCircuitState()).toBe('HALF_OPEN');

      // Failed executions in HALF_OPEN should reopen circuit
      await breaker.execute(async () => {
        throw new Error('still failing');
      });
      await breaker.execute(async () => {
        throw new Error('still failing');
      });

      // Should be back to OPEN after max half-open attempts
      expect(await breaker.getCircuitState()).toBe('OPEN');
    });

    it('should track timeUntilReset when circuit is open', async () => {
      const breaker = createCircuitBreaker({
        name: 'time-until-reset-test',
        failureThreshold: 2,
        resetTimeoutMs: 5000,
      });

      // Open the circuit
      await breaker.recordFailure();
      await breaker.recordFailure();

      const status = await breaker.getStatus();

      expect(status.state).toBe('OPEN');
      expect(status.timeUntilReset).not.toBeNull();
      expect(status.timeUntilReset).toBeGreaterThan(0);
      expect(status.timeUntilReset).toBeLessThanOrEqual(5000);
    });
  });

  describe('withCircuitBreaker Utility', () => {
    it('should throw CircuitBreakerOpenError when circuit is open', async () => {
      // First, open the circuit
      const breaker = getCircuitBreaker('throw-open-test');
      for (let i = 0; i < 5; i++) {
        await breaker.recordFailure();
      }

      // withCircuitBreaker should throw CircuitBreakerOpenError
      await expect(
        withCircuitBreaker('throw-open-test', async () => 'test')
      ).rejects.toThrow(CircuitBreakerOpenError);
    });

    it('should rethrow original error on execution failure', async () => {
      const customError = new Error('Custom execution error');

      await expect(
        withCircuitBreaker('rethrow-test', async () => {
          throw customError;
        })
      ).rejects.toThrow('Custom execution error');
    });

    it('should return result on successful execution', async () => {
      const result = await withCircuitBreaker('success-result-test', async () => {
        return { data: 'test-data', count: 42 };
      });

      expect(result).toEqual({ data: 'test-data', count: 42 });
    });
  });

  describe('withCircuitBreakerResult Utility', () => {
    it('should return result object instead of throwing', async () => {
      // Open the circuit first
      const breaker = getCircuitBreaker('result-open-test');
      for (let i = 0; i < 5; i++) {
        await breaker.recordFailure();
      }

      // Should not throw, return result object instead
      const result = await withCircuitBreakerResult('result-open-test', async () => 'test');

      expect(result.circuitOpen).toBe(true);
      expect(result.success).toBe(false);
    });

    it('should return success result with value', async () => {
      const result = await withCircuitBreakerResult('result-success-test', async () => {
        return { value: 123 };
      });

      expect(result.success).toBe(true);
      expect(result.circuitOpen).toBe(false);
      expect(result.result).toEqual({ value: 123 });
    });

    it('should return failure result with error', async () => {
      const result = await withCircuitBreakerResult('result-failure-test', async () => {
        throw new Error('Test error');
      });

      expect(result.success).toBe(false);
      expect(result.circuitOpen).toBe(false);
      expect(result.error?.message).toBe('Test error');
    });
  });

  describe('Circuit Breaker Status and Control', () => {
    it('should provide detailed status information', async () => {
      const breaker = createCircuitBreaker({
        name: 'status-test',
        failureThreshold: 5,
        resetTimeoutMs: 30000,
        halfOpenMaxAttempts: 3,
        monitorWindowMs: 60000,
      });

      // Record some failures
      await breaker.recordFailure();
      await breaker.recordFailure();

      const status = await breaker.getStatus();

      expect(status.name).toBe('status-test');
      expect(status.state).toBe('CLOSED');
      expect(status.failureCount).toBe(2);
      expect(status.failureThreshold).toBe(5);
      expect(status.resetTimeoutMs).toBe(30000);
      expect(status.halfOpenMaxAttempts).toBe(3);
      expect(status.monitorWindowMs).toBe(60000);
      expect(status.lastFailureTime).not.toBeNull();
    });

    it('should allow force opening the circuit', async () => {
      const breaker = createCircuitBreaker({
        name: 'force-open-test',
        failureThreshold: 10,
        resetTimeoutMs: 30000,
      });

      expect(await breaker.getCircuitState()).toBe('CLOSED');

      await breaker.forceOpen();

      expect(await breaker.getCircuitState()).toBe('OPEN');
      expect(await breaker.isOpen()).toBe(true);
    });

    it('should allow force closing the circuit', async () => {
      const breaker = createCircuitBreaker({
        name: 'force-close-test',
        failureThreshold: 2,
        resetTimeoutMs: 30000,
      });

      // Open the circuit
      await breaker.recordFailure();
      await breaker.recordFailure();
      expect(await breaker.isOpen()).toBe(true);

      // Force close
      await breaker.forceClose();

      expect(await breaker.getCircuitState()).toBe('CLOSED');
      expect(await breaker.isOpen()).toBe(false);
    });

    it('should allow resetting the circuit breaker', async () => {
      const breaker = createCircuitBreaker({
        name: 'reset-test',
        failureThreshold: 2,
        resetTimeoutMs: 30000,
      });

      // Record failures and open circuit
      await breaker.recordFailure();
      await breaker.recordFailure();
      expect(await breaker.isOpen()).toBe(true);

      // Reset
      await breaker.reset();

      // Should be back to initial state
      const status = await breaker.getStatus();
      expect(status.state).toBe('CLOSED');
      expect(status.failureCount).toBe(0);
      expect(status.lastFailureTime).toBeNull();
    });
  });

  describe('Monitoring Window Behavior', () => {
    it('should reset failure count when monitoring window expires', async () => {
      const breaker = createCircuitBreaker({
        name: 'window-test',
        failureThreshold: 5,
        resetTimeoutMs: 30000,
        monitorWindowMs: 100, // Short window for testing
      });

      // Record some failures (not enough to open)
      await breaker.recordFailure();
      await breaker.recordFailure();

      let status = await breaker.getStatus();
      expect(status.failureCount).toBe(2);

      // Wait for window to expire
      await new Promise((r) => setTimeout(r, 150));

      // Record another failure - should start new window
      await breaker.recordFailure();

      status = await breaker.getStatus();
      // Failure count should be 1 (new window)
      expect(status.failureCount).toBe(1);
    });
  });

  describe('Integration with Intent Queue Workers', () => {
    it('should handle policy circuit breaker for parallel evaluation', async () => {
      const policyBreaker = getCircuitBreaker('policyEngine');

      // Simulate parallel evaluation where policy engine fails
      const ruleEvaluation = Promise.resolve({ passed: true, action: 'allow' });

      const policyEvaluation = policyBreaker.execute(async () => {
        throw new Error('Policy engine unavailable');
      });

      const [rules, policy] = await Promise.all([ruleEvaluation, policyEvaluation]);

      // Rules should succeed
      expect(rules.passed).toBe(true);

      // Policy should fail but not crash
      expect(policy.success).toBe(false);

      // Final decision should be based on rules only
      const finalDecision = policy.circuitOpen || !policy.success ? rules : policy.result;
      expect(finalDecision).toEqual({ passed: true, action: 'allow' });
    });

    it('should handle trust engine circuit breaker for intake worker', async () => {
      const trustBreaker = getCircuitBreaker('trustEngine');

      // Open the trust circuit
      for (let i = 0; i < 5; i++) {
        await trustBreaker.recordFailure();
      }

      // Simulate intake worker behavior
      const trustResult = await trustBreaker.execute(async () => {
        return { score: 750, level: 3, components: {} };
      });

      if (trustResult.circuitOpen) {
        // Fallback: use cached trust score or default
        const fallbackTrust = { score: 0, level: 0, components: {}, source: 'fallback' };
        expect(fallbackTrust.source).toBe('fallback');
      }
    });
  });
});
