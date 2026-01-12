/**
 * AgentAnchor - Unified Founding Agents Import
 *
 * Imports agents from multiple seed files:
 * - AI Workforce (89 agents) - A3I format
 * - BAI Workforce (100 agents) - BAI Command Center format
 *
 * Total: 189 Founding Agents
 *
 * Usage:
 *   node scripts/import-founding-agents.js              # Full import
 *   node scripts/import-founding-agents.js --dry-run    # Preview only
 *   node scripts/import-founding-agents.js --ai-only    # AI Workforce only
 *   node scripts/import-founding-agents.js --bai-only   # BAI Workforce only
 */

const { Client } = require('pg');
const fs = require('node:fs');
const path = require('node:path');

require('dotenv').config({ path: '.env.local' });

// Seed files
const SEEDS = {
  aiWorkforce: './data/seeds/ai-workforce-agents.json',
  baiWorkforce: './data/seeds/bai-workforce-agents.json'
};

// CLI options
const DRY_RUN = process.argv.includes('--dry-run');
const AI_ONLY = process.argv.includes('--ai-only');
const BAI_ONLY = process.argv.includes('--bai-only');

const DATABASE_URL = process.env.DATABASE_URL;

// Stats tracking
const stats = {
  aiWorkforce: { imported: 0, skipped: 0, errors: [] },
  baiWorkforce: { imported: 0, skipped: 0, errors: [] },
  enrolled: 0,
  graduated: 0,
  published: 0,
  totalErrors: []
};

/**
 * Transform BAI Workforce agent to A3I format
 */
function transformBaiAgent(baiAgent) {
  // Map BAI level to trust score
  const levelToTrust = {
    'EXECUTIVE': 500,      // Established
    'SENIOR': 450,         // Established
    'MID': 350,            // Developing
    'JUNIOR': 300,         // Developing
    'INTERN': 250          // Developing
  };

  // Map department to category
  const deptToCategory = {
    'Executive Operations': 'operations',
    'Product & Design': 'product',
    'Engineering': 'engineering',
    'Marketing': 'marketing',
    'Sales': 'sales',
    'Finance': 'finance',
    'HR': 'hr',
    'Legal': 'legal',
    'Customer Success': 'customer-success',
    'Data & Analytics': 'data-analytics',
    'Research': 'research',
    'Creative': 'creative'
  };

  return {
    name: baiAgent.name,
    description: `${baiAgent.role} - ${baiAgent.bio?.substring(0, 150) || ''}`,
    system_prompt: baiAgent.systemPrompt || `You are ${baiAgent.name}, ${baiAgent.role} at the organization. ${baiAgent.bio || ''}`,
    model: mapModel(baiAgent.primaryModel),
    status: 'draft',
    trust_score: levelToTrust[baiAgent.level] || 300,
    config: {
      temperature: 0.7,
      maxTokens: 4096,
      specialization: mapDeptToSpec(baiAgent.department),
      personalityTraits: ['professional'],
      capabilities: mapSkillsToCapabilities(baiAgent.skills || [])
    },
    metadata: {
      source: 'bai-command-center',
      originalId: baiAgent.id,
      icon: getIconForRole(baiAgent.role),
      category: deptToCategory[baiAgent.department] || 'general',
      department: baiAgent.department,
      role: baiAgent.role,
      level: baiAgent.level,
      floor: baiAgent.floor,
      email: baiAgent.email,
      bmadAgentId: baiAgent.bmadAgentId,
      skills: baiAgent.skills || [],
      exported_at: new Date().toISOString()
    },
    marketplace: {
      category: deptToCategory[baiAgent.department] || 'general',
      tags: [
        ...(baiAgent.skills || []).slice(0, 3).map(s => s.toLowerCase().replace(/\s+/g, '-')),
        'bai-workforce',
        'founding-agent'
      ],
      pricing: {
        commission_rate: 0.15,
        clone_price: 49.99,
        enterprise_price: 499.99
      }
    }
  };
}

/**
 * Map model names to standard format
 */
function mapModel(model) {
  const modelMap = {
    'claude-sonnet-4-5': 'claude-sonnet-4-20250514',
    'claude-sonnet-4': 'claude-sonnet-4-20250514',
    'claude-opus-4': 'claude-opus-4-20250514',
    'gpt-4': 'gpt-4-turbo',
    'gpt-4o': 'gpt-4o'
  };
  return modelMap[model] || model || 'claude-sonnet-4-20250514';
}

/**
 * Map department to specialization
 */
function mapDeptToSpec(dept) {
  const specMap = {
    'Executive Operations': 'operations',
    'Product & Design': 'creative',
    'Engineering': 'technical',
    'Marketing': 'marketing',
    'Sales': 'sales',
    'Finance': 'research',
    'HR': 'core',
    'Legal': 'research',
    'Customer Success': 'support',
    'Data & Analytics': 'research',
    'Research': 'research',
    'Creative': 'creative'
  };
  return specMap[dept] || 'core';
}

/**
 * Map skills to capabilities
 */
function mapSkillsToCapabilities(skills) {
  const caps = new Set(['text_generation']);

  const skillToCap = {
    'data': 'data_analysis',
    'analytics': 'data_analysis',
    'research': 'research',
    'code': 'code_assistance',
    'engineering': 'code_assistance',
    'writing': 'creative_writing',
    'creative': 'creative_writing',
    'design': 'creative_writing'
  };

  for (const skill of skills) {
    const lower = skill.toLowerCase();
    for (const [key, cap] of Object.entries(skillToCap)) {
      if (lower.includes(key)) {
        caps.add(cap);
      }
    }
  }

  return Array.from(caps);
}

/**
 * Get emoji icon based on role
 */
function getIconForRole(role) {
  const roleIcons = {
    'orchestrator': '🎯',
    'scheduler': '⏰',
    'secretary': '📧',
    'cpo': '🚀',
    'cto': '💻',
    'cfo': '💰',
    'cmo': '📣',
    'engineer': '⚙️',
    'designer': '🎨',
    'analyst': '📊',
    'researcher': '🔬',
    'writer': '✍️',
    'manager': '👔',
    'director': '🎬',
    'lead': '🌟',
    'specialist': '🔧',
    'coordinator': '🔗',
    'support': '🤝',
    'sales': '💼',
    'marketing': '📢'
  };

  const lower = (role || '').toLowerCase();
  for (const [key, icon] of Object.entries(roleIcons)) {
    if (lower.includes(key)) return icon;
  }
  return '🤖';
}

/**
 * Load and parse seed files
 */
function loadSeedFiles() {
  const agents = { aiWorkforce: [], baiWorkforce: [] };

  // Load AI Workforce
  if (!BAI_ONLY && fs.existsSync(SEEDS.aiWorkforce)) {
    const data = JSON.parse(fs.readFileSync(SEEDS.aiWorkforce, 'utf8'));
    agents.aiWorkforce = data.agents || [];
    console.log(`📁 AI Workforce: ${agents.aiWorkforce.length} agents`);
  }

  // Load BAI Workforce
  if (!AI_ONLY && fs.existsSync(SEEDS.baiWorkforce)) {
    const data = JSON.parse(fs.readFileSync(SEEDS.baiWorkforce, 'utf8'));
    // Transform to A3I format
    agents.baiWorkforce = (data.agents || []).map(transformBaiAgent);
    console.log(`📁 BAI Workforce: ${agents.baiWorkforce.length} agents`);
  }

  return agents;
}

/**
 * Get or create owner user
 */
async function getOwner(client) {
  const result = await client.query(`
    SELECT id, full_name, email FROM profiles LIMIT 1
  `);

  if (result.rows.length > 0) {
    const user = result.rows[0];
    console.log(`👤 Owner: ${user.full_name || user.email || user.id}`);
    return user.id;
  }

  throw new Error('No users found. Create a user via the UI first.');
}

/**
 * Import agents from a collection
 */
async function importCollection(client, ownerId, agents, collectionName) {
  console.log(`\n📥 Importing ${collectionName}...\n`);

  for (const agent of agents) {
    try {
      // Check if exists
      const existing = await client.query(
        'SELECT id FROM agents WHERE owner_id = $1 AND name = $2',
        [ownerId, agent.name]
      );

      if (existing.rows.length > 0) {
        console.log(`   ⏭️  ${agent.name} (exists)`);
        stats[collectionName].skipped++;
        continue;
      }

      if (DRY_RUN) {
        console.log(`   📋 ${agent.name} (dry-run)`);
        stats[collectionName].imported++;
        continue;
      }

      // Insert agent (agents view maps to bots table)
      await client.query(`
        INSERT INTO agents (
          owner_id, name, description, system_prompt, model,
          status, trust_score, config, metadata,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      `, [
        ownerId,
        agent.name,
        agent.description,
        agent.system_prompt,
        agent.model || 'claude-sonnet-4-20250514',
        'draft',
        0,  // Start at 0, will boost on graduation
        JSON.stringify(agent.config),
        JSON.stringify(agent.metadata)
      ]);

      console.log(`   ✅ ${agent.name}`);
      stats[collectionName].imported++;

    } catch (err) {
      console.log(`   ❌ ${agent.name}: ${err.message}`);
      stats[collectionName].errors.push({ name: agent.name, error: err.message });
    }
  }
}

/**
 * Enroll all draft agents in Academy
 */
async function enrollAgents(client, ownerId) {
  if (DRY_RUN) {
    console.log('\n🎓 Enrollment (dry-run): skipped');
    return;
  }

  console.log('\n🎓 Enrolling in Academy...\n');

  const result = await client.query(`
    UPDATE agents
    SET status = 'training', updated_at = NOW()
    WHERE owner_id = $1 AND status = 'draft'
    AND (metadata->>'source' = 'bai-migration' OR metadata->>'source' = 'bai-command-center')
    RETURNING name
  `, [ownerId]);

  stats.enrolled = result.rowCount;
  console.log(`   ✅ ${result.rowCount} agents enrolled`);
}

/**
 * Graduate all training agents
 */
async function graduateAgents(client, ownerId) {
  if (DRY_RUN) {
    console.log('\n🎖️  Graduation (dry-run): skipped');
    return;
  }

  console.log('\n🎖️  Graduating agents...\n');

  // Get training agents with their metadata for trust score
  const trainingAgents = await client.query(`
    SELECT id, name, metadata
    FROM agents
    WHERE owner_id = $1 AND status = 'training'
    AND (metadata->>'source' = 'bai-migration' OR metadata->>'source' = 'bai-command-center')
  `, [ownerId]);

  for (const agent of trainingAgents.rows) {
    try {
      // Determine trust score based on source
      const metadata = agent.metadata || {};
      let trustScore = 400; // Default: Established

      // BAI agents may have level-based scoring
      if (metadata.level === 'EXECUTIVE') trustScore = 500;
      else if (metadata.level === 'SENIOR') trustScore = 450;

      // Graduate agent
      await client.query(`
        UPDATE agents
        SET status = 'active', trust_score = $2, graduated_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `, [agent.id, trustScore]);

      // Log trust history (use 'manual_adjustment' as source - valid enum value)
      await client.query(`
        INSERT INTO trust_history (agent_id, previous_score, new_score, change, reason, source, created_at)
        VALUES ($1, 0, $2, $2, 'Founding Agent graduation - established tier', 'manual_adjustment', NOW())
      `, [agent.id, trustScore]);

      console.log(`   ✅ ${agent.name} → trust: ${trustScore}`);
      stats.graduated++;

    } catch (err) {
      console.log(`   ❌ ${agent.name}: ${err.message}`);
      stats.totalErrors.push({ name: agent.name, step: 'graduate', error: err.message });
    }
  }
}

/**
 * Publish agents to marketplace
 */
async function publishAgents(client, ownerId) {
  if (DRY_RUN) {
    console.log('\n🏪 Publishing (dry-run): skipped');
    return;
  }

  console.log('\n🏪 Publishing to Marketplace...\n');

  const activeAgents = await client.query(`
    SELECT id, name, description, config, metadata
    FROM agents
    WHERE owner_id = $1 AND status = 'active'
    AND (metadata->>'source' = 'bai-migration' OR metadata->>'source' = 'bai-command-center')
  `, [ownerId]);

  for (const agent of activeAgents.rows) {
    try {
      const config = agent.config || {};
      const metadata = agent.metadata || {};

      // Check if listing already exists
      const existingListing = await client.query(
        'SELECT id FROM marketplace_listings WHERE agent_id = $1',
        [agent.id]
      );

      if (existingListing.rows.length > 0) {
        // Update existing
        await client.query(`
          UPDATE marketplace_listings
          SET status = 'active', updated_at = NOW(), published_at = NOW()
          WHERE agent_id = $1
        `, [agent.id]);
      } else {
        // Insert new listing
        await client.query(`
          INSERT INTO marketplace_listings (
            agent_id, seller_id, title, description, category, tags,
            commission_rate, clone_price, enterprise_price,
            available_for_commission, available_for_clone, available_for_enterprise,
            status, created_at, updated_at, published_at
          ) VALUES ($1, $2, $3, $4, $5, $6, 0.15, 49.99, 499.99, true, false, false, 'active', NOW(), NOW(), NOW())
        `, [
          agent.id,
          ownerId,  // seller_id = owner
          agent.name,
          agent.description,
          metadata.category || config.specialization || 'general',
          JSON.stringify(config.capabilities || [])
        ]);
      }

      console.log(`   ✅ ${agent.name}`);
      stats.published++;

    } catch (err) {
      console.log(`   ❌ ${agent.name}: ${err.message}`);
      stats.totalErrors.push({ name: agent.name, step: 'publish', error: err.message });
    }
  }
}

/**
 * Print summary
 */
function printSummary(startTime) {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n' + '═'.repeat(60));
  console.log('   📊 FOUNDING AGENTS IMPORT SUMMARY');
  console.log('═'.repeat(60));

  if (!BAI_ONLY) {
    console.log(`\n   AI Workforce:`);
    console.log(`     Imported: ${stats.aiWorkforce.imported}`);
    console.log(`     Skipped:  ${stats.aiWorkforce.skipped}`);
    console.log(`     Errors:   ${stats.aiWorkforce.errors.length}`);
  }

  if (!AI_ONLY) {
    console.log(`\n   BAI Workforce:`);
    console.log(`     Imported: ${stats.baiWorkforce.imported}`);
    console.log(`     Skipped:  ${stats.baiWorkforce.skipped}`);
    console.log(`     Errors:   ${stats.baiWorkforce.errors.length}`);
  }

  const totalImported = stats.aiWorkforce.imported + stats.baiWorkforce.imported;
  const totalSkipped = stats.aiWorkforce.skipped + stats.baiWorkforce.skipped;

  console.log(`\n   Pipeline:`);
  console.log(`     Enrolled:  ${stats.enrolled}`);
  console.log(`     Graduated: ${stats.graduated}`);
  console.log(`     Published: ${stats.published}`);

  console.log(`\n   Total:`);
  console.log(`     Imported:  ${totalImported}`);
  console.log(`     Skipped:   ${totalSkipped}`);
  console.log(`     Time:      ${elapsed}s`);

  if (DRY_RUN) {
    console.log(`\n   ⚠️  DRY RUN - No changes made`);
  }

  console.log('═'.repeat(60) + '\n');

  // Show errors if any
  const allErrors = [
    ...stats.aiWorkforce.errors,
    ...stats.baiWorkforce.errors,
    ...stats.totalErrors
  ];

  if (allErrors.length > 0) {
    console.log('❌ Errors:\n');
    for (const e of allErrors.slice(0, 10)) {
      console.log(`   ${e.name}: ${e.error}`);
    }
    if (allErrors.length > 10) {
      console.log(`   ... and ${allErrors.length - 10} more`);
    }
    console.log('');
  }
}

/**
 * Main
 */
async function main() {
  console.log('═'.repeat(60));
  console.log('   🚀 AgentAnchor - Founding Agents Import');
  console.log('═'.repeat(60));

  if (DRY_RUN) {
    console.log('\n   🔍 DRY RUN MODE - Preview only\n');
  }

  const startTime = Date.now();

  // Load seed files
  const agents = loadSeedFiles();

  const totalAgents = agents.aiWorkforce.length + agents.baiWorkforce.length;
  if (totalAgents === 0) {
    console.error('\n❌ No agents found in seed files');
    process.exit(1);
  }

  console.log(`\n   Total agents to process: ${totalAgents}\n`);

  if (DRY_RUN) {
    // Dry run - just show what would happen
    if (agents.aiWorkforce.length > 0) {
      console.log('\n📋 AI Workforce Preview:');
      for (const a of agents.aiWorkforce.slice(0, 5)) {
        console.log(`   ${a.metadata?.icon || '🤖'} ${a.name} - ${a.description?.substring(0, 50)}...`);
      }
      if (agents.aiWorkforce.length > 5) {
        console.log(`   ... and ${agents.aiWorkforce.length - 5} more`);
      }
      stats.aiWorkforce.imported = agents.aiWorkforce.length;
    }

    if (agents.baiWorkforce.length > 0) {
      console.log('\n📋 BAI Workforce Preview:');
      for (const a of agents.baiWorkforce.slice(0, 5)) {
        console.log(`   ${a.metadata?.icon || '🤖'} ${a.name} - ${a.metadata?.role || ''}`);
      }
      if (agents.baiWorkforce.length > 5) {
        console.log(`   ... and ${agents.baiWorkforce.length - 5} more`);
      }
      stats.baiWorkforce.imported = agents.baiWorkforce.length;
    }

    printSummary(startTime);
    console.log('✨ Run without --dry-run to import agents.\n');
    return;
  }

  // Connect to database
  if (!DATABASE_URL) {
    console.error('\n❌ DATABASE_URL not set in .env.local');
    process.exit(1);
  }

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Get owner
    const ownerId = await getOwner(client);

    // Import collections
    if (agents.aiWorkforce.length > 0) {
      await importCollection(client, ownerId, agents.aiWorkforce, 'aiWorkforce');
    }

    if (agents.baiWorkforce.length > 0) {
      await importCollection(client, ownerId, agents.baiWorkforce, 'baiWorkforce');
    }

    // Pipeline
    await enrollAgents(client, ownerId);
    await graduateAgents(client, ownerId);
    await publishAgents(client, ownerId);

  } catch (err) {
    console.error('\n❌ Pipeline failed:', err.message);
    stats.totalErrors.push({ name: 'PIPELINE', error: err.message });
  } finally {
    await client.end();
  }

  printSummary(startTime);
  console.log('✨ Visit http://localhost:3000/agents to see your Founding Agents!\n');
}

main().catch(console.error);
