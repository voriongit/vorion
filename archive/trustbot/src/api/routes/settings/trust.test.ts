/**
 * Trust Configuration API Tests
 *
 * Epic 11: Live Trust Scoring Engine
 * Story 11.5: Organization Trust Configuration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import trustSettingsRouter from './trust.js';
import {
    getTrustScoreCalculator,
    resetTrustScoreCalculator,
    DEFAULT_EVENT_CONFIG,
} from '../../../services/TrustScoreCalculator.js';
import { getTierManager, resetTierManager, DEFAULT_TIERS } from '../../../services/TierManager.js';

describe('Trust Settings API', () => {
    let app: Hono;

    beforeEach(() => {
        resetTrustScoreCalculator();
        resetTierManager();

        app = new Hono();
        app.route('/api/v1/settings/trust', trustSettingsRouter);
    });

    afterEach(() => {
        resetTrustScoreCalculator();
        resetTierManager();
    });

    // =========================================================================
    // GET /api/v1/settings/trust/:orgId
    // =========================================================================

    describe('GET /:orgId', () => {
        it('should return default config for new org', async () => {
            const res = await app.request('/api/v1/settings/trust/org_new');

            expect(res.status).toBe(200);
            const json = await res.json();
            expect(json.success).toBe(true);
            expect(json.data.orgId).toBe('org_new');
            expect(json.data.scoring.baseScore).toBe(300);
            expect(json.data.tiers.length).toBe(6);
        });

        it('should return custom config after update', async () => {
            const calculator = getTrustScoreCalculator();
            calculator.setOrgConfig('org_custom', {
                baseScore: 500,
            });

            const res = await app.request('/api/v1/settings/trust/org_custom');

            expect(res.status).toBe(200);
            const json = await res.json();
            expect(json.data.scoring.baseScore).toBe(500);
        });
    });

    // =========================================================================
    // PUT /api/v1/settings/trust/:orgId
    // =========================================================================

    describe('PUT /:orgId', () => {
        it('should update scoring config', async () => {
            const res = await app.request('/api/v1/settings/trust/org_1', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scoring: {
                        baseScore: 400,
                        decayFunction: 'exponential',
                    },
                }),
            });

            expect(res.status).toBe(200);
            const json = await res.json();
            expect(json.success).toBe(true);
            expect(json.data.scoring.baseScore).toBe(400);
            expect(json.data.scoring.decayFunction).toBe('exponential');
        });

        it('should update event points', async () => {
            const res = await app.request('/api/v1/settings/trust/org_1', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scoring: {
                        events: {
                            task_completed: { points: 20 },
                            task_failed: { points: -25, decayDays: 7 },
                        },
                    },
                }),
            });

            expect(res.status).toBe(200);
            const json = await res.json();
            expect(json.data.scoring.events.task_completed.points).toBe(20);
            expect(json.data.scoring.events.task_failed.points).toBe(-25);
            expect(json.data.scoring.events.task_failed.decayDays).toBe(7);
        });

        it('should update tier config', async () => {
            const res = await app.request('/api/v1/settings/trust/org_1', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tiers: [
                        { level: 'UNTRUSTED', minScore: 0, maxScore: 249 },
                        { level: 'PROBATIONARY', minScore: 250, maxScore: 499 },
                        { level: 'TRUSTED', minScore: 500, maxScore: 1000 },
                    ],
                }),
            });

            expect(res.status).toBe(200);
            const json = await res.json();
            expect(json.data.tiers.length).toBe(3);
            expect(json.data.tiers[1].minScore).toBe(250);
        });

        it('should reject invalid event type', async () => {
            const res = await app.request('/api/v1/settings/trust/org_1', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scoring: {
                        events: {
                            invalid_event: { points: 10 },
                        },
                    },
                }),
            });

            expect(res.status).toBe(400);
            const json = await res.json();
            expect(json.success).toBe(false);
            expect(json.error).toContain('Invalid event type');
        });

        it('should reject invalid decay days', async () => {
            const res = await app.request('/api/v1/settings/trust/org_1', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scoring: {
                        events: {
                            task_completed: { decayDays: 500 },
                        },
                    },
                }),
            });

            expect(res.status).toBe(400);
            const json = await res.json();
            expect(json.error).toContain('decayDays must be between 1 and 365');
        });

        it('should reject overlapping tiers', async () => {
            const res = await app.request('/api/v1/settings/trust/org_1', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tiers: [
                        { level: 'UNTRUSTED', minScore: 0, maxScore: 300 },
                        { level: 'PROBATIONARY', minScore: 200, maxScore: 500 },
                    ],
                }),
            });

            expect(res.status).toBe(400);
            const json = await res.json();
            expect(json.error).toContain('cannot overlap');
        });

        it('should reject invalid tier level', async () => {
            const res = await app.request('/api/v1/settings/trust/org_1', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tiers: [{ level: 'SUPER_ELITE', minScore: 0, maxScore: 100 }],
                }),
            });

            expect(res.status).toBe(400);
            const json = await res.json();
            expect(json.error).toContain('valid tier level');
        });
    });

    // =========================================================================
    // POST /api/v1/settings/trust/:orgId/preview
    // =========================================================================

    describe('POST /:orgId/preview', () => {
        it('should preview tier changes', async () => {
            // Initialize some agents
            const calculator = getTrustScoreCalculator();
            const tierManager = getTierManager();

            calculator.initializeAgent('agent_1', 'org_1', 350);
            calculator.initializeAgent('agent_2', 'org_1', 550);
            tierManager.initializeAgent('agent_1', 'org_1', 350);
            tierManager.initializeAgent('agent_2', 'org_1', 550);

            // Preview a config change that would affect tiers
            const res = await app.request('/api/v1/settings/trust/org_1/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tiers: [
                        { level: 'UNTRUSTED', minScore: 0, maxScore: 299 },
                        { level: 'PROBATIONARY', minScore: 300, maxScore: 499 },
                        { level: 'TRUSTED', minScore: 500, maxScore: 1000 },
                    ],
                }),
            });

            expect(res.status).toBe(200);
            const json = await res.json();
            expect(json.success).toBe(true);
            expect(json.data.affectedAgents).toBe(2);
        });

        it('should show capability changes', async () => {
            const calculator = getTrustScoreCalculator();
            const tierManager = getTierManager();

            // Agent at VERIFIED tier with delegate capability
            calculator.initializeAgent('agent_1', 'org_1', 650);
            tierManager.initializeAgent('agent_1', 'org_1', 650);

            // Preview config that would demote to TRUSTED (no delegate)
            const res = await app.request('/api/v1/settings/trust/org_1/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tiers: [
                        { level: 'UNTRUSTED', minScore: 0, maxScore: 299 },
                        { level: 'TRUSTED', minScore: 300, maxScore: 799, capabilities: ['execute'] },
                        { level: 'ELITE', minScore: 800, maxScore: 1000, capabilities: ['execute', 'delegate'] },
                    ],
                }),
            });

            expect(res.status).toBe(200);
            const json = await res.json();
            expect(json.success).toBe(true);
        });

        it('should reject invalid preview config', async () => {
            const res = await app.request('/api/v1/settings/trust/org_1/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tiers: [{ level: 'INVALID', minScore: 0, maxScore: 100 }],
                }),
            });

            expect(res.status).toBe(400);
        });
    });

    // =========================================================================
    // POST /api/v1/settings/trust/:orgId/reset
    // =========================================================================

    describe('POST /:orgId/reset', () => {
        it('should reset config to defaults', async () => {
            // First customize config
            const calculator = getTrustScoreCalculator();
            calculator.setOrgConfig('org_1', { baseScore: 500 });

            // Reset
            const res = await app.request('/api/v1/settings/trust/org_1/reset', {
                method: 'POST',
            });

            expect(res.status).toBe(200);
            const json = await res.json();
            expect(json.success).toBe(true);

            // Verify reset
            const config = calculator.getOrgConfig('org_1');
            expect(config.baseScore).toBe(300);
        });
    });

    // =========================================================================
    // GET /api/v1/settings/trust/defaults
    // =========================================================================

    describe('GET /defaults', () => {
        it('should return default configuration', async () => {
            const res = await app.request('/api/v1/settings/trust/defaults');

            expect(res.status).toBe(200);
            const json = await res.json();
            expect(json.success).toBe(true);
            expect(json.data.scoring.events).toEqual(DEFAULT_EVENT_CONFIG);
            expect(json.data.tiers.length).toBe(6);
        });
    });

    // =========================================================================
    // Validation
    // =========================================================================

    describe('Validation', () => {
        it('should reject invalid JSON body', async () => {
            const res = await app.request('/api/v1/settings/trust/org_1', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: 'not json',
            });

            // Invalid JSON causes parse error
            expect(res.status).toBe(500);
        });

        it('should reject null body', async () => {
            const res = await app.request('/api/v1/settings/trust/org_1', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(null),
            });

            expect(res.status).toBe(400);
        });

        it('should reject negative minScore', async () => {
            const res = await app.request('/api/v1/settings/trust/org_1', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scoring: { minScore: -10 },
                }),
            });

            expect(res.status).toBe(400);
        });

        it('should reject tier with minScore > maxScore', async () => {
            const res = await app.request('/api/v1/settings/trust/org_1', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tiers: [{ level: 'UNTRUSTED', minScore: 500, maxScore: 100 }],
                }),
            });

            expect(res.status).toBe(400);
        });
    });
});
