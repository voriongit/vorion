#!/usr/bin/env node
/**
 * Sync agents from Neon to Supabase
 */
const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function sync() {
  console.log('Connecting to databases...');

  // Source: Neon
  const neon = new Client({ connectionString: process.env.DATABASE_URL });
  await neon.connect();

  // Target: Supabase
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Get a valid owner_id from Supabase (platform owner)
  const { data: profiles } = await sb.from('profiles').select('id').limit(1);
  const platformOwnerId = profiles?.[0]?.id;
  if (!platformOwnerId) {
    console.error('No profiles found in Supabase!');
    await neon.end();
    return;
  }
  console.log('Using platform owner:', platformOwnerId);

  // Get existing in Supabase
  const { data: existing } = await sb.from('agents').select('name');
  const existingNames = new Set(existing.map(a => a.name.toLowerCase()));
  console.log('Supabase has:', existingNames.size, 'agents');

  // Get all from Neon
  const { rows: neonAgents } = await neon.query("SELECT * FROM agents WHERE status='active'");
  console.log('Neon has:', neonAgents.length, 'active agents');

  const missing = neonAgents.filter(a => !existingNames.has(a.name.toLowerCase()));
  console.log('Missing in Supabase:', missing.length);

  if (missing.length === 0) {
    console.log('Already in sync!');
    await neon.end();
    return;
  }

  console.log('Syncing', missing.length, 'agents to Supabase...');

  let success = 0, errors = 0;
  const batchSize = 50;

  for (let i = 0; i < missing.length; i += batchSize) {
    const batch = missing.slice(i, i + batchSize).map(a => ({
      name: a.name,
      description: a.description,
      system_prompt: a.system_prompt,
      model: a.model || 'claude-sonnet-4-20250514',
      status: 'active',
      trust_score: a.trust_score || 400,
      config: a.config,
      metadata: a.metadata,
      owner_id: platformOwnerId
    }));

    const { error } = await sb.from('agents').insert(batch);
    if (error) {
      errors += batch.length;
      if (errors <= 150) console.log('Error:', error.message);
    } else {
      success += batch.length;
    }
    if ((i + batchSize) % 500 === 0 || i + batchSize >= missing.length) {
      console.log('Progress:', Math.min(i + batchSize, missing.length), '/', missing.length);
    }
  }

  console.log('\nDone! Success:', success, 'Errors:', errors);

  // Verify
  const { count } = await sb.from('agents').select('*', { count: 'exact', head: true }).eq('status', 'active');
  console.log('Supabase now has:', count, 'active agents');

  await neon.end();
}

sync().catch(console.error);
