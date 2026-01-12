/**
 * Trust Decay Cron Job Endpoint
 * Story 4-4: Trust Decay & Autonomy Limits (FR56)
 *
 * This endpoint should be called by a scheduled job (e.g., Vercel Cron)
 * daily to process trust score decay for inactive agents.
 *
 * POST /api/cron/decay
 *
 * Security: Requires CRON_SECRET header for authorization
 */

import { NextRequest, NextResponse } from 'next/server'
import { processDecayBatch, DECAY_CONFIG } from '@/lib/agents/decay-service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Allow up to 60 seconds for batch processing

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret (for Vercel Cron or other schedulers)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    // Allow requests from localhost for development
    const isLocalhost = request.headers.get('host')?.includes('localhost')

    if (!isLocalhost && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('[Decay Cron] Starting decay batch processing...')
    const startTime = Date.now()

    const result = await processDecayBatch()

    const duration = Date.now() - startTime

    console.log('[Decay Cron] Completed:', {
      processed: result.processed,
      decayed: result.decayed,
      skipped: result.skipped,
      errors: result.errors,
      probationTriggered: result.probationTriggered.length,
      durationMs: duration,
    })

    return NextResponse.json({
      success: true,
      config: {
        inactivityThresholdDays: DECAY_CONFIG.inactivityThresholdDays,
        decayPointsPerDay: DECAY_CONFIG.decayPointsPerDay,
      },
      stats: {
        processed: result.processed,
        decayed: result.decayed,
        skipped: result.skipped,
        errors: result.errors,
        probationTriggered: result.probationTriggered.length,
      },
      durationMs: duration,
      // Include details for debugging
      decayedAgents: result.results.map(r => ({
        agentId: r.agentId,
        agentName: r.agentName,
        previousScore: r.previousScore,
        newScore: r.newScore,
        decayAmount: r.decayAmount,
        tierChanged: r.tierChanged,
        triggeredProbation: r.triggeredProbation,
      })),
    })
  } catch (error) {
    console.error('[Decay Cron] Error:', error)
    return NextResponse.json(
      { error: 'Failed to process decay', details: String(error) },
      { status: 500 }
    )
  }
}

// Also support GET for Vercel Cron
export async function GET(request: NextRequest) {
  return POST(request)
}
