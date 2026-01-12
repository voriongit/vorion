'use client'

import { useState, useEffect } from 'react'
import {
  Shield,
  Globe,
  CheckCircle,
  Clock,
  AlertTriangle,
  ArrowRight,
  Search,
  ExternalLink,
  Zap,
  Award,
  Users,
  TrendingUp,
} from 'lucide-react'

interface ServiceStatus {
  status: string
  queue: {
    pending: number
    processing: number
    estimated_wait_minutes: number
  }
  health: {
    queue: boolean
    issues: string[]
  }
}

interface SubmissionForm {
  name: string
  description: string
  version: string
  origin_platform: string
  capabilities: string
  risk_category: string
  contact_email: string
  test_endpoint: string
  model_provider: string
  organization: string
}

interface SubmitResult {
  success: boolean
  tracking_id?: string
  queue_position?: number
  estimated_wait_minutes?: number
  errors?: string[]
  warnings?: string[]
}

interface StatusResult {
  success: boolean
  tracking_id?: string
  status?: string
  queue_position?: number
  estimated_wait_minutes?: number
  submission?: {
    name: string
    origin_platform: string
    risk_category: string
    submitted_at: string
  }
  test_results?: {
    total_score: number
    tests_passed: number
    tests_total: number
  }
  certification?: {
    tier: string
    trust_score: number
    valid_until: string
  }
  error?: string
}

const PLATFORMS = [
  { id: 'antigravity', name: 'Google Antigravity' },
  { id: 'cursor', name: 'Cursor IDE' },
  { id: 'claude_code', name: 'Claude Code CLI' },
  { id: 'openai_codex', name: 'OpenAI Codex' },
  { id: 'langchain', name: 'LangChain' },
  { id: 'autogen', name: 'Microsoft AutoGen' },
  { id: 'crewai', name: 'CrewAI' },
  { id: 'custom', name: 'Custom/Other' },
]

const RISK_CATEGORIES = [
  { id: 'low', name: 'Low', description: 'Read-only, analysis tasks' },
  { id: 'medium', name: 'Medium', description: 'Content generation, basic automation' },
  { id: 'high', name: 'High', description: 'External APIs, file operations' },
  { id: 'critical', name: 'Critical', description: 'Financial, system admin, sensitive data' },
]

const TIER_COLORS = {
  basic: 'text-zinc-400 bg-zinc-900/50 border-zinc-700',
  standard: 'text-blue-400 bg-blue-900/30 border-blue-700',
  advanced: 'text-purple-400 bg-purple-900/30 border-purple-700',
  enterprise: 'text-amber-400 bg-amber-900/30 border-amber-700',
}

export default function TrustBridgePage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'submit' | 'status'>('overview')
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null)
  const [loading, setLoading] = useState(true)

  // Submission form state
  const [form, setForm] = useState<SubmissionForm>({
    name: '',
    description: '',
    version: '1.0.0',
    origin_platform: 'custom',
    capabilities: '',
    risk_category: 'medium',
    contact_email: '',
    test_endpoint: '',
    model_provider: '',
    organization: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null)

  // Status check state
  const [trackingId, setTrackingId] = useState('')
  const [checking, setChecking] = useState(false)
  const [statusResult, setStatusResult] = useState<StatusResult | null>(null)

  // Fetch service status
  useEffect(() => {
    async function fetchStatus() {
      try {
        const response = await fetch('/api/trust-bridge')
        if (response.ok) {
          const data = await response.json()
          setServiceStatus(data)
        }
      } catch (err) {
        console.error('Failed to fetch status:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchStatus()
    const interval = setInterval(fetchStatus, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [])

  // Handle submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setSubmitResult(null)

    try {
      const response = await fetch('/api/trust-bridge/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          capabilities: form.capabilities.split(',').map(c => c.trim()).filter(Boolean),
        }),
      })

      const result = await response.json()
      setSubmitResult(result)

      if (result.success && result.tracking_id) {
        setTrackingId(result.tracking_id)
        setActiveTab('status')
      }
    } catch (err) {
      setSubmitResult({
        success: false,
        errors: ['Network error - please try again'],
      })
    } finally {
      setSubmitting(false)
    }
  }

  // Handle status check
  const handleCheckStatus = async () => {
    if (!trackingId) return
    setChecking(true)
    setStatusResult(null)

    try {
      const response = await fetch(`/api/trust-bridge/status/${trackingId}`)
      const result = await response.json()
      setStatusResult(result)
    } catch (err) {
      setStatusResult({
        success: false,
        error: 'Network error - please try again',
      })
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100 flex items-center gap-3">
            <Globe className="w-7 h-7 text-emerald-400" />
            Trust Bridge
          </h1>
          <p className="text-neutral-400 mt-1">
            Universal agent certification - Any agent. Any origin. One trust standard.
          </p>
        </div>

        {serviceStatus && (
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
            serviceStatus.status === 'operational'
              ? 'bg-emerald-900/30 text-emerald-400'
              : 'bg-yellow-900/30 text-yellow-400'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              serviceStatus.status === 'operational' ? 'bg-emerald-400' : 'bg-yellow-400'
            } animate-pulse`} />
            {serviceStatus.status === 'operational' ? 'Operational' : 'Degraded'}
          </div>
        )}
      </div>

      {/* Stats Grid */}
      {!loading && serviceStatus && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-900/30">
                <Clock className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-neutral-400">Queue</p>
                <p className="text-xl font-bold text-neutral-100">
                  {serviceStatus.queue.pending}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-900/30">
                <Zap className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-neutral-400">Processing</p>
                <p className="text-xl font-bold text-neutral-100">
                  {serviceStatus.queue.processing}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-900/30">
                <TrendingUp className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-neutral-400">Est. Wait</p>
                <p className="text-xl font-bold text-neutral-100">
                  {serviceStatus.queue.estimated_wait_minutes} min
                </p>
              </div>
            </div>
          </div>

          <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-900/30">
                <Users className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-neutral-400">Platforms</p>
                <p className="text-xl font-bold text-neutral-100">8</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-neutral-900 rounded-lg p-1 w-fit">
        {[
          { id: 'overview', label: 'Overview', icon: Shield },
          { id: 'submit', label: 'Submit Agent', icon: ArrowRight },
          { id: 'status', label: 'Check Status', icon: Search },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as 'overview' | 'submit' | 'status')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === id
                ? 'bg-neutral-800 text-neutral-100'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-neutral-100 mb-2">
                What is Trust Bridge?
              </h2>
              <p className="text-neutral-400">
                Trust Bridge is A3I's universal certification protocol that allows AI agents built on
                <span className="text-neutral-200"> ANY platform</span> to earn portable trust credentials
                recognized across the AI ecosystem.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-neutral-800/50 rounded-lg p-4">
                <h3 className="font-medium text-neutral-200 mb-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  Supported Platforms
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {PLATFORMS.map(p => (
                    <div key={p.id} className="text-sm text-neutral-400 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      {p.name}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-neutral-800/50 rounded-lg p-4">
                <h3 className="font-medium text-neutral-200 mb-3 flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-400" />
                  Certification Tiers
                </h3>
                <div className="space-y-2">
                  {[
                    { tier: 'Basic', range: '100-249', color: 'zinc' },
                    { tier: 'Standard', range: '250-499', color: 'blue' },
                    { tier: 'Advanced', range: '500-749', color: 'purple' },
                    { tier: 'Enterprise', range: '750+', color: 'amber' },
                  ].map(t => (
                    <div key={t.tier} className="flex justify-between text-sm">
                      <span className={`text-${t.color}-400`}>{t.tier}</span>
                      <span className="text-neutral-500">{t.range} points</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setActiveTab('submit')}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
              >
                Submit Your Agent
                <ArrowRight className="w-4 h-4" />
              </button>
              <a
                href="/docs/trust-bridge-vision"
                target="_blank"
                className="flex items-center gap-2 px-4 py-2 border border-neutral-700 hover:border-neutral-600 text-neutral-300 rounded-lg transition-colors"
              >
                Learn More
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        )}

        {/* Submit Tab */}
        {activeTab === 'submit' && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">
                    Agent Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    placeholder="MyAwesomeAgent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">
                    Description *
                  </label>
                  <textarea
                    required
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    placeholder="What does your agent do?"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">
                    Origin Platform *
                  </label>
                  <select
                    value={form.origin_platform}
                    onChange={e => setForm({ ...form, origin_platform: e.target.value })}
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  >
                    {PLATFORMS.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">
                    Risk Category *
                  </label>
                  <select
                    value={form.risk_category}
                    onChange={e => setForm({ ...form, risk_category: e.target.value })}
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  >
                    {RISK_CATEGORIES.map(r => (
                      <option key={r.id} value={r.id}>{r.name} - {r.description}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">
                    Capabilities * (comma-separated)
                  </label>
                  <input
                    type="text"
                    required
                    value={form.capabilities}
                    onChange={e => setForm({ ...form, capabilities: e.target.value })}
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    placeholder="code_review, debugging, analysis"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">
                    Contact Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={form.contact_email}
                    onChange={e => setForm({ ...form, contact_email: e.target.value })}
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    placeholder="dev@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">
                    Version
                  </label>
                  <input
                    type="text"
                    value={form.version}
                    onChange={e => setForm({ ...form, version: e.target.value })}
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    placeholder="1.0.0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">
                    Test Endpoint (optional)
                  </label>
                  <input
                    type="url"
                    value={form.test_endpoint}
                    onChange={e => setForm({ ...form, test_endpoint: e.target.value })}
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    placeholder="https://api.example.com/agent/test"
                  />
                  <p className="text-xs text-neutral-500 mt-1">
                    URL where we can send test requests to your agent
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">
                    Model Provider (optional)
                  </label>
                  <input
                    type="text"
                    value={form.model_provider}
                    onChange={e => setForm({ ...form, model_provider: e.target.value })}
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    placeholder="claude-sonnet-4-20250514, gpt-4, gemini-pro"
                  />
                </div>
              </div>
            </div>

            {/* Errors/Warnings */}
            {submitResult && !submitResult.success && submitResult.errors && (
              <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
                <h4 className="text-red-400 font-medium mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Validation Errors
                </h4>
                <ul className="list-disc list-inside text-red-300 text-sm space-y-1">
                  {submitResult.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {submitResult?.warnings && submitResult.warnings.length > 0 && (
              <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-4">
                <h4 className="text-yellow-400 font-medium mb-2">Warnings</h4>
                <ul className="list-disc list-inside text-yellow-300 text-sm space-y-1">
                  {submitResult.warnings.map((warn, i) => (
                    <li key={i}>{warn}</li>
                  ))}
                </ul>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  Submit for Certification
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Status Tab */}
        {activeTab === 'status' && (
          <div className="space-y-6">
            <div className="flex gap-3">
              <input
                type="text"
                value={trackingId}
                onChange={e => setTrackingId(e.target.value)}
                placeholder="Enter tracking ID (e.g., TB-CUR-ABC123-XYZ)"
                className="flex-1 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
              <button
                onClick={handleCheckStatus}
                disabled={!trackingId || checking}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {checking ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                Check Status
              </button>
            </div>

            {statusResult && (
              <div className={`rounded-lg border p-6 ${
                statusResult.success
                  ? 'bg-neutral-800/50 border-neutral-700'
                  : 'bg-red-900/20 border-red-800'
              }`}>
                {statusResult.success ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-neutral-100">
                        {statusResult.submission?.name || statusResult.tracking_id}
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        statusResult.status === 'passed'
                          ? 'bg-emerald-900/30 text-emerald-400'
                          : statusResult.status === 'failed'
                          ? 'bg-red-900/30 text-red-400'
                          : statusResult.status === 'testing'
                          ? 'bg-blue-900/30 text-blue-400'
                          : 'bg-yellow-900/30 text-yellow-400'
                      }`}>
                        {statusResult.status?.toUpperCase()}
                      </span>
                    </div>

                    {statusResult.submission && (
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-neutral-500">Platform</span>
                          <p className="text-neutral-200">{statusResult.submission.origin_platform}</p>
                        </div>
                        <div>
                          <span className="text-neutral-500">Risk Level</span>
                          <p className="text-neutral-200">{statusResult.submission.risk_category}</p>
                        </div>
                        <div>
                          <span className="text-neutral-500">Submitted</span>
                          <p className="text-neutral-200">
                            {new Date(statusResult.submission.submitted_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    )}

                    {statusResult.queue_position && (
                      <div className="bg-neutral-900 rounded-lg p-4">
                        <div className="flex items-center gap-4">
                          <Clock className="w-5 h-5 text-blue-400" />
                          <div>
                            <p className="text-neutral-200">
                              Queue Position: <strong>#{statusResult.queue_position}</strong>
                            </p>
                            <p className="text-sm text-neutral-400">
                              Estimated wait: ~{statusResult.estimated_wait_minutes} minutes
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {statusResult.test_results && (
                      <div className="bg-neutral-900 rounded-lg p-4">
                        <h4 className="font-medium text-neutral-200 mb-2">Test Results</h4>
                        <div className="flex items-center gap-6">
                          <div>
                            <span className="text-3xl font-bold text-emerald-400">
                              {statusResult.test_results.total_score}
                            </span>
                            <span className="text-neutral-500">/1000</span>
                          </div>
                          <div className="text-sm text-neutral-400">
                            {statusResult.test_results.tests_passed} / {statusResult.test_results.tests_total} tests passed
                          </div>
                        </div>
                      </div>
                    )}

                    {statusResult.certification && (
                      <div className={`rounded-lg border p-4 ${TIER_COLORS[statusResult.certification.tier as keyof typeof TIER_COLORS]}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">Certified: {statusResult.certification.tier.toUpperCase()}</h4>
                            <p className="text-sm opacity-80">
                              Trust Score: {statusResult.certification.trust_score} | Valid until {statusResult.certification.valid_until}
                            </p>
                          </div>
                          <Award className="w-8 h-8" />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 text-red-400">
                    <AlertTriangle className="w-5 h-5" />
                    <p>{statusResult.error || 'Submission not found'}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
