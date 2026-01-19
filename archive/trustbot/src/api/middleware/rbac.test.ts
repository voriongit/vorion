/**
 * RBAC Middleware Tests
 *
 * Story 1.1: RBAC Middleware & Role-Based Access
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import {
    requireRole,
    requireAuth,
    requireOrgAccess,
    hasRole,
    extractUserContext,
    getUserContext,
    getOrgId,
    getUserRole,
    unauthorizedError,
    forbiddenError,
    notFoundError,
    type UserRole,
    type UserContext,
} from './rbac.js';

// ============================================================================
// Test Helpers
// ============================================================================

function createTestApp() {
    const app = new Hono();
    return app;
}

async function makeRequest(
    app: Hono,
    path: string,
    options: { headers?: Record<string, string> } = {}
) {
    const request = new Request(`http://localhost${path}`, {
        method: 'GET',
        headers: options.headers,
    });
    return app.fetch(request);
}

// ============================================================================
// RFC 7807 Error Response Tests
// ============================================================================

describe('RFC 7807 Error Responses', () => {
    describe('unauthorizedError', () => {
        it('returns correct 401 structure', () => {
            const error = unauthorizedError();
            expect(error).toEqual({
                type: 'https://aurais.ai/errors/unauthorized',
                title: 'Unauthorized',
                status: 401,
                detail: 'Authentication required',
            });
        });

        it('accepts custom detail message', () => {
            const error = unauthorizedError('Token expired');
            expect(error.detail).toBe('Token expired');
        });
    });

    describe('forbiddenError', () => {
        it('returns correct 403 structure', () => {
            const error = forbiddenError();
            expect(error).toEqual({
                type: 'https://aurais.ai/errors/forbidden',
                title: 'Forbidden',
                status: 403,
                detail: 'Insufficient permissions',
            });
        });

        it('accepts custom detail message', () => {
            const error = forbiddenError('Director role required');
            expect(error.detail).toBe('Director role required');
        });
    });

    describe('notFoundError', () => {
        it('returns correct 404 structure', () => {
            const error = notFoundError();
            expect(error).toEqual({
                type: 'https://aurais.ai/errors/not-found',
                title: 'Not Found',
                status: 404,
                detail: 'Resource not found',
            });
        });
    });
});

// ============================================================================
// Role Hierarchy Tests
// ============================================================================

describe('hasRole', () => {
    it('returns true for exact role match', () => {
        expect(hasRole('operator', ['operator'])).toBe(true);
        expect(hasRole('supervisor', ['supervisor'])).toBe(true);
        expect(hasRole('director', ['director'])).toBe(true);
    });

    it('returns true for higher role than required', () => {
        // Supervisor can access operator routes
        expect(hasRole('supervisor', ['operator'])).toBe(true);
        // Director can access supervisor routes
        expect(hasRole('director', ['supervisor'])).toBe(true);
        // Admin can access everything
        expect(hasRole('admin', ['operator'])).toBe(true);
        expect(hasRole('admin', ['supervisor'])).toBe(true);
        expect(hasRole('admin', ['director'])).toBe(true);
    });

    it('returns false for lower role than required', () => {
        expect(hasRole('viewer', ['operator'])).toBe(false);
        expect(hasRole('operator', ['supervisor'])).toBe(false);
        expect(hasRole('supervisor', ['director'])).toBe(false);
    });

    it('returns true if any required role matches', () => {
        expect(hasRole('operator', ['viewer', 'operator'])).toBe(true);
        expect(hasRole('supervisor', ['operator', 'director'])).toBe(true);
    });

    it('handles compliance role correctly (same level as director)', () => {
        expect(hasRole('compliance', ['compliance'])).toBe(true);
        expect(hasRole('compliance', ['supervisor'])).toBe(true);
        expect(hasRole('compliance', ['operator'])).toBe(true);
    });
});

// ============================================================================
// requireAuth Middleware Tests
// ============================================================================

describe('requireAuth', () => {
    it('returns 401 when no authentication provided', async () => {
        const app = createTestApp();
        app.use('*', requireAuth());
        app.get('/test', (c) => c.json({ ok: true }));

        const res = await makeRequest(app, '/test');

        expect(res.status).toBe(401);
        const body = await res.json();
        expect(body.type).toBe('https://aurais.ai/errors/unauthorized');
        expect(body.title).toBe('Unauthorized');
        expect(body.status).toBe(401);
    });

    it('allows access with valid demo auth header', async () => {
        const app = createTestApp();
        app.use('*', requireAuth());
        app.get('/test', (c) => {
            const user = getUserContext(c);
            return c.json({ ok: true, user });
        });

        const res = await makeRequest(app, '/test', {
            headers: { Authorization: 'Demo demo@aurais.ai' },
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.ok).toBe(true);
        expect(body.user.email).toBe('demo@aurais.ai');
        expect(body.user.role).toBe('operator');
        expect(body.user.orgId).toBe('demo-org');
    });

    it('sets user context correctly for downstream handlers', async () => {
        const app = createTestApp();
        app.use('*', requireAuth());
        app.get('/test', (c) => {
            return c.json({
                user: getUserContext(c),
                orgId: getOrgId(c),
                role: getUserRole(c),
            });
        });

        const res = await makeRequest(app, '/test', {
            headers: { Authorization: 'Demo supervisor@aurais.ai' },
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.user.role).toBe('supervisor');
        expect(body.orgId).toBe('demo-org');
        expect(body.role).toBe('supervisor');
    });

    it('continues without auth when optional is true', async () => {
        const app = createTestApp();
        app.use('*', requireAuth({ optional: true }));
        app.get('/test', (c) => c.json({ ok: true, user: getUserContext(c) }));

        const res = await makeRequest(app, '/test');

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.ok).toBe(true);
        expect(body.user).toBeUndefined();
    });
});

// ============================================================================
// requireRole Middleware Tests
// ============================================================================

describe('requireRole', () => {
    it('returns 401 when no authentication provided', async () => {
        const app = createTestApp();
        app.get('/test', requireRole('operator'), (c) => c.json({ ok: true }));

        const res = await makeRequest(app, '/test');

        expect(res.status).toBe(401);
        const body = await res.json();
        expect(body.type).toBe('https://aurais.ai/errors/unauthorized');
    });

    it('returns 403 when role is insufficient', async () => {
        const app = createTestApp();
        app.get('/test', requireRole('supervisor'), (c) => c.json({ ok: true }));

        const res = await makeRequest(app, '/test', {
            headers: { Authorization: 'Demo demo@aurais.ai' }, // operator role
        });

        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.type).toBe('https://aurais.ai/errors/forbidden');
        expect(body.detail).toContain('supervisor');
        expect(body.detail).toContain('operator');
    });

    it('allows access with exact required role', async () => {
        const app = createTestApp();
        app.get('/test', requireRole('operator'), (c) => c.json({ ok: true }));

        const res = await makeRequest(app, '/test', {
            headers: { Authorization: 'Demo demo@aurais.ai' },
        });

        expect(res.status).toBe(200);
    });

    it('allows access with higher role', async () => {
        const app = createTestApp();
        app.get('/test', requireRole('operator'), (c) => c.json({ ok: true }));

        const res = await makeRequest(app, '/test', {
            headers: { Authorization: 'Demo supervisor@aurais.ai' },
        });

        expect(res.status).toBe(200);
    });

    it('allows access when any required role matches', async () => {
        const app = createTestApp();
        app.get('/test', requireRole('supervisor', 'compliance'), (c) => c.json({ ok: true }));

        const res = await makeRequest(app, '/test', {
            headers: { Authorization: 'Demo compliance@aurais.ai' },
        });

        expect(res.status).toBe(200);
    });

    it('rejects viewer role from operator-required endpoint', async () => {
        const app = createTestApp();
        app.get('/test', requireRole('operator'), (c) => c.json({ ok: true }));

        const res = await makeRequest(app, '/test', {
            headers: { Authorization: 'Demo viewer@aurais.ai' },
        });

        expect(res.status).toBe(403);
    });
});

// ============================================================================
// requireOrgAccess Middleware Tests
// ============================================================================

describe('requireOrgAccess', () => {
    it('allows access when org_id matches', async () => {
        const app = createTestApp();
        app.use('*', requireAuth());
        app.get(
            '/agents/:id',
            requireOrgAccess(() => 'demo-org'),
            (c) => c.json({ ok: true })
        );

        const res = await makeRequest(app, '/agents/123', {
            headers: { Authorization: 'Demo demo@aurais.ai' },
        });

        expect(res.status).toBe(200);
    });

    it('returns 404 when org_id does not match', async () => {
        const app = createTestApp();
        app.use('*', requireAuth());
        app.get(
            '/agents/:id',
            requireOrgAccess(() => 'other-org'),
            (c) => c.json({ ok: true })
        );

        const res = await makeRequest(app, '/agents/123', {
            headers: { Authorization: 'Demo demo@aurais.ai' },
        });

        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.type).toBe('https://aurais.ai/errors/not-found');
    });

    it('returns 404 when resource does not exist (null org_id)', async () => {
        const app = createTestApp();
        app.use('*', requireAuth());
        app.get(
            '/agents/:id',
            requireOrgAccess(() => null),
            (c) => c.json({ ok: true })
        );

        const res = await makeRequest(app, '/agents/123', {
            headers: { Authorization: 'Demo demo@aurais.ai' },
        });

        expect(res.status).toBe(404);
    });

    it('supports async org_id resolution', async () => {
        const app = createTestApp();
        app.use('*', requireAuth());
        app.get(
            '/agents/:id',
            requireOrgAccess(async () => {
                // Simulate async database lookup
                await new Promise((r) => setTimeout(r, 10));
                return 'demo-org';
            }),
            (c) => c.json({ ok: true })
        );

        const res = await makeRequest(app, '/agents/123', {
            headers: { Authorization: 'Demo demo@aurais.ai' },
        });

        expect(res.status).toBe(200);
    });

    it('returns 401 when no org context available', async () => {
        const app = createTestApp();
        // Note: No requireAuth middleware, so orgId won't be set
        app.get(
            '/agents/:id',
            requireOrgAccess(() => 'demo-org'),
            (c) => c.json({ ok: true })
        );

        const res = await makeRequest(app, '/agents/123');

        expect(res.status).toBe(401);
    });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Integration: Mission Control Routes', () => {
    it('protects dashboard endpoint with operator role', async () => {
        const app = createTestApp();

        // Simulate Mission Control dashboard route
        app.get(
            '/api/v1/mission-control/dashboard',
            requireRole('operator'),
            (c) => {
                const user = getUserContext(c);
                return c.json({
                    orgId: user?.orgId,
                    agents: [],
                    stats: { total: 0 },
                });
            }
        );

        // Without auth - 401
        const res1 = await makeRequest(app, '/api/v1/mission-control/dashboard');
        expect(res1.status).toBe(401);

        // With operator auth - 200
        const res2 = await makeRequest(app, '/api/v1/mission-control/dashboard', {
            headers: { Authorization: 'Demo demo@aurais.ai' },
        });
        expect(res2.status).toBe(200);
        const body = await res2.json();
        expect(body.orgId).toBe('demo-org');
    });

    it('protects supervisor endpoints from operators', async () => {
        const app = createTestApp();

        app.get(
            '/api/v1/mission-control/team',
            requireRole('supervisor'),
            (c) => c.json({ operators: [] })
        );

        // Operator - 403
        const res1 = await makeRequest(app, '/api/v1/mission-control/team', {
            headers: { Authorization: 'Demo demo@aurais.ai' },
        });
        expect(res1.status).toBe(403);

        // Supervisor - 200
        const res2 = await makeRequest(app, '/api/v1/mission-control/team', {
            headers: { Authorization: 'Demo supervisor@aurais.ai' },
        });
        expect(res2.status).toBe(200);
    });

    it('prevents cross-org data access', async () => {
        const app = createTestApp();

        // Mock agent data
        const agents: Record<string, { id: string; orgId: string }> = {
            'agent-1': { id: 'agent-1', orgId: 'demo-org' },
            'agent-2': { id: 'agent-2', orgId: 'other-org' },
        };

        app.use('*', requireAuth());
        app.get(
            '/api/v1/mission-control/agents/:id',
            requireOrgAccess((c) => {
                const id = c.req.param('id');
                return agents[id]?.orgId;
            }),
            (c) => {
                const id = c.req.param('id');
                return c.json(agents[id]);
            }
        );

        // demo-org user accessing demo-org agent - 200
        const res1 = await makeRequest(app, '/api/v1/mission-control/agents/agent-1', {
            headers: { Authorization: 'Demo demo@aurais.ai' },
        });
        expect(res1.status).toBe(200);

        // demo-org user accessing other-org agent - 404 (not 403!)
        const res2 = await makeRequest(app, '/api/v1/mission-control/agents/agent-2', {
            headers: { Authorization: 'Demo demo@aurais.ai' },
        });
        expect(res2.status).toBe(404);
    });
});
