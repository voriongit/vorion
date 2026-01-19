/**
 * WebSocket Hub - Unit Tests
 *
 * Epic 10: Agent Connection Layer
 * Story 10.2: WebSocket Hub
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocketHub } from './WebSocketHub.js';
import type {
    TaskPayload,
    DecisionPayload,
    ConfigPayload,
    StatusUpdatePayload,
} from './types.js';

// Mock the AgentRegistry
vi.mock('../../services/AgentRegistry.js', () => ({
    getAgentRegistry: () => ({
        verifyAPIKey: vi.fn().mockImplementation((apiKey: string) => {
            if (apiKey === 'valid_api_key') {
                return Promise.resolve({
                    valid: true,
                    agentId: 'agent_test123',
                    permissions: ['agent:read', 'agent:write'],
                });
            }
            return Promise.resolve({ valid: false });
        }),
    }),
}));

describe('WebSocketHub', () => {
    let hub: WebSocketHub;

    beforeEach(() => {
        hub = new WebSocketHub({
            pingInterval: 60000, // Long interval for tests
            authTimeout: 1000,
        });
    });

    afterEach(async () => {
        await hub.shutdown();
    });

    // ========================================================================
    // Configuration Tests
    // ========================================================================

    describe('Configuration', () => {
        it('uses default configuration', () => {
            const defaultHub = new WebSocketHub();
            expect(defaultHub).toBeDefined();
        });

        it('accepts custom configuration', () => {
            const customHub = new WebSocketHub({
                path: '/custom-ws',
                pingInterval: 10000,
                pongTimeout: 5000,
                authTimeout: 3000,
                maxConnections: 500,
                maxConnectionsPerAgent: 3,
            });
            expect(customHub).toBeDefined();
        });
    });

    // ========================================================================
    // Connection Management Tests
    // ========================================================================

    describe('Connection Management', () => {
        it('tracks connected agents', () => {
            const agents = hub.getConnectedAgents();
            expect(Array.isArray(agents)).toBe(true);
            expect(agents.length).toBe(0);
        });

        it('returns empty connections for unknown agent', () => {
            const connections = hub.getAgentConnections('unknown_agent');
            expect(connections).toEqual([]);
        });

        it('reports agent not connected for unknown agent', () => {
            expect(hub.isAgentConnected('unknown_agent')).toBe(false);
        });

        it('returns zero stats initially', () => {
            const stats = hub.getStats();
            expect(stats.totalConnections).toBe(0);
            expect(stats.authenticatedConnections).toBe(0);
            expect(stats.messagesSent).toBe(0);
            expect(stats.messagesReceived).toBe(0);
        });
    });

    // ========================================================================
    // Message Sending Tests
    // ========================================================================

    describe('Message Sending', () => {
        it('returns 0 when sending to non-existent agent', () => {
            const sent = hub.sendToAgent('non_existent', 'task:assigned', {});
            expect(sent).toBe(0);
        });

        it('returns 0 when broadcasting with no connections', () => {
            const sent = hub.broadcast('config:updated', {});
            expect(sent).toBe(0);
        });

        it('returns false when assigning task to non-existent agent', () => {
            const task: TaskPayload = {
                id: 'task_1',
                description: 'Test task',
                priority: 'high',
                requiredTier: 2,
            };
            const result = hub.assignTask('non_existent', task);
            expect(result).toBe(false);
        });

        it('returns false when requesting decision from non-existent agent', () => {
            const decision: DecisionPayload = {
                id: 'dec_1',
                agentId: 'agent_1',
                action: 'send_email',
                reason: 'User requested',
                riskLevel: 'medium',
                urgency: 'normal',
            };
            const result = hub.requestDecision('non_existent', decision);
            expect(result).toBe(false);
        });

        it('returns false when updating config for non-existent agent', () => {
            const config: ConfigPayload = {
                settings: { debug: true },
                version: '1.0.0',
            };
            const result = hub.updateConfig('non_existent', config);
            expect(result).toBe(false);
        });
    });

    // ========================================================================
    // Event Emission Tests
    // ========================================================================

    describe('Event Emission', () => {
        it('emits error events', () => {
            const errorHandler = vi.fn();
            hub.on('error', errorHandler);

            hub.emit('error', new Error('Test error'));

            expect(errorHandler).toHaveBeenCalledWith(expect.any(Error));
        });

        it('emits status:update events', () => {
            const statusHandler = vi.fn();
            hub.on('status:update', statusHandler);

            const payload: StatusUpdatePayload = {
                status: 'busy',
                progress: 50,
                currentTask: 'task_1',
            };

            hub.emit('status:update', 'agent_1', payload);

            expect(statusHandler).toHaveBeenCalledWith('agent_1', payload);
        });

        it('emits heartbeat events', () => {
            const heartbeatHandler = vi.fn();
            hub.on('heartbeat', heartbeatHandler);

            hub.emit('heartbeat', 'agent_1', {
                timestamp: Date.now(),
                status: 'healthy',
            });

            expect(heartbeatHandler).toHaveBeenCalled();
        });

        it('emits connection events', () => {
            const connectionHandler = vi.fn();
            hub.on('connection', connectionHandler);

            hub.emit('connection', 'conn_123', 'agent_1');

            expect(connectionHandler).toHaveBeenCalledWith('conn_123', 'agent_1');
        });

        it('emits disconnection events', () => {
            const disconnectionHandler = vi.fn();
            hub.on('disconnection', disconnectionHandler);

            hub.emit('disconnection', 'conn_123', 'agent_1', 'Client disconnected');

            expect(disconnectionHandler).toHaveBeenCalledWith('conn_123', 'agent_1', 'Client disconnected');
        });
    });

    // ========================================================================
    // Shutdown Tests
    // ========================================================================

    describe('Shutdown', () => {
        it('shuts down gracefully', async () => {
            await expect(hub.shutdown()).resolves.toBeUndefined();
        });

        it('can shutdown multiple times', async () => {
            await hub.shutdown();
            await expect(hub.shutdown()).resolves.toBeUndefined();
        });
    });

    // ========================================================================
    // Disconnect Agent Tests
    // ========================================================================

    describe('Disconnect Agent', () => {
        it('handles disconnecting non-existent agent', () => {
            // Should not throw
            expect(() => hub.disconnectAgent('non_existent')).not.toThrow();
        });

        it('accepts custom disconnect reason', () => {
            expect(() => hub.disconnectAgent('agent_1', 'Admin action')).not.toThrow();
        });
    });
});

describe('WebSocketHub Message Types', () => {
    // ========================================================================
    // Task Payload Tests
    // ========================================================================

    describe('TaskPayload', () => {
        it('has required fields', () => {
            const task: TaskPayload = {
                id: 'task_123',
                description: 'Process data',
                priority: 'high',
                requiredTier: 3,
            };

            expect(task.id).toBe('task_123');
            expect(task.description).toBe('Process data');
            expect(task.priority).toBe('high');
            expect(task.requiredTier).toBe(3);
        });

        it('supports optional fields', () => {
            const task: TaskPayload = {
                id: 'task_123',
                description: 'Process data',
                priority: 'medium',
                requiredTier: 2,
                deadline: '2025-12-31T23:59:59Z',
                context: { source: 'api', batchId: 'batch_1' },
            };

            expect(task.deadline).toBeDefined();
            expect(task.context).toBeDefined();
        });
    });

    // ========================================================================
    // Decision Payload Tests
    // ========================================================================

    describe('DecisionPayload', () => {
        it('has required fields', () => {
            const decision: DecisionPayload = {
                id: 'dec_123',
                agentId: 'agent_1',
                action: 'SEND_EMAIL',
                reason: 'User requested notification',
                riskLevel: 'medium',
                urgency: 'normal',
            };

            expect(decision.id).toBe('dec_123');
            expect(decision.action).toBe('SEND_EMAIL');
            expect(decision.riskLevel).toBe('medium');
        });

        it('supports optional fields', () => {
            const decision: DecisionPayload = {
                id: 'dec_123',
                agentId: 'agent_1',
                action: 'DELETE_DATA',
                reason: 'Cleanup request',
                riskLevel: 'high',
                urgency: 'critical',
                sampleData: { records: 100 },
                expiresAt: '2025-12-25T12:00:00Z',
            };

            expect(decision.sampleData).toBeDefined();
            expect(decision.expiresAt).toBeDefined();
        });
    });

    // ========================================================================
    // Config Payload Tests
    // ========================================================================

    describe('ConfigPayload', () => {
        it('has required fields', () => {
            const config: ConfigPayload = {
                settings: {
                    debug: true,
                    logLevel: 'verbose',
                    maxRetries: 3,
                },
                version: '2.0.0',
            };

            expect(config.settings).toBeDefined();
            expect(config.version).toBe('2.0.0');
        });
    });

    // ========================================================================
    // Status Update Payload Tests
    // ========================================================================

    describe('StatusUpdatePayload', () => {
        it('has required fields', () => {
            const status: StatusUpdatePayload = {
                status: 'busy',
            };

            expect(status.status).toBe('busy');
        });

        it('supports optional fields', () => {
            const status: StatusUpdatePayload = {
                status: 'processing',
                progress: 75,
                currentTask: 'task_456',
                message: 'Processing batch 3 of 4',
            };

            expect(status.progress).toBe(75);
            expect(status.currentTask).toBe('task_456');
            expect(status.message).toBeDefined();
        });

        it('supports all status values', () => {
            const statuses: StatusUpdatePayload['status'][] = ['idle', 'busy', 'processing', 'error'];

            statuses.forEach(s => {
                const payload: StatusUpdatePayload = { status: s };
                expect(payload.status).toBe(s);
            });
        });
    });
});
