-- Migration: 002_trust
-- Description: Create trust tables for behavioral trust scoring
-- Created: 2026-01-18

-- Trust level enum (0-4)
DO $$ BEGIN
    CREATE TYPE trust_level AS ENUM ('0', '1', '2', '3', '4');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Trust records table - current trust state for entities
CREATE TABLE IF NOT EXISTS trust_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL UNIQUE,

    -- Current score (0-1000)
    score INTEGER NOT NULL DEFAULT 200,
    level trust_level NOT NULL DEFAULT '1',

    -- Component scores (0.0 - 1.0)
    behavioral_score REAL NOT NULL DEFAULT 0.5,
    compliance_score REAL NOT NULL DEFAULT 0.5,
    identity_score REAL NOT NULL DEFAULT 0.5,
    context_score REAL NOT NULL DEFAULT 0.5,

    -- Metadata
    signal_count INTEGER NOT NULL DEFAULT 0,
    last_calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT trust_records_score_range CHECK (score >= 0 AND score <= 1000),
    CONSTRAINT trust_records_behavioral_range CHECK (behavioral_score >= 0 AND behavioral_score <= 1),
    CONSTRAINT trust_records_compliance_range CHECK (compliance_score >= 0 AND compliance_score <= 1),
    CONSTRAINT trust_records_identity_range CHECK (identity_score >= 0 AND identity_score <= 1),
    CONSTRAINT trust_records_context_range CHECK (context_score >= 0 AND context_score <= 1)
);

CREATE INDEX IF NOT EXISTS trust_records_entity_id_idx ON trust_records (entity_id);
CREATE INDEX IF NOT EXISTS trust_records_score_idx ON trust_records (score);
CREATE INDEX IF NOT EXISTS trust_records_level_idx ON trust_records (level);

-- Trust signals table - behavioral events affecting trust
CREATE TABLE IF NOT EXISTS trust_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL,

    -- Signal details
    type TEXT NOT NULL,  -- e.g., 'behavioral.success', 'compliance.violation'
    value REAL NOT NULL, -- 0.0 - 1.0
    weight REAL NOT NULL DEFAULT 1.0,

    -- Context
    source TEXT,  -- Where the signal came from
    metadata JSONB,

    -- Timestamp
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT trust_signals_value_range CHECK (value >= 0 AND value <= 1),
    CONSTRAINT trust_signals_weight_positive CHECK (weight > 0)
);

CREATE INDEX IF NOT EXISTS trust_signals_entity_id_idx ON trust_signals (entity_id);
CREATE INDEX IF NOT EXISTS trust_signals_type_idx ON trust_signals (type);
CREATE INDEX IF NOT EXISTS trust_signals_timestamp_idx ON trust_signals (timestamp);
CREATE INDEX IF NOT EXISTS trust_signals_entity_timestamp_idx ON trust_signals (entity_id, timestamp);

-- Trust history table - significant score changes
CREATE TABLE IF NOT EXISTS trust_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL,

    -- Score snapshot
    score INTEGER NOT NULL,
    previous_score INTEGER,
    level trust_level NOT NULL,
    previous_level trust_level,

    -- Change details
    reason TEXT NOT NULL,
    signal_id UUID,  -- Reference to triggering signal

    -- Timestamp
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT trust_history_score_range CHECK (score >= 0 AND score <= 1000),
    CONSTRAINT trust_history_prev_score_range CHECK (previous_score IS NULL OR (previous_score >= 0 AND previous_score <= 1000))
);

CREATE INDEX IF NOT EXISTS trust_history_entity_id_idx ON trust_history (entity_id);
CREATE INDEX IF NOT EXISTS trust_history_timestamp_idx ON trust_history (timestamp);
CREATE INDEX IF NOT EXISTS trust_history_entity_timestamp_idx ON trust_history (entity_id, timestamp);

-- Foreign key from history to signals (optional - signal may not exist)
-- ALTER TABLE trust_history ADD CONSTRAINT trust_history_signal_fk
--     FOREIGN KEY (signal_id) REFERENCES trust_signals(id) ON DELETE SET NULL;

-- Add comments for documentation
COMMENT ON TABLE trust_records IS 'Current trust state for entities with component scores';
COMMENT ON TABLE trust_signals IS 'Behavioral events that affect trust scores';
COMMENT ON TABLE trust_history IS 'Audit trail of significant trust score changes';
COMMENT ON COLUMN trust_records.level IS 'Trust level: 0=Untrusted, 1=Provisional, 2=Trusted, 3=Verified, 4=Privileged';
COMMENT ON COLUMN trust_signals.type IS 'Signal type prefix: behavioral., compliance., identity., context.';
