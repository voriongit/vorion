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
  FileText,
  RefreshCw,
  ArrowRight,
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
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
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

  const frameworks = [
    {
      id: 'soc2' as const,
      name: 'SOC 2 Type II',
      icon: Shield,
      gradient: 'from-blue-500 to-indigo-600',
      description: 'Trust Service Criteria',
      stats: stats?.soc2
    },
    {
      id: 'hipaa' as const,
      name: 'HIPAA',
      icon: Lock,
      gradient: 'from-green-500 to-emerald-600',
      description: 'Health Insurance Portability',
      stats: stats?.hipaa
    },
    {
      id: 'iso27001' as const,
      name: 'ISO 27001:2022',
      icon: FileCheck,
      gradient: 'from-purple-500 to-indigo-600',
      description: 'Information Security Management',
      stats: stats?.iso27001
    }
  ]

  const getCompliancePercentage = (framework: typeof frameworks[0]) => {
    if (!framework.stats) return 0
    return Math.round((framework.stats.compliant / framework.stats.controls) * 100)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-3" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading compliance data...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 sm:p-2.5 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 shadow-lg shadow-rose-500/25">
            <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              Compliance Vault
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 hidden sm:block">
              SOC 2, HIPAA, and ISO 27001 management
            </p>
          </div>
        </div>

        <button
          onClick={() => window.open('/api/compliance/audit?limit=1000', '_blank')}
          className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 rounded-xl transition-all active:scale-95 touch-manipulation shadow-lg"
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Export Audit Log</span>
          <span className="sm:hidden">Export</span>
        </button>
      </div>

      {/* Framework Cards - Horizontal scroll on mobile */}
      <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0 pb-2">
        <div className="flex sm:grid sm:grid-cols-3 gap-3 sm:gap-4 min-w-max sm:min-w-0">
          {frameworks.map((framework) => {
            const percentage = getCompliancePercentage(framework)
            const Icon = framework.icon
            const isActive = activeFramework === framework.id

            return (
              <button
                key={framework.id}
                onClick={() => setActiveFramework(framework.id)}
                className={`
                  flex-shrink-0 w-[200px] sm:w-auto text-left bg-white dark:bg-gray-800 rounded-xl border p-4 sm:p-5 transition-all active:scale-[0.98] touch-manipulation
                  ${isActive
                    ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-lg'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md'}
                `}
              >
                <div className="flex items-start justify-between mb-3 sm:mb-4">
                  <div className={`p-2 rounded-lg bg-gradient-to-br ${framework.gradient}`}>
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </div>
                  <span className={`text-xl sm:text-2xl font-bold ${
                    percentage >= 90 ? 'text-green-600 dark:text-green-400' :
                    percentage >= 70 ? 'text-amber-600 dark:text-amber-400' :
                    'text-red-600 dark:text-red-400'
                  }`}>
                    {percentage}%
                  </span>
                </div>

                <h3 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">{framework.name}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{framework.description}</p>

                {/* Progress bar */}
                <div className="mt-3 sm:mt-4 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r transition-all duration-500 ${
                      percentage >= 90 ? 'from-green-500 to-emerald-400' :
                      percentage >= 70 ? 'from-amber-500 to-yellow-400' :
                      'from-red-500 to-rose-400'
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>

                <div className="mt-2 sm:mt-3 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                    {framework.stats?.compliant || 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-500" />
                    {framework.stats?.pending || 0}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <QuickStatCard
          label="Audit Events"
          value={stats?.auditEvents?.toLocaleString() || '—'}
          icon={Activity}
          gradient="from-blue-500 to-indigo-600"
        />
        <QuickStatCard
          label="Access Reviews"
          value={stats?.accessReviews?.toString() || '—'}
          icon={Users}
          gradient="from-green-500 to-emerald-600"
        />
        <QuickStatCard
          label="Retention"
          value="7 yrs"
          icon={Database}
          gradient="from-purple-500 to-indigo-600"
        />
        <QuickStatCard
          label="Hash Chain"
          value="SHA-256"
          icon={FileText}
          gradient="from-amber-500 to-orange-600"
        />
      </div>

      {/* Framework Details */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-gradient-to-br ${frameworks.find(f => f.id === activeFramework)?.gradient}`}>
              <FileCheck className="w-4 h-4 text-white" />
            </div>
            <h2 className="font-semibold text-gray-900 dark:text-white">
              {frameworks.find(f => f.id === activeFramework)?.name} Controls
            </h2>
          </div>
        </div>

        <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Recent Audit Events
            </h2>
          </div>
          <a
            href="/api/compliance/audit"
            target="_blank"
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            <span className="hidden sm:inline">View All</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="p-4 sm:p-5">
          {recentAudits.length === 0 ? (
            <div className="text-center py-8">
              <div className="p-3 rounded-full bg-gray-100 dark:bg-gray-700 inline-block mb-3">
                <Activity className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">No audit events recorded yet</p>
            </div>
          ) : (
            <div className="space-y-2 sm:space-y-3">
              {recentAudits.map((event) => (
                <AuditEventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Documentation Links */}
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
          Compliance Documentation
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <DocLink
            title="HIPAA Status"
            description="PHI access controls"
            href="/api/compliance/hipaa"
            icon={Lock}
            gradient="from-green-500 to-emerald-600"
          />
          <DocLink
            title="ISO 27001"
            description="ISMS documentation"
            href="/api/compliance/iso27001"
            icon={FileCheck}
            gradient="from-purple-500 to-indigo-600"
          />
          <DocLink
            title="Access Reviews"
            description="Permission audits"
            href="/api/compliance/access"
            icon={Users}
            gradient="from-blue-500 to-indigo-600"
          />
        </div>
      </div>
    </div>
  )
}

function QuickStatCard({
  label,
  value,
  icon: Icon,
  gradient,
}: {
  label: string
  value: string
  icon: React.ElementType
  gradient: string
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg bg-gradient-to-br ${gradient} flex-shrink-0`}>
          <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate">
            {value}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{label}</p>
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
    <div className="p-3 sm:p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-gray-900 dark:text-white text-sm truncate pr-2">{name}</span>
        <span className={`text-sm font-bold flex-shrink-0 ${percentage === 100 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
          {percentage}%
        </span>
      </div>
      <div className="h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden mb-2">
        <div
          className={`h-full transition-all duration-300 ${percentage === 100 ? 'bg-green-500' : 'bg-amber-500'}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-green-500" />
          {compliant}/{controls}
        </span>
        {pending > 0 && (
          <span className="flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-500" />
            {pending} pending
          </span>
        )}
      </div>
    </div>
  )
}

function AuditEventCard({ event }: { event: AuditEvent }) {
  return (
    <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
      <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex-shrink-0">
        <Activity className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-900 dark:text-white font-medium truncate">
          {event.event_type.replace(/_/g, ' ')}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
          {event.description}
        </p>
      </div>
      <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap flex-shrink-0 hidden sm:block">
        {new Date(event.created_at).toLocaleString()}
      </span>
      <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap flex-shrink-0 sm:hidden">
        {new Date(event.created_at).toLocaleDateString()}
      </span>
    </div>
  )
}

function DocLink({
  title,
  description,
  href,
  icon: Icon,
  gradient,
}: {
  title: string
  description: string
  href: string
  icon: React.ElementType
  gradient: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      className="flex items-center gap-3 p-3 sm:p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all active:scale-[0.98] touch-manipulation group"
    >
      <div className={`p-2 rounded-lg bg-gradient-to-br ${gradient} flex-shrink-0 group-hover:shadow-lg transition-shadow`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{title}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{description}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
    </a>
  )
}
