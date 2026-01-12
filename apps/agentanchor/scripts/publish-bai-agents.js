/**
 * Publish BAI agents to marketplace
 */

const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const DATABASE_URL = process.env.DATABASE_URL;
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

// Category mapping from agent metadata
const CATEGORY_MAP = {
  'strategic-leadership': 'business',
  'technical': 'development',
  'ai-ml': 'ai-ml',
  'data-analytics': 'analytics',
  'legal-compliance': 'compliance',
  'customer-success': 'customer-service',
  'operations': 'operations',
  'creative': 'creative',
  'research': 'research',
  'communication': 'communication',
  'learning-development': 'education',
  'industry-vertical': 'industry',
  'wellness': 'wellness',
  'tech-health': 'devops',
  'business-health': 'operations'
};

async function publishAgents() {
  console.log('🚀 Publishing BAI Agents to Marketplace\n');

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // Get all active BAI agents not yet listed
    const agents = await client.query(`
      SELECT a.id, a.name, a.description, a.config, a.metadata
      FROM agents a
      LEFT JOIN marketplace_listings ml ON ml.agent_id = a.id
      WHERE a.status = 'active'
      AND a.metadata->>'source' = 'bai-migration'
      AND ml.id IS NULL
    `);

    console.log(`📦 Found ${agents.rows.length} agents to publish\n`);

    let published = 0;
    for (const agent of agents.rows) {
      const metadata = agent.metadata || {};
      const config = agent.config || {};

      // Determine category
      const category = CATEGORY_MAP[metadata.category] || 'general';

      // Build tags from capabilities and expertise
      const capabilities = config.capabilities || [];
      const tags = [...new Set([
        ...capabilities.slice(0, 5),
        metadata.category,
        'bai-advisor'
      ])].filter(Boolean);

      try {
        await client.query(`
          INSERT INTO marketplace_listings (
            agent_id,
            seller_id,
            title,
            description,
            status,
            commission_rate,
            clone_price,
            enterprise_price,
            available_for_commission,
            available_for_clone,
            available_for_enterprise,
            max_clones,
            current_clones,
            tags,
            category,
            preview_config,
            view_count,
            acquisition_count,
            average_rating,
            review_count,
            created_at,
            updated_at,
            published_at
          ) VALUES (
            $1, $2, $3, $4, 'active',
            0.15, 49.99, 499.99,
            true, true, true,
            100, 0,
            $5, $6, $7,
            0, 0, 0, 0,
            NOW(), NOW(), NOW()
          )
        `, [
          agent.id,
          SYSTEM_USER_ID,
          agent.name,
          agent.description,
          JSON.stringify(tags),
          category,
          JSON.stringify({
            demo_enabled: true,
            sample_prompts: [
              `What can you help me with, ${agent.name}?`,
              'Give me your expert perspective on my current challenge.',
              'What are the key considerations I should think about?'
            ]
          })
        ]);

        console.log(`   ✅ ${agent.name} → published (${category})`);
        published++;
      } catch (err) {
        console.log(`   ❌ ${agent.name}: ${err.message.substring(0, 50)}`);
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Published: ${published} agents`);

    // Count total listings
    const listingCount = await client.query(`
      SELECT COUNT(*) as count FROM marketplace_listings
      WHERE seller_id = $1
    `, [SYSTEM_USER_ID]);
    console.log(`   Total BAI listings: ${listingCount.rows[0].count}`);

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
  }
}

publishAgents().catch(console.error);
