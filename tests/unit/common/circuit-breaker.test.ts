/**
 * Circuit Breaker Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  CircuitBreaker,
  createCircuitBreaker,
  getCircuitBreaker,
  setCircuitBreakerConfigOverrides,
  getAllCircuitBreakerStatuses,
  resetCircuitBreaker,
  clearCircuitBreakerRegistry,
  CIRCUIT_BREAKER_CONFIGS,
  type CircuitState,
  type CircuitBreakerConfig,
} from '../../../src/common/circuit-breaker.js';

// Mock Redis
const mockRedis = {
  get: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  duplicate: vi.fn(() => mockRedis),
  on: vi.fn(),
};

// Mock getRedis to return our mock
vi.mock('../../../src/common/redis.js', () => ({
  getRedis: () => mockRedis,
}));

describe('CircuitBreaker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default Redis returns null (no existing state)
    mockRedis.get.mockResolvedValue(null);
    mockRedis.setex.mockResolvedValue('OK');
    mockRedis.del.mockResolvedValue(1);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should create a circuit breaker with default options', () => {
      const breaker = new CircuitBreaker({ name: 'test-breaker' });
      expect(breaker).toBeInstanceOf(CircuitBreaker);
    });

    it('should create a circuit breaker with custom options', () => {
      const breaker = new CircuitBreaker({
        name: 'custom-breaker',
        failureThreshold: 10,
        resetTimeoutMs: 60000,
      });
      expect(breaker).toBeInstanceOf(CircuitBreaker);
    });

    it('should accept a custom Redis client', () => {
      const customRedis = { ...mockRedis };
      const breaker = new CircuitBreaker({
        name: 'redis-breaker',
        redis: customRedis as any,
      });
      expect(breaker).toBeInstanceOf(CircuitBreaker);
    });
  });

  describe('getCircuitState', () => {
    it('should return CLOSED when no state exists', async () => {
      mockRedis.get.mockResolvedValue(null);

      const breaker = new CircuitBreaker({ name: 'test' });
      const state = await breaker.getCircuitState();

      expect(state).toBe('CLOSED');
    });

    it('should return stored state from Redis', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({
        state: 'OPEN',
        failureCount: 5,
        lastFailureTime: Date.now(),
        openedAt: Date.now(),
      }));

      const breaker = new CircuitBreaker({ name: 'test' });
      const state = await breaker.getCircuitState();

      expect(state).toBe('OPEN');
    });

    it('should transition from OPEN to HALF_OPEN after reset timeout', async () => {
      const openedAt = Date.now() - 35000; // 35 seconds ago
      mockRedis.get.mockResolvedValue(JSON.stringify({
        state: 'OPEN',
        failureCount: 5,
        lastFailureTime: openedAt,
        openedAt: openedAt,
      }));

      const breaker = new CircuitBreaker({
        name: 'test',
        resetTimeoutMs: 30000, // 30 seconds
      });
      const state = await breaker.getCircuitState();

      expect(state).toBe('HALF_OPEN');
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'vorion:circuit-breaker:test',
        86400,
        expect.stringContaining('"state":"HALF_OPEN"')
      );
    });

    it('should remain OPEN if reset timeout has not passed', async () => {
      const openedAt = Date.now() - 10000; // 10 seconds ago
      mockRedis.get.mockResolvedValue(JSON.stringify({
        state: 'OPEN',
        failureCount: 5,
        lastFailureTime: openedAt,
        openedAt: openedAt,
      }));

      const breaker = new CircuitBreaker({
        name: 'test',
        resetTimeoutMs: 30000, // 30 seconds
      });
      const state = await breaker.getCircuitState();

      expect(state).toBe('OPEN');
    });
  });

  describe('isOpen', () => {
    it('should return false when circuit is CLOSED', async () => {
      mockRedis.get.mockResolvedValue(null);

      const breaker = new CircuitBreaker({ name: 'test' });
      const isOpen = await breaker.isOpen();

      expect(isOpen).toBe(false);
    });

    it('should return true when circuit is OPEN', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({
        state: 'OPEN',
        failureCount: 5,
        lastFailureTime: Date.now(),
        openedAt: Date.now(),
      }));

      const breaker = new CircuitBreaker({ name: 'test' });
      const isOpen = await breaker.isOpen();

      expect(isOpen).toBe(true);
    });

    it('should return false when circuit is HALF_OPEN', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({
        state: 'HALF_OPEN',
        failureCount: 5,
        lastFailureTime: Date.now() - 35000,
        openedAt: Date.now() - 35000,
      }));

      const breaker = new CircuitBreaker({ name: 'test' });
      const isOpen = await breaker.isOpen();

      expect(isOpen).toBe(false);
    });
  });

  describe('recordSuccess', () => {
    it('should close the circuit when in HALF_OPEN state', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({
        state: 'HALF_OPEN',
        failureCount: 5,
        lastFailureTime: Date.now(),
        openedAt: Date.now() - 35000,
      }));

      const breaker = new CircuitBreaker({ name: 'test' });
      await breaker.recordSuccess();

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'vorion:circuit-breaker:test',
        86400,
        expect.stringContaining('"state":"CLOSED"')
      );
    });

    it('should reset failure count when in CLOSED state with failures', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({
        state: 'CLOSED',
        failureCount: 3,
        lastFailureTime: Date.now(),
        openedAt: null,
      }));

      const breaker = new CircuitBreaker({ name: 'test' });
      await breaker.recordSuccess();

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'vorion:circuit-breaker:test',
        86400,
        expect.stringContaining('"failureCount":0')
      );
    });
  });

  describe('recordFailure', () => {
    it('should increment failure count in CLOSED state', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({
        state: 'CLOSED',
        failureCount: 2,
        lastFailureTime: null,
        openedAt: null,
      }));

      const breaker = new CircuitBreaker({ name: 'test', failureThreshold: 5 });
      await breaker.recordFailure();

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'vorion:circuit-breaker:test',
        86400,
        expect.stringContaining('"failureCount":3')
      );
    });

    it('should open circuit when failure threshold is reached', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({
        state: 'CLOSED',
        failureCount: 4, // Will become 5 after this failure
        lastFailureTime: null,
        openedAt: null,
      }));

      const breaker = new CircuitBreaker({ name: 'test', failureThreshold: 5 });
      await breaker.recordFailure();

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'vorion:circuit-breaker:test',
        86400,
        expect.stringContaining('"state":"OPEN"')
      );
    });

    it('should reopen circuit when max half-open attempts exceeded', async () => {
      // With default halfOpenMaxAttempts of 3, we need to be at 2 attempts
      // so the next failure (3rd) triggers reopening
      mockRedis.get.mockResolvedValue(JSON.stringify({
        state: 'HALF_OPEN',
        failureCount: 5,
        lastFailureTime: Date.now() - 35000,
        openedAt: Date.now() - 35000,
        halfOpenAttempts: 2, // At 2, next failure makes it 3 which equals default max
        windowStartTime: null,
      }));

      const breaker = new CircuitBreaker({ name: 'test' }); // Default halfOpenMaxAttempts is 3
      await breaker.recordFailure();

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'vorion:circuit-breaker:test',
        86400,
        expect.stringContaining('"state":"OPEN"')
      );
    });

    it('should increment half-open attempts on failure without reopening if under max', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({
        state: 'HALF_OPEN',
        failureCount: 5,
        lastFailureTime: Date.now() - 35000,
        openedAt: Date.now() - 35000,
        halfOpenAttempts: 0,
        windowStartTime: null,
      }));

      const breaker = new CircuitBreaker({ name: 'test' }); // Default halfOpenMaxAttempts is 3
      await breaker.recordFailure();

      // Should stay in HALF_OPEN state with incremented attempts
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'vorion:circuit-breaker:test',
        86400,
        expect.stringContaining('"state":"HALF_OPEN"')
      );
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'vorion:circuit-breaker:test',
        86400,
        expect.stringContaining('"halfOpenAttempts":1')
      );
    });
  });

  describe('execute', () => {
    it('should execute function when circuit is CLOSED', async () => {
      mockRedis.get.mockResolvedValue(null);

      const breaker = new CircuitBreaker({ name: 'test' });
      const fn = vi.fn().mockResolvedValue('success');

      const result = await breaker.execute(fn);

      expect(fn).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.circuitOpen).toBe(false);
    });

    it('should fail fast when circuit is OPEN', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({
        state: 'OPEN',
        failureCount: 5,
        lastFailureTime: Date.now(),
        openedAt: Date.now(),
      }));

      const breaker = new CircuitBreaker({ name: 'test' });
      const fn = vi.fn().mockResolvedValue('success');

      const result = await breaker.execute(fn);

      expect(fn).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.circuitOpen).toBe(true);
      expect(result.error?.message).toContain('OPEN');
    });

    it('should execute function when circuit is HALF_OPEN', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({
        state: 'HALF_OPEN',
        failureCount: 5,
        lastFailureTime: Date.now() - 35000,
        openedAt: Date.now() - 35000,
      }));

      const breaker = new CircuitBreaker({ name: 'test' });
      const fn = vi.fn().mockResolvedValue('success');

      const result = await breaker.execute(fn);

      expect(fn).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
    });

    it('should record failure when function throws', async () => {
      mockRedis.get.mockResolvedValue(null);

      const breaker = new CircuitBreaker({ name: 'test' });
      const error = new Error('Test error');
      const fn = vi.fn().mockRejectedValue(error);

      const result = await breaker.execute(fn);

      expect(fn).toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.error).toBe(error);
      expect(result.circuitOpen).toBe(false);
    });

    it('should convert non-Error throws to Error', async () => {
      mockRedis.get.mockResolvedValue(null);

      const breaker = new CircuitBreaker({ name: 'test' });
      const fn = vi.fn().mockRejectedValue('string error');

      const result = await breaker.execute(fn);

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('string error');
    });
  });

  describe('forceOpen', () => {
    it('should force the circuit to OPEN state', async () => {
      mockRedis.get.mockResolvedValue(null);

      const breaker = new CircuitBreaker({ name: 'test', failureThreshold: 5 });
      await breaker.forceOpen();

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'vorion:circuit-breaker:test',
        86400,
        expect.stringContaining('"state":"OPEN"')
      );
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'vorion:circuit-breaker:test',
        86400,
        expect.stringContaining('"failureCount":5')
      );
    });
  });

  describe('forceClose', () => {
    it('should force the circuit to CLOSED state', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({
        state: 'OPEN',
        failureCount: 5,
        lastFailureTime: Date.now(),
        openedAt: Date.now(),
      }));

      const breaker = new CircuitBreaker({ name: 'test' });
      await breaker.forceClose();

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'vorion:circuit-breaker:test',
        86400,
        expect.stringContaining('"state":"CLOSED"')
      );
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'vorion:circuit-breaker:test',
        86400,
        expect.stringContaining('"failureCount":0')
      );
    });
  });

  describe('reset', () => {
    it('should delete the circuit breaker state from Redis', async () => {
      const breaker = new CircuitBreaker({ name: 'test' });
      await breaker.reset();

      expect(mockRedis.del).toHaveBeenCalledWith('vorion:circuit-breaker:test');
    });
  });

  describe('getStatus', () => {
    it('should return detailed status information', async () => {
      const now = Date.now();
      mockRedis.get.mockResolvedValue(JSON.stringify({
        state: 'OPEN',
        failureCount: 5,
        lastFailureTime: now - 5000,
        openedAt: now - 10000,
      }));

      const breaker = new CircuitBreaker({
        name: 'test',
        failureThreshold: 5,
        resetTimeoutMs: 30000,
      });
      const status = await breaker.getStatus();

      expect(status.name).toBe('test');
      expect(status.state).toBe('OPEN');
      expect(status.failureCount).toBe(5);
      expect(status.failureThreshold).toBe(5);
      expect(status.resetTimeoutMs).toBe(30000);
      expect(status.lastFailureTime).toBeInstanceOf(Date);
      expect(status.openedAt).toBeInstanceOf(Date);
      expect(status.timeUntilReset).toBeGreaterThan(0);
      expect(status.timeUntilReset).toBeLessThanOrEqual(30000);
    });

    it('should return null timeUntilReset when circuit is CLOSED', async () => {
      mockRedis.get.mockResolvedValue(null);

      const breaker = new CircuitBreaker({ name: 'test' });
      const status = await breaker.getStatus();

      expect(status.state).toBe('CLOSED');
      expect(status.timeUntilReset).toBeNull();
    });
  });

  describe('onStateChange callback', () => {
    it('should call onStateChange when state transitions', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({
        state: 'CLOSED',
        failureCount: 4,
        lastFailureTime: null,
        openedAt: null,
      }));

      const onStateChange = vi.fn();
      const breaker = new CircuitBreaker({
        name: 'test',
        failureThreshold: 5,
        onStateChange,
      });

      await breaker.recordFailure();

      expect(onStateChange).toHaveBeenCalledWith('CLOSED', 'OPEN', breaker);
    });

    it('should call onStateChange when closing from HALF_OPEN', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({
        state: 'HALF_OPEN',
        failureCount: 5,
        lastFailureTime: Date.now() - 35000,
        openedAt: Date.now() - 35000,
      }));

      const onStateChange = vi.fn();
      const breaker = new CircuitBreaker({
        name: 'test',
        onStateChange,
      });

      await breaker.recordSuccess();

      expect(onStateChange).toHaveBeenCalledWith('HALF_OPEN', 'CLOSED', breaker);
    });

    it('should handle errors in onStateChange callback gracefully', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({
        state: 'CLOSED',
        failureCount: 4,
        lastFailureTime: null,
        openedAt: null,
      }));

      const onStateChange = vi.fn().mockImplementation(() => {
        throw new Error('Callback error');
      });

      const breaker = new CircuitBreaker({
        name: 'test',
        failureThreshold: 5,
        onStateChange,
      });

      // Should not throw
      await expect(breaker.recordFailure()).resolves.not.toThrow();
      expect(onStateChange).toHaveBeenCalled();
    });
  });

  describe('Local state caching', () => {
    it('should use local cache within TTL', async () => {
      mockRedis.get.mockResolvedValue(null);

      const breaker = new CircuitBreaker({ name: 'test' });

      // First call should hit Redis
      await breaker.getCircuitState();
      expect(mockRedis.get).toHaveBeenCalledTimes(1);

      // Second call within 1 second should use cache
      await breaker.getCircuitState();
      // Still only 1 call because cache was used
      expect(mockRedis.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('Redis error handling', () => {
    it('should return CLOSED state when Redis get fails', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));

      const breaker = new CircuitBreaker({ name: 'test' });
      const state = await breaker.getCircuitState();

      expect(state).toBe('CLOSED');
    });

    it('should not throw when Redis setex fails', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockRejectedValue(new Error('Redis write failed'));

      const breaker = new CircuitBreaker({ name: 'test' });
      await expect(breaker.recordFailure()).resolves.not.toThrow();
    });

    it('should not throw when Redis del fails', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis delete failed'));

      const breaker = new CircuitBreaker({ name: 'test' });
      await expect(breaker.reset()).resolves.not.toThrow();
    });
  });

  describe('createCircuitBreaker factory', () => {
    it('should create a circuit breaker instance', () => {
      const breaker = createCircuitBreaker({ name: 'factory-test' });
      expect(breaker).toBeInstanceOf(CircuitBreaker);
    });
  });

  describe('Half-open max attempts', () => {
    it('should reopen circuit after max half-open attempts', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({
        state: 'HALF_OPEN',
        failureCount: 5,
        lastFailureTime: Date.now() - 35000,
        openedAt: Date.now() - 35000,
        halfOpenAttempts: 2, // Already at 2, max is 3
        windowStartTime: null,
      }));

      const breaker = new CircuitBreaker({
        name: 'test',
        halfOpenMaxAttempts: 3,
      });

      await breaker.recordFailure();

      // Should reopen circuit after exceeding max attempts
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'vorion:circuit-breaker:test',
        86400,
        expect.stringContaining('"state":"OPEN"')
      );
    });

    it('should stay in HALF_OPEN state if under max attempts', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({
        state: 'HALF_OPEN',
        failureCount: 5,
        lastFailureTime: Date.now() - 35000,
        openedAt: Date.now() - 35000,
        halfOpenAttempts: 0, // At 0, max is 3
        windowStartTime: null,
      }));

      const breaker = new CircuitBreaker({
        name: 'test',
        halfOpenMaxAttempts: 3,
      });

      await breaker.recordFailure();

      // Should still be HALF_OPEN since we're under max attempts
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'vorion:circuit-breaker:test',
        86400,
        expect.stringContaining('"state":"HALF_OPEN"')
      );
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'vorion:circuit-breaker:test',
        86400,
        expect.stringContaining('"halfOpenAttempts":1')
      );
    });
  });

  describe('Monitoring window', () => {
    it('should reset failure count when monitoring window expires', async () => {
      const windowStart = Date.now() - 70000; // 70 seconds ago
      mockRedis.get.mockResolvedValue(JSON.stringify({
        state: 'CLOSED',
        failureCount: 4,
        lastFailureTime: windowStart,
        openedAt: null,
        halfOpenAttempts: 0,
        windowStartTime: windowStart,
      }));

      const breaker = new CircuitBreaker({
        name: 'test',
        failureThreshold: 5,
        monitorWindowMs: 60000, // 60 seconds
      });

      await breaker.recordFailure();

      // Should have reset failure count to 1 (new failure in new window)
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'vorion:circuit-breaker:test',
        86400,
        expect.stringContaining('"failureCount":1')
      );
    });

    it('should accumulate failures within monitoring window', async () => {
      const windowStart = Date.now() - 30000; // 30 seconds ago (within 60s window)
      mockRedis.get.mockResolvedValue(JSON.stringify({
        state: 'CLOSED',
        failureCount: 3,
        lastFailureTime: windowStart,
        openedAt: null,
        halfOpenAttempts: 0,
        windowStartTime: windowStart,
      }));

      const breaker = new CircuitBreaker({
        name: 'test',
        failureThreshold: 5,
        monitorWindowMs: 60000,
      });

      await breaker.recordFailure();

      // Should have incremented failure count
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'vorion:circuit-breaker:test',
        86400,
        expect.stringContaining('"failureCount":4')
      );
    });
  });

  describe('Extended status', () => {
    it('should include halfOpenMaxAttempts and monitorWindowMs in status', async () => {
      mockRedis.get.mockResolvedValue(null);

      const breaker = new CircuitBreaker({
        name: 'test',
        halfOpenMaxAttempts: 5,
        monitorWindowMs: 120000,
      });

      const status = await breaker.getStatus();

      expect(status.halfOpenMaxAttempts).toBe(5);
      expect(status.monitorWindowMs).toBe(120000);
      expect(status.halfOpenAttempts).toBe(0);
      expect(status.windowStartTime).toBeNull();
    });
  });
});

// =============================================================================
// Per-Service Circuit Breaker Registry Tests
// =============================================================================

describe('Circuit Breaker Registry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearCircuitBreakerRegistry();
    mockRedis.get.mockResolvedValue(null);
    mockRedis.setex.mockResolvedValue('OK');
    mockRedis.del.mockResolvedValue(1);
  });

  afterEach(() => {
    vi.clearAllMocks();
    clearCircuitBreakerRegistry();
  });

  describe('CIRCUIT_BREAKER_CONFIGS', () => {
    it('should have default configurations for all known services', () => {
      expect(CIRCUIT_BREAKER_CONFIGS.database).toBeDefined();
      expect(CIRCUIT_BREAKER_CONFIGS.redis).toBeDefined();
      expect(CIRCUIT_BREAKER_CONFIGS.webhook).toBeDefined();
      expect(CIRCUIT_BREAKER_CONFIGS.policyEngine).toBeDefined();
      expect(CIRCUIT_BREAKER_CONFIGS.trustEngine).toBeDefined();
    });

    it('should have different configurations for each service', () => {
      // Database vs Redis - different thresholds
      expect(CIRCUIT_BREAKER_CONFIGS.database.failureThreshold).toBe(5);
      expect(CIRCUIT_BREAKER_CONFIGS.redis.failureThreshold).toBe(10);

      // Database vs Webhook - different reset timeouts
      expect(CIRCUIT_BREAKER_CONFIGS.database.resetTimeoutMs).toBe(30000);
      expect(CIRCUIT_BREAKER_CONFIGS.webhook.resetTimeoutMs).toBe(60000);

      // Webhook - more conservative settings
      expect(CIRCUIT_BREAKER_CONFIGS.webhook.failureThreshold).toBe(3);
      expect(CIRCUIT_BREAKER_CONFIGS.webhook.halfOpenMaxAttempts).toBe(2);
    });

    it('should have all required fields in each config', () => {
      for (const [serviceName, config] of Object.entries(CIRCUIT_BREAKER_CONFIGS)) {
        expect(config.name).toBe(serviceName === 'policyEngine' ? 'policy-engine' : serviceName === 'trustEngine' ? 'trust-engine' : serviceName);
        expect(typeof config.failureThreshold).toBe('number');
        expect(typeof config.resetTimeoutMs).toBe('number');
        expect(typeof config.halfOpenMaxAttempts).toBe('number');
        expect(typeof config.monitorWindowMs).toBe('number');
      }
    });
  });

  describe('getCircuitBreaker', () => {
    it('should return the same instance for the same service name', () => {
      const breaker1 = getCircuitBreaker('database');
      const breaker2 = getCircuitBreaker('database');

      expect(breaker1).toBe(breaker2);
    });

    it('should return different instances for different service names', () => {
      const dbBreaker = getCircuitBreaker('database');
      const redisBreaker = getCircuitBreaker('redis');

      expect(dbBreaker).not.toBe(redisBreaker);
    });

    it('should use default config for known services', async () => {
      const breaker = getCircuitBreaker('database');
      const status = await breaker.getStatus();

      expect(status.name).toBe('database');
      expect(status.failureThreshold).toBe(CIRCUIT_BREAKER_CONFIGS.database.failureThreshold);
      expect(status.resetTimeoutMs).toBe(CIRCUIT_BREAKER_CONFIGS.database.resetTimeoutMs);
    });

    it('should use database config as fallback for unknown services', async () => {
      const breaker = getCircuitBreaker('unknown-service');
      const status = await breaker.getStatus();

      expect(status.name).toBe('unknown-service');
      expect(status.failureThreshold).toBe(CIRCUIT_BREAKER_CONFIGS.database.failureThreshold);
    });

    it('should accept onStateChange callback', async () => {
      const onStateChange = vi.fn();
      const breaker = getCircuitBreaker('test-service', onStateChange);

      // Force open to trigger state change
      mockRedis.get.mockResolvedValue(null);
      await breaker.forceOpen();

      expect(onStateChange).toHaveBeenCalledWith('CLOSED', 'OPEN', breaker);
    });
  });

  describe('setCircuitBreakerConfigOverrides', () => {
    it('should apply config overrides when creating circuit breakers', async () => {
      setCircuitBreakerConfigOverrides({
        database: {
          failureThreshold: 20,
          resetTimeoutMs: 120000,
        },
      });

      const breaker = getCircuitBreaker('database');
      const status = await breaker.getStatus();

      expect(status.failureThreshold).toBe(20);
      expect(status.resetTimeoutMs).toBe(120000);
    });

    it('should merge overrides with default config', async () => {
      setCircuitBreakerConfigOverrides({
        redis: {
          failureThreshold: 50, // Override only this
        },
      });

      const breaker = getCircuitBreaker('redis');
      const status = await breaker.getStatus();

      // Overridden value
      expect(status.failureThreshold).toBe(50);
      // Default values
      expect(status.resetTimeoutMs).toBe(CIRCUIT_BREAKER_CONFIGS.redis.resetTimeoutMs);
      expect(status.halfOpenMaxAttempts).toBe(CIRCUIT_BREAKER_CONFIGS.redis.halfOpenMaxAttempts);
    });

    it('should not affect already created circuit breakers', async () => {
      // Create breaker first
      const breaker = getCircuitBreaker('database');
      const statusBefore = await breaker.getStatus();

      // Then set overrides (too late for existing breaker)
      setCircuitBreakerConfigOverrides({
        database: { failureThreshold: 100 },
      });

      const statusAfter = await breaker.getStatus();
      expect(statusAfter.failureThreshold).toBe(statusBefore.failureThreshold);
    });
  });

  describe('getAllCircuitBreakerStatuses', () => {
    it('should return statuses for all registered circuit breakers', async () => {
      // Create some circuit breakers
      getCircuitBreaker('database');
      getCircuitBreaker('redis');
      getCircuitBreaker('webhook');

      const statuses = await getAllCircuitBreakerStatuses();

      expect(statuses.size).toBe(3);
      expect(statuses.has('database')).toBe(true);
      expect(statuses.has('redis')).toBe(true);
      expect(statuses.has('webhook')).toBe(true);
    });

    it('should return empty map when no circuit breakers registered', async () => {
      const statuses = await getAllCircuitBreakerStatuses();
      expect(statuses.size).toBe(0);
    });
  });

  describe('resetCircuitBreaker', () => {
    it('should reset a registered circuit breaker', async () => {
      getCircuitBreaker('database');

      const result = await resetCircuitBreaker('database');

      expect(result).toBe(true);
      expect(mockRedis.del).toHaveBeenCalledWith('vorion:circuit-breaker:database');
    });

    it('should return false for non-existent circuit breaker', async () => {
      const result = await resetCircuitBreaker('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('clearCircuitBreakerRegistry', () => {
    it('should clear all circuit breakers', async () => {
      getCircuitBreaker('database');
      getCircuitBreaker('redis');

      clearCircuitBreakerRegistry();

      const statuses = await getAllCircuitBreakerStatuses();
      expect(statuses.size).toBe(0);
    });

    it('should clear config overrides', async () => {
      setCircuitBreakerConfigOverrides({
        database: { failureThreshold: 100 },
      });

      clearCircuitBreakerRegistry();

      // Now create a new breaker - should use default config
      const breaker = getCircuitBreaker('database');
      const status = await breaker.getStatus();
      expect(status.failureThreshold).toBe(CIRCUIT_BREAKER_CONFIGS.database.failureThreshold);
    });
  });
});
