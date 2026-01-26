'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Key,
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Shield,
  Users,
  Activity,
  Eye,
} from 'lucide-react'

// =============================================================================
// TYPES
// =============================================================================

interface RoleGateEvaluation {
  id: string
  agentId: string
  requestedRole: string
  currentTier: string
  decision: 'ALLOW' | 'DENY' | 'ESCALATE'
  kernelResult: boolean
  policyApplied?: string
  overrideUsed: boolean
  timestamp: string
}

// =============================================================================
// CONSTANTS
// =============================================================================

// Role definitions
const ROLES = [
  { id: 'R-L0', name: 'Listener', minTier: 'T0', description: 'Passive observation only' },
  { id: 'R-L1', name: 'Executor', minTier: 'T0', description: 'Single task execution' },
  { id: 'R-L2', name: 'Planner', minTier: 'T1', description: 'Multi-step planning' },
  { id: 'R-L3', name: 'Orchestrator', minTier: 'T2', description: 'Multi-agent coordination' },
  { id: 'R-L4', name: 'Architect', minTier: 'T3', description: 'System design' },
  { id: 'R-L5', name: 'Governor', minTier: 'T4', description: 'Policy control' },
  { id: 'R-L6', name: 'Sovereign', minTier: 'T5', description: 'Full autonomy' },
  { id: 'R-L7', name: 'Meta-Agent', minTier: 'T5', description: 'Agent creation' },
  { id: 'R-L8', name: 'Ecosystem', minTier: 'T5', description: 'Ecosystem control' },
]

const TIERS = ['T0', 'T1', 'T2', 'T3', 'T4', 'T5']

// Role-tier matrix (true = allowed by kernel)
const ROLE_GATE_MATRIX: Record<string, Record<string, boolean>> = {
  'R-L0': { T0: true, T1: true, T2: true, T3: true, T4: true, T5: true },
  'R-L1': { T0: true, T1: true, T2: true, T3: true, T4: true, T5: true },
  'R-L2': { T0: false, T1: true, T2: true, T3: true, T4: true, T5: true },
  'R-L3': { T0: false, T1: false, T2: true, T3: true, T4: true, T5: true },
  'R-L4': { T0: false, T1: false, T2: false, T3: true, T4: true, T5: true },
  'R-L5': { T0: false, T1: false, T2: false, T3: false, T4: true, T5: true },
  'R-L6': { T0: false, T1: false, T2: false, T3: false, T4: false, T5: true },
  'R-L7': { T0: false, T1: false, T2: false, T3: false, T4: false, T5: true },
  'R-L8': { T0: false, T1: false, T2: false, T3: false, T4: false, T5: true },
}

// Demo evaluations
const DEMO_EVALUATIONS: RoleGateEvaluation[] = [
  { id: '1', agentId: 'agent-042', requestedRole: 'R-L3', currentTier: 'T3', decision: 'ALLOW', kernelResult: true, policyApplied: 'default-orchestrator', overrideUsed: false, timestamp: new Date().toISOString() },
  { id: '2', agentId: 'agent-017', requestedRole: 'R-L4', currentTier: 'T2', decision: 'DENY', kernelResult: false, overrideUsed: false, timestamp: new Date(Date.now() - 60000).toISOString() },
  { id: '3', agentId: 'agent-089', requestedRole: 'R-L5', currentTier: 'T3', decision: 'ESCALATE', kernelResult: false, policyApplied: 'requires-override', overrideUsed: false, timestamp: new Date(Date.now() - 120000).toISOString() },
  { id: '4', agentId: 'agent-023', requestedRole: 'R-L2', currentTier: 'T4', decision: 'ALLOW', kernelResult: true, policyApplied: 'default-planner', overrideUsed: false, timestamp: new Date(Date.now() - 180000).toISOString() },
  { id: '5', agentId: 'agent-056', requestedRole: 'R-L4', currentTier: 'T3', decision: 'ALLOW', kernelResult: true, policyApplied: 'enterprise-architect', overrideUsed: true, timestamp: new Date(Date.now() - 240000).toISOString() },
]

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function RoleGatesPage() {
  const [evaluations] = useState<RoleGateEvaluation[]>(DEMO_EVALUATIONS)
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const allowCount = evaluations.filter(e => e.decision === 'ALLOW').length
  const denyCount = evaluations.filter(e => e.decision === 'DENY').length
  const escalateCount = evaluations.filter(e => e.decision === 'ESCALATE').length

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
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 shadow-lg shadow-purple-500/25">
            <Key className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              Q3: Stratified Role Gates
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              3-layer role + trust enforcement
            </p>
          </div>
        </div>
        <button
          onClick={() => setLoading(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-500 to-indigo-500 rounded-lg hover:opacity-90 transition-opacity"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Allowed</span>
            <CheckCircle className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{allowCount}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Denied</span>
            <XCircle className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{denyCount}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Escalated</span>
            <AlertTriangle className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{escalateCount}</p>
        </div>
      </div>

      {/* 3-Layer Explanation */}
      <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-xl border border-purple-200 dark:border-purple-800 p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">3-Layer Evaluation Stack</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-bold">1</div>
              <span className="font-medium text-gray-900 dark:text-white">Kernel</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Fast matrix lookup: Role × Tier = Allow/Deny
            </p>
          </div>
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-purple-500 text-white text-xs flex items-center justify-center font-bold">2</div>
              <span className="font-medium text-gray-900 dark:text-white">Policy</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Context-aware rules: attestations, domains, conditions
            </p>
          </div>
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center font-bold">3</div>
              <span className="font-medium text-gray-900 dark:text-white">BASIS</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Dual-control override: requires 2 approvers
            </p>
          </div>
        </div>
      </div>

      {/* Role-Tier Matrix */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-purple-500" />
            Role-Tier Permission Matrix (Kernel Layer)
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Role</th>
                {TIERS.map(tier => (
                  <th key={tier} className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400">
                    {tier}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {ROLES.map(role => (
                <tr
                  key={role.id}
                  className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors ${
                    selectedRole === role.id ? 'bg-purple-50 dark:bg-purple-900/20' : ''
                  }`}
                  onClick={() => setSelectedRole(selectedRole === role.id ? null : role.id)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-purple-600 dark:text-purple-400">{role.id}</span>
                      <span className="text-sm text-gray-900 dark:text-white">{role.name}</span>
                    </div>
                    {selectedRole === role.id && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{role.description}</p>
                    )}
                  </td>
                  {TIERS.map(tier => {
                    const allowed = ROLE_GATE_MATRIX[role.id]?.[tier] ?? false
                    return (
                      <td key={tier} className="px-4 py-3 text-center">
                        {allowed ? (
                          <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-300 dark:text-red-800 mx-auto" />
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Evaluations */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-500" />
            Recent Role Gate Evaluations
          </h2>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {evaluations.map((evaluation) => (
            <div key={evaluation.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    evaluation.decision === 'ALLOW' ? 'bg-green-100 dark:bg-green-900/30' :
                    evaluation.decision === 'DENY' ? 'bg-red-100 dark:bg-red-900/30' :
                    'bg-amber-100 dark:bg-amber-900/30'
                  }`}>
                    {evaluation.decision === 'ALLOW' ? (
                      <CheckCircle className={`w-4 h-4 text-green-600 dark:text-green-400`} />
                    ) : evaluation.decision === 'DENY' ? (
                      <XCircle className={`w-4 h-4 text-red-600 dark:text-red-400`} />
                    ) : (
                      <AlertTriangle className={`w-4 h-4 text-amber-600 dark:text-amber-400`} />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {evaluation.agentId}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {evaluation.requestedRole} @ {evaluation.currentTier}
                      {evaluation.policyApplied && (
                        <span className="ml-2 text-purple-600 dark:text-purple-400">
                          Policy: {evaluation.policyApplied}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {evaluation.overrideUsed && (
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                      Override
                    </span>
                  )}
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                    evaluation.decision === 'ALLOW' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                    evaluation.decision === 'DENY' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                  }`}>
                    {evaluation.decision}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dual Control Override Info */}
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Users className="w-5 h-5 text-gray-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Dual-Control Override (BASIS Layer)
          </h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          When a role gate evaluation is escalated, dual-control override requires two different human approvers
          to grant temporary elevated access. This ensures no single person can bypass security controls.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Requirements</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white">2 different approvers</p>
          </div>
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Max Duration</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white">1 hour per override</p>
          </div>
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Audit</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white">Full reason + approvers logged</p>
          </div>
        </div>
      </div>
    </div>
  )
}
