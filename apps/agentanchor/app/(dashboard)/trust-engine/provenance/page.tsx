'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Eye,
  ArrowLeft,
  RefreshCw,
  GitBranch,
  Plus,
  Copy,
  ArrowUpRight,
  Award,
  Download,
  Hash,
  User,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react'

// =============================================================================
// TYPES
// =============================================================================

interface ProvenanceRecord {
  agentId: string
  creationType: 'FRESH' | 'CLONED' | 'EVOLVED' | 'PROMOTED' | 'IMPORTED'
  parentAgentId?: string
  createdBy: string
  createdAt: string
  hash: string
  modifier: number
}

interface ModifierPolicy {
  policyId: string
  creationType: string
  baselineModifier: number
  conditions?: Record<string, unknown>
  createdBy: string
}

// =============================================================================
// CONSTANTS
// =============================================================================

const CREATION_TYPES = [
  { type: 'FRESH', modifier: 0, icon: Plus, color: 'from-blue-500 to-indigo-500', description: 'New agent with baseline trust' },
  { type: 'CLONED', modifier: -50, icon: Copy, color: 'from-purple-500 to-indigo-500', description: 'Copy of existing agent' },
  { type: 'EVOLVED', modifier: 100, icon: ArrowUpRight, color: 'from-green-500 to-emerald-500', description: 'Upgraded with verifiable history' },
  { type: 'PROMOTED', modifier: 150, icon: Award, color: 'from-amber-500 to-orange-500', description: 'Earned trust advancement' },
  { type: 'IMPORTED', modifier: -100, icon: Download, color: 'from-red-500 to-rose-500', description: 'External origin, unknown trust' },
]

// =============================================================================
// DEMO DATA
// =============================================================================

const DEMO_RECORDS: ProvenanceRecord[] = [
  { agentId: 'agent-042', creationType: 'FRESH', createdBy: 'system', createdAt: '2025-01-15T10:00:00Z', hash: 'prov-hash-042...', modifier: 0 },
  { agentId: 'agent-017', creationType: 'CLONED', parentAgentId: 'agent-042', createdBy: 'admin@company.com', createdAt: '2025-01-16T08:00:00Z', hash: 'prov-hash-017...', modifier: -50 },
  { agentId: 'agent-089', creationType: 'EVOLVED', parentAgentId: 'agent-042', createdBy: 'system', createdAt: '2025-01-17T09:00:00Z', hash: 'prov-hash-089...', modifier: 100 },
  { agentId: 'agent-023', creationType: 'PROMOTED', parentAgentId: 'agent-017', createdBy: 'trust-engine', createdAt: '2025-01-18T14:00:00Z', hash: 'prov-hash-023...', modifier: 150 },
  { agentId: 'agent-056', creationType: 'IMPORTED', createdBy: 'integration-service', createdAt: '2025-01-19T11:00:00Z', hash: 'prov-hash-056...', modifier: -100 },
  { agentId: 'agent-078', creationType: 'FRESH', createdBy: 'system', createdAt: '2025-01-20T16:00:00Z', hash: 'prov-hash-078...', modifier: 0 },
]

const DEMO_POLICIES: ModifierPolicy[] = [
  { policyId: 'default:fresh', creationType: 'FRESH', baselineModifier: 0, createdBy: 'system' },
  { policyId: 'default:cloned', creationType: 'CLONED', baselineModifier: -50, createdBy: 'system' },
  { policyId: 'default:evolved', creationType: 'EVOLVED', baselineModifier: 100, createdBy: 'system' },
  { policyId: 'default:promoted', creationType: 'PROMOTED', baselineModifier: 150, createdBy: 'system' },
  { policyId: 'default:imported', creationType: 'IMPORTED', baselineModifier: -100, createdBy: 'system' },
  { policyId: 'trusted:imported', creationType: 'IMPORTED', baselineModifier: -30, conditions: { trustedSources: ['org:verified-partner'] }, createdBy: 'security-team' },
]

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function ProvenancePage() {
  const [records] = useState<ProvenanceRecord[]>(DEMO_RECORDS)
  const [policies] = useState<ModifierPolicy[]>(DEMO_POLICIES)
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const countByType = CREATION_TYPES.map(ct => ({
    ...ct,
    count: records.filter(r => r.creationType === ct.type).length,
  }))

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
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-rose-500 to-pink-500 shadow-lg shadow-rose-500/25">
            <Eye className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              Q5: Provenance Tracking
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Immutable origin records + mutable policy modifiers
            </p>
          </div>
        </div>
        <button
          onClick={() => setLoading(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-rose-500 to-pink-500 rounded-lg hover:opacity-90 transition-opacity"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Creation Types Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {countByType.map((ct) => {
          const Icon = ct.icon
          return (
            <button
              key={ct.type}
              onClick={() => setSelectedType(selectedType === ct.type ? null : ct.type)}
              className={`p-4 rounded-xl border transition-all ${
                selectedType === ct.type
                  ? 'bg-gradient-to-br ' + ct.color + ' border-transparent text-white'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <Icon className={`w-5 h-5 ${selectedType === ct.type ? 'text-white' : 'text-gray-500'}`} />
                <span className={`text-lg font-bold ${selectedType === ct.type ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                  {ct.count}
                </span>
              </div>
              <p className={`text-sm font-medium ${selectedType === ct.type ? 'text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                {ct.type}
              </p>
              <p className={`text-xs flex items-center gap-1 mt-1 ${
                selectedType === ct.type ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'
              }`}>
                {ct.modifier > 0 ? (
                  <><TrendingUp className="w-3 h-3" /> +{ct.modifier}</>
                ) : ct.modifier < 0 ? (
                  <><TrendingDown className="w-3 h-3" /> {ct.modifier}</>
                ) : (
                  <><Minus className="w-3 h-3" /> 0</>
                )}
              </p>
            </button>
          )
        })}
      </div>

      {/* Modifier Explanation */}
      <div className="bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-900/20 dark:to-pink-900/20 rounded-xl border border-rose-200 dark:border-rose-800 p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Trust Score Modifiers</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Provenance modifiers adjust the base trust score based on how an agent was created.
          These modifiers are applied during trust computation and reflect the inherent trust characteristics of the creation method.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {CREATION_TYPES.map((ct) => (
            <div
              key={ct.type}
              className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-900 dark:text-white">{ct.type}</span>
                <span className={`text-xs font-bold ${
                  ct.modifier > 0 ? 'text-green-600 dark:text-green-400' :
                  ct.modifier < 0 ? 'text-red-600 dark:text-red-400' :
                  'text-gray-600 dark:text-gray-400'
                }`}>
                  {ct.modifier > 0 ? '+' : ''}{ct.modifier}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{ct.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Provenance Records */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-rose-500" />
            Provenance Records
            {selectedType && (
              <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                (filtered: {selectedType})
              </span>
            )}
          </h2>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {records
            .filter(r => !selectedType || r.creationType === selectedType)
            .map((record) => {
              const typeConfig = CREATION_TYPES.find(ct => ct.type === record.creationType)!
              const Icon = typeConfig.icon
              return (
                <div key={record.agentId} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg bg-gradient-to-br ${typeConfig.color}`}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {record.agentId}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {record.createdBy}
                          </span>
                          {record.parentAgentId && (
                            <span className="flex items-center gap-1">
                              <GitBranch className="w-3 h-3" />
                              from {record.parentAgentId}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                        record.modifier > 0
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                          : record.modifier < 0
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {record.modifier > 0 ? '+' : ''}{record.modifier}
                      </span>
                      <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                        <Hash className="w-3 h-3" />
                        <code>{record.hash}</code>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
        </div>
      </div>

      {/* Modifier Policies */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-purple-500" />
            Modifier Policies
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[500px]">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Policy ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Creation Type</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400">Modifier</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Conditions</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Created By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {policies.map((policy) => (
                <tr key={policy.policyId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3">
                    <code className="text-xs text-gray-600 dark:text-gray-400">{policy.policyId}</code>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{policy.creationType}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-sm font-bold ${
                      policy.baselineModifier > 0
                        ? 'text-green-600 dark:text-green-400'
                        : policy.baselineModifier < 0
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      {policy.baselineModifier > 0 ? '+' : ''}{policy.baselineModifier}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {policy.conditions ? (
                      <code className="text-xs text-purple-600 dark:text-purple-400">
                        {JSON.stringify(policy.conditions).substring(0, 30)}...
                      </code>
                    ) : (
                      <span className="text-xs text-gray-400">None</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{policy.createdBy}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lineage Visualization */}
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <GitBranch className="w-5 h-5 text-gray-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Agent Lineage Example
          </h3>
        </div>
        <div className="flex items-center justify-center gap-4 flex-wrap py-4">
          <div className="flex flex-col items-center">
            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 shadow-lg mb-2">
              <Plus className="w-5 h-5 text-white" />
            </div>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">agent-042</span>
            <span className="text-xs text-gray-500">FRESH (±0)</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-0.5 bg-gray-300 dark:bg-gray-600" />
            <span className="text-xs text-gray-400">cloned</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 shadow-lg mb-2">
              <Copy className="w-5 h-5 text-white" />
            </div>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">agent-017</span>
            <span className="text-xs text-red-500">CLONED (-50)</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-0.5 bg-gray-300 dark:bg-gray-600" />
            <span className="text-xs text-gray-400">promoted</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg mb-2">
              <Award className="w-5 h-5 text-white" />
            </div>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">agent-023</span>
            <span className="text-xs text-green-500">PROMOTED (+150)</span>
          </div>
        </div>
        <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-4">
          Agent lineage is tracked immutably. Trust modifiers are computed based on creation type at evaluation time.
        </p>
      </div>
    </div>
  )
}
