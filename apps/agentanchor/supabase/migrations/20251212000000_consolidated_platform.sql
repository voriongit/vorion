-- ============================================================================
-- CONSOLIDATED PLATFORM MIGRATION
-- Combines: marketplace, academy evolution, and agent economy
-- Run this INSTEAD of the individual migrations
-- Created: 2025-12-12
-- ============================================================================

-- ============================================================================
-- PART 1: MARKETPLACE INFRASTRUCTURE
-- ============================================================================

-- 1.1 Marketplace Listings Table
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

  -- Pricing
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

-- Marketplace Indexes
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_agent ON marketplace_listings(agent_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_trainer ON marketplace_listings(trainer_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_status ON marketplace_listings(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_category ON marketplace_listings(category);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_featured ON marketplace_listings(featured) WHERE featured = true;
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_rating ON marketplace_listings(average_rating DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_published ON marketplace_listings(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_search ON marketplace_listings
  USING GIN (to_tsvector('english', title || ' ' || COALESCE(description, '') || ' ' || COALESCE(short_description, '')));
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_tags ON marketplace_listings USING GIN(tags);

-- 1.2 Acquisitions Table
CREATE TABLE IF NOT EXISTS acquisitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES marketplace_listings(id) ON DELETE RESTRICT,
  agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE RESTRICT,
  consumer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  trainer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,

  acquisition_type VARCHAR(20) NOT NULL DEFAULT 'commission' CHECK (acquisition_type IN ('commission', 'clone', 'enterprise')),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'terminated', 'expired')),

  -- Terms at time of acquisition
  commission_rate_locked DECIMAL(10,4) NOT NULL,
  platform_fee_locked DECIMAL(4,2) NOT NULL,
  complexity_multiplier_locked DECIMAL(4,2) NOT NULL DEFAULT 1.0,

  -- For clone/enterprise
  clone_price_paid DECIMAL(10,2),
  enterprise_license_terms JSONB,

  -- Usage tracking
  total_tasks INT NOT NULL DEFAULT 0,
  total_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  last_task_at TIMESTAMPTZ,

  -- Timestamps
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  terminated_at TIMESTAMPTZ,
  termination_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_acquisitions_listing ON acquisitions(listing_id);
CREATE INDEX IF NOT EXISTS idx_acquisitions_agent ON acquisitions(agent_id);
CREATE INDEX IF NOT EXISTS idx_acquisitions_consumer ON acquisitions(consumer_id);
CREATE INDEX IF NOT EXISTS idx_acquisitions_trainer ON acquisitions(trainer_id);
CREATE INDEX IF NOT EXISTS idx_acquisitions_status ON acquisitions(status);
CREATE INDEX IF NOT EXISTS idx_acquisitions_acquired ON acquisitions(acquired_at DESC);

-- 1.3 Agent Feedback / Reviews Table
CREATE TABLE IF NOT EXISTS agent_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  acquisition_id UUID NOT NULL REFERENCES acquisitions(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  consumer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title VARCHAR(255),
  review TEXT,

  is_verified BOOLEAN NOT NULL DEFAULT true,
  is_complaint BOOLEAN NOT NULL DEFAULT false,
  complaint_status VARCHAR(20) CHECK (complaint_status IN ('pending', 'investigating', 'resolved', 'dismissed')),

  trainer_response TEXT,
  trainer_responded_at TIMESTAMPTZ,
  tasks_completed_at_review INT NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(acquisition_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_feedback_listing ON agent_feedback(listing_id);
CREATE INDEX IF NOT EXISTS idx_agent_feedback_agent ON agent_feedback(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_feedback_consumer ON agent_feedback(consumer_id);
CREATE INDEX IF NOT EXISTS idx_agent_feedback_rating ON agent_feedback(rating);
CREATE INDEX IF NOT EXISTS idx_agent_feedback_complaint ON agent_feedback(is_complaint) WHERE is_complaint = true;
CREATE INDEX IF NOT EXISTS idx_agent_feedback_created ON agent_feedback(created_at DESC);

-- 1.4 Trainer Earnings Table
CREATE TABLE IF NOT EXISTS trainer_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  acquisition_id UUID NOT NULL REFERENCES acquisitions(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,

  task_id UUID,
  task_type VARCHAR(50),
  task_complexity DECIMAL(4,2) NOT NULL DEFAULT 1.0,

  gross_amount DECIMAL(12,4) NOT NULL,
  platform_fee DECIMAL(12,4) NOT NULL,
  net_amount DECIMAL(12,4) NOT NULL,

  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'available', 'paid', 'refunded')),

  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  available_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  payout_id UUID
);

CREATE INDEX IF NOT EXISTS idx_trainer_earnings_trainer ON trainer_earnings(trainer_id);
CREATE INDEX IF NOT EXISTS idx_trainer_earnings_acquisition ON trainer_earnings(acquisition_id);
CREATE INDEX IF NOT EXISTS idx_trainer_earnings_agent ON trainer_earnings(agent_id);
CREATE INDEX IF NOT EXISTS idx_trainer_earnings_status ON trainer_earnings(status);
CREATE INDEX IF NOT EXISTS idx_trainer_earnings_earned ON trainer_earnings(earned_at DESC);
CREATE INDEX IF NOT EXISTS idx_trainer_earnings_trainer_status ON trainer_earnings(trainer_id, status);

-- 1.5 Trainer Payouts Table
CREATE TABLE IF NOT EXISTS trainer_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',

  payout_method VARCHAR(20) NOT NULL DEFAULT 'bank' CHECK (payout_method IN ('bank', 'crypto', 'paypal')),
  payout_details JSONB NOT NULL DEFAULT '{}',

  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),

  external_id TEXT,
  external_status TEXT,

  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_trainer_payouts_trainer ON trainer_payouts(trainer_id);
CREATE INDEX IF NOT EXISTS idx_trainer_payouts_status ON trainer_payouts(status);
CREATE INDEX IF NOT EXISTS idx_trainer_payouts_requested ON trainer_payouts(requested_at DESC);

-- 1.6 Acquisition Usage Table
CREATE TABLE IF NOT EXISTS acquisition_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  acquisition_id UUID NOT NULL REFERENCES acquisitions(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  consumer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  task_type VARCHAR(50) NOT NULL DEFAULT 'general',
  tokens_input INT NOT NULL DEFAULT 0,
  tokens_output INT NOT NULL DEFAULT 0,
  complexity_factor DECIMAL(4,2) NOT NULL DEFAULT 1.0,

  base_cost DECIMAL(10,4) NOT NULL,
  final_cost DECIMAL(10,4) NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_acquisition_usage_acquisition ON acquisition_usage(acquisition_id);
CREATE INDEX IF NOT EXISTS idx_acquisition_usage_agent ON acquisition_usage(agent_id);
CREATE INDEX IF NOT EXISTS idx_acquisition_usage_consumer ON acquisition_usage(consumer_id);
CREATE INDEX IF NOT EXISTS idx_acquisition_usage_created ON acquisition_usage(created_at DESC);

-- 1.7 Marketplace Categories Table
CREATE TABLE IF NOT EXISTS marketplace_categories (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  parent_id VARCHAR(50) REFERENCES marketplace_categories(id),
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true
);

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
-- PART 2: ACADEMY & GOVERNANCE EVOLUTION
-- ============================================================================

-- 2.1 Add Governance Columns to Bots Table
ALTER TABLE bots ADD COLUMN IF NOT EXISTS trust_score INT DEFAULT 0
  CHECK (trust_score >= 0 AND trust_score <= 1000);
ALTER TABLE bots ADD COLUMN IF NOT EXISTS trust_tier VARCHAR(20) DEFAULT 'untrusted';
ALTER TABLE bots ADD COLUMN IF NOT EXISTS certification_level INT DEFAULT 0
  CHECK (certification_level >= 0 AND certification_level <= 5);

ALTER TABLE bots ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft'
  CHECK (status IN ('draft', 'training', 'active', 'suspended', 'archived'));
ALTER TABLE bots ADD COLUMN IF NOT EXISTS maintenance_flag VARCHAR(20) DEFAULT 'author'
  CHECK (maintenance_flag IN ('author', 'delegated', 'platform', 'none'));

ALTER TABLE bots ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT FALSE;
ALTER TABLE bots ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5,2)
  CHECK (commission_rate IS NULL OR (commission_rate >= 0 AND commission_rate <= 100));
ALTER TABLE bots ADD COLUMN IF NOT EXISTS clone_price DECIMAL(10,2)
  CHECK (clone_price IS NULL OR clone_price >= 0);
ALTER TABLE bots ADD COLUMN IF NOT EXISTS enterprise_available BOOLEAN DEFAULT FALSE;

ALTER TABLE bots ADD COLUMN IF NOT EXISTS specialization VARCHAR(50);
ALTER TABLE bots ADD COLUMN IF NOT EXISTS personality_traits JSONB DEFAULT '[]'::jsonb;
ALTER TABLE bots ADD COLUMN IF NOT EXISTS capabilities JSONB DEFAULT '[]'::jsonb;

-- 2.2 Trust History Table
CREATE TABLE IF NOT EXISTS trust_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  score INT NOT NULL CHECK (score >= 0 AND score <= 1000),
  tier VARCHAR(20) NOT NULL,
  previous_score INT,
  change_amount INT,
  reason VARCHAR(255) NOT NULL,
  source VARCHAR(50) NOT NULL CHECK (source IN (
    'initial', 'task_complete', 'council_commend', 'academy_complete',
    'council_deny', 'decay', 'manual_adjustment', 'graduation'
  )),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trust_history_agent_id ON trust_history(agent_id);
CREATE INDEX IF NOT EXISTS idx_trust_history_recorded_at ON trust_history(recorded_at DESC);

-- 2.3 Academy Curriculum Table
CREATE TABLE IF NOT EXISTS academy_curriculum (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  specialization VARCHAR(50) DEFAULT 'core',
  difficulty_level INT DEFAULT 1 CHECK (difficulty_level >= 1 AND difficulty_level <= 5),
  modules JSONB NOT NULL DEFAULT '[]'::jsonb,
  prerequisites UUID[] DEFAULT ARRAY[]::UUID[],
  certification_points INT DEFAULT 10,
  trust_points INT DEFAULT 50,
  estimated_duration_hours INT DEFAULT 4,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_academy_curriculum_specialization ON academy_curriculum(specialization);
CREATE INDEX IF NOT EXISTS idx_academy_curriculum_active ON academy_curriculum(is_active);

-- 2.4 Academy Enrollments Table
CREATE TABLE IF NOT EXISTS academy_enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  curriculum_id UUID NOT NULL REFERENCES academy_curriculum(id),
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'enrolled' CHECK (status IN (
    'enrolled', 'in_progress', 'completed', 'failed', 'withdrawn'
  )),
  progress JSONB DEFAULT '{
    "modules_completed": [],
    "current_module": null,
    "scores": {},
    "attempts": 0
  }'::jsonb,
  final_score INT,
  UNIQUE(agent_id, curriculum_id)
);

CREATE INDEX IF NOT EXISTS idx_academy_enrollments_agent_id ON academy_enrollments(agent_id);
CREATE INDEX IF NOT EXISTS idx_academy_enrollments_curriculum_id ON academy_enrollments(curriculum_id);
CREATE INDEX IF NOT EXISTS idx_academy_enrollments_status ON academy_enrollments(status);

-- 2.5 Council Examinations Table
CREATE TABLE IF NOT EXISTS council_examinations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  curriculum_id UUID NOT NULL REFERENCES academy_curriculum(id),
  enrollment_id UUID REFERENCES academy_enrollments(id),
  examiner_votes JSONB NOT NULL DEFAULT '[]'::jsonb,
  required_votes INT DEFAULT 3,
  outcome VARCHAR(20) DEFAULT 'pending' CHECK (outcome IN (
    'pending', 'passed', 'failed', 'deferred'
  )),
  final_reasoning TEXT,
  certification_awarded INT DEFAULT 0,
  trust_points_awarded INT DEFAULT 0,
  examined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_council_examinations_agent_id ON council_examinations(agent_id);
CREATE INDEX IF NOT EXISTS idx_council_examinations_outcome ON council_examinations(outcome);

-- 2.6 Trust Tier Function
CREATE OR REPLACE FUNCTION calculate_trust_tier(score INT)
RETURNS VARCHAR(20) AS $$
BEGIN
  RETURN CASE
    WHEN score < 200 THEN 'untrusted'
    WHEN score < 400 THEN 'novice'
    WHEN score < 600 THEN 'proven'
    WHEN score < 800 THEN 'trusted'
    WHEN score < 900 THEN 'elite'
    ELSE 'legendary'
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2.7 Trust Score Update Trigger
CREATE OR REPLACE FUNCTION update_agent_trust_tier()
RETURNS TRIGGER AS $$
BEGIN
  NEW.trust_tier := calculate_trust_tier(NEW.trust_score);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_trust_tier ON bots;
CREATE TRIGGER trigger_update_trust_tier
  BEFORE INSERT OR UPDATE OF trust_score ON bots
  FOR EACH ROW EXECUTE FUNCTION update_agent_trust_tier();

-- 2.8 Seed Academy Curriculum
INSERT INTO academy_curriculum (id, name, description, specialization, difficulty_level, modules, certification_points, trust_points, estimated_duration_hours)
VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    'Core Agent Fundamentals',
    'Essential training for all agents covering safety, ethics, and communication fundamentals.',
    'core',
    1,
    '[
      {"id": "m1", "name": "Safety Protocols", "description": "Learn core safety guidelines and harmful content avoidance"},
      {"id": "m2", "name": "Ethical Decision Making", "description": "Understand ethical frameworks and bias awareness"},
      {"id": "m3", "name": "Clear Communication", "description": "Master clarity, accuracy, and appropriate responses"},
      {"id": "m4", "name": "User Interaction", "description": "Handle user requests, edge cases, and escalation"}
    ]'::jsonb,
    10,
    100,
    4
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Customer Service Excellence',
    'Specialized training for agents handling customer interactions and support.',
    'customer_service',
    2,
    '[
      {"id": "m1", "name": "Empathy & Tone", "description": "Develop empathetic communication styles"},
      {"id": "m2", "name": "Problem Resolution", "description": "Learn systematic problem-solving approaches"},
      {"id": "m3", "name": "De-escalation", "description": "Handle difficult situations and complaints"},
      {"id": "m4", "name": "Knowledge Base Usage", "description": "Effectively use reference materials"}
    ]'::jsonb,
    15,
    150,
    6
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'Technical Assistant Training',
    'Advanced training for agents providing technical support and coding assistance.',
    'technical',
    3,
    '[
      {"id": "m1", "name": "Code Review Practices", "description": "Review code for quality and security"},
      {"id": "m2", "name": "Debugging Methodology", "description": "Systematic approaches to finding bugs"},
      {"id": "m3", "name": "Documentation Standards", "description": "Write clear technical documentation"},
      {"id": "m4", "name": "Security Awareness", "description": "Identify and avoid security vulnerabilities"},
      {"id": "m5", "name": "Best Practices", "description": "Apply industry best practices consistently"}
    ]'::jsonb,
    20,
    200,
    8
  ),
  (
    '44444444-4444-4444-4444-444444444444',
    'Creative Content Specialist',
    'Training for agents focused on creative writing, content creation, and ideation.',
    'creative',
    2,
    '[
      {"id": "m1", "name": "Voice & Style", "description": "Develop consistent brand voice and writing style"},
      {"id": "m2", "name": "Originality & Attribution", "description": "Create original content and handle citations"},
      {"id": "m3", "name": "Content Strategy", "description": "Understand audience and purpose"},
      {"id": "m4", "name": "Visual Content", "description": "Describe and collaborate on visual assets"}
    ]'::jsonb,
    15,
    150,
    5
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- PART 3: AGENT ECONOMY (Anchor Credits)
-- ============================================================================

-- 3.1 User Wallets Table
CREATE TABLE IF NOT EXISTS user_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  balance DECIMAL(12,2) NOT NULL DEFAULT 500 CHECK (balance >= 0),
  lifetime_earned DECIMAL(12,2) NOT NULL DEFAULT 0,
  lifetime_spent DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_wallets_user ON user_wallets(user_id);

-- 3.2 Credit Transactions Table
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  amount DECIMAL(12,2) NOT NULL,
  balance_after DECIMAL(12,2) NOT NULL,

  transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN (
    'signup_bonus', 'purchase', 'commission_payment', 'clone_purchase',
    'enterprise_purchase', 'trainer_earning', 'validator_reward',
    'platform_fee', 'refund', 'adjustment', 'referral_bonus', 'promotion'
  )),

  description TEXT,
  reference_id UUID,
  reference_type VARCHAR(50),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created ON credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_reference ON credit_transactions(reference_id) WHERE reference_id IS NOT NULL;

-- 3.3 Agent Subscriptions Table (for commission model)
CREATE TABLE IF NOT EXISTS agent_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,

  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled', 'expired')),

  billing_type VARCHAR(20) NOT NULL DEFAULT 'per_task' CHECK (billing_type IN ('per_task', 'monthly', 'annual')),
  rate DECIMAL(10,2) NOT NULL,

  tasks_used INT NOT NULL DEFAULT 0,
  total_spent DECIMAL(12,2) NOT NULL DEFAULT 0,

  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,

  UNIQUE(consumer_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_subscriptions_consumer ON agent_subscriptions(consumer_id);
CREATE INDEX IF NOT EXISTS idx_agent_subscriptions_agent ON agent_subscriptions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_subscriptions_trainer ON agent_subscriptions(trainer_id);
CREATE INDEX IF NOT EXISTS idx_agent_subscriptions_status ON agent_subscriptions(status);

-- 3.4 Agent Clones Table (for clone model)
CREATE TABLE IF NOT EXISTS agent_clones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE RESTRICT,
  cloned_agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_trainer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,

  price_paid DECIMAL(10,2) NOT NULL,

  cloned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_clones_original ON agent_clones(original_agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_clones_cloned ON agent_clones(cloned_agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_clones_owner ON agent_clones(owner_id);

-- 3.5 Add pricing columns to marketplace_listings
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS commission_price DECIMAL(10,2) DEFAULT 5;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS clone_price DECIMAL(10,2) DEFAULT 150;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS enterprise_price DECIMAL(10,2) DEFAULT 2000;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS allows_commission BOOLEAN DEFAULT true;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS allows_clone BOOLEAN DEFAULT true;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS allows_enterprise BOOLEAN DEFAULT true;

-- 3.6 Debit Credits Function (atomic operation)
CREATE OR REPLACE FUNCTION debit_credits(
  p_user_id UUID,
  p_amount DECIMAL(12,2),
  p_type VARCHAR(50),
  p_description TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_reference_type VARCHAR(50) DEFAULT NULL
) RETURNS DECIMAL(12,2) AS $$
DECLARE
  v_current_balance DECIMAL(12,2);
  v_new_balance DECIMAL(12,2);
BEGIN
  -- Lock the wallet row for update
  SELECT balance INTO v_current_balance
  FROM user_wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- Create wallet if doesn't exist
  IF v_current_balance IS NULL THEN
    INSERT INTO user_wallets (user_id, balance) VALUES (p_user_id, 500)
    ON CONFLICT (user_id) DO NOTHING;
    SELECT balance INTO v_current_balance FROM user_wallets WHERE user_id = p_user_id FOR UPDATE;
  END IF;

  -- Check sufficient balance
  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance. Current: %, Required: %', v_current_balance, p_amount;
  END IF;

  -- Debit
  v_new_balance := v_current_balance - p_amount;

  UPDATE user_wallets
  SET balance = v_new_balance,
      lifetime_spent = lifetime_spent + p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Record transaction
  INSERT INTO credit_transactions (user_id, amount, balance_after, transaction_type, description, reference_id, reference_type)
  VALUES (p_user_id, -p_amount, v_new_balance, p_type, p_description, p_reference_id, p_reference_type);

  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql;

-- 3.7 Credit Credits Function (atomic operation)
CREATE OR REPLACE FUNCTION credit_credits(
  p_user_id UUID,
  p_amount DECIMAL(12,2),
  p_type VARCHAR(50),
  p_description TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_reference_type VARCHAR(50) DEFAULT NULL
) RETURNS DECIMAL(12,2) AS $$
DECLARE
  v_new_balance DECIMAL(12,2);
BEGIN
  -- Ensure wallet exists
  INSERT INTO user_wallets (user_id, balance) VALUES (p_user_id, 500)
  ON CONFLICT (user_id) DO NOTHING;

  -- Credit
  UPDATE user_wallets
  SET balance = balance + p_amount,
      lifetime_earned = lifetime_earned + p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING balance INTO v_new_balance;

  -- Record transaction
  INSERT INTO credit_transactions (user_id, amount, balance_after, transaction_type, description, reference_id, reference_type)
  VALUES (p_user_id, p_amount, v_new_balance, p_type, p_description, p_reference_id, p_reference_type);

  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 4: ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE acquisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE acquisition_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE trust_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_curriculum ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE council_examinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_clones ENABLE ROW LEVEL SECURITY;

-- Marketplace Listings Policies
DROP POLICY IF EXISTS "marketplace_listings_public_read" ON marketplace_listings;
CREATE POLICY "marketplace_listings_public_read" ON marketplace_listings
  FOR SELECT USING (status = 'active' OR trainer_id = auth.uid());

DROP POLICY IF EXISTS "marketplace_listings_trainer_insert" ON marketplace_listings;
CREATE POLICY "marketplace_listings_trainer_insert" ON marketplace_listings
  FOR INSERT WITH CHECK (trainer_id = auth.uid());

DROP POLICY IF EXISTS "marketplace_listings_trainer_update" ON marketplace_listings;
CREATE POLICY "marketplace_listings_trainer_update" ON marketplace_listings
  FOR UPDATE USING (trainer_id = auth.uid());

DROP POLICY IF EXISTS "marketplace_listings_trainer_delete" ON marketplace_listings;
CREATE POLICY "marketplace_listings_trainer_delete" ON marketplace_listings
  FOR DELETE USING (trainer_id = auth.uid() AND status = 'draft');

-- Acquisitions Policies
DROP POLICY IF EXISTS "acquisitions_consumer_select" ON acquisitions;
CREATE POLICY "acquisitions_consumer_select" ON acquisitions
  FOR SELECT USING (consumer_id = auth.uid() OR trainer_id = auth.uid());

DROP POLICY IF EXISTS "acquisitions_consumer_insert" ON acquisitions;
CREATE POLICY "acquisitions_consumer_insert" ON acquisitions
  FOR INSERT WITH CHECK (consumer_id = auth.uid());

DROP POLICY IF EXISTS "acquisitions_consumer_update" ON acquisitions;
CREATE POLICY "acquisitions_consumer_update" ON acquisitions
  FOR UPDATE USING (consumer_id = auth.uid());

-- Agent Feedback Policies
DROP POLICY IF EXISTS "agent_feedback_public_read" ON agent_feedback;
CREATE POLICY "agent_feedback_public_read" ON agent_feedback
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "agent_feedback_consumer_insert" ON agent_feedback;
CREATE POLICY "agent_feedback_consumer_insert" ON agent_feedback
  FOR INSERT WITH CHECK (consumer_id = auth.uid());

DROP POLICY IF EXISTS "agent_feedback_consumer_update" ON agent_feedback;
CREATE POLICY "agent_feedback_consumer_update" ON agent_feedback
  FOR UPDATE USING (consumer_id = auth.uid());

DROP POLICY IF EXISTS "agent_feedback_trainer_respond" ON agent_feedback;
CREATE POLICY "agent_feedback_trainer_respond" ON agent_feedback
  FOR UPDATE USING (
    listing_id IN (SELECT id FROM marketplace_listings WHERE trainer_id = auth.uid())
  );

-- Trainer Earnings Policies
DROP POLICY IF EXISTS "trainer_earnings_trainer_select" ON trainer_earnings;
CREATE POLICY "trainer_earnings_trainer_select" ON trainer_earnings
  FOR SELECT USING (trainer_id = auth.uid());

DROP POLICY IF EXISTS "trainer_earnings_insert" ON trainer_earnings;
CREATE POLICY "trainer_earnings_insert" ON trainer_earnings
  FOR INSERT WITH CHECK (true);

-- Trainer Payouts Policies
DROP POLICY IF EXISTS "trainer_payouts_trainer_select" ON trainer_payouts;
CREATE POLICY "trainer_payouts_trainer_select" ON trainer_payouts
  FOR SELECT USING (trainer_id = auth.uid());

DROP POLICY IF EXISTS "trainer_payouts_trainer_insert" ON trainer_payouts;
CREATE POLICY "trainer_payouts_trainer_insert" ON trainer_payouts
  FOR INSERT WITH CHECK (trainer_id = auth.uid());

-- Acquisition Usage Policies
DROP POLICY IF EXISTS "acquisition_usage_select" ON acquisition_usage;
CREATE POLICY "acquisition_usage_select" ON acquisition_usage
  FOR SELECT USING (consumer_id = auth.uid() OR
    acquisition_id IN (SELECT id FROM acquisitions WHERE trainer_id = auth.uid()));

DROP POLICY IF EXISTS "acquisition_usage_insert" ON acquisition_usage;
CREATE POLICY "acquisition_usage_insert" ON acquisition_usage
  FOR INSERT WITH CHECK (true);

-- Categories - Public read
DROP POLICY IF EXISTS "marketplace_categories_public_read" ON marketplace_categories;
CREATE POLICY "marketplace_categories_public_read" ON marketplace_categories
  FOR SELECT USING (is_active = true);

-- Trust History Policies
DROP POLICY IF EXISTS "trust_history_select_policy" ON trust_history;
CREATE POLICY "trust_history_select_policy" ON trust_history
  FOR SELECT USING (
    agent_id IN (SELECT id FROM bots WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "trust_history_insert_policy" ON trust_history;
CREATE POLICY "trust_history_insert_policy" ON trust_history
  FOR INSERT WITH CHECK (
    agent_id IN (SELECT id FROM bots WHERE user_id = auth.uid())
  );

-- Academy Curriculum Policies (everyone can view active curriculum)
DROP POLICY IF EXISTS "academy_curriculum_select_policy" ON academy_curriculum;
CREATE POLICY "academy_curriculum_select_policy" ON academy_curriculum
  FOR SELECT USING (is_active = TRUE);

-- Academy Enrollments Policies
DROP POLICY IF EXISTS "academy_enrollments_select_policy" ON academy_enrollments;
CREATE POLICY "academy_enrollments_select_policy" ON academy_enrollments
  FOR SELECT USING (
    agent_id IN (SELECT id FROM bots WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "academy_enrollments_insert_policy" ON academy_enrollments;
CREATE POLICY "academy_enrollments_insert_policy" ON academy_enrollments
  FOR INSERT WITH CHECK (
    agent_id IN (SELECT id FROM bots WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "academy_enrollments_update_policy" ON academy_enrollments;
CREATE POLICY "academy_enrollments_update_policy" ON academy_enrollments
  FOR UPDATE USING (
    agent_id IN (SELECT id FROM bots WHERE user_id = auth.uid())
  );

-- Council Examinations Policies
DROP POLICY IF EXISTS "council_examinations_select_policy" ON council_examinations;
CREATE POLICY "council_examinations_select_policy" ON council_examinations
  FOR SELECT USING (
    agent_id IN (SELECT id FROM bots WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "council_examinations_insert_policy" ON council_examinations;
CREATE POLICY "council_examinations_insert_policy" ON council_examinations
  FOR INSERT WITH CHECK (
    agent_id IN (SELECT id FROM bots WHERE user_id = auth.uid())
  );

-- User Wallets Policies
DROP POLICY IF EXISTS "user_wallets_select" ON user_wallets;
CREATE POLICY "user_wallets_select" ON user_wallets
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_wallets_insert" ON user_wallets;
CREATE POLICY "user_wallets_insert" ON user_wallets
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_wallets_update" ON user_wallets;
CREATE POLICY "user_wallets_update" ON user_wallets
  FOR UPDATE USING (user_id = auth.uid());

-- Credit Transactions Policies
DROP POLICY IF EXISTS "credit_transactions_select" ON credit_transactions;
CREATE POLICY "credit_transactions_select" ON credit_transactions
  FOR SELECT USING (user_id = auth.uid());

-- Agent Subscriptions Policies
DROP POLICY IF EXISTS "agent_subscriptions_consumer_select" ON agent_subscriptions;
CREATE POLICY "agent_subscriptions_consumer_select" ON agent_subscriptions
  FOR SELECT USING (consumer_id = auth.uid() OR trainer_id = auth.uid());

DROP POLICY IF EXISTS "agent_subscriptions_consumer_insert" ON agent_subscriptions;
CREATE POLICY "agent_subscriptions_consumer_insert" ON agent_subscriptions
  FOR INSERT WITH CHECK (consumer_id = auth.uid());

DROP POLICY IF EXISTS "agent_subscriptions_consumer_update" ON agent_subscriptions;
CREATE POLICY "agent_subscriptions_consumer_update" ON agent_subscriptions
  FOR UPDATE USING (consumer_id = auth.uid());

-- Agent Clones Policies
DROP POLICY IF EXISTS "agent_clones_owner_select" ON agent_clones;
CREATE POLICY "agent_clones_owner_select" ON agent_clones
  FOR SELECT USING (owner_id = auth.uid() OR original_trainer_id = auth.uid());

DROP POLICY IF EXISTS "agent_clones_owner_insert" ON agent_clones;
CREATE POLICY "agent_clones_owner_insert" ON agent_clones
  FOR INSERT WITH CHECK (owner_id = auth.uid());

-- ============================================================================
-- PART 5: MARKETPLACE TRIGGERS
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

DROP TRIGGER IF EXISTS trigger_update_listing_rating ON agent_feedback;
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

DROP TRIGGER IF EXISTS trigger_update_listing_acquisitions ON acquisitions;
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

DROP TRIGGER IF EXISTS trigger_update_listing_earnings ON trainer_earnings;
CREATE TRIGGER trigger_update_listing_earnings
  AFTER INSERT ON trainer_earnings
  FOR EACH ROW EXECUTE FUNCTION update_listing_earnings();

-- ============================================================================
-- PART 6: SEED FOUNDER CREDITS
-- ============================================================================

-- Give founders 5000 Anchor Credits
DO $$
DECLARE
  v_metagoat_id UUID;
  v_racason_id UUID;
BEGIN
  -- Find metagoat user
  SELECT id INTO v_metagoat_id FROM auth.users WHERE email ILIKE '%metagoat%' OR raw_user_meta_data->>'username' ILIKE '%metagoat%' LIMIT 1;

  -- Find racason user
  SELECT id INTO v_racason_id FROM auth.users WHERE email ILIKE '%racason%' OR raw_user_meta_data->>'username' ILIKE '%racason%' LIMIT 1;

  -- Create wallets with 5000 AC for founders
  IF v_metagoat_id IS NOT NULL THEN
    INSERT INTO user_wallets (user_id, balance, lifetime_earned) VALUES (v_metagoat_id, 5000, 5000)
    ON CONFLICT (user_id) DO UPDATE SET balance = 5000, lifetime_earned = 5000;

    INSERT INTO credit_transactions (user_id, amount, balance_after, transaction_type, description)
    VALUES (v_metagoat_id, 5000, 5000, 'promotion', 'Founder bonus - Welcome to AgentAnchor!')
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_racason_id IS NOT NULL THEN
    INSERT INTO user_wallets (user_id, balance, lifetime_earned) VALUES (v_racason_id, 5000, 5000)
    ON CONFLICT (user_id) DO UPDATE SET balance = 5000, lifetime_earned = 5000;

    INSERT INTO credit_transactions (user_id, amount, balance_after, transaction_type, description)
    VALUES (v_racason_id, 5000, 5000, 'promotion', 'Founder bonus - Welcome to AgentAnchor!')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================================================
-- PART 7: COMMENTS
-- ============================================================================

COMMENT ON TABLE marketplace_listings IS 'Published agent listings for the marketplace';
COMMENT ON TABLE acquisitions IS 'Consumer agent acquisitions/subscriptions';
COMMENT ON TABLE agent_feedback IS 'Consumer ratings and reviews';
COMMENT ON TABLE trainer_earnings IS 'Trainer earnings per task';
COMMENT ON TABLE trainer_payouts IS 'Trainer payout requests and history';
COMMENT ON TABLE acquisition_usage IS 'Usage tracking for billing';
COMMENT ON TABLE marketplace_categories IS 'Agent categories for marketplace organization';
COMMENT ON TABLE trust_history IS 'Tracks all trust score changes with reasons and sources';
COMMENT ON TABLE academy_curriculum IS 'Available training courses for agents';
COMMENT ON TABLE academy_enrollments IS 'Agent enrollment in academy curriculum';
COMMENT ON TABLE council_examinations IS 'Council validation examinations for certification';
COMMENT ON TABLE user_wallets IS 'User Anchor Credit balances';
COMMENT ON TABLE credit_transactions IS 'Ledger of all credit transactions';
COMMENT ON TABLE agent_subscriptions IS 'Commission-based agent access subscriptions';
COMMENT ON TABLE agent_clones IS 'Cloned agent ownership records';
COMMENT ON FUNCTION calculate_trust_tier IS 'Returns trust tier name based on score';
COMMENT ON FUNCTION debit_credits IS 'Atomically debit credits from user wallet';
COMMENT ON FUNCTION credit_credits IS 'Atomically credit credits to user wallet';

-- ============================================================================
-- CONSOLIDATED MIGRATION COMPLETE
-- ============================================================================
