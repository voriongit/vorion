/**
 * Single Agent API
 * Epic 8: Story 8-1 RESTful API (FR144)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateApiKey, checkRateLimit, logApiUsage } from '@/lib/api'

/**
 * GET /api/v1/agents/[id]
 * Get single agent details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const startTime = Date.now()

  // Check API key auth
  const authHeader = request.headers.get('authorization')
  let userId: string | null = null
  let keyId: string | null = null

  if (authHeader?.startsWith('Bearer ')) {
    const key = authHeader.slice(7)
    const validation = await validateApiKey(key)

    if (!validation) {
      return NextResponse.json(
        { error: { message: 'Invalid API key', code: 'unauthorized' } },
        { status: 401 }
      )
    }

    userId = validation.userId
    keyId = validation.keyId
  }

  // Check rate limit
  if (userId && keyId) {
    const rateLimit = await checkRateLimit(keyId, userId)

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: { message: 'Rate limit exceeded', code: 'rate_limited' } },
        { status: 429 }
      )
    }
  }

  const supabase = createClient()

  try {
    const { data: agent, error } = await supabase
      .from('bots')
      .select(`
        id,
        name,
        description,
        status,
        trust_score,
        trust_tier,
        published,
        capabilities,
        personality_traits,
        created_at,
        updated_at,
        creator_id
      `)
      .eq('id', params.id)
      .single()

    const responseTime = Date.now() - startTime

    if (userId) {
      await logApiUsage(keyId, userId, `/api/v1/agents/${params.id}`, 'GET', error ? 404 : 200, responseTime)
    }

    if (error || !agent) {
      return NextResponse.json(
        { error: { message: 'Agent not found', code: 'not_found' } },
        { status: 404 }
      )
    }

    // Check access - either owner or published
    if (!agent.published && (!userId || agent.creator_id !== userId)) {
      return NextResponse.json(
        { error: { message: 'Agent not found', code: 'not_found' } },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: agent })
  } catch (err: any) {
    return NextResponse.json(
      { error: { message: err.message, code: 'internal_error' } },
      { status: 500 }
    )
  }
}
