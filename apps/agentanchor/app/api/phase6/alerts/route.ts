/**
 * Phase 6 Gaming Alerts API (Q1)
 *
 * Manages gaming detection alerts:
 * - Rapid change detection
 * - Oscillation detection
 * - Boundary testing detection
 * - Ceiling breach detection
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getPhase6Service,
  AlertStatus,
  GamingAlertType,
  AlertSeverity,
} from '@/lib/services/phase6-service'

/**
 * GET /api/phase6/alerts
 * Get gaming alerts
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as AlertStatus | null
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const service = getPhase6Service()
    const alerts = await service.getGamingAlerts(status || undefined, limit)

    // Summarize by status and severity
    const summary = {
      total: alerts.length,
      byStatus: {
        ACTIVE: alerts.filter(a => a.status === 'ACTIVE').length,
        INVESTIGATING: alerts.filter(a => a.status === 'INVESTIGATING').length,
        RESOLVED: alerts.filter(a => a.status === 'RESOLVED').length,
        FALSE_POSITIVE: alerts.filter(a => a.status === 'FALSE_POSITIVE').length,
      },
      bySeverity: {
        CRITICAL: alerts.filter(a => a.severity === 'CRITICAL').length,
        HIGH: alerts.filter(a => a.severity === 'HIGH').length,
        MEDIUM: alerts.filter(a => a.severity === 'MEDIUM').length,
        LOW: alerts.filter(a => a.severity === 'LOW').length,
      },
      byType: {
        RAPID_CHANGE: alerts.filter(a => a.alertType === 'RAPID_CHANGE').length,
        OSCILLATION: alerts.filter(a => a.alertType === 'OSCILLATION').length,
        BOUNDARY_TESTING: alerts.filter(a => a.alertType === 'BOUNDARY_TESTING').length,
        CEILING_BREACH: alerts.filter(a => a.alertType === 'CEILING_BREACH').length,
      },
    }

    return NextResponse.json({ alerts, summary })
  } catch (error) {
    console.error('[Phase6 Alerts API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch gaming alerts', details: (error as Error).message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/phase6/alerts
 * Create a new gaming alert
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      agentId,
      alertType,
      severity,
      details,
      occurrences,
      thresholdValue,
      actualValue,
      windowStart,
      windowEnd,
    } = body

    // Validate required fields
    if (!agentId || !alertType || !severity || !details) {
      return NextResponse.json(
        { error: 'Missing required fields: agentId, alertType, severity, details' },
        { status: 400 }
      )
    }

    const service = getPhase6Service()

    const alert = await service.createGamingAlert({
      agentId,
      alertType: alertType as GamingAlertType,
      severity: severity as AlertSeverity,
      status: 'ACTIVE',
      details,
      occurrences: occurrences || 1,
      thresholdValue,
      actualValue,
      windowStart: windowStart || new Date().toISOString(),
      windowEnd: windowEnd || new Date().toISOString(),
    })

    return NextResponse.json({ alert }, { status: 201 })
  } catch (error) {
    console.error('[Phase6 Alerts API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to create gaming alert', details: (error as Error).message },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/phase6/alerts
 * Update alert status
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { alertId, status, resolvedBy, resolutionNotes } = body

    if (!alertId || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: alertId, status' },
        { status: 400 }
      )
    }

    const service = getPhase6Service()

    const alert = await service.updateGamingAlertStatus(
      alertId,
      status as AlertStatus,
      resolvedBy,
      resolutionNotes
    )

    return NextResponse.json({ alert })
  } catch (error) {
    console.error('[Phase6 Alerts API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to update gaming alert', details: (error as Error).message },
      { status: 500 }
    )
  }
}
