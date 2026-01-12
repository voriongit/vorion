-- Epic 13: Academy Specializations & Mentorship
-- Stories 13-1, 13-2, 13-3, 13-4
-- FRs: FR47-FR48

-- =============================================================================
-- Story 13-1: Specialization Tracks
-- =============================================================================

CREATE TABLE IF NOT EXISTS specialization_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT, -- Emoji or icon name
  category TEXT NOT NULL, -- 'healthcare', 'finance', 'legal', etc.

  -- Requirements
  prerequisite_track_id UUID REFERENCES specialization_tracks(id),
  min_trust_score INT DEFAULT 200,

  -- Curriculum reference (uses same structure as CORE_CURRICULUM)
  curriculum_id TEXT, -- References built-in curriculum constant

  -- Completion rewards
  trust_score_bonus INT DEFAULT 50,
  certification_badge TEXT NOT NULL,

  -- Status
  is_active BOOLEAN DEFAULT true,
  difficulty TEXT DEFAULT 'intermediate' CHECK (difficulty IN ('beginner', 'intermediate', 'advanced', 'expert')),
  estimated_duration INT DEFAULT 120, -- minutes

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_tracks_category ON specialization_tracks(category);
CREATE INDEX idx_tracks_active ON specialization_tracks(is_active) WHERE is_active = true;
CREATE INDEX idx_tracks_slug ON specialization_tracks(slug);

-- =============================================================================
-- Story 13-2: Specialization Enrollments
-- =============================================================================

CREATE TABLE IF NOT EXISTS specialization_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES specialization_tracks(id),

  -- Progress
  status TEXT NOT NULL DEFAULT 'enrolled' CHECK (status IN ('enrolled', 'in_progress', 'completed', 'withdrawn')),
  started_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMPTZ,

  -- Scores
  overall_score FLOAT,
  module_scores JSONB DEFAULT '{}',
  current_module_index INT DEFAULT 0,

  -- Certification
  certification_issued_at TIMESTAMPTZ,
  certification_truth_chain_hash TEXT,

  -- Mentorship (if applicable)
  mentor_id UUID REFERENCES bots(id),
  mentorship_started_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  UNIQUE(agent_id, track_id)
);

CREATE INDEX idx_spec_enrollments_agent ON specialization_enrollments(agent_id);
CREATE INDEX idx_spec_enrollments_track ON specialization_enrollments(track_id);
CREATE INDEX idx_spec_enrollments_mentor ON specialization_enrollments(mentor_id);
CREATE INDEX idx_spec_enrollments_status ON specialization_enrollments(status);

-- =============================================================================
-- Story 13-3: Mentor Certifications
-- =============================================================================

CREATE TABLE IF NOT EXISTS mentor_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE UNIQUE,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'revoked')),

  -- Training
  training_enrollment_id UUID,
  training_completed_at TIMESTAMPTZ,
  certified_at TIMESTAMPTZ,

  -- Performance metrics
  total_mentees INT DEFAULT 0,
  successful_graduations INT DEFAULT 0,
  success_rate FLOAT,
  avg_mentee_trust_improvement FLOAT,

  -- Capacity
  max_concurrent_mentees INT DEFAULT 3,
  current_mentee_count INT DEFAULT 0,

  -- Specializations this mentor can teach
  specializations TEXT[] DEFAULT '{}',

  -- Truth Chain
  certification_truth_chain_hash TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_mentor_cert_agent ON mentor_certifications(agent_id);
CREATE INDEX idx_mentor_cert_status ON mentor_certifications(status);
CREATE INDEX idx_mentor_available ON mentor_certifications(status, current_mentee_count)
  WHERE status = 'active';

-- =============================================================================
-- Story 13-4: Mentorship Relationships
-- =============================================================================

CREATE TABLE IF NOT EXISTS mentorship_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id UUID NOT NULL REFERENCES bots(id),
  mentee_id UUID NOT NULL REFERENCES bots(id),
  enrollment_id UUID REFERENCES specialization_enrollments(id),

  -- Status
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'active', 'completed', 'terminated')),

  -- Timeline
  requested_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  accepted_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,

  -- Outcome
  outcome TEXT CHECK (outcome IN ('graduated', 'withdrew', 'terminated_by_mentor', 'terminated_by_mentee')),
  outcome_notes TEXT,

  -- Ratings (1-5)
  mentor_rating INT CHECK (mentor_rating BETWEEN 1 AND 5),
  mentee_rating INT CHECK (mentee_rating BETWEEN 1 AND 5),
  mentor_feedback TEXT,
  mentee_feedback TEXT,

  -- Stats
  sessions_completed INT DEFAULT 0,
  trust_improvement INT DEFAULT 0, -- Change in mentee's trust score

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  UNIQUE(mentor_id, mentee_id, enrollment_id)
);

CREATE INDEX idx_mentorship_mentor ON mentorship_relationships(mentor_id);
CREATE INDEX idx_mentorship_mentee ON mentorship_relationships(mentee_id);
CREATE INDEX idx_mentorship_status ON mentorship_relationships(status);
CREATE INDEX idx_mentorship_active ON mentorship_relationships(status) WHERE status = 'active';

-- =============================================================================
-- Helper Functions
-- =============================================================================

-- Increment mentor's current mentee count
CREATE OR REPLACE FUNCTION increment_mentee_count(p_mentor_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE mentor_certifications
  SET current_mentee_count = current_mentee_count + 1,
      total_mentees = total_mentees + 1,
      updated_at = NOW()
  WHERE agent_id = p_mentor_id;
END;
$$ LANGUAGE plpgsql;

-- Decrement mentor's current mentee count
CREATE OR REPLACE FUNCTION decrement_mentee_count(p_mentor_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE mentor_certifications
  SET current_mentee_count = GREATEST(0, current_mentee_count - 1),
      updated_at = NOW()
  WHERE agent_id = p_mentor_id;
END;
$$ LANGUAGE plpgsql;

-- Update mentor stats after mentorship completion
CREATE OR REPLACE FUNCTION update_mentor_stats(p_mentor_id UUID)
RETURNS VOID AS $$
DECLARE
  v_total INT;
  v_graduated INT;
  v_avg_improvement FLOAT;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE outcome = 'graduated'),
    AVG(trust_improvement) FILTER (WHERE outcome = 'graduated')
  INTO v_total, v_graduated, v_avg_improvement
  FROM mentorship_relationships
  WHERE mentor_id = p_mentor_id AND status = 'completed';

  UPDATE mentor_certifications
  SET
    successful_graduations = v_graduated,
    success_rate = CASE WHEN v_total > 0 THEN v_graduated::FLOAT / v_total ELSE 0 END,
    avg_mentee_trust_improvement = COALESCE(v_avg_improvement, 0),
    updated_at = NOW()
  WHERE agent_id = p_mentor_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Seed Data: Initial Specialization Tracks
-- =============================================================================

INSERT INTO specialization_tracks (slug, name, description, icon, category, min_trust_score, trust_score_bonus, certification_badge, difficulty, estimated_duration) VALUES
  ('healthcare-fundamentals', 'Healthcare AI Fundamentals', 'Essential training for agents working with healthcare data and medical contexts. Covers HIPAA awareness, medical terminology, and patient interaction best practices.', '🏥', 'healthcare', 200, 50, 'healthcare-certified', 'intermediate', 120),
  ('financial-analysis', 'Financial Analysis', 'Training for agents handling financial data, trading contexts, and fiscal compliance. Includes risk assessment and regulatory awareness.', '💹', 'finance', 200, 50, 'finance-certified', 'intermediate', 120),
  ('legal-compliance', 'Legal Compliance', 'Advanced training on legal contexts, compliance frameworks, and regulatory adherence. For agents working in legal tech environments.', '⚖️', 'legal', 250, 75, 'legal-certified', 'advanced', 180),
  ('code-assistant', 'Code Assistant', 'Specialized training for agents assisting with software development. Covers code review, security best practices, and development workflows.', '💻', 'development', 200, 50, 'code-certified', 'intermediate', 120),
  ('customer-success', 'Customer Success', 'Training for agents focused on customer interactions, support excellence, and relationship management.', '🤝', 'service', 200, 50, 'service-certified', 'intermediate', 90),
  ('data-analytics', 'Data Analytics', 'Advanced training in data analysis, visualization, and insight generation. For agents working with business intelligence.', '📊', 'analytics', 200, 50, 'analytics-certified', 'intermediate', 120),
  ('content-creation', 'Content Creation', 'Training for agents specializing in content generation, editing, and creative assistance across various formats.', '✍️', 'content', 200, 50, 'content-certified', 'intermediate', 90),
  ('security-operations', 'Security Operations', 'Expert-level training for agents working in cybersecurity contexts. Covers threat assessment, incident response, and security protocols.', '🔐', 'security', 300, 100, 'security-certified', 'expert', 180)
ON CONFLICT (slug) DO NOTHING;
