-- ============================================
-- Agent Signal & Callback System
-- Enables agents to hear and respond to system events
-- ============================================

-- Signal sequence function
CREATE OR REPLACE FUNCTION next_signal_sequence()
RETURNS BIGINT AS $$
DECLARE
  seq BIGINT;
BEGIN
  SELECT COALESCE(MAX(sequence), 0) + 1 INTO seq FROM agent_signals;
  RETURN seq;
END;
$$ LANGUAGE plpgsql;

-- Agent Signals (events agents can receive)
CREATE TABLE IF NOT EXISTS agent_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'self', 'peer', 'hierarchy', 'council',
    'trust', 'academy', 'marketplace', 'system', 'safety'
  )),
  priority TEXT NOT NULL CHECK (priority IN (
    'critical', 'high', 'normal', 'low', 'background'
  )),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sequence BIGINT NOT NULL,

  -- Subject of the signal
  subject_type TEXT NOT NULL CHECK (subject_type IN ('agent', 'user', 'system', 'council')),
  subject_id TEXT NOT NULL,
  subject_name TEXT,

  -- Signal content
  data JSONB DEFAULT '{}',
  summary TEXT NOT NULL,

  -- Aggregation info (for batched signals)
  aggregation JSONB,

  -- Action info
  action_required BOOLEAN DEFAULT FALSE,
  suggested_actions TEXT[],
  expires_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signals_type ON agent_signals(type);
CREATE INDEX IF NOT EXISTS idx_signals_category ON agent_signals(category);
CREATE INDEX IF NOT EXISTS idx_signals_priority ON agent_signals(priority);
CREATE INDEX IF NOT EXISTS idx_signals_sequence ON agent_signals(sequence);
CREATE INDEX IF NOT EXISTS idx_signals_timestamp ON agent_signals(timestamp);
CREATE INDEX IF NOT EXISTS idx_signals_subject ON agent_signals(subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_signals_action ON agent_signals(action_required) WHERE action_required = TRUE;
CREATE INDEX IF NOT EXISTS idx_signals_expires ON agent_signals(expires_at) WHERE expires_at IS NOT NULL;

-- Agent Signal Subscriptions (what agents want to receive)
CREATE TABLE IF NOT EXISTS agent_signal_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT TRUE,

  -- Category preferences (JSONB with enabled, minPriority, realtime per category)
  categories JSONB NOT NULL DEFAULT '{}',

  -- Custom filters
  filters JSONB DEFAULT '{}',

  -- Delivery preferences
  delivery JSONB DEFAULT '{"realtime": true, "batchInterval": 15}',

  -- Rate limiting
  rate_limit JSONB DEFAULT '{"maxPerMinute": 60, "maxPerHour": 500}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(agent_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_agent ON agent_signal_subscriptions(agent_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_enabled ON agent_signal_subscriptions(enabled) WHERE enabled = TRUE;

-- Agent Signal Deliveries (tracking what was delivered)
CREATE TABLE IF NOT EXISTS agent_signal_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  signal_id UUID NOT NULL REFERENCES agent_signals(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('realtime', 'batch', 'webhook')),
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deliveries_agent ON agent_signal_deliveries(agent_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_signal ON agent_signal_deliveries(signal_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_time ON agent_signal_deliveries(delivered_at);

-- Agent Signal Queue (for batch delivery)
CREATE TABLE IF NOT EXISTS agent_signal_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  signal_id UUID NOT NULL REFERENCES agent_signals(id) ON DELETE CASCADE,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_queue_agent ON agent_signal_queue(agent_id);
CREATE INDEX IF NOT EXISTS idx_queue_pending ON agent_signal_queue(agent_id, queued_at) WHERE processed_at IS NULL;

-- Agent Signal Acknowledgments (agent responses to signals)
CREATE TABLE IF NOT EXISTS agent_signal_acknowledgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  signal_id UUID NOT NULL REFERENCES agent_signals(id) ON DELETE CASCADE,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  action_taken TEXT,
  outcome TEXT,
  response_data JSONB,

  UNIQUE(agent_id, signal_id)
);

CREATE INDEX IF NOT EXISTS idx_acks_agent ON agent_signal_acknowledgments(agent_id);
CREATE INDEX IF NOT EXISTS idx_acks_signal ON agent_signal_acknowledgments(signal_id);

-- Agent Callbacks (trigger-response rules)
CREATE TABLE IF NOT EXISTS agent_callbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT TRUE,

  -- Trigger configuration
  trigger_config JSONB NOT NULL,

  -- Action configuration
  action_config JSONB NOT NULL,

  -- Rate limiting
  rate_limit JSONB,

  -- Stats
  trigger_count INTEGER DEFAULT 0,
  last_triggered_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_callbacks_agent ON agent_callbacks(agent_id);
CREATE INDEX IF NOT EXISTS idx_callbacks_enabled ON agent_callbacks(enabled) WHERE enabled = TRUE;

-- Agent Callback Executions (history of callback runs)
CREATE TABLE IF NOT EXISTS agent_callback_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  callback_id UUID NOT NULL REFERENCES agent_callbacks(id) ON DELETE CASCADE,
  signal_id UUID NOT NULL REFERENCES agent_signals(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,

  success BOOLEAN NOT NULL,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_ms INTEGER,
  response JSONB,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_executions_callback ON agent_callback_executions(callback_id);
CREATE INDEX IF NOT EXISTS idx_executions_agent ON agent_callback_executions(agent_id);
CREATE INDEX IF NOT EXISTS idx_executions_time ON agent_callback_executions(executed_at);
CREATE INDEX IF NOT EXISTS idx_executions_success ON agent_callback_executions(success);

-- Agent Triggered Actions (internal actions queued by callbacks)
CREATE TABLE IF NOT EXISTS agent_triggered_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  action_params JSONB DEFAULT '{}',
  trigger_signal_id UUID REFERENCES agent_signals(id) ON DELETE SET NULL,

  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'completed', 'failed', 'cancelled'
  )),

  result JSONB,
  error TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_triggered_agent ON agent_triggered_actions(agent_id);
CREATE INDEX IF NOT EXISTS idx_triggered_status ON agent_triggered_actions(status);
CREATE INDEX IF NOT EXISTS idx_triggered_pending ON agent_triggered_actions(agent_id, status) WHERE status = 'pending';

-- Escalations (from callback escalations)
CREATE TABLE IF NOT EXISTS escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  escalate_to TEXT NOT NULL CHECK (escalate_to IN ('council', 'human', 'supervisor')),
  reason TEXT NOT NULL,
  trigger_signal_id UUID REFERENCES agent_signals(id) ON DELETE SET NULL,

  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'assigned', 'in_review', 'resolved', 'dismissed'
  )),

  assigned_to UUID,
  resolution TEXT,
  resolution_data JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_escalations_agent ON escalations(agent_id);
CREATE INDEX IF NOT EXISTS idx_escalations_status ON escalations(status);
CREATE INDEX IF NOT EXISTS idx_escalations_pending ON escalations(escalate_to, status) WHERE status IN ('pending', 'assigned');

-- ============================================
-- Views for dashboards
-- ============================================

-- Signal activity summary
CREATE OR REPLACE VIEW signal_activity AS
SELECT
  DATE_TRUNC('hour', timestamp) as hour,
  category,
  priority,
  COUNT(*) as signal_count,
  COUNT(*) FILTER (WHERE action_required) as action_required_count
FROM agent_signals
WHERE timestamp > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', timestamp), category, priority
ORDER BY hour DESC;

-- Pending actions per agent
CREATE OR REPLACE VIEW agent_pending_actions AS
SELECT
  a.id as agent_id,
  a.name as agent_name,
  COUNT(s.id) FILTER (WHERE s.action_required AND ack.id IS NULL) as pending_signals,
  COUNT(ta.id) FILTER (WHERE ta.status = 'pending') as pending_actions,
  COUNT(e.id) FILTER (WHERE e.status IN ('pending', 'assigned')) as pending_escalations
FROM bots a
LEFT JOIN agent_signals s ON s.subject_id = a.id::text AND s.expires_at > NOW()
LEFT JOIN agent_signal_acknowledgments ack ON ack.agent_id = a.id AND ack.signal_id = s.id
LEFT JOIN agent_triggered_actions ta ON ta.agent_id = a.id
LEFT JOIN escalations e ON e.agent_id = a.id
GROUP BY a.id, a.name;

-- Callback performance
CREATE OR REPLACE VIEW callback_performance AS
SELECT
  c.id as callback_id,
  c.agent_id,
  c.name as callback_name,
  c.trigger_count,
  c.last_triggered_at,
  COUNT(e.id) as execution_count,
  COUNT(e.id) FILTER (WHERE e.success) as success_count,
  AVG(e.duration_ms) as avg_duration_ms
FROM agent_callbacks c
LEFT JOIN agent_callback_executions e ON e.callback_id = c.id
GROUP BY c.id, c.agent_id, c.name, c.trigger_count, c.last_triggered_at;

-- ============================================
-- RLS Policies
-- ============================================

ALTER TABLE agent_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_signal_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_signal_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_signal_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_signal_acknowledgments ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_callbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_callback_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_triggered_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalations ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role manages signals"
  ON agent_signals FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role manages subscriptions"
  ON agent_signal_subscriptions FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role manages deliveries"
  ON agent_signal_deliveries FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role manages queue"
  ON agent_signal_queue FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role manages acknowledgments"
  ON agent_signal_acknowledgments FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role manages callbacks"
  ON agent_callbacks FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role manages executions"
  ON agent_callback_executions FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role manages triggered actions"
  ON agent_triggered_actions FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role manages escalations"
  ON escalations FOR ALL
  USING (auth.role() = 'service_role');

-- Users can view signals for their agents
CREATE POLICY "Users view their agent signals"
  ON agent_signals FOR SELECT
  USING (
    subject_id IN (
      SELECT id::text FROM bots WHERE created_by = auth.uid()
    )
  );

-- Users can manage their agent subscriptions
CREATE POLICY "Users manage their agent subscriptions"
  ON agent_signal_subscriptions FOR ALL
  USING (
    agent_id IN (
      SELECT id FROM bots WHERE created_by = auth.uid()
    )
  );

-- Users can manage their agent callbacks
CREATE POLICY "Users manage their agent callbacks"
  ON agent_callbacks FOR ALL
  USING (
    agent_id IN (
      SELECT id FROM bots WHERE created_by = auth.uid()
    )
  );

-- Comments for documentation
COMMENT ON TABLE agent_signals IS 'System events that agents can subscribe to and receive';
COMMENT ON TABLE agent_signal_subscriptions IS 'Agent preferences for which signals to receive';
COMMENT ON TABLE agent_callbacks IS 'Automated trigger-response rules for agents';
COMMENT ON TABLE agent_triggered_actions IS 'Internal actions queued by callback triggers';
COMMENT ON TABLE escalations IS 'Issues escalated by agents to council/human review';
