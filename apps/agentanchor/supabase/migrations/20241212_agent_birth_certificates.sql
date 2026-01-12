-- Agent Birth Certificate System
-- Immutable, single-use, cryptographically bound agent identities

-- Add birth certificate column to agents table
ALTER TABLE agents ADD COLUMN IF NOT EXISTS birth_certificate JSONB;

-- Add canonical_id column (indexed for lookups)
ALTER TABLE agents ADD COLUMN IF NOT EXISTS canonical_id TEXT UNIQUE;

-- Add fingerprint column (the immutable hash)
ALTER TABLE agents ADD COLUMN IF NOT EXISTS fingerprint TEXT UNIQUE;

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_agents_canonical_id ON agents(canonical_id);
CREATE INDEX IF NOT EXISTS idx_agents_fingerprint ON agents(fingerprint);

-- Create birth certificate registry table (append-only log)
CREATE TABLE IF NOT EXISTS agent_birth_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_id TEXT NOT NULL UNIQUE,
  fingerprint TEXT NOT NULL UNIQUE,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,

  -- Birth data (immutable inputs to fingerprint)
  agent_name TEXT NOT NULL,
  creator_id UUID NOT NULL,
  born_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  initial_config_hash TEXT NOT NULL,

  -- Signed certificate
  birth_jwt TEXT NOT NULL,

  -- Blockchain anchors (optional)
  anchors JSONB DEFAULT '{}',

  -- Truth chain linking
  truth_chain_sequence BIGINT,
  truth_chain_prev_hash TEXT,
  truth_chain_hash TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent any updates - birth certificates are immutable
  CONSTRAINT birth_registry_immutable CHECK (true)
);

-- Create sequence for truth chain
CREATE SEQUENCE IF NOT EXISTS truth_chain_seq START 1;

-- Index for truth chain queries
CREATE INDEX IF NOT EXISTS idx_birth_registry_truth_chain
  ON agent_birth_registry(truth_chain_sequence);
CREATE INDEX IF NOT EXISTS idx_birth_registry_creator
  ON agent_birth_registry(creator_id);

-- Revocation table (separate from birth - birth is permanent, revocation is an event)
CREATE TABLE IF NOT EXISTS agent_revocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_id TEXT NOT NULL REFERENCES agent_birth_registry(canonical_id),
  reason TEXT NOT NULL,
  revoked_by UUID NOT NULL,
  revoked_at TIMESTAMPTZ DEFAULT NOW(),
  revocation_jwt TEXT NOT NULL,

  -- Blockchain anchor for revocation
  anchor JSONB
);

CREATE INDEX IF NOT EXISTS idx_revocations_canonical_id
  ON agent_revocations(canonical_id);

-- Function to prevent updates to birth registry (truly immutable)
CREATE OR REPLACE FUNCTION prevent_birth_registry_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Birth certificates are immutable and cannot be updated';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce immutability
DROP TRIGGER IF EXISTS birth_registry_immutable_trigger ON agent_birth_registry;
CREATE TRIGGER birth_registry_immutable_trigger
  BEFORE UPDATE ON agent_birth_registry
  FOR EACH ROW
  EXECUTE FUNCTION prevent_birth_registry_update();

-- Function to prevent deletion of birth registry (permanent record)
CREATE OR REPLACE FUNCTION prevent_birth_registry_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Birth certificates are permanent and cannot be deleted. Use revocation instead.';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to prevent deletion
DROP TRIGGER IF EXISTS birth_registry_no_delete_trigger ON agent_birth_registry;
CREATE TRIGGER birth_registry_no_delete_trigger
  BEFORE DELETE ON agent_birth_registry
  FOR EACH ROW
  EXECUTE FUNCTION prevent_birth_registry_delete();

-- RLS Policies
ALTER TABLE agent_birth_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_revocations ENABLE ROW LEVEL SECURITY;

-- Anyone can read birth certificates (public registry)
CREATE POLICY "Birth certificates are public"
  ON agent_birth_registry FOR SELECT
  USING (true);

-- Only authenticated users can create birth certificates
CREATE POLICY "Authenticated users can register agents"
  ON agent_birth_registry FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = creator_id);

-- Service role can do anything (for system operations)
CREATE POLICY "Service role full access to birth registry"
  ON agent_birth_registry FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Revocations are public readable
CREATE POLICY "Revocations are public"
  ON agent_revocations FOR SELECT
  USING (true);

-- Only creator or admin can revoke
CREATE POLICY "Creator can revoke"
  ON agent_revocations FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = revoked_by AND
    EXISTS (
      SELECT 1 FROM agent_birth_registry
      WHERE canonical_id = agent_revocations.canonical_id
      AND creator_id = auth.uid()
    )
  );

CREATE POLICY "Service role can revoke"
  ON agent_revocations FOR INSERT
  TO service_role
  WITH CHECK (true);

-- View for agent status (birth + revocation)
CREATE OR REPLACE VIEW agent_identity_status AS
SELECT
  b.canonical_id,
  b.fingerprint,
  b.agent_id,
  b.agent_name,
  b.creator_id,
  b.born_at,
  b.birth_jwt,
  b.anchors,
  b.truth_chain_sequence,
  b.truth_chain_hash,
  r.revoked_at,
  r.reason as revocation_reason,
  CASE
    WHEN r.id IS NOT NULL THEN 'revoked'
    ELSE 'active'
  END as status
FROM agent_birth_registry b
LEFT JOIN agent_revocations r ON b.canonical_id = r.canonical_id;

COMMENT ON TABLE agent_birth_registry IS 'Immutable registry of agent birth certificates. Once created, entries cannot be modified or deleted.';
COMMENT ON TABLE agent_revocations IS 'Record of agent revocations. Revocation does not delete birth certificate - it marks the agent as no longer trusted.';
COMMENT ON VIEW agent_identity_status IS 'Combined view of agent identity with birth and revocation status.';
