'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  TrendingUp,
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  ChevronRight,
  ChevronDown,
  Hash,
  GitBranch,
  Shield,
  Building,
  Layers,
} from 'lucide-react'

// =============================================================================
// TYPES
// =============================================================================

interface WeightPreset {
  id: string
  name: string
  description: string
  tier: 'aci' | 'vorion' | 'axiom'
  parentId?: string
  weights: {
    observability: number
    capability: number
    behavior: number
    governance: number
    context: number
  }
  hash: string
  createdBy: string
  version: string
}

interface LineageVerification {
  presetId: string
  chain: string[]
  verified: boolean
  verifiedAt: string
}

// =============================================================================
// DEMO DATA
// =============================================================================

const ACI_PRESETS: WeightPreset[] = [
  {
    id: 'aci:preset:balanced',
    name: 'ACI Balanced',
    description: 'Equal weights across all dimensions',
    tier: 'aci',
    weights: { observability: 0.20, capability: 0.20, behavior: 0.20, governance: 0.20, context: 0.20 },
    hash: 'a1b2c3d4...',
    createdBy: 'ACI Specification',
    version: '1.0.0',
  },
  {
    id: 'aci:preset:conservative',
    name: 'ACI Conservative',
    description: 'Emphasizes governance and observability',
    tier: 'aci',
    weights: { observability: 0.30, capability: 0.15, behavior: 0.15, governance: 0.30, context: 0.10 },
    hash: 'e5f6g7h8...',
    createdBy: 'ACI Specification',
    version: '1.0.0',
  },
  {
    id: 'aci:preset:capability-focused',
    name: 'ACI Capability-Focused',
    description: 'Emphasizes capability and behavior',
    tier: 'aci',
    weights: { observability: 0.15, capability: 0.30, behavior: 0.25, governance: 0.15, context: 0.15 },
    hash: 'i9j0k1l2...',
    createdBy: 'ACI Specification',
    version: '1.0.0',
  },
]

const VORION_PRESETS: WeightPreset[] = [
  {
    id: 'vorion:preset:enterprise',
    name: 'Vorion Enterprise',
    description: 'Enterprise-grade balance with governance focus',
    tier: 'vorion',
    parentId: 'aci:preset:balanced',
    weights: { observability: 0.25, capability: 0.20, behavior: 0.20, governance: 0.25, context: 0.10 },
    hash: 'm3n4o5p6...',
    createdBy: 'Vorion Team',
    version: '1.0.0',
  },
  {
    id: 'vorion:preset:balanced-autonomy',
    name: 'Vorion Balanced Autonomy',
    description: 'Higher capability for trusted agents',
    tier: 'vorion',
    parentId: 'aci:preset:balanced',
    weights: { observability: 0.20, capability: 0.25, behavior: 0.25, governance: 0.15, context: 0.15 },
    hash: 'q7r8s9t0...',
    createdBy: 'Vorion Team',
    version: '1.0.0',
  },
  {
    id: 'vorion:preset:high-security',
    name: 'Vorion High Security',
    description: 'Maximum observability for regulated environments',
    tier: 'vorion',
    parentId: 'aci:preset:conservative',
    weights: { observability: 0.35, capability: 0.10, behavior: 0.15, governance: 0.30, context: 0.10 },
    hash: 'u1v2w3x4...',
    createdBy: 'Vorion Security Team',
    version: '1.0.0',
  },
]

const AXIOM_PRESETS: WeightPreset[] = [
  {
    id: 'axiom:org-001:standard',
    name: 'Org-001 Standard',
    description: 'Standard preset for Organization 001',
    tier: 'axiom',
    parentId: 'vorion:preset:enterprise',
    weights: { observability: 0.25, capability: 0.20, behavior: 0.22, governance: 0.23, context: 0.10 },
    hash: 'y5z6a7b8...',
    createdBy: 'admin@org-001.com',
    version: '1.0.0',
  },
  {
    id: 'axiom:org-001:high-trust',
    name: 'Org-001 High Trust',
    description: 'For internal high-trust agents',
    tier: 'axiom',
    parentId: 'vorion:preset:balanced-autonomy',
    weights: { observability: 0.18, capability: 0.27, behavior: 0.25, governance: 0.15, context: 0.15 },
    hash: 'c9d0e1f2...',
    createdBy: 'security@org-001.com',
    version: '1.0.0',
  },
]

const DEMO_LINEAGES: LineageVerification[] = [
  {
    presetId: 'axiom:org-001:standard',
    chain: ['aci:preset:balanced', 'vorion:preset:enterprise', 'axiom:org-001:standard'],
    verified: true,
    verifiedAt: new Date().toISOString(),
  },
  {
    presetId: 'axiom:org-001:high-trust',
    chain: ['aci:preset:balanced', 'vorion:preset:balanced-autonomy', 'axiom:org-001:high-trust'],
    verified: true,
    verifiedAt: new Date(Date.now() - 3600000).toISOString(),
  },
]

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function PresetsPage() {
  const [selectedPreset, setSelectedPreset] = useState<WeightPreset | null>(null)
  const [expandedTier, setExpandedTier] = useState<string>('aci')
  const [loading, setLoading] = useState(false)

  const allPresets = [...ACI_PRESETS, ...VORION_PRESETS, ...AXIOM_PRESETS]

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
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/25">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              Q4: Federated Weight Presets
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              3-tier federation with cryptographic derivation chains
            </p>
          </div>
        </div>
        <button
          onClick={() => setLoading(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg hover:opacity-90 transition-opacity"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Tier Stats */}
      <div className="grid grid-cols-3 gap-4">
        <TierCard
          tier="ACI Canonical"
          icon={Shield}
          count={ACI_PRESETS.length}
          description="Immutable specification presets"
          color="from-blue-500 to-indigo-500"
        />
        <TierCard
          tier="Vorion Reference"
          icon={Building}
          count={VORION_PRESETS.length}
          description="Platform-level presets"
          color="from-purple-500 to-indigo-500"
        />
        <TierCard
          tier="Axiom Deployment"
          icon={Layers}
          count={AXIOM_PRESETS.length}
          description="Organization-specific presets"
          color="from-amber-500 to-orange-500"
        />
      </div>

      {/* Federation Diagram */}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl border border-amber-200 dark:border-amber-800 p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Derivation Chain</h3>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <div className="flex flex-col items-center">
            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 shadow-lg mb-2">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">ACI Canonical</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">IMMUTABLE</span>
          </div>
          <ChevronRight className="w-6 h-6 text-gray-400" />
          <div className="flex flex-col items-center">
            <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 shadow-lg mb-2">
              <Building className="w-6 h-6 text-white" />
            </div>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Vorion Reference</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">Derives from ACI</span>
          </div>
          <ChevronRight className="w-6 h-6 text-gray-400" />
          <div className="flex flex-col items-center">
            <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg mb-2">
              <Layers className="w-6 h-6 text-white" />
            </div>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Axiom Deployment</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">Org-specific</span>
          </div>
        </div>
      </div>

      {/* Presets by Tier */}
      <div className="space-y-4">
        {/* ACI Presets */}
        <PresetTierSection
          tier="aci"
          title="ACI Canonical Presets"
          subtitle="Immutable specification presets"
          icon={Shield}
          color="from-blue-500 to-indigo-500"
          presets={ACI_PRESETS}
          expanded={expandedTier === 'aci'}
          onToggle={() => setExpandedTier(expandedTier === 'aci' ? '' : 'aci')}
          onSelectPreset={setSelectedPreset}
          selectedPreset={selectedPreset}
        />

        {/* Vorion Presets */}
        <PresetTierSection
          tier="vorion"
          title="Vorion Reference Presets"
          subtitle="Platform-level customizations"
          icon={Building}
          color="from-purple-500 to-indigo-500"
          presets={VORION_PRESETS}
          expanded={expandedTier === 'vorion'}
          onToggle={() => setExpandedTier(expandedTier === 'vorion' ? '' : 'vorion')}
          onSelectPreset={setSelectedPreset}
          selectedPreset={selectedPreset}
        />

        {/* Axiom Presets */}
        <PresetTierSection
          tier="axiom"
          title="Axiom Deployment Presets"
          subtitle="Organization-specific configurations"
          icon={Layers}
          color="from-amber-500 to-orange-500"
          presets={AXIOM_PRESETS}
          expanded={expandedTier === 'axiom'}
          onToggle={() => setExpandedTier(expandedTier === 'axiom' ? '' : 'axiom')}
          onSelectPreset={setSelectedPreset}
          selectedPreset={selectedPreset}
        />
      </div>

      {/* Selected Preset Details */}
      {selectedPreset && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber-500" />
                Weight Distribution: {selectedPreset.name}
              </h2>
              <button
                onClick={() => setSelectedPreset(null)}
                className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                Close
              </button>
            </div>
          </div>
          <div className="p-4">
            <div className="space-y-3">
              {Object.entries(selectedPreset.weights).map(([key, value]) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="w-24 text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                    {key}
                  </span>
                  <div className="flex-1 h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500"
                      style={{ width: `${value * 100}%` }}
                    />
                  </div>
                  <span className="w-12 text-sm font-bold text-gray-900 dark:text-white text-right">
                    {(value * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Created by</span>
                  <p className="font-medium text-gray-900 dark:text-white">{selectedPreset.createdBy}</p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Hash</span>
                  <p className="font-mono text-xs text-gray-600 dark:text-gray-400">{selectedPreset.hash}</p>
                </div>
                {selectedPreset.parentId && (
                  <div className="col-span-2">
                    <span className="text-gray-500 dark:text-gray-400">Derived from</span>
                    <p className="font-medium text-purple-600 dark:text-purple-400">{selectedPreset.parentId}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lineage Verification */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-green-500" />
            Lineage Verification
          </h2>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {DEMO_LINEAGES.map((lineage) => (
            <div key={lineage.presetId} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {lineage.presetId}
                </span>
                <span className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                  lineage.verified
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                }`}>
                  {lineage.verified ? <CheckCircle className="w-3 h-3" /> : null}
                  {lineage.verified ? 'Verified' : 'Unverified'}
                </span>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {lineage.chain.map((step, index) => (
                  <div key={step} className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      step.startsWith('aci:')
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        : step.startsWith('vorion:')
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                    }`}>
                      {step.split(':').slice(-1)[0]}
                    </span>
                    {index < lineage.chain.length - 1 && (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
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
  icon: Icon,
  count,
  description,
  color,
}: {
  tier: string
  icon: React.ElementType
  count: number
  description: string
  color: string
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg bg-gradient-to-br ${color}`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <span className="text-sm font-semibold text-gray-900 dark:text-white">{tier}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{count}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
    </div>
  )
}

function PresetTierSection({
  tier,
  title,
  subtitle,
  icon: Icon,
  color,
  presets,
  expanded,
  onToggle,
  onSelectPreset,
  selectedPreset,
}: {
  tier: string
  title: string
  subtitle: string
  icon: React.ElementType
  color: string
  presets: WeightPreset[]
  expanded: boolean
  onToggle: () => void
  onSelectPreset: (preset: WeightPreset) => void
  selectedPreset: WeightPreset | null
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-gradient-to-br ${color}`}>
            <Icon className="w-4 h-4 text-white" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-gray-900 dark:text-white">{title}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-500">{presets.length}</span>
          {expanded ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>
      {expanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
          {presets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => onSelectPreset(preset)}
              className={`w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                selectedPreset?.id === preset.id ? 'bg-amber-50 dark:bg-amber-900/20' : ''
              }`}
            >
              <div className="text-left">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{preset.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{preset.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-gray-400" />
                <code className="text-xs text-gray-500">{preset.hash}</code>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
