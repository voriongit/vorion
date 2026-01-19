'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Shield,
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  BarChart3,
  Users,
  Zap,
} from 'lucide-react'

interface TrustMetrics {
  timestamp: string
  summary: {
    totalAgents: number
    averageScore: number
    medianScore: number
    agentsWithAcceleratedDecay: number
    agentsWithAcceleratedRecovery: number
  }
  tierDistribution: Array<{ level: number; name: string; count: number }>
  scoreDistribution: Record<string, number>
  componentAverages: {
    behavioral: number
    compliance: number
    identity: number
    context: number
  }
  healthIndicators: {
    healthyAgents: number
    warningAgents: number
    criticalAgents: number
  }
  topPerformers: Array<{
    agentId: string
    score: number
    level: number
    levelName: string
  }>
  needsAttention: Array<{
    agentId: string
    score: number
    level: number
    levelName: string
    reason: string
  }>
  recentChanges: Array<{
    agentId: string
    score: number
    level: number
    updatedAt: string
  }>
  agents: Array<{
    agentId: string
    score: number
    level: number
    levelName: string
    tier: string
    consecutiveSuccesses: number
    acceleratedDecayActive: boolean
    acceleratedRecoveryActive: boolean
  }>
}

export default function TrustMetricsPage() {
  const [metrics, setMetrics] = useState<TrustMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/trust-metrics')
      if (!response.ok) {
        throw new Error('Failed to fetch metrics')
      }
      const data = await response.json()
      setMetrics(data)
      setLastRefresh(new Date())
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMetrics()
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchMetrics, 30000)
    return () => clearInterval(interval)
  }, [fetchMetrics])

  const getTierColor = (level: number) => {
    const colors: Record<number, string> = {
      0: 'text-red-400',
      1: 'text-orange-400',
      2: 'text-yellow-400',
      3: 'text-blue-400',
      4: 'text-indigo-400',
      5: 'text-green-400',
    }
    return colors[level] || 'text-neutral-400'
  }

  const getScoreColor = (score: number) => {
    if (score >= 800) return 'text-green-400'
    if (score >= 500) return 'text-blue-400'
    if (score >= 300) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getHealthColor = (type: 'healthy' | 'warning' | 'critical') => {
    switch (type) {
      case 'healthy':
        return 'bg-green-900/30 text-green-400'
      case 'warning':
        return 'bg-yellow-900/30 text-yellow-400'
      case 'critical':
        return 'bg-red-900/30 text-red-400'
    }
  }

  if (loading && !metrics) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100 flex items-center gap-3">
            <Shield className="w-7 h-7 text-blue-400" />
            Trust Metrics Observatory
          </h1>
          <p className="text-neutral-400 mt-1">
            Real-time monitoring of AI agent trust scores and governance health
          </p>
        </div>

        <div className="flex items-center gap-4">
          {lastRefresh && (
            <span className="text-xs text-neutral-500">
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchMetrics}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-neutral-100 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}

      {metrics && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-900/30">
                  <Users className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-neutral-100">
                    {metrics.summary.totalAgents}
                  </p>
                  <p className="text-xs text-neutral-500">Total Agents</p>
                </div>
              </div>
            </div>

            <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-900/30">
                  <BarChart3 className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className={`text-2xl font-bold ${getScoreColor(metrics.summary.averageScore)}`}>
                    {metrics.summary.averageScore}
                  </p>
                  <p className="text-xs text-neutral-500">Avg Score</p>
                </div>
              </div>
            </div>

            <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-900/30">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-400">
                    {metrics.summary.agentsWithAcceleratedRecovery}
                  </p>
                  <p className="text-xs text-neutral-500">In Recovery</p>
                </div>
              </div>
            </div>

            <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-900/30">
                  <TrendingDown className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-orange-400">
                    {metrics.summary.agentsWithAcceleratedDecay}
                  </p>
                  <p className="text-xs text-neutral-500">In Decay</p>
                </div>
              </div>
            </div>

            <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-900/30">
                  <Activity className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-neutral-100">
                    {metrics.summary.medianScore}
                  </p>
                  <p className="text-xs text-neutral-500">Median Score</p>
                </div>
              </div>
            </div>
          </div>

          {/* Health Indicators */}
          <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-6">
            <h2 className="text-lg font-semibold text-neutral-100 mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-400" />
              Fleet Health
            </h2>
            <div className="grid grid-cols-3 gap-4">
              <div className={`rounded-lg p-4 ${getHealthColor('healthy')}`}>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">Healthy</span>
                </div>
                <p className="text-3xl font-bold">{metrics.healthIndicators.healthyAgents}</p>
                <p className="text-sm opacity-75">Score ≥ 500</p>
              </div>

              <div className={`rounded-lg p-4 ${getHealthColor('warning')}`}>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="font-medium">Warning</span>
                </div>
                <p className="text-3xl font-bold">{metrics.healthIndicators.warningAgents}</p>
                <p className="text-sm opacity-75">Score 200-499</p>
              </div>

              <div className={`rounded-lg p-4 ${getHealthColor('critical')}`}>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="font-medium">Critical</span>
                </div>
                <p className="text-3xl font-bold">{metrics.healthIndicators.criticalAgents}</p>
                <p className="text-sm opacity-75">Score &lt; 200</p>
              </div>
            </div>
          </div>

          {/* Component Scores & Tier Distribution */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Component Averages */}
            <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-6">
              <h2 className="text-lg font-semibold text-neutral-100 mb-4">
                Component Scores (Fleet Average)
              </h2>
              <div className="space-y-4">
                {Object.entries(metrics.componentAverages).map(([key, value]) => (
                  <div key={key}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-neutral-400 capitalize">{key}</span>
                      <span className="text-neutral-100">{(value * 100).toFixed(0)}%</span>
                    </div>
                    <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${value * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tier Distribution */}
            <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-6">
              <h2 className="text-lg font-semibold text-neutral-100 mb-4">
                Trust Tier Distribution
              </h2>
              <div className="space-y-3">
                {metrics.tierDistribution.length > 0 ? (
                  metrics.tierDistribution.map((tier) => (
                    <div key={tier.level} className="flex items-center gap-3">
                      <span className={`w-24 text-sm ${getTierColor(tier.level)}`}>
                        {tier.name}
                      </span>
                      <div className="flex-1 h-6 bg-neutral-800 rounded overflow-hidden">
                        <div
                          className={`h-full ${tier.level >= 4 ? 'bg-green-600' : tier.level >= 2 ? 'bg-blue-600' : 'bg-orange-600'} rounded transition-all`}
                          style={{
                            width: `${metrics.summary.totalAgents > 0 ? (tier.count / metrics.summary.totalAgents) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <span className="w-8 text-sm text-neutral-400 text-right">{tier.count}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-neutral-500 text-sm">No tier data available</p>
                )}
              </div>
            </div>
          </div>

          {/* Top Performers & Needs Attention */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top Performers */}
            <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-6">
              <h2 className="text-lg font-semibold text-neutral-100 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-400" />
                Top Performers
              </h2>
              {metrics.topPerformers.length > 0 ? (
                <div className="space-y-3">
                  {metrics.topPerformers.map((agent, idx) => (
                    <div
                      key={agent.agentId}
                      className="flex items-center justify-between p-3 bg-neutral-800/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-neutral-500">#{idx + 1}</span>
                        <div>
                          <p className="text-sm font-medium text-neutral-100 truncate max-w-[150px]">
                            {agent.agentId}
                          </p>
                          <p className={`text-xs ${getTierColor(agent.level)}`}>
                            {agent.levelName}
                          </p>
                        </div>
                      </div>
                      <span className={`text-lg font-bold ${getScoreColor(agent.score)}`}>
                        {agent.score}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-neutral-500 text-sm">No agents yet</p>
              )}
            </div>

            {/* Needs Attention */}
            <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-6">
              <h2 className="text-lg font-semibold text-neutral-100 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-400" />
                Needs Attention
              </h2>
              {metrics.needsAttention.length > 0 ? (
                <div className="space-y-3">
                  {metrics.needsAttention.map((agent) => (
                    <div
                      key={agent.agentId}
                      className="flex items-center justify-between p-3 bg-red-900/20 border border-red-800/50 rounded-lg"
                    >
                      <div>
                        <p className="text-sm font-medium text-neutral-100 truncate max-w-[150px]">
                          {agent.agentId}
                        </p>
                        <p className="text-xs text-orange-400">{agent.reason}</p>
                      </div>
                      <span className={`text-lg font-bold ${getScoreColor(agent.score)}`}>
                        {agent.score}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-2" />
                  <p className="text-green-400">All agents healthy</p>
                </div>
              )}
            </div>
          </div>

          {/* All Agents Table */}
          <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-6">
            <h2 className="text-lg font-semibold text-neutral-100 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              All Agents
            </h2>
            {metrics.agents.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-neutral-400 border-b border-neutral-800">
                      <th className="pb-3 font-medium">Agent ID</th>
                      <th className="pb-3 font-medium">Score</th>
                      <th className="pb-3 font-medium">Tier</th>
                      <th className="pb-3 font-medium">Streak</th>
                      <th className="pb-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800">
                    {metrics.agents.map((agent) => (
                      <tr key={agent.agentId} className="hover:bg-neutral-800/50">
                        <td className="py-3 font-medium text-neutral-100">
                          {agent.agentId}
                        </td>
                        <td className={`py-3 font-bold ${getScoreColor(agent.score)}`}>
                          {agent.score}
                        </td>
                        <td className={`py-3 ${getTierColor(agent.level)}`}>
                          {agent.levelName}
                        </td>
                        <td className="py-3 text-neutral-400">
                          {agent.consecutiveSuccesses > 0 && (
                            <span className="flex items-center gap-1 text-green-400">
                              <Zap className="w-3 h-3" />
                              {agent.consecutiveSuccesses}
                            </span>
                          )}
                        </td>
                        <td className="py-3">
                          {agent.acceleratedRecoveryActive && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-900/30 text-green-400 rounded">
                              <TrendingUp className="w-3 h-3" />
                              Recovery
                            </span>
                          )}
                          {agent.acceleratedDecayActive && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-orange-900/30 text-orange-400 rounded">
                              <TrendingDown className="w-3 h-3" />
                              Decay
                            </span>
                          )}
                          {!agent.acceleratedRecoveryActive && !agent.acceleratedDecayActive && (
                            <span className="text-neutral-500">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-neutral-500 text-center py-8">No agents in trust engine yet</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
