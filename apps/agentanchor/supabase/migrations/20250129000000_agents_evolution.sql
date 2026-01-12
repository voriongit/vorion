-- Agent Evolution Migration
-- Evolves bots table to agents with full governance support
-- Part of Epic 2: Agent Creation & Academy

-- ============================================================================
-- 1. Add Governance Columns to Bots Table
-- ============================================================================

-- Trust and certification columns
ALTER TABLE bots ADD COLUMN IF NOT EXISTS trust_score INT DEFAULT 0
  CHECK (trust_score >= 0 AND trust_score <= 1000);
ALTER TABLE bots ADD COLUMN IF NOT EXISTS trust_tier VARCHAR(20) DEFAULT 'untrusted';
ALTER TABLE bots ADD COLUMN IF NOT EXISTS certification_level INT DEFAULT 0
  CHECK (certification_level >= 0 AND certification_level <= 5);

-- Status and lifecycle
ALTER TABLE bots ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft'
  CHECK (status IN ('draft', 'training', 'active', 'suspended', 'archived'));
ALTER TABLE bots ADD COLUMN IF NOT EXISTS maintenance_flag VARCHAR(20) DEFAULT 'author'
  CHECK (maintenance_flag IN ('author', 'delegated', 'platform', 'none'));

-- Marketplace columns
ALTER TABLE bots ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT FALSE;
ALTER TABLE bots ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5,2)
  CHECK (commission_rate IS NULL OR (commission_rate >= 0 AND commission_rate <= 100));
ALTER TABLE bots ADD COLUMN IF NOT EXISTS clone_price DECIMAL(10,2)
  CHECK (clone_price IS NULL OR clone_price >= 0);
ALTER TABLE bots ADD COLUMN IF NOT EXISTS enterprise_available BOOLEAN DEFAULT FALSE;

-- Agent specialization and traits
ALTER TABLE bots ADD COLUMN IF NOT EXISTS specialization VARCHAR(50);
ALTER TABLE bots ADD COLUMN IF NOT EXISTS personality_traits JSONB DEFAULT '[]'::jsonb;
ALTER TABLE bots ADD COLUMN IF NOT EXISTS capabilities JSONB DEFAULT '[]'::jsonb;

-- ============================================================================
-- 2. SKIPPED: View Alias for "agents"
-- NOTE: "agents" already exists as a TABLE in the database (not a view)
-- The original line "CREATE OR REPLACE VIEW agents AS SELECT * FROM bots;"
-- fails with error 42809 because PostgreSQL cannot replace a table with a view.
-- ============================================================================

-- ============================================================================
-- 3. Trust History Table
-- ============================================================================

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

-- ============================================================================
-- 4. Academy Curriculum Table
-- ============================================================================

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

-- ============================================================================
-- 5. Academy Enrollments Table
-- ============================================================================

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

-- ============================================================================
-- 6. Council Examinations Table
-- ============================================================================

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

-- ============================================================================
-- 7. Trust Tier Function
-- ============================================================================

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

-- ============================================================================
-- 8. Trust Score Update Trigger
-- ============================================================================

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

-- ============================================================================
-- 9. RLS Policies for New Tables
-- ============================================================================

-- Enable RLS
ALTER TABLE trust_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_curriculum ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE council_examinations ENABLE ROW LEVEL SECURITY;

-- Trust History Policies
CREATE POLICY trust_history_select_policy ON trust_history
  FOR SELECT USING (
    agent_id IN (SELECT id FROM bots WHERE user_id = auth.uid())
  );

CREATE POLICY trust_history_insert_policy ON trust_history
  FOR INSERT WITH CHECK (
    agent_id IN (SELECT id FROM bots WHERE user_id = auth.uid())
  );

-- Academy Curriculum Policies (everyone can view active curriculum)
CREATE POLICY academy_curriculum_select_policy ON academy_curriculum
  FOR SELECT USING (is_active = TRUE);

-- Academy Enrollments Policies
CREATE POLICY academy_enrollments_select_policy ON academy_enrollments
  FOR SELECT USING (
    agent_id IN (SELECT id FROM bots WHERE user_id = auth.uid())
  );

CREATE POLICY academy_enrollments_insert_policy ON academy_enrollments
  FOR INSERT WITH CHECK (
    agent_id IN (SELECT id FROM bots WHERE user_id = auth.uid())
  );

CREATE POLICY academy_enrollments_update_policy ON academy_enrollments
  FOR UPDATE USING (
    agent_id IN (SELECT id FROM bots WHERE user_id = auth.uid())
  );

-- Council Examinations Policies
CREATE POLICY council_examinations_select_policy ON council_examinations
  FOR SELECT USING (
    agent_id IN (SELECT id FROM bots WHERE user_id = auth.uid())
  );

CREATE POLICY council_examinations_insert_policy ON council_examinations
  FOR INSERT WITH CHECK (
    agent_id IN (SELECT id FROM bots WHERE user_id = auth.uid())
  );

-- ============================================================================
-- 10. Seed Initial Curriculum Data
-- ============================================================================

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
-- 11. Comments
-- ============================================================================

COMMENT ON TABLE trust_history IS 'Tracks all trust score changes with reasons and sources';
COMMENT ON TABLE academy_curriculum IS 'Available training courses for agents';
COMMENT ON TABLE academy_enrollments IS 'Agent enrollment in academy curriculum';
COMMENT ON TABLE council_examinations IS 'Council validation examinations for certification';
COMMENT ON FUNCTION calculate_trust_tier IS 'Returns trust tier name based on score';

-- ============================================================================
-- Migration Complete
-- ============================================================================
