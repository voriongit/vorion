-- Migration: Aria Decision Patterns
-- Epic: Aria Memory & Knowledge System
-- Phase 1: Foundation

-- Decision patterns for learning from approval/denial history
CREATE TABLE aria_decision_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID,

    -- Pattern classification
    pattern_type TEXT NOT NULL CHECK (pattern_type IN (
        'approval',    -- Request approved
        'denial',      -- Request denied
        'delegation',  -- Delegated to another
        'escalation',  -- Escalated to higher authority
        'modification' -- Approved with modifications
    )),

    -- Context matching
    context_signature TEXT NOT NULL,  -- Hash of context for exact matching
    context_embedding vector(1536),   -- For semantic similarity
    context_summary TEXT,             -- Human-readable context

    -- Decision details
    agent_type TEXT,
    agent_tier INTEGER,
    action_type TEXT,
    decision TEXT NOT NULL,
    rationale TEXT,

    -- Outcome tracking
    outcome TEXT CHECK (outcome IN ('success', 'failure', 'pending', 'unknown')),
    outcome_details TEXT,

    -- Attribution
    hitl_user_id TEXT,

    -- Pattern strength
    frequency INTEGER DEFAULT 1,
    success_rate REAL DEFAULT 1.0,
    last_occurred_at TIMESTAMPTZ DEFAULT NOW(),

    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_aria_patterns_org ON aria_decision_patterns(org_id);
CREATE INDEX idx_aria_patterns_type ON aria_decision_patterns(pattern_type);
CREATE INDEX idx_aria_patterns_agent ON aria_decision_patterns(agent_type, agent_tier);
CREATE INDEX idx_aria_patterns_user ON aria_decision_patterns(hitl_user_id);
CREATE INDEX idx_aria_patterns_frequency ON aria_decision_patterns(frequency DESC);
CREATE INDEX idx_aria_patterns_signature ON aria_decision_patterns(context_signature);

-- Vector similarity index
CREATE INDEX idx_aria_patterns_embedding ON aria_decision_patterns
    USING ivfflat (context_embedding vector_cosine_ops)
    WITH (lists = 100);

-- RLS Policies
ALTER TABLE aria_decision_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org patterns" ON aria_decision_patterns
    FOR SELECT
    USING (org_id IS NULL OR org_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE POLICY "Users can insert own org patterns" ON aria_decision_patterns
    FOR INSERT
    WITH CHECK (org_id IS NULL OR org_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE POLICY "Users can update own org patterns" ON aria_decision_patterns
    FOR UPDATE
    USING (org_id IS NULL OR org_id = (auth.jwt() ->> 'org_id')::uuid);

-- Function to find similar patterns
CREATE OR REPLACE FUNCTION find_similar_patterns(
    query_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.75,
    match_count INT DEFAULT 5,
    filter_pattern_type TEXT DEFAULT NULL,
    filter_agent_type TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    pattern_type TEXT,
    context_summary TEXT,
    agent_type TEXT,
    agent_tier INTEGER,
    decision TEXT,
    rationale TEXT,
    outcome TEXT,
    similarity FLOAT,
    frequency INTEGER,
    success_rate REAL
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        adp.id,
        adp.pattern_type,
        adp.context_summary,
        adp.agent_type,
        adp.agent_tier,
        adp.decision,
        adp.rationale,
        adp.outcome,
        1 - (adp.context_embedding <=> query_embedding) AS similarity,
        adp.frequency,
        adp.success_rate
    FROM aria_decision_patterns adp
    WHERE
        adp.context_embedding IS NOT NULL
        AND 1 - (adp.context_embedding <=> query_embedding) > match_threshold
        AND (filter_pattern_type IS NULL OR adp.pattern_type = filter_pattern_type)
        AND (filter_agent_type IS NULL OR adp.agent_type = filter_agent_type)
    ORDER BY
        adp.context_embedding <=> query_embedding,
        adp.frequency DESC
    LIMIT match_count;
END;
$$;

-- Function to record or update a pattern
CREATE OR REPLACE FUNCTION upsert_decision_pattern(
    p_context_signature TEXT,
    p_pattern_type TEXT,
    p_agent_type TEXT,
    p_agent_tier INTEGER,
    p_action_type TEXT,
    p_decision TEXT,
    p_rationale TEXT,
    p_hitl_user_id TEXT,
    p_context_embedding vector(1536) DEFAULT NULL,
    p_context_summary TEXT DEFAULT NULL,
    p_org_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    existing_id UUID;
    result_id UUID;
BEGIN
    -- Check for existing pattern with same signature
    SELECT id INTO existing_id
    FROM aria_decision_patterns
    WHERE context_signature = p_context_signature
    AND pattern_type = p_pattern_type
    LIMIT 1;

    IF existing_id IS NOT NULL THEN
        -- Update existing pattern
        UPDATE aria_decision_patterns
        SET
            frequency = frequency + 1,
            last_occurred_at = NOW(),
            rationale = COALESCE(p_rationale, rationale)
        WHERE id = existing_id
        RETURNING id INTO result_id;
    ELSE
        -- Insert new pattern
        INSERT INTO aria_decision_patterns (
            org_id, pattern_type, context_signature, context_embedding,
            context_summary, agent_type, agent_tier, action_type,
            decision, rationale, hitl_user_id
        ) VALUES (
            p_org_id, p_pattern_type, p_context_signature, p_context_embedding,
            p_context_summary, p_agent_type, p_agent_tier, p_action_type,
            p_decision, p_rationale, p_hitl_user_id
        )
        RETURNING id INTO result_id;
    END IF;

    RETURN result_id;
END;
$$;
