-- ============================================================================
-- AgentAnchor API v1 Migration
-- Adds tables required for the v1 API contract
-- ============================================================================

-- ============================================================================
-- CERTIFICATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  target_tier INTEGER NOT NULL CHECK (target_tier >= 0 AND target_tier <= 4),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'approved', 'rejected', 'suspended', 'expired')),

  -- Contact info
  contact JSONB NOT NULL DEFAULT '{}',

  -- Attestations
  attestations JSONB NOT NULL DEFAULT '{}',

  -- Documents
  documents JSONB NOT NULL DEFAULT '[]',

  -- Notes and actions
  notes TEXT,
  reviewer_notes TEXT,
  required_actions JSONB NOT NULL DEFAULT '[]',

  -- Certification dates
  issued_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  renewed_at TIMESTAMPTZ,

  -- Previous cert for renewals
  previous_cert_id UUID REFERENCES certifications(id),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for certifications
CREATE INDEX IF NOT EXISTS idx_certifications_agent_id ON certifications(agent_id);
CREATE INDEX IF NOT EXISTS idx_certifications_status ON certifications(status);
CREATE INDEX IF NOT EXISTS idx_certifications_expires ON certifications(expires_at) WHERE status = 'approved';

-- ============================================================================
-- TRUST EVENTS UPDATES
-- Add proof_hash column for Kaizen proof tracking
-- ============================================================================

-- Add proof_hash column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trust_events' AND column_name = 'proof_hash'
  ) THEN
    ALTER TABLE trust_events ADD COLUMN proof_hash TEXT;
    CREATE UNIQUE INDEX idx_trust_events_proof_hash ON trust_events(proof_hash) WHERE proof_hash IS NOT NULL;
  END IF;
END $$;

-- Add metadata column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trust_events' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE trust_events ADD COLUMN metadata JSONB DEFAULT '{}';
  END IF;
END $$;

-- ============================================================================
-- API KEYS TABLE (if not exists)
-- ============================================================================
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash TEXT NOT NULL UNIQUE,
  secret_hash TEXT,
  agent_id UUID REFERENCES bots(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  rate_limit INTEGER NOT NULL DEFAULT 1000,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_agent_id ON api_keys(agent_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);

-- ============================================================================
-- WEBHOOKS TABLE (if not exists)
-- ============================================================================
CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES bots(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  secret TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'failed')),
  last_triggered_at TIMESTAMPTZ,
  failure_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_webhooks_agent_id ON webhooks(agent_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_user_id ON webhooks(user_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_status ON webhooks(status);

-- ============================================================================
-- API USAGE TRACKING TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partitioned index for time-based queries
CREATE INDEX IF NOT EXISTS idx_api_usage_created ON api_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_key ON api_usage(key_id, created_at DESC);

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_certifications_updated_at ON certifications;
CREATE TRIGGER update_certifications_updated_at
  BEFORE UPDATE ON certifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_api_keys_updated_at ON api_keys;
CREATE TRIGGER update_api_keys_updated_at
  BEFORE UPDATE ON api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_webhooks_updated_at ON webhooks;
CREATE TRIGGER update_webhooks_updated_at
  BEFORE UPDATE ON webhooks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

-- Certifications: users can view their own agent certifications
CREATE POLICY certifications_select_policy ON certifications
  FOR SELECT USING (
    agent_id IN (SELECT id FROM bots WHERE creator_id = auth.uid())
  );

-- API Keys: users can manage their own keys
CREATE POLICY api_keys_select_policy ON api_keys
  FOR SELECT USING (user_id = auth.uid() OR agent_id IN (SELECT id FROM bots WHERE creator_id = auth.uid()));

CREATE POLICY api_keys_insert_policy ON api_keys
  FOR INSERT WITH CHECK (user_id = auth.uid() OR agent_id IN (SELECT id FROM bots WHERE creator_id = auth.uid()));

-- Webhooks: users can manage their own webhooks
CREATE POLICY webhooks_all_policy ON webhooks
  FOR ALL USING (user_id = auth.uid() OR agent_id IN (SELECT id FROM bots WHERE creator_id = auth.uid()));

-- API Usage: users can view their own usage
CREATE POLICY api_usage_select_policy ON api_usage
  FOR SELECT USING (user_id = auth.uid());
