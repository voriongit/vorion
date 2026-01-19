-- Migration: 003_escalations
-- Description: Create escalation tables for human-in-the-loop decisions
-- Created: 2026-01-18

-- Escalation status enum
DO $$ BEGIN
    CREATE TYPE escalation_status AS ENUM (
        'pending',
        'approved',
        'rejected',
        'timeout',
        'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Escalation priority enum
DO $$ BEGIN
    CREATE TYPE escalation_priority AS ENUM (
        'low',
        'medium',
        'high',
        'critical'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Escalations table
CREATE TABLE IF NOT EXISTS escalations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    intent_id UUID NOT NULL,
    entity_id UUID NOT NULL,

    -- Escalation details
    reason TEXT NOT NULL,
    priority escalation_priority NOT NULL DEFAULT 'medium',
    status escalation_status NOT NULL DEFAULT 'pending',

    -- Assignment
    escalated_to TEXT NOT NULL,
    escalated_by UUID,

    -- Context
    context JSONB,
    requested_action TEXT,

    -- Resolution
    resolved_by UUID,
    resolved_at TIMESTAMPTZ,
    resolution TEXT,
    resolution_notes TEXT,

    -- Timeout
    timeout_at TIMESTAMPTZ NOT NULL,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for escalations
CREATE INDEX IF NOT EXISTS escalations_tenant_id_idx ON escalations (tenant_id);
CREATE INDEX IF NOT EXISTS escalations_intent_id_idx ON escalations (intent_id);
CREATE INDEX IF NOT EXISTS escalations_entity_id_idx ON escalations (entity_id);
CREATE INDEX IF NOT EXISTS escalations_status_idx ON escalations (status);
CREATE INDEX IF NOT EXISTS escalations_escalated_to_idx ON escalations (escalated_to);
CREATE INDEX IF NOT EXISTS escalations_timeout_at_idx ON escalations (timeout_at);
CREATE INDEX IF NOT EXISTS escalations_tenant_status_idx ON escalations (tenant_id, status);

-- Escalation audit log
CREATE TABLE IF NOT EXISTS escalation_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    escalation_id UUID NOT NULL,
    tenant_id UUID NOT NULL,

    -- Action details
    action TEXT NOT NULL,
    actor_id UUID,
    actor_type TEXT NOT NULL DEFAULT 'user',

    -- State change
    previous_status escalation_status,
    new_status escalation_status,

    -- Details
    details JSONB,
    ip_address TEXT,
    user_agent TEXT,

    -- Timestamp
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for escalation audit
CREATE INDEX IF NOT EXISTS escalation_audit_escalation_id_idx ON escalation_audit (escalation_id);
CREATE INDEX IF NOT EXISTS escalation_audit_tenant_id_idx ON escalation_audit (tenant_id);
CREATE INDEX IF NOT EXISTS escalation_audit_timestamp_idx ON escalation_audit (timestamp);

-- Foreign key from audit to escalations
ALTER TABLE escalation_audit
    DROP CONSTRAINT IF EXISTS escalation_audit_escalation_fk;
ALTER TABLE escalation_audit
    ADD CONSTRAINT escalation_audit_escalation_fk
    FOREIGN KEY (escalation_id)
    REFERENCES escalations(id)
    ON DELETE CASCADE;

-- Add comments for documentation
COMMENT ON TABLE escalations IS 'Human-in-the-loop escalation requests with tenant isolation';
COMMENT ON TABLE escalation_audit IS 'Complete audit trail for escalation lifecycle events';
COMMENT ON COLUMN escalations.escalated_to IS 'Role or user ID that should handle this escalation';
COMMENT ON COLUMN escalations.timeout_at IS 'When escalation auto-transitions to timeout status';
COMMENT ON COLUMN escalation_audit.actor_type IS 'Type of actor: user, system, or timeout';
