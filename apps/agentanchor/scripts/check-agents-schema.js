/**
 * Check agents table schema
 */

const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const DATABASE_URL = process.env.DATABASE_URL;

async function checkSchema() {
  console.log('🔍 Checking Agents Table Schema\n');

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // Check agents table
    const agentsCheck = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'agents'
      ORDER BY ordinal_position
    `);

    console.log('📋 Agents table columns:\n');
    for (const row of agentsCheck.rows) {
      const nullable = row.is_nullable === 'NO' ? 'required' : 'optional';
      const defaultVal = row.column_default ? ` default: ${row.column_default.substring(0, 30)}` : '';
      console.log(`   ${row.column_name}: ${row.data_type} (${nullable})${defaultVal}`);
    }

    // Count existing agents
    const countResult = await client.query('SELECT COUNT(*) as count FROM agents');
    console.log(`\n📊 Existing agents: ${countResult.rows[0].count}`);

    // Sample agent
    const sampleResult = await client.query('SELECT * FROM agents LIMIT 1');
    if (sampleResult.rows.length > 0) {
      console.log('\n📋 Sample agent:');
      const sample = sampleResult.rows[0];
      console.log(`   Name: ${sample.name}`);
      console.log(`   Status: ${sample.status}`);
      console.log(`   Trust: ${sample.trust_score}`);
      console.log(`   Capabilities: ${JSON.stringify(sample.capabilities)}`);
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
  }
}

checkSchema().catch(console.error);
