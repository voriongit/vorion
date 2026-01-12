/**
 * Circuit Breaker API
 * GET - Get pause status for agents
 * POST - Pause/resume agents, manage kill switch
 *
 * Epic 16: Circuit Breaker
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import CircuitBreakerService from '@/lib/circuit-breaker/circuit-breaker-service'

/**
 * GET - Get circuit breaker status
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')
    const action = searchParams.get('action')

    // Get kill switch status
    if (action === 'killSwitch') {
      const state = await CircuitBreakerService.getKillSwitchState()
      return NextResponse.json({
        success: true,
        killSwitch: state || { isActive: false },
      })
    }

    // Get events for an agent
    if (action === 'events' && agentId) {
      const events = await CircuitBreakerService.getEvents(agentId)
      return NextResponse.json({
        success: true,
        events,
      })
    }

    // Check if agent is blocked by kill switch
    if (action === 'checkBlocked' && agentId) {
      const blocked = await CircuitBreakerService.isBlockedByKillSwitch(agentId)
      return NextResponse.json({
        success: true,
        ...blocked,
      })
    }

    // Get pause state for specific agent
    if (agentId) {
      const pauseState = await CircuitBreakerService.getAgentPauseState(agentId)
      return NextResponse.json({
        success: true,
        pauseState: pauseState || { agentId, isPaused: false },
      })
    }

    // Get all paused agents for user
    const pausedAgents = await CircuitBreakerService.getPausedAgents(user.id)
    return NextResponse.json({
      success: true,
      pausedAgents,
    })
  } catch (error: any) {
    console.error('Circuit breaker GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * POST - Circuit breaker actions
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
      case 'pause': {
        const { agentId, reason, notes, expiresAt, cascadeToDependent } = body
        if (!agentId) {
          return NextResponse.json({ error: 'agentId is required' }, { status: 400 })
        }
        if (!reason) {
          return NextResponse.json({ error: 'reason is required' }, { status: 400 })
        }

        const result = await CircuitBreakerService.pauseAgent({
          agentId,
          reason,
          notes,
          expiresAt: expiresAt ? new Date(expiresAt) : undefined,
          cascadeToDependent,
        }, user.id)

        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 })
        }

        return NextResponse.json({
          success: true,
          message: 'Agent paused',
          event: result.event,
          cascadedAgents: result.cascadedAgents,
        })
      }

      case 'resume': {
        const { agentId, notes } = body
        if (!agentId) {
          return NextResponse.json({ error: 'agentId is required' }, { status: 400 })
        }

        const result = await CircuitBreakerService.resumeAgent({
          agentId,
          notes,
        }, user.id)

        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 })
        }

        return NextResponse.json({
          success: true,
          message: 'Agent resumed',
          event: result.event,
        })
      }

      case 'activateKillSwitch': {
        const { reason, scope } = body
        if (!reason) {
          return NextResponse.json({ error: 'reason is required' }, { status: 400 })
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

        const result = await CircuitBreakerService.activateKillSwitch({
          reason,
          scope,
        }, user.id)

        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 })
        }

        return NextResponse.json({
          success: true,
          message: 'Kill switch activated',
          state: result.state,
          affectedCount: result.affectedCount,
        })
      }

      case 'deactivateKillSwitch': {
        const { notes } = body

        // Admin only
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (profile?.role !== 'admin') {
          return NextResponse.json({ error: 'Admin only' }, { status: 403 })
        }

        const result = await CircuitBreakerService.deactivateKillSwitch({
          notes,
        }, user.id)

        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 })
        }

        return NextResponse.json({
          success: true,
          message: 'Kill switch deactivated',
        })
      }

      case 'processExpiredPauses': {
        // Admin/cron only
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (profile?.role !== 'admin') {
          return NextResponse.json({ error: 'Admin only' }, { status: 403 })
        }

        const result = await CircuitBreakerService.processExpiredPauses()
        return NextResponse.json({
          success: true,
          processed: result.processed,
          errors: result.errors,
        })
      }

      default:
        return NextResponse.json({
          error: 'Invalid action',
          validActions: [
            'pause',
            'resume',
            'activateKillSwitch',
            'deactivateKillSwitch',
            'processExpiredPauses',
          ],
        }, { status: 400 })
    }
  } catch (error: any) {
    console.error('Circuit breaker POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
