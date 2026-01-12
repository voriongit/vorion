-- Truth Chain Table
-- Story 5-4: Truth Chain Records (FR92-FR97)
-- Story 5-5: Truth Chain Verification (FR98-FR100)

CREATE TABLE IF NOT EXISTS truth_chain (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence BIGINT NOT NULL UNIQUE,
  record_type TEXT NOT NULL,
  agent_id UUID REFERENCES bots(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  data JSONB NOT NULL DEFAULT '{}',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  previous_hash TEXT NOT NULL,
  hash TEXT NOT NULL UNIQUE,
  signature TEXT NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT true,
  verification_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_truth_chain_sequence ON truth_chain (sequence);
CREATE INDEX IF NOT EXISTS idx_truth_chain_hash ON truth_chain (hash);
CREATE INDEX IF NOT EXISTS idx_truth_chain_agent ON truth_chain (agent_id);
CREATE INDEX IF NOT EXISTS idx_truth_chain_type ON truth_chain (record_type);
CREATE INDEX IF NOT EXISTS idx_truth_chain_timestamp ON truth_chain (timestamp DESC);

-- Hash prefix index for verification lookups
CREATE INDEX IF NOT EXISTS idx_truth_chain_hash_prefix ON truth_chain (substring(hash from 1 for 16));

-- Enable RLS
ALTER TABLE truth_chain ENABLE ROW LEVEL SECURITY;

-- Policies
-- Public read for verification (FR98)
CREATE POLICY "truth_chain_public_read"
ON truth_chain FOR SELECT
USING (true);

-- Insert allowed (system use)
CREATE POLICY "truth_chain_insert"
ON truth_chain FOR INSERT
WITH CHECK (true);

-- No updates allowed (immutable)
CREATE POLICY "truth_chain_no_update"
ON truth_chain FOR UPDATE
USING (false);

-- No deletes allowed (immutable)
CREATE POLICY "truth_chain_no_delete"
ON truth_chain FOR DELETE
USING (false);

-- Comments
COMMENT ON TABLE truth_chain IS 'Immutable ledger for governance records (Story 5-4, 5-5)';
COMMENT ON COLUMN truth_chain.sequence IS 'Monotonically increasing sequence number';
COMMENT ON COLUMN truth_chain.record_type IS 'Type: council_decision, certification, human_override, ownership_change';
COMMENT ON COLUMN truth_chain.previous_hash IS 'Hash of previous record (FR96)';
COMMENT ON COLUMN truth_chain.hash IS 'SHA-256 hash of this record';
COMMENT ON COLUMN truth_chain.signature IS 'HMAC signature (FR97)';
COMMENT ON COLUMN truth_chain.verification_url IS 'Public URL for verification (FR99)';

-- Create genesis record if table is empty
INSERT INTO truth_chain (
  sequence,
  record_type,
  data,
  timestamp,
  previous_hash,
  hash,
  signature,
  verified,
  verification_url
)
SELECT
  0,
  'agent_creation',
  '{"message": "Truth Chain genesis block"}'::jsonb,
  NOW(),
  '0000000000000000000000000000000000000000000000000000000000000000',
  '0000000000000000000000000000000000000000000000000000000000000001',
  'genesis',
  true,
  '/api/truth-chain/verify/0000000000000000'
WHERE NOT EXISTS (SELECT 1 FROM truth_chain LIMIT 1);
