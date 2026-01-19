-- ============================================================================
-- Story 3.1: Bot Tribunal Voting Records Display
-- Creates the tribunal_votes table for tracking AI council deliberations
--
-- FRs: FR19
-- ============================================================================

-- ============================================================================
-- Tribunal Votes Table
-- Stores voting records from Bot Tribunal deliberations on high-risk decisions
-- ============================================================================

CREATE TABLE IF NOT EXISTS tribunal_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    action_request_id UUID NOT NULL REFERENCES action_requests(id) ON DELETE CASCADE,

    -- Voting agent info
    agent_id TEXT NOT NULL,
    agent_name TEXT NOT NULL,

    -- Vote details
    vote VARCHAR(10) NOT NULL,
    reasoning TEXT,
    confidence DECIMAL(3,2),

    -- Timestamps
    voted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT tribunal_votes_vote_check
        CHECK (vote IN ('approve', 'deny', 'abstain')),
    CONSTRAINT tribunal_votes_confidence_check
        CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),

    -- Unique constraint: each agent can only vote once per action request
    CONSTRAINT tribunal_votes_agent_action_unique
        UNIQUE (action_request_id, agent_id)
);

-- ============================================================================
-- Indexes
-- ============================================================================

-- Primary query pattern: votes for a specific action request
CREATE INDEX IF NOT EXISTS idx_tribunal_votes_action
    ON tribunal_votes(action_request_id);

-- For org-level queries and RLS
CREATE INDEX IF NOT EXISTS idx_tribunal_votes_org
    ON tribunal_votes(org_id);

-- For agent voting history lookups
CREATE INDEX IF NOT EXISTS idx_tribunal_votes_agent
    ON tribunal_votes(agent_id);

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE tribunal_votes ENABLE ROW LEVEL SECURITY;

-- Users can view tribunal votes from their org
CREATE POLICY "Users can view own org tribunal_votes" ON tribunal_votes
    FOR SELECT
    USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

-- System can insert tribunal votes (via service role)
CREATE POLICY "Service can insert tribunal_votes" ON tribunal_votes
    FOR INSERT
    WITH CHECK (true);

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE tribunal_votes IS 'Bot Tribunal voting records for high-risk decision deliberations (Story 3.1)';
COMMENT ON COLUMN tribunal_votes.vote IS 'The agent''s vote: approve, deny, or abstain';
COMMENT ON COLUMN tribunal_votes.reasoning IS 'The agent''s explanation for their vote';
COMMENT ON COLUMN tribunal_votes.confidence IS 'Confidence score (0.00 to 1.00) in the vote decision';
COMMENT ON COLUMN tribunal_votes.voted_at IS 'When the vote was cast';
