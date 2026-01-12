-- Epic 14: Precedent Flywheel [MOAT BUILDER]
-- Stories 14-1, 14-2, 14-3, 14-4, 14-5
-- FRs: FR150-FR156
-- AI-powered governance that learns from decisions

-- =============================================================================
-- Enable pgvector extension for semantic search
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- =============================================================================
-- Story 14-1: Decision Indexing
-- Add embedding column to existing precedents table
-- =============================================================================

-- Add embedding column to council_precedents if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'council_precedents') THEN
    -- Add embedding column (1536 dimensions for text-embedding-ada-002)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'council_precedents' AND column_name = 'embedding') THEN
      ALTER TABLE council_precedents ADD COLUMN embedding vector(1536);
    END IF;

    -- Add indexed_at timestamp
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'council_precedents' AND column_name = 'indexed_at') THEN
      ALTER TABLE council_precedents ADD COLUMN indexed_at TIMESTAMPTZ;
    END IF;

    -- Add embedding metadata
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'council_precedents' AND column_name = 'embedding_model') THEN
      ALTER TABLE council_precedents ADD COLUMN embedding_model TEXT DEFAULT 'text-embedding-ada-002';
    END IF;
  END IF;
END $$;

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_precedents_embedding ON council_precedents
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- =============================================================================
-- Story 14-2: Precedent Similarity Cache
-- Cache frequently accessed similarity results
-- =============================================================================

CREATE TABLE IF NOT EXISTS precedent_similarity_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_hash TEXT NOT NULL UNIQUE, -- Hash of the query embedding
  query_text TEXT, -- Original query for debugging

  -- Results
  similar_precedent_ids UUID[] NOT NULL,
  similarity_scores FLOAT[] NOT NULL,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
  hit_count INT DEFAULT 0
);

CREATE INDEX idx_similarity_cache_hash ON precedent_similarity_cache(query_hash);
CREATE INDEX idx_similarity_cache_expires ON precedent_similarity_cache(expires_at);

-- =============================================================================
-- Story 14-4: Decision Consistency Tracking
-- Track when validators make inconsistent decisions
-- =============================================================================

CREATE TABLE IF NOT EXISTS decision_consistency_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The decision that was made
  decision_id UUID NOT NULL,
  request_id UUID,
  agent_id UUID,

  -- The similar precedent that suggests inconsistency
  precedent_id UUID REFERENCES council_precedents(id),
  similarity_score FLOAT NOT NULL,

  -- Inconsistency details
  inconsistency_type TEXT NOT NULL CHECK (inconsistency_type IN (
    'outcome_mismatch',     -- Same scenario, different outcome
    'reasoning_divergence', -- Same outcome, different reasoning
    'severity_mismatch',    -- Similar risk, very different treatment
    'precedent_ignored'     -- High similarity precedent not cited
  )),

  -- Analysis
  current_outcome TEXT NOT NULL,
  precedent_outcome TEXT NOT NULL,
  divergence_explanation TEXT,

  -- Resolution
  status TEXT DEFAULT 'flagged' CHECK (status IN ('flagged', 'reviewed', 'justified', 'corrected')),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_consistency_decision ON decision_consistency_log(decision_id);
CREATE INDEX idx_consistency_precedent ON decision_consistency_log(precedent_id);
CREATE INDEX idx_consistency_status ON decision_consistency_log(status);
CREATE INDEX idx_consistency_type ON decision_consistency_log(inconsistency_type);

-- =============================================================================
-- Story 14-5: Validator Fine-Tuning Pipeline
-- Track validator prompt versions and performance
-- =============================================================================

CREATE TABLE IF NOT EXISTS validator_prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Validator identification
  validator_type TEXT NOT NULL, -- 'guardian', 'arbiter', 'scholar', etc.
  version INT NOT NULL,

  -- Prompt content
  system_prompt TEXT NOT NULL,
  prompt_hash TEXT NOT NULL,

  -- Training data reference
  training_precedent_ids UUID[],
  training_examples_count INT DEFAULT 0,

  -- Performance metrics
  accuracy_score FLOAT,
  consistency_score FLOAT,
  avg_confidence FLOAT,

  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'testing', 'active', 'retired')),
  activated_at TIMESTAMPTZ,
  retired_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by UUID,
  notes TEXT,

  UNIQUE(validator_type, version)
);

CREATE INDEX idx_validator_prompts_type ON validator_prompt_versions(validator_type);
CREATE INDEX idx_validator_prompts_status ON validator_prompt_versions(status);
CREATE INDEX idx_validator_prompts_active ON validator_prompt_versions(validator_type, status) WHERE status = 'active';

-- Track individual validator decisions for training data
CREATE TABLE IF NOT EXISTS validator_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to council decision
  decision_id UUID NOT NULL,
  request_id UUID,

  -- Validator info
  validator_type TEXT NOT NULL,
  prompt_version_id UUID REFERENCES validator_prompt_versions(id),

  -- Decision details
  vote TEXT NOT NULL CHECK (vote IN ('approve', 'deny', 'abstain', 'escalate')),
  confidence FLOAT CHECK (confidence BETWEEN 0 AND 1),
  reasoning TEXT,

  -- For training evaluation
  human_agreed BOOLEAN, -- Did human override agree?
  outcome_correct BOOLEAN, -- Was the final outcome what validator suggested?

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_validator_decisions_decision ON validator_decisions(decision_id);
CREATE INDEX idx_validator_decisions_validator ON validator_decisions(validator_type);
CREATE INDEX idx_validator_decisions_version ON validator_decisions(prompt_version_id);

-- =============================================================================
-- Helper Functions
-- =============================================================================

-- Function to find similar precedents using vector similarity
CREATE OR REPLACE FUNCTION find_similar_precedents(
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  summary TEXT,
  outcome TEXT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cp.id,
    cp.title,
    cp.summary,
    cp.outcome,
    1 - (cp.embedding <=> query_embedding) AS similarity
  FROM council_precedents cp
  WHERE cp.embedding IS NOT NULL
    AND 1 - (cp.embedding <=> query_embedding) > match_threshold
  ORDER BY cp.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Function to check decision consistency
CREATE OR REPLACE FUNCTION check_decision_consistency(
  p_decision_id UUID,
  p_embedding vector(1536),
  p_outcome TEXT,
  p_threshold FLOAT DEFAULT 0.85
)
RETURNS TABLE (
  precedent_id UUID,
  similarity FLOAT,
  precedent_outcome TEXT,
  is_inconsistent BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cp.id AS precedent_id,
    1 - (cp.embedding <=> p_embedding) AS similarity,
    cp.outcome AS precedent_outcome,
    (cp.outcome != p_outcome) AS is_inconsistent
  FROM council_precedents cp
  WHERE cp.embedding IS NOT NULL
    AND 1 - (cp.embedding <=> p_embedding) > p_threshold
  ORDER BY cp.embedding <=> p_embedding
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- Cleanup expired cache entries
CREATE OR REPLACE FUNCTION cleanup_similarity_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM precedent_similarity_cache
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
