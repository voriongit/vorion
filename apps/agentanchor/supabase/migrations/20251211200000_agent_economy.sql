-- Agent Economy Migration
-- Anchor Credits (AC) currency system for agent acquisition
-- Part of Marketplace Epic

-- ============================================================================
-- 1. User Wallets Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_wallets (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance INT DEFAULT 500 CHECK (balance >= 0), -- Starting credits
  lifetime_earned INT DEFAULT 0,
  lifetime_spent INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. Credit Transactions Ledger
-- ============================================================================

CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INT NOT NULL, -- positive = credit, negative = debit
  balance_after INT NOT NULL, -- wallet balance after this transaction
  type VARCHAR(30) NOT NULL CHECK (type IN (
    'signup_bonus',      -- Initial 500 AC
    'admin_grant',       -- Manual admin credit
    'purchase',          -- Bought credits with real money
    'commission_earned', -- Trainer earned from rental
    'commission_paid',   -- User paid for rental/task
    'clone_purchase',    -- User bought a clone
    'clone_sale',        -- Trainer sold a clone
    'enterprise_purchase', -- User bought full ownership
    'enterprise_sale',   -- Trainer sold full ownership
    'subscription_charge', -- Monthly subscription charge
    'refund',            -- Refund
    'platform_fee'       -- Platform takes cut
  )),
  reference_type VARCHAR(30), -- 'acquisition', 'listing', 'subscription'
  reference_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(type);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at DESC);

-- ============================================================================
-- 3. Agent Subscriptions (Commission/Rental Model)
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  listing_id UUID, -- Reference to marketplace listing
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN (
    'active', 'paused', 'cancelled', 'expired'
  )),
  billing_type VARCHAR(20) NOT NULL CHECK (billing_type IN (
    'per_task', 'monthly', 'annual'
  )),
  rate INT NOT NULL, -- AC per task or per period
  tasks_used INT DEFAULT 0,
  tasks_limit INT, -- NULL = unlimited for subscription
  started_at TIMESTAMPTZ DEFAULT NOW(),
  current_period_start TIMESTAMPTZ DEFAULT NOW(),
  current_period_end TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  UNIQUE(user_id, agent_id, status) -- Can only have one active subscription per agent
);

CREATE INDEX IF NOT EXISTS idx_agent_subscriptions_user_id ON agent_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_subscriptions_agent_id ON agent_subscriptions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_subscriptions_status ON agent_subscriptions(status);

-- ============================================================================
-- 4. Agent Clones (Track cloned agents)
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_clones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE SET NULL,
  cloned_agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  cloned_by UUID NOT NULL REFERENCES auth.users(id),
  clone_price INT NOT NULL,
  acquisition_id UUID, -- Reference to acquisition record
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_clones_original ON agent_clones(original_agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_clones_cloned_by ON agent_clones(cloned_by);

-- ============================================================================
-- 5. Marketplace Pricing (Extend listings)
-- ============================================================================

-- Add pricing columns to marketplace_listings if not exists
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS commission_rate INT DEFAULT 5
  CHECK (commission_rate IS NULL OR (commission_rate >= 1 AND commission_rate <= 100));
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS clone_price INT
  CHECK (clone_price IS NULL OR clone_price >= 0);
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS enterprise_price INT
  CHECK (enterprise_price IS NULL OR enterprise_price >= 0);
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS allows_commission BOOLEAN DEFAULT TRUE;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS allows_clone BOOLEAN DEFAULT TRUE;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS allows_enterprise BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- 6. Functions
-- ============================================================================

-- Function to create wallet on user signup (trigger from auth.users)
CREATE OR REPLACE FUNCTION create_user_wallet()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_wallets (user_id, balance)
  VALUES (NEW.id, 500)
  ON CONFLICT (user_id) DO NOTHING;

  -- Record signup bonus transaction
  INSERT INTO credit_transactions (user_id, amount, balance_after, type, description)
  VALUES (NEW.id, 500, 500, 'signup_bonus', 'Welcome bonus - 500 Anchor Credits');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to debit credits (with balance check)
CREATE OR REPLACE FUNCTION debit_credits(
  p_user_id UUID,
  p_amount INT,
  p_type VARCHAR(30),
  p_description TEXT,
  p_reference_type VARCHAR(30) DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL
) RETURNS TABLE(success BOOLEAN, new_balance INT, error_message TEXT) AS $$
DECLARE
  v_current_balance INT;
  v_new_balance INT;
BEGIN
  -- Lock the wallet row
  SELECT balance INTO v_current_balance
  FROM user_wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, 'Wallet not found'::TEXT;
    RETURN;
  END IF;

  IF v_current_balance < p_amount THEN
    RETURN QUERY SELECT FALSE, v_current_balance, 'Insufficient credits'::TEXT;
    RETURN;
  END IF;

  v_new_balance := v_current_balance - p_amount;

  -- Update wallet
  UPDATE user_wallets
  SET balance = v_new_balance,
      lifetime_spent = lifetime_spent + p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Record transaction
  INSERT INTO credit_transactions (user_id, amount, balance_after, type, description, reference_type, reference_id)
  VALUES (p_user_id, -p_amount, v_new_balance, p_type, p_description, p_reference_type, p_reference_id);

  RETURN QUERY SELECT TRUE, v_new_balance, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to credit (add) credits
CREATE OR REPLACE FUNCTION credit_credits(
  p_user_id UUID,
  p_amount INT,
  p_type VARCHAR(30),
  p_description TEXT,
  p_reference_type VARCHAR(30) DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL
) RETURNS TABLE(success BOOLEAN, new_balance INT) AS $$
DECLARE
  v_new_balance INT;
BEGIN
  -- Ensure wallet exists
  INSERT INTO user_wallets (user_id, balance)
  VALUES (p_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Update wallet
  UPDATE user_wallets
  SET balance = balance + p_amount,
      lifetime_earned = lifetime_earned + p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING balance INTO v_new_balance;

  -- Record transaction
  INSERT INTO credit_transactions (user_id, amount, balance_after, type, description, reference_type, reference_id)
  VALUES (p_user_id, p_amount, v_new_balance, p_type, p_description, p_reference_type, p_reference_id);

  RETURN QUERY SELECT TRUE, v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. RLS Policies
-- ============================================================================

ALTER TABLE user_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_clones ENABLE ROW LEVEL SECURITY;

-- Wallets: users can only see their own
CREATE POLICY wallet_select_own ON user_wallets
  FOR SELECT USING (user_id = auth.uid());

-- Transactions: users can only see their own
CREATE POLICY transactions_select_own ON credit_transactions
  FOR SELECT USING (user_id = auth.uid());

-- Subscriptions: users can see their own
CREATE POLICY subscriptions_select_own ON agent_subscriptions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY subscriptions_insert_own ON agent_subscriptions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY subscriptions_update_own ON agent_subscriptions
  FOR UPDATE USING (user_id = auth.uid());

-- Clones: users can see clones they made
CREATE POLICY clones_select_own ON agent_clones
  FOR SELECT USING (cloned_by = auth.uid());

-- ============================================================================
-- 8. Seed Initial Data - Give metagoat and racason 5000 AC
-- ============================================================================

-- First ensure wallets exist for these users, then update
DO $$
DECLARE
  v_metagoat_id UUID;
  v_racason_id UUID;
BEGIN
  -- Find metagoat user
  SELECT id INTO v_metagoat_id FROM auth.users WHERE email ILIKE '%metagoat%' LIMIT 1;

  -- Find racason user
  SELECT id INTO v_racason_id FROM auth.users WHERE email ILIKE '%racason%' LIMIT 1;

  -- Grant 5000 AC to metagoat if found
  IF v_metagoat_id IS NOT NULL THEN
    INSERT INTO user_wallets (user_id, balance, lifetime_earned)
    VALUES (v_metagoat_id, 5000, 5000)
    ON CONFLICT (user_id) DO UPDATE SET balance = 5000, lifetime_earned = 5000;

    INSERT INTO credit_transactions (user_id, amount, balance_after, type, description)
    VALUES (v_metagoat_id, 5000, 5000, 'admin_grant', 'Founder bonus - 5000 Anchor Credits');
  END IF;

  -- Grant 5000 AC to racason if found
  IF v_racason_id IS NOT NULL THEN
    INSERT INTO user_wallets (user_id, balance, lifetime_earned)
    VALUES (v_racason_id, 5000, 5000)
    ON CONFLICT (user_id) DO UPDATE SET balance = 5000, lifetime_earned = 5000;

    INSERT INTO credit_transactions (user_id, amount, balance_after, type, description)
    VALUES (v_racason_id, 5000, 5000, 'admin_grant', 'Founder bonus - 5000 Anchor Credits');
  END IF;
END $$;

-- ============================================================================
-- 9. Comments
-- ============================================================================

COMMENT ON TABLE user_wallets IS 'Anchor Credits (AC) wallet for each user';
COMMENT ON TABLE credit_transactions IS 'Immutable ledger of all credit transactions';
COMMENT ON TABLE agent_subscriptions IS 'Active rentals/subscriptions for commission-based agents';
COMMENT ON TABLE agent_clones IS 'Track lineage of cloned agents';
COMMENT ON FUNCTION debit_credits IS 'Safely debit credits with balance check';
COMMENT ON FUNCTION credit_credits IS 'Add credits to user wallet';

-- ============================================================================
-- Migration Complete
-- ============================================================================
