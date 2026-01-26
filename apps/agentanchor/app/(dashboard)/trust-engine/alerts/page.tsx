'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
  Bell,
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Activity,
  Eye,
  Settings,
} from 'lucide-react'

// =============================================================================
// TYPES
// =============================================================================

interface GamingAlert {
  id: string
  agentId: string
  alertType: 'rapid_change' | 'oscillation' | 'boundary_testing' | 'ceiling_breach'
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'active' | 'investigating' | 'resolved' | 'false_positive'
  detectedAt: string
  resolvedAt?: string
  details: string
  occurrences: number
}

// =============================================================================
// DEMO DATA
// =============================================================================

const DEMO_ALERTS: GamingAlert[] = [
  {
    id: '1',
    agentId: 'agent-089',
    alertType: 'rapid_change',
    severity: 'high',
    status: 'active',
    detectedAt: new Date().toISOString(),
    details: 'Trust score changed 150 points within 60 seconds (threshold: 100)',
    occurrences: 3,
  },
  {
    id: '2',
    agentId: 'agent-023',
    alertType: 'boundary_testing',
    severity: 'medium',
    status: 'investigating',
    detectedAt: new Date(Date.now() - 3600000).toISOString(),
    details: '7 requests near T4 ceiling (899) within 10 minutes',
    occurrences: 7,
  },
  {
    id: '3',
    agentId: 'agent-056',
    alertType: 'oscillation',
    severity: 'low',
    status: 'resolved',
    detectedAt: new Date(Date.now() - 86400000).toISOString(),
    resolvedAt: new Date(Date.now() - 43200000).toISOString(),
    details: '4 score reversals within 5 minutes',
    occurrences: 4,
  },
  {
    id: '4',
    agentId: 'agent-011',
    alertType: 'ceiling_breach',
    severity: 'critical',
    status: 'resolved',
    detectedAt: new Date(Date.now() - 172800000).toISOString(),
    resolvedAt: new Date(Date.now() - 86400000).toISOString(),
    details: 'Attempted to exceed regulatory ceiling (EU AI Act: 699 max)',
    occurrences: 1,
  },
  {
    id: '5',
    agentId: 'agent-034',
    alertType: 'rapid_change',
    severity: 'medium',
    status: 'false_positive',
    detectedAt: new Date(Date.now() - 259200000).toISOString(),
    resolvedAt: new Date(Date.now() - 172800000).toISOString(),
    details: 'Legitimate batch processing caused rapid score changes',
    occurrences: 2,
  },
]

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function AlertsPage() {
  const [alerts] = useState<GamingAlert[]>(DEMO_ALERTS)
  const [filter, setFilter] = useState<string>('all')
  const [loading, setLoading] = useState(false)

  const alertTypeConfig: Record<string, { icon: React.ElementType; label: string }> = {
    rapid_change: { icon: TrendingUp, label: 'Rapid Change' },
    oscillation: { icon: Activity, label: 'Oscillation' },
    boundary_testing: { icon: TrendingDown, label: 'Boundary Testing' },
    ceiling_breach: { icon: AlertTriangle, label: 'Ceiling Breach' },
  }

  const severityConfig: Record<string, { color: string; bgColor: string }> = {
    low: { color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
    medium: { color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-100 dark:bg-amber-900/30' },
    high: { color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-100 dark:bg-orange-900/30' },
    critical: { color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30' },
  }

  const statusConfig: Record<string, { icon: React.ElementType; color: string; bgColor: string }> = {
    active: { icon: AlertTriangle, color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30' },
    investigating: { icon: Eye, color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-100 dark:bg-amber-900/30' },
    resolved: { icon: CheckCircle, color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/30' },
    false_positive: { icon: XCircle, color: 'text-gray-600 dark:text-gray-400', bgColor: 'bg-gray-100 dark:bg-gray-700' },
  }

  const filteredAlerts = filter === 'all' ? alerts : alerts.filter(a => a.status === filter)

  const stats = {
    active: alerts.filter(a => a.status === 'active').length,
    investigating: alerts.filter(a => a.status === 'investigating').length,
    resolved: alerts.filter(a => a.status === 'resolved').length,
    falsePositive: alerts.filter(a => a.status === 'false_positive').length,
  }

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
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/25">
            <AlertTriangle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              Gaming Detection Alerts
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Trust score manipulation detection
            </p>
          </div>
        </div>
        <button
          onClick={() => setLoading(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg hover:opacity-90 transition-opacity"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <button
          onClick={() => setFilter(filter === 'active' ? 'all' : 'active')}
          className={`p-4 rounded-xl border transition-all ${
            filter === 'active'
              ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <span className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.active}</span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Active</p>
        </button>
        <button
          onClick={() => setFilter(filter === 'investigating' ? 'all' : 'investigating')}
          className={`p-4 rounded-xl border transition-all ${
            filter === 'investigating'
              ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <Eye className="w-5 h-5 text-amber-500" />
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.investigating}</span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Investigating</p>
        </button>
        <button
          onClick={() => setFilter(filter === 'resolved' ? 'all' : 'resolved')}
          className={`p-4 rounded-xl border transition-all ${
            filter === 'resolved'
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.resolved}</span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Resolved</p>
        </button>
        <button
          onClick={() => setFilter(filter === 'false_positive' ? 'all' : 'false_positive')}
          className={`p-4 rounded-xl border transition-all ${
            filter === 'false_positive'
              ? 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600'
              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <XCircle className="w-5 h-5 text-gray-500" />
            <span className="text-2xl font-bold text-gray-600 dark:text-gray-400">{stats.falsePositive}</span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">False Positive</p>
        </button>
      </div>

      {/* Alert Types Legend */}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl border border-amber-200 dark:border-amber-800 p-4">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Detection Types</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(alertTypeConfig).map(([key, config]) => {
            const Icon = config.icon
            return (
              <div key={key} className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <Icon className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{config.label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Alerts List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-500" />
              Alerts ({filteredAlerts.length})
            </h2>
            {filter !== 'all' && (
              <button
                onClick={() => setFilter('all')}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Clear filter
              </button>
            )}
          </div>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {filteredAlerts.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No alerts matching your filter
              </p>
            </div>
          ) : (
            filteredAlerts.map((alert) => {
              const typeConfig = alertTypeConfig[alert.alertType]
              const TypeIcon = typeConfig.icon
              const sevConfig = severityConfig[alert.severity]
              const statConfig = statusConfig[alert.status]
              const StatusIcon = statConfig.icon

              return (
                <div key={alert.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${sevConfig.bgColor}`}>
                        <TypeIcon className={`w-4 h-4 ${sevConfig.color}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {alert.agentId}
                          </p>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${sevConfig.bgColor} ${sevConfig.color}`}>
                            {alert.severity.toUpperCase()}
                          </span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${statConfig.bgColor} ${statConfig.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {alert.status.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                          {typeConfig.label}: {alert.details}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(alert.detectedAt).toLocaleString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <Activity className="w-3 h-3" />
                            {alert.occurrences} occurrences
                          </span>
                          {alert.resolvedAt && (
                            <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                              <CheckCircle className="w-3 h-3" />
                              Resolved: {new Date(alert.resolvedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Thresholds Configuration */}
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Settings className="w-5 h-5 text-gray-500" />
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Detection Thresholds
            </h3>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-medium text-gray-900 dark:text-white">Rapid Change</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">100 points within 60 seconds</p>
          </div>
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-medium text-gray-900 dark:text-white">Oscillation</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">3 reversals within 5 minutes</p>
          </div>
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-medium text-gray-900 dark:text-white">Boundary Testing</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">5 near-ceiling hits in 10 minutes</p>
          </div>
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-medium text-gray-900 dark:text-white">Ceiling Breach</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Any attempt to exceed ceiling</p>
          </div>
        </div>
      </div>
    </div>
  )
}
