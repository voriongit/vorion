/**
 * Database Connection Manager
 *
 * Provides PostgreSQL connection pool using node-postgres and Drizzle ORM.
 * Implements lazy initialization with connection health checks.
 *
 * @packageDocumentation
 */

import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, PoolConfig } from 'pg';
import { createLogger } from './logger.js';
import { getConfig } from './config.js';
import * as schema from '../db/schema/index.js';

const logger = createLogger({ component: 'database' });

export type Database = NodePgDatabase<typeof schema>;

let pool: Pool | null = null;
let db: Database | null = null;

/**
 * Build connection string from config
 */
function buildConnectionString(): string {
  const config = getConfig();
  const { host, port, name, user, password } = config.database;
  return `postgresql://${user}:${password}@${host}:${port}/${name}`;
}

/**
 * Get pool configuration
 */
function getPoolConfig(): PoolConfig {
  const config = getConfig();
  return {
    connectionString: process.env['DATABASE_URL'] ?? buildConnectionString(),
    min: config.database.poolMin,
    max: config.database.poolMax,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  };
}

/**
 * Initialize the database connection pool
 */
export async function initializeDatabase(): Promise<Database> {
  if (db) {
    return db;
  }

  const poolConfig = getPoolConfig();

  pool = new Pool(poolConfig);

  // Handle pool errors
  pool.on('error', (err) => {
    logger.error({ error: err.message }, 'Unexpected database pool error');
  });

  pool.on('connect', () => {
    logger.debug('New database connection established');
  });

  // Test connection
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    logger.info('Database connection verified');
  } catch (error) {
    logger.error({ error }, 'Failed to connect to database');
    throw error;
  }

  db = drizzle(pool, { schema });

  logger.info(
    {
      host: getConfig().database.host,
      database: getConfig().database.name,
      poolMin: getConfig().database.poolMin,
      poolMax: getConfig().database.poolMax,
    },
    'Database initialized'
  );

  return db;
}

/**
 * Get the database instance (lazy initialization)
 */
export async function getDatabase(): Promise<Database> {
  if (!db) {
    return initializeDatabase();
  }
  return db;
}

/**
 * Get the database instance synchronously (throws if not initialized)
 */
export function getDatabaseSync(): Database {
  if (!db) {
    throw new Error(
      'Database not initialized. Call initializeDatabase() first.'
    );
  }
  return db;
}

/**
 * Check database health
 */
export async function checkDatabaseHealth(): Promise<{
  healthy: boolean;
  latencyMs: number;
  poolStats: {
    total: number;
    idle: number;
    waiting: number;
  };
}> {
  if (!pool) {
    return {
      healthy: false,
      latencyMs: -1,
      poolStats: { total: 0, idle: 0, waiting: 0 },
    };
  }

  const start = Date.now();
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();

    return {
      healthy: true,
      latencyMs: Date.now() - start,
      poolStats: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount,
      },
    };
  } catch {
    return {
      healthy: false,
      latencyMs: Date.now() - start,
      poolStats: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount,
      },
    };
  }
}

/**
 * Close database connections
 */
export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
    logger.info('Database connections closed');
  }
}

/**
 * Execute a transaction
 */
export async function transaction<T>(
  fn: (tx: Database) => Promise<T>
): Promise<T> {
  const database = await getDatabase();

  // Drizzle handles transactions internally
  return database.transaction(fn);
}
