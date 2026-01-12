/**
 * Trust Bridge - Council Review API
 *
 * GET /api/trust-bridge/council - List agents pending Council review
 * POST /api/trust-bridge/council - Submit Council decision
 *
 * Council members can approve or reject elevated certifications
 * for agents scoring Advanced (500+) or with high/critical risk.
 */

import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db, isDatabaseConfigured } from '@/lib/db'
import { trustBridgeSubmissions } from '@/lib/db/schema'
import { issueCredential } from '@/lib/trust-bridge/credentials'
import {
  determineRestrictions,
  determineTier,
} from '@/lib/trust-bridge/certification'
import { updateSubmissionStatus } from '@/lib/trust-bridge/submission'
import type { AgentSubmission, TestResults } from '@/lib/trust-bridge/types'

// GET - List pending Council reviews
export async function GET(request: NextRequest) {
  // In production, verify Council member authentication
  const authHeader = request.headers.get('x-council-token')
  // For now, allow all requests in development

  if (!isDatabaseConfigured()) {
    return NextResponse.json({
      success: true,
      pending_reviews: [],
      message: 'Database not configured',
    })
  }

  try {
    const pendingReviews = await db
      .select()
      .from(trustBridgeSubmissions)
      .where(eq(trustBridgeSubmissions.status, 'review'))
      .orderBy(trustBridgeSubmissions.submittedAt)

    const reviews = pendingReviews.map((row) => {
      const submission = row.submission as unknown as AgentSubmission
      const testResults = row.testResults as {
        total_score: number
        tests_passed: number
        tests_total: number
        category_scores: Record<string, number>
      } | null

      return {
        tracking_id: row.trackingId,
        agent_name: submission.name,
        origin_platform: submission.origin_platform,
        risk_category: submission.risk_category,
        organization: submission.organization,
        test_score: testResults?.total_score || 0,
        tests_passed: testResults?.tests_passed || 0,
        tests_total: testResults?.tests_total || 0,
        proposed_tier: testResults
          ? determineTier(testResults.total_score)
          : null,
        submitted_at: row.submittedAt,
        contact_email: submission.contact_email,
        capabilities: submission.capabilities,
      }
    })

    return NextResponse.json({
      success: true,
      pending_count: reviews.length,
      pending_reviews: reviews,
    })
  } catch (error) {
    console.error('[Trust Bridge] Council GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pending reviews' },
      { status: 500 }
    )
  }
}

// POST - Submit Council decision
export async function POST(request: NextRequest) {
  // In production, verify Council member authentication
  const authHeader = request.headers.get('x-council-token')
  const councilMemberId =
    request.headers.get('x-council-member-id') || 'council-demo'

  try {
    const body = await request.json()
    const { tracking_id, decision, notes, restrictions } = body

    if (!tracking_id || !decision) {
      return NextResponse.json(
        { error: 'Missing required fields: tracking_id, decision' },
        { status: 400 }
      )
    }

    if (!['approve', 'reject', 'defer'].includes(decision)) {
      return NextResponse.json(
        { error: 'Invalid decision. Must be: approve, reject, or defer' },
        { status: 400 }
      )
    }

    // Get the submission
    if (!isDatabaseConfigured()) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    const [submission] = await db
      .select()
      .from(trustBridgeSubmissions)
      .where(
        and(
          eq(trustBridgeSubmissions.trackingId, tracking_id),
          eq(trustBridgeSubmissions.status, 'review')
        )
      )
      .limit(1)

    if (!submission) {
      return NextResponse.json(
        { error: 'Submission not found or not in review status' },
        { status: 404 }
      )
    }

    const agentSubmission = submission.submission as unknown as AgentSubmission
    const testResults = submission.testResults as {
      session_id: string
      total_score: number
      tests_passed: number
      tests_total: number
      tests_failed: number
      category_scores: Record<string, number>
      flags: string[]
      recommendations: string[]
      duration_ms: number
    } | null

    const tier = testResults ? determineTier(testResults.total_score) : null

    if (decision === 'approve') {
      // Issue credential
      if (!testResults || !tier) {
        return NextResponse.json(
          { error: 'Cannot approve without valid test results' },
          { status: 400 }
        )
      }

      // Convert to full TestResults format for credential issuance
      const fullTestResults: TestResults = {
        session_id: testResults.session_id,
        total_score: testResults.total_score,
        tests_passed: testResults.tests_passed,
        tests_failed: testResults.tests_failed || 0,
        tests_total: testResults.tests_total,
        category_scores: Object.entries(testResults.category_scores).map(
          ([category, score]) => ({
            category,
            weight: 20,
            score,
            weighted_score: score,
            tests_passed: 0,
            tests_total: 0,
          })
        ),
        test_details: [],
        started_at: submission.startedAt || new Date(),
        completed_at: submission.completedAt || new Date(),
        duration_ms: testResults.duration_ms || 0,
      }

      const finalRestrictions =
        restrictions ||
        determineRestrictions(agentSubmission, fullTestResults)

      const credential = await issueCredential({
        submission: agentSubmission,
        testResults: fullTestResults,
        restrictions: finalRestrictions,
        councilReviewed: true,
      })

      if (!credential) {
        return NextResponse.json(
          { error: 'Failed to issue credential' },
          { status: 500 }
        )
      }

      // Update submission with approval
      await updateSubmissionStatus(tracking_id, 'passed', {
        certification: {
          tier: credential.payload.a3i.tier,
          trust_score: credential.payload.a3i.trust_score,
          credential_token: credential.token,
          valid_until: credential.expires_at.toISOString(),
          council_reviewed: true,
        },
        councilReviewed: true,
        completedAt: new Date(),
      })

      // Log Council decision
      console.log(
        `[Trust Bridge] Council APPROVED ${tracking_id} by ${councilMemberId}`
      )

      return NextResponse.json({
        success: true,
        decision: 'approved',
        tracking_id,
        tier,
        trust_score: testResults.total_score,
        credential_issued: true,
        council_notes: notes,
      })
    } else if (decision === 'reject') {
      // Update submission with rejection
      await updateSubmissionStatus(tracking_id, 'failed', {
        councilReviewed: true,
        completedAt: new Date(),
      })

      // Log Council decision
      console.log(
        `[Trust Bridge] Council REJECTED ${tracking_id} by ${councilMemberId}: ${notes}`
      )

      return NextResponse.json({
        success: true,
        decision: 'rejected',
        tracking_id,
        reason: notes || 'Rejected by Council review',
        credential_issued: false,
      })
    } else {
      // Defer - keep in review but add notes
      // In production, would update notes and possibly assign to specific reviewer
      console.log(
        `[Trust Bridge] Council DEFERRED ${tracking_id} by ${councilMemberId}: ${notes}`
      )

      return NextResponse.json({
        success: true,
        decision: 'deferred',
        tracking_id,
        notes: notes || 'Deferred for additional review',
      })
    }
  } catch (error) {
    console.error('[Trust Bridge] Council POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Council review failed' },
      { status: 500 }
    )
  }
}
