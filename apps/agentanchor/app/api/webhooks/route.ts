/**
 * Webhooks Management API
 * Epic 8: Story 8-3 Webhooks (FR146)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import crypto from 'crypto'

const MAX_WEBHOOKS_PER_USER = 10

/**
 * GET /api/webhooks
 * Get user's webhooks
 */
export async function GET() {
  const supabase = createRouteHandlerClient({ cookies })

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { data, error } = await supabase
      .from('user_webhooks')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    // Don't expose secrets
    const webhooks = (data || []).map(w => ({
      ...w,
      secret: w.secret ? '••••••••' : null,
    }))

    return NextResponse.json({ webhooks })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * POST /api/webhooks
 * Create a new webhook
 */
export async function POST(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { name, url, notification_types } = body

    if (!name || !url) {
      return NextResponse.json(
        { error: 'Name and URL are required' },
        { status: 400 }
      )
    }

    // Validate URL
    try {
      new URL(url)
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      )
    }

    // Check limit
    const { count } = await supabase
      .from('user_webhooks')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if ((count || 0) >= MAX_WEBHOOKS_PER_USER) {
      return NextResponse.json(
        { error: `Maximum of ${MAX_WEBHOOKS_PER_USER} webhooks allowed` },
        { status: 400 }
      )
    }

    // Generate secret
    const secret = 'whsec_' + crypto.randomBytes(24).toString('hex')

    const { data, error } = await supabase
      .from('user_webhooks')
      .insert({
        user_id: user.id,
        name,
        url,
        secret,
        notification_types: notification_types || [],
        enabled: true,
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({
      webhook: data,
      secret, // Only shown once!
      warning: 'Save this secret - it will not be shown again',
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
