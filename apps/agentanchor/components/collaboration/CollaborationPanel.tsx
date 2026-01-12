'use client';

/**
 * Collaboration Panel Component
 *
 * Displays active collaborations, consensus requests, and collaboration history.
 */

import { useState, useEffect } from 'react';
import {
  Users,
  GitBranch,
  Vote,
  MessageSquare,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  ChevronRight,
  ArrowRight,
  UserPlus,
  GitMerge,
  Layers,
} from 'lucide-react';

interface Collaboration {
  id: string;
  initiatorId: string;
  initiatorName?: string;
  targetId?: string;
  targetName?: string;
  mode: string;
  taskType: string;
  taskDescription?: string;
  urgency: string;
  status: string;
  createdAt: string;
}

interface Consensus {
  id: string;
  initiatorId: string;
  question: string;
  participants: string[];
  requiredAgreement: number;
  status: string;
  agreementRate?: number;
  createdAt: string;
}

interface CollaborationPanelProps {
  agentId: string;
  showHistory?: boolean;
}

const MODE_CONFIG: Record<string, { icon: any; label: string; color: string }> = {
  DELEGATE: { icon: ArrowRight, label: 'Delegate', color: 'text-blue-500' },
  CONSULT: { icon: MessageSquare, label: 'Consult', color: 'text-green-500' },
  PARALLEL: { icon: Layers, label: 'Parallel', color: 'text-purple-500' },
  SEQUENTIAL: { icon: GitBranch, label: 'Sequential', color: 'text-orange-500' },
  CONSENSUS: { icon: Vote, label: 'Consensus', color: 'text-indigo-500' },
};

const URGENCY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  medium: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  high: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
  critical: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
};

const STATUS_CONFIG: Record<string, { icon: any; color: string }> = {
  pending: { icon: Clock, color: 'text-gray-500' },
  active: { icon: Loader2, color: 'text-blue-500' },
  completed: { icon: CheckCircle, color: 'text-green-500' },
  failed: { icon: XCircle, color: 'text-red-500' },
  cancelled: { icon: XCircle, color: 'text-gray-400' },
  voting: { icon: Vote, color: 'text-purple-500' },
  consensus_reached: { icon: CheckCircle, color: 'text-green-500' },
  no_consensus: { icon: XCircle, color: 'text-red-500' },
};

export function CollaborationPanel({
  agentId,
  showHistory = false,
}: CollaborationPanelProps) {
  const [collaborations, setCollaborations] = useState<Collaboration[]>([]);
  const [consensusRequests, setConsensusRequests] = useState<Consensus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'collaborations' | 'consensus'>('collaborations');

  useEffect(() => {
    loadData();
  }, [agentId, showHistory]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const status = showHistory ? '' : '&status=active';

      const [collabRes, consensusRes] = await Promise.all([
        fetch(`/api/v1/collaboration/collaborations?agentId=${agentId}${status}&limit=10`),
        fetch(`/api/v1/collaboration/consensus?agentId=${agentId}${status}&limit=10`),
      ]);

      if (collabRes.ok) {
        const data = await collabRes.json();
        setCollaborations(data.collaborations || []);
      }

      if (consensusRes.ok) {
        const data = await consensusRes.json();
        setConsensusRequests(data.consensus || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
      {/* Header with Tabs */}
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-4">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('collaborations')}
            className={`py-4 px-2 border-b-2 font-medium text-sm transition ${
              activeTab === 'collaborations'
                ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Collaborations
              {collaborations.length > 0 && (
                <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full text-xs">
                  {collaborations.length}
                </span>
              )}
            </div>
          </button>
          <button
            onClick={() => setActiveTab('consensus')}
            className={`py-4 px-2 border-b-2 font-medium text-sm transition ${
              activeTab === 'consensus'
                ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Vote className="h-4 w-4" />
              Consensus
              {consensusRequests.length > 0 && (
                <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full text-xs">
                  {consensusRequests.length}
                </span>
              )}
            </div>
          </button>
        </div>
      </div>

      {error && (
        <div className="m-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {activeTab === 'collaborations' ? (
          collaborations.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No active collaborations</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                Collaborations will appear when agents work together
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {collaborations.map((collab) => {
                const modeConfig = MODE_CONFIG[collab.mode] || MODE_CONFIG.DELEGATE;
                const ModeIcon = modeConfig.icon;
                const statusConfig = STATUS_CONFIG[collab.status] || STATUS_CONFIG.pending;
                const StatusIcon = statusConfig.icon;

                return (
                  <div
                    key={collab.id}
                    className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <ModeIcon className={`h-4 w-4 ${modeConfig.color}`} />
                          <span className="font-medium text-gray-900 dark:text-white">
                            {collab.taskType}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${URGENCY_COLORS[collab.urgency]}`}>
                            {collab.urgency}
                          </span>
                        </div>
                        {collab.taskDescription && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                            {collab.taskDescription}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-500">
                          <span className="flex items-center gap-1">
                            <StatusIcon className={`h-3 w-3 ${statusConfig.color} ${collab.status === 'active' ? 'animate-spin' : ''}`} />
                            {collab.status}
                          </span>
                          <span>{formatDate(collab.createdAt)}</span>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          consensusRequests.length === 0 ? (
            <div className="text-center py-8">
              <Vote className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No consensus requests</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                Multi-agent decisions will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {consensusRequests.map((consensus) => {
                const statusConfig = STATUS_CONFIG[consensus.status] || STATUS_CONFIG.voting;
                const StatusIcon = statusConfig.icon;

                return (
                  <div
                    key={consensus.id}
                    className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Vote className="h-4 w-4 text-indigo-500" />
                          <span className="font-medium text-gray-900 dark:text-white">
                            Consensus Request
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                          {consensus.question}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-500">
                          <span className="flex items-center gap-1">
                            <StatusIcon className={`h-3 w-3 ${statusConfig.color}`} />
                            {consensus.status.replace(/_/g, ' ')}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {consensus.participants.length} participants
                          </span>
                          {consensus.agreementRate !== undefined && (
                            <span className={consensus.agreementRate >= consensus.requiredAgreement ? 'text-green-600' : 'text-red-600'}>
                              {Math.round(consensus.agreementRate * 100)}% agreement
                            </span>
                          )}
                          <span>{formatDate(consensus.createdAt)}</span>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default CollaborationPanel;
