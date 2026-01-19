-- Migration: Aria User Preferences
-- Epic: Aria Memory & Knowledge System
-- Phase 1: Foundation

-- User preferences (learned and explicit)
CREATE TABLE aria_user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    org_id UUID,

    -- Display preferences
    display_name TEXT,
    avatar_url TEXT,

    -- Aria interaction preferences
    preferred_provider TEXT DEFAULT 'claude',
    voice_enabled BOOLEAN DEFAULT FALSE,
    voice_name TEXT,
    verbosity_level TEXT DEFAULT 'normal' CHECK (verbosity_level IN ('concise', 'normal', 'detailed')),

    -- Notification preferences
    notification_preferences JSONB DEFAULT '{
        "approvals": true,
        "alerts": true,
        "agent_updates": false,
        "daily_summary": true
    }',

    -- Auto-learned preferences (from Shadow Bot)
    learned_preferences JSONB DEFAULT '{}',
    -- Example structure:
    -- {
    --   "approval_tendency": "cautious",  -- cautious, moderate, permissive
    --   "preferred_explanations": "detailed",
    --   "common_queries": ["agent status", "trust scores"],
    --   "active_hours": {"start": 9, "end": 17},
    --   "response_style": "technical"
    -- }

    -- Session tracking
    last_session_id UUID,
    last_active_at TIMESTAMPTZ,

    -- Usage metrics
    total_interactions INTEGER DEFAULT 0,
    total_approvals INTEGER DEFAULT 0,
    total_denials INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, org_id)
);

-- Indexes
CREATE INDEX idx_aria_prefs_user ON aria_user_preferences(user_id);
CREATE INDEX idx_aria_prefs_org ON aria_user_preferences(org_id);

-- RLS Policies
ALTER TABLE aria_user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences" ON aria_user_preferences
    FOR SELECT
    USING (user_id = auth.jwt() ->> 'email' OR org_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE POLICY "Users can insert own preferences" ON aria_user_preferences
    FOR INSERT
    WITH CHECK (user_id = auth.jwt() ->> 'email');

CREATE POLICY "Users can update own preferences" ON aria_user_preferences
    FOR UPDATE
    USING (user_id = auth.jwt() ->> 'email');

-- Trigger to update timestamp
CREATE TRIGGER trigger_prefs_updated
    BEFORE UPDATE ON aria_user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_knowledge_timestamp();

-- Function to get or create user preferences
CREATE OR REPLACE FUNCTION get_or_create_user_preferences(
    p_user_id TEXT,
    p_org_id UUID DEFAULT NULL
)
RETURNS aria_user_preferences
LANGUAGE plpgsql
AS $$
DECLARE
    result aria_user_preferences;
BEGIN
    -- Try to get existing
    SELECT * INTO result
    FROM aria_user_preferences
    WHERE user_id = p_user_id
    AND (org_id = p_org_id OR (org_id IS NULL AND p_org_id IS NULL))
    LIMIT 1;

    -- Create if not exists
    IF result IS NULL THEN
        INSERT INTO aria_user_preferences (user_id, org_id)
        VALUES (p_user_id, p_org_id)
        RETURNING * INTO result;
    END IF;

    RETURN result;
END;
$$;

-- Function to update learned preferences
CREATE OR REPLACE FUNCTION update_learned_preferences(
    p_user_id TEXT,
    p_key TEXT,
    p_value JSONB
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE aria_user_preferences
    SET
        learned_preferences = jsonb_set(
            COALESCE(learned_preferences, '{}'),
            ARRAY[p_key],
            p_value
        ),
        updated_at = NOW()
    WHERE user_id = p_user_id;
END;
$$;

-- Function to increment interaction count
CREATE OR REPLACE FUNCTION increment_user_interaction(
    p_user_id TEXT,
    p_session_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE aria_user_preferences
    SET
        total_interactions = total_interactions + 1,
        last_session_id = p_session_id,
        last_active_at = NOW()
    WHERE user_id = p_user_id;
END;
$$;
