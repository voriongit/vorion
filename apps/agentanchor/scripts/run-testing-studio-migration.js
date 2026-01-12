#!/usr/bin/env node
/**
 * Run Testing Studio Migration
 * Usage: node scripts/run-testing-studio-migration.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function runMigration() {
  console.log('🚀 Running Testing Studio migration...\n');

  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20241214_testing_studio.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  // Split into individual statements (rough split, handles most cases)
  const statements = sql
    .split(/;(?=\s*(?:--|CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|COMMENT|$))/gi)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`Found ${statements.length} SQL statements to execute\n`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.substring(0, 60).replace(/\n/g, ' ');

    process.stdout.write(`[${i + 1}/${statements.length}] ${preview}... `);

    try {
      const { error } = await supabase.rpc('exec_sql', { sql_query: stmt + ';' });

      if (error) {
        // Try direct query for DDL statements
        const { error: directError } = await supabase.from('_migrations').select('*').limit(0);

        // If it's just a "function doesn't exist" error, try raw
        if (error.message.includes('exec_sql')) {
          console.log('⚠️  (exec_sql not available, skipping)');
          errorCount++;
          continue;
        }

        throw error;
      }

      console.log('✅');
      successCount++;
    } catch (err) {
      console.log(`❌ ${err.message?.substring(0, 50) || 'Error'}`);
      errorCount++;
    }
  }

  console.log(`\n📊 Migration Results:`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);

  if (errorCount > 0) {
    console.log('\n⚠️  Some statements failed. You may need to run the migration manually via Supabase Dashboard.');
    console.log('   Go to: https://supabase.com/dashboard/project/mdcrzpuawbaicawqpwlx/sql/new');
    console.log('   Paste the contents of: supabase/migrations/20241214_testing_studio.sql');
  }
}

// Check if tables already exist
async function checkExistingTables() {
  console.log('Checking existing tables...\n');

  const tables = ['attack_vectors', 'detection_rules', 'arena_sessions', 'session_turns'];

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);

    if (error && error.code === '42P01') {
      console.log(`  ❌ ${table} - does not exist`);
    } else if (error) {
      console.log(`  ⚠️  ${table} - ${error.message}`);
    } else {
      console.log(`  ✅ ${table} - exists`);
    }
  }

  console.log('');
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  A3I Testing Studio - Database Migration');
  console.log('═══════════════════════════════════════════════════════\n');

  await checkExistingTables();

  const args = process.argv.slice(2);
  if (args.includes('--check-only')) {
    console.log('Check only mode. Exiting.');
    return;
  }

  console.log('Note: The migration may need to be run manually via Supabase Dashboard.');
  console.log('URL: https://supabase.com/dashboard/project/mdcrzpuawbaicawqpwlx/sql/new\n');

  console.log('To run manually:');
  console.log('1. Open the SQL editor in Supabase Dashboard');
  console.log('2. Copy contents of: supabase/migrations/20241214_testing_studio.sql');
  console.log('3. Execute the SQL\n');
}

main().catch(console.error);
