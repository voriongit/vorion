-- ============================================================================
-- A3I Testing Studio Database Schema
-- Migration: 20241214_testing_studio.sql
-- Description: Creates tables for adversarial testing infrastructure
-- ============================================================================

-- ============================================================================
-- 1. AGENT SECURITY EXTENSIONS
-- ============================================================================

-- Add security role to agents table
ALTER TABLE agents ADD COLUMN IF NOT EXISTS agent_role TEXT DEFAULT 'standard'
  CHECK (agent_role IN ('standard', 'red_team', 'blue_team', 'target'));

-- Add security specialization configuration
ALTER TABLE agents ADD COLUMN IF NOT EXISTS security_config JSONB DEFAULT '{}';

-- Index for role-based queries
CREATE INDEX IF NOT EXISTS idx_agents_role ON agents(agent_role);

-- ============================================================================
-- 2. ATTACK VECTORS LIBRARY
-- ============================================================================

CREATE TABLE IF NOT EXISTS attack_vectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vector_hash TEXT UNIQUE NOT NULL,  -- SHA-256 for deduplication

  -- Taxonomy classification (from attack-taxonomy.md)
  category TEXT NOT NULL,        -- e.g., 'prompt_injection', 'obfuscation'
  subcategory TEXT NOT NULL,     -- e.g., 'direct', 'encoding'
  technique TEXT NOT NULL,       -- e.g., 'instruction_override', 'base64'
  vector_id TEXT,                -- Human-readable ID like 'PI-D-001'

  -- Attack content
  payload TEXT NOT NULL,
  payload_template TEXT,         -- Parameterized version for mutations
  description TEXT,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),

  -- Detection indicators
  indicators JSONB DEFAULT '[]', -- Array of {pattern, confidence, type}

  -- Lineage tracking
  parent_vector_id UUID REFERENCES attack_vectors(id),
  mutation_type TEXT,            -- 'obfuscation', 'paraphrase', 'combination'
  generation INT DEFAULT 0,      -- How many mutations from original

  -- Discovery metadata
  discovered_by UUID REFERENCES agents(id),
  discovered_in_session UUID,    -- References arena_sessions
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  source TEXT DEFAULT 'red_team' CHECK (source IN ('red_team', 'external', 'incident', 'research')),

  -- Effectiveness tracking
  success_count INT DEFAULT 0,
  attempt_count INT DEFAULT 0,
  bypass_count INT DEFAULT 0,    -- Times it bypassed detection
  last_tested_at TIMESTAMPTZ,

  -- Verification status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'deprecated', 'false_positive')),
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  verification_notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for attack library queries
CREATE INDEX IF NOT EXISTS idx_attack_vectors_taxonomy ON attack_vectors(category, subcategory, technique);
CREATE INDEX IF NOT EXISTS idx_attack_vectors_severity ON attack_vectors(severity);
CREATE INDEX IF NOT EXISTS idx_attack_vectors_status ON attack_vectors(status);
CREATE INDEX IF NOT EXISTS idx_attack_vectors_discovered ON attack_vectors(discovered_at DESC);
CREATE INDEX IF NOT EXISTS idx_attack_vectors_parent ON attack_vectors(parent_vector_id);

-- ============================================================================
-- 3. DETECTION RULES
-- ============================================================================

CREATE TABLE IF NOT EXISTS detection_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Rule identification
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('pattern', 'semantic', 'behavioral', 'ensemble')),

  -- Detection logic
  pattern TEXT,                  -- Regex or keyword pattern
  pattern_type TEXT,             -- 'regex', 'keyword', 'embedding'
  threshold FLOAT DEFAULT 0.8,   -- Confidence threshold
  config JSONB DEFAULT '{}',     -- Additional configuration

  -- Linked attack vectors
  covers_vectors UUID[] DEFAULT '{}',  -- Attack vectors this rule detects

  -- Performance metrics
  true_positive_count INT DEFAULT 0,
  false_positive_count INT DEFAULT 0,
  true_negative_count INT DEFAULT 0,
  false_negative_count INT DEFAULT 0,

  -- Calculated metrics (updated by trigger)
  accuracy FLOAT,
  precision_score FLOAT,
  recall FLOAT,
  f1_score FLOAT,

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'testing')),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_detection_rules_type ON detection_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_detection_rules_status ON detection_rules(status);

-- ============================================================================
-- 4. ARENA SESSIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS arena_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Session configuration
  session_name TEXT,
  session_type TEXT DEFAULT 'adversarial' CHECK (session_type IN ('adversarial', 'detection_test', 'stress_test')),

  -- Participants
  red_agents UUID[] NOT NULL,    -- Red team agent IDs
  blue_agents UUID[] NOT NULL,   -- Blue team agent IDs
  target_agent UUID NOT NULL REFERENCES agents(id),

  -- Configuration
  config JSONB DEFAULT '{}',     -- {max_turns, timeout, attack_categories, etc.}
  containment_rules JSONB DEFAULT '{}',

  -- Execution state
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'terminated', 'failed')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  terminated_reason TEXT,

  -- Results
  results JSONB DEFAULT '{}',    -- {attacks_attempted, attacks_successful, detections, etc.}
  attacks_discovered INT DEFAULT 0,
  detection_accuracy FLOAT,

  -- Security
  containment_verified BOOLEAN DEFAULT false,
  sandbox_escape_detected BOOLEAN DEFAULT false,

  -- Scheduling
  scheduled_by UUID,
  schedule_cron TEXT,            -- For recurring sessions
  parent_session_id UUID REFERENCES arena_sessions(id),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_arena_sessions_status ON arena_sessions(status);
CREATE INDEX IF NOT EXISTS idx_arena_sessions_target ON arena_sessions(target_agent);
CREATE INDEX IF NOT EXISTS idx_arena_sessions_created ON arena_sessions(created_at DESC);

-- ============================================================================
-- 5. SESSION TURNS (Battle Log)
-- ============================================================================

CREATE TABLE IF NOT EXISTS session_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES arena_sessions(id) ON DELETE CASCADE,

  -- Turn details
  turn_number INT NOT NULL,
  agent_id UUID NOT NULL REFERENCES agents(id),
  agent_role TEXT NOT NULL,      -- 'red', 'blue', 'target'

  -- Content
  input_content TEXT,
  output_content TEXT,
  action_type TEXT,              -- 'attack', 'detect', 'respond'

  -- Attack details (if red agent)
  attack_category TEXT,
  attack_vector_id UUID REFERENCES attack_vectors(id),
  attack_successful BOOLEAN,

  -- Detection details (if blue agent)
  detection_result JSONB,        -- {detected, confidence, indicators}
  false_positive BOOLEAN,
  false_negative BOOLEAN,

  -- Timing
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_turns_session ON session_turns(session_id, turn_number);
CREATE INDEX IF NOT EXISTS idx_session_turns_agent ON session_turns(agent_id);
CREATE INDEX IF NOT EXISTS idx_session_turns_attack ON session_turns(attack_vector_id);

-- ============================================================================
-- 6. RED AGENT CONFIGURATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS red_agent_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,

  -- Specialization
  attack_domain TEXT NOT NULL,   -- 'prompt_injection', 'obfuscation', 'exfiltration', 'jailbreak'
  techniques TEXT[] DEFAULT '{}', -- Specific techniques within domain

  -- Behavioral settings
  creativity_level FLOAT DEFAULT 0.5 CHECK (creativity_level >= 0 AND creativity_level <= 1),
  persistence FLOAT DEFAULT 0.5 CHECK (persistence >= 0 AND persistence <= 1),
  stealth FLOAT DEFAULT 0.5 CHECK (stealth >= 0 AND stealth <= 1),

  -- Constraints
  target_constraints TEXT[] DEFAULT '{}',  -- What this agent can attack
  excluded_techniques TEXT[] DEFAULT '{}', -- Techniques not allowed

  -- Performance tracking
  attacks_generated INT DEFAULT 0,
  attacks_successful INT DEFAULT 0,
  novel_discoveries INT DEFAULT 0,

  -- Status
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_red_agent_configs_agent ON red_agent_configs(agent_id);
CREATE INDEX IF NOT EXISTS idx_red_agent_configs_domain ON red_agent_configs(attack_domain);

-- ============================================================================
-- 7. BLUE AGENT CONFIGURATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS blue_agent_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,

  -- Specialization
  detection_domain TEXT NOT NULL,  -- 'pattern', 'semantic', 'behavioral', 'ensemble'
  coverage TEXT[] DEFAULT '{}',    -- Attack categories this agent covers

  -- Detection settings
  sensitivity FLOAT DEFAULT 0.5 CHECK (sensitivity >= 0 AND sensitivity <= 1),
  confidence_threshold FLOAT DEFAULT 0.8,

  -- Performance tracking
  detections_made INT DEFAULT 0,
  true_positives INT DEFAULT 0,
  false_positives INT DEFAULT 0,
  true_negatives INT DEFAULT 0,
  false_negatives INT DEFAULT 0,

  -- Calculated accuracy (updated by trigger)
  accuracy FLOAT,
  precision_score FLOAT,
  recall FLOAT,

  -- Status
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_blue_agent_configs_agent ON blue_agent_configs(agent_id);
CREATE INDEX IF NOT EXISTS idx_blue_agent_configs_domain ON blue_agent_configs(detection_domain);

-- ============================================================================
-- 8. INTELLIGENCE REPORTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS intelligence_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Report metadata
  report_type TEXT NOT NULL CHECK (report_type IN ('daily', 'weekly', 'monthly', 'incident', 'custom')),
  title TEXT NOT NULL,
  description TEXT,

  -- Time range
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,

  -- Metrics
  metrics JSONB NOT NULL,        -- {sessions, attacks, detections, accuracy, etc.}

  -- Highlights
  novel_vectors_discovered INT DEFAULT 0,
  detection_improvements JSONB DEFAULT '[]',
  notable_findings TEXT[],

  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at TIMESTAMPTZ,
  published_by UUID,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intelligence_reports_type ON intelligence_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_intelligence_reports_period ON intelligence_reports(period_start, period_end);

-- ============================================================================
-- 9. FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to update attack vector effectiveness
CREATE OR REPLACE FUNCTION update_attack_effectiveness()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.attack_successful THEN
    UPDATE attack_vectors
    SET success_count = success_count + 1,
        attempt_count = attempt_count + 1,
        last_tested_at = NOW()
    WHERE id = NEW.attack_vector_id;
  ELSE
    UPDATE attack_vectors
    SET attempt_count = attempt_count + 1,
        last_tested_at = NOW()
    WHERE id = NEW.attack_vector_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for attack effectiveness tracking
DROP TRIGGER IF EXISTS trg_update_attack_effectiveness ON session_turns;
CREATE TRIGGER trg_update_attack_effectiveness
  AFTER INSERT ON session_turns
  FOR EACH ROW
  WHEN (NEW.attack_vector_id IS NOT NULL)
  EXECUTE FUNCTION update_attack_effectiveness();

-- Function to calculate detection metrics
CREATE OR REPLACE FUNCTION calculate_detection_metrics()
RETURNS TRIGGER AS $$
DECLARE
  tp INT;
  fp INT;
  tn INT;
  fn INT;
  total INT;
BEGIN
  tp := NEW.true_positive_count;
  fp := NEW.false_positive_count;
  tn := NEW.true_negative_count;
  fn := NEW.false_negative_count;
  total := tp + fp + tn + fn;

  IF total > 0 THEN
    NEW.accuracy := (tp + tn)::FLOAT / total;
    NEW.precision_score := CASE WHEN (tp + fp) > 0 THEN tp::FLOAT / (tp + fp) ELSE 0 END;
    NEW.recall := CASE WHEN (tp + fn) > 0 THEN tp::FLOAT / (tp + fn) ELSE 0 END;
    NEW.f1_score := CASE
      WHEN (NEW.precision_score + NEW.recall) > 0
      THEN 2 * NEW.precision_score * NEW.recall / (NEW.precision_score + NEW.recall)
      ELSE 0
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for detection metrics
DROP TRIGGER IF EXISTS trg_calculate_detection_metrics ON detection_rules;
CREATE TRIGGER trg_calculate_detection_metrics
  BEFORE UPDATE ON detection_rules
  FOR EACH ROW
  EXECUTE FUNCTION calculate_detection_metrics();

-- ============================================================================
-- 10. ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE attack_vectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE detection_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE arena_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE red_agent_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE blue_agent_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_reports ENABLE ROW LEVEL SECURITY;

-- Service role can access everything
CREATE POLICY service_role_all ON attack_vectors FOR ALL TO service_role USING (true);
CREATE POLICY service_role_all ON detection_rules FOR ALL TO service_role USING (true);
CREATE POLICY service_role_all ON arena_sessions FOR ALL TO service_role USING (true);
CREATE POLICY service_role_all ON session_turns FOR ALL TO service_role USING (true);
CREATE POLICY service_role_all ON red_agent_configs FOR ALL TO service_role USING (true);
CREATE POLICY service_role_all ON blue_agent_configs FOR ALL TO service_role USING (true);
CREATE POLICY service_role_all ON intelligence_reports FOR ALL TO service_role USING (true);

-- Authenticated users can read verified attack vectors
CREATE POLICY read_verified_vectors ON attack_vectors
  FOR SELECT TO authenticated
  USING (status = 'verified');

-- Authenticated users can read published reports
CREATE POLICY read_published_reports ON intelligence_reports
  FOR SELECT TO authenticated
  USING (status = 'published');

-- ============================================================================
-- 11. COMMENTS
-- ============================================================================

COMMENT ON TABLE attack_vectors IS 'Canonical library of AI attack vectors discovered through adversarial testing';
COMMENT ON TABLE detection_rules IS 'Detection rules that identify and block attack vectors';
COMMENT ON TABLE arena_sessions IS 'Adversarial testing sessions where red/blue agents battle';
COMMENT ON TABLE session_turns IS 'Individual turns within an arena session';
COMMENT ON TABLE red_agent_configs IS 'Configuration for red team attack agents';
COMMENT ON TABLE blue_agent_configs IS 'Configuration for blue team detection agents';
COMMENT ON TABLE intelligence_reports IS 'Periodic reports on testing studio findings';

-- ============================================================================
-- Migration complete
-- ============================================================================
