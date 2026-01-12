-- =====================================================
-- A3I ECOSYSTEM INFRASTRUCTURE
-- Guard Rails, Teams, Goals, Inter-Agent Communication
-- =====================================================

-- =====================================================
-- GUARD RAILS SYSTEM
-- =====================================================

-- Guard Rail Types
DO $$ BEGIN
  CREATE TYPE guard_rail_type AS ENUM (
    'hard_boundary',      -- NEVER cross - immediate block
    'soft_boundary',      -- Requires approval to cross
    'warning',            -- Log and alert, but allow
    'guidance'            -- Suggest but don't enforce
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Guard Rail Scope
DO $$ BEGIN
  CREATE TYPE guard_rail_scope AS ENUM (
    'universal',          -- Applies to ALL agents
    'category',           -- Applies to agent category
    'team',               -- Applies to team members
    'role',               -- Applies to specific role
    'individual'          -- Applies to specific agent
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Guard Rails Definition Table
CREATE TABLE IF NOT EXISTS guard_rails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  type guard_rail_type NOT NULL DEFAULT 'warning',
  scope guard_rail_scope NOT NULL DEFAULT 'universal',

  -- Targeting
  scope_target TEXT,                    -- Category/team/role name if not universal
  applies_to UUID[],                    -- Specific agent IDs if individual scope

  -- Rule Definition
  rule_definition JSONB NOT NULL,       -- The actual rule logic
  -- Example: {"action": "access_pii", "condition": "always", "requirement": "privacy_officer_approval"}

  -- Consequences
  on_violation TEXT NOT NULL DEFAULT 'block',  -- block, warn, log, escalate
  escalation_target TEXT,               -- Council/agent to escalate to

  -- Metadata
  rationale TEXT,                       -- Why this guard rail exists
  source TEXT,                          -- Regulation, policy, or principle
  version INT DEFAULT 1,

  -- Status
  is_active BOOLEAN DEFAULT true,
  effective_from TIMESTAMPTZ DEFAULT NOW(),
  effective_until TIMESTAMPTZ,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guard_rails_type ON guard_rails(type);
CREATE INDEX IF NOT EXISTS idx_guard_rails_scope ON guard_rails(scope);
CREATE INDEX IF NOT EXISTS idx_guard_rails_active ON guard_rails(is_active) WHERE is_active = true;

-- Guard Rail Violations Log
CREATE TABLE IF NOT EXISTS guard_rail_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  guard_rail_id UUID NOT NULL REFERENCES guard_rails(id),
  agent_id UUID NOT NULL REFERENCES agents(id),

  -- Violation Details
  attempted_action TEXT NOT NULL,
  context JSONB,

  -- Outcome
  was_blocked BOOLEAN NOT NULL,
  override_granted BOOLEAN DEFAULT false,
  override_by UUID REFERENCES agents(id),
  override_reason TEXT,

  -- Timestamp
  occurred_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_violations_agent ON guard_rail_violations(agent_id);
CREATE INDEX IF NOT EXISTS idx_violations_rail ON guard_rail_violations(guard_rail_id);
CREATE INDEX IF NOT EXISTS idx_violations_time ON guard_rail_violations(occurred_at DESC);

-- =====================================================
-- TEAM & COUNCIL STRUCTURES
-- =====================================================

-- Team Types
DO $$ BEGIN
  CREATE TYPE team_type AS ENUM (
    'council',            -- Strategic decision-making body
    'team',               -- Execution unit
    'guild',              -- Learning community
    'squad',              -- Temporary project team
    'incident'            -- Crisis response team
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Teams Table
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  type team_type NOT NULL DEFAULT 'team',
  icon TEXT,

  -- Hierarchy
  parent_team_id UUID REFERENCES teams(id),

  -- Leadership
  lead_agent_id UUID REFERENCES agents(id),

  -- Purpose
  purpose TEXT NOT NULL,                -- The "why"
  responsibilities JSONB DEFAULT '[]',  -- What they're accountable for

  -- Authority
  authority_level INT DEFAULT 1,        -- 1-10, higher = more authority
  can_approve JSONB DEFAULT '[]',       -- What decisions can they make
  must_escalate JSONB DEFAULT '[]',     -- What must go up the chain

  -- Configuration
  quorum_required INT DEFAULT 1,        -- Members needed for decisions
  decision_method TEXT DEFAULT 'consensus', -- consensus, majority, lead_decides

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teams_type ON teams(type);
CREATE INDEX IF NOT EXISTS idx_teams_parent ON teams(parent_team_id);

-- Team Memberships
CREATE TABLE IF NOT EXISTS team_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,

  -- Role in Team
  role TEXT DEFAULT 'member',           -- member, lead, deputy, advisor
  responsibilities TEXT[],

  -- Status
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,

  UNIQUE(team_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_membership_team ON team_memberships(team_id);
CREATE INDEX IF NOT EXISTS idx_membership_agent ON team_memberships(agent_id);

-- =====================================================
-- GOAL ALIGNMENT SYSTEM
-- =====================================================

-- Goal Levels
DO $$ BEGIN
  CREATE TYPE goal_level AS ENUM (
    'mission',            -- Unchanging purpose
    'strategic',          -- Annual goals
    'team_okr',           -- Quarterly team objectives
    'agent_objective',    -- Sprint objectives
    'task'                -- Daily tasks
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Goal Status
DO $$ BEGIN
  CREATE TYPE goal_status AS ENUM (
    'draft',
    'active',
    'completed',
    'cancelled',
    'blocked'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Goals Table
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  title TEXT NOT NULL,
  description TEXT,
  level goal_level NOT NULL,

  -- Hierarchy
  parent_goal_id UUID REFERENCES goals(id),

  -- Ownership
  owner_agent_id UUID REFERENCES agents(id),
  owner_team_id UUID REFERENCES teams(id),

  -- Timeframe
  start_date DATE,
  target_date DATE,

  -- Progress
  status goal_status DEFAULT 'draft',
  progress_percent INT DEFAULT 0,

  -- Key Results (for OKRs)
  key_results JSONB DEFAULT '[]',
  -- Example: [{"result": "Deploy to 100 customers", "target": 100, "current": 45}]

  -- Alignment
  alignment_score FLOAT,                -- 0-1, how aligned with parent
  alignment_notes TEXT,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_goals_level ON goals(level);
CREATE INDEX IF NOT EXISTS idx_goals_parent ON goals(parent_goal_id);
CREATE INDEX IF NOT EXISTS idx_goals_owner_agent ON goals(owner_agent_id);
CREATE INDEX IF NOT EXISTS idx_goals_owner_team ON goals(owner_team_id);
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);

-- =====================================================
-- INTER-AGENT COMMUNICATION
-- =====================================================

-- Message Types
DO $$ BEGIN
  CREATE TYPE message_type AS ENUM (
    'request',            -- Asking for help
    'response',           -- Answering a request
    'broadcast',          -- Announcing to many
    'escalation',         -- Raising to higher authority
    'delegation',         -- Assigning to another
    'notification',       -- FYI message
    'collaboration'       -- Working session invite
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Message Priority
DO $$ BEGIN
  CREATE TYPE message_priority AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Agent Messages
CREATE TABLE IF NOT EXISTS agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Routing
  from_agent_id UUID NOT NULL REFERENCES agents(id),
  to_agent_id UUID REFERENCES agents(id),          -- Null for broadcasts
  to_team_id UUID REFERENCES teams(id),            -- For team messages

  -- Message
  type message_type NOT NULL,
  priority message_priority DEFAULT 'medium',
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  context JSONB,                                   -- Additional context

  -- Threading
  thread_id UUID,                                  -- For conversations
  in_reply_to UUID REFERENCES agent_messages(id),

  -- Status
  status TEXT DEFAULT 'sent',                      -- sent, delivered, read, acted_upon
  read_at TIMESTAMPTZ,
  acted_at TIMESTAMPTZ,

  -- Response expectations
  requires_response BOOLEAN DEFAULT false,
  response_deadline TIMESTAMPTZ,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_from ON agent_messages(from_agent_id);
CREATE INDEX IF NOT EXISTS idx_messages_to_agent ON agent_messages(to_agent_id);
CREATE INDEX IF NOT EXISTS idx_messages_to_team ON agent_messages(to_team_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON agent_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON agent_messages(created_at DESC);

-- =====================================================
-- COLLABORATION SESSIONS
-- =====================================================

-- Session Types
DO $$ BEGIN
  CREATE TYPE session_type AS ENUM (
    'design_review',
    'code_review',
    'incident_response',
    'decision_making',
    'brainstorming',
    'retrospective',
    'planning'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Collaboration Sessions
CREATE TABLE IF NOT EXISTS collaboration_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  title TEXT NOT NULL,
  type session_type NOT NULL,
  description TEXT,

  -- Participants
  initiator_id UUID NOT NULL REFERENCES agents(id),
  participants UUID[] NOT NULL,
  required_participants UUID[],

  -- Context
  related_goal_id UUID REFERENCES goals(id),
  context JSONB,

  -- Timeline
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,

  -- Outcomes
  outcome TEXT,
  decisions_made JSONB DEFAULT '[]',
  action_items JSONB DEFAULT '[]',

  -- Status
  status TEXT DEFAULT 'scheduled',                 -- scheduled, in_progress, completed, cancelled

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_initiator ON collaboration_sessions(initiator_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON collaboration_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_scheduled ON collaboration_sessions(scheduled_at);

-- =====================================================
-- DELEGATION TRACKING
-- =====================================================

CREATE TABLE IF NOT EXISTS delegations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parties
  delegator_id UUID NOT NULL REFERENCES agents(id),
  delegatee_id UUID NOT NULL REFERENCES agents(id),

  -- Task
  task_description TEXT NOT NULL,
  acceptance_criteria JSONB NOT NULL,
  context JSONB,

  -- Timeline
  delegated_at TIMESTAMPTZ DEFAULT NOW(),
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Check-ins
  check_in_schedule JSONB DEFAULT '[]',
  check_ins JSONB DEFAULT '[]',

  -- Status
  status TEXT DEFAULT 'active',                    -- active, completed, returned, escalated
  completion_notes TEXT,

  -- Accountability
  delegator_remains_accountable BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_delegations_delegator ON delegations(delegator_id);
CREATE INDEX IF NOT EXISTS idx_delegations_delegatee ON delegations(delegatee_id);
CREATE INDEX IF NOT EXISTS idx_delegations_status ON delegations(status);

-- =====================================================
-- ESCALATION CHAINS
-- =====================================================

CREATE TABLE IF NOT EXISTS escalation_chains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name TEXT NOT NULL UNIQUE,
  description TEXT,

  -- Chain definition (ordered)
  chain JSONB NOT NULL,
  -- Example: [
  --   {"level": 1, "type": "agent", "target": "team_lead"},
  --   {"level": 2, "type": "team", "target": "security_team"},
  --   {"level": 3, "type": "council", "target": "security_council"}
  -- ]

  -- Triggers
  triggers JSONB DEFAULT '[]',
  -- Example: ["security_incident", "compliance_violation"]

  -- SLAs
  sla_by_level JSONB DEFAULT '{}',
  -- Example: {"1": "15m", "2": "1h", "3": "4h"}

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Escalation Events
CREATE TABLE IF NOT EXISTS escalation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  chain_id UUID NOT NULL REFERENCES escalation_chains(id),

  -- Source
  triggered_by UUID NOT NULL REFERENCES agents(id),
  trigger_reason TEXT NOT NULL,
  context JSONB,

  -- Progress
  current_level INT DEFAULT 1,
  escalation_history JSONB DEFAULT '[]',

  -- Resolution
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES agents(id),
  resolution TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escalation_events_chain ON escalation_events(chain_id);
CREATE INDEX IF NOT EXISTS idx_escalation_events_triggered ON escalation_events(triggered_by);

-- =====================================================
-- DECISION AUDIT LOG
-- =====================================================

CREATE TABLE IF NOT EXISTS decision_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who decided
  agent_id UUID REFERENCES agents(id),
  team_id UUID REFERENCES teams(id),
  council_id UUID REFERENCES teams(id),

  -- The decision
  decision_type TEXT NOT NULL,
  decision TEXT NOT NULL,
  reasoning TEXT NOT NULL,

  -- Alternatives considered
  alternatives JSONB DEFAULT '[]',

  -- Alignment
  goal_id UUID REFERENCES goals(id),
  guard_rails_checked UUID[],

  -- Outcome
  expected_outcome TEXT,
  actual_outcome TEXT,
  outcome_assessed_at TIMESTAMPTZ,

  -- Impact
  impact_assessment JSONB,

  -- Timestamp
  decided_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decision_log_agent ON decision_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_decision_log_team ON decision_log(team_id);
CREATE INDEX IF NOT EXISTS idx_decision_log_time ON decision_log(decided_at DESC);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Check if action violates guard rails
CREATE OR REPLACE FUNCTION check_guard_rails(
  p_agent_id UUID,
  p_action TEXT,
  p_context JSONB DEFAULT '{}'
)
RETURNS TABLE (
  violates BOOLEAN,
  guard_rail_id UUID,
  guard_rail_name TEXT,
  guard_rail_type guard_rail_type,
  required_action TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    true as violates,
    gr.id,
    gr.name,
    gr.type,
    gr.on_violation as required_action
  FROM guard_rails gr
  WHERE gr.is_active = true
    AND (
      gr.scope = 'universal'
      OR (gr.scope = 'individual' AND p_agent_id = ANY(gr.applies_to))
      -- Add more scope checks as needed
    )
    AND gr.rule_definition->>'action' = p_action
  ORDER BY
    CASE gr.type
      WHEN 'hard_boundary' THEN 1
      WHEN 'soft_boundary' THEN 2
      WHEN 'warning' THEN 3
      ELSE 4
    END;
END;
$$;

-- Get agent's team memberships
CREATE OR REPLACE FUNCTION get_agent_teams(p_agent_id UUID)
RETURNS TABLE (
  team_id UUID,
  team_name TEXT,
  team_type team_type,
  role TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.type,
    tm.role
  FROM team_memberships tm
  JOIN teams t ON t.id = tm.team_id
  WHERE tm.agent_id = p_agent_id
    AND tm.is_active = true
    AND t.is_active = true;
END;
$$;

-- Verify goal alignment
CREATE OR REPLACE FUNCTION verify_goal_alignment(p_goal_id UUID)
RETURNS FLOAT
LANGUAGE plpgsql
AS $$
DECLARE
  alignment_score FLOAT := 1.0;
  parent_goal RECORD;
  current_goal RECORD;
BEGIN
  SELECT * INTO current_goal FROM goals WHERE id = p_goal_id;

  IF current_goal.parent_goal_id IS NOT NULL THEN
    SELECT * INTO parent_goal FROM goals WHERE id = current_goal.parent_goal_id;

    -- Simple alignment check - can be made more sophisticated
    IF parent_goal.status = 'cancelled' THEN
      alignment_score := 0.0;
    ELSIF parent_goal.status = 'blocked' THEN
      alignment_score := 0.5;
    END IF;
  END IF;

  RETURN alignment_score;
END;
$$;

-- =====================================================
-- PERMISSIONS
-- =====================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON guard_rails TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON guard_rail_violations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON teams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON team_memberships TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON goals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON agent_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON collaboration_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON delegations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON escalation_chains TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON escalation_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON decision_log TO authenticated;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE guard_rails IS 'Defines safety boundaries and constraints for agent behavior';
COMMENT ON TABLE teams IS 'Team, council, and guild structures for agent organization';
COMMENT ON TABLE goals IS 'Hierarchical goal alignment from mission to tasks';
COMMENT ON TABLE agent_messages IS 'Inter-agent communication and collaboration';
COMMENT ON TABLE decision_log IS 'Audit trail of all significant decisions';

-- Success message
DO $$ BEGIN
  RAISE NOTICE 'A3I Ecosystem Infrastructure schema created successfully!';
END $$;
