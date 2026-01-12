import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import {
  getPendingEscalations,
  getEscalationHistory,
  getEscalationStats,
  EscalationPriority,
  EscalationStatus,
} from '@/lib/council/escalation-service'

export const dynamic = 'force-dynamic'

// GET /api/council/escalations - Get escalations (pending or history)
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
    const view = searchParams.get('view') || 'pending' // 'pending' | 'history' | 'stats'
    const agentId = searchParams.get('agentId') || undefined
    const status = searchParams.get('status') as EscalationStatus | undefined
    const priority = searchParams.get('priority') as EscalationPriority | undefined
    const assignedToMe = searchParams.get('assignedToMe') === 'true'
    const limit = parseInt(searchParams.get('limit') || '20')

    if (view === 'stats') {
      const stats = await getEscalationStats()
      return NextResponse.json({ stats })
    }

    if (view === 'pending') {
      const escalations = await getPendingEscalations({
        assignedTo: assignedToMe ? user.id : undefined,
        agentId,
        priority,
        limit,
      })

      return NextResponse.json({
        escalations,
        total: escalations.length,
        view: 'pending',
      })
    }

    // History view
    const escalations = await getEscalationHistory({
      agentId,
      status,
      limit,
    })

    return NextResponse.json({
      escalations,
      total: escalations.length,
      view: 'history',
    })
  } catch (error) {
    console.error('Escalations error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
