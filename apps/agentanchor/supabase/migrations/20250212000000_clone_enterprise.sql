-- Clone & Enterprise Acquisition Migration
-- Epic 9: Clone & Enterprise Acquisition
--
-- Story 9-1: Clone Pricing Settings
-- Story 9-2: Enterprise Lock Configuration
-- Story 9-3: Clone Package Generation
-- Story 9-4: Clone Acquisition Flow
-- Story 9-5: Enterprise Lock Acquisition

-- ============================================================================
-- 1. Add enterprise config column to marketplace_listings
-- ============================================================================

ALTER TABLE marketplace_listings
ADD COLUMN IF NOT EXISTS enterprise_config JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN marketplace_listings.enterprise_config IS
  'Enterprise lock configuration: lockDuration, removeFromMarketplace, includesSupport, includesUpdates, customTerms';

-- ============================================================================
-- 2. Add payment tracking to acquisitions
-- ============================================================================

ALTER TABLE acquisitions
ADD COLUMN IF NOT EXISTS payment_intent_id TEXT;

ALTER TABLE acquisitions
ADD COLUMN IF NOT EXISTS enterprise_license_terms JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_acquisitions_payment ON acquisitions(payment_intent_id)
  WHERE payment_intent_id IS NOT NULL;

-- ============================================================================
-- 3. Clone Package Storage (for download history)
-- ============================================================================

CREATE TABLE IF NOT EXISTS clone_packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  acquisition_id UUID NOT NULL REFERENCES acquisitions(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  consumer_id UUID NOT NULL REFERENCES auth.users(id),
  package_version VARCHAR(20) NOT NULL,
  clone_number INT NOT NULL,
  package_hash TEXT, -- For integrity verification
  definition JSONB NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  signature TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  downloaded_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_clone_packages_acquisition ON clone_packages(acquisition_id);
CREATE INDEX IF NOT EXISTS idx_clone_packages_consumer ON clone_packages(consumer_id);

-- ============================================================================
-- 4. Enterprise Licenses (detailed tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS enterprise_licenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  acquisition_id UUID NOT NULL REFERENCES acquisitions(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  consumer_id UUID NOT NULL REFERENCES auth.users(id),
  trainer_id UUID NOT NULL REFERENCES auth.users(id),
  lock_duration VARCHAR(20) NOT NULL CHECK (lock_duration IN (
    'perpetual', '1_year', '2_year', '3_year'
  )),
  is_perpetual BOOLEAN DEFAULT FALSE,
  includes_support BOOLEAN DEFAULT FALSE,
  includes_updates BOOLEAN DEFAULT TRUE,
  custom_terms TEXT,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN (
    'active', 'expired', 'cancelled', 'transferred'
  )),
  activated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enterprise_licenses_agent ON enterprise_licenses(agent_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_licenses_consumer ON enterprise_licenses(consumer_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_licenses_status ON enterprise_licenses(status);

-- ============================================================================
-- 5. RLS Policies
-- ============================================================================

ALTER TABLE clone_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise_licenses ENABLE ROW LEVEL SECURITY;

-- Clone packages: consumers can view their own
CREATE POLICY clone_packages_consumer_select ON clone_packages
  FOR SELECT USING (consumer_id = auth.uid());

-- Enterprise licenses: consumers and trainers can view
CREATE POLICY enterprise_licenses_consumer_select ON enterprise_licenses
  FOR SELECT USING (consumer_id = auth.uid() OR trainer_id = auth.uid());

-- ============================================================================
-- 6. Function: Check Enterprise Lock Status
-- ============================================================================

CREATE OR REPLACE FUNCTION is_enterprise_locked(p_agent_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM enterprise_licenses
    WHERE agent_id = p_agent_id
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > NOW())
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. Function: Get Clone Availability
-- ============================================================================

CREATE OR REPLACE FUNCTION get_clone_availability(p_listing_id UUID)
RETURNS TABLE (
  available BOOLEAN,
  current_clones INT,
  max_clones INT,
  remaining INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ml.available_for_clone AS available,
    COALESCE(ml.current_clones, 0) AS current_clones,
    ml.max_clones,
    CASE
      WHEN ml.max_clones IS NULL THEN 999999
      ELSE ml.max_clones - COALESCE(ml.current_clones, 0)
    END AS remaining
  FROM marketplace_listings ml
  WHERE ml.id = p_listing_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. Comments
-- ============================================================================

COMMENT ON TABLE clone_packages IS 'Generated clone packages for agent clones sold';
COMMENT ON TABLE enterprise_licenses IS 'Enterprise lock licenses for exclusive agent access';
COMMENT ON FUNCTION is_enterprise_locked IS 'Check if an agent is under active enterprise lock';
COMMENT ON FUNCTION get_clone_availability IS 'Check clone availability for a listing';

-- ============================================================================
-- Migration Complete
-- ============================================================================
