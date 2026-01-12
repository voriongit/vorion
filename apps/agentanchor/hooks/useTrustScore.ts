'use client'

/**
 * useTrustScore Hook - Trust score with real-time updates
 *
 * Combines SWR fetching with Pusher real-time subscriptions
 * for instant trust score updates across the app.
 * Part of Frontend Architecture Section 6.
 */

import { useEffect, useCallback, useState } from 'react'
import useSWR from 'swr'
import { usePusherEvent } from '@/lib/pusher/hooks'
import type { TrustTier, TrustHistoryEntry } from '@/lib/agents/types'
import { getTrustTierFromScore, TRUST_TIERS } from '@/lib/agents/types'

interface TrustScoreData {
  score: number
  tier: TrustTier
  previousScore?: number
  change?: number
}

interface UseTrustScoreReturn {
  score: number
  tier: TrustTier
  tierInfo: typeof TRUST_TIERS[TrustTier]
  isLoading: boolean
  isError: boolean
  lastChange: { amount: number; reason: string } | null
  pointsToNextTier: number
  nextTier: TrustTier | null
  refresh: () => Promise<void>
}

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch trust score')
  return res.json()
}

/**
 * Subscribe to trust score with real-time updates
 *
 * @example
 * const { score, tier, tierInfo } = useTrustScore('agent-123')
 *
 * @example
 * const { pointsToNextTier, nextTier } = useTrustScore('agent-123')
 */
export function useTrustScore(agentId: string | undefined | null): UseTrustScoreReturn {
  const [lastChange, setLastChange] = useState<{ amount: number; reason: string } | null>(null)

  // Initial data fetch with SWR
  const { data, error, isLoading, mutate } = useSWR<TrustScoreData>(
    agentId ? `/api/agents/${agentId}/trust` : null,
    fetcher,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
  )

  // Subscribe to real-time trust updates via Pusher
  const { data: pusherUpdate } = usePusherEvent<TrustScoreData>(
    agentId ? `agent-${agentId}` : '',
    'trust-update'
  )

  // When we receive a Pusher update, update SWR cache
  useEffect(() => {
    if (pusherUpdate && agentId) {
      mutate(pusherUpdate, { revalidate: false })
      if (pusherUpdate.change !== undefined) {
        setLastChange({
          amount: pusherUpdate.change,
          reason: 'Trust score updated',
        })
      }
    }
  }, [pusherUpdate, agentId, mutate])

  const refresh = useCallback(async () => {
    await mutate()
  }, [mutate])

  // Calculate current values
  const score = data?.score ?? 0
  const tier = data?.tier ?? getTrustTierFromScore(score)
  const tierInfo = TRUST_TIERS[tier]

  // Calculate next tier info
  const tiers: TrustTier[] = ['untrusted', 'novice', 'proven', 'trusted', 'elite', 'legendary']
  const currentTierIndex = tiers.indexOf(tier)
  const nextTier = currentTierIndex < tiers.length - 1 ? tiers[currentTierIndex + 1] : null
  const nextTierInfo = nextTier ? TRUST_TIERS[nextTier] : null
  const pointsToNextTier = nextTierInfo ? Math.max(0, nextTierInfo.min - score) : 0

  return {
    score,
    tier,
    tierInfo,
    isLoading,
    isError: !!error,
    lastChange,
    pointsToNextTier,
    nextTier,
    refresh,
  }
}

/**
 * Fetch trust history for an agent
 *
 * @example
 * const { history, isLoading } = useTrustHistory('agent-123')
 */
interface UseTrustHistoryOptions {
  limit?: number
  offset?: number
}

interface UseTrustHistoryReturn {
  history: TrustHistoryEntry[]
  total: number
  isLoading: boolean
  isError: boolean
  loadMore: () => void
  hasMore: boolean
}

export function useTrustHistory(
  agentId: string | undefined | null,
  options: UseTrustHistoryOptions = {}
): UseTrustHistoryReturn {
  const { limit = 20, offset = 0 } = options
  const [currentOffset, setCurrentOffset] = useState(offset)

  const { data, error, isLoading, mutate } = useSWR<{
    entries: TrustHistoryEntry[]
    total: number
  }>(
    agentId ? `/api/agents/${agentId}/trust/history?limit=${limit}&offset=${currentOffset}` : null,
    fetcher
  )

  // Subscribe to new trust changes
  const { data: newChange } = usePusherEvent<TrustHistoryEntry>(
    agentId ? `agent-${agentId}` : '',
    'trust-change'
  )

  // Prepend new changes to history
  useEffect(() => {
    if (newChange && data) {
      mutate(
        {
          entries: [newChange, ...data.entries].slice(0, limit),
          total: data.total + 1,
        },
        { revalidate: false }
      )
    }
  }, [newChange, data, mutate, limit])

  const loadMore = useCallback(() => {
    setCurrentOffset((prev) => prev + limit)
  }, [limit])

  const hasMore = (data?.total ?? 0) > currentOffset + limit

  return {
    history: data?.entries ?? [],
    total: data?.total ?? 0,
    isLoading,
    isError: !!error,
    loadMore,
    hasMore,
  }
}

/**
 * Get trust trend data for charts
 *
 * @example
 * const { trend } = useTrustTrend('agent-123', 30)
 */
export function useTrustTrend(
  agentId: string | undefined | null,
  days: number = 30
) {
  const { data, error, isLoading } = useSWR<Array<{
    date: string
    score: number
    tier: TrustTier
  }>>(
    agentId ? `/api/agents/${agentId}/trust/trend?days=${days}` : null,
    fetcher
  )

  return {
    trend: data ?? [],
    isLoading,
    isError: !!error,
  }
}
