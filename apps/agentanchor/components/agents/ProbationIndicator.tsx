'use client'

import { AlertTriangle, Clock, ShieldOff } from 'lucide-react'

interface ProbationIndicatorProps {
  daysRemaining: number
  size?: 'sm' | 'md' | 'lg'
  showDetails?: boolean
}

const sizeClasses = {
  sm: {
    container: 'px-2 py-1 text-xs gap-1.5',
    icon: 'h-3 w-3',
  },
  md: {
    container: 'px-3 py-2 text-sm gap-2',
    icon: 'h-4 w-4',
  },
  lg: {
    container: 'px-4 py-3 text-base gap-2.5',
    icon: 'h-5 w-5',
  },
}

export default function ProbationIndicator({
  daysRemaining,
  size = 'md',
  showDetails = false,
}: ProbationIndicatorProps) {
  const sizes = sizeClasses[size]

  return (
    <div
      className={`inline-flex items-center rounded-lg font-medium bg-orange-100 text-orange-700 border border-orange-300 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800 ${sizes.container}`}
      title={`Agent is on probation - ${daysRemaining} days remaining`}
    >
      <AlertTriangle className={`${sizes.icon} flex-shrink-0`} />
      <span>On Probation</span>
      {showDetails && (
        <span className="flex items-center gap-1 opacity-75">
          <Clock className={sizes.icon} />
          {daysRemaining} days left
        </span>
      )}
    </div>
  )
}

// Full card version for detail pages
export function ProbationCard({ daysRemaining }: { daysRemaining: number }) {
  return (
    <div className="rounded-lg border-2 border-orange-300 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20 p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-orange-100 dark:bg-orange-900/50 p-2">
          <ShieldOff className="h-5 w-5 text-orange-600 dark:text-orange-400" />
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-orange-800 dark:text-orange-300">
            Agent On Probation
          </h4>
          <p className="text-sm text-orange-700 dark:text-orange-400 mt-1">
            This agent has been placed on probation due to significant trust score decline.
            All actions require human approval during this period.
          </p>
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1.5 text-sm">
              <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              <span className="font-medium text-orange-800 dark:text-orange-300">
                {daysRemaining} days remaining
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-orange-200 dark:border-orange-800">
        <h5 className="text-xs font-medium text-orange-700 dark:text-orange-400 uppercase tracking-wide mb-2">
          Probation Restrictions
        </h5>
        <ul className="text-sm text-orange-700 dark:text-orange-400 space-y-1">
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
            Cannot execute autonomous actions
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
            All actions require human approval
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
            Enhanced monitoring enabled
          </li>
        </ul>
      </div>
    </div>
  )
}
