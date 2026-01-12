-- AgentAnchor - Patent Security Features Migration
-- Patents 5, 6, 7, 8 database support

-- ============================================================================
-- Patent 5: Creator Trust (Transitive Trust Model)
-- ============================================================================

-- Agent-Creator trust binding with snapshot
CREATE TABLE IF NOT EXISTS agent_creator_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  creator_trust_at_creation INTEGER NOT NULL,
  creator_tier_at_creation TEXT NOT NULL,
  snapshot_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id)
);

CREATE INDEX idx_agent_creator_bindings_creator ON agent_creator_bindings(creator_id);
CREATE INDEX idx_agent_creator_bindings_agent ON agent_creator_bindings(agent_id);

-- Creator trust history for tracking
CREATE TABLE IF NOT EXISTS creator_trust_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  tier TEXT NOT NULL,
  fleet_size INTEGER NOT NULL DEFAULT 0,
  avg_fleet_trust INTEGER NOT NULL DEFAULT 0,
  signals JSONB NOT NULL DEFAULT '{}',
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_creator_trust_history_creator ON creator_trust_history(creator_id, calculated_at DESC);

-- ============================================================================
-- Patent 6: Cryptographic Agent Action Chain
-- ============================================================================

-- Individual action records with cryptographic binding
CREATE TABLE IF NOT EXISTS action_chain_records (
  id UUID PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  parameters JSONB NOT NULL DEFAULT '{}',
  context JSONB NOT NULL DEFAULT '{}',
  result JSONB,

  -- Cryptographic elements
  previous_hash TEXT NOT NULL,
  state_hash TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  timestamp_source TEXT NOT NULL DEFAULT 'internal',
  timestamp_tsa_response TEXT,
  agent_signature TEXT NOT NULL,
  observer_signatures JSONB NOT NULL DEFAULT '[]',

  -- Merkle tree position
  merkle_leaf_hash TEXT NOT NULL,
  merkle_proof JSONB,
  merkle_tree_id UUID,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_action_chain_agent ON action_chain_records(agent_id, timestamp DESC);
CREATE INDEX idx_action_chain_type ON action_chain_records(action_type);
CREATE INDEX idx_action_chain_merkle ON action_chain_records(merkle_tree_id);
CREATE INDEX idx_action_chain_hash ON action_chain_records(merkle_leaf_hash);
CREATE INDEX idx_action_chain_prev ON action_chain_records(previous_hash);

-- Merkle trees for action batches
CREATE TABLE IF NOT EXISTS merkle_trees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  root TEXT NOT NULL UNIQUE,
  leaves TEXT[] NOT NULL,
  height INTEGER NOT NULL,
  record_count INTEGER NOT NULL DEFAULT 0,

  -- Blockchain anchoring
  anchor_chain TEXT,  -- 'ethereum', 'polygon', 'internal'
  anchor_tx_hash TEXT,
  anchor_block INTEGER,
  anchor_verified BOOLEAN DEFAULT FALSE,
  anchor_timestamp TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_merkle_trees_root ON merkle_trees(root);
CREATE INDEX idx_merkle_trees_anchor ON merkle_trees(anchor_chain, anchor_verified);

-- ============================================================================
-- Patent 7: Adaptive Circuit Breaker
-- ============================================================================

-- Agent behavior baselines
CREATE TABLE IF NOT EXISTS agent_behavior_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  sample_count INTEGER NOT NULL DEFAULT 0,
  metrics_mean JSONB NOT NULL DEFAULT '{}',
  metrics_stddev JSONB NOT NULL DEFAULT '{}',
  metrics_min JSONB NOT NULL DEFAULT '{}',
  metrics_max JSONB NOT NULL DEFAULT '{}',
  temporal_patterns JSONB NOT NULL DEFAULT '[]',
  context_profiles JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id)
);

CREATE INDEX idx_behavior_baselines_agent ON agent_behavior_baselines(agent_id);

-- Circuit breaker state and history
CREATE TABLE IF NOT EXISTS circuit_breaker_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,  -- 'state_change', 'anomaly', 'termination'
  old_state TEXT,
  new_state TEXT,
  anomaly_score NUMERIC(4,3),
  anomaly_factors TEXT[],
  metrics JSONB,
  recovery_attempts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_circuit_breaker_agent ON circuit_breaker_events(agent_id, created_at DESC);
CREATE INDEX idx_circuit_breaker_type ON circuit_breaker_events(event_type);

-- Termination records for forensics
CREATE TABLE IF NOT EXISTS agent_termination_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  state TEXT NOT NULL,
  anomaly_score JSONB NOT NULL,
  metrics JSONB NOT NULL,
  state_snapshot JSONB NOT NULL DEFAULT '{}',
  reason TEXT NOT NULL,
  recovery_attempts INTEGER DEFAULT 0,
  credentials_revoked BOOLEAN DEFAULT TRUE,
  terminated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_termination_records_agent ON agent_termination_records(agent_id, terminated_at DESC);

-- ============================================================================
-- Patent 8: Prompt Injection Firewall
-- ============================================================================

-- Detected threats log
CREATE TABLE IF NOT EXISTS firewall_threat_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  session_id TEXT,
  threat_type TEXT NOT NULL,
  severity TEXT NOT NULL,  -- 'low', 'medium', 'high', 'critical'
  pattern TEXT NOT NULL,
  position INTEGER,
  description TEXT,
  input_hash TEXT NOT NULL,  -- Hash of input (not storing full input for privacy)
  blocked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_firewall_threats_agent ON firewall_threat_logs(agent_id, created_at DESC);
CREATE INDEX idx_firewall_threats_type ON firewall_threat_logs(threat_type);
CREATE INDEX idx_firewall_threats_severity ON firewall_threat_logs(severity, created_at DESC);

-- Canary violation alerts
CREATE TABLE IF NOT EXISTS canary_violation_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  canary_type TEXT NOT NULL,  -- 'phrase', 'behavior', 'honeypot'
  violation_details TEXT NOT NULL,
  output_hash TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'critical',
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by UUID REFERENCES profiles(id),
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_canary_alerts_agent ON canary_violation_alerts(agent_id, created_at DESC);
CREATE INDEX idx_canary_alerts_unack ON canary_violation_alerts(acknowledged) WHERE acknowledged = FALSE;

-- ============================================================================
-- Row Level Security Policies
-- ============================================================================

-- Agent creator bindings - owners can read their own
ALTER TABLE agent_creator_bindings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their agent bindings" ON agent_creator_bindings
  FOR SELECT USING (
    creator_id = auth.uid() OR
    agent_id IN (SELECT id FROM agents WHERE owner_id = auth.uid())
  );

-- Creator trust history - owners can read their own
ALTER TABLE creator_trust_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their trust history" ON creator_trust_history
  FOR SELECT USING (creator_id = auth.uid());

-- Action chain records - owners can view their agent's records
ALTER TABLE action_chain_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their agent actions" ON action_chain_records
  FOR SELECT USING (
    agent_id IN (SELECT id FROM agents WHERE owner_id = auth.uid())
  );

-- Firewall threat logs - owners can view
ALTER TABLE firewall_threat_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their threat logs" ON firewall_threat_logs
  FOR SELECT USING (
    agent_id IN (SELECT id FROM agents WHERE owner_id = auth.uid()) OR
    user_id = auth.uid()
  );

-- Canary alerts - owners can view and acknowledge
ALTER TABLE canary_violation_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their canary alerts" ON canary_violation_alerts
  FOR SELECT USING (
    agent_id IN (SELECT id FROM agents WHERE owner_id = auth.uid())
  );

CREATE POLICY "Users can acknowledge their canary alerts" ON canary_violation_alerts
  FOR UPDATE USING (
    agent_id IN (SELECT id FROM agents WHERE owner_id = auth.uid())
  );

-- ============================================================================
-- Functions
-- ============================================================================

-- Function to update creator trust on agent changes
CREATE OR REPLACE FUNCTION update_creator_trust_on_agent_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Queue a creator trust recalculation
  INSERT INTO creator_trust_history (creator_id, score, tier, fleet_size, avg_fleet_trust, signals, calculated_at)
  SELECT
    NEW.owner_id,
    0, -- Will be calculated by application
    'provisional',
    COUNT(*),
    COALESCE(AVG(trust_score), 0),
    '{}',
    NOW()
  FROM agents
  WHERE owner_id = NEW.owner_id AND status != 'archived';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for agent changes affecting creator trust
DROP TRIGGER IF EXISTS trigger_update_creator_trust ON agents;
CREATE TRIGGER trigger_update_creator_trust
  AFTER INSERT OR UPDATE OF trust_score, status ON agents
  FOR EACH ROW
  EXECUTE FUNCTION update_creator_trust_on_agent_change();

-- Function to verify action chain integrity
CREATE OR REPLACE FUNCTION verify_action_chain_integrity(p_agent_id UUID)
RETURNS TABLE (
  valid BOOLEAN,
  broken_at UUID,
  expected_prev TEXT,
  actual_prev TEXT
) AS $$
DECLARE
  prev_hash TEXT := REPEAT('0', 64);
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT id, previous_hash, merkle_leaf_hash
    FROM action_chain_records
    WHERE agent_id = p_agent_id
    ORDER BY timestamp ASC
  LOOP
    IF rec.previous_hash != prev_hash THEN
      RETURN QUERY SELECT FALSE, rec.id, prev_hash, rec.previous_hash;
      RETURN;
    END IF;
    prev_hash := rec.merkle_leaf_hash;
  END LOOP;

  RETURN QUERY SELECT TRUE, NULL::UUID, NULL::TEXT, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Summary
-- ============================================================================

COMMENT ON TABLE agent_creator_bindings IS 'Patent 5: Transitive Trust - Links agents to creators with trust snapshot';
COMMENT ON TABLE creator_trust_history IS 'Patent 5: Tracks creator trust over time';
COMMENT ON TABLE action_chain_records IS 'Patent 6: Cryptographic action chain with signatures and chain linkage';
COMMENT ON TABLE merkle_trees IS 'Patent 6: Merkle tree roots for action batches with blockchain anchoring';
COMMENT ON TABLE agent_behavior_baselines IS 'Patent 7: ML baselines for anomaly detection';
COMMENT ON TABLE circuit_breaker_events IS 'Patent 7: Circuit breaker state changes and anomaly events';
COMMENT ON TABLE agent_termination_records IS 'Patent 7: Forensic records when agents are terminated';
COMMENT ON TABLE firewall_threat_logs IS 'Patent 8: Detected prompt injection threats';
COMMENT ON TABLE canary_violation_alerts IS 'Patent 8: Canary detection alerts';
