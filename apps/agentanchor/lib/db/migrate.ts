/**
 * Phase 6 Database Migration Runner
 *
 * Simple, zero-dependency migration tool for Phase 6 Trust Engine
 */

import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

interface MigrationRecord {
  id: number;
  name: string;
  applied_at: Date;
  checksum: string;
}

interface MigrationFile {
  name: string;
  path: string;
  version: number;
}

interface DatabaseClient {
  query: <T = unknown>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
  end?: () => Promise<void>;
}

const MIGRATIONS_TABLE = 'phase6_migrations';

/**
 * Create a checksum for migration content
 */
function createChecksum(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Ensure migrations table exists
 */
async function ensureMigrationsTable(client: DatabaseClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ DEFAULT now(),
      checksum TEXT NOT NULL
    )
  `);
}

/**
 * Get list of applied migrations
 */
async function getAppliedMigrations(client: DatabaseClient): Promise<MigrationRecord[]> {
  const result = await client.query<MigrationRecord>(
    `SELECT * FROM ${MIGRATIONS_TABLE} ORDER BY id`
  );
  return result.rows;
}

/**
 * Get list of pending migration files
 */
async function getMigrationFiles(migrationsDir: string): Promise<MigrationFile[]> {
  const files = await readdir(migrationsDir);

  return files
    .filter((f) => f.endsWith('.sql'))
    .map((name) => {
      const versionMatch = name.match(/^(\d+)/);
      const version = versionMatch ? parseInt(versionMatch[1], 10) : 0;
      return {
        name,
        path: join(migrationsDir, name),
        version,
      };
    })
    .sort((a, b) => a.version - b.version);
}

/**
 * Run a single migration
 */
async function runMigration(
  client: DatabaseClient,
  migration: MigrationFile
): Promise<void> {
  const content = await readFile(migration.path, 'utf-8');
  const checksum = createChecksum(content);

  console.log(`  Running migration: ${migration.name}`);

  // Run migration in a transaction
  await client.query('BEGIN');

  try {
    await client.query(content);

    await client.query(
      `INSERT INTO ${MIGRATIONS_TABLE} (name, checksum) VALUES ($1, $2)`,
      [migration.name, checksum]
    );

    await client.query('COMMIT');
    console.log(`  ✓ Applied: ${migration.name}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

/**
 * Validate that applied migrations match their checksums
 */
async function validateMigrations(
  client: DatabaseClient,
  migrationsDir: string
): Promise<{ valid: boolean; errors: string[] }> {
  const applied = await getAppliedMigrations(client);
  const files = await getMigrationFiles(migrationsDir);
  const errors: string[] = [];

  for (const record of applied) {
    const file = files.find((f) => f.name === record.name);

    if (!file) {
      errors.push(`Migration file not found: ${record.name}`);
      continue;
    }

    const content = await readFile(file.path, 'utf-8');
    const checksum = createChecksum(content);

    if (checksum !== record.checksum) {
      errors.push(
        `Checksum mismatch for ${record.name}: expected ${record.checksum}, got ${checksum}`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Run all pending migrations
 */
export async function migrate(
  client: DatabaseClient,
  migrationsDir: string = join(__dirname, 'migrations')
): Promise<{ applied: string[]; skipped: string[] }> {
  console.log('Phase 6 Migration Runner');
  console.log('========================\n');

  // Ensure migrations table exists
  await ensureMigrationsTable(client);

  // Get applied and pending migrations
  const applied = await getAppliedMigrations(client);
  const files = await getMigrationFiles(migrationsDir);

  const appliedNames = new Set(applied.map((m) => m.name));
  const pending = files.filter((f) => !appliedNames.has(f.name));

  if (pending.length === 0) {
    console.log('No pending migrations.\n');
    return { applied: [], skipped: files.map((f) => f.name) };
  }

  console.log(`Found ${pending.length} pending migration(s):\n`);

  const appliedMigrations: string[] = [];

  for (const migration of pending) {
    await runMigration(client, migration);
    appliedMigrations.push(migration.name);
  }

  console.log(`\n✓ Applied ${appliedMigrations.length} migration(s)\n`);

  return {
    applied: appliedMigrations,
    skipped: files.filter((f) => appliedNames.has(f.name)).map((f) => f.name),
  };
}

/**
 * Rollback the last migration
 */
export async function rollback(
  client: DatabaseClient,
  migrationsDir: string = join(__dirname, 'migrations')
): Promise<{ rolledBack: string | null }> {
  console.log('Phase 6 Migration Rollback');
  console.log('==========================\n');

  const applied = await getAppliedMigrations(client);

  if (applied.length === 0) {
    console.log('No migrations to rollback.\n');
    return { rolledBack: null };
  }

  const lastMigration = applied[applied.length - 1];
  const downFile = join(
    migrationsDir,
    lastMigration.name.replace('.sql', '.down.sql')
  );

  try {
    const downContent = await readFile(downFile, 'utf-8');

    console.log(`  Rolling back: ${lastMigration.name}`);

    await client.query('BEGIN');

    try {
      await client.query(downContent);

      await client.query(
        `DELETE FROM ${MIGRATIONS_TABLE} WHERE name = $1`,
        [lastMigration.name]
      );

      await client.query('COMMIT');
      console.log(`  ✓ Rolled back: ${lastMigration.name}\n`);

      return { rolledBack: lastMigration.name };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.error(`  ✗ No down migration found: ${downFile}\n`);
      return { rolledBack: null };
    }
    throw error;
  }
}

/**
 * Get migration status
 */
export async function status(
  client: DatabaseClient,
  migrationsDir: string = join(__dirname, 'migrations')
): Promise<void> {
  console.log('Phase 6 Migration Status');
  console.log('========================\n');

  await ensureMigrationsTable(client);

  const applied = await getAppliedMigrations(client);
  const files = await getMigrationFiles(migrationsDir);
  const appliedNames = new Set(applied.map((m) => m.name));

  console.log('Migrations:\n');

  for (const file of files) {
    const isApplied = appliedNames.has(file.name);
    const record = applied.find((m) => m.name === file.name);
    const status = isApplied ? '✓' : '○';
    const date = record
      ? new Date(record.applied_at).toISOString().slice(0, 19)
      : 'pending';

    console.log(`  ${status} ${file.name} (${date})`);
  }

  const pending = files.filter((f) => !appliedNames.has(f.name));
  console.log(`\nApplied: ${applied.length}, Pending: ${pending.length}\n`);
}

/**
 * Create a new migration file
 */
export async function create(
  name: string,
  migrationsDir: string = join(__dirname, 'migrations')
): Promise<string> {
  const files = await getMigrationFiles(migrationsDir);
  const nextVersion = files.length > 0
    ? Math.max(...files.map((f) => f.version)) + 1
    : 1;

  const versionStr = nextVersion.toString().padStart(3, '0');
  const safeName = name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const filename = `${versionStr}_${safeName}.sql`;

  const template = `-- Migration: ${filename}
-- Description: ${name}
-- Created: ${new Date().toISOString().slice(0, 10)}

-- Write your migration SQL here

`;

  const filepath = join(migrationsDir, filename);
  const { writeFile } = await import('fs/promises');
  await writeFile(filepath, template);

  console.log(`Created migration: ${filename}`);
  return filename;
}

/**
 * CLI entry point
 */
async function main(): Promise<void> {
  const command = process.argv[2];

  if (!command || command === 'help' || command === '--help') {
    console.log(`
Phase 6 Migration CLI

Usage:
  npx ts-node lib/db/migrate.ts <command> [options]

Commands:
  migrate     Run all pending migrations
  rollback    Rollback the last migration
  status      Show migration status
  validate    Validate migration checksums
  create      Create a new migration file

Examples:
  npx ts-node lib/db/migrate.ts migrate
  npx ts-node lib/db/migrate.ts status
  npx ts-node lib/db/migrate.ts create "add user preferences"
`);
    return;
  }

  // Dynamic import of pg to avoid bundling issues
  const { Pool } = await import('pg');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const migrationsDir = join(__dirname, 'migrations');

    switch (command) {
      case 'migrate':
        await migrate(pool, migrationsDir);
        break;

      case 'rollback':
        await rollback(pool, migrationsDir);
        break;

      case 'status':
        await status(pool, migrationsDir);
        break;

      case 'validate': {
        const result = await validateMigrations(pool, migrationsDir);
        if (result.valid) {
          console.log('✓ All migrations valid\n');
        } else {
          console.error('✗ Migration validation failed:\n');
          result.errors.forEach((e) => console.error(`  - ${e}`));
          process.exit(1);
        }
        break;
      }

      case 'create': {
        const name = process.argv[3];
        if (!name) {
          console.error('Please provide a migration name');
          process.exit(1);
        }
        await create(name, migrationsDir);
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

// Run CLI if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
}
