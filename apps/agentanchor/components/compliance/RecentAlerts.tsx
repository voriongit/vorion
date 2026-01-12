'use client';

import type { ComplianceAlert, FindingSeverity } from '@/lib/compliance/types';

interface RecentAlertsProps {
  alerts: ComplianceAlert[];
  className?: string;
}

export function RecentAlerts({ alerts, className = '' }: RecentAlertsProps) {
  const getSeverityColor = (severity: FindingSeverity) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getSeverityIcon = (severity: FindingSeverity) => {
    switch (severity) {
      case 'critical':
      case 'high':
        return (
          <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      case 'medium':
        return (
          <svg className="w-5 h-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  if (alerts.length === 0) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${className}`}>
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
          Recent Alerts
        </h3>
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-2 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p>No active alerts</p>
          <p className="text-sm">All systems operating within compliance parameters</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${className}`}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Recent Alerts
        </h3>
        <span className="text-sm text-gray-500">
          {alerts.filter(a => !a.acknowledged).length} unacknowledged
        </span>
      </div>

      <div className="space-y-3">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`flex items-start space-x-3 p-3 rounded-lg ${
              alert.acknowledged
                ? 'bg-gray-50 dark:bg-gray-700/50'
                : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600'
            }`}
          >
            <div className="flex-shrink-0 mt-0.5">
              {getSeverityIcon(alert.severity)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <span className={`text-xs px-2 py-0.5 rounded ${getSeverityColor(alert.severity)}`}>
                  {alert.severity.toUpperCase()}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {alert.framework.toUpperCase()}
                </span>
                {alert.controlId && (
                  <span className="text-xs text-gray-400">
                    {alert.controlId}
                  </span>
                )}
              </div>

              <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                {alert.title}
              </p>

              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {alert.description}
              </p>

              <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                <span>
                  {new Date(alert.timestamp).toLocaleString()}
                </span>
                {alert.acknowledged && alert.acknowledgedBy && (
                  <span>
                    Ack'd by {alert.acknowledgedBy}
                  </span>
                )}
              </div>
            </div>

            {!alert.acknowledged && (
              <button className="flex-shrink-0 text-blue-600 hover:text-blue-800 text-sm">
                Acknowledge
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
