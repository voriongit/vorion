/**
 * Phase 6 Context Hierarchy API (Q2)
 *
 * Manages the 4-tier hierarchical context:
 * - Tier 1: Deployment (IMMUTABLE)
 * - Tier 2: Organization (LOCKED after grace)
 * - Tier 3: Agent (FROZEN on registration)
 * - Tier 4: Operation (EPHEMERAL)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPhase6Service } from '@/lib/services/phase6-service'

/**
 * GET /api/phase6/context
 * Get context hierarchy data
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const deploymentId = searchParams.get('deploymentId')
    const orgId = searchParams.get('orgId')
    const agentId = searchParams.get('agentId')
    const tier = searchParams.get('tier')

    const service = getPhase6Service()

    let data: unknown

    switch (tier) {
      case 'deployment':
        data = await service.getDeploymentContexts()
        break
      case 'organization':
        data = await service.getOrgContexts(deploymentId || undefined)
        break
      case 'agent':
        data = await service.getAgentContexts(deploymentId || undefined, orgId || undefined)
        break
      case 'operation':
        data = await service.getOperationContexts(agentId || undefined, true)
        break
      default:
        // Return full hierarchy
        const [deployments, organizations, agents, operations] = await Promise.all([
          service.getDeploymentContexts(),
          service.getOrgContexts(),
          service.getAgentContexts(),
          service.getOperationContexts(undefined, true),
        ])
        data = {
          deployments,
          organizations,
          agents,
          operations,
          summary: {
            deploymentCount: deployments.length,
            orgCount: organizations.length,
            agentCount: agents.length,
            activeOperations: operations.length,
          },
        }
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('[Phase6 Context API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch context data', details: (error as Error).message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/phase6/context
 * Create a new context at specified tier
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tier, ...contextData } = body

    const service = getPhase6Service()

    let result: unknown

    switch (tier) {
      case 'deployment':
        result = await service.createDeploymentContext(contextData)
        break
      // Add other tiers as needed
      default:
        return NextResponse.json(
          { error: `Invalid tier: ${tier}` },
          { status: 400 }
        )
    }

    return NextResponse.json({ data: result }, { status: 201 })
  } catch (error) {
    console.error('[Phase6 Context API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to create context', details: (error as Error).message },
      { status: 500 }
    )
  }
}
