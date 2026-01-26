/**
 * Phase 6 Database Client
 *
 * Production-ready database connection with pooling, retries, and health checks
 */

import { Pool, PoolClient, PoolConfig, QueryResult } from 'pg';

// =============================================================================
// Types
// =============================================================================

export interface DatabaseConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean | { rejectUnauthorized: boolean };
  // Pool settings
  min?: number;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
  // Custom settings
  statementTimeout?: number;
  queryTimeout?: number;
  retries?: number;
  retryDelay?: number;
}

export interface QueryOptions {
  timeout?: number;
  retries?: number;
  name?: string; // For prepared statements
}

export interface TransactionOptions {
  isolationLevel?: 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';
  readOnly?: boolean;
  deferrable?: boolean;
}

export interface DatabaseHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyMs: number;
  poolSize: number;
  availableConnections: number;
  waitingClients: number;
  version?: string;
}

export interface DatabaseMetrics {
  totalQueries: number;
  failedQueries: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  activeConnections: number;
  idleConnections: number;
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: Partial<DatabaseConfig> = {
  min: 2,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  statementTimeout: 30000,
  queryTimeout: 30000,
  retries: 3,
  retryDelay: 1000,
};

// =============================================================================
// Metrics Tracking
// =============================================================================

class MetricsTracker {
  private queryCount = 0;
  private failedCount = 0;
  private latencies: number[] = [];
  private maxLatencies = 1000;

  recordQuery(latencyMs: number, success: boolean): void {
    this.queryCount++;
    if (!success) this.failedCount++;

    this.latencies.push(latencyMs);
    if (this.latencies.length > this.maxLatencies) {
      this.latencies.shift();
    }
  }

  getMetrics(): Omit<DatabaseMetrics, 'activeConnections' | 'idleConnections'> {
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const avg = sorted.length > 0
      ? sorted.reduce((a, b) => a + b, 0) / sorted.length
      : 0;

    return {
      totalQueries: this.queryCount,
      failedQueries: this.failedCount,
      avgLatencyMs: Math.round(avg),
      p95LatencyMs: sorted[Math.floor(sorted.length * 0.95)] || 0,
      p99LatencyMs: sorted[Math.floor(sorted.length * 0.99)] || 0,
    };
  }

  reset(): void {
    this.queryCount = 0;
    this.failedCount = 0;
    this.latencies = [];
  }
}

// =============================================================================
// Database Client
// =============================================================================

export class DatabaseClient {
  private pool: Pool;
  private config: DatabaseConfig;
  private metrics: MetricsTracker;
  private initialized = false;

  constructor(config: DatabaseConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.metrics = new MetricsTracker();

    const poolConfig: PoolConfig = {
      connectionString: this.config.connectionString,
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      ssl: this.config.ssl,
      min: this.config.min,
      max: this.config.max,
      idleTimeoutMillis: this.config.idleTimeoutMillis,
      connectionTimeoutMillis: this.config.connectionTimeoutMillis,
    };

    this.pool = new Pool(poolConfig);

    // Handle pool errors
    this.pool.on('error', (err) => {
      console.error('[Database] Pool error:', err.message);
    });

    this.pool.on('connect', () => {
      console.debug('[Database] New client connected');
    });
  }

  /**
   * Initialize the database connection and run setup queries
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Test connection
    const client = await this.pool.connect();
    try {
      // Set session parameters
      if (this.config.statementTimeout) {
        await client.query(
          `SET statement_timeout = ${this.config.statementTimeout}`
        );
      }

      // Verify connection
      const result = await client.query('SELECT version()');
      console.log('[Database] Connected:', result.rows[0].version.split(' ')[0]);

      this.initialized = true;
    } finally {
      client.release();
    }
  }

  /**
   * Execute a query with automatic retries and metrics
   */
  async query<T = unknown>(
    sql: string,
    params?: unknown[],
    options: QueryOptions = {}
  ): Promise<QueryResult<T>> {
    const retries = options.retries ?? this.config.retries ?? 3;
    const timeout = options.timeout ?? this.config.queryTimeout;

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= retries; attempt++) {
      const startTime = Date.now();

      try {
        const client = await this.pool.connect();

        try {
          // Set query timeout
          if (timeout) {
            await client.query(`SET statement_timeout = ${timeout}`);
          }

          // Execute query
          const result = await client.query<T>({
            text: sql,
            values: params,
            name: options.name,
          });

          const latency = Date.now() - startTime;
          this.metrics.recordQuery(latency, true);

          return result;
        } finally {
          client.release();
        }
      } catch (error) {
        const latency = Date.now() - startTime;
        this.metrics.recordQuery(latency, false);
        lastError = error as Error;

        // Don't retry certain errors
        const errorCode = (error as { code?: string }).code;
        if (
          errorCode === '23505' || // Unique violation
          errorCode === '23503' || // Foreign key violation
          errorCode === '42P01' || // Undefined table
          errorCode === '42703'    // Undefined column
        ) {
          throw error;
        }

        // Wait before retry
        if (attempt < retries) {
          const delay = this.config.retryDelay! * Math.pow(2, attempt);
          await sleep(delay);
          console.warn(
            `[Database] Query retry ${attempt + 1}/${retries} after ${delay}ms`
          );
        }
      }
    }

    throw lastError;
  }

  /**
   * Execute a query and return the first row
   */
  async queryOne<T = unknown>(
    sql: string,
    params?: unknown[],
    options?: QueryOptions
  ): Promise<T | null> {
    const result = await this.query<T>(sql, params, options);
    return result.rows[0] || null;
  }

  /**
   * Execute a query and return all rows
   */
  async queryAll<T = unknown>(
    sql: string,
    params?: unknown[],
    options?: QueryOptions
  ): Promise<T[]> {
    const result = await this.query<T>(sql, params, options);
    return result.rows;
  }

  /**
   * Execute multiple queries in a transaction
   */
  async transaction<T>(
    fn: (client: TransactionClient) => Promise<T>,
    options: TransactionOptions = {}
  ): Promise<T> {
    const client = await this.pool.connect();
    const txClient = new TransactionClient(client);

    try {
      // Start transaction with options
      let beginSql = 'BEGIN';
      if (options.isolationLevel) {
        beginSql += ` ISOLATION LEVEL ${options.isolationLevel}`;
      }
      if (options.readOnly) {
        beginSql += ' READ ONLY';
      }
      if (options.deferrable) {
        beginSql += ' DEFERRABLE';
      }

      await client.query(beginSql);

      const result = await fn(txClient);

      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check database health
   */
  async healthCheck(): Promise<DatabaseHealth> {
    const startTime = Date.now();

    try {
      const result = await this.query<{ version: string }>(
        'SELECT version()',
        [],
        { timeout: 5000, retries: 0 }
      );

      const latency = Date.now() - startTime;
      const poolStatus = this.getPoolStatus();

      return {
        status: latency < 100 ? 'healthy' : latency < 500 ? 'degraded' : 'unhealthy',
        latencyMs: latency,
        poolSize: poolStatus.total,
        availableConnections: poolStatus.idle,
        waitingClients: poolStatus.waiting,
        version: result.rows[0]?.version?.split(' ')[1],
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latencyMs: Date.now() - startTime,
        poolSize: 0,
        availableConnections: 0,
        waitingClients: 0,
      };
    }
  }

  /**
   * Get pool status
   */
  getPoolStatus(): { total: number; idle: number; waiting: number } {
    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
    };
  }

  /**
   * Get database metrics
   */
  getMetrics(): DatabaseMetrics {
    const poolStatus = this.getPoolStatus();
    const queryMetrics = this.metrics.getMetrics();

    return {
      ...queryMetrics,
      activeConnections: poolStatus.total - poolStatus.idle,
      idleConnections: poolStatus.idle,
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics.reset();
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    await this.pool.end();
    this.initialized = false;
  }
}

// =============================================================================
// Transaction Client
// =============================================================================

export class TransactionClient {
  constructor(private client: PoolClient) {}

  async query<T = unknown>(
    sql: string,
    params?: unknown[]
  ): Promise<QueryResult<T>> {
    return this.client.query<T>(sql, params);
  }

  async queryOne<T = unknown>(
    sql: string,
    params?: unknown[]
  ): Promise<T | null> {
    const result = await this.query<T>(sql, params);
    return result.rows[0] || null;
  }

  async queryAll<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
    const result = await this.query<T>(sql, params);
    return result.rows;
  }
}

// =============================================================================
// Repository Base Class
// =============================================================================

export abstract class Repository<T, ID = string> {
  constructor(
    protected db: DatabaseClient,
    protected tableName: string
  ) {}

  protected abstract mapRow(row: Record<string, unknown>): T;

  async findById(id: ID): Promise<T | null> {
    const row = await this.db.queryOne<Record<string, unknown>>(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    return row ? this.mapRow(row) : null;
  }

  async findAll(options?: { limit?: number; offset?: number }): Promise<T[]> {
    let sql = `SELECT * FROM ${this.tableName}`;
    const params: unknown[] = [];

    if (options?.limit) {
      sql += ` LIMIT $${params.length + 1}`;
      params.push(options.limit);
    }

    if (options?.offset) {
      sql += ` OFFSET $${params.length + 1}`;
      params.push(options.offset);
    }

    const rows = await this.db.queryAll<Record<string, unknown>>(sql, params);
    return rows.map((row) => this.mapRow(row));
  }

  async count(where?: string, params?: unknown[]): Promise<number> {
    let sql = `SELECT COUNT(*) FROM ${this.tableName}`;
    if (where) {
      sql += ` WHERE ${where}`;
    }

    const result = await this.db.queryOne<{ count: string }>(sql, params);
    return parseInt(result?.count || '0', 10);
  }

  async exists(id: ID): Promise<boolean> {
    const result = await this.db.queryOne<{ exists: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM ${this.tableName} WHERE id = $1)`,
      [id]
    );
    return result?.exists || false;
  }

  async deleteById(id: ID): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let dbInstance: DatabaseClient | null = null;

export function getDatabase(): DatabaseClient {
  if (!dbInstance) {
    dbInstance = new DatabaseClient({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false,
    });
  }
  return dbInstance;
}

export async function initializeDatabase(): Promise<DatabaseClient> {
  const db = getDatabase();
  await db.initialize();
  return db;
}

export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
  }
}

// =============================================================================
// Utilities
// =============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
// Exports
// =============================================================================

export const database = {
  getDatabase,
  initialize: initializeDatabase,
  close: closeDatabase,
};
