#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  console.log('Checking Trust Bridge submissions in database...\n');

  const { data, error, count } = await supabase
    .from('trust_bridge_submissions')
    .select('id, tracking_id, status, submitted_at', { count: 'exact' })
    .order('submitted_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log(`Total submissions: ${count}\n`);

  if (data.length === 0) {
    console.log('No submissions found.');
  } else {
    console.log('Recent submissions:');
    data.forEach(s => {
      console.log(`  ${s.tracking_id} | ${s.status} | ${s.submitted_at}`);
    });
  }

  // Check pending count
  const { count: pendingCount } = await supabase
    .from('trust_bridge_submissions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  console.log(`\nPending: ${pendingCount || 0}`);
}

main().catch(console.error);
