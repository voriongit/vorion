-- Observer Anomalies Table
-- Story 5-3: Anomaly Detection (FR90)

CREATE TABLE IF NOT EXISTS observer_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  anomaly_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'low',
  description TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_anomalies_agent ON observer_anomalies (agent_id);
CREATE INDEX IF NOT EXISTS idx_anomalies_severity ON observer_anomalies (severity);
CREATE INDEX IF NOT EXISTS idx_anomalies_detected ON observer_anomalies (detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_anomalies_unresolved ON observer_anomalies (agent_id)
WHERE resolved_at IS NULL;

-- Enable RLS
ALTER TABLE observer_anomalies ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "anomalies_select"
ON observer_anomalies FOR SELECT
USING (
  agent_id IN (SELECT id FROM bots WHERE user_id = auth.uid())
);

CREATE POLICY "anomalies_insert"
ON observer_anomalies FOR INSERT
WITH CHECK (true);

CREATE POLICY "anomalies_update"
ON observer_anomalies FOR UPDATE
USING (
  agent_id IN (SELECT id FROM bots WHERE user_id = auth.uid())
);

COMMENT ON TABLE observer_anomalies IS 'Detected anomalies in agent behavior (Story 5-3)';
