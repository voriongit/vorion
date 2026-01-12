#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function analyze() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  // Get agents without L0-L8 hierarchy
  const result = await client.query(`
    SELECT
      metadata->>'level' as level,
      metadata->>'source' as source,
      COUNT(*) as count
    FROM agents
    WHERE metadata->>'level' IS NULL
       OR metadata->>'level' NOT LIKE 'L%'
    GROUP BY metadata->>'level', metadata->>'source'
    ORDER BY count DESC
  `);

  console.log('Agents needing L0-L8 migration:\n');
  let total = 0;
  result.rows.forEach(r => {
    console.log(`  ${r.level || 'null'} (${r.source || 'unknown'}): ${r.count}`);
    total += parseInt(r.count);
  });
  console.log(`\n  Total to migrate: ${total}`);

  // Show mapping suggestion
  console.log('\nSuggested L0-L8 mapping:');
  console.log('  EXECUTIVE -> L8 (Executive)');
  console.log('  SENIOR -> L5 (Project Orchestrator)');
  console.log('  MID_LEVEL -> L3 (Orchestrator)');
  console.log('  JUNIOR -> L1 (Executor)');
  console.log('  null -> L1 (Executor, default)');

  await client.end();
}
analyze();
