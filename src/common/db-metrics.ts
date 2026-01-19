/**
 * Database Metrics Wrapper
 *
 * Provides instrumentation for database operations, capturing query timing,
 * success/failure counts, and connection pool metrics.
 */

import type { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import {
  dbQueryDuration,
  dbQueryTotal,
  dbQueryErrorsTotal,
  dbPoolConnectionsActive,
  dbPoolConnectionsIdle,
  dbPoolConnectionsWaiting,
  detectOperationType,
  recordDbQuery,
  recordDbQueryError,
  updateDbPoolMetrics,
  type DbOperationType,
} from '../intent/metrics.js';

/**
 * Wraps a pg Pool to instrument queries with metrics
 */
export class InstrumentedPool {
  private pool: Pool;
  private metricsInterval: NodeJS.Timeout | null = null;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Start periodic collection of pool metrics
   */
  startMetricsCollection(intervalMs: number = 5000): void {
    if (this.metricsInterval) {
      return;
    }

    this.metricsInterval = setInterval(() => {
      this.collectPoolMetrics();
    }, intervalMs);

    // Collect immediately
    this.collectPoolMetrics();
  }

  /**
   * Stop periodic metrics collection
   */
  stopMetricsCollection(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
  }

  /**
   * Collect current pool metrics
   */
  collectPoolMetrics(): void {
    // pg Pool exposes these properties
    const totalCount = this.pool.totalCount;
    const idleCount = this.pool.idleCount;
    const waitingCount = this.pool.waitingCount;

    // Active = total - idle
    const activeCount = totalCount - idleCount;

    updateDbPoolMetrics(activeCount, idleCount, waitingCount);
  }

  /**
   * Execute a query with metrics instrumentation
   */
  async query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[]
  ): Promise<QueryResult<R>> {
    const operation = detectOperationType(text);
    const startTime = performance.now();

    try {
      const result = await this.pool.query<R>(text, values);
      const durationSeconds = (performance.now() - startTime) / 1000;
      recordDbQuery(operation, durationSeconds);
      return result;
    } catch (error) {
      const errorType = getErrorType(error);
      recordDbQueryError(operation, errorType);
      throw error;
    }
  }

  /**
   * Get an instrumented client from the pool
   */
  async connect(): Promise<InstrumentedPoolClient> {
    const client = await this.pool.connect();
    return new InstrumentedPoolClient(client);
  }

  /**
   * Get the underlying pool (for advanced usage)
   */
  getPool(): Pool {
    return this.pool;
  }

  /**
   * End the pool connection
   */
  async end(): Promise<void> {
    this.stopMetricsCollection();
    await this.pool.end();
  }
}

/**
 * Wraps a pg PoolClient to instrument queries with metrics
 */
export class InstrumentedPoolClient {
  private client: PoolClient;

  constructor(client: PoolClient) {
    this.client = client;
  }

  /**
   * Execute a query with metrics instrumentation
   */
  async query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[]
  ): Promise<QueryResult<R>> {
    const operation = detectOperationType(text);
    const startTime = performance.now();

    try {
      const result = await this.client.query<R>(text, values);
      const durationSeconds = (performance.now() - startTime) / 1000;
      recordDbQuery(operation, durationSeconds);
      return result;
    } catch (error) {
      const errorType = getErrorType(error);
      recordDbQueryError(operation, errorType);
      throw error;
    }
  }

  /**
   * Release the client back to the pool
   */
  release(err?: Error | boolean): void {
    this.client.release(err);
  }

  /**
   * Get the underlying client (for advanced usage)
   */
  getClient(): PoolClient {
    return this.client;
  }
}

/**
 * Extract error type from an error for metrics labeling
 */
function getErrorType(error: unknown): string {
  if (error instanceof Error) {
    // PostgreSQL error codes
    const pgError = error as { code?: string };
    if (pgError.code) {
      // Map common Postgres error codes to readable types
      switch (pgError.code) {
        case '23505': return 'unique_violation';
        case '23503': return 'foreign_key_violation';
        case '23502': return 'not_null_violation';
        case '23514': return 'check_violation';
        case '42P01': return 'undefined_table';
        case '42703': return 'undefined_column';
        case '57014': return 'query_canceled';
        case '40001': return 'serialization_failure';
        case '40P01': return 'deadlock_detected';
        case '08006': return 'connection_failure';
        case '08001': return 'connection_refused';
        case '08004': return 'connection_rejected';
        case '57P01': return 'admin_shutdown';
        default: return `pg_${pgError.code}`;
      }
    }
    // Connection/network errors
    if (error.message.includes('timeout')) return 'timeout';
    if (error.message.includes('ECONNREFUSED')) return 'connection_refused';
    if (error.message.includes('ENOTFOUND')) return 'host_not_found';
    return 'unknown';
  }
  return 'unknown';
}

/**
 * Wrap a database query function with metrics instrumentation.
 * Useful for instrumenting existing code without changing structure.
 */
export function withDbMetrics<T>(
  operation: DbOperationType,
  queryFn: () => Promise<T>
): Promise<T> {
  const startTime = performance.now();

  return queryFn()
    .then((result) => {
      const durationSeconds = (performance.now() - startTime) / 1000;
      recordDbQuery(operation, durationSeconds);
      return result;
    })
    .catch((error) => {
      const errorType = getErrorType(error);
      recordDbQueryError(operation, errorType);
      throw error;
    });
}

/**
 * Timer helper for measuring query duration.
 * Useful for instrumenting Drizzle ORM queries.
 */
export class DbQueryTimer {
  private startTime: number;
  private operation: DbOperationType;

  constructor(operation: DbOperationType) {
    this.operation = operation;
    this.startTime = performance.now();
  }

  /**
   * Record success and return the duration in seconds
   */
  success(): number {
    const durationSeconds = (performance.now() - this.startTime) / 1000;
    recordDbQuery(this.operation, durationSeconds);
    return durationSeconds;
  }

  /**
   * Record failure
   */
  failure(error: unknown): void {
    const errorType = getErrorType(error);
    recordDbQueryError(this.operation, errorType);
  }
}

/**
 * Create a timer for measuring query duration
 */
export function startDbQueryTimer(operation: DbOperationType): DbQueryTimer {
  return new DbQueryTimer(operation);
}
