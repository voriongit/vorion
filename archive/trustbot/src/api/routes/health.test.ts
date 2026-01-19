/**
 * Health Check Routes - Unit Tests
 * Epic 9: Production Hardening
 * Story 9.1: Health Check Endpoints
 * FR56: Health check endpoints for liveness and readiness probes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { createHealthRoutes, formatUptime, getMemoryUsageMB } from './health.js';

// ============================================================================
// Test Setup
// ============================================================================

function createTestApp(config: Parameters<typeof createHealthRoutes>[0] = {}) {
    const app = new Hono();
    const healthRoutes = createHealthRoutes(config);
    app.route('/', healthRoutes);
    return app;
}

describe('Health Check Routes', () => {
    // ========================================================================
    // GET /health - Comprehensive Health Check
    // ========================================================================

    describe('GET /health', () => {
        it('returns status with all required fields', async () => {
            const app = createTestApp();
            const res = await app.request('/health');

            expect(res.status).toBe(200);
            const body = await res.json();

            // Status is 'degraded' when no database (warn status from db check)
            expect(['healthy', 'degraded']).toContain(body.status);
            expect(body.timestamp).toBeDefined();
            expect(body.version).toBeDefined();
            expect(body.uptime).toBeGreaterThan(0);
            expect(body.uptimeFormatted).toBeDefined();
            expect(body.checks).toBeInstanceOf(Array);
        });

        it('returns healthy status when database is connected', async () => {
            const mockSupabase = {
                from: () => ({
                    select: () => ({
                        limit: () => Promise.resolve({ error: null, data: [{ id: 'test' }] }),
                    }),
                }),
            };
            const app = createTestApp({ supabase: mockSupabase });
            const res = await app.request('/health');

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.status).toBe('healthy');
        });

        it('includes memory check in checks array', async () => {
            const app = createTestApp();
            const res = await app.request('/health');

            expect(res.status).toBe(200);
            const body = await res.json();

            const memoryCheck = body.checks.find((c: { name: string }) => c.name === 'memory');
            expect(memoryCheck).toBeDefined();
            expect(memoryCheck.status).toBe('pass');
            expect(memoryCheck.message).toContain('Memory usage');
        });

        it('includes event loop check in checks array', async () => {
            const app = createTestApp();
            const res = await app.request('/health');

            expect(res.status).toBe(200);
            const body = await res.json();

            const eventLoopCheck = body.checks.find((c: { name: string }) => c.name === 'event_loop');
            expect(eventLoopCheck).toBeDefined();
            expect(['pass', 'warn']).toContain(eventLoopCheck.status);
        });

        it('shows database in warn status when not configured', async () => {
            const app = createTestApp();
            const res = await app.request('/health');

            expect(res.status).toBe(200);
            const body = await res.json();

            const dbCheck = body.checks.find((c: { name: string }) => c.name === 'database');
            expect(dbCheck).toBeDefined();
            expect(dbCheck.status).toBe('warn');
            expect(dbCheck.message).toContain('file-based mode');
        });

        it('includes connection count when provided', async () => {
            const app = createTestApp({
                getConnectionCount: () => 5,
            });
            const res = await app.request('/health');

            expect(res.status).toBe(200);
            const body = await res.json();

            const connCheck = body.checks.find((c: { name: string }) => c.name === 'websocket_connections');
            expect(connCheck).toBeDefined();
            expect(connCheck.status).toBe('pass');
            expect(connCheck.message).toBe('5 active connections');
        });

        it('includes active agent count when provided', async () => {
            const app = createTestApp({
                getActiveAgentCount: () => 3,
            });
            const res = await app.request('/health');

            expect(res.status).toBe(200);
            const body = await res.json();

            const agentCheck = body.checks.find((c: { name: string }) => c.name === 'active_agents');
            expect(agentCheck).toBeDefined();
            expect(agentCheck.status).toBe('pass');
            expect(agentCheck.message).toBe('3 agents online');
        });

        it('returns 200 for degraded status (warnings only)', async () => {
            // Degraded happens when there are warnings but no failures
            // Database in file-based mode triggers a 'warn' status
            const app = createTestApp();
            const res = await app.request('/health');

            // With no supabase, we get a 'warn' from database check
            // Overall status should be 'degraded' or 'healthy' depending on implementation
            expect(res.status).toBe(200);
        });
    });

    // ========================================================================
    // GET /ready - Kubernetes Readiness Probe
    // ========================================================================

    describe('GET /ready', () => {
        it('returns ready=true when database is available', async () => {
            const app = createTestApp();
            const res = await app.request('/ready');

            expect(res.status).toBe(200);
            const body = await res.json();

            // Without supabase, readiness check returns ready=true with warn status
            expect(body.ready).toBe(true);
            expect(body.timestamp).toBeDefined();
            expect(body.checks).toBeInstanceOf(Array);
        });

        it('includes database check in response', async () => {
            const app = createTestApp();
            const res = await app.request('/ready');

            const body = await res.json();
            const dbCheck = body.checks.find((c: { name: string }) => c.name === 'database');
            expect(dbCheck).toBeDefined();
        });

        it('returns 503 when database check fails', async () => {
            // Mock a failing database connection
            const mockSupabase = {
                from: () => ({
                    select: () => ({
                        limit: () => Promise.resolve({ error: new Error('Connection failed') }),
                    }),
                }),
            };

            const app = createTestApp({ supabase: mockSupabase });
            const res = await app.request('/ready');

            expect(res.status).toBe(503);
            const body = await res.json();
            expect(body.ready).toBe(false);
        });
    });

    // ========================================================================
    // GET /live - Kubernetes Liveness Probe
    // ========================================================================

    describe('GET /live', () => {
        it('returns alive=true with process info', async () => {
            const app = createTestApp();
            const res = await app.request('/live');

            expect(res.status).toBe(200);
            const body = await res.json();

            expect(body.alive).toBe(true);
            expect(body.timestamp).toBeDefined();
            expect(body.pid).toBeGreaterThan(0);
            expect(body.memoryUsageMB).toBeGreaterThan(0);
        });

        it('always returns 200 for liveness check', async () => {
            // Liveness check should always succeed if the process is running
            const app = createTestApp();
            const res = await app.request('/live');

            expect(res.status).toBe(200);
        });
    });

    // ========================================================================
    // GET /health/db - Database-specific Health Check
    // ========================================================================

    describe('GET /health/db', () => {
        it('returns database status without supabase', async () => {
            const app = createTestApp();
            const res = await app.request('/health/db');

            expect(res.status).toBe(200);
            const body = await res.json();

            expect(body.name).toBe('database');
            expect(body.status).toBe('warn');
            expect(body.message).toContain('file-based mode');
            expect(body.timestamp).toBeDefined();
        });

        it('returns 503 when database fails', async () => {
            const mockSupabase = {
                from: () => ({
                    select: () => ({
                        limit: () => Promise.resolve({ error: new Error('Connection timeout') }),
                    }),
                }),
            };

            const app = createTestApp({ supabase: mockSupabase });
            const res = await app.request('/health/db');

            expect(res.status).toBe(503);
            const body = await res.json();
            expect(body.status).toBe('fail');
        });

        it('returns success with latency when database is healthy', async () => {
            const mockSupabase = {
                from: () => ({
                    select: () => ({
                        limit: () => Promise.resolve({ error: null, data: [{ id: 'test' }] }),
                    }),
                }),
            };

            const app = createTestApp({ supabase: mockSupabase });
            const res = await app.request('/health/db');

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.status).toBe('pass');
            expect(body.latencyMs).toBeDefined();
            expect(body.lastChecked).toBeDefined();
        });
    });
});

// ============================================================================
// Helper Function Tests
// ============================================================================

describe('Health Check Helpers', () => {
    describe('formatUptime', () => {
        it('formats seconds correctly', () => {
            expect(formatUptime(30000)).toBe('30s');
            expect(formatUptime(45000)).toBe('45s');
        });

        it('formats minutes correctly', () => {
            expect(formatUptime(120000)).toBe('2m 0s');
            expect(formatUptime(185000)).toBe('3m 5s');
        });

        it('formats hours correctly', () => {
            expect(formatUptime(3600000)).toBe('1h 0m 0s');
            expect(formatUptime(7380000)).toBe('2h 3m 0s');
        });

        it('formats days correctly', () => {
            expect(formatUptime(86400000)).toBe('1d 0h 0m');
            expect(formatUptime(90000000)).toBe('1d 1h 0m');
        });
    });

    describe('getMemoryUsageMB', () => {
        it('returns a positive number', () => {
            const usage = getMemoryUsageMB();
            expect(usage).toBeGreaterThan(0);
            expect(Number.isInteger(usage)).toBe(true);
        });
    });
});
