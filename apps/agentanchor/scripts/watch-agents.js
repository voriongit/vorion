#!/usr/bin/env node
/**
 * Watch agents seed file and auto-sync to database
 *
 * Usage:
 *   node scripts/watch-agents.js
 *   npm run watch:agents
 *
 * Environment:
 *   DATABASE_URL - Postgres connection string (from .env.local)
 */

const { Client } = require('pg');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config({ path: '.env.local' });

const SEED_FILE = path.resolve(__dirname, '../data/seeds/ai-workforce-agents.json');
const DATABASE_URL = process.env.DATABASE_URL;
const DEBOUNCE_MS = 1000; // Wait 1s after last change before syncing

// Target users to sync agents for
const TARGET_EMAILS = [
  'racason@gmail.com',
  'metagoat@duck.com'
];

let syncTimeout = null;
let isSyncing = false;
let lastSyncHash = null;

function getFileHash(content) {
  const crypto = require('node:crypto');
  return crypto.createHash('md5').update(content).digest('hex');
}

async function syncAgents() {
  if (isSyncing) {
    console.log('⏳ Sync already in progress, skipping...');
    return;
  }

  isSyncing = true;
  const startTime = Date.now();

  try {
    // Read seed file
    if (!fs.existsSync(SEED_FILE)) {
      console.error('❌ Seed file not found:', SEED_FILE);
      return;
    }

    const content = fs.readFileSync(SEED_FILE, 'utf8');
    const currentHash = getFileHash(content);

    // Skip if file hasn't actually changed
    if (currentHash === lastSyncHash) {
      console.log('📋 No changes detected, skipping sync');
      return;
    }

    const data = JSON.parse(content);
    const agents = data.agents || [];

    console.log('\n' + '═'.repeat(50));
    console.log(`🔄 Auto-syncing ${agents.length} agents...`);
    console.log('═'.repeat(50));

    if (!DATABASE_URL) {
      console.error('❌ DATABASE_URL not set in .env.local');
      return;
    }

    const client = new Client({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    await client.connect();

    // Get target users
    const usersResult = await client.query(`
      SELECT id, email FROM profiles WHERE email = ANY($1)
    `, [TARGET_EMAILS]);

    if (usersResult.rows.length === 0) {
      console.log('⚠️  No target users found in database');
      await client.end();
      return;
    }

    let totalImported = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;

    for (const user of usersResult.rows) {
      let imported = 0;
      let updated = 0;
      let skipped = 0;

      for (const agent of agents) {
        try {
          // Check if exists
          const existing = await client.query(
            'SELECT id FROM agents WHERE owner_id = $1 AND name = $2',
            [user.id, agent.name]
          );

          if (existing.rows.length > 0) {
            // Update existing
            await client.query(`
              UPDATE agents SET
                description = $1,
                system_prompt = $2,
                model = $3,
                trust_score = $4,
                config = $5,
                metadata = $6,
                updated_at = NOW()
              WHERE id = $7
            `, [
              agent.description,
              agent.system_prompt,
              agent.model || 'claude-sonnet-4-20250514',
              agent.trust_score || 400,
              JSON.stringify(agent.config || {}),
              JSON.stringify(agent.metadata || {}),
              existing.rows[0].id
            ]);
            updated++;
          } else {
            // Insert new
            await client.query(`
              INSERT INTO agents (
                owner_id, name, description, system_prompt, model,
                status, trust_score, config, metadata,
                created_at, updated_at, graduated_at
              ) VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, $8, NOW(), NOW(), NOW())
            `, [
              user.id,
              agent.name,
              agent.description,
              agent.system_prompt,
              agent.model || 'claude-sonnet-4-20250514',
              agent.trust_score || 400,
              JSON.stringify(agent.config || {}),
              JSON.stringify(agent.metadata || {})
            ]);
            imported++;
          }
        } catch (err) {
          // Silently skip individual errors
          skipped++;
        }
      }

      console.log(`   ${user.email}: +${imported} new, ~${updated} updated, ${skipped} skipped`);
      totalImported += imported;
      totalUpdated += updated;
      totalSkipped += skipped;
    }

    await client.end();

    lastSyncHash = currentHash;
    const duration = Date.now() - startTime;

    console.log('─'.repeat(50));
    console.log(`✅ Sync complete in ${duration}ms`);
    console.log(`   Total: +${totalImported} new, ~${totalUpdated} updated`);
    console.log('═'.repeat(50) + '\n');

  } catch (err) {
    console.error('❌ Sync error:', err.message);
  } finally {
    isSyncing = false;
  }
}

function debouncedSync() {
  if (syncTimeout) {
    clearTimeout(syncTimeout);
  }
  syncTimeout = setTimeout(syncAgents, DEBOUNCE_MS);
}

// Initial sync
console.log('\n🔍 AgentAnchor Agent Watcher');
console.log('─'.repeat(40));
console.log(`📁 Watching: ${SEED_FILE}`);
console.log(`👥 Syncing to: ${TARGET_EMAILS.join(', ')}`);
console.log('─'.repeat(40));
console.log('Press Ctrl+C to stop\n');

syncAgents().then(() => {
  // Start watching
  fs.watch(SEED_FILE, (eventType) => {
    if (eventType === 'change') {
      console.log('📝 File changed, scheduling sync...');
      debouncedSync();
    }
  });
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Stopping watcher...');
  process.exit(0);
});
