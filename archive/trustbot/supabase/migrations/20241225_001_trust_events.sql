-- ============================================================================
-- Story 11.2: Trust History Database
-- FR69: 30-day rolling history with weighted decay
-- FR71: Trust score event sourcing for audit
-- ============================================================================

-- Trust events table
-- Stores all trust score change events for audit and calculation
CREATE TABLE IF NOT EXISTS trust_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    org_id UUID NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    points INTEGER NOT NULL,
    decay_days INTEGER NOT NULL DEFAULT 30,
    reason TEXT,
    old_score INTEGER NOT NULL,
    new_score INTEGER NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for common query patterns
-- Primary index for agent history queries
CREATE INDEX IF NOT EXISTS idx_trust_events_agent_created
    ON trust_events(agent_id, created_at DESC);

-- Organization-level queries
CREATE INDEX IF NOT EXISTS idx_trust_events_org_id
    ON trust_events(org_id);

-- Event type filtering
CREATE INDEX IF NOT EXISTS idx_trust_events_event_type
    ON trust_events(event_type);

-- Time-based queries for decay calculations
CREATE INDEX IF NOT EXISTS idx_trust_events_created_at
    ON trust_events(created_at);

-- Composite index for org + time queries
CREATE INDEX IF NOT EXISTS idx_trust_events_org_created
    ON trust_events(org_id, created_at DESC);

-- Enable RLS
ALTER TABLE trust_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Select: Users can only view their org's trust events
CREATE POLICY trust_events_select_policy ON trust_events
    FOR SELECT
    USING (org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid);

-- Insert: Users can only insert events for their org
CREATE POLICY trust_events_insert_policy ON trust_events
    FOR INSERT
    WITH CHECK (org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid);

-- No update or delete allowed (append-only for audit integrity)
-- Events are immutable records

-- Add comments for documentation
COMMENT ON TABLE trust_events IS 'Immutable audit log of all trust score changes';
COMMENT ON COLUMN trust_events.agent_id IS 'Agent whose trust score changed';
COMMENT ON COLUMN trust_events.org_id IS 'Organization the agent belongs to';
COMMENT ON COLUMN trust_events.event_type IS 'Type of event (task_completed, task_failed, etc.)';
COMMENT ON COLUMN trust_events.points IS 'Point value of the event (positive or negative)';
COMMENT ON COLUMN trust_events.decay_days IS 'Number of days until this event fully decays';
COMMENT ON COLUMN trust_events.reason IS 'Human-readable reason for the event';
COMMENT ON COLUMN trust_events.old_score IS 'Score before this event';
COMMENT ON COLUMN trust_events.new_score IS 'Score after this event';
COMMENT ON COLUMN trust_events.metadata IS 'Additional context about the event';
