/**
 * Health Check Service for INTENT Module
 *
 * Provides /health (liveness) and /ready (readiness) endpoints
 * for Kubernetes probes and load balancer health checks.
 */

import { getRedis } from '../common/redis.js';
import { getDatabase, getPool } from '../common/db.js';
import { createLogger } from '../common/logger.js';
import { sql } from 'drizzle-orm';

const logger = createLogger({ component: 'intent-health' });

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: ComponentHealth;
    redis: ComponentHealth;
    queues: ComponentHealth;
  };
}

export interface ComponentHealth {
  status: 'ok' | 'degraded' | 'error';
  latencyMs?: number;
  message?: string;
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
  const [database, redis, queues] = await Promise.all([
    checkDatabaseHealth(),
    checkRedisHealth(),
    checkQueueHealth(),
  ]);

  const allOk =
    database.status === 'ok' && redis.status === 'ok' && queues.status === 'ok';
  const anyError =
    database.status === 'error' ||
    redis.status === 'error' ||
    queues.status === 'error';

  return {
    status: anyError ? 'unhealthy' : allOk ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.0.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks: { database, redis, queues },
  };
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
