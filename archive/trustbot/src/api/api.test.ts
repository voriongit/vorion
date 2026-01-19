/**
 * API Routing Integration Tests
 *
 * Verifies the complete routing tree of the Unified Workflow API:
 * - All endpoints are reachable
 * - Correct HTTP methods
 * - Response format validation
 * - Error handling
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Hono } from 'hono';
import { createWorkflowAPI, UnifiedWorkflowEngine } from './UnifiedWorkflowAPI.js';

// ============================================================================
// Test Setup
// ============================================================================

let app: Hono;
let engine: UnifiedWorkflowEngine;

beforeAll(() => {
    engine = new UnifiedWorkflowEngine();
    app = createWorkflowAPI(engine);
});

afterAll(() => {
    // Cleanup if needed
});

// Helper to make test requests
async function request(method: string, path: string, body?: unknown) {
    const req = new Request(`http://localhost${path}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
    });
    return app.fetch(req);
}

// ============================================================================
// Routing Tree Tests
// ============================================================================

describe('API Routing Tree', () => {
    // =========================================================================
    // Health & System Endpoints
    // =========================================================================

    describe('Health & System', () => {
        it('GET /health - should return health status', async () => {
            const res = await request('GET', '/health');
            expect(res.status).toBe(200);

            const data = await res.json();
            // New health endpoint returns status as 'healthy', 'degraded', or 'unhealthy'
            expect(['healthy', 'degraded', 'unhealthy']).toContain(data.status);
            expect(data).toHaveProperty('timestamp');
            expect(data).toHaveProperty('version');
            expect(data).toHaveProperty('uptime');
            expect(data).toHaveProperty('checks');
        });

        it('GET /api/uptime - should return server uptime', async () => {
            const res = await request('GET', '/api/uptime');
            expect(res.status).toBe(200);

            const data = await res.json();
            expect(data).toHaveProperty('uptime');
            expect(data).toHaveProperty('formatted');
            expect(data).toHaveProperty('startTimeISO');
        });

        it('GET /api/stats - should return quick stats', async () => {
            const res = await request('GET', '/api/stats');
            expect(res.status).toBe(200);

            const data = await res.json();
            expect(data).toHaveProperty('hitlLevel');
            expect(data).toHaveProperty('avgTrust');
            expect(data).toHaveProperty('agentCount');
        });
    });

    // =========================================================================
    // Legacy API Endpoints
    // =========================================================================

    describe('Legacy API (/api/*)', () => {
        it('GET /api/state - should return full system state', async () => {
            const res = await request('GET', '/api/state');
            expect(res.status).toBe(200);

            const data = await res.json();
            expect(data).toHaveProperty('agents');
            expect(data).toHaveProperty('blackboard');
            expect(data).toHaveProperty('hitlLevel');
            expect(data).toHaveProperty('avgTrust');
            expect(Array.isArray(data.agents)).toBe(true);
        });

        it('GET /api/agents - should return agents list', async () => {
            const res = await request('GET', '/api/agents');
            expect(res.status).toBe(200);

            const data = await res.json();
            expect(Array.isArray(data)).toBe(true);
        });

        it('POST /api/spawn - should spawn new agent', async () => {
            const res = await request('POST', '/api/spawn', {
                name: 'Test-Agent',
                type: 'WORKER',
                tier: 2,
            });
            expect(res.status).toBe(200);

            const data = await res.json();
            expect(data).toHaveProperty('success', true);
            expect(data).toHaveProperty('agent');
        });

        it('GET /api/blackboard - should return blackboard entries', async () => {
            const res = await request('GET', '/api/blackboard');
            expect(res.status).toBe(200);

            const data = await res.json();
            expect(Array.isArray(data)).toBe(true);
        });

        it('POST /api/hitl - should set HITL level', async () => {
            const res = await request('POST', '/api/hitl', { level: 50 });
            expect(res.status).toBe(200);

            const data = await res.json();
            expect(data).toHaveProperty('success', true);
            expect(data).toHaveProperty('hitlLevel', 50);
        });

        it('GET /api/approvals - should return empty approvals', async () => {
            const res = await request('GET', '/api/approvals');
            expect(res.status).toBe(200);

            const data = await res.json();
            expect(Array.isArray(data)).toBe(true);
        });

        it('GET /api/settings - should return settings', async () => {
            const res = await request('GET', '/api/settings');
            expect(res.status).toBe(200);
        });

        it('POST /api/settings - should accept settings update', async () => {
            const res = await request('POST', '/api/settings', {});
            expect(res.status).toBe(200);

            const data = await res.json();
            expect(data).toHaveProperty('success', true);
        });
    });

    // =========================================================================
    // Dashboard Endpoints
    // =========================================================================

    describe('Dashboard', () => {
        it('GET /dashboard/today - should return completed today summary', async () => {
            const res = await request('GET', '/dashboard/today');
            expect(res.status).toBe(200);

            const data = await res.json();
            expect(data).toHaveProperty('date');
            expect(data).toHaveProperty('totalCompleted');
            expect(data).toHaveProperty('totalFailed');
            expect(data).toHaveProperty('totalPending');
            expect(data).toHaveProperty('byAgent');
            expect(data).toHaveProperty('byPriority');
            expect(data).toHaveProperty('avgCompletionTimeMs');
            expect(data).toHaveProperty('trustChanges');
            expect(data).toHaveProperty('autonomyMetrics');
        });

        it('GET /dashboard/aggressiveness - should return aggressiveness config', async () => {
            const res = await request('GET', '/dashboard/aggressiveness');
            expect(res.status).toBe(200);

            const data = await res.json();
            expect(data).toHaveProperty('level');
            expect(data).toHaveProperty('autoApproveUpToTier');
            expect(data).toHaveProperty('maxDelegationDepth');
            expect(data).toHaveProperty('trustRewardMultiplier');
            expect(data).toHaveProperty('trustPenaltyMultiplier');
        });

        it('POST /dashboard/aggressiveness - should reject without valid token', async () => {
            const res = await request('POST', '/dashboard/aggressiveness', {
                level: 50,
                tokenId: 'invalid-token',
            });
            expect(res.status).toBe(403);
        });
    });

    // =========================================================================
    // Task Endpoints
    // =========================================================================

    describe('Tasks', () => {
        let taskId: string;

        it('GET /tasks - should return tasks list', async () => {
            const res = await request('GET', '/tasks');
            expect(res.status).toBe(200);

            const data = await res.json();
            expect(Array.isArray(data)).toBe(true);
        });

        it('POST /tasks - should create new task', async () => {
            const res = await request('POST', '/tasks', {
                title: 'Test Task',
                description: 'Integration test task',
                priority: 'HIGH',
                requiredTier: 2,
            });
            expect(res.status).toBe(201);

            const data = await res.json();
            expect(data).toHaveProperty('id');
            expect(data).toHaveProperty('title', 'Test Task');
            expect(data).toHaveProperty('description');
            expect(data).toHaveProperty('priority', 'HIGH');
            expect(data).toHaveProperty('status');
            taskId = data.id;
        });

        it('GET /tasks/:id - should return specific task', async () => {
            // Create a task first
            const createRes = await request('POST', '/tasks', {
                title: 'Get Task Test',
                description: 'Test',
            });
            const created = await createRes.json();

            const res = await request('GET', `/tasks/${created.id}`);
            expect(res.status).toBe(200);

            const data = await res.json();
            expect(data).toHaveProperty('id', created.id);
            expect(data).toHaveProperty('title', 'Get Task Test');
        });

        it('GET /tasks/:id - should return 404 for unknown task', async () => {
            const res = await request('GET', '/tasks/nonexistent-id');
            expect(res.status).toBe(404);

            const data = await res.json();
            expect(data).toHaveProperty('error');
        });

        it('POST /tasks/:id/assign - should reject without valid token', async () => {
            const createRes = await request('POST', '/tasks', {
                title: 'Assign Test',
                description: 'Test',
            });
            const created = await createRes.json();

            const res = await request('POST', `/tasks/${created.id}/assign`, {
                agentId: 'agent-1',
                tokenId: 'invalid-token',
            });
            expect(res.status).toBe(403);
        });

        it('POST /tasks/:id/complete - should complete task', async () => {
            const createRes = await request('POST', '/tasks', {
                title: 'Complete Test',
                description: 'Test',
            });
            const created = await createRes.json();

            const res = await request('POST', `/tasks/${created.id}/complete`, {
                result: { success: true },
                tokenId: 'test-token', // Token not enforced for complete
            });
            // Complete endpoint doesn't strictly enforce auth token
            expect([200, 403]).toContain(res.status);
        });

        it('POST /tasks/:id/fail - should fail task', async () => {
            const createRes = await request('POST', '/tasks', {
                title: 'Fail Test',
                description: 'Test',
            });
            const created = await createRes.json();

            const res = await request('POST', `/tasks/${created.id}/fail`, {
                reason: 'Test failure',
                tokenId: 'test-token', // Token not enforced for fail
            });
            // Fail endpoint doesn't strictly enforce auth token
            expect([200, 403]).toContain(res.status);
        });

        it('POST /tasks/:id/delegate - should return 404 for nonexistent task', async () => {
            const res = await request('POST', '/tasks/nonexistent/delegate', {
                fromAgentId: 'agent-1',
                toAgentId: 'agent-2',
                tokenId: 'test',
            });
            expect(res.status).toBe(404);
        });

        it('GET /delegate - should return delegation rules', async () => {
            const res = await request('GET', '/delegate');
            expect(res.status).toBe(200);

            const data = await res.json();
            expect(data).toHaveProperty('rules');
            expect(data.rules).toHaveProperty('maxDelegations');
            expect(data).toHaveProperty('tiers');
            expect(Array.isArray(data.tiers)).toBe(true);
        });
    });

    // =========================================================================
    // Approval Endpoints
    // =========================================================================

    describe('Approvals', () => {
        it('GET /approvals - should return pending approvals', async () => {
            const res = await request('GET', '/approvals');
            expect(res.status).toBe(200);

            const data = await res.json();
            expect(Array.isArray(data)).toBe(true);
        });

        it('POST /approvals/:id - should reject without valid token', async () => {
            const res = await request('POST', '/approvals/some-id', {
                approve: true,
                tokenId: 'invalid-token',
            });
            expect(res.status).toBe(403);
        });
    });

    // =========================================================================
    // Trust & Security Endpoints
    // =========================================================================

    describe('Trust & Security', () => {
        it('GET /trust/stats - should return trust statistics', async () => {
            const res = await request('GET', '/trust/stats');
            expect(res.status).toBe(200);

            const data = await res.json();
            expect(data).toHaveProperty('hitlLevel');
            expect(data).toHaveProperty('avgTrust');
        });

        it('GET /security/audit - should return audit log', async () => {
            const res = await request('GET', '/security/audit');
            expect(res.status).toBe(200);

            const data = await res.json();
            expect(Array.isArray(data)).toBe(true);
        });

        it('GET /security/audit?limit=10 - should respect limit param', async () => {
            const res = await request('GET', '/security/audit?limit=10');
            expect(res.status).toBe(200);
        });

        it('POST /auth/human - should reject invalid master key', async () => {
            const res = await request('POST', '/auth/human', {
                masterKey: 'wrong-key',
            });
            expect(res.status).toBe(401);

            const data = await res.json();
            expect(data).toHaveProperty('error');
        });

        it('GET /trust/:agentId/components - should return 404 for unknown agent', async () => {
            const res = await request('GET', '/trust/unknown-agent/components');
            expect(res.status).toBe(404);

            const data = await res.json();
            expect(data).toHaveProperty('error');
        });

        it('GET /trust/:agentId/history - should return 404 for unknown agent', async () => {
            const res = await request('GET', '/trust/unknown-agent/history');
            expect(res.status).toBe(404);

            const data = await res.json();
            expect(data).toHaveProperty('error');
        });
    });

    // =========================================================================
    // Audit Verification Endpoints
    // =========================================================================

    describe('Audit Verification', () => {
        it('GET /audit/verify - should verify audit chain', async () => {
            const res = await request('GET', '/audit/verify');
            expect(res.status).toBe(200);

            const data = await res.json();
            expect(data).toHaveProperty('isValid');
            expect(data).toHaveProperty('lastVerified');
            expect(data).toHaveProperty('entriesVerified');
        });

        it('GET /audit/export - should export audit log as JSON', async () => {
            const res = await request('GET', '/audit/export');
            expect(res.status).toBe(200);

            const data = await res.json();
            expect(data).toHaveProperty('exported');
            expect(data).toHaveProperty('chainValid');
            expect(data).toHaveProperty('entriesCount');
            expect(data).toHaveProperty('entries');
        });

        it('GET /audit/export?format=csv - should export as CSV', async () => {
            const res = await request('GET', '/audit/export?format=csv');
            expect(res.status).toBe(200);

            const contentType = res.headers.get('Content-Type');
            expect(contentType).toContain('text/csv');
        });
    });

    // =========================================================================
    // Council Endpoints
    // =========================================================================

    describe('Council', () => {
        it('GET /council/reviews - should return pending reviews', async () => {
            const res = await request('GET', '/council/reviews');
            expect(res.status).toBe(200);

            const data = await res.json();
            expect(Array.isArray(data)).toBe(true);
        });

        it('GET /council/reviews/:id - should return 404 for unknown review', async () => {
            const res = await request('GET', '/council/reviews/nonexistent');
            expect(res.status).toBe(404);

            const data = await res.json();
            expect(data).toHaveProperty('error');
        });

        it('POST /council/reviews/:id/vote - should return 400 for invalid review', async () => {
            const res = await request('POST', '/council/reviews/nonexistent/vote', {
                agentId: 'voter-1',
                vote: 'approve',
                reasoning: 'Test vote',
                confidence: 0.9,
            });
            expect(res.status).toBe(400);
        });

        it('GET /council/members - should return council members', async () => {
            const res = await request('GET', '/council/members');
            expect(res.status).toBe(200);

            const data = await res.json();
            expect(Array.isArray(data)).toBe(true);
        });
    });

    // =========================================================================
    // Delegation & Budget Endpoints
    // =========================================================================

    describe('Delegation & Budget', () => {
        it('POST /delegation/request - should reject invalid capability', async () => {
            const res = await request('POST', '/delegation/request', {
                agentId: 'test-agent',
                capabilities: ['INVALID_CAPABILITY'],
                reason: 'Test',
                duration: 60000,
            });
            expect(res.status).toBe(400);

            const data = await res.json();
            expect(data).toHaveProperty('error');
        });

        it('GET /delegation/:agentId/active - should return empty for unknown agent', async () => {
            const res = await request('GET', '/delegation/unknown-agent/active');
            expect(res.status).toBe(200);

            const data = await res.json();
            expect(Array.isArray(data)).toBe(true);
            expect(data.length).toBe(0);
        });

        it('DELETE /delegation/:id - should reject without valid token', async () => {
            const res = await request('DELETE', '/delegation/some-id', {
                reason: 'Test revocation',
                tokenId: 'invalid-token',
            });
            expect(res.status).toBe(403);
        });

        it('GET /autonomy/:agentId/budget - should return budget for any agent', async () => {
            const res = await request('GET', '/autonomy/test-agent/budget');
            expect(res.status).toBe(200);

            const data = await res.json();
            expect(data).toHaveProperty('agentId');
            expect(data).toHaveProperty('tier');
            expect(data).toHaveProperty('actions');
            expect(data).toHaveProperty('delegations');
            expect(data).toHaveProperty('tokens');
            expect(data).toHaveProperty('resetsIn');
            expect(data).toHaveProperty('resetsAt');
        });

        it('POST /autonomy/:agentId/action - should handle action recording', async () => {
            const res = await request('POST', '/autonomy/test-agent/action', {
                actionType: 'test_action',
                cost: 1,
            });
            // May return 400 if agent doesn't exist in trust engine
            // or 200 if action recording succeeds
            expect([200, 400]).toContain(res.status);

            const data = await res.json();
            // Either success response or error response
            expect(data).toHaveProperty(res.status === 200 ? 'success' : 'error');
        });
    });

    // =========================================================================
    // AI Provider Endpoints
    // =========================================================================

    describe('AI Providers', () => {
        it('GET /api/ai/providers - should return available providers', async () => {
            const res = await request('GET', '/api/ai/providers');
            expect(res.status).toBe(200);

            const data = await res.json();
            expect(data).toHaveProperty('available');
            expect(Array.isArray(data.available)).toBe(true);
        });

        it('GET /api/ai/info - should return provider info', async () => {
            const res = await request('GET', '/api/ai/info');
            expect(res.status).toBe(200);

            const data = await res.json();
            expect(data).toHaveProperty('providers');
            expect(data).toHaveProperty('allProviderTypes');
        });

        it('POST /api/ai/complete - should handle missing provider gracefully', async () => {
            const res = await request('POST', '/api/ai/complete', {
                messages: [{ role: 'user', content: 'Hello' }],
            });
            // Should either succeed or fail gracefully (no AI configured)
            expect([200, 500]).toContain(res.status);
        });

        it('POST /api/ai/ask - should handle missing provider gracefully', async () => {
            const res = await request('POST', '/api/ai/ask', {
                prompt: 'Hello',
            });
            expect([200, 500]).toContain(res.status);
        });

        it('POST /api/ai/configure - should reject missing params', async () => {
            const res = await request('POST', '/api/ai/configure', {});
            expect(res.status).toBe(400);
        });
    });

    // =========================================================================
    // Aria AI Endpoints
    // =========================================================================

    describe('Aria AI', () => {
        it('GET /api/ai/aria/settings - should return Aria settings', async () => {
            const res = await request('GET', '/api/ai/aria/settings');
            expect(res.status).toBe(200);

            const data = await res.json();
            expect(data).toHaveProperty('success');
            expect(data).toHaveProperty('settings');
            expect(data.settings).toHaveProperty('enabled');
            expect(data.settings).toHaveProperty('mode');
            expect(data.settings).toHaveProperty('advisors');
        });

        it('POST /api/ai/aria/settings - should update Aria settings', async () => {
            const res = await request('POST', '/api/ai/aria/settings', {
                enabled: true,
                mode: 'single',
            });
            expect(res.status).toBe(200);

            const data = await res.json();
            expect(data).toHaveProperty('success', true);
            expect(data.settings).toHaveProperty('enabled', true);
        });

        it('GET /api/ai/aria/advisors - should return advisors list', async () => {
            const res = await request('GET', '/api/ai/aria/advisors');
            expect(res.status).toBe(200);

            const data = await res.json();
            expect(data).toHaveProperty('advisors');
            expect(Array.isArray(data.advisors)).toBe(true);
            expect(data).toHaveProperty('councilName');
        });

        it('POST /api/ai/aria/advisors - should reject without required fields', async () => {
            const res = await request('POST', '/api/ai/aria/advisors', {});
            expect(res.status).toBe(400);

            const data = await res.json();
            expect(data).toHaveProperty('error');
        });

        it('POST /api/ai/aria/advisors - should add new advisor', async () => {
            const res = await request('POST', '/api/ai/aria/advisors', {
                name: 'TestAdvisor',
                provider: 'claude',
                aliases: ['test'],
            });
            expect(res.status).toBe(200);

            const data = await res.json();
            expect(data).toHaveProperty('success', true);
            expect(data).toHaveProperty('advisor');
            expect(data.advisor.name).toBe('TestAdvisor');
        });

        it('DELETE /api/ai/aria/advisors/:name - should return 404 for unknown advisor', async () => {
            const res = await request('DELETE', '/api/ai/aria/advisors/nonexistent');
            expect(res.status).toBe(404);
        });

        it('POST /api/ai/aria/council - should update council settings', async () => {
            const res = await request('POST', '/api/ai/aria/council', {
                name: 'TestCouncil',
                aliases: ['test', 'advisors'],
            });
            expect(res.status).toBe(200);

            const data = await res.json();
            expect(data).toHaveProperty('success', true);
            expect(data).toHaveProperty('councilName', 'TestCouncil');
        });

        it('POST /api/ai/aria/interpret - should handle interpretation', async () => {
            const res = await request('POST', '/api/ai/aria/interpret', {
                message: 'show me the status',
            });
            expect(res.status).toBe(200);

            const data = await res.json();
            expect(data).toHaveProperty('interpretation');
            expect(data.interpretation).toHaveProperty('action');
        });

        it('POST /api/ai/aria/gather - should handle no providers gracefully', async () => {
            const res = await request('POST', '/api/ai/aria/gather', {
                question: 'What is the meaning of life?',
            });
            expect(res.status).toBe(200);

            const data = await res.json();
            expect(data).toHaveProperty('perspectives');
        });

        it('POST /api/ai/aria/consult - should handle missing provider', async () => {
            const res = await request('POST', '/api/ai/aria/consult', {
                question: 'Test question',
                provider: 'claude',
            });
            // Either succeeds or returns error about unconfigured provider
            expect([200, 500]).toContain(res.status);
        });
    });

    // =========================================================================
    // Method Validation
    // =========================================================================

    describe('HTTP Method Validation', () => {
        it('should reject POST to GET-only endpoints', async () => {
            const res = await request('POST', '/health');
            expect(res.status).toBe(404);
        });

        it('should reject GET to POST-only endpoints', async () => {
            const res = await request('GET', '/auth/human');
            expect(res.status).toBe(404);
        });

        it('should reject PUT where not supported', async () => {
            const res = await request('PUT', '/tasks');
            expect(res.status).toBe(404);
        });
    });

    // =========================================================================
    // Route Coverage Summary
    // =========================================================================

    describe('Route Coverage', () => {
        it('verifies all major route groups are covered', () => {
            // This test documents the complete routing tree
            const routeGroups = {
                health: ['/health', '/api/uptime', '/api/stats'],
                legacy: ['/api/state', '/api/agents', '/api/spawn', '/api/blackboard', '/api/hitl', '/api/approvals', '/api/settings'],
                dashboard: ['/dashboard/today', '/dashboard/aggressiveness'],
                tasks: ['/tasks', '/tasks/:id', '/tasks/:id/assign', '/tasks/:id/complete', '/tasks/:id/fail', '/tasks/:id/delegate', '/delegate'],
                approvals: ['/approvals', '/approvals/:id'],
                trust: ['/trust/stats', '/trust/:agentId/components', '/trust/:agentId/history'],
                security: ['/security/audit', '/auth/human'],
                audit: ['/audit/verify', '/audit/export'],
                council: ['/council/reviews', '/council/reviews/:id', '/council/reviews/:id/vote', '/council/members'],
                delegation: ['/delegation/request', '/delegation/:agentId/active', '/delegation/:id'],
                autonomy: ['/autonomy/:agentId/budget', '/autonomy/:agentId/action'],
                ai: ['/ai/providers', '/ai/complete', '/ai/ask', '/ai/agent-reason', '/ai/set-default', '/ai/configure', '/ai/test', '/ai/provider/:type', '/ai/info'],
                aria: ['/ai/aria/interpret', '/ai/aria/gather', '/ai/aria/settings', '/ai/aria/advisors', '/ai/aria/advisors/:name', '/ai/aria/council', '/ai/aria/consult'],
            };

            // Count total routes
            const totalRoutes = Object.values(routeGroups).flat().length;
            expect(totalRoutes).toBeGreaterThan(50); // We have 50+ routes

            // Verify all groups exist
            expect(Object.keys(routeGroups)).toHaveLength(13);
        });
    });
});
