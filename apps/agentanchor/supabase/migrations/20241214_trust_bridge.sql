-- ============================================================================
-- Trust Bridge - Universal Agent Certification
-- Migration: Create Trust Bridge tables
-- Created: 2024-12-14
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Submissions Table
-- Stores external agent certification requests
-- ============================================================================

CREATE TABLE IF NOT EXISTS trust_bridge_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tracking_id VARCHAR(50) UNIQUE NOT NULL,

    -- Submission data (JSONB for flexibility)
    submission JSONB NOT NULL,

    -- Status tracking
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'testing', 'review', 'passed', 'failed', 'flagged', 'expired')),

    -- Queue management
    queue_position INTEGER,
    priority_score INTEGER DEFAULT 0,
    estimated_start TIMESTAMPTZ,

    -- Test results (populated after testing)
    test_results JSONB,
    test_session_id UUID,

    -- Certification (populated if passed)
    certification JSONB,
    credential_token TEXT,

    -- Council review (for elevated certifications)
    council_reviewed BOOLEAN DEFAULT FALSE,
    council_decision_id UUID,
    review_notes TEXT,

    -- Timestamps
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,

    -- Submitter info
    submitter_id VARCHAR(100) NOT NULL,
    submitter_tier VARCHAR(20) DEFAULT 'free'
        CHECK (submitter_tier IN ('free', 'pro', 'enterprise')),

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tb_submissions_tracking_id ON trust_bridge_submissions(tracking_id);
CREATE INDEX IF NOT EXISTS idx_tb_submissions_status ON trust_bridge_submissions(status);
CREATE INDEX IF NOT EXISTS idx_tb_submissions_submitter ON trust_bridge_submissions(submitter_id);
CREATE INDEX IF NOT EXISTS idx_tb_submissions_pending ON trust_bridge_submissions(status, priority_score DESC)
    WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_tb_submissions_submitted_at ON trust_bridge_submissions(submitted_at DESC);

-- ============================================================================
-- Credentials Table
-- Stores issued Trust Bridge Credentials
-- ============================================================================

CREATE TABLE IF NOT EXISTS trust_bridge_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Agent identification
    agent_id VARCHAR(100) UNIQUE NOT NULL,
    submission_id UUID REFERENCES trust_bridge_submissions(id),

    -- Credential data
    token TEXT NOT NULL,
    payload JSONB NOT NULL,

    -- Certification details
    trust_score INTEGER NOT NULL CHECK (trust_score >= 0 AND trust_score <= 1000),
    tier VARCHAR(20) NOT NULL CHECK (tier IN ('basic', 'standard', 'advanced', 'enterprise')),
    origin_platform VARCHAR(50) NOT NULL,
    capabilities TEXT[] NOT NULL DEFAULT '{}',
    restrictions TEXT[] NOT NULL DEFAULT '{}',

    -- Validity
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    revocation_reason TEXT,

    -- Council review
    council_reviewed BOOLEAN DEFAULT FALSE,
    council_decision_id UUID,

    -- Truth Chain anchor
    truth_chain_hash VARCHAR(100),

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tb_credentials_agent_id ON trust_bridge_credentials(agent_id);
CREATE INDEX IF NOT EXISTS idx_tb_credentials_submission ON trust_bridge_credentials(submission_id);
CREATE INDEX IF NOT EXISTS idx_tb_credentials_tier ON trust_bridge_credentials(tier);
CREATE INDEX IF NOT EXISTS idx_tb_credentials_platform ON trust_bridge_credentials(origin_platform);
CREATE INDEX IF NOT EXISTS idx_tb_credentials_active ON trust_bridge_credentials(agent_id, expires_at)
    WHERE revoked_at IS NULL;

-- ============================================================================
-- Verification Log Table
-- Tracks credential verifications for analytics and rate limiting
-- ============================================================================

CREATE TABLE IF NOT EXISTS trust_bridge_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- What was verified
    credential_id UUID REFERENCES trust_bridge_credentials(id),
    agent_id VARCHAR(100),

    -- Verification result
    valid BOOLEAN NOT NULL,
    error_code VARCHAR(50),
    warnings TEXT[],

    -- Requester info
    requester_ip VARCHAR(50),
    requester_api_key VARCHAR(100),
    requester_tier VARCHAR(20) DEFAULT 'free',

    -- Timing
    verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    response_time_ms INTEGER
);

-- Indexes for rate limiting and analytics
CREATE INDEX IF NOT EXISTS idx_tb_verifications_requester ON trust_bridge_verifications(requester_ip, verified_at DESC);
CREATE INDEX IF NOT EXISTS idx_tb_verifications_credential ON trust_bridge_verifications(credential_id);
CREATE INDEX IF NOT EXISTS idx_tb_verifications_time ON trust_bridge_verifications(verified_at DESC);

-- ============================================================================
-- Revocations Table
-- Tracks revoked credentials for quick lookup
-- ============================================================================

CREATE TABLE IF NOT EXISTS trust_bridge_revocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    agent_id VARCHAR(100) NOT NULL,
    credential_id UUID REFERENCES trust_bridge_credentials(id),

    reason TEXT NOT NULL,
    revoked_by VARCHAR(100),

    revoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quick revocation checks
CREATE UNIQUE INDEX IF NOT EXISTS idx_tb_revocations_agent ON trust_bridge_revocations(agent_id);

-- ============================================================================
-- Queue Processing Log
-- Tracks queue processing for debugging and metrics
-- ============================================================================

CREATE TABLE IF NOT EXISTS trust_bridge_queue_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    submission_id UUID REFERENCES trust_bridge_submissions(id),
    tracking_id VARCHAR(50),

    action VARCHAR(50) NOT NULL,
    details JSONB,

    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for recent logs
CREATE INDEX IF NOT EXISTS idx_tb_queue_log_time ON trust_bridge_queue_log(processed_at DESC);
CREATE INDEX IF NOT EXISTS idx_tb_queue_log_submission ON trust_bridge_queue_log(submission_id);

-- ============================================================================
-- Functions
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_trust_bridge_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS trigger_tb_submissions_updated_at ON trust_bridge_submissions;
CREATE TRIGGER trigger_tb_submissions_updated_at
    BEFORE UPDATE ON trust_bridge_submissions
    FOR EACH ROW EXECUTE FUNCTION update_trust_bridge_updated_at();

DROP TRIGGER IF EXISTS trigger_tb_credentials_updated_at ON trust_bridge_credentials;
CREATE TRIGGER trigger_tb_credentials_updated_at
    BEFORE UPDATE ON trust_bridge_credentials
    FOR EACH ROW EXECUTE FUNCTION update_trust_bridge_updated_at();

-- Function to get queue position
CREATE OR REPLACE FUNCTION get_trust_bridge_queue_position(p_tracking_id VARCHAR)
RETURNS INTEGER AS $$
DECLARE
    v_position INTEGER;
    v_submitted_at TIMESTAMPTZ;
BEGIN
    -- Get the submission time
    SELECT submitted_at INTO v_submitted_at
    FROM trust_bridge_submissions
    WHERE tracking_id = p_tracking_id AND status = 'pending';

    IF v_submitted_at IS NULL THEN
        RETURN NULL;
    END IF;

    -- Count submissions ahead in queue
    SELECT COUNT(*) + 1 INTO v_position
    FROM trust_bridge_submissions
    WHERE status = 'pending'
      AND (priority_score > (
          SELECT COALESCE(priority_score, 0)
          FROM trust_bridge_submissions
          WHERE tracking_id = p_tracking_id
      ) OR (
          priority_score = (
              SELECT COALESCE(priority_score, 0)
              FROM trust_bridge_submissions
              WHERE tracking_id = p_tracking_id
          ) AND submitted_at < v_submitted_at
      ));

    RETURN v_position;
END;
$$ LANGUAGE plpgsql;

-- Function to check if agent is revoked
CREATE OR REPLACE FUNCTION is_trust_bridge_agent_revoked(p_agent_id VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM trust_bridge_revocations WHERE agent_id = p_agent_id
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get queue statistics
CREATE OR REPLACE FUNCTION get_trust_bridge_queue_stats()
RETURNS TABLE (
    pending_count BIGINT,
    testing_count BIGINT,
    review_count BIGINT,
    avg_wait_minutes NUMERIC,
    max_wait_hours NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE status = 'testing') as testing_count,
        COUNT(*) FILTER (WHERE status = 'review') as review_count,
        COALESCE(
            AVG(EXTRACT(EPOCH FROM (NOW() - submitted_at)) / 60)
            FILTER (WHERE status = 'pending'),
            0
        ) as avg_wait_minutes,
        COALESCE(
            MAX(EXTRACT(EPOCH FROM (NOW() - submitted_at)) / 3600)
            FILTER (WHERE status = 'pending'),
            0
        ) as max_wait_hours
    FROM trust_bridge_submissions;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE trust_bridge_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trust_bridge_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE trust_bridge_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE trust_bridge_revocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE trust_bridge_queue_log ENABLE ROW LEVEL SECURITY;

-- Service role has full access (for API routes)
CREATE POLICY "Service role full access on submissions"
    ON trust_bridge_submissions FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on credentials"
    ON trust_bridge_credentials FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on verifications"
    ON trust_bridge_verifications FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on revocations"
    ON trust_bridge_revocations FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on queue_log"
    ON trust_bridge_queue_log FOR ALL
    USING (auth.role() = 'service_role');

-- Public can verify credentials (read-only on credentials)
CREATE POLICY "Public can read active credentials"
    ON trust_bridge_credentials FOR SELECT
    USING (revoked_at IS NULL AND expires_at > NOW());

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE trust_bridge_submissions IS 'External agent certification requests';
COMMENT ON TABLE trust_bridge_credentials IS 'Issued Trust Bridge Credentials (TBC)';
COMMENT ON TABLE trust_bridge_verifications IS 'Credential verification log for analytics';
COMMENT ON TABLE trust_bridge_revocations IS 'Revoked credentials quick lookup';
COMMENT ON TABLE trust_bridge_queue_log IS 'Queue processing audit log';

COMMENT ON COLUMN trust_bridge_submissions.submission IS 'Full AgentSubmission object as JSONB';
COMMENT ON COLUMN trust_bridge_submissions.priority_score IS 'Higher score = processed first';
COMMENT ON COLUMN trust_bridge_credentials.payload IS 'Full JWT payload as JSONB';
COMMENT ON COLUMN trust_bridge_credentials.truth_chain_hash IS 'Anchor hash on Truth Chain';
