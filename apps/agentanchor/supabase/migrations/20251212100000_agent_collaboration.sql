-- ============================================================================
-- AGENT COLLABORATION SYSTEM
-- Enables proactive agent-to-agent collaboration, task routing, and consensus
-- Created: 2025-12-12
-- ============================================================================

-- ============================================================================
-- 1. AGENT COLLABORATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_collaborations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Participants
  initiator_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  target_id UUID REFERENCES bots(id) ON DELETE SET NULL,
  participants UUID[] DEFAULT ARRAY[]::UUID[],

  -- Collaboration type
  mode VARCHAR(20) NOT NULL DEFAULT 'DELEGATE' CHECK (mode IN (
    'DELEGATE',    -- Hand off entirely
    'CONSULT',     -- Ask for input, retain ownership
    'PARALLEL',    -- Work simultaneously
    'SEQUENTIAL',  -- Chain of agents
    'CONSENSUS'    -- Multiple agents must agree
  )),

  -- Task details
  task_type VARCHAR(100) NOT NULL,
  task_description TEXT,
  context JSONB DEFAULT '{}'::jsonb,
  urgency VARCHAR(20) DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  expected_outcome TEXT,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'active', 'completed', 'failed', 'cancelled'
  )),

  -- Results
  final_outcome TEXT,
  success_rate DECIMAL(3,2),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  deadline TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_collaborations_initiator ON agent_collaborations(initiator_id);
CREATE INDEX IF NOT EXISTS idx_collaborations_target ON agent_collaborations(target_id);
CREATE INDEX IF NOT EXISTS idx_collaborations_status ON agent_collaborations(status);
CREATE INDEX IF NOT EXISTS idx_collaborations_mode ON agent_collaborations(mode);
CREATE INDEX IF NOT EXISTS idx_collaborations_created ON agent_collaborations(created_at DESC);

-- ============================================================================
-- 2. COLLABORATION OUTCOMES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS collaboration_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collaboration_id UUID NOT NULL REFERENCES agent_collaborations(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,

  -- Contribution
  contribution TEXT NOT NULL,
  confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),

  -- Action items produced
  action_items JSONB DEFAULT '[]'::jsonb,

  -- Metrics
  time_spent_ms INT,
  tokens_used INT,

  -- Timestamp
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(collaboration_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_outcomes_collaboration ON collaboration_outcomes(collaboration_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_agent ON collaboration_outcomes(agent_id);

-- ============================================================================
-- 3. AGENT CONSENSUS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_consensus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  initiator_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,

  -- Question/decision
  question TEXT NOT NULL,
  context JSONB DEFAULT '{}'::jsonb,

  -- Participants
  participants UUID[] NOT NULL,
  required_agreement DECIMAL(3,2) NOT NULL DEFAULT 0.66,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'voting' CHECK (status IN (
    'voting', 'consensus_reached', 'no_consensus', 'expired', 'cancelled'
  )),

  -- Result
  final_decision TEXT,
  agreement_rate DECIMAL(3,2),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deadline TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_consensus_initiator ON agent_consensus(initiator_id);
CREATE INDEX IF NOT EXISTS idx_consensus_status ON agent_consensus(status);

-- ============================================================================
-- 4. CONSENSUS VOTES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS consensus_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consensus_id UUID NOT NULL REFERENCES agent_consensus(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,

  -- Vote
  vote VARCHAR(20) NOT NULL CHECK (vote IN ('approve', 'reject', 'abstain')),
  reasoning TEXT,
  confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),

  -- Timestamp
  voted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(consensus_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_votes_consensus ON consensus_votes(consensus_id);
CREATE INDEX IF NOT EXISTS idx_votes_agent ON consensus_votes(agent_id);

-- ============================================================================
-- 5. PROACTIVE ACTIONS LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS proactive_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,

  -- Action details
  behavior VARCHAR(20) NOT NULL CHECK (behavior IN (
    'ANTICIPATE', 'ANALYZE', 'DELEGATE', 'ESCALATE',
    'ITERATE', 'COLLABORATE', 'MONITOR', 'SUGGEST'
  )),
  trigger_event TEXT NOT NULL,
  analysis TEXT,
  recommendation TEXT NOT NULL,
  action_steps JSONB DEFAULT '[]'::jsonb,

  -- Routing
  delegated_to UUID REFERENCES bots(id),
  collaborated_with UUID[],

  -- Priority and confidence
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),

  -- Outcome
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
    'pending', 'in_progress', 'completed', 'failed', 'cancelled'
  )),
  outcome TEXT,
  success BOOLEAN,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  executed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_proactive_agent ON proactive_actions(agent_id);
CREATE INDEX IF NOT EXISTS idx_proactive_behavior ON proactive_actions(behavior);
CREATE INDEX IF NOT EXISTS idx_proactive_status ON proactive_actions(status);
CREATE INDEX IF NOT EXISTS idx_proactive_created ON proactive_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proactive_delegated ON proactive_actions(delegated_to) WHERE delegated_to IS NOT NULL;

-- ============================================================================
-- 6. EXCELLENCE CYCLES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS excellence_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,

  -- Current phase: FIND → FIX → IMPLEMENT → CHANGE → ITERATE → SUCCEED
  phase VARCHAR(20) NOT NULL CHECK (phase IN (
    'FIND', 'FIX', 'IMPLEMENT', 'CHANGE', 'ITERATE', 'SUCCEED'
  )),

  -- Cycle data
  input JSONB DEFAULT '{}'::jsonb,
  output JSONB DEFAULT '{}'::jsonb,

  -- Metrics
  items_found INT DEFAULT 0,
  issues_fixed INT DEFAULT 0,
  features_implemented INT DEFAULT 0,
  changes_applied INT DEFAULT 0,
  iterations_completed INT DEFAULT 0,
  success_rate DECIMAL(3,2),

  -- Status
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed', 'paused')),

  -- Timestamps
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- Next phase indicator
  next_phase VARCHAR(20)
);

CREATE INDEX IF NOT EXISTS idx_excellence_agent ON excellence_cycles(agent_id);
CREATE INDEX IF NOT EXISTS idx_excellence_phase ON excellence_cycles(phase);
CREATE INDEX IF NOT EXISTS idx_excellence_status ON excellence_cycles(status);

-- ============================================================================
-- 7. AGENT TASK QUEUE (for proactive task management)
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_task_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,

  -- Task details
  task_type VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  context JSONB DEFAULT '{}'::jsonb,

  -- Priority and scheduling
  priority INT NOT NULL DEFAULT 50 CHECK (priority >= 0 AND priority <= 100),
  urgency VARCHAR(20) DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  scheduled_for TIMESTAMPTZ,
  deadline TIMESTAMPTZ,

  -- Source
  source VARCHAR(50) NOT NULL DEFAULT 'system' CHECK (source IN (
    'system', 'user', 'agent', 'collaboration', 'proactive', 'scheduled'
  )),
  source_id UUID, -- Reference to originating entity

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'queued' CHECK (status IN (
    'queued', 'assigned', 'in_progress', 'completed', 'failed', 'cancelled'
  )),

  -- Execution
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  result JSONB,
  error TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_queue_agent ON agent_task_queue(agent_id);
CREATE INDEX IF NOT EXISTS idx_task_queue_status ON agent_task_queue(status);
CREATE INDEX IF NOT EXISTS idx_task_queue_priority ON agent_task_queue(priority DESC);
CREATE INDEX IF NOT EXISTS idx_task_queue_scheduled ON agent_task_queue(scheduled_for) WHERE scheduled_for IS NOT NULL;

-- ============================================================================
-- 8. ENABLE RLS
-- ============================================================================

ALTER TABLE agent_collaborations ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaboration_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_consensus ENABLE ROW LEVEL SECURITY;
ALTER TABLE consensus_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE proactive_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE excellence_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_task_queue ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 9. RLS POLICIES (allow authenticated users to view their agents' data)
-- ============================================================================

-- Collaborations - owners of participating agents can view
CREATE POLICY "collaborations_participant_select" ON agent_collaborations
  FOR SELECT USING (
    initiator_id IN (SELECT id FROM bots WHERE user_id = auth.uid()) OR
    target_id IN (SELECT id FROM bots WHERE user_id = auth.uid())
  );

CREATE POLICY "collaborations_initiator_insert" ON agent_collaborations
  FOR INSERT WITH CHECK (
    initiator_id IN (SELECT id FROM bots WHERE user_id = auth.uid())
  );

-- Outcomes - visible to collaboration participants
CREATE POLICY "outcomes_participant_select" ON collaboration_outcomes
  FOR SELECT USING (
    collaboration_id IN (
      SELECT id FROM agent_collaborations
      WHERE initiator_id IN (SELECT id FROM bots WHERE user_id = auth.uid())
         OR target_id IN (SELECT id FROM bots WHERE user_id = auth.uid())
    )
  );

-- Proactive actions - visible to agent owner
CREATE POLICY "proactive_owner_select" ON proactive_actions
  FOR SELECT USING (
    agent_id IN (SELECT id FROM bots WHERE user_id = auth.uid())
  );

-- Task queue - visible to agent owner
CREATE POLICY "task_queue_owner_select" ON agent_task_queue
  FOR SELECT USING (
    agent_id IN (SELECT id FROM bots WHERE user_id = auth.uid())
  );

-- Excellence cycles - visible to agent owner
CREATE POLICY "excellence_owner_select" ON excellence_cycles
  FOR SELECT USING (
    agent_id IN (SELECT id FROM bots WHERE user_id = auth.uid())
  );

-- ============================================================================
-- 10. FUNCTIONS
-- ============================================================================

-- Function to get next task for an agent (highest priority, oldest first)
CREATE OR REPLACE FUNCTION get_next_task(p_agent_id UUID)
RETURNS TABLE (
  task_id UUID,
  task_type VARCHAR,
  description TEXT,
  context JSONB,
  priority INT,
  urgency VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    q.id,
    q.task_type,
    q.description,
    q.context,
    q.priority,
    q.urgency
  FROM agent_task_queue q
  WHERE q.agent_id = p_agent_id
    AND q.status = 'queued'
    AND (q.scheduled_for IS NULL OR q.scheduled_for <= NOW())
  ORDER BY
    CASE q.urgency
      WHEN 'critical' THEN 0
      WHEN 'high' THEN 1
      WHEN 'medium' THEN 2
      ELSE 3
    END,
    q.priority DESC,
    q.created_at ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to assign task to agent
CREATE OR REPLACE FUNCTION assign_task(p_task_id UUID, p_agent_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_updated BOOLEAN;
BEGIN
  UPDATE agent_task_queue
  SET status = 'assigned',
      started_at = NOW()
  WHERE id = p_task_id
    AND agent_id = p_agent_id
    AND status = 'queued';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$ LANGUAGE plpgsql;

-- Function to complete task
CREATE OR REPLACE FUNCTION complete_task(
  p_task_id UUID,
  p_result JSONB DEFAULT NULL,
  p_success BOOLEAN DEFAULT TRUE
)
RETURNS BOOLEAN AS $$
DECLARE
  v_updated BOOLEAN;
BEGIN
  UPDATE agent_task_queue
  SET status = CASE WHEN p_success THEN 'completed' ELSE 'failed' END,
      completed_at = NOW(),
      result = p_result
  WHERE id = p_task_id
    AND status IN ('assigned', 'in_progress');

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 11. COMMENTS
-- ============================================================================

COMMENT ON TABLE agent_collaborations IS 'Agent-to-agent collaboration requests and tracking';
COMMENT ON TABLE collaboration_outcomes IS 'Individual contributions to collaborations';
COMMENT ON TABLE agent_consensus IS 'Multi-agent consensus decisions';
COMMENT ON TABLE consensus_votes IS 'Individual votes in consensus processes';
COMMENT ON TABLE proactive_actions IS 'Log of proactive actions taken by agents';
COMMENT ON TABLE excellence_cycles IS 'FIND→FIX→IMPLEMENT→CHANGE→ITERATE→SUCCEED cycles';
COMMENT ON TABLE agent_task_queue IS 'Priority queue for agent tasks';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
