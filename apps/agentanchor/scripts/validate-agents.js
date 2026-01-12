#!/usr/bin/env node
/**
 * Agent Validation Script
 * Validates all agents in the database are properly configured and ready
 */

const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const DATABASE_URL = process.env.DATABASE_URL;

const VALIDATION_RULES = {
  // Required fields
  required: ['id', 'name', 'status', 'trust_score'],

  // Status must be valid
  validStatuses: ['draft', 'training', 'active', 'suspended', 'archived'],

  // Trust score range
  trustScoreMin: 0,
  trustScoreMax: 1000,

  // Active agents need these
  activeRequirements: ['system_prompt', 'model'],

  // Marketplace listing requirements
  marketplaceRequirements: ['description'],
};

async function validateAgents() {
  console.log('════════════════════════════════════════════════════════════');
  console.log('   🔍 AgentAnchor - Agent Validation');
  console.log('════════════════════════════════════════════════════════════\n');

  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL not set');
    process.exit(1);
  }

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  console.log('✅ Connected to database\n');

  const stats = {
    total: 0,
    active: 0,
    valid: 0,
    withListings: 0,
    issues: [],
    warnings: [],
  };

  try {
    // Get all agents (using agents view)
    const { rows: agents } = await client.query(`
      SELECT
        a.*,
        ml.id as listing_id,
        ml.status as listing_status
      FROM agents a
      LEFT JOIN marketplace_listings ml ON ml.agent_id = a.id
      ORDER BY a.name
    `);

    stats.total = agents.length;
    console.log(`📊 Total agents: ${agents.length}\n`);

    // Validate each agent
    for (const agent of agents) {
      const agentIssues = [];
      const agentWarnings = [];

      // Check required fields
      for (const field of VALIDATION_RULES.required) {
        if (!agent[field] && agent[field] !== 0) {
          agentIssues.push(`Missing required field: ${field}`);
        }
      }

      // Check status
      if (!VALIDATION_RULES.validStatuses.includes(agent.status)) {
        agentIssues.push(`Invalid status: ${agent.status}`);
      }

      // Check trust score range
      if (agent.trust_score < VALIDATION_RULES.trustScoreMin ||
          agent.trust_score > VALIDATION_RULES.trustScoreMax) {
        agentIssues.push(`Trust score out of range: ${agent.trust_score}`);
      }

      // Active agent checks
      if (agent.status === 'active') {
        stats.active++;

        for (const field of VALIDATION_RULES.activeRequirements) {
          if (!agent[field]) {
            agentWarnings.push(`Active agent missing: ${field}`);
          }
        }

        // Should have marketplace listing
        if (!agent.listing_id) {
          agentWarnings.push('Active agent has no marketplace listing');
        } else {
          stats.withListings++;
          if (agent.listing_status !== 'active') {
            agentWarnings.push(`Listing status is '${agent.listing_status}', not 'active'`);
          }
        }
      }

      // Model validation
      if (agent.model && !agent.model.includes('claude')) {
        agentWarnings.push(`Non-Claude model: ${agent.model}`);
      }

      // Record issues
      if (agentIssues.length > 0) {
        stats.issues.push({ name: agent.name, id: agent.id, issues: agentIssues });
      } else {
        stats.valid++;
      }

      if (agentWarnings.length > 0) {
        stats.warnings.push({ name: agent.name, id: agent.id, warnings: agentWarnings });
      }
    }

    // Status breakdown
    const { rows: statusBreakdown } = await client.query(`
      SELECT status, COUNT(*) as count
      FROM agents
      GROUP BY status
      ORDER BY count DESC
    `);

    console.log('📈 Status Breakdown:');
    for (const row of statusBreakdown) {
      console.log(`   ${row.status}: ${row.count}`);
    }

    // Trust tier breakdown
    const { rows: tierBreakdown } = await client.query(`
      SELECT
        CASE
          WHEN trust_score >= 900 THEN 'Legendary (900-1000)'
          WHEN trust_score >= 750 THEN 'Trusted (750-899)'
          WHEN trust_score >= 500 THEN 'Established (500-749)'
          WHEN trust_score >= 250 THEN 'Developing (250-499)'
          WHEN trust_score >= 100 THEN 'Probation (100-249)'
          ELSE 'Untrusted (0-99)'
        END as tier,
        COUNT(*) as count
      FROM agents
      GROUP BY tier
      ORDER BY MIN(trust_score) DESC
    `);

    console.log('\n🏆 Trust Tier Breakdown:');
    for (const row of tierBreakdown) {
      console.log(`   ${row.tier}: ${row.count}`);
    }

    // Marketplace stats
    const { rows: listingStats } = await client.query(`
      SELECT status, COUNT(*) as count
      FROM marketplace_listings
      GROUP BY status
    `);

    console.log('\n🏪 Marketplace Listings:');
    for (const row of listingStats) {
      console.log(`   ${row.status}: ${row.count}`);
    }

    // Print summary
    console.log('\n════════════════════════════════════════════════════════════');
    console.log('   📊 VALIDATION SUMMARY');
    console.log('════════════════════════════════════════════════════════════\n');

    console.log(`   Total Agents:     ${stats.total}`);
    console.log(`   Active Agents:    ${stats.active}`);
    console.log(`   Valid Agents:     ${stats.valid}`);
    console.log(`   With Listings:    ${stats.withListings}`);
    console.log(`   Issues Found:     ${stats.issues.length}`);
    console.log(`   Warnings Found:   ${stats.warnings.length}`);

    // Print issues
    if (stats.issues.length > 0) {
      console.log('\n❌ ISSUES (require fixes):');
      for (const item of stats.issues.slice(0, 10)) {
        console.log(`   ${item.name}:`);
        item.issues.forEach(i => console.log(`      - ${i}`));
      }
      if (stats.issues.length > 10) {
        console.log(`   ... and ${stats.issues.length - 10} more`);
      }
    }

    // Print warnings (first 5)
    if (stats.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS (optional fixes):');
      for (const item of stats.warnings.slice(0, 5)) {
        console.log(`   ${item.name}:`);
        item.warnings.forEach(w => console.log(`      - ${w}`));
      }
      if (stats.warnings.length > 5) {
        console.log(`   ... and ${stats.warnings.length - 5} more`);
      }
    }

    // Final verdict
    console.log('\n════════════════════════════════════════════════════════════');
    if (stats.issues.length === 0) {
      console.log('   ✅ ALL AGENTS VALID - Ready for production!');
    } else {
      console.log(`   ⚠️  ${stats.issues.length} agents have issues that need fixing`);
    }
    console.log('════════════════════════════════════════════════════════════\n');

  } finally {
    await client.end();
  }
}

validateAgents().catch(console.error);
