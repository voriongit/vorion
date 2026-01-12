/**
 * Global Kill Switch API
 *
 * POST /api/v1/governance/kill-switch - Activate kill switch
 * DELETE /api/v1/governance/kill-switch - Deactivate kill switch
 * GET /api/v1/governance/kill-switch - Get current state
 *
 * Story 16-2: Global Kill Switch
 * Council Priority #3 (39 points)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CircuitBreakerService } from '@/lib/circuit-breaker/circuit-breaker-service';
import { KillSwitchScope } from '@/lib/circuit-breaker/types';

// =============================================================================
// POST - Activate kill switch
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

    // TODO: Add admin check - for now any authenticated user can activate
    // In production, this should be restricted to admins only

    const body = await request.json();

    if (!body.reason || typeof body.reason !== 'string') {
      return NextResponse.json(
        { error: 'reason is required and must be a string' },
        { status: 400 }
      );
    }

    // Validate scope if provided
    const validScopes = ['all'];
    const scopePattern = /^(tier:|specialization:).+/;
    if (body.scope && body.scope !== 'all' && !scopePattern.test(body.scope)) {
      return NextResponse.json(
        { error: 'Invalid scope. Use "all", "tier:<tier-name>", or "specialization:<spec-name>"' },
        { status: 400 }
      );
    }

    const result = await CircuitBreakerService.activateKillSwitch({
      reason: body.reason,
      scope: (body.scope as KillSwitchScope) || 'all',
    }, user.id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Kill switch activated',
      state: result.state,
      affectedAgents: result.affectedCount,
    });
  } catch (error) {
    console.error('Kill switch activation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE - Deactivate kill switch
// =============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // TODO: Add admin check

    const notes = request.nextUrl.searchParams.get('notes') || undefined;

    const result = await CircuitBreakerService.deactivateKillSwitch({
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
      message: 'Kill switch deactivated. Agents remain paused until manually resumed.',
    });
  } catch (error) {
    console.error('Kill switch deactivation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET - Get current state
// =============================================================================

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const state = await CircuitBreakerService.getKillSwitchState();

    return NextResponse.json({
      success: true,
      isActive: state?.isActive || false,
      state,
    });
  } catch (error) {
    console.error('Kill switch state error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
