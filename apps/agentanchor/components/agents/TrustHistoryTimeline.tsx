'use client'

import { useState } from 'react'
import { TrustTier } from '@/lib/agents/types'
import { TrendingUp, TrendingDown, Minus, Clock, ChevronDown, ChevronUp } from 'lucide-react'

interface TrustHistoryEntry {
  id: string
  previous_score: number
  score: number
  change_amount: number
  tier: TrustTier
  reason: string
  source: string
  recorded_at: string
  metadata?: Record<string, unknown>
}

interface TrustHistoryTimelineProps {
  entries: TrustHistoryEntry[]
  currentScore: number
  currentTier: TrustTier
  total: number
  hasMore: boolean
  onLoadMore?: () => void
  loading?: boolean
}

const tierEmojis: Record<TrustTier, string> = {
  untrusted: '⚠️',
  novice: '🌱',
  proven: '✅',
  trusted: '🛡️',
  elite: '👑',
  legendary: '🌟',
}

const tierColors: Record<TrustTier, string> = {
  untrusted: 'text-red-400',
  novice: 'text-green-400',
  proven: 'text-blue-400',
  trusted: 'text-purple-400',
  elite: 'text-amber-400',
  legendary: 'text-pink-400',
}

const sourceLabels: Record<string, string> = {
  task_success_low: 'Task Success',
  task_success_medium: 'Task Success',
  task_success_high: 'Task Success',
  council_approval: 'Council Approval',
  council_denial: 'Council Denial',
  user_positive_feedback: 'User Feedback',
  user_negative_feedback: 'User Feedback',
  training_milestone: 'Training Milestone',
  examination_passed: 'Examination Passed',
  commendation: 'Commendation',
  task_failure: 'Task Failure',
  policy_violation_minor: 'Policy Violation',
  policy_violation_major: 'Policy Violation',
  complaint_filed: 'Complaint Filed',
  suspension: 'Suspension',
  decay: 'Inactivity Decay',
  manual_adjustment: 'Manual Adjustment',
  graduation: 'Academy Graduation',
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

function ChangeIndicator({ change }: { change: number }) {
  if (change > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-green-400">
        <TrendingUp className="w-4 h-4" />
        <span>+{change}</span>
      </span>
    )
  }
  if (change < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-red-400">
        <TrendingDown className="w-4 h-4" />
        <span>{change}</span>
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-neutral-500">
      <Minus className="w-4 h-4" />
      <span>0</span>
    </span>
  )
}

function TimelineEntry({ entry, isLast }: { entry: TrustHistoryEntry; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="relative flex gap-4">
      {/* Timeline line */}
      <div className="flex flex-col items-center">
        <div
          className={`w-3 h-3 rounded-full border-2 ${
            entry.change_amount > 0
              ? 'border-green-500 bg-green-500/20'
              : entry.change_amount < 0
              ? 'border-red-500 bg-red-500/20'
              : 'border-neutral-500 bg-neutral-500/20'
          }`}
        />
        {!isLast && (
          <div className="w-0.5 h-full bg-neutral-700 min-h-[40px]" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 pb-4">
        <div
          className="bg-neutral-900 rounded-lg border border-neutral-800 p-4 cursor-pointer hover:border-neutral-700 transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-neutral-100">
                  {sourceLabels[entry.source] || entry.source}
                </span>
                <ChangeIndicator change={entry.change_amount} />
              </div>
              <p className="text-sm text-neutral-400">{entry.reason}</p>
            </div>

            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-2">
                <span className={`text-lg ${tierColors[entry.tier]}`}>
                  {tierEmojis[entry.tier]}
                </span>
                <span className="text-lg font-bold text-neutral-100">
                  {entry.score}
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs text-neutral-500">
                <Clock className="w-3 h-3" />
                <span>{formatDate(entry.recorded_at)}</span>
              </div>
            </div>
          </div>

          {/* Expanded details */}
          {expanded && (
            <div className="mt-4 pt-4 border-t border-neutral-800">
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-neutral-500">Previous Score</dt>
                  <dd className="text-neutral-100">{entry.previous_score}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500">New Score</dt>
                  <dd className="text-neutral-100">{entry.score}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Source Event</dt>
                  <dd className="text-neutral-100">{entry.source}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Tier</dt>
                  <dd className={`capitalize ${tierColors[entry.tier]}`}>
                    {entry.tier}
                  </dd>
                </div>
                {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                  <div className="col-span-2">
                    <dt className="text-neutral-500 mb-1">Metadata</dt>
                    <dd className="text-xs font-mono bg-neutral-950 p-2 rounded">
                      {JSON.stringify(entry.metadata, null, 2)}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {/* Expand indicator */}
          <div className="flex justify-center mt-2 text-neutral-600">
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function TrustHistoryTimeline({
  entries,
  currentScore,
  currentTier,
  total,
  hasMore,
  onLoadMore,
  loading = false,
}: TrustHistoryTimelineProps) {
  if (entries.length === 0) {
    return (
      <div className="bg-neutral-900 rounded-lg p-6 border border-neutral-800">
        <h3 className="text-lg font-medium text-neutral-100 mb-4">
          Trust History
        </h3>
        <div className="text-center py-8 text-neutral-500">
          <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No trust history entries yet</p>
          <p className="text-sm mt-1">
            Trust changes will appear here as they occur
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-neutral-900 rounded-lg p-6 border border-neutral-800">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-medium text-neutral-100">
          Trust History
        </h3>
        <div className="flex items-center gap-2">
          <span className={`text-2xl ${tierColors[currentTier]}`}>
            {tierEmojis[currentTier]}
          </span>
          <span className="text-2xl font-bold text-neutral-100">
            {currentScore}
          </span>
          <span className="text-sm text-neutral-500">/ 1000</span>
        </div>
      </div>

      <p className="text-sm text-neutral-500 mb-4">
        Showing {entries.length} of {total} entries
      </p>

      <div className="space-y-0">
        {entries.map((entry, index) => (
          <TimelineEntry
            key={entry.id}
            entry={entry}
            isLast={index === entries.length - 1}
          />
        ))}
      </div>

      {hasMore && (
        <div className="mt-4 text-center">
          <button
            onClick={onLoadMore}
            disabled={loading}
            className="px-4 py-2 text-sm text-neutral-300 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  )
}

export default TrustHistoryTimeline
