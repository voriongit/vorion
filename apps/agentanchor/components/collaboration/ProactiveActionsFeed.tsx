'use client';

/**
 * Proactive Actions Feed Component
 *
 * Displays proactive behaviors taken by agents:
 * ANTICIPATE, ANALYZE, DELEGATE, ESCALATE, ITERATE, COLLABORATE, MONITOR, SUGGEST
 */

import { useState, useEffect } from 'react';
import {
  Lightbulb,
  Search,
  ArrowRight,
  AlertTriangle,
  RotateCcw,
  Users,
  Eye,
  MessageSquare,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ProactiveAction {
  id: string;
  agentId: string;
  agentName?: string;
  behavior: string;
  triggerEvent: string;
  analysis?: string;
  recommendation: string;
  actionSteps: Array<{
    order: number;
    description: string;
    status: string;
    result?: string;
  }>;
  delegatedTo?: string;
  delegatedToName?: string;
  priority: string;
  confidence?: number;
  status: string;
  outcome?: string;
  success?: boolean;
  createdAt: string;
}

interface ProactiveActionsFeedProps {
  agentId?: string;
  limit?: number;
  showFilters?: boolean;
}

const BEHAVIOR_CONFIG: Record<string, { icon: any; label: string; color: string; bgColor: string }> = {
  ANTICIPATE: { icon: Lightbulb, label: 'Anticipate', color: 'text-amber-500', bgColor: 'bg-amber-100 dark:bg-amber-900/30' },
  ANALYZE: { icon: Search, label: 'Analyze', color: 'text-blue-500', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  DELEGATE: { icon: ArrowRight, label: 'Delegate', color: 'text-purple-500', bgColor: 'bg-purple-100 dark:bg-purple-900/30' },
  ESCALATE: { icon: AlertTriangle, label: 'Escalate', color: 'text-red-500', bgColor: 'bg-red-100 dark:bg-red-900/30' },
  ITERATE: { icon: RotateCcw, label: 'Iterate', color: 'text-indigo-500', bgColor: 'bg-indigo-100 dark:bg-indigo-900/30' },
  COLLABORATE: { icon: Users, label: 'Collaborate', color: 'text-green-500', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  MONITOR: { icon: Eye, label: 'Monitor', color: 'text-cyan-500', bgColor: 'bg-cyan-100 dark:bg-cyan-900/30' },
  SUGGEST: { icon: MessageSquare, label: 'Suggest', color: 'text-pink-500', bgColor: 'bg-pink-100 dark:bg-pink-900/30' },
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-gray-500',
  medium: 'text-blue-500',
  high: 'text-orange-500',
  critical: 'text-red-500',
};

export function ProactiveActionsFeed({
  agentId,
  limit = 10,
  showFilters = true,
}: ProactiveActionsFeedProps) {
  const [actions, setActions] = useState<ProactiveAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBehavior, setSelectedBehavior] = useState<string | null>(null);
  const [expandedAction, setExpandedAction] = useState<string | null>(null);

  useEffect(() => {
    loadActions();
  }, [agentId, selectedBehavior]);

  const loadActions = async () => {
    try {
      setLoading(true);
      setError(null);

      let url = `/api/v1/collaboration/proactive?limit=${limit}`;
      if (agentId) url += `&agentId=${agentId}`;
      if (selectedBehavior) url += `&behavior=${selectedBehavior}`;

      const res = await fetch(url);
      const data = await res.json();

      if (res.ok) {
        setActions(data.actions || []);
      } else {
        setError(data.error || 'Failed to load actions');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusIcon = (status: string, success?: boolean) => {
    switch (status) {
      case 'completed':
        return success ? (
          <CheckCircle className="h-4 w-4 text-green-500" />
        ) : (
          <XCircle className="h-4 w-4 text-red-500" />
        );
      case 'in_progress':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Proactive Actions
            </h3>
          </div>
          {showFilters && (
            <select
              value={selectedBehavior || ''}
              onChange={(e) => setSelectedBehavior(e.target.value || null)}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">All behaviors</option>
              {Object.entries(BEHAVIOR_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {error && (
        <div className="m-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
        </div>
      ) : actions.length === 0 ? (
        <div className="text-center py-8">
          <Lightbulb className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 dark:text-gray-400">No proactive actions yet</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            Actions will appear as agents identify opportunities
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {actions.map((action) => {
            const behaviorConfig = BEHAVIOR_CONFIG[action.behavior] || BEHAVIOR_CONFIG.SUGGEST;
            const BehaviorIcon = behaviorConfig.icon;
            const isExpanded = expandedAction === action.id;

            return (
              <div key={action.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                <div
                  className="flex items-start gap-3 cursor-pointer"
                  onClick={() => setExpandedAction(isExpanded ? null : action.id)}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${behaviorConfig.bgColor}`}>
                    <BehaviorIcon className={`h-5 w-5 ${behaviorConfig.color}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-medium ${behaviorConfig.color}`}>
                        {behaviorConfig.label}
                      </span>
                      <span className={`text-xs ${PRIORITY_COLORS[action.priority]}`}>
                        {action.priority}
                      </span>
                      {action.confidence !== undefined && (
                        <span className="text-xs text-gray-400">
                          {Math.round(action.confidence * 100)}% confident
                        </span>
                      )}
                    </div>

                    <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                      {action.recommendation}
                    </p>

                    <p className="text-xs text-gray-500 dark:text-gray-500 line-clamp-1">
                      Trigger: {action.triggerEvent}
                    </p>

                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      {getStatusIcon(action.status, action.success)}
                      <span>{action.status}</span>
                      <span>{formatDate(action.createdAt)}</span>
                      {action.delegatedToName && (
                        <span className="flex items-center gap-1">
                          <ArrowRight className="h-3 w-3" />
                          {action.delegatedToName}
                        </span>
                      )}
                    </div>
                  </div>

                  <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </button>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="mt-4 ml-13 pl-4 border-l-2 border-gray-200 dark:border-gray-600">
                    {action.analysis && (
                      <div className="mb-3">
                        <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Analysis</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{action.analysis}</p>
                      </div>
                    )}

                    {action.actionSteps && action.actionSteps.length > 0 && (
                      <div className="mb-3">
                        <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Action Steps</h4>
                        <div className="space-y-2">
                          {action.actionSteps.map((step, index) => (
                            <div key={index} className="flex items-start gap-2">
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium ${
                                step.status === 'completed'
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                  : step.status === 'in_progress'
                                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                  : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                              }`}>
                                {step.order}
                              </div>
                              <div className="flex-1">
                                <p className="text-sm text-gray-700 dark:text-gray-300">{step.description}</p>
                                {step.result && (
                                  <p className="text-xs text-gray-500 mt-0.5">{step.result}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {action.outcome && (
                      <div className="mb-3">
                        <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Outcome</h4>
                        <p className={`text-sm ${action.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {action.outcome}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ProactiveActionsFeed;
