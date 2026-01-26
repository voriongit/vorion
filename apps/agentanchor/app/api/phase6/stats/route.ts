/**
 * Phase 6 Trust Engine Stats API
 *
 * Returns aggregated statistics from all Phase 6 components:
 * - Q1: Ceiling Enforcement
 * - Q2: Hierarchical Context
 * - Q3: Role Gates
 * - Q4: Weight Presets
 * - Q5: Provenance
 */

import { NextRequest, NextResponse } from 'next/server'

// =============================================================================
// TYPES
// =============================================================================

interface Phase6Stats {
  contextStats: {
    deployments: number
    organizations: number
    agents: number
    activeOperations: number
  }
  ceilingStats: {
    totalEvents: number
    totalAuditEntries: number
    complianceBreakdown: {
      compliant: number
      warning: number
      violation: number
    }
    agentsWithAlerts: number
  }
  roleGateStats: {
    totalEvaluations: number
    byDecision: {
      ALLOW: number
      DENY: number
      ESCALATE: number
    }
  }
  presetStats: {
    aciPresets: number
    vorionPresets: number
    axiomPresets: number
    verifiedLineages: number
  }
  provenanceStats: {
    totalRecords: number
    byCreationType: {
      FRESH: number
      CLONED: number
      EVOLVED: number
      PROMOTED: number
      IMPORTED: number
    }
  }
}

interface TrustTierData {
  tier: string
  label: string
  range: string
  count: number
  color: string
}

interface RecentEvent {
  id: string
  type: 'ceiling' | 'role_gate' | 'context' | 'provenance'
  agentId: string
  decision?: string
  status: 'compliant' | 'warning' | 'violation'
  timestamp: string
}

// =============================================================================
// HANDLER
// =============================================================================

/**
 * GET /api/phase6/stats
 * Get Phase 6 Trust Engine statistics
 */
export async function GET(request: NextRequest) {
  try {
    // In production, these would come from the actual Phase 6 services
    // For now, return demo data that matches the expected interface

    const stats: Phase6Stats = {
      contextStats: {
        deployments: 3,
        organizations: 12,
        agents: 47,
        activeOperations: 23,
      },
      ceilingStats: {
        totalEvents: 1842,
        totalAuditEntries: 1842,
        complianceBreakdown: {
          compliant: 1756,
          warning: 72,
          violation: 14,
        },
        agentsWithAlerts: 5,
      },
      roleGateStats: {
        totalEvaluations: 3291,
        byDecision: {
          ALLOW: 3104,
          DENY: 142,
          ESCALATE: 45,
        },
      },
      presetStats: {
        aciPresets: 3,
        vorionPresets: 3,
        axiomPresets: 8,
        verifiedLineages: 6,
      },
      provenanceStats: {
        totalRecords: 47,
        byCreationType: {
          FRESH: 28,
          CLONED: 8,
          EVOLVED: 6,
          PROMOTED: 3,
          IMPORTED: 2,
        },
      },
    }

    const tierDistribution: TrustTierData[] = [
      { tier: 'T0', label: 'Sandbox', range: '0-99', count: 2, color: 'from-gray-400 to-gray-500' },
      { tier: 'T1', label: 'Probation', range: '100-299', count: 5, color: 'from-red-400 to-red-500' },
      { tier: 'T2', label: 'Limited', range: '300-499', count: 8, color: 'from-orange-400 to-orange-500' },
      { tier: 'T3', label: 'Standard', range: '500-699', count: 18, color: 'from-yellow-400 to-yellow-500' },
      { tier: 'T4', label: 'Trusted', range: '700-899', count: 12, color: 'from-green-400 to-green-500' },
      { tier: 'T5', label: 'Sovereign', range: '900-1000', count: 2, color: 'from-blue-400 to-indigo-500' },
    ]

    const recentEvents: RecentEvent[] = [
      { id: '1', type: 'ceiling', agentId: 'agent-042', status: 'compliant', timestamp: new Date().toISOString() },
      { id: '2', type: 'role_gate', agentId: 'agent-017', decision: 'ALLOW', status: 'compliant', timestamp: new Date(Date.now() - 60000).toISOString() },
      { id: '3', type: 'ceiling', agentId: 'agent-089', status: 'warning', timestamp: new Date(Date.now() - 120000).toISOString() },
      { id: '4', type: 'provenance', agentId: 'agent-023', status: 'compliant', timestamp: new Date(Date.now() - 180000).toISOString() },
      { id: '5', type: 'context', agentId: 'agent-056', status: 'compliant', timestamp: new Date(Date.now() - 240000).toISOString() },
      { id: '6', type: 'role_gate', agentId: 'agent-011', decision: 'DENY', status: 'violation', timestamp: new Date(Date.now() - 300000).toISOString() },
      { id: '7', type: 'ceiling', agentId: 'agent-078', status: 'compliant', timestamp: new Date(Date.now() - 360000).toISOString() },
      { id: '8', type: 'provenance', agentId: 'agent-034', status: 'compliant', timestamp: new Date(Date.now() - 420000).toISOString() },
    ]

    return NextResponse.json({
      stats,
      tierDistribution,
      recentEvents,
      version: {
        major: 1,
        minor: 0,
        patch: 0,
        label: 'phase6-trust-engine',
        decisions: ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'],
      },
    })
  } catch (error) {
    console.error('[Phase6 Stats API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Phase 6 statistics', details: (error as Error).message },
      { status: 500 }
    )
  }
}
