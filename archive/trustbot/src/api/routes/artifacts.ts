/**
 * Artifact API Routes
 *
 * REST endpoints for managing agent artifacts (files, documents, deliverables).
 * Supports CRUD operations, versioning, review workflow, and file upload/download.
 */

import { Hono } from 'hono';
import { getArtifactService } from '../../core/ArtifactService.js';
import { getSupabasePersistence, hasSupabaseConfig } from '../../core/SupabasePersistence.js';
import { logger } from '../../lib/logger.js';
import type {
    ArtifactCreateParams,
    ArtifactUpdateParams,
    ArtifactQueryParams,
    ArtifactReviewParams,
    ArtifactType,
    ArtifactStatus,
} from '../../types/artifact.js';

const log = logger.child({ component: 'ArtifactRoutes' });

// ============================================================================
// Route Factory
// ============================================================================

export function createArtifactRoutes(): Hono {
    const app = new Hono();

    // -------------------------------------------------------------------------
    // Middleware: Check Supabase availability
    // -------------------------------------------------------------------------

    app.use('*', async (c, next) => {
        if (!hasSupabaseConfig()) {
            return c.json(
                {
                    error: 'Artifact service not available',
                    message: 'Supabase configuration required for artifact storage',
                    code: 'SUPABASE_NOT_CONFIGURED',
                },
                503
            );
        }
        return next();
    });

    // -------------------------------------------------------------------------
    // Helper: Get service instance
    // -------------------------------------------------------------------------

    const getService = () => {
        const persistence = getSupabasePersistence();
        return getArtifactService(persistence.getClient());
    };

    // -------------------------------------------------------------------------
    // POST /artifacts - Create a new artifact
    // -------------------------------------------------------------------------

    app.post('/', async (c) => {
        try {
            const contentType = c.req.header('content-type') || '';

            let params: ArtifactCreateParams;
            let createdBy: string;

            if (contentType.includes('multipart/form-data')) {
                // Handle file upload
                const formData = await c.req.formData();
                const file = formData.get('file') as File | null;
                const metadata = formData.get('metadata') as string | null;

                if (!file) {
                    return c.json({ error: 'No file provided' }, 400);
                }

                const meta = metadata ? JSON.parse(metadata) : {};
                const buffer = Buffer.from(await file.arrayBuffer());

                params = {
                    name: meta.name || file.name,
                    type: meta.type as ArtifactType,
                    file: buffer,
                    mimeType: file.type,
                    taskId: meta.taskId,
                    blackboardEntryId: meta.blackboardEntryId,
                    visibility: meta.visibility,
                    minTierRequired: meta.minTierRequired,
                    tags: meta.tags,
                    description: meta.description,
                };
                createdBy = meta.createdBy || 'UNKNOWN';
            } else {
                // Handle JSON body
                const body = await c.req.json<ArtifactCreateParams & { createdBy: string }>();
                createdBy = body.createdBy || 'UNKNOWN';
                params = {
                    name: body.name,
                    type: body.type,
                    content: body.content,
                    mimeType: body.mimeType,
                    taskId: body.taskId,
                    blackboardEntryId: body.blackboardEntryId,
                    visibility: body.visibility,
                    minTierRequired: body.minTierRequired,
                    tags: body.tags,
                    description: body.description,
                };
            }

            if (!params.name) {
                return c.json({ error: 'Artifact name is required' }, 400);
            }

            const service = getService();
            const artifact = await service.create(params, createdBy);

            log.info('Artifact created via API', { id: artifact.id, name: artifact.name });
            return c.json(artifact, 201);
        } catch (error: any) {
            log.error('Failed to create artifact', { error: error.message });
            return c.json({ error: error.message }, 500);
        }
    });

    // -------------------------------------------------------------------------
    // GET /artifacts - List artifacts with filtering
    // -------------------------------------------------------------------------

    app.get('/', async (c) => {
        try {
            const query: ArtifactQueryParams = {
                taskId: c.req.query('taskId') || undefined,
                blackboardEntryId: c.req.query('blackboardEntryId') || undefined,
                createdBy: c.req.query('createdBy') || undefined,
                type: c.req.query('type') as ArtifactType | undefined,
                status: c.req.query('status') as ArtifactStatus | undefined,
                tags: c.req.query('tags')?.split(',').filter(Boolean),
                latestOnly: c.req.query('latestOnly') === 'true',
                offset: parseInt(c.req.query('offset') || '0'),
                limit: parseInt(c.req.query('limit') || '50'),
                sortBy: c.req.query('sortBy') as ArtifactQueryParams['sortBy'],
                sortOrder: c.req.query('sortOrder') as ArtifactQueryParams['sortOrder'],
            };

            const service = getService();
            const result = await service.list(query);

            return c.json(result);
        } catch (error: any) {
            log.error('Failed to list artifacts', { error: error.message });
            return c.json({ error: error.message }, 500);
        }
    });

    // -------------------------------------------------------------------------
    // GET /artifacts/stats - Get artifact statistics
    // -------------------------------------------------------------------------

    app.get('/stats', async (c) => {
        try {
            const service = getService();
            const stats = await service.getStats();
            return c.json(stats);
        } catch (error: any) {
            log.error('Failed to get artifact stats', { error: error.message });
            return c.json({ error: error.message }, 500);
        }
    });

    // -------------------------------------------------------------------------
    // GET /artifacts/:id - Get artifact metadata
    // -------------------------------------------------------------------------

    app.get('/:id', async (c) => {
        try {
            const id = c.req.param('id');
            const service = getService();
            const artifact = await service.get(id);

            if (!artifact) {
                return c.json({ error: 'Artifact not found' }, 404);
            }

            return c.json(artifact);
        } catch (error: any) {
            log.error('Failed to get artifact', { error: error.message });
            return c.json({ error: error.message }, 500);
        }
    });

    // -------------------------------------------------------------------------
    // GET /artifacts/:id/content - Download artifact content
    // -------------------------------------------------------------------------

    app.get('/:id/content', async (c) => {
        try {
            const id = c.req.param('id');
            const service = getService();
            const result = await service.getContent(id);

            if (!result) {
                return c.json({ error: 'Artifact not found or has no content' }, 404);
            }

            // Set appropriate headers
            c.header('Content-Type', result.mimeType);

            // Get artifact for filename
            const artifact = await service.get(id);
            if (artifact) {
                c.header(
                    'Content-Disposition',
                    `attachment; filename="${encodeURIComponent(artifact.name)}"`
                );
            }

            // Return content
            if (typeof result.content === 'string') {
                return c.text(result.content);
            } else {
                // For Buffer, create a proper Response with binary data
                return new Response(result.content, {
                    headers: {
                        'Content-Type': result.mimeType,
                    },
                });
            }
        } catch (error: any) {
            log.error('Failed to download artifact', { error: error.message });
            return c.json({ error: error.message }, 500);
        }
    });

    // -------------------------------------------------------------------------
    // PUT /artifacts/:id - Update artifact metadata
    // -------------------------------------------------------------------------

    app.put('/:id', async (c) => {
        try {
            const id = c.req.param('id');
            const body = await c.req.json<ArtifactUpdateParams>();

            const service = getService();
            const artifact = await service.update(id, body);

            log.info('Artifact updated via API', { id });
            return c.json(artifact);
        } catch (error: any) {
            log.error('Failed to update artifact', { error: error.message });
            if (error.message.includes('not found')) {
                return c.json({ error: 'Artifact not found' }, 404);
            }
            return c.json({ error: error.message }, 500);
        }
    });

    // -------------------------------------------------------------------------
    // DELETE /artifacts/:id - Delete artifact
    // -------------------------------------------------------------------------

    app.delete('/:id', async (c) => {
        try {
            const id = c.req.param('id');
            const service = getService();
            await service.delete(id);

            log.info('Artifact deleted via API', { id });
            return c.json({ success: true, message: 'Artifact deleted' });
        } catch (error: any) {
            log.error('Failed to delete artifact', { error: error.message });
            if (error.message.includes('not found')) {
                return c.json({ error: 'Artifact not found' }, 404);
            }
            return c.json({ error: error.message }, 500);
        }
    });

    // -------------------------------------------------------------------------
    // POST /artifacts/:id/versions - Create new version
    // -------------------------------------------------------------------------

    app.post('/:id/versions', async (c) => {
        try {
            const id = c.req.param('id');
            const contentType = c.req.header('content-type') || '';

            let content: string | undefined;
            let file: Buffer | undefined;
            let notes: string | undefined;
            let createdBy: string;

            if (contentType.includes('multipart/form-data')) {
                const formData = await c.req.formData();
                const uploadedFile = formData.get('file') as File | null;
                const metadata = formData.get('metadata') as string | null;

                if (uploadedFile) {
                    file = Buffer.from(await uploadedFile.arrayBuffer());
                }

                const meta = metadata ? JSON.parse(metadata) : {};
                notes = meta.notes;
                createdBy = meta.createdBy || 'UNKNOWN';
            } else {
                const body = await c.req.json<{
                    content?: string;
                    notes?: string;
                    createdBy: string;
                }>();
                content = body.content;
                notes = body.notes;
                createdBy = body.createdBy || 'UNKNOWN';
            }

            const service = getService();
            const newVersion = await service.createVersion(
                id,
                { content, file, notes },
                createdBy
            );

            log.info('Artifact version created via API', {
                id: newVersion.id,
                parentId: id,
                version: newVersion.version,
            });
            return c.json(newVersion, 201);
        } catch (error: any) {
            log.error('Failed to create artifact version', { error: error.message });
            if (error.message.includes('not found')) {
                return c.json({ error: 'Parent artifact not found' }, 404);
            }
            return c.json({ error: error.message }, 500);
        }
    });

    // -------------------------------------------------------------------------
    // GET /artifacts/:id/versions - Get version history
    // -------------------------------------------------------------------------

    app.get('/:id/versions', async (c) => {
        try {
            const id = c.req.param('id');
            const service = getService();
            const versions = await service.getVersionHistory(id);

            return c.json({
                artifactId: id,
                versions,
                count: versions.length,
            });
        } catch (error: any) {
            log.error('Failed to get version history', { error: error.message });
            return c.json({ error: error.message }, 500);
        }
    });

    // -------------------------------------------------------------------------
    // POST /artifacts/:id/submit-review - Submit for review
    // -------------------------------------------------------------------------

    app.post('/:id/submit-review', async (c) => {
        try {
            const id = c.req.param('id');
            const service = getService();
            const artifact = await service.submitForReview(id);

            log.info('Artifact submitted for review', { id });
            return c.json(artifact);
        } catch (error: any) {
            log.error('Failed to submit artifact for review', { error: error.message });
            return c.json({ error: error.message }, 500);
        }
    });

    // -------------------------------------------------------------------------
    // POST /artifacts/:id/review - Review artifact (approve/reject)
    // -------------------------------------------------------------------------

    app.post('/:id/review', async (c) => {
        try {
            const id = c.req.param('id');
            const body = await c.req.json<ArtifactReviewParams & { reviewedBy: string }>();

            if (!body.decision || !['APPROVE', 'REJECT'].includes(body.decision)) {
                return c.json({ error: 'Invalid decision. Must be APPROVE or REJECT' }, 400);
            }

            const service = getService();
            const artifact = await service.review(
                id,
                { decision: body.decision, notes: body.notes },
                body.reviewedBy || 'UNKNOWN'
            );

            log.info('Artifact reviewed', { id, decision: body.decision });
            return c.json(artifact);
        } catch (error: any) {
            log.error('Failed to review artifact', { error: error.message });
            return c.json({ error: error.message }, 500);
        }
    });

    // -------------------------------------------------------------------------
    // GET /artifacts/task/:taskId - Get artifacts for a task
    // -------------------------------------------------------------------------

    app.get('/task/:taskId', async (c) => {
        try {
            const taskId = c.req.param('taskId');
            const service = getService();
            const artifacts = await service.getByTask(taskId);

            return c.json({
                taskId,
                artifacts,
                count: artifacts.length,
            });
        } catch (error: any) {
            log.error('Failed to get task artifacts', { error: error.message });
            return c.json({ error: error.message }, 500);
        }
    });

    return app;
}

// ============================================================================
// Default Export
// ============================================================================

export const artifactRoutes = createArtifactRoutes();
