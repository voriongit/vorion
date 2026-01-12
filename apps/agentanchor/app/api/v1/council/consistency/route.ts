/**
 * Decision Consistency API
 * Epic 14 - Story 14-4: Consistency Tracking
 *
 * GET /api/v1/council/consistency - Get consistency flags
 * POST /api/v1/council/consistency - Check or resolve consistency
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  checkDecisionConsistency,
  getDecisionFlags,
  getUnresolvedFlags,
  resolveConsistencyFlag,
  getConsistencyMetrics,
} from '@/lib/council/consistency-service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const decisionId = searchParams.get('decisionId')

    // Get flags for a specific decision
    if (action === 'flags' && decisionId) {
      const flags = await getDecisionFlags(decisionId)
      return NextResponse.json({ success: true, data: flags })
    }

    // Get unresolved flags (dashboard)
    if (action === 'unresolved') {
      const limit = parseInt(searchParams.get('limit') || '50', 10)
      const flags = await getUnresolvedFlags(limit)
      return NextResponse.json({ success: true, data: flags })
    }

    // Get consistency metrics
    if (action === 'metrics') {
      const days = parseInt(searchParams.get('days') || '30', 10)
      const metrics = await getConsistencyMetrics(days)
      return NextResponse.json({ success: true, data: metrics })
    }

    return NextResponse.json(
      { success: false, error: 'action parameter required' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error in consistency GET:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { action } = body

    // Check decision consistency
    if (action === 'check') {
      const { decisionId, actionDescription, actionType, outcome, reasoning } = body

      if (!decisionId || !actionDescription || !actionType || !outcome) {
        return NextResponse.json(
          { success: false, error: 'Missing required fields' },
          { status: 400 }
        )
      }

      const report = await checkDecisionConsistency(
        decisionId,
        actionDescription,
        actionType,
        outcome,
        reasoning || ''
      )

      return NextResponse.json({ success: true, data: report })
    }

    // Resolve a consistency flag
    if (action === 'resolve') {
      const { flagId, resolution, notes } = body

      if (!flagId || !resolution) {
        return NextResponse.json(
          { success: false, error: 'flagId and resolution required' },
          { status: 400 }
        )
      }

      if (!['justified', 'corrected'].includes(resolution)) {
        return NextResponse.json(
          { success: false, error: 'resolution must be justified or corrected' },
          { status: 400 }
        )
      }

      const success = await resolveConsistencyFlag(
        flagId,
        user.id,
        resolution,
        notes || ''
      )

      return NextResponse.json({ success })
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error in consistency POST:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
