/**
 * Dashboard API
 * Epic 7: Story 7-1 Role-Based Dashboard (FR129-131)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import {
  getDashboardPreferences,
  updateDashboardPreferences,
  getTrainerDashboardStats,
  getConsumerDashboardStats,
  getRecentActivity,
} from '@/lib/notifications'

/**
 * GET /api/dashboard
 * Get dashboard data for current user
 */
export async function GET(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const requestedRole = searchParams.get('role') as 'trainer' | 'consumer' | null

  try {
    // Get user preferences
    const preferences = await getDashboardPreferences(user.id)
    const role = requestedRole || preferences.active_role

    // Get role-specific stats
    let stats
    if (role === 'trainer') {
      stats = await getTrainerDashboardStats(user.id)
    } else {
      stats = await getConsumerDashboardStats(user.id)
    }

    // Get recent activity
    const activity = await getRecentActivity(user.id, role)

    return NextResponse.json({
      preferences,
      stats,
      activity,
      role,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * PATCH /api/dashboard
 * Update dashboard preferences
 */
export async function PATCH(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { active_role, default_tab, widget_layout } = body

    const preferences = await updateDashboardPreferences(user.id, {
      active_role,
      default_tab,
      widget_layout,
    })

    return NextResponse.json({ preferences })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
