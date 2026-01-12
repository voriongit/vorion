/**
 * Generate comprehensive agent catalog
 */

const { Client } = require('pg');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const DATABASE_URL = process.env.DATABASE_URL;

async function generateCatalog() {
  console.log('📚 Generating Comprehensive Agent Catalog...\n');

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    const result = await client.query(`
      SELECT
        a.name,
        a.description,
        a.system_prompt,
        a.model,
        a.status,
        a.trust_score,
        a.config,
        a.metadata,
        ml.category as marketplace_category,
        ml.tags as marketplace_tags,
        ml.clone_price,
        ml.enterprise_price
      FROM agents a
      LEFT JOIN marketplace_listings ml ON ml.agent_id = a.id
      WHERE a.metadata->>'source' = 'bai-migration'
      ORDER BY
        a.metadata->>'category',
        a.name
    `);

    // Group by category
    const byCategory = {};
    for (const agent of result.rows) {
      const cat = agent.metadata?.category || 'general';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(agent);
    }

    // Generate markdown
    let md = `# A3I Agent Catalog
## Complete Directory of 300 AI Governance Agents

**Generated:** ${new Date().toISOString().split('T')[0]}
**Total Agents:** ${result.rows.length}
**Categories:** ${Object.keys(byCategory).length}

---

## Table of Contents

`;

    // TOC
    const categories = Object.keys(byCategory).sort();
    categories.forEach((cat, i) => {
      const count = byCategory[cat].length;
      const displayName = cat.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      md += `${i + 1}. [${displayName}](#${cat}) (${count} agents)\n`;
    });

    md += `\n---\n\n`;

    // Each category
    for (const cat of categories) {
      const agents = byCategory[cat];
      const displayName = cat.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

      md += `## ${displayName} {#${cat}}\n\n`;
      md += `**${agents.length} agents in this category**\n\n`;

      for (const agent of agents) {
        const meta = agent.metadata || {};
        const config = agent.config || {};
        const icon = meta.icon || '🤖';
        const expertise = meta.expertise || [];
        const principles = meta.principles || [];
        const commands = meta.menuCommands || [];

        md += `### ${icon} ${agent.name}\n\n`;
        md += `**${agent.description}**\n\n`;

        md += `| Attribute | Value |\n`;
        md += `|-----------|-------|\n`;
        md += `| Status | ${agent.status} |\n`;
        md += `| Trust Score | ${agent.trust_score} |\n`;
        md += `| Model | ${agent.model} |\n`;
        md += `| Category | ${cat} |\n`;
        md += `| Marketplace | ${agent.marketplace_category || 'N/A'} |\n`;
        md += `| Clone Price | $${agent.clone_price || '49.99'} |\n`;
        md += `| Enterprise | $${agent.enterprise_price || '499.99'} |\n`;

        if (expertise.length > 0) {
          md += `\n**Expertise:**\n`;
          expertise.forEach(e => md += `- ${e}\n`);
        }

        if (principles.length > 0) {
          md += `\n**Core Principles:**\n`;
          principles.forEach(p => md += `- ${p}\n`);
        }

        if (commands.length > 0) {
          md += `\n**Commands:**\n`;
          md += `| Command | Label | Action |\n`;
          md += `|---------|-------|--------|\n`;
          commands.forEach(c => {
            md += `| /${c.cmd} | ${c.label} | ${c.action} |\n`;
          });
        }

        // Extract persona from system prompt
        if (agent.system_prompt) {
          const identityMatch = agent.system_prompt.match(/## Identity\n([\s\S]*?)(?=\n##|$)/);
          if (identityMatch) {
            md += `\n**Persona:**\n${identityMatch[1].trim().substring(0, 500)}...\n`;
          }
        }

        md += `\n---\n\n`;
      }
    }

    // Summary statistics
    md += `## Summary Statistics\n\n`;
    md += `| Category | Agent Count |\n`;
    md += `|----------|-------------|\n`;
    categories.forEach(cat => {
      const displayName = cat.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      md += `| ${displayName} | ${byCategory[cat].length} |\n`;
    });
    md += `| **TOTAL** | **${result.rows.length}** |\n`;

    // Write file
    const outputPath = 'C:/BAI/ai-workforce/docs/AGENT_CATALOG.md';
    fs.mkdirSync('C:/BAI/ai-workforce/docs', { recursive: true });
    fs.writeFileSync(outputPath, md);

    console.log(`✅ Catalog generated: ${outputPath}`);
    console.log(`   Agents: ${result.rows.length}`);
    console.log(`   Categories: ${categories.length}`);
    console.log(`   File size: ${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB`);

    // Also generate JSON version
    const jsonOutput = {
      generated: new Date().toISOString(),
      total_agents: result.rows.length,
      categories: categories.length,
      agents: result.rows.map(a => ({
        name: a.name,
        title: a.description,
        icon: a.metadata?.icon,
        category: a.metadata?.category,
        status: a.status,
        trust_score: a.trust_score,
        model: a.model,
        expertise: a.metadata?.expertise || [],
        principles: a.metadata?.principles || [],
        commands: a.metadata?.menuCommands || [],
        marketplace: {
          category: a.marketplace_category,
          tags: a.marketplace_tags,
          clone_price: a.clone_price,
          enterprise_price: a.enterprise_price
        }
      }))
    };

    const jsonPath = 'C:/BAI/ai-workforce/docs/agent-catalog.json';
    fs.writeFileSync(jsonPath, JSON.stringify(jsonOutput, null, 2));
    console.log(`   JSON: ${jsonPath}`);

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
  }
}

generateCatalog().catch(console.error);
