/**
 * Database connections
 */

import { Pool, PoolConfig } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { getConfig } from './config.js';
import { createLogger } from './logger.js';
import { withTimeout } from './timeout.js';
import { InstrumentedPool } from './db-metrics.js';
import { queryTimeouts } from '../intent/metrics.js';

const dbLogger = createLogger({ component: 'db' });

/** Default statement timeout for regular queries (30 seconds) */
export const DEFAULT_STATEMENT_TIMEOUT_MS = 30000;

/** Extended timeout for long-running queries like reports/exports (2 minutes) */
export const LONG_QUERY_TIMEOUT_MS = 120000;

/** Short timeout for health checks and quick operations (5 seconds) */
export const SHORT_QUERY_TIMEOUT_MS = 5000;

let pool: Pool | null = null;
let instrumentedPool: InstrumentedPool | null = null;
let database: NodePgDatabase | null = null;

/**
 * Options for database query execution
 */
export interface QueryOptions {
  /** Statement timeout in milliseconds */
  statementTimeout?: number;
}

/**
 * Lazily create Drizzle database connection backed by pg Pool.
 */
export function getDatabase(): NodePgDatabase {
  if (!database) {
    const config = getConfig();

    const poolConfig: PoolConfig = {
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
      // Set default statement timeout at pool level
      statement_timeout: config.database.statementTimeoutMs,
    };

    pool = new Pool(poolConfig);

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

/**
 * Error thrown when a database statement exceeds its timeout.
 * PostgreSQL error code 57014 (query_canceled) is returned when statement_timeout is exceeded.
 */
export class StatementTimeoutError extends Error {
  public readonly code = 'STATEMENT_TIMEOUT';
  public readonly timeoutMs: number;
  public readonly operation: string;

  constructor(message: string, timeoutMs: number, operation: string) {
    super(message);
    this.name = 'StatementTimeoutError';
    this.timeoutMs = timeoutMs;
    this.operation = operation;
  }
}

/**
 * Check if an error is a PostgreSQL statement timeout error.
 * PostgreSQL returns error code 57014 (query_canceled) when statement_timeout is exceeded.
 */
export function isStatementTimeoutError(error: unknown): boolean {
  if (error instanceof StatementTimeoutError) {
    return true;
  }
  if (error instanceof Error) {
    const pgError = error as { code?: string };
    // PostgreSQL error code for query_canceled (includes statement_timeout)
    return pgError.code === '57014';
  }
  return false;
}

/**
 * Execute a database operation with a specific statement timeout.
 * Uses PostgreSQL's SET LOCAL statement_timeout within a transaction
 * to apply the timeout only to the current operation.
 *
 * @param fn - The database operation to execute
 * @param timeoutMs - Statement timeout in milliseconds
 * @param operationName - Name of the operation for metrics/logging
 * @returns The result of the database operation
 * @throws StatementTimeoutError if the operation exceeds the timeout
 *
 * @example
 * ```typescript
 * // Regular query with default timeout
 * const intents = await withStatementTimeout(
 *   async () => db.select().from(intents).limit(100),
 *   DEFAULT_STATEMENT_TIMEOUT_MS,
 *   'listIntents'
 * );
 *
 * // Long-running export with extended timeout
 * const exportData = await withStatementTimeout(
 *   async () => db.select().from(userDataExport).where(...),
 *   LONG_QUERY_TIMEOUT_MS,
 *   'exportAllUserData'
 * );
 * ```
 */
export async function withStatementTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number = DEFAULT_STATEMENT_TIMEOUT_MS,
  operationName: string = 'unknown'
): Promise<T> {
  const db = getDatabase();
  const config = getConfig();
  const effectiveTimeout = timeoutMs ?? config.database.statementTimeoutMs;

  try {
    // Execute within a transaction to scope the statement_timeout
    return await db.transaction(async (tx) => {
      // Set statement timeout for this transaction only
      // SET LOCAL only affects the current transaction
      await tx.execute(sql`SET LOCAL statement_timeout = ${effectiveTimeout}`);

      dbLogger.debug(
        { operation: operationName, timeoutMs: effectiveTimeout },
        'Executing query with statement timeout'
      );

      return await fn();
    });
  } catch (error) {
    // Check if this is a statement timeout error
    if (isStatementTimeoutError(error)) {
      dbLogger.warn(
        { operation: operationName, timeoutMs: effectiveTimeout, error },
        'Database query exceeded statement timeout'
      );

      // Record timeout metric
      queryTimeouts.inc({ operation: operationName });

      throw new StatementTimeoutError(
        `Query '${operationName}' exceeded statement timeout of ${effectiveTimeout}ms`,
        effectiveTimeout,
        operationName
      );
    }

    // Re-throw other errors
    throw error;
  }
}

/**
 * Execute a database operation with the long query timeout.
 * Convenience wrapper for operations like reports and data exports.
 *
 * @param fn - The database operation to execute
 * @param operationName - Name of the operation for metrics/logging
 * @returns The result of the database operation
 */
export async function withLongQueryTimeout<T>(
  fn: () => Promise<T>,
  operationName: string = 'longQuery'
): Promise<T> {
  return withStatementTimeout(fn, LONG_QUERY_TIMEOUT_MS, operationName);
}
