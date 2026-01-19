/**
 * Mission Control Zustand Store
 *
 * Central state management for Mission Control dashboard.
 * Provides real-time synchronized state for agents, connection status,
 * and pending decisions.
 *
 * Story 1.2: Zustand Store & Real-Time Connection
 * Story 2.3: Approve Action Request - Optimistic Updates
 * FRs: FR14, FR55 (Real-time updates)
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Agent, Task, ApprovalRequest, ActionRequest, ActionRequestCounts } from '../types';

// ============================================================================
// Types
// ============================================================================

export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting';

export interface AgentUpdate {
    id: string;
    updates: Partial<Agent>;
}

// Story 2.3: HITL metrics for tracking review behavior
export interface HITLMetrics {
    reviewTimeMs: number;
    detailViewsAccessed: boolean;
    sampleDataViewed: boolean;
    scrollDepth?: number;
}

// Story 2.3: Decision approval response
export interface DecisionResponse {
    success: boolean;
    decision: {
        id: string;
        status: string;
        decidedBy: string;
        decidedAt: string;
        reviewMetrics: HITLMetrics;
    };
}

export interface MissionControlState {
    // Data
    agents: Agent[];
    pendingDecisions: ApprovalRequest[];
    activeTasks: Task[];

    // Story 2.1-2.3: Action Request Queue
    queue: ActionRequest[];
    queueCounts: ActionRequestCounts;
    queueLoading: boolean;
    queueError: string | null;

    // Connection
    connectionStatus: ConnectionStatus;
    lastSync: Date | null;
    reconnectAttempts: number;

    // User context (from RBAC)
    orgId: string | null;
    userRole: string | null;

    // Actions - Data
    setAgents: (agents: Agent[]) => void;
    updateAgent: (agentId: string, updates: Partial<Agent>) => void;
    removeAgent: (agentId: string) => void;
    addAgent: (agent: Agent) => void;

    // Actions - Decisions (Legacy ApprovalRequest)
    setPendingDecisions: (decisions: ApprovalRequest[]) => void;
    addDecision: (decision: ApprovalRequest) => void;
    removeDecision: (decisionId: string) => void;
    updateDecision: (decisionId: string, updates: Partial<ApprovalRequest>) => void;

    // Actions - Queue (Story 2.1-2.3: ActionRequest queue with optimistic updates)
    setQueue: (queue: ActionRequest[], counts: ActionRequestCounts) => void;
    setQueueLoading: (loading: boolean) => void;
    setQueueError: (error: string | null) => void;
    approveDecisionOptimistic: (
        decisionId: string,
        reviewNotes?: string,
        metrics?: HITLMetrics
    ) => Promise<DecisionResponse>;
    denyDecisionOptimistic: (
        decisionId: string,
        reason?: string,
        metrics?: HITLMetrics
    ) => Promise<DecisionResponse>;

    // Actions - Tasks
    setActiveTasks: (tasks: Task[]) => void;
    updateTask: (taskId: string, updates: Partial<Task>) => void;

    // Actions - Connection
    setConnectionStatus: (status: ConnectionStatus) => void;
    setLastSync: (date: Date) => void;
    incrementReconnectAttempts: () => void;
    resetReconnectAttempts: () => void;

    // Actions - User Context
    setUserContext: (orgId: string, role: string) => void;
    clearUserContext: () => void;

    // Actions - Bulk
    syncState: (state: {
        agents?: Agent[];
        pendingDecisions?: ApprovalRequest[];
        activeTasks?: Task[];
    }) => void;
    reset: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState = {
    agents: [],
    pendingDecisions: [],
    activeTasks: [],
    queue: [] as ActionRequest[],
    queueCounts: { immediate: 0, queued: 0, total: 0 } as ActionRequestCounts,
    queueLoading: false,
    queueError: null as string | null,
    connectionStatus: 'disconnected' as ConnectionStatus,
    lastSync: null,
    reconnectAttempts: 0,
    orgId: null,
    userRole: null,
};

// API base URL for queue operations
const API_BASE = '/api/v1/mission-control';

// ============================================================================
// Store
// ============================================================================

export const useMissionControlStore = create<MissionControlState>()(
    subscribeWithSelector((set, get) => ({
        ...initialState,

        // ====================================================================
        // Agent Actions
        // ====================================================================

        setAgents: (agents) => set({ agents }),

        updateAgent: (agentId, updates) =>
            set((state) => ({
                agents: state.agents.map((agent) =>
                    agent.id === agentId ? { ...agent, ...updates } : agent
                ),
            })),

        removeAgent: (agentId) =>
            set((state) => ({
                agents: state.agents.filter((agent) => agent.id !== agentId),
            })),

        addAgent: (agent) =>
            set((state) => ({
                agents: [...state.agents, agent],
            })),

        // ====================================================================
        // Decision Actions
        // ====================================================================

        setPendingDecisions: (decisions) => set({ pendingDecisions: decisions }),

        addDecision: (decision) =>
            set((state) => ({
                pendingDecisions: [...state.pendingDecisions, decision],
            })),

        removeDecision: (decisionId) =>
            set((state) => ({
                pendingDecisions: state.pendingDecisions.filter((d) => d.id !== decisionId),
            })),

        updateDecision: (decisionId, updates) =>
            set((state) => ({
                pendingDecisions: state.pendingDecisions.map((d) =>
                    d.id === decisionId ? { ...d, ...updates } : d
                ),
            })),

        // ====================================================================
        // Queue Actions (Story 2.1-2.3)
        // ====================================================================

        setQueue: (queue, counts) => set({ queue, queueCounts: counts }),

        setQueueLoading: (loading) => set({ queueLoading: loading }),

        setQueueError: (error) => set({ queueError: error }),

        /**
         * Approve a decision with optimistic update
         * Story 2.3: FR14 - Approve pending action requests
         *
         * Pattern:
         * 1. Store original for rollback
         * 2. Optimistic update (mark as approved immediately)
         * 3. Server call
         * 4. Rollback on error
         */
        approveDecisionOptimistic: async (decisionId, reviewNotes, metrics) => {
            // 1. Store original for rollback
            const original = get().queue.find((d) => d.id === decisionId);

            if (!original) {
                throw new Error('Decision not found');
            }

            // 2. Optimistic update - mark as approved and update counts
            set((state) => ({
                queue: state.queue.map((d) =>
                    d.id === decisionId ? { ...d, status: 'approved' as const } : d
                ),
                queueCounts: {
                    ...state.queueCounts,
                    [original.urgency]: Math.max(0, state.queueCounts[original.urgency] - 1),
                    total: Math.max(0, state.queueCounts.total - 1),
                },
            }));

            try {
                // 3. Server call
                const response = await fetch(`${API_BASE}/decisions/${decisionId}/approve`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        reviewNotes,
                        reviewMetrics: metrics,
                    }),
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.detail || 'Failed to approve decision');
                }

                const result: DecisionResponse = await response.json();

                // Remove approved decision from queue after server confirms
                set((state) => ({
                    queue: state.queue.filter((d) => d.id !== decisionId),
                }));

                return result;
            } catch (error) {
                // 4. Rollback on error
                set((state) => ({
                    queue: state.queue.map((d) =>
                        d.id === decisionId ? original : d
                    ),
                    queueCounts: {
                        ...state.queueCounts,
                        [original.urgency]: state.queueCounts[original.urgency] + 1,
                        total: state.queueCounts.total + 1,
                    },
                }));
                throw error;
            }
        },

        /**
         * Deny a decision with optimistic update
         * Story 2.4: Deny pending action requests
         */
        denyDecisionOptimistic: async (decisionId, reason, metrics) => {
            const original = get().queue.find((d) => d.id === decisionId);

            if (!original) {
                throw new Error('Decision not found');
            }

            // Optimistic update
            set((state) => ({
                queue: state.queue.map((d) =>
                    d.id === decisionId ? { ...d, status: 'denied' as const } : d
                ),
                queueCounts: {
                    ...state.queueCounts,
                    [original.urgency]: Math.max(0, state.queueCounts[original.urgency] - 1),
                    total: Math.max(0, state.queueCounts.total - 1),
                },
            }));

            try {
                const response = await fetch(`${API_BASE}/decisions/${decisionId}/deny`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        reason,
                        reviewMetrics: metrics,
                    }),
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.detail || 'Failed to deny decision');
                }

                const result: DecisionResponse = await response.json();

                // Remove denied decision from queue
                set((state) => ({
                    queue: state.queue.filter((d) => d.id !== decisionId),
                }));

                return result;
            } catch (error) {
                // Rollback on error
                set((state) => ({
                    queue: state.queue.map((d) =>
                        d.id === decisionId ? original : d
                    ),
                    queueCounts: {
                        ...state.queueCounts,
                        [original.urgency]: state.queueCounts[original.urgency] + 1,
                        total: state.queueCounts.total + 1,
                    },
                }));
                throw error;
            }
        },

        // ====================================================================
        // Task Actions
        // ====================================================================

        setActiveTasks: (tasks) => set({ activeTasks: tasks }),

        updateTask: (taskId, updates) =>
            set((state) => ({
                activeTasks: state.activeTasks.map((task) =>
                    task.id === taskId ? { ...task, ...updates } : task
                ),
            })),

        // ====================================================================
        // Connection Actions
        // ====================================================================

        setConnectionStatus: (status) => set({ connectionStatus: status }),

        setLastSync: (date) => set({ lastSync: date }),

        incrementReconnectAttempts: () =>
            set((state) => ({ reconnectAttempts: state.reconnectAttempts + 1 })),

        resetReconnectAttempts: () => set({ reconnectAttempts: 0 }),

        // ====================================================================
        // User Context Actions
        // ====================================================================

        setUserContext: (orgId, role) => set({ orgId, userRole: role }),

        clearUserContext: () => set({ orgId: null, userRole: null }),

        // ====================================================================
        // Bulk Actions
        // ====================================================================

        syncState: (newState) =>
            set((state) => ({
                ...state,
                ...(newState.agents !== undefined && { agents: newState.agents }),
                ...(newState.pendingDecisions !== undefined && {
                    pendingDecisions: newState.pendingDecisions,
                }),
                ...(newState.activeTasks !== undefined && { activeTasks: newState.activeTasks }),
                lastSync: new Date(),
            })),

        reset: () => set(initialState),
    }))
);

// ============================================================================
// Selectors
// ============================================================================

/**
 * Get agents filtered by status
 */
export const selectAgentsByStatus = (status: Agent['status']) =>
    useMissionControlStore((state) => state.agents.filter((a) => a.status === status));

/**
 * Get agent by ID
 */
export const selectAgentById = (agentId: string) =>
    useMissionControlStore((state) => state.agents.find((a) => a.id === agentId));

/**
 * Get pending decision count
 */
export const selectPendingDecisionCount = () =>
    useMissionControlStore((state) => state.pendingDecisions.length);

/**
 * Check if connected
 */
export const selectIsConnected = () =>
    useMissionControlStore((state) => state.connectionStatus === 'connected');

/**
 * Get time since last sync in seconds
 */
export const selectSecondsSinceSync = () =>
    useMissionControlStore((state) => {
        if (!state.lastSync) return null;
        return Math.floor((Date.now() - state.lastSync.getTime()) / 1000);
    });

/**
 * Get agents grouped by tier
 */
export const selectAgentsByTier = () =>
    useMissionControlStore((state) => {
        const byTier: Record<number, Agent[]> = {};
        for (const agent of state.agents) {
            if (!byTier[agent.tier]) {
                byTier[agent.tier] = [];
            }
            byTier[agent.tier].push(agent);
        }
        return byTier;
    });

/**
 * Get fleet statistics
 */
export const selectFleetStats = () =>
    useMissionControlStore((state) => {
        const total = state.agents.length;
        const active = state.agents.filter((a) => a.status === 'WORKING').length;
        const idle = state.agents.filter((a) => a.status === 'IDLE').length;
        const error = state.agents.filter((a) => a.status === 'ERROR').length;
        const avgTrust =
            total > 0
                ? Math.round(state.agents.reduce((sum, a) => sum + a.trustScore, 0) / total)
                : 0;

        return { total, active, idle, error, avgTrust };
    });
