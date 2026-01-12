/**
 * Payouts API
 * Story 6-6: Earnings Dashboard & Payouts (FR113-FR115)
 *
 * GET  /api/marketplace/payouts - Get payout history
 * POST /api/marketplace/payouts - Request a payout
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import {
  requestPayout,
  getPayoutHistory,
  cancelPayout,
} from '@/lib/marketplace'

export const dynamic = 'force-dynamic'

const requestPayoutSchema = z.object({
  amount: z.number().min(100),
  payout_method: z.enum(['bank', 'crypto', 'paypal']),
  payout_details: z.record(z.any()),
})

// GET /api/marketplace/payouts
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
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    const result = await getPayoutHistory(user.id, limit, offset)

    return NextResponse.json({
      payouts: result.payouts,
      total: result.total,
      limit,
      offset,
      has_more: offset + result.payouts.length < result.total,
    })
  } catch (error) {
    console.error('Get payouts error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/marketplace/payouts - Request a payout
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
    const validation = requestPayoutSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      )
    }

    const payout = await requestPayout(
      user.id,
      validation.data.amount,
      validation.data.payout_method,
      validation.data.payout_details
    )

    return NextResponse.json({
      payout,
      message: 'Payout request submitted',
    }, { status: 201 })
  } catch (error: any) {
    console.error('Request payout error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 400 }
    )
  }
}
