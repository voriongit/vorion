'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Layers,
  ArrowLeft,
  RefreshCw,
  Server,
  Building,
  Users,
  Zap,
  Lock,
  Unlock,
  ChevronRight,
  ChevronDown,
  CheckCircle,
  Clock,
  Shield,
  Hash,
} from 'lucide-react'

// =============================================================================
// TYPES
// =============================================================================

interface DeploymentContext {
  deploymentId: string
  regulatoryFramework: string
  maxAllowedTier: string
  allowedContextTypes: string[]
  deployedBy: string
  createdAt: string
  hash: string
}

interface OrganizationalContext {
  orgId: string
  tenantId: string
  parentDeployment: string
  status: 'configuring' | 'locked'
  constraints: {
    maxTrustTier: string
    deniedDomains: string[]
    requiredAttestations: string[]
    dataClassification: string
    auditLevel: string
  }
  lockedAt?: string
  hash: string
}

interface AgentContext {
  agentId: string
  parentOrg: string
  contextType: string
  ceiling: number
  createdBy: string
  createdAt: string
  hash: string
}

interface OperationContext {
  operationId: string
  parentAgent: string
  action: string
  ttlMs: number
  createdAt: string
  expiresAt: string
  expired: boolean
}

// =============================================================================
// DEMO DATA
// =============================================================================

const DEMO_DEPLOYMENTS: DeploymentContext[] = [
  {
    deploymentId: 'prod-us-west-1',
    regulatoryFramework: 'HIPAA',
    maxAllowedTier: 'T4',
    allowedContextTypes: ['ENTERPRISE'],
    deployedBy: 'devops@company.com',
    createdAt: '2025-01-15T08:00:00Z',
    hash: 'a1b2c3d4e5f6...',
  },
  {
    deploymentId: 'prod-eu-central-1',
    regulatoryFramework: 'GDPR',
    maxAllowedTier: 'T4',
    allowedContextTypes: ['ENTERPRISE', 'SANDBOX'],
    deployedBy: 'devops@company.eu',
    createdAt: '2025-01-16T10:00:00Z',
    hash: 'f6e5d4c3b2a1...',
  },
  {
    deploymentId: 'staging-us-east-1',
    regulatoryFramework: 'NONE',
    maxAllowedTier: 'T5',
    allowedContextTypes: ['SANDBOX', 'PERSONAL', 'ENTERPRISE'],
    deployedBy: 'dev@company.com',
    createdAt: '2025-01-10T14:00:00Z',
    hash: '1a2b3c4d5e6f...',
  },
]

const DEMO_ORGS: OrganizationalContext[] = [
  {
    orgId: 'company-us',
    tenantId: 'tenant-001',
    parentDeployment: 'prod-us-west-1',
    status: 'locked',
    constraints: {
      maxTrustTier: 'T4',
      deniedDomains: ['F'],
      requiredAttestations: ['identity', 'compliance'],
      dataClassification: 'confidential',
      auditLevel: 'comprehensive',
    },
    lockedAt: '2025-01-15T09:00:00Z',
    hash: 'org-hash-001...',
  },
  {
    orgId: 'company-eu',
    tenantId: 'tenant-002',
    parentDeployment: 'prod-eu-central-1',
    status: 'locked',
    constraints: {
      maxTrustTier: 'T4',
      deniedDomains: [],
      requiredAttestations: ['identity', 'gdpr-compliance'],
      dataClassification: 'restricted',
      auditLevel: 'comprehensive',
    },
    lockedAt: '2025-01-16T11:00:00Z',
    hash: 'org-hash-002...',
  },
]

const DEMO_AGENTS: AgentContext[] = [
  { agentId: 'agent-042', parentOrg: 'company-us', contextType: 'ENTERPRISE', ceiling: 900, createdBy: 'system', createdAt: '2025-01-15T10:00:00Z', hash: 'agent-hash-042...' },
  { agentId: 'agent-017', parentOrg: 'company-us', contextType: 'ENTERPRISE', ceiling: 900, createdBy: 'admin@company.com', createdAt: '2025-01-16T08:00:00Z', hash: 'agent-hash-017...' },
  { agentId: 'agent-089', parentOrg: 'company-eu', contextType: 'ENTERPRISE', ceiling: 900, createdBy: 'system', createdAt: '2025-01-17T09:00:00Z', hash: 'agent-hash-089...' },
]

const DEMO_OPERATIONS: OperationContext[] = [
  { operationId: 'op-001', parentAgent: 'agent-042', action: 'analyze_document', ttlMs: 300000, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 300000).toISOString(), expired: false },
  { operationId: 'op-002', parentAgent: 'agent-017', action: 'generate_report', ttlMs: 600000, createdAt: new Date(Date.now() - 60000).toISOString(), expiresAt: new Date(Date.now() + 540000).toISOString(), expired: false },
  { operationId: 'op-003', parentAgent: 'agent-089', action: 'query_data', ttlMs: 120000, createdAt: new Date(Date.now() - 180000).toISOString(), expiresAt: new Date(Date.now() - 60000).toISOString(), expired: true },
]

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function ContextPage() {
  const [expandedDeployment, setExpandedDeployment] = useState<string | null>('prod-us-west-1')
  const [expandedOrg, setExpandedOrg] = useState<string | null>('company-us')
  const [loading, setLoading] = useState(false)

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
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 shadow-lg shadow-green-500/25">
            <Layers className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              Q2: Hierarchical Context
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              4-tier context with tiered immutability
            </p>
          </div>
        </div>
        <button
          onClick={() => setLoading(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg hover:opacity-90 transition-opacity"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Tier Legend */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <TierCard
          tier="Tier 1"
          label="Deployment"
          status="IMMUTABLE"
          icon={Server}
          description="Set once at deployment"
          color="from-blue-500 to-indigo-500"
          count={DEMO_DEPLOYMENTS.length}
        />
        <TierCard
          tier="Tier 2"
          label="Organization"
          status="LOCKED"
          icon={Building}
          description="Locked post-startup"
          color="from-purple-500 to-indigo-500"
          count={DEMO_ORGS.length}
        />
        <TierCard
          tier="Tier 3"
          label="Agent"
          status="FROZEN"
          icon={Users}
          description="Frozen at creation"
          color="from-green-500 to-emerald-500"
          count={DEMO_AGENTS.length}
        />
        <TierCard
          tier="Tier 4"
          label="Operation"
          status="EPHEMERAL"
          icon={Zap}
          description="Per-request with TTL"
          color="from-amber-500 to-orange-500"
          count={DEMO_OPERATIONS.filter(o => !o.expired).length}
        />
      </div>

      {/* Hierarchy Tree */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-green-500" />
            Context Hierarchy Tree
          </h2>
        </div>
        <div className="p-4">
          <div className="space-y-2">
            {DEMO_DEPLOYMENTS.map((deployment) => (
              <div key={deployment.deploymentId} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                {/* Deployment Level */}
                <button
                  onClick={() => setExpandedDeployment(expandedDeployment === deployment.deploymentId ? null : deployment.deploymentId)}
                  className="w-full flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                >
                  <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500">
                    <Server className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{deployment.deploymentId}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{deployment.regulatoryFramework} | Max: {deployment.maxAllowedTier}</p>
                  </div>
                  <Lock className="w-4 h-4 text-blue-500" />
                  {expandedDeployment === deployment.deploymentId ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                </button>

                {/* Organizations under this deployment */}
                {expandedDeployment === deployment.deploymentId && (
                  <div className="pl-8 pr-4 py-2 space-y-2 bg-gray-50 dark:bg-gray-800">
                    {DEMO_ORGS.filter(o => o.parentDeployment === deployment.deploymentId).map((org) => (
                      <div key={org.orgId} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                        <button
                          onClick={() => setExpandedOrg(expandedOrg === org.orgId ? null : org.orgId)}
                          className="w-full flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                        >
                          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500">
                            <Building className="w-4 h-4 text-white" />
                          </div>
                          <div className="flex-1 text-left">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{org.orgId}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Tenant: {org.tenantId} | {org.status}</p>
                          </div>
                          <Lock className="w-4 h-4 text-purple-500" />
                          {expandedOrg === org.orgId ? (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          )}
                        </button>

                        {/* Agents under this org */}
                        {expandedOrg === org.orgId && (
                          <div className="pl-8 pr-4 py-2 space-y-2 bg-gray-100 dark:bg-gray-900">
                            {DEMO_AGENTS.filter(a => a.parentOrg === org.orgId).map((agent) => (
                              <div key={agent.agentId} className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                <div className="p-2 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500">
                                  <Users className="w-4 h-4 text-white" />
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-gray-900 dark:text-white">{agent.agentId}</p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">{agent.contextType} | Ceiling: {agent.ceiling}</p>
                                </div>
                                <Lock className="w-4 h-4 text-green-500" />

                                {/* Operations indicator */}
                                {DEMO_OPERATIONS.filter(o => o.parentAgent === agent.agentId && !o.expired).length > 0 && (
                                  <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                                    <Zap className="w-3 h-3" />
                                    {DEMO_OPERATIONS.filter(o => o.parentAgent === agent.agentId && !o.expired).length} active
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Active Operations */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            Active Operations (Tier 4)
          </h2>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {DEMO_OPERATIONS.map((op) => (
            <div
              key={op.operationId}
              className={`p-4 ${op.expired ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${op.expired ? 'bg-gray-100 dark:bg-gray-700' : 'bg-amber-100 dark:bg-amber-900/30'}`}>
                    {op.expired ? (
                      <Clock className="w-4 h-4 text-gray-500" />
                    ) : (
                      <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {op.operationId}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {op.parentAgent} | {op.action}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    op.expired
                      ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                  }`}>
                    {op.expired ? 'Expired' : 'Active'}
                  </span>
                  <p className="text-xs text-gray-400 mt-1">
                    TTL: {op.ttlMs / 1000}s
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hash Chain Info */}
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Hash className="w-5 h-5 text-gray-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Cryptographic Hash Chain
          </h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Each context tier maintains a cryptographic hash that chains to its parent, ensuring integrity verification at any point in the hierarchy.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Deployment Hash</p>
            <code className="text-xs font-mono text-blue-600 dark:text-blue-400">SHA-256 | IMMUTABLE</code>
          </div>
          <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Org Hash</p>
            <code className="text-xs font-mono text-purple-600 dark:text-purple-400">SHA-256 + Parent</code>
          </div>
          <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Agent Hash</p>
            <code className="text-xs font-mono text-green-600 dark:text-green-400">SHA-256 + Parent</code>
          </div>
          <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Operation Hash</p>
            <code className="text-xs font-mono text-amber-600 dark:text-amber-400">SHA-256 + Parent</code>
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function TierCard({
  tier,
  label,
  status,
  icon: Icon,
  description,
  color,
  count,
}: {
  tier: string
  label: string
  status: string
  icon: React.ElementType
  description: string
  color: string
  count: number
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg bg-gradient-to-br ${color}`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{tier}</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{label}</p>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1 ${
          status === 'IMMUTABLE' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
          status === 'LOCKED' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
          status === 'FROZEN' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
          'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
        }`}>
          {status === 'EPHEMERAL' ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
          {status}
        </span>
        <span className="text-lg font-bold text-gray-900 dark:text-white">{count}</span>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{description}</p>
    </div>
  )
}
