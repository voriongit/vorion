/**
 * Agent Pause/Resume API
 *
 * POST /api/v1/agents/[agentId]/pause - Pause an agent
 * DELETE /api/v1/agents/[agentId]/pause - Resume an agent
 * GET /api/v1/agents/[agentId]/pause - Get pause state
 *
 * Story 16-1: Agent Pause/Resume
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CircuitBreakerService } from '@/lib/circuit-breaker/circuit-breaker-service';
import { PauseReason } from '@/lib/circuit-breaker/types';

// Valid pause reasons
const VALID_PAUSE_REASONS: PauseReason[] = [
  'investigation',
  'maintenance',
  'consumer_request',
  'circuit_breaker',
  'cascade_halt',
  'emergency_stop',
  'other',
];

// =============================================================================
// POST - Pause an agent
// =============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { agentId } = await params;
    const body = await request.json();

    // Validate reason
    if (!body.reason || !VALID_PAUSE_REASONS.includes(body.reason)) {
      return NextResponse.json(
        { error: `Invalid reason. Must be one of: ${VALID_PAUSE_REASONS.join(', ')}` },
        { status: 400 }
      );
    }

    // Parse expiration date if provided
    let expiresAt: Date | undefined;
    if (body.expiresAt) {
      expiresAt = new Date(body.expiresAt);
      if (isNaN(expiresAt.getTime())) {
        return NextResponse.json(
          { error: 'Invalid expiresAt date format' },
          { status: 400 }
        );
      }
      if (expiresAt <= new Date()) {
        return NextResponse.json(
          { error: 'expiresAt must be in the future' },
          { status: 400 }
        );
      }
    }

    // Pause the agent
    const result = await CircuitBreakerService.pauseAgent({
      agentId,
      reason: body.reason as PauseReason,
      notes: body.notes,
      expiresAt,
      cascadeToDependent: body.cascadeToDependent ?? false,
    }, user.id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Agent paused successfully',
      agentId: result.agentId,
      event: result.event,
      cascadedAgents: result.cascadedAgents,
    });
  } catch (error) {
    console.error('Pause agent error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE - Resume an agent
// =============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { agentId } = await params;

    // Get optional notes from query params
    const notes = request.nextUrl.searchParams.get('notes') || undefined;

    // Resume the agent
    const result = await CircuitBreakerService.resumeAgent({
      agentId,
      notes,
    }, user.id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Agent resumed successfully',
      agentId: result.agentId,
      event: result.event,
    });
  } catch (error) {
    console.error('Resume agent error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET - Get pause state
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { agentId } = await params;

    // Get pause state
    const pauseState = await CircuitBreakerService.getAgentPauseState(agentId);

    if (!pauseState) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Get recent events
    const events = await CircuitBreakerService.getEvents(agentId, 10);

    return NextResponse.json({
      success: true,
      pauseState,
      recentEvents: events,
    });
  } catch (error) {
    console.error('Get pause state error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
