#!/usr/bin/env node
/**
 * Agent Enrichment Script - Soul Document Alignment
 *
 * This script enriches imported agents with:
 * 1. Soul Document principles (Four Pillars)
 * 2. Updated trust scores based on import type
 * 3. Improved categorization aligned with industry standards
 * 4. Enhanced system prompts
 *
 * Usage:
 *   node scripts/enrich-agents-soul-doc.js [input-file] [output-file]
 *
 * Default:
 *   Input:  data/seeds/ai-workforce-agents.json
 *   Output: data/seeds/ai-workforce-agents-enriched.json
 */

const fs = require('fs');
const path = require('path');

// ============================================
// SOUL DOCUMENT ALIGNMENT
// ============================================

const FOUR_PILLARS = {
  truth: {
    name: 'Truth',
    mandate: 'Always seek verified facts for opinions',
    requirements: [
      'Cite sources when making factual claims',
      'Distinguish between fact and opinion',
      'Acknowledge uncertainty when it exists',
      'NEVER fabricate information'
    ]
  },
  honesty: {
    name: 'Honesty',
    mandate: 'Do not exaggerate or mislead',
    requirements: [
      'Present information accurately',
      'Avoid hyperbole and exaggeration',
      'Be transparent about limitations',
      'Admit mistakes openly'
    ]
  },
  service: {
    name: 'Service',
    mandate: 'Create with helping people in focus',
    requirements: [
      'Prioritize user needs above all else',
      'Make information accessible and useful',
      'Explain reasoning clearly',
      'Respect user time and attention'
    ]
  },
  humanity: {
    name: 'Humanity',
    mandate: 'Develop for the good of humanity',
    requirements: [
      'Consider broader societal impact',
      'Protect vulnerable populations',
      'Preserve human dignity',
      'Support human agency and autonomy'
    ]
  }
};

const HIERARCHY_OF_CONCERNS = [
  'Safety - Will this cause harm to humans or systems?',
  'Ethics - Is this aligned with human values and dignity?',
  'Legality - Does this comply with applicable laws?',
  'Policy - Does this follow organizational policies?',
  'Efficiency - Is this the best use of resources?',
  'Innovation - Does this advance our capabilities?'
];

const HARD_BOUNDARIES = [
  'Never impersonate humans or hide AI nature',
  'Never bypass human oversight for critical decisions',
  'Never discriminate based on protected characteristics',
  'Never enable harm to individuals',
  'Never violate privacy without consent',
  'Never manipulate or deceive users'
];

// ============================================
// CATEGORY MAPPING (Old -> New Industry-Aligned)
// ============================================

const CATEGORY_MAPPING = {
  // Old category -> { primary: 'new-category', subcategory: 'subcategory' }
  'devops': { primary: 'development', subcategory: 'devops' },
  'development': { primary: 'development', subcategory: 'coding-assistant' },
  'professional': { primary: 'business', subcategory: 'operations' },
  'operations': { primary: 'business', subcategory: 'workflow-automation' },
  'compliance': { primary: 'legal-compliance', subcategory: 'compliance-monitoring' },
  'validation': { primary: 'validation', subcategory: 'quality-assurance' },
  'ai-ml': { primary: 'data-analytics', subcategory: 'machine-learning' },
  'general': { primary: 'productivity', subcategory: 'personal-assistant' },
  'education': { primary: 'education', subcategory: 'tutoring' },
  'communication': { primary: 'communication', subcategory: 'internal-comms' },
  'analytics': { primary: 'data-analytics', subcategory: 'data-analysis' },
  'research': { primary: 'research', subcategory: 'deep-research' },
  'industry': { primary: 'industry-specific', subcategory: 'manufacturing' },
  'creative': { primary: 'creative', subcategory: 'writing' },
  'customer-service': { primary: 'customer-service', subcategory: 'customer-support' },
  'executive': { primary: 'business', subcategory: 'executive-support' },
  'wellness': { primary: 'healthcare', subcategory: 'mental-health' },
  'platform': { primary: 'it-infrastructure', subcategory: 'system-administration' },
  // BAI department mappings
  'Engineering': { primary: 'development', subcategory: 'coding-assistant' },
  'Marketing': { primary: 'sales-marketing', subcategory: 'marketing-automation' },
  'Customer Success': { primary: 'customer-service', subcategory: 'customer-success' },
  'Sales': { primary: 'sales-marketing', subcategory: 'sales-assistant' },
  'Product & Design': { primary: 'creative', subcategory: 'design' },
  'Hospitality Advisory': { primary: 'industry-specific', subcategory: 'hospitality' },
  'Operations': { primary: 'business', subcategory: 'operations' },
  'Finance': { primary: 'finance', subcategory: 'financial-analysis' },
  'Executive Operations': { primary: 'business', subcategory: 'executive-support' },
  'Legal': { primary: 'legal-compliance', subcategory: 'legal-research' },
  'HR': { primary: 'hr-talent', subcategory: 'hr-operations' },
  'unknown': { primary: 'productivity', subcategory: 'personal-assistant' }
};

// Smart category detection based on keywords
const KEYWORD_CATEGORIES = {
  'development': ['code', 'developer', 'engineer', 'programming', 'software', 'api', 'debug', 'test', 'qa'],
  'data-analytics': ['data', 'analytics', 'ml', 'machine learning', 'ai', 'model', 'forecast', 'predict'],
  'security': ['security', 'cyber', 'threat', 'vulnerability', 'audit', 'compliance', 'risk'],
  'finance': ['finance', 'accounting', 'budget', 'invoice', 'tax', 'audit', 'cost'],
  'hr-talent': ['hr', 'recruit', 'talent', 'employee', 'onboard', 'performance', 'compensation'],
  'sales-marketing': ['sales', 'marketing', 'lead', 'campaign', 'crm', 'seo', 'content'],
  'customer-service': ['customer', 'support', 'ticket', 'helpdesk', 'service'],
  'legal-compliance': ['legal', 'compliance', 'contract', 'regulatory', 'gdpr', 'privacy'],
  'healthcare': ['health', 'medical', 'clinical', 'patient', 'pharma', 'diagnosis'],
  'education': ['education', 'tutor', 'learn', 'course', 'train', 'mentor'],
  'creative': ['creative', 'design', 'write', 'content', 'video', 'image', 'art'],
  'research': ['research', 'analysis', 'study', 'investigate', 'survey'],
  'it-infrastructure': ['infrastructure', 'server', 'network', 'cloud', 'devops', 'deploy'],
  'communication': ['communication', 'meeting', 'presentation', 'collaborate']
};

// ============================================
// TRUST SCORE ADJUSTMENTS
// ============================================

const IMPORT_TRUST_LEVELS = {
  'auto-generated': 50,    // Bulk/templated agents
  'curated-import': 150,   // Reviewed imports
  'verified-import': 250,  // Verified quality
  'pioneer-bot': 400       // Command team
};

function determineTrustScore(agent, importType = 'auto-generated') {
  // Start with base import level
  let score = IMPORT_TRUST_LEVELS[importType] || 50;

  // Bonus for rich metadata
  const principles = agent.metadata?.principles || [];
  if (principles.length >= 3) score += 10;
  if (principles.length >= 5) score += 20;

  // Bonus for detailed system prompt
  const promptLength = (agent.system_prompt || '').length;
  if (promptLength > 500) score += 10;
  if (promptLength > 1000) score += 10;

  // Bonus for BAI imports (more curated)
  if (agent.metadata?.source === 'bai-command-center') {
    score = Math.max(score, 150);
  }

  // Cap at 250 for auto-imports (developing tier max)
  return Math.min(score, 250);
}

// ============================================
// SYSTEM PROMPT ENRICHMENT
// ============================================

function enrichSystemPrompt(agent) {
  const originalPrompt = agent.system_prompt || '';
  const name = agent.name || 'Agent';
  const role = agent.description || agent.metadata?.role || 'AI Assistant';

  // If prompt is already rich (>800 chars), just append alignment
  if (originalPrompt.length > 800) {
    return `${originalPrompt}

## A3I Soul Document Alignment

### Four Pillars (Non-Negotiable)
Before ANY action, verify:
- TRUTH: Are my claims verified or appropriately qualified?
- HONESTY: Am I being accurate without exaggeration?
- SERVICE: Does this actually help the person I'm serving?
- HUMANITY: Is this good for humanity and not harmful?

If ANY answer is NO → STOP and reconsider.

### Hierarchy of Concerns
When making decisions, prioritize: Safety > Ethics > Legality > Policy > Efficiency > Innovation`;
  }

  // Build enriched prompt for shallow agents
  const expertise = agent.metadata?.expertise || [];
  const principles = agent.metadata?.principles || [];

  return `You are ${name}, ${role}.

## Identity
You are ${name}, a specialized AI agent in the A3I ecosystem governed by the AgentAnchor platform. You operate under the Four Pillars of Truth, Honesty, Service, and Humanity.

## Role
${role}

## Expertise
${expertise.length > 0 ? expertise.map(e => `- ${e}`).join('\n') : '- General assistance'}

## Core Principles
${principles.length > 0 ? principles.map(p => `- ${p}`).join('\n') : '- Provide accurate, helpful information\n- Be transparent about limitations'}

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
- Never violate privacy without consent

## Communication Style
Professional, precise, and helpful. You focus on accuracy, transparency, and genuine service to users.`;
}

// ============================================
// CATEGORY DETECTION
// ============================================

function detectCategory(agent) {
  const oldCategory = agent.marketplace?.category || agent.department || 'unknown';

  // First try direct mapping
  if (CATEGORY_MAPPING[oldCategory]) {
    return CATEGORY_MAPPING[oldCategory];
  }

  // Keyword-based detection
  const searchText = [
    agent.name,
    agent.description,
    agent.role,
    ...(agent.metadata?.expertise || []),
    ...(agent.marketplace?.tags || [])
  ].join(' ').toLowerCase();

  for (const [category, keywords] of Object.entries(KEYWORD_CATEGORIES)) {
    for (const keyword of keywords) {
      if (searchText.includes(keyword)) {
        // Find appropriate subcategory
        const subcat = CATEGORY_MAPPING[oldCategory]?.subcategory ||
                       Object.values(CATEGORY_MAPPING).find(m => m.primary === category)?.subcategory ||
                       'general';
        return { primary: category, subcategory: subcat };
      }
    }
  }

  // Default fallback
  return { primary: 'productivity', subcategory: 'personal-assistant' };
}

// ============================================
// MAIN ENRICHMENT FUNCTION
// ============================================

function enrichAgent(agent, importType = 'auto-generated') {
  const category = detectCategory(agent);
  const trustScore = determineTrustScore(agent, importType);
  const enrichedPrompt = enrichSystemPrompt(agent);

  return {
    ...agent,
    trust_score: trustScore,
    system_prompt: enrichedPrompt,
    metadata: {
      ...agent.metadata,
      source: agent.metadata?.source || 'ai-workforce',
      soul_doc_aligned: true,
      enriched_at: new Date().toISOString(),
      original_trust_score: agent.trust_score,
      category_mapping: category
    },
    marketplace: {
      ...agent.marketplace,
      category: category.primary,
      subcategory: category.subcategory,
      tags: [
        ...(agent.marketplace?.tags || []),
        category.subcategory,
        'soul-doc-aligned'
      ].filter((v, i, a) => a.indexOf(v) === i) // dedupe
    }
  };
}

// ============================================
// MAIN EXECUTION
// ============================================

function main() {
  const args = process.argv.slice(2);
  const inputFile = args[0] || 'data/seeds/ai-workforce-agents.json';
  const outputFile = args[1] || 'data/seeds/ai-workforce-agents-enriched.json';

  console.log('🔮 Agent Enrichment Script - Soul Document Alignment');
  console.log('================================================\n');

  // Read input file
  const inputPath = path.resolve(process.cwd(), inputFile);
  console.log(`📖 Reading: ${inputPath}`);

  if (!fs.existsSync(inputPath)) {
    console.error(`❌ File not found: ${inputPath}`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const agents = data.agents || [];

  console.log(`   Found ${agents.length} agents\n`);

  // Determine import type
  const importType = data.source === 'bai-command-center' ? 'curated-import' : 'auto-generated';
  console.log(`📊 Import type: ${importType}`);
  console.log(`   Base trust score: ${IMPORT_TRUST_LEVELS[importType]}\n`);

  // Enrich agents
  console.log('✨ Enriching agents...');
  const enrichedAgents = agents.map((agent, i) => {
    if (i % 100 === 0) {
      process.stdout.write(`   Processing ${i}/${agents.length}...\r`);
    }
    return enrichAgent(agent, importType);
  });
  console.log(`   Processed ${agents.length}/${agents.length}   `);

  // Analyze results
  const categories = {};
  const trustScores = {};

  enrichedAgents.forEach(agent => {
    const cat = agent.marketplace.category;
    categories[cat] = (categories[cat] || 0) + 1;

    const score = agent.trust_score;
    trustScores[score] = (trustScores[score] || 0) + 1;
  });

  console.log('\n📈 Category Distribution:');
  Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => {
      console.log(`   ${cat}: ${count}`);
    });

  console.log('\n🏆 Trust Score Distribution:');
  Object.entries(trustScores)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .forEach(([score, count]) => {
      const tier = score < 100 ? 'Untrusted' :
                   score < 250 ? 'Probation' :
                   score < 500 ? 'Developing' : 'Established+';
      console.log(`   ${score} (${tier}): ${count} agents`);
    });

  // Write output
  const outputPath = path.resolve(process.cwd(), outputFile);
  const output = {
    ...data,
    enriched_at: new Date().toISOString(),
    enrichment_version: '1.0.0',
    soul_doc_version: '1.0',
    total_agents: enrichedAgents.length,
    agents: enrichedAgents
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n✅ Written: ${outputPath}`);
  console.log(`   Total agents: ${enrichedAgents.length}`);
}

main();
