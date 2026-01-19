/**
 * Unified Aurais Hook
 *
 * Single hook that provides all Aurais state and actions.
 * Consolidates useSystemState and useApprovals into one cohesive interface.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { api, type APISystemState } from '../api';
import type { Agent, BlackboardEntry, ApprovalRequest } from '../types';

// =============================================================================
// Types
// =============================================================================

export interface AuraisState {
    // Core data
    agents: Agent[];
    blackboardEntries: BlackboardEntry[];
    approvals: ApprovalRequest[];

    // System metrics
    hitlLevel: number;
    avgTrust: number;
    uptime: number;

    // Status
    loading: boolean;
    error: string | null;
    connected: boolean;
    persistenceMode?: 'postgres' | 'memory';
}

export interface AuraisActions {
    // Refresh data
    refresh: () => Promise<void>;

    // Agent actions
    spawnAgent: (name: string, type: string, tier: number) => Promise<Agent | null>;

    // Governance
    setHITL: (level: number) => Promise<boolean>;

    // Approvals
    approve: (id: string, approved: boolean) => Promise<boolean>;

    // Tasks
    createTask: (description: string, priority?: string) => Promise<boolean>;
    tick: () => Promise<{ processed: number; assigned: number; completed: number; events: string[] } | null>;

    // Blackboard
    postToBlackboard: (type: string, title: string, content: string, priority?: string) => Promise<boolean>;
}

export interface UseAuraisReturn extends AuraisState, AuraisActions {
    // Computed values
    workingAgents: Agent[];
    idleAgents: Agent[];
    pendingTasks: BlackboardEntry[];
    openProblems: BlackboardEntry[];
}

// =============================================================================
// Default State
// =============================================================================

const defaultState: AuraisState = {
    agents: [],
    blackboardEntries: [],
    approvals: [],
    hitlLevel: 100,
    avgTrust: 0,
    uptime: 0,
    loading: true,
    error: null,
    connected: false,
};

// =============================================================================
// Hook Implementation
// =============================================================================

export function useAurais(pollInterval = 2000): UseAuraisReturn {
    const [state, setState] = useState<AuraisState>(defaultState);
    const [localUptime, setLocalUptime] = useState(0);

    // Transform API state to local format
    const transformState = useCallback((apiState: APISystemState): Partial<AuraisState> => {
        return {
            agents: apiState.agents.map(a => ({
                id: a.id,
                name: a.name,
                type: a.type as Agent['type'],
                tier: a.tier as Agent['tier'],
                status: a.status,
                location: {
                    floor: a.location.floor as 'EXECUTIVE' | 'OPERATIONS' | 'WORKSPACE',
                    room: a.location.room,
                },
                trustScore: a.trustScore,
                capabilities: a.capabilities,
                skills: a.skills || [],
                parentId: a.parentId,
                childIds: a.childIds,
            })),
            blackboardEntries: apiState.blackboard.map(b => ({
                id: b.id,
                type: b.type as BlackboardEntry['type'],
                title: b.title,
                content: b.content as string,
                author: b.author,
                priority: b.priority as BlackboardEntry['priority'],
                status: b.status as BlackboardEntry['status'],
                timestamp: new Date(b.createdAt),
                comments: b.comments?.map(c => ({
                    author: c.author,
                    text: c.text,
                    timestamp: new Date(c.timestamp),
                })),
            })),
            hitlLevel: apiState.hitlLevel,
            avgTrust: apiState.avgTrust,
            persistenceMode: apiState.persistenceMode,
            connected: true,
            error: null,
        };
    }, []);

    // Fetch system state
    const fetchState = useCallback(async () => {
        try {
            const [apiState, approvals] = await Promise.all([
                api.getState(),
                api.getApprovals().catch(() => [] as ApprovalRequest[]),
            ]);

            setState(prev => ({
                ...prev,
                ...transformState(apiState),
                approvals,
                loading: false,
            }));
        } catch (e) {
            setState(prev => ({
                ...prev,
                loading: false,
                error: e instanceof Error ? e.message : 'Failed to connect to API',
                connected: false,
            }));
        }
    }, [transformState]);

    // Initial fetch and polling
    useEffect(() => {
        fetchState();
        const interval = setInterval(fetchState, pollInterval);
        return () => clearInterval(interval);
    }, [fetchState, pollInterval]);

    // Uptime ticker
    useEffect(() => {
        api.getUptime()
            .then(data => {
                if (data?.uptime) {
                    setLocalUptime(data.uptime);
                }
            })
            .catch(() => {});

        const interval = setInterval(() => {
            setLocalUptime(prev => prev + 1);
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    // Actions
    const refresh = useCallback(async () => {
        setState(prev => ({ ...prev, loading: true }));
        await fetchState();
    }, [fetchState]);

    const spawnAgent = useCallback(async (name: string, type: string, tier: number): Promise<Agent | null> => {
        try {
            const agent = await api.spawnAgent({ name, type, tier });
            await fetchState(); // Refresh to get updated list
            return agent as Agent;
        } catch (e) {
            console.error('Failed to spawn agent:', e);
            return null;
        }
    }, [fetchState]);

    const setHITL = useCallback(async (level: number): Promise<boolean> => {
        try {
            await api.setHITL(level);
            setState(prev => ({ ...prev, hitlLevel: level }));
            return true;
        } catch (e) {
            console.error('Failed to set HITL:', e);
            return false;
        }
    }, []);

    const approve = useCallback(async (id: string, approved: boolean): Promise<boolean> => {
        try {
            await api.approve(id, approved);
            setState(prev => ({
                ...prev,
                approvals: prev.approvals.filter(a => a.id !== id),
            }));
            return true;
        } catch (e) {
            console.error('Failed to process approval:', e);
            return false;
        }
    }, []);

    const createTask = useCallback(async (description: string, priority = 'NORMAL'): Promise<boolean> => {
        try {
            await api.createTask(description, 'Human', priority);
            await fetchState();
            return true;
        } catch (e) {
            console.error('Failed to create task:', e);
            return false;
        }
    }, [fetchState]);

    const tick = useCallback(async () => {
        try {
            const result = await api.tick();
            await fetchState();
            return {
                processed: result.processed,
                assigned: result.assigned,
                completed: result.completed,
                events: result.events || [],
            };
        } catch (e) {
            console.error('Tick failed:', e);
            return null;
        }
    }, [fetchState]);

    const postToBlackboard = useCallback(async (
        type: string,
        title: string,
        content: string,
        priority = 'NORMAL'
    ): Promise<boolean> => {
        try {
            await api.postToBlackboard({ type, title, content, priority });
            await fetchState();
            return true;
        } catch (e) {
            console.error('Failed to post to blackboard:', e);
            return false;
        }
    }, [fetchState]);

    // Computed values
    const workingAgents = useMemo(
        () => state.agents.filter(a => a.status === 'WORKING'),
        [state.agents]
    );

    const idleAgents = useMemo(
        () => state.agents.filter(a => a.status === 'IDLE'),
        [state.agents]
    );

    const pendingTasks = useMemo(
        () => state.blackboardEntries.filter(e => e.type === 'TASK' && e.status !== 'RESOLVED'),
        [state.blackboardEntries]
    );

    const openProblems = useMemo(
        () => state.blackboardEntries.filter(e => e.type === 'PROBLEM' && e.status === 'OPEN'),
        [state.blackboardEntries]
    );

    return {
        // State
        ...state,
        uptime: localUptime,

        // Actions
        refresh,
        spawnAgent,
        setHITL,
        approve,
        createTask,
        tick,
        postToBlackboard,

        // Computed
        workingAgents,
        idleAgents,
        pendingTasks,
        openProblems,
    };
}

export default useAurais;
