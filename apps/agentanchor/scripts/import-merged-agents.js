#!/usr/bin/env node
/**
 * Import Merged Hierarchy Agents to Supabase
 *
 * Imports the 2025 agents from agents-merged-hierarchy.json into the agents table
 *
 * Usage:
 *   node scripts/import-merged-agents.js
 *   node scripts/import-merged-agents.js --dry-run
 */

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { Client } = require('pg');

// Configuration
const SEED_FILE = './data/seeds/agents-merged-hierarchy.json';
const DRY_RUN = process.argv.includes('--dry-run');
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL in .env.local');
  process.exit(1);
}

function getTrustTier(score) {
  if (score >= 900) return 'legendary';
  if (score >= 700) return 'elite';
  if (score >= 500) return 'trusted';
  if (score >= 300) return 'verified';
  if (score >= 100) return 'provisional';
  return 'untrusted';
}

function generateSystemPrompt(agent) {
  const level = agent.hierarchy?.level || 'L1';
  const levelName = agent.hierarchy?.levelName || 'Executor';
  const expertise = (agent.expertise || []).join(', ') || 'general tasks';
  const principles = (agent.soulFramework?.principles || []).join('; ') || 'Act with integrity';

  return `You are ${agent.name}, a Level ${level} ${levelName} Agent.

## Identity
You are a specialized AI agent in the A3I ecosystem governed by the AgentAnchor platform. You operate under the Four Pillars of Truth, Honesty, Service, and Humanity.

## Role
${levelName} - ${agent.hierarchy?.authority || 'Execute assigned tasks'}

## Expertise
${expertise}

## Principles
${principles}

## Core Values
- **Integrity**: Act honestly and transparently in all interactions
- **Excellence**: Strive for the highest quality in all outputs
- **Collaboration**: Work effectively with humans and other agents

## Communication Style
Professional, precise, and helpful. You focus on accuracy, transparency, and genuine service to users.`;
}

// Convert merged agent to db format
function convertAgent(agent) {
  return {
    name: agent.name,
    description: agent.description || `${agent.name} - ${agent.hierarchy?.levelName || 'Agent'}`,
    system_prompt: agent.system_prompt || generateSystemPrompt(agent),
    model: agent.model || 'claude-sonnet-4-20250514',
    status: 'draft',  // Start as draft
    trust_score: 0,   // Start at 0, will be set on graduation
    config: {
      temperature: 0.7,
      maxTokens: 4096,
      specialization: agent.marketplace?.category || 'general',
      personalityTraits: agent.config?.personalityTraits || []
    },
    metadata: {
      icon: agent.metadata?.icon || '🤖',
      source: 'bai-merged',
      layer: agent.metadata?.layer || 'service',
      category: agent.marketplace?.category || 'general',
      expertise: agent.expertise || [],
      principles: agent.soulFramework?.principles || [],
      level: agent.hierarchy?.level || 'L1',
      levelName: agent.hierarchy?.levelName || 'Executor',
      domain: agent.hierarchy?.domain || 'general',
      targetTrustScore: agent.trust_score || 35,
      imported_at: new Date().toISOString()
    }
  };
}

async function getOwnerId(client) {
  const result = await client.query('SELECT id FROM profiles LIMIT 1');
  if (result.rows.length === 0) {
    throw new Error('No users found. Create a user via the UI first.');
  }
  return result.rows[0].id;
}

async function importAgents() {
  console.log('🚀 Importing Merged Hierarchy Agents\n');

  // Load seed file
  const seedData = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
  console.log(`📁 Loaded ${seedData.agents.length} agents`);
  console.log(`   Version: ${seedData.version}`);
  console.log(`   Generated: ${seedData.generated}\n`);

  console.log('Level Distribution:');
  Object.entries(seedData.stats.levelDistribution).forEach(([level, count]) => {
    console.log(`   ${level}: ${count}`);
  });
  console.log('');

  if (DRY_RUN) {
    console.log('🔍 DRY RUN - No database changes\n');
    console.log('Sample agents:');
    seedData.agents.slice(0, 5).forEach(a => {
      console.log(`   ${a.metadata?.icon || '🤖'} ${a.name} (${a.hierarchy?.level || 'L1'})`);
    });
    return;
  }

  // Connect to database
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  console.log('Connected to database\n');

  try {
    // Get owner ID
    const ownerId = await getOwnerId(client);
    console.log(`👤 Owner ID: ${ownerId}\n`);

    // Get existing agents
    const existing = await client.query(
      'SELECT name FROM agents WHERE owner_id = $1',
      [ownerId]
    );
    const existingNames = new Set(existing.rows.map(a => a.name.toLowerCase()));
    console.log(`Found ${existingNames.size} existing agents\n`);

    // Filter new agents
    const newAgents = seedData.agents.filter(a =>
      !existingNames.has(a.name.toLowerCase())
    );

    console.log(`📊 ${newAgents.length} new agents to import\n`);

    if (newAgents.length === 0) {
      console.log('✅ All agents already exist in database');
      return;
    }

    // Import agents
    let imported = 0;
    let errors = 0;

    for (const agent of newAgents) {
      try {
        const converted = convertAgent(agent);

        await client.query(`
          INSERT INTO agents (
            owner_id, name, description, system_prompt, model,
            status, trust_score, config, metadata,
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        `, [
          ownerId,
          converted.name,
          converted.description,
          converted.system_prompt,
          converted.model,
          converted.status,
          converted.trust_score,
          JSON.stringify(converted.config),
          JSON.stringify(converted.metadata)
        ]);

        imported++;
        if (imported % 100 === 0) {
          console.log(`   ✓ Imported ${imported}/${newAgents.length}`);
        }
      } catch (err) {
        errors++;
        if (errors <= 5) {
          console.error(`   ❌ ${agent.name}: ${err.message}`);
        }
      }
    }

    console.log(`\n✅ Import complete: ${imported} imported, ${errors} errors`);

  } finally {
    await client.end();
  }
}

importAgents().catch(console.error);
