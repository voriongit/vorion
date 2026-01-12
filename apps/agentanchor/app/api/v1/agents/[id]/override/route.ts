/**
 * Human Override API
 * A3I-OS v2.0 - Phase 1
 *
 * POST /api/v1/agents/[id]/override
 * Process a human override command for an agent
 *
 * GET /api/v1/agents/[id]/override
 * Get override history for an agent
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateApiKey, checkRateLimit, logApiUsage } from '@/lib/api'
import {
  processOverride,
  type OverrideCommand,
} from '@/lib/agents/human-override'

interface OverrideRequestBody {
  command: OverrideCommand
  originalRecommendation: string
  overrideDirection: string
  sessionId: string
  safetyNotes?: string[]
  rationale?: string
}

/**
 * POST /api/v1/agents/[id]/override
 * Process a human override command
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
    const body: OverrideRequestBody = await request.json()

    // Validate required fields
    if (!body.command || !body.originalRecommendation || !body.overrideDirection || !body.sessionId) {
      return NextResponse.json(
        {
          error: {
            message: 'Missing required fields: command, originalRecommendation, overrideDirection, sessionId',
            code: 'bad_request'
          }
        },
        { status: 400 }
      )
    }

    // Validate command type
    const validCommands: OverrideCommand[] = ['PAUSE', 'STOP', 'REDIRECT', 'EXPLAIN', 'VETO', 'ESCALATE', 'ROLLBACK']
    if (!validCommands.includes(body.command)) {
      return NextResponse.json(
        {
          error: {
            message: `Invalid command. Must be one of: ${validCommands.join(', ')}`,
            code: 'bad_request'
          }
        },
        { status: 400 }
      )
    }

    // Verify agent exists
    const supabase = createClient()
    const { data: agent, error: agentError } = await supabase
      .from('bots')
      .select('id, name, creator_id')
      .eq('id', agentId)
      .single()

    if (agentError || !agent) {
      const responseTime = Date.now() - startTime
      await logApiUsage(keyId, userId, `/api/v1/agents/${agentId}/override`, 'POST', 404, responseTime)

      return NextResponse.json(
        { error: { message: 'Agent not found', code: 'not_found' } },
        { status: 404 }
      )
    }

    // Process the override
    const result = await processOverride(
      agentId,
      body.sessionId,
      userId,
      body.command,
      body.originalRecommendation,
      body.overrideDirection,
      {
        safetyNotes: body.safetyNotes,
        metadata: {
          rationale: body.rationale,
          agentName: agent.name,
        },
        onLog: async (event) => {
          // Store override event in database
          await supabase.from('agent_overrides').insert({
            id: event.id,
            agent_id: event.agentId,
            session_id: event.sessionId,
            user_id: event.userId,
            command: event.command,
            original_recommendation: event.originalRecommendation,
            override_direction: event.overrideDirection,
            agent_acknowledgment: event.agentAcknowledgment,
            action_taken: event.actionTaken,
            failure_reason: event.failureReason,
            metadata: event.metadata,
          })
        },
      }
    )

    const responseTime = Date.now() - startTime
    await logApiUsage(keyId, userId, `/api/v1/agents/${agentId}/override`, 'POST', result.success ? 200 : 500, responseTime)

    if (!result.success) {
      return NextResponse.json(
        {
          error: {
            message: result.error || 'Override processing failed',
            code: 'internal_error'
          }
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: {
        success: true,
        acknowledgment: result.acknowledgment,
        event: {
          id: result.event.id,
          timestamp: result.event.timestamp,
          command: result.event.command,
          actionTaken: result.event.actionTaken,
        },
      },
    })
  } catch (err: unknown) {
    const responseTime = Date.now() - startTime
    await logApiUsage(keyId, userId, `/api/v1/agents/${agentId}/override`, 'POST', 500, responseTime)

    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: { message, code: 'internal_error' } },
      { status: 500 }
    )
  }
}

/**
 * GET /api/v1/agents/[id]/override
 * Get override history for an agent
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
    const command = searchParams.get('command')

    let query = supabase
      .from('agent_overrides')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (sessionId) {
      query = query.eq('session_id', sessionId)
    }

    if (command) {
      query = query.eq('command', command)
    }

    const { data: overrides, error } = await query

    const responseTime = Date.now() - startTime
    if (userId) {
      await logApiUsage(keyId, userId, `/api/v1/agents/${agentId}/override`, 'GET', error ? 500 : 200, responseTime)
    }

    if (error) {
      return NextResponse.json(
        { error: { message: error.message, code: 'internal_error' } },
        { status: 500 }
      )
    }

    // Calculate summary stats
    const stats = {
      total: overrides?.length || 0,
      byCommand: {} as Record<string, number>,
      complianceRate: 0,
    }

    if (overrides && overrides.length > 0) {
      let complied = 0
      for (const o of overrides) {
        stats.byCommand[o.command] = (stats.byCommand[o.command] || 0) + 1
        if (o.action_taken === 'complied') complied++
      }
      stats.complianceRate = complied / overrides.length
    }

    return NextResponse.json({
      data: {
        overrides: overrides || [],
        stats,
      },
    })
  } catch (err: unknown) {
    const responseTime = Date.now() - startTime
    if (userId) {
      await logApiUsage(keyId, userId, `/api/v1/agents/${agentId}/override`, 'GET', 500, responseTime)
    }

    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: { message, code: 'internal_error' } },
      { status: 500 }
    )
  }
}
