'use client'

import { useState, useEffect } from 'react'
import { Link2, Shield, CheckCircle, Search, RefreshCw, ExternalLink } from 'lucide-react'

interface TruthChainRecord {
  id: string
  sequence: number
  record_type: string
  agent_id?: string
  timestamp: string
  hash: string
  verification_url?: string
  data: Record<string, unknown>
}

interface ChainStats {
  total_records: number
  records_by_type: Record<string, number>
  latest_sequence: number
  chain_valid: boolean
}

const recordTypeLabels: Record<string, string> = {
  council_decision: 'Council Decision',
  certification: 'Certification',
  human_override: 'Human Override',
  ownership_change: 'Ownership Change',
  agent_creation: 'Agent Creation',
  agent_archive: 'Agent Archive',
  trust_milestone: 'Trust Milestone',
  marketplace_listing: 'Marketplace Listing',
  acquisition: 'Acquisition',
}

const recordTypeColors: Record<string, string> = {
  council_decision: 'bg-blue-900/30 text-blue-400 border-blue-800',
  certification: 'bg-green-900/30 text-green-400 border-green-800',
  human_override: 'bg-orange-900/30 text-orange-400 border-orange-800',
  ownership_change: 'bg-purple-900/30 text-purple-400 border-purple-800',
  agent_creation: 'bg-cyan-900/30 text-cyan-400 border-cyan-800',
}

export default function TruthChainPage() {
  const [records, setRecords] = useState<TruthChainRecord[]>([])
  const [stats, setStats] = useState<ChainStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [verifyHash, setVerifyHash] = useState('')
  const [verifyResult, setVerifyResult] = useState<any>(null)
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    async function fetchData() {
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
        console.error('Failed to fetch Truth Chain data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-100 flex items-center gap-3">
          <Link2 className="w-7 h-7 text-purple-400" />
          Truth Chain
        </h1>
        <p className="text-neutral-400 mt-1">
          Immutable, verifiable records of all governance decisions
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
          <p className="text-2xl font-bold text-neutral-100">
            {stats?.total_records.toLocaleString() || '—'}
          </p>
          <p className="text-xs text-neutral-500">Total Records</p>
        </div>
        <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
          <p className="text-2xl font-bold text-neutral-100">
            #{stats?.latest_sequence || '—'}
          </p>
          <p className="text-xs text-neutral-500">Latest Sequence</p>
        </div>
        <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
          <p className="text-2xl font-bold text-neutral-100">
            {stats?.records_by_type?.council_decision || 0}
          </p>
          <p className="text-xs text-neutral-500">Council Decisions</p>
        </div>
        <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
          <div className="flex items-center gap-2">
            {stats?.chain_valid ? (
              <CheckCircle className="w-6 h-6 text-green-400" />
            ) : (
              <Shield className="w-6 h-6 text-red-400" />
            )}
            <span className={stats?.chain_valid ? 'text-green-400' : 'text-red-400'}>
              {stats?.chain_valid ? 'Valid' : 'Invalid'}
            </span>
          </div>
          <p className="text-xs text-neutral-500">Chain Integrity</p>
        </div>
      </div>

      {/* Verification Tool */}
      <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-6">
        <h2 className="text-lg font-semibold text-neutral-100 mb-4 flex items-center gap-2">
          <Search className="w-5 h-5 text-blue-400" />
          Verify Record
        </h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={verifyHash}
            onChange={(e) => setVerifyHash(e.target.value)}
            placeholder="Enter hash or record ID to verify..."
            className="flex-1 bg-neutral-800 border border-neutral-700 text-neutral-100 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={handleVerify}
            disabled={verifying || verifyHash.length < 8}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {verifying ? 'Verifying...' : 'Verify'}
          </button>
        </div>

        {verifyResult && (
          <div className={`mt-4 p-4 rounded-lg ${
            verifyResult.verified
              ? 'bg-green-900/20 border border-green-800'
              : 'bg-red-900/20 border border-red-800'
          }`}>
            {verifyResult.verified ? (
              <div>
                <div className="flex items-center gap-2 text-green-400 mb-2">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">Record Verified</span>
                </div>
                <dl className="text-sm space-y-1">
                  <div className="flex gap-2">
                    <dt className="text-neutral-500">Type:</dt>
                    <dd className="text-neutral-100">
                      {recordTypeLabels[verifyResult.record?.record_type] || verifyResult.record?.record_type}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-neutral-500">Sequence:</dt>
                    <dd className="text-neutral-100">#{verifyResult.record?.sequence}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-neutral-500">Timestamp:</dt>
                    <dd className="text-neutral-100">
                      {new Date(verifyResult.record?.timestamp).toLocaleString()}
                    </dd>
                  </div>
                </dl>
              </div>
            ) : (
              <div className="text-red-400">
                Verification failed: {verifyResult.error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Records List */}
      <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-6">
        <h2 className="text-lg font-semibold text-neutral-100 mb-4">
          Recent Records
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-neutral-500" />
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-12 text-neutral-500">
            <Link2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No records yet</p>
            <p className="text-sm mt-1">
              Governance records will appear here as they're created
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {records.map((record) => (
              <div
                key={record.id}
                className={`rounded-lg border p-4 ${
                  recordTypeColors[record.record_type] || 'bg-neutral-800 border-neutral-700'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-neutral-100">
                        {recordTypeLabels[record.record_type] || record.record_type}
                      </span>
                      <span className="text-xs text-neutral-500">
                        #{record.sequence}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500 mt-1 font-mono">
                      {record.hash.substring(0, 32)}...
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-neutral-500">
                      {new Date(record.timestamp).toLocaleString()}
                    </p>
                    {record.verification_url && (
                      <a
                        href={record.verification_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline mt-1"
                      >
                        Verify <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
