-- ============================================================================
-- Crypto Audit Log Migration
-- Persistent storage for CryptographicAuditLogger entries
-- ============================================================================

-- Create the crypto_audit_log table
CREATE TABLE IF NOT EXISTS crypto_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sequence_number BIGINT NOT NULL,
    previous_hash TEXT NOT NULL,
    entry_hash TEXT NOT NULL,
    action TEXT NOT NULL,
    actor_type TEXT NOT NULL CHECK (actor_type IN ('HUMAN', 'AGENT', 'SYSTEM')),
    actor_id TEXT NOT NULL,
    actor_tier TEXT,
    target_type TEXT CHECK (target_type IN ('AGENT', 'ENTRY', 'SYSTEM')),
    target_id TEXT,
    details JSONB NOT NULL DEFAULT '{}',
    outcome TEXT NOT NULL CHECK (outcome IN ('SUCCESS', 'DENIED', 'ERROR')),
    reason TEXT,
    merkle_root TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint on sequence_number to ensure chain integrity
CREATE UNIQUE INDEX IF NOT EXISTS crypto_audit_log_sequence_idx
    ON crypto_audit_log(sequence_number);

-- Index on entry_hash for verification lookups
CREATE INDEX IF NOT EXISTS crypto_audit_log_hash_idx
    ON crypto_audit_log(entry_hash);

-- Index on actor_id for actor-based queries
CREATE INDEX IF NOT EXISTS crypto_audit_log_actor_idx
    ON crypto_audit_log(actor_id);

-- Index on action for action-based queries
CREATE INDEX IF NOT EXISTS crypto_audit_log_action_idx
    ON crypto_audit_log(action);

-- Index on created_at for time-based queries
CREATE INDEX IF NOT EXISTS crypto_audit_log_created_at_idx
    ON crypto_audit_log(created_at);

-- ============================================================================
-- Row Level Security (RLS) - Append-Only
-- ============================================================================

-- Enable RLS
ALTER TABLE crypto_audit_log ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read (audit logs are transparent)
CREATE POLICY "crypto_audit_log_read_all" ON crypto_audit_log
    FOR SELECT
    USING (true);

-- Policy: Only service role can insert (append-only)
CREATE POLICY "crypto_audit_log_insert_service" ON crypto_audit_log
    FOR INSERT
    WITH CHECK (true);

-- NO UPDATE POLICY - Entries are immutable
-- NO DELETE POLICY - Entries cannot be deleted

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE crypto_audit_log IS 'Immutable, hash-chained audit log for compliance and verification';
COMMENT ON COLUMN crypto_audit_log.sequence_number IS 'Monotonically increasing sequence number for chain ordering';
COMMENT ON COLUMN crypto_audit_log.previous_hash IS 'SHA-256 hash of the previous entry (GENESIS for first entry)';
COMMENT ON COLUMN crypto_audit_log.entry_hash IS 'SHA-256 hash of this entry for integrity verification';
COMMENT ON COLUMN crypto_audit_log.action IS 'Type of action being audited';
COMMENT ON COLUMN crypto_audit_log.actor_type IS 'Type of entity that performed the action';
COMMENT ON COLUMN crypto_audit_log.actor_id IS 'Identifier of the actor';
COMMENT ON COLUMN crypto_audit_log.actor_tier IS 'Trust tier of the actor (for agents)';
COMMENT ON COLUMN crypto_audit_log.target_type IS 'Type of entity the action was performed on';
COMMENT ON COLUMN crypto_audit_log.target_id IS 'Identifier of the target entity';
COMMENT ON COLUMN crypto_audit_log.details IS 'Additional context about the action';
COMMENT ON COLUMN crypto_audit_log.outcome IS 'Result of the action (SUCCESS, DENIED, ERROR)';
COMMENT ON COLUMN crypto_audit_log.reason IS 'Explanation for the outcome';
COMMENT ON COLUMN crypto_audit_log.merkle_root IS 'Optional Merkle root for batch operations';
