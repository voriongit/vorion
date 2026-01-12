/**
 * Check database schema
 */

const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const DATABASE_URL = process.env.DATABASE_URL;

async function checkSchema() {
  console.log('🔍 Checking Database Schema\n');

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected\n');

    // List all tables
    const tables = await client.query(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name
    `);

    console.log('📋 Tables found:');
    let currentSchema = '';
    for (const row of tables.rows) {
      if (row.table_schema !== currentSchema) {
        currentSchema = row.table_schema;
        console.log(`\n   Schema: ${currentSchema}`);
      }
      console.log(`   - ${row.table_name}`);
    }

    // Check bots table specifically
    const botsCheck = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'bots'
      ORDER BY ordinal_position
    `);

    if (botsCheck.rows.length > 0) {
      console.log('\n\n📋 Bots table columns:');
      for (const row of botsCheck.rows) {
        console.log(`   ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? '(required)' : ''}`);
      }
    } else {
      console.log('\n\n⚠️ Bots table not found in any schema');
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
  }
}

checkSchema().catch(console.error);
