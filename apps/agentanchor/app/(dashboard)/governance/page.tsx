'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Scale, Shield, BookOpen, Heart, Loader2, AlertTriangle, CheckCircle, XCircle, HelpCircle, Search, Tag, Clock, TrendingUp, ArrowRight, Bot, Zap } from 'lucide-react'

interface PolicyRule {
  id: string
  name: string
  description: string
  action_type: string
  risk_level: number
  enabled: boolean
}

interface RiskLevel {
  level: number
  name: string
  description: string
  approval: string
}

interface GovernanceDecision {
  id: string
  agent_id: string
  agent_name?: string
  action_type: string
  decision: 'allow' | 'deny' | 'escalate' | 'degrade'
  risk_level: number
  reasoning: string
  constraints?: Record<string, unknown>
  created_at: string
}

interface GovernanceStats {
  total_decisions: number
  decisions_today: number
  allow_rate: number
  escalation_rate: number
  avg_response_ms: number
}

const decisionColors: Record<string, string> = {
  allow: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  deny: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  escalate: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  degrade: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
}

const decisionIcons: Record<string, any> = {
  allow: CheckCircle,
  deny: XCircle,
  escalate: AlertTriangle,
  degrade: Zap,
}

export default function GovernancePage() {
  const [decisions, setDecisions] = useState<GovernanceDecision[]>([])
  const [stats, setStats] = useState<GovernanceStats | null>(null)
  const [riskLevels, setRiskLevels] = useState<RiskLevel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadGovernanceData()
  }, [])

  const loadGovernanceData = async () => {
    try {
      setLoading(true)

      // Load risk levels and sample decisions
      const [validatorsRes, decisionsRes] = await Promise.all([
        fetch('/api/council/validators'),
        fetch('/api/decisions?limit=10'),
      ])

      if (validatorsRes.ok) {
        const data = await validatorsRes.json()
        setRiskLevels(data.riskLevels || [])
      }

      if (decisionsRes.ok) {
        const data = await decisionsRes.json()
        setDecisions(data.decisions || [])
        setStats(data.stats || null)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Scale className="h-8 w-8 text-purple-600" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Governance
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl">
            Real-time policy enforcement for AI agent actions. Every decision is evaluated
            against your governance rules with full auditability.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 text-red-700 dark:text-red-400 rounded-lg">
            {error}
          </div>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="card">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats?.total_decisions?.toLocaleString() || '—'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Decisions</p>
          </div>
          <div className="card">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats?.decisions_today?.toLocaleString() || '—'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Today</p>
          </div>
          <div className="card">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {stats?.allow_rate ? `${(stats.allow_rate * 100).toFixed(1)}%` : '—'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Allow Rate</p>
          </div>
          <div className="card">
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {stats?.escalation_rate ? `${(stats.escalation_rate * 100).toFixed(1)}%` : '—'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Escalation Rate</p>
          </div>
          <div className="card">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats?.avg_response_ms ? `${stats.avg_response_ms}ms` : '—'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Avg Latency</p>
          </div>
        </div>

        {/* Governance Flow Diagram */}
        <div className="card mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Governance Flow
          </h2>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center gap-2 text-center">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <Bot className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900 dark:text-white">Agent Request</p>
                <p className="text-xs text-gray-500">Action intent submitted</p>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-gray-400 hidden md:block" />
            <div className="flex items-center gap-2 text-center">
              <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                <Scale className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900 dark:text-white">ENFORCE</p>
                <p className="text-xs text-gray-500">Policy evaluation</p>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-gray-400 hidden md:block" />
            <div className="flex items-center gap-2 text-center">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900 dark:text-white">Decision</p>
                <p className="text-xs text-gray-500">ALLOW / DENY / ESCALATE</p>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-gray-400 hidden md:block" />
            <div className="flex items-center gap-2 text-center">
              <div className="w-10 h-10 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg flex items-center justify-center">
                <Shield className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900 dark:text-white">PROOF</p>
                <p className="text-xs text-gray-500">Audit record created</p>
              </div>
            </div>
          </div>
        </div>

        {/* Risk Levels */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Risk Classification
          </h2>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Level
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Example Actions
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Trust Required
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {riskLevels.map((level) => (
                  <tr key={level.level} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                        level.level <= 1 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        level.level === 2 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                        level.level === 3 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        L{level.level}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      {level.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {level.description}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {level.approval}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Decisions */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Recent Decisions
            </h2>
            <Link
              href="/audit"
              className="text-sm text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
            >
              View full audit trail
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {decisions.length === 0 ? (
            <div className="card text-center py-8">
              <Scale className="h-12 w-12 mx-auto text-gray-400 mb-3" />
              <p className="text-gray-600 dark:text-gray-400">
                No governance decisions yet
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                Decisions will appear here as agents request actions
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {decisions.map((decision) => {
                const DecisionIcon = decisionIcons[decision.decision] || HelpCircle
                return (
                  <div
                    key={decision.id}
                    className="card hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold ${
                            decision.risk_level <= 1 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                            decision.risk_level === 2 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                            decision.risk_level === 3 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                            'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            L{decision.risk_level}
                          </span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${decisionColors[decision.decision]}`}>
                            <DecisionIcon className="h-3 w-3" />
                            {decision.decision.toUpperCase()}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-500">
                            {formatDate(decision.created_at)}
                          </span>
                        </div>
                        <h3 className="font-medium text-gray-900 dark:text-white">
                          {decision.action_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </h3>
                        {decision.agent_name && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Agent: {decision.agent_name}
                          </p>
                        )}
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                          {decision.reasoning}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/escalations" className="card hover:shadow-lg transition-shadow group">
            <div className="flex items-center gap-3 mb-2">
              <AlertTriangle className="h-6 w-6 text-yellow-500" />
              <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                Review Escalations
              </h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              High-risk decisions requiring human approval
            </p>
          </Link>

          <Link href="/compliance" className="card hover:shadow-lg transition-shadow group">
            <div className="flex items-center gap-3 mb-2">
              <Shield className="h-6 w-6 text-green-500" />
              <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                Compliance Reports
              </h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Generate EU AI Act, ISO 42001 reports
            </p>
          </Link>

          <Link href="/audit" className="card hover:shadow-lg transition-shadow group">
            <div className="flex items-center gap-3 mb-2">
              <BookOpen className="h-6 w-6 text-blue-500" />
              <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                Audit Trail
              </h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Full cryptographic proof chain
            </p>
          </Link>
        </div>
      </div>
    </div>
  )
}
