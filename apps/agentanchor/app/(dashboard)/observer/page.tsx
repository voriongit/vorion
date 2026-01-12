'use client'

import { useState, useEffect } from 'react'
import { Eye, Activity, Shield, Download, BarChart2, AlertTriangle } from 'lucide-react'
import EventFeed from '@/components/observer/EventFeed'
import AnomalyList from '@/components/observer/AnomalyList'

interface ObserverStats {
  total_events: number
  events_today: number
  high_risk_events: number
  active_agents: number
}

export default function ObserverPage() {
  const [stats, setStats] = useState<ObserverStats | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<string>('')
  const [agents, setAgents] = useState<Array<{ id: string; name: string }>>([])

  // Fetch user's agents for filter dropdown
  useEffect(() => {
    async function fetchAgents() {
      try {
        const response = await fetch('/api/agents')
        if (response.ok) {
          const data = await response.json()
          setAgents(data.agents || [])
        }
      } catch (err) {
        console.error('Failed to fetch agents:', err)
      }
    }
    fetchAgents()
  }, [])

  // Fetch overall stats
  useEffect(() => {
    async function fetchStats() {
      try {
        // Simple stats from events endpoint
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const [allEvents, todayEvents, highRisk] = await Promise.all([
          fetch('/api/observer/events?limit=1').then(r => r.json()),
          fetch(`/api/observer/events?from=${today.toISOString()}&limit=1`).then(r => r.json()),
          fetch('/api/observer/events?risk_level=high&limit=1').then(r => r.json()),
        ])

        setStats({
          total_events: allEvents.total || 0,
          events_today: todayEvents.total || 0,
          high_risk_events: highRisk.total || 0,
          active_agents: agents.length,
        })
      } catch (err) {
        console.error('Failed to fetch stats:', err)
      }
    }
    if (agents.length > 0) {
      fetchStats()
    }
  }, [agents])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100 flex items-center gap-3">
            <Eye className="w-7 h-7 text-blue-400" />
            Observer
          </h1>
          <p className="text-neutral-400 mt-1">
            Real-time monitoring of all agent activity
          </p>
        </div>

        <button
          onClick={() => {
            // Export functionality placeholder
            const params = new URLSearchParams({ limit: '1000' })
            if (selectedAgent) params.set('agent_id', selectedAgent)
            window.open(`/api/observer/events?${params}`, '_blank')
          }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-neutral-100 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          <Download className="w-4 h-4" />
          Export Events
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-900/30">
              <Activity className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-100">
                {stats?.total_events.toLocaleString() || '—'}
              </p>
              <p className="text-xs text-neutral-500">Total Events</p>
            </div>
          </div>
        </div>

        <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-900/30">
              <BarChart2 className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-100">
                {stats?.events_today.toLocaleString() || '—'}
              </p>
              <p className="text-xs text-neutral-500">Today</p>
            </div>
          </div>
        </div>

        <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-900/30">
              <Shield className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-100">
                {stats?.high_risk_events.toLocaleString() || '—'}
              </p>
              <p className="text-xs text-neutral-500">High Risk</p>
            </div>
          </div>
        </div>

        <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-900/30">
              <Eye className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-100">
                {stats?.active_agents || '—'}
              </p>
              <p className="text-xs text-neutral-500">Monitored Agents</p>
            </div>
          </div>
        </div>
      </div>

      {/* Agent Filter */}
      <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
        <div className="flex items-center gap-4">
          <label className="text-sm text-neutral-400">Filter by Agent:</label>
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            className="flex-1 max-w-md bg-neutral-800 border border-neutral-700 text-neutral-100 text-sm rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Agents</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Anomalies Section */}
      <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-6">
        <h2 className="text-lg font-semibold text-neutral-100 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-orange-400" />
          Anomaly Detection
        </h2>
        <AnomalyList agentId={selectedAgent || undefined} />
      </div>

      {/* Event Feed */}
      <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-6">
        <h2 className="text-lg font-semibold text-neutral-100 mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-green-400" />
          Live Event Feed
        </h2>
        <EventFeed
          agentId={selectedAgent || undefined}
          autoRefresh={true}
          refreshInterval={5000}
        />
      </div>
    </div>
  )
}
