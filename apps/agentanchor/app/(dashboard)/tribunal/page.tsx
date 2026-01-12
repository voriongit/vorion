'use client'

import { useState, useEffect } from 'react'
import {
  Gavel,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Users,
  Scale,
  ChevronRight
} from 'lucide-react'

interface Case {
  id: string
  title: string
  type: 'appeal' | 'dispute' | 'review'
  status: 'pending' | 'in_review' | 'resolved' | 'dismissed'
  submitted_by: string
  created_at: string
  agent_id?: string
}

export default function TribunalPage() {
  const [cases, setCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'resolved'>('all')

  useEffect(() => {
    // Simulated data - replace with actual API call
    setCases([
      {
        id: '1',
        title: 'Appeal: Trust Score Reduction',
        type: 'appeal',
        status: 'pending',
        submitted_by: 'trainer@example.com',
        created_at: new Date(Date.now() - 86400000).toISOString()
      },
      {
        id: '2',
        title: 'Dispute: Agent Ownership',
        type: 'dispute',
        status: 'in_review',
        submitted_by: 'consumer@example.com',
        created_at: new Date(Date.now() - 172800000).toISOString()
      },
      {
        id: '3',
        title: 'Review: High-Risk Decision Override',
        type: 'review',
        status: 'resolved',
        submitted_by: 'council@agentanchor.com',
        created_at: new Date(Date.now() - 604800000).toISOString()
      }
    ])
    setLoading(false)
  }, [])

  const getStatusIcon = (status: Case['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-400" />
      case 'in_review':
        return <Scale className="w-4 h-4 text-blue-400" />
      case 'resolved':
        return <CheckCircle2 className="w-4 h-4 text-green-400" />
      case 'dismissed':
        return <XCircle className="w-4 h-4 text-red-400" />
    }
  }

  const getTypeColor = (type: Case['type']) => {
    switch (type) {
      case 'appeal':
        return 'bg-orange-900/30 text-orange-400'
      case 'dispute':
        return 'bg-red-900/30 text-red-400'
      case 'review':
        return 'bg-purple-900/30 text-purple-400'
    }
  }

  const filteredCases = cases.filter(c => {
    if (filter === 'all') return true
    if (filter === 'pending') return c.status === 'pending' || c.status === 'in_review'
    return c.status === 'resolved' || c.status === 'dismissed'
  })

  const stats = {
    total: cases.length,
    pending: cases.filter(c => c.status === 'pending').length,
    inReview: cases.filter(c => c.status === 'in_review').length,
    resolved: cases.filter(c => c.status === 'resolved' || c.status === 'dismissed').length
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-red-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100 flex items-center gap-3">
            <Gavel className="w-7 h-7 text-red-400" />
            Tribunal
          </h1>
          <p className="text-neutral-400 mt-1">
            Appeals, disputes, and governance reviews
          </p>
        </div>

        <button
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-neutral-100 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
        >
          <FileText className="w-4 h-4" />
          Submit Case
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-900/50">
              <FileText className="w-5 h-5 text-slate-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-100">{stats.total}</p>
              <p className="text-xs text-neutral-500">Total Cases</p>
            </div>
          </div>
        </div>

        <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-900/30">
              <Clock className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-100">{stats.pending}</p>
              <p className="text-xs text-neutral-500">Pending</p>
            </div>
          </div>
        </div>

        <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-900/30">
              <Scale className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-100">{stats.inReview}</p>
              <p className="text-xs text-neutral-500">In Review</p>
            </div>
          </div>
        </div>

        <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-900/30">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-100">{stats.resolved}</p>
              <p className="text-xs text-neutral-500">Resolved</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(['all', 'pending', 'resolved'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              filter === f
                ? 'bg-red-600 text-white'
                : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Cases List */}
      <div className="bg-neutral-900 rounded-lg border border-neutral-800">
        {filteredCases.length === 0 ? (
          <div className="p-8 text-center text-neutral-500">
            <Gavel className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No cases found</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-800">
            {filteredCases.map((caseItem) => (
              <div
                key={caseItem.id}
                className="p-4 hover:bg-neutral-800/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-neutral-800">
                      {getStatusIcon(caseItem.status)}
                    </div>
                    <div>
                      <h3 className="font-medium text-neutral-100">{caseItem.title}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded ${getTypeColor(caseItem.type)}`}>
                          {caseItem.type}
                        </span>
                        <span className="text-xs text-neutral-500">
                          by {caseItem.submitted_by}
                        </span>
                        <span className="text-xs text-neutral-500">
                          {new Date(caseItem.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-neutral-600" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Banner */}
      <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-lg bg-red-900/30">
            <AlertTriangle className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <h3 className="font-semibold text-neutral-100 mb-1">How the Tribunal Works</h3>
            <p className="text-sm text-neutral-400">
              The Tribunal handles appeals against trust score decisions, disputes between parties,
              and reviews of high-risk agent decisions. Cases are reviewed by Council validators
              who reach consensus through deliberation. Average resolution time is 48-72 hours.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
