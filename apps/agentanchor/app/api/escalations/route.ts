/**
 * Escalations API
 * GET - List escalations
 * POST - Create escalation
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEscalations, createEscalation } from '@/lib/escalations'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')

    const filters: any = {}
    if (status) filters.status = [status]
    if (priority) filters.priority = [priority]

    const { escalations, total } = await getEscalations(filters)

    return NextResponse.json({ escalations, total })
  } catch (error: any) {
    console.error('Escalations GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { decisionId, agentId, reason, priority, context } = body

    if (!decisionId || !agentId || !reason || !context) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const escalation = await createEscalation({
      decisionId,
      agentId,
      reason,
      priority,
      context,
    })

    return NextResponse.json({ escalation })
  } catch (error: any) {
    console.error('Escalations POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
