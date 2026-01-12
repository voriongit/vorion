#!/usr/bin/env node
/**
 * Execute Trust Bridge SQL via Supabase REST API
 * This uses the service role key to create tables directly
 */

require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SQL = `
-- Trust Bridge Submissions Table
CREATE TABLE IF NOT EXISTS trust_bridge_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tracking_id VARCHAR(50) UNIQUE NOT NULL,
    submission JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    queue_position INTEGER,
    priority_score INTEGER DEFAULT 0,
    estimated_start TIMESTAMPTZ,
    test_results JSONB,
    test_session_id UUID,
    certification JSONB,
    credential_token TEXT,
    council_reviewed BOOLEAN DEFAULT FALSE,
    council_decision_id UUID,
    review_notes TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    submitter_id VARCHAR(100) NOT NULL,
    submitter_tier VARCHAR(20) DEFAULT 'free',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trust Bridge Credentials Table
CREATE TABLE IF NOT EXISTS trust_bridge_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id VARCHAR(100) UNIQUE NOT NULL,
    submission_id UUID REFERENCES trust_bridge_submissions(id),
    token TEXT NOT NULL,
    payload JSONB NOT NULL,
    trust_score INTEGER NOT NULL,
    tier VARCHAR(20) NOT NULL,
    origin_platform VARCHAR(50) NOT NULL,
    capabilities TEXT[] NOT NULL DEFAULT '{}',
    restrictions TEXT[] NOT NULL DEFAULT '{}',
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    revocation_reason TEXT,
    council_reviewed BOOLEAN DEFAULT FALSE,
    council_decision_id UUID,
    truth_chain_hash VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

async function createTables() {
  console.log('Creating Trust Bridge tables via Supabase REST API...\n');

  // Use Supabase's SQL endpoint (requires service role)
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ query: SQL }),
  });

  if (!response.ok) {
    // exec_sql RPC doesn't exist, try alternative approach
    console.log('RPC not available, using direct table creation approach...\n');

    // Try creating tables by inserting and catching the error
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Check if tables exist
    const { error: subError } = await supabase
      .from('trust_bridge_submissions')
      .select('id')
      .limit(1);

    if (subError && subError.message?.includes('Could not find')) {
      console.log('❌ Tables do not exist yet.');
      console.log('\n📋 Please run this SQL in Supabase Dashboard:');
      console.log('   https://supabase.com/dashboard/project/mdcrzpuawbaicawqpwlx/sql/new\n');

      console.log('='.repeat(60));
      console.log(SQL);
      console.log('='.repeat(60));

      // Also output index creation
      console.log('\n-- Indexes');
      console.log('CREATE INDEX IF NOT EXISTS idx_tb_submissions_tracking_id ON trust_bridge_submissions(tracking_id);');
      console.log('CREATE INDEX IF NOT EXISTS idx_tb_submissions_status ON trust_bridge_submissions(status);');
      console.log('CREATE INDEX IF NOT EXISTS idx_tb_credentials_agent_id ON trust_bridge_credentials(agent_id);');

      console.log('\n-- Row Level Security');
      console.log('ALTER TABLE trust_bridge_submissions ENABLE ROW LEVEL SECURITY;');
      console.log('ALTER TABLE trust_bridge_credentials ENABLE ROW LEVEL SECURITY;');
      console.log("CREATE POLICY \"Service role full access on submissions\" ON trust_bridge_submissions FOR ALL USING (auth.role() = 'service_role');");
      console.log("CREATE POLICY \"Service role full access on credentials\" ON trust_bridge_credentials FOR ALL USING (auth.role() = 'service_role');");

      return false;
    } else if (subError) {
      console.log('Error:', subError.message);
      return false;
    } else {
      console.log('✅ trust_bridge_submissions table exists!');

      const { error: credError } = await supabase
        .from('trust_bridge_credentials')
        .select('id')
        .limit(1);

      if (credError && credError.message?.includes('Could not find')) {
        console.log('❌ trust_bridge_credentials table does not exist');
        return false;
      } else {
        console.log('✅ trust_bridge_credentials table exists!');
        console.log('\n✨ All Trust Bridge tables are ready!');
        return true;
      }
    }
  }

  const result = await response.json();
  console.log('Result:', result);
  return true;
}

createTables().catch(console.error);
