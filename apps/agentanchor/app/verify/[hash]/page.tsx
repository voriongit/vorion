'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  CheckCircle,
  XCircle,
  Shield,
  Clock,
  Hash,
  Link2,
  Copy,
  ExternalLink,
  Loader2,
  AlertTriangle,
} from 'lucide-react'

interface VerificationResult {
  verified: boolean
  chain_valid?: boolean
  error?: string
  record?: {
    id: string
    sequence: number
    record_type: string
    agent_id?: string
    timestamp: string
    hash: string
    previous_hash: string
    data: Record<string, unknown>
  }
  verification_url?: string
}

const RECORD_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  council_decision: { label: 'Council Decision', color: 'blue' },
  certification: { label: 'Agent Certification', color: 'green' },
  human_override: { label: 'Human Override', color: 'orange' },
  ownership_change: { label: 'Ownership Change', color: 'purple' },
  marketplace_listing: { label: 'Marketplace Listing', color: 'cyan' },
  acquisition: { label: 'Agent Acquisition', color: 'pink' },
}

export default function VerifyPage() {
  const params = useParams()
  const hash = params.hash as string

  const [result, setResult] = useState<VerificationResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function verify() {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`/api/truth-chain/verify/${hash}`)
        const data = await response.json()

        if (!response.ok) {
          setError(data.error || 'Verification failed')
        } else {
          setResult(data)
        }
      } catch (err) {
        setError('Failed to verify record')
      } finally {
        setLoading(false)
      }
    }

    if (hash) {
      verify()
    }
  }, [hash])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const recordTypeInfo = result?.record?.record_type
    ? RECORD_TYPE_LABELS[result.record.record_type] || { label: result.record.record_type, color: 'gray' }
    : null

  return (
    <div className="min-h-screen bg-neutral-950 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-neutral-400 hover:text-neutral-100 mb-6">
            <Shield className="w-8 h-8 text-blue-500" />
            <span className="text-xl font-bold text-neutral-100">AgentAnchor</span>
          </Link>
          <h1 className="text-3xl font-bold text-neutral-100">Truth Chain Verification</h1>
          <p className="text-neutral-400 mt-2">
            Verify the authenticity and integrity of governance records
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-12 text-center">
            <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-blue-500" />
            <p className="text-neutral-400">Verifying record...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-900/20 border border-red-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <XCircle className="w-8 h-8 text-red-500" />
              <h2 className="text-xl font-semibold text-red-400">Verification Failed</h2>
            </div>
            <p className="text-red-300">{error}</p>
            <p className="text-red-400/70 text-sm mt-4">
              The record could not be found or verified. Please check the hash and try again.
            </p>
          </div>
        )}

        {/* Result */}
        {result && !loading && (
          <div className="space-y-6">
            {/* Verification Status Card */}
            <div
              className={`rounded-xl border p-6 ${
                result.verified
                  ? 'bg-green-900/20 border-green-800'
                  : 'bg-red-900/20 border-red-800'
              }`}
            >
              <div className="flex items-center gap-4">
                {result.verified ? (
                  <CheckCircle className="w-12 h-12 text-green-500" />
                ) : (
                  <XCircle className="w-12 h-12 text-red-500" />
                )}
                <div>
                  <h2
                    className={`text-2xl font-bold ${
                      result.verified ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {result.verified ? 'Verified' : 'Not Verified'}
                  </h2>
                  <p className={result.verified ? 'text-green-300/70' : 'text-red-300/70'}>
                    {result.verified
                      ? 'This record is authentic and has not been tampered with.'
                      : result.error || 'This record could not be verified.'}
                  </p>
                </div>
              </div>

              {result.chain_valid !== undefined && (
                <div className="mt-4 pt-4 border-t border-neutral-700">
                  <div className="flex items-center gap-2">
                    {result.chain_valid ? (
                      <>
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        <span className="text-green-400 text-sm">Chain integrity verified</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-5 h-5 text-orange-500" />
                        <span className="text-orange-400 text-sm">Chain integrity issue detected</span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Record Details */}
            {result.record && (
              <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6">
                <h3 className="text-lg font-semibold text-neutral-100 mb-4">Record Details</h3>

                <div className="space-y-4">
                  {/* Record Type */}
                  <div className="flex items-center justify-between py-2 border-b border-neutral-800">
                    <span className="text-neutral-400">Type</span>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium bg-${recordTypeInfo?.color}-900/30 text-${recordTypeInfo?.color}-400`}
                    >
                      {recordTypeInfo?.label}
                    </span>
                  </div>

                  {/* Sequence */}
                  <div className="flex items-center justify-between py-2 border-b border-neutral-800">
                    <span className="text-neutral-400">Sequence #</span>
                    <span className="text-neutral-100 font-mono">{result.record.sequence}</span>
                  </div>

                  {/* Timestamp */}
                  <div className="flex items-center justify-between py-2 border-b border-neutral-800">
                    <span className="text-neutral-400 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Recorded
                    </span>
                    <span className="text-neutral-100">
                      {new Date(result.record.timestamp).toLocaleString()}
                    </span>
                  </div>

                  {/* Hash */}
                  <div className="py-2 border-b border-neutral-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-neutral-400 flex items-center gap-2">
                        <Hash className="w-4 h-4" />
                        Hash
                      </span>
                      <button
                        onClick={() => copyToClipboard(result.record!.hash)}
                        className="text-blue-400 hover:text-blue-300 flex items-center gap-1 text-sm"
                      >
                        <Copy className="w-4 h-4" />
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <code className="text-xs text-neutral-300 font-mono break-all bg-neutral-800 p-2 rounded block">
                      {result.record.hash}
                    </code>
                  </div>

                  {/* Previous Hash */}
                  <div className="py-2 border-b border-neutral-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-neutral-400 flex items-center gap-2">
                        <Link2 className="w-4 h-4" />
                        Previous Hash
                      </span>
                    </div>
                    <code className="text-xs text-neutral-400 font-mono break-all bg-neutral-800 p-2 rounded block">
                      {result.record.previous_hash}
                    </code>
                  </div>

                  {/* Record Data */}
                  <div className="py-2">
                    <span className="text-neutral-400 block mb-2">Record Data</span>
                    <pre className="text-xs text-neutral-300 font-mono bg-neutral-800 p-3 rounded overflow-x-auto">
                      {JSON.stringify(result.record.data, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            {/* Share Section */}
            <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6">
              <h3 className="text-lg font-semibold text-neutral-100 mb-4">Share Verification</h3>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={typeof window !== 'undefined' ? window.location.href : ''}
                  className="flex-1 bg-neutral-800 border border-neutral-700 text-neutral-300 text-sm rounded-lg px-3 py-2"
                />
                <button
                  onClick={() => copyToClipboard(window.location.href)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Copy Link
                </button>
              </div>
            </div>

            {/* Footer Info */}
            <p className="text-center text-neutral-500 text-sm">
              Records are cryptographically signed and linked in an immutable chain.
              <br />
              Each record&apos;s hash includes the previous record&apos;s hash, ensuring tamper-evidence.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
