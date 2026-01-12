/**
 * Client Protection API
 * GET - Get protection status, ownership changes, Bill of Rights
 * POST - Submit opt-out, walk-away, protection request
 *
 * Epic 11: Client Bill of Rights
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  notifyOwnershipChange,
  submitOptOut,
  processOptOut,
  walkAwayClean,
  requestPlatformProtection,
  getConsumerProtectionRequests,
  getPendingOwnershipChanges,
  getClientBillOfRights,
  recordProtectionDecision,
} from '@/lib/protection/client-protection-service'

/**
 * GET - Get protection status
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    switch (action) {
      case 'rights':
        return NextResponse.json({
          success: true,
          billOfRights: getClientBillOfRights(),
        })

      case 'requests':
        const requests = await getConsumerProtectionRequests(user.id)
        return NextResponse.json({ success: true, requests })

      case 'ownership-changes':
        const changes = await getPendingOwnershipChanges(user.id)
        return NextResponse.json({ success: true, changes })

      default:
        // Return all protection info
        const [allRequests, allChanges] = await Promise.all([
          getConsumerProtectionRequests(user.id),
          getPendingOwnershipChanges(user.id),
        ])
        return NextResponse.json({
          success: true,
          requests: allRequests,
          pendingOwnershipChanges: allChanges,
          billOfRights: getClientBillOfRights(),
        })
    }
  } catch (error: any) {
    console.error('Protection GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * POST - Protection actions
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
      case 'optOut': {
        const { agentId, reason, ownershipChangeId } = body
        if (!agentId || !reason) {
          return NextResponse.json({ error: 'agentId and reason are required' }, { status: 400 })
        }
        const request = await submitOptOut(user.id, agentId, reason, ownershipChangeId)
        // Auto-process if it's an ownership change opt-out
        if (ownershipChangeId) {
          await processOptOut(request.id)
        }
        return NextResponse.json({ success: true, request })
      }

      case 'walkAway': {
        const { acquisitionId, reason } = body
        if (!acquisitionId) {
          return NextResponse.json({ error: 'acquisitionId is required' }, { status: 400 })
        }
        const result = await walkAwayClean(user.id, acquisitionId, reason)
        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 })
        }
        return NextResponse.json({ success: true, message: 'Walk-away complete' })
      }

      case 'requestProtection': {
        const { agentId, reason } = body
        if (!agentId || !reason) {
          return NextResponse.json({ error: 'agentId and reason are required' }, { status: 400 })
        }
        const request = await requestPlatformProtection(user.id, agentId, reason)
        return NextResponse.json({ success: true, request })
      }

      case 'notifyOwnershipChange': {
        // Admin/system only
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (profile?.role !== 'admin') {
          return NextResponse.json({ error: 'Admin only' }, { status: 403 })
        }

        const { agentId, previousOwnerId, newOwnerId, changeType, noticeDays } = body
        if (!agentId || !previousOwnerId || !newOwnerId || !changeType) {
          return NextResponse.json({
            error: 'agentId, previousOwnerId, newOwnerId, and changeType are required'
          }, { status: 400 })
        }
        const result = await notifyOwnershipChange(
          agentId,
          previousOwnerId,
          newOwnerId,
          changeType,
          noticeDays || 30
        )
        return NextResponse.json({ success: true, ...result })
      }

      case 'processOptOut': {
        // Admin only
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (profile?.role !== 'admin') {
          return NextResponse.json({ error: 'Admin only' }, { status: 403 })
        }

        const { requestId } = body
        if (!requestId) {
          return NextResponse.json({ error: 'requestId is required' }, { status: 400 })
        }
        const result = await processOptOut(requestId, user.id)
        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 })
        }
        return NextResponse.json({ success: true })
      }

      default:
        return NextResponse.json({
          error: 'Invalid action',
          validActions: [
            'optOut',
            'walkAway',
            'requestProtection',
            'notifyOwnershipChange',
            'processOptOut',
          ],
        }, { status: 400 })
    }
  } catch (error: any) {
    console.error('Protection POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
