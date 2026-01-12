/**
 * Single Listing API
 * Story 6-1: Agent Publishing
 *
 * GET    /api/marketplace/listings/[id] - Get listing details
 * PATCH  /api/marketplace/listings/[id] - Update listing
 * DELETE /api/marketplace/listings/[id] - Delete draft listing
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { getListing, updateListing, getTrainerListings } from '@/lib/marketplace'

export const dynamic = 'force-dynamic'

const updateListingSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().min(10).optional(),
  short_description: z.string().max(500).optional(),
  category: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
  commission_rate: z.number().min(0.001).max(10).optional(),
  complexity_multiplier: z.number().min(0.5).max(5).optional(),
  status: z.enum(['draft', 'paused']).optional(),
})

// GET /api/marketplace/listings/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // Handle "mine" to get trainer's listings
    if (id === 'mine') {
      const supabase = createClient()
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const listings = await getTrainerListings(user.id)
      return NextResponse.json({ listings })
    }

    const listing = await getListing(id)

    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    return NextResponse.json({ listing })
  } catch (error) {
    console.error('Get listing error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/marketplace/listings/[id]
export async function PATCH(
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
    const validation = updateListingSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      )
    }

    const listing = await updateListing(params.id, user.id, validation.data)

    return NextResponse.json({ listing })
  } catch (error: any) {
    console.error('Update listing error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 400 }
    )
  }
}

// DELETE /api/marketplace/listings/[id] - Only for draft listings
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

    // Delete only if draft and owned by user
    const { error: deleteError } = await supabase
      .from('marketplace_listings')
      .delete()
      .eq('id', params.id)
      .eq('trainer_id', user.id)
      .eq('status', 'draft')

    if (deleteError) {
      return NextResponse.json(
        { error: 'Failed to delete listing or listing is not a draft' },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete listing error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
