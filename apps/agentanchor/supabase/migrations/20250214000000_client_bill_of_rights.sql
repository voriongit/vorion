-- Client Bill of Rights Migration
-- Epic 11: Client Bill of Rights
--
-- Story 11-1: Ownership Change Detection
-- Story 11-2: 30-Day Notice System
-- Story 11-3: Consumer Opt-Out Flow
-- Story 11-4: Walk-Away Termination
-- Story 11-5: Protection Truth Chain Records

-- ============================================================================
-- 1. Ownership Changes Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS ownership_changes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  previous_owner_id UUID NOT NULL REFERENCES auth.users(id),
  new_owner_id UUID REFERENCES auth.users(id), -- null = platform
  change_type VARCHAR(30) NOT NULL CHECK (change_type IN (
    'transfer', 'delegation', 'platform_takeover', 'sale', 'walk_away', 'protection_decision'
  )),
  notice_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_date TIMESTAMPTZ NOT NULL,
  affected_consumers INT DEFAULT 0,
  opt_out_count INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
    'pending', 'in_progress', 'completed', 'cancelled'
  )),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ownership_changes_agent ON ownership_changes(agent_id);
CREATE INDEX IF NOT EXISTS idx_ownership_changes_effective ON ownership_changes(effective_date);
CREATE INDEX IF NOT EXISTS idx_ownership_changes_status ON ownership_changes(status);

-- ============================================================================
-- 2. Protection Requests Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS protection_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  consumer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  acquisition_id UUID NOT NULL REFERENCES acquisitions(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL CHECK (type IN (
    'opt_out', 'platform_maintenance', 'ownership_dispute'
  )),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'rejected', 'completed', 'cancelled'
  )),
  reason TEXT NOT NULL,
  context JSONB DEFAULT '{}'::jsonb,
  resolution TEXT,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_protection_requests_consumer ON protection_requests(consumer_id);
CREATE INDEX IF NOT EXISTS idx_protection_requests_agent ON protection_requests(agent_id);
CREATE INDEX IF NOT EXISTS idx_protection_requests_status ON protection_requests(status);
CREATE INDEX IF NOT EXISTS idx_protection_requests_pending ON protection_requests(consumer_id)
  WHERE status = 'pending';

-- ============================================================================
-- 3. Add termination tracking to acquisitions
-- ============================================================================

ALTER TABLE acquisitions
ADD COLUMN IF NOT EXISTS termination_reason VARCHAR(50),
ADD COLUMN IF NOT EXISTS walk_away_reason TEXT;

-- ============================================================================
-- 4. RLS Policies
-- ============================================================================

ALTER TABLE ownership_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE protection_requests ENABLE ROW LEVEL SECURITY;

-- Ownership changes: affected consumers can view
CREATE POLICY ownership_changes_consumer_select ON ownership_changes
  FOR SELECT USING (
    agent_id IN (
      SELECT agent_id FROM acquisitions
      WHERE consumer_id = auth.uid() AND status = 'active'
    )
    OR previous_owner_id = auth.uid()
    OR new_owner_id = auth.uid()
  );

-- Protection requests: consumers can manage their own
CREATE POLICY protection_requests_consumer_select ON protection_requests
  FOR SELECT USING (consumer_id = auth.uid());

CREATE POLICY protection_requests_consumer_insert ON protection_requests
  FOR INSERT WITH CHECK (consumer_id = auth.uid());

-- ============================================================================
-- 5. Function: Check if Consumer Can Walk Away
-- ============================================================================

CREATE OR REPLACE FUNCTION can_walk_away(p_consumer_id UUID, p_acquisition_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_agent_id UUID;
  v_has_pending_change BOOLEAN;
  v_can_walk_away BOOLEAN;
BEGIN
  -- Get agent ID and walk-away flag
  SELECT agent_id, can_walk_away INTO v_agent_id, v_can_walk_away
  FROM acquisitions
  WHERE id = p_acquisition_id AND consumer_id = p_consumer_id;

  IF v_agent_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Always can walk away if flag is set
  IF v_can_walk_away THEN
    RETURN TRUE;
  END IF;

  -- Check for pending ownership change
  SELECT EXISTS (
    SELECT 1 FROM ownership_changes
    WHERE agent_id = v_agent_id
      AND effective_date > NOW()
      AND status = 'pending'
  ) INTO v_has_pending_change;

  RETURN v_has_pending_change;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. Function: Get Active Protection Requests Count
-- ============================================================================

CREATE OR REPLACE FUNCTION get_pending_protection_requests(p_consumer_id UUID)
RETURNS INT AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INT
    FROM protection_requests
    WHERE consumer_id = p_consumer_id
      AND status = 'pending'
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. Comments
-- ============================================================================

COMMENT ON TABLE ownership_changes IS 'Track agent ownership changes for 30-day notice system';
COMMENT ON TABLE protection_requests IS 'Consumer protection requests (opt-out, platform maintenance)';
COMMENT ON FUNCTION can_walk_away IS 'Check if consumer can walk away clean from acquisition';

-- ============================================================================
-- Migration Complete
-- ============================================================================
