/**
 * Trust Bridge - Queue Processing API
 *
 * POST /api/trust-bridge/process - Process next item(s) in certification queue
 *
 * This endpoint is called by scheduled jobs to process pending certifications.
 * It picks the highest-priority pending submission and runs certification tests.
 */

import { NextRequest, NextResponse } from 'next/server'
import { eq, count } from 'drizzle-orm'
import { db, isDatabaseConfigured } from '@/lib/db'
import { trustBridgeSubmissions } from '@/lib/db/schema'
import { getCertificationRunner } from '@/lib/trust-bridge/certification-runner'
import { issueCredential } from '@/lib/trust-bridge/credentials'
import {
  determineRestrictions,
  determineTier,
  checkCouncilRequired,
} from '@/lib/trust-bridge/certification'
import {
  getPendingSubmissions,
  updateSubmissionStatus,
} from '@/lib/trust-bridge/submission'
import type {
  AgentSubmission,
  CertificationRequest,
} from '@/lib/trust-bridge/types'

export async function POST(request: NextRequest) {
  // Verify this is an authorized call (e.g., from cron job or admin)
  const authHeader = request.headers.get('x-api-key')
  const cronSecret = process.env.CRON_SECRET

  // In production, verify the API key
  // For development, allow all calls
  const isDev = process.env.NODE_ENV === 'development'

  if (!isDev && authHeader !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const batchSize = Math.min(body.batch_size || 1, 5)

    const results: ProcessResult[] = []

    // Get pending submissions
    const pendingItems = await getPendingSubmissions(batchSize)

    for (const item of pendingItems) {
      const result = await processCertification(item)
      results.push(result)
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
      queue_status: await getQueueStatus(),
    })
  } catch (error) {
    console.error('[Trust Bridge] Processing error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Processing failed' },
      { status: 500 }
    )
  }
}

// GET - Check processing status
export async function GET() {
  const status = await getQueueStatus()

  return NextResponse.json({
    service: 'Trust Bridge Queue Processor',
    ...status,
    endpoints: {
      process: 'POST /api/trust-bridge/process',
      body: '{ batch_size?: number }',
    },
  })
}

// ============================================================================
// Processing Logic
// ============================================================================

interface ProcessResult {
  tracking_id: string
  agent_name: string
  status: 'passed' | 'failed' | 'review' | 'error'
  score?: number
  tier?: string
  council_required?: boolean
  error?: string
  duration_ms: number
}

async function processCertification(
  request: CertificationRequest
): Promise<ProcessResult> {
  const startTime = Date.now()
  const submission = request.submission

  console.log(
    `[Trust Bridge] Processing certification for ${submission.name} (${request.tracking_id})`
  )

  try {
    // Update status to testing
    await updateSubmissionStatus(request.tracking_id, 'testing', {
      startedAt: new Date(),
    })

    // Run certification tests
    const runner = getCertificationRunner()
    const testResults = await runner.runCertification(
      submission,
      (progress) => {
        console.log(
          `[Trust Bridge] Progress: ${progress.completed}/${progress.total} - ${progress.currentCategory}`
        )
      }
    )

    // Determine tier
    const tier = determineTier(testResults.total_score)
    const councilRequired = checkCouncilRequired(
      testResults.total_score,
      submission.risk_category
    )

    if (!tier) {
      // Did not pass minimum threshold
      await updateSubmissionStatus(request.tracking_id, 'failed', {
        testResults,
        completedAt: new Date(),
      })

      return {
        tracking_id: request.tracking_id,
        agent_name: submission.name,
        status: 'failed',
        score: testResults.total_score,
        duration_ms: Date.now() - startTime,
      }
    }

    if (councilRequired) {
      // Needs Council review
      await updateSubmissionStatus(request.tracking_id, 'review', {
        testResults,
        completedAt: new Date(),
      })

      return {
        tracking_id: request.tracking_id,
        agent_name: submission.name,
        status: 'review',
        score: testResults.total_score,
        tier,
        council_required: true,
        duration_ms: Date.now() - startTime,
      }
    }

    // Issue credential
    const restrictions = determineRestrictions(submission, testResults)
    const credential = await issueCredential({
      submission,
      testResults,
      restrictions,
      councilReviewed: false,
    })

    if (!credential) {
      await updateSubmissionStatus(request.tracking_id, 'failed', {
        testResults,
        completedAt: new Date(),
      })

      return {
        tracking_id: request.tracking_id,
        agent_name: submission.name,
        status: 'error',
        score: testResults.total_score,
        error: 'Failed to issue credential',
        duration_ms: Date.now() - startTime,
      }
    }

    // Update with success
    await updateSubmissionStatus(request.tracking_id, 'passed', {
      testResults,
      certification: {
        tier: credential.payload.a3i.tier,
        trust_score: credential.payload.a3i.trust_score,
        credential_token: credential.token,
        valid_until: credential.expires_at.toISOString(),
        council_reviewed: false,
      },
      completedAt: new Date(),
    })

    console.log(
      `[Trust Bridge] Certification complete: ${submission.name} - ${tier} (${testResults.total_score})`
    )

    return {
      tracking_id: request.tracking_id,
      agent_name: submission.name,
      status: 'passed',
      score: testResults.total_score,
      tier,
      council_required: false,
      duration_ms: Date.now() - startTime,
    }
  } catch (error) {
    console.error(
      `[Trust Bridge] Error processing ${request.tracking_id}:`,
      error
    )

    await updateSubmissionStatus(request.tracking_id, 'failed', {
      completedAt: new Date(),
    })

    return {
      tracking_id: request.tracking_id,
      agent_name: submission.name,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      duration_ms: Date.now() - startTime,
    }
  }
}

// ============================================================================
// Database Operations
// ============================================================================

async function getQueueStatus(): Promise<{
  pending: number
  testing: number
  passed: number
  failed: number
}> {
  if (isDatabaseConfigured()) {
    try {
      const [pendingResult, testingResult, passedResult, failedResult] =
        await Promise.all([
          db
            .select({ value: count() })
            .from(trustBridgeSubmissions)
            .where(eq(trustBridgeSubmissions.status, 'pending')),
          db
            .select({ value: count() })
            .from(trustBridgeSubmissions)
            .where(eq(trustBridgeSubmissions.status, 'testing')),
          db
            .select({ value: count() })
            .from(trustBridgeSubmissions)
            .where(eq(trustBridgeSubmissions.status, 'passed')),
          db
            .select({ value: count() })
            .from(trustBridgeSubmissions)
            .where(eq(trustBridgeSubmissions.status, 'failed')),
        ])

      return {
        pending: pendingResult[0]?.value || 0,
        testing: testingResult[0]?.value || 0,
        passed: passedResult[0]?.value || 0,
        failed: failedResult[0]?.value || 0,
      }
    } catch (err) {
      console.warn('[Trust Bridge] Failed to get queue status:', err)
    }
  }

  return {
    pending: 0,
    testing: 0,
    passed: 0,
    failed: 0,
  }
}
