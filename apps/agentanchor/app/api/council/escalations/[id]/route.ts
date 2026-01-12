import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import {
  getEscalationById,
  assignEscalation,
  respondToEscalation,
  cancelEscalation,
  HumanDecision,
} from '@/lib/council/escalation-service'

export const dynamic = 'force-dynamic'

// GET /api/council/escalations/[id] - Get escalation details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const escalation = await getEscalationById(params.id)

    if (!escalation) {
      return NextResponse.json({ error: 'Escalation not found' }, { status: 404 })
    }

    // Get response history
    const { data: responses } = await supabase
      .from('escalation_responses')
      .select('*')
      .eq('escalation_id', params.id)
      .order('created_at', { ascending: true })

    return NextResponse.json({
      escalation,
      responses: responses || [],
    })
  } catch (error) {
    console.error('Get escalation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

const responseSchema = z.object({
  action: z.enum(['respond', 'assign', 'cancel']),
  // For 'respond' action
  decision: z.enum(['approve', 'deny', 'modify']).optional(),
  reasoning: z.string().optional(),
  modificationDetails: z.string().optional(),
  // For 'assign' action
  assigneeId: z.string().uuid().optional(),
  // For 'cancel' action
  cancelReason: z.string().optional(),
})

// POST /api/council/escalations/[id] - Respond to escalation
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const validation = responseSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { action, decision, reasoning, modificationDetails, assigneeId, cancelReason } = validation.data

    // Handle different actions
    switch (action) {
      case 'assign': {
        if (!assigneeId) {
          return NextResponse.json({ error: 'assigneeId required for assign action' }, { status: 400 })
        }

        const success = await assignEscalation(params.id, assigneeId)
        if (!success) {
          return NextResponse.json({ error: 'Failed to assign escalation' }, { status: 500 })
        }

        return NextResponse.json({
          message: 'Escalation assigned successfully',
          escalationId: params.id,
          assigneeId,
        })
      }

      case 'cancel': {
        const success = await cancelEscalation(params.id, cancelReason || 'Cancelled by user')
        if (!success) {
          return NextResponse.json({ error: 'Failed to cancel escalation' }, { status: 500 })
        }

        return NextResponse.json({
          message: 'Escalation cancelled successfully',
          escalationId: params.id,
        })
      }

      case 'respond': {
        if (!decision) {
          return NextResponse.json({ error: 'decision required for respond action' }, { status: 400 })
        }
        if (!reasoning) {
          return NextResponse.json({ error: 'reasoning required for respond action' }, { status: 400 })
        }
        if (decision === 'modify' && !modificationDetails) {
          return NextResponse.json({ error: 'modificationDetails required for modify decision' }, { status: 400 })
        }

        const result = await respondToEscalation(params.id, user.id, {
          decision: decision as HumanDecision,
          reasoning,
          modificationDetails,
        })

        if (!result.success) {
          return NextResponse.json({ error: 'Failed to respond to escalation' }, { status: 500 })
        }

        return NextResponse.json({
          message: 'Escalation response recorded successfully',
          escalation: result.escalation,
          precedentId: result.precedentId,
        })
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Escalation response error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
