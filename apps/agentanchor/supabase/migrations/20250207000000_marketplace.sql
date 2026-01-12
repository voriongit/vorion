-- Marketplace Infrastructure Migration
-- Epic 6: Marketplace & Acquisition
-- Story 6-1 through 6-6

-- ============================================================================
-- 1. Marketplace Listings Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS marketplace_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Listing details
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  short_description VARCHAR(500),
  category VARCHAR(50) NOT NULL DEFAULT 'general',
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Pricing (FR109-FR111)
  commission_rate DECIMAL(10,4) NOT NULL DEFAULT 0.01 CHECK (commission_rate >= 0),
  complexity_multiplier DECIMAL(4,2) NOT NULL DEFAULT 1.0 CHECK (complexity_multiplier >= 0.5 AND complexity_multiplier <= 5.0),
  platform_fee_percent DECIMAL(4,2) NOT NULL DEFAULT 15.0 CHECK (platform_fee_percent >= 0 AND platform_fee_percent <= 50),

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'active', 'paused', 'archived')),
  featured BOOLEAN NOT NULL DEFAULT false,
  featured_until TIMESTAMPTZ,

  -- Stats (denormalized for performance)
  total_acquisitions INT NOT NULL DEFAULT 0,
  total_tasks_completed BIGINT NOT NULL DEFAULT 0,
  total_earnings DECIMAL(12,2) NOT NULL DEFAULT 0,
  average_rating DECIMAL(3,2),
  rating_count INT NOT NULL DEFAULT 0,

  -- Timestamps
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure one listing per agent
  UNIQUE(agent_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_agent ON marketplace_listings(agent_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_trainer ON marketplace_listings(trainer_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_status ON marketplace_listings(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_category ON marketplace_listings(category);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_featured ON marketplace_listings(featured) WHERE featured = true;
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_rating ON marketplace_listings(average_rating DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_published ON marketplace_listings(published_at DESC);

-- Full-text search
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_search ON marketplace_listings
  USING GIN (to_tsvector('english', title || ' ' || COALESCE(description, '') || ' ' || COALESCE(short_description, '')));

-- GIN index for tags
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_tags ON marketplace_listings USING GIN(tags);

-- ============================================================================
-- 2. Acquisitions Table (FR27)
-- ============================================================================

CREATE TABLE IF NOT EXISTS acquisitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES marketplace_listings(id) ON DELETE RESTRICT,
  agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE RESTRICT,
  consumer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  trainer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,

  -- Acquisition type
  acquisition_type VARCHAR(20) NOT NULL DEFAULT 'commission' CHECK (acquisition_type IN ('commission', 'clone', 'enterprise')),

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'terminated', 'expired')),

  -- Terms at time of acquisition
  commission_rate_locked DECIMAL(10,4) NOT NULL,
  platform_fee_locked DECIMAL(4,2) NOT NULL,
  complexity_multiplier_locked DECIMAL(4,2) NOT NULL DEFAULT 1.0,

  -- For clone/enterprise (Growth features)
  clone_price_paid DECIMAL(10,2),
  enterprise_license_terms JSONB,

  -- Usage tracking (FR30)
  total_tasks INT NOT NULL DEFAULT 0,
  total_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  last_task_at TIMESTAMPTZ,

  -- Timestamps
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  terminated_at TIMESTAMPTZ,
  termination_reason TEXT,

  -- Prevent duplicate acquisitions
  UNIQUE(agent_id, consumer_id) WHERE status = 'active'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_acquisitions_listing ON acquisitions(listing_id);
CREATE INDEX IF NOT EXISTS idx_acquisitions_agent ON acquisitions(agent_id);
CREATE INDEX IF NOT EXISTS idx_acquisitions_consumer ON acquisitions(consumer_id);
CREATE INDEX IF NOT EXISTS idx_acquisitions_trainer ON acquisitions(trainer_id);
CREATE INDEX IF NOT EXISTS idx_acquisitions_status ON acquisitions(status);
CREATE INDEX IF NOT EXISTS idx_acquisitions_acquired ON acquisitions(acquired_at DESC);

-- ============================================================================
-- 3. Agent Feedback / Reviews Table (FR31, FR104)
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  acquisition_id UUID NOT NULL REFERENCES acquisitions(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  consumer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Rating
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title VARCHAR(255),
  review TEXT,

  -- Flags
  is_verified BOOLEAN NOT NULL DEFAULT true,
  is_complaint BOOLEAN NOT NULL DEFAULT false,
  complaint_status VARCHAR(20) CHECK (complaint_status IN ('pending', 'investigating', 'resolved', 'dismissed')),

  -- Trainer response (FR22)
  trainer_response TEXT,
  trainer_responded_at TIMESTAMPTZ,

  -- Usage context at time of review
  tasks_completed_at_review INT NOT NULL DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One review per acquisition
  UNIQUE(acquisition_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_feedback_listing ON agent_feedback(listing_id);
CREATE INDEX IF NOT EXISTS idx_agent_feedback_agent ON agent_feedback(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_feedback_consumer ON agent_feedback(consumer_id);
CREATE INDEX IF NOT EXISTS idx_agent_feedback_rating ON agent_feedback(rating);
CREATE INDEX IF NOT EXISTS idx_agent_feedback_complaint ON agent_feedback(is_complaint) WHERE is_complaint = true;
CREATE INDEX IF NOT EXISTS idx_agent_feedback_created ON agent_feedback(created_at DESC);

-- ============================================================================
-- 4. Earnings Table (FR112-FR115)
-- ============================================================================

CREATE TABLE IF NOT EXISTS trainer_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  acquisition_id UUID NOT NULL REFERENCES acquisitions(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,

  -- Task details
  task_id UUID,
  task_type VARCHAR(50),
  task_complexity DECIMAL(4,2) NOT NULL DEFAULT 1.0,

  -- Amounts
  gross_amount DECIMAL(12,4) NOT NULL,
  platform_fee DECIMAL(12,4) NOT NULL,
  net_amount DECIMAL(12,4) NOT NULL,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'available', 'paid', 'refunded')),

  -- Timestamps
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  available_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  payout_id UUID
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trainer_earnings_trainer ON trainer_earnings(trainer_id);
CREATE INDEX IF NOT EXISTS idx_trainer_earnings_acquisition ON trainer_earnings(acquisition_id);
CREATE INDEX IF NOT EXISTS idx_trainer_earnings_agent ON trainer_earnings(agent_id);
CREATE INDEX IF NOT EXISTS idx_trainer_earnings_status ON trainer_earnings(status);
CREATE INDEX IF NOT EXISTS idx_trainer_earnings_earned ON trainer_earnings(earned_at DESC);
CREATE INDEX IF NOT EXISTS idx_trainer_earnings_trainer_status ON trainer_earnings(trainer_id, status);

-- ============================================================================
-- 5. Payouts Table (FR113-FR114)
-- ============================================================================

CREATE TABLE IF NOT EXISTS trainer_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Amount
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',

  -- Method
  payout_method VARCHAR(20) NOT NULL DEFAULT 'bank' CHECK (payout_method IN ('bank', 'crypto', 'paypal')),
  payout_details JSONB NOT NULL DEFAULT '{}',

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),

  -- External reference
  external_id TEXT,
  external_status TEXT,

  -- Timestamps
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trainer_payouts_trainer ON trainer_payouts(trainer_id);
CREATE INDEX IF NOT EXISTS idx_trainer_payouts_status ON trainer_payouts(status);
CREATE INDEX IF NOT EXISTS idx_trainer_payouts_requested ON trainer_payouts(requested_at DESC);

-- ============================================================================
-- 6. Usage Logs for Billing (FR30, FR109-FR110)
-- ============================================================================

CREATE TABLE IF NOT EXISTS acquisition_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  acquisition_id UUID NOT NULL REFERENCES acquisitions(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  consumer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Task details
  task_type VARCHAR(50) NOT NULL DEFAULT 'general',
  tokens_input INT NOT NULL DEFAULT 0,
  tokens_output INT NOT NULL DEFAULT 0,

  -- Complexity (FR110)
  complexity_factor DECIMAL(4,2) NOT NULL DEFAULT 1.0,

  -- Cost calculation
  base_cost DECIMAL(10,4) NOT NULL,
  final_cost DECIMAL(10,4) NOT NULL,

  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_acquisition_usage_acquisition ON acquisition_usage(acquisition_id);
CREATE INDEX IF NOT EXISTS idx_acquisition_usage_agent ON acquisition_usage(agent_id);
CREATE INDEX IF NOT EXISTS idx_acquisition_usage_consumer ON acquisition_usage(consumer_id);
CREATE INDEX IF NOT EXISTS idx_acquisition_usage_created ON acquisition_usage(created_at DESC);

-- ============================================================================
-- 7. Category Reference Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS marketplace_categories (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  parent_id VARCHAR(50) REFERENCES marketplace_categories(id),
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Seed categories
INSERT INTO marketplace_categories (id, name, description, icon, display_order) VALUES
  ('general', 'General Assistant', 'Multi-purpose AI assistants', 'Bot', 0),
  ('customer_service', 'Customer Service', 'Customer support and service agents', 'Headphones', 1),
  ('data_analysis', 'Data Analysis', 'Data processing and analytics', 'BarChart3', 2),
  ('creative', 'Creative', 'Content creation and creative writing', 'Palette', 3),
  ('development', 'Development', 'Coding and software development', 'Code', 4),
  ('research', 'Research', 'Information gathering and research', 'Search', 5),
  ('productivity', 'Productivity', 'Task management and productivity', 'CheckSquare', 6),
  ('education', 'Education', 'Learning and tutoring', 'GraduationCap', 7)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 8. Enable RLS
-- ============================================================================

ALTER TABLE marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE acquisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE acquisition_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_categories ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 9. RLS Policies
-- ============================================================================

-- Marketplace Listings - Public read for active, owner full access
CREATE POLICY "marketplace_listings_public_read" ON marketplace_listings
  FOR SELECT USING (status = 'active' OR trainer_id = auth.uid());

CREATE POLICY "marketplace_listings_trainer_insert" ON marketplace_listings
  FOR INSERT WITH CHECK (trainer_id = auth.uid());

CREATE POLICY "marketplace_listings_trainer_update" ON marketplace_listings
  FOR UPDATE USING (trainer_id = auth.uid());

CREATE POLICY "marketplace_listings_trainer_delete" ON marketplace_listings
  FOR DELETE USING (trainer_id = auth.uid() AND status = 'draft');

-- Acquisitions - Consumer and Trainer can view their own
CREATE POLICY "acquisitions_consumer_select" ON acquisitions
  FOR SELECT USING (consumer_id = auth.uid() OR trainer_id = auth.uid());

CREATE POLICY "acquisitions_consumer_insert" ON acquisitions
  FOR INSERT WITH CHECK (consumer_id = auth.uid());

CREATE POLICY "acquisitions_consumer_update" ON acquisitions
  FOR UPDATE USING (consumer_id = auth.uid());

-- Agent Feedback - Public read, consumer write
CREATE POLICY "agent_feedback_public_read" ON agent_feedback
  FOR SELECT USING (true);

CREATE POLICY "agent_feedback_consumer_insert" ON agent_feedback
  FOR INSERT WITH CHECK (consumer_id = auth.uid());

CREATE POLICY "agent_feedback_consumer_update" ON agent_feedback
  FOR UPDATE USING (consumer_id = auth.uid());

-- Allow trainer to respond
CREATE POLICY "agent_feedback_trainer_respond" ON agent_feedback
  FOR UPDATE USING (
    listing_id IN (SELECT id FROM marketplace_listings WHERE trainer_id = auth.uid())
  );

-- Trainer Earnings - Trainer only
CREATE POLICY "trainer_earnings_trainer_select" ON trainer_earnings
  FOR SELECT USING (trainer_id = auth.uid());

CREATE POLICY "trainer_earnings_insert" ON trainer_earnings
  FOR INSERT WITH CHECK (true);

-- Trainer Payouts - Trainer only
CREATE POLICY "trainer_payouts_trainer_select" ON trainer_payouts
  FOR SELECT USING (trainer_id = auth.uid());

CREATE POLICY "trainer_payouts_trainer_insert" ON trainer_payouts
  FOR INSERT WITH CHECK (trainer_id = auth.uid());

-- Acquisition Usage - Consumer and Trainer
CREATE POLICY "acquisition_usage_select" ON acquisition_usage
  FOR SELECT USING (consumer_id = auth.uid() OR
    acquisition_id IN (SELECT id FROM acquisitions WHERE trainer_id = auth.uid()));

CREATE POLICY "acquisition_usage_insert" ON acquisition_usage
  FOR INSERT WITH CHECK (true);

-- Categories - Public read
CREATE POLICY "marketplace_categories_public_read" ON marketplace_categories
  FOR SELECT USING (is_active = true);

-- ============================================================================
-- 10. Functions
-- ============================================================================

-- Update listing stats when feedback is added/updated
CREATE OR REPLACE FUNCTION update_listing_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE marketplace_listings
  SET
    average_rating = (
      SELECT ROUND(AVG(rating)::numeric, 2)
      FROM agent_feedback
      WHERE listing_id = COALESCE(NEW.listing_id, OLD.listing_id)
    ),
    rating_count = (
      SELECT COUNT(*)
      FROM agent_feedback
      WHERE listing_id = COALESCE(NEW.listing_id, OLD.listing_id)
    ),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.listing_id, OLD.listing_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_listing_rating
  AFTER INSERT OR UPDATE OR DELETE ON agent_feedback
  FOR EACH ROW EXECUTE FUNCTION update_listing_rating();

-- Update acquisition count when new acquisition is made
CREATE OR REPLACE FUNCTION update_listing_acquisitions()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE marketplace_listings
    SET
      total_acquisitions = total_acquisitions + 1,
      updated_at = NOW()
    WHERE id = NEW.listing_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_listing_acquisitions
  AFTER INSERT ON acquisitions
  FOR EACH ROW EXECUTE FUNCTION update_listing_acquisitions();

-- Update listing earnings
CREATE OR REPLACE FUNCTION update_listing_earnings()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE marketplace_listings
  SET
    total_earnings = total_earnings + NEW.net_amount,
    updated_at = NOW()
  WHERE id = NEW.listing_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_listing_earnings
  AFTER INSERT ON trainer_earnings
  FOR EACH ROW EXECUTE FUNCTION update_listing_earnings();

-- ============================================================================
-- 11. Comments
-- ============================================================================

COMMENT ON TABLE marketplace_listings IS 'Published agent listings for the marketplace (Story 6-1)';
COMMENT ON TABLE acquisitions IS 'Consumer agent acquisitions/subscriptions (Story 6-4)';
COMMENT ON TABLE agent_feedback IS 'Consumer ratings and reviews (Story 6-5)';
COMMENT ON TABLE trainer_earnings IS 'Trainer earnings per task (Story 6-6)';
COMMENT ON TABLE trainer_payouts IS 'Trainer payout requests and history (Story 6-6)';
COMMENT ON TABLE acquisition_usage IS 'Usage tracking for billing (FR30)';
COMMENT ON TABLE marketplace_categories IS 'Agent categories for marketplace organization';

-- ============================================================================
-- Migration Complete
-- ============================================================================
