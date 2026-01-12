/**
 * AgentAnchorAI - BAI Agent Import Script
 *
 * Imports BAI agents from seed file into A3I database
 *
 * Usage:
 *   npx tsx scripts/import-bai-agents.ts
 *
 * Options:
 *   --dry-run    Preview without inserting
 *   --owner-id   UUID of owner (required for production)
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

// Configuration
const SEED_FILE = 'C:/BAI/ai-workforce/scripts/a3i-agents-seed.json';
const DRY_RUN = process.argv.includes('--dry-run');

// Get owner ID from args or env
const ownerIdArg = process.argv.find(arg => arg.startsWith('--owner-id='));
const OWNER_ID = ownerIdArg?.split('=')[1] || process.env.DEFAULT_OWNER_ID;

// Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface BAISeedAgent {
  name: string;
  description: string;
  model: string;
  temperature: number;
  max_tokens: number;
  system_prompt: string;
  specialization: string;
  personality_traits: string[];
  capabilities: string[];
  trust_score: number;
  trust_tier: string;
  status: string;
  metadata: {
    source: string;
    original_id: string;
    icon: string;
    category: string;
    expertise: string[];
    principles: string[];
    menu_commands: Array<{ cmd: string; label: string; action: string }>;
  };
}

interface SeedFile {
  version: string;
  generated: string;
  source: string;
  target: string;
  agents: BAISeedAgent[];
  stats: {
    total: number;
    converted: number;
    errors: number;
  };
}

async function importAgents() {
  console.log('🚀 AgentAnchorAI - BAI Agent Import\n');

  // Validate configuration
  if (!DRY_RUN && !OWNER_ID) {
    console.error('❌ Error: --owner-id required for production import');
    console.error('   Usage: npx tsx scripts/import-bai-agents.ts --owner-id=<uuid>');
    console.error('   Or set DEFAULT_OWNER_ID environment variable');
    process.exit(1);
  }

  if (!DRY_RUN && (!supabaseUrl || !supabaseServiceKey)) {
    console.error('❌ Error: Supabase credentials not configured');
    console.error('   Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  // Load seed file
  if (!fs.existsSync(SEED_FILE)) {
    console.error(`❌ Seed file not found: ${SEED_FILE}`);
    console.error('   Run the migration script first:');
    console.error('   node C:/BAI/ai-workforce/scripts/migrate-to-a3i.js');
    process.exit(1);
  }

  const seedData: SeedFile = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
  console.log(`📁 Loaded ${seedData.agents.length} agents from seed file`);
  console.log(`   Generated: ${seedData.generated}`);
  console.log(`   Source: ${seedData.source}\n`);

  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No database changes will be made\n');
    previewAgents(seedData.agents);
    return;
  }

  // Initialize Supabase client
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });

  // Import agents
  const results = {
    success: 0,
    skipped: 0,
    errors: [] as Array<{ name: string; error: string }>
  };

  for (const agent of seedData.agents) {
    try {
      // Check if agent already exists (by name for this owner)
      const { data: existing } = await supabase
        .from('bots')
        .select('id')
        .eq('user_id', OWNER_ID)
        .eq('name', agent.name)
        .single();

      if (existing) {
        console.log(`⏭️  ${agent.name} - already exists, skipping`);
        results.skipped++;
        continue;
      }

      // Insert new agent
      const { data, error } = await supabase
        .from('bots')
        .insert({
          user_id: OWNER_ID,
          name: agent.name,
          description: agent.description,
          system_prompt: agent.system_prompt,
          model: agent.model,
          temperature: agent.temperature,
          max_tokens: agent.max_tokens,
          specialization: agent.specialization,
          personality_traits: agent.personality_traits,
          capabilities: agent.capabilities,
          trust_score: agent.trust_score,
          status: agent.status,
          metadata: agent.metadata,
          // Governance defaults
          certification_level: 0,
          maintenance_flag: 'author',
          published: false,
          is_public: false,
        })
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      console.log(`✅ ${agent.name} → ${data.id}`);
      results.success++;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.log(`❌ ${agent.name} - ${errorMsg}`);
      results.errors.push({ name: agent.name, error: errorMsg });
    }
  }

  // Summary
  console.log('\n📊 Import Summary');
  console.log(`   Success: ${results.success}`);
  console.log(`   Skipped: ${results.skipped}`);
  console.log(`   Errors: ${results.errors.length}`);

  if (results.errors.length > 0) {
    console.log('\n❌ Failed Imports:');
    for (const { name, error } of results.errors) {
      console.log(`   ${name}: ${error}`);
    }
  }
}

function previewAgents(agents: BAISeedAgent[]) {
  console.log('📋 Agent Preview:\n');

  // Group by specialization
  const bySpec: Record<string, BAISeedAgent[]> = {};
  for (const agent of agents) {
    const spec = agent.specialization;
    if (!bySpec[spec]) bySpec[spec] = [];
    bySpec[spec].push(agent);
  }

  for (const [spec, specAgents] of Object.entries(bySpec)) {
    console.log(`\n## ${spec.toUpperCase()} (${specAgents.length})`);
    for (const agent of specAgents) {
      const icon = agent.metadata.icon || '🤖';
      const traits = agent.personality_traits.join(', ');
      const caps = agent.capabilities.length;
      console.log(`   ${icon} ${agent.name}`);
      console.log(`      ${agent.description}`);
      console.log(`      Traits: [${traits}] | Capabilities: ${caps}`);
    }
  }

  console.log('\n\n💡 To import these agents, run:');
  console.log('   npx tsx scripts/import-bai-agents.ts --owner-id=<your-user-uuid>');
}

// Run import
importAgents().catch(console.error);
