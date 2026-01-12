#!/usr/bin/env node
/**
 * Create Trust Bridge Tables
 * This creates the core tables needed for Trust Bridge
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Create tables using raw SQL via the REST API
async function createTables() {
  console.log('Creating Trust Bridge tables...\n');

  // The Supabase client doesn't directly support raw DDL
  // We need to use the SQL editor or Supabase Management API
  // For now, let's just check what we can do

  // Try to query the table to see if it exists
  const { error } = await supabase
    .from('trust_bridge_submissions')
    .select('id')
    .limit(1);

  if (error && (error.code === '42P01' || error.message?.includes('Could not find the table'))) {
    console.log('❌ Table trust_bridge_submissions does not exist');
    console.log('\n📋 To create the tables, run this SQL in Supabase Dashboard:');
    console.log('   https://supabase.com/dashboard/project/mdcrzpuawbaicawqpwlx/sql/new\n');

    console.log('Copy and paste this SQL:\n');
    console.log('----------------------------------------');
    console.log(`
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS trust_bridge_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

CREATE INDEX IF NOT EXISTS idx_tb_submissions_tracking_id ON trust_bridge_submissions(tracking_id);
CREATE INDEX IF NOT EXISTS idx_tb_submissions_status ON trust_bridge_submissions(status);
CREATE INDEX IF NOT EXISTS idx_tb_submissions_pending ON trust_bridge_submissions(status, priority_score DESC) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS trust_bridge_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

CREATE INDEX IF NOT EXISTS idx_tb_credentials_agent_id ON trust_bridge_credentials(agent_id);

ALTER TABLE trust_bridge_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trust_bridge_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on submissions" ON trust_bridge_submissions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on credentials" ON trust_bridge_credentials FOR ALL USING (auth.role() = 'service_role');
`);
    console.log('----------------------------------------');
    console.log('\nAfter running the SQL, re-run this script to verify.');
  } else if (error) {
    console.log('Error checking table:', error.message);
  } else {
    console.log('✅ Table trust_bridge_submissions exists');

    // Check credentials table
    const { error: credError } = await supabase
      .from('trust_bridge_credentials')
      .select('id')
      .limit(1);

    if (credError && credError.code === '42P01') {
      console.log('❌ Table trust_bridge_credentials does not exist');
    } else {
      console.log('✅ Table trust_bridge_credentials exists');
    }

    console.log('\n✨ Trust Bridge tables are ready!');
  }
}

createTables().catch(console.error);
