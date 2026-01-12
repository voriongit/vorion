/**
 * Export BAI agents to seed file
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const DATABASE_URL = process.env.DATABASE_URL;

async function exportAgents() {
  console.log('📦 Exporting BAI Agents to Seed File\n');

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // Get all BAI agents with their marketplace listings
    const result = await client.query(`
      SELECT
        a.id,
        a.name,
        a.description,
        a.system_prompt,
        a.model,
        a.status,
        a.trust_score,
        a.config,
        a.metadata,
        a.graduated_at,
        ml.category as marketplace_category,
        ml.tags as marketplace_tags,
        ml.commission_rate,
        ml.clone_price,
        ml.enterprise_price
      FROM agents a
      LEFT JOIN marketplace_listings ml ON ml.agent_id = a.id
      WHERE a.metadata->>'source' = 'bai-migration'
      ORDER BY a.name
    `);

    console.log(`Found ${result.rows.length} BAI agents\n`);

    // Transform to seed format
    const agents = result.rows.map(row => ({
      name: row.name,
      description: row.description,
      system_prompt: row.system_prompt,
      model: row.model,
      status: row.status,
      trust_score: row.trust_score,
      config: row.config,
      metadata: {
        ...row.metadata,
        exported_at: new Date().toISOString()
      },
      marketplace: row.marketplace_category ? {
        category: row.marketplace_category,
        tags: row.marketplace_tags,
        pricing: {
          commission_rate: parseFloat(row.commission_rate),
          clone_price: parseFloat(row.clone_price),
          enterprise_price: parseFloat(row.enterprise_price)
        }
      } : null
    }));

    // Create seed file
    const seedData = {
      version: '1.0.0',
      source: 'bai-ai-workforce',
      exported_at: new Date().toISOString(),
      agent_count: agents.length,
      agents: agents
    };

    const outputPath = path.join(__dirname, '../data/seeds/ai-workforce-agents.json');
    fs.writeFileSync(outputPath, JSON.stringify(seedData, null, 2));

    console.log(`✅ Exported to: ${outputPath}`);
    console.log(`   Agents: ${agents.length}`);
    console.log(`   File size: ${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB`);

    // Summary by category
    const categories = {};
    agents.forEach(a => {
      const cat = a.metadata?.category || 'general';
      categories[cat] = (categories[cat] || 0) + 1;
    });

    console.log('\n📊 By Category:');
    Object.entries(categories).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
      console.log(`   ${cat}: ${count}`);
    });

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
  }
}

exportAgents().catch(console.error);
