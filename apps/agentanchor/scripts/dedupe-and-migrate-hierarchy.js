#!/usr/bin/env node
/**
 * Deduplicate agents and migrate to L0-L8 hierarchy
 */
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const DRY_RUN = process.argv.includes('--dry-run');

// Legacy to L0-L8 mapping
const LEVEL_MAP = {
  'EXECUTIVE': { level: 'L8', levelName: 'Executive' },
  'SENIOR': { level: 'L5', levelName: 'Project Orchestrator' },
  'MID_LEVEL': { level: 'L3', levelName: 'Orchestrator' },
  'MID': { level: 'L3', levelName: 'Orchestrator' },
  'JUNIOR': { level: 'L1', levelName: 'Executor' },
  'INTERN': { level: 'L0', levelName: 'Listener' },
  null: { level: 'L1', levelName: 'Executor' }
};

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log(DRY_RUN ? '🔍 DRY RUN MODE\n' : '🚀 LIVE MODE\n');

  // Step 1: Find duplicates
  console.log('Step 1: Finding duplicates...\n');
  const dupes = await client.query(`
    SELECT LOWER(name) as name_lower, COUNT(*) as count,
           array_agg(id ORDER BY created_at) as ids
    FROM agents
    GROUP BY LOWER(name)
    HAVING COUNT(*) > 1
    ORDER BY count DESC
    LIMIT 20
  `);

  console.log(`Found ${dupes.rows.length} duplicate names (showing top 20):\n`);
  let totalDupes = 0;
  dupes.rows.forEach(r => {
    const extra = r.count - 1;
    totalDupes += extra;
    console.log(`  "${r.name_lower}": ${r.count} copies (keep 1, delete ${extra})`);
  });

  // Get full count
  const fullDupeCount = await client.query(`
    SELECT SUM(count - 1) as total FROM (
      SELECT COUNT(*) as count FROM agents GROUP BY LOWER(name) HAVING COUNT(*) > 1
    ) sub
  `);
  totalDupes = parseInt(fullDupeCount.rows[0].total || 0);
  console.log(`\n  Total duplicates to remove: ${totalDupes}\n`);

  // Step 2: Delete duplicates (keep oldest)
  if (!DRY_RUN && totalDupes > 0) {
    console.log('Step 2: Removing duplicates (keeping oldest)...\n');

    const deleteResult = await client.query(`
      DELETE FROM agents
      WHERE id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (
            PARTITION BY LOWER(name)
            ORDER BY created_at ASC
          ) as rn
          FROM agents
        ) sub
        WHERE rn > 1
      )
    `);
    console.log(`  Deleted ${deleteResult.rowCount} duplicate agents\n`);
  } else if (DRY_RUN) {
    console.log('Step 2: Would delete duplicates (skipped in dry-run)\n');
  }

  // Step 3: Migrate legacy levels to L0-L8
  console.log('Step 3: Migrating legacy levels to L0-L8...\n');

  const legacy = await client.query(`
    SELECT id, name, metadata
    FROM agents
    WHERE metadata->>'level' IS NULL
       OR metadata->>'level' NOT LIKE 'L%'
  `);

  console.log(`  Found ${legacy.rows.length} agents needing migration\n`);

  let migrated = 0;
  for (const agent of legacy.rows) {
    const oldLevel = agent.metadata?.level || null;
    const mapping = LEVEL_MAP[oldLevel] || LEVEL_MAP[null];

    const newMetadata = {
      ...agent.metadata,
      level: mapping.level,
      levelName: mapping.levelName,
      legacyLevel: oldLevel,
      migratedAt: new Date().toISOString()
    };

    if (!DRY_RUN) {
      await client.query(
        'UPDATE agents SET metadata = $1 WHERE id = $2',
        [JSON.stringify(newMetadata), agent.id]
      );
    }
    migrated++;

    if (migrated % 500 === 0) {
      console.log(`  Migrated ${migrated}/${legacy.rows.length}...`);
    }
  }
  console.log(`  ${DRY_RUN ? 'Would migrate' : 'Migrated'} ${migrated} agents\n`);

  // Step 4: Final count
  console.log('Step 4: Final counts...\n');
  const finalCount = await client.query(`
    SELECT
      metadata->>'level' as level,
      COUNT(*) as count
    FROM agents
    GROUP BY metadata->>'level'
    ORDER BY metadata->>'level'
  `);

  finalCount.rows.forEach(r => {
    console.log(`  ${r.level || 'null'}: ${r.count}`);
  });

  const total = await client.query('SELECT COUNT(*) FROM agents');
  console.log(`\n  Total agents: ${total.rows[0].count}`);

  await client.end();
}

run().catch(console.error);
