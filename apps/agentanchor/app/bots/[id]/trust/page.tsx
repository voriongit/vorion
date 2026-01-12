'use client';

/**
 * Bot Trust Dashboard Page
 * Displays comprehensive trust metrics, transparency data, and telemetry
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import TrustScoreCard from '@/components/bot-trust/TrustScoreCard';
import ApprovalRateChart from '@/components/bot-trust/ApprovalRateChart';
import AutonomyLevelCard from '@/components/bot-trust/AutonomyLevelCard';
import DecisionHistory from '@/components/bot-trust/DecisionHistory';
import TelemetryDashboard from '@/components/bot-trust/TelemetryDashboard';
import AuditLogViewer from '@/components/bot-trust/AuditLogViewer';

export default function BotTrustDashboard() {
  const params = useParams();
  const botId = params.id as string;
  const [activeTab, setActiveTab] = useState<'overview' | 'decisions' | 'telemetry' | 'audit'>('overview');

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Bot Trust Dashboard</h1>
        <p className="text-gray-600">
          Training, Transparency, and Telemetry for Bot {botId}
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'overview'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('decisions')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'decisions'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Decision History
          </button>
          <button
            onClick={() => setActiveTab('telemetry')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'telemetry'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Telemetry
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'audit'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Audit Log
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Top Row: Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <TrustScoreCard botId={botId} />
            <AutonomyLevelCard botId={botId} />
            <ApprovalRateCard botId={botId} />
          </div>

          {/* Middle Row: Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ApprovalRateChart botId={botId} />
            <TrustScoreHistory botId={botId} />
          </div>

          {/* Bottom Row: Recent Decisions */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Recent Decisions</h2>
            <DecisionHistory botId={botId} limit={5} />
          </div>
        </div>
      )}

      {activeTab === 'decisions' && (
        <DecisionHistory botId={botId} />
      )}

      {activeTab === 'telemetry' && (
        <TelemetryDashboard botId={botId} />
      )}

      {activeTab === 'audit' && (
        <AuditLogViewer botId={botId} />
      )}
    </div>
  );
}

// Quick approval rate card component (simple version)
function ApprovalRateCard({ botId }: { botId: string }) {
  const [approvalRate, setApprovalRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/bot-trust/approval-rate?bot_id=${botId}`)
      .then((res) => res.json())
      .then((data) => {
        setApprovalRate(data.approval_rate?.overall || 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [botId]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  const percentage = ((approvalRate || 0) * 100).toFixed(1);
  const color = (approvalRate || 0) >= 0.85 ? 'text-green-600' : (approvalRate || 0) >= 0.75 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-sm font-medium text-gray-500 mb-2">Approval Rate</h3>
      <div className={`text-3xl font-bold ${color}`}>{percentage}%</div>
      <p className="text-xs text-gray-500 mt-2">
        {(approvalRate || 0) >= 0.85 ? 'Excellent' : (approvalRate || 0) >= 0.75 ? 'Good' : 'Needs Improvement'}
      </p>
    </div>
  );
}

// Quick trust score history component (simple version)
function TrustScoreHistory({ botId }: { botId: string }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Trust Score Trend</h3>
      <p className="text-gray-500 text-sm">Chart component coming soon...</p>
    </div>
  );
}
