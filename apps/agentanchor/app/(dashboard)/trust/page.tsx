'use client'

import { useState, useEffect } from 'react'
import {
  Shield,
  Award,
  TrendingUp,
  TrendingDown,
  Star,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Users,
  Activity
} from 'lucide-react'
import Link from 'next/link'

interface TrustCredential {
  id: string
  name: string
  type: 'badge' | 'certification' | 'endorsement'
  issued_at: string
  issuer: string
  agent_id?: string
}

interface AgentTrustSummary {
  id: string
  name: string
  trust_score: number
  tier: string
  trend: 'up' | 'down' | 'stable'
  last_updated: string
}

export default function TrustVaultPage() {
  const [agents, setAgents] = useState<AgentTrustSummary[]>([])
  const [credentials, setCredentials] = useState<TrustCredential[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/api/agents')
        if (response.ok) {
          const data = await response.json()
          setAgents(
            (data.agents || []).map((a: { id: string; name: string; trust_score?: number }) => ({
              id: a.id,
              name: a.name,
              trust_score: a.trust_score || 50,
              tier: getTier(a.trust_score || 50),
              trend: Math.random() > 0.5 ? 'up' : Math.random() > 0.5 ? 'down' : 'stable',
              last_updated: new Date().toISOString()
            }))
          )
        }

        // Simulated credentials
        setCredentials([
          {
            id: '1',
            name: 'Academy Graduate',
            type: 'certification',
            issued_at: new Date(Date.now() - 604800000).toISOString(),
            issuer: 'AgentAnchor Academy'
          },
          {
            id: '2',
            name: 'Ethics Verified',
            type: 'badge',
            issued_at: new Date(Date.now() - 1209600000).toISOString(),
            issuer: 'Council of Nine'
          }
        ])
      } catch (err) {
        console.error('Failed to fetch data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const getTier = (score: number) => {
    if (score >= 800) return 'Legendary'
    if (score >= 600) return 'Trusted'
    if (score >= 400) return 'Established'
    if (score >= 200) return 'Developing'
    if (score >= 100) return 'Probation'
    return 'Untrusted'
  }

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'Legendary':
        return 'text-purple-400 bg-purple-900/30'
      case 'Trusted':
        return 'text-blue-400 bg-blue-900/30'
      case 'Established':
        return 'text-green-400 bg-green-900/30'
      case 'Developing':
        return 'text-yellow-400 bg-yellow-900/30'
      case 'Probation':
        return 'text-orange-400 bg-orange-900/30'
      default:
        return 'text-red-400 bg-red-900/30'
    }
  }

  const totalScore = agents.reduce((sum, a) => sum + a.trust_score, 0)
  const avgScore = agents.length > 0 ? Math.round(totalScore / agents.length) : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-100 flex items-center gap-3">
          <Shield className="w-7 h-7 text-blue-400" />
          Trust Vault
        </h1>
        <p className="text-neutral-400 mt-1">
          Scores, credentials, and earned badges
        </p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-900/30">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-100">{agents.length}</p>
              <p className="text-xs text-neutral-500">Your Agents</p>
            </div>
          </div>
        </div>

        <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-900/30">
              <Activity className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-100">{avgScore}</p>
              <p className="text-xs text-neutral-500">Avg Trust Score</p>
            </div>
          </div>
        </div>

        <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-900/30">
              <Award className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-100">{credentials.length}</p>
              <p className="text-xs text-neutral-500">Credentials</p>
            </div>
          </div>
        </div>

        <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-900/30">
              <Star className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-100">
                {agents.filter(a => a.trust_score >= 600).length}
              </p>
              <p className="text-xs text-neutral-500">Trusted+</p>
            </div>
          </div>
        </div>
      </div>

      {/* Trust Tiers Legend */}
      <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
        <h3 className="text-sm font-medium text-neutral-400 mb-3">Trust Tiers</h3>
        <div className="flex flex-wrap gap-2">
          {[
            { tier: 'Legendary', range: '800+', color: 'purple' },
            { tier: 'Trusted', range: '600-799', color: 'blue' },
            { tier: 'Established', range: '400-599', color: 'green' },
            { tier: 'Developing', range: '200-399', color: 'yellow' },
            { tier: 'Probation', range: '100-199', color: 'orange' },
            { tier: 'Untrusted', range: '0-99', color: 'red' }
          ].map(({ tier, range, color }) => (
            <div
              key={tier}
              className={`px-3 py-1.5 rounded-lg bg-${color}-900/30 text-${color}-400 text-xs flex items-center gap-2`}
            >
              <span className="font-medium">{tier}</span>
              <span className="opacity-70">{range}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Agent Trust Scores */}
      <div className="bg-neutral-900 rounded-lg border border-neutral-800">
        <div className="p-4 border-b border-neutral-800">
          <h2 className="font-semibold text-neutral-100">Agent Trust Scores</h2>
        </div>

        {agents.length === 0 ? (
          <div className="p-8 text-center text-neutral-500">
            <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No agents yet. Create your first agent to see trust scores.</p>
            <Link
              href="/agents/new"
              className="inline-block mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create Agent
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-neutral-800">
            {agents.map((agent) => (
              <Link
                key={agent.id}
                href={`/agents/${agent.id}/trust`}
                className="flex items-center justify-between p-4 hover:bg-neutral-800/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                    {agent.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-medium text-neutral-100">{agent.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded ${getTierColor(agent.tier)}`}>
                      {agent.tier}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-lg font-bold text-neutral-100">{agent.trust_score}</p>
                    <div className="flex items-center gap-1 text-xs">
                      {agent.trend === 'up' && (
                        <>
                          <TrendingUp className="w-3 h-3 text-green-400" />
                          <span className="text-green-400">Rising</span>
                        </>
                      )}
                      {agent.trend === 'down' && (
                        <>
                          <TrendingDown className="w-3 h-3 text-red-400" />
                          <span className="text-red-400">Falling</span>
                        </>
                      )}
                      {agent.trend === 'stable' && (
                        <span className="text-neutral-500">Stable</span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Credentials */}
      <div className="bg-neutral-900 rounded-lg border border-neutral-800">
        <div className="p-4 border-b border-neutral-800">
          <h2 className="font-semibold text-neutral-100 flex items-center gap-2">
            <Award className="w-5 h-5 text-purple-400" />
            Earned Credentials
          </h2>
        </div>

        {credentials.length === 0 ? (
          <div className="p-8 text-center text-neutral-500">
            <Award className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No credentials earned yet. Complete training to earn badges.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
            {credentials.map((cred) => (
              <div
                key={cred.id}
                className="flex items-center gap-4 p-4 bg-neutral-800/50 rounded-lg"
              >
                <div className={`p-3 rounded-lg ${
                  cred.type === 'certification' ? 'bg-blue-900/30' :
                  cred.type === 'badge' ? 'bg-purple-900/30' :
                  'bg-green-900/30'
                }`}>
                  {cred.type === 'certification' ? (
                    <CheckCircle2 className="w-6 h-6 text-blue-400" />
                  ) : cred.type === 'badge' ? (
                    <Award className="w-6 h-6 text-purple-400" />
                  ) : (
                    <Star className="w-6 h-6 text-green-400" />
                  )}
                </div>
                <div>
                  <h3 className="font-medium text-neutral-100">{cred.name}</h3>
                  <p className="text-xs text-neutral-500">
                    Issued by {cred.issuer} on {new Date(cred.issued_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
