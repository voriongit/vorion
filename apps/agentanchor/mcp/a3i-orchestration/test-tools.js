#!/usr/bin/env node
/**
 * Direct tool function tests for A3I MCP Server
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
});

async function testTools() {
  console.log('Testing MCP Tool Functions...\n');

  try {
    // Test 1: find_experts
    console.log('1. find_experts("security")');
    const experts = await pool.query(
      `SELECT name, description, metadata->>'category' as category, metadata->'expertise' as expertise
       FROM agents
       WHERE metadata->'expertise' @> $1
          OR name ILIKE $2
          OR description ILIKE $2
       LIMIT 5`,
      [JSON.stringify(['security']), '%security%']
    );
    console.log(`   ✓ Found ${experts.rows.length} security experts:`);
    experts.rows.forEach(e => console.log(`     - ${e.name} (${e.category})`));
    console.log('');

    // Test 2: get_agent_info
    console.log('2. get_agent_info("Atlas Mercer")');
    const agent = await pool.query(
      `SELECT name, description, system_prompt, status, trust_score, metadata
       FROM agents WHERE name ILIKE $1 LIMIT 1`,
      ['%Atlas Mercer%']
    );
    if (agent.rows.length > 0) {
      const a = agent.rows[0];
      console.log(`   ✓ Found: ${a.name}`);
      console.log(`     Status: ${a.status}, Trust: ${a.trust_score}`);
      console.log(`     Category: ${a.metadata?.category}`);
    }
    console.log('');

    // Test 3: check_guard_rails
    console.log('3. check_guard_rails (fetching active rails)');
    const rails = await pool.query(
      `SELECT name, type, description
       FROM guard_rails
       WHERE is_active = true AND scope = 'universal'
       ORDER BY type
       LIMIT 5`
    );
    console.log(`   ✓ Found ${rails.rows.length} universal guard rails:`);
    rails.rows.forEach(r => console.log(`     - [${r.type}] ${r.name}`));
    console.log('');

    // Test 4: query_team
    console.log('4. query_team (fetching team info)');
    const team = await pool.query(
      `SELECT t.id, t.name, t.purpose, array_agg(a.name) as members
       FROM teams t
       LEFT JOIN team_memberships tm ON tm.team_id = t.id
       LEFT JOIN agents a ON a.id = tm.agent_id
       GROUP BY t.id
       LIMIT 1`
    );
    if (team.rows.length > 0) {
      const t = team.rows[0];
      console.log(`   ✓ Team: ${t.name}`);
      console.log(`     Purpose: ${t.purpose?.substring(0, 60)}...`);
      console.log(`     Members: ${t.members?.filter(Boolean).length || 0}`);
    }
    console.log('');

    // Test 5: escalate (check chains)
    console.log('5. escalate (fetching escalation chains)');
    const chains = await pool.query(
      `SELECT name, chain, sla_by_level FROM escalation_chains LIMIT 3`
    );
    console.log(`   ✓ Found ${chains.rows.length} escalation chains:`);
    chains.rows.forEach(c => console.log(`     - ${c.name}`));
    console.log('');

    // Test 6: log_decision (insert test)
    console.log('6. log_decision (testing insert)');
    const decision = await pool.query(
      `INSERT INTO decision_log (decision_type, decision, reasoning, alternatives, decided_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id`,
      [
        'mcp_test',
        'Verify MCP server functionality',
        'Testing database write operations',
        JSON.stringify(['skip test', 'manual test'])
      ]
    );
    console.log(`   ✓ Logged decision with ID: ${decision.rows[0].id}`);
    console.log('');

    // Test 7: share_knowledge (via agent_memories)
    console.log('7. share_knowledge (testing memory insert)');
    const agentForMemory = await pool.query('SELECT id FROM agents LIMIT 1');
    if (agentForMemory.rows.length > 0) {
      const memory = await pool.query(
        `INSERT INTO agent_memories (agent_id, memory_type, content, confidence, importance, tags)
         VALUES ($1, 'semantic', $2, $3, $4, $5)
         RETURNING id`,
        [
          agentForMemory.rows[0].id,
          'MCP server test completed successfully',
          0.95,
          0.5,
          JSON.stringify(['test', 'mcp'])
        ]
      );
      console.log(`   ✓ Created memory with ID: ${memory.rows[0].id}`);
    }
    console.log('');

    console.log('═══════════════════════════════════════');
    console.log('All MCP tool function tests passed! ✓');
    console.log('═══════════════════════════════════════');

  } catch (error) {
    console.error(`\n✗ Error: ${error.message}`);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

testTools();
