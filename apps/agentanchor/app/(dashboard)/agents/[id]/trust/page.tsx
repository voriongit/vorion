'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Bot, Loader2 } from 'lucide-react'
import TrustHistorySection from '@/components/agents/TrustHistorySection'
import TrustBadge from '@/components/agents/TrustBadge'
import { TrustTier } from '@/lib/agents/types'

interface AgentData {
  id: string
  name: string
  trust_score: number
  trust_tier: TrustTier
  avatar_url?: string
}

export default function TrustHistoryPage() {
  const params = useParams()
  const agentId = params.id as string

  const [agent, setAgent] = useState<AgentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchAgent() {
      try {
        const response = await fetch(`/api/agents/${agentId}`)
        if (!response.ok) {
          throw new Error('Agent not found')
        }
        const data = await response.json()
        setAgent(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load agent')
      } finally {
        setLoading(false)
      }
    }

    fetchAgent()
  }, [agentId])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-500" />
      </div>
    )
  }

  if (error || !agent) {
    return (
      <div className="space-y-6">
        <Link
          href="/agents"
          className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Agents
        </Link>
        <div className="bg-red-900/20 border border-red-800 text-red-400 rounded-lg p-6">
          {error || 'Agent not found'}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Link
        href={`/agents/${agentId}`}
        className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {agent.name}
      </Link>

      {/* Agent Header */}
      <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-6">
        <div className="flex items-center gap-4">
          {agent.avatar_url ? (
            <img
              src={agent.avatar_url}
              alt={agent.name}
              className="h-12 w-12 rounded-full object-cover"
            />
          ) : (
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
              <Bot className="h-6 w-6 text-white" />
            </div>
          )}
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-neutral-100">{agent.name}</h1>
            <p className="text-sm text-neutral-400">Trust Score History & Trends</p>
          </div>
          <TrustBadge score={agent.trust_score} tier={agent.trust_tier} showScore />
        </div>
      </div>

      {/* Trust History Section */}
      <TrustHistorySection
        agentId={agentId}
        initialScore={agent.trust_score}
        initialTier={agent.trust_tier}
      />
    </div>
  )
}
