#!/usr/bin/env node
/**
 * Run All Pending Migrations
 * Usage: node scripts/run-all-migrations.js
 *
 * This script runs migrations via Supabase SQL Editor API
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
  auth: { autoRefreshToken: false, persistSession: false },
});

// Migrations to run in order
const migrations = [
  '20241214_testing_studio.sql',
  '20241214_trust_bridge.sql',
];

async function checkTable(tableName) {
  const { error } = await supabase.from(tableName).select('*').limit(1);
  return !error || error.code !== '42P01';
}

async function runMigration(filename) {
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', filename);

  if (!fs.existsSync(migrationPath)) {
    console.log(`  ⚠️  ${filename} - File not found`);
    return false;
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');

  // Split into statements (simplified)
  const statements = sql
    .split(/;(?=\s*(?:--|CREATE|ALTER|DROP|INSERT|COMMENT|$))/gi)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`  📄 ${filename} - ${statements.length} statements`);

  let success = 0;
  let errors = 0;

  for (const stmt of statements) {
    if (stmt.length < 5) continue;

    try {
      // Try using rpc if available, otherwise log for manual execution
      const { error } = await supabase.rpc('exec_sql', { sql_query: stmt + ';' });

      if (error) {
        if (error.message?.includes('already exists')) {
          success++;
        } else {
          errors++;
        }
      } else {
        success++;
      }
    } catch (err) {
      errors++;
    }
  }

  console.log(`     ✅ ${success} succeeded, ❌ ${errors} failed`);
  return errors === 0;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  A3I - Database Migration Runner');
  console.log('═══════════════════════════════════════════════════════\n');

  // Check current state
  console.log('Checking existing tables...\n');

  const tables = [
    // Testing Studio
    'attack_vectors',
    'detection_rules',
    'arena_sessions',
    'session_turns',
    // Trust Bridge
    'trust_bridge_submissions',
    'trust_bridge_credentials',
    'trust_bridge_verifications',
  ];

  for (const table of tables) {
    const exists = await checkTable(table);
    console.log(`  ${exists ? '✅' : '❌'} ${table}`);
  }

  console.log('\n───────────────────────────────────────────────────────');
  console.log('Note: Migrations may need to be run manually.\n');
  console.log('Supabase Dashboard SQL Editor:');
  console.log('https://supabase.com/dashboard/project/mdcrzpuawbaicawqpwlx/sql/new\n');

  console.log('Migration files:');
  for (const migration of migrations) {
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', migration);
    if (fs.existsSync(migrationPath)) {
      console.log(`  📄 supabase/migrations/${migration}`);
    }
  }

  console.log('\nTo run manually:');
  console.log('1. Open the SQL editor link above');
  console.log('2. Copy and paste each migration file');
  console.log('3. Click "Run"\n');
}

main().catch(console.error);
