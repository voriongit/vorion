'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  WorldState,
  Agent,
  Task,
  SystemEvent,
  TrustTier,
  TIER_NAMES,
  TIER_COLORS,
  AgentStatus,
  TaskStatus,
} from '@/lib/types';

// ============================================================================
// STATE HOOK
// ============================================================================

function useWorldState() {
  const [state, setState] = useState<WorldState | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const eventSource = new EventSource('/api/stream');

    eventSource.onopen = () => {
      setConnected(true);
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setState(data);
      } catch (e) {
        console.error('Failed to parse state:', e);
      }
    };

    eventSource.onerror = () => {
      setConnected(false);
      setError('Connection lost');
    };

    return () => {
      eventSource.close();
    };
  }, []);

  return { state, connected, error };
}

// ============================================================================
// COMPONENTS
// ============================================================================

function StatusBadge({ status }: { status: AgentStatus | TaskStatus }) {
  const colors: Record<string, string> = {
    idle: 'bg-gray-500',
    thinking: 'bg-yellow-500 animate-pulse',
    executing: 'bg-blue-500 animate-pulse',
    waiting: 'bg-orange-500',
    suspended: 'bg-red-500',
    terminated: 'bg-gray-800',
    pending: 'bg-gray-500',
    assigned: 'bg-yellow-500',
    in_progress: 'bg-blue-500 animate-pulse',
    completed: 'bg-green-500',
    failed: 'bg-red-500',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs text-white ${colors[status] || 'bg-gray-500'}`}>
      {status}
    </span>
  );
}

function TierBadge({ tier }: { tier: TrustTier }) {
  return (
    <span
      className="px-2 py-0.5 rounded text-xs text-white font-medium"
      style={{ backgroundColor: TIER_COLORS[tier] }}
    >
      {TIER_NAMES[tier]}
    </span>
  );
}

function AgentCard({ agent, tasks }: { agent: Agent; tasks: Task[] }) {
  const agentTasks = tasks.filter(t => t.assignedTo === agent.id);
  const currentTask = agentTasks.find(t => t.id === agent.currentTaskId);

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-white">{agent.name}</h3>
        <div className="flex gap-2">
          <TierBadge tier={agent.tier} />
          <StatusBadge status={agent.status} />
        </div>
      </div>
      
      <p className="text-gray-400 text-sm mb-2">{agent.purpose}</p>
      
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span>Score: {agent.trustScore}</span>
        <span>✓ {agent.tasksCompleted}</span>
        <span>✗ {agent.tasksFailed}</span>
      </div>
      
      {currentTask && (
        <div className="mt-3 p-2 bg-gray-900 rounded text-sm">
          <div className="text-yellow-400 text-xs mb-1">Working on:</div>
          <div className="text-white">{currentTask.title}</div>
        </div>
      )}
      
      {/* Trust bar */}
      <div className="mt-3 h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${agent.trustScore / 10}%`,
            backgroundColor: TIER_COLORS[agent.tier],
          }}
        />
      </div>
    </div>
  );
}

function TaskCard({ task, agents }: { task: Task; agents: Record<string, Agent> }) {
  const assignedAgent = task.assignedTo ? agents[task.assignedTo] : null;
  const creatorAgent = agents[task.createdBy];

  return (
    <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-medium text-white text-sm">{task.title}</h4>
        <StatusBadge status={task.status} />
      </div>
      
      <p className="text-gray-400 text-xs mb-2 line-clamp-2">{task.description}</p>
      
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          {assignedAgent ? `→ ${assignedAgent.name}` : 'Unassigned'}
        </span>
        <span>
          Delegations: {task.currentDelegations}/{task.maxDelegations}
        </span>
      </div>
      
      {task.output && (
        <div className="mt-2 p-2 bg-green-900/30 rounded text-xs text-green-300">
          <pre className="whitespace-pre-wrap">
            {JSON.stringify(task.output, null, 2).slice(0, 200)}
          </pre>
        </div>
      )}
      
      {task.error && (
        <div className="mt-2 p-2 bg-red-900/30 rounded text-xs text-red-300">
          {task.error}
        </div>
      )}
    </div>
  );
}

function EventLog({ events }: { events: SystemEvent[] }) {
  return (
    <div className="space-y-1 max-h-96 overflow-y-auto">
      {events.slice().reverse().map((event) => (
        <div
          key={event.id}
          className="text-xs p-2 bg-gray-800 rounded border-l-2"
          style={{
            borderColor:
              event.type.includes('completed') ? '#10b981' :
              event.type.includes('failed') ? '#ef4444' :
              event.type.includes('trust') ? '#8b5cf6' :
              '#6b7280',
          }}
        >
          <div className="flex justify-between text-gray-500">
            <span>{event.type}</span>
            <span>{new Date(event.timestamp).toLocaleTimeString()}</span>
          </div>
          <div className="text-gray-300 mt-1">{event.message}</div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// CONTROL PANEL
// ============================================================================

function ControlPanel({ state }: { state: WorldState }) {
  const [loading, setLoading] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');

  const runTick = useCallback(async () => {
    setLoading(true);
    try {
      await fetch('/api/tick', { method: 'POST' });
    } catch (e) {
      console.error('Tick failed:', e);
    }
    setLoading(false);
  }, []);

  const createRootAgent = useCallback(async () => {
    setLoading(true);
    try {
      await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Overseer',
          purpose: 'System orchestration and high-level task management',
          persona: 'A wise and efficient coordinator who delegates strategically but prefers to see work done correctly.',
          isRoot: true,
        }),
      });
    } catch (e) {
      console.error('Create agent failed:', e);
    }
    setLoading(false);
  }, []);

  const createWorkerAgent = useCallback(async () => {
    setLoading(true);
    const rootAgent = Object.values(state.agents).find(a => a.tier === TrustTier.ELITE);
    try {
      await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Worker-${Date.now().toString(36).slice(-4)}`,
          purpose: 'Execute tasks directly and efficiently',
          persona: 'A diligent worker who takes pride in completing tasks thoroughly.',
          parentId: rootAgent?.id,
        }),
      });
    } catch (e) {
      console.error('Create agent failed:', e);
    }
    setLoading(false);
  }, [state.agents]);

  const createTask = useCallback(async () => {
    if (!taskTitle || !taskDesc) return;
    setLoading(true);
    const rootAgent = Object.values(state.agents).find(a => a.tier === TrustTier.ELITE);
    try {
      await fetch('/api/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: taskTitle,
          description: taskDesc,
          createdBy: rootAgent?.id || 'system',
          input: {},
        }),
      });
      setTaskTitle('');
      setTaskDesc('');
    } catch (e) {
      console.error('Create task failed:', e);
    }
    setLoading(false);
  }, [taskTitle, taskDesc, state.agents]);

  const resetSystem = useCallback(async () => {
    if (!confirm('Reset entire system?')) return;
    setLoading(true);
    try {
      await fetch('/api/agent', { method: 'DELETE' });
    } catch (e) {
      console.error('Reset failed:', e);
    }
    setLoading(false);
  }, []);

  const hasRootAgent = Object.values(state.agents).some(a => a.tier === TrustTier.ELITE);

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <h2 className="text-lg font-semibold text-white mb-4">Control Panel</h2>
      
      <div className="space-y-3">
        {/* System controls */}
        <div className="flex gap-2">
          <button
            onClick={runTick}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded text-white text-sm font-medium"
          >
            {loading ? '...' : '▶ Run Tick'}
          </button>
          
          {!hasRootAgent && (
            <button
              onClick={createRootAgent}
              disabled={loading}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 rounded text-white text-sm font-medium"
            >
              + Root Agent
            </button>
          )}
          
          {hasRootAgent && (
            <button
              onClick={createWorkerAgent}
              disabled={loading}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded text-white text-sm font-medium"
            >
              + Worker
            </button>
          )}
          
          <button
            onClick={resetSystem}
            disabled={loading}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 rounded text-white text-sm font-medium ml-auto"
          >
            Reset
          </button>
        </div>
        
        {/* Task creation */}
        {hasRootAgent && (
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Task title..."
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
            />
            <textarea
              placeholder="Task description..."
              value={taskDesc}
              onChange={(e) => setTaskDesc(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm h-20"
            />
            <button
              onClick={createTask}
              disabled={loading || !taskTitle || !taskDesc}
              className="w-full px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 rounded text-white text-sm font-medium"
            >
              + Create Task
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function Dashboard() {
  const { state, connected, error } = useWorldState();

  if (!state) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  const agents = Object.values(state.agents);
  const tasks = Object.values(state.tasks);
  const pendingTasks = tasks.filter(t => t.status === TaskStatus.PENDING);
  const activeTasks = tasks.filter(t => 
    t.status === TaskStatus.ASSIGNED || t.status === TaskStatus.IN_PROGRESS
  );
  const completedTasks = tasks.filter(t => t.status === TaskStatus.COMPLETED);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">TrustBot Live</h1>
          <p className="text-gray-400 text-sm">
            Tick: {state.tick} | Agents: {agents.length} | Tasks: {tasks.length}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm text-gray-400">
            {connected ? 'Connected' : error || 'Disconnected'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left: Agents */}
        <div className="col-span-4 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span>Agents</span>
            <span className="text-sm text-gray-500">({agents.length})</span>
          </h2>
          
          {agents.length === 0 ? (
            <div className="text-gray-500 text-sm">No agents yet. Create a root agent to start.</div>
          ) : (
            <div className="space-y-3">
              {agents.map((agent) => (
                <AgentCard key={agent.id} agent={agent} tasks={tasks} />
              ))}
            </div>
          )}
        </div>

        {/* Middle: Tasks */}
        <div className="col-span-4 space-y-4">
          <h2 className="text-lg font-semibold">Tasks</h2>
          
          {/* Pending */}
          {pendingTasks.length > 0 && (
            <div>
              <h3 className="text-sm text-gray-400 mb-2">Pending ({pendingTasks.length})</h3>
              <div className="space-y-2">
                {pendingTasks.map((task) => (
                  <TaskCard key={task.id} task={task} agents={state.agents} />
                ))}
              </div>
            </div>
          )}
          
          {/* Active */}
          {activeTasks.length > 0 && (
            <div>
              <h3 className="text-sm text-yellow-400 mb-2">Active ({activeTasks.length})</h3>
              <div className="space-y-2">
                {activeTasks.map((task) => (
                  <TaskCard key={task.id} task={task} agents={state.agents} />
                ))}
              </div>
            </div>
          )}
          
          {/* Completed (last 5) */}
          {completedTasks.length > 0 && (
            <div>
              <h3 className="text-sm text-green-400 mb-2">Completed ({completedTasks.length})</h3>
              <div className="space-y-2">
                {completedTasks.slice(-5).reverse().map((task) => (
                  <TaskCard key={task.id} task={task} agents={state.agents} />
                ))}
              </div>
            </div>
          )}
          
          {tasks.length === 0 && (
            <div className="text-gray-500 text-sm">No tasks yet.</div>
          )}
        </div>

        {/* Right: Controls & Events */}
        <div className="col-span-4 space-y-4">
          <ControlPanel state={state} />
          
          <div>
            <h2 className="text-lg font-semibold mb-2">Event Log</h2>
            <EventLog events={state.events} />
          </div>
        </div>
      </div>
    </div>
  );
}
