/**
 * Acquisitions API
 * Story 6-4: Agent Acquisition (FR27, FR30)
 *
 * GET  /api/marketplace/acquisitions - Get user's acquisitions
 * POST /api/marketplace/acquisitions - Acquire an agent
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import {
  acquireAgent,
  getConsumerAcquisitions,
} from '@/lib/marketplace'

export const dynamic = 'force-dynamic'

const acquireSchema = z.object({
  listing_id: z.string().uuid(),
  acquisition_type: z.enum(['commission', 'clone', 'enterprise']).optional().default('commission'),
})

// GET /api/marketplace/acquisitions - Get user's acquisitions
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
    const status = searchParams.get('status') || undefined

    let acquisitions = await getConsumerAcquisitions(user.id)

    // Filter by status if provided
    if (status) {
      acquisitions = acquisitions.filter(a => a.status === status)
    }

    return NextResponse.json({
      acquisitions,
      total: acquisitions.length,
    })
  } catch (error) {
    console.error('Get acquisitions error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/marketplace/acquisitions - Acquire an agent
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
    const validation = acquireSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      )
    }

    const acquisition = await acquireAgent(user.id, validation.data)

    return NextResponse.json({
      acquisition,
      message: 'Agent acquired successfully',
    }, { status: 201 })
  } catch (error: any) {
    console.error('Acquire agent error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 400 }
    )
  }
}
