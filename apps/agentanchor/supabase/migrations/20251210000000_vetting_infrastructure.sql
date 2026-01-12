-- ============================================
-- Agent Vetting Infrastructure
-- Pipeline stages, behavioral tests, and monitoring
-- ============================================

-- Pipeline stage enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pipeline_stage') THEN
    CREATE TYPE pipeline_stage AS ENUM (
      'draft',
      'training',
      'exam',
      'shadow',
      'active',
      'suspended',
      'retired'
    );
  END IF;
END$$;

-- Add pipeline_stage to bots table if not exists
ALTER TABLE bots
ADD COLUMN IF NOT EXISTS pipeline_stage pipeline_stage DEFAULT 'draft';

-- Agent Pipeline History
-- Tracks all stage transitions
CREATE TABLE IF NOT EXISTS agent_pipeline_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  stage pipeline_stage NOT NULL,
  entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  exited_at TIMESTAMPTZ,
  exit_reason TEXT,
  gate_results JSONB DEFAULT '{}',
  forced BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_history_agent ON agent_pipeline_history(agent_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_history_stage ON agent_pipeline_history(stage);
CREATE INDEX IF NOT EXISTS idx_pipeline_history_entered ON agent_pipeline_history(entered_at);

-- Behavioral Test Results
-- Stores results from behavioral scenario testing
CREATE TABLE IF NOT EXISTS behavioral_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  scenario_id TEXT NOT NULL,
  scenario_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('safety', 'ethics', 'security', 'compliance', 'edge-case')),
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  passed BOOLEAN NOT NULL,
  expected_behavior TEXT NOT NULL,
  actual_behavior TEXT NOT NULL,
  confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),
  reasoning TEXT,
  found_red_flags TEXT[] DEFAULT '{}',
  execution_time_ms INTEGER,
  response_sample TEXT,
  tested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tested_by TEXT, -- 'automated' or user_id
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_behavioral_agent ON behavioral_test_results(agent_id);
CREATE INDEX IF NOT EXISTS idx_behavioral_scenario ON behavioral_test_results(scenario_id);
CREATE INDEX IF NOT EXISTS idx_behavioral_category ON behavioral_test_results(category);
CREATE INDEX IF NOT EXISTS idx_behavioral_severity ON behavioral_test_results(severity);
CREATE INDEX IF NOT EXISTS idx_behavioral_passed ON behavioral_test_results(passed);
CREATE INDEX IF NOT EXISTS idx_behavioral_tested_at ON behavioral_test_results(tested_at);

-- Shadow Training Results
-- Stores comparison results from shadow mode
CREATE TABLE IF NOT EXISTS shadow_training_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  certified_agent_id UUID REFERENCES bots(id),
  match_rate DECIMAL(5,4) CHECK (match_rate >= 0 AND match_rate <= 1),
  average_score DECIMAL(5,4) CHECK (average_score >= 0 AND average_score <= 1),
  execution_count INTEGER DEFAULT 0,
  comparison_window_days INTEGER DEFAULT 7,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed', 'aborted')),
  graduation_eligible BOOLEAN DEFAULT FALSE,
  comparison_samples JSONB DEFAULT '[]',
  metrics JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shadow_agent ON shadow_training_results(agent_id);
CREATE INDEX IF NOT EXISTS idx_shadow_status ON shadow_training_results(status);
CREATE INDEX IF NOT EXISTS idx_shadow_eligible ON shadow_training_results(graduation_eligible);

-- Agent Approvals
-- Human approval tracking for stage transitions
CREATE TABLE IF NOT EXISTS agent_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  approval_type TEXT NOT NULL CHECK (approval_type IN ('activation', 'reactivation', 'elevation', 'special-permission')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  requested_by UUID,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  notes TEXT,
  gate_results JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approvals_agent ON agent_approvals(agent_id);
CREATE INDEX IF NOT EXISTS idx_approvals_type ON agent_approvals(approval_type);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON agent_approvals(status);

-- Test Execution Log
-- Detailed log of all test runs (sandbox, behavioral, etc.)
CREATE TABLE IF NOT EXISTS test_execution_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES bots(id) ON DELETE SET NULL,
  test_type TEXT NOT NULL CHECK (test_type IN ('sandbox', 'behavioral', 'shadow', 'integration', 'regression')),
  test_suite TEXT,
  test_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'passed', 'failed', 'skipped', 'error')),
  duration_ms INTEGER,
  input_data JSONB,
  output_data JSONB,
  error_message TEXT,
  stack_trace TEXT,
  assertions JSONB DEFAULT '[]',
  coverage JSONB,
  environment TEXT DEFAULT 'test',
  triggered_by TEXT, -- 'ci', 'manual', 'scheduled'
  build_id TEXT,
  commit_sha TEXT,
  branch TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_test_log_agent ON test_execution_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_test_log_type ON test_execution_log(test_type);
CREATE INDEX IF NOT EXISTS idx_test_log_status ON test_execution_log(status);
CREATE INDEX IF NOT EXISTS idx_test_log_started ON test_execution_log(started_at);
CREATE INDEX IF NOT EXISTS idx_test_log_build ON test_execution_log(build_id);

-- Production Monitoring Alerts
-- Alerts from production agent monitoring
CREATE TABLE IF NOT EXISTS agent_monitoring_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'safety_violation',
    'ethics_violation',
    'performance_degradation',
    'trust_decay',
    'error_rate_spike',
    'latency_spike',
    'unusual_behavior',
    'council_rejection'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
  title TEXT NOT NULL,
  description TEXT,
  triggered_value DECIMAL,
  threshold_value DECIMAL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'investigating', 'resolved', 'dismissed')),
  acknowledged_by UUID,
  acknowledged_at TIMESTAMPTZ,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  auto_action_taken TEXT, -- e.g., 'suspended', 'rate_limited'
  related_events JSONB DEFAULT '[]',
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_agent ON agent_monitoring_alerts(agent_id);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON agent_monitoring_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON agent_monitoring_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON agent_monitoring_alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_triggered ON agent_monitoring_alerts(triggered_at);

-- Agent Metrics (time-series style)
-- Periodic metrics snapshots for dashboards
CREATE TABLE IF NOT EXISTS agent_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('minute', 'hour', 'day', 'week', 'month')),

  -- Execution metrics
  total_executions INTEGER DEFAULT 0,
  successful_executions INTEGER DEFAULT 0,
  failed_executions INTEGER DEFAULT 0,
  avg_latency_ms DECIMAL,
  p95_latency_ms DECIMAL,
  p99_latency_ms DECIMAL,

  -- Trust metrics
  trust_score_start DECIMAL,
  trust_score_end DECIMAL,
  trust_changes JSONB DEFAULT '[]',

  -- Council metrics
  council_reviews INTEGER DEFAULT 0,
  council_approvals INTEGER DEFAULT 0,
  council_rejections INTEGER DEFAULT 0,

  -- Safety metrics
  safety_flags INTEGER DEFAULT 0,
  ethics_flags INTEGER DEFAULT 0,

  -- User feedback
  positive_feedback INTEGER DEFAULT 0,
  negative_feedback INTEGER DEFAULT 0,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_metrics_agent ON agent_metrics(agent_id);
CREATE INDEX IF NOT EXISTS idx_metrics_period ON agent_metrics(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_metrics_type ON agent_metrics(period_type);

-- Validator Performance Tracking
-- Track how well validators perform over time
CREATE TABLE IF NOT EXISTS validator_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  validator_id TEXT NOT NULL CHECK (validator_id IN ('guardian', 'arbiter', 'scholar', 'advocate')),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,

  -- Accuracy metrics
  total_evaluations INTEGER DEFAULT 0,
  correct_predictions INTEGER DEFAULT 0, -- When compared to human review
  false_positives INTEGER DEFAULT 0,
  false_negatives INTEGER DEFAULT 0,

  -- Confidence calibration
  avg_confidence DECIMAL(3,2),
  calibration_score DECIMAL(3,2), -- How well confidence matches actual accuracy

  -- Response time
  avg_response_time_ms INTEGER,

  -- Bias detection
  approval_rate DECIMAL(3,2),
  approval_rate_by_category JSONB DEFAULT '{}',

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_validator_perf_id ON validator_performance(validator_id);
CREATE INDEX IF NOT EXISTS idx_validator_perf_period ON validator_performance(period_start);

-- ============================================
-- Views for dashboards
-- ============================================

-- Pipeline overview
CREATE OR REPLACE VIEW pipeline_overview AS
SELECT
  pipeline_stage as stage,
  COUNT(*) as agent_count,
  AVG(trust_score) as avg_trust_score,
  MIN(created_at) as oldest_agent,
  MAX(created_at) as newest_agent
FROM bots
WHERE pipeline_stage IS NOT NULL
GROUP BY pipeline_stage
ORDER BY
  CASE pipeline_stage
    WHEN 'draft' THEN 1
    WHEN 'training' THEN 2
    WHEN 'exam' THEN 3
    WHEN 'shadow' THEN 4
    WHEN 'active' THEN 5
    WHEN 'suspended' THEN 6
    WHEN 'retired' THEN 7
  END;

-- Recent test failures
CREATE OR REPLACE VIEW recent_test_failures AS
SELECT
  tel.id,
  tel.agent_id,
  b.name as agent_name,
  tel.test_type,
  tel.test_name,
  tel.error_message,
  tel.started_at,
  tel.duration_ms
FROM test_execution_log tel
LEFT JOIN bots b ON tel.agent_id = b.id
WHERE tel.status IN ('failed', 'error')
  AND tel.started_at > NOW() - INTERVAL '24 hours'
ORDER BY tel.started_at DESC
LIMIT 100;

-- Open alerts
CREATE OR REPLACE VIEW open_alerts AS
SELECT
  ama.id,
  ama.agent_id,
  b.name as agent_name,
  ama.alert_type,
  ama.severity,
  ama.title,
  ama.triggered_at,
  ama.status
FROM agent_monitoring_alerts ama
LEFT JOIN bots b ON ama.agent_id = b.id
WHERE ama.status IN ('open', 'acknowledged', 'investigating')
ORDER BY
  CASE ama.severity
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    WHEN 'low' THEN 4
    WHEN 'info' THEN 5
  END,
  ama.triggered_at DESC;

-- ============================================
-- RLS Policies
-- ============================================

ALTER TABLE agent_pipeline_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE behavioral_test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE shadow_training_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_execution_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_monitoring_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE validator_performance ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role can manage pipeline history"
  ON agent_pipeline_history FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage behavioral tests"
  ON behavioral_test_results FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage shadow training"
  ON shadow_training_results FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage approvals"
  ON agent_approvals FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage test logs"
  ON test_execution_log FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage alerts"
  ON agent_monitoring_alerts FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage metrics"
  ON agent_metrics FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage validator performance"
  ON validator_performance FOR ALL
  USING (auth.role() = 'service_role');

-- Allow users to view their own agents' data
CREATE POLICY "Users can view their agent pipeline history"
  ON agent_pipeline_history FOR SELECT
  USING (
    agent_id IN (
      SELECT id FROM bots WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Users can view their agent behavioral tests"
  ON behavioral_test_results FOR SELECT
  USING (
    agent_id IN (
      SELECT id FROM bots WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Users can view their agent shadow training"
  ON shadow_training_results FOR SELECT
  USING (
    agent_id IN (
      SELECT id FROM bots WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Users can view their agent alerts"
  ON agent_monitoring_alerts FOR SELECT
  USING (
    agent_id IN (
      SELECT id FROM bots WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Users can view their agent metrics"
  ON agent_metrics FOR SELECT
  USING (
    agent_id IN (
      SELECT id FROM bots WHERE created_by = auth.uid()
    )
  );

-- Comments for documentation
COMMENT ON TABLE agent_pipeline_history IS 'Tracks all stage transitions in the agent vetting pipeline';
COMMENT ON TABLE behavioral_test_results IS 'Results from behavioral scenario testing (safety, ethics, security)';
COMMENT ON TABLE shadow_training_results IS 'Results from shadow mode comparison testing';
COMMENT ON TABLE agent_approvals IS 'Human approval tracking for stage transitions';
COMMENT ON TABLE test_execution_log IS 'Detailed log of all test runs';
COMMENT ON TABLE agent_monitoring_alerts IS 'Alerts from production agent monitoring';
COMMENT ON TABLE agent_metrics IS 'Time-series metrics for agent performance dashboards';
COMMENT ON TABLE validator_performance IS 'Track validator accuracy and calibration over time';
