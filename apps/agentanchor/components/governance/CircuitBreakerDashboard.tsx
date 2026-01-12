'use client';

/**
 * Circuit Breaker Dashboard Component
 *
 * Epic 16: Circuit Breaker & Kill Switch
 *
 * Provides admin controls for:
 * - Global Kill Switch activation/deactivation
 * - Viewing paused agents
 * - Circuit breaker event history
 */

import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Power,
  PowerOff,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Clock,
  User,
  History,
  RefreshCw,
  Pause,
  Play
} from 'lucide-react';

interface KillSwitchState {
  id: string;
  isActive: boolean;
  activatedAt?: string;
  activatedBy?: string;
  reason?: string;
  scope: string;
  deactivatedAt?: string;
  deactivatedBy?: string;
}

interface PausedAgent {
  agentId: string;
  agentName?: string;
  isPaused: boolean;
  pauseReason?: string;
  pausedAt?: string;
  pausedBy?: string;
  pauseNotes?: string;
  pauseExpiresAt?: string;
}

interface CircuitBreakerEvent {
  id: string;
  agentId: string;
  agentName?: string;
  eventType: string;
  reason?: string;
  notes?: string;
  triggeredBy?: string;
  createdAt: string;
}

export function CircuitBreakerDashboard() {
  const [killSwitchState, setKillSwitchState] = useState<KillSwitchState | null>(null);
  const [pausedAgents, setPausedAgents] = useState<PausedAgent[]>([]);
  const [recentEvents, setRecentEvents] = useState<CircuitBreakerEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [killSwitchReason, setKillSwitchReason] = useState('');
  const [showActivateModal, setShowActivateModal] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [killSwitchRes, pausedRes] = await Promise.all([
        fetch('/api/v1/governance/kill-switch'),
        fetch('/api/v1/circuit-breaker?action=paused'),
      ]);

      if (killSwitchRes.ok) {
        const data = await killSwitchRes.json();
        setKillSwitchState(data.state || null);
      }

      if (pausedRes.ok) {
        const data = await pausedRes.json();
        setPausedAgents(data.agents || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleActivateKillSwitch = async () => {
    if (!killSwitchReason.trim()) {
      setError('Reason is required to activate kill switch');
      return;
    }

    try {
      setActionLoading(true);
      setError(null);

      const res = await fetch('/api/v1/governance/kill-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: killSwitchReason,
          scope: 'all',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to activate kill switch');
      }

      setShowActivateModal(false);
      setKillSwitchReason('');
      loadDashboardData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to activate');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeactivateKillSwitch = async () => {
    if (!confirm('Are you sure you want to deactivate the kill switch? Agents will NOT automatically resume.')) {
      return;
    }

    try {
      setActionLoading(true);
      setError(null);

      const res = await fetch('/api/v1/governance/kill-switch', {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to deactivate kill switch');
      }

      loadDashboardData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deactivate');
    } finally {
      setActionLoading(false);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 text-red-700 dark:text-red-400 rounded-lg flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          {error}
        </div>
      )}

      {/* Kill Switch Status Card */}
      <div className={`rounded-xl border-2 p-6 ${
        killSwitchState?.isActive
          ? 'bg-red-50 dark:bg-red-900/20 border-red-500'
          : 'bg-green-50 dark:bg-green-900/20 border-green-500'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {killSwitchState?.isActive ? (
              <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center animate-pulse">
                <ShieldAlert className="h-8 w-8 text-white" />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center">
                <ShieldCheck className="h-8 w-8 text-white" />
              </div>
            )}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Global Kill Switch
              </h2>
              <p className={`text-lg font-medium ${
                killSwitchState?.isActive
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-green-600 dark:text-green-400'
              }`}>
                {killSwitchState?.isActive ? 'ACTIVE - All Agents Halted' : 'Inactive - Normal Operations'}
              </p>
              {killSwitchState?.isActive && killSwitchState.reason && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Reason: {killSwitchState.reason}
                </p>
              )}
              {killSwitchState?.isActive && killSwitchState.activatedAt && (
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  Activated: {formatDate(killSwitchState.activatedAt)}
                </p>
              )}
            </div>
          </div>

          <div>
            {killSwitchState?.isActive ? (
              <button
                onClick={handleDeactivateKillSwitch}
                disabled={actionLoading}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition disabled:opacity-50"
              >
                {actionLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Power className="h-5 w-5" />
                )}
                Deactivate
              </button>
            ) : (
              <button
                onClick={() => setShowActivateModal(true)}
                disabled={actionLoading}
                className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition disabled:opacity-50"
              >
                {actionLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <PowerOff className="h-5 w-5" />
                )}
                Activate Kill Switch
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Activate Modal */}
      {showActivateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Activate Kill Switch?
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  This will halt ALL agent operations
                </p>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Reason (required)
              </label>
              <textarea
                value={killSwitchReason}
                onChange={(e) => setKillSwitchReason(e.target.value)}
                placeholder="Enter reason for activating kill switch..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                rows={3}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowActivateModal(false);
                  setKillSwitchReason('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleActivateKillSwitch}
                disabled={actionLoading || !killSwitchReason.trim()}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PowerOff className="h-4 w-4" />
                )}
                Activate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
              <Pause className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {pausedAgents.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Paused Agents
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <History className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {recentEvents.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Recent Events
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <button
            onClick={loadDashboardData}
            className="flex items-center gap-3 w-full"
          >
            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <RefreshCw className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="text-left">
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                Refresh Data
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                Click to reload status
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Paused Agents List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Paused Agents
          </h3>
        </div>

        {pausedAgents.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <Play className="h-12 w-12 mx-auto text-green-400 mb-3" />
            <p className="text-gray-600 dark:text-gray-400">
              No agents currently paused
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
              All agents are operating normally
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {pausedAgents.map((agent) => (
              <div key={agent.agentId} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {agent.agentName || agent.agentId.slice(0, 8)}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        agent.pauseReason === 'investigation'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : agent.pauseReason === 'emergency_stop'
                          ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                          : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      }`}>
                        {agent.pauseReason?.replace(/_/g, ' ')}
                      </span>
                    </div>
                    {agent.pauseNotes && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {agent.pauseNotes}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-500">
                      {agent.pausedAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(agent.pausedAt)}
                        </span>
                      )}
                      {agent.pauseExpiresAt && (
                        <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                          <Clock className="h-3 w-3" />
                          Expires: {formatDate(agent.pauseExpiresAt)}
                        </span>
                      )}
                    </div>
                  </div>
                  <button className="px-3 py-1.5 text-sm font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition">
                    Manage
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default CircuitBreakerDashboard;
