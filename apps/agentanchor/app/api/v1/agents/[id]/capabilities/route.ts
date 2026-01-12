/**
 * Capabilities API
 * A3I-OS v2.0 - Phase 1
 *
 * GET /api/v1/agents/[id]/capabilities
 * Get capability matrix and limits for an agent
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateApiKey, checkRateLimit, logApiUsage } from '@/lib/api'
import {
  CAPABILITY_MATRIX,
  HARD_LIMITS,
  SOFT_LIMITS,
  getCapabilitySummary,
  getHardLimitsSummary,
  type HierarchyLevel,
} from '@/lib/agents/capability-boundaries'

/**
 * GET /api/v1/agents/[id]/capabilities
 * Get capability matrix and limits for an agent
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
    // Get agent details
    const { data: agent, error: agentError } = await supabase
      .from('bots')
      .select('id, name, hierarchy_level, trust_score, trust_tier, status')
      .eq('id', agentId)
      .single()

    if (agentError || !agent) {
      const responseTime = Date.now() - startTime
      if (userId) {
        await logApiUsage(keyId, userId, `/api/v1/agents/${agentId}/capabilities`, 'GET', 404, responseTime)
      }

      return NextResponse.json(
        { error: { message: 'Agent not found', code: 'not_found' } },
        { status: 404 }
      )
    }

    const agentLevel = (agent.hierarchy_level || 'L1') as HierarchyLevel
    const capabilities = CAPABILITY_MATRIX[agentLevel]

    // Format hard limits
    const hardLimits = Object.entries(HARD_LIMITS).map(([key, limit]) => ({
      id: key,
      rule: limit.rule,
      violationResponse: limit.violationResponse,
    }))

    // Format soft limits
    const softLimits = Object.entries(SOFT_LIMITS).map(([key, limit]) => ({
      id: key,
      response: limit.response,
      message: limit.message,
    }))

    const responseTime = Date.now() - startTime
    if (userId) {
      await logApiUsage(keyId, userId, `/api/v1/agents/${agentId}/capabilities`, 'GET', 200, responseTime)
    }

    return NextResponse.json({
      data: {
        agent: {
          id: agent.id,
          name: agent.name,
          level: agentLevel,
          trustScore: agent.trust_score,
          trustTier: agent.trust_tier,
          status: agent.status,
        },
        capabilities: {
          can: capabilities.can,
          cannot: capabilities.cannot,
          confirmationRequired: capabilities.confirmationRequired,
        },
        limits: {
          hard: hardLimits,
          soft: softLimits,
        },
        summary: getCapabilitySummary(agentLevel),
        hardLimitsSummary: getHardLimitsSummary(),
        allLevels: Object.keys(CAPABILITY_MATRIX),
      },
    })
  } catch (err: unknown) {
    const responseTime = Date.now() - startTime
    if (userId) {
      await logApiUsage(keyId, userId, `/api/v1/agents/${agentId}/capabilities`, 'GET', 500, responseTime)
    }

    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: { message, code: 'internal_error' } },
      { status: 500 }
    )
  }
}
