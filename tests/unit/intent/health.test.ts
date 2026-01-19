/**
 * INTENT Health Check Tests
 *
 * Tests for the health check service providing Kubernetes readiness/liveness probes.
 * Includes tests for:
 * - Liveness checks (basic process health)
 * - Readiness checks (dependency health)
 * - Global health checks (component aggregation)
 * - INTENT-specific health checks
 * - Shutdown handling
 * - 503 response scenarios
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';

// Create mock functions that we can control
const mockPing = vi.fn();
const mockExists = vi.fn();
const mockExecute = vi.fn();
const mockGetQueueHealth = vi.fn();
const mockGetPolicyLoader = vi.fn();

// Mock dependencies before importing the module
vi.mock('../../../src/common/redis.js', () => ({
  getRedis: vi.fn(() => ({
    ping: mockPing,
    exists: mockExists,
  })),
}));

vi.mock('../../../src/common/db.js', () => ({
  getDatabase: vi.fn(() => ({
    execute: mockExecute,
  })),
  getPool: vi.fn(() => null),
}));

vi.mock('../../../src/common/logger.js', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock('../../../src/common/config.js', () => ({
  getConfig: vi.fn(() => ({
    env: 'test',
    health: {
      checkTimeoutMs: 5000,
      readyTimeoutMs: 10000,
      livenessTimeoutMs: 1000,
    },
  })),
}));

vi.mock('../../../src/common/timeout.js', () => ({
  withTimeout: vi.fn((promise) => promise),
}));

vi.mock('../../../src/intent/queues.js', () => ({
  getQueueHealth: () => mockGetQueueHealth(),
}));

vi.mock('../../../src/policy/loader.js', () => ({
  getPolicyLoader: () => mockGetPolicyLoader(),
}));

// Import after mocks are set up
import {
  checkDatabaseHealth,
  checkRedisHealth,
  checkQueueHealth,
  checkPolicyLoaderHealth,
  checkDetailedQueueHealth,
  livenessCheck,
  readinessCheck,
  intentReadinessCheck,
  globalHealthCheck,
  globalReadinessCheck,
  validateStartupDependencies,
  getUptimeSeconds,
  type HealthStatus,
  type ComponentHealth,
  type GlobalHealthStatus,
  type ReadinessStatus,
} from '../../../src/intent/health.js';

describe('INTENT Health Check Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to default successful behavior
    mockPing.mockResolvedValue('PONG');
    mockExists.mockResolvedValue(1);
    mockExecute.mockResolvedValue({ rows: [{ '?column?': 1 }] });
    mockGetQueueHealth.mockResolvedValue({
      intake: { waiting: 0, active: 0, completed: 100, failed: 0 },
      evaluate: { waiting: 0, active: 0, completed: 100, failed: 0 },
      decision: { waiting: 0, active: 0, completed: 100, failed: 0 },
      deadLetter: { waiting: 0, active: 0, completed: 0, failed: 5 },
    });
    mockGetPolicyLoader.mockReturnValue({
      getPolicies: vi.fn().mockResolvedValue([]),
      invalidateCache: vi.fn().mockResolvedValue(undefined),
    });
  });

  describe('checkDatabaseHealth', () => {
    it('should return ok status when database is healthy', async () => {
      const result = await checkDatabaseHealth();

      expect(result.status).toBe('ok');
      expect(result.latencyMs).toBeDefined();
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.message).toBeUndefined();
    });

    it('should return error status when database query fails', async () => {
      mockExecute.mockRejectedValue(new Error('Connection refused'));

      const result = await checkDatabaseHealth();

      expect(result.status).toBe('error');
      expect(result.latencyMs).toBeDefined();
      expect(result.message).toBe('Connection refused');
    });

    it('should return error status with unknown error message', async () => {
      mockExecute.mockRejectedValue('non-error object');

      const result = await checkDatabaseHealth();

      expect(result.status).toBe('error');
      expect(result.message).toBe('Unknown error');
    });

    it('should measure latency correctly', async () => {
      mockExecute.mockImplementation(async () => {
        // Simulate some delay
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { rows: [{ '?column?': 1 }] };
      });

      const result = await checkDatabaseHealth();

      expect(result.latencyMs).toBeGreaterThanOrEqual(10);
    });
  });

  describe('checkRedisHealth', () => {
    it('should return ok status when redis is healthy', async () => {
      const result = await checkRedisHealth();

      expect(result.status).toBe('ok');
      expect(result.latencyMs).toBeDefined();
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.message).toBeUndefined();
    });

    it('should return error status when redis ping fails', async () => {
      mockPing.mockRejectedValue(new Error('Redis connection failed'));

      const result = await checkRedisHealth();

      expect(result.status).toBe('error');
      expect(result.latencyMs).toBeDefined();
      expect(result.message).toBe('Redis connection failed');
    });

    it('should return error status with unknown error message', async () => {
      mockPing.mockRejectedValue({ unexpected: 'error' });

      const result = await checkRedisHealth();

      expect(result.status).toBe('error');
      expect(result.message).toBe('Unknown error');
    });
  });

  describe('checkQueueHealth', () => {
    it('should return ok status when queue is accessible', async () => {
      const result = await checkQueueHealth();

      expect(result.status).toBe('ok');
      expect(result.latencyMs).toBeDefined();
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.message).toBeUndefined();
    });

    it('should return error status when queue check fails', async () => {
      mockExists.mockRejectedValue(new Error('Queue unavailable'));

      const result = await checkQueueHealth();

      expect(result.status).toBe('error');
      expect(result.latencyMs).toBeDefined();
      expect(result.message).toBe('Queue unavailable');
    });
  });

  describe('livenessCheck', () => {
    it('should always return alive: true when process is running', async () => {
      const result = await livenessCheck();

      expect(result).toEqual({ alive: true });
    });

    it('should return quickly without external dependencies', async () => {
      const start = Date.now();
      await livenessCheck();
      const duration = Date.now() - start;

      // Should complete in less than 10ms
      expect(duration).toBeLessThan(10);
    });
  });

  describe('readinessCheck', () => {
    it('should return healthy status when all dependencies are ok', async () => {
      const result = await readinessCheck();

      expect(result.status).toBe('healthy');
      expect(result.timestamp).toBeDefined();
      expect(result.version).toBeDefined();
      expect(result.uptime).toBeGreaterThanOrEqual(0);
      expect(result.checks.database.status).toBe('ok');
      expect(result.checks.redis.status).toBe('ok');
      expect(result.checks.queues.status).toBe('ok');
    });

    it('should return unhealthy status when database fails', async () => {
      mockExecute.mockRejectedValue(new Error('DB error'));

      const result = await readinessCheck();

      expect(result.status).toBe('unhealthy');
      expect(result.checks.database.status).toBe('error');
      expect(result.checks.database.message).toBe('DB error');
    });

    it('should return unhealthy status when redis fails', async () => {
      mockPing.mockRejectedValue(new Error('Redis error'));

      const result = await readinessCheck();

      expect(result.status).toBe('unhealthy');
      expect(result.checks.redis.status).toBe('error');
      expect(result.checks.redis.message).toBe('Redis error');
    });

    it('should return unhealthy status when queue fails', async () => {
      mockExists.mockRejectedValue(new Error('Queue error'));

      const result = await readinessCheck();

      expect(result.status).toBe('unhealthy');
      expect(result.checks.queues.status).toBe('error');
      expect(result.checks.queues.message).toBe('Queue error');
    });

    it('should include ISO timestamp', async () => {
      const result = await readinessCheck();

      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    });

    it('should include uptime in seconds', async () => {
      const result = await readinessCheck();

      expect(typeof result.uptime).toBe('number');
      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should check all dependencies in parallel', async () => {
      let dbCalled = false;
      let redisPingCalled = false;
      let redisExistsCalled = false;

      mockExecute.mockImplementation(async () => {
        dbCalled = true;
        await new Promise((r) => setTimeout(r, 50));
        return { rows: [{ '?column?': 1 }] };
      });

      mockPing.mockImplementation(async () => {
        redisPingCalled = true;
        await new Promise((r) => setTimeout(r, 50));
        return 'PONG';
      });

      mockExists.mockImplementation(async () => {
        redisExistsCalled = true;
        await new Promise((r) => setTimeout(r, 50));
        return 1;
      });

      const start = Date.now();
      await readinessCheck();
      const duration = Date.now() - start;

      // All checks were called
      expect(dbCalled).toBe(true);
      expect(redisPingCalled).toBe(true);
      expect(redisExistsCalled).toBe(true);

      // Should complete in ~50ms (parallel) not ~150ms (sequential)
      expect(duration).toBeLessThan(100);
    });
  });

  describe('validateStartupDependencies', () => {
    it('should succeed when all dependencies are healthy', async () => {
      await expect(validateStartupDependencies()).resolves.toBeUndefined();
    });

    it('should throw when database is unhealthy', async () => {
      mockExecute.mockRejectedValue(new Error('DB connection failed'));

      await expect(validateStartupDependencies()).rejects.toThrow(
        'Startup validation failed: Database: DB connection failed'
      );
    });

    it('should throw when redis is unhealthy', async () => {
      mockPing.mockRejectedValue(new Error('Redis connection failed'));

      await expect(validateStartupDependencies()).rejects.toThrow(
        'Startup validation failed: Redis: Redis connection failed'
      );
    });

    it('should include all errors when multiple dependencies fail', async () => {
      mockExecute.mockRejectedValue(new Error('DB error'));
      mockPing.mockRejectedValue(new Error('Redis error'));

      await expect(validateStartupDependencies()).rejects.toThrow(
        'Startup validation failed: Database: DB error; Redis: Redis error'
      );
    });

    it('should validate dependencies in parallel', async () => {
      mockExecute.mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 50));
        return { rows: [{ '?column?': 1 }] };
      });

      mockPing.mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 50));
        return 'PONG';
      });

      const start = Date.now();
      await validateStartupDependencies();
      const duration = Date.now() - start;

      // Should complete in ~50ms (parallel) not ~100ms (sequential)
      expect(duration).toBeLessThan(80);
    });
  });

  describe('getUptimeSeconds', () => {
    it('should return a non-negative number', () => {
      const uptime = getUptimeSeconds();

      expect(typeof uptime).toBe('number');
      expect(uptime).toBeGreaterThanOrEqual(0);
    });

    it('should return an integer', () => {
      const uptime = getUptimeSeconds();

      expect(Number.isInteger(uptime)).toBe(true);
    });
  });

  describe('HealthStatus interface compliance', () => {
    it('should return correct HealthStatus structure', async () => {
      const result: HealthStatus = await readinessCheck();

      // Validate required fields
      expect(['healthy', 'degraded', 'unhealthy']).toContain(result.status);
      expect(typeof result.timestamp).toBe('string');
      expect(typeof result.version).toBe('string');
      expect(typeof result.uptime).toBe('number');
      expect(result.checks).toBeDefined();
      expect(result.checks.database).toBeDefined();
      expect(result.checks.redis).toBeDefined();
      expect(result.checks.queues).toBeDefined();
    });
  });

  describe('ComponentHealth interface compliance', () => {
    it('should return correct ComponentHealth structure for database', async () => {
      const result = await checkDatabaseHealth();

      expect(['ok', 'degraded', 'error']).toContain(result.status);
      if (result.latencyMs !== undefined) {
        expect(typeof result.latencyMs).toBe('number');
      }
      if (result.message !== undefined) {
        expect(typeof result.message).toBe('string');
      }
    });

    it('should return correct ComponentHealth structure for redis', async () => {
      const result = await checkRedisHealth();

      expect(['ok', 'degraded', 'error']).toContain(result.status);
      if (result.latencyMs !== undefined) {
        expect(typeof result.latencyMs).toBe('number');
      }
      if (result.message !== undefined) {
        expect(typeof result.message).toBe('string');
      }
    });

    it('should return correct ComponentHealth structure for queues', async () => {
      const result = await checkQueueHealth();

      expect(['ok', 'degraded', 'error']).toContain(result.status);
      if (result.latencyMs !== undefined) {
        expect(typeof result.latencyMs).toBe('number');
      }
      if (result.message !== undefined) {
        expect(typeof result.message).toBe('string');
      }
    });
  });

  describe('Edge cases', () => {
    it('should handle very fast responses', async () => {
      const result = await checkDatabaseHealth();

      // Should still have a valid latency measurement
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle multiple concurrent readiness checks', async () => {
      const results = await Promise.all([
        readinessCheck(),
        readinessCheck(),
        readinessCheck(),
      ]);

      // All should complete successfully
      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.status).toBe('healthy');
      });
    });

    it('should return version from environment variable', async () => {
      const result = await readinessCheck();

      // Version should be a string (either from env or default '0.0.0')
      expect(typeof result.version).toBe('string');
      expect(result.version).toMatch(/^\d+\.\d+\.\d+$|^0\.0\.0$/);
    });
  });
});

describe('Kubernetes Probe Compatibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPing.mockResolvedValue('PONG');
    mockExists.mockResolvedValue(1);
    mockExecute.mockResolvedValue({ rows: [{ '?column?': 1 }] });
  });

  describe('Liveness probe', () => {
    it('should return quickly for Kubernetes liveness probe', async () => {
      const start = Date.now();
      const result = await livenessCheck();
      const duration = Date.now() - start;

      // Kubernetes default timeout is 1s, we should be well under that
      expect(duration).toBeLessThan(100);
      expect(result.alive).toBe(true);
    });
  });

  describe('Readiness probe', () => {
    it('should return healthy status for Kubernetes readiness probe', async () => {
      const result = await readinessCheck();

      // Kubernetes expects 200 OK for ready
      expect(result.status).toBe('healthy');
    });

    it('should return unhealthy status when dependencies fail', async () => {
      mockExecute.mockRejectedValue(new Error('DB unavailable'));

      const result = await readinessCheck();

      // Kubernetes expects non-200 for not ready
      expect(result.status).toBe('unhealthy');
    });
  });

  describe('Startup probe', () => {
    it('should throw on startup when dependencies unavailable', async () => {
      mockExecute.mockRejectedValue(new Error('Starting up...'));

      await expect(validateStartupDependencies()).rejects.toThrow();
    });
  });
});

describe('Policy Loader Health Check', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPolicyLoader.mockReturnValue({
      getPolicies: vi.fn().mockResolvedValue([]),
      invalidateCache: vi.fn().mockResolvedValue(undefined),
    });
  });

  describe('checkPolicyLoaderHealth', () => {
    it('should return ok status when policy loader is accessible', async () => {
      const result = await checkPolicyLoaderHealth();

      expect(result.status).toBe('ok');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should return error status when policy loader throws', async () => {
      mockGetPolicyLoader.mockImplementation(() => {
        throw new Error('Policy loader not initialized');
      });

      const result = await checkPolicyLoaderHealth();

      expect(result.status).toBe('error');
      expect(result.message).toBe('Policy loader not initialized');
    });
  });
});

describe('INTENT Module Readiness Check', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPing.mockResolvedValue('PONG');
    mockExists.mockResolvedValue(1);
    mockGetQueueHealth.mockResolvedValue({
      intake: { waiting: 0, active: 0, completed: 100, failed: 0 },
      evaluate: { waiting: 0, active: 0, completed: 100, failed: 0 },
      decision: { waiting: 0, active: 0, completed: 100, failed: 0 },
      deadLetter: { waiting: 0, active: 0, completed: 0, failed: 5 },
    });
    mockGetPolicyLoader.mockReturnValue({
      getPolicies: vi.fn().mockResolvedValue([]),
    });
  });

  describe('intentReadinessCheck', () => {
    it('should return healthy when queues and policies are ok', async () => {
      const result = await intentReadinessCheck();

      expect(result.status).toBe('healthy');
      expect(result.checks.queues.status).toBe('ok');
      expect(result.checks.policies.status).toBe('ok');
      expect(result.timestamp).toBeDefined();
    });

    it('should return unhealthy when queue check fails', async () => {
      mockExists.mockRejectedValue(new Error('Queue unavailable'));

      const result = await intentReadinessCheck();

      expect(result.status).toBe('unhealthy');
      expect(result.checks.queues.status).toBe('error');
    });

    it('should return unhealthy when policy loader fails', async () => {
      mockGetPolicyLoader.mockImplementation(() => {
        throw new Error('Policy loader error');
      });

      const result = await intentReadinessCheck();

      expect(result.status).toBe('unhealthy');
      expect(result.checks.policies.status).toBe('error');
    });

    it('should include timestamp in ISO format', async () => {
      const result = await intentReadinessCheck();

      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    });
  });
});

describe('Global Health Check', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('globalHealthCheck', () => {
    it('should return healthy status with process info', async () => {
      const result = await globalHealthCheck(5, false);

      expect(result.status).toBe('healthy');
      expect(result.version).toBeDefined();
      expect(result.environment).toBe('test');
      expect(result.process.uptimeSeconds).toBeGreaterThanOrEqual(0);
      expect(result.process.activeRequests).toBe(5);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should return shutting_down status when server is shutting down', async () => {
      const result = await globalHealthCheck(10, true);

      expect(result.status).toBe('shutting_down');
      expect(result.process.activeRequests).toBe(10);
    });

    it('should include memory usage in MB', async () => {
      const result = await globalHealthCheck(0, false);

      expect(result.process.memoryUsageMb).toBeDefined();
      expect(result.process.memoryUsageMb.rss).toBeGreaterThan(0);
      expect(result.process.memoryUsageMb.heapTotal).toBeGreaterThan(0);
      expect(result.process.memoryUsageMb.heapUsed).toBeGreaterThan(0);
      expect(result.process.memoryUsageMb.external).toBeGreaterThanOrEqual(0);
    });

    it('should include INTENT component status', async () => {
      const result = await globalHealthCheck(0, false);

      expect(result.components.intent).toBeDefined();
      expect(result.components.intent.status).toBe('ok');
    });

    it('should include timestamp in response', async () => {
      const result = await globalHealthCheck(0, false);

      expect(result.timestamp).toBeDefined();
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    });
  });
});

describe('Global Readiness Check', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPing.mockResolvedValue('PONG');
    mockExists.mockResolvedValue(1);
    mockExecute.mockResolvedValue({ rows: [{ '?column?': 1 }] });
    mockGetQueueHealth.mockResolvedValue({
      intake: { waiting: 0, active: 0, completed: 100, failed: 0 },
      evaluate: { waiting: 0, active: 0, completed: 100, failed: 0 },
      decision: { waiting: 0, active: 0, completed: 100, failed: 0 },
      deadLetter: { waiting: 0, active: 0, completed: 0, failed: 5 },
    });
    mockGetPolicyLoader.mockReturnValue({
      getPolicies: vi.fn().mockResolvedValue([]),
    });
  });

  describe('globalReadinessCheck', () => {
    it('should return ready status when all components are healthy', async () => {
      const result = await globalReadinessCheck();

      expect(result.status).toBe('ready');
      expect(result.checks.database.status).toBe('ok');
      expect(result.checks.redis.status).toBe('ok');
      expect(result.checks.queues.status).toBe('ok');
      expect(result.checks.intent.status).toBe('ok');
    });

    it('should return unhealthy when database fails', async () => {
      mockExecute.mockRejectedValue(new Error('DB connection failed'));

      const result = await globalReadinessCheck();

      expect(result.status).toBe('unhealthy');
      expect(result.checks.database.status).toBe('error');
    });

    it('should return unhealthy when Redis fails', async () => {
      mockPing.mockRejectedValue(new Error('Redis unavailable'));

      const result = await globalReadinessCheck();

      expect(result.status).toBe('unhealthy');
      expect(result.checks.redis.status).toBe('error');
    });

    it('should include INTENT module check with details', async () => {
      const result = await globalReadinessCheck();

      expect(result.checks.intent).toBeDefined();
      expect(result.checks.intent.details).toBeDefined();
    });

    it('should include queue details', async () => {
      const result = await globalReadinessCheck();

      expect(result.checks.queues.details).toBeDefined();
      if (result.checks.queues.details) {
        expect(result.checks.queues.details).toHaveProperty('intake');
        expect(result.checks.queues.details).toHaveProperty('evaluate');
        expect(result.checks.queues.details).toHaveProperty('decision');
        expect(result.checks.queues.details).toHaveProperty('deadLetter');
      }
    });

    it('should include timestamp', async () => {
      const result = await globalReadinessCheck();

      expect(result.timestamp).toBeDefined();
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    });
  });
});

describe('503 Response Scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPing.mockResolvedValue('PONG');
    mockExists.mockResolvedValue(1);
    mockExecute.mockResolvedValue({ rows: [{ '?column?': 1 }] });
    mockGetQueueHealth.mockResolvedValue({
      intake: { waiting: 0, active: 0, completed: 100, failed: 0 },
      evaluate: { waiting: 0, active: 0, completed: 100, failed: 0 },
      decision: { waiting: 0, active: 0, completed: 100, failed: 0 },
      deadLetter: { waiting: 0, active: 0, completed: 0, failed: 5 },
    });
    mockGetPolicyLoader.mockReturnValue({
      getPolicies: vi.fn().mockResolvedValue([]),
    });
  });

  it('should indicate unhealthy (503) when database is unavailable', async () => {
    mockExecute.mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await globalReadinessCheck();

    expect(result.status).toBe('unhealthy');
    // Server would return 503 for unhealthy status
  });

  it('should indicate shutting_down (503) during shutdown', async () => {
    const result = await globalHealthCheck(0, true);

    expect(result.status).toBe('shutting_down');
    // Server would return 503 for shutting_down status
  });

  it('should indicate unhealthy (503) when Redis is unavailable', async () => {
    mockPing.mockRejectedValue(new Error('ECONNREFUSED'));
    mockExists.mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await globalReadinessCheck();

    expect(result.status).toBe('unhealthy');
  });

  it('should indicate unhealthy (503) when queue service fails', async () => {
    mockExists.mockRejectedValue(new Error('Queue service unavailable'));

    const result = await globalReadinessCheck();

    // Queue failure should affect readiness
    expect(['unhealthy', 'degraded']).toContain(result.status);
  });
});

describe('Health Check Response Structure Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPing.mockResolvedValue('PONG');
    mockExists.mockResolvedValue(1);
    mockExecute.mockResolvedValue({ rows: [{ '?column?': 1 }] });
    mockGetQueueHealth.mockResolvedValue({
      intake: { waiting: 0, active: 0, completed: 100, failed: 0 },
      evaluate: { waiting: 0, active: 0, completed: 100, failed: 0 },
      decision: { waiting: 0, active: 0, completed: 100, failed: 0 },
      deadLetter: { waiting: 0, active: 0, completed: 0, failed: 5 },
    });
    mockGetPolicyLoader.mockReturnValue({
      getPolicies: vi.fn().mockResolvedValue([]),
    });
  });

  it('GlobalHealthStatus should have all required fields', async () => {
    const result: GlobalHealthStatus = await globalHealthCheck(0, false);

    // Required fields
    expect(result).toHaveProperty('status');
    expect(result).toHaveProperty('version');
    expect(result).toHaveProperty('environment');
    expect(result).toHaveProperty('timestamp');
    expect(result).toHaveProperty('process');
    expect(result).toHaveProperty('components');
    expect(result).toHaveProperty('latencyMs');

    // Process sub-fields
    expect(result.process).toHaveProperty('uptimeSeconds');
    expect(result.process).toHaveProperty('memoryUsageMb');
    expect(result.process).toHaveProperty('activeRequests');

    // Memory sub-fields
    expect(result.process.memoryUsageMb).toHaveProperty('rss');
    expect(result.process.memoryUsageMb).toHaveProperty('heapTotal');
    expect(result.process.memoryUsageMb).toHaveProperty('heapUsed');
    expect(result.process.memoryUsageMb).toHaveProperty('external');
  });

  it('ReadinessStatus should have all required fields', async () => {
    const result: ReadinessStatus = await globalReadinessCheck();

    // Required fields
    expect(result).toHaveProperty('status');
    expect(result).toHaveProperty('timestamp');
    expect(result).toHaveProperty('checks');

    // Checks sub-fields
    expect(result.checks).toHaveProperty('database');
    expect(result.checks).toHaveProperty('redis');
    expect(result.checks).toHaveProperty('queues');
    expect(result.checks).toHaveProperty('intent');

    // Each check should have status
    expect(result.checks.database).toHaveProperty('status');
    expect(result.checks.redis).toHaveProperty('status');
    expect(result.checks.queues).toHaveProperty('status');
    expect(result.checks.intent).toHaveProperty('status');
  });

  it('Status values should be valid enum values', async () => {
    const healthResult = await globalHealthCheck(0, false);
    const readyResult = await globalReadinessCheck();

    expect(['healthy', 'degraded', 'unhealthy', 'shutting_down']).toContain(healthResult.status);
    expect(['ready', 'degraded', 'unhealthy']).toContain(readyResult.status);
  });
});
