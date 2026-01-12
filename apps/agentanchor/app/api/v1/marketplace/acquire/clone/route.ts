/**
 * Clone Acquisition API
 * POST - Acquire an agent via clone model
 *
 * Story 9-4: Clone Acquisition Flow (FR28)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { acquireClone } from '@/lib/marketplace/clone-enterprise-service'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { listingId, paymentIntentId } = body

    if (!listingId) {
      return NextResponse.json({ error: 'listingId is required' }, { status: 400 })
    }

    // In production, verify payment with Stripe before proceeding
    // For now, we trust the paymentIntentId if provided

    const result = await acquireClone(user.id, listingId, paymentIntentId)

    return NextResponse.json({
      success: true,
      acquisition: result.acquisition,
      clonePackage: {
        id: result.clonePackage.id,
        agentName: result.clonePackage.agentName,
        version: result.clonePackage.version,
        createdAt: result.clonePackage.createdAt,
        // Don't expose full definition in API response
        // Provide download link instead
        downloadUrl: `/api/v1/marketplace/clone/${result.acquisition.id}/download`,
      },
      message: 'Clone acquired successfully. Use the download URL to get your clone package.',
    })
  } catch (error: any) {
    console.error('Clone acquisition error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
