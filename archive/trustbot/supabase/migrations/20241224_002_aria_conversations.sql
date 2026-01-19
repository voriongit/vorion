-- Migration: Aria Conversation Memory
-- Epic: Aria Memory & Knowledge System
-- Phase 1: Foundation

-- Conversation history with vector embeddings for semantic search
CREATE TABLE aria_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL,
    user_id TEXT,  -- HITL user email or 'anonymous'
    org_id UUID,   -- For multi-tenant isolation
    role TEXT NOT NULL CHECK (role IN ('user', 'aria', 'system')),
    content TEXT NOT NULL,
    embedding vector(1536),  -- OpenAI text-embedding-ada-002 dimension
    tokens_used INTEGER DEFAULT 0,
    provider TEXT,  -- 'claude', 'grok', 'openai', 'gemini'
    model TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_aria_conv_session ON aria_conversations(session_id);
CREATE INDEX idx_aria_conv_user ON aria_conversations(user_id);
CREATE INDEX idx_aria_conv_org ON aria_conversations(org_id);
CREATE INDEX idx_aria_conv_created ON aria_conversations(created_at DESC);

-- Vector similarity index (IVFFlat for approximate nearest neighbor)
CREATE INDEX idx_aria_conv_embedding ON aria_conversations
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- RLS Policies for multi-tenant isolation
ALTER TABLE aria_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org conversations" ON aria_conversations
    FOR SELECT
    USING (org_id IS NULL OR org_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE POLICY "Users can insert own org conversations" ON aria_conversations
    FOR INSERT
    WITH CHECK (org_id IS NULL OR org_id = (auth.jwt() ->> 'org_id')::uuid);

-- Function to search conversations by semantic similarity
CREATE OR REPLACE FUNCTION search_conversations(
    query_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 10,
    filter_user_id TEXT DEFAULT NULL,
    filter_session_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    session_id UUID,
    user_id TEXT,
    role TEXT,
    content TEXT,
    similarity FLOAT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ac.id,
        ac.session_id,
        ac.user_id,
        ac.role,
        ac.content,
        1 - (ac.embedding <=> query_embedding) AS similarity,
        ac.created_at
    FROM aria_conversations ac
    WHERE
        ac.embedding IS NOT NULL
        AND 1 - (ac.embedding <=> query_embedding) > match_threshold
        AND (filter_user_id IS NULL OR ac.user_id = filter_user_id)
        AND (filter_session_id IS NULL OR ac.session_id = filter_session_id)
    ORDER BY ac.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
