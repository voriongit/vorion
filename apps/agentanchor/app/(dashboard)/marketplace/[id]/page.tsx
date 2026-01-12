'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Bot,
  Star,
  Users,
  Activity,
  Shield,
  CheckCircle,
  AlertTriangle,
  ShoppingCart,
  ExternalLink,
  MessageSquare,
  RefreshCw,
  Sparkles,
  Play,
  UserPlus,
  Loader2,
} from 'lucide-react'
import TrustBadge from '@/components/agents/TrustBadge'
import { TrustTier } from '@/lib/agents/types'
import { AcquireModal } from '@/components/marketplace/AcquireModal'

interface Agent {
  id: string
  name: string
  description: string | null
  specialization: string | null
  trust_score: number
  trust_tier: string
  capabilities: string[]
  personality_traits: string[]
  system_prompt: string | null
  model: string
  avatar_url: string | null
  created_at: string
}

export default function AgentDetailPage() {
  const router = useRouter()
  const params = useParams()
  const [agent, setAgent] = useState<Agent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAcquireModal, setShowAcquireModal] = useState(false)
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  useEffect(() => {
    if (params.id) {
      fetchAgent(params.id as string)
    }
  }, [params.id])

  async function fetchAgent(id: string) {
    try {
      const res = await fetch(`/api/agents/public/${id}`)
      if (res.ok) {
        const data = await res.json()
        setAgent(data.agent)
      } else {
        setError('Agent not found')
      }
    } catch (err) {
      setError('Failed to load agent')
    } finally {
      setLoading(false)
    }
  }

  async function handleAddToMyAgents() {
    if (!agent) return
    setAdding(true)
    setAddError(null)

    try {
      const res = await fetch('/api/agents/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: agent.id }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to add agent')
      }

      setAdded(true)
    } catch (err: any) {
      setAddError(err.message)
    } finally {
      setAdding(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <RefreshCw className="w-8 h-8 animate-spin text-neutral-500" />
      </div>
    )
  }

  if (error || !agent) {
    return (
      <div className="text-center py-24">
        <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-400" />
        <h2 className="text-xl font-semibold text-neutral-100 mb-2">
          {error || 'Agent not found'}
        </h2>
        <Link href="/marketplace" className="text-blue-400 hover:underline">
          Back to Marketplace
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back Link */}
      <Link
        href="/marketplace"
        className="inline-flex items-center gap-2 text-neutral-400 hover:text-neutral-200"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Marketplace
      </Link>

      {/* Header */}
      <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-6">
        <div className="flex items-start gap-6">
          <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold text-4xl">
            {agent.name?.charAt(0) || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-neutral-100">
                  {agent.name}
                </h1>
                <p className="text-neutral-400 mt-1">{agent.specialization || 'General Assistant'}</p>
              </div>
              <TrustBadge
                score={agent.trust_score}
                tier={agent.trust_tier as TrustTier}
                size="lg"
              />
            </div>

            {/* Stats Row */}
            <div className="flex items-center gap-6 mt-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-green-400" />
                <span className="text-neutral-100 font-medium">
                  Trust Score: {agent.trust_score}
                </span>
              </div>
              <div className="flex items-center gap-2 text-neutral-400">
                <Bot className="w-5 h-5" />
                <span className="capitalize">{agent.trust_tier || 'Untrusted'}</span>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-wrap gap-3 mt-6">
              <Link
                href={`/sandbox?agent=${agent.id}`}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                <Play className="w-4 h-4" />
                Try in Sandbox
              </Link>
              <button
                onClick={handleAddToMyAgents}
                disabled={adding || added}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  added
                    ? 'bg-green-600 text-white cursor-default'
                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                } ${adding ? 'opacity-70 cursor-wait' : ''}`}
              >
                {adding ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : added ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                {added ? 'Added!' : adding ? 'Adding...' : 'Add to My Agents'}
              </button>
              <button onClick={() => setShowAcquireModal(true)} className="flex items-center gap-2 px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg font-medium transition-colors">
                <ShoppingCart className="w-4 h-4" />
                Acquire (Clone/Own)
              </button>
            </div>
            {addError && (
              <p className="text-red-400 text-sm mt-2">{addError}</p>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-6">
        <h2 className="text-lg font-semibold text-neutral-100 mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-400" />
          Description
        </h2>
        <p className="text-neutral-300 whitespace-pre-wrap leading-relaxed">
          {agent.description || 'No description available for this agent.'}
        </p>
      </div>

      {/* Capabilities */}
      {agent.capabilities && agent.capabilities.length > 0 && (
        <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-6">
          <h2 className="text-lg font-semibold text-neutral-100 mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            Capabilities
          </h2>
          <div className="flex flex-wrap gap-2">
            {agent.capabilities.map((cap, i) => (
              <span
                key={i}
                className="px-3 py-1.5 bg-neutral-800 text-neutral-300 rounded-lg text-sm border border-neutral-700"
              >
                {cap}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Personality Traits */}
      {agent.personality_traits && agent.personality_traits.length > 0 && (
        <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-6">
          <h2 className="text-lg font-semibold text-neutral-100 mb-4 flex items-center gap-2">
            <Bot className="w-5 h-5 text-green-400" />
            Personality
          </h2>
          <div className="flex flex-wrap gap-2">
            {agent.personality_traits.map((trait, i) => (
              <span
                key={i}
                className="px-3 py-1.5 bg-green-900/30 text-green-300 rounded-lg text-sm border border-green-800"
              >
                {trait}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Technical Details */}
      <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-6">
        <h2 className="text-lg font-semibold text-neutral-100 mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-yellow-400" />
          Technical Details
        </h2>
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-sm text-neutral-500">Model</dt>
            <dd className="text-neutral-100 font-medium">{agent.model || 'Not specified'}</dd>
          </div>
          <div>
            <dt className="text-sm text-neutral-500">Created</dt>
            <dd className="text-neutral-100 font-medium">
              {new Date(agent.created_at).toLocaleDateString()}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-neutral-500">Trust Tier</dt>
            <dd className="text-neutral-100 font-medium capitalize">{agent.trust_tier || 'Untrusted'}</dd>
          </div>
          <div>
            <dt className="text-sm text-neutral-500">Agent ID</dt>
            <dd className="text-neutral-100 font-mono text-sm">{agent.id.substring(0, 8)}...</dd>
          </div>
        </dl>
      </div>

      {/* Trust Benefits */}
      <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-6">
        <h2 className="text-lg font-semibold text-neutral-100 mb-4 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-400" />
          Governance Benefits
        </h2>
        <ul className="space-y-3">
          <li className="flex items-center gap-3 text-neutral-300">
            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
            Council-governed high-risk decisions
          </li>
          <li className="flex items-center gap-3 text-neutral-300">
            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
            Full Observer audit trail for all actions
          </li>
          <li className="flex items-center gap-3 text-neutral-300">
            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
            Truth Chain verification and accountability
          </li>
          <li className="flex items-center gap-3 text-neutral-300">
            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
            Circuit breaker emergency controls
          </li>
        </ul>
      </div>

      {/* Acquire Modal */}
      <AcquireModal
        agent={agent}
        isOpen={showAcquireModal}
        onClose={() => setShowAcquireModal(false)}
        onSuccess={(model, agentId) => {
          router.push('/agents')
        }}
      />
    </div>
  )
}
