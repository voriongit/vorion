import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import {
  submitUpchainRequest,
  getPendingRequests,
  getDecisionHistory,
  assessRisk,
  getRequiredApproval,
} from '@/lib/council'

export const dynamic = 'force-dynamic'

const upchainSchema = z.object({
  agentId: z.string().uuid(),
  actionType: z.string().min(1),
  actionDetails: z.string().min(1),
  context: z.record(z.any()).optional().default({}),
  justification: z.string().min(1),
  riskFactors: z.object({
    affectsMultipleUsers: z.boolean().optional(),
    involvesPersonalData: z.boolean().optional(),
    hasFinancialImpact: z.boolean().optional(),
    isIrreversible: z.boolean().optional(),
    involvesExternalSystem: z.boolean().optional(),
    modifiesPermissions: z.boolean().optional(),
  }).optional(),
})

// POST /api/council/upchain - Submit an action for upchain approval
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validation = upchainSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { agentId, actionType, actionDetails, context, justification, riskFactors } = validation.data

    // Get agent and verify ownership
    const { data: agent, error: agentError } = await supabase
      .from('bots')
      .select('id, name, trust_score, trust_tier, user_id, status')
      .eq('id', agentId)
      .single()

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // For now, only agent owner can submit upchain requests
    // In production, this would also allow the agent itself via API key
    if (agent.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Submit upchain request
    const result = await submitUpchainRequest(
      {
        agentId,
        actionType,
        actionDetails,
        context: {
          ...context,
          agentName: agent.name,
          agentStatus: agent.status,
        },
        justification,
        riskFactors,
      },
      agent.trust_tier || 'untrusted'
    )

    // Store decision record
    if (result.decision || result.status === 'auto_approved') {
      await supabase
        .from('bot_decisions')
        .insert({
          bot_id: agentId,
          decision_type: result.canProceed ? 'execute' : 'escalate',
          action_taken: actionType,
          context_data: {
            actionDetails,
            context,
            justification,
            upchainResult: result,
          },
          reasoning: result.message,
          confidence_score: result.decision?.votes?.length
            ? result.decision.votes.reduce((sum, v) => sum + v.confidence, 0) / result.decision.votes.length
            : 1.0,
          risk_level: ['low', 'low', 'medium', 'high', 'critical'][result.riskLevel],
          user_response: result.status === 'auto_approved' ? 'approved' : null,
        })
    }

    return NextResponse.json({
      result: {
        requestId: result.requestId,
        status: result.status,
        canProceed: result.canProceed,
        message: result.message,
        requiresHuman: result.requiresHuman,
      },
      risk: {
        level: result.riskLevel,
        reasoning: result.riskReasoning,
        approval: getRequiredApproval(result.riskLevel),
      },
      decision: result.decision ? {
        outcome: result.decision.outcome,
        reasoning: result.decision.finalReasoning,
        votes: result.decision.votes?.map(v => ({
          validator: v.validatorId,
          decision: v.decision,
          reasoning: v.reasoning,
          confidence: v.confidence,
        })),
      } : null,
    })
  } catch (error) {
    console.error('Upchain error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/council/upchain - Get pending/recent upchain decisions
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')
    const status = searchParams.get('status') // 'pending' | 'all'

    if (!agentId) {
      return NextResponse.json({ error: 'agentId required' }, { status: 400 })
    }

    // Verify agent ownership
    const { data: agent, error: agentError } = await supabase
      .from('bots')
      .select('id, name, user_id')
      .eq('id', agentId)
      .eq('user_id', user.id)
      .single()

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // Get decisions
    const decisions = status === 'pending'
      ? await getPendingRequests(agentId)
      : await getDecisionHistory(agentId)

    return NextResponse.json({
      agent: { id: agent.id, name: agent.name },
      decisions,
      total: decisions.length,
    })
  } catch (error) {
    console.error('Get upchain error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
