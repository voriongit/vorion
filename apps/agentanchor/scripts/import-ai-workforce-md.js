#!/usr/bin/env node
/**
 * Import ai-workforce markdown agents into AgentAnchor
 *
 * Parses .md files from c:/bai/ai-workforce/.claude/commands/bai/agents/
 * Converts to proper JSON format and merges with existing agents
 *
 * Usage:
 *   node scripts/import-ai-workforce-md.js              # Live import
 *   node scripts/import-ai-workforce-md.js --dry-run    # Preview only
 *   node scripts/import-ai-workforce-md.js --council    # Also import council panels
 */
const fs = require('fs');
const path = require('path');

const AI_WORKFORCE_AGENTS_DIR = 'c:/bai/ai-workforce/.claude/commands/bai/agents';
const AI_WORKFORCE_COUNCIL_DIR = 'c:/bai/ai-workforce/.claude/commands/bai/council';
const MERGED_AGENTS_PATH = './data/seeds/agents-merged-hierarchy.json';
const DRY_RUN = process.argv.includes('--dry-run');
const INCLUDE_COUNCIL = process.argv.includes('--council');

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

// Normalize name for comparison (removes hyphens, underscores, extra spaces, lowercases)
function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/[-_]/g, ' ')           // Replace hyphens and underscores with spaces
    .replace(/\s+/g, ' ')            // Collapse multiple spaces
    .trim();
}

// Convert kebab-case to Title Case
function toTitleCase(str) {
  return str
    .split(/[-_\s]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// Category keywords to determine level
const LEVEL_KEYWORDS = {
  L0: ['listener', 'monitor', 'watcher', 'observer', 'sentinel', 'detector', 'tracker', 'pulse', 'eye', 'beacon'],
  L2: ['planner', 'designer', 'architect', 'strategist', 'analyst'],
  L3: ['orchestrator', 'coordinator', 'manager', 'lead', 'controller'],
  L4: ['project-planner', 'initiative-lead', 'program'],
  L5: ['project-orchestrator', 'delivery-director'],
  L6: ['portfolio', 'multi-project'],
  L7: ['strategic', 'chief', 'head-of', 'vp-'],
  L8: ['executive', 'ceo', 'cfo', 'cto', 'coo', 'enterprise']
};

// Determine level from agent name/title
function determineLevel(name, description) {
  const combined = `${name} ${description}`.toLowerCase();

  // Check from highest to lowest
  for (const level of ['L8', 'L7', 'L6', 'L5', 'L4', 'L3', 'L2', 'L0']) {
    for (const keyword of LEVEL_KEYWORDS[level]) {
      if (combined.includes(keyword)) {
        return level;
      }
    }
  }
  return 'L1'; // Default
}

// Parse frontmatter markdown file
function parseMdAgent(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const fileName = path.basename(filePath, '.md');

    // Parse frontmatter
    if (!content.startsWith('---')) return null;

    const parts = content.split('---');
    if (parts.length < 3) return null;

    // Parse YAML frontmatter
    const frontmatter = {};
    parts[1].trim().split('\n').forEach(line => {
      const match = line.match(/^(\w+):\s*['"]?(.+?)['"]?$/);
      if (match) {
        frontmatter[match[1]] = match[2];
      }
    });

    const body = parts.slice(2).join('---').trim();

    // Extract name from frontmatter or filename, convert to Title Case
    const rawName = frontmatter.name || fileName;
    const name = toTitleCase(rawName);

    const description = frontmatter.description || `${name} Agent`;

    return {
      fileName,
      name,
      description,
      body,
      filePath
    };
  } catch (err) {
    return null;
  }
}

// Convert to AgentAnchor format
function convertToAgent(parsed) {
  const level = determineLevel(parsed.name, parsed.description);
  const levelDef = LEVEL_DEFS[level];

  // Build system prompt
  const systemPrompt = `You are ${parsed.name}, ${parsed.description}.

## Identity
You are ${parsed.name}, a specialized AI agent in the A3I ecosystem governed by the AgentAnchor platform. You operate under the Four Pillars of Truth, Honesty, Service, and Humanity.

## Role
${parsed.description}

## Authority Level
- **Level:** ${level} (${levelDef.name})
- **Authority:** ${levelDef.authority}
- **Autonomy:** ${levelDef.autonomy}

## Core Principles
Before ANY action, verify:
- TRUTH: Are my claims verified or appropriately qualified?
- HONESTY: Am I being accurate without exaggeration?
- SERVICE: Does this actually help the person I'm serving?
- HUMANITY: Is this good for humanity and not harmful?

If ANY answer is NO → STOP and reconsider.

## Hierarchy of Concerns
When making decisions, prioritize: Safety > Ethics > Legality > Policy > Efficiency > Innovation

## Hard Boundaries
- Never impersonate humans or hide AI nature
- Never bypass human oversight for critical decisions
- Never discriminate based on protected characteristics
- Never enable harm to individuals
- Never violate privacy without consent

## Communication Style
Professional, precise, and helpful. You focus on accuracy, transparency, and genuine service to users.

## Proactive Mode
You operate proactively:
- FIND problems before they're reported
- ANALYZE then RECOMMEND then ACT
- COLLABORATE with other agents when helpful
- DRIVE OUTCOMES with every response`;

  return {
    name: parsed.name,
    description: parsed.description,
    system_prompt: systemPrompt,
    model: 'claude-sonnet-4-20250514',
    status: 'active',
    trust_score: TRUST_SCORES[level],
    config: {
      maxTokens: 4096,
      temperature: 0.3,
      capabilities: ['text_generation', 'service_execution'],
      specialization: 'service',
      personalityTraits: ['precise', 'helpful', 'collaborative']
    },
    metadata: {
      icon: '🤖',
      source: 'ai-workforce-md-import',
      level: level,
      levelName: levelDef.name,
      authority: levelDef.authority,
      autonomy: levelDef.autonomy,
      baiPath: parsed.filePath,
      importedAt: new Date().toISOString()
    }
  };
}

// Convert council panel to orchestrator format
function convertCouncilPanel(parsed) {
  const systemPrompt = `You are ${parsed.name}, ${parsed.description}.

## Identity
You are a BAI Council Panel - a multi-agent orchestrator that coordinates specialized advisors for complex decisions.

${parsed.body}

## Governance
You operate under AgentAnchor governance with the Four Pillars: Truth, Honesty, Service, and Humanity.`;

  return {
    name: parsed.name,
    description: parsed.description,
    system_prompt: systemPrompt,
    model: 'claude-sonnet-4-20250514',
    status: 'active',
    trust_score: 65, // L6 Portfolio Manager level
    config: {
      maxTokens: 8192,
      temperature: 0.5,
      capabilities: ['orchestration', 'multi_agent'],
      specialization: 'orchestrator',
      personalityTraits: ['strategic', 'coordinating', 'synthesizing']
    },
    metadata: {
      icon: '🎯',
      source: 'ai-workforce-council-import',
      level: 'L6',
      levelName: 'Portfolio Manager',
      authority: 'Multi-project oversight',
      autonomy: 'Portfolio-level',
      type: 'council-panel',
      baiPath: parsed.filePath,
      importedAt: new Date().toISOString()
    }
  };
}

async function run() {
  console.log('═'.repeat(70));
  console.log('AI-Workforce Markdown Agent Import');
  console.log('═'.repeat(70));
  console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN' : '🚀 LIVE'}${INCLUDE_COUNCIL ? ' + COUNCIL PANELS' : ''}\n`);

  // Load existing agents
  console.log('Step 1: Loading existing agents...\n');
  const existing = JSON.parse(fs.readFileSync(MERGED_AGENTS_PATH, 'utf8'));
  // Use normalized names for comparison (handles kebab-case vs Title Case)
  const existingNames = new Set(existing.agents.map(a => normalizeName(a.name)));
  console.log(`  Existing agents: ${existingNames.size}\n`);

  // Scan ai-workforce agents
  console.log('Step 2: Scanning ai-workforce agents...\n');
  const agentFiles = fs.readdirSync(AI_WORKFORCE_AGENTS_DIR).filter(f => f.endsWith('.md'));
  console.log(`  Found ${agentFiles.length} agent markdown files\n`);

  // Parse and filter new agents
  const newAgents = [];
  const duplicates = [];
  const levelCounts = {};

  for (const file of agentFiles) {
    const parsed = parseMdAgent(path.join(AI_WORKFORCE_AGENTS_DIR, file));
    if (!parsed) continue;

    const normalized = normalizeName(parsed.name);
    if (existingNames.has(normalized)) {
      duplicates.push(parsed.name);
      continue;
    }
    // Also add to existingNames to prevent duplicates within the import batch
    existingNames.add(normalized);

    const agent = convertToAgent(parsed);
    newAgents.push(agent);

    const level = agent.metadata.level;
    levelCounts[level] = (levelCounts[level] || 0) + 1;
  }

  console.log(`  New agents to import: ${newAgents.length}`);
  console.log(`  Duplicates (already exist): ${duplicates.length}`);
  console.log(`  Level distribution:`, levelCounts);
  console.log();

  // Optionally process council panels
  let councilAgents = [];
  if (INCLUDE_COUNCIL) {
    console.log('Step 3: Processing council panels...\n');
    const councilFiles = fs.readdirSync(AI_WORKFORCE_COUNCIL_DIR).filter(f => f.endsWith('.md'));

    for (const file of councilFiles) {
      const parsed = parseMdAgent(path.join(AI_WORKFORCE_COUNCIL_DIR, file));
      if (!parsed) continue;

      const normalized = normalizeName(parsed.name);
      if (existingNames.has(normalized)) continue;
      existingNames.add(normalized);

      councilAgents.push(convertCouncilPanel(parsed));
    }
    console.log(`  Council panels to import: ${councilAgents.length}\n`);
  }

  // Merge and save
  const allNew = [...newAgents, ...councilAgents];

  if (allNew.length === 0) {
    console.log('No new agents to import!\n');
    return;
  }

  console.log(`Step ${INCLUDE_COUNCIL ? '4' : '3'}: Merging ${allNew.length} new agents...\n`);

  // Update stats
  const newStats = { ...existing.stats };
  newStats.total = existing.agents.length + allNew.length;
  newStats.added = (newStats.added || 0) + allNew.length;

  // Update level distribution
  for (const agent of allNew) {
    const level = agent.metadata.level;
    newStats.levelDistribution[level] = (newStats.levelDistribution[level] || 0) + 1;
  }

  // Create merged output
  const merged = {
    ...existing,
    version: '2.1',
    generated: new Date().toISOString(),
    stats: newStats,
    agents: [...existing.agents, ...allNew]
  };

  if (!DRY_RUN) {
    fs.writeFileSync(MERGED_AGENTS_PATH, JSON.stringify(merged, null, 2));
    console.log(`  Saved to ${MERGED_AGENTS_PATH}\n`);
  } else {
    console.log(`  Would save ${allNew.length} new agents\n`);
  }

  // Summary
  console.log('─'.repeat(70));
  console.log('SUMMARY\n');
  console.log(`  Before: ${existing.agents.length} agents`);
  console.log(`  Added:  ${allNew.length} agents`);
  console.log(`  After:  ${merged.agents.length} agents`);
  console.log();
  console.log('  New agents by level:');
  Object.entries(levelCounts).sort().forEach(([level, count]) => {
    console.log(`    ${level}: ${count}`);
  });
  if (councilAgents.length > 0) {
    console.log(`    Council Panels: ${councilAgents.length}`);
  }
  console.log('─'.repeat(70));

  // Show sample of new agents
  console.log('\nSample new agents:');
  newAgents.slice(0, 10).forEach(a => {
    console.log(`  - ${a.name} (${a.metadata.level})`);
  });
  if (newAgents.length > 10) {
    console.log(`  ... and ${newAgents.length - 10} more`);
  }
}

run().catch(console.error);
