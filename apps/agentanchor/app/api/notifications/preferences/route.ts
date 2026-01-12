/**
 * Notification Preferences API
 * Epic 7: Story 7-5 (FR142-143)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import {
  getNotificationPreferences,
  updateNotificationPreference,
} from '@/lib/notifications'

/**
 * GET /api/notifications/preferences
 * Get user's notification preferences
 */
export async function GET() {
  const supabase = createRouteHandlerClient({ cookies })

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const preferences = await getNotificationPreferences(user.id)
    return NextResponse.json({ preferences })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * PATCH /api/notifications/preferences
 * Update notification preference
 */
export async function PATCH(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { type, channel, enabled } = body

    if (!type || !channel || typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'type, channel, and enabled are required' },
        { status: 400 }
      )
    }

    const preference = await updateNotificationPreference(
      user.id,
      type,
      channel,
      enabled
    )

    return NextResponse.json({ preference })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
