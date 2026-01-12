'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  BarChart3,
  Bot,
  Activity,
  TrendingUp,
  AlertTriangle,
  Scale,
  Eye,
  RefreshCw,
  Calendar,
  ArrowRight,
  CheckCircle,
  Info,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface UsageStats {
  overview: {
    totalAgents: number
    activeAgents: number
    totalInteractions: number
    successRate: number
    totalEvents: number
    eventsToday: number
    councilDecisions: number
    trustChanges: number
  }
  timeline: {
    date: string
    events: number
    interactions: number
    decisions: number
  }[]
  eventsByType: {
    type: string
    count: number
  }[]
  eventsByRisk: {
    risk: string
    count: number
  }[]
  agentActivity: {
    agentId: string
    agentName: string
    interactions: number
    successRate: number
    trustScore: number
    eventsCount: number
  }[]
  recentActivity: {
    id: string
    type: string
    title: string
    description: string
    risk: string
    createdAt: string
  }[]
}

const RISK_COLORS: Record<string, string> = {
  low: 'bg-green-500',
  medium: 'bg-yellow-500',
  high: 'bg-red-500',
}

const TYPE_COLORS: Record<string, string> = {
  task_completed: 'bg-green-500',
  task_failed: 'bg-red-500',
  decision_made: 'bg-blue-500',
  escalation_triggered: 'bg-orange-500',
  compliance_check: 'bg-purple-500',
  anomaly_detected: 'bg-red-500',
  api_call: 'bg-cyan-500',
  user_interaction: 'bg-teal-500',
  resource_access: 'bg-yellow-500',
  trust_updated: 'bg-indigo-500',
}

export default function UsagePage() {
  const [stats, setStats] = useState<UsageStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState(30)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchUsageData()
  }, [timeRange])

  async function fetchUsageData() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/usage?days=${timeRange}`)
      if (!res.ok) {
        throw new Error('Failed to fetch usage data')
      }
      const data = await res.json()
      setStats(data)
    } catch (err) {
      console.error('Failed to fetch usage:', err)
      setError('Failed to load usage data')
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

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <AlertTriangle className="w-12 h-12 text-yellow-500 mb-4" />
        <p className="text-neutral-400">{error}</p>
        <button
          onClick={fetchUsageData}
          className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100 flex items-center gap-3">
            <BarChart3 className="w-7 h-7 text-blue-400" />
            Usage Analytics
          </h1>
          <p className="text-neutral-400 mt-1">
            Monitor your agent activity, events, and performance
          </p>
        </div>

        {/* Time Range Selector */}
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-neutral-500" />
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(parseInt(e.target.value))}
            className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Agents"
          value={stats?.overview.totalAgents || 0}
          subtitle={`${stats?.overview.activeAgents || 0} active`}
          icon={Bot}
          color="blue"
        />
        <StatCard
          title="Total Events"
          value={stats?.overview.totalEvents || 0}
          subtitle={`${stats?.overview.eventsToday || 0} today`}
          icon={Activity}
          color="green"
        />
        <StatCard
          title="Success Rate"
          value={`${stats?.overview.successRate || 0}%`}
          subtitle={`${stats?.overview.totalInteractions || 0} interactions`}
          icon={TrendingUp}
          color="purple"
        />
        <StatCard
          title="Council Decisions"
          value={stats?.overview.councilDecisions || 0}
          subtitle={`${stats?.overview.trustChanges || 0} trust changes`}
          icon={Scale}
          color="yellow"
        />
      </div>

      {/* Activity Timeline Chart */}
      <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-6">
        <h2 className="text-lg font-semibold text-neutral-100 mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-400" />
          Activity Timeline
        </h2>

        {stats?.timeline && stats.timeline.length > 0 ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={stats.timeline}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="eventGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#6b7280"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => {
                    const date = new Date(value)
                    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  }}
                  interval="preserveStartEnd"
                  minTickGap={50}
                />
                <YAxis
                  stroke="#6b7280"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
                  }}
                  labelStyle={{ color: '#f3f4f6', fontWeight: 600, marginBottom: '4px' }}
                  itemStyle={{ color: '#9ca3af' }}
                  labelFormatter={(value) => {
                    const date = new Date(value)
                    return date.toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })
                  }}
                  formatter={(value: number) => [value, 'Events']}
                />
                <Area
                  type="monotone"
                  dataKey="events"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#eventGradient)"
                  dot={false}
                  activeDot={{ r: 6, fill: '#3b82f6', stroke: '#1e3a5f', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Activity className="w-10 h-10 text-neutral-600 mb-3" />
            <p className="text-sm text-neutral-500">No activity data available</p>
          </div>
        )}
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Events by Type */}
        <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-6">
          <h2 className="text-lg font-semibold text-neutral-100 mb-4 flex items-center gap-2">
            <Eye className="w-5 h-5 text-purple-400" />
            Events by Type
          </h2>

          {stats?.eventsByType && stats.eventsByType.length > 0 ? (
            <div className="space-y-3">
              {stats.eventsByType.map((item) => {
                const total = stats.eventsByType.reduce((sum, c) => sum + c.count, 0)
                const percentage = total > 0 ? (item.count / total) * 100 : 0
                return (
                  <div key={item.type} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-300 capitalize">
                        {item.type.replace(/_/g, ' ')}
                      </span>
                      <span className="text-neutral-500">{item.count}</span>
                    </div>
                    <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${TYPE_COLORS[item.type] || 'bg-gray-500'} rounded-full transition-all`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Eye className="w-10 h-10 text-neutral-600 mb-3" />
              <p className="text-sm text-neutral-500">No event data available</p>
            </div>
          )}
        </div>

        {/* Events by Risk Level */}
        <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-6">
          <h2 className="text-lg font-semibold text-neutral-100 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            Events by Risk Level
          </h2>

          {stats?.eventsByRisk && stats.eventsByRisk.length > 0 ? (
            <div className="space-y-3">
              {['high', 'medium', 'low'].map((risk) => {
                const data = stats.eventsByRisk.find(r => r.risk === risk)
                const count = data?.count || 0
                const total = stats.eventsByRisk.reduce((sum, r) => sum + r.count, 0)
                const percentage = total > 0 ? (count / total) * 100 : 0
                return (
                  <div key={risk} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-300 capitalize flex items-center gap-2">
                        <RiskIcon risk={risk} />
                        {risk}
                      </span>
                      <span className="text-neutral-500">{count}</span>
                    </div>
                    <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${RISK_COLORS[risk]} rounded-full transition-all`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertTriangle className="w-10 h-10 text-neutral-600 mb-3" />
              <p className="text-sm text-neutral-500">No risk data available</p>
            </div>
          )}
        </div>
      </div>

      {/* Agent Activity Table */}
      <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-6">
        <h2 className="text-lg font-semibold text-neutral-100 mb-4 flex items-center gap-2">
          <Bot className="w-5 h-5 text-blue-400" />
          Agent Activity
        </h2>

        {stats?.agentActivity && stats.agentActivity.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-neutral-500 border-b border-neutral-800">
                  <th className="pb-3 font-medium">Agent</th>
                  <th className="pb-3 font-medium text-right">Trust Score</th>
                  <th className="pb-3 font-medium text-right">Interactions</th>
                  <th className="pb-3 font-medium text-right">Success Rate</th>
                  <th className="pb-3 font-medium text-right">Events</th>
                  <th className="pb-3 font-medium text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {stats.agentActivity.map((agent) => (
                  <tr key={agent.agentId} className="hover:bg-neutral-800/50">
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white text-sm font-medium">
                          {agent.agentName.charAt(0)}
                        </div>
                        <span className="text-neutral-200 font-medium">{agent.agentName}</span>
                      </div>
                    </td>
                    <td className="py-3 text-right">
                      <TrustBadge score={agent.trustScore} />
                    </td>
                    <td className="py-3 text-right text-neutral-300">
                      {agent.interactions.toLocaleString()}
                    </td>
                    <td className="py-3 text-right">
                      <span className={agent.successRate >= 90 ? 'text-green-400' : agent.successRate >= 70 ? 'text-yellow-400' : 'text-red-400'}>
                        {agent.successRate}%
                      </span>
                    </td>
                    <td className="py-3 text-right text-neutral-300">
                      {agent.eventsCount}
                    </td>
                    <td className="py-3 text-right">
                      <Link
                        href={`/agents/${agent.agentId}`}
                        className="text-blue-400 hover:text-blue-300"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Bot className="w-10 h-10 text-neutral-600 mb-3" />
            <p className="text-sm text-neutral-500">No agent activity data</p>
            <Link href="/agents" className="text-blue-400 hover:text-blue-300 text-sm mt-2">
              View your agents
            </Link>
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-6">
        <h2 className="text-lg font-semibold text-neutral-100 mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-green-400" />
          Recent Activity
        </h2>

        {stats?.recentActivity && stats.recentActivity.length > 0 ? (
          <div className="space-y-3">
            {stats.recentActivity.map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between p-3 bg-neutral-800/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <RiskIcon risk={event.risk} />
                  <div>
                    <p className="text-neutral-200 font-medium text-sm">{event.title}</p>
                    <p className="text-xs text-neutral-500">{event.description}</p>
                  </div>
                </div>
                <div className="text-xs text-neutral-500">
                  {new Date(event.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Activity className="w-10 h-10 text-neutral-600 mb-3" />
            <p className="text-sm text-neutral-500">No recent activity</p>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
}: {
  title: string
  value: string | number
  subtitle: string
  icon: React.ElementType
  color: 'blue' | 'green' | 'purple' | 'yellow'
}) {
  const colorClasses = {
    blue: 'text-blue-400',
    green: 'text-green-400',
    purple: 'text-purple-400',
    yellow: 'text-yellow-400',
  }

  return (
    <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-neutral-500">{title}</span>
        <Icon className={`w-5 h-5 ${colorClasses[color]}`} />
      </div>
      <p className="text-2xl font-bold text-neutral-100">{value}</p>
      <p className="text-sm text-neutral-500 mt-1">{subtitle}</p>
    </div>
  )
}

function RiskIcon({ risk }: { risk: string }) {
  switch (risk) {
    case 'high':
      return <AlertTriangle className="w-4 h-4 text-red-500" />
    case 'medium':
      return <AlertTriangle className="w-4 h-4 text-yellow-500" />
    case 'low':
      return <CheckCircle className="w-4 h-4 text-green-500" />
    default:
      return <Info className="w-4 h-4 text-neutral-500" />
  }
}

function TrustBadge({ score }: { score: number }) {
  let color = 'bg-neutral-600 text-neutral-300'
  let tier = 'Untrusted'

  if (score >= 900) {
    color = 'bg-yellow-500 text-black'
    tier = 'Legendary'
  } else if (score >= 800) {
    color = 'bg-purple-500 text-white'
    tier = 'Certified'
  } else if (score >= 600) {
    color = 'bg-blue-500 text-white'
    tier = 'Verified'
  } else if (score >= 400) {
    color = 'bg-green-500 text-white'
    tier = 'Trusted'
  } else if (score >= 200) {
    color = 'bg-teal-500 text-white'
    tier = 'Established'
  }

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {score}
    </span>
  )
}
