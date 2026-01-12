'use client';

/**
 * Agent Collaboration Dashboard
 *
 * Displays the BAI Operational Philosophy in action:
 * - Excellence Cycles (FIND→FIX→IMPLEMENT→CHANGE→ITERATE→SUCCEED)
 * - Agent-to-Agent Collaborations
 * - Proactive Actions Feed
 * - Consensus Requests
 */

import { useState, useEffect } from 'react';
import {
  Users,
  Lightbulb,
  Trophy,
  ArrowRight,
  Loader2,
  RefreshCw,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { ExcellenceCycleTracker, CollaborationPanel, ProactiveActionsFeed } from '@/components/collaboration';

interface CollaborationStats {
  activeCollaborations: number;
  completedToday: number;
  pendingConsensus: number;
  proactiveActionsToday: number;
  activeCycles: number;
  successRate: number;
}

export default function CollaborationPage() {
  const [stats, setStats] = useState<CollaborationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      // In production, this would fetch from /api/v1/collaboration/stats
      // For now, use mock data
      setStats({
        activeCollaborations: 3,
        completedToday: 12,
        pendingConsensus: 2,
        proactiveActionsToday: 28,
        activeCycles: 5,
        successRate: 0.89,
      });
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Users className="h-8 w-8 text-purple-600" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Agent Collaboration
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl">
            BAI Operational Philosophy in action. Proactive agents finding opportunities,
            collaborating on solutions, and iterating to excellence.
          </p>
        </div>

        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-purple-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400">Active</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.activeCollaborations}
              </div>
              <div className="text-xs text-gray-500">collaborations</div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400">Today</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.completedToday}
              </div>
              <div className="text-xs text-gray-500">completed</div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-orange-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400">Pending</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.pendingConsensus}
              </div>
              <div className="text-xs text-gray-500">consensus</div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400">Proactive</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.proactiveActionsToday}
              </div>
              <div className="text-xs text-gray-500">actions today</div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw className="h-4 w-4 text-indigo-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400">Cycles</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.activeCycles}
              </div>
              <div className="text-xs text-gray-500">active</div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400">Success</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {Math.round(stats.successRate * 100)}%
              </div>
              <div className="text-xs text-gray-500">rate</div>
            </div>
          </div>
        )}

        {/* Excellence Cycle Philosophy */}
        <div className="mb-8">
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-6 text-white">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Trophy className="h-6 w-6" />
              The Excellence Cycle
            </h2>
            <p className="text-purple-100 mb-6">
              Our agents operate according to the BAI Operational Philosophy: proactively identifying
              opportunities, taking immediate action, and iterating until success.
            </p>

            {/* Phase Flow */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              {[
                { phase: 'FIND', desc: 'Identify problems & opportunities' },
                { phase: 'FIX', desc: 'Address issues immediately' },
                { phase: 'IMPLEMENT', desc: 'Complete solutions fully' },
                { phase: 'CHANGE', desc: 'Adapt what\'s not working' },
                { phase: 'ITERATE', desc: 'Continuously improve' },
                { phase: 'SUCCEED', desc: 'Persist through obstacles' },
              ].map((item, index, arr) => (
                <div key={item.phase} className="flex items-center gap-2">
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mb-1">
                      <span className="text-lg font-bold">{item.phase.charAt(0)}</span>
                    </div>
                    <div className="text-sm font-medium">{item.phase}</div>
                    <div className="text-xs text-purple-200 max-w-[100px]">{item.desc}</div>
                  </div>
                  {index < arr.length - 1 && (
                    <ArrowRight className="h-5 w-5 text-purple-300 hidden md:block" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Column - Collaborations & Consensus */}
          <div className="space-y-6">
            <CollaborationPanel agentId={selectedAgentId || ''} showHistory={false} />

            {/* Quick Stats */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                Collaboration Modes
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { mode: 'DELEGATE', desc: 'Hand off entirely', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
                  { mode: 'CONSULT', desc: 'Ask for input', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
                  { mode: 'PARALLEL', desc: 'Work simultaneously', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
                  { mode: 'SEQUENTIAL', desc: 'Chain of agents', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
                  { mode: 'CONSENSUS', desc: 'Must agree', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
                ].map((item) => (
                  <div
                    key={item.mode}
                    className={`p-3 rounded-lg ${item.color}`}
                  >
                    <div className="font-medium text-sm">{item.mode}</div>
                    <div className="text-xs opacity-75">{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - Proactive Actions */}
          <div className="space-y-6">
            <ProactiveActionsFeed limit={15} showFilters={true} />
          </div>
        </div>

        {/* Proactive Behaviors Legend */}
        <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
            Proactive Behaviors
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Agents don't wait to be asked. They actively identify opportunities and take action.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { behavior: 'ANTICIPATE', desc: 'Predict needs before they arise', icon: '💡' },
              { behavior: 'ANALYZE', desc: 'Deep dive into problems', icon: '🔍' },
              { behavior: 'DELEGATE', desc: 'Route to better-suited agents', icon: '➡️' },
              { behavior: 'ESCALATE', desc: 'Flag for human attention', icon: '⚠️' },
              { behavior: 'ITERATE', desc: 'Refine until excellent', icon: '🔄' },
              { behavior: 'COLLABORATE', desc: 'Team up for complex tasks', icon: '👥' },
              { behavior: 'MONITOR', desc: 'Watch for changes', icon: '👁️' },
              { behavior: 'SUGGEST', desc: 'Recommend improvements', icon: '💬' },
            ].map((item) => (
              <div
                key={item.behavior}
                className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span>{item.icon}</span>
                  <span className="font-medium text-sm text-gray-900 dark:text-white">
                    {item.behavior}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
