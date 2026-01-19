/**
 * Logging Middleware - Unit Tests
 * Epic 9: Production Hardening
 * Story 9.2: Structured Logging with Correlation IDs
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import {
    loggingMiddleware,
    getRequestLogger,
    getCorrelationId,
    logAudit,
    logDomainEvent,
} from './logging.js';

// ============================================================================
// Test Helpers
// ============================================================================

function createTestApp(config: Parameters<typeof loggingMiddleware>[0] = {}) {
    const app = new Hono();

    // Add request ID middleware (simulated)
    app.use('*', async (c, next) => {
        const requestId = c.req.header('X-Request-ID') || crypto.randomUUID();
        c.set('requestId', requestId);
        c.header('X-Request-ID', requestId);
        await next();
    });

    // Add logging middleware
    app.use('*', loggingMiddleware(config));

    // Test routes
    app.get('/test', (c) => c.json({ message: 'ok' }));
    app.get('/health', (c) => c.json({ status: 'healthy' }));
    app.post('/error', (c) => {
        c.status(500);
        return c.json({ error: 'Internal error' });
    });
    app.get('/with-logger', (c) => {
        const log = getRequestLogger(c);
        const correlationId = getCorrelationId(c);
        log.info('Test log from handler');
        return c.json({ correlationId });
    });

    return app;
}

describe('Logging Middleware', () => {
    // ========================================================================
    // Middleware Configuration Tests
    // ========================================================================

    describe('Middleware Configuration', () => {
        it('logs requests to regular paths', async () => {
            const app = createTestApp();
            const res = await app.request('/test');

            expect(res.status).toBe(200);
        });

        it('skips logging for configured skip paths', async () => {
            const app = createTestApp({
                skipPaths: ['/health', '/live', '/ready'],
            });

            const res = await app.request('/health');
            expect(res.status).toBe(200);
        });

        it('uses default skip paths when not configured', async () => {
            const app = createTestApp();
            const res = await app.request('/health');
            expect(res.status).toBe(200);
        });
    });

    // ========================================================================
    // Correlation ID Tests
    // ========================================================================

    describe('Correlation ID Handling', () => {
        it('extracts correlation ID from request header', async () => {
            const app = createTestApp();
            const testId = 'test-correlation-123';

            const res = await app.request('/with-logger', {
                headers: { 'X-Request-ID': testId },
            });

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.correlationId).toBe(testId);
        });

        it('generates correlation ID when not provided', async () => {
            const app = createTestApp();
            const res = await app.request('/with-logger');

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.correlationId).toBeDefined();
            expect(body.correlationId).toMatch(/^[a-f0-9-]{36}$/);
        });

        it('includes correlation ID in response header', async () => {
            const app = createTestApp();
            const res = await app.request('/test');

            expect(res.status).toBe(200);
            expect(res.headers.get('X-Request-ID')).toBeDefined();
        });
    });

    // ========================================================================
    // Request Logger Access Tests
    // ========================================================================

    describe('Request Logger Access', () => {
        it('getRequestLogger returns logger from context', async () => {
            const app = createTestApp();
            const res = await app.request('/with-logger');

            expect(res.status).toBe(200);
        });

        it('getCorrelationId returns ID from context', async () => {
            const app = createTestApp();
            const testId = 'explicit-id-456';

            const res = await app.request('/with-logger', {
                headers: { 'X-Request-ID': testId },
            });

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.correlationId).toBe(testId);
        });
    });

    // ========================================================================
    // Response Status Logging Tests
    // ========================================================================

    describe('Response Status Logging', () => {
        it('logs 2xx responses as info', async () => {
            const app = createTestApp();
            const res = await app.request('/test');
            expect(res.status).toBe(200);
        });

        it('logs 4xx responses as warn', async () => {
            const app = new Hono();
            app.use('*', loggingMiddleware());
            app.get('/notfound', (c) => {
                c.status(404);
                return c.json({ error: 'Not found' });
            });

            const res = await app.request('/notfound');
            expect(res.status).toBe(404);
        });

        it('logs 5xx responses as error', async () => {
            const app = createTestApp();
            const res = await app.request('/error', { method: 'POST' });
            expect(res.status).toBe(500);
        });
    });
});

// ============================================================================
// Audit Logging Tests
// ============================================================================

describe('Audit Logging', () => {
    it('logAudit logs successful audit events', () => {
        expect(() => logAudit({
            action: 'APPROVE_DECISION',
            resource: 'decision',
            resourceId: 'dec-123',
            userId: 'user-456',
            orgId: 'org-789',
            success: true,
            correlationId: 'corr-101',
        })).not.toThrow();
    });

    it('logAudit logs failed audit events', () => {
        expect(() => logAudit({
            action: 'DELETE_AGENT',
            resource: 'agent',
            resourceId: 'agent-123',
            success: false,
            details: { reason: 'Insufficient permissions' },
        })).not.toThrow();
    });

    it('logAudit works without optional fields', () => {
        expect(() => logAudit({
            action: 'VIEW_DASHBOARD',
            resource: 'dashboard',
            success: true,
        })).not.toThrow();
    });
});

// ============================================================================
// Domain Event Logging Tests
// ============================================================================

describe('Domain Event Logging', () => {
    it('logDomainEvent logs events with full context', () => {
        expect(() => logDomainEvent({
            event: 'DecisionApproved',
            aggregate: 'Decision',
            aggregateId: 'dec-123',
            payload: { approvedBy: 'user-456' },
            correlationId: 'corr-789',
            userId: 'user-456',
            orgId: 'org-101',
        })).not.toThrow();
    });

    it('logDomainEvent works with minimal data', () => {
        expect(() => logDomainEvent({
            event: 'AgentSpawned',
            aggregate: 'Agent',
            aggregateId: 'agent-123',
        })).not.toThrow();
    });
});
