'use client'

import { useState, useEffect } from 'react'
import {
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
  Download,
  RefreshCw,
  Calendar,
  Bot,
  Wallet,
} from 'lucide-react'
import { EarningsSummary, TrainerEarning, TrainerPayout } from '@/lib/marketplace/types'

interface EarningsByAgent {
  agent_id: string
  agent_name: string
  total: number
  tasks: number
}

interface TimelinePoint {
  date: string
  amount: number
}

export default function EarningsPage() {
  const [summary, setSummary] = useState<EarningsSummary | null>(null)
  const [byAgent, setByAgent] = useState<EarningsByAgent[]>([])
  const [timeline, setTimeline] = useState<TimelinePoint[]>([])
  const [recentEarnings, setRecentEarnings] = useState<TrainerEarning[]>([])
  const [payouts, setPayouts] = useState<TrainerPayout[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'payouts'>('overview')

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    try {
      const [summaryRes, byAgentRes, timelineRes, earningsRes, payoutsRes] = await Promise.all([
        fetch('/api/marketplace/earnings?summary=true'),
        fetch('/api/marketplace/earnings?by_agent=true'),
        fetch('/api/marketplace/earnings?timeline=true&days=30'),
        fetch('/api/marketplace/earnings?limit=20'),
        fetch('/api/marketplace/payouts?limit=10'),
      ])

      if (summaryRes.ok) {
        const data = await summaryRes.json()
        setSummary(data.summary)
      }

      if (byAgentRes.ok) {
        const data = await byAgentRes.json()
        setByAgent(data.by_agent || [])
      }

      if (timelineRes.ok) {
        const data = await timelineRes.json()
        setTimeline(data.timeline || [])
      }

      if (earningsRes.ok) {
        const data = await earningsRes.json()
        setRecentEarnings(data.earnings || [])
      }

      if (payoutsRes.ok) {
        const data = await payoutsRes.json()
        setPayouts(data.payouts || [])
      }
    } catch (err) {
      console.error('Failed to fetch earnings data:', err)
    } finally {
      setLoading(false)
    }
  }

  // Calculate max for chart scaling
  const maxAmount = Math.max(...timeline.map(t => t.amount), 1)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <RefreshCw className="w-8 h-8 animate-spin text-neutral-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100 flex items-center gap-3">
            <DollarSign className="w-7 h-7 text-green-400" />
            Earnings Dashboard
          </h1>
          <p className="text-neutral-400 mt-1">
            Track your agent earnings and manage payouts
          </p>
        </div>
        <button
          onClick={fetchData}
          className="p-2 text-neutral-400 hover:text-neutral-200"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
          <div className="flex items-center gap-2 text-neutral-500 mb-2">
            <Calendar className="w-4 h-4" />
            <span className="text-sm">Today</span>
          </div>
          <p className="text-2xl font-bold text-neutral-100">
            ${summary?.today.toFixed(2) || '0.00'}
          </p>
        </div>

        <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
          <div className="flex items-center gap-2 text-neutral-500 mb-2">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm">This Week</span>
          </div>
          <p className="text-2xl font-bold text-neutral-100">
            ${summary?.this_week.toFixed(2) || '0.00'}
          </p>
        </div>

        <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
          <div className="flex items-center gap-2 text-neutral-500 mb-2">
            <Clock className="w-4 h-4" />
            <span className="text-sm">Available</span>
          </div>
          <p className="text-2xl font-bold text-green-400">
            ${summary?.available.toFixed(2) || '0.00'}
          </p>
        </div>

        <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
          <div className="flex items-center gap-2 text-neutral-500 mb-2">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm">All Time</span>
          </div>
          <p className="text-2xl font-bold text-neutral-100">
            ${summary?.all_time.toFixed(2) || '0.00'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-neutral-800">
        <nav className="flex gap-6">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'history', label: 'History' },
            { id: 'payouts', label: 'Payouts' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-3 text-sm font-medium transition-colors relative ${
                activeTab === tab.id
                  ? 'text-blue-400'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400" />
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Earnings Chart */}
          <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-6">
            <h2 className="text-lg font-semibold text-neutral-100 mb-4">
              Last 30 Days
            </h2>
            <div className="h-48 flex items-end gap-1">
              {timeline.map((point) => {
                const height = maxAmount > 0 ? (point.amount / maxAmount) * 100 : 0
                return (
                  <div
                    key={point.date}
                    className="flex-1 bg-green-600/30 hover:bg-green-600/50 transition-colors rounded-t relative group"
                    style={{ height: `${Math.max(height, 2)}%` }}
                  >
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block bg-neutral-800 px-2 py-1 rounded text-xs whitespace-nowrap z-10">
                      {point.date}: ${point.amount.toFixed(2)}
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="text-sm text-neutral-500 mt-2 text-center">
              Total: ${timeline.reduce((sum, t) => sum + t.amount, 0).toFixed(2)}
            </p>
          </div>

          {/* Earnings by Agent */}
          <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-6">
            <h2 className="text-lg font-semibold text-neutral-100 mb-4">
              By Agent
            </h2>
            {byAgent.length === 0 ? (
              <p className="text-neutral-500 text-center py-8">
                No earnings yet
              </p>
            ) : (
              <div className="space-y-3">
                {byAgent.slice(0, 5).map((agent) => (
                  <div
                    key={agent.agent_id}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <Bot className="w-5 h-5 text-neutral-500" />
                      <div>
                        <p className="text-neutral-200">{agent.agent_name}</p>
                        <p className="text-xs text-neutral-500">
                          {agent.tasks} tasks
                        </p>
                      </div>
                    </div>
                    <span className="text-green-400 font-medium">
                      ${agent.total.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-neutral-900 rounded-lg border border-neutral-800">
          <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
            <h2 className="font-semibold text-neutral-100">Earnings History</h2>
            <button className="text-sm text-blue-400 hover:underline flex items-center gap-1">
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
          <div className="divide-y divide-neutral-800">
            {recentEarnings.length === 0 ? (
              <div className="p-8 text-center text-neutral-500">
                No earnings yet
              </div>
            ) : (
              recentEarnings.map((earning) => (
                <div
                  key={earning.id}
                  className="p-4 flex items-center justify-between"
                >
                  <div>
                    <p className="text-neutral-200">{earning.task_type || 'Task'}</p>
                    <p className="text-xs text-neutral-500">
                      {new Date(earning.earned_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-green-400 font-medium">
                      +${Number(earning.net_amount).toFixed(4)}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {earning.status}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'payouts' && (
        <div className="space-y-6">
          {/* Request Payout Card */}
          <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-neutral-100">
                  Available Balance
                </h2>
                <p className="text-3xl font-bold text-green-400 mt-2">
                  ${summary?.available.toFixed(2) || '0.00'}
                </p>
                <p className="text-sm text-neutral-500 mt-1">
                  Minimum payout: $100.00
                </p>
              </div>
              <button
                disabled={(summary?.available || 0) < 100}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <Wallet className="w-5 h-5" />
                Request Payout
              </button>
            </div>
          </div>

          {/* Payout History */}
          <div className="bg-neutral-900 rounded-lg border border-neutral-800">
            <div className="p-4 border-b border-neutral-800">
              <h2 className="font-semibold text-neutral-100">Payout History</h2>
            </div>
            <div className="divide-y divide-neutral-800">
              {payouts.length === 0 ? (
                <div className="p-8 text-center text-neutral-500">
                  No payouts yet
                </div>
              ) : (
                payouts.map((payout) => (
                  <div
                    key={payout.id}
                    className="p-4 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-neutral-200">
                        ${Number(payout.amount).toFixed(2)}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {new Date(payout.requested_at).toLocaleDateString()} via {payout.payout_method}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        payout.status === 'completed'
                          ? 'bg-green-900/30 text-green-400'
                          : payout.status === 'failed'
                          ? 'bg-red-900/30 text-red-400'
                          : 'bg-yellow-900/30 text-yellow-400'
                      }`}
                    >
                      {payout.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
