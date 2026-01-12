'use client';

/**
 * Excellence Cycle Tracker Component
 *
 * Visualizes the BAI Operational Philosophy cycle:
 * FIND → FIX → IMPLEMENT → CHANGE → ITERATE → SUCCEED
 */

import { useState, useEffect } from 'react';
import {
  Search,
  Wrench,
  Rocket,
  RefreshCw,
  RotateCcw,
  Trophy,
  Loader2,
  ChevronRight,
  CheckCircle,
  Circle,
  Play,
} from 'lucide-react';

interface ExcellenceCycle {
  id: string;
  agentId: string;
  phase: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  itemsFound: number;
  issuesFixed: number;
  featuresImplemented: number;
  changesApplied: number;
  iterationsCompleted: number;
  successRate?: number;
  status: string;
  startedAt: Date;
  completedAt?: Date;
  nextPhase?: string;
}

interface ExcellenceCycleTrackerProps {
  agentId: string;
  onStartCycle?: () => void;
  onAdvanceCycle?: (cycleId: string) => void;
  compact?: boolean;
}

const PHASES = [
  { id: 'FIND', label: 'Find', icon: Search, color: 'text-blue-500', bgColor: 'bg-blue-100 dark:bg-blue-900/30', description: 'Identify problems & opportunities' },
  { id: 'FIX', label: 'Fix', icon: Wrench, color: 'text-orange-500', bgColor: 'bg-orange-100 dark:bg-orange-900/30', description: 'Address issues immediately' },
  { id: 'IMPLEMENT', label: 'Implement', icon: Rocket, color: 'text-green-500', bgColor: 'bg-green-100 dark:bg-green-900/30', description: 'Complete solutions fully' },
  { id: 'CHANGE', label: 'Change', icon: RefreshCw, color: 'text-purple-500', bgColor: 'bg-purple-100 dark:bg-purple-900/30', description: 'Adapt what\'s not working' },
  { id: 'ITERATE', label: 'Iterate', icon: RotateCcw, color: 'text-indigo-500', bgColor: 'bg-indigo-100 dark:bg-indigo-900/30', description: 'Continuously improve' },
  { id: 'SUCCEED', label: 'Succeed', icon: Trophy, color: 'text-amber-500', bgColor: 'bg-amber-100 dark:bg-amber-900/30', description: 'Persist through obstacles' },
];

export function ExcellenceCycleTracker({
  agentId,
  onStartCycle,
  onAdvanceCycle,
  compact = false,
}: ExcellenceCycleTrackerProps) {
  const [cycle, setCycle] = useState<ExcellenceCycle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadActiveCycle();
  }, [agentId]);

  const loadActiveCycle = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/collaboration/cycles?agentId=${agentId}&active=true`);
      const data = await res.json();

      if (res.ok) {
        setCycle(data.cycle || null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cycle');
    } finally {
      setLoading(false);
    }
  };

  const handleStartCycle = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/collaboration/cycles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId }),
      });

      if (res.ok) {
        loadActiveCycle();
        onStartCycle?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start cycle');
    } finally {
      setLoading(false);
    }
  };

  const handleAdvance = async () => {
    if (!cycle) return;

    try {
      setLoading(true);
      const res = await fetch(`/api/v1/collaboration/cycles/${cycle.id}/advance`, {
        method: 'POST',
      });

      if (res.ok) {
        loadActiveCycle();
        onAdvanceCycle?.(cycle.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to advance cycle');
    } finally {
      setLoading(false);
    }
  };

  const getCurrentPhaseIndex = () => {
    if (!cycle) return -1;
    return PHASES.findIndex(p => p.id === cycle.phase);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
      </div>
    );
  }

  // Compact view
  if (compact) {
    const currentIndex = getCurrentPhaseIndex();

    return (
      <div className="flex items-center gap-1">
        {PHASES.map((phase, index) => {
          const Icon = phase.icon;
          const isComplete = cycle && index < currentIndex;
          const isCurrent = cycle && index === currentIndex;

          return (
            <div
              key={phase.id}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition ${
                isComplete
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : isCurrent
                  ? `${phase.bgColor} ${phase.color}`
                  : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500'
              }`}
              title={phase.description}
            >
              <Icon className="h-3 w-3" />
              {isCurrent && <span>{phase.label}</span>}
            </div>
          );
        })}
      </div>
    );
  }

  // Full view
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Excellence Cycle
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {cycle ? `Phase: ${cycle.phase}` : 'No active cycle'}
          </p>
        </div>
        {!cycle ? (
          <button
            onClick={handleStartCycle}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition"
          >
            <Play className="h-4 w-4" />
            Start Cycle
          </button>
        ) : cycle.status === 'active' && (
          <button
            onClick={handleAdvance}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition"
          >
            <ChevronRight className="h-4 w-4" />
            Advance
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Phase Timeline */}
      <div className="relative">
        {/* Progress Line */}
        <div className="absolute top-6 left-6 right-6 h-0.5 bg-gray-200 dark:bg-gray-700" />
        {cycle && (
          <div
            className="absolute top-6 left-6 h-0.5 bg-green-500 transition-all duration-500"
            style={{ width: `${(getCurrentPhaseIndex() / (PHASES.length - 1)) * 100}%` }}
          />
        )}

        {/* Phases */}
        <div className="relative flex justify-between">
          {PHASES.map((phase, index) => {
            const Icon = phase.icon;
            const currentIndex = getCurrentPhaseIndex();
            const isComplete = cycle && index < currentIndex;
            const isCurrent = cycle && index === currentIndex;

            return (
              <div key={phase.id} className="flex flex-col items-center">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                    isComplete
                      ? 'bg-green-500 text-white'
                      : isCurrent
                      ? `${phase.bgColor} ${phase.color} ring-2 ring-offset-2 ring-purple-500 dark:ring-offset-gray-800`
                      : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
                  }`}
                >
                  {isComplete ? (
                    <CheckCircle className="h-6 w-6" />
                  ) : (
                    <Icon className="h-6 w-6" />
                  )}
                </div>
                <span className={`mt-2 text-sm font-medium ${
                  isCurrent ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {phase.label}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500 text-center max-w-[80px] mt-1">
                  {phase.description}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Metrics */}
      {cycle && (
        <div className="mt-8 grid grid-cols-3 md:grid-cols-6 gap-4">
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {cycle.itemsFound}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Found</div>
          </div>
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {cycle.issuesFixed}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Fixed</div>
          </div>
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {cycle.featuresImplemented}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Implemented</div>
          </div>
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {cycle.changesApplied}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Changed</div>
          </div>
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {cycle.iterationsCompleted}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Iterations</div>
          </div>
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {cycle.successRate ? `${Math.round(cycle.successRate * 100)}%` : '-'}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Success</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ExcellenceCycleTracker;
