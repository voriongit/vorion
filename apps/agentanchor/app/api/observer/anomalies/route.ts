/**
 * Observer Anomalies API
 * Story 5-3: Anomaly Detection (FR90)
 *
 * GET /api/observer/anomalies - Get anomalies
 * POST /api/observer/anomalies/detect - Run detection
 * PATCH /api/observer/anomalies/[id] - Acknowledge/resolve
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getAnomalies,
  detectAnomalies,
  storeAnomaly,
  AnomalySeverity,
} from '@/lib/observer/anomaly-service'

export const dynamic = 'force-dynamic'

// GET /api/observer/anomalies - Get anomalies
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
    const agentId = searchParams.get('agent_id') || undefined
    const severity = searchParams.get('severity') as AnomalySeverity | null
    const includeResolved = searchParams.get('include_resolved') === 'true'
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // If agent specified, verify access
    if (agentId) {
      const { data: agent } = await supabase
        .from('bots')
        .select('id, user_id')
        .eq('id', agentId)
        .single()

      if (!agent || agent.user_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const result = await getAnomalies(agentId, {
      severity: severity || undefined,
      includeResolved,
      limit,
      offset,
    })

    return NextResponse.json({
      anomalies: result.anomalies,
      total: result.total,
      limit,
      offset,
      has_more: offset + result.anomalies.length < result.total,
    })
  } catch (error) {
    console.error('Get anomalies error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/observer/anomalies - Run detection for an agent
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
    const { agent_id } = body

    if (!agent_id) {
      return NextResponse.json(
        { error: 'agent_id is required' },
        { status: 400 }
      )
    }

    // Verify ownership
    const { data: agent } = await supabase
      .from('bots')
      .select('id, user_id, name')
      .eq('id', agent_id)
      .single()

    if (!agent || agent.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Run detection
    const result = await detectAnomalies(agent_id)

    // Store any detected anomalies
    const storedAnomalies = []
    for (const anomaly of result.anomalies) {
      const stored = await storeAnomaly(anomaly)
      if (stored) {
        storedAnomalies.push(stored)
      }
    }

    return NextResponse.json({
      detected: result.detected,
      anomaly_count: storedAnomalies.length,
      anomalies: storedAnomalies,
    })
  } catch (error) {
    console.error('Anomaly detection error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
