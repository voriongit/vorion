/**
 * Maintenance Delegation API
 * GET - Get delegations
 * POST - Create/manage delegations
 *
 * Epic 12: Maintenance Delegation
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  createDelegation,
  revokeDelegation,
  resignDelegation,
  updateDelegatePermissions,
  getTrainerDelegations,
  getDelegateDelegations,
  checkDelegatePermission,
  type DelegatePermissions,
} from '@/lib/delegation'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role') || 'both'

    const result: any = {}

    if (role === 'trainer' || role === 'both') {
      result.asTrainer = await getTrainerDelegations(user.id)
    }

    if (role === 'delegate' || role === 'both') {
      result.asDelegate = await getDelegateDelegations(user.id)
    }

    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    console.error('Delegation GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

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
      case 'create': {
        const { agentId, delegateId, permissions, expiresInDays, reason } = body
        if (!agentId || !delegateId) {
          return NextResponse.json({ error: 'agentId and delegateId are required' }, { status: 400 })
        }
        const delegation = await createDelegation(user.id, {
          agentId,
          delegateId,
          permissions,
          expiresInDays,
          reason,
        })
        return NextResponse.json({ success: true, delegation })
      }

      case 'revoke': {
        const { delegationId, reason } = body
        if (!delegationId) {
          return NextResponse.json({ error: 'delegationId is required' }, { status: 400 })
        }
        await revokeDelegation(user.id, delegationId, reason)
        return NextResponse.json({ success: true, message: 'Delegation revoked' })
      }

      case 'resign': {
        const { delegationId, reason } = body
        if (!delegationId) {
          return NextResponse.json({ error: 'delegationId is required' }, { status: 400 })
        }
        await resignDelegation(user.id, delegationId, reason)
        return NextResponse.json({ success: true, message: 'Delegation resigned' })
      }

      case 'updatePermissions': {
        const { delegationId, permissions } = body
        if (!delegationId || !permissions) {
          return NextResponse.json({ error: 'delegationId and permissions are required' }, { status: 400 })
        }
        await updateDelegatePermissions(user.id, delegationId, permissions as Partial<DelegatePermissions>)
        return NextResponse.json({ success: true, message: 'Permissions updated' })
      }

      case 'checkPermission': {
        const { agentId, permission } = body
        if (!agentId || !permission) {
          return NextResponse.json({ error: 'agentId and permission are required' }, { status: 400 })
        }
        const hasPermission = await checkDelegatePermission(user.id, agentId, permission)
        return NextResponse.json({ success: true, hasPermission })
      }

      default:
        return NextResponse.json({
          error: 'Invalid action',
          validActions: ['create', 'revoke', 'resign', 'updatePermissions', 'checkPermission'],
        }, { status: 400 })
    }
  } catch (error: any) {
    console.error('Delegation POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
