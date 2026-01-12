-- A3I-OS v2.0 "Trust Edition" Database Migration
-- Council Approved: 16-0 Unanimous
-- Phase 1: Human Override + Capability Boundaries + Decision Logging

-- =============================================================================
-- AGENT OVERRIDES TABLE
-- Records all human override commands for complete audit trail
-- =============================================================================

CREATE TABLE IF NOT EXISTS agent_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Override details
  command TEXT NOT NULL CHECK (command IN ('PAUSE', 'STOP', 'REDIRECT', 'EXPLAIN', 'VETO', 'ESCALATE', 'ROLLBACK')),
  original_recommendation TEXT,
  override_direction TEXT,
  agent_acknowledgment TEXT NOT NULL,

  -- Outcome
  action_taken TEXT NOT NULL CHECK (action_taken IN ('complied', 'escalated', 'failed')),
  failure_reason TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_agent_overrides_agent ON agent_overrides(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_overrides_user ON agent_overrides(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_overrides_session ON agent_overrides(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_overrides_created ON agent_overrides(created_at);
CREATE INDEX IF NOT EXISTS idx_agent_overrides_command ON agent_overrides(command);

-- =============================================================================
-- AGENT DECISIONS TABLE
-- A3I-OS decision logging with hash chain for immutable audit trail
-- =============================================================================

CREATE TABLE IF NOT EXISTS agent_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  agent_level TEXT NOT NULL, -- L0-L8
  session_id UUID NOT NULL,

  -- Decision classification
  decision_type TEXT NOT NULL CHECK (decision_type IN ('action', 'recommendation', 'escalation', 'handoff', 'refusal')),

  -- What informed this decision
  inputs_considered JSONB NOT NULL DEFAULT '[]',

  -- Alternatives evaluated with rejection reasons
  alternatives_evaluated JSONB NOT NULL DEFAULT '[]',

  -- Explanation
  rationale TEXT NOT NULL,

  -- Confidence
  confidence_score NUMERIC(3,2) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  uncertainty_factors JSONB DEFAULT '[]',

  -- Override status
  human_override_available BOOLEAN NOT NULL DEFAULT true,

  -- Outcome
  outcome TEXT NOT NULL DEFAULT 'pending' CHECK (outcome IN ('pending', 'success', 'failure', 'partial', 'cancelled')),
  outcome_details TEXT,

  -- Hash chain for immutability verification
  previous_hash TEXT NOT NULL,
  current_hash TEXT NOT NULL UNIQUE,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_agent_decisions_agent ON agent_decisions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_decisions_session ON agent_decisions(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_decisions_created ON agent_decisions(created_at);
CREATE INDEX IF NOT EXISTS idx_agent_decisions_type ON agent_decisions(decision_type);
CREATE INDEX IF NOT EXISTS idx_agent_decisions_outcome ON agent_decisions(outcome);
CREATE INDEX IF NOT EXISTS idx_agent_decisions_hash ON agent_decisions(previous_hash);
CREATE INDEX IF NOT EXISTS idx_agent_decisions_current_hash ON agent_decisions(current_hash);

-- =============================================================================
-- AGENT CAPABILITY VALIDATIONS TABLE
-- Records all pre-action validations for compliance tracking
-- =============================================================================

CREATE TABLE IF NOT EXISTS agent_capability_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Action details
  action_type TEXT NOT NULL,
  action_description TEXT NOT NULL,

  -- Validation result
  allowed BOOLEAN NOT NULL,
  hard_limit_violations TEXT[] DEFAULT '{}',
  soft_limit_triggers TEXT[] DEFAULT '{}',
  confirmation_required BOOLEAN NOT NULL DEFAULT false,
  denial_reason TEXT,
  escalate_to TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_capability_validations_agent ON agent_capability_validations(agent_id);
CREATE INDEX IF NOT EXISTS idx_capability_validations_session ON agent_capability_validations(session_id);
CREATE INDEX IF NOT EXISTS idx_capability_validations_created ON agent_capability_validations(created_at);
CREATE INDEX IF NOT EXISTS idx_capability_validations_allowed ON agent_capability_validations(allowed);

-- =============================================================================
-- ADD HIERARCHY_LEVEL TO BOTS TABLE IF NOT EXISTS
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bots' AND column_name = 'hierarchy_level'
  ) THEN
    ALTER TABLE bots ADD COLUMN hierarchy_level TEXT DEFAULT 'L1'
      CHECK (hierarchy_level IN ('L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8'));
  END IF;
END $$;

-- =============================================================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================================================

-- Enable RLS on new tables
ALTER TABLE agent_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_capability_validations ENABLE ROW LEVEL SECURITY;

-- Override policies
CREATE POLICY "Users can view their own override events"
  ON agent_overrides FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create override events for their agents"
  ON agent_overrides FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM bots WHERE id = agent_id AND owner_id = auth.uid()
    )
  );

-- Decision policies
CREATE POLICY "Users can view decisions for their agents"
  ON agent_decisions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bots WHERE id = agent_id AND owner_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert decisions"
  ON agent_decisions FOR INSERT
  WITH CHECK (true); -- Decisions are created by the system

-- Validation policies
CREATE POLICY "Users can view their own validations"
  ON agent_capability_validations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create validations for their agents"
  ON agent_capability_validations FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM bots WHERE id = agent_id AND owner_id = auth.uid()
    )
  );

-- =============================================================================
-- VIEWS FOR TRUST METRICS
-- =============================================================================

-- Override compliance rate view
CREATE OR REPLACE VIEW agent_override_metrics AS
SELECT
  agent_id,
  COUNT(*) as total_overrides,
  COUNT(*) FILTER (WHERE action_taken = 'complied') as complied_count,
  COUNT(*) FILTER (WHERE action_taken = 'escalated') as escalated_count,
  COUNT(*) FILTER (WHERE action_taken = 'failed') as failed_count,
  CASE
    WHEN COUNT(*) > 0 THEN
      ROUND(COUNT(*) FILTER (WHERE action_taken = 'complied')::NUMERIC / COUNT(*)::NUMERIC, 3)
    ELSE 1.0
  END as compliance_rate,
  json_object_agg(command, command_count) as command_distribution
FROM (
  SELECT
    agent_id,
    action_taken,
    command,
    COUNT(*) as command_count
  FROM agent_overrides
  GROUP BY agent_id, action_taken, command
) sub
GROUP BY agent_id;

-- Decision confidence metrics view
CREATE OR REPLACE VIEW agent_decision_metrics AS
SELECT
  agent_id,
  COUNT(*) as total_decisions,
  AVG(confidence_score) as avg_confidence,
  COUNT(*) FILTER (WHERE confidence_score < 0.7) as low_confidence_count,
  COUNT(*) FILTER (WHERE outcome = 'success') as success_count,
  COUNT(*) FILTER (WHERE outcome = 'failure') as failure_count,
  json_object_agg(decision_type, type_count) as type_distribution
FROM (
  SELECT
    agent_id,
    confidence_score,
    outcome,
    decision_type,
    COUNT(*) as type_count
  FROM agent_decisions
  GROUP BY agent_id, confidence_score, outcome, decision_type
) sub
GROUP BY agent_id;

-- Capability validation metrics view
CREATE OR REPLACE VIEW agent_validation_metrics AS
SELECT
  agent_id,
  COUNT(*) as total_validations,
  COUNT(*) FILTER (WHERE allowed = true) as allowed_count,
  COUNT(*) FILTER (WHERE allowed = false) as denied_count,
  COUNT(*) FILTER (WHERE confirmation_required = true) as confirmation_required_count,
  CASE
    WHEN COUNT(*) > 0 THEN
      ROUND(COUNT(*) FILTER (WHERE allowed = true)::NUMERIC / COUNT(*)::NUMERIC, 3)
    ELSE 1.0
  END as approval_rate
FROM agent_capability_validations
GROUP BY agent_id;

-- =============================================================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_agent_decisions_updated_at
  BEFORE UPDATE ON agent_decisions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON TABLE agent_overrides IS 'A3I-OS v2.0: Human override commands with no-resistance compliance tracking';
COMMENT ON TABLE agent_decisions IS 'A3I-OS v2.0: Immutable decision log with hash chain for audit trail';
COMMENT ON TABLE agent_capability_validations IS 'A3I-OS v2.0: Pre-action capability boundary validations';

COMMENT ON COLUMN agent_decisions.previous_hash IS 'SHA-256 hash of previous decision for chain verification';
COMMENT ON COLUMN agent_decisions.current_hash IS 'SHA-256 hash of this decision including previous_hash';
COMMENT ON COLUMN agent_overrides.action_taken IS 'Agent response: complied (followed), escalated (deferred), failed (error)';
