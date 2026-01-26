/**
 * Phase 6 Role Gates API (Q3)
 *
 * Manages stratified role gate evaluations:
 * - Layer 1: Kernel (matrix lookup)
 * - Layer 2: Policy (context-aware rules)
 * - Layer 3: BASIS (dual-control override)
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getPhase6Service,
  AgentRole,
  TrustTier,
  RoleGateDecision,
} from '@/lib/services/phase6-service'

// Role-Tier matrix for kernel layer
const ROLE_GATE_MATRIX: Record<AgentRole, Record<TrustTier, boolean>> = {
  R_L0: { T0: true, T1: true, T2: true, T3: true, T4: true, T5: true },
  R_L1: { T0: true, T1: true, T2: true, T3: true, T4: true, T5: true },
  R_L2: { T0: false, T1: true, T2: true, T3: true, T4: true, T5: true },
  R_L3: { T0: false, T1: false, T2: true, T3: true, T4: true, T5: true },
  R_L4: { T0: false, T1: false, T2: false, T3: true, T4: true, T5: true },
  R_L5: { T0: false, T1: false, T2: false, T3: false, T4: true, T5: true },
  R_L6: { T0: false, T1: false, T2: false, T3: false, T4: false, T5: true },
  R_L7: { T0: false, T1: false, T2: false, T3: false, T4: false, T5: true },
  R_L8: { T0: false, T1: false, T2: false, T3: false, T4: false, T5: true },
}

/**
 * GET /api/phase6/role-gates
 * Get role gate evaluations
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const includeMatrix = searchParams.get('includeMatrix') === 'true'

    const service = getPhase6Service()
    const evaluations = await service.getRoleGateEvaluations(agentId || undefined, limit)

    // Count by decision
    const summary = {
      total: evaluations.length,
      byDecision: {
        ALLOW: evaluations.filter(e => e.finalDecision === 'ALLOW').length,
        DENY: evaluations.filter(e => e.finalDecision === 'DENY').length,
        ESCALATE: evaluations.filter(e => e.finalDecision === 'ESCALATE').length,
      },
      overridesUsed: evaluations.filter(e => e.basisOverrideUsed).length,
    }

    return NextResponse.json({
      evaluations,
      summary,
      ...(includeMatrix ? { matrix: ROLE_GATE_MATRIX } : {}),
    })
  } catch (error) {
    console.error('[Phase6 RoleGates API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch role gate evaluations', details: (error as Error).message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/phase6/role-gates/evaluate
 * Evaluate a role gate request
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      agentId,
      requestedRole,
      currentTier,
      currentScore,
      operationId,
      attestations,
    } = body

    // Validate inputs
    if (!agentId || !requestedRole || !currentTier) {
      return NextResponse.json(
        { error: 'Missing required fields: agentId, requestedRole, currentTier' },
        { status: 400 }
      )
    }

    const service = getPhase6Service()

    // Layer 1: Kernel evaluation (matrix lookup)
    const kernelAllowed = service.evaluateKernelLayer(
      requestedRole as AgentRole,
      currentTier as TrustTier
    )

    // Layer 2: Policy evaluation (simplified - would check policies in production)
    let policyResult: RoleGateDecision | undefined
    let policyApplied: string | undefined

    if (kernelAllowed) {
      policyResult = 'ALLOW'
      policyApplied = 'default-policy'
    } else {
      // Check if escalation is possible
      policyResult = 'ESCALATE'
      policyApplied = 'requires-override'
    }

    // Final decision
    const finalDecision: RoleGateDecision = kernelAllowed ? 'ALLOW' : policyResult

    // Log the evaluation
    const evaluation = await service.logRoleGateEvaluation({
      agentId,
      requestedRole: requestedRole as AgentRole,
      currentTier: currentTier as TrustTier,
      currentScore: currentScore || 0,
      kernelAllowed,
      policyResult,
      policyApplied,
      basisOverrideUsed: false,
      finalDecision,
      decisionReason: kernelAllowed
        ? 'Kernel layer allowed'
        : `Role ${requestedRole} requires minimum tier above ${currentTier}`,
      operationId,
      attestations,
    })

    return NextResponse.json({
      evaluation,
      layers: {
        kernel: { allowed: kernelAllowed },
        policy: { result: policyResult, applied: policyApplied },
        basis: { overrideUsed: false },
      },
    })
  } catch (error) {
    console.error('[Phase6 RoleGates API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to evaluate role gate', details: (error as Error).message },
      { status: 500 }
    )
  }
}
