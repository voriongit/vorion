/**
 * HITL (Human-in-the-Loop) API
 *
 * GET /api/v1/governance/hitl - Get HITL status for agents
 * POST /api/v1/governance/hitl/check - Check if review required
 * POST /api/v1/governance/hitl/record - Record a proof (agreement/disagreement)
 *
 * Story 16-5: Proof Accumulation Tracker
 * Story 16-6: HITL Fade Logic
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { HITLService } from '@/lib/hitl';

// =============================================================================
// GET - Get HITL status
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const agentId = request.nextUrl.searchParams.get('agentId');

    if (agentId) {
      // Get status for specific agent
      const status = await HITLService.getAgentHITLStatus(agentId);
      const pendingReviews = await HITLService.getPendingReviews(agentId);

      return NextResponse.json({
        success: true,
        agentId,
        status,
        pendingReviews: pendingReviews.length,
      });
    }

    // Get all pending reviews for user's agents
    const pendingReviews = await HITLService.getPendingReviews();

    return NextResponse.json({
      success: true,
      pendingReviews,
    });
  } catch (error) {
    console.error('HITL status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Check review required OR record proof
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const action = body.action;

    // Handle different actions
    switch (action) {
      case 'check': {
        // Check if review is required
        if (!body.agentId || !body.actionType || !body.riskLevel) {
          return NextResponse.json(
            { error: 'agentId, actionType, and riskLevel are required' },
            { status: 400 }
          );
        }

        const result = await HITLService.checkReviewRequired({
          agentId: body.agentId,
          actionType: body.actionType,
          riskLevel: body.riskLevel,
        });

        return NextResponse.json({
          success: true,
          ...result,
        });
      }

      case 'record': {
        // Record a proof
        if (!body.agentId || !body.actionType || !body.riskLevel || !body.agentDecision) {
          return NextResponse.json(
            { error: 'agentId, actionType, riskLevel, and agentDecision are required' },
            { status: 400 }
          );
        }

        const proof = await HITLService.recordProof({
          agentId: body.agentId,
          actionType: body.actionType,
          riskLevel: body.riskLevel,
          agentDecision: body.agentDecision,
          humanDecision: body.humanDecision,
          reviewedBy: body.humanDecision ? user.id : undefined,
        });

        if (!proof) {
          return NextResponse.json(
            { error: 'Failed to record proof' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          proof,
        });
      }

      case 'createReview': {
        // Create a review request
        if (!body.agentId || !body.actionType || !body.actionData || !body.agentDecision || !body.riskLevel) {
          return NextResponse.json(
            { error: 'agentId, actionType, actionData, agentDecision, and riskLevel are required' },
            { status: 400 }
          );
        }

        const review = await HITLService.createReviewRequest(
          body.agentId,
          body.actionType,
          body.actionData,
          body.agentDecision,
          body.riskLevel
        );

        if (!review) {
          return NextResponse.json(
            { error: 'Failed to create review request' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          review,
        });
      }

      case 'submitReview': {
        // Submit a review decision
        if (!body.reviewId || !body.decision || !body.humanDecision) {
          return NextResponse.json(
            { error: 'reviewId, decision, and humanDecision are required' },
            { status: 400 }
          );
        }

        const success = await HITLService.submitReview(
          body.reviewId,
          body.decision,
          body.humanDecision,
          body.humanNotes,
          user.id
        );

        if (!success) {
          return NextResponse.json(
            { error: 'Failed to submit review' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          message: 'Review submitted successfully',
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: check, record, createReview, submitReview' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('HITL action error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
