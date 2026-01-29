'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Bot,
  Shield,
  Activity,
  Settings,
  LogOut,
  BarChart3,
  Users,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Zap,
  Clock,
  Filter,
  Search,
  XCircle,
  Info,
} from 'lucide-react'

const mockActivity = [
  { id: 1, type: 'success', agent: 'DataProcessor', message: 'Pipeline execution completed successfully', timestamp: '2 mins ago', details: '1,247 records processed' },
  { id: 2, type: 'success', agent: 'DataProcessor', message: 'Data validation passed', timestamp: '5 mins ago', details: 'All checks passed' },
  { id: 3, type: 'info', agent: 'CodeReviewer', message: 'Trust score increased', timestamp: '15 mins ago', details: '+3 points (623 → 626)' },
  { id: 4, type: 'warning', agent: 'CustomerSupport', message: 'Rate limit warning', timestamp: '1 hour ago', details: '85% of hourly quota used' },
  { id: 5, type: 'success', agent: 'CodeReviewer', message: 'Code review completed', timestamp: '1 hour ago', details: '3 issues found, 2 auto-fixed' },
  { id: 6, type: 'error', agent: 'CustomerSupport', message: 'External API timeout', timestamp: '2 hours ago', details: 'Retried 3 times, escalated' },
  { id: 7, type: 'success', agent: 'DataProcessor', message: 'Scheduled job completed', timestamp: '3 hours ago', details: 'Daily sync finished' },
  { id: 8, type: 'info', agent: 'DataProcessor', message: 'New data source connected', timestamp: '4 hours ago', details: 'PostgreSQL database added' },
  { id: 9, type: 'warning', agent: 'CodeReviewer', message: 'High severity issue detected', timestamp: '5 hours ago', details: 'SQL injection vulnerability' },
  { id: 10, type: 'success', agent: 'CustomerSupport', message: 'Ticket resolved', timestamp: '6 hours ago', details: 'Customer satisfaction: 5/5' },
]

const eventIcons = {
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
  info: Info,
}

const eventColors = {
  success: 'text-green-400',
  warning: 'text-yellow-400',
  error: 'text-red-400',
  info: 'text-aurais-primary',
}

export default function ActivityPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [agentFilter, setAgentFilter] = useState<string>('all')

  const agents = [...new Set(mockActivity.map(a => a.agent))]

  const filteredActivity = mockActivity.filter((event) => {
    const matchesSearch = event.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.agent.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesType = typeFilter === 'all' || event.type === typeFilter
    const matchesAgent = agentFilter === 'all' || event.agent === agentFilter
    return matchesSearch && matchesType && matchesAgent
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
          <Link href="/dashboard/agents" className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition">
            <Bot className="w-5 h-5" />
            <span>My Agents</span>
          </Link>
          <Link href="/marketplace" className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition">
            <Users className="w-5 h-5" />
            <span>Marketplace</span>
          </Link>
          <Link href="/dashboard/activity" className="flex items-center gap-3 px-3 py-2 rounded-lg bg-aurais-primary/10 text-white">
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
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Activity Log</h1>
            <p className="text-gray-400">Monitor all agent events and actions</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="glass rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-aurais-primary" />
              <span className="text-sm text-gray-400">Total Events (24h)</span>
            </div>
            <div className="text-2xl font-bold">1,247</div>
          </div>
          <div className="glass rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-sm text-gray-400">Success Rate</span>
            </div>
            <div className="text-2xl font-bold">98.3%</div>
          </div>
          <div className="glass rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              <span className="text-sm text-gray-400">Warnings</span>
            </div>
            <div className="text-2xl font-bold">12</div>
          </div>
          <div className="glass rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-5 h-5 text-red-400" />
              <span className="text-sm text-gray-400">Errors</span>
            </div>
            <div className="text-2xl font-bold">3</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-aurais-primary focus:outline-none text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-aurais-primary"
            >
              <option value="all">All Types</option>
              <option value="success">Success</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
              <option value="info">Info</option>
            </select>
            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-aurais-primary"
            >
              <option value="all">All Agents</option>
              {agents.map(agent => (
                <option key={agent} value={agent}>{agent}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Activity List */}
        <div className="glass rounded-xl overflow-hidden">
          <div className="divide-y divide-white/5">
            {filteredActivity.map((event) => {
              const Icon = eventIcons[event.type as keyof typeof eventIcons]
              const color = eventColors[event.type as keyof typeof eventColors]
              return (
                <div key={event.id} className="p-4 hover:bg-white/5 transition">
                  <div className="flex items-start gap-4">
                    <div className={`mt-1 ${color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{event.agent}</span>
                        <span className="text-gray-400">•</span>
                        <span className="text-gray-300">{event.message}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <span>{event.details}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <Clock className="w-3 h-3" />
                      {event.timestamp}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {filteredActivity.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No events found</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
