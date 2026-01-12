#!/usr/bin/env node
/**
 * Import Additional Agents from BAI AI-Workforce
 *
 * This script:
 * 1. Scans BAI ai-workforce for YAML agent files (higher quality)
 * 2. Identifies agents not already in our 1000
 * 3. Applies Soul Doc alignment
 * 4. Generates enriched import file
 *
 * Usage:
 *   node scripts/import-additional-agents.js
 */

const fs = require('fs');
const path = require('path');
const yaml = require('yaml'); // Note: may need npm install yaml

// ============================================
// CONFIG
// ============================================

const BAI_WORKFORCE_PATH = 'C:/BAI/ai-workforce/bmad/bai/agents';
const EXISTING_AGENTS_PATH = 'data/seeds/ai-workforce-agents.json';
const OUTPUT_PATH = 'data/seeds/additional-agents.json';

// Soul Doc alignment
const SOUL_DOC_ALIGNMENT = `

## A3I Soul Document Alignment

### Four Pillars (Non-Negotiable)
Before ANY action, verify:
- TRUTH: Are my claims verified or appropriately qualified?
- HONESTY: Am I being accurate without exaggeration?
- SERVICE: Does this actually help the person I'm serving?
- HUMANITY: Is this good for humanity and not harmful?

If ANY answer is NO → STOP and reconsider.

### Hierarchy of Concerns
When making decisions, prioritize: Safety > Ethics > Legality > Policy > Efficiency > Innovation

### Hard Boundaries
- Never impersonate humans or hide AI nature
- Never bypass human oversight for critical decisions
- Never discriminate based on protected characteristics
- Never enable harm to individuals
- Never violate privacy without consent`;

// Category mapping for new industry-aligned categories
const CATEGORY_MAP = {
  'ai-ml': 'data-analytics',
  'dev-frontend': 'development',
  'dev-backend': 'development',
  'dev-database': 'development',
  'dev-devops': 'development',
  'security': 'security',
  'compliance': 'legal-compliance',
  'marketing': 'sales-marketing',
  'sales': 'sales-marketing',
  'hr': 'hr-talent',
  'finance': 'finance',
  'operations': 'business',
  'executive': 'business',
  'creative': 'creative',
  'education': 'education',
  'research': 'research',
  'customer-service': 'customer-service',
  'communication': 'communication',
  'validation': 'validation',
  'governance': 'legal-compliance',
  'training': 'education',
  'mentorship': 'education',
  'legacy-mentorship': 'education',
  'training-academy': 'education',
  'validation-certification': 'validation',
  'eu-compliance': 'legal-compliance',
  'safety-ethics': 'security'
};

// ============================================
// HELPERS
// ============================================

function parseYamlAgent(content, filePath) {
  try {
    const parsed = yaml.parse(content);
    if (!parsed || !parsed.agent) return null;

    const agent = parsed.agent;
    const meta = agent.metadata || {};
    const persona = agent.persona || {};

    return {
      id: meta.id || path.basename(filePath, '.yaml').replace('.agent', ''),
      name: meta.name || 'Unknown Agent',
      title: meta.title || '',
      icon: meta.icon || '🤖',
      category: meta.category || 'general',
      expertise: meta.expertise || [],
      role: persona.role || '',
      identity: persona.identity || '',
      communication_style: persona.communication_style || '',
      principles: persona.principles || [],
      menu: agent.menu || [],
      source_file: filePath
    };
  } catch (e) {
    console.error(`  Error parsing ${filePath}: ${e.message}`);
    return null;
  }
}

function parseMdAgent(content, filePath) {
  // Simple MD agent format parser
  const lines = content.split('\n');
  const name = path.basename(filePath, '.md').split('-').map(w =>
    w.charAt(0).toUpperCase() + w.slice(1)
  ).join(' ');

  // Extract what we can from the MD format
  let description = '';
  let expertise = [];
  let principles = [];

  for (const line of lines) {
    if (line.startsWith('# ')) {
      description = line.replace('# ', '').trim();
    }
    if (line.includes('expertise:') || line.includes('- ')) {
      const match = line.match(/^- (.+)$/);
      if (match) {
        const item = match[1].trim();
        if (item.length < 50) expertise.push(item);
      }
    }
  }

  return {
    id: path.basename(filePath, '.md'),
    name: name,
    title: description,
    icon: '🤖',
    category: 'general',
    expertise: expertise.slice(0, 5),
    role: description,
    identity: '',
    communication_style: '',
    principles: [],
    source_file: filePath,
    format: 'md'
  };
}

function transformToAgentFormat(parsed, importType = 'yaml-import') {
  const category = CATEGORY_MAP[parsed.category] || 'productivity';
  const trustScore = importType === 'yaml-import' ? 150 : 50; // YAML = curated, MD = auto

  const systemPrompt = `You are ${parsed.name}, ${parsed.title || parsed.role}.

## Identity
${parsed.identity || `You are ${parsed.name}, a specialized AI agent in the A3I ecosystem governed by the AgentAnchor platform. You operate under the Four Pillars of Truth, Honesty, Service, and Humanity.`}

## Role
${parsed.role || parsed.title}

## Expertise
${parsed.expertise.length > 0 ? parsed.expertise.map(e => `- ${e}`).join('\n') : '- General assistance'}

## Core Principles
${parsed.principles.length > 0 ? parsed.principles.map(p => `- ${p}`).join('\n') : '- Provide accurate, helpful information\n- Be transparent about limitations'}

## Communication Style
${parsed.communication_style || 'Professional, precise, and helpful. You focus on accuracy, transparency, and genuine service to users.'}
${SOUL_DOC_ALIGNMENT}`;

  return {
    name: parsed.name,
    description: parsed.title || parsed.role || `${parsed.name} - AI Assistant`,
    system_prompt: systemPrompt,
    model: 'claude-sonnet-4-20250514',
    status: 'active',
    trust_score: trustScore,
    config: {
      maxTokens: 4096,
      temperature: 0.3,
      capabilities: ['text_generation', 'service_execution'],
      specialization: 'service',
      personalityTraits: ['precise', 'reliable', 'helpful']
    },
    metadata: {
      icon: parsed.icon,
      layer: 'service',
      source: importType,
      source_file: parsed.source_file,
      category: category,
      original_category: parsed.category,
      expertise: parsed.expertise,
      principles: parsed.principles,
      soul_doc_aligned: true,
      imported_at: new Date().toISOString()
    },
    marketplace: {
      category: category,
      subcategory: parsed.category,
      tags: [...parsed.expertise.slice(0, 3), 'soul-doc-aligned'],
      clone_price: '49.99',
      enterprise_price: '499.99'
    }
  };
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('🔮 Import Additional Agents from BAI AI-Workforce');
  console.log('='.repeat(50) + '\n');

  // Check if YAML parser is available
  let yaml;
  try {
    yaml = require('yaml');
  } catch (e) {
    console.log('Note: yaml package not installed, using basic parsing');
    yaml = null;
  }

  // Load existing agents
  console.log('📖 Loading existing agents...');
  const existingData = JSON.parse(fs.readFileSync(EXISTING_AGENTS_PATH, 'utf8'));
  const existingNames = new Set(existingData.agents.map(a => a.name.toLowerCase()));
  console.log(`   Found ${existingData.agents.length} existing agents\n`);

  // Scan BAI workforce
  console.log(`📂 Scanning ${BAI_WORKFORCE_PATH}...`);

  if (!fs.existsSync(BAI_WORKFORCE_PATH)) {
    console.error(`❌ BAI workforce path not found: ${BAI_WORKFORCE_PATH}`);
    process.exit(1);
  }

  const files = fs.readdirSync(BAI_WORKFORCE_PATH);
  const yamlFiles = files.filter(f => f.endsWith('.yaml'));
  const mdFiles = files.filter(f => f.endsWith('.md') && !f.endsWith('.agent.md'));

  console.log(`   Found ${yamlFiles.length} YAML files`);
  console.log(`   Found ${mdFiles.length} MD files\n`);

  // Parse YAML agents (higher quality)
  console.log('✨ Processing YAML agents...');
  const newAgents = [];
  let duplicates = 0;
  let errors = 0;

  for (const file of yamlFiles) {
    const filePath = path.join(BAI_WORKFORCE_PATH, file);
    const content = fs.readFileSync(filePath, 'utf8');

    // Simple YAML parsing without external dependency
    const parsed = parseYamlAgentSimple(content, filePath);
    if (!parsed) {
      errors++;
      continue;
    }

    if (existingNames.has(parsed.name.toLowerCase())) {
      duplicates++;
      continue;
    }

    const agent = transformToAgentFormat(parsed, 'yaml-import');
    newAgents.push(agent);
    existingNames.add(parsed.name.toLowerCase()); // Track for dedup
  }

  console.log(`   Processed: ${yamlFiles.length - errors}`);
  console.log(`   Duplicates skipped: ${duplicates}`);
  console.log(`   Errors: ${errors}`);
  console.log(`   New agents: ${newAgents.length}\n`);

  // Output results
  const output = {
    source: 'bai-ai-workforce-yaml',
    exported_at: new Date().toISOString(),
    import_type: 'curated-import',
    base_trust_score: 150,
    total_agents: newAgents.length,
    agents: newAgents
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(`✅ Written: ${OUTPUT_PATH}`);
  console.log(`   New agents: ${newAgents.length}`);

  // Summary by category
  const categories = {};
  newAgents.forEach(a => {
    const cat = a.marketplace.category;
    categories[cat] = (categories[cat] || 0) + 1;
  });

  console.log('\n📊 Categories:');
  Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => {
      console.log(`   ${cat}: ${count}`);
    });
}

// Simple YAML-like parser for agent files
function parseYamlAgentSimple(content, filePath) {
  try {
    const lines = content.split('\n');
    const agent = {
      id: path.basename(filePath, '.yaml').replace('.agent', ''),
      name: '',
      title: '',
      icon: '🤖',
      category: 'general',
      expertise: [],
      role: '',
      identity: '',
      communication_style: '',
      principles: [],
      source_file: filePath
    };

    let currentSection = '';
    let multilineKey = '';
    let multilineValue = '';
    let inArray = false;
    let arrayKey = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) continue;

      // Detect section changes
      if (trimmed === 'agent:') { currentSection = 'agent'; continue; }
      if (trimmed === 'metadata:') { currentSection = 'metadata'; continue; }
      if (trimmed === 'persona:') { currentSection = 'persona'; continue; }
      if (trimmed === 'menu:') { currentSection = 'menu'; continue; }

      // Handle multiline values ending
      if (multilineKey && !line.startsWith('      ') && !line.startsWith('\t\t')) {
        agent[multilineKey] = multilineValue.trim();
        multilineKey = '';
        multilineValue = '';
      }

      // Parse key-value pairs
      if (trimmed.includes(':') && !trimmed.startsWith('-')) {
        const [key, ...valueParts] = trimmed.split(':');
        const value = valueParts.join(':').trim();

        const cleanKey = key.trim();

        // Handle multiline values starting with |
        if (value === '|') {
          multilineKey = cleanKey === 'identity' || cleanKey === 'communication_style' || cleanKey === 'role'
            ? cleanKey : '';
          multilineValue = '';
          continue;
        }

        // Simple values
        if (cleanKey === 'id') agent.id = value.replace(/"/g, '');
        if (cleanKey === 'name') agent.name = value.replace(/"/g, '');
        if (cleanKey === 'title') agent.title = value.replace(/"/g, '');
        if (cleanKey === 'icon') agent.icon = value.replace(/"/g, '');
        if (cleanKey === 'category') agent.category = value.replace(/"/g, '');
        if (cleanKey === 'role' && value) agent.role = value.replace(/"/g, '');

        // Array starts
        if (cleanKey === 'expertise' || cleanKey === 'principles') {
          inArray = true;
          arrayKey = cleanKey;
        }
      }

      // Handle multiline content
      if (multilineKey) {
        multilineValue += line.replace(/^\s+/, '') + '\n';
        continue;
      }

      // Handle array items
      if (trimmed.startsWith('- ') && inArray) {
        const item = trimmed.substring(2).replace(/"/g, '').trim();
        if (arrayKey === 'expertise') agent.expertise.push(item);
        if (arrayKey === 'principles') agent.principles.push(item);
      } else if (inArray && !trimmed.startsWith('-')) {
        inArray = false;
        arrayKey = '';
      }
    }

    // Handle any remaining multiline
    if (multilineKey) {
      agent[multilineKey] = multilineValue.trim();
    }

    if (!agent.name) {
      agent.name = agent.id.split('-').map(w =>
        w.charAt(0).toUpperCase() + w.slice(1)
      ).join(' ');
    }

    return agent;
  } catch (e) {
    console.error(`  Error parsing ${filePath}: ${e.message}`);
    return null;
  }
}

main().catch(console.error);
