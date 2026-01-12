/**
 * Fix graduation and publishing for BAI agents
 */

const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const DATABASE_URL = process.env.DATABASE_URL;

async function fixAgents() {
  console.log('🔧 Fixing BAI Agent Graduation & Publishing\n');

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // Check trust_history schema
    const trustHistorySchema = await client.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'trust_history'
      ORDER BY ordinal_position
    `);
    console.log('📋 trust_history columns:');
    for (const row of trustHistorySchema.rows) {
      console.log(`   ${row.column_name}: ${row.data_type} (${row.udt_name})`);
    }

    // Check marketplace_listings schema
    const marketplaceSchema = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'marketplace_listings'
      ORDER BY ordinal_position
    `);
    console.log('\n📋 marketplace_listings columns:');
    for (const row of marketplaceSchema.rows) {
      console.log(`   ${row.column_name}: ${row.data_type}`);
    }

    // Check trust_source enum values
    const enumValues = await client.query(`
      SELECT enumlabel FROM pg_enum
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'trust_source')
    `);
    console.log('\n📋 trust_source enum values:');
    for (const row of enumValues.rows) {
      console.log(`   - ${row.enumlabel}`);
    }

    // Graduate agents - just update status and trust_score, skip trust_history
    console.log('\n🎖️ Graduating training agents...\n');
    const trainingAgents = await client.query(`
      SELECT id, name FROM agents
      WHERE status = 'training'
      AND metadata->>'source' = 'bai-migration'
    `);

    let graduated = 0;
    for (const agent of trainingAgents.rows) {
      await client.query(`
        UPDATE agents
        SET status = 'active',
            trust_score = 400,
            graduated_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
      `, [agent.id]);
      console.log(`   ✅ ${agent.name} → active (trust: 400)`);
      graduated++;
    }
    console.log(`\n   Graduated: ${graduated} agents`);

    // Count active agents
    const activeCount = await client.query(`
      SELECT COUNT(*) as count FROM agents
      WHERE status = 'active'
      AND metadata->>'source' = 'bai-migration'
    `);
    console.log(`   Active BAI agents: ${activeCount.rows[0].count}`);

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
  }
}

fixAgents().catch(console.error);
