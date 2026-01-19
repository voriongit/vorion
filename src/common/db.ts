/**
 * Database connections
 */

import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { getConfig } from './config.js';
import { createLogger } from './logger.js';
import { withTimeout } from './timeout.js';
import { InstrumentedPool } from './db-metrics.js';

const dbLogger = createLogger({ component: 'db' });

let pool: Pool | null = null;
let instrumentedPool: InstrumentedPool | null = null;
let database: NodePgDatabase | null = null;

/**
 * Lazily create Drizzle database connection backed by pg Pool.
 */
export function getDatabase(): NodePgDatabase {
  if (!database) {
    const config = getConfig();
    pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      user: config.database.user,
      password: config.database.password,
      min: config.database.poolMin,
      max: config.database.poolMax,
      idleTimeoutMillis: config.database.poolIdleTimeoutMs,
      connectionTimeoutMillis: config.database.poolConnectionTimeoutMs,
      allowExitOnIdle: true,
    });

    pool.on('error', (error) => {
      dbLogger.error({ error }, 'Database pool error');
    });

    // Wrap pool with metrics instrumentation
    instrumentedPool = new InstrumentedPool(pool);
    instrumentedPool.startMetricsCollection(config.database.metricsIntervalMs ?? 5000);

    database = drizzle(pool);
  }

  return database;
}

/**
 * Get the instrumented pool for direct query execution with metrics.
 * Returns null if database has not been initialized.
 */
export function getInstrumentedPool(): InstrumentedPool | null {
  return instrumentedPool;
}

/**
 * Get the raw pool for direct access (use sparingly).
 * Returns null if database has not been initialized.
 */
export function getPool(): Pool | null {
  return pool;
}

/**
 * Close pool (mainly for tests).
 */
export async function closeDatabase(): Promise<void> {
  if (instrumentedPool) {
    instrumentedPool.stopMetricsCollection();
    instrumentedPool = null;
  }
  if (pool) {
    await pool.end();
    pool = null;
    database = null;
  }
}

/**
 * Check database health by running a simple query.
 * Returns true if the database is healthy, false otherwise.
 *
 * @param timeoutMs - Optional timeout in milliseconds (defaults to config value)
 */
export async function checkDatabaseHealth(timeoutMs?: number): Promise<{
  healthy: boolean;
  latencyMs?: number;
  error?: string;
  timedOut?: boolean;
}> {
  if (!pool) {
    // Initialize the pool if not already done
    getDatabase();
  }

  if (!pool) {
    return { healthy: false, error: 'Pool not initialized' };
  }

  const config = getConfig();
  const timeout = timeoutMs ?? config.health.checkTimeoutMs;
  const start = performance.now();

  try {
    const result = await withTimeout(
      pool.query('SELECT 1 as health'),
      timeout,
      'Database health check timed out'
    );
    const latencyMs = Math.round(performance.now() - start);

    if (result.rows[0]?.health === 1) {
      return { healthy: true, latencyMs };
    }
    return { healthy: false, latencyMs, error: 'Unexpected query result' };
  } catch (error) {
    const latencyMs = Math.round(performance.now() - start);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isTimeout = errorMessage.includes('timed out');

    if (isTimeout) {
      dbLogger.warn({ latencyMs, timeoutMs: timeout }, 'Database health check timed out');
    }

    return {
      healthy: false,
      latencyMs,
      error: errorMessage,
      timedOut: isTimeout,
    };
  }
}
