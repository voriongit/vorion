'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Bot,
  Shield,
  Activity,
  Settings,
  LogOut,
  Plus,
  Search,
  ChevronRight,
  BarChart3,
  Users,
  Clock,
  MoreVertical,
  Play,
  Pause,
  Trash2,
  Edit,
  Filter,
} from 'lucide-react'

const TRUST_TIERS: Record<string, { name: string; color: string; bg: string }> = {
  sandbox: { name: 'Sandbox', color: 'text-red-400', bg: 'bg-red-500/20' },
  observed: { name: 'Observed', color: 'text-orange-400', bg: 'bg-orange-500/20' },
  provisional: { name: 'Provisional', color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  verified: { name: 'Verified', color: 'text-lime-400', bg: 'bg-lime-500/20' },
  operational: { name: 'Operational', color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
  trusted: { name: 'Trusted', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  certified: { name: 'Certified', color: 'text-purple-400', bg: 'bg-purple-500/20' },
  autonomous: { name: 'Autonomous', color: 'text-aurais-primary', bg: 'bg-aurais-primary/20' },
}

const mockAgents = [
  {
    id: '1',
    name: 'DataProcessor',
    description: 'Automated data pipeline agent for ETL workflows',
    trustScore: 847,
    tier: 'certified',
    status: 'active',
    executions: 12847,
    lastActive: '2 mins ago',
    created: '2025-12-15',
  },
  {
    id: '2',
    name: 'CodeReviewer',
    description: 'AI-powered code review and security analysis',
    trustScore: 623,
    tier: 'trusted',
    status: 'active',
    executions: 5234,
    lastActive: '15 mins ago',
    created: '2025-11-20',
  },
  {
    id: '3',
    name: 'CustomerSupport',
    description: 'Multi-channel customer inquiry handler',
    trustScore: 412,
    tier: 'provisional',
    status: 'paused',
    executions: 892,
    lastActive: '1 hour ago',
    created: '2026-01-05',
  },
]

export default function AgentsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all')
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  const filteredAgents = mockAgents.filter((agent) => {
    const matchesSearch =
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || agent.status === statusFilter
    return matchesSearch && matchesStatus
  })

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
          <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition">
            <BarChart3 className="w-5 h-5" />
            <span>Dashboard</span>
          </Link>
          <Link href="/dashboard/agents" className="flex items-center gap-3 px-3 py-2 rounded-lg bg-aurais-primary/10 text-white">
            <Bot className="w-5 h-5" />
            <span>My Agents</span>
          </Link>
          <Link href="/marketplace" className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition">
            <Users className="w-5 h-5" />
            <span>Marketplace</span>
          </Link>
          <Link href="/dashboard/activity" className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition">
            <Activity className="w-5 h-5" />
            <span>Activity</span>
          </Link>
          <Link href="/dashboard/settings" className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition">
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
            <h1 className="text-2xl font-bold">My Agents</h1>
            <p className="text-gray-400">Manage your deployed AI agents</p>
          </div>
          <Link
            href="/dashboard/agents/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-aurais-primary hover:bg-aurais-secondary transition"
          >
            <Plus className="w-5 h-5" />
            <span>New Agent</span>
          </Link>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search agents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-aurais-primary focus:outline-none text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-aurais-primary"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
            </select>
          </div>
        </div>

        {/* Agents List */}
        <div className="glass rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Agent</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Trust Score</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Status</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Executions</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Last Active</th>
                <th className="text-right px-6 py-4 text-sm font-medium text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAgents.map((agent) => {
                const tier = TRUST_TIERS[agent.tier]
                return (
                  <tr key={agent.id} className="border-b border-white/5 hover:bg-white/5 transition">
                    <td className="px-6 py-4">
                      <Link href={`/dashboard/agents/${agent.id}`} className="flex items-center gap-3 group">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-aurais-primary/20 to-aurais-accent/20 flex items-center justify-center">
                          <Bot className="w-5 h-5 text-aurais-primary" />
                        </div>
                        <div>
                          <div className="font-medium group-hover:text-aurais-primary transition">{agent.name}</div>
                          <div className="text-sm text-gray-400 truncate max-w-xs">{agent.description}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">{agent.trustScore}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${tier.bg} ${tier.color}`}>
                          {tier.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 text-sm ${
                        agent.status === 'active' ? 'text-green-400' : 'text-yellow-400'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${
                          agent.status === 'active' ? 'bg-green-400' : 'bg-yellow-400'
                        }`} />
                        {agent.status === 'active' ? 'Active' : 'Paused'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-300">
                      {agent.executions.toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-sm text-gray-400">
                        <Clock className="w-3 h-3" />
                        {agent.lastActive}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="relative">
                        <button
                          onClick={() => setOpenMenu(openMenu === agent.id ? null : agent.id)}
                          className="p-2 rounded-lg hover:bg-white/10 transition"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {openMenu === agent.id && (
                          <div className="absolute right-0 top-full mt-1 w-40 glass rounded-lg py-1 z-10">
                            <button className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/10 transition">
                              <Edit className="w-4 h-4" />
                              Edit
                            </button>
                            <button className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/10 transition">
                              {agent.status === 'active' ? (
                                <>
                                  <Pause className="w-4 h-4" />
                                  Pause
                                </>
                              ) : (
                                <>
                                  <Play className="w-4 h-4" />
                                  Resume
                                </>
                              )}
                            </button>
                            <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-white/10 transition">
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {filteredAgents.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No agents found</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
