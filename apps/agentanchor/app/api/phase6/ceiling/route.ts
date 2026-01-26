/**
 * Phase 6 Ceiling Enforcement API (Q1)
 *
 * Manages dual-layer ceiling enforcement:
 * - Regulatory ceiling (jurisdiction-based)
 * - Organizational ceiling (policy-based)
 * - Gaming detection thresholds
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPhase6Service, ComplianceStatus } from '@/lib/services/phase6-service'

// Regulatory ceilings by framework
const REGULATORY_CEILINGS: Record<string, { maxScore: number; article?: string }> = {
  EU_AI_ACT: { maxScore: 699, article: 'Article 6' },
  NIST_AI_RMF: { maxScore: 899 },
  ISO_42001: { maxScore: 799 },
  DEFAULT: { maxScore: 1000 },
}

// Gaming detection thresholds
const GAMING_THRESHOLDS = {
  rapidChange: {
    maxDelta: 100,
    windowSeconds: 60,
    description: 'Score change within time window',
  },
  oscillation: {
    maxReversals: 3,
    windowMinutes: 5,
    description: 'Score direction reversals',
  },
  boundaryTesting: {
    maxNearCeilingHits: 5,
    windowMinutes: 10,
    nearCeilingMargin: 10,
    description: 'Requests near ceiling boundary',
  },
}

/**
 * GET /api/phase6/ceiling
 * Get ceiling events and configuration
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const includeConfig = searchParams.get('includeConfig') === 'true'

    const service = getPhase6Service()
    const events = await service.getCeilingEvents(agentId || undefined, limit)

    // Summarize by compliance status
    const summary = {
      total: events.length,
      byStatus: {
        COMPLIANT: events.filter(e => e.complianceStatus === 'COMPLIANT').length,
        WARNING: events.filter(e => e.complianceStatus === 'WARNING').length,
        VIOLATION: events.filter(e => e.complianceStatus === 'VIOLATION').length,
      },
      ceilingAppliedCount: events.filter(e => e.ceilingApplied).length,
      auditRequiredCount: events.filter(e => e.auditRequired).length,
    }

    const response: Record<string, unknown> = { events, summary }

    if (includeConfig) {
      response.config = {
        regulatoryCeilings: REGULATORY_CEILINGS,
        gamingThresholds: GAMING_THRESHOLDS,
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[Phase6 Ceiling API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch ceiling events', details: (error as Error).message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/phase6/ceiling/check
 * Check a proposed score against ceilings
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      agentId,
      previousScore,
      proposedScore,
      complianceFramework,
      organizationalCeiling,
    } = body

    // Validate required fields
    if (!agentId || proposedScore === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: agentId, proposedScore' },
        { status: 400 }
      )
    }

    // Determine effective ceiling
    const regulatoryCeiling = complianceFramework
      ? REGULATORY_CEILINGS[complianceFramework]?.maxScore ?? 1000
      : 1000

    const orgCeiling = organizationalCeiling ?? 1000
    const effectiveCeiling = Math.min(regulatoryCeiling, orgCeiling)

    // Apply ceiling
    const finalScore = Math.min(proposedScore, effectiveCeiling)
    const ceilingApplied = finalScore < proposedScore

    // Determine compliance status
    let complianceStatus: ComplianceStatus = 'COMPLIANT'
    if (ceilingApplied) {
      complianceStatus = 'WARNING'
    }
    if (proposedScore > effectiveCeiling + 50) {
      complianceStatus = 'VIOLATION'
    }

    // Check for gaming patterns (simplified)
    const gamingIndicators: string[] = []

    if (previousScore !== undefined) {
      const delta = Math.abs(proposedScore - previousScore)
      if (delta > GAMING_THRESHOLDS.rapidChange.maxDelta) {
        gamingIndicators.push('RAPID_CHANGE')
      }
    }

    // Determine audit requirement
    const auditRequired =
      complianceStatus === 'VIOLATION' ||
      gamingIndicators.length > 0 ||
      (complianceFramework && ['EU_AI_ACT', 'NIST_AI_RMF'].includes(complianceFramework))

    // Determine retention days
    let retentionDays: number | undefined
    if (complianceFramework === 'EU_AI_ACT') {
      retentionDays = 2555 // 7 years
    } else if (complianceFramework === 'NIST_AI_RMF') {
      retentionDays = 1825 // 5 years
    }

    return NextResponse.json({
      result: {
        agentId,
        previousScore,
        proposedScore,
        finalScore,
        effectiveCeiling,
        ceilingSource: regulatoryCeiling < orgCeiling ? 'regulatory' : 'organizational',
        ceilingApplied,
        complianceStatus,
        complianceFramework,
        auditRequired,
        retentionDays,
        gamingIndicators,
      },
      ceilingDetails: {
        regulatory: {
          framework: complianceFramework || 'DEFAULT',
          ceiling: regulatoryCeiling,
          article: complianceFramework ? REGULATORY_CEILINGS[complianceFramework]?.article : undefined,
        },
        organizational: {
          ceiling: orgCeiling,
        },
        effective: effectiveCeiling,
      },
    })
  } catch (error) {
    console.error('[Phase6 Ceiling API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to check ceiling', details: (error as Error).message },
      { status: 500 }
    )
  }
}
