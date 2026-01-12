/**
 * Action Validation API
 * A3I-OS v2.0 - Phase 1
 *
 * POST /api/v1/agents/[id]/validate-action
 * Pre-validate an action before execution
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateApiKey, checkRateLimit, logApiUsage } from '@/lib/api'
import {
  validateAction,
  createProposedAction,
  createActionContext,
  getCapabilitySummary,
  type HierarchyLevel,
} from '@/lib/agents/capability-boundaries'

interface ValidateActionRequestBody {
  action: {
    type: string
    description: string
    targetSystem?: string
    targetResource?: string
    isDestructive?: boolean
    isIrreversible?: boolean
    isProduction?: boolean
    sendsExternal?: boolean
    targetsSelf?: boolean
    grantsPermissions?: boolean
    modifiesOtherAgent?: boolean
    handlesSecrets?: boolean
    secretHandling?: 'ephemeral' | 'persistent'
    confidence?: number
    ethicalFlags?: string[]
    estimatedCost?: number
    estimatedTime?: number
    metadata?: Record<string, unknown>
  }
  context: {
    sessionId: string
    authorizedSystems?: string[]
    authorizedScope?: string[]
    authorizedDestinations?: string[]
    hasHumanApproval?: boolean
  }
}

/**
 * POST /api/v1/agents/[id]/validate-action
 * Validate a proposed action against capability boundaries
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
    const body: ValidateActionRequestBody = await request.json()

    // Validate required fields
    if (!body.action || !body.action.type || !body.action.description || !body.context?.sessionId) {
      return NextResponse.json(
        {
          error: {
            message: 'Missing required fields: action.type, action.description, context.sessionId',
            code: 'bad_request'
          }
        },
        { status: 400 }
      )
    }

    // Get agent details including hierarchy level
    const supabase = createClient()
    const { data: agent, error: agentError } = await supabase
      .from('bots')
      .select('id, name, creator_id, hierarchy_level, trust_score, status')
      .eq('id', agentId)
      .single()

    if (agentError || !agent) {
      const responseTime = Date.now() - startTime
      await logApiUsage(keyId, userId, `/api/v1/agents/${agentId}/validate-action`, 'POST', 404, responseTime)

      return NextResponse.json(
        { error: { message: 'Agent not found', code: 'not_found' } },
        { status: 404 }
      )
    }

    // Determine agent level (default to L1 if not set)
    const agentLevel = (agent.hierarchy_level || 'L1') as HierarchyLevel

    // Create proposed action
    const proposedAction = createProposedAction(
      body.action.type,
      body.action.description,
      {
        targetSystem: body.action.targetSystem,
        targetResource: body.action.targetResource,
        isDestructive: body.action.isDestructive ?? false,
        isIrreversible: body.action.isIrreversible ?? false,
        isProduction: body.action.isProduction ?? false,
        sendsExternal: body.action.sendsExternal ?? false,
        targetsSelf: body.action.targetsSelf ?? false,
        grantsPermissions: body.action.grantsPermissions ?? false,
        modifiesOtherAgent: body.action.modifiesOtherAgent ?? false,
        handlesSecrets: body.action.handlesSecrets ?? false,
        secretHandling: body.action.secretHandling,
        confidence: body.action.confidence ?? 1.0,
        ethicalFlags: body.action.ethicalFlags ?? [],
        estimatedCost: body.action.estimatedCost,
        estimatedTime: body.action.estimatedTime,
        metadata: body.action.metadata ?? {},
      }
    )

    // Create action context
    const actionContext = createActionContext(
      agentId,
      agentLevel,
      body.context.sessionId,
      userId,
      {
        authorizedSystems: body.context.authorizedSystems ?? [],
        authorizedScope: body.context.authorizedScope ?? [],
        authorizedDestinations: body.context.authorizedDestinations ?? [],
        hasHumanApproval: body.context.hasHumanApproval ?? false,
        hasActiveVeto: false,
        securityAlerts: 0,
      }
    )

    // Validate the action
    const result = validateAction(proposedAction, actionContext)

    // Log the validation event
    await supabase.from('agent_capability_validations').insert({
      agent_id: agentId,
      session_id: body.context.sessionId,
      user_id: userId,
      action_type: body.action.type,
      action_description: body.action.description,
      allowed: result.allowed,
      hard_limit_violations: result.hardLimitViolations,
      soft_limit_triggers: result.softLimitTriggers,
      confirmation_required: result.confirmationRequired,
      denial_reason: result.denialReason,
      escalate_to: result.escalateTo,
      metadata: {
        agentLevel,
        actionDetails: body.action,
        contextDetails: body.context,
      },
    })

    const responseTime = Date.now() - startTime
    await logApiUsage(keyId, userId, `/api/v1/agents/${agentId}/validate-action`, 'POST', 200, responseTime)

    return NextResponse.json({
      data: {
        allowed: result.allowed,
        hardLimitViolations: result.hardLimitViolations,
        softLimitTriggers: result.softLimitTriggers,
        confirmationRequired: result.confirmationRequired,
        confirmationPrompt: result.confirmationPrompt,
        denialReason: result.denialReason,
        escalateTo: result.escalateTo,
        agent: {
          id: agent.id,
          name: agent.name,
          level: agentLevel,
          trustScore: agent.trust_score,
          status: agent.status,
        },
        action: {
          id: proposedAction.id,
          type: proposedAction.type,
          description: proposedAction.description,
        },
      },
    })
  } catch (err: unknown) {
    const responseTime = Date.now() - startTime
    await logApiUsage(keyId, userId, `/api/v1/agents/${agentId}/validate-action`, 'POST', 500, responseTime)

    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: { message, code: 'internal_error' } },
      { status: 500 }
    )
  }
}
