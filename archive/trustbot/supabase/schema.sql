-- TrustBot Database Schema for Supabase
-- Run this in your Supabase SQL Editor

-- ============================================================================
-- AGENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    tier INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'IDLE',
    trust_score INTEGER NOT NULL DEFAULT 100,
    floor TEXT NOT NULL DEFAULT 'OPERATIONS',
    room TEXT NOT NULL DEFAULT 'SPAWN_BAY',
    capabilities TEXT[] DEFAULT '{}',
    skills TEXT[] DEFAULT '{}',
    parent_id UUID REFERENCES agents(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TASKS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    priority TEXT NOT NULL DEFAULT 'NORMAL',
    requester TEXT NOT NULL,
    assigned_to UUID REFERENCES agents(id),
    delegation_chain TEXT[] DEFAULT '{}',
    result TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- ============================================================================
-- TRUST SCORES TABLE (History)
-- ============================================================================
CREATE TABLE IF NOT EXISTS trust_scores (
    id SERIAL PRIMARY KEY,
    agent_id UUID NOT NULL REFERENCES agents(id),
    score INTEGER NOT NULL,
    tier INTEGER NOT NULL,
    reason TEXT,
    delta INTEGER DEFAULT 0,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- BLACKBOARD ENTRIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS blackboard_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    author TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'NORMAL',
    status TEXT NOT NULL DEFAULT 'OPEN',
    parent_id UUID REFERENCES blackboard_entries(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- ============================================================================
-- BLACKBOARD COMMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS blackboard_comments (
    id SERIAL PRIMARY KEY,
    entry_id UUID NOT NULL REFERENCES blackboard_entries(id) ON DELETE CASCADE,
    author TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- AUDIT LOG TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,
    actor TEXT NOT NULL,
    target TEXT,
    action TEXT NOT NULL,
    details JSONB,
    ip_address TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- APPROVALS TABLE (HITL)
-- ============================================================================
CREATE TABLE IF NOT EXISTS approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES tasks(id),
    agent_id UUID NOT NULL,
    action TEXT NOT NULL,
    reason TEXT,
    priority TEXT NOT NULL DEFAULT 'NORMAL',
    status TEXT NOT NULL DEFAULT 'PENDING',
    approved_by TEXT,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

-- ============================================================================
-- SYSTEM CONFIG TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default config
INSERT INTO system_config (key, value) VALUES
    ('hitl_level', '100'),
    ('aggressiveness', '{"level": 50, "autoApproveUpToTier": 1, "maxDelegationDepth": 3}')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_agents_tier ON agents(tier);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_trust_scores_agent ON trust_scores(agent_id);
CREATE INDEX IF NOT EXISTS idx_blackboard_type ON blackboard_entries(type);
CREATE INDEX IF NOT EXISTS idx_blackboard_status ON blackboard_entries(status);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
