-- ============================================================================
-- Story 1.1: RBAC Middleware & Role-Based Access
-- RLS (Row Level Security) Policies for Mission Control
--
-- These policies ensure multi-tenant data isolation by filtering
-- all queries by org_id from the authenticated user's JWT claims.
--
-- FRs: FR51, FR52, FR53
-- ============================================================================

-- ============================================================================
-- Agents Table RLS
-- ============================================================================

-- Enable RLS on agents table
ALTER TABLE IF EXISTS agents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view own org agents" ON agents;
DROP POLICY IF EXISTS "Users can insert own org agents" ON agents;
DROP POLICY IF EXISTS "Users can update own org agents" ON agents;
DROP POLICY IF EXISTS "Users can delete own org agents" ON agents;

-- Policy: Users can only SELECT agents from their organization
CREATE POLICY "Users can view own org agents" ON agents
    FOR SELECT
    USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

-- Policy: Users can only INSERT agents into their organization
CREATE POLICY "Users can insert own org agents" ON agents
    FOR INSERT
    WITH CHECK (org_id = (auth.jwt() ->> 'org_id')::uuid);

-- Policy: Users can only UPDATE agents in their organization
CREATE POLICY "Users can update own org agents" ON agents
    FOR UPDATE
    USING (org_id = (auth.jwt() ->> 'org_id')::uuid)
    WITH CHECK (org_id = (auth.jwt() ->> 'org_id')::uuid);

-- Policy: Users can only DELETE agents in their organization
CREATE POLICY "Users can delete own org agents" ON agents
    FOR DELETE
    USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

-- ============================================================================
-- Action Requests Table RLS
-- ============================================================================

-- Enable RLS on action_requests table
ALTER TABLE IF EXISTS action_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own org action_requests" ON action_requests;
DROP POLICY IF EXISTS "Users can insert own org action_requests" ON action_requests;
DROP POLICY IF EXISTS "Users can update own org action_requests" ON action_requests;
DROP POLICY IF EXISTS "Users can delete own org action_requests" ON action_requests;

-- Policy: Users can only SELECT action_requests from their organization
CREATE POLICY "Users can view own org action_requests" ON action_requests
    FOR SELECT
    USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

-- Policy: Users can only INSERT action_requests into their organization
CREATE POLICY "Users can insert own org action_requests" ON action_requests
    FOR INSERT
    WITH CHECK (org_id = (auth.jwt() ->> 'org_id')::uuid);

-- Policy: Users can only UPDATE action_requests in their organization
CREATE POLICY "Users can update own org action_requests" ON action_requests
    FOR UPDATE
    USING (org_id = (auth.jwt() ->> 'org_id')::uuid)
    WITH CHECK (org_id = (auth.jwt() ->> 'org_id')::uuid);

-- Policy: Users can only DELETE action_requests in their organization
CREATE POLICY "Users can delete own org action_requests" ON action_requests
    FOR DELETE
    USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

-- ============================================================================
-- Audit Logs Table RLS (for future use)
-- ============================================================================

-- Enable RLS on audit_logs table when it exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'audit_logs') THEN
        EXECUTE 'ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY';

        EXECUTE 'DROP POLICY IF EXISTS "Users can view own org audit_logs" ON audit_logs';

        EXECUTE 'CREATE POLICY "Users can view own org audit_logs" ON audit_logs
            FOR SELECT
            USING (org_id = (auth.jwt() ->> ''org_id'')::uuid)';

        -- Audit logs should be insert-only (immutable)
        EXECUTE 'DROP POLICY IF EXISTS "Users can insert own org audit_logs" ON audit_logs';

        EXECUTE 'CREATE POLICY "Users can insert own org audit_logs" ON audit_logs
            FOR INSERT
            WITH CHECK (org_id = (auth.jwt() ->> ''org_id'')::uuid)';
    END IF;
END $$;

-- ============================================================================
-- Helper Function: Get Current User's Org ID
-- ============================================================================

-- Create a helper function to get the current user's org_id from JWT
CREATE OR REPLACE FUNCTION get_current_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT (auth.jwt() ->> 'org_id')::uuid;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_current_org_id() TO authenticated;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON POLICY "Users can view own org agents" ON agents IS
    'RLS policy ensuring users can only view agents belonging to their organization (Story 1.1)';

COMMENT ON POLICY "Users can view own org action_requests" ON action_requests IS
    'RLS policy ensuring users can only view action requests belonging to their organization (Story 1.1)';

COMMENT ON FUNCTION get_current_org_id() IS
    'Helper function to extract org_id from authenticated user JWT claims';
