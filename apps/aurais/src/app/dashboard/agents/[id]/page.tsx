'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  Bot,
  Shield,
  Activity,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Users,
  Clock,
  Play,
  Pause,
  Trash2,
  Edit,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Zap,
  Calendar,
  Terminal,
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

const mockAgentDetails: Record<string, any> = {
  '1': {
    id: '1',
    name: 'DataProcessor',
    description: 'Automated data pipeline agent for ETL workflows. Handles data extraction, transformation, and loading across multiple data sources.',
    trustScore: 847,
    tier: 'certified',
    status: 'active',
    executions: 12847,
    successRate: 99.2,
    avgLatency: '234ms',
    lastActive: '2 mins ago',
    created: '2025-12-15',
    capabilities: ['Read databases', 'Write approved data', 'External API calls', 'ML inference'],
    recentEvents: [
      { type: 'success', message: 'Pipeline execution completed', time: '2 mins ago' },
      { type: 'success', message: 'Data validation passed', time: '5 mins ago' },
      { type: 'info', message: 'Trust score increased +3', time: '1 hour ago' },
      { type: 'warning', message: 'Rate limit warning', time: '3 hours ago' },
    ],
  },
  '2': {
    id: '2',
    name: 'CodeReviewer',
    description: 'AI-powered code review and security analysis. Identifies vulnerabilities and suggests improvements.',
    trustScore: 623,
    tier: 'trusted',
    status: 'active',
    executions: 5234,
    successRate: 98.7,
    avgLatency: '1.2s',
    lastActive: '15 mins ago',
    created: '2025-11-20',
    capabilities: ['Read source code', 'Generate reports', 'CI/CD integration'],
    recentEvents: [
      { type: 'success', message: 'Code review completed', time: '15 mins ago' },
      { type: 'info', message: 'New repository connected', time: '2 hours ago' },
    ],
  },
  '3': {
    id: '3',
    name: 'CustomerSupport',
    description: 'Multi-channel customer inquiry handler with sentiment analysis.',
    trustScore: 412,
    tier: 'provisional',
    status: 'paused',
    executions: 892,
    successRate: 94.5,
    avgLatency: '450ms',
    lastActive: '1 hour ago',
    created: '2026-01-05',
    capabilities: ['Read messages', 'Send responses', 'Sentiment analysis'],
    recentEvents: [
      { type: 'warning', message: 'Agent paused by user', time: '1 hour ago' },
      { type: 'success', message: 'Ticket resolved', time: '2 hours ago' },
    ],
  },
}

export default function AgentDetailPage() {
  const params = useParams()
  const agentId = params.id as string
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'config'>('overview')

  const agent = mockAgentDetails[agentId]

  if (!agent) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Bot className="w-16 h-16 mx-auto mb-4 text-gray-600" />
          <h1 className="text-2xl font-bold mb-2">Agent Not Found</h1>
          <p className="text-gray-400 mb-4">The agent you're looking for doesn't exist.</p>
          <Link href="/dashboard/agents" className="text-aurais-primary hover:text-aurais-secondary">
            Back to My Agents
          </Link>
        </div>
      </div>
    )
  }

  const tier = TRUST_TIERS[agent.tier]

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
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
          <Link href="/dashboard/agents" className="hover:text-white transition flex items-center gap-1">
            <ChevronLeft className="w-4 h-4" />
            My Agents
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-white">{agent.name}</span>
        </div>

        {/* Agent Header */}
        <div className="glass rounded-xl p-6 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-aurais-primary/20 to-aurais-accent/20 flex items-center justify-center">
                <Bot className="w-8 h-8 text-aurais-primary" />
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl font-bold">{agent.name}</h1>
                  <span className={`inline-flex items-center gap-1.5 text-sm px-2 py-0.5 rounded-full ${
                    agent.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${
                      agent.status === 'active' ? 'bg-green-400' : 'bg-yellow-400'
                    }`} />
                    {agent.status === 'active' ? 'Active' : 'Paused'}
                  </span>
                </div>
                <p className="text-gray-400 max-w-xl">{agent.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 rounded-lg glass glass-hover transition">
                <Edit className="w-5 h-5" />
              </button>
              <button className="p-2 rounded-lg glass glass-hover transition">
                {agent.status === 'active' ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>
              <button className="p-2 rounded-lg glass glass-hover transition text-red-400">
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="glass rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-5 h-5 text-aurais-primary" />
              <span className="text-sm text-gray-400">Trust Score</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{agent.trustScore}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${tier.bg} ${tier.color}`}>{tier.name}</span>
            </div>
          </div>
          <div className="glass rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              <span className="text-sm text-gray-400">Executions</span>
            </div>
            <div className="text-2xl font-bold">{agent.executions.toLocaleString()}</div>
          </div>
          <div className="glass rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              <span className="text-sm text-gray-400">Success Rate</span>
            </div>
            <div className="text-2xl font-bold">{agent.successRate}%</div>
          </div>
          <div className="glass rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-blue-400" />
              <span className="text-sm text-gray-400">Avg Latency</span>
            </div>
            <div className="text-2xl font-bold">{agent.avgLatency}</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 glass rounded-xl w-fit">
          {(['overview', 'activity', 'config'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition capitalize ${
                activeTab === tab ? 'bg-aurais-primary text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab === 'config' ? 'Configuration' : tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-2 gap-6">
            <div className="glass rounded-xl p-6">
              <h3 className="font-semibold mb-4">Capabilities</h3>
              <div className="space-y-2">
                {agent.capabilities.map((cap: string, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span className="text-gray-300">{cap}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass rounded-xl p-6">
              <h3 className="font-semibold mb-4">Recent Events</h3>
              <div className="space-y-3">
                {agent.recentEvents.map((event: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    {event.type === 'success' && <CheckCircle className="w-4 h-4 text-green-400" />}
                    {event.type === 'warning' && <AlertTriangle className="w-4 h-4 text-yellow-400" />}
                    {event.type === 'info' && <TrendingUp className="w-4 h-4 text-aurais-primary" />}
                    <span className="flex-1 text-gray-300">{event.message}</span>
                    <span className="text-gray-500">{event.time}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="col-span-2 glass rounded-xl p-6">
              <h3 className="font-semibold mb-4">Agent Details</h3>
              <dl className="grid grid-cols-4 gap-4">
                <div>
                  <dt className="text-sm text-gray-400">Created</dt>
                  <dd className="flex items-center gap-1 mt-1">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    {agent.created}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-400">Last Active</dt>
                  <dd className="flex items-center gap-1 mt-1">
                    <Clock className="w-4 h-4 text-gray-400" />
                    {agent.lastActive}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-400">Agent ID</dt>
                  <dd className="flex items-center gap-1 mt-1">
                    <Terminal className="w-4 h-4 text-gray-400" />
                    <code className="text-xs">{agent.id}</code>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-400">Trust Tier</dt>
                  <dd className={`mt-1 ${tier.color}`}>{tier.name}</dd>
                </div>
              </dl>
            </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="glass rounded-xl p-6">
            <h3 className="font-semibold mb-4">Activity Log</h3>
            <p className="text-gray-400">Activity logging coming soon...</p>
          </div>
        )}

        {activeTab === 'config' && (
          <div className="glass rounded-xl p-6">
            <h3 className="font-semibold mb-4">Agent Configuration</h3>
            <p className="text-gray-400">Configuration management coming soon...</p>
          </div>
        )}
      </main>
    </div>
  )
}
