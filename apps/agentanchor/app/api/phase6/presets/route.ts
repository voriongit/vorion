/**
 * Phase 6 Federated Weight Presets API (Q4)
 *
 * Manages the 3-tier preset hierarchy:
 * - ACI Canonical (immutable reference)
 * - Vorion Reference (derived from ACI)
 * - Axiom Deployment (derived from Vorion)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPhase6Service } from '@/lib/services/phase6-service'

/**
 * GET /api/phase6/presets
 * Get weight presets
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tier = searchParams.get('tier')
    const deploymentId = searchParams.get('deploymentId')

    const service = getPhase6Service()

    let data: unknown

    switch (tier) {
      case 'aci':
        data = { presets: await service.getAciPresets() }
        break
      case 'vorion':
        data = { presets: await service.getVorionPresets() }
        break
      case 'axiom':
        data = { presets: await service.getAxiomPresets(deploymentId || undefined) }
        break
      default:
        // Return all presets with hierarchy info
        const [aciPresets, vorionPresets, axiomPresets] = await Promise.all([
          service.getAciPresets(),
          service.getVorionPresets(),
          service.getAxiomPresets(),
        ])

        // Build lineage map
        const lineages = axiomPresets.map(axiom => {
          const vorion = vorionPresets.find(v => v.presetId === axiom.parentVorionPresetId)
          const aci = vorion ? aciPresets.find(a => a.presetId === vorion.parentAciPresetId) : null

          return {
            axiom: {
              id: axiom.presetId,
              name: axiom.name,
              verified: axiom.lineageVerified,
            },
            vorion: vorion ? {
              id: vorion.presetId,
              name: vorion.name,
            } : null,
            aci: aci ? {
              id: aci.presetId,
              name: aci.name,
            } : null,
          }
        })

        data = {
          aci: aciPresets,
          vorion: vorionPresets,
          axiom: axiomPresets,
          summary: {
            aciCount: aciPresets.length,
            vorionCount: vorionPresets.length,
            axiomCount: axiomPresets.length,
            verifiedLineages: axiomPresets.filter(p => p.lineageVerified).length,
          },
          lineages,
        }
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('[Phase6 Presets API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch weight presets', details: (error as Error).message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/phase6/presets/matrix
 * Get the role-tier permission matrix
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (action === 'verify-lineage') {
      const body = await request.json()
      const { axiomPresetId } = body

      if (!axiomPresetId) {
        return NextResponse.json(
          { error: 'Missing axiomPresetId' },
          { status: 400 }
        )
      }

      const service = getPhase6Service()

      // Get the axiom preset and its lineage
      const axiomPresets = await service.getAxiomPresets()
      const axiom = axiomPresets.find(p => p.presetId === axiomPresetId)

      if (!axiom) {
        return NextResponse.json(
          { error: 'Axiom preset not found' },
          { status: 404 }
        )
      }

      const vorionPresets = await service.getVorionPresets()
      const vorion = vorionPresets.find(v => v.presetId === axiom.parentVorionPresetId)

      if (!vorion) {
        return NextResponse.json({
          verified: false,
          reason: 'Parent Vorion preset not found',
        })
      }

      const aciPresets = await service.getAciPresets()
      const aci = aciPresets.find(a => a.presetId === vorion.parentAciPresetId)

      if (!aci) {
        return NextResponse.json({
          verified: false,
          reason: 'Root ACI preset not found',
        })
      }

      // Verify hash chain
      const hashChainValid =
        axiom.parentHash === vorion.presetHash &&
        vorion.parentHash === aci.presetHash

      return NextResponse.json({
        verified: hashChainValid,
        lineage: {
          aci: { id: aci.presetId, hash: aci.presetHash },
          vorion: { id: vorion.presetId, hash: vorion.presetHash, parentHash: vorion.parentHash },
          axiom: { id: axiom.presetId, hash: axiom.presetHash, parentHash: axiom.parentHash },
        },
        hashChainValid,
      })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('[Phase6 Presets API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to process request', details: (error as Error).message },
      { status: 500 }
    )
  }
}
