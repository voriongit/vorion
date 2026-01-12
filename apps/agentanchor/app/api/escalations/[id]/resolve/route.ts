/**
 * Resolve Escalation API
 * POST - Resolve an escalation
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveEscalation } from '@/lib/escalations'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { resolution, resolutionReason, createsPrecedent, precedentNote } = body

    if (!resolution || !resolutionReason) {
      return NextResponse.json({ error: 'Resolution and reason required' }, { status: 400 })
    }

    if (resolution !== 'approved' && resolution !== 'rejected') {
      return NextResponse.json({ error: 'Invalid resolution' }, { status: 400 })
    }

    const escalation = await resolveEscalation(id, user.id, {
      resolution,
      resolutionReason,
      createsPrecedent,
      precedentNote,
    })

    return NextResponse.json({ escalation })
  } catch (error: any) {
    console.error('Resolve escalation error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
