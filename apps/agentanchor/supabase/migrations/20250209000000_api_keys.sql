-- =====================================================
-- Epic 8: API & Integration
-- Stories 8-1 through 8-4: API Keys, Webhooks, Rate Limiting
-- =====================================================

-- API Key scope enum
CREATE TYPE api_key_scope AS ENUM ('read', 'read_write', 'admin');

-- API Keys table
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  key_prefix VARCHAR(20) NOT NULL, -- aa_live_ or aa_test_
  key_hash VARCHAR(255) NOT NULL, -- bcrypt hash of key
  scope api_key_scope DEFAULT 'read',
  is_test BOOLEAN DEFAULT false,
  last_used_at TIMESTAMPTZ,
  last_used_ip VARCHAR(45),
  expires_at TIMESTAMPTZ,
  revoked BOOLEAN DEFAULT false,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- API Usage tracking for rate limiting
CREATE TABLE api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  status_code INTEGER,
  response_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Rate limit windows (sliding window counters)
CREATE TABLE rate_limit_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER DEFAULT 0,
  UNIQUE(api_key_id, window_start),
  UNIQUE(user_id, window_start)
);

-- Webhook events table
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES user_webhooks(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  signature VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, sent, delivered, failed
  attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  response_status INTEGER,
  response_body TEXT,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  delivered_at TIMESTAMPTZ
);

-- =====================================================
-- Indexes
-- =====================================================

CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_key_prefix ON api_keys(key_prefix);
CREATE INDEX idx_api_keys_active ON api_keys(user_id, revoked) WHERE revoked = false;
CREATE INDEX idx_api_usage_key_id ON api_usage(api_key_id);
CREATE INDEX idx_api_usage_created_at ON api_usage(created_at DESC);
CREATE INDEX idx_rate_limit_windows_key ON rate_limit_windows(api_key_id, window_start);
CREATE INDEX idx_webhook_events_webhook_id ON webhook_events(webhook_id);
CREATE INDEX idx_webhook_events_status ON webhook_events(status) WHERE status IN ('pending', 'failed');

-- =====================================================
-- RLS Policies
-- =====================================================

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- API Keys: users can manage their own
CREATE POLICY "Users can view own API keys"
  ON api_keys FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own API keys"
  ON api_keys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own API keys"
  ON api_keys FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own API keys"
  ON api_keys FOR DELETE
  USING (auth.uid() = user_id);

-- API Usage: users can view their own
CREATE POLICY "Users can view own API usage"
  ON api_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service can insert API usage"
  ON api_usage FOR INSERT
  WITH CHECK (true);

-- Rate limit windows: managed by system
CREATE POLICY "Service can manage rate limits"
  ON rate_limit_windows FOR ALL
  USING (true);

-- Webhook events: users can view their own
CREATE POLICY "Users can view own webhook events"
  ON webhook_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_webhooks w
      WHERE w.id = webhook_id AND w.user_id = auth.uid()
    )
  );

-- =====================================================
-- Helper functions
-- =====================================================

-- Check rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_api_key_id UUID,
  p_user_id UUID,
  p_tier VARCHAR DEFAULT 'free'
)
RETURNS TABLE(allowed BOOLEAN, remaining INTEGER, reset_at TIMESTAMPTZ) AS $$
DECLARE
  v_limit INTEGER;
  v_window_start TIMESTAMPTZ;
  v_count INTEGER;
BEGIN
  -- Set limit based on tier
  v_limit := CASE p_tier
    WHEN 'enterprise' THEN 10000
    WHEN 'pro' THEN 1000
    ELSE 100
  END;

  -- Get current hour window
  v_window_start := date_trunc('hour', now());

  -- Get or create window counter
  INSERT INTO rate_limit_windows (api_key_id, user_id, window_start, request_count)
  VALUES (p_api_key_id, p_user_id, v_window_start, 1)
  ON CONFLICT (api_key_id, window_start) DO UPDATE
  SET request_count = rate_limit_windows.request_count + 1
  RETURNING request_count INTO v_count;

  -- Return rate limit status
  RETURN QUERY SELECT
    v_count <= v_limit AS allowed,
    GREATEST(v_limit - v_count, 0) AS remaining,
    v_window_start + interval '1 hour' AS reset_at;
END;
$$ LANGUAGE plpgsql;

-- Clean up old rate limit windows
CREATE OR REPLACE FUNCTION cleanup_rate_limit_windows()
RETURNS void AS $$
BEGIN
  DELETE FROM rate_limit_windows
  WHERE window_start < now() - interval '2 hours';
END;
$$ LANGUAGE plpgsql;

-- Validate API key (returns user_id if valid)
CREATE OR REPLACE FUNCTION validate_api_key(p_key_prefix VARCHAR)
RETURNS TABLE(user_id UUID, scope api_key_scope, api_key_id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT k.user_id, k.scope, k.id
  FROM api_keys k
  WHERE k.key_prefix = p_key_prefix
    AND k.revoked = false
    AND (k.expires_at IS NULL OR k.expires_at > now());
END;
$$ LANGUAGE plpgsql;
