/**
 * Prometheus Metrics Middleware Tests
 *
 * Epic 13: Observability & Monitoring
 * Story 13.1: Prometheus Metrics
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import {
    metricsMiddleware,
    metricsHandler,
    getMetricsRegistry,
    resetMetricsRegistry,
    metrics,
} from './metrics.js';

// ============================================================================
// Test Setup
// ============================================================================

describe('Prometheus Metrics', () => {
    beforeEach(() => {
        resetMetricsRegistry();
    });

    afterEach(() => {
        resetMetricsRegistry();
    });

    // =========================================================================
    // Metrics Registry
    // =========================================================================

    describe('MetricsRegistry', () => {
        it('should return same instance on multiple calls', () => {
            const registry1 = getMetricsRegistry();
            const registry2 = getMetricsRegistry();
            expect(registry1).toBe(registry2);
        });

        it('should reset properly', () => {
            const registry1 = getMetricsRegistry();
            resetMetricsRegistry();
            const registry2 = getMetricsRegistry();
            expect(registry1).not.toBe(registry2);
        });

        it('should generate metrics output', async () => {
            const registry = getMetricsRegistry();
            const output = await registry.getMetrics();

            expect(output).toContain('aurais_');
            expect(output).toContain('http_requests_total');
        });
    });

    // =========================================================================
    // HTTP Metrics
    // =========================================================================

    describe('HTTP Metrics', () => {
        it('should record HTTP request metrics', async () => {
            const registry = getMetricsRegistry();
            registry.recordHttpRequest('GET', '/api/test', 200, 0.05);

            const output = await registry.getMetrics();
            expect(output).toContain('aurais_http_requests_total');
            expect(output).toContain('method="GET"');
            expect(output).toContain('status_code="200"');
        });

        it('should normalize paths with UUIDs', async () => {
            const registry = getMetricsRegistry();
            registry.recordHttpRequest('GET', '/api/v1/agents/a1b2c3d4-e5f6-7890-abcd-ef1234567890', 200, 0.05);

            const output = await registry.getMetrics();
            expect(output).toContain('path="/api/v1/agents/:uuid"');
        });

        it('should normalize paths with IDs', async () => {
            const registry = getMetricsRegistry();
            registry.recordHttpRequest('GET', '/api/v1/decisions/dec_123/approve', 200, 0.05);

            const output = await registry.getMetrics();
            expect(output).toContain('path="/api/v1/decisions/:id/approve"');
        });

        it('should record request duration histogram', async () => {
            const registry = getMetricsRegistry();
            registry.recordHttpRequest('GET', '/api/test', 200, 0.05);
            registry.recordHttpRequest('GET', '/api/test', 200, 0.15);

            const output = await registry.getMetrics();
            expect(output).toContain('aurais_http_request_duration_seconds');
            expect(output).toContain('_bucket');
        });
    });

    // =========================================================================
    // Middleware Integration
    // =========================================================================

    describe('metricsMiddleware', () => {
        it('should record metrics for requests', async () => {
            const app = new Hono();
            app.use('*', metricsMiddleware());
            app.get('/api/test', (c) => c.json({ ok: true }));

            await app.request('/api/test');

            const registry = getMetricsRegistry();
            const output = await registry.getMetrics();
            expect(output).toContain('aurais_http_requests_total');
        });

        it('should exclude /metrics path', async () => {
            const app = new Hono();
            app.use('*', metricsMiddleware());
            app.get('/metrics', metricsHandler);
            app.get('/api/test', (c) => c.json({ ok: true }));

            // Make request to /metrics (should be excluded)
            await app.request('/metrics');

            const registry = getMetricsRegistry();
            const output = await registry.getMetrics();
            // The /metrics path should not appear in recorded requests
            expect(output).not.toContain('path="/metrics"');
        });

        it('should exclude health check paths', async () => {
            const app = new Hono();
            app.use('*', metricsMiddleware());
            app.get('/health', (c) => c.json({ status: 'ok' }));
            app.get('/api/test', (c) => c.json({ ok: true }));

            await app.request('/health');

            const registry = getMetricsRegistry();
            const output = await registry.getMetrics();
            expect(output).not.toContain('path="/health"');
        });

        it('should record error status codes', async () => {
            const app = new Hono();
            app.use('*', metricsMiddleware());
            app.get('/api/error', (c) => c.json({ error: 'Not found' }, 404));

            await app.request('/api/error');

            const registry = getMetricsRegistry();
            const output = await registry.getMetrics();
            expect(output).toContain('status_code="404"');
        });
    });

    // =========================================================================
    // Metrics Endpoint
    // =========================================================================

    describe('metricsHandler', () => {
        it('should return prometheus format metrics', async () => {
            const app = new Hono();
            app.get('/metrics', metricsHandler);

            const res = await app.request('/metrics');
            const text = await res.text();

            expect(res.status).toBe(200);
            expect(res.headers.get('content-type')).toContain('text/plain');
            expect(text).toContain('# HELP');
            expect(text).toContain('# TYPE');
        });
    });

    // =========================================================================
    // WebSocket Metrics
    // =========================================================================

    describe('WebSocket Metrics', () => {
        it('should track connection count', async () => {
            const registry = getMetricsRegistry();

            registry.setWsConnections('agent', 5);

            const output = await registry.getMetrics();
            expect(output).toContain('aurais_websocket_connections_current');
            expect(output).toContain('type="agent"');
        });

        it('should increment and decrement connections', async () => {
            const registry = getMetricsRegistry();

            registry.setWsConnections('agent', 0);
            registry.incWsConnections('agent');
            registry.incWsConnections('agent');
            registry.decWsConnections('agent');

            const output = await registry.getMetrics();
            expect(output).toContain('aurais_websocket_connections_current');
        });

        it('should record message counts', async () => {
            const registry = getMetricsRegistry();

            registry.recordWsMessage('inbound', 'task_update');
            registry.recordWsMessage('outbound', 'decision_request');

            const output = await registry.getMetrics();
            expect(output).toContain('aurais_websocket_messages_total');
            expect(output).toContain('direction="inbound"');
            expect(output).toContain('direction="outbound"');
        });
    });

    // =========================================================================
    // Trust Score Metrics
    // =========================================================================

    describe('Trust Score Metrics', () => {
        it('should record trust score changes', async () => {
            const registry = getMetricsRegistry();

            registry.recordTrustScoreChange('increase', 'task_completed', 'org_1');
            registry.recordTrustScoreChange('decrease', 'task_failed', 'org_1');

            const output = await registry.getMetrics();
            expect(output).toContain('aurais_trust_score_changes_total');
            expect(output).toContain('direction="increase"');
            expect(output).toContain('direction="decrease"');
        });

        it('should track current trust scores', async () => {
            const registry = getMetricsRegistry();

            registry.setTrustScore('agent_1', 'org_1', 850);

            const output = await registry.getMetrics();
            expect(output).toContain('aurais_trust_score_current');
            expect(output).toContain('agent_id="agent_1"');
        });

        it('should record tier changes', async () => {
            const registry = getMetricsRegistry();

            registry.recordTierChange('TRUSTED', 'VERIFIED', 'org_1');

            const output = await registry.getMetrics();
            expect(output).toContain('aurais_trust_tier_changes_total');
            expect(output).toContain('from_tier="TRUSTED"');
            expect(output).toContain('to_tier="VERIFIED"');
        });
    });

    // =========================================================================
    // Decision Metrics
    // =========================================================================

    describe('Decision Metrics', () => {
        it('should record decisions processed', async () => {
            const registry = getMetricsRegistry();

            registry.recordDecisionProcessed('execute', 'approved', 'auto_approval', 'org_1');
            registry.recordDecisionProcessed('external', 'denied', 'tribunal', 'org_1');

            const output = await registry.getMetrics();
            expect(output).toContain('aurais_decisions_processed_total');
            expect(output).toContain('outcome="approved"');
            expect(output).toContain('source="auto_approval"');
        });

        it('should record decision duration', async () => {
            const registry = getMetricsRegistry();

            registry.recordDecisionDuration('execute', 'hitl', 5.5);

            const output = await registry.getMetrics();
            expect(output).toContain('aurais_decision_duration_seconds');
        });

        it('should track queue depth', async () => {
            const registry = getMetricsRegistry();

            registry.setDecisionQueueDepth('high', 'org_1', 25);

            const output = await registry.getMetrics();
            expect(output).toContain('aurais_decision_queue_depth');
            expect(output).toContain('urgency="high"');
        });
    });

    // =========================================================================
    // Agent Metrics
    // =========================================================================

    describe('Agent Metrics', () => {
        it('should track connected agents', async () => {
            const registry = getMetricsRegistry();

            registry.setAgentsConnected('online', 'org_1', 10);
            registry.setAgentsConnected('offline', 'org_1', 2);

            const output = await registry.getMetrics();
            expect(output).toContain('aurais_agents_connected');
            expect(output).toContain('status="online"');
            expect(output).toContain('status="offline"');
        });

        it('should record heartbeat latency', async () => {
            const registry = getMetricsRegistry();

            registry.recordHeartbeatLatency('agent_1', 0.05);

            const output = await registry.getMetrics();
            expect(output).toContain('aurais_agent_heartbeat_latency_seconds');
        });
    });

    // =========================================================================
    // Convenience API
    // =========================================================================

    describe('metrics convenience API', () => {
        it('should provide http recording', async () => {
            metrics.http.record('POST', '/api/test', 201, 0.1);

            const output = await getMetricsRegistry().getMetrics();
            expect(output).toContain('method="POST"');
            expect(output).toContain('status_code="201"');
        });

        it('should provide websocket recording', async () => {
            metrics.websocket.setConnections('agent', 5);
            metrics.websocket.recordMessage('inbound', 'heartbeat');

            const output = await getMetricsRegistry().getMetrics();
            expect(output).toContain('websocket_connections_current');
            expect(output).toContain('websocket_messages_total');
        });

        it('should provide trust score recording', async () => {
            metrics.trust.recordChange('increase', 'task_completed', 'org_1');
            metrics.trust.setScore('agent_1', 'org_1', 900);
            metrics.trust.recordTierChange('TRUSTED', 'VERIFIED', 'org_1');

            const output = await getMetricsRegistry().getMetrics();
            expect(output).toContain('trust_score_changes_total');
            expect(output).toContain('trust_score_current');
            expect(output).toContain('trust_tier_changes_total');
        });

        it('should provide decision recording', async () => {
            metrics.decisions.recordProcessed('execute', 'approved', 'tribunal', 'org_1');
            metrics.decisions.recordDuration('execute', 'tribunal', 2.5);
            metrics.decisions.setQueueDepth('immediate', 'org_1', 3);

            const output = await getMetricsRegistry().getMetrics();
            expect(output).toContain('decisions_processed_total');
            expect(output).toContain('decision_duration_seconds');
            expect(output).toContain('decision_queue_depth');
        });

        it('should provide agent recording', async () => {
            metrics.agents.setConnected('online', 'org_1', 15);
            metrics.agents.recordHeartbeatLatency('agent_1', 0.03);

            const output = await getMetricsRegistry().getMetrics();
            expect(output).toContain('agents_connected');
            expect(output).toContain('agent_heartbeat_latency_seconds');
        });
    });

    // =========================================================================
    // Default Metrics
    // =========================================================================

    describe('Default Node.js Metrics', () => {
        it('should include process metrics', async () => {
            const output = await getMetricsRegistry().getMetrics();

            // Default prom-client metrics
            expect(output).toContain('process_');
            expect(output).toContain('nodejs_');
        });
    });
});
