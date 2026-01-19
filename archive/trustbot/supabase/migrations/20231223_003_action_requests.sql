-- ============================================================================
-- Story 2.1: Task Pipeline Module - Pending Decisions View
-- Creates the action_requests table for tracking pending decisions
--
-- FRs: FR7, FR11, FR12, FR13
-- ============================================================================

-- ============================================================================
-- Action Requests Table
-- Stores pending action requests requiring HITL approval
-- ============================================================================

CREATE TABLE IF NOT EXISTS action_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    agent_id UUID NOT NULL,
    agent_name VARCHAR(255) NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    action_payload JSONB DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    urgency VARCHAR(20) NOT NULL DEFAULT 'queued',
    queued_reason TEXT,
    trust_gate_rules JSONB DEFAULT '[]',
    priority INTEGER DEFAULT 0,

    -- Decision tracking
    decided_by UUID,
    decided_at TIMESTAMPTZ,
    decision_reason TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT action_requests_status_check
        CHECK (status IN ('pending', 'approved', 'denied', 'cancelled', 'expired')),
    CONSTRAINT action_requests_urgency_check
        CHECK (urgency IN ('immediate', 'queued'))
);

-- ============================================================================
-- Indexes
-- ============================================================================

-- Primary query pattern: pending requests for an org
CREATE INDEX IF NOT EXISTS idx_action_requests_org_pending
    ON action_requests(org_id, status, urgency)
    WHERE status = 'pending';

-- For morning queue filtering
CREATE INDEX IF NOT EXISTS idx_action_requests_created_at
    ON action_requests(org_id, created_at)
    WHERE status = 'pending';

-- For agent lookups
CREATE INDEX IF NOT EXISTS idx_action_requests_agent
    ON action_requests(agent_id);

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE action_requests ENABLE ROW LEVEL SECURITY;

-- Users can view action requests from their org
CREATE POLICY "Users can view own org action_requests" ON action_requests
    FOR SELECT
    USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

-- Users can insert action requests for their org
CREATE POLICY "Users can insert own org action_requests" ON action_requests
    FOR INSERT
    WITH CHECK (org_id = (auth.jwt() ->> 'org_id')::uuid);

-- Users can update action requests from their org
CREATE POLICY "Users can update own org action_requests" ON action_requests
    FOR UPDATE
    USING (org_id = (auth.jwt() ->> 'org_id')::uuid)
    WITH CHECK (org_id = (auth.jwt() ->> 'org_id')::uuid);

-- ============================================================================
-- Updated At Trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION update_action_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS action_requests_updated_at ON action_requests;
CREATE TRIGGER action_requests_updated_at
    BEFORE UPDATE ON action_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_action_requests_updated_at();

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE action_requests IS 'Pending action requests requiring HITL approval (Story 2.1)';
COMMENT ON COLUMN action_requests.urgency IS 'immediate=requires immediate attention, queued=can wait for morning review';
COMMENT ON COLUMN action_requests.queued_reason IS 'Human-readable explanation of why request was queued vs immediate';
COMMENT ON COLUMN action_requests.trust_gate_rules IS 'Array of rule IDs that triggered this request to require approval';
