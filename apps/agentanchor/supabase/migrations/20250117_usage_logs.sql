-- Create usage_logs table for tracking API usage and costs
CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  bot_id UUID REFERENCES bots(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd DECIMAL(10, 6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_bot_id ON usage_logs(bot_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_conversation_id ON usage_logs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_created ON usage_logs(user_id, created_at DESC);

-- Enable RLS
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own usage logs" ON usage_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert usage logs" ON usage_logs
  FOR INSERT WITH CHECK (true);

-- Create audit_logs table for security auditing
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for audit logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- Enable RLS on audit logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for audit logs (admin only viewing)
CREATE POLICY "Users can view their own audit logs" ON audit_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert audit logs" ON audit_logs
  FOR INSERT WITH CHECK (true);

-- Create materialized view for usage statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS user_usage_stats AS
SELECT
  user_id,
  COUNT(DISTINCT bot_id) as bot_count,
  COUNT(DISTINCT conversation_id) as conversation_count,
  SUM(input_tokens) as total_input_tokens,
  SUM(output_tokens) as total_output_tokens,
  SUM(cost_usd) as total_cost,
  MAX(created_at) as last_activity
FROM usage_logs
GROUP BY user_id;

-- Index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_usage_stats_user_id
ON user_usage_stats(user_id);

-- Function to refresh materialized view (can be called by cron job)
CREATE OR REPLACE FUNCTION refresh_user_usage_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_usage_stats;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE usage_logs IS 'Tracks API usage, token consumption, and costs per user/bot/conversation';
COMMENT ON TABLE audit_logs IS 'Security audit trail for sensitive operations';
COMMENT ON MATERIALIZED VIEW user_usage_stats IS 'Aggregated usage statistics per user (refresh periodically)';
