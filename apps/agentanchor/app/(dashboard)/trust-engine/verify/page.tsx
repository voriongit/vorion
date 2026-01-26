'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  CheckCircle,
  ArrowLeft,
  Search,
  Shield,
  Key,
  Layers,
  Eye,
  TrendingUp,
  AlertTriangle,
  XCircle,
  RefreshCw,
} from 'lucide-react'

// =============================================================================
// TYPES
// =============================================================================

interface VerificationResult {
  agentId: string
  verified: boolean
  timestamp: string
  checks: {
    name: string
    decision: string
    passed: boolean
    details?: string
  }[]
  trustScore: number
  tier: string
  role: string
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function VerifyPage() {
  const [agentId, setAgentId] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<VerificationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleVerify() {
    if (!agentId.trim()) {
      setError('Please enter an agent ID')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    // Simulate verification
    await new Promise(resolve => setTimeout(resolve, 1500))

    // Demo result
    const demoResult: VerificationResult = {
      agentId: agentId,
      verified: true,
      timestamp: new Date().toISOString(),
      checks: [
        { name: 'Context Hierarchy', decision: 'VALID', passed: true, details: 'All context hashes verified' },
        { name: 'Provenance Record', decision: 'FOUND', passed: true, details: 'FRESH creation, modifier: 0' },
        { name: 'Role Gate (R-L2)', decision: 'ALLOW', passed: true, details: 'Kernel layer passed, no policy override' },
        { name: 'Ceiling Compliance', decision: 'COMPLIANT', passed: true, details: 'Score within context ceiling' },
        { name: 'Preset Lineage', decision: 'VERIFIED', passed: true, details: 'Chain: ACI → Vorion → Axiom' },
      ],
      trustScore: 742,
      tier: 'T4',
      role: 'R-L2',
    }

    setResult(demoResult)
    setLoading(false)
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/trust-engine"
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 shadow-lg shadow-green-500/25">
          <CheckCircle className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Verify Agent
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Comprehensive Phase 6 trust verification
          </p>
        </div>
      </div>

      {/* Search Input */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Agent ID
        </label>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
              placeholder="Enter agent ID (e.g., agent-042)"
              className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={handleVerify}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 text-sm font-medium text-white bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <CheckCircle className="w-5 h-5" />
            )}
            Verify
          </button>
        </div>
        {error && (
          <p className="mt-2 text-sm text-red-500 flex items-center gap-1">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </p>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 shadow-sm">
          <div className="flex flex-col items-center justify-center">
            <RefreshCw className="w-12 h-12 text-green-500 animate-spin mb-4" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Running Phase 6 verification checks...
            </p>
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Summary Card */}
          <div className={`rounded-xl border p-6 shadow-sm ${
            result.verified
              ? 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800'
              : 'bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border-red-200 dark:border-red-800'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl ${
                  result.verified
                    ? 'bg-gradient-to-br from-green-500 to-emerald-500'
                    : 'bg-gradient-to-br from-red-500 to-rose-500'
                }`}>
                  {result.verified ? (
                    <CheckCircle className="w-6 h-6 text-white" />
                  ) : (
                    <XCircle className="w-6 h-6 text-white" />
                  )}
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {result.agentId}
                  </p>
                  <p className={`text-sm ${
                    result.verified
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {result.verified ? 'All checks passed' : 'Verification failed'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{result.trustScore}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {result.tier} | {result.role}
                </p>
              </div>
            </div>
          </div>

          {/* Check Results */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-green-500" />
                Verification Checks
              </h2>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {result.checks.map((check, index) => {
                const icons: Record<string, React.ElementType> = {
                  'Context Hierarchy': Layers,
                  'Provenance Record': Eye,
                  'Role Gate (R-L2)': Key,
                  'Ceiling Compliance': TrendingUp,
                  'Preset Lineage': Shield,
                }
                const Icon = icons[check.name] || Shield

                return (
                  <div key={index} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          check.passed
                            ? 'bg-green-100 dark:bg-green-900/30'
                            : 'bg-red-100 dark:bg-red-900/30'
                        }`}>
                          <Icon className={`w-4 h-4 ${
                            check.passed
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          }`} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {check.name}
                          </p>
                          {check.details && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {check.details}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                        check.passed
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                      }`}>
                        {check.decision}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Timestamp */}
          <p className="text-xs text-center text-gray-400">
            Verified at {new Date(result.timestamp).toLocaleString()}
          </p>
        </>
      )}

      {/* Info Panel */}
      {!result && !loading && (
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
            What gets verified?
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { icon: Layers, title: 'Context', desc: 'Hash chain integrity' },
              { icon: Eye, title: 'Provenance', desc: 'Origin record exists' },
              { icon: Key, title: 'Role Gate', desc: 'Permission matrix' },
              { icon: TrendingUp, title: 'Ceiling', desc: 'Score compliance' },
              { icon: Shield, title: 'Presets', desc: 'Lineage verification' },
            ].map((item) => (
              <div key={item.title} className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <item.icon className="w-5 h-5 text-green-500 mb-2" />
                <p className="text-sm font-medium text-gray-900 dark:text-white">{item.title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
