/**
 * Listing Publish/Unpublish API
 * Story 6-1: Agent Publishing (FR12)
 *
 * POST   /api/marketplace/listings/[id]/publish - Publish listing
 * DELETE /api/marketplace/listings/[id]/publish - Unpublish listing
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { publishListing, unpublishListing } from '@/lib/marketplace'

export const dynamic = 'force-dynamic'

// POST /api/marketplace/listings/[id]/publish - Publish listing
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

    const listing = await publishListing(params.id, user.id)

    return NextResponse.json({
      listing,
      message: 'Agent published to marketplace successfully',
    })
  } catch (error: any) {
    console.error('Publish listing error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 400 }
    )
  }
}

// DELETE /api/marketplace/listings/[id]/publish - Unpublish listing
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

    const listing = await unpublishListing(params.id, user.id)

    return NextResponse.json({
      listing,
      message: 'Agent removed from marketplace',
    })
  } catch (error: any) {
    console.error('Unpublish listing error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 400 }
    )
  }
}
