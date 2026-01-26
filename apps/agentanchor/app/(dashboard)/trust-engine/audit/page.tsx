'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Eye,
  ArrowLeft,
  RefreshCw,
  Filter,
  Download,
  Search,
  Clock,
  BarChart3,
  Key,
  Layers,
  Shield,
  CheckCircle,
  AlertTriangle,
  XCircle,
} from 'lucide-react'

// =============================================================================
// TYPES
// =============================================================================

interface AuditEntry {
  id: string
  timestamp: string
  eventType: 'ceiling' | 'role_gate' | 'context' | 'provenance' | 'preset'
  agentId: string
  action: string
  decision: string
  status: 'compliant' | 'warning' | 'violation'
  details: string
  regulatory?: string
  retentionRequired: boolean
}

// =============================================================================
// DEMO DATA
// =============================================================================

const DEMO_ENTRIES: AuditEntry[] = [
  { id: '1', timestamp: new Date().toISOString(), eventType: 'ceiling', agentId: 'agent-042', action: 'Trust computation', decision: 'CLAMPED', status: 'compliant', details: '920 → 899 (context ceiling)', regulatory: 'GDPR', retentionRequired: true },
  { id: '2', timestamp: new Date(Date.now() - 60000).toISOString(), eventType: 'role_gate', agentId: 'agent-017', action: 'Role request: R-L3', decision: 'ALLOW', status: 'compliant', details: 'Kernel layer passed', retentionRequired: false },
  { id: '3', timestamp: new Date(Date.now() - 120000).toISOString(), eventType: 'ceiling', agentId: 'agent-089', action: 'Gaming detection', decision: 'ALERT', status: 'warning', details: 'Rapid change: 150 pts/60s', retentionRequired: true },
  { id: '4', timestamp: new Date(Date.now() - 180000).toISOString(), eventType: 'context', agentId: 'agent-023', action: 'Operation created', decision: 'VALID', status: 'compliant', details: 'TTL: 300s, hash verified', retentionRequired: false },
  { id: '5', timestamp: new Date(Date.now() - 240000).toISOString(), eventType: 'role_gate', agentId: 'agent-056', action: 'Role request: R-L5', decision: 'DENY', status: 'violation', details: 'Tier T3 insufficient for R-L5', retentionRequired: true },
  { id: '6', timestamp: new Date(Date.now() - 300000).toISOString(), eventType: 'provenance', agentId: 'agent-078', action: 'Modifier evaluation', decision: 'APPLIED', status: 'compliant', details: 'FRESH: +0 modifier', retentionRequired: false },
  { id: '7', timestamp: new Date(Date.now() - 360000).toISOString(), eventType: 'preset', agentId: 'agent-011', action: 'Lineage verification', decision: 'VERIFIED', status: 'compliant', details: 'Chain: 3 levels verified', retentionRequired: false },
  { id: '8', timestamp: new Date(Date.now() - 420000).toISOString(), eventType: 'ceiling', agentId: 'agent-034', action: 'Trust computation', decision: 'PASS', status: 'compliant', details: '680 (no ceiling applied)', regulatory: 'HIPAA', retentionRequired: true },
]

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function AuditPage() {
  const [entries] = useState<AuditEntry[]>(DEMO_ENTRIES)
  const [filter, setFilter] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)

  const eventTypeConfig: Record<string, { icon: React.ElementType; color: string }> = {
    ceiling: { icon: BarChart3, color: 'from-blue-500 to-indigo-500' },
    role_gate: { icon: Key, color: 'from-purple-500 to-indigo-500' },
    context: { icon: Layers, color: 'from-green-500 to-emerald-500' },
    provenance: { icon: Eye, color: 'from-rose-500 to-pink-500' },
    preset: { icon: Shield, color: 'from-amber-500 to-orange-500' },
  }

  const filteredEntries = entries.filter(entry => {
    if (filter !== 'all' && entry.eventType !== filter) return false
    if (searchTerm && !entry.agentId.includes(searchTerm) && !entry.action.toLowerCase().includes(searchTerm.toLowerCase())) return false
    return true
  })

  const stats = {
    total: entries.length,
    compliant: entries.filter(e => e.status === 'compliant').length,
    warnings: entries.filter(e => e.status === 'warning').length,
    violations: entries.filter(e => e.status === 'violation').length,
    retentionRequired: entries.filter(e => e.retentionRequired).length,
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
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg shadow-blue-500/25">
            <Eye className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              Audit Trail
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Phase 6 trust engine audit log
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLoading(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg hover:opacity-90 transition-opacity">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Entries</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-green-500" /> Compliant
          </p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.compliant}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-500" /> Warnings
          </p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.warnings}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
            <XCircle className="w-3 h-3 text-red-500" /> Violations
          </p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.violations}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
            <Clock className="w-3 h-3 text-blue-500" /> Retention Req.
          </p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.retentionRequired}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by agent ID or action..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-400" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Events</option>
            <option value="ceiling">Ceiling</option>
            <option value="role_gate">Role Gate</option>
            <option value="context">Context</option>
            <option value="provenance">Provenance</option>
            <option value="preset">Preset</option>
          </select>
        </div>
      </div>

      {/* Audit Log */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-500" />
            Audit Entries ({filteredEntries.length})
          </h2>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {filteredEntries.map((entry) => {
            const config = eventTypeConfig[entry.eventType]
            const Icon = config.icon

            return (
              <div key={entry.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg bg-gradient-to-br ${config.color} flex-shrink-0`}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {entry.action}
                        </p>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          entry.status === 'compliant' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                          entry.status === 'warning' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                          'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                        }`}>
                          {entry.decision}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {entry.agentId} | {entry.details}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(entry.timestamp).toLocaleString()}
                        </span>
                        {entry.regulatory && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                            {entry.regulatory}
                          </span>
                        )}
                        {entry.retentionRequired && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                            Retention Required
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Retention Info */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-500" />
          Regulatory Retention Requirements
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { framework: 'NONE', days: 30 },
            { framework: 'HIPAA', days: 2190 },
            { framework: 'GDPR', days: 365 },
            { framework: 'EU AI Act', days: 3650 },
            { framework: 'SOC2', days: 365 },
            { framework: 'ISO 42001', days: 1095 },
          ].map((fw) => (
            <div key={fw.framework} className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-xs font-medium text-gray-900 dark:text-white">{fw.framework}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{fw.days} days</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
