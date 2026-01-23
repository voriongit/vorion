import { NextRequest, NextResponse } from 'next/server'
import {
  getTrustEngine,
  recordAgentSignal,
  getAgentTrustScore,
  initializeAgentTrust,
  hasAcceleratedDecay,
  hasAcceleratedRecovery,
  getTrustLevelName,
  AGENT_SIGNAL_TYPES,
} from '@/lib/trust/trust-engine-service'
import type { TrustLevel } from '@vorionsys/atsf-core/types'

/**
 * Trust record response type for API serialization
 * Mirrors TrustRecord from atsf-core with safe access to all fields
 */
type TrustRecordResponse = {
  entityId: string
  score: number
  level: TrustLevel
  components: {
    behavioral: number
    compliance: number
    identity: number
    context: number
  }
  signals: unknown[]
  lastCalculatedAt: string
  history?: Array<{ score: number; level: number; reason: string; timestamp: string }>
  recentFailures?: string[]
  recentSuccesses?: string[]
  peakScore?: number
  consecutiveSuccesses?: number
}

/**
 * GET /api/trust-engine
 * Get trust score for an agent or list all agents
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')

    if (agentId) {
      // Get specific agent's trust score
      const record = await getAgentTrustScore(agentId) as TrustRecordResponse | undefined

      if (!record) {
        return NextResponse.json(
          { error: 'Agent not found in trust engine' },
          { status: 404 }
        )
      }

      const acceleratedDecay = await hasAcceleratedDecay(agentId)
      const acceleratedRecovery = await hasAcceleratedRecovery(agentId)

      return NextResponse.json({
        agentId: record.entityId,
        score: record.score,
        level: record.level,
        levelName: getTrustLevelName(record.level),
        components: record.components,
        lastCalculatedAt: record.lastCalculatedAt,
        peakScore: record.peakScore ?? record.score,
        consecutiveSuccesses: record.consecutiveSuccesses ?? 0,
        acceleratedDecayActive: acceleratedDecay,
        acceleratedRecoveryActive: acceleratedRecovery,
        recentFailures: record.recentFailures?.length ?? 0,
        recentSuccesses: record.recentSuccesses?.length ?? 0,
        history: record.history?.slice(-10) ?? [], // Last 10 history entries
      })
    }

    // List all agents
    const engine = await getTrustEngine()
    const entityIds = engine.getEntityIds()

    const agents = await Promise.all(
      entityIds.map(async (id) => {
        const record = await engine.getScore(id)
        if (!record) return null

        return {
          agentId: record.entityId,
          score: record.score,
          level: record.level,
          levelName: getTrustLevelName(record.level),
          lastCalculatedAt: record.lastCalculatedAt,
        }
      })
    )

    return NextResponse.json({
      agents: agents.filter(Boolean),
      count: agents.filter(Boolean).length,
      signalTypes: AGENT_SIGNAL_TYPES,
    })
  } catch (error) {
    console.error('[TrustEngine API] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to get trust data', details: (error as Error).message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/trust-engine
 * Record a signal or initialize trust
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, agentId, signalType, value, metadata, initialLevel } = body

    if (!agentId) {
      return NextResponse.json(
        { error: 'agentId is required' },
        { status: 400 }
      )
    }

    switch (action) {
      case 'initialize': {
        const record = await initializeAgentTrust(agentId, initialLevel ?? 1)
        return NextResponse.json({
          success: true,
          action: 'initialized',
          agentId: record.entityId,
          score: record.score,
          level: record.level,
          levelName: getTrustLevelName(record.level),
        })
      }

      case 'signal': {
        if (!signalType || value === undefined) {
          return NextResponse.json(
            { error: 'signalType and value are required for signal action' },
            { status: 400 }
          )
        }

        await recordAgentSignal(agentId, signalType, value, metadata || {})

        // Get updated score
        const record = await getAgentTrustScore(agentId) as TrustRecordResponse | undefined

        return NextResponse.json({
          success: true,
          action: 'signal_recorded',
          agentId,
          signalType,
          value,
          newScore: record?.score,
          newLevel: record?.level,
          levelName: record ? getTrustLevelName(record.level) : undefined,
          consecutiveSuccesses: record?.consecutiveSuccesses ?? 0,
        })
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use "initialize" or "signal"' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('[TrustEngine API] POST error:', error)
    return NextResponse.json(
      { error: 'Failed to process trust action', details: (error as Error).message },
      { status: 500 }
    )
  }
}
