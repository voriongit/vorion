'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Activity,
  Shield,
  GraduationCap,
  Bot,
  User,
  Server,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react'
import { EventRiskLevel, EventSource, EventType } from '@/lib/observer/types'

interface ObserverEvent {
  id: string
  sequence: number
  source: EventSource
  event_type: EventType
  risk_level: EventRiskLevel
  agent_id?: string
  user_id?: string
  data: Record<string, unknown>
  timestamp: string
  hash: string
}

interface EventFeedProps {
  agentId?: string
  autoRefresh?: boolean
  refreshInterval?: number
}

// Source icons
const sourceIcons: Record<EventSource, typeof Activity> = {
  agent: Bot,
  council: Shield,
  academy: GraduationCap,
  marketplace: Activity,
  user: User,
  system: Server,
  cron: Clock,
}

// Risk level colors and icons
const riskConfig: Record<EventRiskLevel, { color: string; bg: string; icon: typeof Activity }> = {
  info: { color: 'text-neutral-400', bg: 'bg-neutral-800', icon: Activity },
  low: { color: 'text-green-400', bg: 'bg-green-900/30', icon: CheckCircle },
  medium: { color: 'text-yellow-400', bg: 'bg-yellow-900/30', icon: AlertTriangle },
  high: { color: 'text-orange-400', bg: 'bg-orange-900/30', icon: AlertTriangle },
  critical: { color: 'text-red-400', bg: 'bg-red-900/30', icon: XCircle },
}

// Event type labels
const eventLabels: Partial<Record<EventType, string>> = {
  agent_created: 'Agent Created',
  agent_updated: 'Agent Updated',
  agent_action: 'Agent Action',
  agent_graduated: 'Agent Graduated',
  agent_archived: 'Agent Archived',
  council_request: 'Council Request',
  council_vote: 'Council Vote',
  council_decision: 'Council Decision',
  council_precedent_created: 'Precedent Created',
  academy_enrolled: 'Academy Enrollment',
  academy_progress: 'Training Progress',
  academy_module_completed: 'Module Completed',
  academy_examination: 'Examination',
  trust_change: 'Trust Changed',
  trust_decay: 'Trust Decay',
  tier_change: 'Tier Changed',
  user_feedback: 'User Feedback',
  escalation_created: 'Escalation Created',
  escalation_resolved: 'Escalation Resolved',
  human_override: 'Human Override',
  system_startup: 'System Startup',
  decay_batch: 'Decay Batch',
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)

  if (diffSecs < 60) return `${diffSecs}s ago`
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`

  return date.toLocaleString()
}

function EventCard({ event }: { event: ObserverEvent }) {
  const [expanded, setExpanded] = useState(false)
  const risk = riskConfig[event.risk_level]
  const SourceIcon = sourceIcons[event.source] || Activity
  const RiskIcon = risk.icon

  return (
    <div
      className={`rounded-lg border border-neutral-800 ${risk.bg} p-4 cursor-pointer hover:border-neutral-700 transition-colors`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg bg-neutral-800 ${risk.color}`}>
            <SourceIcon className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-neutral-100">
                {eventLabels[event.event_type] || event.event_type}
              </span>
              <RiskIcon className={`w-4 h-4 ${risk.color}`} />
            </div>
            <p className="text-sm text-neutral-400 mt-1">
              {event.source} | #{event.sequence}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <span className="text-xs text-neutral-500">{formatTime(event.timestamp)}</span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-neutral-600" />
          ) : (
            <ChevronDown className="w-4 h-4 text-neutral-600" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-neutral-800">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            {event.agent_id && (
              <div>
                <dt className="text-neutral-500">Agent ID</dt>
                <dd className="text-neutral-100 font-mono text-xs truncate">
                  {event.agent_id}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-neutral-500">Timestamp</dt>
              <dd className="text-neutral-100">
                {new Date(event.timestamp).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">Risk Level</dt>
              <dd className={`capitalize ${risk.color}`}>{event.risk_level}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Hash</dt>
              <dd className="text-neutral-100 font-mono text-xs truncate">
                {event.hash.substring(0, 16)}...
              </dd>
            </div>
            {Object.keys(event.data).length > 0 && (
              <div className="col-span-2">
                <dt className="text-neutral-500 mb-2">Event Data</dt>
                <dd className="bg-neutral-900 rounded p-3 overflow-auto max-h-48">
                  <pre className="text-xs text-neutral-300">
                    {JSON.stringify(event.data, null, 2)}
                  </pre>
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </div>
  )
}

export function EventFeed({
  agentId,
  autoRefresh = true,
  refreshInterval = 5000,
}: EventFeedProps) {
  const [events, setEvents] = useState<ObserverEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastSequence, setLastSequence] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)

  // Filters
  const [riskFilter, setRiskFilter] = useState<EventRiskLevel | ''>('')
  const [sourceFilter, setSourceFilter] = useState<EventSource | ''>('')

  const fetchEvents = useCallback(async (reset = false) => {
    try {
      setLoading(true)
      setError(null)

      const currentOffset = reset ? 0 : offset
      const params = new URLSearchParams({
        limit: '50',
        offset: currentOffset.toString(),
      })

      if (agentId) params.set('agent_id', agentId)
      if (riskFilter) params.set('risk_level', riskFilter)
      if (sourceFilter) params.set('source', sourceFilter)

      const response = await fetch(`/api/observer/events?${params}`)
      if (!response.ok) throw new Error('Failed to fetch events')

      const data = await response.json()

      if (reset) {
        setEvents(data.events)
        setOffset(data.events.length)
      } else {
        setEvents(prev => [...prev, ...data.events])
        setOffset(currentOffset + data.events.length)
      }

      setHasMore(data.has_more)
      if (data.events.length > 0) {
        setLastSequence(data.events[0].sequence)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [agentId, riskFilter, sourceFilter, offset])

  // Initial load
  useEffect(() => {
    fetchEvents(true)
  }, [agentId, riskFilter, sourceFilter])

  // Auto-refresh for new events
  useEffect(() => {
    if (!autoRefresh || loading) return

    const checkForNew = async () => {
      try {
        const params = new URLSearchParams({ limit: '10', offset: '0' })
        if (agentId) params.set('agent_id', agentId)
        if (riskFilter) params.set('risk_level', riskFilter)
        if (sourceFilter) params.set('source', sourceFilter)

        const response = await fetch(`/api/observer/events?${params}`)
        if (!response.ok) return

        const data = await response.json()
        if (data.events.length > 0 && data.events[0].sequence > lastSequence) {
          // New events - prepend them
          const newEvents = data.events.filter(
            (e: ObserverEvent) => e.sequence > lastSequence
          )
          if (newEvents.length > 0) {
            setEvents(prev => [...newEvents, ...prev])
            setLastSequence(newEvents[0].sequence)
          }
        }
      } catch (err) {
        // Silently fail on refresh
      }
    }

    const interval = setInterval(checkForNew, refreshInterval)
    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, lastSequence, agentId, riskFilter, sourceFilter, loading])

  const handleRefresh = () => {
    setOffset(0)
    fetchEvents(true)
  }

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      fetchEvents(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value as EventRiskLevel | '')}
          className="bg-neutral-800 border border-neutral-700 text-neutral-100 text-sm rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Risk Levels</option>
          <option value="info">Info</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>

        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value as EventSource | '')}
          className="bg-neutral-800 border border-neutral-700 text-neutral-100 text-sm rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Sources</option>
          <option value="agent">Agent</option>
          <option value="council">Council</option>
          <option value="academy">Academy</option>
          <option value="marketplace">Marketplace</option>
          <option value="user">User</option>
          <option value="system">System</option>
        </select>

        <button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-300 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>

        {autoRefresh && (
          <span className="text-xs text-neutral-500">
            Auto-refreshing every {refreshInterval / 1000}s
          </span>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-900/20 border border-red-800 text-red-400 rounded-lg p-4">
          {error}
        </div>
      )}

      {/* Events list */}
      <div className="space-y-3">
        {events.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}

        {events.length === 0 && !loading && (
          <div className="text-center py-12 text-neutral-500">
            <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No events found</p>
            <p className="text-sm mt-1">
              Events will appear here as they occur
            </p>
          </div>
        )}

        {loading && events.length === 0 && (
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 mx-auto animate-spin text-neutral-500" />
            <p className="text-neutral-400 mt-3">Loading events...</p>
          </div>
        )}
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="text-center pt-4">
          <button
            onClick={handleLoadMore}
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

export default EventFeed
