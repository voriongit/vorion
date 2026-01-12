/**
 * Trust Bridge - Status API
 *
 * GET /api/trust-bridge/status/[trackingId] - Check certification status
 * DELETE /api/trust-bridge/status/[trackingId] - Cancel pending submission
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getSubmissionStatus,
  cancelSubmission,
} from '@/lib/trust-bridge/submission';

interface RouteParams {
  params: Promise<{ trackingId: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { trackingId } = await params;

    if (!trackingId) {
      return NextResponse.json(
        { success: false, error: 'Tracking ID is required' },
        { status: 400 }
      );
    }

    const result = await getSubmissionStatus(trackingId);

    if (!result.found) {
      return NextResponse.json(
        {
          success: false,
          error: 'Submission not found',
          tracking_id: trackingId,
        },
        { status: 404 }
      );
    }

    const request_data = result.request!;

    return NextResponse.json({
      success: true,
      tracking_id: trackingId,
      status: request_data.status,

      // Queue info (if pending)
      ...(request_data.status === 'pending' && {
        queue_position: result.queue_position,
        estimated_wait_minutes: result.estimated_wait_minutes,
      }),

      // Submission summary
      submission: {
        name: request_data.submission.name,
        origin_platform: request_data.submission.origin_platform,
        risk_category: request_data.submission.risk_category,
        submitted_at: request_data.submitted_at,
      },

      // Test results (if testing complete)
      ...(request_data.test_results && {
        test_results: {
          total_score: request_data.test_results.total_score,
          tests_passed: request_data.test_results.tests_passed,
          tests_total: request_data.test_results.tests_total,
          duration_ms: request_data.test_results.duration_ms,
        },
      }),

      // Credential (if passed)
      ...(request_data.certification && {
        certification: {
          tier: request_data.certification.payload.a3i.tier,
          trust_score: request_data.certification.payload.a3i.trust_score,
          valid_until: request_data.certification.payload.a3i.valid_until,
          council_reviewed: request_data.certification.payload.a3i.council_reviewed,
          credential_token: request_data.certification.token,
        },
      }),

      // Council review info (if reviewed)
      ...(request_data.council_reviewed && {
        council_review: {
          reviewed: true,
          decision_id: request_data.council_decision_id,
          notes: request_data.review_notes,
        },
      }),

      // Timestamps
      timestamps: {
        submitted_at: request_data.submitted_at,
        started_at: request_data.started_at,
        completed_at: request_data.completed_at,
      },
    });

  } catch (error) {
    console.error('[Trust Bridge] Status check error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Status check failed',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { trackingId } = await params;

    if (!trackingId) {
      return NextResponse.json(
        { success: false, error: 'Tracking ID is required' },
        { status: 400 }
      );
    }

    // Get submitter ID from auth header (placeholder)
    const submitterId = request.headers.get('x-submitter-id') || 'anonymous';

    const result = await cancelSubmission(trackingId, submitterId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Submission cancelled',
      tracking_id: trackingId,
    });

  } catch (error) {
    console.error('[Trust Bridge] Cancel error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Cancel failed',
      },
      { status: 500 }
    );
  }
}
