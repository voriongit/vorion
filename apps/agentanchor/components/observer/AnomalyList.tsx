'use client'

import { useState, useEffect } from 'react'
import {
  AlertTriangle,
  XCircle,
  Activity,
  TrendingDown,
  Zap,
  Clock,
  CheckCircle,
  RefreshCw,
} from 'lucide-react'

interface Anomaly {
  id: string
  agent_id: string
  anomaly_type: string
  severity: string
  description: string
  details: Record<string, unknown>
  detected_at: string
  acknowledged_at?: string
  resolved_at?: string
}

interface AnomalyListProps {
  agentId?: string
}

const anomalyIcons: Record<string, typeof AlertTriangle> = {
  activity_spike: Zap,
  error_cluster: XCircle,
  timing_anomaly: Clock,
  risk_escalation: AlertTriangle,
  trust_drop: TrendingDown,
  rapid_actions: Activity,
}

const severityColors: Record<string, { bg: string; text: string; border: string }> = {
  low: { bg: 'bg-yellow-900/20', text: 'text-yellow-400', border: 'border-yellow-800' },
  medium: { bg: 'bg-orange-900/20', text: 'text-orange-400', border: 'border-orange-800' },
  high: { bg: 'bg-red-900/20', text: 'text-red-400', border: 'border-red-800' },
  critical: { bg: 'bg-red-900/40', text: 'text-red-300', border: 'border-red-600' },
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)

  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return date.toLocaleDateString()
}

export function AnomalyList({ agentId }: AnomalyListProps) {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAnomalies = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ limit: '20' })
      if (agentId) params.set('agent_id', agentId)

      const response = await fetch(`/api/observer/anomalies?${params}`)
      if (!response.ok) throw new Error('Failed to fetch anomalies')

      const data = await response.json()
      setAnomalies(data.anomalies || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAnomalies()
  }, [agentId])

  const handleAcknowledge = async (anomalyId: string) => {
    try {
      const response = await fetch(`/api/observer/anomalies/${anomalyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'acknowledge' }),
      })

      if (response.ok) {
        fetchAnomalies()
      }
    } catch (err) {
      console.error('Failed to acknowledge:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin text-neutral-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-800 text-red-400 rounded-lg p-4">
        {error}
      </div>
    )
  }

  if (anomalies.length === 0) {
    return (
      <div className="text-center py-8 text-neutral-500">
        <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No anomalies detected</p>
        <p className="text-sm mt-1">All systems operating normally</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {anomalies.map((anomaly) => {
        const Icon = anomalyIcons[anomaly.anomaly_type] || AlertTriangle
        const colors = severityColors[anomaly.severity] || severityColors.low

        return (
          <div
            key={anomaly.id}
            className={`rounded-lg border ${colors.border} ${colors.bg} p-4`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg bg-neutral-800 ${colors.text}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-neutral-100">
                      {anomaly.anomaly_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded ${colors.bg} ${colors.text}`}>
                      {anomaly.severity}
                    </span>
                  </div>
                  <p className="text-sm text-neutral-400 mt-1">
                    {anomaly.description}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <span className="text-xs text-neutral-500">
                  {formatTime(anomaly.detected_at)}
                </span>
                {!anomaly.acknowledged_at && (
                  <button
                    onClick={() => handleAcknowledge(anomaly.id)}
                    className="text-xs px-2 py-1 bg-neutral-800 hover:bg-neutral-700 rounded text-neutral-300 transition-colors"
                  >
                    Acknowledge
                  </button>
                )}
                {anomaly.acknowledged_at && !anomaly.resolved_at && (
                  <span className="text-xs text-yellow-500">Acknowledged</span>
                )}
                {anomaly.resolved_at && (
                  <span className="text-xs text-green-500">Resolved</span>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default AnomalyList
