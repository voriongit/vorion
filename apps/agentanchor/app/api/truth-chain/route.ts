/**
 * Truth Chain API
 * Story 5-4: Truth Chain Records (FR92-FR97)
 * Story 5-5: Truth Chain Verification (FR98-FR100)
 *
 * GET /api/truth-chain - Query records
 * GET /api/truth-chain/stats - Get chain statistics
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { queryRecords, getChainStats, TruthChainRecordType } from '@/lib/truth-chain'

export const dynamic = 'force-dynamic'

// GET /api/truth-chain - Query records
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

    // Check if requesting stats
    if (searchParams.get('stats') === 'true') {
      const stats = await getChainStats()
      return NextResponse.json(stats)
    }

    const agentId = searchParams.get('agent_id') || undefined
    const recordType = searchParams.get('record_type') as TruthChainRecordType | null
    const from = searchParams.get('from') || undefined
    const to = searchParams.get('to') || undefined
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // If agent specified, verify access
    if (agentId) {
      const { data: agent } = await supabase
        .from('bots')
        .select('id, user_id, is_public')
        .eq('id', agentId)
        .single()

      if (!agent) {
        return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
      }

      // Only owner or public agents
      if (agent.user_id !== user.id && !agent.is_public) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const result = await queryRecords({
      agent_id: agentId,
      record_type: recordType || undefined,
      from_timestamp: from,
      to_timestamp: to,
      limit,
      offset,
    })

    return NextResponse.json({
      records: result.records,
      total: result.total,
      limit,
      offset,
      has_more: offset + result.records.length < result.total,
    })
  } catch (error) {
    console.error('Truth Chain query error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
