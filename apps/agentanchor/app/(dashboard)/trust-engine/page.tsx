'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Shield,
  Layers,
  Key,
  Activity,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  ArrowRight,
  Lock,
  Unlock,
  Eye,
  TrendingUp,
  Users,
  Building,
  Server,
  Zap,
  BarChart3,
} from 'lucide-react'

// =============================================================================
// TYPES
// =============================================================================

interface Phase6Stats {
  contextStats: {
    deployments: number
    organizations: number
    agents: number
    activeOperations: number
  }
  ceilingStats: {
    totalEvents: number
    totalAuditEntries: number
    complianceBreakdown: {
      compliant: number
      warning: number
      violation: number
    }
    agentsWithAlerts: number
  }
  roleGateStats: {
    totalEvaluations: number
    byDecision: {
      ALLOW: number
      DENY: number
      ESCALATE: number
    }
  }
  presetStats: {
    aciPresets: number
    vorionPresets: number
    axiomPresets: number
    verifiedLineages: number
  }
}

interface TrustTierData {
  tier: string
  label: string
  range: string
  count: number
  color: string
}

interface RecentEvent {
  id: string
  type: 'ceiling' | 'role_gate' | 'context' | 'provenance'
  agentId: string
  decision?: string
  status: 'compliant' | 'warning' | 'violation'
  timestamp: string
}

// =============================================================================
// CONSTANTS
// =============================================================================

const TIER_DATA: TrustTierData[] = [
  { tier: 'T0', label: 'Sandbox', range: '0-99', count: 0, color: 'from-gray-400 to-gray-500' },
  { tier: 'T1', label: 'Probation', range: '100-299', count: 0, color: 'from-red-400 to-red-500' },
  { tier: 'T2', label: 'Limited', range: '300-499', count: 0, color: 'from-orange-400 to-orange-500' },
  { tier: 'T3', label: 'Standard', range: '500-699', count: 0, color: 'from-yellow-400 to-yellow-500' },
  { tier: 'T4', label: 'Trusted', range: '700-899', count: 0, color: 'from-green-400 to-green-500' },
  { tier: 'T5', label: 'Sovereign', range: '900-1000', count: 0, color: 'from-blue-400 to-indigo-500' },
]

const ROLE_LABELS: Record<string, string> = {
  'R-L0': 'Listener',
  'R-L1': 'Executor',
  'R-L2': 'Planner',
  'R-L3': 'Orchestrator',
  'R-L4': 'Architect',
  'R-L5': 'Governor',
  'R-L6': 'Sovereign',
  'R-L7': 'Meta-Agent',
  'R-L8': 'Ecosystem',
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function Phase6DashboardPage() {
  const [stats, setStats] = useState<Phase6Stats | null>(null)
  const [tierData, setTierData] = useState<TrustTierData[]>(TIER_DATA)
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPhase6Data()
  }, [])

  async function fetchPhase6Data() {
    setLoading(true)
    try {
      const res = await fetch('/api/phase6/stats')
      if (res.ok) {
        const data = await res.json()
        setStats(data.stats)
        setTierData(data.tierDistribution || TIER_DATA)
        setRecentEvents(data.recentEvents || [])
      }
    } catch (err) {
      console.error('Failed to fetch Phase 6 data:', err)
      // Use demo data for now
      setStats(getDemoStats())
      setRecentEvents(getDemoEvents())
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading Phase 6 Trust Engine...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 sm:p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25">
            <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              Phase 6 Trust Engine
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 hidden sm:block">
              Hardened trust computation with regulatory compliance
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full">
            v1.0.0
          </span>
          <button
            onClick={() => fetchPhase6Data()}
            className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Architecture Decisions Cards */}
      <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0 pb-2">
        <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 min-w-max sm:min-w-0">
          <DecisionCard
            decision="Q1"
            title="Ceiling"
            description="Dual-layer enforcement"
            icon={BarChart3}
            gradient="from-blue-500 to-cyan-500"
            href="/trust-engine/ceiling"
          />
          <DecisionCard
            decision="Q2"
            title="Context"
            description="4-tier hierarchy"
            icon={Layers}
            gradient="from-green-500 to-emerald-500"
            href="/trust-engine/context"
          />
          <DecisionCard
            decision="Q3"
            title="Role Gates"
            description="3-layer stratified"
            icon={Key}
            gradient="from-purple-500 to-indigo-500"
            href="/trust-engine/role-gates"
          />
          <DecisionCard
            decision="Q4"
            title="Presets"
            description="Federated weights"
            icon={TrendingUp}
            gradient="from-amber-500 to-orange-500"
            href="/trust-engine/presets"
          />
          <DecisionCard
            decision="Q5"
            title="Provenance"
            description="Origin tracking"
            icon={Eye}
            gradient="from-rose-500 to-pink-500"
            href="/trust-engine/provenance"
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Context Hierarchy"
          value={(stats?.contextStats.deployments ?? 0) + (stats?.contextStats.organizations ?? 0) + (stats?.contextStats.agents ?? 0)}
          subtitle={`${stats?.contextStats.activeOperations ?? 0} active ops`}
          icon={Layers}
          gradient="from-green-500 to-emerald-600"
        />
        <StatCard
          title="Trust Events"
          value={stats?.ceilingStats.totalEvents ?? 0}
          subtitle={`${stats?.ceilingStats.totalAuditEntries ?? 0} audited`}
          icon={Activity}
          gradient="from-blue-500 to-indigo-600"
        />
        <StatCard
          title="Role Evaluations"
          value={stats?.roleGateStats.totalEvaluations ?? 0}
          subtitle={`${stats?.roleGateStats.byDecision.DENY ?? 0} denied`}
          icon={Key}
          gradient="from-purple-500 to-indigo-600"
        />
        <StatCard
          title="Compliance"
          value={stats?.ceilingStats.complianceBreakdown.compliant ?? 0}
          subtitle={`${stats?.ceilingStats.agentsWithAlerts ?? 0} alerts`}
          icon={Shield}
          gradient="from-amber-500 to-orange-600"
          alert={(stats?.ceilingStats.agentsWithAlerts ?? 0) > 0}
        />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Trust Tier Distribution */}
        <TrustTierDistribution tierData={tierData} />

        {/* Compliance Status */}
        <ComplianceStatus stats={stats} />
      </div>

      {/* Context Hierarchy */}
      <ContextHierarchyCard stats={stats} />

      {/* Recent Events */}
      <RecentEventsCard events={recentEvents} />

      {/* Quick Actions */}
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <QuickAction
            title="Verify Agent"
            icon={CheckCircle}
            href="/trust-engine/verify"
            gradient="from-green-500 to-emerald-500"
          />
          <QuickAction
            title="Check Role Gate"
            icon={Key}
            href="/trust-engine/role-gates"
            gradient="from-purple-500 to-indigo-500"
          />
          <QuickAction
            title="View Audit"
            icon={Eye}
            href="/trust-engine/audit"
            gradient="from-blue-500 to-cyan-500"
          />
          <QuickAction
            title="Gaming Alerts"
            icon={AlertTriangle}
            href="/trust-engine/alerts"
            gradient="from-amber-500 to-orange-500"
          />
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function DecisionCard({
  decision,
  title,
  description,
  href,
  icon: Icon,
  gradient,
}: {
  decision: string
  title: string
  description: string
  href: string
  icon: React.ElementType
  gradient: string
}) {
  return (
    <Link
      href={href}
      className="flex-shrink-0 w-[140px] sm:w-auto p-3 sm:p-4 rounded-xl bg-white dark:bg-gray-800 border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200 group"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-gradient-to-r ${gradient} text-white`}>
          {decision}
        </span>
        <div className={`p-1.5 rounded-lg bg-gradient-to-br ${gradient} opacity-80 group-hover:opacity-100 transition-opacity`}>
          <Icon className="w-3.5 h-3.5 text-white" />
        </div>
      </div>
      <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{title}</h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{description}</p>
    </Link>
  )
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  gradient,
  alert,
}: {
  title: string
  value: number
  subtitle: string
  icon: React.ElementType
  gradient: string
  alert?: boolean
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate pr-2">{title}</span>
        <div className={`p-1.5 sm:p-2 rounded-lg bg-gradient-to-br ${gradient} flex-shrink-0`}>
          <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
        </div>
      </div>
      <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{value.toLocaleString()}</p>
      <p className={`text-xs sm:text-sm mt-1 flex items-center gap-1 ${alert ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}`}>
        {alert && <AlertTriangle className="w-3 h-3 flex-shrink-0" />}
        <span className="truncate">{subtitle}</span>
      </p>
    </div>
  )
}

function TrustTierDistribution({ tierData }: { tierData: TrustTierData[] }) {
  const maxCount = Math.max(...tierData.map(t => t.count), 1)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <h2 className="font-semibold text-gray-900 dark:text-white">
            Trust Tier Distribution
          </h2>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-3">
        {tierData.map((tier) => (
          <div key={tier.tier} className="flex items-center gap-3">
            <div className="w-16 flex-shrink-0">
              <span className={`text-xs font-bold px-2 py-1 rounded-full bg-gradient-to-r ${tier.color} text-white`}>
                {tier.tier}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{tier.label}</span>
                <span className="text-xs text-gray-500">{tier.range}</span>
              </div>
              <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${tier.color} transition-all duration-500`}
                  style={{ width: `${(tier.count / maxCount) * 100}%` }}
                />
              </div>
            </div>
            <span className="text-sm font-semibold text-gray-900 dark:text-white w-8 text-right">
              {tier.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ComplianceStatus({ stats }: { stats: Phase6Stats | null }) {
  const total = (stats?.ceilingStats.complianceBreakdown.compliant ?? 0) +
    (stats?.ceilingStats.complianceBreakdown.warning ?? 0) +
    (stats?.ceilingStats.complianceBreakdown.violation ?? 0)

  const items = [
    {
      label: 'Compliant',
      count: stats?.ceilingStats.complianceBreakdown.compliant ?? 0,
      color: 'bg-green-500',
      icon: CheckCircle,
    },
    {
      label: 'Warning',
      count: stats?.ceilingStats.complianceBreakdown.warning ?? 0,
      color: 'bg-amber-500',
      icon: AlertTriangle,
    },
    {
      label: 'Violation',
      count: stats?.ceilingStats.complianceBreakdown.violation ?? 0,
      color: 'bg-red-500',
      icon: AlertTriangle,
    },
  ]

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <h2 className="font-semibold text-gray-900 dark:text-white">
            Compliance Status
          </h2>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {/* Progress bar */}
        {total > 0 && (
          <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden flex mb-4">
            {items.map((item) => (
              <div
                key={item.label}
                className={`${item.color} transition-all duration-500`}
                style={{ width: `${(item.count / total) * 100}%` }}
              />
            ))}
          </div>
        )}

        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50"
            >
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${item.color}`} />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {item.label}
                </span>
              </div>
              <span className="text-lg font-bold text-gray-900 dark:text-white">
                {item.count}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ContextHierarchyCard({ stats }: { stats: Phase6Stats | null }) {
  const levels = [
    {
      tier: 'Tier 1',
      label: 'Deployment',
      icon: Server,
      status: 'IMMUTABLE',
      count: stats?.contextStats.deployments ?? 0,
      color: 'from-blue-500 to-indigo-500',
    },
    {
      tier: 'Tier 2',
      label: 'Organization',
      icon: Building,
      status: 'LOCKED',
      count: stats?.contextStats.organizations ?? 0,
      color: 'from-purple-500 to-indigo-500',
    },
    {
      tier: 'Tier 3',
      label: 'Agent',
      icon: Users,
      status: 'FROZEN',
      count: stats?.contextStats.agents ?? 0,
      color: 'from-green-500 to-emerald-500',
    },
    {
      tier: 'Tier 4',
      label: 'Operation',
      icon: Zap,
      status: 'EPHEMERAL',
      count: stats?.contextStats.activeOperations ?? 0,
      color: 'from-amber-500 to-orange-500',
    },
  ]

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Q2: Context Hierarchy
            </h2>
          </div>
          <Link
            href="/trust-engine/context"
            className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
          >
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2">
          {levels.map((level, index) => (
            <div key={level.tier} className="flex items-center">
              <div className="flex flex-col items-center min-w-[80px]">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${level.color} shadow-lg mb-2`}>
                  <level.icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{level.tier}</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{level.label}</span>
                <span className={`text-xs mt-1 px-2 py-0.5 rounded-full ${
                  level.status === 'IMMUTABLE' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                  level.status === 'LOCKED' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                  level.status === 'FROZEN' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                }`}>
                  {level.status === 'IMMUTABLE' ? <Lock className="w-3 h-3 inline mr-1" /> :
                   level.status === 'LOCKED' ? <Lock className="w-3 h-3 inline mr-1" /> :
                   level.status === 'FROZEN' ? <Lock className="w-3 h-3 inline mr-1" /> :
                   <Unlock className="w-3 h-3 inline mr-1" />}
                  {level.count}
                </span>
              </div>
              {index < levels.length - 1 && (
                <ArrowRight className="w-4 h-4 text-gray-300 dark:text-gray-600 mx-2 flex-shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function RecentEventsCard({ events }: { events: RecentEvent[] }) {
  const eventConfig: Record<string, { icon: React.ElementType; gradient: string }> = {
    ceiling: { icon: BarChart3, gradient: 'from-blue-500 to-indigo-500' },
    role_gate: { icon: Key, gradient: 'from-purple-500 to-indigo-500' },
    context: { icon: Layers, gradient: 'from-green-500 to-emerald-500' },
    provenance: { icon: Eye, gradient: 'from-amber-500 to-orange-500' },
  }

  const statusConfig = {
    compliant: { color: 'bg-green-500', label: 'Compliant' },
    warning: { color: 'bg-amber-500', label: 'Warning' },
    violation: { color: 'bg-red-500', label: 'Violation' },
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Recent Trust Events
            </h2>
          </div>
          <Link
            href="/trust-engine/audit"
            className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
          >
            View audit <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="p-3 rounded-full bg-gray-100 dark:bg-gray-700 mb-3">
              <Activity className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Trust events will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-2 sm:space-y-3">
            {events.slice(0, 5).map((event) => {
              const config = eventConfig[event.type] || { icon: Activity, gradient: 'from-gray-500 to-gray-600' }
              const status = statusConfig[event.status]

              return (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg bg-gradient-to-br ${config.gradient} flex-shrink-0`}>
                      <config.icon className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {event.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        Agent: {event.agentId}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <span className={`w-2 h-2 rounded-full ${status.color}`} />
                    <span className="text-xs text-gray-400 hidden sm:inline">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function QuickAction({
  title,
  icon: Icon,
  href,
  gradient,
}: {
  title: string
  icon: React.ElementType
  href: string
  gradient: string
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 p-3 sm:p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200 group"
    >
      <div className={`p-2.5 rounded-xl bg-gradient-to-br ${gradient} group-hover:shadow-lg transition-shadow`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 text-center">{title}</span>
    </Link>
  )
}

// =============================================================================
// DEMO DATA
// =============================================================================

function getDemoStats(): Phase6Stats {
  return {
    contextStats: {
      deployments: 3,
      organizations: 12,
      agents: 47,
      activeOperations: 23,
    },
    ceilingStats: {
      totalEvents: 1842,
      totalAuditEntries: 1842,
      complianceBreakdown: {
        compliant: 1756,
        warning: 72,
        violation: 14,
      },
      agentsWithAlerts: 5,
    },
    roleGateStats: {
      totalEvaluations: 3291,
      byDecision: {
        ALLOW: 3104,
        DENY: 142,
        ESCALATE: 45,
      },
    },
    presetStats: {
      aciPresets: 3,
      vorionPresets: 3,
      axiomPresets: 8,
      verifiedLineages: 6,
    },
  }
}

function getDemoEvents(): RecentEvent[] {
  return [
    { id: '1', type: 'ceiling', agentId: 'agent-042', status: 'compliant', timestamp: new Date().toISOString() },
    { id: '2', type: 'role_gate', agentId: 'agent-017', decision: 'ALLOW', status: 'compliant', timestamp: new Date(Date.now() - 60000).toISOString() },
    { id: '3', type: 'ceiling', agentId: 'agent-089', status: 'warning', timestamp: new Date(Date.now() - 120000).toISOString() },
    { id: '4', type: 'provenance', agentId: 'agent-023', status: 'compliant', timestamp: new Date(Date.now() - 180000).toISOString() },
    { id: '5', type: 'context', agentId: 'agent-056', status: 'compliant', timestamp: new Date(Date.now() - 240000).toISOString() },
  ]
}
