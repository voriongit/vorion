-- Migration: Memory Agent Activity Logs
-- Epic: Aria Memory & Knowledge System
-- Phase 1: Foundation

-- Activity logs for Librarian, Shadow Bot, and Archivist agents
CREATE TABLE memory_agent_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID,

    -- Agent identification
    agent_type TEXT NOT NULL CHECK (agent_type IN (
        'librarian',   -- Knowledge curation
        'shadow_bot',  -- Observation and extraction
        'archivist'    -- Retrieval and context building
    )),
    agent_id TEXT,  -- Specific agent instance ID

    -- Action details
    action TEXT NOT NULL CHECK (action IN (
        -- Librarian actions
        'indexed',
        'consolidated',
        'expired',
        'archived',
        'quality_assessed',
        'deduplicated',

        -- Shadow Bot actions
        'observed',
        'extracted',
        'learned',
        'pattern_detected',

        -- Archivist actions
        'retrieved',
        'ranked',
        'summarized',
        'context_built'
    )),

    -- Target of the action
    target_type TEXT,  -- 'conversation', 'knowledge', 'pattern', 'agent', 'user'
    target_id TEXT,

    -- Result details
    success BOOLEAN DEFAULT TRUE,
    details JSONB DEFAULT '{}',
    -- Example details:
    -- { "entries_processed": 10, "duplicates_found": 2, "tokens_used": 500 }

    -- Performance
    duration_ms INTEGER,
    tokens_used INTEGER,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_mem_logs_org ON memory_agent_logs(org_id);
CREATE INDEX idx_mem_logs_agent ON memory_agent_logs(agent_type);
CREATE INDEX idx_mem_logs_action ON memory_agent_logs(action);
CREATE INDEX idx_mem_logs_target ON memory_agent_logs(target_type, target_id);
CREATE INDEX idx_mem_logs_created ON memory_agent_logs(created_at DESC);

-- Partition by month for efficient cleanup (optional, for high-volume deployments)
-- CREATE INDEX idx_mem_logs_month ON memory_agent_logs(date_trunc('month', created_at));

-- RLS Policies
ALTER TABLE memory_agent_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org logs" ON memory_agent_logs
    FOR SELECT
    USING (org_id IS NULL OR org_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE POLICY "System can insert logs" ON memory_agent_logs
    FOR INSERT
    WITH CHECK (TRUE);  -- Logs can be inserted by system

-- Function to log memory agent activity
CREATE OR REPLACE FUNCTION log_memory_agent_activity(
    p_agent_type TEXT,
    p_action TEXT,
    p_target_type TEXT DEFAULT NULL,
    p_target_id TEXT DEFAULT NULL,
    p_success BOOLEAN DEFAULT TRUE,
    p_details JSONB DEFAULT '{}',
    p_duration_ms INTEGER DEFAULT NULL,
    p_tokens_used INTEGER DEFAULT NULL,
    p_org_id UUID DEFAULT NULL,
    p_agent_id TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    result_id UUID;
BEGIN
    INSERT INTO memory_agent_logs (
        org_id, agent_type, agent_id, action,
        target_type, target_id, success, details,
        duration_ms, tokens_used
    ) VALUES (
        p_org_id, p_agent_type, p_agent_id, p_action,
        p_target_type, p_target_id, p_success, p_details,
        p_duration_ms, p_tokens_used
    )
    RETURNING id INTO result_id;

    RETURN result_id;
END;
$$;

-- View for memory agent statistics
CREATE OR REPLACE VIEW memory_agent_stats AS
SELECT
    agent_type,
    action,
    COUNT(*) AS total_actions,
    COUNT(*) FILTER (WHERE success = TRUE) AS successful,
    COUNT(*) FILTER (WHERE success = FALSE) AS failed,
    AVG(duration_ms) AS avg_duration_ms,
    SUM(tokens_used) AS total_tokens,
    MAX(created_at) AS last_activity
FROM memory_agent_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY agent_type, action
ORDER BY agent_type, total_actions DESC;

-- Cleanup function for old logs (keep 30 days by default)
CREATE OR REPLACE FUNCTION cleanup_old_memory_logs(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM memory_agent_logs
    WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;
