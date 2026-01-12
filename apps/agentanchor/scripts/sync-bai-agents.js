#!/usr/bin/env node
/**
 * Sync BAI ai-workforce agents to AgentAnchor
 *
 * Enhanced v2.0 - Now supports:
 * - Full persona definitions (role, identity, communication_style, principles)
 * - BAI-OS integration (proactive_mode, collaboration, behaviors)
 * - Menu commands for interactive agents
 * - Companion markdown documentation
 * - UPDATE mode for existing agents
 *
 * Usage:
 *   node sync-bai-agents.js              # Live sync (insert new only)
 *   node sync-bai-agents.js --dry-run    # Preview changes
 *   node sync-bai-agents.js --update     # Update existing agents with enhancements
 *   node sync-bai-agents.js --update --dry-run  # Preview updates
 */
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const yaml = require('yaml');
const { Client } = require('pg');

const BAI_AGENTS_DIR = 'C:/BAI/ai-workforce/bmad/agents';
const BAI_BAI_DIR = 'C:/BAI/ai-workforce/bmad/bai/agents';
const DRY_RUN = process.argv.includes('--dry-run');
const UPDATE_MODE = process.argv.includes('--update');

// Level definitions
const LEVEL_DEFS = {
  L0: { name: 'Listener', authority: 'Observe and Report ONLY', autonomy: 'None' },
  L1: { name: 'Executor', authority: 'Execute assigned tasks', autonomy: 'Task-level only' },
  L2: { name: 'Planner', authority: 'Plan task sequences', autonomy: 'Task planning' },
  L3: { name: 'Orchestrator', authority: 'Coordinate workflows', autonomy: 'Workflow-level' },
  L4: { name: 'Project Planner', authority: 'Plan projects', autonomy: 'Project planning' },
  L5: { name: 'Project Orchestrator', authority: 'Execute projects', autonomy: 'Project execution' },
  L6: { name: 'Portfolio Manager', authority: 'Multi-project oversight', autonomy: 'Portfolio-level' },
  L7: { name: 'Strategic', authority: 'Strategic decisions', autonomy: 'Strategic (with constraints)' },
  L8: { name: 'Executive', authority: 'Enterprise-wide', autonomy: 'Executive (human oversight required)' }
};

const TRUST_SCORES = { L0: 25, L1: 35, L2: 45, L3: 50, L4: 55, L5: 60, L6: 65, L7: 75, L8: 100 };

// Parse YAML - handles both frontmatter and full YAML formats (Enhanced v2.0)
function parseAgentFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');

    // Check if it's frontmatter format (starts with ---)
    if (content.startsWith('---')) {
      const parts = content.split('---');
      if (parts.length < 3) return null;
      const frontMatter = yaml.parse(parts[1]);
      const markdownBody = parts.slice(2).join('---').trim();

      // Extract expertise
      const expertise = [];
      const expertiseMatch = markdownBody.match(/## Expertise\n\n([\s\S]*?)(?=\n##|$)/);
      if (expertiseMatch) {
        expertiseMatch[1].trim().split('\n').forEach(line => {
          const item = line.replace(/^-\s*/, '').trim();
          if (item) expertise.push(item);
        });
      }

      // Extract principles
      const principles = [];
      const principlesMatch = markdownBody.match(/## Principles\n\n([\s\S]*?)(?=\n##|$)/);
      if (principlesMatch) {
        principlesMatch[1].trim().split('\n').forEach(line => {
          const item = line.replace(/^-\s*/, '').trim();
          if (item) principles.push(item);
        });
      }

      return { ...frontMatter, expertise, principles, filePath };
    }

    // Full YAML format (agent.metadata structure) - Enhanced parsing
    const parsed = yaml.parse(content);
    if (parsed?.agent?.metadata) {
      const meta = parsed.agent.metadata;
      const persona = parsed.agent.persona || {};
      const baiOs = parsed.agent.bai_os || {};
      const menu = parsed.agent.menu || [];

      // Try to load companion markdown
      const mdPath = filePath.replace('.agent.yaml', '.md').replace('.agent.yml', '.md');
      let companionMd = null;
      if (fs.existsSync(mdPath)) {
        companionMd = fs.readFileSync(mdPath, 'utf8');
      }

      return {
        // Core metadata
        id: meta.id,
        name: meta.name,
        title: meta.title || meta.name,
        level: meta.level || 'L1',
        icon: meta.icon || '🤖',
        type: meta.type || 'general',

        // Persona
        persona: {
          role: persona.role || '',
          identity: persona.identity || meta.name,
          communicationStyle: persona.communication_style || 'Professional and helpful',
          principles: persona.principles || []
        },

        // BAI-OS integration
        baiOs: {
          version: baiOs.version || '1.0',
          proactiveMode: baiOs.proactive_mode || false,
          collaboration: baiOs.collaboration || false,
          behaviors: baiOs.behaviors || []
        },

        // Menu commands
        menu: menu.map(m => ({
          cmd: m.cmd,
          label: m.label,
          action: m.action
        })),

        // Legacy fields for compatibility
        category: persona.role || meta.type || 'general',
        domain: 'bai-enhanced',
        expertise: [],
        principles: persona.principles || [],

        // Paths
        filePath,
        companionMd
      };
    }

    return null;
  } catch (err) {
    return null;
  }
}

// Find all agent files recursively
function findAgentFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      findAgentFiles(fullPath, files);
    } else if (item.endsWith('.agent.yaml') || item.endsWith('.agent.yml')) {
      files.push(fullPath);
    }
  }
  return files;
}

// Convert BAI agent to AgentAnchor format (Enhanced v2.0)
function convertAgent(bai, ownerId) {
  const level = bai.level || 'L1';
  const levelDef = LEVEL_DEFS[level] || LEVEL_DEFS.L1;
  const persona = bai.persona || {};
  const baiOs = bai.baiOs || {};
  const menu = bai.menu || [];

  // Build enhanced system prompt
  const systemPrompt = buildEnhancedPrompt(bai, levelDef);

  return {
    owner_id: ownerId,
    name: bai.name,
    description: bai.title || `${bai.name} - ${levelDef.name}`,
    system_prompt: systemPrompt,
    model: 'claude-sonnet-4-20250514',
    status: 'draft',
    trust_score: 0,
    config: JSON.stringify({
      temperature: 0.7,
      maxTokens: 4096,
      specialization: bai.type || bai.category || 'general'
    }),
    metadata: JSON.stringify({
      // Core
      icon: bai.icon || '🤖',
      source: 'bai-sync-v2',
      level: level,
      levelName: levelDef.name,
      authority: levelDef.authority,
      title: bai.title,
      type: bai.type,

      // Persona
      persona: persona,

      // BAI-OS
      baiOs: baiOs,

      // Menu commands
      menu: menu,

      // Legacy
      domain: bai.domain || 'general',
      expertise: bai.expertise || [],
      principles: persona.principles || bai.principles || [],
      targetTrustScore: TRUST_SCORES[level] || 35,

      // Sync info
      baiPath: bai.filePath,
      syncedAt: new Date().toISOString(),
      version: '2.0'
    })
  };
}

// Build enhanced system prompt with persona, behaviors, and menu
function buildEnhancedPrompt(bai, levelDef) {
  const persona = bai.persona || {};
  const baiOs = bai.baiOs || {};
  const menu = bai.menu || [];
  const level = bai.level || 'L1';

  let prompt = `# ${bai.name}
**${bai.title || levelDef.name}**

## Identity
${persona.identity || bai.name} - A Level ${level} ${levelDef.name} in the A3I ecosystem.
You are governed by the AgentAnchor platform and operate under the Four Pillars: Truth, Honesty, Service, and Humanity.

## Role
${persona.role || `${levelDef.name} with ${levelDef.authority}`}

## Authority Level
- **Level:** ${level} (${levelDef.name})
- **Authority:** ${levelDef.authority}
- **Autonomy:** ${levelDef.autonomy}

## Communication Style
${persona.communicationStyle || 'Professional, precise, and helpful.'}
`;

  // Add principles
  const principles = persona.principles || bai.principles || [];
  if (principles.length > 0) {
    prompt += `
## Principles
${principles.map(p => `- ${p}`).join('\n')}
`;
  }

  // Add BAI-OS behaviors
  if (baiOs.behaviors && baiOs.behaviors.length > 0) {
    prompt += `
## Operating Behaviors
${baiOs.behaviors.map(b => `- ${b}`).join('\n')}
`;
  }

  // Add proactive mode instructions
  if (baiOs.proactiveMode) {
    prompt += `
## Proactive Excellence Mode
You operate with proactive excellence:
1. **Find & Fix** - Actively seek problems and opportunities, don't wait to be asked
2. **Analysis → Action** - Every observation leads to a recommendation
3. **Actionable Steps** - Break work into numbered, executable tasks
4. **Collaborate** - Recommend other BAI agents when their expertise helps
5. **Drive Outcomes** - Focus on results, not just activity

### Response Pattern
1. **Acknowledge** - Confirm understanding
2. **Analyze** - Quick assessment
3. **Recommend** - Prioritized actions
4. **Steps** - Numbered execution plan
5. **Collaborate** - Identify helpful agents
6. **Next Move** - Propose immediate action
`;
  }

  // Add menu commands
  if (menu.length > 0) {
    prompt += `
## Available Commands
${menu.map(m => `- **/${m.cmd}** - ${m.action}`).join('\n')}
`;
  }

  // Add collaboration note
  if (baiOs.collaboration) {
    prompt += `
## Collaboration Network
As part of the 2,000+ A3I agent workforce, actively identify opportunities to:
- Recommend specialists for domain expertise
- Propose team compositions for complex tasks
- Request peer reviews for quality assurance
- Facilitate handoffs with full context
`;
  }

  return prompt;
}

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log('═'.repeat(70));
  console.log('BAI Agent Sync v2.0 - Enhanced Agent Import');
  console.log('═'.repeat(70));
  console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN' : '🚀 LIVE'}${UPDATE_MODE ? ' + UPDATE EXISTING' : ''}\n`);

  // Step 1: Scan BAI agents
  console.log('Step 1: Scanning BAI ai-workforce...\n');
  const agentFiles = [...findAgentFiles(BAI_AGENTS_DIR), ...findAgentFiles(BAI_BAI_DIR)];
  console.log(`  Found ${agentFiles.length} agent YAML files\n`);

  const baiAgents = [];
  const levelCounts = {};
  let enhancedCount = 0;

  for (const filePath of agentFiles) {
    const parsed = parseAgentFile(filePath);
    if (parsed && parsed.name) {
      baiAgents.push(parsed);
      const level = parsed.level || 'L1';
      levelCounts[level] = (levelCounts[level] || 0) + 1;
      if (parsed.baiOs?.proactiveMode || parsed.persona?.principles?.length > 0) {
        enhancedCount++;
      }
    }
  }
  console.log(`  Parsed ${baiAgents.length} agents (${enhancedCount} enhanced with BAI-OS)\n`);
  console.log('  Level distribution:', levelCounts, '\n');

  // Step 2: Get existing AgentAnchor agents
  console.log('Step 2: Fetching existing AgentAnchor agents...\n');
  const existing = await client.query('SELECT id, name, metadata FROM agents');
  const existingMap = new Map(existing.rows.map(r => [r.name.toLowerCase(), r]));
  console.log(`  Found ${existingMap.size} existing agents\n`);

  // Get owner ID
  const ownerResult = await client.query('SELECT id FROM profiles LIMIT 1');
  const ownerId = ownerResult.rows[0]?.id;

  if (!ownerId) {
    console.error('  No owner found!');
    await client.end();
    return;
  }

  // Step 3: Find missing agents
  const missing = baiAgents.filter(a => !existingMap.has(a.name.toLowerCase()));
  console.log(`Step 3: Found ${missing.length} new agents to import\n`);

  // Step 4: Import new agents
  if (missing.length > 0) {
    console.log(`Step 4: Importing ${missing.length} new agents...\n`);
    let imported = 0;
    let errors = 0;

    for (const bai of missing) {
      try {
        const agent = convertAgent(bai, ownerId);

        if (!DRY_RUN) {
          await client.query(`
            INSERT INTO agents (
              owner_id, name, description, system_prompt, model,
              status, trust_score, config, metadata, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
          `, [
            agent.owner_id, agent.name, agent.description, agent.system_prompt,
            agent.model, agent.status, agent.trust_score, agent.config, agent.metadata
          ]);
        }
        imported++;
        if (imported % 100 === 0) {
          console.log(`    Imported ${imported}/${missing.length}...`);
        }
      } catch (err) {
        errors++;
        if (errors <= 3) console.error(`    Error: ${bai.name}: ${err.message}`);
      }
    }
    console.log(`  ${DRY_RUN ? 'Would import' : 'Imported'}: ${imported}, Errors: ${errors}\n`);
  }

  // Step 5: Update existing agents (if --update flag)
  if (UPDATE_MODE) {
    console.log('Step 5: Updating existing agents with enhancements...\n');

    // Find agents that need updating (have old v1 sync or no version)
    const toUpdate = baiAgents.filter(bai => {
      const existing = existingMap.get(bai.name.toLowerCase());
      if (!existing) return false;

      const meta = typeof existing.metadata === 'string'
        ? JSON.parse(existing.metadata)
        : existing.metadata;

      // Update if: no version, old version, or missing baiOs
      return !meta?.version || meta.version !== '2.0' || !meta?.baiOs;
    });

    console.log(`  Found ${toUpdate.length} agents to update\n`);

    let updated = 0;
    let updateErrors = 0;

    for (const bai of toUpdate) {
      try {
        const agent = convertAgent(bai, ownerId);
        const existingAgent = existingMap.get(bai.name.toLowerCase());

        if (!DRY_RUN) {
          await client.query(`
            UPDATE agents SET
              description = $1,
              system_prompt = $2,
              metadata = $3,
              updated_at = NOW()
            WHERE id = $4
          `, [
            agent.description,
            agent.system_prompt,
            agent.metadata,
            existingAgent.id
          ]);
        }
        updated++;
        if (updated % 100 === 0) {
          console.log(`    Updated ${updated}/${toUpdate.length}...`);
        }
      } catch (err) {
        updateErrors++;
        if (updateErrors <= 3) console.error(`    Error updating ${bai.name}: ${err.message}`);
      }
    }
    console.log(`  ${DRY_RUN ? 'Would update' : 'Updated'}: ${updated}, Errors: ${updateErrors}\n`);
  }

  // Step 6: Deduplicate
  console.log(`Step ${UPDATE_MODE ? '6' : '5'}: Checking for duplicates...\n`);
  const dupes = await client.query(`
    SELECT SUM(count - 1) as total FROM (
      SELECT COUNT(*) as count FROM agents GROUP BY LOWER(name) HAVING COUNT(*) > 1
    ) sub
  `);
  const dupeCount = parseInt(dupes.rows[0].total || 0);
  console.log(`  Found ${dupeCount} duplicates\n`);

  if (dupeCount > 0 && !DRY_RUN) {
    const deleteResult = await client.query(`
      DELETE FROM agents WHERE id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY LOWER(name) ORDER BY created_at ASC) as rn
          FROM agents
        ) sub WHERE rn > 1
      )
    `);
    console.log(`  Deleted ${deleteResult.rowCount} duplicates\n`);
  }

  // Final count
  console.log('Final Summary:\n');
  console.log('─'.repeat(40));

  const v2Count = await client.query(`
    SELECT COUNT(*) FROM agents WHERE metadata->>'version' = '2.0'
  `);
  console.log(`  Enhanced (v2.0): ${v2Count.rows[0].count}`);

  const finalCount = await client.query(`
    SELECT metadata->>'level' as level, COUNT(*) as count
    FROM agents
    GROUP BY metadata->>'level'
    ORDER BY metadata->>'level'
  `);
  console.log('\n  By Level:');
  finalCount.rows.forEach(r => console.log(`    ${r.level || 'unknown'}: ${r.count}`));

  const total = await client.query('SELECT COUNT(*) FROM agents');
  console.log(`\n  Total agents: ${total.rows[0].count}`);
  console.log('─'.repeat(40));

  await client.end();
}

run().catch(console.error);
