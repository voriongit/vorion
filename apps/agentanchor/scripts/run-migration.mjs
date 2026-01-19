/**
 * Run SQL migration against the database
 * Usage: node scripts/run-migration.mjs <migration-file>
 */

import { readFileSync } from 'fs';
import pg from 'pg';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const { Pool } = pg;

async function runMigration(migrationFile) {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('DATABASE_URL not found in environment');
    process.exit(1);
  }

  console.log('Connecting to database...');

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Read the migration file
    const sql = readFileSync(migrationFile, 'utf-8');
    console.log(`Running migration: ${migrationFile}`);
    console.log('---');

    // Execute the migration
    await pool.query(sql);

    console.log('---');
    console.log('Migration completed successfully!');

    // Verify the table exists
    const result = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'trust_scores'
    `);

    if (result.rows.length > 0) {
      console.log('✓ trust_scores table created');
    }

    // Get column info
    const columns = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'trust_scores'
      ORDER BY ordinal_position
    `);

    console.log('\nTable columns:');
    columns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });

  } catch (error) {
    console.error('Migration failed:', error.message);
    if (error.message.includes('already exists')) {
      console.log('(This may be expected if the table was already created)');
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Get migration file from command line
const migrationFile = process.argv[2] || 'drizzle/0003_trust_scores.sql';
runMigration(migrationFile);
