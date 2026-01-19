/**
 * Artifact Service
 *
 * Manages the lifecycle of artifacts (files, documents, deliverables)
 * produced by agents. Handles storage, versioning, access control,
 * and review workflows.
 */

import { createHash } from 'crypto';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'eventemitter3';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../lib/logger.js';
import type { AgentId, AgentTier } from '../types.js';
import type {
    Artifact,
    ArtifactCreateParams,
    ArtifactUpdateParams,
    ArtifactVersionParams,
    ArtifactReviewParams,
    ArtifactQueryParams,
    ArtifactListResult,
    ArtifactEvents,
    ArtifactRow,
    ArtifactType,
    ArtifactVisibility,
    MIME_TYPE_MAP,
    ARTIFACT_TYPE_FROM_MIME,
} from '../types/artifact.js';

// Re-import the constants (can't import const from type-only imports)
const MIME_TYPES: Record<string, string> = {
    '.ts': 'text/typescript',
    '.tsx': 'text/typescript',
    '.js': 'text/javascript',
    '.jsx': 'text/javascript',
    '.py': 'text/x-python',
    '.md': 'text/markdown',
    '.txt': 'text/plain',
    '.json': 'application/json',
    '.yaml': 'text/yaml',
    '.yml': 'text/yaml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.zip': 'application/zip',
    '.csv': 'text/csv',
    '.html': 'text/html',
    '.css': 'text/css',
    '.sql': 'text/x-sql',
};

const TYPE_FROM_MIME: Record<string, ArtifactType> = {
    'text/typescript': 'CODE',
    'text/javascript': 'CODE',
    'text/x-python': 'CODE',
    'text/markdown': 'DOCUMENT',
    'text/plain': 'DOCUMENT',
    'application/json': 'DATA',
    'text/yaml': 'CONFIG',
    'image/png': 'IMAGE',
    'image/jpeg': 'IMAGE',
    'image/gif': 'IMAGE',
    'image/svg+xml': 'IMAGE',
    'application/pdf': 'DOCUMENT',
    'application/zip': 'ARCHIVE',
    'text/csv': 'DATA',
    'text/html': 'CODE',
    'text/css': 'CODE',
    'text/x-sql': 'CODE',
};

// ============================================================================
// Constants
// ============================================================================

/** Maximum size for inline content storage (1MB) */
const INLINE_THRESHOLD_BYTES = 1024 * 1024;

/** Storage bucket name */
const STORAGE_BUCKET = 'artifacts';

/** Default pagination limit */
const DEFAULT_LIMIT = 50;

/** Maximum pagination limit */
const MAX_LIMIT = 100;

// ============================================================================
// ArtifactService Class
// ============================================================================

export class ArtifactService extends EventEmitter<ArtifactEvents> {
    private supabase: SupabaseClient;
    private log = logger.child({ component: 'ArtifactService' });

    constructor(supabaseClient: SupabaseClient) {
        super();
        this.supabase = supabaseClient;
        this.log.info('ArtifactService initialized');
    }

    // -------------------------------------------------------------------------
    // Core CRUD Operations
    // -------------------------------------------------------------------------

    /**
     * Create a new artifact
     */
    async create(params: ArtifactCreateParams, createdBy: AgentId): Promise<Artifact> {
        const id = uuidv4();
        const now = new Date();

        // Detect MIME type if not provided
        const mimeType = params.mimeType || this.detectMimeType(params.name);

        // Infer artifact type if not provided
        const artifactType = params.type || this.inferArtifactType(mimeType);

        // Calculate size and checksum
        let size = 0;
        let checksum: string | undefined;
        let content: string | undefined;
        let storagePath: string | undefined;
        let storageUrl: string | undefined;

        if (params.file) {
            size = params.file.length;
            checksum = this.calculateChecksum(params.file);

            if (size <= INLINE_THRESHOLD_BYTES && this.isTextMimeType(mimeType)) {
                // Store inline as text
                content = params.file.toString('utf8');
            } else {
                // Upload to storage
                const uploadResult = await this.uploadToStorage(id, params.file, mimeType, params.taskId);
                storagePath = uploadResult.path;
                storageUrl = uploadResult.url;
            }
        } else if (params.content) {
            content = params.content;
            size = Buffer.byteLength(params.content, 'utf8');
            checksum = this.calculateChecksum(Buffer.from(params.content, 'utf8'));
        }

        // Build artifact row
        const row: Partial<ArtifactRow> = {
            id,
            name: params.name,
            type: artifactType,
            mime_type: mimeType,
            content,
            storage_path: storagePath,
            storage_url: storageUrl,
            size_bytes: size,
            checksum,
            created_by: createdBy,
            created_at: now.toISOString(),
            updated_at: now.toISOString(),
            task_id: params.taskId,
            blackboard_entry_id: params.blackboardEntryId,
            visibility: params.visibility || 'PRIVATE',
            min_tier_required: params.minTierRequired,
            status: 'DRAFT',
            tags: params.tags || [],
            description: params.description,
            version: 1,
            is_latest: true,
        };

        // Insert into database
        const { data, error } = await this.supabase
            .from('artifacts')
            .insert(row)
            .select()
            .single();

        if (error) {
            this.log.error('Failed to create artifact', { error, params });
            throw new Error(`Failed to create artifact: ${error.message}`);
        }

        const artifact = this.rowToArtifact(data);
        this.emit('artifact:created', artifact);
        this.log.info('Artifact created', { id: artifact.id, name: artifact.name, type: artifact.type });

        return artifact;
    }

    /**
     * Get an artifact by ID
     */
    async get(id: string): Promise<Artifact | null> {
        const { data, error } = await this.supabase
            .from('artifacts')
            .select()
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null; // Not found
            }
            this.log.error('Failed to get artifact', { error, id });
            throw new Error(`Failed to get artifact: ${error.message}`);
        }

        return this.rowToArtifact(data);
    }

    /**
     * Get artifact content (download)
     */
    async getContent(id: string): Promise<{ content: string | Buffer; mimeType: string } | null> {
        const artifact = await this.get(id);
        if (!artifact) return null;

        if (artifact.content) {
            return { content: artifact.content, mimeType: artifact.mimeType };
        }

        if (artifact.storagePath) {
            const { data, error } = await this.supabase.storage
                .from(STORAGE_BUCKET)
                .download(artifact.storagePath);

            if (error) {
                this.log.error('Failed to download artifact content', { error, id });
                throw new Error(`Failed to download artifact: ${error.message}`);
            }

            const buffer = Buffer.from(await data.arrayBuffer());
            this.emit('artifact:accessed', id, artifact.createdBy);
            return { content: buffer, mimeType: artifact.mimeType };
        }

        return null;
    }

    /**
     * Update artifact metadata
     */
    async update(id: string, updates: ArtifactUpdateParams): Promise<Artifact> {
        const updateData: Partial<ArtifactRow> = {};

        if (updates.name !== undefined) updateData.name = updates.name;
        if (updates.description !== undefined) updateData.description = updates.description;
        if (updates.tags !== undefined) updateData.tags = updates.tags;
        if (updates.visibility !== undefined) updateData.visibility = updates.visibility;
        if (updates.minTierRequired !== undefined) updateData.min_tier_required = updates.minTierRequired;
        if (updates.status !== undefined) updateData.status = updates.status;

        const { data, error } = await this.supabase
            .from('artifacts')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            this.log.error('Failed to update artifact', { error, id, updates });
            throw new Error(`Failed to update artifact: ${error.message}`);
        }

        const artifact = this.rowToArtifact(data);
        this.emit('artifact:updated', artifact);
        this.log.info('Artifact updated', { id: artifact.id });

        return artifact;
    }

    /**
     * Delete an artifact
     */
    async delete(id: string): Promise<void> {
        const artifact = await this.get(id);
        if (!artifact) {
            throw new Error(`Artifact not found: ${id}`);
        }

        // Delete from storage if applicable
        if (artifact.storagePath) {
            const { error: storageError } = await this.supabase.storage
                .from(STORAGE_BUCKET)
                .remove([artifact.storagePath]);

            if (storageError) {
                this.log.warn('Failed to delete artifact from storage', { error: storageError, id });
            }
        }

        // Delete from database
        const { error } = await this.supabase
            .from('artifacts')
            .delete()
            .eq('id', id);

        if (error) {
            this.log.error('Failed to delete artifact', { error, id });
            throw new Error(`Failed to delete artifact: ${error.message}`);
        }

        this.emit('artifact:deleted', id);
        this.log.info('Artifact deleted', { id });
    }

    // -------------------------------------------------------------------------
    // Query Operations
    // -------------------------------------------------------------------------

    /**
     * List artifacts with filtering and pagination
     */
    async list(params: ArtifactQueryParams = {}): Promise<ArtifactListResult> {
        let query = this.supabase.from('artifacts').select('*', { count: 'exact' });

        // Apply filters
        if (params.taskId) {
            query = query.eq('task_id', params.taskId);
        }
        if (params.blackboardEntryId) {
            query = query.eq('blackboard_entry_id', params.blackboardEntryId);
        }
        if (params.createdBy) {
            query = query.eq('created_by', params.createdBy);
        }
        if (params.type) {
            query = query.eq('type', params.type);
        }
        if (params.status) {
            query = query.eq('status', params.status);
        }
        if (params.latestOnly) {
            query = query.eq('is_latest', true);
        }
        if (params.tags && params.tags.length > 0) {
            query = query.overlaps('tags', params.tags);
        }

        // Apply sorting
        const sortField = params.sortBy || 'created_at';
        const sortOrder = params.sortOrder === 'asc' ? true : false;
        query = query.order(sortField, { ascending: sortOrder });

        // Apply pagination
        const limit = Math.min(params.limit || DEFAULT_LIMIT, MAX_LIMIT);
        const offset = params.offset || 0;
        query = query.range(offset, offset + limit - 1);

        const { data, error, count } = await query;

        if (error) {
            this.log.error('Failed to list artifacts', { error, params });
            throw new Error(`Failed to list artifacts: ${error.message}`);
        }

        const artifacts = (data || []).map(row => this.rowToArtifact(row));
        const total = count || 0;

        return {
            artifacts,
            total,
            hasMore: offset + artifacts.length < total,
        };
    }

    /**
     * Get artifacts for a task
     */
    async getByTask(taskId: string): Promise<Artifact[]> {
        const result = await this.list({ taskId, latestOnly: true });
        return result.artifacts;
    }

    /**
     * Get artifacts by creator
     */
    async getByCreator(createdBy: AgentId): Promise<Artifact[]> {
        const result = await this.list({ createdBy, latestOnly: true });
        return result.artifacts;
    }

    // -------------------------------------------------------------------------
    // Versioning
    // -------------------------------------------------------------------------

    /**
     * Create a new version of an artifact
     */
    async createVersion(
        id: string,
        params: ArtifactVersionParams,
        createdBy: AgentId
    ): Promise<Artifact> {
        const parent = await this.get(id);
        if (!parent) {
            throw new Error(`Parent artifact not found: ${id}`);
        }

        // Create new artifact as child
        const newArtifact = await this.create(
            {
                name: parent.name,
                type: parent.type,
                content: params.content,
                file: params.file,
                mimeType: parent.mimeType,
                taskId: parent.taskId,
                blackboardEntryId: parent.blackboardEntryId,
                visibility: parent.visibility,
                minTierRequired: parent.minTierRequired,
                tags: parent.tags,
                description: params.notes || parent.description,
            },
            createdBy
        );

        // Update with version info
        const { data, error } = await this.supabase
            .from('artifacts')
            .update({
                parent_artifact_id: id,
                version: parent.version + 1,
                previous_version_id: id,
            })
            .eq('id', newArtifact.id)
            .select()
            .single();

        if (error) {
            this.log.error('Failed to update version info', { error, id: newArtifact.id });
            throw new Error(`Failed to update version info: ${error.message}`);
        }

        const versioned = this.rowToArtifact(data);
        this.emit('artifact:versioned', versioned, parent);
        this.log.info('Artifact version created', {
            id: versioned.id,
            parentId: id,
            version: versioned.version,
        });

        return versioned;
    }

    /**
     * Get version history for an artifact
     */
    async getVersionHistory(id: string): Promise<Artifact[]> {
        const versions: Artifact[] = [];
        let currentId: string | null = id;

        while (currentId) {
            const artifact = await this.get(currentId);
            if (!artifact) break;

            versions.push(artifact);
            currentId = artifact.previousVersionId || null;
        }

        return versions;
    }

    // -------------------------------------------------------------------------
    // Review Workflow
    // -------------------------------------------------------------------------

    /**
     * Submit an artifact for review
     */
    async submitForReview(id: string): Promise<Artifact> {
        return this.update(id, { status: 'PENDING_REVIEW' });
    }

    /**
     * Review an artifact (approve or reject)
     */
    async review(
        id: string,
        params: ArtifactReviewParams,
        reviewedBy: AgentId
    ): Promise<Artifact> {
        const now = new Date();
        const newStatus = params.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';

        const { data, error } = await this.supabase
            .from('artifacts')
            .update({
                status: newStatus,
                reviewed_by: reviewedBy,
                reviewed_at: now.toISOString(),
                review_notes: params.notes,
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            this.log.error('Failed to review artifact', { error, id, params });
            throw new Error(`Failed to review artifact: ${error.message}`);
        }

        const artifact = this.rowToArtifact(data);
        this.emit('artifact:reviewed', artifact, params.decision);
        this.log.info('Artifact reviewed', { id, decision: params.decision, reviewedBy });

        return artifact;
    }

    // -------------------------------------------------------------------------
    // Access Control
    // -------------------------------------------------------------------------

    /**
     * Check if an agent can access an artifact
     */
    canAccess(artifact: Artifact, agentId: AgentId, agentTier: AgentTier): boolean {
        // Creator always has access
        if (artifact.createdBy === agentId) return true;

        // Check explicit allow list
        if (artifact.allowedAgentIds?.includes(agentId)) return true;

        switch (artifact.visibility) {
            case 'PUBLIC':
                return true;

            case 'PRIVATE':
                return false;

            case 'TIER_RESTRICTED':
                return agentTier >= (artifact.minTierRequired || 0);

            case 'TASK_PARTICIPANTS':
                // This would need task participant info passed in
                // For now, allow if tier is high enough
                return agentTier >= 2;

            default:
                return false;
        }
    }

    // -------------------------------------------------------------------------
    // Helper Methods
    // -------------------------------------------------------------------------

    /**
     * Detect MIME type from filename
     */
    private detectMimeType(filename: string): string {
        const ext = extname(filename).toLowerCase();
        return MIME_TYPES[ext] || 'application/octet-stream';
    }

    /**
     * Infer artifact type from MIME type
     */
    private inferArtifactType(mimeType: string): ArtifactType {
        return TYPE_FROM_MIME[mimeType] || 'DATA';
    }

    /**
     * Check if MIME type is text-based
     */
    private isTextMimeType(mimeType: string): boolean {
        return (
            mimeType.startsWith('text/') ||
            mimeType === 'application/json' ||
            mimeType === 'application/xml'
        );
    }

    /**
     * Calculate SHA-256 checksum
     */
    private calculateChecksum(data: Buffer): string {
        return createHash('sha256').update(data).digest('hex');
    }

    /**
     * Upload file to Supabase Storage
     */
    private async uploadToStorage(
        artifactId: string,
        data: Buffer,
        mimeType: string,
        taskId?: string
    ): Promise<{ path: string; url: string }> {
        const path = taskId
            ? `tasks/${taskId}/${artifactId}`
            : `general/${artifactId}`;

        const { error } = await this.supabase.storage
            .from(STORAGE_BUCKET)
            .upload(path, data, {
                contentType: mimeType,
                upsert: false,
            });

        if (error) {
            this.log.error('Failed to upload to storage', { error, path });
            throw new Error(`Failed to upload artifact: ${error.message}`);
        }

        // Get public URL (or signed URL for private buckets)
        const { data: urlData } = this.supabase.storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(path);

        return {
            path,
            url: urlData.publicUrl,
        };
    }

    /**
     * Convert database row to Artifact object
     */
    private rowToArtifact(row: ArtifactRow): Artifact {
        return {
            id: row.id,
            name: row.name,
            type: row.type as ArtifactType,
            mimeType: row.mime_type,
            content: row.content || undefined,
            storagePath: row.storage_path || undefined,
            storageUrl: row.storage_url || undefined,
            size: row.size_bytes,
            checksum: row.checksum || undefined,
            originalFilename: row.original_filename || undefined,
            createdBy: row.created_by,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
            taskId: row.task_id || undefined,
            blackboardEntryId: row.blackboard_entry_id || undefined,
            parentArtifactId: row.parent_artifact_id || undefined,
            visibility: row.visibility as ArtifactVisibility,
            minTierRequired: row.min_tier_required as AgentTier | undefined,
            allowedAgentIds: row.allowed_agent_ids || undefined,
            status: row.status as Artifact['status'],
            reviewedBy: row.reviewed_by || undefined,
            reviewedAt: row.reviewed_at ? new Date(row.reviewed_at) : undefined,
            reviewNotes: row.review_notes || undefined,
            tags: row.tags || [],
            description: row.description || undefined,
            version: row.version,
            previousVersionId: row.previous_version_id || undefined,
            isLatest: row.is_latest,
        };
    }

    // -------------------------------------------------------------------------
    // Statistics
    // -------------------------------------------------------------------------

    /**
     * Get artifact statistics
     */
    async getStats(): Promise<{
        total: number;
        byType: Record<ArtifactType, number>;
        byStatus: Record<string, number>;
        totalSizeBytes: number;
    }> {
        const { data, error } = await this.supabase
            .from('artifacts')
            .select('type, status, size_bytes');

        if (error) {
            this.log.error('Failed to get artifact stats', { error });
            throw new Error(`Failed to get stats: ${error.message}`);
        }

        const byType: Record<string, number> = {};
        const byStatus: Record<string, number> = {};
        let totalSizeBytes = 0;

        for (const row of data || []) {
            byType[row.type] = (byType[row.type] || 0) + 1;
            byStatus[row.status] = (byStatus[row.status] || 0) + 1;
            totalSizeBytes += row.size_bytes || 0;
        }

        return {
            total: data?.length || 0,
            byType: byType as Record<ArtifactType, number>,
            byStatus,
            totalSizeBytes,
        };
    }
}

// ============================================================================
// Factory Function
// ============================================================================

let artifactServiceInstance: ArtifactService | null = null;

/**
 * Get or create the ArtifactService singleton
 */
export function getArtifactService(supabaseClient: SupabaseClient): ArtifactService {
    if (!artifactServiceInstance) {
        artifactServiceInstance = new ArtifactService(supabaseClient);
    }
    return artifactServiceInstance;
}
