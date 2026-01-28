'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Bot,
  Shield,
  Zap,
  TrendingUp,
  Activity,
  Settings,
  LogOut,
  Plus,
  Search,
  ChevronRight,
  BarChart3,
  Users,
  Clock,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react'

// BASIS Trust Tiers (per cognigate.dev/v1/health)
// Sandbox: 0-99, Provisional: 100-299, Standard: 300-499
// Trusted: 500-699, Certified: 700-899, Autonomous: 900-1000

// Mock data - will be replaced with real Cognigate API calls
const mockAgents = [
  {
    id: '1',
    name: 'DataProcessor',
    description: 'Automated data pipeline agent',
    trustScore: 847,
    tier: 'certified',
    status: 'active',
    executions: 12847,
    lastActive: '2 mins ago',
  },
  {
    id: '2',
    name: 'CodeReviewer',
    description: 'AI-powered code review assistant',
    trustScore: 623,
    tier: 'trusted',
    status: 'active',
    executions: 5234,
    lastActive: '15 mins ago',
  },
  {
    id: '3',
    name: 'CustomerSupport',
    description: 'Customer inquiry handler',
    trustScore: 412,
    tier: 'standard',
    status: 'paused',
    executions: 892,
    lastActive: '1 hour ago',
  },
]

// BASIS tier colors aligned with specification
const tierColors: Record<string, string> = {
  sandbox: 'text-red-400',
  provisional: 'text-orange-400',
  standard: 'text-yellow-400',
  trusted: 'text-blue-400',
  certified: 'text-purple-400',
  autonomous: 'text-aurais-primary',
}

const stats = [
  { label: 'Total Agents', value: '3', icon: Bot, change: '+1 this month' },
  { label: 'Avg Trust Score', value: '627', icon: Shield, change: '+12 this week' },
  { label: 'Total Executions', value: '18.9K', icon: Zap, change: '+2.3K today' },
  { label: 'Success Rate', value: '99.2%', icon: TrendingUp, change: '+0.3%' },
]

export default function DashboardPage() {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredAgents = mockAgents.filter(
    (agent) =>
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="min-h-screen">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-64 glass border-r border-white/10 p-4 flex flex-col">
        <div className="flex items-center gap-2 mb-8 px-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-aurais-primary to-aurais-accent flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-gradient">Aurais</span>
        </div>

        <nav className="flex-1 space-y-1">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-3 py-2 rounded-lg bg-aurais-primary/10 text-white"
          >
            <BarChart3 className="w-5 h-5" />
            <span>Dashboard</span>
          </Link>
          <Link
            href="/dashboard/agents"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition"
          >
            <Bot className="w-5 h-5" />
            <span>My Agents</span>
          </Link>
          <Link
            href="/marketplace"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition"
          >
            <Users className="w-5 h-5" />
            <span>Marketplace</span>
          </Link>
          <Link
            href="/dashboard/activity"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition"
          >
            <Activity className="w-5 h-5" />
            <span>Activity</span>
          </Link>
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition"
          >
            <Settings className="w-5 h-5" />
            <span>Settings</span>
          </Link>
        </nav>

        <div className="pt-4 border-t border-white/10">
          <button className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition w-full">
            <LogOut className="w-5 h-5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64 p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-gray-400">Welcome back! Here's your agent overview.</p>
          </div>
          <Link
            href="/dashboard/agents/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-aurais-primary hover:bg-aurais-secondary transition"
          >
            <Plus className="w-5 h-5" />
            <span>New Agent</span>
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {stats.map((stat, i) => (
            <div key={i} className="glass rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-aurais-primary/20 flex items-center justify-center">
                  <stat.icon className="w-5 h-5 text-aurais-primary" />
                </div>
                <span className="text-xs text-green-400">{stat.change}</span>
              </div>
              <div className="text-2xl font-bold mb-1">{stat.value}</div>
              <div className="text-sm text-gray-400">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Agents Section */}
        <div className="glass rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">Your Agents</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search agents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-aurais-primary focus:outline-none text-sm w-64"
              />
            </div>
          </div>

          <div className="space-y-3">
            {filteredAgents.map((agent) => (
              <Link
                key={agent.id}
                href={`/dashboard/agents/${agent.id}`}
                className="flex items-center gap-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 transition group"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-aurais-primary/20 to-aurais-accent/20 flex items-center justify-center">
                  <Bot className="w-6 h-6 text-aurais-primary" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium">{agent.name}</h3>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        agent.status === 'active'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-yellow-500/20 text-yellow-400'
                      }`}
                    >
                      {agent.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 truncate">{agent.description}</p>
                </div>

                <div className="text-right">
                  <div className="flex items-center gap-2 justify-end mb-1">
                    <Shield className="w-4 h-4 text-gray-400" />
                    <span className="font-medium">{agent.trustScore}</span>
                    <span className={`text-xs capitalize ${tierColors[agent.tier]}`}>
                      {agent.tier}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <Clock className="w-3 h-3" />
                    <span>{agent.lastActive}</span>
                  </div>
                </div>

                <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-white transition" />
              </Link>
            ))}
          </div>

          {filteredAgents.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No agents found</p>
              <Link
                href="/dashboard/agents/new"
                className="inline-flex items-center gap-2 text-aurais-primary hover:text-aurais-secondary transition mt-2"
              >
                <Plus className="w-4 h-4" />
                <span>Create your first agent</span>
              </Link>
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-2 gap-6 mt-6">
          <div className="glass rounded-xl p-6">
            <h3 className="font-semibold mb-4">Recent Events</h3>
            <div className="space-y-3">
              {[
                {
                  icon: CheckCircle,
                  iconColor: 'text-green-400',
                  title: 'DataProcessor execution succeeded',
                  time: '2 mins ago',
                },
                {
                  icon: TrendingUp,
                  iconColor: 'text-aurais-primary',
                  title: 'CodeReviewer trust score increased',
                  time: '15 mins ago',
                },
                {
                  icon: AlertTriangle,
                  iconColor: 'text-yellow-400',
                  title: 'CustomerSupport rate limit warning',
                  time: '1 hour ago',
                },
              ].map((event, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <event.icon className={`w-4 h-4 ${event.iconColor}`} />
                  <span className="flex-1 text-gray-300">{event.title}</span>
                  <span className="text-gray-500">{event.time}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass rounded-xl p-6">
            <h3 className="font-semibold mb-4">Trust Insights</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">Average Trust Score</span>
                  <span>627 / 1000</span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-aurais-primary to-aurais-accent"
                    style={{ width: '62.7%' }}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Highest Tier</span>
                <span className="text-purple-400 font-medium">Certified (700-899)</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Violations (30d)</span>
                <span className="text-green-400 font-medium">0</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
