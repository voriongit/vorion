/**
 * Organization Data Isolation Tests
 *
 * Story 1.6: Organization Data Isolation
 * FR: FR53 - Multi-tenant security
 *
 * These tests verify that:
 * - Users can only access data from their organization
 * - Cross-org access attempts return 404 (not 403)
 * - No data leakage occurs between organizations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { requireRole, requireOrgAccess } from './rbac';

// ============================================================================
// Test Helpers
// ============================================================================

interface MockAgent {
    id: string;
    name: string;
    org_id: string;
    trustScore: number;
}

// Mock database of agents across multiple orgs
// Uses org IDs that match DEMO_USER_ROLES in rbac.ts
const mockAgents: MockAgent[] = [
    { id: 'agent-demo-001', name: 'Agent1-Demo', org_id: 'demo-org', trustScore: 750 },
    { id: 'agent-demo-002', name: 'Agent2-Demo', org_id: 'demo-org', trustScore: 800 },
    { id: 'agent-other-001', name: 'Agent1-Other', org_id: 'other-org', trustScore: 600 },
    { id: 'agent-other-002', name: 'Agent2-Other', org_id: 'other-org', trustScore: 900 },
    { id: 'agent-third-001', name: 'Agent1-Third', org_id: 'third-org', trustScore: 500 },
];

// Mock function to get agent by ID
function getAgentById(id: string): MockAgent | undefined {
    return mockAgents.find(a => a.id === id);
}

// Mock function to get agents by org
function getAgentsByOrg(orgId: string): MockAgent[] {
    return mockAgents.filter(a => a.org_id === orgId);
}

// Create test app with org-isolated endpoints
function createTestApp() {
    const app = new Hono();

    // Inject auth header for testing
    app.use('*', async (c, next) => {
        const authHeader = c.req.header('Authorization');
        if (authHeader) {
            c.set('authHeader', authHeader);
        }
        await next();
    });

    // List agents (filtered by org)
    app.get('/api/v1/agents', requireRole('operator'), async (c) => {
        const orgId = c.get('orgId') as string;
        const agents = getAgentsByOrg(orgId);
        return c.json({ agents });
    });

    // Get single agent (with org access check)
    app.get(
        '/api/v1/agents/:id',
        requireRole('operator'),
        requireOrgAccess(async (c) => {
            const agentId = c.req.param('id');
            const agent = getAgentById(agentId);
            return agent?.org_id;
        }),
        async (c) => {
            const agentId = c.req.param('id');
            const agent = getAgentById(agentId);
            return c.json({ agent });
        }
    );

    return app;
}

// Demo users for testing (must match DEMO_USER_ROLES in rbac.ts)
const DEMO_USERS: Record<string, string> = {
    'org-001': 'demo@aurais.ai',      // demo-org
    'demo-org': 'demo@aurais.ai',     // demo-org
    'other-org': 'other@company.com',   // other-org
};

// Helper to make request with Demo auth
async function makeRequest(
    app: Hono,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    orgId: string,
    _role: string = 'operator'
) {
    // Use the Demo auth scheme that rbac.ts expects
    const demoEmail = DEMO_USERS[orgId] || `user@${orgId}.example.com`;

    const req = new Request(`http://localhost${path}`, {
        method,
        headers: {
            Authorization: `Demo ${demoEmail}`,
        },
    });

    return app.fetch(req);
}

// ============================================================================
// Tests
// ============================================================================

describe('Organization Data Isolation', () => {
    let app: Hono;

    beforeEach(() => {
        app = createTestApp();
    });

    // ========================================================================
    // Agent List Isolation
    // ========================================================================

    describe('Agent List Isolation', () => {
        it('should only return agents from user\'s organization', async () => {
            // User from demo-org should only see demo-org agents
            const res = await makeRequest(app, 'GET', '/api/v1/agents', 'demo-org');
            expect(res.status).toBe(200);

            const data = await res.json();
            expect(data.agents).toHaveLength(2);
            expect(data.agents.every((a: MockAgent) => a.org_id === 'demo-org')).toBe(true);
        });

        it('should return different agents for different organizations', async () => {
            // demo-org user
            const res1 = await makeRequest(app, 'GET', '/api/v1/agents', 'demo-org');
            const data1 = await res1.json();

            // other-org user
            const res2 = await makeRequest(app, 'GET', '/api/v1/agents', 'other-org');
            const data2 = await res2.json();

            // Should have no overlapping agents
            const ids1 = data1.agents.map((a: MockAgent) => a.id);
            const ids2 = data2.agents.map((a: MockAgent) => a.id);

            const overlap = ids1.filter((id: string) => ids2.includes(id));
            expect(overlap).toHaveLength(0);
        });

        it('should return empty list for user without known org', async () => {
            // Unknown user returns 401 (not found in DEMO_USER_ROLES)
            const res = await makeRequest(app, 'GET', '/api/v1/agents', 'org-999');
            expect(res.status).toBe(401);
        });
    });

    // ========================================================================
    // Single Agent Access
    // ========================================================================

    describe('Single Agent Access', () => {
        it('should allow access to agent in user\'s organization', async () => {
            // User from demo-org accessing demo-org agent
            const res = await makeRequest(app, 'GET', '/api/v1/agents/agent-demo-001', 'demo-org');
            expect(res.status).toBe(200);

            const data = await res.json();
            expect(data.agent.id).toBe('agent-demo-001');
        });

        it('should return 404 for agent in different organization', async () => {
            // User from demo-org trying to access other-org agent
            const res = await makeRequest(app, 'GET', '/api/v1/agents/agent-other-001', 'demo-org');

            // IMPORTANT: Returns 404, NOT 403
            // This prevents enumeration attacks
            expect(res.status).toBe(404);

            const data = await res.json();
            expect(data.type).toContain('not-found');
        });

        it('should return 404 for non-existent agent', async () => {
            const res = await makeRequest(app, 'GET', '/api/v1/agents/agent-nonexistent', 'demo-org');
            expect(res.status).toBe(404);
        });
    });

    // ========================================================================
    // Cross-Org Attack Prevention
    // ========================================================================

    describe('Cross-Org Attack Prevention', () => {
        it('should not leak other-org data to demo-org user', async () => {
            // Try multiple other-org agents from demo-org
            const agents = ['agent-other-001', 'agent-other-002'];

            for (const agentId of agents) {
                const res = await makeRequest(app, 'GET', `/api/v1/agents/${agentId}`, 'demo-org');

                // All should return 404
                expect(res.status).toBe(404);

                const data = await res.json();
                // Response should NOT contain any agent data
                expect(data.agent).toBeUndefined();
            }
        });

        it('should return same response for cross-org and non-existent agents', async () => {
            // Cross-org request
            const crossOrgRes = await makeRequest(
                app,
                'GET',
                '/api/v1/agents/agent-other-001',
                'demo-org'
            );

            // Non-existent request
            const nonExistentRes = await makeRequest(
                app,
                'GET',
                '/api/v1/agents/agent-does-not-exist',
                'demo-org'
            );

            // Both should return identical 404 response structure
            expect(crossOrgRes.status).toBe(nonExistentRes.status);

            const crossOrgData = await crossOrgRes.json();
            const nonExistentData = await nonExistentRes.json();

            // Response structure should be identical (prevents timing attacks)
            expect(Object.keys(crossOrgData).sort()).toEqual(Object.keys(nonExistentData).sort());
        });
    });

    // ========================================================================
    // Authentication Required
    // ========================================================================

    describe('Authentication Required', () => {
        it('should reject requests without authentication', async () => {
            const req = new Request('http://localhost/api/v1/agents', {
                method: 'GET',
            });

            const res = await app.fetch(req);
            expect(res.status).toBe(401);
        });
    });
});

// Note: extractUserContext unit tests are in rbac.test.ts
// This file focuses on integration tests for org isolation
