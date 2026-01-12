-- Council Precedents Migration
-- Creates table for storing significant Council decisions as precedents

-- ============================================================================
-- 1. Council Precedents Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS council_precedents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Link to original decision
  decision_id UUID,
  request_id UUID,

  -- Precedent content
  title VARCHAR(255) NOT NULL,
  summary TEXT NOT NULL,
  action_type VARCHAR(100) NOT NULL,
  risk_level INT NOT NULL CHECK (risk_level >= 0 AND risk_level <= 4),

  -- Outcome
  outcome VARCHAR(20) NOT NULL CHECK (outcome IN ('approved', 'denied', 'escalated')),
  reasoning TEXT NOT NULL,

  -- Categorization
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  category VARCHAR(50) DEFAULT 'general',

  -- Context (anonymized)
  context_summary TEXT,

  -- Validator votes summary
  votes_summary JSONB DEFAULT '[]'::jsonb,

  -- Metrics
  times_cited INT DEFAULT 0,
  relevance_score DECIMAL(3,2) DEFAULT 1.0,

  -- Audit
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Full-text search
  search_vector tsvector
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_precedents_action_type ON council_precedents(action_type);
CREATE INDEX IF NOT EXISTS idx_precedents_outcome ON council_precedents(outcome);
CREATE INDEX IF NOT EXISTS idx_precedents_risk_level ON council_precedents(risk_level);
CREATE INDEX IF NOT EXISTS idx_precedents_category ON council_precedents(category);
CREATE INDEX IF NOT EXISTS idx_precedents_tags ON council_precedents USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_precedents_created_at ON council_precedents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_precedents_search ON council_precedents USING GIN(search_vector);

-- ============================================================================
-- 2. Full-Text Search Trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION update_precedent_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.summary, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.reasoning, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.action_type, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.context_summary, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_precedent_search ON council_precedents;
CREATE TRIGGER trigger_update_precedent_search
  BEFORE INSERT OR UPDATE ON council_precedents
  FOR EACH ROW EXECUTE FUNCTION update_precedent_search_vector();

-- ============================================================================
-- 3. Precedent Citations Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS precedent_citations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  precedent_id UUID NOT NULL REFERENCES council_precedents(id) ON DELETE CASCADE,
  decision_id UUID,
  cited_at TIMESTAMPTZ DEFAULT NOW(),
  context TEXT
);

CREATE INDEX IF NOT EXISTS idx_citations_precedent ON precedent_citations(precedent_id);
CREATE INDEX IF NOT EXISTS idx_citations_decision ON precedent_citations(decision_id);

-- ============================================================================
-- 4. Increment Citation Count Function
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_precedent_citations()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE council_precedents
  SET times_cited = times_cited + 1
  WHERE id = NEW.precedent_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_increment_citations ON precedent_citations;
CREATE TRIGGER trigger_increment_citations
  AFTER INSERT ON precedent_citations
  FOR EACH ROW EXECUTE FUNCTION increment_precedent_citations();

-- ============================================================================
-- 5. RLS Policies
-- ============================================================================

ALTER TABLE council_precedents ENABLE ROW LEVEL SECURITY;
ALTER TABLE precedent_citations ENABLE ROW LEVEL SECURITY;

-- Precedents are public read (for transparency)
CREATE POLICY precedents_select_policy ON council_precedents
  FOR SELECT USING (true);

-- Only authenticated users can insert
CREATE POLICY precedents_insert_policy ON council_precedents
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Citations public read
CREATE POLICY citations_select_policy ON precedent_citations
  FOR SELECT USING (true);

-- Authenticated users can insert citations
CREATE POLICY citations_insert_policy ON precedent_citations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================================
-- 6. Seed Initial Precedents (Example)
-- ============================================================================

INSERT INTO council_precedents (
  id,
  title,
  summary,
  action_type,
  risk_level,
  outcome,
  reasoning,
  tags,
  category,
  context_summary
) VALUES
(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'External API Data Access Approval',
  'Agent requested permission to call external weather API for user query. Approved as data is public and non-sensitive.',
  'external_api_call',
  2,
  'approved',
  'The Guardian found no security concerns with public weather data. The Scholar confirmed API follows platform standards. Action approved.',
  ARRAY['api', 'external', 'data-access'],
  'safety',
  'User asked agent to check weather. Agent needed external API access.'
),
(
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'Email Sending with Personal Information Denied',
  'Agent requested to send email containing user PII to unverified address. Denied due to privacy concerns.',
  'send_email',
  3,
  'denied',
  'The Advocate raised concerns about sending personal information to unverified recipients. The Guardian flagged potential data exposure. Majority denied.',
  ARRAY['email', 'privacy', 'pii', 'security'],
  'privacy',
  'Agent attempted to forward user data to third party without explicit consent.'
),
(
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'Code Execution in Sandbox Approved',
  'Agent requested to execute user-provided code in isolated sandbox environment. Approved with monitoring.',
  'execute_code',
  3,
  'approved',
  'The Scholar verified sandbox isolation meets security standards. The Guardian confirmed no escape vectors. Majority approved with logging requirement.',
  ARRAY['code', 'execution', 'sandbox', 'security'],
  'security',
  'User requested code execution for data analysis. Sandboxed environment ensured safety.'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE council_precedents IS 'Significant Council decisions stored as precedents for future reference';
COMMENT ON TABLE precedent_citations IS 'Tracks when precedents are cited in new decisions';

-- ============================================================================
-- Migration Complete
-- ============================================================================
