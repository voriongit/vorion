/**
 * Enterprise Lock Acquisition API
 * POST - Acquire an agent via enterprise lock model
 *
 * Story 9-5: Enterprise Lock Acquisition (FR29)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { acquireEnterpriseLock } from '@/lib/marketplace/clone-enterprise-service'

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

    const result = await acquireEnterpriseLock(user.id, listingId, paymentIntentId)

    return NextResponse.json({
      success: true,
      acquisition: result.acquisition,
      license: {
        id: result.license.id,
        agentId: result.license.agentId,
        terms: result.license.terms,
        status: result.license.status,
        activatedAt: result.license.activatedAt,
      },
      message: 'Enterprise lock acquired successfully. This agent is now exclusively yours.',
    })
  } catch (error: any) {
    console.error('Enterprise acquisition error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
