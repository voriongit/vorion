/**
 * Feedback API
 * Story 6-5: Consumer Feedback (FR31, FR104)
 *
 * GET  /api/marketplace/feedback - Get feedback
 * POST /api/marketplace/feedback - Submit feedback
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import {
  submitFeedback,
  getListingFeedback,
  getAgentFeedback,
  getConsumerFeedback,
  getRatingDistribution,
} from '@/lib/marketplace'

export const dynamic = 'force-dynamic'

const submitFeedbackSchema = z.object({
  acquisition_id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(255).optional(),
  review: z.string().max(2000).optional(),
  is_complaint: z.boolean().optional().default(false),
})

// GET /api/marketplace/feedback
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const listingId = searchParams.get('listing_id')
    const agentId = searchParams.get('agent_id')
    const distribution = searchParams.get('distribution') === 'true'
    const mine = searchParams.get('mine') === 'true'
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Get consumer's own feedback
    if (mine) {
      const supabase = createClient()
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const feedback = await getConsumerFeedback(user.id)
      return NextResponse.json({ feedback })
    }

    // Get rating distribution
    if (distribution && listingId) {
      const dist = await getRatingDistribution(listingId)
      return NextResponse.json({ distribution: dist })
    }

    // Get feedback by listing
    if (listingId) {
      const result = await getListingFeedback(listingId, limit, offset)
      return NextResponse.json({
        feedback: result.feedback,
        total: result.total,
        limit,
        offset,
        has_more: offset + result.feedback.length < result.total,
      })
    }

    // Get feedback by agent
    if (agentId) {
      const result = await getAgentFeedback(agentId, limit, offset)
      return NextResponse.json({
        feedback: result.feedback,
        total: result.total,
        limit,
        offset,
        has_more: offset + result.feedback.length < result.total,
      })
    }

    return NextResponse.json(
      { error: 'Must provide listing_id, agent_id, or mine=true' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Get feedback error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/marketplace/feedback - Submit feedback
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
    const validation = submitFeedbackSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      )
    }

    const feedback = await submitFeedback(user.id, validation.data)

    return NextResponse.json({
      feedback,
      message: 'Feedback submitted successfully',
    }, { status: 201 })
  } catch (error: any) {
    console.error('Submit feedback error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 400 }
    )
  }
}
