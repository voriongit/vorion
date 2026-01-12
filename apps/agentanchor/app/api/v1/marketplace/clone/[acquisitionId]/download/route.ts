/**
 * Clone Package Download API
 * GET - Download clone package for an acquisition
 *
 * Story 9-3: Clone Package Generation
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateClonePackage } from '@/lib/marketplace/clone-enterprise-service'

interface RouteContext {
  params: Promise<{ acquisitionId: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { acquisitionId } = await context.params

    // Verify ownership of acquisition
    const { data: acquisition, error: fetchError } = await supabase
      .from('acquisitions')
      .select('*, marketplace_listings(*)')
      .eq('id', acquisitionId)
      .eq('consumer_id', user.id)
      .eq('acquisition_type', 'clone')
      .single()

    if (fetchError || !acquisition) {
      return NextResponse.json({ error: 'Clone acquisition not found' }, { status: 404 })
    }

    // Get clone number from listing
    const listing = acquisition.marketplace_listings as any
    const cloneNumber = listing?.current_clones || 1

    // Generate fresh clone package
    const clonePackage = await generateClonePackage(
      acquisition.agent_id,
      acquisition.listing_id,
      acquisition.id,
      cloneNumber
    )

    // Return as downloadable JSON
    const filename = `${clonePackage.agentName.replace(/[^a-zA-Z0-9]/g, '_')}_clone_v${clonePackage.version}.json`

    return new NextResponse(JSON.stringify(clonePackage, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error: any) {
    console.error('Clone download error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
