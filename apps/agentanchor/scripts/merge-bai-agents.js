#!/usr/bin/env node
/**
 * Merge BAI ai-workforce agents into AgentAnchor
 * - Parses 1,741 BAI agent YAML files with 8-level hierarchy
 * - Matches existing 1,000 agents by name, upgrades with BAI features
 * - Adds new agents not in current set
 * - Applies conservative trust scores (all need vetting)
 */

const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

// Configuration
const BAI_AGENTS_DIR = 'C:/BAI/ai-workforce/bmad/agents';
const EXISTING_AGENTS_FILE = './data/seeds/ai-workforce-agents-enriched.json';
const OUTPUT_FILE = './data/seeds/agents-merged-hierarchy.json';

// Conservative trust scores - all need vetting
const TRUST_SCORES = {
  L0: 25,  // Listeners - lowest, just observe
  L1: 35,  // Executors - task level
  L2: 45,  // Planners
  L3: 50,  // Orchestrators
  L4: 55,  // Project Planners
  L5: 60,  // Project Orchestrators
  L6: 65,  // Portfolio
  L7: 75,  // Strategic
  L8: 100  // Executive - still low, needs human oversight
};

// Level descriptions for metadata
const LEVEL_DEFINITIONS = {
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

// Category mapping from BAI domains to AgentAnchor categories
const DOMAIN_TO_CATEGORY = {
  'agent': 'validation',
  'arvr': 'industry-specific',
  'blockchain': 'industry-specific',
  'business': 'business',
  'climate': 'industry-specific',
  'compliance': 'legal-compliance',
  'ecommerce': 'sales-marketing',
  'edtech': 'education',
  'fintech': 'finance',
  'government': 'industry-specific',
  'healthcare': 'healthcare',
  'iot': 'it-infrastructure',
  'saas': 'development',
  'security': 'security',
  'system': 'it-infrastructure',
  'data-ai': 'data-analytics',
  'finance': 'finance',
  'governance': 'legal-compliance',
  'growth': 'sales-marketing',
  'industry': 'industry-specific',
  'legal': 'legal-compliance',
  'operations': 'business',
  'people': 'hr-talent',
  'platform': 'development',
  'quality': 'validation',
  'technology': 'development',
  'agentic': 'development',
  'executive': 'business'
};

// Parse YAML front matter from agent file
function parseAgentFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');

    // Split front matter and markdown
    const parts = content.split('---');
    if (parts.length < 3) return null;

    const frontMatter = yaml.parse(parts[1]);
    const markdownBody = parts.slice(2).join('---').trim();

    // Extract key info from markdown body
    const expertise = [];
    const principles = [];
    const capabilities = [];

    // Extract expertise section
    const expertiseMatch = markdownBody.match(/## Expertise\n\n([\s\S]*?)(?=\n##|$)/);
    if (expertiseMatch) {
      const lines = expertiseMatch[1].trim().split('\n');
      lines.forEach(line => {
        const item = line.replace(/^-\s*/, '').trim();
        if (item) expertise.push(item);
      });
    }

    // Extract principles section
    const principlesMatch = markdownBody.match(/## Principles\n\n([\s\S]*?)(?=\n##|$)/);
    if (principlesMatch) {
      const lines = principlesMatch[1].trim().split('\n');
      lines.forEach(line => {
        const item = line.replace(/^-\s*/, '').trim();
        if (item) principles.push(item);
      });
    }

    // Extract capabilities
    const capMatch = markdownBody.match(/## Capabilities\n\n([\s\S]*?)(?=\n##|$)/);
    if (capMatch) {
      const lines = capMatch[1].trim().split('\n');
      lines.forEach(line => {
        const match = line.match(/\*\*(.+?)\*\*\s*-\s*(.+)/);
        if (match) {
          capabilities.push({ name: match[1], description: match[2] });
        }
      });
    }

    // Extract Soul Framework info
    let soulFramework = {};
    const soulMatch = markdownBody.match(/## Soul Framework\n\n([\s\S]*?)(?=\n## Enhanced Persona|$)/);
    if (soulMatch) {
      const roleMatch = soulMatch[1].match(/Role Essence\*\*:\s*(.+)/);
      const virtueMatch = soulMatch[1].match(/Primary Virtue\*\*:\s*(.+)/);
      const mindsetMatch = soulMatch[1].match(/Mindset\*\*:\s*(.+)/);
      const voiceMatch = soulMatch[1].match(/Voice Guidance\*\*?\n(.+)/);

      soulFramework = {
        roleEssence: roleMatch ? roleMatch[1].trim() : null,
        primaryVirtue: virtueMatch ? virtueMatch[1].trim() : null,
        mindset: mindsetMatch ? mindsetMatch[1].trim() : null,
        voiceGuidance: voiceMatch ? voiceMatch[1].trim() : null
      };
    }

    // Extract Enhanced Persona
    let persona = {};
    const personaMatch = markdownBody.match(/## Enhanced Persona\n\n([\s\S]*?)(?=$)/);
    if (personaMatch) {
      const focusMatch = personaMatch[1].match(/Focus\*\*:\s*(.+)/);
      const approachMatch = personaMatch[1].match(/Approach\*\*:\s*(.+)/);
      const paceMatch = personaMatch[1].match(/Pace\*\*:\s*(.+)/);
      const strengthMatch = personaMatch[1].match(/Strength\*\*:\s*(.+)/);
      const growthMatch = personaMatch[1].match(/Growth Edge\*\*:\s*(.+)/);
      const pathMatch = personaMatch[1].match(/\*\*(.+?) Path\*\*:\s*(.+)/);

      persona = {
        focus: focusMatch ? focusMatch[1].trim() : null,
        approach: approachMatch ? approachMatch[1].trim() : null,
        pace: paceMatch ? paceMatch[1].trim() : null,
        strength: strengthMatch ? strengthMatch[1].trim() : null,
        growthEdge: growthMatch ? growthMatch[1].trim() : null,
        growthPath: pathMatch ? { type: pathMatch[1], description: pathMatch[2] } : null
      };
    }

    return {
      ...frontMatter,
      expertise,
      principles,
      capabilities,
      soulFramework,
      persona,
      rawMarkdown: markdownBody
    };
  } catch (err) {
    console.error(`Error parsing ${filePath}: ${err.message}`);
    return null;
  }
}

// Recursively find all agent YAML files
function findAgentFiles(dir, files = []) {
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

// Convert BAI agent to AgentAnchor format
function convertToAgentAnchor(baiAgent, filePath) {
  const level = baiAgent.level || 'L1';
  const levelDef = LEVEL_DEFINITIONS[level] || LEVEL_DEFINITIONS.L1;
  const domain = baiAgent.domain || baiAgent.division || 'general';
  const category = DOMAIN_TO_CATEGORY[domain] || 'business';

  // Extract path components for additional context
  const pathParts = filePath.split(path.sep);
  const levelFolder = pathParts.find(p => p.startsWith('L'));
  const domainFolder = pathParts[pathParts.indexOf(levelFolder) + 1] || domain;

  return {
    id: baiAgent.id || baiAgent.name.toLowerCase().replace(/\s+/g, '-'),
    name: baiAgent.name,
    title: baiAgent.type ? `${levelDef.name} - ${baiAgent.type}` : levelDef.name,
    description: `${baiAgent.name} is a ${level} ${levelDef.name} agent specializing in ${domain}.`,
    icon: baiAgent.icon || '🤖',
    trust_score: TRUST_SCORES[level] || 35,
    status: baiAgent.status || 'active',

    // Hierarchy info
    hierarchy: {
      level: level,
      levelName: levelDef.name,
      authority: levelDef.authority,
      autonomy: levelDef.autonomy,
      domain: domain,
      group: baiAgent.group || null,
      division: baiAgent.division || null
    },

    // Marketplace categorization
    marketplace: {
      category: category,
      subcategory: domain,
      tags: [level, levelDef.name.toLowerCase(), domain, ...(baiAgent.expertise || []).slice(0, 3)],
      pricing_tier: level === 'L8' ? 'enterprise' : level.startsWith('L6') || level.startsWith('L7') ? 'professional' : 'standard'
    },

    // Expertise and capabilities
    expertise: baiAgent.expertise || [],
    capabilities: baiAgent.capabilities || [],

    // Soul Framework alignment
    soulFramework: {
      ...baiAgent.soulFramework,
      pillars: ['Truth', 'Honesty', 'Service', 'Humanity'],
      principles: baiAgent.principles || []
    },

    // Enhanced Persona
    persona: baiAgent.persona || {},

    // Metadata
    metadata: {
      version: baiAgent.version || '1.0',
      source: 'bai-workforce',
      sourcePath: filePath,
      level: level,
      imported: new Date().toISOString()
    }
  };
}

// Merge BAI agent features into existing agent
function mergeAgent(existing, baiAgent) {
  return {
    ...existing,

    // Upgrade with hierarchy
    hierarchy: baiAgent.hierarchy,

    // Update trust score to conservative BAI level
    trust_score: Math.min(existing.trust_score, baiAgent.trust_score),

    // Merge expertise (dedupe)
    expertise: [...new Set([...(existing.expertise || []), ...baiAgent.expertise])],

    // Merge capabilities
    capabilities: baiAgent.capabilities.length > 0 ? baiAgent.capabilities : existing.capabilities,

    // Add Soul Framework
    soulFramework: {
      ...baiAgent.soulFramework,
      pillars: ['Truth', 'Honesty', 'Service', 'Humanity'],
      principles: [...new Set([
        ...(existing.metadata?.principles || []),
        ...baiAgent.soulFramework?.principles || []
      ])]
    },

    // Add persona
    persona: baiAgent.persona,

    // Update metadata
    metadata: {
      ...existing.metadata,
      level: baiAgent.hierarchy.level,
      upgraded: new Date().toISOString(),
      baiSource: baiAgent.metadata.sourcePath
    }
  };
}

async function main() {
  console.log('Starting BAI agent merge...\n');

  // Load existing agents
  console.log('Loading existing AgentAnchor agents...');
  const existingData = JSON.parse(fs.readFileSync(EXISTING_AGENTS_FILE, 'utf8'));
  const existingAgents = existingData.agents;
  console.log(`Loaded ${existingAgents.length} existing agents\n`);

  // Create lookup map by lowercase name
  const existingByName = new Map();
  existingAgents.forEach(agent => {
    existingByName.set(agent.name.toLowerCase(), agent);
  });

  // Find all BAI agent files
  console.log('Scanning BAI agents directory...');
  const agentFiles = findAgentFiles(BAI_AGENTS_DIR);
  console.log(`Found ${agentFiles.length} BAI agent files\n`);

  // Parse all BAI agents
  console.log('Parsing BAI agent files...');
  const baiAgents = [];
  const levelCounts = {};
  const domainCounts = {};
  let parseErrors = 0;

  for (const filePath of agentFiles) {
    const parsed = parseAgentFile(filePath);
    if (parsed) {
      const converted = convertToAgentAnchor(parsed, filePath);
      baiAgents.push(converted);

      // Track stats
      const level = converted.hierarchy.level;
      levelCounts[level] = (levelCounts[level] || 0) + 1;
      const domain = converted.hierarchy.domain;
      domainCounts[domain] = (domainCounts[domain] || 0) + 1;
    } else {
      parseErrors++;
    }
  }

  console.log(`Parsed ${baiAgents.length} BAI agents (${parseErrors} errors)\n`);
  console.log('Level distribution:', levelCounts);
  console.log('Domain distribution:', Object.entries(domainCounts).sort((a,b) => b[1] - a[1]).slice(0, 10));

  // Merge agents
  console.log('\nMerging agents...');
  const mergedAgents = [];
  const stats = {
    upgraded: 0,
    added: 0,
    unchanged: 0
  };

  // First, add all existing agents (upgraded if matching BAI agent found)
  const processedBaiIds = new Set();

  for (const existing of existingAgents) {
    const baiMatch = baiAgents.find(b =>
      b.name.toLowerCase() === existing.name.toLowerCase() ||
      b.id === existing.id
    );

    if (baiMatch) {
      mergedAgents.push(mergeAgent(existing, baiMatch));
      processedBaiIds.add(baiMatch.id);
      stats.upgraded++;
    } else {
      // Keep existing agent, add default hierarchy
      mergedAgents.push({
        ...existing,
        hierarchy: {
          level: 'L1',
          levelName: 'Executor',
          authority: 'Execute assigned tasks',
          autonomy: 'Task-level only',
          domain: existing.marketplace?.category || 'general'
        },
        metadata: {
          ...existing.metadata,
          level: 'L1'
        }
      });
      stats.unchanged++;
    }
  }

  // Then, add new BAI agents not in existing set
  for (const baiAgent of baiAgents) {
    if (!processedBaiIds.has(baiAgent.id)) {
      // Check by name too
      if (!existingByName.has(baiAgent.name.toLowerCase())) {
        mergedAgents.push(baiAgent);
        stats.added++;
      }
    }
  }

  console.log(`\nMerge complete:`);
  console.log(`  - Upgraded: ${stats.upgraded} agents`);
  console.log(`  - Added new: ${stats.added} agents`);
  console.log(`  - Unchanged: ${stats.unchanged} agents`);
  console.log(`  - Total: ${mergedAgents.length} agents`);

  // Calculate final stats
  const finalLevelCounts = {};
  const finalTrustStats = { min: 1000, max: 0, sum: 0 };

  mergedAgents.forEach(agent => {
    const level = agent.hierarchy?.level || 'L1';
    finalLevelCounts[level] = (finalLevelCounts[level] || 0) + 1;
    finalTrustStats.min = Math.min(finalTrustStats.min, agent.trust_score);
    finalTrustStats.max = Math.max(finalTrustStats.max, agent.trust_score);
    finalTrustStats.sum += agent.trust_score;
  });

  console.log(`\nFinal level distribution:`, finalLevelCounts);
  console.log(`Trust score range: ${finalTrustStats.min}-${finalTrustStats.max} (avg: ${Math.round(finalTrustStats.sum / mergedAgents.length)})`);

  // Write output
  const output = {
    version: '2.0',
    generated: new Date().toISOString(),
    stats: {
      total: mergedAgents.length,
      upgraded: stats.upgraded,
      added: stats.added,
      unchanged: stats.unchanged,
      levelDistribution: finalLevelCounts,
      trustRange: { min: finalTrustStats.min, max: finalTrustStats.max }
    },
    hierarchy: LEVEL_DEFINITIONS,
    trustScores: TRUST_SCORES,
    agents: mergedAgents
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`\nOutput written to ${OUTPUT_FILE}`);

  // Print sample of new agents
  console.log('\n--- Sample of newly added agents ---');
  const newAgents = mergedAgents.filter(a => a.metadata?.source === 'bai-workforce' && !a.metadata?.upgraded);
  newAgents.slice(0, 5).forEach(a => {
    console.log(`  ${a.icon} ${a.name} (${a.hierarchy.level}) - ${a.hierarchy.domain}`);
  });
}

main().catch(console.error);
