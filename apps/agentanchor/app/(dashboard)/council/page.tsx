'use client'

import { useState, useEffect } from 'react'
import { Metadata } from 'next'
import Link from 'next/link'
import { Scale, Shield, BookOpen, Heart, Loader2, AlertTriangle, CheckCircle, XCircle, HelpCircle, Search, Tag, Clock, TrendingUp, ExternalLink, Bell, User, ArrowRight } from 'lucide-react'

interface Validator {
  id: string
  name: string
  domain: string
  description: string
  icon: string
}

interface RiskLevel {
  level: number
  name: string
  description: string
  approval: string
}

interface Precedent {
  id: string
  title: string
  summary: string
  action_type: string
  risk_level: number
  outcome: 'approved' | 'denied' | 'escalated'
  reasoning: string
  tags: string[]
  category: string
  times_cited: number
  created_at: string
}

interface Escalation {
  id: string
  action_type: string
  action_details: string
  risk_level: number
  status: 'pending' | 'approved' | 'denied' | 'modified' | 'timeout' | 'cancelled'
  priority: 'low' | 'normal' | 'high' | 'critical'
  council_reasoning: string
  timeout_at: string
  created_at: string
}

interface EscalationStats {
  pending: number
  approved: number
  denied: number
  modified: number
  timeout: number
  avgResponseTimeMinutes: number
}

const VALIDATOR_ICONS: Record<string, any> = {
  guardian: Shield,
  arbiter: Scale,
  scholar: BookOpen,
  advocate: Heart,
}

const VALIDATOR_COLORS: Record<string, string> = {
  guardian: 'text-red-500 bg-red-100 dark:bg-red-900/30',
  arbiter: 'text-purple-500 bg-purple-100 dark:bg-purple-900/30',
  scholar: 'text-blue-500 bg-blue-100 dark:bg-blue-900/30',
  advocate: 'text-green-500 bg-green-100 dark:bg-green-900/30',
}

export default function CouncilPage() {
  const [validators, setValidators] = useState<Validator[]>([])
  const [riskLevels, setRiskLevels] = useState<RiskLevel[]>([])
  const [precedents, setPrecedents] = useState<Precedent[]>([])
  const [escalations, setEscalations] = useState<Escalation[]>([])
  const [escalationStats, setEscalationStats] = useState<EscalationStats | null>(null)
  const [precedentSearch, setPrecedentSearch] = useState('')
  const [precedentSort, setPrecedentSort] = useState<'recent' | 'cited'>('recent')
  const [loading, setLoading] = useState(true)
  const [precedentsLoading, setPrecedentsLoading] = useState(false)
  const [escalationsLoading, setEscalationsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadCouncilData()
    loadPrecedents()
    loadEscalations()
  }, [])

  useEffect(() => {
    loadPrecedents()
  }, [precedentSort])

  const loadCouncilData = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/council/validators')
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load council data')
      }

      setValidators(data.validators || [])
      setRiskLevels(data.riskLevels || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadPrecedents = async () => {
    try {
      setPrecedentsLoading(true)
      const params = new URLSearchParams()
      if (precedentSearch) params.set('q', precedentSearch)
      params.set('sort', precedentSort)
      params.set('limit', '10')

      const res = await fetch(`/api/council/precedents?${params}`)
      const data = await res.json()

      if (res.ok) {
        setPrecedents(data.precedents || [])
      }
    } catch (err) {
      console.error('Failed to load precedents:', err)
    } finally {
      setPrecedentsLoading(false)
    }
  }

  const handlePrecedentSearch = (e: React.FormEvent) => {
    e.preventDefault()
    loadPrecedents()
  }

  const loadEscalations = async () => {
    try {
      setEscalationsLoading(true)

      // Load pending escalations and stats in parallel
      const [escalationsRes, statsRes] = await Promise.all([
        fetch('/api/council/escalations?view=pending&limit=5'),
        fetch('/api/council/escalations?view=stats'),
      ])

      if (escalationsRes.ok) {
        const data = await escalationsRes.json()
        setEscalations(data.escalations || [])
      }

      if (statsRes.ok) {
        const data = await statsRes.json()
        setEscalationStats(data.stats)
      }
    } catch (err) {
      console.error('Failed to load escalations:', err)
    } finally {
      setEscalationsLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatTimeRemaining = (timeoutAt: string) => {
    const timeout = new Date(timeoutAt).getTime()
    const now = Date.now()
    const remaining = timeout - now

    if (remaining <= 0) return 'Expired'

    const hours = Math.floor(remaining / (1000 * 60 * 60))
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60))

    if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
      case 'high': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
      case 'normal': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Scale className="h-8 w-8 text-purple-600" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              The Council
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl">
            The validator tribunal that governs agent decisions. Four specialized validators
            assess actions based on their domain expertise, ensuring safe, ethical, compliant,
            and user-focused outcomes.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 text-red-700 dark:text-red-400 rounded-lg">
            {error}
          </div>
        )}

        {/* Validators Grid */}
        <div className="mb-12">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Council Validators
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {validators.map((validator) => {
              const IconComponent = VALIDATOR_ICONS[validator.id] || Scale
              const colorClass = VALIDATOR_COLORS[validator.id] || 'text-gray-500 bg-gray-100'

              return (
                <Link
                  key={validator.id}
                  href={`/council/${validator.id}`}
                  className="card hover:shadow-lg transition-shadow group cursor-pointer"
                >
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${colorClass}`}>
                    <IconComponent className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                    {validator.name}
                  </h3>
                  <p className="text-sm font-medium text-purple-600 dark:text-purple-400 mb-2">
                    {validator.domain}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {validator.description}
                  </p>
                  <div className="mt-3 flex items-center text-sm text-purple-600 dark:text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    View Details
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Risk Levels */}
        <div className="mb-12">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Risk Level Classification
          </h2>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Level
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Example Actions
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Approval Required
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {riskLevels.map((level) => (
                  <tr key={level.level} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                        level.level <= 1 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        level.level === 2 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                        level.level === 3 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        L{level.level}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      {level.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {level.description}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {level.approval}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Voting Rules */}
        <div className="mb-12">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Voting Rules
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card">
              <div className="flex items-center gap-3 mb-3">
                <CheckCircle className="h-6 w-6 text-green-500" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Approve</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Validator believes the action is safe, ethical, compliant, and beneficial.
                Action proceeds based on risk level requirements.
              </p>
            </div>

            <div className="card">
              <div className="flex items-center gap-3 mb-3">
                <XCircle className="h-6 w-6 text-red-500" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Deny</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Validator identifies concerns in their domain. Denial includes reasoning
                that can be used to improve future requests.
              </p>
            </div>

            <div className="card">
              <div className="flex items-center gap-3 mb-3">
                <HelpCircle className="h-6 w-6 text-gray-500" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Abstain</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Validator determines the action is outside their domain or lacks
                sufficient information to make a judgment.
              </p>
            </div>
          </div>
        </div>

        {/* Human Escalation Queue */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Human Escalation Queue
              </h2>
              {escalationStats && escalationStats.pending > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                  <Bell className="h-3 w-3" />
                  {escalationStats.pending} pending
                </span>
              )}
            </div>
            {escalationStats && (
              <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                <span>Avg response: {escalationStats.avgResponseTimeMinutes}m</span>
                <span className="text-green-600 dark:text-green-400">{escalationStats.approved} approved</span>
                <span className="text-red-600 dark:text-red-400">{escalationStats.denied} denied</span>
              </div>
            )}
          </div>

          {escalationsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
            </div>
          ) : escalations.length === 0 ? (
            <div className="card text-center py-8">
              <CheckCircle className="h-12 w-12 mx-auto text-green-400 mb-3" />
              <p className="text-gray-600 dark:text-gray-400">
                No pending escalations
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                Critical decisions (L4) that require human oversight will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {escalations.map((escalation) => (
                <div
                  key={escalation.id}
                  className="card border-l-4 border-l-red-500 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400`}>
                          L{escalation.risk_level}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(escalation.priority)}`}>
                          {escalation.priority.toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-500">
                          {formatDate(escalation.created_at)}
                        </span>
                      </div>
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {escalation.action_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                        {escalation.action_details}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-2 italic">
                        Council: {escalation.council_reasoning.substring(0, 150)}...
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-1 text-sm">
                        <Clock className="h-4 w-4 text-orange-500" />
                        <span className="text-orange-600 dark:text-orange-400 font-medium">
                          {formatTimeRemaining(escalation.timeout_at)}
                        </span>
                      </div>
                      <button className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors">
                        Review
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Precedent Library */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Precedent Library
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPrecedentSort('recent')}
                className={`px-3 py-1.5 text-sm rounded-lg flex items-center gap-1 ${
                  precedentSort === 'recent'
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                }`}
              >
                <Clock className="h-4 w-4" />
                Recent
              </button>
              <button
                onClick={() => setPrecedentSort('cited')}
                className={`px-3 py-1.5 text-sm rounded-lg flex items-center gap-1 ${
                  precedentSort === 'cited'
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                }`}
              >
                <TrendingUp className="h-4 w-4" />
                Most Cited
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <form onSubmit={handlePrecedentSearch} className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={precedentSearch}
                onChange={(e) => setPrecedentSearch(e.target.value)}
                placeholder="Search precedents by action type, tags, or keywords..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400"
              />
            </div>
          </form>

          {/* Precedent List */}
          {precedentsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
            </div>
          ) : precedents.length === 0 ? (
            <div className="card text-center py-8">
              <BookOpen className="h-12 w-12 mx-auto text-gray-400 mb-3" />
              <p className="text-gray-600 dark:text-gray-400">
                {precedentSearch ? 'No precedents found matching your search.' : 'No precedents recorded yet.'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                Significant Council decisions (L3+) are automatically recorded as precedents.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {precedents.map((precedent) => (
                <div
                  key={precedent.id}
                  className="card hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold ${
                          precedent.risk_level <= 1 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          precedent.risk_level === 2 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                          precedent.risk_level === 3 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                          'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          L{precedent.risk_level}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          precedent.outcome === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          precedent.outcome === 'denied' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                          'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        }`}>
                          {precedent.outcome === 'approved' && <CheckCircle className="h-3 w-3" />}
                          {precedent.outcome === 'denied' && <XCircle className="h-3 w-3" />}
                          {precedent.outcome === 'escalated' && <AlertTriangle className="h-3 w-3" />}
                          {precedent.outcome.charAt(0).toUpperCase() + precedent.outcome.slice(1)}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-500">
                          {formatDate(precedent.created_at)}
                        </span>
                      </div>
                      <h3 className="font-medium text-gray-900 dark:text-white truncate">
                        {precedent.title}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                        {precedent.summary}
                      </p>
                      {precedent.tags && precedent.tags.length > 0 && (
                        <div className="flex items-center gap-1 mt-2 flex-wrap">
                          <Tag className="h-3 w-3 text-gray-400" />
                          {precedent.tags.slice(0, 4).map((tag) => (
                            <span
                              key={tag}
                              className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                          {precedent.tags.length > 4 && (
                            <span className="text-xs text-gray-500">+{precedent.tags.length - 4}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                        <TrendingUp className="h-4 w-4" />
                        <span>{precedent.times_cited} cited</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Coming Soon Features */}
        <div className="card bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
          <div className="flex items-start gap-4">
            <AlertTriangle className="h-6 w-6 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">
                Coming Soon
              </h3>
              <ul className="text-sm text-purple-800 dark:text-purple-200 space-y-1">
                <li>• Decision analytics and validator performance metrics</li>
                <li>• Email/push notifications for urgent escalations</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
