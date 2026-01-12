'use client';

/**
 * Decision History Component
 * Displays bot decisions with reasoning and user responses
 */

import { useEffect, useState } from 'react';

interface Decision {
  id: string;
  decision_type: string;
  action_taken: string;
  reasoning?: string;
  confidence_score: number;
  risk_level: string;
  user_response?: string;
  created_at: string;
  alternatives_considered?: Array<{
    alternative: string;
    rejected_reason: string;
  }>;
}

interface DecisionHistoryProps {
  botId: string;
  limit?: number;
}

export default function DecisionHistory({ botId, limit = 50 }: DecisionHistoryProps) {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDecision, setSelectedDecision] = useState<Decision | null>(null);

  useEffect(() => {
    fetchDecisions();
  }, [botId, limit]);

  const fetchDecisions = async () => {
    try {
      const res = await fetch(`/api/bot-trust/decisions?bot_id=${botId}&limit=${limit}`);
      const data = await res.json();

      if (res.ok) {
        setDecisions(data.decisions || []);
      } else {
        setError(data.error || 'Failed to load decisions');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (risk: string) => {
    const colors: Record<string, string> = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800',
    };
    return colors[risk] || 'bg-gray-100 text-gray-800';
  };

  const getResponseColor = (response?: string) => {
    const colors: Record<string, string> = {
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      modified: 'bg-blue-100 text-blue-800',
    };
    return response ? colors[response] || 'bg-gray-100 text-gray-800' : 'bg-gray-100 text-gray-600';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="animate-pulse p-6">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-200 rounded mb-3"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-red-500 text-sm">{error}</p>
      </div>
    );
  }

  if (decisions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-500 text-sm">No decisions recorded yet</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="divide-y divide-gray-200">
        {decisions.map((decision) => (
          <div
            key={decision.id}
            className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
            onClick={() => setSelectedDecision(decision)}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-gray-900">
                    {decision.action_taken}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getRiskColor(decision.risk_level)}`}>
                    {decision.risk_level}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getResponseColor(decision.user_response)}`}>
                    {decision.user_response || 'pending'}
                  </span>
                </div>

                {decision.reasoning && (
                  <p className="text-sm text-gray-600 mb-2">{decision.reasoning}</p>
                )}

                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>Type: {decision.decision_type}</span>
                  <span>Confidence: {(decision.confidence_score * 100).toFixed(0)}%</span>
                  <span>{new Date(decision.created_at).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Decision Detail Modal */}
      {selectedDecision && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedDecision(null)}
        >
          <div
            className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Decision Details</h3>
                <button
                  onClick={() => setSelectedDecision(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Action</label>
                  <p className="text-gray-900">{selectedDecision.action_taken}</p>
                </div>

                {selectedDecision.reasoning && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Reasoning</label>
                    <p className="text-gray-900">{selectedDecision.reasoning}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Decision Type</label>
                    <p className="text-gray-900 capitalize">{selectedDecision.decision_type}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Risk Level</label>
                    <p className="text-gray-900 capitalize">{selectedDecision.risk_level}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Confidence</label>
                    <p className="text-gray-900">{(selectedDecision.confidence_score * 100).toFixed(1)}%</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">User Response</label>
                    <p className="text-gray-900 capitalize">{selectedDecision.user_response || 'Pending'}</p>
                  </div>
                </div>

                {selectedDecision.alternatives_considered && selectedDecision.alternatives_considered.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 mb-2 block">Alternatives Considered</label>
                    <div className="space-y-2">
                      {selectedDecision.alternatives_considered.map((alt, idx) => (
                        <div key={idx} className="bg-gray-50 rounded p-3">
                          <p className="text-sm font-medium text-gray-900">{alt.alternative}</p>
                          <p className="text-xs text-gray-600 mt-1">Rejected: {alt.rejected_reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-gray-500">Timestamp</label>
                  <p className="text-gray-900">{new Date(selectedDecision.created_at).toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
