/**
 * Artifact System Types
 *
 * Artifacts are files, documents, and deliverables produced by agents
 * during task execution. They provide persistent, versioned storage
 * for agent outputs with access control and review workflows.
 */

import type { AgentId, AgentTier } from '../types.js';

// ============================================================================
// Artifact Type Definitions
// ============================================================================

/**
 * Categories of artifacts that agents can produce
 */
export type ArtifactType =
    | 'CODE'           // Source code files (.ts, .js, .py, etc.)
    | 'DOCUMENT'       // Markdown, text, PDFs, Word docs
    | 'IMAGE'          // Generated images, screenshots, diagrams
    | 'DATA'           // JSON, CSV, structured data files
    | 'REPORT'         // Analysis reports, summaries
    | 'CONFIG'         // Configuration files (.yaml, .json, .env)
    | 'LOG'            // Execution logs, debug output
    | 'ARCHIVE';       // Bundles of multiple files (.zip, .tar)

/**
 * Lifecycle status of an artifact
 */
export type ArtifactStatus =
    | 'DRAFT'          // Work in progress, not finalized
    | 'PENDING_REVIEW' // Awaiting human or agent review
    | 'APPROVED'       // Reviewed and approved for use
    | 'REJECTED'       // Review failed, needs revision
    | 'ARCHIVED';      // No longer active, kept for history

/**
 * Access control levels for artifacts
 */
export type ArtifactVisibility =
    | 'PUBLIC'              // Visible to all agents
    | 'PRIVATE'             // Only creator can access
    | 'TASK_PARTICIPANTS'   // Only agents involved in the task
    | 'TIER_RESTRICTED';    // Only agents at or above specified tier

// ============================================================================
// Core Artifact Interface
// ============================================================================

/**
 * Main artifact entity representing a file or deliverable
 */
export interface Artifact {
    /** Unique identifier (UUID) */
    id: string;

    /** Human-readable name (e.g., "api-design.md") */
    name: string;

    /** Category of artifact */
    type: ArtifactType;

    /** MIME type (e.g., "text/markdown", "image/png") */
    mimeType: string;

    // -------------------------------------------------------------------------
    // Content Storage (one of these will be set)
    // -------------------------------------------------------------------------

    /** Inline content for small text artifacts (<1MB) */
    content?: string;

    /** Storage bucket path for large files */
    storagePath?: string;

    /** Public URL for accessing stored files */
    storageUrl?: string;

    // -------------------------------------------------------------------------
    // Metadata
    // -------------------------------------------------------------------------

    /** File size in bytes */
    size: number;

    /** SHA-256 checksum for integrity verification */
    checksum?: string;

    /** Original filename if uploaded */
    originalFilename?: string;

    // -------------------------------------------------------------------------
    // Ownership & Timestamps
    // -------------------------------------------------------------------------

    /** Agent ID of creator */
    createdBy: AgentId;

    /** Creation timestamp */
    createdAt: Date;

    /** Last update timestamp */
    updatedAt: Date;

    // -------------------------------------------------------------------------
    // Relationships
    // -------------------------------------------------------------------------

    /** Associated task ID (if created for a task) */
    taskId?: string;

    /** Associated blackboard entry ID */
    blackboardEntryId?: string;

    /** Parent artifact ID (for versioning) */
    parentArtifactId?: string;

    /** Child artifact IDs (newer versions) */
    childArtifactIds?: string[];

    // -------------------------------------------------------------------------
    // Access Control
    // -------------------------------------------------------------------------

    /** Visibility level */
    visibility: ArtifactVisibility;

    /** Minimum tier required to access (for TIER_RESTRICTED) */
    minTierRequired?: AgentTier;

    /** Specific agent IDs that can access (override) */
    allowedAgentIds?: AgentId[];

    // -------------------------------------------------------------------------
    // Status & Review
    // -------------------------------------------------------------------------

    /** Current lifecycle status */
    status: ArtifactStatus;

    /** Agent ID of reviewer (if reviewed) */
    reviewedBy?: AgentId;

    /** Review timestamp */
    reviewedAt?: Date;

    /** Review notes/feedback */
    reviewNotes?: string;

    // -------------------------------------------------------------------------
    // Organization & Search
    // -------------------------------------------------------------------------

    /** Tags for categorization and search */
    tags: string[];

    /** Human-readable description */
    description?: string;

    // -------------------------------------------------------------------------
    // Versioning
    // -------------------------------------------------------------------------

    /** Version number (starts at 1) */
    version: number;

    /** ID of the previous version */
    previousVersionId?: string;

    /** Whether this is the latest version */
    isLatest: boolean;
}

// ============================================================================
// Operation Interfaces
// ============================================================================

/**
 * Parameters for creating a new artifact
 */
export interface ArtifactCreateParams {
    /** Artifact name */
    name: string;

    /** Artifact type */
    type: ArtifactType;

    /** Text content (for inline storage) */
    content?: string;

    /** Binary file data (for file uploads) */
    file?: Buffer;

    /** MIME type (auto-detected if not provided) */
    mimeType?: string;

    /** Associated task ID */
    taskId?: string;

    /** Associated blackboard entry ID */
    blackboardEntryId?: string;

    /** Visibility level */
    visibility?: ArtifactVisibility;

    /** Minimum tier for access */
    minTierRequired?: AgentTier;

    /** Tags for organization */
    tags?: string[];

    /** Description */
    description?: string;
}

/**
 * Parameters for updating an artifact
 */
export interface ArtifactUpdateParams {
    /** Updated name */
    name?: string;

    /** Updated description */
    description?: string;

    /** Updated tags */
    tags?: string[];

    /** Updated visibility */
    visibility?: ArtifactVisibility;

    /** Updated tier requirement */
    minTierRequired?: AgentTier;

    /** Updated status */
    status?: ArtifactStatus;
}

/**
 * Parameters for creating a new version
 */
export interface ArtifactVersionParams {
    /** New content (text) */
    content?: string;

    /** New content (binary) */
    file?: Buffer;

    /** Version notes */
    notes?: string;
}

/**
 * Parameters for reviewing an artifact
 */
export interface ArtifactReviewParams {
    /** Review decision */
    decision: 'APPROVE' | 'REJECT';

    /** Review notes/feedback */
    notes?: string;
}

/**
 * Query parameters for listing artifacts
 */
export interface ArtifactQueryParams {
    /** Filter by task ID */
    taskId?: string;

    /** Filter by blackboard entry ID */
    blackboardEntryId?: string;

    /** Filter by creator */
    createdBy?: AgentId;

    /** Filter by type */
    type?: ArtifactType;

    /** Filter by status */
    status?: ArtifactStatus;

    /** Filter by tags (any match) */
    tags?: string[];

    /** Only return latest versions */
    latestOnly?: boolean;

    /** Pagination: offset */
    offset?: number;

    /** Pagination: limit */
    limit?: number;

    /** Sort field */
    sortBy?: 'createdAt' | 'updatedAt' | 'name' | 'size';

    /** Sort direction */
    sortOrder?: 'asc' | 'desc';
}

/**
 * Result of a list query
 */
export interface ArtifactListResult {
    /** Artifacts matching the query */
    artifacts: Artifact[];

    /** Total count (for pagination) */
    total: number;

    /** Whether there are more results */
    hasMore: boolean;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Events emitted by the ArtifactService
 */
export interface ArtifactEvents {
    'artifact:created': (artifact: Artifact) => void;
    'artifact:updated': (artifact: Artifact) => void;
    'artifact:deleted': (artifactId: string) => void;
    'artifact:versioned': (artifact: Artifact, previousVersion: Artifact) => void;
    'artifact:reviewed': (artifact: Artifact, decision: 'APPROVE' | 'REJECT') => void;
    'artifact:accessed': (artifactId: string, accessedBy: AgentId) => void;
}

// ============================================================================
// Database Row Type (for Supabase)
// ============================================================================

/**
 * Database row representation (snake_case for Postgres)
 */
export interface ArtifactRow {
    id: string;
    name: string;
    type: string;
    mime_type: string;
    content: string | null;
    storage_path: string | null;
    storage_url: string | null;
    size_bytes: number;
    checksum: string | null;
    original_filename: string | null;
    created_by: string;
    created_at: string;
    updated_at: string;
    task_id: string | null;
    blackboard_entry_id: string | null;
    parent_artifact_id: string | null;
    visibility: string;
    min_tier_required: number | null;
    allowed_agent_ids: string[] | null;
    status: string;
    reviewed_by: string | null;
    reviewed_at: string | null;
    review_notes: string | null;
    tags: string[];
    description: string | null;
    version: number;
    previous_version_id: string | null;
    is_latest: boolean;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * MIME type mappings for common file extensions
 */
export const MIME_TYPE_MAP: Record<string, string> = {
    // Code
    '.ts': 'text/typescript',
    '.tsx': 'text/typescript',
    '.js': 'text/javascript',
    '.jsx': 'text/javascript',
    '.py': 'text/x-python',
    '.rs': 'text/x-rust',
    '.go': 'text/x-go',
    '.java': 'text/x-java',
    '.c': 'text/x-c',
    '.cpp': 'text/x-c++',
    '.h': 'text/x-c',
    '.css': 'text/css',
    '.html': 'text/html',
    '.sql': 'text/x-sql',

    // Documents
    '.md': 'text/markdown',
    '.txt': 'text/plain',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',

    // Data
    '.json': 'application/json',
    '.yaml': 'text/yaml',
    '.yml': 'text/yaml',
    '.xml': 'application/xml',
    '.csv': 'text/csv',

    // Images
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',

    // Archives
    '.zip': 'application/zip',
    '.tar': 'application/x-tar',
    '.gz': 'application/gzip',

    // Config
    '.env': 'text/plain',
    '.toml': 'text/toml',
    '.ini': 'text/plain',
};

/**
 * Artifact type inference from MIME type
 */
export const ARTIFACT_TYPE_FROM_MIME: Record<string, ArtifactType> = {
    'text/typescript': 'CODE',
    'text/javascript': 'CODE',
    'text/x-python': 'CODE',
    'text/x-rust': 'CODE',
    'text/x-go': 'CODE',
    'text/x-java': 'CODE',
    'text/x-c': 'CODE',
    'text/x-c++': 'CODE',
    'text/css': 'CODE',
    'text/html': 'CODE',
    'text/x-sql': 'CODE',

    'text/markdown': 'DOCUMENT',
    'text/plain': 'DOCUMENT',
    'application/pdf': 'DOCUMENT',
    'application/msword': 'DOCUMENT',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCUMENT',

    'application/json': 'DATA',
    'text/yaml': 'CONFIG',
    'application/xml': 'DATA',
    'text/csv': 'DATA',

    'image/png': 'IMAGE',
    'image/jpeg': 'IMAGE',
    'image/gif': 'IMAGE',
    'image/svg+xml': 'IMAGE',
    'image/webp': 'IMAGE',

    'application/zip': 'ARCHIVE',
    'application/x-tar': 'ARCHIVE',
    'application/gzip': 'ARCHIVE',
};
