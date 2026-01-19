/**
 * Story 2.3: Approve Action Request - API Tests
 * FR14: Approve pending action requests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { missionControlRoutes } from './index.js';

// Mock the RBAC middleware
vi.mock('../../middleware/rbac.js', () => ({
    requireRole: () => async (c: unknown, next: () => Promise<void>) => {
        await next();
    },
    requireAuth: () => async (c: unknown, next: () => Promise<void>) => {
        await next();
    },
    getUserContext: () => ({
        id: 'test-user-id',
        email: 'test@example.com',
        role: 'operator',
    }),
    getOrgId: () => 'demo-org',
}));

// ============================================================================
// Test Setup
// ============================================================================

function createTestApp() {
    const app = new Hono();
    app.route('/api/v1/mission-control', missionControlRoutes);
    return app;
}

describe('POST /api/v1/mission-control/decisions/:id/approve', () => {
    let app: Hono;

    beforeEach(() => {
        app = createTestApp();
    });

    // ========================================================================
    // AC1: Approve Action
    // ========================================================================

    describe('AC1: Approve Action', () => {
        it('approves a pending decision', async () => {
            const res = await app.request(
                '/api/v1/mission-control/decisions/ar-001/approve',
                { method: 'POST' }
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.decision.status).toBe('approved');
            expect(body.decision.decidedBy).toBe('test-user-id');
            expect(body.decision.decidedAt).toBeDefined();
        });

        it('includes review metrics in response', async () => {
            const res = await app.request(
                '/api/v1/mission-control/decisions/ar-002/approve',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        reviewNotes: 'Looks good',
                        reviewMetrics: {
                            reviewTimeMs: 15000,
                            detailViewsAccessed: true,
                            sampleDataViewed: false,
                        },
                    }),
                }
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.decision.reviewMetrics).toBeDefined();
            expect(body.decision.reviewMetrics.reviewTimeMs).toBe(15000);
            expect(body.decision.reviewMetrics.detailViewsAccessed).toBe(true);
        });
    });

    // ========================================================================
    // AC3: Error Handling
    // ========================================================================

    describe('AC3: Error Handling', () => {
        it('returns 404 for non-existent decision', async () => {
            const res = await app.request(
                '/api/v1/mission-control/decisions/non-existent/approve',
                { method: 'POST' }
            );

            expect(res.status).toBe(404);
            const body = await res.json();
            expect(body.type).toBe('https://aurais.ai/errors/not-found');
            expect(body.detail).toBe('Decision not found');
        });

        it('returns 409 for already decided decision', async () => {
            // First approval
            await app.request(
                '/api/v1/mission-control/decisions/ar-003/approve',
                { method: 'POST' }
            );

            // Second attempt
            const res = await app.request(
                '/api/v1/mission-control/decisions/ar-003/approve',
                { method: 'POST' }
            );

            expect(res.status).toBe(409);
            const body = await res.json();
            expect(body.type).toBe('https://aurais.ai/errors/conflict');
            expect(body.detail).toContain('already been approved');
        });
    });
});

describe('POST /api/v1/mission-control/decisions/:id/deny', () => {
    let app: Hono;

    beforeEach(() => {
        app = createTestApp();
    });

    it('denies a pending decision with reason', async () => {
        const res = await app.request(
            '/api/v1/mission-control/decisions/ar-004/deny',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reason: 'Insufficient justification for this action',
                }),
            }
        );

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.decision.status).toBe('denied');
        expect(body.decision.reason).toBe('Insufficient justification for this action');
    });

    it('returns 404 for non-existent decision', async () => {
        const res = await app.request(
            '/api/v1/mission-control/decisions/non-existent/deny',
            { method: 'POST' }
        );

        expect(res.status).toBe(404);
    });
});
