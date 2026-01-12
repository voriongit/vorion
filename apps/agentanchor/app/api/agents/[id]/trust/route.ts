/**
 * Trust Score API - Apply trust changes and get history
 * Story 4-2: Trust Score Changes (FR51, FR52)
 *
 * POST /api/agents/[id]/trust - Apply trust change
 * GET /api/agents/[id]/trust - Get trust history
 * GET /api/agents/[id]/trust?trend=true - Get trust trend for charts
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  applyTrustChange,
  getTrustHistory,
  getTrustTrend,
  TRUST_IMPACTS,
  TrustChangeType,
} from '@/lib/agents/trust-service'

export const dynamic = 'force-dynamic'

// POST /api/agents/[id]/trust - Apply trust change
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

    const agentId = params.id

    // Verify ownership or admin
    const { data: agent, error: agentError } = await supabase
      .from('bots')
      .select('id, user_id, name')
      .eq('id', agentId)
      .single()

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // Only owner can manually adjust trust (for testing/admin)
    // In production, trust changes should come from system events
    if (agent.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { change_type, custom_change, custom_reason, metadata } = body

    // Validate change type
    if (!change_type || !TRUST_IMPACTS[change_type as TrustChangeType]) {
      return NextResponse.json(
        {
          error: 'Invalid change_type',
          valid_types: Object.keys(TRUST_IMPACTS),
        },
        { status: 400 }
      )
    }

    const result = await applyTrustChange(
      agentId,
      change_type as TrustChangeType,
      custom_change,
      custom_reason,
      metadata
    )

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to apply trust change' },
        { status: 500 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Trust change error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET /api/agents/[id]/trust - Get trust history or trend
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

    const agentId = params.id
    const { searchParams } = new URL(request.url)
    const trend = searchParams.get('trend') === 'true'
    const days = parseInt(searchParams.get('days') || '30')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Verify access (owner or public agent)
    const { data: agent, error: agentError } = await supabase
      .from('bots')
      .select('id, user_id, is_public, trust_score, trust_tier')
      .eq('id', agentId)
      .single()

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // Only owner can view full trust history, public agents show limited info
    if (agent.user_id !== user.id && !agent.is_public) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (trend) {
      // Return trend data for charts
      const trendData = await getTrustTrend(agentId, days)
      return NextResponse.json({
        agent_id: agentId,
        current_score: agent.trust_score,
        current_tier: agent.trust_tier,
        trend: trendData,
        days,
      })
    }

    // Return paginated history
    const { entries, total } = await getTrustHistory(agentId, limit, offset)

    return NextResponse.json({
      agent_id: agentId,
      current_score: agent.trust_score,
      current_tier: agent.trust_tier,
      history: entries,
      total,
      limit,
      offset,
      has_more: offset + entries.length < total,
    })
  } catch (error) {
    console.error('Trust history error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
