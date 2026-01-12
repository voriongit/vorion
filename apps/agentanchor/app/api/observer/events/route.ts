/**
 * Observer Events API
 * Story 5-1: Observer Event Logging (FR82, FR87, FR88)
 *
 * GET /api/observer/events - Query events with filters
 * POST /api/observer/events - Log a new event (internal use)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logEvent, queryEvents, EventInput, EventQueryOptions } from '@/lib/observer'

export const dynamic = 'force-dynamic'

// GET /api/observer/events - Query events with filters
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

    const options: EventQueryOptions = {
      agent_id: searchParams.get('agent_id') || undefined,
      user_id: searchParams.get('user_id') || undefined,
      event_type: searchParams.get('event_type') as EventQueryOptions['event_type'],
      source: searchParams.get('source') as EventQueryOptions['source'],
      risk_level: searchParams.get('risk_level') as EventQueryOptions['risk_level'],
      from_timestamp: searchParams.get('from') || undefined,
      to_timestamp: searchParams.get('to') || undefined,
      limit: parseInt(searchParams.get('limit') || '50'),
      offset: parseInt(searchParams.get('offset') || '0'),
    }

    // If agent_id is specified, verify user has access to that agent
    if (options.agent_id) {
      const { data: agent, error: agentError } = await supabase
        .from('bots')
        .select('id, user_id, is_public')
        .eq('id', options.agent_id)
        .single()

      if (agentError || !agent) {
        return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
      }

      // Only owner can see private agent's events
      if (agent.user_id !== user.id && !agent.is_public) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else {
      // No agent specified - filter to user's agents only
      options.user_id = user.id
    }

    const result = await queryEvents(options)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Observer events query error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/observer/events - Log a new event (internal use)
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()

    // This endpoint should be protected - only internal services should call it
    // For MVP, we'll use auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const eventInput: EventInput = {
      source: body.source,
      event_type: body.event_type,
      risk_level: body.risk_level,
      agent_id: body.agent_id,
      user_id: user.id, // Always set to authenticated user
      data: body.data || {},
    }

    // Validate required fields
    if (!eventInput.source || !eventInput.event_type) {
      return NextResponse.json(
        { error: 'Missing required fields: source, event_type' },
        { status: 400 }
      )
    }

    // If agent_id specified, verify ownership
    if (eventInput.agent_id) {
      const { data: agent, error: agentError } = await supabase
        .from('bots')
        .select('id, user_id')
        .eq('id', eventInput.agent_id)
        .single()

      if (agentError || !agent) {
        return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
      }

      if (agent.user_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const event = await logEvent(eventInput)

    return NextResponse.json({
      success: true,
      event: {
        id: event.id,
        sequence: event.sequence,
        event_type: event.event_type,
        timestamp: event.timestamp,
        hash: event.hash,
      },
    })
  } catch (error) {
    console.error('Observer event log error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
