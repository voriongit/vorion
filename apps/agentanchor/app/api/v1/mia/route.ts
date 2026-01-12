/**
 * MIA (Missing-In-Action) Protocol API
 * GET - Get trainer MIA status
 * POST - Record activity / Send warning / Initiate takeover
 *
 * Epic 10: MIA Protocol
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getTrainerActivity,
  recordActivity,
  scanForMIATrainers,
  sendMIAWarning,
  acknowledgeWarning,
  initiateTakeover,
  assignTemporaryMaintainer,
  returnAgentToTrainer,
  notifyConsumersOfMIA,
  type ActivityType,
} from '@/lib/mia'

/**
 * GET - Get MIA status
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const trainerId = searchParams.get('trainerId') || user.id
    const action = searchParams.get('action')

    // Admin-only: scan all trainers
    if (action === 'scan') {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role !== 'admin') {
        return NextResponse.json({ error: 'Admin only' }, { status: 403 })
      }

      const scanResults = await scanForMIATrainers()
      return NextResponse.json({
        success: true,
        scan: scanResults,
      })
    }

    // Get trainer activity status
    const activity = await getTrainerActivity(trainerId)

    if (!activity) {
      return NextResponse.json({ error: 'Trainer not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      activity,
    })
  } catch (error: any) {
    console.error('MIA status error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * POST - MIA actions
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body

    switch (action) {
      case 'recordActivity': {
        const { activityType, metadata } = body
        if (!activityType) {
          return NextResponse.json({ error: 'activityType is required' }, { status: 400 })
        }
        await recordActivity(user.id, activityType as ActivityType, metadata)
        return NextResponse.json({ success: true, message: 'Activity recorded' })
      }

      case 'sendWarning': {
        const { trainerId, level } = body
        if (!trainerId || !level) {
          return NextResponse.json({ error: 'trainerId and level are required' }, { status: 400 })
        }
        // Admin only
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (profile?.role !== 'admin') {
          return NextResponse.json({ error: 'Admin only' }, { status: 403 })
        }

        const warning = await sendMIAWarning(trainerId, level)
        return NextResponse.json({ success: true, warning })
      }

      case 'acknowledgeWarning': {
        const { warningId } = body
        if (!warningId) {
          return NextResponse.json({ error: 'warningId is required' }, { status: 400 })
        }
        await acknowledgeWarning(warningId, user.id)
        return NextResponse.json({ success: true, message: 'Warning acknowledged' })
      }

      case 'initiateTakeover': {
        const { trainerId, agentId, reason } = body
        if (!trainerId || !agentId) {
          return NextResponse.json({ error: 'trainerId and agentId are required' }, { status: 400 })
        }
        // Admin only
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (profile?.role !== 'admin') {
          return NextResponse.json({ error: 'Admin only' }, { status: 403 })
        }

        const takeover = await initiateTakeover(trainerId, agentId, reason || 'mia')
        return NextResponse.json({ success: true, takeover })
      }

      case 'assignMaintainer': {
        const { takeoverId, maintainerId } = body
        if (!takeoverId || !maintainerId) {
          return NextResponse.json({ error: 'takeoverId and maintainerId are required' }, { status: 400 })
        }
        // Admin only
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (profile?.role !== 'admin') {
          return NextResponse.json({ error: 'Admin only' }, { status: 403 })
        }

        await assignTemporaryMaintainer(takeoverId, maintainerId)
        return NextResponse.json({ success: true, message: 'Maintainer assigned' })
      }

      case 'returnAgent': {
        const { takeoverId } = body
        if (!takeoverId) {
          return NextResponse.json({ error: 'takeoverId is required' }, { status: 400 })
        }
        await returnAgentToTrainer(takeoverId, user.id)
        return NextResponse.json({ success: true, message: 'Agent returned' })
      }

      case 'notifyConsumers': {
        const { trainerId } = body
        if (!trainerId) {
          return NextResponse.json({ error: 'trainerId is required' }, { status: 400 })
        }
        // Admin only
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (profile?.role !== 'admin') {
          return NextResponse.json({ error: 'Admin only' }, { status: 403 })
        }

        const notifiedCount = await notifyConsumersOfMIA(trainerId)
        return NextResponse.json({ success: true, notifiedCount })
      }

      default:
        return NextResponse.json({
          error: 'Invalid action',
          validActions: [
            'recordActivity',
            'sendWarning',
            'acknowledgeWarning',
            'initiateTakeover',
            'assignMaintainer',
            'returnAgent',
            'notifyConsumers',
          ],
        }, { status: 400 })
    }
  } catch (error: any) {
    console.error('MIA action error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
