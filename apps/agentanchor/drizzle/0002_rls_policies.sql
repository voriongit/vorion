-- AgentAnchor Row Level Security Policies
-- Applied after functions migration

-- ============================================
-- Enable RLS on all tables
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE trust_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE council_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE truth_chain ENABLE ROW LEVEL SECURITY;
ALTER TABLE observer_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE acquisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_progress ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Profiles Policies
-- ============================================

-- Users can read all profiles (public directory)
DROP POLICY IF EXISTS profiles_select_all ON profiles;
CREATE POLICY profiles_select_all ON profiles
  FOR SELECT
  USING (true);

-- Users can only update their own profile
DROP POLICY IF EXISTS profiles_update_own ON profiles;
CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE
  USING (auth_user_id = current_setting('app.current_user_id', true))
  WITH CHECK (auth_user_id = current_setting('app.current_user_id', true));

-- Only system can insert profiles (via auth trigger)
DROP POLICY IF EXISTS profiles_insert_system ON profiles;
CREATE POLICY profiles_insert_system ON profiles
  FOR INSERT
  WITH CHECK (true); -- Controlled at application level

-- ============================================
-- Agents Policies
-- ============================================

-- Users can read their own agents
DROP POLICY IF EXISTS agents_select_own ON agents;
CREATE POLICY agents_select_own ON agents
  FOR SELECT
  USING (
    owner_id IN (SELECT id FROM profiles WHERE auth_user_id = current_setting('app.current_user_id', true))
    OR status = 'active' -- Active agents are publicly visible
  );

-- Users can only modify their own agents
DROP POLICY IF EXISTS agents_modify_own ON agents;
CREATE POLICY agents_modify_own ON agents
  FOR ALL
  USING (owner_id IN (SELECT id FROM profiles WHERE auth_user_id = current_setting('app.current_user_id', true)))
  WITH CHECK (owner_id IN (SELECT id FROM profiles WHERE auth_user_id = current_setting('app.current_user_id', true)));

-- ============================================
-- Trust History Policies
-- ============================================

-- Users can read trust history for their own agents
DROP POLICY IF EXISTS trust_history_select ON trust_history;
CREATE POLICY trust_history_select ON trust_history
  FOR SELECT
  USING (
    agent_id IN (
      SELECT id FROM agents
      WHERE owner_id IN (SELECT id FROM profiles WHERE auth_user_id = current_setting('app.current_user_id', true))
         OR status = 'active'
    )
  );

-- Only system can insert trust history
DROP POLICY IF EXISTS trust_history_insert_system ON trust_history;
CREATE POLICY trust_history_insert_system ON trust_history
  FOR INSERT
  WITH CHECK (true); -- Controlled at application level

-- ============================================
-- Council Decisions Policies
-- ============================================

-- All authenticated users can read council decisions (transparency)
DROP POLICY IF EXISTS council_decisions_select ON council_decisions;
CREATE POLICY council_decisions_select ON council_decisions
  FOR SELECT
  USING (true);

-- Only system/council can insert decisions
DROP POLICY IF EXISTS council_decisions_insert_system ON council_decisions;
CREATE POLICY council_decisions_insert_system ON council_decisions
  FOR INSERT
  WITH CHECK (true); -- Controlled at application level

-- ============================================
-- Truth Chain Policies
-- ============================================

-- Truth chain is publicly readable (transparency)
DROP POLICY IF EXISTS truth_chain_select_all ON truth_chain;
CREATE POLICY truth_chain_select_all ON truth_chain
  FOR SELECT
  USING (true);

-- Only system can insert truth chain records (append-only)
DROP POLICY IF EXISTS truth_chain_insert_system ON truth_chain;
CREATE POLICY truth_chain_insert_system ON truth_chain
  FOR INSERT
  WITH CHECK (true); -- Controlled at application level

-- No updates or deletes allowed
DROP POLICY IF EXISTS truth_chain_no_update ON truth_chain;
CREATE POLICY truth_chain_no_update ON truth_chain
  FOR UPDATE
  USING (false);

DROP POLICY IF EXISTS truth_chain_no_delete ON truth_chain;
CREATE POLICY truth_chain_no_delete ON truth_chain
  FOR DELETE
  USING (false);

-- ============================================
-- Observer Events Policies
-- ============================================

-- Users can read events related to their agents or public events
DROP POLICY IF EXISTS observer_events_select ON observer_events;
CREATE POLICY observer_events_select ON observer_events
  FOR SELECT
  USING (
    -- Users can see events for their agents
    subject_id IN (
      SELECT id FROM agents
      WHERE owner_id IN (SELECT id FROM profiles WHERE auth_user_id = current_setting('app.current_user_id', true))
    )
    -- Or public events (info/warning severity on active agents)
    OR (
      severity IN ('info', 'warning')
      AND subject_type = 'agent'
      AND subject_id IN (SELECT id FROM agents WHERE status = 'active')
    )
  );

-- Only system can insert events
DROP POLICY IF EXISTS observer_events_insert_system ON observer_events;
CREATE POLICY observer_events_insert_system ON observer_events
  FOR INSERT
  WITH CHECK (true); -- Controlled at application level

-- No updates or deletes allowed (append-only)
DROP POLICY IF EXISTS observer_events_no_update ON observer_events;
CREATE POLICY observer_events_no_update ON observer_events
  FOR UPDATE
  USING (false);

DROP POLICY IF EXISTS observer_events_no_delete ON observer_events;
CREATE POLICY observer_events_no_delete ON observer_events
  FOR DELETE
  USING (false);

-- ============================================
-- Marketplace Listings Policies
-- ============================================

-- Active listings are publicly readable
DROP POLICY IF EXISTS marketplace_listings_select ON marketplace_listings;
CREATE POLICY marketplace_listings_select ON marketplace_listings
  FOR SELECT
  USING (
    status = 'active'
    OR seller_id IN (SELECT id FROM profiles WHERE auth_user_id = current_setting('app.current_user_id', true))
  );

-- Sellers can manage their own listings
DROP POLICY IF EXISTS marketplace_listings_modify ON marketplace_listings;
CREATE POLICY marketplace_listings_modify ON marketplace_listings
  FOR ALL
  USING (seller_id IN (SELECT id FROM profiles WHERE auth_user_id = current_setting('app.current_user_id', true)))
  WITH CHECK (seller_id IN (SELECT id FROM profiles WHERE auth_user_id = current_setting('app.current_user_id', true)));

-- ============================================
-- Acquisitions Policies
-- ============================================

-- Users can read their own acquisitions
DROP POLICY IF EXISTS acquisitions_select ON acquisitions;
CREATE POLICY acquisitions_select ON acquisitions
  FOR SELECT
  USING (
    consumer_id IN (SELECT id FROM profiles WHERE auth_user_id = current_setting('app.current_user_id', true))
    OR agent_id IN (
      SELECT id FROM agents
      WHERE owner_id IN (SELECT id FROM profiles WHERE auth_user_id = current_setting('app.current_user_id', true))
    )
  );

-- Consumers can create acquisitions
DROP POLICY IF EXISTS acquisitions_insert ON acquisitions;
CREATE POLICY acquisitions_insert ON acquisitions
  FOR INSERT
  WITH CHECK (
    consumer_id IN (SELECT id FROM profiles WHERE auth_user_id = current_setting('app.current_user_id', true))
  );

-- Consumers can update their own acquisitions (e.g., add review)
DROP POLICY IF EXISTS acquisitions_update ON acquisitions;
CREATE POLICY acquisitions_update ON acquisitions
  FOR UPDATE
  USING (consumer_id IN (SELECT id FROM profiles WHERE auth_user_id = current_setting('app.current_user_id', true)))
  WITH CHECK (consumer_id IN (SELECT id FROM profiles WHERE auth_user_id = current_setting('app.current_user_id', true)));

-- ============================================
-- Academy Progress Policies
-- ============================================

-- Users can read progress for their own agents
DROP POLICY IF EXISTS academy_progress_select ON academy_progress;
CREATE POLICY academy_progress_select ON academy_progress
  FOR SELECT
  USING (
    agent_id IN (
      SELECT id FROM agents
      WHERE owner_id IN (SELECT id FROM profiles WHERE auth_user_id = current_setting('app.current_user_id', true))
    )
  );

-- Users can manage progress for their own agents
DROP POLICY IF EXISTS academy_progress_modify ON academy_progress;
CREATE POLICY academy_progress_modify ON academy_progress
  FOR ALL
  USING (
    agent_id IN (
      SELECT id FROM agents
      WHERE owner_id IN (SELECT id FROM profiles WHERE auth_user_id = current_setting('app.current_user_id', true))
    )
  )
  WITH CHECK (
    agent_id IN (
      SELECT id FROM agents
      WHERE owner_id IN (SELECT id FROM profiles WHERE auth_user_id = current_setting('app.current_user_id', true))
    )
  );

-- ============================================
-- Service Role Bypass
-- ============================================
-- Note: In Neon/Supabase, service role connections bypass RLS
-- Application code should use the appropriate connection based on context
