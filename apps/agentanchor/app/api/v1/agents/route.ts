/**
 * Public Agents API
 * Epic 8: Story 8-1 RESTful API (FR144)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateApiKey, checkRateLimit, logApiUsage } from '@/lib/api'

/**
 * GET /api/v1/agents
 * List agents (authenticated user's agents or public marketplace)
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  // Check API key auth
  const authHeader = request.headers.get('authorization')
  let userId: string | null = null
  let keyId: string | null = null
  let scope: string = 'read'

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
    scope = validation.scope
  } else {
    // No API key - return only public agents
  }

  // Check rate limit
  if (userId && keyId) {
    const rateLimit = await checkRateLimit(keyId, userId)

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: { message: 'Rate limit exceeded', code: 'rate_limited' },
          meta: { reset_at: rateLimit.reset_at },
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimit.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimit.reset_at,
          },
        }
      )
    }
  }

  const supabase = createClient()
  const { searchParams } = new URL(request.url)

  const page = parseInt(searchParams.get('page') || '1')
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
  const offset = (page - 1) * limit
  const status = searchParams.get('status')
  const published = searchParams.get('published')

  try {
    let query = supabase
      .from('bots')
      .select('id, name, description, status, trust_score, trust_tier, published, capabilities, created_at', { count: 'exact' })

    // If authenticated, show user's agents
    if (userId) {
      query = query.eq('creator_id', userId)
    } else {
      // Public - only show published active agents
      query = query.eq('published', true).eq('status', 'active')
    }

    if (status) {
      query = query.eq('status', status)
    }

    if (published !== null) {
      query = query.eq('published', published === 'true')
    }

    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1)

    const { data, error, count } = await query

    const responseTime = Date.now() - startTime

    // Log API usage
    if (userId) {
      await logApiUsage(keyId, userId, '/api/v1/agents', 'GET', 200, responseTime)
    }

    if (error) {
      return NextResponse.json(
        { error: { message: error.message, code: 'internal_error' } },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data,
      meta: {
        page,
        limit,
        total: count || 0,
        has_more: offset + limit < (count || 0),
      },
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: { message: err.message, code: 'internal_error' } },
      { status: 500 }
    )
  }
}
