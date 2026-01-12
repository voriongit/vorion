#!/usr/bin/env node
/**
 * Direct database connection test for A3I MCP Server
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const { Pool } = pg;

async function testDatabase() {
  console.log('Testing database connection...\n');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 1,
    connectionTimeoutMillis: 10000,
  });

  try {
    // Test 1: Basic connection
    console.log('1. Connecting to database...');
    const client = await pool.connect();
    console.log('   ✓ Connected successfully\n');

    // Test 2: Check agents table
    console.log('2. Checking agents table...');
    const agentsResult = await client.query('SELECT COUNT(*) as count FROM agents');
    console.log(`   ✓ Found ${agentsResult.rows[0].count} agents\n`);

    // Test 3: Sample agent lookup
    console.log('3. Sample agent lookup...');
    const sampleAgent = await client.query(
      "SELECT name, description FROM agents LIMIT 3"
    );
    for (const agent of sampleAgent.rows) {
      console.log(`   - ${agent.name}: ${agent.description?.substring(0, 50)}...`);
    }
    console.log('');

    // Test 4: Check guard_rails table
    console.log('4. Checking guard_rails table...');
    const railsResult = await client.query('SELECT COUNT(*) as count FROM guard_rails WHERE is_active = true');
    console.log(`   ✓ Found ${railsResult.rows[0].count} active guard rails\n`);

    // Test 5: Check teams table
    console.log('5. Checking teams table...');
    const teamsResult = await client.query('SELECT COUNT(*) as count FROM teams');
    console.log(`   ✓ Found ${teamsResult.rows[0].count} teams\n`);

    // Test 6: Check decision_log table exists
    console.log('6. Checking decision_log table...');
    const decisionResult = await client.query('SELECT COUNT(*) as count FROM decision_log');
    console.log(`   ✓ Found ${decisionResult.rows[0].count} logged decisions\n`);

    // Test 7: Check agent_messages table
    console.log('7. Checking agent_messages table...');
    const messagesResult = await client.query('SELECT COUNT(*) as count FROM agent_messages');
    console.log(`   ✓ Found ${messagesResult.rows[0].count} agent messages\n`);

    // Test 8: Check escalation_chains table
    console.log('8. Checking escalation_chains table...');
    const chainsResult = await client.query('SELECT COUNT(*) as count FROM escalation_chains');
    console.log(`   ✓ Found ${chainsResult.rows[0].count} escalation chains\n`);

    client.release();
    console.log('All database tests passed! ✓');

  } catch (error) {
    console.error(`\n✗ Error: ${error.message}`);
    if (error.message.includes('does not exist')) {
      console.log('\n  Missing table - you may need to run migrations.');
    }
  } finally {
    await pool.end();
  }
}

testDatabase();
