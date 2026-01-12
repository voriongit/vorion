/**
 * Feedback Response API
 * Story 6-5: Consumer Feedback
 *
 * POST /api/marketplace/feedback/[id]/respond - Trainer responds to feedback
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { addTrainerResponse } from '@/lib/marketplace'

export const dynamic = 'force-dynamic'

const responseSchema = z.object({
  response: z.string().min(1).max(2000),
})

// POST /api/marketplace/feedback/[id]/respond
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

    const feedback = await addTrainerResponse(
      params.id,
      user.id,
      validation.data.response
    )

    return NextResponse.json({
      feedback,
      message: 'Response added successfully',
    })
  } catch (error: any) {
    console.error('Add response error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 400 }
    )
  }
}
