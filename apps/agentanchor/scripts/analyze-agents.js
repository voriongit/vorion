#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function analyze() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  // Level distribution
  console.log('=== HIERARCHY LEVELS ===');
  const levels = await client.query(`
    SELECT metadata->>'level' as level, COUNT(*) as count
    FROM bots
    GROUP BY metadata->>'level'
    ORDER BY metadata->>'level'
  `);
  levels.rows.forEach(r => console.log(`  ${r.level || 'null'}: ${r.count}`));

  // Status distribution
  console.log('\n=== STATUS ===');
  const status = await client.query(`
    SELECT status, COUNT(*) as count FROM bots GROUP BY status ORDER BY count DESC
  `);
  status.rows.forEach(r => console.log(`  ${r.status}: ${r.count}`));

  // Trust score distribution
  console.log('\n=== TRUST SCORE TIERS ===');
  const trust = await client.query(`
    SELECT
      CASE
        WHEN trust_score >= 900 THEN 'Legendary (900+)'
        WHEN trust_score >= 700 THEN 'Elite (700-899)'
        WHEN trust_score >= 500 THEN 'Trusted (500-699)'
        WHEN trust_score >= 300 THEN 'Established (300-499)'
        WHEN trust_score >= 100 THEN 'Probation (100-299)'
        ELSE 'Untrusted (0-99)'
      END as tier,
      COUNT(*) as count,
      MIN(trust_score) as min_score,
      MAX(trust_score) as max_score
    FROM bots
    GROUP BY tier
    ORDER BY min_score DESC
  `);
  trust.rows.forEach(r => console.log(`  ${r.tier}: ${r.count} (range: ${r.min_score}-${r.max_score})`));

  // Domain/Category distribution (top 15)
  console.log('\n=== TOP 15 DOMAINS ===');
  const domains = await client.query(`
    SELECT metadata->>'domain' as domain, COUNT(*) as count
    FROM bots
    WHERE metadata->>'domain' IS NOT NULL
    GROUP BY metadata->>'domain'
    ORDER BY count DESC
    LIMIT 15
  `);
  domains.rows.forEach(r => console.log(`  ${r.domain}: ${r.count}`));

  // Source distribution
  console.log('\n=== SOURCES ===');
  const sources = await client.query(`
    SELECT metadata->>'source' as source, COUNT(*) as count
    FROM bots
    GROUP BY metadata->>'source'
    ORDER BY count DESC
  `);
  sources.rows.forEach(r => console.log(`  ${r.source || 'unknown'}: ${r.count}`));

  // Total
  const total = await client.query('SELECT COUNT(*) FROM bots');
  console.log(`\n=== TOTAL: ${total.rows[0].count} agents ===`);

  await client.end();
}

analyze().catch(console.error);
