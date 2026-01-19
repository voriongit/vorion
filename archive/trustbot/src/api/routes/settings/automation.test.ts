/**
 * Automation Settings API Routes Tests
 *
 * Epic 12: Decision Automation Pipeline
 * Story 12.8: Automation Threshold Configuration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import automationSettingsRouter from './automation.js';
import {
    getAutomationConfigService,
    resetAutomationConfigService,
} from '../../../services/AutomationConfig.js';

// ============================================================================
// Test Setup
// ============================================================================

const app = new Hono();
app.route('/api/v1/settings/automation', automationSettingsRouter);

// ============================================================================
// Tests
// ============================================================================

describe('Automation Settings API', () => {
    beforeEach(() => {
        resetAutomationConfigService();
    });

    afterEach(() => {
        resetAutomationConfigService();
    });

    // =========================================================================
    // Main Settings Endpoints
    // =========================================================================

    describe('GET /:orgId', () => {
        it('should return automation settings', async () => {
            const res = await app.request('/api/v1/settings/automation/org_1');
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.success).toBe(true);
            expect(json.data.orgId).toBe('org_1');
            expect(json.data.autoApproval).toBeDefined();
            expect(json.data.riskClassifications).toBeDefined();
        });
    });

    describe('PUT /:orgId', () => {
        it('should update automation settings', async () => {
            const res = await app.request('/api/v1/settings/automation/org_1', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    autoApproval: { minTrustScore: 900 },
                }),
            });
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.success).toBe(true);
            expect(json.data.autoApproval.minTrustScore).toBe(900);
        });

        it('should reject invalid update', async () => {
            const res = await app.request('/api/v1/settings/automation/org_1', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    autoApproval: { minTrustScore: 1500 },
                }),
            });
            const json = await res.json();

            expect(res.status).toBe(400);
            expect(json.success).toBe(false);
        });
    });

    describe('POST /:orgId/reset', () => {
        it('should reset settings to defaults', async () => {
            // First modify settings
            await app.request('/api/v1/settings/automation/org_1', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ autoApproval: { minTrustScore: 500 } }),
            });

            // Then reset
            const res = await app.request('/api/v1/settings/automation/org_1/reset', {
                method: 'POST',
            });
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.success).toBe(true);
            expect(json.data.autoApproval.minTrustScore).toBe(800);
        });
    });

    // =========================================================================
    // Auto-Approval Endpoints
    // =========================================================================

    describe('GET /:orgId/auto-approval', () => {
        it('should return auto-approval settings', async () => {
            const res = await app.request('/api/v1/settings/automation/org_1/auto-approval');
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.success).toBe(true);
            expect(json.data.minTrustScore).toBe(800);
            expect(json.data.enabled).toBe(true);
        });
    });

    describe('PUT /:orgId/auto-approval', () => {
        it('should update auto-approval settings', async () => {
            const res = await app.request('/api/v1/settings/automation/org_1/auto-approval', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ minTrustScore: 750 }),
            });
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.data.minTrustScore).toBe(750);
        });
    });

    describe('POST /:orgId/auto-approval/check', () => {
        it('should check auto-approval eligibility', async () => {
            const res = await app.request('/api/v1/settings/automation/org_1/auto-approval/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    trustScore: 850,
                    actionType: 'read',
                    riskLevel: 'low',
                }),
            });
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.success).toBe(true);
            expect(json.data.eligible).toBe(true);
        });

        it('should return ineligible for low trust', async () => {
            const res = await app.request('/api/v1/settings/automation/org_1/auto-approval/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    trustScore: 500,
                    actionType: 'read',
                    riskLevel: 'low',
                }),
            });
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.data.eligible).toBe(false);
        });

        it('should require trustScore', async () => {
            const res = await app.request('/api/v1/settings/automation/org_1/auto-approval/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    actionType: 'read',
                }),
            });
            const json = await res.json();

            expect(res.status).toBe(400);
        });
    });

    // =========================================================================
    // Risk Classification Endpoints
    // =========================================================================

    describe('GET /:orgId/risk-classifications', () => {
        it('should return risk classifications', async () => {
            const res = await app.request('/api/v1/settings/automation/org_1/risk-classifications');
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.data.length).toBe(4);
        });
    });

    describe('POST /:orgId/risk-classifications/classify', () => {
        it('should classify action risk', async () => {
            const res = await app.request('/api/v1/settings/automation/org_1/risk-classifications/classify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ actionType: 'delete' }),
            });
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.data.riskLevel).toBe('critical');
            expect(json.data.riskScore).toBe(100);
        });

        it('should use trust score for unknown action', async () => {
            const res = await app.request('/api/v1/settings/automation/org_1/risk-classifications/classify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    actionType: 'custom_action',
                    trustScore: 850,
                }),
            });
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.data.riskLevel).toBe('low');
        });
    });

    // =========================================================================
    // Timeout Endpoints
    // =========================================================================

    describe('GET /:orgId/timeouts', () => {
        it('should return timeout configurations', async () => {
            const res = await app.request('/api/v1/settings/automation/org_1/timeouts');
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.data.length).toBe(4);
        });
    });

    describe('GET /:orgId/timeouts/:urgency', () => {
        it('should return timeout for urgency', async () => {
            const res = await app.request('/api/v1/settings/automation/org_1/timeouts/immediate');
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.data.timeoutMs).toBe(15 * 60 * 1000);
        });

        it('should reject invalid urgency', async () => {
            const res = await app.request('/api/v1/settings/automation/org_1/timeouts/invalid');
            const json = await res.json();

            expect(res.status).toBe(400);
        });
    });

    // =========================================================================
    // Escalation Path Endpoints
    // =========================================================================

    describe('GET /:orgId/escalation-paths', () => {
        it('should return escalation paths', async () => {
            const res = await app.request('/api/v1/settings/automation/org_1/escalation-paths');
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.data.length).toBe(4);
        });
    });

    describe('GET /:orgId/escalation-paths/:riskLevel', () => {
        it('should return path for risk level', async () => {
            const res = await app.request('/api/v1/settings/automation/org_1/escalation-paths/high');
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.data.targetRole).toBe('supervisor');
        });

        it('should reject invalid risk level', async () => {
            const res = await app.request('/api/v1/settings/automation/org_1/escalation-paths/invalid');
            const json = await res.json();

            expect(res.status).toBe(400);
        });
    });

    // =========================================================================
    // Tribunal Endpoints
    // =========================================================================

    describe('GET /:orgId/tribunal', () => {
        it('should return tribunal configuration', async () => {
            const res = await app.request('/api/v1/settings/automation/org_1/tribunal');
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.data.minValidators).toBe(3);
            expect(json.data.maxValidators).toBe(5);
        });
    });

    describe('PUT /:orgId/tribunal', () => {
        it('should update tribunal configuration', async () => {
            const res = await app.request('/api/v1/settings/automation/org_1/tribunal', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    minValidators: 5,
                    consensusThreshold: 0.8,
                }),
            });
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.data.minValidators).toBe(5);
            expect(json.data.consensusThreshold).toBe(0.8);
        });

        it('should reject invalid configuration', async () => {
            const res = await app.request('/api/v1/settings/automation/org_1/tribunal', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    minValidators: 10,
                    maxValidators: 5,
                }),
            });
            const json = await res.json();

            expect(res.status).toBe(400);
        });
    });

    // =========================================================================
    // HITL Endpoints
    // =========================================================================

    describe('GET /:orgId/hitl', () => {
        it('should return HITL configuration', async () => {
            const res = await app.request('/api/v1/settings/automation/org_1/hitl');
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.data.loadBalancing).toBe(true);
            expect(json.data.maxConcurrentPerReviewer).toBe(10);
        });
    });

    describe('PUT /:orgId/hitl', () => {
        it('should update HITL configuration', async () => {
            const res = await app.request('/api/v1/settings/automation/org_1/hitl', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    maxConcurrentPerReviewer: 20,
                }),
            });
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.data.maxConcurrentPerReviewer).toBe(20);
        });
    });

    // =========================================================================
    // Defaults Endpoint
    // =========================================================================

    describe('GET /defaults', () => {
        it('should return default configuration', async () => {
            const res = await app.request('/api/v1/settings/automation/defaults');
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.success).toBe(true);
            expect(json.data.autoApproval).toBeDefined();
            expect(json.data.tribunal).toBeDefined();
        });
    });
});
