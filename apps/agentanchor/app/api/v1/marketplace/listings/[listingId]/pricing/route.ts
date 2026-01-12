/**
 * Marketplace Listing Pricing API
 * GET - Get pricing options for a listing
 * PUT - Update clone/enterprise pricing (trainer only)
 *
 * Story 9-1: Clone Pricing Settings
 * Story 9-2: Enterprise Lock Configuration
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  updateClonePricing,
  getClonePricing,
  updateEnterpriseLockConfig,
  getEnterpriseLockConfig,
  type ClonePricingConfig,
  type EnterpriseLockConfig,
} from '@/lib/marketplace/clone-enterprise-service'

interface RouteContext {
  params: Promise<{ listingId: string }>
}

/**
 * GET - Get pricing options for a listing
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { listingId } = await context.params

    const [clonePricing, enterpriseConfig] = await Promise.all([
      getClonePricing(listingId),
      getEnterpriseLockConfig(listingId),
    ])

    if (!clonePricing && !enterpriseConfig) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    return NextResponse.json({
      listingId,
      clone: clonePricing,
      enterprise: enterpriseConfig,
    })
  } catch (error: any) {
    console.error('Get pricing error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * PUT - Update clone/enterprise pricing (trainer only)
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { listingId } = await context.params
    const body = await request.json()
    const { type, config } = body

    if (!type || !['clone', 'enterprise'].includes(type)) {
      return NextResponse.json({
        error: 'type must be "clone" or "enterprise"',
      }, { status: 400 })
    }

    if (!config) {
      return NextResponse.json({ error: 'config is required' }, { status: 400 })
    }

    if (type === 'clone') {
      await updateClonePricing(listingId, user.id, config as ClonePricingConfig)
    } else {
      await updateEnterpriseLockConfig(listingId, user.id, config as EnterpriseLockConfig)
    }

    // Return updated pricing
    const [clonePricing, enterpriseConfig] = await Promise.all([
      getClonePricing(listingId),
      getEnterpriseLockConfig(listingId),
    ])

    return NextResponse.json({
      success: true,
      listingId,
      clone: clonePricing,
      enterprise: enterpriseConfig,
    })
  } catch (error: any) {
    console.error('Update pricing error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
