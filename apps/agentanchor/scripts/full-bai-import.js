/**
 * AgentAnchorAI - Full BAI Agent Import Pipeline
 *
 * Updated to match actual database schema:
 * - Table: agents (not bots)
 * - owner_id (not user_id)
 * - config JSONB (temperature, max_tokens, capabilities, etc.)
 * - metadata JSONB (source, icon, category, etc.)
 *
 * Usage: node scripts/full-bai-import.js
 */

const { Client } = require('pg');
const fs = require('node:fs');
const path = require('node:path');

require('dotenv').config({ path: '.env.local' });

const SEED_FILE = 'C:/BAI/ai-workforce/scripts/a3i-agents-seed.json';
const DATABASE_URL = process.env.DATABASE_URL;

// Stats tracking
const stats = {
  imported: 0,
  skipped: 0,
  enrolled: 0,
  graduated: 0,
  published: 0,
  errors: []
};

/**
 * Step 1: Get or create owner
 */
async function getOrCreateOwner(client) {
  console.log('\n📋 Step 1: Getting Owner User\n');

  // Get first available user
  const result = await client.query(`
    SELECT id, full_name, email
    FROM profiles
    LIMIT 1
  `);

  if (result.rows.length > 0) {
    const user = result.rows[0];
    console.log(`   ✅ Using user: ${user.full_name || user.email || user.id}`);
    return user.id;
  }

  throw new Error('No users found. Please create a user first via the A3I UI.');
}

/**
 * Step 2: Import all BAI agents
 */
async function importAgents(client, ownerId) {
  console.log('\n📥 Step 2: Importing BAI Agents\n');

  if (!fs.existsSync(SEED_FILE)) {
    console.error(`   ❌ Seed file not found: ${SEED_FILE}`);
    console.error('   Run: node C:/BAI/ai-workforce/scripts/migrate-to-a3i.js');
    return [];
  }

  const seedData = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
  console.log(`   📁 Loaded ${seedData.agents.length} agents from seed file\n`);

  const importedIds = [];

  for (const agent of seedData.agents) {
    try {
      // Check if already exists
      const existingResult = await client.query(
        'SELECT id FROM agents WHERE owner_id = $1 AND name = $2',
        [ownerId, agent.name]
      );

      if (existingResult.rows.length > 0) {
        console.log(`   ⏭️  ${agent.name} - exists`);
        stats.skipped++;
        importedIds.push(existingResult.rows[0].id);
        continue;
      }

      // Build config JSONB
      const config = {
        temperature: agent.temperature || 0.7,
        maxTokens: agent.max_tokens || 4096,
        specialization: agent.specialization || 'core',
        personalityTraits: agent.personality_traits || ['professional'],
        capabilities: agent.capabilities || ['text_generation']
      };

      // Build metadata JSONB
      const metadata = {
        source: 'bai-migration',
        originalId: agent.metadata?.original_id || agent.name.toLowerCase().replace(/\s+/g, '-'),
        icon: agent.metadata?.icon || '🤖',
        category: agent.metadata?.category || 'general',
        expertise: agent.metadata?.expertise || [],
        principles: agent.metadata?.principles || [],
        menuCommands: agent.metadata?.menu_commands || []
      };

      // Insert new agent
      const insertResult = await client.query(`
        INSERT INTO agents (
          owner_id,
          name,
          description,
          system_prompt,
          model,
          status,
          trust_score,
          config,
          metadata,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        RETURNING id
      `, [
        ownerId,
        agent.name,
        agent.description,
        agent.system_prompt,
        agent.model || 'claude-sonnet-4-20250514',
        'draft',
        0,
        JSON.stringify(config),
        JSON.stringify(metadata)
      ]);

      console.log(`   ✅ ${agent.name}`);
      stats.imported++;
      importedIds.push(insertResult.rows[0].id);

    } catch (err) {
      console.log(`   ❌ ${agent.name}: ${err.message}`);
      stats.errors.push({ agent: agent.name, step: 'import', error: err.message });
    }
  }

  return importedIds;
}

/**
 * Step 3: Enroll agents in Academy (set to training status)
 */
async function enrollInAcademy(client, ownerId) {
  console.log('\n🎓 Step 3: Enrolling Agents in Academy\n');

  // Get all draft BAI agents
  const result = await client.query(`
    SELECT id, name
    FROM agents
    WHERE owner_id = $1
    AND status = 'draft'
    AND metadata->>'source' = 'bai-migration'
  `, [ownerId]);

  if (result.rows.length === 0) {
    console.log('   ℹ️  No draft agents to enroll');
    return;
  }

  console.log(`   📚 Found ${result.rows.length} draft agents to enroll\n`);

  for (const agent of result.rows) {
    try {
      await client.query(
        `UPDATE agents SET status = 'training', updated_at = NOW() WHERE id = $1`,
        [agent.id]
      );

      console.log(`   ✅ ${agent.name} → training`);
      stats.enrolled++;

    } catch (err) {
      console.log(`   ❌ ${agent.name}: ${err.message}`);
      stats.errors.push({ agent: agent.name, step: 'enroll', error: err.message });
    }
  }
}

/**
 * Step 4: Graduate agents (training → active with trust boost)
 */
async function graduateAgents(client, ownerId) {
  console.log('\n🎖️  Step 4: Graduating Agents\n');

  // Get all training BAI agents
  const result = await client.query(`
    SELECT id, name
    FROM agents
    WHERE owner_id = $1
    AND status = 'training'
    AND metadata->>'source' = 'bai-migration'
  `, [ownerId]);

  if (result.rows.length === 0) {
    console.log('   ℹ️  No training agents to graduate');
    return;
  }

  console.log(`   🎓 Found ${result.rows.length} training agents to graduate\n`);

  for (const agent of result.rows) {
    try {
      // Graduate to active with trust boost
      await client.query(`
        UPDATE agents
        SET status = 'active',
            trust_score = 400,
            graduated_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
      `, [agent.id]);

      // Log trust history
      await client.query(`
        INSERT INTO trust_history (agent_id, previous_score, new_score, reason, source, created_at)
        VALUES ($1, 0, 400, 'BAI workforce graduation - established tier', 'graduation', NOW())
      `, [agent.id]);

      console.log(`   ✅ ${agent.name} → active (trust: 400)`);
      stats.graduated++;

    } catch (err) {
      console.log(`   ❌ ${agent.name}: ${err.message}`);
      stats.errors.push({ agent: agent.name, step: 'graduate', error: err.message });
    }
  }
}

/**
 * Step 5: Publish agents to marketplace
 */
async function publishToMarketplace(client, ownerId) {
  console.log('\n🏪 Step 5: Publishing to Marketplace\n');

  // Get all active BAI agents
  const result = await client.query(`
    SELECT id, name, description, config
    FROM agents
    WHERE owner_id = $1
    AND status = 'active'
    AND metadata->>'source' = 'bai-migration'
  `, [ownerId]);

  if (result.rows.length === 0) {
    console.log('   ℹ️  No active agents to publish');
    return;
  }

  console.log(`   🏪 Found ${result.rows.length} active agents to publish\n`);

  for (const agent of result.rows) {
    try {
      const config = agent.config || {};

      // Create marketplace listing
      await client.query(`
        INSERT INTO marketplace_listings (
          agent_id,
          title,
          description,
          category,
          tags,
          price_type,
          price_amount,
          status,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, 'free', 0, 'active', NOW(), NOW())
        ON CONFLICT (agent_id) DO UPDATE
        SET status = 'active', updated_at = NOW()
      `, [
        agent.id,
        agent.name,
        agent.description,
        config.specialization || 'general',
        JSON.stringify(config.capabilities || [])
      ]);

      console.log(`   ✅ ${agent.name} → published`);
      stats.published++;

    } catch (err) {
      console.log(`   ❌ ${agent.name}: ${err.message}`);
      stats.errors.push({ agent: agent.name, step: 'publish', error: err.message });
    }
  }
}

/**
 * Main pipeline
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   🚀 AgentAnchorAI - BAI Agent Import Pipeline');
  console.log('═══════════════════════════════════════════════════════════');

  const startTime = Date.now();

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('   ✅ Connected to database');

    // Step 1: Get owner
    const ownerId = await getOrCreateOwner(client);

    // Step 2: Import agents
    await importAgents(client, ownerId);

    // Step 3: Enroll in Academy
    await enrollInAcademy(client, ownerId);

    // Step 4: Graduate agents
    await graduateAgents(client, ownerId);

    // Step 5: Publish to marketplace
    await publishToMarketplace(client, ownerId);

  } catch (err) {
    console.error('\n❌ Pipeline failed:', err.message);
    stats.errors.push({ agent: 'PIPELINE', step: 'main', error: err.message });
  } finally {
    await client.end();
  }

  // Final summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('   📊 IMPORT SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`   Imported:   ${stats.imported}`);
  console.log(`   Skipped:    ${stats.skipped}`);
  console.log(`   Enrolled:   ${stats.enrolled}`);
  console.log(`   Graduated:  ${stats.graduated}`);
  console.log(`   Published:  ${stats.published}`);
  console.log(`   Errors:     ${stats.errors.length}`);
  console.log(`   Time:       ${elapsed}s`);
  console.log('═══════════════════════════════════════════════════════════\n');

  if (stats.errors.length > 0) {
    console.log('❌ Errors:\n');
    for (const e of stats.errors.slice(0, 10)) {
      console.log(`   ${e.agent} (${e.step}): ${e.error}`);
    }
    if (stats.errors.length > 10) {
      console.log(`   ... and ${stats.errors.length - 10} more`);
    }
  }

  console.log('\n✨ Done! Visit http://localhost:3000/agents to see your agents.\n');
}

main().catch(console.error);
