import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { evaluateRequest, RiskLevel, UpchainRequest } from '@/lib/council'
import { applyTrustChange, calculateCouncilDecisionImpact } from '@/lib/agents/trust-service'
import { getAutonomyLimits, recordActivity } from '@/lib/agents/decay-service'
import { TrustTier } from '@/lib/agents/types'
import { logEvent } from '@/lib/observer'
import { recordCouncilDecision } from '@/lib/truth-chain'

export const dynamic = 'force-dynamic'

const evaluateSchema = z.object({
  agentId: z.string().uuid(),
  actionType: z.string().min(1),
  actionDetails: z.string().min(1),
  context: z.record(z.any()).optional().default({}),
  justification: z.string().min(1),
  riskLevel: z.number().min(0).max(4),
})

// POST /api/council/evaluate - Submit an action for Council evaluation
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
    const validation = evaluateSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { agentId, actionType, actionDetails, context, justification, riskLevel } = validation.data

    // Verify agent belongs to user or user has permission
    const { data: agent, error: agentError } = await supabase
      .from('bots')
      .select('id, name, trust_score, trust_tier, user_id, is_on_probation')
      .eq('id', agentId)
      .single()

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // For now, only agent owner can request evaluation
    if (agent.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Check autonomy limits (FR54, FR57) - Story 4-4
    const autonomyLimits = getAutonomyLimits(
      (agent.trust_tier as TrustTier) || 'untrusted',
      agent.is_on_probation || false
    )

    // If action risk exceeds agent's autonomy, require human approval
    const exceedsAutonomy = riskLevel > autonomyLimits.maxRiskLevel
    const forceHumanApproval = autonomyLimits.requiresHumanApproval || agent.is_on_probation

    // Record activity to reset decay timer
    await recordActivity(agentId)

    // Build upchain request
    const upchainRequest: UpchainRequest = {
      id: crypto.randomUUID(),
      agentId,
      actionType,
      actionDetails,
      context: {
        ...context,
        agentName: agent.name,
        trustScore: agent.trust_score,
        trustTier: agent.trust_tier,
        isOnProbation: agent.is_on_probation,
        exceedsAutonomy,
        forceHumanApproval,
        autonomyLimits,
      },
      justification,
      riskLevel: riskLevel as RiskLevel,
      requestedAt: new Date().toISOString(),
    }

    // Evaluate through Council
    const decision = await evaluateRequest(upchainRequest)

    // Store decision in database
    const { error: insertError } = await supabase
      .from('bot_decisions')
      .insert({
        bot_id: agentId,
        decision_type: decision.outcome === 'approved' ? 'execute' :
                       decision.outcome === 'denied' ? 'escalate' : 'ask',
        action_taken: actionType,
        context_data: {
          upchainRequest,
          councilDecision: decision,
        },
        reasoning: decision.finalReasoning,
        confidence_score: decision.votes.length > 0
          ? decision.votes.reduce((sum, v) => sum + v.confidence, 0) / decision.votes.length
          : 1.0,
        risk_level: ['low', 'low', 'medium', 'high', 'critical'][riskLevel],
      })

    if (insertError) {
      console.error('Error storing decision:', insertError)
      // Continue anyway - decision was made
    }

    // Apply trust score change based on Council decision (FR51, FR52)
    let trustChange = null
    if (decision.outcome === 'approved' || decision.outcome === 'denied') {
      const riskLevelName = (['low', 'low', 'medium', 'high', 'critical'] as const)[riskLevel]
      const impact = calculateCouncilDecisionImpact(
        decision.outcome === 'approved',
        riskLevelName
      )

      trustChange = await applyTrustChange(
        agentId,
        decision.outcome === 'approved' ? 'council_approval' : 'council_denial',
        impact.change,
        impact.reason,
        {
          decision_id: decision.id,
          action_type: actionType,
          risk_level: riskLevel,
        }
      )
    }

    // If creates precedent, could store separately (future enhancement)

    // Log to Observer for audit trail (FR82) - Story 5-1
    try {
      // Log the Council request
      await logEvent({
        source: 'council',
        event_type: 'council_request',
        risk_level: (['info', 'low', 'medium', 'high', 'critical'] as const)[riskLevel],
        agent_id: agentId,
        user_id: user.id,
        data: {
          request_id: upchainRequest.id,
          action_type: actionType,
          action_details: actionDetails,
          justification,
          risk_level: riskLevel,
        },
      })

      // Log the Council decision
      await logEvent({
        source: 'council',
        event_type: 'council_decision',
        risk_level: decision.outcome === 'denied' ? 'high' :
                   decision.outcome === 'escalated' ? 'medium' : 'info',
        agent_id: agentId,
        user_id: user.id,
        data: {
          decision_id: decision.id,
          request_id: upchainRequest.id,
          outcome: decision.outcome,
          reasoning: decision.finalReasoning,
          votes_count: decision.votes.length,
          creates_precedent: decision.createsPrecedent,
        },
      })

      // Log trust change if applicable
      if (trustChange) {
        await logEvent({
          source: 'council',
          event_type: 'trust_change',
          risk_level: trustChange.tierChanged ? 'medium' : 'info',
          agent_id: agentId,
          user_id: user.id,
          data: {
            previous_score: trustChange.previousScore,
            new_score: trustChange.newScore,
            change: trustChange.change,
            reason: trustChange.reason,
            tier_changed: trustChange.tierChanged,
            new_tier: trustChange.newTier,
          },
        })
      }
    } catch (observerError) {
      // Don't fail the request if Observer logging fails
      console.error('Observer logging error:', observerError)
    }

    // Record on Truth Chain (FR92) - Story 5-4
    try {
      await recordCouncilDecision({
        decision_id: decision.id,
        request_id: upchainRequest.id,
        agent_id: agentId,
        action_type: actionType,
        risk_level: riskLevel,
        outcome: decision.outcome,
        votes: decision.votes.map(v => ({
          validator_id: v.validatorId,
          decision: v.decision,
          confidence: v.confidence,
        })),
        reasoning: decision.finalReasoning,
        creates_precedent: decision.createsPrecedent,
      })
    } catch (truthChainError) {
      console.error('Truth Chain recording error:', truthChainError)
    }

    return NextResponse.json({
      decision: {
        id: decision.id,
        outcome: decision.outcome,
        reasoning: decision.finalReasoning,
        votes: decision.votes.map(v => ({
          validator: v.validatorId,
          decision: v.decision,
          reasoning: v.reasoning,
          confidence: v.confidence,
        })),
        createsPrecedent: decision.createsPrecedent,
      },
      request: {
        id: upchainRequest.id,
        actionType,
        riskLevel,
      },
      autonomy: {
        tier: agent.trust_tier,
        isOnProbation: agent.is_on_probation,
        exceedsAutonomy,
        forceHumanApproval,
        maxAutonomousRiskLevel: autonomyLimits.maxRiskLevel,
        description: autonomyLimits.description,
      },
      trustChange: trustChange ? {
        previousScore: trustChange.previousScore,
        newScore: trustChange.newScore,
        change: trustChange.change,
        tierChanged: trustChange.tierChanged,
        newTier: trustChange.newTier,
      } : null,
    })
  } catch (error) {
    console.error('Council evaluate error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
