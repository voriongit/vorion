#!/usr/bin/env node
/**
 * Create Trust Bridge tables via direct PostgreSQL connection
 */

require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

// Supabase direct connection
const connectionString = process.env.DATABASE_URL ||
  `postgresql://postgres.mdcrzpuawbaicawqpwlx:${process.env.SUPABASE_DB_PASSWORD}@aws-0-us-east-1.pooler.supabase.com:5432/postgres`;

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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tb_submissions_tracking_id ON trust_bridge_submissions(tracking_id);
CREATE INDEX IF NOT EXISTS idx_tb_submissions_status ON trust_bridge_submissions(status);
CREATE INDEX IF NOT EXISTS idx_tb_credentials_agent_id ON trust_bridge_credentials(agent_id);

-- Row Level Security
ALTER TABLE trust_bridge_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trust_bridge_credentials ENABLE ROW LEVEL SECURITY;

-- RLS Policies (drop first to avoid errors on re-run)
DROP POLICY IF EXISTS "Service role full access on submissions" ON trust_bridge_submissions;
DROP POLICY IF EXISTS "Service role full access on credentials" ON trust_bridge_credentials;
CREATE POLICY "Service role full access on submissions" ON trust_bridge_submissions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on credentials" ON trust_bridge_credentials FOR ALL USING (auth.role() = 'service_role');
`;

async function main() {
  console.log('Connecting to Supabase PostgreSQL...\n');

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✅ Connected!\n');

    console.log('Creating Trust Bridge tables...\n');
    await client.query(SQL);

    console.log('✅ Tables created successfully!\n');

    // Verify
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name LIKE 'trust_bridge%'
    `);

    console.log('Trust Bridge tables:');
    result.rows.forEach(row => {
      console.log(`  ✅ ${row.table_name}`);
    });

  } catch (err) {
    console.error('❌ Error:', err.message);

    if (err.message.includes('password authentication failed') || err.message.includes('FATAL')) {
      console.log('\n📋 Database credentials not configured.');
      console.log('   Set DATABASE_URL or SUPABASE_DB_PASSWORD in .env.local\n');
      console.log('   Or run this SQL manually in Supabase Dashboard:');
      console.log('   https://supabase.com/dashboard/project/mdcrzpuawbaicawqpwlx/sql/new');
    }
  } finally {
    await client.end();
  }
}

main();
