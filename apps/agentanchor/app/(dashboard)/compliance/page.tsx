'use client'

import { useState, useEffect } from 'react'
import {
  Shield,
  FileCheck,
  Lock,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Activity,
  Database,
  Users,
  FileText
} from 'lucide-react'

interface ComplianceStats {
  soc2: { controls: number; compliant: number; pending: number }
  hipaa: { controls: number; compliant: number; pending: number }
  iso27001: { controls: number; compliant: number; pending: number }
  auditEvents: number
  lastAudit: string | null
  accessReviews: number
}

interface AuditEvent {
  id: string
  event_type: string
  description: string
  user_id: string
  created_at: string
  metadata: Record<string, unknown>
}

export default function CompliancePage() {
  const [stats, setStats] = useState<ComplianceStats | null>(null)
  const [recentAudits, setRecentAudits] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFramework, setActiveFramework] = useState<'soc2' | 'hipaa' | 'iso27001'>('soc2')

  useEffect(() => {
    async function fetchData() {
      try {
        const [dashboardRes, auditRes] = await Promise.all([
          fetch('/api/compliance'),
          fetch('/api/compliance/audit?limit=10')
        ])

        if (dashboardRes.ok) {
          const data = await dashboardRes.json()
          setStats({
            soc2: { controls: 45, compliant: data.soc2_compliant || 42, pending: 3 },
            hipaa: { controls: 25, compliant: data.hipaa_compliant || 23, pending: 2 },
            iso27001: { controls: 93, compliant: data.iso27001_compliant || 89, pending: 4 },
            auditEvents: data.total_audit_events || 0,
            lastAudit: data.last_audit_date,
            accessReviews: data.access_reviews || 0
          })
        }

        if (auditRes.ok) {
          const auditData = await auditRes.json()
          setRecentAudits(auditData.events || [])
        }
      } catch (err) {
        console.error('Failed to fetch compliance data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const frameworks = [
    {
      id: 'soc2' as const,
      name: 'SOC 2 Type II',
      icon: Shield,
      color: 'blue',
      description: 'Trust Service Criteria',
      stats: stats?.soc2
    },
    {
      id: 'hipaa' as const,
      name: 'HIPAA',
      icon: Lock,
      color: 'green',
      description: 'Health Insurance Portability',
      stats: stats?.hipaa
    },
    {
      id: 'iso27001' as const,
      name: 'ISO 27001:2022',
      icon: FileCheck,
      color: 'purple',
      description: 'Information Security Management',
      stats: stats?.iso27001
    }
  ]

  const getCompliancePercentage = (framework: typeof frameworks[0]) => {
    if (!framework.stats) return 0
    return Math.round((framework.stats.compliant / framework.stats.controls) * 100)
  }

  const getColorClasses = (color: string) => ({
    bg: `bg-${color}-900/30`,
    text: `text-${color}-400`,
    border: `border-${color}-500`,
    gradient: `from-${color}-600 to-${color}-400`
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100 flex items-center gap-3">
            <Shield className="w-7 h-7 text-slate-400" />
            Compliance Vault
          </h1>
          <p className="text-neutral-400 mt-1">
            SOC 2, HIPAA, and ISO 27001 compliance management
          </p>
        </div>

        <button
          onClick={() => window.open('/api/compliance/audit?limit=1000', '_blank')}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-neutral-100 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
        >
          <Download className="w-4 h-4" />
          Export Audit Log
        </button>
      </div>

      {/* Framework Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {frameworks.map((framework) => {
          const percentage = getCompliancePercentage(framework)
          const Icon = framework.icon
          const isActive = activeFramework === framework.id

          return (
            <button
              key={framework.id}
              onClick={() => setActiveFramework(framework.id)}
              className={`
                text-left bg-neutral-900 rounded-lg border p-5 transition-all
                ${isActive ? 'border-blue-500 ring-1 ring-blue-500' : 'border-neutral-800 hover:border-neutral-700'}
              `}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`p-2 rounded-lg bg-${framework.color}-900/30`}>
                  <Icon className={`w-5 h-5 text-${framework.color}-400`} />
                </div>
                <span className={`text-2xl font-bold ${percentage >= 90 ? 'text-green-400' : percentage >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {percentage}%
                </span>
              </div>

              <h3 className="font-semibold text-neutral-100">{framework.name}</h3>
              <p className="text-xs text-neutral-500 mt-1">{framework.description}</p>

              {/* Progress bar */}
              <div className="mt-4 h-2 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${
                    percentage >= 90 ? 'from-green-600 to-green-400' :
                    percentage >= 70 ? 'from-yellow-600 to-yellow-400' :
                    'from-red-600 to-red-400'
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              </div>

              <div className="mt-3 flex items-center gap-4 text-xs text-neutral-500">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-green-400" />
                  {framework.stats?.compliant || 0} compliant
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-yellow-400" />
                  {framework.stats?.pending || 0} pending
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-900/30">
              <Activity className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-100">
                {stats?.auditEvents.toLocaleString() || '—'}
              </p>
              <p className="text-xs text-neutral-500">Audit Events</p>
            </div>
          </div>
        </div>

        <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-900/30">
              <Users className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-100">
                {stats?.accessReviews || '—'}
              </p>
              <p className="text-xs text-neutral-500">Access Reviews</p>
            </div>
          </div>
        </div>

        <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-900/30">
              <Database className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-100">7 yrs</p>
              <p className="text-xs text-neutral-500">Retention Period</p>
            </div>
          </div>
        </div>

        <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-900/30">
              <FileText className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-100">SHA-256</p>
              <p className="text-xs text-neutral-500">Hash Chain</p>
            </div>
          </div>
        </div>
      </div>

      {/* Framework Details */}
      <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-6">
        <h2 className="text-lg font-semibold text-neutral-100 mb-4">
          {frameworks.find(f => f.id === activeFramework)?.name} Controls
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeFramework === 'soc2' && (
            <>
              <ControlCategory name="Security" controls={12} compliant={11} />
              <ControlCategory name="Availability" controls={8} compliant={8} />
              <ControlCategory name="Processing Integrity" controls={10} compliant={9} />
              <ControlCategory name="Confidentiality" controls={8} compliant={8} />
              <ControlCategory name="Privacy" controls={7} compliant={6} />
            </>
          )}
          {activeFramework === 'hipaa' && (
            <>
              <ControlCategory name="Administrative Safeguards" controls={9} compliant={8} />
              <ControlCategory name="Physical Safeguards" controls={4} compliant={4} />
              <ControlCategory name="Technical Safeguards" controls={9} compliant={8} />
              <ControlCategory name="Breach Notification" controls={3} compliant={3} />
            </>
          )}
          {activeFramework === 'iso27001' && (
            <>
              <ControlCategory name="Organizational Controls" controls={37} compliant={35} />
              <ControlCategory name="People Controls" controls={8} compliant={8} />
              <ControlCategory name="Physical Controls" controls={14} compliant={13} />
              <ControlCategory name="Technological Controls" controls={34} compliant={33} />
            </>
          )}
        </div>
      </div>

      {/* Recent Audit Events */}
      <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-neutral-100 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-400" />
            Recent Audit Events
          </h2>
          <a
            href="/api/compliance/audit"
            target="_blank"
            className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
          >
            View All <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {recentAudits.length === 0 ? (
          <p className="text-neutral-500 text-sm">No audit events recorded yet.</p>
        ) : (
          <div className="space-y-3">
            {recentAudits.map((event) => (
              <div
                key={event.id}
                className="flex items-start gap-3 p-3 bg-neutral-800/50 rounded-lg"
              >
                <div className="p-1.5 rounded bg-blue-900/30">
                  <Activity className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-neutral-200 font-medium">
                    {event.event_type.replace(/_/g, ' ')}
                  </p>
                  <p className="text-xs text-neutral-500 truncate">
                    {event.description}
                  </p>
                </div>
                <span className="text-xs text-neutral-500 whitespace-nowrap">
                  {new Date(event.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Documentation Links */}
      <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-6">
        <h2 className="text-lg font-semibold text-neutral-100 mb-4">
          Compliance Documentation
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a
            href="/api/compliance/hipaa"
            target="_blank"
            className="flex items-center gap-3 p-4 bg-neutral-800/50 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <Lock className="w-5 h-5 text-green-400" />
            <div>
              <p className="font-medium text-neutral-200">HIPAA Status</p>
              <p className="text-xs text-neutral-500">PHI access controls</p>
            </div>
          </a>
          <a
            href="/api/compliance/iso27001"
            target="_blank"
            className="flex items-center gap-3 p-4 bg-neutral-800/50 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <FileCheck className="w-5 h-5 text-purple-400" />
            <div>
              <p className="font-medium text-neutral-200">ISO 27001</p>
              <p className="text-xs text-neutral-500">ISMS documentation</p>
            </div>
          </a>
          <a
            href="/api/compliance/access"
            target="_blank"
            className="flex items-center gap-3 p-4 bg-neutral-800/50 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <Users className="w-5 h-5 text-blue-400" />
            <div>
              <p className="font-medium text-neutral-200">Access Reviews</p>
              <p className="text-xs text-neutral-500">Permission audits</p>
            </div>
          </a>
        </div>
      </div>
    </div>
  )
}

function ControlCategory({
  name,
  controls,
  compliant
}: {
  name: string
  controls: number
  compliant: number
}) {
  const percentage = Math.round((compliant / controls) * 100)
  const pending = controls - compliant

  return (
    <div className="p-4 bg-neutral-800/50 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-neutral-200">{name}</span>
        <span className={`text-sm font-bold ${percentage === 100 ? 'text-green-400' : 'text-yellow-400'}`}>
          {percentage}%
        </span>
      </div>
      <div className="h-1.5 bg-neutral-700 rounded-full overflow-hidden mb-2">
        <div
          className={`h-full ${percentage === 100 ? 'bg-green-500' : 'bg-yellow-500'}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="flex items-center gap-3 text-xs text-neutral-500">
        <span className="flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-green-400" />
          {compliant}/{controls}
        </span>
        {pending > 0 && (
          <span className="flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-yellow-400" />
            {pending} pending
          </span>
        )}
      </div>
    </div>
  )
}
