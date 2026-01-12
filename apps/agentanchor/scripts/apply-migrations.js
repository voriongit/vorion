/**
 * Apply pending migrations to Supabase database
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('node:fs');
const path = require('node:path');

require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

// Migrations to apply in order
const migrations = [
  '20250129000000_agents_evolution.sql',
];

async function applyMigration(filename) {
  const filepath = path.join(__dirname, '../supabase/migrations', filename);

  if (!fs.existsSync(filepath)) {
    console.log(`   ⚠️ File not found: ${filename}`);
    return false;
  }

  const sql = fs.readFileSync(filepath, 'utf8');

  // Split into individual statements (simple split, may need improvement for complex SQL)
  const statements = sql
    .split(/;\s*$/m)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`   📝 ${filename} (${statements.length} statements)`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    if (!stmt || stmt.startsWith('--')) continue;

    try {
      const { error } = await supabase.rpc('exec_sql', { sql_query: stmt });
      if (error) {
        // Try direct execution
        const { error: error2 } = await supabase.from('_exec').select(stmt);
        if (error2 && !error2.message.includes('already exists')) {
          console.log(`   ⚠️ Statement ${i + 1}: ${error.message.substring(0, 60)}...`);
        }
      }
    } catch (err) {
      // Ignore errors for IF NOT EXISTS statements
      if (!err.message?.includes('already exists')) {
        console.log(`   ⚠️ Statement ${i + 1}: ${err.message?.substring(0, 60) || err}...`);
      }
    }
  }

  return true;
}

async function main() {
  console.log('🔧 Applying Database Migrations\n');

  // Check if key columns already exist
  const { data: testData, error: testError } = await supabase
    .from('bots')
    .select('id, status, capabilities, specialization')
    .limit(1);

  if (!testError) {
    console.log('✅ Migrations already applied - governance columns exist\n');
    return;
  }

  console.log('📋 Columns missing, applying migrations...\n');

  // Apply migrations using REST API with raw SQL
  const migrationSql = fs.readFileSync(
    path.join(__dirname, '../supabase/migrations/20250129000000_agents_evolution.sql'),
    'utf8'
  );

  // Use Supabase SQL editor approach - need to run via dashboard or pg directly
  console.log('⚠️ Cannot run raw SQL via JS client.');
  console.log('   Please apply migrations via Supabase Dashboard SQL Editor:\n');
  console.log('   1. Go to: https://supabase.com/dashboard/project/mdcrzpuawbaicawqpwlx/sql');
  console.log('   2. Copy contents of: supabase/migrations/20250129000000_agents_evolution.sql');
  console.log('   3. Paste and run in SQL Editor\n');
  console.log('   Or run: psql $DATABASE_URL -f supabase/migrations/20250129000000_agents_evolution.sql\n');
}

main().catch(console.error);
