-- ============================================================================
-- Story 1.6: Organization Data Isolation
-- Additional RLS Policies for Mission Control Tables
--
-- These policies extend Story 1.1's RLS foundation to cover all
-- Mission Control related tables ensuring complete multi-tenant isolation.
--
-- FR: FR53 - Multi-tenant security
-- ============================================================================

-- ============================================================================
-- Investigations Table RLS
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'investigations') THEN
        -- Enable RLS
        EXECUTE 'ALTER TABLE investigations ENABLE ROW LEVEL SECURITY';

        -- Drop existing policies
        EXECUTE 'DROP POLICY IF EXISTS "Users can view own org investigations" ON investigations';
        EXECUTE 'DROP POLICY IF EXISTS "Users can insert own org investigations" ON investigations';
        EXECUTE 'DROP POLICY IF EXISTS "Users can update own org investigations" ON investigations';

        -- SELECT policy
        EXECUTE 'CREATE POLICY "Users can view own org investigations" ON investigations
            FOR SELECT
            USING (org_id = (auth.jwt() ->> ''org_id'')::uuid)';

        -- INSERT policy
        EXECUTE 'CREATE POLICY "Users can insert own org investigations" ON investigations
            FOR INSERT
            WITH CHECK (org_id = (auth.jwt() ->> ''org_id'')::uuid)';

        -- UPDATE policy
        EXECUTE 'CREATE POLICY "Users can update own org investigations" ON investigations
            FOR UPDATE
            USING (org_id = (auth.jwt() ->> ''org_id'')::uuid)
            WITH CHECK (org_id = (auth.jwt() ->> ''org_id'')::uuid)';
    END IF;
END $$;

-- ============================================================================
-- Tribunal Votes Table RLS
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tribunal_votes') THEN
        EXECUTE 'ALTER TABLE tribunal_votes ENABLE ROW LEVEL SECURITY';

        EXECUTE 'DROP POLICY IF EXISTS "Users can view own org tribunal_votes" ON tribunal_votes';
        EXECUTE 'DROP POLICY IF EXISTS "Users can insert own org tribunal_votes" ON tribunal_votes';

        -- SELECT policy
        EXECUTE 'CREATE POLICY "Users can view own org tribunal_votes" ON tribunal_votes
            FOR SELECT
            USING (org_id = (auth.jwt() ->> ''org_id'')::uuid)';

        -- INSERT policy (votes are immutable)
        EXECUTE 'CREATE POLICY "Users can insert own org tribunal_votes" ON tribunal_votes
            FOR INSERT
            WITH CHECK (org_id = (auth.jwt() ->> ''org_id'')::uuid)';
    END IF;
END $$;

-- ============================================================================
-- HITL Metrics Table RLS
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'hitl_metrics') THEN
        EXECUTE 'ALTER TABLE hitl_metrics ENABLE ROW LEVEL SECURITY';

        EXECUTE 'DROP POLICY IF EXISTS "Users can view own org hitl_metrics" ON hitl_metrics';
        EXECUTE 'DROP POLICY IF EXISTS "Users can insert own org hitl_metrics" ON hitl_metrics';

        -- SELECT policy
        EXECUTE 'CREATE POLICY "Users can view own org hitl_metrics" ON hitl_metrics
            FOR SELECT
            USING (org_id = (auth.jwt() ->> ''org_id'')::uuid)';

        -- INSERT policy
        EXECUTE 'CREATE POLICY "Users can insert own org hitl_metrics" ON hitl_metrics
            FOR INSERT
            WITH CHECK (org_id = (auth.jwt() ->> ''org_id'')::uuid)';
    END IF;
END $$;

-- ============================================================================
-- Governance Rules Table RLS
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'governance_rules') THEN
        EXECUTE 'ALTER TABLE governance_rules ENABLE ROW LEVEL SECURITY';

        EXECUTE 'DROP POLICY IF EXISTS "Users can view own org governance_rules" ON governance_rules';
        EXECUTE 'DROP POLICY IF EXISTS "Users can insert own org governance_rules" ON governance_rules';
        EXECUTE 'DROP POLICY IF EXISTS "Users can update own org governance_rules" ON governance_rules';

        -- SELECT policy
        EXECUTE 'CREATE POLICY "Users can view own org governance_rules" ON governance_rules
            FOR SELECT
            USING (org_id = (auth.jwt() ->> ''org_id'')::uuid)';

        -- INSERT policy
        EXECUTE 'CREATE POLICY "Users can insert own org governance_rules" ON governance_rules
            FOR INSERT
            WITH CHECK (org_id = (auth.jwt() ->> ''org_id'')::uuid)';

        -- UPDATE policy
        EXECUTE 'CREATE POLICY "Users can update own org governance_rules" ON governance_rules
            FOR UPDATE
            USING (org_id = (auth.jwt() ->> ''org_id'')::uuid)
            WITH CHECK (org_id = (auth.jwt() ->> ''org_id'')::uuid)';
    END IF;
END $$;

-- ============================================================================
-- Audit Hashes Table RLS (Cryptographic Audit Trail)
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'audit_hashes') THEN
        EXECUTE 'ALTER TABLE audit_hashes ENABLE ROW LEVEL SECURITY';

        EXECUTE 'DROP POLICY IF EXISTS "Users can view own org audit_hashes" ON audit_hashes';
        EXECUTE 'DROP POLICY IF EXISTS "Users can insert own org audit_hashes" ON audit_hashes';

        -- SELECT policy
        EXECUTE 'CREATE POLICY "Users can view own org audit_hashes" ON audit_hashes
            FOR SELECT
            USING (org_id = (auth.jwt() ->> ''org_id'')::uuid)';

        -- INSERT policy (hashes are immutable)
        EXECUTE 'CREATE POLICY "Users can insert own org audit_hashes" ON audit_hashes
            FOR INSERT
            WITH CHECK (org_id = (auth.jwt() ->> ''org_id'')::uuid)';
    END IF;
END $$;

-- ============================================================================
-- Tasks Table RLS
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tasks') THEN
        EXECUTE 'ALTER TABLE tasks ENABLE ROW LEVEL SECURITY';

        EXECUTE 'DROP POLICY IF EXISTS "Users can view own org tasks" ON tasks';
        EXECUTE 'DROP POLICY IF EXISTS "Users can insert own org tasks" ON tasks';
        EXECUTE 'DROP POLICY IF EXISTS "Users can update own org tasks" ON tasks';

        -- SELECT policy
        EXECUTE 'CREATE POLICY "Users can view own org tasks" ON tasks
            FOR SELECT
            USING (org_id = (auth.jwt() ->> ''org_id'')::uuid)';

        -- INSERT policy
        EXECUTE 'CREATE POLICY "Users can insert own org tasks" ON tasks
            FOR INSERT
            WITH CHECK (org_id = (auth.jwt() ->> ''org_id'')::uuid)';

        -- UPDATE policy
        EXECUTE 'CREATE POLICY "Users can update own org tasks" ON tasks
            FOR UPDATE
            USING (org_id = (auth.jwt() ->> ''org_id'')::uuid)
            WITH CHECK (org_id = (auth.jwt() ->> ''org_id'')::uuid)';
    END IF;
END $$;

-- ============================================================================
-- Users Table RLS (scoped to org)
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users') THEN
        EXECUTE 'ALTER TABLE users ENABLE ROW LEVEL SECURITY';

        EXECUTE 'DROP POLICY IF EXISTS "Users can view own org users" ON users';
        EXECUTE 'DROP POLICY IF EXISTS "Users can update own profile" ON users';

        -- SELECT policy - users can see other users in their org
        EXECUTE 'CREATE POLICY "Users can view own org users" ON users
            FOR SELECT
            USING (org_id = (auth.jwt() ->> ''org_id'')::uuid)';

        -- UPDATE policy - users can only update their own profile
        EXECUTE 'CREATE POLICY "Users can update own profile" ON users
            FOR UPDATE
            USING (id = (auth.jwt() ->> ''sub'')::uuid)
            WITH CHECK (id = (auth.jwt() ->> ''sub'')::uuid)';
    END IF;
END $$;

-- ============================================================================
-- Org Settings Table RLS
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'org_settings') THEN
        EXECUTE 'ALTER TABLE org_settings ENABLE ROW LEVEL SECURITY';

        EXECUTE 'DROP POLICY IF EXISTS "Users can view own org settings" ON org_settings';
        EXECUTE 'DROP POLICY IF EXISTS "Directors can update org settings" ON org_settings';

        -- SELECT policy
        EXECUTE 'CREATE POLICY "Users can view own org settings" ON org_settings
            FOR SELECT
            USING (org_id = (auth.jwt() ->> ''org_id'')::uuid)';

        -- UPDATE policy (directors only - enforced at API level)
        EXECUTE 'CREATE POLICY "Directors can update org settings" ON org_settings
            FOR UPDATE
            USING (org_id = (auth.jwt() ->> ''org_id'')::uuid)
            WITH CHECK (org_id = (auth.jwt() ->> ''org_id'')::uuid)';
    END IF;
END $$;

-- ============================================================================
-- RLS Pattern Documentation as Comment
-- ============================================================================

COMMENT ON SCHEMA public IS
'Mission Control RLS Patterns (Story 1.6):

All org-scoped tables MUST have:
1. RLS enabled: ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;
2. SELECT policy using org_id = (auth.jwt() ->> ''org_id'')::uuid
3. INSERT policy with CHECK clause for org_id
4. UPDATE policy with both USING and WITH CHECK clauses
5. DELETE policy (if deletion is allowed)

Standard pattern:
CREATE POLICY "Users can view own org {table}" ON {table}
  FOR SELECT
  USING (org_id = (auth.jwt() ->> ''org_id'')::uuid);

For immutable tables (audit logs, hashes, votes):
- Only SELECT and INSERT policies
- No UPDATE or DELETE policies

API Layer Defense:
- Always validate org_id in handlers even with RLS
- Return 404 (not 403) for cross-org access to prevent enumeration
- Use requireOrgAccess() middleware from rbac.ts
';
