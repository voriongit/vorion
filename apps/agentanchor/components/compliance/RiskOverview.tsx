'use client';

import type { RiskCategory } from '@/lib/compliance/types';

interface RiskOverviewProps {
  riskStats: {
    total: number;
    byCategory: Record<RiskCategory, number>;
    highRisk: number;
    criticalRisk: number;
  };
  className?: string;
}

export function RiskOverview({ riskStats, className = '' }: RiskOverviewProps) {
  const categoryColors: Record<RiskCategory, string> = {
    security: 'bg-red-500',
    operational: 'bg-orange-500',
    compliance: 'bg-yellow-500',
    reputational: 'bg-purple-500',
    financial: 'bg-blue-500',
  };

  const categoryLabels: Record<RiskCategory, string> = {
    security: 'Security',
    operational: 'Operational',
    compliance: 'Compliance',
    reputational: 'Reputational',
    financial: 'Financial',
  };

  const categories = Object.entries(riskStats.byCategory) as [RiskCategory, number][];
  const maxValue = Math.max(...categories.map(([, v]) => v), 1);

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${className}`}>
      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
        Risk Overview
      </h3>

      {/* Risk Level Indicators */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            {riskStats.criticalRisk}
          </div>
          <div className="text-xs text-red-600 dark:text-red-400">Critical</div>
        </div>
        <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
          <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
            {riskStats.highRisk}
          </div>
          <div className="text-xs text-orange-600 dark:text-orange-400">High</div>
        </div>
        <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="text-2xl font-bold text-gray-700 dark:text-gray-300">
            {riskStats.total}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Total</div>
        </div>
      </div>

      {/* Risk by Category */}
      <div className="space-y-3">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          By Category
        </div>
        {categories.map(([category, count]) => (
          <div key={category} className="flex items-center space-x-3">
            <div className="w-24 text-sm text-gray-600 dark:text-gray-400">
              {categoryLabels[category]}
            </div>
            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
              <div
                className={`h-full ${categoryColors[category]} transition-all`}
                style={{ width: `${(count / maxValue) * 100}%` }}
              />
            </div>
            <div className="w-8 text-right text-sm font-medium text-gray-700 dark:text-gray-300">
              {count}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
