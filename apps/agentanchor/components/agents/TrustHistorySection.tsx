'use client'

import { useState, useEffect, useCallback } from 'react'
import { TrustHistoryChart } from './TrustHistoryChart'
import { TrustHistoryTimeline } from './TrustHistoryTimeline'
import { TrustTier } from '@/lib/agents/types'
import { BarChart2, List, RefreshCw } from 'lucide-react'

interface TrustHistorySectionProps {
  agentId: string
  initialScore: number
  initialTier: TrustTier
}

interface TrendPoint {
  date: string
  score: number
  tier: TrustTier
}

interface HistoryEntry {
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

type ViewMode = 'chart' | 'timeline'

export function TrustHistorySection({
  agentId,
  initialScore,
  initialTier,
}: TrustHistorySectionProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('chart')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Chart data
  const [trendData, setTrendData] = useState<TrendPoint[]>([])
  const [days, setDays] = useState(30)

  // Timeline data
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([])
  const [historyTotal, setHistoryTotal] = useState(0)
  const [historyOffset, setHistoryOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  // Current score (may be updated)
  const [currentScore, setCurrentScore] = useState(initialScore)
  const [currentTier, setCurrentTier] = useState(initialTier)

  const fetchTrend = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/agents/${agentId}/trust?trend=true&days=${days}`
      )
      if (!response.ok) {
        throw new Error('Failed to fetch trust trend')
      }
      const data = await response.json()
      setTrendData(data.trend || [])
      setCurrentScore(data.current_score)
      setCurrentTier(data.current_tier)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [agentId, days])

  const fetchHistory = useCallback(async (reset = false) => {
    if (reset) {
      setLoadingMore(false)
      setLoading(true)
    } else {
      setLoadingMore(true)
    }
    setError(null)

    const offset = reset ? 0 : historyOffset
    try {
      const response = await fetch(
        `/api/agents/${agentId}/trust?limit=20&offset=${offset}`
      )
      if (!response.ok) {
        throw new Error('Failed to fetch trust history')
      }
      const data = await response.json()

      if (reset) {
        setHistoryEntries(data.history || [])
      } else {
        setHistoryEntries(prev => [...prev, ...(data.history || [])])
      }

      setHistoryTotal(data.total)
      setHistoryOffset(offset + (data.history?.length || 0))
      setHasMore(data.has_more)
      setCurrentScore(data.current_score)
      setCurrentTier(data.current_tier)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [agentId, historyOffset])

  useEffect(() => {
    if (viewMode === 'chart') {
      fetchTrend()
    } else {
      fetchHistory(true)
    }
  }, [viewMode, days, fetchTrend])

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      fetchHistory(false)
    }
  }

  const handleRefresh = () => {
    if (viewMode === 'chart') {
      fetchTrend()
    } else {
      setHistoryOffset(0)
      fetchHistory(true)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header with controls */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-neutral-100">Trust History</h2>

        <div className="flex items-center gap-3">
          {/* View mode toggle */}
          <div className="flex items-center bg-neutral-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('chart')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                viewMode === 'chart'
                  ? 'bg-neutral-700 text-neutral-100'
                  : 'text-neutral-400 hover:text-neutral-100'
              }`}
            >
              <BarChart2 className="w-4 h-4" />
              <span>Chart</span>
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                viewMode === 'timeline'
                  ? 'bg-neutral-700 text-neutral-100'
                  : 'text-neutral-400 hover:text-neutral-100'
              }`}
            >
              <List className="w-4 h-4" />
              <span>Timeline</span>
            </button>
          </div>

          {/* Days selector for chart */}
          {viewMode === 'chart' && (
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="bg-neutral-800 border border-neutral-700 text-neutral-100 text-sm rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
              <option value={365}>1 year</option>
            </select>
          )}

          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-2 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-900/20 border border-red-800 text-red-400 rounded-lg p-4">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && !loadingMore && (
        <div className="bg-neutral-900 rounded-lg p-12 border border-neutral-800 text-center">
          <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin text-neutral-500" />
          <p className="text-neutral-400">Loading trust data...</p>
        </div>
      )}

      {/* Content */}
      {!loading && !error && (
        <>
          {viewMode === 'chart' ? (
            <TrustHistoryChart data={trendData} days={days} />
          ) : (
            <TrustHistoryTimeline
              entries={historyEntries}
              currentScore={currentScore}
              currentTier={currentTier}
              total={historyTotal}
              hasMore={hasMore}
              onLoadMore={handleLoadMore}
              loading={loadingMore}
            />
          )}
        </>
      )}
    </div>
  )
}

export default TrustHistorySection
