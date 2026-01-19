-- Migration: 004_intents
-- Description: Create intent tables for goal processing with queue tracking
-- Created: 2026-01-18

-- Intent status enum
DO $$ BEGIN
    CREATE TYPE intent_status AS ENUM (
        'pending',
        'evaluating',
        'approved',
        'denied',
        'escalated',
        'executing',
        'completed',
        'failed'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Intents table
CREATE TABLE IF NOT EXISTS intents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    entity_id UUID NOT NULL,

    -- Intent details
    goal TEXT NOT NULL,
    context JSONB NOT NULL,
    metadata JSONB,

    -- Processing state
    status intent_status NOT NULL DEFAULT 'pending',
    priority INTEGER NOT NULL DEFAULT 0,

    -- Queue tracking
    queued_at TIMESTAMPTZ,
    processing_started_at TIMESTAMPTZ,
    processing_completed_at TIMESTAMPTZ,
    process_attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,

    -- Decision references
    decision_id UUID,
    proof_id UUID,
    escalation_id UUID,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for intents
CREATE INDEX IF NOT EXISTS intents_tenant_id_idx ON intents (tenant_id);
CREATE INDEX IF NOT EXISTS intents_entity_id_idx ON intents (entity_id);
CREATE INDEX IF NOT EXISTS intents_status_idx ON intents (status);
CREATE INDEX IF NOT EXISTS intents_priority_idx ON intents (priority);
CREATE INDEX IF NOT EXISTS intents_created_at_idx ON intents (created_at);

-- Composite for queue processing (status + priority + creation order)
CREATE INDEX IF NOT EXISTS intents_status_priority_idx ON intents (status, priority DESC, created_at ASC);

-- Tenant scoped status queries
CREATE INDEX IF NOT EXISTS intents_tenant_status_idx ON intents (tenant_id, status);

-- Intent processing log
CREATE TABLE IF NOT EXISTS intent_processing_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    intent_id UUID NOT NULL,
    tenant_id UUID NOT NULL,

    -- Processing details
    phase TEXT NOT NULL,
    previous_status intent_status,
    new_status intent_status,

    -- Performance
    duration_ms INTEGER,
    attempt INTEGER,

    -- Details
    details JSONB,
    error TEXT,

    -- Timestamp
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for processing log
CREATE INDEX IF NOT EXISTS intent_processing_log_intent_id_idx ON intent_processing_log (intent_id);
CREATE INDEX IF NOT EXISTS intent_processing_log_tenant_id_idx ON intent_processing_log (tenant_id);
CREATE INDEX IF NOT EXISTS intent_processing_log_timestamp_idx ON intent_processing_log (timestamp);

-- Foreign key from log to intents
ALTER TABLE intent_processing_log
    DROP CONSTRAINT IF EXISTS intent_processing_log_intent_fk;
ALTER TABLE intent_processing_log
    ADD CONSTRAINT intent_processing_log_intent_fk
    FOREIGN KEY (intent_id)
    REFERENCES intents(id)
    ON DELETE CASCADE;

-- Add comments for documentation
COMMENT ON TABLE intents IS 'Intent records for AI agent goal governance';
COMMENT ON TABLE intent_processing_log IS 'Processing lifecycle events for intents';
COMMENT ON COLUMN intents.priority IS 'Higher values = higher priority, processed first';
COMMENT ON COLUMN intents.process_attempts IS 'Number of processing attempts for retry tracking';
COMMENT ON COLUMN intent_processing_log.phase IS 'Processing phase: queued, started, completed, failed, retried';
