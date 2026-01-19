-- ============================================================================
-- Story 2.3: Approve Action Request - HITL Metrics Table
-- FR14: Approve pending action requests
-- ============================================================================

-- HITL (Human-In-The-Loop) metrics table
-- Tracks operator review behavior for quality assessment
CREATE TABLE IF NOT EXISTS hitl_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    user_id UUID NOT NULL,
    decision_id UUID NOT NULL REFERENCES action_requests(id) ON DELETE CASCADE,
    review_time_ms INTEGER NOT NULL,
    detail_views_accessed BOOLEAN DEFAULT false,
    sample_data_viewed BOOLEAN DEFAULT false,
    scroll_depth FLOAT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_hitl_metrics_org_id ON hitl_metrics(org_id);
CREATE INDEX IF NOT EXISTS idx_hitl_metrics_user_id ON hitl_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_hitl_metrics_decision_id ON hitl_metrics(decision_id);
CREATE INDEX IF NOT EXISTS idx_hitl_metrics_created_at ON hitl_metrics(created_at);

-- Enable RLS
ALTER TABLE hitl_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Select: Users can only view their org's HITL metrics
CREATE POLICY hitl_metrics_select_policy ON hitl_metrics
    FOR SELECT
    USING (org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid);

-- Insert: Users can only insert metrics for their org
CREATE POLICY hitl_metrics_insert_policy ON hitl_metrics
    FOR INSERT
    WITH CHECK (org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid);

-- Add comments for documentation
COMMENT ON TABLE hitl_metrics IS 'Tracks human-in-the-loop review metrics for quality assessment';
COMMENT ON COLUMN hitl_metrics.review_time_ms IS 'Time spent reviewing the decision in milliseconds';
COMMENT ON COLUMN hitl_metrics.detail_views_accessed IS 'Whether the operator expanded detail views';
COMMENT ON COLUMN hitl_metrics.sample_data_viewed IS 'Whether the operator viewed sample data';
COMMENT ON COLUMN hitl_metrics.scroll_depth IS 'How far the operator scrolled in the details (0.0-1.0)';
