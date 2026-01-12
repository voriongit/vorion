-- Escalation Queue Migration
-- Creates tables for human escalation of critical decisions

-- ============================================================================
-- 1. Escalation Queue Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS escalation_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Link to original request
  request_id UUID NOT NULL,
  decision_id UUID,
  agent_id UUID NOT NULL,

  -- Escalation details
  action_type VARCHAR(100) NOT NULL,
  action_details TEXT NOT NULL,
  risk_level INT NOT NULL CHECK (risk_level >= 0 AND risk_level <= 4),

  -- Council reasoning for escalation
  council_reasoning TEXT NOT NULL,
  council_votes JSONB DEFAULT '[]'::jsonb,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'denied', 'modified', 'timeout', 'cancelled')),
  priority VARCHAR(20) NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'critical')),

  -- Assignment
  assigned_to UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ,

  -- Human response
  human_decision VARCHAR(20) CHECK (human_decision IN ('approve', 'deny', 'modify')),
  human_reasoning TEXT,
  modification_details TEXT,
  responded_by UUID REFERENCES auth.users(id),
  responded_at TIMESTAMPTZ,

  -- Timeout handling
  timeout_at TIMESTAMPTZ NOT NULL,
  timeout_action VARCHAR(20) DEFAULT 'deny' CHECK (timeout_action IN ('approve', 'deny')),

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_escalation_status ON escalation_queue(status);
CREATE INDEX IF NOT EXISTS idx_escalation_priority ON escalation_queue(priority);
CREATE INDEX IF NOT EXISTS idx_escalation_agent ON escalation_queue(agent_id);
CREATE INDEX IF NOT EXISTS idx_escalation_assigned ON escalation_queue(assigned_to);
CREATE INDEX IF NOT EXISTS idx_escalation_timeout ON escalation_queue(timeout_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_escalation_created ON escalation_queue(created_at DESC);

-- ============================================================================
-- 2. Escalation Response History Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS escalation_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  escalation_id UUID NOT NULL REFERENCES escalation_queue(id) ON DELETE CASCADE,

  -- Response details
  action VARCHAR(50) NOT NULL, -- 'view', 'assign', 'respond', 'reassign', 'comment'
  actor_id UUID NOT NULL REFERENCES auth.users(id),
  details JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escalation_responses_escalation ON escalation_responses(escalation_id);
CREATE INDEX IF NOT EXISTS idx_escalation_responses_actor ON escalation_responses(actor_id);

-- ============================================================================
-- 3. Update Timestamp Trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION update_escalation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_escalation_timestamp ON escalation_queue;
CREATE TRIGGER trigger_update_escalation_timestamp
  BEFORE UPDATE ON escalation_queue
  FOR EACH ROW EXECUTE FUNCTION update_escalation_timestamp();

-- ============================================================================
-- 4. Timeout Check Function (called by cron or worker)
-- ============================================================================

CREATE OR REPLACE FUNCTION process_escalation_timeouts()
RETURNS INT AS $$
DECLARE
  timeout_count INT;
BEGIN
  -- Update timed-out escalations
  UPDATE escalation_queue
  SET
    status = 'timeout',
    human_decision = timeout_action,
    human_reasoning = 'Automatic timeout - no response received within the allotted time',
    responded_at = NOW()
  WHERE
    status = 'pending'
    AND timeout_at <= NOW();

  GET DIAGNOSTICS timeout_count = ROW_COUNT;
  RETURN timeout_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. RLS Policies
-- ============================================================================

ALTER TABLE escalation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalation_responses ENABLE ROW LEVEL SECURITY;

-- Escalations visible to assigned user or admin/overseer roles
CREATE POLICY escalation_select_policy ON escalation_queue
  FOR SELECT USING (
    auth.uid() IS NOT NULL
  );

-- Only system can insert escalations (via service role)
CREATE POLICY escalation_insert_policy ON escalation_queue
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
  );

-- Users can update escalations assigned to them or if admin
CREATE POLICY escalation_update_policy ON escalation_queue
  FOR UPDATE USING (
    auth.uid() IS NOT NULL AND (
      assigned_to = auth.uid() OR
      assigned_to IS NULL
    )
  );

-- Response history policies
CREATE POLICY responses_select_policy ON escalation_responses
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY responses_insert_policy ON escalation_responses
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE escalation_queue IS 'Queue of actions requiring human oversight before execution';
COMMENT ON TABLE escalation_responses IS 'Audit trail of human interactions with escalation queue';
COMMENT ON FUNCTION process_escalation_timeouts() IS 'Processes timed-out escalations, called by scheduled job';

-- ============================================================================
-- Migration Complete
-- ============================================================================
