'use client'

import { useState } from 'react'
import Link from 'next/link'
import { 
  Shield, 
  Plus, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  Coins,
  Activity
} from 'lucide-react'

export default function Dashboard() {
  const [agents] = useState(mockAgents)

  return (
    <div className="min-h-screen bg-surface-dark">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
            <p className="text-gray-400">Manage your AI agents and certifications</p>
          </div>
          <Link
            href="/dashboard/agents/new"
            className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white font-medium rounded-lg transition-colors"
          >
            <Plus className="h-5 w-5 mr-2" />
            Register Agent
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Agents"
            value="3"
            change="+1 this month"
            icon={Shield}
            color="primary"
          />
          <StatCard
            title="Avg Trust Score"
            value="687"
            change="+12 pts"
            icon={TrendingUp}
            color="green"
          />
          <StatCard
            title="ANCR Staked"
            value="31,000"
            change="$4,650 value"
            icon={Coins}
            color="purple"
          />
          <StatCard
            title="API Calls (24h)"
            value="12,847"
            change="↑ 8% from yesterday"
            icon={Activity}
            color="blue"
          />
        </div>

        {/* Agents Table */}
        <div className="bg-surface rounded-xl border border-gray-800">
          <div className="p-6 border-b border-gray-800">
            <h2 className="text-lg font-semibold text-white">Your Agents</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-400 border-b border-gray-800">
                  <th className="px-6 py-4 font-medium">Agent</th>
                  <th className="px-6 py-4 font-medium">Trust Score</th>
                  <th className="px-6 py-4 font-medium">Certification</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Staked</th>
                  <th className="px-6 py-4 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent) => (
                  <AgentRow key={agent.id} agent={agent} />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="mt-8 grid lg:grid-cols-2 gap-8">
          <div className="bg-surface rounded-xl border border-gray-800 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Recent Activity</h2>
            <div className="space-y-4">
              {recentActivity.map((activity, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className={`p-2 rounded-lg ${activity.iconBg}`}>
                    <activity.icon className={`h-4 w-4 ${activity.iconColor}`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-white">{activity.message}</p>
                    <p className="text-xs text-gray-500">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-surface rounded-xl border border-gray-800 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Trust Score History</h2>
            <div className="h-64 flex items-center justify-center text-gray-500">
              <TrustScoreChart />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ 
  title, 
  value, 
  change, 
  icon: Icon, 
  color 
}: { 
  title: string
  value: string
  change: string
  icon: any
  color: 'primary' | 'green' | 'purple' | 'blue'
}) {
  const colorClasses = {
    primary: 'bg-primary-500/10 text-primary-400',
    green: 'bg-green-500/10 text-green-400',
    purple: 'bg-purple-500/10 text-purple-400',
    blue: 'bg-blue-500/10 text-blue-400',
  }

  return (
    <div className="bg-surface rounded-xl p-6 border border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-gray-400">{title}</span>
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="text-2xl font-bold text-white mb-1">{value}</p>
      <p className="text-sm text-gray-500">{change}</p>
    </div>
  )
}

function AgentRow({ agent }: { agent: typeof mockAgents[0] }) {
  const tierColors: Record<string, string> = {
    Trusted: 'bg-green-500/10 text-green-400',
    Certified: 'bg-yellow-500/10 text-yellow-400',
    Provisional: 'bg-orange-500/10 text-orange-400',
  }

  const certColors: Record<string, string> = {
    Gold: 'bg-yellow-500/10 text-yellow-400',
    Silver: 'bg-gray-400/10 text-gray-300',
    Bronze: 'bg-orange-600/10 text-orange-400',
  }

  return (
    <tr className="border-b border-gray-800 last:border-0 hover:bg-surface-light/50 transition-colors">
      <td className="px-6 py-4">
        <div>
          <p className="font-medium text-white">{agent.name}</p>
          <p className="text-sm text-gray-500 font-mono">{agent.id}</p>
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-white">{agent.trustScore}</span>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${tierColors[agent.tier]}`}>
            {agent.tier}
          </span>
        </div>
      </td>
      <td className="px-6 py-4">
        <span className={`px-2 py-1 rounded text-sm font-medium ${certColors[agent.certification]}`}>
          {agent.certification}
        </span>
      </td>
      <td className="px-6 py-4">
        {agent.status === 'active' ? (
          <span className="flex items-center gap-1 text-green-400 text-sm">
            <CheckCircle className="h-4 w-4" />
            Active
          </span>
        ) : (
          <span className="flex items-center gap-1 text-yellow-400 text-sm">
            <Clock className="h-4 w-4" />
            Pending
          </span>
        )}
      </td>
      <td className="px-6 py-4">
        <span className="text-white font-mono">{agent.staked.toLocaleString()} ANCR</span>
      </td>
      <td className="px-6 py-4">
        <Link
          href={`/dashboard/agents/${agent.id}`}
          className="text-primary-400 hover:text-primary-300 text-sm font-medium"
        >
          View →
        </Link>
      </td>
    </tr>
  )
}

function TrustScoreChart() {
  // Simple placeholder chart
  const data = [620, 635, 642, 658, 670, 665, 687]
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min

  return (
    <div className="w-full h-full flex items-end justify-between gap-2 px-4">
      {data.map((value, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-2">
          <div
            className="w-full bg-primary-500/50 rounded-t transition-all hover:bg-primary-500"
            style={{ height: `${((value - min) / range) * 150 + 20}px` }}
          />
          <span className="text-xs text-gray-500">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}
          </span>
        </div>
      ))}
    </div>
  )
}

const mockAgents = [
  {
    id: 'ag_7x8k2mN3pQ9r',
    name: 'Marketing Assistant Pro',
    trustScore: 687,
    tier: 'Trusted',
    certification: 'Gold',
    status: 'active',
    staked: 25000,
  },
  {
    id: 'ag_4j5h6gF7dS8a',
    name: 'Data Processor Alpha',
    trustScore: 423,
    tier: 'Certified',
    certification: 'Silver',
    status: 'active',
    staked: 5000,
  },
  {
    id: 'ag_1m2n3bV4cX5z',
    name: 'Support Bot Beta',
    trustScore: 156,
    tier: 'Provisional',
    certification: 'Bronze',
    status: 'pending',
    staked: 1000,
  },
]

const recentActivity = [
  {
    icon: CheckCircle,
    iconBg: 'bg-green-500/10',
    iconColor: 'text-green-400',
    message: 'Marketing Assistant Pro passed compliance check',
    time: '2 hours ago',
  },
  {
    icon: TrendingUp,
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-400',
    message: 'Trust score increased +12 points',
    time: '5 hours ago',
  },
  {
    icon: AlertTriangle,
    iconBg: 'bg-yellow-500/10',
    iconColor: 'text-yellow-400',
    message: 'Rate limit warning for Data Processor Alpha',
    time: '1 day ago',
  },
  {
    icon: Coins,
    iconBg: 'bg-purple-500/10',
    iconColor: 'text-purple-400',
    message: 'Staked 5,000 ANCR for Silver certification',
    time: '3 days ago',
  },
]
