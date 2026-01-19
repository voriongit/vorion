-- ============================================================================
-- Migration: Add Artifacts Table
-- Description: Creates the artifacts table for storing agent-produced files,
--              documents, and deliverables with versioning and access control.
-- Date: 2024-12-26
-- ============================================================================

-- Create artifacts table
CREATE TABLE IF NOT EXISTS artifacts (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Basic info
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('CODE', 'DOCUMENT', 'IMAGE', 'DATA', 'REPORT', 'CONFIG', 'LOG', 'ARCHIVE')),
    mime_type TEXT NOT NULL,

    -- Content storage (one of these will be set)
    content TEXT,                    -- For small text artifacts (<1MB)
    storage_path TEXT,               -- Supabase Storage bucket path
    storage_url TEXT,                -- Public URL for stored files

    -- Metadata
    size_bytes INTEGER NOT NULL DEFAULT 0,
    checksum TEXT,                   -- SHA-256 hash
    original_filename TEXT,

    -- Ownership & timestamps
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Relationships
    task_id TEXT,                    -- Associated task
    blackboard_entry_id TEXT,        -- Associated blackboard entry
    parent_artifact_id UUID REFERENCES artifacts(id) ON DELETE SET NULL,

    -- Access control
    visibility TEXT NOT NULL DEFAULT 'PRIVATE' CHECK (visibility IN ('PUBLIC', 'PRIVATE', 'TASK_PARTICIPANTS', 'TIER_RESTRICTED')),
    min_tier_required INTEGER CHECK (min_tier_required >= 0 AND min_tier_required <= 5),
    allowed_agent_ids TEXT[],        -- Override: specific agents that can access

    -- Status & review
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED')),
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,

    -- Organization & search
    tags TEXT[] DEFAULT '{}',
    description TEXT,

    -- Versioning
    version INTEGER NOT NULL DEFAULT 1,
    previous_version_id UUID REFERENCES artifacts(id) ON DELETE SET NULL,
    is_latest BOOLEAN NOT NULL DEFAULT TRUE,

    -- Constraints
    CONSTRAINT content_or_storage CHECK (
        (content IS NOT NULL AND storage_path IS NULL) OR
        (content IS NULL AND storage_path IS NOT NULL) OR
        (content IS NULL AND storage_path IS NULL)  -- Allow empty artifacts initially
    )
);

-- ============================================================================
-- Indexes for common query patterns
-- ============================================================================

-- Task association (most common query)
CREATE INDEX idx_artifacts_task_id ON artifacts(task_id) WHERE task_id IS NOT NULL;

-- Creator lookup
CREATE INDEX idx_artifacts_created_by ON artifacts(created_by);

-- Status filtering
CREATE INDEX idx_artifacts_status ON artifacts(status);

-- Type filtering
CREATE INDEX idx_artifacts_type ON artifacts(type);

-- Blackboard entry association
CREATE INDEX idx_artifacts_blackboard_entry ON artifacts(blackboard_entry_id) WHERE blackboard_entry_id IS NOT NULL;

-- Version chain navigation
CREATE INDEX idx_artifacts_parent ON artifacts(parent_artifact_id) WHERE parent_artifact_id IS NOT NULL;

-- Latest version filtering
CREATE INDEX idx_artifacts_latest ON artifacts(is_latest) WHERE is_latest = TRUE;

-- Tag search (GIN index for array containment)
CREATE INDEX idx_artifacts_tags ON artifacts USING GIN(tags);

-- Full-text search on name and description
CREATE INDEX idx_artifacts_search ON artifacts USING GIN(
    to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(description, ''))
);

-- Date-based queries
CREATE INDEX idx_artifacts_created_at ON artifacts(created_at DESC);

-- ============================================================================
-- Trigger: Auto-update updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_artifacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER artifacts_updated_at_trigger
    BEFORE UPDATE ON artifacts
    FOR EACH ROW
    EXECUTE FUNCTION update_artifacts_updated_at();

-- ============================================================================
-- Trigger: Mark previous version as not latest when creating new version
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_artifact_versioning()
RETURNS TRIGGER AS $$
BEGIN
    -- If this artifact has a parent (is a new version)
    IF NEW.parent_artifact_id IS NOT NULL THEN
        -- Mark the parent as not latest
        UPDATE artifacts
        SET is_latest = FALSE, updated_at = NOW()
        WHERE id = NEW.parent_artifact_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER artifacts_versioning_trigger
    AFTER INSERT ON artifacts
    FOR EACH ROW
    EXECUTE FUNCTION handle_artifact_versioning();

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations for authenticated users (API handles fine-grained access)
-- In production, you'd want more granular policies based on visibility and tier
CREATE POLICY "Allow all for authenticated" ON artifacts
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- Storage Bucket for large artifacts (run via Supabase dashboard or API)
-- ============================================================================

-- Note: Storage bucket creation must be done via Supabase dashboard or API
-- The bucket should be named 'artifacts' with the following settings:
-- - Public: false (we control access via signed URLs)
-- - File size limit: 50MB
-- - Allowed MIME types: * (all)

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE artifacts IS 'Stores files, documents, and deliverables produced by agents';
COMMENT ON COLUMN artifacts.content IS 'Inline content for small text artifacts (<1MB)';
COMMENT ON COLUMN artifacts.storage_path IS 'Supabase Storage path for large files';
COMMENT ON COLUMN artifacts.checksum IS 'SHA-256 hash for integrity verification';
COMMENT ON COLUMN artifacts.visibility IS 'Access control level: PUBLIC, PRIVATE, TASK_PARTICIPANTS, TIER_RESTRICTED';
COMMENT ON COLUMN artifacts.is_latest IS 'Whether this is the latest version in the version chain';
