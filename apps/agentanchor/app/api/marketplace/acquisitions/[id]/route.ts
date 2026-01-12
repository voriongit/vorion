/**
 * Single Acquisition API
 * Story 6-4: Agent Acquisition
 *
 * GET    /api/marketplace/acquisitions/[id] - Get acquisition details
 * DELETE /api/marketplace/acquisitions/[id] - Terminate acquisition
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { terminateAcquisition } from '@/lib/marketplace'

export const dynamic = 'force-dynamic'

const terminateSchema = z.object({
  reason: z.string().min(1).max(500),
})

// GET /api/marketplace/acquisitions/[id]
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

    const { data: acquisition, error } = await supabase
      .from('acquisitions')
      .select(`
        *,
        listing:marketplace_listings(*),
        agent:bots(id, name, trust_score, trust_tier)
      `)
      .eq('id', params.id)
      .or(`consumer_id.eq.${user.id},trainer_id.eq.${user.id}`)
      .single()

    if (error || !acquisition) {
      return NextResponse.json({ error: 'Acquisition not found' }, { status: 404 })
    }

    return NextResponse.json({ acquisition })
  } catch (error) {
    console.error('Get acquisition error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/marketplace/acquisitions/[id] - Terminate acquisition
export async function DELETE(
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
    const validation = terminateSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      )
    }

    const acquisition = await terminateAcquisition(
      params.id,
      user.id,
      validation.data.reason
    )

    return NextResponse.json({
      acquisition,
      message: 'Acquisition terminated',
    })
  } catch (error: any) {
    console.error('Terminate acquisition error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 400 }
    )
  }
}
