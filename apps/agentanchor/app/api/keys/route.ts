/**
 * API Keys Management
 * Epic 8: Story 8-2 API Authentication (FR145)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import {
  createApiKey,
  getUserApiKeys,
  getApiUsageStats,
} from '@/lib/api'

/**
 * GET /api/keys
 * Get user's API keys
 */
export async function GET(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const includeUsage = searchParams.get('usage') === 'true'

  try {
    const keys = await getUserApiKeys(user.id)

    let usage = null
    if (includeUsage) {
      usage = await getApiUsageStats(user.id)
    }

    return NextResponse.json({ keys, usage })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * POST /api/keys
 * Create a new API key
 */
export async function POST(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { name, scope, is_test, expires_at } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    const result = await createApiKey(user.id, name, {
      scope,
      isTest: is_test,
      expiresAt: expires_at,
    })

    return NextResponse.json({
      key: result.apiKey,
      raw_key: result.rawKey, // Only shown once!
      warning: 'Save this key - it will not be shown again',
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
