-- Observer Events Table
-- Story 5-1: Observer Event Logging (FR82-FR86)
--
-- This table implements the Observer audit layer:
-- - Append-only logging (FR83) via RLS policies
-- - Cryptographic signatures (FR84)
-- - Isolated from Worker/Council (FR85, FR86)

-- Create observer_events table
CREATE TABLE IF NOT EXISTS observer_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence BIGINT NOT NULL UNIQUE,
  source TEXT NOT NULL,
  event_type TEXT NOT NULL,
  risk_level TEXT NOT NULL DEFAULT 'info',
  agent_id UUID REFERENCES bots(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  data JSONB NOT NULL DEFAULT '{}',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  previous_hash TEXT NOT NULL,
  hash TEXT NOT NULL,
  signature TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_observer_events_sequence ON observer_events (sequence);
CREATE INDEX IF NOT EXISTS idx_observer_events_agent_id ON observer_events (agent_id);
CREATE INDEX IF NOT EXISTS idx_observer_events_user_id ON observer_events (user_id);
CREATE INDEX IF NOT EXISTS idx_observer_events_event_type ON observer_events (event_type);
CREATE INDEX IF NOT EXISTS idx_observer_events_source ON observer_events (source);
CREATE INDEX IF NOT EXISTS idx_observer_events_risk_level ON observer_events (risk_level);
CREATE INDEX IF NOT EXISTS idx_observer_events_timestamp ON observer_events (timestamp);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_observer_events_agent_time
ON observer_events (agent_id, timestamp DESC);

-- Enable RLS
ALTER TABLE observer_events ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert (for logging)
-- In production, this would be restricted to service role only
CREATE POLICY "observer_events_insert"
ON observer_events
FOR INSERT
WITH CHECK (true);

-- Policy: No updates allowed (append-only - FR83)
-- This enforces the immutable audit log requirement
CREATE POLICY "observer_events_no_update"
ON observer_events
FOR UPDATE
USING (false);

-- Policy: No deletes allowed (append-only - FR83)
CREATE POLICY "observer_events_no_delete"
ON observer_events
FOR DELETE
USING (false);

-- Policy: Users can read their own events or public agent events
CREATE POLICY "observer_events_select"
ON observer_events
FOR SELECT
USING (
  user_id = auth.uid()
  OR agent_id IN (
    SELECT id FROM bots WHERE user_id = auth.uid() OR is_public = true
  )
);

-- Add comments for documentation
COMMENT ON TABLE observer_events IS 'Append-only audit log for the Observer layer (Story 5-1)';
COMMENT ON COLUMN observer_events.sequence IS 'Monotonically increasing sequence number for ordering';
COMMENT ON COLUMN observer_events.source IS 'Source of the event: agent, council, academy, etc.';
COMMENT ON COLUMN observer_events.event_type IS 'Type of event: agent_action, council_decision, etc.';
COMMENT ON COLUMN observer_events.risk_level IS 'Risk level: info, low, medium, high, critical';
COMMENT ON COLUMN observer_events.previous_hash IS 'Hash of the previous event in chain';
COMMENT ON COLUMN observer_events.hash IS 'SHA-256 hash of this event data';
COMMENT ON COLUMN observer_events.signature IS 'HMAC signature using platform key';

-- Create genesis event if table is empty
INSERT INTO observer_events (
  sequence,
  source,
  event_type,
  risk_level,
  data,
  timestamp,
  previous_hash,
  hash,
  signature
)
SELECT
  0,
  'system',
  'system_startup',
  'info',
  '{"message": "Observer chain initialized"}'::jsonb,
  NOW(),
  '0000000000000000000000000000000000000000000000000000000000000000',
  '0000000000000000000000000000000000000000000000000000000000000001',
  'genesis'
WHERE NOT EXISTS (SELECT 1 FROM observer_events LIMIT 1);
