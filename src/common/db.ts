/**
 * Database connections
 */

import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { getConfig } from './config.js';
import { createLogger } from './logger.js';

const dbLogger = createLogger({ component: 'db' });

let pool: Pool | null = null;
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
      allowExitOnIdle: true,
    });

    pool.on('error', (error) => {
      dbLogger.error({ error }, 'Database pool error');
    });

    database = drizzle(pool);
  }

  return database;
}

/**
 * Close pool (mainly for tests).
 */
export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    database = null;
  }
}

/**
 * Check database health by running a simple query.
 * Returns true if the database is healthy, false otherwise.
 */
export async function checkDatabaseHealth(): Promise<{
  healthy: boolean;
  latencyMs?: number;
  error?: string;
}> {
  if (!pool) {
    // Initialize the pool if not already done
    getDatabase();
  }

  if (!pool) {
    return { healthy: false, error: 'Pool not initialized' };
  }

  const start = performance.now();
  try {
    const result = await pool.query('SELECT 1 as health');
    const latencyMs = Math.round(performance.now() - start);

    if (result.rows[0]?.health === 1) {
      return { healthy: true, latencyMs };
    }
    return { healthy: false, latencyMs, error: 'Unexpected query result' };
  } catch (error) {
    const latencyMs = Math.round(performance.now() - start);
    return {
      healthy: false,
      latencyMs,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
