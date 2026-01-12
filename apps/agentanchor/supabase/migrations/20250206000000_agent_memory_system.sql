-- =====================================================
-- A3I AGENT MEMORY & KNOWLEDGE SYSTEM
-- Enabling agents to learn, remember, and share knowledge
-- =====================================================

-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================
-- MEMORY TYPES ENUM
-- =====================================================
DO $$ BEGIN
  CREATE TYPE memory_type AS ENUM (
    'episodic',     -- Specific events and interactions
    'semantic',     -- Facts, concepts, and general knowledge
    'procedural',   -- How to do things (skills)
    'shadow',       -- Learned from observing other agents
    'working'       -- Current session context
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- AGENT MEMORIES TABLE
-- Personal memory storage for each agent
-- =====================================================
CREATE TABLE IF NOT EXISTS agent_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  memory_type memory_type NOT NULL DEFAULT 'episodic',

  -- Content
  content TEXT NOT NULL,
  summary TEXT,                          -- Summarized version for quick retrieval
  embedding VECTOR(1536),                -- OpenAI ada-002 compatible

  -- Metadata
  source_agent_id UUID REFERENCES agents(id),  -- For shadow learning
  source_interaction_id UUID,            -- Reference to original interaction
  confidence FLOAT DEFAULT 1.0,          -- How confident is this memory (0-1)
  importance FLOAT DEFAULT 0.5,          -- How important is this memory (0-1)

  -- Temporal
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed TIMESTAMPTZ DEFAULT NOW(),
  access_count INT DEFAULT 0,
  expires_at TIMESTAMPTZ,                -- Optional expiration

  -- Tags and categorization
  tags JSONB DEFAULT '[]',
  category TEXT,

  -- Indexes for efficient retrieval
  CONSTRAINT valid_confidence CHECK (confidence >= 0 AND confidence <= 1),
  CONSTRAINT valid_importance CHECK (importance >= 0 AND importance <= 1)
);

-- Indexes for agent_memories
CREATE INDEX IF NOT EXISTS idx_agent_memories_agent ON agent_memories(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_memories_type ON agent_memories(memory_type);
CREATE INDEX IF NOT EXISTS idx_agent_memories_source ON agent_memories(source_agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_memories_importance ON agent_memories(importance DESC);
CREATE INDEX IF NOT EXISTS idx_agent_memories_accessed ON agent_memories(last_accessed DESC);

-- Vector similarity index (for semantic search)
CREATE INDEX IF NOT EXISTS idx_agent_memories_embedding ON agent_memories
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- =====================================================
-- SHARED MEMORIES TABLE
-- Collective knowledge for councils and teams
-- =====================================================
CREATE TABLE IF NOT EXISTS shared_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Scope
  council_id UUID,                       -- Council this belongs to (null = global)
  team_id UUID,                          -- Team this belongs to
  scope TEXT DEFAULT 'global',           -- 'global', 'council', 'team', 'guild'

  -- Content
  content TEXT NOT NULL,
  summary TEXT,
  embedding VECTOR(1536),

  -- Provenance
  contributors UUID[] DEFAULT '{}',      -- Agents who contributed
  original_memory_id UUID REFERENCES agent_memories(id),

  -- Consensus
  consensus_score FLOAT DEFAULT 0,       -- Agreement level (0-1)
  vote_count INT DEFAULT 0,

  -- Metadata
  category TEXT,
  tags JSONB DEFAULT '[]',
  importance FLOAT DEFAULT 0.5,

  -- Temporal
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_consensus CHECK (consensus_score >= 0 AND consensus_score <= 1)
);

CREATE INDEX IF NOT EXISTS idx_shared_memories_council ON shared_memories(council_id);
CREATE INDEX IF NOT EXISTS idx_shared_memories_scope ON shared_memories(scope);
CREATE INDEX IF NOT EXISTS idx_shared_memories_embedding ON shared_memories
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- =====================================================
-- KNOWLEDGE GRAPH EDGES
-- Relationships between agents, concepts, and memories
-- =====================================================
DO $$ BEGIN
  CREATE TYPE knowledge_relation AS ENUM (
    'trained_by',        -- Agent was trained by another agent
    'trained',           -- Agent trained another agent
    'knows_about',       -- Agent has knowledge of topic
    'decided_on',        -- Agent made a decision about something
    'collaborated_with', -- Agents worked together
    'derived_from',      -- Knowledge derived from source
    'contradicts',       -- Conflicting information
    'supports',          -- Supporting evidence
    'supersedes',        -- Newer information replaces older
    'related_to'         -- General relationship
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS knowledge_graph (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationship
  subject_type TEXT NOT NULL,            -- 'agent', 'memory', 'concept', 'decision'
  subject_id UUID NOT NULL,
  predicate knowledge_relation NOT NULL,
  object_type TEXT NOT NULL,
  object_id UUID NOT NULL,

  -- Metadata
  confidence FLOAT DEFAULT 1.0,
  evidence JSONB DEFAULT '{}',           -- Supporting evidence
  created_by UUID REFERENCES agents(id),

  -- Temporal
  created_at TIMESTAMPTZ DEFAULT NOW(),
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,               -- Null = still valid

  CONSTRAINT valid_kg_confidence CHECK (confidence >= 0 AND confidence <= 1)
);

CREATE INDEX IF NOT EXISTS idx_kg_subject ON knowledge_graph(subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_kg_object ON knowledge_graph(object_type, object_id);
CREATE INDEX IF NOT EXISTS idx_kg_predicate ON knowledge_graph(predicate);

-- =====================================================
-- TRAINING LINEAGE
-- Track master-apprentice relationships
-- =====================================================
CREATE TABLE IF NOT EXISTS training_lineage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  master_id UUID NOT NULL REFERENCES agents(id),
  apprentice_id UUID NOT NULL REFERENCES agents(id),

  -- Training details
  training_type TEXT DEFAULT 'shadow',   -- 'shadow', 'direct', 'curriculum'
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- Assessment
  proficiency_score FLOAT,               -- Final proficiency (0-1)
  skills_transferred JSONB DEFAULT '[]', -- Skills passed on
  certification_id UUID,                 -- Link to certification if any

  -- Metadata
  notes TEXT,

  CONSTRAINT no_self_training CHECK (master_id != apprentice_id),
  CONSTRAINT valid_proficiency CHECK (proficiency_score IS NULL OR (proficiency_score >= 0 AND proficiency_score <= 1))
);

CREATE INDEX IF NOT EXISTS idx_lineage_master ON training_lineage(master_id);
CREATE INDEX IF NOT EXISTS idx_lineage_apprentice ON training_lineage(apprentice_id);

-- =====================================================
-- SHADOW LEARNING SESSIONS
-- Track observation-based learning
-- =====================================================
CREATE TABLE IF NOT EXISTS shadow_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  observer_id UUID NOT NULL REFERENCES agents(id),
  observed_id UUID NOT NULL REFERENCES agents(id),

  -- Session details
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  interaction_count INT DEFAULT 0,

  -- Learning outcomes
  insights_captured INT DEFAULT 0,
  behaviors_learned JSONB DEFAULT '[]',
  skills_observed JSONB DEFAULT '[]',

  -- Quality
  quality_score FLOAT,                   -- How valuable was this session

  CONSTRAINT no_self_shadow CHECK (observer_id != observed_id)
);

CREATE INDEX IF NOT EXISTS idx_shadow_observer ON shadow_sessions(observer_id);
CREATE INDEX IF NOT EXISTS idx_shadow_observed ON shadow_sessions(observed_id);

-- =====================================================
-- MEMORY RETRIEVAL FUNCTION
-- Semantic search across agent memories
-- =====================================================
CREATE OR REPLACE FUNCTION search_agent_memories(
  p_agent_id UUID,
  p_query_embedding VECTOR(1536),
  p_memory_types memory_type[] DEFAULT NULL,
  p_limit INT DEFAULT 10,
  p_min_similarity FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  memory_id UUID,
  content TEXT,
  memory_type memory_type,
  similarity FLOAT,
  importance FLOAT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    am.id,
    am.content,
    am.memory_type,
    1 - (am.embedding <=> p_query_embedding) as similarity,
    am.importance,
    am.created_at
  FROM agent_memories am
  WHERE am.agent_id = p_agent_id
    AND (p_memory_types IS NULL OR am.memory_type = ANY(p_memory_types))
    AND 1 - (am.embedding <=> p_query_embedding) >= p_min_similarity
  ORDER BY similarity DESC, am.importance DESC
  LIMIT p_limit;
END;
$$;

-- =====================================================
-- MEMORY CONSOLIDATION FUNCTION
-- Merge similar memories (like sleep consolidation)
-- =====================================================
CREATE OR REPLACE FUNCTION consolidate_memories(
  p_agent_id UUID,
  p_similarity_threshold FLOAT DEFAULT 0.95
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  consolidated_count INT := 0;
BEGIN
  -- Mark duplicate memories for consolidation
  -- (Full implementation would merge content and update importance)

  -- Update access patterns
  UPDATE agent_memories
  SET importance = importance * 0.99  -- Slight decay
  WHERE agent_id = p_agent_id
    AND last_accessed < NOW() - INTERVAL '7 days';

  GET DIAGNOSTICS consolidated_count = ROW_COUNT;
  RETURN consolidated_count;
END;
$$;

-- =====================================================
-- STRATEGIC FORGETTING FUNCTION
-- Remove low-value memories to optimize storage
-- =====================================================
CREATE OR REPLACE FUNCTION strategic_forget(
  p_agent_id UUID,
  p_max_memories INT DEFAULT 10000,
  p_min_importance FLOAT DEFAULT 0.1
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INT := 0;
  current_count INT;
BEGIN
  -- Count current memories
  SELECT COUNT(*) INTO current_count
  FROM agent_memories
  WHERE agent_id = p_agent_id;

  -- Delete if over limit
  IF current_count > p_max_memories THEN
    DELETE FROM agent_memories
    WHERE id IN (
      SELECT id FROM agent_memories
      WHERE agent_id = p_agent_id
        AND importance < p_min_importance
        AND memory_type != 'procedural'  -- Never forget skills
      ORDER BY importance ASC, last_accessed ASC
      LIMIT (current_count - p_max_memories)
    );
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
  END IF;

  RETURN deleted_count;
END;
$$;

-- =====================================================
-- UPDATE MEMORY ACCESS
-- Track when memories are accessed
-- =====================================================
CREATE OR REPLACE FUNCTION update_memory_access(p_memory_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE agent_memories
  SET
    last_accessed = NOW(),
    access_count = access_count + 1,
    -- Boost importance slightly with each access
    importance = LEAST(1.0, importance + 0.01)
  WHERE id = p_memory_id;
END;
$$;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE agent_memories IS 'Personal memory storage for each AI agent - supports episodic, semantic, procedural, and shadow learning memories';
COMMENT ON TABLE shared_memories IS 'Collective knowledge shared across councils, teams, and the ecosystem';
COMMENT ON TABLE knowledge_graph IS 'Graph relationships between agents, memories, concepts, and decisions';
COMMENT ON TABLE training_lineage IS 'Master-apprentice training relationships for lineage tracking';
COMMENT ON TABLE shadow_sessions IS 'Observation-based learning sessions between agents';

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON agent_memories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON shared_memories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON knowledge_graph TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON training_lineage TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON shadow_sessions TO authenticated;

-- Success message
DO $$ BEGIN
  RAISE NOTICE 'A3I Agent Memory System schema created successfully!';
END $$;
