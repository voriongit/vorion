'use client';

import { cn } from '@/lib/utils';

interface ProgressBarProps {
  value: number; // 0-100
  size?: 'sm' | 'md' | 'lg';
  color?: 'cyan' | 'green' | 'purple' | 'orange' | 'blue';
  showLabel?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
};

const colorClasses = {
  cyan: 'bg-cyan-500',
  green: 'bg-green-500',
  purple: 'bg-purple-500',
  orange: 'bg-orange-500',
  blue: 'bg-blue-500',
};

export function ProgressBar({
  value,
  size = 'md',
  color = 'cyan',
  showLabel = false,
  className,
}: ProgressBarProps) {
  const clampedValue = Math.max(0, Math.min(100, value));

  return (
    <div className={cn('w-full', className)}>
      {showLabel && (
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Progress</span>
          <span>{Math.round(clampedValue)}%</span>
        </div>
      )}
      <div className={cn('w-full bg-gray-800 rounded-full overflow-hidden', sizeClasses[size])}>
        <div
          className={cn('h-full transition-all duration-500 ease-out rounded-full', colorClasses[color])}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    </div>
  );
}
