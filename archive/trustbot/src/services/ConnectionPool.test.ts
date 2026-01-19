/**
 * Connection Pool - Unit Tests
 *
 * Epic 10: Agent Connection Layer
 * Story 10.6: Connection Pool Management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConnectionPool, type ConnectionPoolConfig } from './ConnectionPool.js';

describe('ConnectionPool', () => {
    let pool: ConnectionPool;

    beforeEach(() => {
        // Default pool with storm protection disabled for most tests
        pool = new ConnectionPool({
            maxConnections: 100,
            maxConnectionsPerOrg: 20,
            maxConnectionsPerAgent: 3,
            connectionRateLimitGlobal: 1000, // High limit for testing
            connectionRateLimitPerOrg: 500,  // High limit for testing
            rateLimitWindowMs: 1000,
            idleTimeoutMs: 5000,
            stormProtection: false, // Disabled for most tests
            stormThreshold: 50,
            stormCooldownMs: 1000,
        });
    });

    afterEach(() => {
        pool.clear();
    });

    // ========================================================================
    // Basic Connection Tests
    // ========================================================================

    describe('Basic Connections', () => {
        it('allows a new connection', () => {
            const result = pool.requestConnection('agent_1', 'org_1');

            expect(result.allowed).toBe(true);
            expect(result.connectionId).toBeDefined();
            expect(result.connectionId).toMatch(/^conn_/);
        });

        it('tracks connection info correctly', () => {
            const result = pool.requestConnection('agent_1', 'org_1', {
                remoteAddress: '192.168.1.1',
                userAgent: 'TestAgent/1.0',
            });

            const info = pool.getConnection(result.connectionId!);

            expect(info).not.toBeNull();
            expect(info?.agentId).toBe('agent_1');
            expect(info?.orgId).toBe('org_1');
            expect(info?.remoteAddress).toBe('192.168.1.1');
            expect(info?.userAgent).toBe('TestAgent/1.0');
            expect(info?.connectedAt).toBeInstanceOf(Date);
        });

        it('releases connections correctly', () => {
            const result = pool.requestConnection('agent_1', 'org_1');
            expect(pool.getConnectionCount()).toBe(1);

            const released = pool.releaseConnection(result.connectionId!);

            expect(released).toBe(true);
            expect(pool.getConnectionCount()).toBe(0);
            expect(pool.getConnection(result.connectionId!)).toBeNull();
        });

        it('returns false when releasing non-existent connection', () => {
            const released = pool.releaseConnection('non_existent');
            expect(released).toBe(false);
        });

        it('updates last activity timestamp', () => {
            const result = pool.requestConnection('agent_1', 'org_1');
            const info1 = pool.getConnection(result.connectionId!);
            const firstActivity = info1?.lastActivityAt.getTime();

            // Touch connection
            pool.touchConnection(result.connectionId!);

            const info2 = pool.getConnection(result.connectionId!);
            expect(info2?.lastActivityAt.getTime()).toBeGreaterThanOrEqual(firstActivity!);
        });

        it('emits connection:added event', () => {
            const handler = vi.fn();
            pool.on('connection:added', handler);

            pool.requestConnection('agent_1', 'org_1');

            expect(handler).toHaveBeenCalled();
            expect(handler.mock.calls[0][0].agentId).toBe('agent_1');
        });

        it('emits connection:removed event', () => {
            const handler = vi.fn();
            pool.on('connection:removed', handler);

            const result = pool.requestConnection('agent_1', 'org_1');
            pool.releaseConnection(result.connectionId!, 'test_reason');

            expect(handler).toHaveBeenCalledWith(result.connectionId, 'agent_1', 'test_reason');
        });
    });

    // ========================================================================
    // Global Limit Tests
    // ========================================================================

    describe('Global Limits', () => {
        it('enforces maximum connections', () => {
            // Fill up to limit
            for (let i = 0; i < 100; i++) {
                const result = pool.requestConnection(`agent_${i}`, `org_${i % 50}`);
                expect(result.allowed).toBe(true);
            }

            // Next should fail
            const result = pool.requestConnection('agent_overflow', 'org_0');

            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('max_connections_reached');
        });

        it('emits connection:rejected event on limit', () => {
            const handler = vi.fn();
            pool.on('connection:rejected', handler);

            // Fill pool
            for (let i = 0; i < 100; i++) {
                pool.requestConnection(`agent_${i}`, `org_${i % 50}`);
            }

            // Trigger rejection
            pool.requestConnection('overflow', 'org_0');

            expect(handler).toHaveBeenCalledWith('overflow', 'org_0', 'max_connections_reached');
        });

        it('allows connection after release', () => {
            // Fill pool
            const connections: string[] = [];
            for (let i = 0; i < 100; i++) {
                const result = pool.requestConnection(`agent_${i}`, `org_${i % 50}`);
                connections.push(result.connectionId!);
            }

            // Release one
            pool.releaseConnection(connections[0]);

            // Now should work
            const result = pool.requestConnection('new_agent', 'org_0');
            expect(result.allowed).toBe(true);
        });
    });

    // ========================================================================
    // Per-Org Limit Tests
    // ========================================================================

    describe('Per-Org Limits', () => {
        it('enforces per-org connection limit', () => {
            // Fill org limit
            for (let i = 0; i < 20; i++) {
                const result = pool.requestConnection(`agent_${i}`, 'org_1');
                expect(result.allowed).toBe(true);
            }

            // Next for same org should fail
            const result = pool.requestConnection('agent_overflow', 'org_1');

            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('max_org_connections_reached');
        });

        it('allows connection for different org', () => {
            // Fill org_1
            for (let i = 0; i < 20; i++) {
                pool.requestConnection(`agent_${i}`, 'org_1');
            }

            // Different org should work
            const result = pool.requestConnection('agent_other', 'org_2');
            expect(result.allowed).toBe(true);
        });

        it('tracks org connection counts correctly', () => {
            for (let i = 0; i < 5; i++) {
                pool.requestConnection(`agent_${i}`, 'org_1');
            }
            for (let i = 0; i < 3; i++) {
                pool.requestConnection(`agent_${i}`, 'org_2');
            }

            expect(pool.getOrgConnectionCount('org_1')).toBe(5);
            expect(pool.getOrgConnectionCount('org_2')).toBe(3);
            expect(pool.getOrgConnectionCount('org_3')).toBe(0);
        });
    });

    // ========================================================================
    // Per-Agent Limit Tests
    // ========================================================================

    describe('Per-Agent Limits', () => {
        it('enforces per-agent connection limit', () => {
            // Fill agent limit (3)
            for (let i = 0; i < 3; i++) {
                const result = pool.requestConnection('agent_1', 'org_1');
                expect(result.allowed).toBe(true);
            }

            // Fourth should fail
            const result = pool.requestConnection('agent_1', 'org_1');

            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('max_agent_connections_reached');
        });

        it('allows connection for different agent', () => {
            // Fill agent_1
            for (let i = 0; i < 3; i++) {
                pool.requestConnection('agent_1', 'org_1');
            }

            // Different agent should work
            const result = pool.requestConnection('agent_2', 'org_1');
            expect(result.allowed).toBe(true);
        });

        it('tracks agent connection counts correctly', () => {
            pool.requestConnection('agent_1', 'org_1');
            pool.requestConnection('agent_1', 'org_1');
            pool.requestConnection('agent_2', 'org_1');

            expect(pool.getAgentConnectionCount('agent_1')).toBe(2);
            expect(pool.getAgentConnectionCount('agent_2')).toBe(1);
            expect(pool.getAgentConnectionCount('agent_3')).toBe(0);
        });
    });

    // ========================================================================
    // Rate Limiting Tests
    // ========================================================================

    describe('Rate Limiting', () => {
        let rateLimitedPool: ConnectionPool;

        beforeEach(() => {
            rateLimitedPool = new ConnectionPool({
                maxConnections: 1000,
                maxConnectionsPerOrg: 500,
                maxConnectionsPerAgent: 100,
                connectionRateLimitGlobal: 50,
                connectionRateLimitPerOrg: 10,
                rateLimitWindowMs: 1000,
                stormProtection: false,
            });
        });

        afterEach(() => {
            rateLimitedPool.clear();
        });

        it('enforces global rate limit', () => {
            // Create 50 connections rapidly (at limit)
            for (let i = 0; i < 50; i++) {
                const result = rateLimitedPool.requestConnection(`agent_${i}`, `org_${i % 100}`);
                expect(result.allowed).toBe(true);
            }

            // 51st should be rate limited
            const result = rateLimitedPool.requestConnection('agent_overflow', 'org_0');

            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('rate_limit_exceeded');
        });

        it('enforces per-org rate limit', () => {
            // Create 10 connections for org_1 (at limit)
            for (let i = 0; i < 10; i++) {
                const result = rateLimitedPool.requestConnection(`agent_${i}`, 'org_1');
                expect(result.allowed).toBe(true);
            }

            // 11th for same org should be rate limited
            const result = rateLimitedPool.requestConnection('agent_overflow', 'org_1');

            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('org_rate_limit_exceeded');
        });
    });

    // ========================================================================
    // Storm Protection Tests
    // ========================================================================

    describe('Storm Protection', () => {
        let stormPool: ConnectionPool;

        beforeEach(() => {
            stormPool = new ConnectionPool({
                maxConnections: 1000,
                maxConnectionsPerOrg: 500,
                maxConnectionsPerAgent: 100,
                connectionRateLimitGlobal: 1000,
                connectionRateLimitPerOrg: 500,
                rateLimitWindowMs: 1000,
                stormProtection: true,
                stormThreshold: 20,
                stormCooldownMs: 1000,
            });
        });

        afterEach(() => {
            stormPool.clear();
        });

        it('activates storm mode on rapid connections', () => {
            const stormHandler = vi.fn();
            stormPool.on('storm:detected', stormHandler);

            // Create connections to reach threshold (storm triggers when count >= threshold)
            // The check happens before recording, so we need 21 connections to trigger
            // (after 20 are recorded, the 21st check sees 20 timestamps)
            for (let i = 0; i < 21; i++) {
                stormPool.requestConnection(`agent_${i}`, `org_${i % 10}`);
            }

            expect(stormHandler).toHaveBeenCalled();

            // Next connection should be rejected
            const result = stormPool.requestConnection('agent_storm', 'org_0');
            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('storm_protection_active');
        });

        it('clears storm mode after cooldown', async () => {
            vi.useFakeTimers();

            // Trigger storm (need 21 connections)
            for (let i = 0; i < 21; i++) {
                stormPool.requestConnection(`agent_${i}`, `org_${i % 10}`);
            }

            const stats = stormPool.getStats();
            expect(stats.isInStormMode).toBe(true);

            // Advance past cooldown (1000ms)
            vi.advanceTimersByTime(1100);

            const stats2 = stormPool.getStats();
            expect(stats2.isInStormMode).toBe(false);

            vi.useRealTimers();
        });

        it('emits storm:cleared event', async () => {
            vi.useFakeTimers();

            const clearHandler = vi.fn();
            stormPool.on('storm:cleared', clearHandler);

            // Trigger storm (need 21 connections)
            for (let i = 0; i < 21; i++) {
                stormPool.requestConnection(`agent_${i}`, `org_${i % 10}`);
            }

            // Advance past cooldown
            vi.advanceTimersByTime(1100);

            expect(clearHandler).toHaveBeenCalled();

            vi.useRealTimers();
        });
    });

    // ========================================================================
    // Query Tests
    // ========================================================================

    describe('Queries', () => {
        beforeEach(() => {
            // Set up some connections
            pool.requestConnection('agent_1', 'org_1');
            pool.requestConnection('agent_1', 'org_1');
            pool.requestConnection('agent_2', 'org_1');
            pool.requestConnection('agent_3', 'org_2');
        });

        it('getAgentConnections returns all connections for agent', () => {
            const connections = pool.getAgentConnections('agent_1');
            expect(connections.length).toBe(2);
            expect(connections[0].agentId).toBe('agent_1');
        });

        it('getOrgConnections returns all connections for org', () => {
            const connections = pool.getOrgConnections('org_1');
            expect(connections.length).toBe(3);
        });

        it('getStats returns accurate statistics', () => {
            const stats = pool.getStats();

            expect(stats.totalConnections).toBe(4);
            expect(stats.connectionsByOrg.get('org_1')).toBe(3);
            expect(stats.connectionsByOrg.get('org_2')).toBe(1);
            expect(stats.connectionsByAgent.get('agent_1')).toBe(2);
            expect(stats.totalConnectionsServed).toBe(4);
        });

        it('isAtCapacity returns correct status', () => {
            expect(pool.isAtCapacity()).toBe(false);

            // Fill pool (already have 4)
            for (let i = 0; i < 96; i++) {
                pool.requestConnection(`agent_fill_${i}`, `org_${i % 50}`);
            }

            expect(pool.isAtCapacity()).toBe(true);
        });

        it('isOrgAtCapacity returns correct status', () => {
            expect(pool.isOrgAtCapacity('org_1')).toBe(false);

            // Fill org_1 (already has 3, need 17 more)
            for (let i = 0; i < 17; i++) {
                pool.requestConnection(`agent_fill_${i}`, 'org_1');
            }

            expect(pool.isOrgAtCapacity('org_1')).toBe(true);
            expect(pool.isOrgAtCapacity('org_2')).toBe(false);
        });
    });

    // ========================================================================
    // Disconnect Tests
    // ========================================================================

    describe('Disconnect Operations', () => {
        beforeEach(() => {
            pool.requestConnection('agent_1', 'org_1');
            pool.requestConnection('agent_1', 'org_1');
            pool.requestConnection('agent_2', 'org_1');
            pool.requestConnection('agent_3', 'org_2');
        });

        it('disconnectAgent removes all agent connections', () => {
            const disconnected = pool.disconnectAgent('agent_1');

            expect(disconnected).toBe(2);
            expect(pool.getAgentConnectionCount('agent_1')).toBe(0);
            expect(pool.getConnectionCount()).toBe(2);
        });

        it('disconnectOrg removes all org connections', () => {
            const disconnected = pool.disconnectOrg('org_1');

            expect(disconnected).toBe(3);
            expect(pool.getOrgConnectionCount('org_1')).toBe(0);
            expect(pool.getConnectionCount()).toBe(1);
        });
    });

    // ========================================================================
    // Idle Cleanup Tests
    // ========================================================================

    describe('Idle Cleanup', () => {
        it('cleans up idle connections', async () => {
            vi.useFakeTimers();

            pool.requestConnection('agent_1', 'org_1');
            pool.requestConnection('agent_2', 'org_1');

            // Advance time past idle timeout (5000ms)
            vi.advanceTimersByTime(6000);

            const cleaned = pool.cleanupIdleConnections();

            expect(cleaned).toBe(2);
            expect(pool.getConnectionCount()).toBe(0);

            vi.useRealTimers();
        });

        it('keeps active connections', async () => {
            vi.useFakeTimers();

            const conn1 = pool.requestConnection('agent_1', 'org_1');
            pool.requestConnection('agent_2', 'org_1');

            // Advance some time
            vi.advanceTimersByTime(3000);

            // Touch one connection
            pool.touchConnection(conn1.connectionId!);

            // Advance past idle timeout
            vi.advanceTimersByTime(3000);

            const cleaned = pool.cleanupIdleConnections();

            expect(cleaned).toBe(1); // Only conn2 should be cleaned
            expect(pool.getConnectionCount()).toBe(1);

            vi.useRealTimers();
        });
    });

    // ========================================================================
    // Limit Warning Tests
    // ========================================================================

    describe('Limit Warnings', () => {
        it('emits limit:approaching for global limit at 80%', () => {
            const handler = vi.fn();
            pool.on('limit:approaching', handler);

            // Fill to 80% (80 connections)
            for (let i = 0; i < 80; i++) {
                pool.requestConnection(`agent_${i}`, `org_${i % 50}`);
            }

            // Check that at least one call was for global limit
            const globalCalls = handler.mock.calls.filter(
                (call: unknown[]) => call[0] === 'global'
            );
            expect(globalCalls.length).toBeGreaterThan(0);
        });

        it('emits limit:approaching for org limit at 80%', () => {
            const handler = vi.fn();
            pool.on('limit:approaching', handler);

            // Fill org to 80% (16 connections)
            for (let i = 0; i < 16; i++) {
                pool.requestConnection(`agent_${i}`, 'org_1');
            }

            // Check that at least one call was for org limit
            const orgCalls = handler.mock.calls.filter(
                (call: unknown[]) => call[0] === 'org' && call[3] === 'org_1'
            );
            expect(orgCalls.length).toBeGreaterThan(0);
        });
    });

    // ========================================================================
    // Shutdown Tests
    // ========================================================================

    describe('Shutdown', () => {
        it('rejects connections during shutdown', async () => {
            pool.requestConnection('agent_1', 'org_1');

            // Start shutdown (don't await)
            const shutdownPromise = pool.shutdown(100);

            // Try to connect during shutdown
            const result = pool.requestConnection('agent_2', 'org_1');

            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('pool_shutting_down');

            await shutdownPromise;
        });

        it('clears all connections on shutdown', async () => {
            pool.requestConnection('agent_1', 'org_1');
            pool.requestConnection('agent_2', 'org_1');

            await pool.shutdown(10);

            expect(pool.getConnectionCount()).toBe(0);
        });
    });

    // ========================================================================
    // Clear Tests
    // ========================================================================

    describe('Clear', () => {
        it('clears all state', () => {
            pool.requestConnection('agent_1', 'org_1');
            pool.requestConnection('agent_2', 'org_1');

            pool.clear();

            expect(pool.getConnectionCount()).toBe(0);
            expect(pool.getStats().totalConnections).toBe(0);
        });
    });
});
