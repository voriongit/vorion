/**
 * Run SQL migration directly via pg driver
 */

const { Client } = require('pg');
const fs = require('node:fs');
const path = require('node:path');

require('dotenv').config({ path: '.env.local' });

const DATABASE_URL = process.env.DATABASE_URL;

async function runMigration() {
  console.log('🔧 Running Database Migration\n');

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Read migration file
    const migrationPath = path.join(__dirname, '../supabase/migrations/20250129000000_agents_evolution.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('📝 Executing agents_evolution migration...\n');

    // Execute the entire migration
    await client.query(sql);

    console.log('✅ Migration completed successfully!\n');

    // Verify columns exist
    const result = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'bots'
      AND column_name IN ('status', 'capabilities', 'specialization', 'trust_score', 'trust_tier')
      ORDER BY column_name
    `);

    console.log('📋 Verified columns in bots table:');
    for (const row of result.rows) {
      console.log(`   ✅ ${row.column_name} (${row.data_type})`);
    }

  } catch (err) {
    console.error('❌ Migration error:', err.message);

    // Check if it's an "already exists" type error
    if (err.message.includes('already exists') || err.message.includes('duplicate')) {
      console.log('\n⚠️ Some objects already exist - this is OK, migration may have been partially applied.');
    }
  } finally {
    await client.end();
  }
}

runMigration().catch(console.error);
