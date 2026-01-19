/**
 * Heartbeat Monitor - Unit Tests
 *
 * Epic 10: Agent Connection Layer
 * Story 10.3: Agent Heartbeat System
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HeartbeatMonitor, type AgentHeartbeat, type AgentHealthStatus } from './HeartbeatMonitor.js';

// Mock WebSocket hub
vi.mock('../api/ws/index.js', () => ({
    getWebSocketHub: () => ({
        broadcast: vi.fn(),
    }),
}));

// Mock Supabase
vi.mock('../core/SupabasePersistence.js', () => ({
    hasSupabaseConfig: () => false,
    getSupabasePersistence: () => ({}),
}));

describe('HeartbeatMonitor', () => {
    let monitor: HeartbeatMonitor;

    beforeEach(() => {
        monitor = new HeartbeatMonitor({
            heartbeatInterval: 1000,    // 1 second for faster tests
            missedThreshold: 3,
            degradedThreshold: 1,
            checkInterval: 500,         // 500ms checks
            recoveryThreshold: 2,
        });
    });

    afterEach(() => {
        monitor.stop();
        monitor.clear();
    });

    // ========================================================================
    // Lifecycle Tests
    // ========================================================================

    describe('Lifecycle', () => {
        it('starts and stops correctly', () => {
            expect(monitor.isActive()).toBe(false);

            monitor.start();
            expect(monitor.isActive()).toBe(true);

            monitor.stop();
            expect(monitor.isActive()).toBe(false);
        });

        it('can be started multiple times safely', () => {
            monitor.start();
            monitor.start();
            expect(monitor.isActive()).toBe(true);
        });
    });

    // ========================================================================
    // Heartbeat Recording Tests
    // ========================================================================

    describe('recordHeartbeat', () => {
        it('records new agent as online', () => {
            const heartbeat: AgentHeartbeat = {
                agentId: 'agent_1',
                timestamp: new Date(),
                status: 'healthy',
            };

            monitor.recordHeartbeat(heartbeat);

            const health = monitor.getAgentHealth('agent_1');
            expect(health).toBeDefined();
            expect(health?.status).toBe('online');
            expect(health?.missedHeartbeats).toBe(0);
        });

        it('updates existing agent heartbeat', () => {
            const now = new Date();

            monitor.recordHeartbeat({
                agentId: 'agent_1',
                timestamp: now,
                status: 'healthy',
            });

            const later = new Date(now.getTime() + 1000);
            monitor.recordHeartbeat({
                agentId: 'agent_1',
                timestamp: later,
                status: 'healthy',
            });

            const health = monitor.getAgentHealth('agent_1');
            expect(health?.lastHeartbeat).toEqual(later);
            expect(health?.consecutiveHealthy).toBe(2);
        });

        it('tracks metrics from heartbeat', () => {
            monitor.recordHeartbeat({
                agentId: 'agent_1',
                timestamp: new Date(),
                status: 'healthy',
                metrics: {
                    cpuUsage: 45,
                    memoryUsage: 60,
                    taskQueue: 5,
                },
            });

            const health = monitor.getAgentHealth('agent_1');
            expect(health?.metrics?.cpuUsage).toBe(45);
            expect(health?.metrics?.memoryUsage).toBe(60);
        });

        it('resets missed heartbeats on new heartbeat', () => {
            monitor.recordHeartbeat({
                agentId: 'agent_1',
                timestamp: new Date(),
                status: 'healthy',
            });

            // Manually set missed heartbeats
            const health = monitor.getAgentHealth('agent_1');
            if (health) {
                health.missedHeartbeats = 2;
            }

            // New heartbeat should reset
            monitor.recordHeartbeat({
                agentId: 'agent_1',
                timestamp: new Date(),
                status: 'healthy',
            });

            expect(monitor.getAgentHealth('agent_1')?.missedHeartbeats).toBe(0);
        });

        it('emits heartbeat:received event', () => {
            const handler = vi.fn();
            monitor.on('heartbeat:received', handler);

            const heartbeat: AgentHeartbeat = {
                agentId: 'agent_1',
                timestamp: new Date(),
                status: 'healthy',
            };

            monitor.recordHeartbeat(heartbeat);

            expect(handler).toHaveBeenCalledWith(heartbeat);
        });
    });

    // ========================================================================
    // Agent Registration Tests
    // ========================================================================

    describe('registerAgent', () => {
        it('registers new agent as online', () => {
            monitor.registerAgent('agent_1');

            const health = monitor.getAgentHealth('agent_1');
            expect(health?.status).toBe('online');
        });

        it('does not re-register existing agent', () => {
            monitor.registerAgent('agent_1');
            const firstTimestamp = monitor.getAgentHealth('agent_1')?.lastHeartbeat;

            // Register again
            monitor.registerAgent('agent_1');
            const secondTimestamp = monitor.getAgentHealth('agent_1')?.lastHeartbeat;

            // Timestamps should be the same (not re-registered)
            expect(firstTimestamp?.getTime()).toEqual(secondTimestamp?.getTime());
        });

        it('emits agent:online event', () => {
            const handler = vi.fn();
            monitor.on('agent:online', handler);

            monitor.registerAgent('agent_1');

            expect(handler).toHaveBeenCalledWith('agent_1');
        });
    });

    describe('unregisterAgent', () => {
        it('marks agent as offline', () => {
            monitor.registerAgent('agent_1');
            expect(monitor.getAgentHealth('agent_1')?.status).toBe('online');

            monitor.unregisterAgent('agent_1');
            expect(monitor.getAgentHealth('agent_1')?.status).toBe('offline');
        });

        it('emits agent:offline event', () => {
            monitor.registerAgent('agent_1');

            const handler = vi.fn();
            monitor.on('agent:offline', handler);

            monitor.unregisterAgent('agent_1');

            expect(handler).toHaveBeenCalledWith('agent_1');
        });
    });

    // ========================================================================
    // Status Transition Tests
    // ========================================================================

    describe('Status Transitions', () => {
        it('emits status:changed on new agent', () => {
            const handler = vi.fn();
            monitor.on('status:changed', handler);

            monitor.registerAgent('agent_1');

            expect(handler).toHaveBeenCalledWith('agent_1', 'unknown', 'online');
        });

        it('emits status:changed on status change', () => {
            monitor.registerAgent('agent_1');

            const handler = vi.fn();
            monitor.on('status:changed', handler);

            monitor.unregisterAgent('agent_1');

            expect(handler).toHaveBeenCalledWith('agent_1', 'online', 'offline');
        });
    });

    // ========================================================================
    // Query Tests
    // ========================================================================

    describe('Queries', () => {
        beforeEach(() => {
            // Register multiple agents with different statuses
            monitor.registerAgent('agent_online_1');
            monitor.registerAgent('agent_online_2');
            monitor.registerAgent('agent_offline');
            monitor.unregisterAgent('agent_offline');
        });

        it('getAllAgentHealth returns all agents', () => {
            const all = monitor.getAllAgentHealth();
            expect(all.length).toBe(3);
        });

        it('getAgentsByStatus filters correctly', () => {
            const online = monitor.getAgentsByStatus('online');
            expect(online.length).toBe(2);

            const offline = monitor.getAgentsByStatus('offline');
            expect(offline.length).toBe(1);
        });

        it('getOnlineCount returns correct count', () => {
            expect(monitor.getOnlineCount()).toBe(2);
        });

        it('getOfflineCount returns correct count', () => {
            expect(monitor.getOfflineCount()).toBe(1);
        });

        it('getStats returns summary', () => {
            const stats = monitor.getStats();
            expect(stats.total).toBe(3);
            expect(stats.online).toBe(2);
            expect(stats.offline).toBe(1);
            expect(stats.degraded).toBe(0);
        });

        it('isAgentOnline returns correct status', () => {
            expect(monitor.isAgentOnline('agent_online_1')).toBe(true);
            expect(monitor.isAgentOnline('agent_offline')).toBe(false);
            expect(monitor.isAgentOnline('unknown_agent')).toBe(false);
        });

        it('getLastSeen returns timestamp', () => {
            expect(monitor.getLastSeen('agent_online_1')).toBeInstanceOf(Date);
            expect(monitor.getLastSeen('unknown_agent')).toBeNull();
        });

        it('getAgentHealth returns null for unknown agent', () => {
            expect(monitor.getAgentHealth('unknown_agent')).toBeNull();
        });
    });

    // ========================================================================
    // Configuration Tests
    // ========================================================================

    describe('Configuration', () => {
        it('uses custom configuration', () => {
            const customMonitor = new HeartbeatMonitor({
                heartbeatInterval: 60000,
                missedThreshold: 5,
            });

            expect(customMonitor).toBeDefined();
            customMonitor.stop();
        });

        it('uses default configuration when not specified', () => {
            const defaultMonitor = new HeartbeatMonitor();
            expect(defaultMonitor).toBeDefined();
            defaultMonitor.stop();
        });
    });

    // ========================================================================
    // Clear Tests
    // ========================================================================

    describe('clear', () => {
        it('removes all agent states', () => {
            monitor.registerAgent('agent_1');
            monitor.registerAgent('agent_2');

            expect(monitor.getAllAgentHealth().length).toBe(2);

            monitor.clear();

            expect(monitor.getAllAgentHealth().length).toBe(0);
        });
    });
});

describe('HeartbeatMonitor - Missed Heartbeat Detection', () => {
    let monitor: HeartbeatMonitor;

    beforeEach(() => {
        vi.useFakeTimers();
        monitor = new HeartbeatMonitor({
            heartbeatInterval: 1000,    // 1 second
            missedThreshold: 3,         // 3 missed = offline
            degradedThreshold: 1,       // 1 missed = degraded
            checkInterval: 500,         // Check every 500ms
            recoveryThreshold: 2,
        });
    });

    afterEach(() => {
        monitor.stop();
        monitor.clear();
        vi.useRealTimers();
    });

    it('marks agent as degraded after 1 missed heartbeat', () => {
        // Register agent
        monitor.recordHeartbeat({
            agentId: 'agent_1',
            timestamp: new Date(),
            status: 'healthy',
        });

        expect(monitor.getAgentHealth('agent_1')?.status).toBe('online');

        // Start monitor and advance time past 1 heartbeat interval
        monitor.start();
        vi.advanceTimersByTime(1500); // 1.5 seconds

        // Should be degraded
        expect(monitor.getAgentHealth('agent_1')?.status).toBe('degraded');
    });

    it('marks agent as offline after 3 missed heartbeats', () => {
        monitor.recordHeartbeat({
            agentId: 'agent_1',
            timestamp: new Date(),
            status: 'healthy',
        });

        monitor.start();
        vi.advanceTimersByTime(3500); // 3.5 seconds (3 missed)

        expect(monitor.getAgentHealth('agent_1')?.status).toBe('offline');
    });

    it('recovers agent to online after consecutive healthy heartbeats', () => {
        // Make agent offline
        monitor.recordHeartbeat({
            agentId: 'agent_1',
            timestamp: new Date(),
            status: 'healthy',
        });
        monitor.start();
        vi.advanceTimersByTime(3500);
        expect(monitor.getAgentHealth('agent_1')?.status).toBe('offline');

        // Send recovery heartbeats
        monitor.recordHeartbeat({
            agentId: 'agent_1',
            timestamp: new Date(),
            status: 'healthy',
        });
        monitor.recordHeartbeat({
            agentId: 'agent_1',
            timestamp: new Date(),
            status: 'healthy',
        });

        expect(monitor.getAgentHealth('agent_1')?.status).toBe('online');
    });

    it('emits heartbeat:missed event', () => {
        const handler = vi.fn();
        monitor.on('heartbeat:missed', handler);

        monitor.recordHeartbeat({
            agentId: 'agent_1',
            timestamp: new Date(),
            status: 'healthy',
        });

        monitor.start();
        vi.advanceTimersByTime(1500);

        expect(handler).toHaveBeenCalledWith('agent_1', expect.any(Number));
    });
});
