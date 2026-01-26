/**
 * Phase 6 Trust Engine Stats API
 *
 * Returns aggregated statistics from all Phase 6 components:
 * - Q1: Ceiling Enforcement
 * - Q2: Hierarchical Context
 * - Q3: Role Gates
 * - Q4: Weight Presets
 * - Q5: Provenance
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getPhase6Service,
  getDemoStats,
  getDemoTierDistribution,
  getDemoRecentEvents,
} from '@/lib/services/phase6-service'

/**
 * GET /api/phase6/stats
 * Get Phase 6 Trust Engine statistics
 */
export async function GET(request: NextRequest) {
  try {
    const service = getPhase6Service()

    // Try to get real data, fall back to demo
    let stats, tierDistribution, recentEvents

    try {
      [stats, tierDistribution, recentEvents] = await Promise.all([
        service.getStats(),
        service.getTierDistribution(),
        service.getRecentEvents(10),
      ])

      // If stats are all zeros, use demo data
      const totalContexts =
        stats.contextStats.deployments +
        stats.contextStats.organizations +
        stats.contextStats.agents

      if (totalContexts === 0) {
        stats = getDemoStats()
        tierDistribution = getDemoTierDistribution()
        recentEvents = getDemoRecentEvents()
      }
    } catch (dbError) {
      // Database not ready, use demo data
      console.log('[Phase6 Stats API] Using demo data:', (dbError as Error).message)
      stats = getDemoStats()
      tierDistribution = getDemoTierDistribution()
      recentEvents = getDemoRecentEvents()
    }

    return NextResponse.json({
      stats,
      tierDistribution,
      recentEvents,
      version: {
        major: 1,
        minor: 0,
        patch: 0,
        label: 'phase6-trust-engine',
        decisions: ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'],
      },
    })
  } catch (error) {
    console.error('[Phase6 Stats API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Phase 6 statistics', details: (error as Error).message },
      { status: 500 }
    )
  }
}
