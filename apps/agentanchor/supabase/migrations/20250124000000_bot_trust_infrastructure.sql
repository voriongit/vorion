-- Bot Trust Infrastructure Migration
-- Creates tables and indexes for the bot trust and validation system

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. Bot Decisions Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS bot_decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  decision_type TEXT NOT NULL CHECK (decision_type IN ('ask', 'suggest', 'execute', 'escalate')),
  action_taken TEXT NOT NULL,
  context_data JSONB DEFAULT '{}'::jsonb,
  reasoning TEXT,
  alternatives_considered JSONB DEFAULT '[]'::jsonb,
  confidence_score DECIMAL(3,2) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  user_response TEXT CHECK (user_response IN ('approved', 'rejected', 'modified')),
  modification_details TEXT,
  outcome TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for bot_decisions
CREATE INDEX idx_bot_decisions_bot_id ON bot_decisions(bot_id);
CREATE INDEX idx_bot_decisions_decision_type ON bot_decisions(decision_type);
CREATE INDEX idx_bot_decisions_risk_level ON bot_decisions(risk_level);
CREATE INDEX idx_bot_decisions_user_response ON bot_decisions(user_response);
CREATE INDEX idx_bot_decisions_created_at ON bot_decisions(created_at DESC);
CREATE INDEX idx_bot_decisions_bot_created ON bot_decisions(bot_id, created_at DESC);

-- ============================================================================
-- 2. Bot Trust Scores Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS bot_trust_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 300 AND score <= 1000),
  decision_accuracy DECIMAL(5,2) NOT NULL CHECK (decision_accuracy >= 0 AND decision_accuracy <= 100),
  ethics_compliance DECIMAL(5,2) NOT NULL CHECK (ethics_compliance >= 0 AND ethics_compliance <= 100),
  training_success DECIMAL(5,2) NOT NULL CHECK (training_success >= 0 AND training_success <= 100),
  operational_stability DECIMAL(5,2) NOT NULL CHECK (operational_stability >= 0 AND operational_stability <= 100),
  peer_reviews DECIMAL(5,2) NOT NULL CHECK (peer_reviews >= 0 AND peer_reviews <= 100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for bot_trust_scores
CREATE INDEX idx_bot_trust_scores_bot_id ON bot_trust_scores(bot_id);
CREATE INDEX idx_bot_trust_scores_score ON bot_trust_scores(score DESC);
CREATE INDEX idx_bot_trust_scores_created_at ON bot_trust_scores(created_at DESC);
CREATE INDEX idx_bot_trust_scores_bot_created ON bot_trust_scores(bot_id, created_at DESC);

-- ============================================================================
-- 3. Bot Approval Rates Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS bot_approval_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  overall_rate DECIMAL(5,4) NOT NULL CHECK (overall_rate >= 0 AND overall_rate <= 1),
  by_task_type JSONB DEFAULT '{}'::jsonb,
  by_risk_level JSONB DEFAULT '{}'::jsonb,
  trend_7_days DECIMAL(5,4) CHECK (trend_7_days >= 0 AND trend_7_days <= 1),
  trend_30_days DECIMAL(5,4) CHECK (trend_30_days >= 0 AND trend_30_days <= 1),
  trend_90_days DECIMAL(5,4) CHECK (trend_90_days >= 0 AND trend_90_days <= 1),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for bot_approval_rates
CREATE INDEX idx_bot_approval_rates_bot_id ON bot_approval_rates(bot_id);
CREATE INDEX idx_bot_approval_rates_overall ON bot_approval_rates(overall_rate DESC);
CREATE INDEX idx_bot_approval_rates_created_at ON bot_approval_rates(created_at DESC);

-- ============================================================================
-- 4. Bot Autonomy Levels Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS bot_autonomy_levels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  current_level INTEGER NOT NULL CHECK (current_level >= 1 AND current_level <= 5),
  previous_level INTEGER CHECK (previous_level >= 1 AND previous_level <= 5),
  decision_count INTEGER NOT NULL DEFAULT 0,
  approval_rate DECIMAL(5,4) NOT NULL DEFAULT 0,
  progression_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for bot_autonomy_levels
CREATE INDEX idx_bot_autonomy_levels_bot_id ON bot_autonomy_levels(bot_id);
CREATE INDEX idx_bot_autonomy_levels_current_level ON bot_autonomy_levels(current_level);
CREATE INDEX idx_bot_autonomy_levels_created_at ON bot_autonomy_levels(created_at DESC);

-- ============================================================================
-- 5. Bot Audit Log Table (Immutable)
-- ============================================================================
CREATE TABLE IF NOT EXISTS bot_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}'::jsonb,
  user_id UUID,
  ip_address INET,
  user_agent TEXT,
  previous_hash TEXT,
  hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for bot_audit_log
CREATE INDEX idx_bot_audit_log_bot_id ON bot_audit_log(bot_id);
CREATE INDEX idx_bot_audit_log_event_type ON bot_audit_log(event_type);
CREATE INDEX idx_bot_audit_log_created_at ON bot_audit_log(created_at DESC);
CREATE INDEX idx_bot_audit_log_hash ON bot_audit_log(hash);

-- Make audit log immutable (prevent updates/deletes)
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit log entries are immutable and cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_audit_log_update
  BEFORE UPDATE ON bot_audit_log
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();

CREATE TRIGGER prevent_audit_log_delete
  BEFORE DELETE ON bot_audit_log
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();

-- ============================================================================
-- 6. Bot Telemetry Table (Time-Series Data)
-- ============================================================================
CREATE TABLE IF NOT EXISTS bot_telemetry (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL,
  metric_value DECIMAL(12,2) NOT NULL,
  metric_unit TEXT NOT NULL,
  tags JSONB DEFAULT '{}'::jsonb,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for bot_telemetry
CREATE INDEX idx_bot_telemetry_bot_id ON bot_telemetry(bot_id);
CREATE INDEX idx_bot_telemetry_metric_name ON bot_telemetry(metric_name);
CREATE INDEX idx_bot_telemetry_timestamp ON bot_telemetry(timestamp DESC);
CREATE INDEX idx_bot_telemetry_bot_metric_time ON bot_telemetry(bot_id, metric_name, timestamp DESC);

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE bot_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_trust_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_approval_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_autonomy_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_telemetry ENABLE ROW LEVEL SECURITY;

-- Bot Decisions Policies
CREATE POLICY bot_decisions_select_policy ON bot_decisions
  FOR SELECT USING (
    bot_id IN (
      SELECT id FROM bots WHERE user_id = auth.uid()
    )
  );

CREATE POLICY bot_decisions_insert_policy ON bot_decisions
  FOR INSERT WITH CHECK (
    bot_id IN (
      SELECT id FROM bots WHERE user_id = auth.uid()
    )
  );

CREATE POLICY bot_decisions_update_policy ON bot_decisions
  FOR UPDATE USING (
    bot_id IN (
      SELECT id FROM bots WHERE user_id = auth.uid()
    )
  );

-- Bot Trust Scores Policies
CREATE POLICY bot_trust_scores_select_policy ON bot_trust_scores
  FOR SELECT USING (
    bot_id IN (
      SELECT id FROM bots WHERE user_id = auth.uid()
    )
  );

CREATE POLICY bot_trust_scores_insert_policy ON bot_trust_scores
  FOR INSERT WITH CHECK (
    bot_id IN (
      SELECT id FROM bots WHERE user_id = auth.uid()
    )
  );

-- Bot Approval Rates Policies
CREATE POLICY bot_approval_rates_select_policy ON bot_approval_rates
  FOR SELECT USING (
    bot_id IN (
      SELECT id FROM bots WHERE user_id = auth.uid()
    )
  );

CREATE POLICY bot_approval_rates_insert_policy ON bot_approval_rates
  FOR INSERT WITH CHECK (
    bot_id IN (
      SELECT id FROM bots WHERE user_id = auth.uid()
    )
  );

-- Bot Autonomy Levels Policies
CREATE POLICY bot_autonomy_levels_select_policy ON bot_autonomy_levels
  FOR SELECT USING (
    bot_id IN (
      SELECT id FROM bots WHERE user_id = auth.uid()
    )
  );

CREATE POLICY bot_autonomy_levels_insert_policy ON bot_autonomy_levels
  FOR INSERT WITH CHECK (
    bot_id IN (
      SELECT id FROM bots WHERE user_id = auth.uid()
    )
  );

-- Bot Audit Log Policies (read-only for users)
CREATE POLICY bot_audit_log_select_policy ON bot_audit_log
  FOR SELECT USING (
    bot_id IN (
      SELECT id FROM bots WHERE user_id = auth.uid()
    )
  );

CREATE POLICY bot_audit_log_insert_policy ON bot_audit_log
  FOR INSERT WITH CHECK (
    bot_id IN (
      SELECT id FROM bots WHERE user_id = auth.uid()
    )
  );

-- Bot Telemetry Policies
CREATE POLICY bot_telemetry_select_policy ON bot_telemetry
  FOR SELECT USING (
    bot_id IN (
      SELECT id FROM bots WHERE user_id = auth.uid()
    )
  );

CREATE POLICY bot_telemetry_insert_policy ON bot_telemetry
  FOR INSERT WITH CHECK (
    bot_id IN (
      SELECT id FROM bots WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to get bot trust score
CREATE OR REPLACE FUNCTION get_bot_trust_score(bot_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  latest_score INTEGER;
BEGIN
  SELECT score INTO latest_score
  FROM bot_trust_scores
  WHERE bot_id = bot_uuid
  ORDER BY created_at DESC
  LIMIT 1;

  RETURN COALESCE(latest_score, 300); -- Default score for new bots
END;
$$ LANGUAGE plpgsql;

-- Function to get bot autonomy level
CREATE OR REPLACE FUNCTION get_bot_autonomy_level(bot_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  current_level INTEGER;
BEGIN
  SELECT current_level INTO current_level
  FROM bot_autonomy_levels
  WHERE bot_id = bot_uuid
  ORDER BY created_at DESC
  LIMIT 1;

  RETURN COALESCE(current_level, 1); -- Default level 1 for new bots
END;
$$ LANGUAGE plpgsql;

-- Function to get bot approval rate
CREATE OR REPLACE FUNCTION get_bot_approval_rate(bot_uuid UUID)
RETURNS DECIMAL(5,4) AS $$
DECLARE
  latest_rate DECIMAL(5,4);
BEGIN
  SELECT overall_rate INTO latest_rate
  FROM bot_approval_rates
  WHERE bot_id = bot_uuid
  ORDER BY created_at DESC
  LIMIT 1;

  RETURN COALESCE(latest_rate, 0); -- Default 0 for new bots
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Comments for Documentation
-- ============================================================================

COMMENT ON TABLE bot_decisions IS 'Tracks all bot decisions with context, reasoning, and user feedback';
COMMENT ON TABLE bot_trust_scores IS 'FICO-style trust scores (300-1000) calculated from 5 weighted components';
COMMENT ON TABLE bot_approval_rates IS 'Historical approval rates with trends and segmentation';
COMMENT ON TABLE bot_autonomy_levels IS 'Bot autonomy progression from Level 1 (Ask) to Level 5 (Autonomous)';
COMMENT ON TABLE bot_audit_log IS 'Immutable audit trail with cryptographic hash chaining';
COMMENT ON TABLE bot_telemetry IS 'Time-series performance metrics and operational data';

-- ============================================================================
-- Migration Complete
-- ============================================================================
