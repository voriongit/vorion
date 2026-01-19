/**
 * Mission Control Store Tests
 *
 * Story 1.2: Zustand Store & Real-Time Connection
 * Story 2.3: Approve Action Request - Optimistic Updates
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useMissionControlStore } from './missionControlStore';
import type { Agent, ApprovalRequest, ActionRequest } from '../types';

// ============================================================================
// Test Data
// ============================================================================

const mockAgent: Agent = {
    id: 'agent-1',
    name: 'TestAgent',
    type: 'WORKER',
    tier: 2,
    status: 'IDLE',
    location: { floor: 'OPERATIONS', room: 'OFFICE_A' },
    trustScore: 500,
    capabilities: ['execute', 'report'],
    parentId: null,
};

const mockAgent2: Agent = {
    id: 'agent-2',
    name: 'TestAgent2',
    type: 'SPECIALIST',
    tier: 3,
    status: 'WORKING',
    location: { floor: 'OPERATIONS', room: 'OFFICE_B' },
    trustScore: 700,
    capabilities: ['analyze', 'execute'],
    parentId: 'agent-1',
};

const mockDecision: ApprovalRequest = {
    id: 'decision-1',
    type: 'SPAWN',
    requestor: 'agent-1',
    summary: 'Request to spawn new agent',
    details: { tier: 1, name: 'NewAgent' },
    status: 'PENDING',
    createdAt: '2024-01-01T00:00:00Z',
};

// Story 2.3: Mock action requests for queue tests
const mockActionRequest: ActionRequest = {
    id: 'ar-001',
    orgId: 'demo-org',
    agentId: 'agent-1',
    agentName: 'DataProcessor-Alpha',
    actionType: 'data_export',
    status: 'pending',
    urgency: 'immediate',
    queuedReason: 'Bulk data export',
    trustGateRules: ['high_volume_data'],
    priority: 10,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
};

const mockActionRequest2: ActionRequest = {
    id: 'ar-002',
    orgId: 'demo-org',
    agentId: 'agent-2',
    agentName: 'SecurityAnalyst',
    actionType: 'security_scan',
    status: 'pending',
    urgency: 'queued',
    queuedReason: 'Routine scan',
    trustGateRules: ['security_action'],
    priority: 5,
    createdAt: '2024-01-01T01:00:00Z',
    updatedAt: '2024-01-01T01:00:00Z',
};

// ============================================================================
// Tests
// ============================================================================

describe('MissionControlStore', () => {
    beforeEach(() => {
        // Reset store before each test
        useMissionControlStore.getState().reset();
    });

    // ========================================================================
    // Initial State
    // ========================================================================

    describe('Initial State', () => {
        it('should have empty initial state', () => {
            const state = useMissionControlStore.getState();

            expect(state.agents).toEqual([]);
            expect(state.pendingDecisions).toEqual([]);
            expect(state.activeTasks).toEqual([]);
            expect(state.connectionStatus).toBe('disconnected');
            expect(state.lastSync).toBeNull();
            expect(state.reconnectAttempts).toBe(0);
            expect(state.orgId).toBeNull();
            expect(state.userRole).toBeNull();
        });
    });

    // ========================================================================
    // Agent Actions
    // ========================================================================

    describe('Agent Actions', () => {
        it('should set agents', () => {
            const { setAgents } = useMissionControlStore.getState();

            setAgents([mockAgent, mockAgent2]);

            const { agents } = useMissionControlStore.getState();
            expect(agents).toHaveLength(2);
            expect(agents[0]).toEqual(mockAgent);
            expect(agents[1]).toEqual(mockAgent2);
        });

        it('should add a single agent', () => {
            const { setAgents, addAgent } = useMissionControlStore.getState();

            setAgents([mockAgent]);
            addAgent(mockAgent2);

            const { agents } = useMissionControlStore.getState();
            expect(agents).toHaveLength(2);
            expect(agents[1]).toEqual(mockAgent2);
        });

        it('should update an agent', () => {
            const { setAgents, updateAgent } = useMissionControlStore.getState();

            setAgents([mockAgent]);
            updateAgent('agent-1', { status: 'WORKING', trustScore: 550 });

            const { agents } = useMissionControlStore.getState();
            expect(agents[0]?.status).toBe('WORKING');
            expect(agents[0]?.trustScore).toBe(550);
            // Other fields should remain unchanged
            expect(agents[0]?.name).toBe('TestAgent');
        });

        it('should remove an agent', () => {
            const { setAgents, removeAgent } = useMissionControlStore.getState();

            setAgents([mockAgent, mockAgent2]);
            removeAgent('agent-1');

            const { agents } = useMissionControlStore.getState();
            expect(agents).toHaveLength(1);
            expect(agents[0]?.id).toBe('agent-2');
        });

        it('should not modify agents when updating non-existent agent', () => {
            const { setAgents, updateAgent } = useMissionControlStore.getState();

            setAgents([mockAgent]);
            updateAgent('non-existent', { status: 'WORKING' });

            const { agents } = useMissionControlStore.getState();
            expect(agents).toHaveLength(1);
            expect(agents[0]?.status).toBe('IDLE');
        });
    });

    // ========================================================================
    // Decision Actions
    // ========================================================================

    describe('Decision Actions', () => {
        it('should set pending decisions', () => {
            const { setPendingDecisions } = useMissionControlStore.getState();

            setPendingDecisions([mockDecision]);

            const { pendingDecisions } = useMissionControlStore.getState();
            expect(pendingDecisions).toHaveLength(1);
            expect(pendingDecisions[0]).toEqual(mockDecision);
        });

        it('should add a decision', () => {
            const { addDecision } = useMissionControlStore.getState();

            addDecision(mockDecision);

            const { pendingDecisions } = useMissionControlStore.getState();
            expect(pendingDecisions).toHaveLength(1);
        });

        it('should remove a decision', () => {
            const { setPendingDecisions, removeDecision } = useMissionControlStore.getState();

            setPendingDecisions([mockDecision]);
            removeDecision('decision-1');

            const { pendingDecisions } = useMissionControlStore.getState();
            expect(pendingDecisions).toHaveLength(0);
        });

        it('should update a decision', () => {
            const { setPendingDecisions, updateDecision } = useMissionControlStore.getState();

            setPendingDecisions([mockDecision]);
            updateDecision('decision-1', { status: 'APPROVED' });

            const { pendingDecisions } = useMissionControlStore.getState();
            expect(pendingDecisions[0]?.status).toBe('APPROVED');
        });
    });

    // ========================================================================
    // Connection Actions
    // ========================================================================

    describe('Connection Actions', () => {
        it('should set connection status', () => {
            const { setConnectionStatus } = useMissionControlStore.getState();

            setConnectionStatus('connected');
            expect(useMissionControlStore.getState().connectionStatus).toBe('connected');

            setConnectionStatus('reconnecting');
            expect(useMissionControlStore.getState().connectionStatus).toBe('reconnecting');

            setConnectionStatus('disconnected');
            expect(useMissionControlStore.getState().connectionStatus).toBe('disconnected');
        });

        it('should set last sync date', () => {
            const { setLastSync } = useMissionControlStore.getState();
            const now = new Date();

            setLastSync(now);

            const { lastSync } = useMissionControlStore.getState();
            expect(lastSync).toEqual(now);
        });

        it('should increment reconnect attempts', () => {
            const { incrementReconnectAttempts } = useMissionControlStore.getState();

            incrementReconnectAttempts();
            expect(useMissionControlStore.getState().reconnectAttempts).toBe(1);

            incrementReconnectAttempts();
            expect(useMissionControlStore.getState().reconnectAttempts).toBe(2);
        });

        it('should reset reconnect attempts', () => {
            const { incrementReconnectAttempts, resetReconnectAttempts } =
                useMissionControlStore.getState();

            incrementReconnectAttempts();
            incrementReconnectAttempts();
            resetReconnectAttempts();

            expect(useMissionControlStore.getState().reconnectAttempts).toBe(0);
        });
    });

    // ========================================================================
    // User Context Actions
    // ========================================================================

    describe('User Context Actions', () => {
        it('should set user context', () => {
            const { setUserContext } = useMissionControlStore.getState();

            setUserContext('org-123', 'operator');

            const state = useMissionControlStore.getState();
            expect(state.orgId).toBe('org-123');
            expect(state.userRole).toBe('operator');
        });

        it('should clear user context', () => {
            const { setUserContext, clearUserContext } = useMissionControlStore.getState();

            setUserContext('org-123', 'operator');
            clearUserContext();

            const state = useMissionControlStore.getState();
            expect(state.orgId).toBeNull();
            expect(state.userRole).toBeNull();
        });
    });

    // ========================================================================
    // Bulk Actions
    // ========================================================================

    describe('Bulk Actions', () => {
        it('should sync state and update lastSync', () => {
            const { syncState } = useMissionControlStore.getState();

            syncState({
                agents: [mockAgent],
                pendingDecisions: [mockDecision],
            });

            const state = useMissionControlStore.getState();
            expect(state.agents).toHaveLength(1);
            expect(state.pendingDecisions).toHaveLength(1);
            expect(state.lastSync).toBeInstanceOf(Date);
        });

        it('should only update specified fields in syncState', () => {
            const { setAgents, syncState } = useMissionControlStore.getState();

            setAgents([mockAgent, mockAgent2]);
            syncState({ pendingDecisions: [mockDecision] });

            const state = useMissionControlStore.getState();
            // Agents should remain unchanged
            expect(state.agents).toHaveLength(2);
            expect(state.pendingDecisions).toHaveLength(1);
        });

        it('should reset to initial state', () => {
            const { setAgents, setConnectionStatus, reset } = useMissionControlStore.getState();

            setAgents([mockAgent]);
            setConnectionStatus('connected');

            reset();

            const state = useMissionControlStore.getState();
            expect(state.agents).toEqual([]);
            expect(state.connectionStatus).toBe('disconnected');
        });
    });

    // ========================================================================
    // Subscription
    // ========================================================================

    describe('Store Subscription', () => {
        it('should notify subscribers on state change', () => {
            let callCount = 0;
            const unsubscribe = useMissionControlStore.subscribe(() => {
                callCount++;
            });

            useMissionControlStore.getState().setAgents([mockAgent]);
            useMissionControlStore.getState().setConnectionStatus('connected');

            expect(callCount).toBe(2);

            unsubscribe();
        });

        it('should support selective subscription', () => {
            let agentUpdates = 0;
            const unsubscribe = useMissionControlStore.subscribe(
                (state) => state.agents,
                () => {
                    agentUpdates++;
                }
            );

            useMissionControlStore.getState().setAgents([mockAgent]);
            useMissionControlStore.getState().setConnectionStatus('connected');
            useMissionControlStore.getState().updateAgent('agent-1', { status: 'WORKING' });

            // Only agent changes should trigger
            expect(agentUpdates).toBe(2);

            unsubscribe();
        });
    });

    // ========================================================================
    // Queue Actions (Story 2.1-2.3)
    // ========================================================================

    describe('Queue Actions', () => {
        it('should set queue and counts', () => {
            const { setQueue } = useMissionControlStore.getState();

            setQueue([mockActionRequest, mockActionRequest2], {
                immediate: 1,
                queued: 1,
                total: 2,
            });

            const state = useMissionControlStore.getState();
            expect(state.queue).toHaveLength(2);
            expect(state.queueCounts.immediate).toBe(1);
            expect(state.queueCounts.queued).toBe(1);
            expect(state.queueCounts.total).toBe(2);
        });

        it('should set queue loading state', () => {
            const { setQueueLoading } = useMissionControlStore.getState();

            setQueueLoading(true);
            expect(useMissionControlStore.getState().queueLoading).toBe(true);

            setQueueLoading(false);
            expect(useMissionControlStore.getState().queueLoading).toBe(false);
        });

        it('should set queue error', () => {
            const { setQueueError } = useMissionControlStore.getState();

            setQueueError('Failed to load queue');
            expect(useMissionControlStore.getState().queueError).toBe('Failed to load queue');

            setQueueError(null);
            expect(useMissionControlStore.getState().queueError).toBeNull();
        });
    });

    // ========================================================================
    // Optimistic Update Actions (Story 2.3)
    // ========================================================================

    describe('Optimistic Update Actions', () => {
        beforeEach(() => {
            // Set up queue with test data
            useMissionControlStore.getState().setQueue([mockActionRequest, mockActionRequest2], {
                immediate: 1,
                queued: 1,
                total: 2,
            });
        });

        afterEach(() => {
            vi.restoreAllMocks();
        });

        describe('approveDecisionOptimistic', () => {
            it('should optimistically update decision status', async () => {
                // Mock successful API response
                global.fetch = vi.fn().mockResolvedValueOnce({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            success: true,
                            decision: {
                                id: 'ar-001',
                                status: 'approved',
                                decidedBy: 'user-1',
                                decidedAt: new Date().toISOString(),
                                reviewMetrics: { reviewTimeMs: 5000 },
                            },
                        }),
                });

                const { approveDecisionOptimistic } = useMissionControlStore.getState();

                // Start the approval
                const approvePromise = approveDecisionOptimistic('ar-001');

                // Check optimistic update happened immediately
                const stateAfterOptimistic = useMissionControlStore.getState();
                const updatedDecision = stateAfterOptimistic.queue.find((d) => d.id === 'ar-001');
                expect(updatedDecision?.status).toBe('approved');
                expect(stateAfterOptimistic.queueCounts.immediate).toBe(0);
                expect(stateAfterOptimistic.queueCounts.total).toBe(1);

                // Wait for server confirmation
                await approvePromise;

                // Decision should be removed from queue after server confirms
                const stateAfterConfirm = useMissionControlStore.getState();
                expect(stateAfterConfirm.queue.find((d) => d.id === 'ar-001')).toBeUndefined();
            });

            it('should rollback on error', async () => {
                // Mock failed API response
                global.fetch = vi.fn().mockResolvedValueOnce({
                    ok: false,
                    json: () => Promise.resolve({ detail: 'Server error' }),
                });

                const { approveDecisionOptimistic } = useMissionControlStore.getState();

                // Attempt approval and expect error
                await expect(approveDecisionOptimistic('ar-001')).rejects.toThrow('Server error');

                // State should be rolled back
                const state = useMissionControlStore.getState();
                const decision = state.queue.find((d) => d.id === 'ar-001');
                expect(decision?.status).toBe('pending');
                expect(state.queueCounts.immediate).toBe(1);
                expect(state.queueCounts.total).toBe(2);
            });

            it('should throw error if decision not found', async () => {
                const { approveDecisionOptimistic } = useMissionControlStore.getState();

                await expect(approveDecisionOptimistic('non-existent')).rejects.toThrow(
                    'Decision not found'
                );
            });
        });

        describe('denyDecisionOptimistic', () => {
            it('should optimistically deny decision', async () => {
                global.fetch = vi.fn().mockResolvedValueOnce({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            success: true,
                            decision: {
                                id: 'ar-002',
                                status: 'denied',
                                decidedBy: 'user-1',
                                decidedAt: new Date().toISOString(),
                                reason: 'Not approved',
                                reviewMetrics: { reviewTimeMs: 3000 },
                            },
                        }),
                });

                const { denyDecisionOptimistic } = useMissionControlStore.getState();

                const denyPromise = denyDecisionOptimistic('ar-002', 'Not approved');

                // Check optimistic update
                const stateAfterOptimistic = useMissionControlStore.getState();
                const updatedDecision = stateAfterOptimistic.queue.find((d) => d.id === 'ar-002');
                expect(updatedDecision?.status).toBe('denied');
                expect(stateAfterOptimistic.queueCounts.queued).toBe(0);

                await denyPromise;

                // Decision should be removed
                const stateAfterConfirm = useMissionControlStore.getState();
                expect(stateAfterConfirm.queue.find((d) => d.id === 'ar-002')).toBeUndefined();
            });

            it('should rollback deny on error', async () => {
                global.fetch = vi.fn().mockResolvedValueOnce({
                    ok: false,
                    json: () => Promise.resolve({ detail: 'Permission denied' }),
                });

                const { denyDecisionOptimistic } = useMissionControlStore.getState();

                await expect(denyDecisionOptimistic('ar-002', 'Test')).rejects.toThrow(
                    'Permission denied'
                );

                // State should be rolled back
                const state = useMissionControlStore.getState();
                const decision = state.queue.find((d) => d.id === 'ar-002');
                expect(decision?.status).toBe('pending');
            });
        });
    });
});
