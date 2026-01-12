'use client'

/**
 * useAgent Hook - Agent data fetching with SWR
 *
 * Provides real-time agent data with automatic revalidation.
 * Part of Frontend Architecture Section 6.
 */

import useSWR from 'swr'
import { useCallback } from 'react'
import type { Agent, AgentWithEnrollments } from '@/lib/agents/types'

interface UseAgentOptions {
  /** Include enrollments in response */
  withEnrollments?: boolean
  /** Include trust history in response */
  withTrustHistory?: boolean
  /** Revalidate interval in milliseconds (0 = disabled) */
  refreshInterval?: number
}

interface UseAgentReturn {
  agent: Agent | AgentWithEnrollments | undefined
  isLoading: boolean
  isError: boolean
  error: Error | undefined
  mutate: () => Promise<Agent | AgentWithEnrollments | undefined>
  refresh: () => Promise<void>
}

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    const error = new Error('Failed to fetch agent')
    throw error
  }
  return res.json()
}

/**
 * Fetch and subscribe to agent data
 *
 * @example
 * const { agent, isLoading } = useAgent('agent-123')
 *
 * @example
 * const { agent } = useAgent('agent-123', { withEnrollments: true })
 */
export function useAgent(
  agentId: string | undefined | null,
  options: UseAgentOptions = {}
): UseAgentReturn {
  const {
    withEnrollments = false,
    withTrustHistory = false,
    refreshInterval = 0,
  } = options

  // Build query params
  const params = new URLSearchParams()
  if (withEnrollments) params.set('include', 'enrollments')
  if (withTrustHistory) params.set('include', 'trust_history')
  const queryString = params.toString()

  const url = agentId
    ? `/api/agents/${agentId}${queryString ? `?${queryString}` : ''}`
    : null

  const { data, error, isLoading, mutate } = useSWR<Agent | AgentWithEnrollments>(
    url,
    fetcher,
    {
      refreshInterval,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
  )

  const refresh = useCallback(async () => {
    await mutate()
  }, [mutate])

  return {
    agent: data,
    isLoading,
    isError: !!error,
    error,
    mutate,
    refresh,
  }
}

/**
 * Fetch list of agents for current user
 *
 * @example
 * const { agents, isLoading } = useAgents()
 *
 * @example
 * const { agents } = useAgents({ status: 'active', limit: 10 })
 */
interface UseAgentsOptions {
  status?: string
  limit?: number
  offset?: number
  refreshInterval?: number
}

interface UseAgentsReturn {
  agents: Agent[]
  total: number
  isLoading: boolean
  isError: boolean
  error: Error | undefined
  mutate: () => Promise<{ agents: Agent[]; total: number } | undefined>
}

export function useAgents(options: UseAgentsOptions = {}): UseAgentsReturn {
  const { status, limit = 50, offset = 0, refreshInterval = 0 } = options

  const params = new URLSearchParams()
  if (status) params.set('status', status)
  params.set('limit', String(limit))
  params.set('offset', String(offset))

  const { data, error, isLoading, mutate } = useSWR<{ agents: Agent[]; total: number }>(
    `/api/agents?${params.toString()}`,
    fetcher,
    { refreshInterval }
  )

  return {
    agents: data?.agents ?? [],
    total: data?.total ?? 0,
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

/**
 * Optimistically update agent data
 * Useful for immediate UI feedback while saving
 */
export function useOptimisticAgent(agentId: string) {
  const { agent, mutate } = useAgent(agentId)

  const updateOptimistic = useCallback(
    async (updates: Partial<Agent>, saveFn: () => Promise<Agent>) => {
      // Optimistically update the UI
      mutate(
        async () => {
          // Perform the actual save
          return await saveFn()
        },
        {
          optimisticData: agent ? { ...agent, ...updates } : undefined,
          rollbackOnError: true,
          populateCache: true,
          revalidate: false,
        }
      )
    },
    [agent, mutate]
  )

  return { agent, updateOptimistic }
}
