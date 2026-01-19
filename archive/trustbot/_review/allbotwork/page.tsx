/**
 * TrustBot Headquarters - Complete Dashboard
 * 
 * Drop-in replacement for your existing TrustBot UI.
 * Connect to the unified backend for real execution.
 */

'use client';

import React, { useState } from 'react';
import { useTrustBotState, useAutoTick } from './hooks';
import { HQAgent, HQTask, HQEvent, HQState } from './adapter';

const TRUSTBOT_CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_TRUSTBOT_API_URL || 'http://localhost:3000',
};

function AgentCard({ agent }: { agent: HQAgent }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold">{agent.name}</h3>
        <div className="flex gap-2">
          <span className="px-2 py-0.5 rounded text-xs text-white" style={{ backgroundColor: agent.tierColor }}>
            {agent.tierName}
          </span>
          <span className={`px-2 py-0.5 rounded text-xs text-white ${agent.isActive ? 'bg-blue-500 animate-pulse' : 'bg-gray-600'}`}>
            {agent.status}
          </span>
        </div>
      </div>
      <p className="text-gray-400 text-sm mb-2">{agent.role}</p>
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span>Score: {agent.trustScore}</span>
        <span>✓ {agent.stats.completed}</span>
        <span>✗ {agent.stats.failed}</span>
      </div>
      <div className="mt-3 h-2 bg-gray-700 rounded-full overflow-hidden">
        <div className="h-full transition-all duration-500" style={{ width: `${agent.trustScore / 10}%`, backgroundColor: agent.tierColor }} />
      </div>
    </div>
  );
}

function TaskCard({ task }: { task: HQTask }) {
  return (
    <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-medium text-sm">{task.title}</h4>
        <span className="px-2 py-0.5 rounded text-xs text-white" style={{ backgroundColor: task.statusColor }}>{task.status}</span>
      </div>
      <p className="text-gray-400 text-xs mb-2 line-clamp-2">{task.description}</p>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{task.assigneeName ? `→ ${task.assigneeName}` : 'Unassigned'}</span>
        <span>Delegations: {task.delegations.current}/{task.delegations.max}</span>
      </div>
      {task.output && (
        <div className="mt-2 p-2 bg-green-900/30 rounded text-xs text-green-300">
          <pre className="whitespace-pre-wrap overflow-hidden">{JSON.stringify(task.output, null, 2).slice(0, 200)}</pre>
        </div>
      )}
      {task.error && <div className="mt-2 p-2 bg-red-900/30 rounded text-xs text-red-300">{task.error}</div>}
    </div>
  );
}

function TaskCreator({ onCreate, isLoading }: { onCreate: (title: string, desc: string) => Promise<any>; isLoading: boolean }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description) return;
    await onCreate(title, description);
    setTitle('');
    setDescription('');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <input type="text" placeholder="Task title..." value={title} onChange={(e) => setTitle(e.target.value)}
        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm" />
      <textarea placeholder="Task description..." value={description} onChange={(e) => setDescription(e.target.value)}
        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm h-20 resize-none" />
      <button type="submit" disabled={isLoading || !title || !description}
        className="w-full px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 rounded text-white text-sm font-medium">
        + Create Task
      </button>
    </form>
  );
}

function EventLog({ events }: { events: HQEvent[] }) {
  const colors: Record<string, string> = { debug: '#6b7280', info: '#3b82f6', warn: '#f59e0b', error: '#ef4444' };
  return (
    <div className="space-y-1 max-h-96 overflow-y-auto">
      {events.map((event) => (
        <div key={event.id} className="text-xs p-2 bg-gray-800 rounded border-l-2" style={{ borderColor: colors[event.severity] || '#6b7280' }}>
          <div className="flex justify-between text-gray-500">
            <span>{event.type}</span>
            <span>{event.timestamp.toLocaleTimeString()}</span>
          </div>
          <div className="text-gray-300 mt-1">{event.message}</div>
        </div>
      ))}
    </div>
  );
}

function MetricsPanel({ metrics }: { metrics: HQState['metrics'] }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="bg-gray-800 rounded-lg p-4 text-center">
        <div className="text-2xl font-bold text-blue-400">{metrics.totalAgents}</div>
        <div className="text-xs text-gray-400">Agents</div>
        <div className="text-xs text-green-400">{metrics.activeAgents} active</div>
      </div>
      <div className="bg-gray-800 rounded-lg p-4 text-center">
        <div className="text-2xl font-bold text-green-400">{metrics.completedTasks}</div>
        <div className="text-xs text-gray-400">Completed</div>
        <div className="text-xs text-yellow-400">{metrics.pendingTasks} pending</div>
      </div>
      <div className="bg-gray-800 rounded-lg p-4 text-center">
        <div className="text-2xl font-bold text-red-400">{metrics.failedTasks}</div>
        <div className="text-xs text-gray-400">Failed</div>
      </div>
    </div>
  );
}

export default function TrustBotHeadquarters() {
  const { state, error, isLoading, isConnected, runTick, createRootAgent, createWorkerAgent, createTask, reset } = useTrustBotState(TRUSTBOT_CONFIG);
  const [autoTick, setAutoTick] = useState(false);
  useAutoTick(runTick, { enabled: autoTick, interval: 2000 });

  if (!state) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">{error ? `Error: ${error}` : 'Connecting to TrustBot...'}</div>
      </div>
    );
  }

  const hasRootAgent = state.agents.some(a => a.tier === 5);
  const rootAgent = state.agents.find(a => a.tier === 5);
  const pendingTasks = state.tasks.filter(t => t.status === 'pending');
  const activeTasks = state.tasks.filter(t => t.status === 'in_progress' || t.status === 'assigned');
  const completedTasks = state.tasks.filter(t => t.status === 'completed').slice(-5).reverse();

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">🤖 TrustBot Headquarters</h1>
            <p className="text-gray-400 text-sm">Tick: {state.tick} | Last updated: {state.lastUpdated.toLocaleTimeString()}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm text-gray-400">{isConnected ? 'Live' : 'Disconnected'}</span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={autoTick} onChange={(e) => setAutoTick(e.target.checked)} className="w-4 h-4 rounded" />
              <span className="text-sm">Auto-tick</span>
            </label>
            <button onClick={reset} className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm">Reset</button>
          </div>
        </div>
      </header>

      <div className="px-6 py-4"><MetricsPanel metrics={state.metrics} /></div>

      <div className="p-6 grid grid-cols-12 gap-6">
        <div className="col-span-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Agents ({state.agents.length})</h2>
            <div className="flex gap-2">
              {!hasRootAgent && <button onClick={createRootAgent} disabled={isLoading} className="px-3 py-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 rounded text-sm">+ Root</button>}
              {rootAgent && <button onClick={() => createWorkerAgent(rootAgent.id)} disabled={isLoading} className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded text-sm">+ Worker</button>}
            </div>
          </div>
          <div className="space-y-3">
            {state.agents.length === 0 ? <p className="text-gray-500 text-sm">No agents yet.</p> : state.agents.map(agent => <AgentCard key={agent.id} agent={agent} />)}
          </div>
        </div>

        <div className="col-span-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Tasks</h2>
            <button onClick={runTick} disabled={isLoading} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded text-sm font-medium">{isLoading ? '...' : '▶ Run Tick'}</button>
          </div>
          {hasRootAgent && <TaskCreator onCreate={createTask} isLoading={isLoading} />}
          {pendingTasks.length > 0 && <div><h3 className="text-sm text-gray-400 mb-2">Pending ({pendingTasks.length})</h3><div className="space-y-2">{pendingTasks.map(t => <TaskCard key={t.id} task={t} />)}</div></div>}
          {activeTasks.length > 0 && <div><h3 className="text-sm text-yellow-400 mb-2">Active ({activeTasks.length})</h3><div className="space-y-2">{activeTasks.map(t => <TaskCard key={t.id} task={t} />)}</div></div>}
          {completedTasks.length > 0 && <div><h3 className="text-sm text-green-400 mb-2">Recent Completed</h3><div className="space-y-2">{completedTasks.map(t => <TaskCard key={t.id} task={t} />)}</div></div>}
        </div>

        <div className="col-span-4 space-y-4">
          <h2 className="text-lg font-semibold">Event Log</h2>
          <EventLog events={state.events} />
        </div>
      </div>
    </div>
  );
}
