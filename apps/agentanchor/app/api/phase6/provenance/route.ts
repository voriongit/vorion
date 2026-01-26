/**
 * Phase 6 Provenance API (Q5)
 *
 * Manages agent provenance:
 * - Immutable origin records
 * - Mutable policy modifiers
 * - Trust score adjustments by creation type
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getPhase6Service,
  CreationType,
} from '@/lib/services/phase6-service'
import { createHash } from 'crypto'

// Default modifiers by creation type
const DEFAULT_MODIFIERS: Record<CreationType, number> = {
  FRESH: 0,
  CLONED: -50,
  EVOLVED: 100,
  PROMOTED: 150,
  IMPORTED: -100,
}

/**
 * GET /api/phase6/provenance
 * Get provenance records
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')

    const service = getPhase6Service()
    const records = await service.getProvenance(agentId || undefined)

    // Summarize by creation type
    const summary = {
      total: records.length,
      byCreationType: {
        FRESH: records.filter(r => r.creationType === 'FRESH').length,
        CLONED: records.filter(r => r.creationType === 'CLONED').length,
        EVOLVED: records.filter(r => r.creationType === 'EVOLVED').length,
        PROMOTED: records.filter(r => r.creationType === 'PROMOTED').length,
        IMPORTED: records.filter(r => r.creationType === 'IMPORTED').length,
      },
      defaultModifiers: DEFAULT_MODIFIERS,
    }

    // If single agent, include lineage
    let lineage = null
    if (agentId && records.length > 0) {
      const record = records[0]
      lineage = [record]

      // Trace back through parents
      let current = record
      while (current.parentAgentId) {
        const parent = records.find(r => r.agentId === current.parentAgentId)
        if (parent) {
          lineage.unshift(parent)
          current = parent
        } else {
          break
        }
      }
    }

    return NextResponse.json({
      records,
      summary,
      lineage,
    })
  } catch (error) {
    console.error('[Phase6 Provenance API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch provenance records', details: (error as Error).message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/phase6/provenance
 * Create a new provenance record
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      agentId,
      creationType,
      parentAgentId,
      createdBy,
      originDeployment,
      originOrg,
      metadata,
    } = body

    // Validate required fields
    if (!agentId || !creationType || !createdBy) {
      return NextResponse.json(
        { error: 'Missing required fields: agentId, creationType, createdBy' },
        { status: 400 }
      )
    }

    // Validate creation type
    if (!Object.keys(DEFAULT_MODIFIERS).includes(creationType)) {
      return NextResponse.json(
        { error: `Invalid creationType: ${creationType}` },
        { status: 400 }
      )
    }

    // Validate parent for non-FRESH types
    if (creationType !== 'FRESH' && creationType !== 'IMPORTED' && !parentAgentId) {
      return NextResponse.json(
        { error: `${creationType} agents must have a parentAgentId` },
        { status: 400 }
      )
    }

    const service = getPhase6Service()

    // Get parent provenance hash if applicable
    let parentProvenanceHash: string | undefined
    if (parentAgentId) {
      const parentRecords = await service.getProvenance(parentAgentId)
      if (parentRecords.length > 0) {
        parentProvenanceHash = parentRecords[0].provenanceHash
      }
    }

    // Compute provenance hash
    const hashContent = JSON.stringify({
      agentId,
      creationType,
      parentAgentId,
      createdBy,
      parentProvenanceHash,
      timestamp: new Date().toISOString(),
    })
    const provenanceHash = createHash('sha256').update(hashContent).digest('hex')

    // Get modifier from policy (use default for now)
    const trustModifier = DEFAULT_MODIFIERS[creationType as CreationType]

    const record = await service.createProvenance({
      agentId,
      creationType: creationType as CreationType,
      parentAgentId,
      createdBy,
      originDeployment,
      originOrg,
      trustModifier,
      provenanceHash,
      parentProvenanceHash,
      metadata: metadata || {},
    })

    return NextResponse.json({ record }, { status: 201 })
  } catch (error) {
    console.error('[Phase6 Provenance API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to create provenance record', details: (error as Error).message },
      { status: 500 }
    )
  }
}
