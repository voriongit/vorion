-- Migration: Aria Knowledge Base
-- Epic: Aria Memory & Knowledge System
-- Phase 1: Foundation

-- Knowledge entries with semantic embeddings
CREATE TABLE aria_knowledge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID,

    -- Categorization
    category TEXT NOT NULL CHECK (category IN (
        'agent',      -- Agent profiles, capabilities, purposes
        'workflow',   -- Task workflows, processes
        'governance', -- Rules, policies, trust gates
        'pattern',    -- Learned behavioral patterns
        'decision',   -- Past decisions and rationales
        'system'      -- System architecture, components
    )),
    subcategory TEXT,

    -- Content
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),

    -- Provenance
    source_type TEXT NOT NULL CHECK (source_type IN (
        'observation',  -- Shadow Bot extracted
        'extraction',   -- AI-extracted from conversations
        'manual',       -- Human-entered
        'inferred'      -- Derived from patterns
    )),
    source_id TEXT,  -- Reference to original (conversation_id, agent_id, etc.)

    -- Quality metrics
    confidence REAL DEFAULT 0.8 CHECK (confidence >= 0 AND confidence <= 1),
    access_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMPTZ,

    -- Verification
    verified_by TEXT,  -- HITL user who verified
    verified_at TIMESTAMPTZ,

    -- Lifecycle
    expires_at TIMESTAMPTZ,  -- For temporal knowledge
    is_archived BOOLEAN DEFAULT FALSE,

    -- Metadata
    tags TEXT[] DEFAULT '{}',
    related_ids UUID[] DEFAULT '{}',  -- Related knowledge entries
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_aria_know_org ON aria_knowledge(org_id);
CREATE INDEX idx_aria_know_category ON aria_knowledge(category, subcategory);
CREATE INDEX idx_aria_know_source ON aria_knowledge(source_type, source_id);
CREATE INDEX idx_aria_know_confidence ON aria_knowledge(confidence DESC);
CREATE INDEX idx_aria_know_tags ON aria_knowledge USING gin(tags);
CREATE INDEX idx_aria_know_created ON aria_knowledge(created_at DESC);

-- Vector similarity index
CREATE INDEX idx_aria_know_embedding ON aria_knowledge
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- RLS Policies
ALTER TABLE aria_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view knowledge" ON aria_knowledge
    FOR SELECT
    USING (org_id IS NULL OR org_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE POLICY "Users can insert knowledge" ON aria_knowledge
    FOR INSERT
    WITH CHECK (org_id IS NULL OR org_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE POLICY "Users can update own org knowledge" ON aria_knowledge
    FOR UPDATE
    USING (org_id IS NULL OR org_id = (auth.jwt() ->> 'org_id')::uuid);

-- Function to search knowledge by semantic similarity
CREATE OR REPLACE FUNCTION search_knowledge(
    query_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 10,
    filter_categories TEXT[] DEFAULT NULL,
    min_confidence FLOAT DEFAULT 0.5
)
RETURNS TABLE (
    id UUID,
    category TEXT,
    subcategory TEXT,
    title TEXT,
    content TEXT,
    similarity FLOAT,
    confidence REAL,
    source_type TEXT,
    verified_by TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ak.id,
        ak.category,
        ak.subcategory,
        ak.title,
        ak.content,
        1 - (ak.embedding <=> query_embedding) AS similarity,
        ak.confidence,
        ak.source_type,
        ak.verified_by,
        ak.created_at
    FROM aria_knowledge ak
    WHERE
        ak.embedding IS NOT NULL
        AND ak.is_archived = FALSE
        AND (ak.expires_at IS NULL OR ak.expires_at > NOW())
        AND 1 - (ak.embedding <=> query_embedding) > match_threshold
        AND ak.confidence >= min_confidence
        AND (filter_categories IS NULL OR ak.category = ANY(filter_categories))
    ORDER BY ak.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Function to increment access count
CREATE OR REPLACE FUNCTION increment_knowledge_access(knowledge_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE aria_knowledge
    SET
        access_count = access_count + 1,
        last_accessed_at = NOW()
    WHERE id = knowledge_id;
END;
$$;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_knowledge_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_knowledge_updated
    BEFORE UPDATE ON aria_knowledge
    FOR EACH ROW
    EXECUTE FUNCTION update_knowledge_timestamp();
