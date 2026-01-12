'use client';

import type { ComplianceMetric } from '@/lib/compliance/types';

interface ComplianceMetricsProps {
  metrics: ComplianceMetric[];
  className?: string;
}

export function ComplianceMetrics({ metrics, className = '' }: ComplianceMetricsProps) {
  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return (
          <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        );
      case 'declining':
        return (
          <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
          </svg>
        );
    }
  };

  const getStatusColor = (metric: ComplianceMetric) => {
    if (metric.currentValue >= metric.target) return 'text-green-500';
    if (metric.currentValue >= metric.threshold) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getFrameworkBadge = (framework: string) => {
    const colors: Record<string, string> = {
      soc2: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      hipaa: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
      iso27001: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    };
    return colors[framework] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${className}`}>
      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
        Compliance Metrics
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((metric) => (
          <div
            key={metric.id}
            className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
          >
            <div className="flex justify-between items-start mb-2">
              <span className={`text-xs px-2 py-1 rounded ${getFrameworkBadge(metric.framework)}`}>
                {metric.framework.toUpperCase()}
              </span>
              {getTrendIcon(metric.trend)}
            </div>

            <div className="mb-2">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {metric.name}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {metric.description}
              </div>
            </div>

            <div className="flex items-baseline space-x-1">
              <span className={`text-2xl font-bold ${getStatusColor(metric)}`}>
                {metric.currentValue}
              </span>
              <span className="text-gray-400">{metric.unit}</span>
              <span className="text-xs text-gray-500">
                / {metric.target}{metric.unit}
              </span>
            </div>

            {/* Progress bar */}
            <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${
                  metric.currentValue >= metric.target
                    ? 'bg-green-500'
                    : metric.currentValue >= metric.threshold
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${Math.min((metric.currentValue / metric.target) * 100, 100)}%` }}
              />
            </div>

            {metric.controlId && (
              <div className="mt-2 text-xs text-gray-500">
                Control: {metric.controlId}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
