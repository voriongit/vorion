'use client';

/**
 * Audit Log Viewer Component
 * Displays immutable audit trail with chain verification
 */

import { useEffect, useState } from 'react';

interface AuditEntry {
  id: string;
  event_type: string;
  event_data: Record<string, any>;
  user_id?: string;
  created_at: string;
  hash: string;
}

interface AuditVerification {
  valid: boolean;
  total_entries: number;
  first_invalid_entry?: string;
  error?: string;
}

interface AuditLogViewerProps {
  botId: string;
}

export default function AuditLogViewer({ botId }: AuditLogViewerProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [verification, setVerification] = useState<AuditVerification | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);

  useEffect(() => {
    fetchAuditLog();
  }, [botId]);

  const fetchAuditLog = async () => {
    try {
      const res = await fetch(`/api/bot-trust/audit?bot_id=${botId}&limit=100`);
      const data = await res.json();

      if (res.ok) {
        setEntries(data.history || []);
      } else {
        setError(data.error || 'Failed to load audit log');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const verifyChain = async () => {
    setVerifying(true);
    try {
      const res = await fetch(`/api/bot-trust/audit?bot_id=${botId}&verify=true`);
      const data = await res.json();

      if (res.ok) {
        setVerification(data.verification);
      } else {
        setError(data.error || 'Failed to verify chain');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setVerifying(false);
    }
  };

  const exportLog = () => {
    window.open(`/api/bot-trust/audit?bot_id=${botId}&export=true`, '_blank');
  };

  const getEventTypeColor = (eventType: string) => {
    const colors: Record<string, string> = {
      decision_made: 'bg-blue-100 text-blue-800',
      decision_approved: 'bg-green-100 text-green-800',
      decision_rejected: 'bg-red-100 text-red-800',
      decision_modified: 'bg-yellow-100 text-yellow-800',
      autonomy_progressed: 'bg-purple-100 text-purple-800',
      autonomy_demoted: 'bg-orange-100 text-orange-800',
      trust_score_calculated: 'bg-indigo-100 text-indigo-800',
      policy_violation: 'bg-red-100 text-red-800',
      escalation: 'bg-orange-100 text-orange-800',
      bot_created: 'bg-green-100 text-green-800',
    };
    return colors[eventType] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="animate-pulse p-6">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-200 rounded mb-3"></div>
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

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Audit Log</h3>
            <p className="text-sm text-gray-500">
              {entries.length} entries · Cryptographically chained
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={verifyChain}
              disabled={verifying}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {verifying ? 'Verifying...' : 'Verify Chain'}
            </button>
            <button
              onClick={exportLog}
              className="px-4 py-2 bg-gray-600 text-white rounded-md text-sm font-medium hover:bg-gray-700"
            >
              Export
            </button>
          </div>
        </div>

        {/* Verification Result */}
        {verification && (
          <div
            className={`p-4 rounded-md ${
              verification.valid ? 'bg-green-50' : 'bg-red-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`text-2xl ${verification.valid ? 'text-green-600' : 'text-red-600'}`}>
                {verification.valid ? '✓' : '✗'}
              </span>
              <div>
                <p className={`font-medium ${verification.valid ? 'text-green-800' : 'text-red-800'}`}>
                  {verification.valid
                    ? 'Audit chain integrity verified'
                    : 'Audit chain integrity compromised'}
                </p>
                {verification.error && (
                  <p className="text-sm text-red-600 mt-1">{verification.error}</p>
                )}
                <p className="text-sm text-gray-600 mt-1">
                  {verification.total_entries} entries verified
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Audit Entries */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {entries.length === 0 ? (
          <div className="p-6">
            <p className="text-gray-500 text-sm">No audit entries yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => setSelectedEntry(entry)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${getEventTypeColor(
                          entry.event_type
                        )}`}
                      >
                        {entry.event_type.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(entry.created_at).toLocaleString()}
                      </span>
                    </div>

                    <div className="text-sm text-gray-700 mb-1">
                      {formatEventData(entry.event_data)}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span title={entry.hash} className="font-mono">
                        {entry.hash.substring(0, 16)}...
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Entry Detail Modal */}
      {selectedEntry && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedEntry(null)}
        >
          <div
            className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Audit Entry Details</h3>
                <button
                  onClick={() => setSelectedEntry(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Event Type</label>
                  <p className="text-gray-900">{selectedEntry.event_type.replace(/_/g, ' ')}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Event Data</label>
                  <pre className="mt-1 p-3 bg-gray-50 rounded text-xs overflow-x-auto">
                    {JSON.stringify(selectedEntry.event_data, null, 2)}
                  </pre>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Cryptographic Hash</label>
                  <p className="text-xs font-mono text-gray-900 break-all">{selectedEntry.hash}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Timestamp</label>
                  <p className="text-gray-900">{new Date(selectedEntry.created_at).toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatEventData(data: Record<string, any>): string {
  const keys = Object.keys(data);
  if (keys.length === 0) return 'No additional data';
  if (keys.length === 1) return `${keys[0]}: ${data[keys[0]]}`;
  return `${keys.length} data fields`;
}
