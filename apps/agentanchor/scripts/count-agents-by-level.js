#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function count() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const result = await client.query(`
    SELECT
      metadata->>'level' as level,
      metadata->>'levelName' as level_name,
      COUNT(*) as count
    FROM agents
    WHERE metadata->>'level' IS NOT NULL
    GROUP BY metadata->>'level', metadata->>'levelName'
    ORDER BY metadata->>'level'
  `);

  console.log('\nAgents by Hierarchy Level:\n');
  let total = 0;
  result.rows.forEach(r => {
    console.log(`  ${r.level} (${r.level_name || 'N/A'}): ${r.count}`);
    total += parseInt(r.count);
  });
  console.log(`\n  Total with hierarchy: ${total}`);

  const allResult = await client.query('SELECT COUNT(*) FROM agents');
  console.log(`  Total agents: ${allResult.rows[0].count}`);

  await client.end();
}
count();
