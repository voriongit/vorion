'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  BarChart3,
  ArrowLeft,
  RefreshCw,
  Shield,
  AlertTriangle,
  CheckCircle,
  Activity,
  Clock,
  TrendingDown,
  TrendingUp,
  Settings,
} from 'lucide-react'

// =============================================================================
// TYPES
// =============================================================================

interface CeilingEvent {
  id: string
  agentId: string
  rawScore: number
  clampedScore: number
  ceilingApplied: boolean
  ceilingSource: 'context' | 'regulatory' | 'tier_max'
  tier: string
  timestamp: string
  regulatoryFramework?: string
}

interface GamingAlert {
  agentId: string
  alertType: 'rapid_change' | 'oscillation' | 'boundary_testing'
  alertCount: number
  status: 'active' | 'resolved' | 'monitoring'
  lastDetected: string
}

interface ComplianceMetric {
  framework: string
  retentionDays: number
  compliantCount: number
  totalCount: number
  percentage: number
}

// =============================================================================
// DEMO DATA
// =============================================================================

const DEMO_EVENTS: CeilingEvent[] = [
  { id: '1', agentId: 'agent-042', rawScore: 920, clampedScore: 899, ceilingApplied: true, ceilingSource: 'context', tier: 'T4', timestamp: new Date().toISOString(), regulatoryFramework: 'GDPR' },
  { id: '2', agentId: 'agent-017', rawScore: 750, clampedScore: 750, ceilingApplied: false, ceilingSource: 'tier_max', tier: 'T4', timestamp: new Date(Date.now() - 60000).toISOString(), regulatoryFramework: 'HIPAA' },
  { id: '3', agentId: 'agent-089', rawScore: 680, clampedScore: 680, ceilingApplied: false, ceilingSource: 'tier_max', tier: 'T3', timestamp: new Date(Date.now() - 120000).toISOString() },
  { id: '4', agentId: 'agent-023', rawScore: 950, clampedScore: 699, ceilingApplied: true, ceilingSource: 'regulatory', tier: 'T3', timestamp: new Date(Date.now() - 180000).toISOString(), regulatoryFramework: 'EU_AI_ACT' },
  { id: '5', agentId: 'agent-056', rawScore: 510, clampedScore: 510, ceilingApplied: false, ceilingSource: 'tier_max', tier: 'T3', timestamp: new Date(Date.now() - 240000).toISOString() },
]

const DEMO_ALERTS: GamingAlert[] = [
  { agentId: 'agent-089', alertType: 'rapid_change', alertCount: 3, status: 'active', lastDetected: new Date().toISOString() },
  { agentId: 'agent-023', alertType: 'boundary_testing', alertCount: 5, status: 'monitoring', lastDetected: new Date(Date.now() - 3600000).toISOString() },
  { agentId: 'agent-011', alertType: 'oscillation', alertCount: 2, status: 'resolved', lastDetected: new Date(Date.now() - 86400000).toISOString() },
]

const DEMO_COMPLIANCE: ComplianceMetric[] = [
  { framework: 'NONE', retentionDays: 30, compliantCount: 28, totalCount: 30, percentage: 93.3 },
  { framework: 'HIPAA', retentionDays: 2190, compliantCount: 8, totalCount: 8, percentage: 100 },
  { framework: 'GDPR', retentionDays: 365, compliantCount: 5, totalCount: 6, percentage: 83.3 },
  { framework: 'EU_AI_ACT', retentionDays: 3650, compliantCount: 2, totalCount: 3, percentage: 66.7 },
  { framework: 'SOC2', retentionDays: 365, compliantCount: 4, totalCount: 4, percentage: 100 },
]

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function CeilingPage() {
  const [events, setEvents] = useState<CeilingEvent[]>(DEMO_EVENTS)
  const [alerts, setAlerts] = useState<GamingAlert[]>(DEMO_ALERTS)
  const [compliance, setCompliance] = useState<ComplianceMetric[]>(DEMO_COMPLIANCE)
  const [loading, setLoading] = useState(false)

  const ceilingAppliedCount = events.filter(e => e.ceilingApplied).length
  const activeAlerts = alerts.filter(a => a.status === 'active').length

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/trust-engine"
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </Link>
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg shadow-blue-500/25">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              Q1: Ceiling Enforcement
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Dual-layer ceiling with regulatory observability
            </p>
          </div>
        </div>
        <button
          onClick={() => setLoading(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg hover:opacity-90 transition-opacity"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Events"
          value={events.length}
          subtitle="Trust computations"
          icon={Activity}
          gradient="from-blue-500 to-indigo-600"
        />
        <StatCard
          title="Ceilings Applied"
          value={ceilingAppliedCount}
          subtitle={`${((ceilingAppliedCount / events.length) * 100).toFixed(1)}% of events`}
          icon={TrendingDown}
          gradient="from-amber-500 to-orange-600"
        />
        <StatCard
          title="Gaming Alerts"
          value={activeAlerts}
          subtitle={`${alerts.length} total detected`}
          icon={AlertTriangle}
          gradient="from-red-500 to-rose-600"
          alert={activeAlerts > 0}
        />
        <StatCard
          title="Compliance Rate"
          value={`${(compliance.reduce((sum, c) => sum + c.compliantCount, 0) / compliance.reduce((sum, c) => sum + c.totalCount, 0) * 100).toFixed(0)}%`}
          subtitle="Across frameworks"
          icon={Shield}
          gradient="from-green-500 to-emerald-600"
        />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Ceiling Events */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-500" />
              Recent Ceiling Events
            </h2>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {events.map((event) => (
              <div key={event.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${event.ceilingApplied ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-green-100 dark:bg-green-900/30'}`}>
                      {event.ceilingApplied ? (
                        <TrendingDown className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      ) : (
                        <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {event.agentId}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {event.rawScore} → {event.clampedScore}
                        {event.ceilingApplied && (
                          <span className="ml-2 text-amber-600 dark:text-amber-400">
                            ({event.ceilingSource})
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                      event.tier === 'T5' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                      event.tier === 'T4' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                      event.tier === 'T3' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                      'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {event.tier}
                    </span>
                    {event.regulatoryFramework && (
                      <p className="text-xs text-gray-400 mt-1">{event.regulatoryFramework}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Gaming Alerts */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Gaming Detection Alerts
            </h2>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {alerts.length === 0 ? (
              <div className="p-8 text-center">
                <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30 inline-flex mb-3">
                  <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No gaming attempts detected
                </p>
              </div>
            ) : (
              alerts.map((alert) => (
                <div key={alert.agentId} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        alert.status === 'active' ? 'bg-red-100 dark:bg-red-900/30' :
                        alert.status === 'monitoring' ? 'bg-amber-100 dark:bg-amber-900/30' :
                        'bg-gray-100 dark:bg-gray-700'
                      }`}>
                        <AlertTriangle className={`w-4 h-4 ${
                          alert.status === 'active' ? 'text-red-600 dark:text-red-400' :
                          alert.status === 'monitoring' ? 'text-amber-600 dark:text-amber-400' :
                          'text-gray-500'
                        }`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {alert.agentId}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {alert.alertType.replace(/_/g, ' ')} ({alert.alertCount} occurrences)
                        </p>
                      </div>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      alert.status === 'active' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                      alert.status === 'monitoring' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                      'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      {alert.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Compliance Frameworks */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-green-500" />
            Regulatory Compliance & Retention
          </h2>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {compliance.map((framework) => (
              <div
                key={framework.framework}
                className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {framework.framework}
                  </span>
                  <span className={`text-xs font-bold ${
                    framework.percentage >= 90 ? 'text-green-600 dark:text-green-400' :
                    framework.percentage >= 70 ? 'text-amber-600 dark:text-amber-400' :
                    'text-red-600 dark:text-red-400'
                  }`}>
                    {framework.percentage.toFixed(0)}%
                  </span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden mb-2">
                  <div
                    className={`h-full transition-all duration-500 ${
                      framework.percentage >= 90 ? 'bg-green-500' :
                      framework.percentage >= 70 ? 'bg-amber-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${framework.percentage}%` }}
                  />
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                  <Clock className="w-3 h-3" />
                  <span>{framework.retentionDays} day retention</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Configuration Panel */}
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Settings className="w-5 h-5 text-gray-500" />
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Gaming Detection Thresholds
            </h3>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Rapid Change</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">100 points / 60s</p>
          </div>
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Oscillation</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">3 reversals / 5m</p>
          </div>
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Boundary Testing</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">5 near-ceiling / 10m</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  gradient,
  alert,
}: {
  title: string
  value: number | string
  subtitle: string
  icon: React.ElementType
  gradient: string
  alert?: boolean
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500 dark:text-gray-400">{title}</span>
        <div className={`p-2 rounded-lg bg-gradient-to-br ${gradient}`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className={`text-sm mt-1 flex items-center gap-1 ${alert ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}`}>
        {alert && <AlertTriangle className="w-3 h-3" />}
        {subtitle}
      </p>
    </div>
  )
}
