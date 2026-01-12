/**
 * Create BAI System User for agent imports
 */

const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const DATABASE_URL = process.env.DATABASE_URL;

async function createSystemUser() {
  console.log('👤 Creating BAI System User\n');

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // Check existing profiles
    const existingProfiles = await client.query(`
      SELECT id, email, full_name
      FROM profiles
      LIMIT 5
    `);

    if (existingProfiles.rows.length > 0) {
      console.log('📋 Found existing profiles:');
      for (const user of existingProfiles.rows) {
        console.log(`   ${user.full_name || user.email || user.id}`);
      }
      console.log('\n✅ Users already exist');
      return;
    }

    // No profiles exist, create a system user directly
    console.log('⚠️ No profiles found, creating BAI System profile...\n');

    const systemUserId = '00000000-0000-0000-0000-000000000001';

    await client.query(`
      INSERT INTO profiles (id, email, full_name, created_at, updated_at)
      VALUES ($1, 'bai-system@agentanchor.ai', 'BAI System', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `, [systemUserId]);

    console.log('✅ Created BAI System user');
    console.log(`   ID: ${systemUserId}`);

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
  }
}

createSystemUser().catch(console.error);
