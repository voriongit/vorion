-- HITL (Human-in-the-Loop) Fade Logic Migration
-- Story 16-5: Proof Accumulation Tracker
-- Story 16-6: HITL Fade Logic
--
-- Council Priority #2 (42 points)

-- ============================================================================
-- 1. Proof Records Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS hitl_proof_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  action_type VARCHAR(100) NOT NULL,
  risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  agent_decision TEXT NOT NULL,
  human_decision TEXT,
  agreed BOOLEAN NOT NULL DEFAULT FALSE,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hitl_proof_agent ON hitl_proof_records(agent_id);
CREATE INDEX IF NOT EXISTS idx_hitl_proof_action ON hitl_proof_records(action_type);
CREATE INDEX IF NOT EXISTS idx_hitl_proof_created ON hitl_proof_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hitl_proof_agent_action ON hitl_proof_records(agent_id, action_type);

-- ============================================================================
-- 2. Accumulation Table (Aggregated Stats)
-- ============================================================================

CREATE TABLE IF NOT EXISTS hitl_accumulation (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  action_type VARCHAR(100) NOT NULL,
  total_reviews INT DEFAULT 0,
  agreed_count INT DEFAULT 0,
  disagreed_count INT DEFAULT 0,
  agreement_rate DECIMAL(5,2) DEFAULT 0 CHECK (agreement_rate >= 0 AND agreement_rate <= 100),
  current_phase VARCHAR(20) DEFAULT 'full_review' CHECK (current_phase IN (
    'full_review', 'spot_check', 'exception_only', 'autonomous'
  )),
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, action_type)
);

CREATE INDEX IF NOT EXISTS idx_hitl_accum_agent ON hitl_accumulation(agent_id);
CREATE INDEX IF NOT EXISTS idx_hitl_accum_phase ON hitl_accumulation(current_phase);

-- ============================================================================
-- 3. Review Requests Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS hitl_review_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  action_type VARCHAR(100) NOT NULL,
  action_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  agent_decision TEXT NOT NULL,
  risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'rejected', 'modified', 'expired'
  )),
  human_decision TEXT,
  human_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hitl_review_agent ON hitl_review_requests(agent_id);
CREATE INDEX IF NOT EXISTS idx_hitl_review_status ON hitl_review_requests(status);
CREATE INDEX IF NOT EXISTS idx_hitl_review_expires ON hitl_review_requests(expires_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_hitl_review_pending ON hitl_review_requests(created_at)
  WHERE status = 'pending';

-- ============================================================================
-- 4. Phase Transition History (Audit Trail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS hitl_phase_transitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  action_type VARCHAR(100) NOT NULL,
  from_phase VARCHAR(20) NOT NULL,
  to_phase VARCHAR(20) NOT NULL,
  agreement_rate DECIMAL(5,2),
  total_reviews INT,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hitl_transition_agent ON hitl_phase_transitions(agent_id);

-- ============================================================================
-- 5. RLS Policies
-- ============================================================================

ALTER TABLE hitl_proof_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE hitl_accumulation ENABLE ROW LEVEL SECURITY;
ALTER TABLE hitl_review_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE hitl_phase_transitions ENABLE ROW LEVEL SECURITY;

-- Proof records: owners can view
CREATE POLICY hitl_proof_select_policy ON hitl_proof_records
  FOR SELECT USING (
    agent_id IN (SELECT id FROM bots WHERE user_id = auth.uid())
  );

-- Accumulation: owners can view
CREATE POLICY hitl_accum_select_policy ON hitl_accumulation
  FOR SELECT USING (
    agent_id IN (SELECT id FROM bots WHERE user_id = auth.uid())
  );

-- Review requests: owners can view and update
CREATE POLICY hitl_review_select_policy ON hitl_review_requests
  FOR SELECT USING (
    agent_id IN (SELECT id FROM bots WHERE user_id = auth.uid())
  );

CREATE POLICY hitl_review_update_policy ON hitl_review_requests
  FOR UPDATE USING (
    agent_id IN (SELECT id FROM bots WHERE user_id = auth.uid())
  );

-- Phase transitions: owners can view
CREATE POLICY hitl_transition_select_policy ON hitl_phase_transitions
  FOR SELECT USING (
    agent_id IN (SELECT id FROM bots WHERE user_id = auth.uid())
  );

-- ============================================================================
-- 6. Function: Update Expired Reviews
-- ============================================================================

CREATE OR REPLACE FUNCTION expire_hitl_reviews()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE hitl_review_requests
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < NOW();

  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. Comments
-- ============================================================================

COMMENT ON TABLE hitl_proof_records IS 'Records of human-agent decision agreement/disagreement';
COMMENT ON TABLE hitl_accumulation IS 'Aggregated agreement statistics per agent/action';
COMMENT ON TABLE hitl_review_requests IS 'Pending and completed human review requests';
COMMENT ON TABLE hitl_phase_transitions IS 'History of HITL phase changes for audit';
COMMENT ON COLUMN hitl_accumulation.current_phase IS 'Current HITL phase: full_review, spot_check, exception_only, autonomous';

-- ============================================================================
-- Migration Complete
-- ============================================================================
