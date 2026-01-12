-- MIA (Missing-In-Action) Protocol Migration
-- Epic 10: MIA Protocol
--
-- Story 10-1: Trainer Activity Tracking
-- Story 10-2: MIA Detection Engine
-- Story 10-3: Graduated Warning System
-- Story 10-4: Consumer MIA Notifications
-- Story 10-5: Platform Takeover Flow

-- ============================================================================
-- 1. Add activity tracking columns to profiles
-- ============================================================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_agent_update_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_response_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_listing_update_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_support_response_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_payout_request_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_last_activity ON profiles(last_activity_at)
  WHERE role = 'trainer';

-- ============================================================================
-- 2. Trainer Activity Log
-- ============================================================================

CREATE TABLE IF NOT EXISTS trainer_activity (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trainer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL CHECK (activity_type IN (
    'login', 'agent_update', 'response', 'listing_update', 'support_response', 'payout_request'
  )),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trainer_activity_trainer ON trainer_activity(trainer_id);
CREATE INDEX IF NOT EXISTS idx_trainer_activity_type ON trainer_activity(activity_type);
CREATE INDEX IF NOT EXISTS idx_trainer_activity_created ON trainer_activity(created_at DESC);

-- ============================================================================
-- 3. MIA Warnings Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS mia_warnings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trainer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  level VARCHAR(20) NOT NULL CHECK (level IN ('notice', 'warning', 'critical', 'final')),
  message TEXT NOT NULL,
  deadline TIMESTAMPTZ,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolution VARCHAR(50), -- 'trainer_active', 'takeover_initiated', 'manual'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mia_warnings_trainer ON mia_warnings(trainer_id);
CREATE INDEX IF NOT EXISTS idx_mia_warnings_level ON mia_warnings(level);
CREATE INDEX IF NOT EXISTS idx_mia_warnings_pending ON mia_warnings(trainer_id)
  WHERE resolved_at IS NULL;

-- ============================================================================
-- 4. MIA Takeovers Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS mia_takeovers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trainer_id UUID NOT NULL REFERENCES auth.users(id),
  agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  reason VARCHAR(30) NOT NULL CHECK (reason IN ('mia', 'abandonment', 'platform_action')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
    'pending', 'temporary', 'permanent', 'returned'
  )),
  temporary_maintainer_id UUID REFERENCES auth.users(id),
  maintainer_assigned_at TIMESTAMPTZ,
  initiated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  returned_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mia_takeovers_trainer ON mia_takeovers(trainer_id);
CREATE INDEX IF NOT EXISTS idx_mia_takeovers_agent ON mia_takeovers(agent_id);
CREATE INDEX IF NOT EXISTS idx_mia_takeovers_status ON mia_takeovers(status);
CREATE INDEX IF NOT EXISTS idx_mia_takeovers_active ON mia_takeovers(agent_id)
  WHERE status IN ('pending', 'temporary');

-- ============================================================================
-- 5. Add MIA columns to agents/bots
-- ============================================================================

ALTER TABLE bots
ADD COLUMN IF NOT EXISTS mia_takeover BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS mia_takeover_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS original_owner_id UUID,
ADD COLUMN IF NOT EXISTS platform_maintained BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_bots_mia ON bots(mia_takeover)
  WHERE mia_takeover = TRUE;

-- ============================================================================
-- 6. RLS Policies
-- ============================================================================

ALTER TABLE trainer_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE mia_warnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE mia_takeovers ENABLE ROW LEVEL SECURITY;

-- Trainer activity: trainers can view their own
CREATE POLICY trainer_activity_select ON trainer_activity
  FOR SELECT USING (trainer_id = auth.uid());

-- MIA warnings: trainers can view their own
CREATE POLICY mia_warnings_select ON mia_warnings
  FOR SELECT USING (trainer_id = auth.uid());

-- MIA takeovers: trainers can view their own
CREATE POLICY mia_takeovers_trainer_select ON mia_takeovers
  FOR SELECT USING (trainer_id = auth.uid() OR temporary_maintainer_id = auth.uid());

-- ============================================================================
-- 7. Function: Get MIA Status for Trainer
-- ============================================================================

CREATE OR REPLACE FUNCTION get_mia_status(p_trainer_id UUID)
RETURNS TABLE (
  status VARCHAR(20),
  days_inactive INT,
  warning_level INT,
  last_activity TIMESTAMPTZ
) AS $$
DECLARE
  v_last_activity TIMESTAMPTZ;
  v_days_inactive INT;
BEGIN
  -- Get last activity
  SELECT last_activity_at INTO v_last_activity
  FROM profiles
  WHERE id = p_trainer_id;

  -- Calculate days inactive
  IF v_last_activity IS NULL THEN
    v_days_inactive := 999;
  ELSE
    v_days_inactive := EXTRACT(DAY FROM (NOW() - v_last_activity));
  END IF;

  RETURN QUERY
  SELECT
    CASE
      WHEN v_days_inactive >= 30 THEN 'mia'::VARCHAR(20)
      WHEN v_days_inactive >= 28 THEN 'critical'::VARCHAR(20)
      WHEN v_days_inactive >= 21 THEN 'warning'::VARCHAR(20)
      WHEN v_days_inactive >= 14 THEN 'notice'::VARCHAR(20)
      ELSE 'active'::VARCHAR(20)
    END AS status,
    v_days_inactive AS days_inactive,
    CASE
      WHEN v_days_inactive >= 30 THEN 3
      WHEN v_days_inactive >= 28 THEN 2
      WHEN v_days_inactive >= 21 THEN 1
      ELSE 0
    END AS warning_level,
    v_last_activity AS last_activity;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. Function: Scan for MIA Trainers (for cron job)
-- ============================================================================

CREATE OR REPLACE FUNCTION scan_mia_trainers()
RETURNS TABLE (
  trainer_id UUID,
  status VARCHAR(20),
  days_inactive INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS trainer_id,
    CASE
      WHEN EXTRACT(DAY FROM (NOW() - p.last_activity_at)) >= 30 THEN 'mia'::VARCHAR(20)
      WHEN EXTRACT(DAY FROM (NOW() - p.last_activity_at)) >= 28 THEN 'critical'::VARCHAR(20)
      WHEN EXTRACT(DAY FROM (NOW() - p.last_activity_at)) >= 21 THEN 'warning'::VARCHAR(20)
      WHEN EXTRACT(DAY FROM (NOW() - p.last_activity_at)) >= 14 THEN 'notice'::VARCHAR(20)
      ELSE 'active'::VARCHAR(20)
    END AS status,
    COALESCE(EXTRACT(DAY FROM (NOW() - p.last_activity_at))::INT, 999) AS days_inactive
  FROM profiles p
  WHERE p.role = 'trainer'
    AND (
      p.last_activity_at IS NULL
      OR p.last_activity_at < NOW() - INTERVAL '14 days'
    )
  ORDER BY days_inactive DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 9. Comments
-- ============================================================================

COMMENT ON TABLE trainer_activity IS 'Log of trainer activities for MIA detection';
COMMENT ON TABLE mia_warnings IS 'Graduated warning system for inactive trainers';
COMMENT ON TABLE mia_takeovers IS 'Platform takeover records for MIA trainer agents';
COMMENT ON FUNCTION get_mia_status IS 'Get current MIA status for a trainer';
COMMENT ON FUNCTION scan_mia_trainers IS 'Scan all trainers for MIA status (cron job)';

-- ============================================================================
-- Migration Complete
-- ============================================================================
