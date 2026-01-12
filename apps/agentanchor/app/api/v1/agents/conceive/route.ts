/**
 * Agent Conception API
 *
 * POST /api/v1/agents/conceive
 *
 * Creates a new agent with trust calculated from conception context.
 * Implements BAI-OS philosophy: trust from birth, not earned from zero.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  agentConceptionService,
  AgentConceptionRequest,
} from '@/lib/agents/agent-conception-service'
import { HierarchyLevel } from '@/lib/agents/trust-from-conception'

// =============================================================================
// REQUEST VALIDATION
// =============================================================================

interface ConceiveRequest {
  // Required
  name: string
  description: string
  domain: string
  hierarchyLevel: HierarchyLevel
  creationType: 'fresh' | 'cloned' | 'evolved' | 'promoted' | 'imported'

  // Optional
  specialization?: string
  parentAgentId?: string
  trainerId?: string
  vettingGate?: 'none' | 'basic' | 'standard' | 'rigorous' | 'council'
  academyCompleted?: string[]
  certifications?: string[]
  systemPrompt?: string
  capabilities?: string[]
  config?: Record<string, unknown>
  icon?: string
  category?: string
  tags?: string[]
}

const VALID_LEVELS: HierarchyLevel[] = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8']
const VALID_CREATION_TYPES = ['fresh', 'cloned', 'evolved', 'promoted', 'imported']
const VALID_VETTING_GATES = ['none', 'basic', 'standard', 'rigorous', 'council']

function validateRequest(body: unknown): ConceiveRequest {
  const req = body as ConceiveRequest

  if (!req.name || typeof req.name !== 'string') {
    throw new Error('name is required and must be a string')
  }

  if (!req.description || typeof req.description !== 'string') {
    throw new Error('description is required and must be a string')
  }

  if (!req.domain || typeof req.domain !== 'string') {
    throw new Error('domain is required and must be a string')
  }

  if (!req.hierarchyLevel || !VALID_LEVELS.includes(req.hierarchyLevel)) {
    throw new Error(`hierarchyLevel must be one of: ${VALID_LEVELS.join(', ')}`)
  }

  if (!req.creationType || !VALID_CREATION_TYPES.includes(req.creationType)) {
    throw new Error(`creationType must be one of: ${VALID_CREATION_TYPES.join(', ')}`)
  }

  if (req.vettingGate && !VALID_VETTING_GATES.includes(req.vettingGate)) {
    throw new Error(`vettingGate must be one of: ${VALID_VETTING_GATES.join(', ')}`)
  }

  if (req.creationType === 'cloned' && !req.parentAgentId) {
    throw new Error('parentAgentId is required for cloned agents')
  }

  return req
}

// =============================================================================
// POST /api/v1/agents/conceive
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      )
    }

    // 2. Parse and validate request
    const body = await request.json()
    const validated = validateRequest(body)

    // 3. Build conception request
    const conceptionRequest: AgentConceptionRequest = {
      name: validated.name,
      description: validated.description,
      domain: validated.domain,
      hierarchyLevel: validated.hierarchyLevel,
      creationType: validated.creationType,
      creatorId: user.id, // Use authenticated user as creator

      // Optional fields
      specialization: validated.specialization,
      parentAgentId: validated.parentAgentId,
      trainerId: validated.trainerId,
      vettingGate: validated.vettingGate,
      academyCompleted: validated.academyCompleted,
      certifications: validated.certifications,
      systemPrompt: validated.systemPrompt,
      capabilities: validated.capabilities,
      config: validated.config,
      icon: validated.icon,
      category: validated.category,
      tags: validated.tags,
    }

    // 4. Conceive the agent
    const agent = await agentConceptionService.conceiveAgent(conceptionRequest)

    // 5. Return conceived agent with full trust context
    return NextResponse.json({
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        description: agent.description,

        // Trust from conception
        trust: {
          score: agent.trustScore,
          tier: agent.trustTier,
          autonomy: agent.autonomyLevel,
          supervision: agent.supervisionLevel,
          ceiling: agent.trustCeiling,
          floor: agent.trustFloor,
          rationale: agent.conceptionRationale,
        },

        // Hierarchy
        hierarchy: {
          level: agent.hierarchyLevel,
          domain: agent.domain,
        },

        // Lineage
        lineage: {
          creationType: agent.creationType,
          parentAgentId: agent.parentAgentId,
          trainerId: agent.trainerId,
          generation: agent.generation,
        },

        // Capabilities
        capabilities: agent.capabilities,

        // Timestamps
        createdAt: agent.createdAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('Agent conception error:', error)

    if (error instanceof Error) {
      return NextResponse.json(
        { error: 'Conception failed', message: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal error', message: 'Failed to conceive agent' },
      { status: 500 }
    )
  }
}

// =============================================================================
// GET /api/v1/agents/conceive - Preview trust calculation
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Get parameters for preview
    const level = searchParams.get('level') as HierarchyLevel
    const domain = searchParams.get('domain') || 'general'
    const creationType = searchParams.get('creationType') || 'fresh'
    const vettingGate = searchParams.get('vettingGate')

    if (!level || !VALID_LEVELS.includes(level)) {
      return NextResponse.json(
        { error: 'Invalid level', message: `level must be one of: ${VALID_LEVELS.join(', ')}` },
        { status: 400 }
      )
    }

    // Import and calculate preview
    const { calculateConceptionTrust, HIERARCHY_TRUST_BASELINES } = await import(
      '@/lib/agents/trust-from-conception'
    )

    const preview = calculateConceptionTrust({
      creationType: creationType as 'fresh' | 'cloned' | 'evolved' | 'promoted' | 'imported',
      hierarchyLevel: level,
      domain,
      vettingGate: vettingGate as 'none' | 'basic' | 'standard' | 'rigorous' | 'council' | undefined,
    })

    const baseline = HIERARCHY_TRUST_BASELINES[level]

    return NextResponse.json({
      preview: {
        level,
        domain,
        creationType,
        vettingGate,

        baseline: {
          score: baseline.baseScore,
          tier: baseline.tier,
          autonomy: baseline.autonomy,
          supervision: baseline.supervision,
          ceiling: baseline.ceiling,
          floor: baseline.floor,
          description: baseline.description,
        },

        calculated: {
          score: preview.initialTrustScore,
          tier: preview.initialTrustTier,
          autonomy: preview.autonomyLevel,
          supervision: preview.supervisionRequirement,
          ceiling: preview.trustCeiling,
          floor: preview.trustFloor,
          rationale: preview.rationale,
        },
      },
    })
  } catch (error) {
    console.error('Trust preview error:', error)
    return NextResponse.json(
      { error: 'Preview failed', message: 'Could not calculate trust preview' },
      { status: 500 }
    )
  }
}
