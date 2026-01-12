/**
 * Notifications API
 * Epic 7: Dashboard & Notifications
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from '@/lib/notifications'

/**
 * GET /api/notifications
 * Get notifications for the current user
 */
export async function GET(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const unreadOnly = searchParams.get('unread') === 'true'
  const countOnly = searchParams.get('count') === 'true'
  const type = searchParams.get('type') as any
  const limit = parseInt(searchParams.get('limit') || '20')
  const offset = parseInt(searchParams.get('offset') || '0')

  try {
    if (countOnly) {
      const count = await getUnreadCount(user.id)
      return NextResponse.json({ count })
    }

    const result = await getNotifications(user.id, {
      unreadOnly,
      type: type || undefined,
      limit,
      offset,
    })

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * PATCH /api/notifications
 * Mark notifications as read
 */
export async function PATCH(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { notification_ids, mark_all } = body

    let count: number

    if (mark_all) {
      count = await markAllAsRead(user.id)
    } else if (notification_ids && Array.isArray(notification_ids)) {
      count = await markAsRead(user.id, notification_ids)
    } else {
      return NextResponse.json(
        { error: 'notification_ids or mark_all required' },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true, count })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
