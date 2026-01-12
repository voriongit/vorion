'use client';

interface FrameworkStatusProps {
  controlStats: {
    total: number;
    compliant: number;
    nonCompliant: number;
    partial: number;
    notApplicable: number;
  };
  className?: string;
}

export function FrameworkStatus({ controlStats, className = '' }: FrameworkStatusProps) {
  const data = [
    { label: 'Compliant', value: controlStats.compliant, color: 'bg-green-500' },
    { label: 'Partial', value: controlStats.partial, color: 'bg-yellow-500' },
    { label: 'Non-Compliant', value: controlStats.nonCompliant, color: 'bg-red-500' },
    { label: 'N/A', value: controlStats.notApplicable, color: 'bg-gray-400' },
  ];

  const total = controlStats.total || 1;

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${className}`}>
      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
        Control Status Overview
      </h3>

      {/* Stacked bar */}
      <div className="flex h-8 rounded-lg overflow-hidden mb-4">
        {data.map((item, index) => (
          <div
            key={index}
            className={`${item.color} transition-all`}
            style={{ width: `${(item.value / total) * 100}%` }}
            title={`${item.label}: ${item.value}`}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-4">
        {data.map((item, index) => (
          <div key={index} className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${item.color}`} />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {item.label}: {item.value}
            </span>
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center">
          <span className="text-gray-600 dark:text-gray-400">Total Controls</span>
          <span className="text-xl font-semibold text-gray-900 dark:text-white">
            {controlStats.total}
          </span>
        </div>
        <div className="flex justify-between items-center mt-2">
          <span className="text-gray-600 dark:text-gray-400">Compliance Rate</span>
          <span className="text-xl font-semibold text-green-500">
            {Math.round((controlStats.compliant / total) * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}
