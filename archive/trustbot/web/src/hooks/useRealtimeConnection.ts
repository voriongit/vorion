/**
 * Real-Time Connection Hook
 *
 * Manages WebSocket/polling connection for real-time updates.
 * Implements exponential backoff reconnection and state reconciliation.
 *
 * Story 1.2: Zustand Store & Real-Time Connection
 * FRs: FR55 (Real-time updates)
 */

import { useEffect, useRef, useCallback } from 'react';
import { useMissionControlStore } from '../stores/missionControlStore';
import { api } from '../api';
import type { Agent, ApprovalRequest } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface RealtimeEvent {
    type: string;
    payload: unknown;
    timestamp: string;
    orgId?: string;
}

export interface AgentStatusChangedEvent extends RealtimeEvent {
    type: 'agent:status_changed';
    payload: {
        agentId: string;
        oldStatus: Agent['status'];
        newStatus: Agent['status'];
        trustScore?: number;
    };
}

export interface AgentTrustUpdatedEvent extends RealtimeEvent {
    type: 'agent:trust_updated';
    payload: {
        agentId: string;
        oldScore: number;
        newScore: number;
        reason?: string;
    };
}

export interface DecisionPendingEvent extends RealtimeEvent {
    type: 'decision:pending';
    payload: ApprovalRequest;
}

export interface DecisionResolvedEvent extends RealtimeEvent {
    type: 'decision:resolved';
    payload: {
        decisionId: string;
        status: 'APPROVED' | 'REJECTED';
    };
}

export type RealtimeEventType =
    | AgentStatusChangedEvent
    | AgentTrustUpdatedEvent
    | DecisionPendingEvent
    | DecisionResolvedEvent;

export interface UseRealtimeConnectionOptions {
    /** Polling interval in ms (fallback when WebSocket unavailable) */
    pollInterval?: number;
    /** Enable/disable the connection */
    enabled?: boolean;
    /** Organization ID for channel subscription */
    orgId?: string;
}

// ============================================================================
// Constants
// ============================================================================

/** Initial reconnect delay in ms */
const INITIAL_BACKOFF = 1000;

/** Maximum reconnect delay in ms */
const MAX_BACKOFF = 30000;

/** Backoff multiplier */
const BACKOFF_MULTIPLIER = 2;

/** Stale threshold in ms (show "last sync" after this) */
const STALE_THRESHOLD = 5000;

// ============================================================================
// Hook
// ============================================================================

export function useRealtimeConnection(options: UseRealtimeConnectionOptions = {}) {
    const { pollInterval = 2000, enabled = true, orgId: _orgId } = options;

    // Store actions
    const {
        setAgents: _setAgents,
        updateAgent,
        addAgent: _addAgent,
        removeAgent: _removeAgent,
        setPendingDecisions: _setPendingDecisions,
        addDecision,
        removeDecision,
        setActiveTasks: _setActiveTasks,
        setConnectionStatus,
        setLastSync,
        incrementReconnectAttempts,
        resetReconnectAttempts,
        syncState,
        connectionStatus,
        reconnectAttempts,
    } = useMissionControlStore();

    // Refs for cleanup and state
    const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mountedRef = useRef(true);
    const lastFetchRef = useRef<number>(0);

    // ========================================================================
    // Fetch Full State (for initial load and reconciliation)
    // ========================================================================

    const fetchFullState = useCallback(async () => {
        if (!mountedRef.current) return;

        try {
            const state = await api.getState();

            if (!mountedRef.current) return;

            // Transform API response to store format
            const agents: Agent[] = state.agents.map((a) => ({
                id: a.id,
                structuredId: a.structuredId,
                name: a.name,
                type: a.type,
                tier: a.tier,
                status: a.status,
                location: a.location,
                trustScore: a.trustScore,
                capabilities: a.capabilities,
                skills: a.skills,
                parentId: a.parentId,
                childIds: a.childIds,
            }));

            syncState({ agents });
            setConnectionStatus('connected');
            setLastSync(new Date());
            resetReconnectAttempts();
            lastFetchRef.current = Date.now();

            return true;
        } catch (error) {
            console.error('[Realtime] Failed to fetch state:', error);

            if (!mountedRef.current) return false;

            setConnectionStatus('disconnected');
            return false;
        }
    }, [syncState, setConnectionStatus, setLastSync, resetReconnectAttempts]);

    // ========================================================================
    // Handle Real-Time Events
    // ========================================================================

    const handleEvent = useCallback(
        (event: RealtimeEventType) => {
            if (!mountedRef.current) return;

            switch (event.type) {
                case 'agent:status_changed': {
                    const { agentId, newStatus, trustScore } = event.payload;
                    updateAgent(agentId, {
                        status: newStatus,
                        ...(trustScore !== undefined && { trustScore }),
                    });
                    break;
                }

                case 'agent:trust_updated': {
                    const { agentId, newScore } = event.payload;
                    updateAgent(agentId, { trustScore: newScore });
                    break;
                }

                case 'decision:pending': {
                    addDecision(event.payload);
                    break;
                }

                case 'decision:resolved': {
                    const { decisionId } = event.payload;
                    removeDecision(decisionId);
                    break;
                }
            }

            setLastSync(new Date());
        },
        [updateAgent, addDecision, removeDecision, setLastSync]
    );

    // ========================================================================
    // Reconnection with Exponential Backoff
    // ========================================================================

    const scheduleReconnect = useCallback(() => {
        if (!mountedRef.current || !enabled) return;

        // Calculate backoff delay
        const delay = Math.min(
            INITIAL_BACKOFF * Math.pow(BACKOFF_MULTIPLIER, reconnectAttempts),
            MAX_BACKOFF
        );

        console.log(`[Realtime] Scheduling reconnect in ${delay}ms (attempt ${reconnectAttempts + 1})`);

        setConnectionStatus('reconnecting');

        reconnectTimeoutRef.current = setTimeout(async () => {
            if (!mountedRef.current) return;

            incrementReconnectAttempts();
            const success = await fetchFullState();

            if (!success && mountedRef.current) {
                scheduleReconnect();
            }
        }, delay);
    }, [
        enabled,
        reconnectAttempts,
        setConnectionStatus,
        incrementReconnectAttempts,
        fetchFullState,
    ]);

    // ========================================================================
    // Polling (Fallback for Real-Time)
    // ========================================================================

    const startPolling = useCallback(() => {
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
        }

        pollIntervalRef.current = setInterval(async () => {
            if (!mountedRef.current) return;

            // Skip if we recently fetched
            if (Date.now() - lastFetchRef.current < pollInterval * 0.8) {
                return;
            }

            try {
                const state = await api.getState();

                if (!mountedRef.current) return;

                const agents: Agent[] = state.agents.map((a) => ({
                    id: a.id,
                    structuredId: a.structuredId,
                    name: a.name,
                    type: a.type,
                    tier: a.tier,
                    status: a.status,
                    location: a.location,
                    trustScore: a.trustScore,
                    capabilities: a.capabilities,
                    skills: a.skills,
                    parentId: a.parentId,
                    childIds: a.childIds,
                }));

                syncState({ agents });
                setConnectionStatus('connected');
                setLastSync(new Date());
                lastFetchRef.current = Date.now();

                if (reconnectAttempts > 0) {
                    resetReconnectAttempts();
                }
            } catch (error) {
                if (!mountedRef.current) return;

                // Only set disconnected if we were previously connected
                if (connectionStatus === 'connected') {
                    setConnectionStatus('disconnected');
                    scheduleReconnect();
                }
            }
        }, pollInterval);
    }, [
        pollInterval,
        syncState,
        setConnectionStatus,
        setLastSync,
        resetReconnectAttempts,
        reconnectAttempts,
        connectionStatus,
        scheduleReconnect,
    ]);

    const stopPolling = useCallback(() => {
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
        }
    }, []);

    // ========================================================================
    // Manual Refresh
    // ========================================================================

    const refresh = useCallback(async () => {
        return fetchFullState();
    }, [fetchFullState]);

    // ========================================================================
    // Lifecycle
    // ========================================================================

    useEffect(() => {
        mountedRef.current = true;

        if (!enabled) {
            setConnectionStatus('disconnected');
            return;
        }

        // Initial fetch
        fetchFullState().then((success) => {
            if (success && mountedRef.current) {
                startPolling();
            } else if (mountedRef.current) {
                scheduleReconnect();
            }
        });

        return () => {
            mountedRef.current = false;
            stopPolling();

            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }
        };
    }, [enabled, fetchFullState, startPolling, stopPolling, scheduleReconnect, setConnectionStatus]);

    // ========================================================================
    // Return
    // ========================================================================

    return {
        /** Current connection status */
        connectionStatus,

        /** Number of reconnection attempts */
        reconnectAttempts,

        /** Manually trigger a refresh */
        refresh,

        /** Handle an incoming real-time event */
        handleEvent,
    };
}

// ============================================================================
// Connection Status Utilities
// ============================================================================

/**
 * Format seconds since last sync for display
 */
export function formatSyncAge(seconds: number | null): string {
    if (seconds === null) return 'Never synced';
    if (seconds < 5) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
}

/**
 * Check if sync is stale (should show indicator)
 */
export function isSyncStale(lastSync: Date | null): boolean {
    if (!lastSync) return true;
    return Date.now() - lastSync.getTime() > STALE_THRESHOLD;
}
