/**
 * Decision Analytics API Routes Tests
 *
 * Epic 12: Decision Automation Pipeline
 * Story 12.7: Decision Analytics
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import decisionsAnalyticsRouter from './decisions.js';
import {
    getDecisionAnalytics,
    resetDecisionAnalytics,
} from '../../../services/DecisionAnalytics.js';

// ============================================================================
// Test Setup
// ============================================================================

const app = new Hono();
app.route('/api/v1/analytics/decisions', decisionsAnalyticsRouter);

function createTestRecord(analytics: ReturnType<typeof getDecisionAnalytics>, overrides: any = {}) {
    const createdAt = overrides.createdAt || new Date();
    const decidedAt = overrides.decidedAt || new Date(createdAt.getTime() + 1000);

    return analytics.recordDecision(
        overrides.id || `dec_${Date.now()}_${Math.random()}`,
        overrides.requestId || `req_${Date.now()}`,
        overrides.orgId || 'org_1',
        overrides.agentId || 'agent_1',
        overrides.actionType || 'execute',
        overrides.riskLevel || 'low',
        overrides.source || 'auto_approval',
        overrides.outcome || 'approved',
        createdAt,
        decidedAt,
        overrides.trustScore || 850,
        {
            wasOverridden: overrides.wasOverridden,
            overrideReason: overrides.overrideReason,
        }
    );
}

// ============================================================================
// Tests
// ============================================================================

describe('Decision Analytics API', () => {
    beforeEach(() => {
        resetDecisionAnalytics();
    });

    afterEach(() => {
        resetDecisionAnalytics();
    });

    // =========================================================================
    // Summary Endpoint
    // =========================================================================

    describe('GET /:orgId', () => {
        it('should return analytics summary', async () => {
            const analytics = getDecisionAnalytics();
            createTestRecord(analytics, { source: 'auto_approval' });
            createTestRecord(analytics, { source: 'tribunal' });

            const res = await app.request('/api/v1/analytics/decisions/org_1');
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.success).toBe(true);
            expect(json.data.totalDecisions).toBe(2);
            expect(json.data.bySource.auto_approval).toBe(1);
            expect(json.data.bySource.tribunal).toBe(1);
        });

        it('should filter by date range', async () => {
            const analytics = getDecisionAnalytics();
            const old = new Date('2025-01-01T10:00:00Z');
            const recent = new Date('2025-01-15T10:00:00Z');

            createTestRecord(analytics, { createdAt: old, decidedAt: old });
            createTestRecord(analytics, { createdAt: recent, decidedAt: recent });

            const res = await app.request('/api/v1/analytics/decisions/org_1?startDate=2025-01-10');
            const json = await res.json();

            expect(json.data.totalDecisions).toBe(1);
        });
    });

    // =========================================================================
    // Auto-Approval Endpoint
    // =========================================================================

    describe('GET /:orgId/auto-approval', () => {
        it('should return auto-approval metrics', async () => {
            const analytics = getDecisionAnalytics();
            createTestRecord(analytics, { source: 'auto_approval', outcome: 'approved' });
            createTestRecord(analytics, { source: 'auto_approval', outcome: 'approved' });
            createTestRecord(analytics, { source: 'tribunal', outcome: 'approved' });

            const res = await app.request('/api/v1/analytics/decisions/org_1/auto-approval');
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.success).toBe(true);
            expect(json.data.autoApproved).toBe(2);
            expect(json.data.rate).toBeCloseTo(0.667, 2);
        });
    });

    // =========================================================================
    // Decision Time Endpoint
    // =========================================================================

    describe('GET /:orgId/decision-time', () => {
        it('should return decision time metrics', async () => {
            const analytics = getDecisionAnalytics();
            const base = new Date('2025-01-15T10:00:00Z');

            createTestRecord(analytics, {
                createdAt: base,
                decidedAt: new Date(base.getTime() + 1000),
            });
            createTestRecord(analytics, {
                createdAt: base,
                decidedAt: new Date(base.getTime() + 3000),
            });

            const res = await app.request('/api/v1/analytics/decisions/org_1/decision-time');
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.success).toBe(true);
            expect(json.data.overall.mean).toBe(2000);
        });
    });

    // =========================================================================
    // Override Endpoint
    // =========================================================================

    describe('GET /:orgId/overrides', () => {
        it('should return override metrics', async () => {
            const analytics = getDecisionAnalytics();
            createTestRecord(analytics, { wasOverridden: true, overrideReason: 'Security' });
            createTestRecord(analytics, { wasOverridden: false });

            const res = await app.request('/api/v1/analytics/decisions/org_1/overrides');
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.success).toBe(true);
            expect(json.data.total).toBe(1);
            expect(json.data.reasons['Security']).toBe(1);
        });
    });

    // =========================================================================
    // False Positive Endpoint
    // =========================================================================

    describe('GET /:orgId/false-positives', () => {
        it('should return false positive metrics', async () => {
            const analytics = getDecisionAnalytics();
            createTestRecord(analytics, {
                source: 'auto_approval',
                outcome: 'approved',
                wasOverridden: true,
            });
            createTestRecord(analytics, {
                source: 'auto_approval',
                outcome: 'approved',
                wasOverridden: false,
            });

            const res = await app.request('/api/v1/analytics/decisions/org_1/false-positives');
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.success).toBe(true);
            expect(json.data.autoApprovalFalsePositives).toBe(1);
            expect(json.data.rate).toBe(0.5);
        });
    });

    // =========================================================================
    // Recent Records Endpoint
    // =========================================================================

    describe('GET /:orgId/recent', () => {
        it('should return recent records', async () => {
            const analytics = getDecisionAnalytics();
            createTestRecord(analytics, { id: 'dec_1' });
            createTestRecord(analytics, { id: 'dec_2' });

            const res = await app.request('/api/v1/analytics/decisions/org_1/recent');
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.success).toBe(true);
            expect(json.data.count).toBe(2);
            expect(json.data.records.length).toBe(2);
        });

        it('should filter by source', async () => {
            const analytics = getDecisionAnalytics();
            createTestRecord(analytics, { source: 'auto_approval' });
            createTestRecord(analytics, { source: 'tribunal' });

            const res = await app.request('/api/v1/analytics/decisions/org_1/recent?source=tribunal');
            const json = await res.json();

            expect(json.data.count).toBe(1);
            expect(json.data.records[0].source).toBe('tribunal');
        });

        it('should filter by outcome', async () => {
            const analytics = getDecisionAnalytics();
            createTestRecord(analytics, { outcome: 'approved' });
            createTestRecord(analytics, { outcome: 'denied' });

            const res = await app.request('/api/v1/analytics/decisions/org_1/recent?outcome=denied');
            const json = await res.json();

            expect(json.data.count).toBe(1);
            expect(json.data.records[0].outcome).toBe('denied');
        });

        it('should filter by risk level', async () => {
            const analytics = getDecisionAnalytics();
            createTestRecord(analytics, { riskLevel: 'low' });
            createTestRecord(analytics, { riskLevel: 'critical' });

            const res = await app.request('/api/v1/analytics/decisions/org_1/recent?riskLevel=critical');
            const json = await res.json();

            expect(json.data.count).toBe(1);
            expect(json.data.records[0].riskLevel).toBe('critical');
        });

        it('should respect limit', async () => {
            const analytics = getDecisionAnalytics();
            for (let i = 0; i < 10; i++) {
                createTestRecord(analytics);
            }

            const res = await app.request('/api/v1/analytics/decisions/org_1/recent?limit=5');
            const json = await res.json();

            expect(json.data.count).toBe(5);
        });
    });

    // =========================================================================
    // Agent Analytics Endpoint
    // =========================================================================

    describe('GET /:orgId/agent/:agentId', () => {
        it('should return agent analytics', async () => {
            const analytics = getDecisionAnalytics();
            createTestRecord(analytics, { agentId: 'agent_1', outcome: 'approved' });
            createTestRecord(analytics, { agentId: 'agent_1', outcome: 'denied' });
            createTestRecord(analytics, { agentId: 'agent_2', outcome: 'approved' });

            const res = await app.request('/api/v1/analytics/decisions/org_1/agent/agent_1');
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.success).toBe(true);
            expect(json.data.totalDecisions).toBe(2);
            expect(json.data.approvalRate).toBe(0.5);
        });
    });

    // =========================================================================
    // Action Type Analytics Endpoint
    // =========================================================================

    describe('GET /:orgId/action-type/:actionType', () => {
        it('should return action type analytics', async () => {
            const analytics = getDecisionAnalytics();
            createTestRecord(analytics, { actionType: 'execute', outcome: 'approved' });
            createTestRecord(analytics, { actionType: 'execute', outcome: 'denied' });
            createTestRecord(analytics, { actionType: 'external', outcome: 'approved' });

            const res = await app.request('/api/v1/analytics/decisions/org_1/action-type/execute');
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.success).toBe(true);
            expect(json.data.total).toBe(2);
            expect(json.data.approvalRate).toBe(0.5);
        });
    });

    // =========================================================================
    // Thresholds Endpoints
    // =========================================================================

    describe('GET /:orgId/thresholds', () => {
        it('should return thresholds', async () => {
            const analytics = getDecisionAnalytics();
            analytics.setThreshold('org_1', 'autoApprovalRate', 0.7);

            const res = await app.request('/api/v1/analytics/decisions/org_1/thresholds');
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.success).toBe(true);
            expect(json.data.thresholds.autoApprovalRate).toBe(0.7);
        });
    });

    describe('PUT /:orgId/thresholds', () => {
        it('should set thresholds', async () => {
            const res = await app.request('/api/v1/analytics/decisions/org_1/thresholds', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ autoApprovalRate: 0.8 }),
            });
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.success).toBe(true);
            expect(json.data.thresholds.autoApprovalRate).toBe(0.8);

            const analytics = getDecisionAnalytics();
            expect(analytics.getThreshold('org_1', 'autoApprovalRate')).toBe(0.8);
        });

        it('should reject invalid metric', async () => {
            const res = await app.request('/api/v1/analytics/decisions/org_1/thresholds', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invalidMetric: 0.5 }),
            });
            const json = await res.json();

            expect(res.status).toBe(400);
            expect(json.success).toBe(false);
            expect(json.error).toContain('Invalid metric');
        });

        it('should reject invalid value', async () => {
            const res = await app.request('/api/v1/analytics/decisions/org_1/thresholds', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ autoApprovalRate: 1.5 }),
            });
            const json = await res.json();

            expect(res.status).toBe(400);
            expect(json.success).toBe(false);
        });
    });

    describe('DELETE /:orgId/thresholds/:metric', () => {
        it('should clear threshold', async () => {
            const analytics = getDecisionAnalytics();
            analytics.setThreshold('org_1', 'autoApprovalRate', 0.7);

            const res = await app.request(
                '/api/v1/analytics/decisions/org_1/thresholds/autoApprovalRate',
                { method: 'DELETE' }
            );
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.success).toBe(true);
            expect(analytics.getThreshold('org_1', 'autoApprovalRate')).toBeNull();
        });
    });

    // =========================================================================
    // Global Stats Endpoint
    // =========================================================================

    describe('GET /stats', () => {
        it('should return global stats', async () => {
            const analytics = getDecisionAnalytics();
            createTestRecord(analytics, { orgId: 'org_1' });
            createTestRecord(analytics, { orgId: 'org_2' });

            const res = await app.request('/api/v1/analytics/decisions/stats');
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.success).toBe(true);
            expect(json.data.totalRecords).toBe(2);
            expect(json.data.uniqueOrgs).toBe(2);
        });
    });
});
