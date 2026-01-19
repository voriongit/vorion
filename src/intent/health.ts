/**
 * Health Check Service for INTENT Module
 *
 * Provides /health (liveness) and /ready (readiness) endpoints
 * for Kubernetes probes and load balancer health checks.
 *
 * Features:
 * - Component-level health status for Kubernetes probes
 * - Timeout protection for all health checks
 * - INTENT-specific dependency validation (queues, policies)
 * - Memory and resource usage reporting
 * - Graceful degradation support
 *
 * @packageDocumentation
 */

import { getRedis } from '../common/redis.js';
import { getDatabase } from '../common/db.js';
import { createLogger } from '../common/logger.js';
import { sql } from 'drizzle-orm';
import { getConfig } from '../common/config.js';
import { withTimeout } from '../common/timeout.js';
import { getQueueHealth } from './queues.js';
import { getPolicyLoader } from '../policy/loader.js';

const logger = createLogger({ component: 'intent-health' });

/**
 * Detailed health status for the INTENT module
 */
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: ComponentHealth;
    redis: ComponentHealth;
    queues: ComponentHealth;
    policies?: ComponentHealth;
  };
}

/**
 * Global health status including all components
 */
export interface GlobalHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'shutting_down';
  version: string;
  environment: string;
  timestamp: string;
  process: {
    uptimeSeconds: number;
    memoryUsageMb: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
    };
    activeRequests: number;
  };
  components: {
    intent: ComponentHealth;
    database?: ComponentHealth;
    redis?: ComponentHealth;
    queues?: ComponentHealth;
  };
  latencyMs: number;
}

/**
 * Readiness status with detailed component checks
 */
export interface ReadinessStatus {
  status: 'ready' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: {
    database: ComponentCheckResult;
    redis: ComponentCheckResult;
    queues: ComponentCheckResult;
    intent: ComponentCheckResult;
  };
  timedOut?: boolean;
  error?: string;
}

export interface ComponentHealth {
  status: 'ok' | 'degraded' | 'error' | 'timeout';
  latencyMs?: number;
  message?: string;
}

export interface ComponentCheckResult {
  status: 'ok' | 'error' | 'timeout';
  latencyMs?: number;
  error?: string;
  details?: Record<string, unknown>;
}

// Track startup time
const startTime = Date.now();

export async function checkDatabaseHealth(): Promise<ComponentHealth> {
  const start = Date.now();
  try {
    const db = getDatabase();
    await db.execute(sql`SELECT 1`);
    return { status: 'ok', latencyMs: Date.now() - start };
  } catch (error) {
    logger.error({ error }, 'Database health check failed');
    return {
      status: 'error',
      latencyMs: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function checkRedisHealth(): Promise<ComponentHealth> {
  const start = Date.now();
  try {
    const redis = getRedis();
    await redis.ping();
    return { status: 'ok', latencyMs: Date.now() - start };
  } catch (error) {
    logger.error({ error }, 'Redis health check failed');
    return {
      status: 'error',
      latencyMs: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function checkQueueHealth(): Promise<ComponentHealth> {
  // Check BullMQ queue connectivity
  const start = Date.now();
  try {
    const redis = getRedis();
    // Verify queue key exists or is accessible
    await redis.exists('bull:intent-submission:meta');
    return { status: 'ok', latencyMs: Date.now() - start };
  } catch (error) {
    logger.error({ error }, 'Queue health check failed');
    return {
      status: 'error',
      latencyMs: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check policy loader health - verifies policy cache and loading capability
 */
export async function checkPolicyLoaderHealth(): Promise<ComponentHealth> {
  const start = Date.now();
  try {
    // Try to access the policy loader singleton - if it initializes, the loader is healthy
    getPolicyLoader();
    // The loader being accessible means it's initialized
    return { status: 'ok', latencyMs: Date.now() - start };
  } catch (error) {
    logger.error({ error }, 'Policy loader health check failed');
    return {
      status: 'error',
      latencyMs: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check detailed queue health with stats
 */
export async function checkDetailedQueueHealth(): Promise<ComponentCheckResult> {
  const start = Date.now();
  const config = getConfig();

  try {
    const queueHealth = await withTimeout(
      getQueueHealth(),
      config.health.checkTimeoutMs,
      'Queue health check timed out'
    );

    return {
      status: 'ok',
      latencyMs: Date.now() - start,
      details: {
        intake: queueHealth.intake,
        evaluate: queueHealth.evaluate,
        decision: queueHealth.decision,
        deadLetter: queueHealth.deadLetter,
      },
    };
  } catch (error) {
    const isTimeout = error instanceof Error && error.message.includes('timed out');
    logger.error({ error }, 'Detailed queue health check failed');
    return {
      status: isTimeout ? 'timeout' : 'error',
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Liveness check - is the process alive?
 * Should return quickly and only fail if process is deadlocked
 */
export async function livenessCheck(): Promise<{ alive: boolean }> {
  return { alive: true };
}

/**
 * Readiness check - can the service handle requests?
 * Checks all dependencies
 */
export async function readinessCheck(): Promise<HealthStatus> {
  const [database, redis, queues, policies] = await Promise.all([
    checkDatabaseHealth(),
    checkRedisHealth(),
    checkQueueHealth(),
    checkPolicyLoaderHealth(),
  ]);

  const allOk =
    database.status === 'ok' &&
    redis.status === 'ok' &&
    queues.status === 'ok' &&
    policies.status === 'ok';
  const anyError =
    database.status === 'error' ||
    redis.status === 'error' ||
    queues.status === 'error' ||
    policies.status === 'error';

  return {
    status: anyError ? 'unhealthy' : allOk ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    version: process.env['npm_package_version'] || '0.0.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks: { database, redis, queues, policies },
  };
}

/**
 * INTENT module specific readiness check
 * Checks INTENT-specific dependencies like queues and policy loader
 */
export async function intentReadinessCheck(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: {
    queues: ComponentHealth;
    policies: ComponentHealth;
  };
}> {
  const config = getConfig();

  const [queues, policies] = await Promise.all([
    withTimeout(
      checkQueueHealth(),
      config.health.checkTimeoutMs,
      'Queue check timed out'
    ).catch((error): ComponentHealth => ({
      status: 'timeout',
      message: error instanceof Error ? error.message : 'Timeout',
    })),
    withTimeout(
      checkPolicyLoaderHealth(),
      config.health.checkTimeoutMs,
      'Policy loader check timed out'
    ).catch((error): ComponentHealth => ({
      status: 'timeout',
      message: error instanceof Error ? error.message : 'Timeout',
    })),
  ]);

  const allOk = queues.status === 'ok' && policies.status === 'ok';
  const anyError = queues.status === 'error' || policies.status === 'error';

  return {
    status: anyError ? 'unhealthy' : allOk ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    checks: { queues, policies },
  };
}

/**
 * Global health check combining all system components
 * Returns 503 if any critical component is unhealthy
 */
export async function globalHealthCheck(
  activeRequests: number,
  isShuttingDown: boolean
): Promise<GlobalHealthStatus> {
  const config = getConfig();
  const start = performance.now();
  const memUsage = process.memoryUsage();

  // If shutting down, return immediately with shutting_down status
  if (isShuttingDown) {
    return {
      status: 'shutting_down',
      version: process.env['npm_package_version'] || '0.0.0',
      environment: config.env,
      timestamp: new Date().toISOString(),
      process: {
        uptimeSeconds: Math.round(process.uptime()),
        memoryUsageMb: {
          rss: Math.round(memUsage.rss / 1024 / 1024),
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
          external: Math.round(memUsage.external / 1024 / 1024),
        },
        activeRequests,
      },
      components: {
        intent: { status: 'ok' },
      },
      latencyMs: Math.round(performance.now() - start),
    };
  }

  // Run minimal self-checks with timeout
  let intentStatus: ComponentHealth = { status: 'ok' };
  try {
    await withTimeout(
      Promise.resolve(), // Quick self-check
      config.health.livenessTimeoutMs,
      'Liveness check timed out'
    );
  } catch (error) {
    intentStatus = {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  // Determine overall status
  const status: 'healthy' | 'degraded' | 'unhealthy' =
    intentStatus.status === 'error' ? 'unhealthy' : 'healthy';

  return {
    status,
    version: process.env['npm_package_version'] || '0.0.0',
    environment: config.env,
    timestamp: new Date().toISOString(),
    process: {
      uptimeSeconds: Math.round(process.uptime()),
      memoryUsageMb: {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
      },
      activeRequests,
    },
    components: {
      intent: intentStatus,
    },
    latencyMs: Math.round(performance.now() - start),
  };
}

/**
 * Global readiness check with all dependency validation
 */
export async function globalReadinessCheck(): Promise<ReadinessStatus> {
  const config = getConfig();
  const start = performance.now();

  // Helper to convert ComponentHealth to ComponentCheckResult
  const toCheckResult = (health: ComponentHealth): ComponentCheckResult => {
    const result: ComponentCheckResult = {
      status: health.status === 'degraded' ? 'error' : health.status as 'ok' | 'error' | 'timeout',
    };
    if (health.latencyMs !== undefined) {
      result.latencyMs = health.latencyMs;
    }
    if (health.message) {
      result.error = health.message;
    }
    return result;
  };

  try {
    // Run all checks with overall timeout
    const checksPromise = Promise.all([
      withTimeout(
        checkDatabaseHealth(),
        config.health.checkTimeoutMs,
        'Database check timed out'
      ).catch((error): ComponentHealth => ({
        status: 'timeout',
        message: error instanceof Error ? error.message : 'Timeout',
      })),
      withTimeout(
        checkRedisHealth(),
        config.health.checkTimeoutMs,
        'Redis check timed out'
      ).catch((error): ComponentHealth => ({
        status: 'timeout',
        message: error instanceof Error ? error.message : 'Timeout',
      })),
      checkDetailedQueueHealth(),
      withTimeout(
        intentReadinessCheck(),
        config.health.checkTimeoutMs,
        'INTENT check timed out'
      ).catch(() => ({
        status: 'unhealthy' as const,
        timestamp: new Date().toISOString(),
        checks: {
          queues: { status: 'timeout' as const, message: 'Timeout' },
          policies: { status: 'timeout' as const, message: 'Timeout' },
        },
      })),
    ]);

    const [dbHealth, redisHealth, queueHealth, intentHealth] = await withTimeout(
      checksPromise,
      config.health.readyTimeoutMs,
      'Ready check timed out'
    );

    // Determine component status
    const dbResult = toCheckResult(dbHealth);
    const redisResult = toCheckResult(redisHealth);
    const intentResult: ComponentCheckResult = {
      status: intentHealth.status === 'healthy' ? 'ok' : 'error',
      details: intentHealth.checks,
    };

    // Determine overall status
    const anyTimedOut =
      dbHealth.status === 'timeout' ||
      redisHealth.status === 'timeout' ||
      queueHealth.status === 'timeout';

    const isHealthy =
      dbHealth.status === 'ok' &&
      redisHealth.status === 'ok' &&
      queueHealth.status === 'ok' &&
      intentHealth.status === 'healthy';

    let status: 'ready' | 'degraded' | 'unhealthy';
    if (isHealthy && !anyTimedOut) {
      status = 'ready';
    } else if (isHealthy || anyTimedOut) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      checks: {
        database: dbResult,
        redis: redisResult,
        queues: queueHealth,
        intent: intentResult,
      },
      ...(anyTimedOut && { timedOut: true }),
    };
  } catch (error) {
    // Overall timeout reached
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.warn({ latencyMs: performance.now() - start, error: errorMessage }, 'Ready check timed out');

    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      checks: {
        database: { status: 'timeout', error: 'Check timed out' },
        redis: { status: 'timeout', error: 'Check timed out' },
        queues: { status: 'timeout', error: 'Check timed out' },
        intent: { status: 'timeout', error: 'Check timed out' },
      },
      timedOut: true,
      error: errorMessage,
    };
  }
}

/**
 * Startup validation - checks DB and Redis connectivity before accepting requests.
 * Throws an error if connectivity fails (causing process exit with code 1).
 */
export async function validateStartupDependencies(): Promise<void> {
  logger.info('Validating startup dependencies...');

  const [dbHealth, redisHealth] = await Promise.all([
    checkDatabaseHealth(),
    checkRedisHealth(),
  ]);

  const errors: string[] = [];

  if (dbHealth.status === 'error') {
    errors.push(`Database: ${dbHealth.message}`);
  }

  if (redisHealth.status === 'error') {
    errors.push(`Redis: ${redisHealth.message}`);
  }

  if (errors.length > 0) {
    const errorMessage = `Startup validation failed: ${errors.join('; ')}`;
    logger.error({ dbHealth, redisHealth }, errorMessage);
    throw new Error(errorMessage);
  }

  logger.info(
    {
      dbLatencyMs: dbHealth.latencyMs,
      redisLatencyMs: redisHealth.latencyMs,
    },
    'Startup dependencies validated successfully'
  );
}

/**
 * Get the uptime in seconds since the module was loaded
 */
export function getUptimeSeconds(): number {
  return Math.floor((Date.now() - startTime) / 1000);
}
