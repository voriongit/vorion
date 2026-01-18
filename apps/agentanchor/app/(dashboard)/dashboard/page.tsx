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
} from 'lucide-react'

interface DashboardStats {
  // Agents
  my_agents: number
  agents_active: number
  agents_sandbox: number
  average_trust_score: number
  // Governance
  total_decisions: number
  decisions_today: number
  allow_rate: number
  // Activity
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
        <RefreshCw className="w-8 h-8 animate-spin text-neutral-500" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-100 flex items-center gap-3">
          <LayoutDashboard className="w-7 h-7 text-blue-400" />
          Dashboard
        </h1>
        <p className="text-neutral-400 mt-1">
          Your AI governance command center
        </p>
      </div>

      {/* B2B Journey Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <JourneyCard
          step={1}
          title="Agents"
          description="Register & manage agents"
          href="/agents"
          icon={Bot}
          color="blue"
        />
        <JourneyCard
          step={2}
          title="Sandbox"
          description="Test in isolated environment"
          href="/sandbox"
          icon={Eye}
          color="green"
        />
        <JourneyCard
          step={3}
          title="Governance"
          description="Policies & enforcement"
          href="/governance"
          icon={Scale}
          color="purple"
        />
        <JourneyCard
          step={4}
          title="Analytics"
          description="Usage & performance"
          href="/usage"
          icon={TrendingUp}
          color="yellow"
        />
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Agents"
          value={stats?.my_agents?.toString() || '0'}
          subtitle={`${stats?.agents_active || 0} active`}
          icon={Bot}
          color="blue"
          href="/agents"
        />
        <StatCard
          title="Trust Score"
          value={stats?.average_trust_score?.toString() || '—'}
          subtitle="Average across agents"
          icon={TrendingUp}
          color="green"
        />
        <StatCard
          title="Decisions"
          value={stats?.decisions_today?.toString() || '0'}
          subtitle="Today"
          icon={Scale}
          color="purple"
          href="/governance"
        />
        <StatCard
          title="Escalations"
          value={stats?.pending_escalations?.toString() || '0'}
          subtitle={stats?.pending_escalations ? 'Pending review' : 'All clear'}
          icon={AlertTriangle}
          color="yellow"
          alert={stats?.pending_escalations ? stats.pending_escalations > 0 : false}
          href="/escalations"
        />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-6">
          <h2 className="text-lg font-semibold text-neutral-100 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-400" />
            Recent Activity
          </h2>

          {activity.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Activity className="w-10 h-10 text-neutral-600 mb-3" />
              <p className="text-sm text-neutral-500">
                Your activity will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {activity.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-neutral-800/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <ActivityIcon type={item.type} />
                    <div>
                      <p className="text-neutral-200 font-medium text-sm">{item.title}</p>
                      <p className="text-xs text-neutral-500">{item.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-500">
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                    {item.agent_id && (
                      <Link
                        href={`/agents/${item.agent_id}`}
                        className="text-blue-400 hover:text-blue-300"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Governance Health */}
        <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-6">
          <h2 className="text-lg font-semibold text-neutral-100 mb-4 flex items-center gap-2">
            <Scale className="w-5 h-5 text-purple-400" />
            Governance Status
          </h2>

          <div className="space-y-4">
            <GovernanceItem
              title="Governance"
              description="Policy enforcement & decisions"
              href="/governance"
              icon={Scale}
              status="active"
            />
            <GovernanceItem
              title="Escalations"
              description="Pending human review"
              href="/escalations"
              icon={AlertTriangle}
              status="active"
            />
            <GovernanceItem
              title="Observer"
              description="Real-time behavior monitoring"
              href="/observer"
              icon={Eye}
              status="active"
            />
            <GovernanceItem
              title="Audit Trail"
              description="Cryptographic proof chain"
              href="/audit"
              icon={FileCheck}
              status="active"
            />
            <GovernanceItem
              title="Compliance"
              description="EU AI Act, ISO 42001 reports"
              href="/compliance"
              icon={Shield}
              status="active"
            />
          </div>
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
  color,
}: {
  step: number
  title: string
  description: string
  href: string
  icon: React.ElementType
  color: 'blue' | 'green' | 'purple' | 'yellow'
}) {
  const colorClasses = {
    blue: 'border-blue-800 hover:border-blue-600 hover:bg-blue-900/20 text-blue-400',
    green: 'border-green-800 hover:border-green-600 hover:bg-green-900/20 text-green-400',
    purple: 'border-purple-800 hover:border-purple-600 hover:bg-purple-900/20 text-purple-400',
    yellow: 'border-yellow-800 hover:border-yellow-600 hover:bg-yellow-900/20 text-yellow-400',
  }

  const badgeColors = {
    blue: 'bg-blue-900/50 text-blue-400',
    green: 'bg-green-900/50 text-green-400',
    purple: 'bg-purple-900/50 text-purple-400',
    yellow: 'bg-yellow-900/50 text-yellow-400',
  }

  return (
    <Link
      href={href}
      className={`block p-4 rounded-lg border-2 border-dashed transition-colors ${colorClasses[color]}`}
    >
      <div className="flex items-center gap-3 mb-2">
        <span className={`text-xs font-bold px-2 py-0.5 rounded ${badgeColors[color]}`}>
          {step}
        </span>
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="font-semibold text-neutral-100">{title}</h3>
      <p className="text-sm text-neutral-500 mt-1">{description}</p>
    </Link>
  )
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  alert,
  href,
}: {
  title: string
  value: string
  subtitle: string
  icon: React.ElementType
  color: 'blue' | 'green' | 'purple' | 'yellow'
  alert?: boolean
  href?: string
}) {
  const colorClasses = {
    blue: 'text-blue-400',
    green: 'text-green-400',
    purple: 'text-purple-400',
    yellow: 'text-yellow-400',
  }

  const content = (
    <div className={`bg-neutral-900 rounded-lg border border-neutral-800 p-4 ${href ? 'hover:border-neutral-700 transition-colors' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-neutral-500">{title}</span>
        <Icon className={`w-5 h-5 ${colorClasses[color]}`} />
      </div>
      <p className="text-2xl font-bold text-neutral-100">{value}</p>
      <p className={`text-sm mt-1 ${alert ? 'text-yellow-400' : 'text-neutral-500'}`}>
        {alert && <AlertTriangle className="w-3 h-3 inline mr-1" />}
        {subtitle}
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
}: {
  title: string
  description: string
  href: string
  icon: React.ElementType
  status: 'active' | 'warning' | 'inactive'
}) {
  const statusColors = {
    active: 'bg-green-500',
    warning: 'bg-yellow-500',
    inactive: 'bg-neutral-500',
  }

  return (
    <Link
      href={href}
      className="flex items-center justify-between p-3 bg-neutral-800/50 rounded-lg hover:bg-neutral-800 transition-colors"
    >
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-neutral-400" />
        <div>
          <p className="text-neutral-200 font-medium">{title}</p>
          <p className="text-xs text-neutral-500">{description}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${statusColors[status]}`} />
        <ArrowRight className="w-4 h-4 text-neutral-500" />
      </div>
    </Link>
  )
}

function ActivityIcon({ type }: { type: string }) {
  const icons: Record<string, { icon: React.ElementType; color: string }> = {
    agent_created: { icon: Bot, color: 'text-blue-400' },
    agent_registered: { icon: Bot, color: 'text-blue-400' },
    task_completed: { icon: Activity, color: 'text-blue-400' },
    feedback: { icon: MessageSquare, color: 'text-yellow-400' },
    governance_decision: { icon: Scale, color: 'text-purple-400' },
    council_decision: { icon: Scale, color: 'text-purple-400' },
    trust_change: { icon: TrendingUp, color: 'text-green-400' },
    escalation: { icon: AlertTriangle, color: 'text-yellow-400' },
    policy_violation: { icon: Shield, color: 'text-red-400' },
    compliance_check: { icon: FileCheck, color: 'text-green-400' },
  }

  const config = icons[type] || { icon: Activity, color: 'text-neutral-400' }
  const IconComponent = config.icon

  return (
    <div className={`p-2 rounded-lg bg-neutral-800 ${config.color}`}>
      <IconComponent className="w-4 h-4" />
    </div>
  )
}
