'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Scale,
  Shield,
  Eye,
  Loader2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  ArrowRight,
  Bot,
  Zap,
  FileCheck,
  LayoutGrid,
  List,
  Filter,
  RefreshCw
} from 'lucide-react'

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
  decision: 'allow' | 'deny' | 'escalate' | 'degrade' | 'pending'
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

const decisionConfig: Record<string, { color: string; gradient: string; icon: any; label: string }> = {
  allow: {
    color: 'text-emerald-600 dark:text-emerald-400',
    gradient: 'from-emerald-500 to-green-600',
    icon: CheckCircle,
    label: 'ALLOW'
  },
  deny: {
    color: 'text-red-600 dark:text-red-400',
    gradient: 'from-red-500 to-rose-600',
    icon: XCircle,
    label: 'DENY'
  },
  escalate: {
    color: 'text-amber-600 dark:text-amber-400',
    gradient: 'from-amber-500 to-orange-600',
    icon: AlertTriangle,
    label: 'ESCALATE'
  },
  degrade: {
    color: 'text-orange-600 dark:text-orange-400',
    gradient: 'from-orange-500 to-red-600',
    icon: Zap,
    label: 'DEGRADE'
  },
  pending: {
    color: 'text-blue-600 dark:text-blue-400',
    gradient: 'from-blue-500 to-indigo-600',
    icon: Clock,
    label: 'PENDING'
  },
}

const riskColors: Record<number, string> = {
  0: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400',
  1: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400',
  2: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400',
  3: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400',
  4: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400',
}

export default function GovernancePage() {
  const [decisions, setDecisions] = useState<GovernanceDecision[]>([])
  const [stats, setStats] = useState<GovernanceStats | null>(null)
  const [riskLevels, setRiskLevels] = useState<RiskLevel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [filter, setFilter] = useState<'all' | 'allow' | 'deny' | 'escalate'>('all')

  useEffect(() => {
    loadGovernanceData()
  }, [])

  const loadGovernanceData = async () => {
    try {
      setLoading(true)
      const [validatorsRes, decisionsRes] = await Promise.all([
        fetch('/api/council/validators'),
        fetch('/api/decisions?limit=20'),
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

  const filteredDecisions = decisions.filter(d => {
    if (filter === 'all') return true
    return d.decision === filter
  })

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
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading governance data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-800">
      <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
        <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2 sm:gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
                  <Scale className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                Governance
              </h1>
              <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-1 sm:mt-2">
                Real-time policy enforcement for AI agent actions
              </p>
            </div>
            <button
              onClick={loadGovernanceData}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>

          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl text-sm">
              {error}
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
            <MetricCard
              title="Total Decisions"
              value={stats?.total_decisions?.toLocaleString() || '0'}
              icon={Scale}
              gradient="from-purple-500 to-indigo-600"
            />
            <MetricCard
              title="Today"
              value={stats?.decisions_today?.toLocaleString() || '0'}
              icon={Clock}
              gradient="from-blue-500 to-cyan-600"
            />
            <MetricCard
              title="Allow Rate"
              value={stats?.allow_rate ? `${(stats.allow_rate * 100).toFixed(0)}%` : '—'}
              icon={CheckCircle}
              gradient="from-emerald-500 to-green-600"
            />
            <MetricCard
              title="Escalation Rate"
              value={stats?.escalation_rate ? `${(stats.escalation_rate * 100).toFixed(0)}%` : '—'}
              icon={AlertTriangle}
              gradient="from-amber-500 to-orange-600"
            />
            <MetricCard
              title="Avg Latency"
              value={stats?.avg_response_ms ? `${stats.avg_response_ms}ms` : '—'}
              icon={Zap}
              gradient="from-pink-500 to-rose-600"
              className="col-span-2 lg:col-span-1"
            />
          </div>

          {/* Governance Flow */}
          <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6 overflow-x-auto">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Governance Flow
            </h2>
            <div className="flex items-center justify-between min-w-[600px] sm:min-w-0 gap-2 sm:gap-4">
              <FlowStep icon={Bot} label="Agent Request" sublabel="Intent submitted" color="from-blue-500 to-indigo-600" />
              <FlowArrow />
              <FlowStep icon={Scale} label="ENFORCE" sublabel="Policy check" color="from-purple-500 to-violet-600" />
              <FlowArrow />
              <FlowStep icon={CheckCircle} label="Decision" sublabel="ALLOW / DENY" color="from-emerald-500 to-green-600" />
              <FlowArrow />
              <FlowStep icon={Shield} label="PROOF" sublabel="Audit record" color="from-cyan-500 to-blue-600" />
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <QuickActionCard
              href="/escalations"
              icon={AlertTriangle}
              title="Review Escalations"
              description="High-risk decisions requiring approval"
              gradient="from-amber-500 to-orange-600"
            />
            <QuickActionCard
              href="/compliance"
              icon={Shield}
              title="Compliance Reports"
              description="EU AI Act, ISO 42001 exports"
              gradient="from-emerald-500 to-green-600"
            />
            <QuickActionCard
              href="/audit"
              icon={FileCheck}
              title="Audit Trail"
              description="Cryptographic proof chain"
              gradient="from-blue-500 to-indigo-600"
            />
          </div>

          {/* Recent Decisions */}
          <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Controls */}
            <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                  Recent Decisions
                </h2>
                <div className="flex items-center gap-2">
                  {/* Filter */}
                  <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <select
                      value={filter}
                      onChange={(e) => setFilter(e.target.value as typeof filter)}
                      className="pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="all">All Decisions</option>
                      <option value="allow">Allowed</option>
                      <option value="deny">Denied</option>
                      <option value="escalate">Escalated</option>
                    </select>
                  </div>
                  {/* View Toggle */}
                  <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-2 rounded-md transition-colors ${
                        viewMode === 'grid'
                          ? 'bg-white dark:bg-gray-600 text-purple-600 dark:text-purple-400 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                      }`}
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`p-2 rounded-md transition-colors ${
                        viewMode === 'list'
                          ? 'bg-white dark:bg-gray-600 text-purple-600 dark:text-purple-400 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                      }`}
                    >
                      <List className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Decisions */}
            <div className="p-4 sm:p-6">
              {filteredDecisions.length === 0 ? (
                <div className="text-center py-12">
                  <Scale className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">No decisions found</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                    Decisions will appear here as agents request actions
                  </p>
                </div>
              ) : (
                <div className={
                  viewMode === 'grid'
                    ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4'
                    : 'space-y-3'
                }>
                  {filteredDecisions.map((decision) => (
                    <DecisionCard
                      key={decision.id}
                      decision={decision}
                      viewMode={viewMode}
                      formatDate={formatDate}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Footer Link */}
            <div className="px-4 sm:px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
              <Link
                href="/audit"
                className="flex items-center justify-center gap-2 text-sm font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
              >
                View full audit trail
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Risk Classification Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                Risk Classification
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px]">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Level</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">Actions</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Trust Required</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {riskLevels.map((level) => (
                    <tr key={level.level} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-4 sm:px-6 py-4">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold ${riskColors[level.level] || riskColors[4]}`}>
                          L{level.level}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 font-medium text-gray-900 dark:text-white">
                        {level.name}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                        {level.description}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {level.approval}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

function MetricCard({
  title,
  value,
  icon: Icon,
  gradient,
  className = ''
}: {
  title: string
  value: string
  icon: any
  gradient: string
  className?: string
}) {
  return (
    <div className={`group bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-5 hover:shadow-xl transition-all duration-300 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
          <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
        </div>
      </div>
      <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">{title}</p>
    </div>
  )
}

function FlowStep({ icon: Icon, label, sublabel, color }: { icon: any; label: string; sublabel: string; color: string }) {
  return (
    <div className="flex flex-col items-center text-center flex-1">
      <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-lg mb-2`}>
        <Icon className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
      </div>
      <p className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">{label}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400">{sublabel}</p>
    </div>
  )
}

function FlowArrow() {
  return (
    <div className="flex-shrink-0">
      <ArrowRight className="h-5 w-5 text-gray-300 dark:text-gray-600" />
    </div>
  )
}

function QuickActionCard({ href, icon: Icon, title, description, gradient }: { href: string; icon: any; title: string; description: string; gradient: string }) {
  return (
    <Link
      href={href}
      className="group relative bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-5 hover:shadow-xl transition-all duration-300 active:scale-95 touch-manipulation"
    >
      {/* Gradient overlay on hover */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} rounded-xl sm:rounded-2xl opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />

      <div className="relative flex items-start gap-3 sm:gap-4">
        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300 flex-shrink-0`}>
          <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
            {title}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {description}
          </p>
        </div>
        <ArrowRight className="h-5 w-5 text-gray-300 dark:text-gray-600 group-hover:text-purple-500 group-hover:translate-x-1 transition-all flex-shrink-0" />
      </div>
    </Link>
  )
}

function DecisionCard({ decision, viewMode, formatDate }: { decision: GovernanceDecision; viewMode: 'grid' | 'list'; formatDate: (d: string) => string }) {
  const config = decisionConfig[decision.decision] || decisionConfig.allow
  const DecisionIcon = config.icon

  if (viewMode === 'list') {
    return (
      <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors">
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${config.gradient} flex items-center justify-center flex-shrink-0`}>
          <DecisionIcon className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold ${riskColors[decision.risk_level] || riskColors[4]}`}>
              L{decision.risk_level}
            </span>
            <span className={`text-xs font-semibold ${config.color}`}>{config.label}</span>
            <span className="text-xs text-gray-400">•</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">{formatDate(decision.created_at)}</span>
          </div>
          <p className="font-medium text-gray-900 dark:text-white mt-1 truncate">
            {decision.action_type?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Unknown Action'}
          </p>
          {decision.agent_name && (
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">Agent: {decision.agent_name}</p>
          )}
        </div>
        <ArrowRight className="h-5 w-5 text-gray-300 dark:text-gray-600 flex-shrink-0" />
      </div>
    )
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${config.gradient} flex items-center justify-center flex-shrink-0`}>
          <DecisionIcon className="h-5 w-5 text-white" />
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold ${riskColors[decision.risk_level] || riskColors[4]}`}>
            L{decision.risk_level}
          </span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${config.color} bg-opacity-10`} style={{ backgroundColor: 'currentColor', opacity: 0.1 }}>
            <span className={config.color}>{config.label}</span>
          </span>
        </div>
      </div>
      <h3 className="font-medium text-gray-900 dark:text-white mb-1">
        {decision.action_type?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Unknown Action'}
      </h3>
      {decision.agent_name && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Agent: {decision.agent_name}</p>
      )}
      <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
        {decision.reasoning || 'No reasoning provided'}
      </p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
        {formatDate(decision.created_at)}
      </p>
    </div>
  )
}
