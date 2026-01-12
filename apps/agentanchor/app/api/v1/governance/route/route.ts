/**
 * Risk×Trust Matrix Router API
 *
 * POST /api/v1/governance/route - Route an action through the matrix
 * GET /api/v1/governance/route - Get the full matrix visualization
 *
 * @see lib/governance/matrix-router.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { MatrixRouter } from '@/lib/governance/matrix-router';
import { RiskLevel, TrustTier } from '@/lib/governance/types';

// =============================================================================
// POST - Route an action
// =============================================================================

interface RouteRequestBody {
  trustScore: number;
  riskLevel: RiskLevel;
  actionType: string;
  agentId?: string;
  context?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    const body: RouteRequestBody = await request.json();

    // Validate required fields
    if (typeof body.trustScore !== 'number') {
      return NextResponse.json(
        { error: 'trustScore is required and must be a number' },
        { status: 400 }
      );
    }

    if (!body.riskLevel || !['low', 'medium', 'high', 'critical'].includes(body.riskLevel)) {
      return NextResponse.json(
        { error: 'riskLevel is required and must be one of: low, medium, high, critical' },
        { status: 400 }
      );
    }

    if (!body.actionType || typeof body.actionType !== 'string') {
      return NextResponse.json(
        { error: 'actionType is required and must be a string' },
        { status: 400 }
      );
    }

    // Validate trust score range
    if (body.trustScore < 0 || body.trustScore > 1000) {
      return NextResponse.json(
        { error: 'trustScore must be between 0 and 1000' },
        { status: 400 }
      );
    }

    // Determine agent tier from trust score
    const agentTier = getTierFromScore(body.trustScore);

    // Route the action through the matrix
    const result = MatrixRouter.route({
      trustScore: body.trustScore,
      riskLevel: body.riskLevel,
      agentTier,
      actionType: body.actionType,
      context: body.context,
    });

    // If YELLOW path, also run policy check
    let policyResult = null;
    if (result.route.path === 'yellow' && body.context) {
      policyResult = MatrixRouter.checkPolicy({
        actionType: body.actionType,
        agentId: body.agentId || 'unknown',
        trustScore: body.trustScore,
        context: body.context,
      });
    }

    // Convert to governance decision format
    const governanceDecision = MatrixRouter.toGovernanceDecision(result);

    return NextResponse.json({
      success: true,
      routing: {
        path: result.route.path,
        pathName: result.route.pathName,
        description: result.route.description,
        autoApprove: result.route.autoApprove,
        requiresCouncil: result.route.requiresCouncil,
        requiresHuman: result.route.requiresHuman,
        maxLatencyMs: result.route.maxLatencyMs,
      },
      input: {
        trustScore: body.trustScore,
        riskLevel: body.riskLevel,
        agentTier,
        actionType: body.actionType,
      },
      result: {
        canProceed: result.canProceed,
        nextAction: result.nextAction,
        reasoning: result.reasoning,
      },
      policyCheck: policyResult,
      governanceDecision,
    });
  } catch (error) {
    console.error('Matrix routing error:', error);
    return NextResponse.json(
      { error: 'Internal server error during routing' },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET - Get the full matrix
// =============================================================================

export async function GET() {
  try {
    const matrix = MatrixRouter.getMatrix();

    // Format matrix for visualization
    const formattedMatrix = {
      trustLevels: ['900+ (Certified)', '800+ (Verified)', '600+ (Trusted)', '400+ (Established)', '200+ (Provisional)', '0+ (Untrusted)'],
      riskLevels: ['Low', 'Medium', 'High', 'Critical'],
      cells: matrix,
      routes: MatrixRouter.ROUTES,
      legend: {
        green: {
          name: 'Express Path',
          description: 'Auto-approve with async logging',
          color: '#22c55e',
        },
        yellow: {
          name: 'Standard Path',
          description: 'Policy validation required',
          color: '#eab308',
        },
        red: {
          name: 'Full Governance',
          description: 'Council consensus or human review',
          color: '#ef4444',
        },
      },
    };

    return NextResponse.json({
      success: true,
      matrix: formattedMatrix,
    });
  } catch (error) {
    console.error('Matrix fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error fetching matrix' },
      { status: 500 }
    );
  }
}

// =============================================================================
// Helpers
// =============================================================================

function getTierFromScore(score: number): TrustTier {
  if (score >= 900) return 'certified';
  if (score >= 800) return 'verified';
  if (score >= 600) return 'trusted';
  if (score >= 400) return 'established';
  if (score >= 200) return 'provisional';
  return 'untrusted';
}
