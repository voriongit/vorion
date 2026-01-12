'use client';

import { useState, useEffect } from 'react';
import { ComplianceScoreCard } from './ComplianceScoreCard';
import { FrameworkStatus } from './FrameworkStatus';
import { ComplianceMetrics } from './ComplianceMetrics';
import { RiskOverview } from './RiskOverview';
import { RecentAlerts } from './RecentAlerts';
import type { ComplianceDashboard as DashboardType, ComplianceMetric } from '@/lib/compliance/types';

interface ComplianceDashboardProps {
  className?: string;
}

export function ComplianceDashboard({ className = '' }: ComplianceDashboardProps) {
  const [dashboard, setDashboard] = useState<DashboardType | null>(null);
  const [metrics, setMetrics] = useState<ComplianceMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchComplianceData();
  }, []);

  const fetchComplianceData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/compliance');
      const data = await response.json();

      if (data.success) {
        setDashboard(data.data.dashboard);
        setMetrics(data.data.metrics);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to load compliance data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`text-red-500 p-4 border border-red-300 rounded-lg ${className}`}>
        <p className="font-semibold">Error loading compliance data</p>
        <p className="text-sm">{error}</p>
        <button
          onClick={fetchComplianceData}
          className="mt-2 px-4 py-2 bg-red-100 hover:bg-red-200 rounded"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!dashboard) {
    return null;
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Compliance Dashboard
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            SOC 2 | HIPAA | ISO 27001
          </p>
        </div>
        <div className="text-sm text-gray-500">
          Last updated: {new Date(dashboard.lastUpdated).toLocaleString()}
        </div>
      </div>

      {/* Overall Score Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <ComplianceScoreCard
          title="Overall Score"
          score={dashboard.overallScore}
          trend="stable"
          icon="shield"
        />
        <ComplianceScoreCard
          title="SOC 2"
          score={dashboard.frameworkScores.soc2}
          trend="improving"
          icon="lock"
        />
        <ComplianceScoreCard
          title="HIPAA"
          score={dashboard.frameworkScores.hipaa}
          trend="stable"
          icon="heart"
        />
        <ComplianceScoreCard
          title="ISO 27001"
          score={dashboard.frameworkScores.iso27001}
          trend="improving"
          icon="globe"
        />
      </div>

      {/* Framework Status and Risk Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FrameworkStatus controlStats={dashboard.controlStats} />
        <RiskOverview riskStats={dashboard.riskStats} />
      </div>

      {/* Metrics */}
      <ComplianceMetrics metrics={metrics} />

      {/* Findings Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
          Audit Findings Summary
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-yellow-500">
              {dashboard.findingStats.open}
            </div>
            <div className="text-sm text-gray-500">Open</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-500">
              {dashboard.findingStats.inProgress}
            </div>
            <div className="text-sm text-gray-500">In Progress</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-red-500">
              {dashboard.findingStats.overdue}
            </div>
            <div className="text-sm text-gray-500">Overdue</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-500">
              {dashboard.findingStats.bySeverity.critical +
                dashboard.findingStats.bySeverity.high}
            </div>
            <div className="text-sm text-gray-500">Critical/High</div>
          </div>
        </div>
      </div>

      {/* Recent Alerts */}
      <RecentAlerts alerts={dashboard.recentAlerts} />
    </div>
  );
}
