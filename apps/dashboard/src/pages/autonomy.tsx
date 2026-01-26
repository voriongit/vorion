/**
 * Autonomy Dashboard
 * Control and monitor autonomous agent operations
 */

import Layout from '../components/Layout';
import { useState } from 'react';
import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';

const fetcher = (url: string) => fetch(url).then(res => res.json());

type AgentMode = 'autonomous' | 'supervised' | 'manual' | 'paused';

const MODE_CONFIG: Record<AgentMode, { label: string; color: string; description: string }> = {
    autonomous: {
        label: 'Autonomous',
        color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        description: 'Works independently, reports results',
    },
    supervised: {
        label: 'Supervised',
        color: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
        description: 'Requests approval before acting',
    },
    manual: {
        label: 'Manual',
        color: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
        description: 'Only acts on explicit commands',
    },
    paused: {
        label: 'Paused',
        color: 'bg-red-500/20 text-red-400 border-red-500/30',
        description: 'Temporarily disabled',
    },
};

const STATUS_INDICATORS = {
    active: { color: 'bg-emerald-500', pulse: true },
    working: { color: 'bg-cyan-500', pulse: true },
    waiting_approval: { color: 'bg-amber-500', pulse: true },
    idle: { color: 'bg-slate-500', pulse: false },
};

export default function Autonomy() {
    const { data, error, mutate } = useSWR('/api/autonomy/status', fetcher, {
        refreshInterval: 5000,
    });
    const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

    const handleModeChange = async (agentId: string, mode: AgentMode) => {
        await fetch('/api/autonomy/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'setMode', agentId, mode }),
        });
        mutate();
    };

    const handleApprove = async (taskId: string) => {
        await fetch('/api/autonomy/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'approve', taskId }),
        });
        mutate();
    };

    const handleReject = async (taskId: string) => {
        await fetch('/api/autonomy/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'reject', taskId }),
        });
        mutate();
    };

    const isLoading = !data && !error;

    return (
        <Layout title="Autonomy">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-600">
                        Autonomous Operations
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Agents work independently and report back to you
                    </p>
                </div>

                {data?.running && (
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                            <div className="relative">
                                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                <motion.div
                                    className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-500"
                                    animate={{ scale: [1, 2], opacity: [0.5, 0] }}
                                    transition={{ duration: 1.5, repeat: Infinity }}
                                />
                            </div>
                            <span className="text-emerald-400 text-sm font-medium">System Active</span>
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-bold text-white">{data?.tasksToday || 0}</div>
                            <div className="text-xs text-slate-500">Tasks Today</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Pending Approvals Alert */}
            {data?.pendingApprovals > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500/20 rounded-lg">
                            <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <div>
                            <div className="text-amber-400 font-medium">{data.pendingApprovals} Pending Approvals</div>
                            <div className="text-sm text-slate-500">Agents are waiting for your approval to proceed</div>
                        </div>
                    </div>
                    <button className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg text-sm font-medium transition-colors">
                        Review All
                    </button>
                </motion.div>
            )}

            {isLoading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-cyan-500 border-t-transparent" />
                </div>
            ) : error ? (
                <div className="text-center text-red-400 py-12">Failed to load autonomy status</div>
            ) : (
                <>
                    {/* Agent Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                        {data.agents.map((agent: any) => {
                            const modeConfig = MODE_CONFIG[agent.mode as AgentMode];
                            const statusConfig = STATUS_INDICATORS[agent.status as keyof typeof STATUS_INDICATORS];

                            return (
                                <motion.div
                                    key={agent.agentId}
                                    layoutId={agent.agentId}
                                    className={`bg-[#0a0a0a] border rounded-xl p-5 cursor-pointer transition-all ${
                                        selectedAgent === agent.agentId
                                            ? 'border-cyan-500/50 ring-1 ring-cyan-500/20'
                                            : 'border-white/5 hover:border-white/10'
                                    }`}
                                    onClick={() => setSelectedAgent(selectedAgent === agent.agentId ? null : agent.agentId)}
                                >
                                    {/* Header */}
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="relative">
                                                <div className={`w-3 h-3 rounded-full ${statusConfig.color}`} />
                                                {statusConfig.pulse && (
                                                    <motion.div
                                                        className={`absolute inset-0 w-3 h-3 rounded-full ${statusConfig.color}`}
                                                        animate={{ scale: [1, 2], opacity: [0.5, 0] }}
                                                        transition={{ duration: 1.5, repeat: Infinity }}
                                                    />
                                                )}
                                            </div>
                                            <span className="font-semibold text-white">{agent.name}</span>
                                        </div>
                                        <span className={`px-2 py-1 text-xs rounded-full border ${modeConfig.color}`}>
                                            {modeConfig.label}
                                        </span>
                                    </div>

                                    {/* Stats */}
                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                        <div className="bg-white/5 rounded-lg p-3">
                                            <div className="text-lg font-bold text-white">{agent.tasksToday}</div>
                                            <div className="text-xs text-slate-500">Tasks Today</div>
                                        </div>
                                        {agent.pendingApprovals > 0 ? (
                                            <div className="bg-amber-500/10 rounded-lg p-3">
                                                <div className="text-lg font-bold text-amber-400">{agent.pendingApprovals}</div>
                                                <div className="text-xs text-slate-500">Pending</div>
                                            </div>
                                        ) : (
                                            <div className="bg-white/5 rounded-lg p-3">
                                                <div className="text-lg font-bold text-emerald-400">Ready</div>
                                                <div className="text-xs text-slate-500">No pending</div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Next Run */}
                                    {agent.nextRun && (
                                        <div className="text-xs text-slate-500">
                                            Next check: {new Date(agent.nextRun).toLocaleTimeString()}
                                        </div>
                                    )}

                                    {/* Expanded Controls */}
                                    <AnimatePresence>
                                        {selectedAgent === agent.agentId && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="mt-4 pt-4 border-t border-white/5"
                                            >
                                                <div className="text-xs text-slate-400 mb-2">Change Mode:</div>
                                                <div className="flex flex-wrap gap-2">
                                                    {(Object.keys(MODE_CONFIG) as AgentMode[]).map(mode => (
                                                        <button
                                                            key={mode}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleModeChange(agent.agentId, mode);
                                                            }}
                                                            className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                                                                agent.mode === mode
                                                                    ? MODE_CONFIG[mode].color
                                                                    : 'border-white/10 text-slate-400 hover:border-white/20'
                                                            }`}
                                                        >
                                                            {MODE_CONFIG[mode].label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            );
                        })}
                    </div>

                    {/* Recent Activity */}
                    <div className="bg-[#0a0a0a] border border-white/5 rounded-xl p-6">
                        <h2 className="text-lg font-semibold text-white mb-4">Recent Activity</h2>
                        <div className="space-y-3">
                            {data.recentActivity.map((activity: any) => (
                                <div
                                    key={activity.id}
                                    className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full ${
                                            activity.status === 'completed' ? 'bg-emerald-500' :
                                            activity.status === 'running' ? 'bg-cyan-500' :
                                            activity.status === 'pending' ? 'bg-amber-500' : 'bg-red-500'
                                        }`} />
                                        <div>
                                            <div className="text-sm text-white">{activity.description}</div>
                                            <div className="text-xs text-slate-500">
                                                {activity.agentId} • {new Date(activity.timestamp).toLocaleTimeString()}
                                            </div>
                                        </div>
                                    </div>

                                    {activity.status === 'pending' && (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleApprove(activity.id)}
                                                className="px-3 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded text-xs font-medium transition-colors"
                                            >
                                                Approve
                                            </button>
                                            <button
                                                onClick={() => handleReject(activity.id)}
                                                className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded text-xs font-medium transition-colors"
                                            >
                                                Reject
                                            </button>
                                        </div>
                                    )}

                                    {activity.status === 'completed' && (
                                        <span className="text-xs text-emerald-400">Completed</span>
                                    )}

                                    {activity.status === 'running' && (
                                        <span className="text-xs text-cyan-400">Running...</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </Layout>
    );
}
