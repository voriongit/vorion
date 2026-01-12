/**
 * Earnings API
 * Story 6-6: Earnings Dashboard & Payouts (FR16, FR112-FR115)
 *
 * GET /api/marketplace/earnings - Get earnings data
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getEarningsSummary,
  getEarningsHistory,
  getEarningsByAgent,
  getEarningsTimeline,
} from '@/lib/marketplace'

export const dynamic = 'force-dynamic'

// GET /api/marketplace/earnings
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

    const summary = searchParams.get('summary') === 'true'
    const byAgent = searchParams.get('by_agent') === 'true'
    const timeline = searchParams.get('timeline') === 'true'
    const status = searchParams.get('status') || undefined
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const days = parseInt(searchParams.get('days') || '30')

    // Get summary
    if (summary) {
      const data = await getEarningsSummary(user.id)
      return NextResponse.json({ summary: data })
    }

    // Get earnings by agent
    if (byAgent) {
      const data = await getEarningsByAgent(user.id)
      return NextResponse.json({ by_agent: data })
    }

    // Get timeline for charts
    if (timeline) {
      const data = await getEarningsTimeline(user.id, days)
      return NextResponse.json({ timeline: data })
    }

    // Get earnings history
    const result = await getEarningsHistory(user.id, limit, offset, status)

    return NextResponse.json({
      earnings: result.earnings,
      total: result.total,
      limit,
      offset,
      has_more: offset + result.earnings.length < result.total,
    })
  } catch (error) {
    console.error('Get earnings error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
