/**
 * Cognigate Module Migration Runner
 *
 * Provides utilities to run cognigate module database migrations.
 * Idempotent - safe to run multiple times without side effects.
 *
 * @packageDocumentation
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getPool, getDatabase } from '../../common/db.js';
import { createLogger } from '../../common/logger.js';

const logger = createLogger({ component: 'cognigate-migrations' });

const MIGRATIONS_DIR = resolve('src', 'cognigate', 'migrations');

/** Record of a migration that has been applied to the database. */
interface MigrationRecord {
  id: number;
  name: string;
  applied_at: Date;
}

/** Definition of a migration with its up and down SQL files. */
interface MigrationDefinition {
  name: string;
  file: string;
  downFile: string;
}

/** Ordered list of all cognigate migrations. */
const MIGRATIONS: readonly MigrationDefinition[] = [
  {
    name: '0001_cognigate_schema',
    file: '0001_cognigate_schema.sql',
    downFile: '0001_cognigate_schema_down.sql',
  },
] as const;

/**
 * Run all cognigate module migrations.
 *
 * This function is idempotent - it checks whether each migration has already
 * been applied before executing it. All DDL statements use IF NOT EXISTS
 * for additional safety.
 *
 * @returns Promise that resolves when all migrations have been applied
 * @throws Error if the database connection is not available or a migration fails
 *
 * @example
 * ```typescript
 * import { runCognigateMigrations } from './cognigate/migrations/index.js';
 *
 * await runCognigateMigrations();
 * ```
 */
export async function runCognigateMigrations(): Promise<void> {
  logger.info('Starting cognigate module migrations');

  // Ensure the database is initialized
  getDatabase();
  const pool = getPool();

  if (!pool) {
    throw new Error('Database pool not available. Ensure database is initialized before running migrations.');
  }

  // Ensure the migrations tracking table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cognigate_migrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  for (const migration of MIGRATIONS) {
    const applied = await isMigrationApplied(migration.name);

    if (applied) {
      logger.info({ migration: migration.name }, 'Migration already applied, skipping');
      continue;
    }

    logger.info({ migration: migration.name }, 'Applying migration');

    const sqlPath = resolve(MIGRATIONS_DIR, migration.file);
    const sqlContent = readFileSync(sqlPath, 'utf-8');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sqlContent);
      await client.query('COMMIT');
      logger.info({ migration: migration.name }, 'Migration applied successfully');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error({ migration: migration.name, error }, 'Migration failed, rolled back');
      throw error;
    } finally {
      client.release();
    }
  }

  logger.info('Cognigate module migrations complete');
}

/**
 * Roll back cognigate module migrations to a target version.
 *
 * Rolls back all migrations that have been applied after (and including)
 * the specified target version. If no target version is provided, all
 * migrations are rolled back.
 *
 * WARNING: This will drop cognigate module tables and data for rolled-back migrations.
 * Use with caution - primarily intended for development and testing.
 *
 * @param targetVersion - The migration version to roll back to (exclusive).
 *   Migrations with version numbers greater than this will be rolled back.
 *   If undefined, all migrations are rolled back.
 * @returns Promise that resolves when the rollback is complete
 * @throws Error if the database connection is not available or a rollback fails
 *
 * @example
 * ```typescript
 * // Roll back all cognigate migrations
 * await rollbackCognigateMigrations();
 *
 * // Roll back to before migration 0001 (drops everything)
 * await rollbackCognigateMigrations(0);
 * ```
 */
export async function rollbackCognigateMigrations(targetVersion?: number): Promise<void> {
  logger.info({ targetVersion }, 'Starting cognigate module migration rollback');

  getDatabase();
  const pool = getPool();

  if (!pool) {
    throw new Error('Database pool not available. Ensure database is initialized before running migrations.');
  }

  // Determine which migrations to roll back (in reverse order)
  const migrationsToRollback = [...MIGRATIONS]
    .reverse()
    .filter((_migration, index) => {
      const migrationVersion = MIGRATIONS.length - index;
      if (targetVersion === undefined) {
        return true;
      }
      return migrationVersion > targetVersion;
    });

  for (const migration of migrationsToRollback) {
    const applied = await isMigrationApplied(migration.name);

    if (!applied) {
      logger.info({ migration: migration.name }, 'Migration not applied, skipping rollback');
      continue;
    }

    logger.info({ migration: migration.name }, 'Rolling back migration');

    const sqlPath = resolve(MIGRATIONS_DIR, migration.downFile);
    const sqlContent = readFileSync(sqlPath, 'utf-8');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sqlContent);
      await client.query('COMMIT');
      logger.info({ migration: migration.name }, 'Migration rolled back successfully');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error({ migration: migration.name, error }, 'Migration rollback failed');
      throw error;
    } finally {
      client.release();
    }
  }

  logger.info('Cognigate module migration rollback complete');
}

/**
 * Check if a specific migration has already been applied.
 *
 * @param name - The migration name to check
 * @returns true if the migration has been applied, false otherwise
 */
async function isMigrationApplied(name: string): Promise<boolean> {
  const pool = getPool();

  if (!pool) {
    return false;
  }

  try {
    const result = await pool.query(
      'SELECT 1 FROM cognigate_migrations WHERE name = $1',
      [name]
    );
    return result.rowCount !== null && result.rowCount > 0;
  } catch {
    // Table might not exist yet on first run
    return false;
  }
}

/**
 * Get the list of applied cognigate migrations.
 *
 * @returns Array of applied migration records with id, name, and applied_at
 */
export async function getAppliedMigrations(): Promise<Array<MigrationRecord>> {
  const pool = getPool();

  if (!pool) {
    return [];
  }

  try {
    const result = await pool.query(
      'SELECT id, name, applied_at FROM cognigate_migrations ORDER BY id ASC'
    );
    return result.rows as Array<MigrationRecord>;
  } catch {
    return [];
  }
}
