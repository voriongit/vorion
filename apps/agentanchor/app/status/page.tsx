'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Activity,
  Shield,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Server,
  Database,
  Users,
  TrendingUp,
  Clock,
  FileCheck,
  Zap,
  Lock,
} from 'lucide-react'

interface DashboardStats {
  my_agents: number
  agents_active: number
  agents_sandbox: number
  average_trust_score: number
  total_decisions: number
  decisions_today: number
  allow_rate: number
  total_tasks: number
  this_month_tasks: number
  pending_escalations: number
}

interface TruthChainStats {
  total_records: number
  latest_sequence: number
  chain_valid: boolean
  records_by_type: Record<string, number>
}

export default function PublicStatusPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [chainStats, setChainStats] = useState<TruthChainStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [serviceStatus, setServiceStatus] = useState<'online' | 'degraded' | 'offline'>('online')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [dashRes, chainRes] = await Promise.all([
        fetch('/api/dashboard').catch(() => null),
        fetch('/api/truth-chain?stats=true').catch(() => null),
      ])

      if (dashRes?.ok) {
        const data = await dashRes.json()
        setStats(data.stats)
        setServiceStatus('online')
      } else {
        setServiceStatus('degraded')
      }

      if (chainRes?.ok) {
        const data = await chainRes.json()
        setChainStats(data)
      }
    } catch {
      setServiceStatus('offline')
    } finally {
      setLoading(false)
      setLastUpdate(new Date())
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 60000)
    return () => clearInterval(interval)
  }, [fetchData])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AgentAnchor Status</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Real-time platform health & metrics</p>
              </div>
            </div>
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Open Dashboard
              <ExternalLink className="w-4 h-4" />
            </Link>
          </div>

          {/* Status Banner */}
          <div className={`mt-6 flex items-center gap-3 px-4 py-3 rounded-xl ${
            serviceStatus === 'online' ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800' :
            serviceStatus === 'degraded' ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800' :
            'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
          }`}>
            <span className={`w-3 h-3 rounded-full ${
              serviceStatus === 'online' ? 'bg-emerald-500' :
              serviceStatus === 'degraded' ? 'bg-amber-500 animate-pulse' :
              'bg-red-500 animate-pulse'
            }`} />
            <span className={`font-medium ${
              serviceStatus === 'online' ? 'text-emerald-700 dark:text-emerald-400' :
              serviceStatus === 'degraded' ? 'text-amber-700 dark:text-amber-400' :
              'text-red-700 dark:text-red-400'
            }`}>
              {serviceStatus === 'online' ? 'All Systems Operational' :
               serviceStatus === 'degraded' ? 'Partial Degradation' :
               'Service Unavailable'}
            </span>
            <span className="text-gray-500 dark:text-gray-400 text-sm ml-auto">
              Updated: {lastUpdate.toLocaleTimeString()}
            </span>
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 hover:bg-white/50 dark:hover:bg-black/20 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={Users}
            label="Active Agents"
            value={stats?.agents_active?.toString() || '—'}
            color="purple"
          />
          <StatCard
            icon={TrendingUp}
            label="Avg Trust Score"
            value={stats?.average_trust_score ? `${Math.round(stats.average_trust_score)}` : '—'}
            color="green"
          />
          <StatCard
            icon={Shield}
            label="Total Decisions"
            value={stats?.total_decisions?.toLocaleString() || '—'}
            color="blue"
          />
          <StatCard
            icon={AlertTriangle}
            label="Pending Escalations"
            value={stats?.pending_escalations?.toString() || '0'}
            color={stats?.pending_escalations && stats.pending_escalations > 0 ? 'amber' : 'green'}
          />
        </div>

        {/* Truth Chain Status */}
        <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="p-5 border-b border-gray-200 dark:border-gray-800 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600">
              <FileCheck className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Truth Chain</h2>
            <span className="text-sm text-gray-500 dark:text-gray-400 ml-auto">Immutable audit ledger</span>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Records</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {chainStats?.total_records?.toLocaleString() || '—'}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Latest Sequence</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {chainStats?.latest_sequence ? `#${chainStats.latest_sequence}` : '—'}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Chain Integrity</div>
                <div className={`text-2xl font-bold ${
                  chainStats?.chain_valid === true ? 'text-emerald-500' :
                  chainStats?.chain_valid === false ? 'text-red-500' :
                  'text-gray-400'
                }`}>
                  {chainStats?.chain_valid === true ? 'Valid' :
                   chainStats?.chain_valid === false ? 'Invalid' : '—'}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Record Types</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {chainStats?.records_by_type ? Object.keys(chainStats.records_by_type).length : '—'}
                </div>
              </div>
            </div>

            {/* Record Types Breakdown */}
            {chainStats?.records_by_type && Object.keys(chainStats.records_by_type).length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-800">
                <div className="text-sm text-gray-500 mb-3">Records by Type</div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(chainStats.records_by_type).map(([type, count]) => (
                    <div
                      key={type}
                      className="px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-sm"
                    >
                      <span className="font-semibold text-gray-900 dark:text-white">{count}</span>
                      <span className="text-gray-500 dark:text-gray-400 ml-1">{type.replace(/_/g, ' ')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Platform Metrics */}
        <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="p-5 border-b border-gray-200 dark:border-gray-800 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Platform Metrics</h2>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Decisions Today</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats?.decisions_today?.toLocaleString() || '0'}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Allow Rate</div>
                <div className={`text-2xl font-bold ${
                  (stats?.allow_rate || 0) > 0.8 ? 'text-emerald-500' :
                  (stats?.allow_rate || 0) > 0.5 ? 'text-amber-500' :
                  'text-red-500'
                }`}>
                  {stats?.allow_rate ? `${(stats.allow_rate * 100).toFixed(1)}%` : '—'}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Tasks This Month</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats?.this_month_tasks?.toLocaleString() || '0'}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Quick Links */}
        <section className="grid md:grid-cols-3 gap-4">
          <QuickLink
            href="/audit"
            icon={FileCheck}
            title="Audit Trail"
            description="View cryptographic proof chain"
          />
          <QuickLink
            href="/compliance"
            icon={Shield}
            title="Compliance Reports"
            description="EU AI Act & ISO 42001"
          />
          <QuickLink
            href="/escalations"
            icon={AlertTriangle}
            title="Escalations"
            description="Human review queue"
          />
        </section>

        {/* Footer */}
        <div className="text-center text-gray-500 dark:text-gray-400 text-sm pt-8">
          <p>AgentAnchor - Enterprise AI Agent Governance Platform</p>
          <p className="mt-1">
            Part of the <a href="https://vorion.org" className="text-purple-500 hover:underline">VORION</a> ecosystem
          </p>
        </div>
      </main>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType
  label: string
  value: string
  color: 'purple' | 'green' | 'blue' | 'amber'
}) {
  const colorClasses = {
    purple: 'from-purple-500/10 to-purple-600/5 border-purple-500/20',
    green: 'from-emerald-500/10 to-emerald-600/5 border-emerald-500/20',
    blue: 'from-blue-500/10 to-blue-600/5 border-blue-500/20',
    amber: 'from-amber-500/10 to-amber-600/5 border-amber-500/20',
  }

  const iconColors = {
    purple: 'text-purple-500',
    green: 'text-emerald-500',
    blue: 'text-blue-500',
    amber: 'text-amber-500',
  }

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} rounded-xl border p-4`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</span>
        <Icon className={`w-4 h-4 ${iconColors[color]}`} />
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  )
}

function QuickLink({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string
  icon: React.ElementType
  title: string
  description: string
}) {
  return (
    <Link
      href={href}
      className="flex items-start gap-4 p-5 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-purple-500/50 dark:hover:border-purple-500/50 transition-colors group"
    >
      <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 group-hover:bg-purple-500/10 transition-colors">
        <Icon className="w-5 h-5 text-gray-500 group-hover:text-purple-500 transition-colors" />
      </div>
      <div>
        <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-purple-500 transition-colors">{title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
      </div>
    </Link>
  )
}
