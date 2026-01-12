/**
 * Decisions API
 * A3I-OS v2.0 - Phase 1
 *
 * GET /api/v1/agents/[id]/decisions
 * Get decision history for an agent
 *
 * POST /api/v1/agents/[id]/decisions
 * Log a new decision
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateApiKey, checkRateLimit, logApiUsage } from '@/lib/api'
import {
  a3iDecisionLogger,
  createDecisionLog,
  type DecisionType,
  type HierarchyLevel,
} from '@/lib/agents/a3i-os'

interface LogDecisionRequestBody {
  sessionId: string
  decisionType: DecisionType
  inputsConsidered?: string[]
  alternativesEvaluated?: Array<{ option: string; rejectedReason: string }>
  rationale: string
  confidenceScore?: number
  uncertaintyFactors?: string[]
  humanOverrideAvailable?: boolean
  metadata?: Record<string, unknown>
}

/**
 * GET /api/v1/agents/[id]/decisions
 * Get decision history for an agent
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const startTime = Date.now()
  const agentId = params.id

  // Check API key auth
  const authHeader = request.headers.get('authorization')
  let userId: string | null = null
  let keyId: string | null = null

  if (authHeader?.startsWith('Bearer ')) {
    const key = authHeader.slice(7)
    const validation = await validateApiKey(key)

    if (!validation) {
      return NextResponse.json(
        { error: { message: 'Invalid API key', code: 'unauthorized' } },
        { status: 401 }
      )
    }

    userId = validation.userId
    keyId = validation.keyId
  }

  // Check rate limit
  if (userId && keyId) {
    const rateLimit = await checkRateLimit(keyId, userId)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: { message: 'Rate limit exceeded', code: 'rate_limited' } },
        { status: 429 }
      )
    }
  }

  const supabase = createClient()

  try {
    // Parse query params
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const sessionId = searchParams.get('session_id')
    const decisionType = searchParams.get('decision_type') as DecisionType | null
    const outcome = searchParams.get('outcome')
    const verifyChain = searchParams.get('verify_chain') === 'true'

    let query = supabase
      .from('agent_decisions')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (sessionId) {
      query = query.eq('session_id', sessionId)
    }

    if (decisionType) {
      query = query.eq('decision_type', decisionType)
    }

    if (outcome) {
      query = query.eq('outcome', outcome)
    }

    const { data: decisions, error } = await query

    if (error) {
      const responseTime = Date.now() - startTime
      if (userId) {
        await logApiUsage(keyId, userId, `/api/v1/agents/${agentId}/decisions`, 'GET', 500, responseTime)
      }

      return NextResponse.json(
        { error: { message: error.message, code: 'internal_error' } },
        { status: 500 }
      )
    }

    // Optionally verify chain integrity
    let chainVerification = null
    if (verifyChain) {
      chainVerification = await a3iDecisionLogger.verifyChainIntegrity(agentId)
    }

    // Calculate stats
    const stats = await a3iDecisionLogger.getDecisionStats(agentId)

    const responseTime = Date.now() - startTime
    if (userId) {
      await logApiUsage(keyId, userId, `/api/v1/agents/${agentId}/decisions`, 'GET', 200, responseTime)
    }

    return NextResponse.json({
      data: {
        decisions: decisions || [],
        stats,
        chainVerification,
      },
    })
  } catch (err: unknown) {
    const responseTime = Date.now() - startTime
    if (userId) {
      await logApiUsage(keyId, userId, `/api/v1/agents/${agentId}/decisions`, 'GET', 500, responseTime)
    }

    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: { message, code: 'internal_error' } },
      { status: 500 }
    )
  }
}

/**
 * POST /api/v1/agents/[id]/decisions
 * Log a new decision
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const startTime = Date.now()
  const agentId = params.id

  // Check API key auth
  const authHeader = request.headers.get('authorization')
  let userId: string | null = null
  let keyId: string | null = null

  if (authHeader?.startsWith('Bearer ')) {
    const key = authHeader.slice(7)
    const validation = await validateApiKey(key)

    if (!validation) {
      return NextResponse.json(
        { error: { message: 'Invalid API key', code: 'unauthorized' } },
        { status: 401 }
      )
    }

    userId = validation.userId
    keyId = validation.keyId
  } else {
    return NextResponse.json(
      { error: { message: 'Authorization required', code: 'unauthorized' } },
      { status: 401 }
    )
  }

  // Check rate limit
  if (keyId) {
    const rateLimit = await checkRateLimit(keyId, userId)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: { message: 'Rate limit exceeded', code: 'rate_limited' } },
        { status: 429 }
      )
    }
  }

  try {
    const body: LogDecisionRequestBody = await request.json()

    // Validate required fields
    if (!body.sessionId || !body.decisionType || !body.rationale) {
      return NextResponse.json(
        {
          error: {
            message: 'Missing required fields: sessionId, decisionType, rationale',
            code: 'bad_request'
          }
        },
        { status: 400 }
      )
    }

    // Validate decision type
    const validTypes: DecisionType[] = ['action', 'recommendation', 'escalation', 'handoff', 'refusal']
    if (!validTypes.includes(body.decisionType)) {
      return NextResponse.json(
        {
          error: {
            message: `Invalid decisionType. Must be one of: ${validTypes.join(', ')}`,
            code: 'bad_request'
          }
        },
        { status: 400 }
      )
    }

    // Get agent details
    const supabase = createClient()
    const { data: agent, error: agentError } = await supabase
      .from('bots')
      .select('id, name, hierarchy_level')
      .eq('id', agentId)
      .single()

    if (agentError || !agent) {
      const responseTime = Date.now() - startTime
      await logApiUsage(keyId, userId, `/api/v1/agents/${agentId}/decisions`, 'POST', 404, responseTime)

      return NextResponse.json(
        { error: { message: 'Agent not found', code: 'not_found' } },
        { status: 404 }
      )
    }

    const agentLevel = (agent.hierarchy_level || 'L1') as HierarchyLevel

    // Create decision log
    const decisionInput = createDecisionLog(
      agentId,
      agentLevel,
      body.sessionId,
      body.decisionType,
      {
        inputsConsidered: body.inputsConsidered,
        alternativesEvaluated: body.alternativesEvaluated,
        rationale: body.rationale,
        confidenceScore: body.confidenceScore,
        uncertaintyFactors: body.uncertaintyFactors,
        humanOverrideAvailable: body.humanOverrideAvailable,
        metadata: body.metadata,
      }
    )

    // Log the decision (includes hash chain)
    const decision = await a3iDecisionLogger.logDecision(decisionInput)

    // Also store in database for persistence
    await supabase.from('agent_decisions').insert({
      id: decision.id,
      agent_id: decision.agentId,
      agent_level: decision.agentLevel,
      session_id: decision.sessionId,
      decision_type: decision.decisionType,
      inputs_considered: decision.inputsConsidered,
      alternatives_evaluated: decision.alternativesEvaluated,
      rationale: decision.rationale,
      confidence_score: decision.confidenceScore,
      uncertainty_factors: decision.uncertaintyFactors,
      human_override_available: decision.humanOverrideAvailable,
      outcome: decision.outcome,
      previous_hash: decision.previousHash,
      current_hash: decision.currentHash,
      metadata: decision.metadata,
    })

    const responseTime = Date.now() - startTime
    await logApiUsage(keyId, userId, `/api/v1/agents/${agentId}/decisions`, 'POST', 201, responseTime)

    return NextResponse.json(
      {
        data: {
          decision: {
            id: decision.id,
            timestamp: decision.timestamp,
            decisionType: decision.decisionType,
            rationale: decision.rationale,
            confidenceScore: decision.confidenceScore,
            outcome: decision.outcome,
            currentHash: decision.currentHash,
          },
        },
      },
      { status: 201 }
    )
  } catch (err: unknown) {
    const responseTime = Date.now() - startTime
    await logApiUsage(keyId, userId, `/api/v1/agents/${agentId}/decisions`, 'POST', 500, responseTime)

    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: { message, code: 'internal_error' } },
      { status: 500 }
    )
  }
}
