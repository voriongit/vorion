/**
 * TrustBot Headquarters - React Hooks
 * 
 * Drop-in hooks for integrating with your existing React UI.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  TrustBotAPI, 
  TrustBotAPIConfig, 
  HQState, 
  adaptStateForHQ 
} from './adapter';
import { WorldState } from '@trustbot/core';

// ============================================================================
// MAIN STATE HOOK
// ============================================================================

export interface UseTrustBotStateOptions extends TrustBotAPIConfig {
  autoConnect?: boolean;
  pollInterval?: number;  // Fallback if SSE not available
}

export interface UseTrustBotStateReturn {
  state: HQState | null;
  error: string | null;
  isLoading: boolean;
  isConnected: boolean;
  
  // Actions
  runTick: () => Promise<void>;
  createRootAgent: () => Promise<string | undefined>;
  createWorkerAgent: (parentId: string) => Promise<string | undefined>;
  createTask: (title: string, description: string) => Promise<string | undefined>;
  sendMessage: (from: string, to: string, content: string) => Promise<void>;
  reset: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useTrustBotState(options: UseTrustBotStateOptions): UseTrustBotStateReturn {
  const [state, setState] = useState<HQState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  
  const apiRef = useRef<TrustBotAPI | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Initialize API
  useEffect(() => {
    apiRef.current = new TrustBotAPI({
      baseUrl: options.baseUrl,
      apiKey: options.apiKey,
    });
  }, [options.baseUrl, options.apiKey]);

  // Fetch state
  const fetchState = useCallback(async () => {
    if (!apiRef.current) return;
    
    try {
      const rawState = await apiRef.current.getState();
      setState(adaptStateForHQ(rawState, isConnected));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch state');
    } finally {
      setIsLoading(false);
    }
  }, [isConnected]);

  // SSE Connection
  useEffect(() => {
    if (!apiRef.current || options.autoConnect === false) return;

    const eventSource = apiRef.current.createEventSource();
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const rawState: WorldState = JSON.parse(event.data);
        setState(adaptStateForHQ(rawState, true));
        setIsLoading(false);
      } catch (e) {
        console.error('Failed to parse SSE data:', e);
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      setError('Connection lost. Retrying...');
    };

    // Initial fetch as fallback
    fetchState();

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [options.autoConnect, fetchState]);

  // Actions
  const runTick = useCallback(async () => {
    if (!apiRef.current) return;
    setIsLoading(true);
    try {
      await apiRef.current.runTick();
      // State will update via SSE
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to run tick');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createRootAgent = useCallback(async () => {
    if (!apiRef.current) return;
    setIsLoading(true);
    try {
      const result = await apiRef.current.createAgent({
        name: 'Overseer',
        purpose: 'System orchestration and high-level task management',
        persona: 'A wise and efficient coordinator who delegates strategically but prefers to see work done correctly.',
        isRoot: true,
      });
      return result.agentId;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create agent');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createWorkerAgent = useCallback(async (parentId: string) => {
    if (!apiRef.current) return;
    setIsLoading(true);
    try {
      const result = await apiRef.current.createAgent({
        name: `Worker-${Date.now().toString(36).slice(-4)}`,
        purpose: 'Execute tasks directly and efficiently',
        persona: 'A diligent worker who takes pride in completing tasks thoroughly.',
        parentId,
      });
      return result.agentId;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create agent');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createTask = useCallback(async (title: string, description: string) => {
    if (!apiRef.current || !state) return;
    
    const eliteAgent = state.agents.find(a => a.tier === 5);
    if (!eliteAgent) {
      setError('No ELITE agent available to create tasks');
      return;
    }
    
    setIsLoading(true);
    try {
      const result = await apiRef.current.createTask({
        title,
        description,
        createdBy: eliteAgent.id,
      });
      return result.taskId;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create task');
    } finally {
      setIsLoading(false);
    }
  }, [state]);

  const sendMessage = useCallback(async (from: string, to: string, content: string) => {
    if (!apiRef.current) return;
    try {
      await apiRef.current.sendMessage(from, to, content);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send message');
    }
  }, []);

  const reset = useCallback(async () => {
    if (!apiRef.current) return;
    if (!confirm('Reset entire system? This cannot be undone.')) return;
    
    setIsLoading(true);
    try {
      await apiRef.current.reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reset');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    state,
    error,
    isLoading,
    isConnected,
    runTick,
    createRootAgent,
    createWorkerAgent,
    createTask,
    sendMessage,
    reset,
    refresh: fetchState,
  };
}

// ============================================================================
// AGENT-SPECIFIC HOOKS
// ============================================================================

export function useAgent(agentId: string | null, state: HQState | null) {
  return state?.agents.find(a => a.id === agentId) || null;
}

export function useAgentTasks(agentId: string | null, state: HQState | null) {
  if (!agentId || !state) return [];
  return state.tasks.filter(t => t.assignee === agentId || t.creator === agentId);
}

export function useAgentChildren(agentId: string | null, state: HQState | null) {
  if (!agentId || !state) return [];
  const agent = state.agents.find(a => a.id === agentId);
  if (!agent) return [];
  return agent.children.map(id => state.agents.find(a => a.id === id)).filter(Boolean);
}

// ============================================================================
// TASK-SPECIFIC HOOKS
// ============================================================================

export function useTask(taskId: string | null, state: HQState | null) {
  return state?.tasks.find(t => t.id === taskId) || null;
}

export function usePendingTasks(state: HQState | null) {
  if (!state) return [];
  return state.tasks.filter(t => t.status === 'pending');
}

export function useActiveTasks(state: HQState | null) {
  if (!state) return [];
  return state.tasks.filter(t => t.status === 'in_progress' || t.status === 'assigned');
}

// ============================================================================
// EVENT HOOKS
// ============================================================================

export function useFilteredEvents(
  state: HQState | null,
  filter?: {
    types?: string[];
    agentId?: string;
    severity?: string[];
    limit?: number;
  }
) {
  if (!state) return [];
  
  let events = state.events;
  
  if (filter?.types?.length) {
    events = events.filter(e => filter.types!.includes(e.type));
  }
  
  if (filter?.agentId) {
    events = events.filter(e => e.agentId === filter.agentId);
  }
  
  if (filter?.severity?.length) {
    events = events.filter(e => filter.severity!.includes(e.severity));
  }
  
  if (filter?.limit) {
    events = events.slice(0, filter.limit);
  }
  
  return events;
}

// ============================================================================
// AUTO-TICK HOOK
// ============================================================================

export function useAutoTick(
  runTick: () => Promise<void>,
  options: {
    enabled?: boolean;
    interval?: number;
  } = {}
) {
  const { enabled = false, interval = 2000 } = options;
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    setIsRunning(true);
    const timer = setInterval(async () => {
      try {
        await runTick();
      } catch (e) {
        console.error('Auto-tick failed:', e);
      }
    }, interval);

    return () => {
      clearInterval(timer);
      setIsRunning(false);
    };
  }, [enabled, interval, runTick]);

  return isRunning;
}
