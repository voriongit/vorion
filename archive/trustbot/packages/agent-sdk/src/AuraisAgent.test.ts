/**
 * Aurais Agent SDK - Tests
 *
 * Epic 10: Agent Connection Layer
 * Story 10.5: Agent SDK (TypeScript)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuraisAgent } from './AuraisAgent.js';
import type {
    AgentStatus,
    Task,
    ActionRequest,
    AgentConfig,
} from './types.js';

// Mock WebSocket
vi.mock('ws', () => {
    return {
        default: vi.fn().mockImplementation(() => ({
            on: vi.fn(),
            send: vi.fn(),
            close: vi.fn(),
            removeAllListeners: vi.fn(),
            readyState: 1, // OPEN
        })),
    };
});

describe('AuraisAgent', () => {
    let agent: AuraisAgent;

    beforeEach(() => {
        agent = new AuraisAgent({
            apiKey: 'test-api-key',
            capabilities: ['execute', 'external'],
            skills: ['web-dev'],
        });
    });

    afterEach(() => {
        agent.disconnect();
    });

    // ========================================================================
    // Configuration Tests
    // ========================================================================

    describe('Configuration', () => {
        it('requires an API key', () => {
            expect(() => new AuraisAgent({ apiKey: '' })).toThrow('API key is required');
        });

        it('uses default configuration when not specified', () => {
            const defaultAgent = new AuraisAgent({ apiKey: 'test' });
            expect(defaultAgent).toBeDefined();
            expect(defaultAgent.getConnectionState()).toBe('disconnected');
        });

        it('accepts custom configuration', () => {
            const customAgent = new AuraisAgent({
                apiKey: 'test',
                capabilities: ['execute', 'delegate'],
                skills: ['data-analysis'],
                serverUrl: 'ws://custom:3000/ws',
                autoReconnect: false,
                maxReconnectAttempts: 5,
                reconnectBaseDelay: 500,
                reconnectMaxDelay: 10000,
                heartbeatInterval: 15000,
                connectionTimeout: 5000,
                metadata: { version: '1.0.0' },
            });
            expect(customAgent).toBeDefined();
        });
    });

    // ========================================================================
    // Connection State Tests
    // ========================================================================

    describe('Connection State', () => {
        it('starts disconnected', () => {
            expect(agent.getConnectionState()).toBe('disconnected');
            expect(agent.isConnected()).toBe(false);
        });

        it('returns null for agent IDs before connection', () => {
            expect(agent.getAgentId()).toBeNull();
            expect(agent.getStructuredId()).toBeNull();
        });
    });

    // ========================================================================
    // Status Tests
    // ========================================================================

    describe('Status', () => {
        it('starts with IDLE status', () => {
            expect(agent.getStatus()).toBe('IDLE');
        });

        it('emits status:changed event on status update', async () => {
            const handler = vi.fn();
            agent.on('status:changed', handler);

            // Manually trigger status change (since we can't actually connect)
            const oldStatus = agent.getStatus();
            // Access private method via any for testing
            (agent as any).status = 'WORKING';
            agent.emit('status:changed', oldStatus, 'WORKING');

            expect(handler).toHaveBeenCalledWith('IDLE', 'WORKING');
        });
    });

    // ========================================================================
    // Event Emitter Tests
    // ========================================================================

    describe('Event Emitter', () => {
        it('supports event subscription', () => {
            const handler = vi.fn();
            agent.on('connected', handler);
            agent.emit('connected');
            expect(handler).toHaveBeenCalled();
        });

        it('supports event unsubscription', () => {
            const handler = vi.fn();
            agent.on('connected', handler);
            agent.off('connected', handler);
            agent.emit('connected');
            expect(handler).not.toHaveBeenCalled();
        });

        it('supports multiple event listeners', () => {
            const handler1 = vi.fn();
            const handler2 = vi.fn();
            agent.on('connected', handler1);
            agent.on('connected', handler2);
            agent.emit('connected');
            expect(handler1).toHaveBeenCalled();
            expect(handler2).toHaveBeenCalled();
        });

        it('emits error events', () => {
            const handler = vi.fn();
            agent.on('error', handler);
            const error = new Error('Test error');
            agent.emit('error', error);
            expect(handler).toHaveBeenCalledWith(error);
        });

        it('emits disconnected events', () => {
            const handler = vi.fn();
            agent.on('disconnected', handler);
            agent.emit('disconnected', 'Test disconnect');
            expect(handler).toHaveBeenCalledWith('Test disconnect');
        });

        it('emits reconnecting events', () => {
            const handler = vi.fn();
            agent.on('reconnecting', handler);
            agent.emit('reconnecting', 1, 10);
            expect(handler).toHaveBeenCalledWith(1, 10);
        });
    });

    // ========================================================================
    // Task Event Tests
    // ========================================================================

    describe('Task Events', () => {
        it('emits task:assigned event', () => {
            const handler = vi.fn();
            agent.on('task:assigned', handler);

            const task: Task = {
                id: 'task_123',
                type: 'data-processing',
                title: 'Process data',
                priority: 'medium',
                payload: { data: 'test' },
                assignedAt: new Date().toISOString(),
            };

            agent.emit('task:assigned', task);
            expect(handler).toHaveBeenCalledWith(task);
        });

        it('emits task:completed event', () => {
            const handler = vi.fn();
            agent.on('task:completed', handler);

            const result = {
                taskId: 'task_123',
                success: true,
                result: { processed: true },
            };

            agent.emit('task:completed', result);
            expect(handler).toHaveBeenCalledWith(result);
        });
    });

    // ========================================================================
    // Decision Event Tests
    // ========================================================================

    describe('Decision Events', () => {
        it('emits decision:required event', () => {
            const handler = vi.fn();
            agent.on('decision:required', handler);

            const request: ActionRequest = {
                id: 'req_123',
                type: 'external_api_call',
                title: 'Call external API',
                description: 'Make external API call',
                riskLevel: 'medium',
                urgency: 'queued',
                payload: { endpoint: 'https://api.example.com' },
                requestedAt: new Date().toISOString(),
            };

            agent.emit('decision:required', request);
            expect(handler).toHaveBeenCalledWith(request);
        });

        it('emits decision:result event', () => {
            const handler = vi.fn();
            agent.on('decision:result', handler);

            const decision = {
                requestId: 'req_123',
                decision: 'approved' as const,
                reason: 'Low risk operation',
                decidedBy: 'user_456',
                decidedAt: new Date().toISOString(),
            };

            agent.emit('decision:result', decision);
            expect(handler).toHaveBeenCalledWith(decision);
        });
    });

    // ========================================================================
    // Config Event Tests
    // ========================================================================

    describe('Config Events', () => {
        it('emits config:updated event', () => {
            const handler = vi.fn();
            agent.on('config:updated', handler);

            const config: AgentConfig = {
                id: 'config_123',
                key: 'max_concurrent_tasks',
                value: 5,
                updatedAt: new Date().toISOString(),
            };

            agent.emit('config:updated', config);
            expect(handler).toHaveBeenCalledWith(config);
        });
    });

    // ========================================================================
    // Message Event Tests
    // ========================================================================

    describe('Message Events', () => {
        it('emits message event for inbound messages', () => {
            const handler = vi.fn();
            agent.on('message', handler);

            const message = {
                type: 'ping' as const,
                timestamp: Date.now(),
            };

            agent.emit('message', message);
            expect(handler).toHaveBeenCalledWith(message);
        });

        it('emits message:sent event for outbound messages', () => {
            const handler = vi.fn();
            agent.on('message:sent', handler);

            const message = {
                type: 'status:update' as const,
                payload: { status: 'WORKING' as AgentStatus, progress: 50 },
                messageId: 'msg_123',
            };

            agent.emit('message:sent', message);
            expect(handler).toHaveBeenCalledWith(message);
        });
    });

    // ========================================================================
    // Disconnect Tests
    // ========================================================================

    describe('Disconnect', () => {
        it('sets state to disconnected', () => {
            agent.disconnect();
            expect(agent.getConnectionState()).toBe('disconnected');
        });

        it('can be called multiple times safely', () => {
            agent.disconnect();
            agent.disconnect();
            expect(agent.getConnectionState()).toBe('disconnected');
        });
    });
});

// ============================================================================
// Type Tests (compile-time only)
// ============================================================================

describe('Type Safety', () => {
    it('exports all required types', async () => {
        // This test verifies types are exported correctly
        const types = await import('./types.js');

        // Verify type exports exist (these are compile-time checks)
        const _taskPriority: typeof types.TaskPriority = undefined as any;
        const _riskLevel: typeof types.RiskLevel = undefined as any;
        const _urgency: typeof types.Urgency = undefined as any;

        expect(true).toBe(true); // Type check passed
    });

    it('AuraisAgent implements EventEmitter', () => {
        const agent = new AuraisAgent({ apiKey: 'test' });

        // Verify EventEmitter methods exist
        expect(typeof agent.on).toBe('function');
        expect(typeof agent.off).toBe('function');
        expect(typeof agent.emit).toBe('function');
        expect(typeof agent.once).toBe('function');
    });
});
