-- Circuit Breaker Migration
-- Story 16-1: Agent Pause/Resume (Council Priority #3)
--
-- Adds pause/resume capability to agents for the Circuit Breaker system

-- ============================================================================
-- 1. Add Circuit Breaker Columns to Bots Table
-- ============================================================================

-- Create pause reason enum type
DO $$ BEGIN
  CREATE TYPE pause_reason AS ENUM (
    'investigation',     -- Under investigation for policy violation
    'maintenance',       -- Trainer-requested maintenance pause
    'consumer_request',  -- Consumer reported issue
    'circuit_breaker',   -- Automatic circuit breaker triggered
    'cascade_halt',      -- Paused due to dependent agent pause
    'emergency_stop',    -- Global kill switch activation
    'other'              -- Other reason (requires notes)
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add pause-specific columns
ALTER TABLE bots ADD COLUMN IF NOT EXISTS is_paused BOOLEAN DEFAULT FALSE;
ALTER TABLE bots ADD COLUMN IF NOT EXISTS pause_reason pause_reason;
ALTER TABLE bots ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ;
ALTER TABLE bots ADD COLUMN IF NOT EXISTS paused_by UUID REFERENCES auth.users(id);
ALTER TABLE bots ADD COLUMN IF NOT EXISTS pause_notes TEXT;
ALTER TABLE bots ADD COLUMN IF NOT EXISTS pause_expires_at TIMESTAMPTZ;

-- ============================================================================
-- 2. Circuit Breaker Events Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS circuit_breaker_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,

  -- Event type
  event_type VARCHAR(20) NOT NULL CHECK (event_type IN (
    'pause', 'resume', 'cascade_halt', 'emergency_stop', 'auto_resume'
  )),

  -- Context
  reason pause_reason,
  notes TEXT,
  triggered_by UUID REFERENCES auth.users(id),
  triggered_by_system BOOLEAN DEFAULT FALSE,

  -- For cascade halts
  parent_agent_id UUID REFERENCES bots(id),

  -- Truth chain anchor
  truth_chain_hash VARCHAR(128),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cb_events_agent_id ON circuit_breaker_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_cb_events_type ON circuit_breaker_events(event_type);
CREATE INDEX IF NOT EXISTS idx_cb_events_created ON circuit_breaker_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cb_events_parent ON circuit_breaker_events(parent_agent_id)
  WHERE parent_agent_id IS NOT NULL;

-- ============================================================================
-- 3. Agent Dependencies Table (for Cascade Halt)
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_dependencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  depends_on_agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  dependency_type VARCHAR(50) DEFAULT 'operational',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, depends_on_agent_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_deps_agent ON agent_dependencies(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_deps_depends_on ON agent_dependencies(depends_on_agent_id);

-- ============================================================================
-- 4. Global Kill Switch State Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS global_kill_switch (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  is_active BOOLEAN DEFAULT FALSE,
  activated_at TIMESTAMPTZ,
  activated_by UUID REFERENCES auth.users(id),
  reason TEXT,
  scope VARCHAR(50) DEFAULT 'all', -- 'all', 'tier:untrusted', 'specialization:X'
  deactivated_at TIMESTAMPTZ,
  deactivated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure only one active kill switch at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_kill_switch_active
  ON global_kill_switch (is_active) WHERE is_active = TRUE;

-- ============================================================================
-- 5. RLS Policies
-- ============================================================================

ALTER TABLE circuit_breaker_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_kill_switch ENABLE ROW LEVEL SECURITY;

-- Circuit breaker events: owners can view their agent's events
CREATE POLICY cb_events_select_policy ON circuit_breaker_events
  FOR SELECT USING (
    agent_id IN (SELECT id FROM bots WHERE user_id = auth.uid())
  );

-- Agent dependencies: owners can manage
CREATE POLICY agent_deps_select_policy ON agent_dependencies
  FOR SELECT USING (
    agent_id IN (SELECT id FROM bots WHERE user_id = auth.uid())
  );

CREATE POLICY agent_deps_insert_policy ON agent_dependencies
  FOR INSERT WITH CHECK (
    agent_id IN (SELECT id FROM bots WHERE user_id = auth.uid())
  );

CREATE POLICY agent_deps_delete_policy ON agent_dependencies
  FOR DELETE USING (
    agent_id IN (SELECT id FROM bots WHERE user_id = auth.uid())
  );

-- Kill switch: everyone can read, admins can modify
CREATE POLICY kill_switch_select_policy ON global_kill_switch
  FOR SELECT USING (TRUE);

-- ============================================================================
-- 6. Index for Paused Agents Query
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_bots_paused ON bots (is_paused)
  WHERE is_paused = TRUE;

CREATE INDEX IF NOT EXISTS idx_bots_pause_expires ON bots (pause_expires_at)
  WHERE pause_expires_at IS NOT NULL;

-- ============================================================================
-- 7. Comments
-- ============================================================================

COMMENT ON TABLE circuit_breaker_events IS 'Audit log of all agent pause/resume events';
COMMENT ON TABLE agent_dependencies IS 'Tracks agent operational dependencies for cascade halt';
COMMENT ON TABLE global_kill_switch IS 'Global emergency stop state management';
COMMENT ON COLUMN bots.is_paused IS 'True if agent is currently paused via circuit breaker';
COMMENT ON COLUMN bots.pause_reason IS 'Reason for the current pause';
COMMENT ON COLUMN bots.paused_by IS 'User who initiated the pause';
COMMENT ON COLUMN bots.pause_expires_at IS 'Optional: auto-resume after this timestamp';

-- ============================================================================
-- Migration Complete
-- ============================================================================
