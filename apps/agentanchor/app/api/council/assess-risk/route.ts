import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { assessRisk, canAutoApprove, getRequiredApproval } from '@/lib/council'

export const dynamic = 'force-dynamic'

const assessSchema = z.object({
  actionType: z.string().min(1),
  actionDetails: z.string().min(1),
  context: z.record(z.any()).optional().default({}),
  riskFactors: z.object({
    affectsMultipleUsers: z.boolean().optional(),
    involvesPersonalData: z.boolean().optional(),
    hasFinancialImpact: z.boolean().optional(),
    isIrreversible: z.boolean().optional(),
    involvesExternalSystem: z.boolean().optional(),
    modifiesPermissions: z.boolean().optional(),
  }).optional(),
  agentTrustTier: z.string().optional(),
})

// POST /api/council/assess-risk - Preview risk assessment without submitting
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
    const validation = assessSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { actionType, actionDetails, context, riskFactors, agentTrustTier } = validation.data

    // Assess risk
    const assessment = assessRisk(
      actionType,
      actionDetails,
      context,
      riskFactors || {}
    )

    // Check auto-approval eligibility
    const autoApproval = agentTrustTier
      ? canAutoApprove(assessment.riskLevel, agentTrustTier)
      : null

    // Get approval requirements
    const approval = getRequiredApproval(assessment.riskLevel)

    return NextResponse.json({
      risk: {
        level: assessment.riskLevel,
        levelName: ['Routine', 'Standard', 'Elevated', 'Significant', 'Critical'][assessment.riskLevel],
        reasoning: assessment.reasoning,
        factors: assessment.factors,
      },
      approval: {
        type: approval.type,
        description: approval.description,
      },
      autoApproval: autoApproval ? {
        eligible: autoApproval.canAutoApprove,
        reason: autoApproval.reason,
        trustTier: agentTrustTier,
      } : null,
      recommendation: assessment.riskLevel <= 1
        ? 'This action can proceed automatically'
        : assessment.riskLevel === 2
        ? 'This action requires single validator approval'
        : assessment.riskLevel === 3
        ? 'This action requires majority Council approval'
        : 'This action requires unanimous approval and human confirmation',
    })
  } catch (error) {
    console.error('Assess risk error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
