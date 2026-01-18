'use client'

import { useState, useEffect } from 'react'
import {
  FileCheck,
  Shield,
  CheckCircle,
  Search,
  RefreshCw,
  ExternalLink,
  Hash,
  Clock,
  Link as LinkIcon,
  AlertTriangle,
} from 'lucide-react'

interface AuditRecord {
  id: string
  sequence: number
  record_type: string
  agent_id?: string
  timestamp: string
  hash: string
  verification_url?: string
  data: Record<string, unknown>
}

interface AuditStats {
  total_records: number
  records_by_type: Record<string, number>
  latest_sequence: number
  chain_valid: boolean
}

const recordTypeLabels: Record<string, string> = {
  governance_decision: 'Governance Decision',
  council_decision: 'Council Decision',
  certification: 'Certification',
  human_override: 'Human Override',
  trust_change: 'Trust Change',
  agent_creation: 'Agent Creation',
  agent_archive: 'Agent Archive',
  trust_milestone: 'Trust Milestone',
  policy_violation: 'Policy Violation',
  escalation_resolved: 'Escalation Resolved',
}

const recordTypeGradients: Record<string, string> = {
  governance_decision: 'from-blue-500 to-indigo-600',
  council_decision: 'from-blue-500 to-indigo-600',
  certification: 'from-green-500 to-emerald-600',
  human_override: 'from-orange-500 to-amber-600',
  trust_change: 'from-purple-500 to-indigo-600',
  agent_creation: 'from-cyan-500 to-blue-600',
  agent_archive: 'from-gray-500 to-gray-600',
  trust_milestone: 'from-green-500 to-emerald-600',
  policy_violation: 'from-red-500 to-rose-600',
  escalation_resolved: 'from-amber-500 to-orange-600',
}

export default function AuditPage() {
  const [records, setRecords] = useState<AuditRecord[]>([])
  const [stats, setStats] = useState<AuditStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [verifyHash, setVerifyHash] = useState('')
  const [verifyResult, setVerifyResult] = useState<any>(null)
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    try {
      const [recordsRes, statsRes] = await Promise.all([
        fetch('/api/truth-chain?limit=50'),
        fetch('/api/truth-chain?stats=true'),
      ])

      if (recordsRes.ok) {
        const data = await recordsRes.json()
        setRecords(data.records || [])
      }

      if (statsRes.ok) {
        const data = await statsRes.json()
        setStats(data)
      }
    } catch (err) {
      console.error('Failed to fetch audit data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async () => {
    if (!verifyHash || verifyHash.length < 8) return

    setVerifying(true)
    setVerifyResult(null)

    try {
      const response = await fetch(`/api/truth-chain/verify/${verifyHash}`)
      const data = await response.json()
      setVerifyResult(data)
    } catch (err) {
      setVerifyResult({ error: 'Verification failed' })
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="space-y-6 sm:space-y-8 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 sm:p-2.5 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg shadow-purple-500/25">
            <FileCheck className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              Audit Trail
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 hidden sm:block">
              Cryptographically-verified governance records
            </p>
          </div>
        </div>
        <button
          onClick={() => fetchData()}
          className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors active:scale-95 touch-manipulation"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Stats - Horizontal scroll on mobile */}
      <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0 pb-2">
        <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 min-w-max sm:min-w-0">
          <StatCard
            label="Total Records"
            value={stats?.total_records?.toLocaleString() || '—'}
            icon={FileCheck}
            gradient="from-purple-500 to-indigo-600"
          />
          <StatCard
            label="Latest Sequence"
            value={stats?.latest_sequence ? `#${stats.latest_sequence}` : '—'}
            icon={Hash}
            gradient="from-blue-500 to-cyan-600"
          />
          <StatCard
            label="Governance Decisions"
            value={String((stats?.records_by_type?.governance_decision || 0) + (stats?.records_by_type?.council_decision || 0))}
            icon={Shield}
            gradient="from-green-500 to-emerald-600"
          />
          <ChainIntegrityCard valid={stats?.chain_valid ?? null} />
        </div>
      </div>

      {/* Verification Tool */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
              <Search className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">
                Verify Proof Record
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
                Enter a hash or record ID to verify authenticity
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={verifyHash}
              onChange={(e) => setVerifyHash(e.target.value)}
              placeholder="Enter SHA-256 hash or record ID..."
              className="flex-1 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
            <button
              onClick={handleVerify}
              disabled={verifying || verifyHash.length < 8}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl font-medium transition-all disabled:opacity-50 active:scale-95 touch-manipulation shadow-lg shadow-blue-500/25"
            >
              {verifying ? 'Verifying...' : 'Verify'}
            </button>
          </div>

          {verifyResult && (
            <div className={`mt-4 p-4 rounded-xl ${
              verifyResult.verified
                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
            }`}>
              {verifyResult.verified ? (
                <div>
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-3">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">Record Verified</span>
                  </div>
                  <dl className="text-sm space-y-2">
                    <div className="flex flex-col sm:flex-row sm:gap-2">
                      <dt className="text-gray-500 dark:text-gray-400">Type:</dt>
                      <dd className="text-gray-900 dark:text-white font-medium">
                        {recordTypeLabels[verifyResult.record?.record_type] || verifyResult.record?.record_type}
                      </dd>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:gap-2">
                      <dt className="text-gray-500 dark:text-gray-400">Sequence:</dt>
                      <dd className="text-gray-900 dark:text-white font-medium">#{verifyResult.record?.sequence}</dd>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:gap-2">
                      <dt className="text-gray-500 dark:text-gray-400">Timestamp:</dt>
                      <dd className="text-gray-900 dark:text-white font-medium">
                        {new Date(verifyResult.record?.timestamp).toLocaleString()}
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                  <span>Verification failed: {verifyResult.error}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Records List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600">
              <Clock className="w-4 h-4 text-white" />
            </div>
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Recent Audit Records
            </h2>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-purple-500 mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading records...</p>
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-12">
              <div className="p-4 rounded-2xl bg-gray-100 dark:bg-gray-700 inline-block mb-4">
                <FileCheck className="w-10 h-10 text-gray-400" />
              </div>
              <p className="text-gray-700 dark:text-gray-300 font-medium">No audit records yet</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Governance decisions and actions will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {records.map((record) => (
                <AuditRecordCard key={record.id} record={record} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Compliance Note */}
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex-shrink-0">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
              Compliance Note
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              This audit trail maintains SHA-256 chained records with Ed25519 signatures,
              supporting EU AI Act Article 19 requirements for immutable audit trails with 6+ month retention.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({
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
    <div className="flex-shrink-0 w-[140px] sm:w-auto bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate pr-2">{label}</span>
        <div className={`p-1.5 sm:p-2 rounded-lg bg-gradient-to-br ${gradient} flex-shrink-0`}>
          <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
        </div>
      </div>
      <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  )
}

function ChainIntegrityCard({ valid }: { valid: boolean | null }) {
  return (
    <div className="flex-shrink-0 w-[140px] sm:w-auto bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Chain Integrity</span>
        <div className={`p-1.5 sm:p-2 rounded-lg bg-gradient-to-br ${valid ? 'from-green-500 to-emerald-600' : 'from-red-500 to-rose-600'} flex-shrink-0`}>
          {valid ? (
            <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-xl sm:text-2xl font-bold ${valid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {valid === null ? '—' : valid ? 'Valid' : 'Invalid'}
        </span>
      </div>
    </div>
  )
}

function AuditRecordCard({ record }: { record: AuditRecord }) {
  const gradient = recordTypeGradients[record.record_type] || 'from-gray-500 to-gray-600'
  const label = recordTypeLabels[record.record_type] || record.record_type

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 p-3 sm:p-4 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`p-2 rounded-lg bg-gradient-to-br ${gradient} flex-shrink-0`}>
            <FileCheck className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-gray-900 dark:text-white text-sm">
                {label}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300">
                #{record.sequence}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono truncate">
              {record.hash.substring(0, 24)}...
            </p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {new Date(record.timestamp).toLocaleDateString()}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">
            {new Date(record.timestamp).toLocaleTimeString()}
          </p>
          {record.verification_url && (
            <a
              href={record.verification_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1"
            >
              <LinkIcon className="w-3 h-3" />
              <span className="hidden sm:inline">Verify</span>
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
