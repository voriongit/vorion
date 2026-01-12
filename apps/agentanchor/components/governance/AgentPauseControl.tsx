'use client';

/**
 * Agent Pause/Resume Control Component
 *
 * Epic 16, Story 16-1: Agent Pause/Resume
 *
 * Provides controls for pausing and resuming individual agents.
 * Used on agent detail pages and in agent management interfaces.
 */

import { useState } from 'react';
import {
  Pause,
  Play,
  Loader2,
  AlertTriangle,
  Clock,
  User,
  FileText
} from 'lucide-react';

interface AgentPauseState {
  agentId: string;
  isPaused: boolean;
  pauseReason?: string;
  pausedAt?: string;
  pausedBy?: string;
  pauseNotes?: string;
  pauseExpiresAt?: string;
}

interface AgentPauseControlProps {
  agentId: string;
  agentName?: string;
  initialPauseState?: AgentPauseState;
  onPauseChange?: (isPaused: boolean) => void;
  compact?: boolean;
}

const PAUSE_REASONS = [
  { value: 'maintenance', label: 'Maintenance', description: 'Routine maintenance or updates' },
  { value: 'consumer_request', label: 'Consumer Request', description: 'Paused by consumer/user request' },
  { value: 'investigation', label: 'Investigation', description: 'Under investigation (blocks resume)' },
  { value: 'circuit_breaker', label: 'Circuit Breaker', description: 'Auto-triggered by system' },
  { value: 'other', label: 'Other', description: 'Other reason (requires notes)' },
];

export function AgentPauseControl({
  agentId,
  agentName,
  initialPauseState,
  onPauseChange,
  compact = false,
}: AgentPauseControlProps) {
  const [pauseState, setPauseState] = useState<AgentPauseState | null>(initialPauseState || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [pauseReason, setPauseReason] = useState('maintenance');
  const [pauseNotes, setPauseNotes] = useState('');
  const [pauseExpiry, setPauseExpiry] = useState('');
  const [cascadeToDependent, setCascadeToDependent] = useState(false);

  const handlePause = async () => {
    if (pauseReason === 'other' && !pauseNotes.trim()) {
      setError('Notes are required when selecting "Other" as the reason');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/v1/agents/${agentId}/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: pauseReason,
          notes: pauseNotes || undefined,
          expiresAt: pauseExpiry || undefined,
          cascadeToDependent,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to pause agent');
      }

      setPauseState({
        agentId,
        isPaused: true,
        pauseReason,
        pausedAt: new Date().toISOString(),
        pauseNotes: pauseNotes || undefined,
        pauseExpiresAt: pauseExpiry || undefined,
      });

      setShowPauseModal(false);
      setPauseNotes('');
      setPauseExpiry('');
      onPauseChange?.(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pause agent');
    } finally {
      setLoading(false);
    }
  };

  const handleResume = async () => {
    if (pauseState?.pauseReason === 'investigation') {
      setError('Agents paused for investigation cannot be resumed. Contact admin.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/v1/agents/${agentId}/pause`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to resume agent');
      }

      setPauseState(null);
      onPauseChange?.(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resume agent');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Compact view for inline display
  if (compact) {
    return (
      <div className="inline-flex items-center gap-2">
        {pauseState?.isPaused ? (
          <>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
              <Pause className="h-3 w-3" />
              Paused
            </span>
            <button
              onClick={handleResume}
              disabled={loading || pauseState.pauseReason === 'investigation'}
              className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition disabled:opacity-50"
              title="Resume agent"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </button>
          </>
        ) : (
          <>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
              <Play className="h-3 w-3" />
              Active
            </span>
            <button
              onClick={() => setShowPauseModal(true)}
              disabled={loading}
              className="p-1.5 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition disabled:opacity-50"
              title="Pause agent"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Pause className="h-4 w-4" />
              )}
            </button>
          </>
        )}

        {/* Inline Pause Modal */}
        {showPauseModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                Pause {agentName || 'Agent'}?
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Reason
                  </label>
                  <select
                    value={pauseReason}
                    onChange={(e) => setPauseReason(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {PAUSE_REASONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Notes {pauseReason === 'other' && <span className="text-red-500">*</span>}
                  </label>
                  <textarea
                    value={pauseNotes}
                    onChange={(e) => setPauseNotes(e.target.value)}
                    placeholder="Additional details..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    rows={2}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Auto-resume after (optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={pauseExpiry}
                    onChange={(e) => setPauseExpiry(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={cascadeToDependent}
                    onChange={(e) => setCascadeToDependent(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  Also pause dependent agents (cascade halt)
                </label>
              </div>

              {error && (
                <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowPauseModal(false);
                    setError(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePause}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Pause className="h-4 w-4" />
                  )}
                  Pause Agent
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full view with details
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold text-gray-900 dark:text-white">
          Agent Status
        </h4>
        {pauseState?.isPaused ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
            <Pause className="h-4 w-4" />
            Paused
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <Play className="h-4 w-4" />
            Active
          </span>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}

      {pauseState?.isPaused ? (
        <div className="space-y-3">
          <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
            {pauseState.pauseReason && (
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span>Reason: {pauseState.pauseReason.replace(/_/g, ' ')}</span>
              </div>
            )}
            {pauseState.pausedAt && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>Since: {formatDate(pauseState.pausedAt)}</span>
              </div>
            )}
            {pauseState.pauseExpiresAt && (
              <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                <Clock className="h-4 w-4" />
                <span>Expires: {formatDate(pauseState.pauseExpiresAt)}</span>
              </div>
            )}
            {pauseState.pauseNotes && (
              <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded text-xs">
                {pauseState.pauseNotes}
              </div>
            )}
          </div>

          <button
            onClick={handleResume}
            disabled={loading || pauseState.pauseReason === 'investigation'}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Resume Agent
          </button>

          {pauseState.pauseReason === 'investigation' && (
            <p className="text-xs text-red-600 dark:text-red-400 text-center">
              Agents under investigation cannot be self-resumed
            </p>
          )}
        </div>
      ) : (
        <button
          onClick={() => setShowPauseModal(true)}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Pause className="h-4 w-4" />
          )}
          Pause Agent
        </button>
      )}

      {/* Pause Modal */}
      {showPauseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Pause {agentName || 'Agent'}?
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Reason
                </label>
                <select
                  value={pauseReason}
                  onChange={(e) => setPauseReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {PAUSE_REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {PAUSE_REASONS.find(r => r.value === pauseReason)?.description}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes {pauseReason === 'other' && <span className="text-red-500">*</span>}
                </label>
                <textarea
                  value={pauseNotes}
                  onChange={(e) => setPauseNotes(e.target.value)}
                  placeholder="Additional details about this pause..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Auto-resume after (optional)
                </label>
                <input
                  type="datetime-local"
                  value={pauseExpiry}
                  onChange={(e) => setPauseExpiry(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave empty for indefinite pause
                </p>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={cascadeToDependent}
                  onChange={(e) => setCascadeToDependent(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Also pause dependent agents (cascade halt)
              </label>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowPauseModal(false);
                  setError(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={handlePause}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Pause className="h-4 w-4" />
                )}
                Pause Agent
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AgentPauseControl;
