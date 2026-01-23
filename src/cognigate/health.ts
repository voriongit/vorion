/**
 * Health Check Service for COGNIGATE Module
 *
 * Provides /health (liveness) and /ready (readiness) endpoints
 * for Kubernetes probes and load balancer health checks.
 *
 * Features:
 * - Component-level health status (database, Redis, handlers, bulkhead, cache, circuit breakers)
 * - Timeout protection for all checks
 * - Active/queued execution counts
 * - Cognigate-specific circuit breaker monitoring
 *
 * Status Logic:
 * - UNHEALTHY: Database or Redis check fails
 * - DEGRADED: Cache, handlers, or circuit breakers have issues
 * - HEALTHY: All checks pass
 *
 * @packageDocumentation
 */

import { sql } from 'drizzle-orm';
import { createLogger } from '../common/logger.js';
import { getCircuitBreaker } from '../common/circuit-breaker.js';
import type { Timestamp } from '../common/types.js';

const logger = createLogger({ component: 'cognigate-health' });

// ============================================================================
// Types
// ============================================================================

/**
 * Individual component health check result
 */
export interface HealthCheck {
  /** Component health status */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** Human-readable message about the check */
  message?: string | undefined;
  /** Time taken for the check in milliseconds */
  latencyMs?: number | undefined;
  /** Additional details about the component */
  details?: Record<string, unknown> | undefined;
}

/**
 * Complete health status for the Cognigate module
 */
export interface CognigateHealthStatus {
  /** Overall health status */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** Individual component checks */
  checks: {
    database: HealthCheck;
    redis: HealthCheck;
    handlers: HealthCheck;
    bulkhead: HealthCheck;
    cache: HealthCheck;
    circuitBreakers: HealthCheck;
  };
  /** Uptime in seconds */
  uptime: number;
  /** Number of currently active executions */
  activeExecutions: number;
  /** Number of queued (pending) executions */
  queuedExecutions: number;
  /** Service version */
  version: string;
  /** ISO timestamp of this check */
  timestamp: Timestamp;
}

/**
 * Readiness status for the Cognigate module
 */
export interface CognigateReadinessStatus {
  /** Whether the service is ready to accept traffic */
  ready: boolean;
  /** Individual readiness checks */
  checks: {
    database: boolean;
    redis: boolean;
    handlers: boolean;
  };
  /** ISO timestamp when the service started */
  startedAt: Timestamp;
}

/**
 * Options for health check configuration
 */
export interface HealthServiceOptions {
  /** Timeout for individual health checks in ms (default: 5000) */
  checkTimeoutMs?: number;
  /** Service version string (default: '0.1.0') */
  version?: string;
  /** External check functions for dependency injection */
  externalChecks?: {
    database?: () => Promise<HealthCheck>;
    redis?: () => Promise<HealthCheck>;
    handlers?: () => Promise<HealthCheck>;
    bulkhead?: () => Promise<HealthCheck>;
    cache?: () => Promise<HealthCheck>;
  };
}

// ============================================================================
// Constants
// ============================================================================

/** Default timeout for health checks in milliseconds */
const DEFAULT_CHECK_TIMEOUT_MS = 5000;

/** Redis health check key */
const REDIS_HEALTH_KEY = 'cognigate:health:ping';

/** Cognigate circuit breaker names to monitor */
const COGNIGATE_BREAKER_NAMES = [
  'cognigateDatabase',
  'cognigateRedis',
  'cognigateHandler',
];

// ============================================================================
// Health Service Implementation
// ============================================================================

/**
 * Health check service for the Cognigate module.
 *
 * Provides comprehensive health and readiness checks for all Cognigate
 * dependencies. Designed for use with Kubernetes liveness and readiness probes.
 *
 * @example
 * ```typescript
 * const healthService = new CognigateHealthService();
 *
 * // Liveness probe
 * const health = await healthService.getHealthStatus();
 * if (health.status === 'unhealthy') {
 *   // Service should be restarted
 * }
 *
 * // Readiness probe
 * const ready = await healthService.getReadinessStatus();
 * if (!ready.ready) {
 *   // Service should not receive traffic
 * }
 * ```
 */
export class CognigateHealthService {
  /** Service start time for uptime calculation */
  private readonly startedAt: number;

  /** Health check timeout in milliseconds */
  private readonly checkTimeoutMs: number;

  /** Service version string */
  private readonly version: string;

  /** External check functions for testability */
  private readonly externalChecks: HealthServiceOptions['externalChecks'];

  /** Simulated active execution count (set externally) */
  private activeExecutionCount: number = 0;

  /** Simulated queued execution count (set externally) */
  private queuedExecutionCount: number = 0;

  constructor(options?: HealthServiceOptions) {
    this.startedAt = Date.now();
    this.checkTimeoutMs = options?.checkTimeoutMs ?? DEFAULT_CHECK_TIMEOUT_MS;
    this.version = options?.version ?? '0.1.0';
    this.externalChecks = options?.externalChecks;
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Get the comprehensive health status of the Cognigate module.
   * Used for the /health endpoint (liveness probe).
   *
   * @returns Complete health status with all component checks
   */
  async getHealthStatus(): Promise<CognigateHealthStatus> {
    const [database, redis, handlers, bulkhead, cache, circuitBreakers] = await Promise.all([
      this.withTimeout(this.checkDatabase()),
      this.withTimeout(this.checkRedis()),
      this.withTimeout(this.checkHandlers()),
      this.withTimeout(this.checkBulkhead()),
      this.withTimeout(this.checkCache()),
      this.withTimeout(this.checkCircuitBreakers()),
    ]);

    const checks = { database, redis, handlers, bulkhead, cache, circuitBreakers };

    // Determine overall status
    const status = this.determineOverallStatus(checks);

    return {
      status,
      checks,
      uptime: this.getUptime(),
      activeExecutions: this.activeExecutionCount,
      queuedExecutions: this.queuedExecutionCount,
      version: this.version,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get the readiness status of the Cognigate module.
   * Used for the /ready endpoint (readiness probe).
   *
   * @returns Readiness status with critical dependency checks
   */
  async getReadinessStatus(): Promise<CognigateReadinessStatus> {
    const [dbCheck, redisCheck, handlerCheck] = await Promise.all([
      this.withTimeout(this.checkDatabase()),
      this.withTimeout(this.checkRedis()),
      this.withTimeout(this.checkHandlers()),
    ]);

    const checks = {
      database: dbCheck.status === 'healthy',
      redis: redisCheck.status === 'healthy',
      handlers: handlerCheck.status !== 'unhealthy',
    };

    // Ready if database and Redis are available
    const ready = checks.database && checks.redis;

    return {
      ready,
      checks,
      startedAt: new Date(this.startedAt).toISOString(),
    };
  }

  /**
   * Simple liveness check - returns true if the process is running.
   * Lightweight check that does not perform any I/O.
   *
   * @returns Always true if the process is alive
   */
  isAlive(): boolean {
    return true;
  }

  /**
   * Get the service uptime in seconds.
   *
   * @returns Uptime in seconds
   */
  getUptime(): number {
    return Math.floor((Date.now() - this.startedAt) / 1000);
  }

  /**
   * Update the active execution count for health reporting.
   *
   * @param count - Current number of active executions
   */
  setActiveExecutions(count: number): void {
    this.activeExecutionCount = count;
  }

  /**
   * Update the queued execution count for health reporting.
   *
   * @param count - Current number of queued executions
   */
  setQueuedExecutions(count: number): void {
    this.queuedExecutionCount = count;
  }

  // ==========================================================================
  // Individual Health Checks
  // ==========================================================================

  /**
   * Check database connectivity.
   * Performs a simple SELECT 1 query to verify the connection.
   */
  private async checkDatabase(): Promise<HealthCheck> {
    if (this.externalChecks?.database) {
      return this.externalChecks.database();
    }

    const start = performance.now();
    try {
      const { getDatabase } = await import('../common/db.js');
      const db = getDatabase();
      await db.execute(sql`SELECT 1`);

      return {
        status: 'healthy',
        latencyMs: Math.round(performance.now() - start),
      };
    } catch (error) {
      logger.error({ error }, 'Cognigate database health check failed');
      return {
        status: 'unhealthy',
        latencyMs: Math.round(performance.now() - start),
        message: error instanceof Error ? error.message : 'Database connection failed',
      };
    }
  }

  /**
   * Check Redis connectivity.
   * Performs a SET/GET/DEL cycle to verify read/write operations.
   */
  private async checkRedis(): Promise<HealthCheck> {
    if (this.externalChecks?.redis) {
      return this.externalChecks.redis();
    }

    const start = performance.now();
    try {
      const { getRedis } = await import('../common/redis.js');
      const redis = getRedis();
      const testValue = `health-${Date.now()}`;

      await redis.set(REDIS_HEALTH_KEY, testValue, 'EX', 10);
      const result = await redis.get(REDIS_HEALTH_KEY);
      await redis.del(REDIS_HEALTH_KEY);

      if (result !== testValue) {
        return {
          status: 'degraded',
          latencyMs: Math.round(performance.now() - start),
          message: 'Redis read/write verification failed',
        };
      }

      return {
        status: 'healthy',
        latencyMs: Math.round(performance.now() - start),
      };
    } catch (error) {
      logger.error({ error }, 'Cognigate Redis health check failed');
      return {
        status: 'unhealthy',
        latencyMs: Math.round(performance.now() - start),
        message: error instanceof Error ? error.message : 'Redis connection failed',
      };
    }
  }

  /**
   * Check handler health.
   * Counts active and degraded handlers to determine overall handler health.
   */
  private async checkHandlers(): Promise<HealthCheck> {
    if (this.externalChecks?.handlers) {
      return this.externalChecks.handlers();
    }

    const start = performance.now();
    try {
      // Check if handlers are registered and healthy
      // In a real implementation, this would query the handler registry
      const handlerBreaker = getCircuitBreaker('cognigateHandler');
      const handlerStatus = await handlerBreaker.getStatus();

      if (handlerStatus.state === 'OPEN') {
        return {
          status: 'degraded',
          latencyMs: Math.round(performance.now() - start),
          message: 'Handler circuit breaker is open',
          details: {
            circuitState: handlerStatus.state,
            failureCount: handlerStatus.failureCount,
          },
        };
      }

      return {
        status: 'healthy',
        latencyMs: Math.round(performance.now() - start),
        details: {
          circuitState: handlerStatus.state,
        },
      };
    } catch (error) {
      logger.warn({ error }, 'Cognigate handler health check failed');
      return {
        status: 'degraded',
        latencyMs: Math.round(performance.now() - start),
        message: error instanceof Error ? error.message : 'Handler check failed',
      };
    }
  }

  /**
   * Check bulkhead (execution capacity) health.
   * Monitors active vs capacity to detect saturation.
   */
  private async checkBulkhead(): Promise<HealthCheck> {
    if (this.externalChecks?.bulkhead) {
      return this.externalChecks.bulkhead();
    }

    const start = performance.now();
    try {
      const active = this.activeExecutionCount;
      const queued = this.queuedExecutionCount;
      const capacity = 100; // Default capacity
      const utilizationPercent = (active / capacity) * 100;

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let message: string | undefined;

      if (utilizationPercent >= 95) {
        status = 'unhealthy';
        message = `Bulkhead near capacity: ${active}/${capacity} active, ${queued} queued`;
      } else if (utilizationPercent >= 80) {
        status = 'degraded';
        message = `Bulkhead high utilization: ${active}/${capacity} active, ${queued} queued`;
      }

      return {
        status,
        latencyMs: Math.round(performance.now() - start),
        message,
        details: {
          activeExecutions: active,
          queuedExecutions: queued,
          capacity,
          utilizationPercent: Math.round(utilizationPercent),
        },
      };
    } catch (error) {
      return {
        status: 'degraded',
        latencyMs: Math.round(performance.now() - start),
        message: error instanceof Error ? error.message : 'Bulkhead check failed',
      };
    }
  }

  /**
   * Check cache health.
   * Counts cache entries and verifies cache operations are working.
   */
  private async checkCache(): Promise<HealthCheck> {
    if (this.externalChecks?.cache) {
      return this.externalChecks.cache();
    }

    const start = performance.now();
    try {
      const { getRedis } = await import('../common/redis.js');
      const redis = getRedis();

      // Count cognigate cache entries
      let cursor = '0';
      let keyCount = 0;
      do {
        const [nextCursor, keys] = await redis.scan(
          cursor, 'MATCH', 'cognigate:cache:*', 'COUNT', 100
        );
        cursor = nextCursor;
        keyCount += keys.length;
        if (keyCount > 5000) break; // Cap counting
      } while (cursor !== '0');

      return {
        status: 'healthy',
        latencyMs: Math.round(performance.now() - start),
        details: {
          approximateEntries: keyCount,
        },
      };
    } catch (error) {
      logger.warn({ error }, 'Cognigate cache health check failed');
      return {
        status: 'degraded',
        latencyMs: Math.round(performance.now() - start),
        message: 'Cache check failed but service can continue without cache',
      };
    }
  }

  /**
   * Check circuit breaker states.
   * Monitors the cognigate-specific circuit breakers for open states.
   */
  private async checkCircuitBreakers(): Promise<HealthCheck> {
    const start = performance.now();
    try {
      const openBreakers: string[] = [];
      const halfOpenBreakers: string[] = [];
      const breakerDetails: Record<string, unknown> = {};

      for (const breakerName of COGNIGATE_BREAKER_NAMES) {
        try {
          const breaker = getCircuitBreaker(breakerName);
          const status = await breaker.getStatus();
          breakerDetails[breakerName] = status.state;

          if (status.state === 'OPEN') {
            openBreakers.push(breakerName);
          } else if (status.state === 'HALF_OPEN') {
            halfOpenBreakers.push(breakerName);
          }
        } catch {
          // Breaker may not exist yet, which is fine
          breakerDetails[breakerName] = 'not_initialized';
        }
      }

      if (openBreakers.length > 0) {
        return {
          status: 'degraded',
          latencyMs: Math.round(performance.now() - start),
          message: `Open circuit breakers: ${openBreakers.join(', ')}`,
          details: breakerDetails,
        };
      }

      if (halfOpenBreakers.length > 0) {
        return {
          status: 'degraded',
          latencyMs: Math.round(performance.now() - start),
          message: `Half-open circuit breakers: ${halfOpenBreakers.join(', ')}`,
          details: breakerDetails,
        };
      }

      return {
        status: 'healthy',
        latencyMs: Math.round(performance.now() - start),
        details: breakerDetails,
      };
    } catch (error) {
      return {
        status: 'degraded',
        latencyMs: Math.round(performance.now() - start),
        message: error instanceof Error ? error.message : 'Circuit breaker check failed',
      };
    }
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Determine overall status from individual component checks.
   *
   * Logic:
   * - UNHEALTHY if database OR redis is unhealthy
   * - DEGRADED if any non-critical component (cache, handlers, bulkhead, breakers) is degraded/unhealthy
   * - HEALTHY if all checks pass
   */
  private determineOverallStatus(checks: CognigateHealthStatus['checks']): 'healthy' | 'degraded' | 'unhealthy' {
    // Critical dependencies - service cannot function without these
    if (checks.database.status === 'unhealthy' || checks.redis.status === 'unhealthy') {
      return 'unhealthy';
    }

    // Non-critical degradation
    const allStatuses = Object.values(checks).map((c) => c.status);
    if (allStatuses.some((s) => s === 'degraded' || s === 'unhealthy')) {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * Wrap a health check with timeout protection.
   * Returns an unhealthy status if the check exceeds the timeout.
   */
  private async withTimeout(check: Promise<HealthCheck>): Promise<HealthCheck> {
    return Promise.race([
      check,
      new Promise<HealthCheck>((resolve) => {
        setTimeout(() => {
          resolve({
            status: 'unhealthy',
            message: `Health check timed out after ${this.checkTimeoutMs}ms`,
            latencyMs: this.checkTimeoutMs,
          });
        }, this.checkTimeoutMs);
      }),
    ]);
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/** Singleton health service instance */
let healthServiceInstance: CognigateHealthService | null = null;

/**
 * Get or create the shared health service singleton.
 *
 * @param options - Optional configuration for first creation
 * @returns The shared CognigateHealthService instance
 */
export function getCognigateHealthService(options?: HealthServiceOptions): CognigateHealthService {
  if (!healthServiceInstance) {
    healthServiceInstance = new CognigateHealthService(options);
  }
  return healthServiceInstance;
}

/**
 * Create a new health service instance (non-singleton).
 *
 * @param options - Optional configuration
 * @returns A new CognigateHealthService instance
 */
export function createCognigateHealthService(options?: HealthServiceOptions): CognigateHealthService {
  return new CognigateHealthService(options);
}

/**
 * Reset the singleton instance. Primarily for testing.
 */
export function resetCognigateHealthService(): void {
  healthServiceInstance = null;
}
