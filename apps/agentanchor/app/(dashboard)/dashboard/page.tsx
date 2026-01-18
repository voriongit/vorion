'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  LayoutDashboard,
  Bot,
  Shield,
  Eye,
  TrendingUp,
  Activity,
  AlertTriangle,
  MessageSquare,
  RefreshCw,
  ArrowRight,
  Scale,
  FileCheck,
  Zap,
  CheckCircle,
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

interface ActivityItem {
  id: string
  type: string
  title: string
  description: string
  agent_id?: string
  agent_name?: string
  created_at: string
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboard()
  }, [])

  async function fetchDashboard() {
    setLoading(true)
    try {
      const res = await fetch('/api/dashboard')
      if (res.ok) {
        const data = await res.json()
        setStats(data.stats)
        setActivity(data.activity || [])
      }
    } catch (err) {
      console.error('Failed to fetch dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 sm:p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25">
            <LayoutDashboard className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              Dashboard
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 hidden sm:block">
              Your AI governance command center
            </p>
          </div>
        </div>
        <button
          onClick={() => fetchDashboard()}
          className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors active:scale-95 touch-manipulation"
        >
          <RefreshCw className="w-4 h-4" />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Quick Journey - Horizontal scroll on mobile */}
      <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0 pb-2">
        <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 min-w-max sm:min-w-0">
          <JourneyCard
            step={1}
            title="Agents"
            description="Register & manage"
            href="/agents"
            icon={Bot}
            gradient="from-blue-500 to-cyan-500"
          />
          <JourneyCard
            step={2}
            title="Sandbox"
            description="Test safely"
            href="/sandbox"
            icon={Eye}
            gradient="from-green-500 to-emerald-500"
          />
          <JourneyCard
            step={3}
            title="Governance"
            description="Policies & rules"
            href="/governance"
            icon={Scale}
            gradient="from-purple-500 to-indigo-500"
          />
          <JourneyCard
            step={4}
            title="Analytics"
            description="Usage metrics"
            href="/usage"
            icon={TrendingUp}
            gradient="from-amber-500 to-orange-500"
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Total Agents"
          value={stats?.my_agents?.toString() || '0'}
          subtitle={`${stats?.agents_active || 0} active`}
          icon={Bot}
          gradient="from-blue-500 to-indigo-600"
          href="/agents"
        />
        <StatCard
          title="Trust Score"
          value={stats?.average_trust_score?.toString() || '—'}
          subtitle="Average"
          icon={TrendingUp}
          gradient="from-green-500 to-emerald-600"
        />
        <StatCard
          title="Decisions"
          value={stats?.decisions_today?.toString() || '0'}
          subtitle="Today"
          icon={Scale}
          gradient="from-purple-500 to-indigo-600"
          href="/governance"
        />
        <StatCard
          title="Escalations"
          value={stats?.pending_escalations?.toString() || '0'}
          subtitle={stats?.pending_escalations ? 'Pending' : 'All clear'}
          icon={AlertTriangle}
          gradient="from-amber-500 to-orange-600"
          alert={stats?.pending_escalations ? stats.pending_escalations > 0 : false}
          href="/escalations"
        />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Recent Activity */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
                <Activity className="w-4 h-4 text-white" />
              </div>
              <h2 className="font-semibold text-gray-900 dark:text-white">
                Recent Activity
              </h2>
            </div>
          </div>

          <div className="p-4 sm:p-5">
            {activity.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="p-3 rounded-full bg-gray-100 dark:bg-gray-700 mb-3">
                  <Activity className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Your activity will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {activity.slice(0, 5).map((item) => (
                  <ActivityCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Governance Status */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600">
                <Scale className="w-4 h-4 text-white" />
              </div>
              <h2 className="font-semibold text-gray-900 dark:text-white">
                Governance Status
              </h2>
            </div>
          </div>

          <div className="p-4 sm:p-5 space-y-2 sm:space-y-3">
            <GovernanceItem
              title="Governance"
              description="Policy enforcement"
              href="/governance"
              icon={Scale}
              status="active"
              gradient="from-purple-500 to-indigo-500"
            />
            <GovernanceItem
              title="Escalations"
              description="Human review"
              href="/escalations"
              icon={AlertTriangle}
              status={stats?.pending_escalations && stats.pending_escalations > 0 ? 'warning' : 'active'}
              gradient="from-amber-500 to-orange-500"
            />
            <GovernanceItem
              title="Observer"
              description="Real-time monitoring"
              href="/observer"
              icon={Eye}
              status="active"
              gradient="from-cyan-500 to-blue-500"
            />
            <GovernanceItem
              title="Audit Trail"
              description="Proof chain"
              href="/audit"
              icon={FileCheck}
              status="active"
              gradient="from-green-500 to-emerald-500"
            />
            <GovernanceItem
              title="Compliance"
              description="EU AI Act, ISO 42001"
              href="/compliance"
              icon={Shield}
              status="active"
              gradient="from-rose-500 to-pink-500"
            />
          </div>
        </div>
      </div>

      {/* Quick Actions - Mobile friendly bottom section */}
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <QuickAction
            title="New Agent"
            icon={Bot}
            href="/agents/new"
            gradient="from-blue-500 to-indigo-500"
          />
          <QuickAction
            title="Run Test"
            icon={Zap}
            href="/sandbox"
            gradient="from-green-500 to-emerald-500"
          />
          <QuickAction
            title="View Audit"
            icon={FileCheck}
            href="/audit"
            gradient="from-purple-500 to-indigo-500"
          />
          <QuickAction
            title="Compliance"
            icon={Shield}
            href="/compliance"
            gradient="from-rose-500 to-pink-500"
          />
        </div>
      </div>
    </div>
  )
}

function JourneyCard({
  step,
  title,
  description,
  href,
  icon: Icon,
  gradient,
}: {
  step: number
  title: string
  description: string
  href: string
  icon: React.ElementType
  gradient: string
}) {
  return (
    <Link
      href={href}
      className="flex-shrink-0 w-[140px] sm:w-auto p-3 sm:p-4 rounded-xl bg-white dark:bg-gray-800 border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200 active:scale-95 touch-manipulation group"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-gradient-to-r ${gradient} text-white`}>
          {step}
        </span>
        <div className={`p-1.5 rounded-lg bg-gradient-to-br ${gradient} opacity-80 group-hover:opacity-100 transition-opacity`}>
          <Icon className="w-3.5 h-3.5 text-white" />
        </div>
      </div>
      <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{title}</h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{description}</p>
    </Link>
  )
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  gradient,
  alert,
  href,
}: {
  title: string
  value: string
  subtitle: string
  icon: React.ElementType
  gradient: string
  alert?: boolean
  href?: string
}) {
  const content = (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4 shadow-sm ${href ? 'hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200 active:scale-[0.98]' : ''} touch-manipulation`}>
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate pr-2">{title}</span>
        <div className={`p-1.5 sm:p-2 rounded-lg bg-gradient-to-br ${gradient} flex-shrink-0`}>
          <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
        </div>
      </div>
      <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className={`text-xs sm:text-sm mt-1 flex items-center gap-1 ${alert ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}`}>
        {alert && <AlertTriangle className="w-3 h-3 flex-shrink-0" />}
        <span className="truncate">{subtitle}</span>
      </p>
    </div>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }
  return content
}

function GovernanceItem({
  title,
  description,
  href,
  icon: Icon,
  status,
  gradient,
}: {
  title: string
  description: string
  href: string
  icon: React.ElementType
  status: 'active' | 'warning' | 'inactive'
  gradient: string
}) {
  const statusConfig = {
    active: { color: 'bg-green-500', icon: CheckCircle },
    warning: { color: 'bg-amber-500', icon: AlertTriangle },
    inactive: { color: 'bg-gray-400', icon: null },
  }

  return (
    <Link
      href={href}
      className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 active:scale-[0.98] touch-manipulation group"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={`p-2 rounded-lg bg-gradient-to-br ${gradient} flex-shrink-0 group-hover:shadow-md transition-shadow`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{title}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{description}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
        <span className={`w-2 h-2 rounded-full ${statusConfig[status].color}`} />
        <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 group-hover:translate-x-0.5 transition-all" />
      </div>
    </Link>
  )
}

function QuickAction({
  title,
  icon: Icon,
  href,
  gradient,
}: {
  title: string
  icon: React.ElementType
  href: string
  gradient: string
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 p-3 sm:p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200 active:scale-95 touch-manipulation group"
    >
      <div className={`p-2.5 rounded-xl bg-gradient-to-br ${gradient} group-hover:shadow-lg transition-shadow`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 text-center">{title}</span>
    </Link>
  )
}

function ActivityCard({ item }: { item: ActivityItem }) {
  const icons: Record<string, { icon: React.ElementType; gradient: string }> = {
    agent_created: { icon: Bot, gradient: 'from-blue-500 to-indigo-500' },
    agent_registered: { icon: Bot, gradient: 'from-blue-500 to-indigo-500' },
    task_completed: { icon: CheckCircle, gradient: 'from-green-500 to-emerald-500' },
    feedback: { icon: MessageSquare, gradient: 'from-amber-500 to-orange-500' },
    governance_decision: { icon: Scale, gradient: 'from-purple-500 to-indigo-500' },
    council_decision: { icon: Scale, gradient: 'from-purple-500 to-indigo-500' },
    trust_change: { icon: TrendingUp, gradient: 'from-green-500 to-emerald-500' },
    escalation: { icon: AlertTriangle, gradient: 'from-amber-500 to-orange-500' },
    policy_violation: { icon: Shield, gradient: 'from-rose-500 to-red-500' },
    compliance_check: { icon: FileCheck, gradient: 'from-green-500 to-emerald-500' },
  }

  const config = icons[item.type] || { icon: Activity, gradient: 'from-gray-500 to-gray-600' }
  const IconComponent = config.icon

  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 group">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`p-2 rounded-lg bg-gradient-to-br ${config.gradient} flex-shrink-0`}>
          <IconComponent className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.title}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.description}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
        <span className="text-xs text-gray-400 hidden sm:inline">
          {new Date(item.created_at).toLocaleDateString()}
        </span>
        {item.agent_id && (
          <Link
            href={`/agents/${item.agent_id}`}
            className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <ArrowRight className="w-4 h-4 text-gray-400 hover:text-blue-500" />
          </Link>
        )}
      </div>
    </div>
  )
}
