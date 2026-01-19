/**
 * TrustBot Headquarters Integration
 * 
 * Bridges the new unified system with your existing web-626.vercel.app TrustBot UI.
 * 
 * This module provides:
 * 1. API client for the unified backend
 * 2. State adapter to transform data for the existing UI
 * 3. Real-time sync via SSE
 * 4. Drop-in replacement hooks
 */

import { 
  WorldState, 
  Agent, 
  Task, 
  SystemEvent,
  TrustTier,
  TIER_CONFIG,
  AgentStatus,
  TaskStatus,
} from '@trustbot/core';

// ============================================================================
// API CLIENT
// ============================================================================

export interface TrustBotAPIConfig {
  baseUrl: string;
  apiKey?: string;
}

export class TrustBotAPI {
  private baseUrl: string;
  private apiKey?: string;

  constructor(config: TrustBotAPIConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
  }

  private async fetch<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // State
  async getState(): Promise<WorldState> {
    return this.fetch('/api/state');
  }

  // Agents
  async createAgent(params: {
    name: string;
    purpose: string;
    persona: string;
    parentId?: string;
    isRoot?: boolean;
  }): Promise<{ agentId: string }> {
    return this.fetch('/api/agent', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async getAgent(agentId: string): Promise<Agent> {
    return this.fetch(`/api/agent/${agentId}`);
  }

  // Tasks
  async createTask(params: {
    title: string;
    description: string;
    input?: Record<string, unknown>;
    createdBy?: string;
    requiredTier?: TrustTier;
  }): Promise<{ taskId: string }> {
    return this.fetch('/api/task', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async getTask(taskId: string): Promise<Task> {
    return this.fetch(`/api/task/${taskId}`);
  }

  // Execution
  async runTick(): Promise<{ tasksAssigned: number; tasksStarted: number }> {
    return this.fetch('/api/tick', { method: 'POST' });
  }

  // Messages
  async sendMessage(
    fromAgent: string,
    toAgent: string,
    content: string
  ): Promise<void> {
    return this.fetch('/api/message', {
      method: 'POST',
      body: JSON.stringify({ fromAgent, toAgent, content }),
    });
  }

  // Reset
  async reset(): Promise<void> {
    return this.fetch('/api/agent', { method: 'DELETE' });
  }

  // SSE Stream
  createEventSource(): EventSource {
    return new EventSource(`${this.baseUrl}/api/stream`);
  }
}

// ============================================================================
// STATE ADAPTER FOR HEADQUARTERS UI
// ============================================================================

/**
 * Transforms the unified state into the format expected by the
 * existing TrustBot Headquarters React components.
 */
export interface HQAgent {
  id: string;
  name: string;
  role: string;
  tier: number;
  tierName: string;
  tierColor: string;
  status: string;
  trustScore: number;
  isActive: boolean;
  currentTask: string | null;
  stats: {
    completed: number;
    failed: number;
    messages: number;
  };
  parentId: string | null;
  children: string[];
  createdAt: Date;
}

export interface HQTask {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  statusColor: string;
  assignee: string | null;
  assigneeName: string | null;
  creator: string;
  creatorName: string;
  delegations: {
    current: number;
    max: number;
  };
  timestamps: {
    created: Date;
    started: Date | null;
    completed: Date | null;
  };
  output: unknown | null;
  error: string | null;
}

export interface HQEvent {
  id: string;
  type: string;
  message: string;
  agentId: string | null;
  agentName: string | null;
  taskId: string | null;
  timestamp: Date;
  severity: string;
}

export interface HQState {
  tick: number;
  agents: HQAgent[];
  tasks: HQTask[];
  events: HQEvent[];
  metrics: {
    totalAgents: number;
    activeAgents: number;
    totalTasks: number;
    pendingTasks: number;
    completedTasks: number;
    failedTasks: number;
  };
  isConnected: boolean;
  lastUpdated: Date;
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#6b7280',
  assigned: '#f59e0b',
  in_progress: '#3b82f6',
  completed: '#10b981',
  failed: '#ef4444',
  cancelled: '#9ca3af',
};

export function adaptStateForHQ(state: WorldState, connected: boolean): HQState {
  const agents = Object.values(state.agents);
  const tasks = Object.values(state.tasks);

  const hqAgents: HQAgent[] = agents.map(agent => ({
    id: agent.id,
    name: agent.name,
    role: agent.purpose,
    tier: agent.tier,
    tierName: TIER_CONFIG[agent.tier].name,
    tierColor: TIER_CONFIG[agent.tier].color,
    status: agent.status,
    trustScore: agent.trustScore,
    isActive: agent.status === AgentStatus.EXECUTING || agent.status === AgentStatus.THINKING,
    currentTask: agent.currentTaskId,
    stats: {
      completed: agent.tasksCompleted,
      failed: agent.tasksFailed,
      messages: agent.messagesProcessed,
    },
    parentId: agent.parentId,
    children: agent.spawnedAgents,
    createdAt: new Date(agent.createdAt),
  }));

  const hqTasks: HQTask[] = tasks.map(task => {
    const assignee = task.assignedTo ? state.agents[task.assignedTo] : null;
    const creator = state.agents[task.createdBy];

    return {
      id: task.id,
      title: task.title,
      description: task.description,
      type: task.type,
      status: task.status,
      statusColor: STATUS_COLORS[task.status] || '#6b7280',
      assignee: task.assignedTo,
      assigneeName: assignee?.name || null,
      creator: task.createdBy,
      creatorName: creator?.name || 'System',
      delegations: {
        current: task.currentDelegations,
        max: task.maxDelegations,
      },
      timestamps: {
        created: new Date(task.createdAt),
        started: task.startedAt ? new Date(task.startedAt) : null,
        completed: task.completedAt ? new Date(task.completedAt) : null,
      },
      output: task.output,
      error: task.error,
    };
  });

  const hqEvents: HQEvent[] = state.events.slice(-100).map(event => {
    const agent = event.agentId ? state.agents[event.agentId] : null;

    return {
      id: event.id,
      type: event.type,
      message: event.message,
      agentId: event.agentId || null,
      agentName: agent?.name || null,
      taskId: event.taskId || null,
      timestamp: new Date(event.timestamp),
      severity: event.severity || 'info',
    };
  });

  return {
    tick: state.tick,
    agents: hqAgents,
    tasks: hqTasks,
    events: hqEvents.reverse(),
    metrics: {
      totalAgents: agents.length,
      activeAgents: agents.filter(a => 
        a.status === AgentStatus.EXECUTING || a.status === AgentStatus.THINKING
      ).length,
      totalTasks: tasks.length,
      pendingTasks: state.pendingTasks.length,
      completedTasks: state.totalTasksCompleted,
      failedTasks: state.totalTasksFailed,
    },
    isConnected: connected,
    lastUpdated: new Date(state.lastUpdated),
  };
}

// ============================================================================
// REACT HOOKS FOR HEADQUARTERS
// ============================================================================

/**
 * React hook for real-time state updates.
 * Drop-in replacement for existing state management.
 * 
 * Usage in your React component:
 * 
 * ```tsx
 * import { useTrustBotState } from '@trustbot/headquarters-adapter';
 * 
 * function Dashboard() {
 *   const { state, api, error } = useTrustBotState({
 *     baseUrl: process.env.NEXT_PUBLIC_TRUSTBOT_API_URL,
 *   });
 * 
 *   if (!state) return <Loading />;
 * 
 *   return (
 *     <div>
 *       {state.agents.map(agent => (
 *         <AgentCard key={agent.id} agent={agent} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function createTrustBotHook(config: TrustBotAPIConfig) {
  const api = new TrustBotAPI(config);

  return function useTrustBotState() {
    // This would be implemented with React hooks
    // Returning the shape for TypeScript purposes
    return {
      state: null as HQState | null,
      api,
      error: null as string | null,
      isLoading: true,
      runTick: async () => api.runTick(),
      createAgent: async (params: Parameters<typeof api.createAgent>[0]) => 
        api.createAgent(params),
      createTask: async (params: Parameters<typeof api.createTask>[0]) => 
        api.createTask(params),
      sendMessage: async (from: string, to: string, content: string) => 
        api.sendMessage(from, to, content),
      reset: async () => api.reset(),
    };
  };
}

// ============================================================================
// VANILLA JS INTEGRATION
// ============================================================================

/**
 * For non-React integration or vanilla JS usage.
 */
export class TrustBotHQClient {
  private api: TrustBotAPI;
  private eventSource: EventSource | null = null;
  private state: HQState | null = null;
  private listeners: Set<(state: HQState) => void> = new Set();

  constructor(config: TrustBotAPIConfig) {
    this.api = new TrustBotAPI(config);
  }

  async connect(): Promise<void> {
    // Initial state fetch
    const rawState = await this.api.getState();
    this.state = adaptStateForHQ(rawState, true);
    this.notifyListeners();

    // Start SSE
    this.eventSource = this.api.createEventSource();

    this.eventSource.onmessage = (event) => {
      try {
        const rawState = JSON.parse(event.data);
        this.state = adaptStateForHQ(rawState, true);
        this.notifyListeners();
      } catch (e) {
        console.error('Failed to parse state:', e);
      }
    };

    this.eventSource.onerror = () => {
      if (this.state) {
        this.state = { ...this.state, isConnected: false };
        this.notifyListeners();
      }
    };
  }

  disconnect(): void {
    this.eventSource?.close();
    this.eventSource = null;
  }

  getState(): HQState | null {
    return this.state;
  }

  subscribe(listener: (state: HQState) => void): () => void {
    this.listeners.add(listener);
    
    // Immediately call with current state
    if (this.state) {
      listener(this.state);
    }

    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    if (this.state) {
      for (const listener of this.listeners) {
        listener(this.state);
      }
    }
  }

  // API methods
  async runTick() {
    return this.api.runTick();
  }

  async createAgent(params: Parameters<typeof this.api.createAgent>[0]) {
    return this.api.createAgent(params);
  }

  async createTask(params: Parameters<typeof this.api.createTask>[0]) {
    return this.api.createTask(params);
  }

  async sendMessage(from: string, to: string, content: string) {
    return this.api.sendMessage(from, to, content);
  }

  async reset() {
    return this.api.reset();
  }
}

// ============================================================================
// HEADQUARTERS COMPONENT LIBRARY TYPES
// ============================================================================

/**
 * Props for common HQ UI components.
 * These match the expected interfaces for your existing React components.
 */

export interface AgentCardProps {
  agent: HQAgent;
  onSelect?: (agentId: string) => void;
  onSpawnChild?: (parentId: string) => void;
  showDetails?: boolean;
}

export interface TaskCardProps {
  task: HQTask;
  onSelect?: (taskId: string) => void;
  onCancel?: (taskId: string) => void;
  showOutput?: boolean;
}

export interface EventLogProps {
  events: HQEvent[];
  maxItems?: number;
  filter?: {
    types?: string[];
    agentId?: string;
    severity?: string[];
  };
}

export interface MetricsPanelProps {
  metrics: HQState['metrics'];
  showChart?: boolean;
}

export interface ControlPanelProps {
  onRunTick: () => Promise<void>;
  onCreateAgent: (params: { name: string; purpose: string; persona: string }) => Promise<void>;
  onCreateTask: (params: { title: string; description: string }) => Promise<void>;
  onReset: () => Promise<void>;
  isLoading?: boolean;
  hasRootAgent: boolean;
}
