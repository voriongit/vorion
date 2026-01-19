/**
 * Trust Metrics API
 *
 * GET /api/trust-metrics - Get aggregated trust metrics for observability
 * GET /api/trust-metrics?agentId=xxx - Get metrics for specific agent
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { trustScores } from '@/lib/db/schema/trust-scores'
import { sql, desc, asc, gte, lte, count } from 'drizzle-orm'
import {
  getAllAgentTrustStatus,
  getEnhancedTrustStatus,
} from '@/lib/governance/trust-engine-bridge'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')

    if (agentId) {
      // Get specific agent metrics
      const status = await getEnhancedTrustStatus(agentId)
      if (!status) {
        return NextResponse.json(
          { error: 'Agent not found in trust engine' },
          { status: 404 }
        )
      }
      return NextResponse.json({ success: true, agent: status })
    }

    // Get all agents for aggregate metrics
    const allAgents = await getAllAgentTrustStatus()

    // Calculate aggregated metrics
    const metrics = calculateMetrics(allAgents)

    // Get tier distribution from database for historical accuracy
    const tierDistribution = await getTierDistribution()

    // Get recent trust changes
    const recentChanges = await getRecentTrustChanges()

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        totalAgents: allAgents.length,
        averageScore: metrics.averageScore,
        medianScore: metrics.medianScore,
        agentsWithAcceleratedDecay: metrics.acceleratedDecayCount,
        agentsWithAcceleratedRecovery: metrics.acceleratedRecoveryCount,
      },
      tierDistribution,
      scoreDistribution: metrics.scoreDistribution,
      componentAverages: metrics.componentAverages,
      healthIndicators: {
        healthyAgents: allAgents.filter(a => a.score >= 500).length,
        warningAgents: allAgents.filter(a => a.score >= 200 && a.score < 500).length,
        criticalAgents: allAgents.filter(a => a.score < 200).length,
      },
      topPerformers: allAgents
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(a => ({
          agentId: a.agentId,
          score: a.score,
          level: a.level,
          levelName: a.levelName,
        })),
      needsAttention: allAgents
        .filter(a => a.acceleratedDecayActive || a.score < 300)
        .slice(0, 5)
        .map(a => ({
          agentId: a.agentId,
          score: a.score,
          level: a.level,
          levelName: a.levelName,
          reason: a.acceleratedDecayActive ? 'Accelerated decay active' : 'Low trust score',
        })),
      recentChanges,
      agents: allAgents,
    })
  } catch (error) {
    console.error('[TrustMetrics API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch trust metrics', details: (error as Error).message },
      { status: 500 }
    )
  }
}

interface AgentStatus {
  score: number
  level: number
  acceleratedDecayActive: boolean
  acceleratedRecoveryActive: boolean
  components: {
    behavioral: number
    compliance: number
    identity: number
    context: number
  }
}

function calculateMetrics(agents: AgentStatus[]) {
  if (agents.length === 0) {
    return {
      averageScore: 0,
      medianScore: 0,
      acceleratedDecayCount: 0,
      acceleratedRecoveryCount: 0,
      scoreDistribution: { '0-199': 0, '200-399': 0, '400-599': 0, '600-799': 0, '800-899': 0, '900-1000': 0 },
      componentAverages: { behavioral: 0.5, compliance: 0.5, identity: 0.5, context: 0.5 },
    }
  }

  const scores = agents.map(a => a.score).sort((a, b) => a - b)
  const averageScore = Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
  const medianScore = scores[Math.floor(scores.length / 2)]

  // Score distribution buckets
  const scoreDistribution = {
    '0-199': agents.filter(a => a.score < 200).length,
    '200-399': agents.filter(a => a.score >= 200 && a.score < 400).length,
    '400-599': agents.filter(a => a.score >= 400 && a.score < 600).length,
    '600-799': agents.filter(a => a.score >= 600 && a.score < 800).length,
    '800-899': agents.filter(a => a.score >= 800 && a.score < 900).length,
    '900-1000': agents.filter(a => a.score >= 900).length,
  }

  // Component averages
  const componentSums = agents.reduce(
    (acc, a) => ({
      behavioral: acc.behavioral + (a.components.behavioral || 0.5),
      compliance: acc.compliance + (a.components.compliance || 0.5),
      identity: acc.identity + (a.components.identity || 0.5),
      context: acc.context + (a.components.context || 0.5),
    }),
    { behavioral: 0, compliance: 0, identity: 0, context: 0 }
  )

  const componentAverages = {
    behavioral: Math.round((componentSums.behavioral / agents.length) * 100) / 100,
    compliance: Math.round((componentSums.compliance / agents.length) * 100) / 100,
    identity: Math.round((componentSums.identity / agents.length) * 100) / 100,
    context: Math.round((componentSums.context / agents.length) * 100) / 100,
  }

  return {
    averageScore,
    medianScore,
    acceleratedDecayCount: agents.filter(a => a.acceleratedDecayActive).length,
    acceleratedRecoveryCount: agents.filter(a => a.acceleratedRecoveryActive).length,
    scoreDistribution,
    componentAverages,
  }
}

async function getTierDistribution() {
  try {
    // Get distribution by trust level
    const result = await db
      .select({
        level: trustScores.level,
        count: count(),
      })
      .from(trustScores)
      .groupBy(trustScores.level)

    const tierNames: Record<number, string> = {
      0: 'Sandbox',
      1: 'Provisional',
      2: 'Standard',
      3: 'Trusted',
      4: 'Certified',
      5: 'Autonomous',
    }

    return result.map(r => ({
      level: r.level,
      name: tierNames[r.level] || 'Unknown',
      count: Number(r.count),
    }))
  } catch {
    return []
  }
}

async function getRecentTrustChanges() {
  try {
    // Get recently updated agents (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const result = await db
      .select({
        entityId: trustScores.entityId,
        score: trustScores.score,
        level: trustScores.level,
        updatedAt: trustScores.updatedAt,
      })
      .from(trustScores)
      .where(gte(trustScores.updatedAt, oneDayAgo))
      .orderBy(desc(trustScores.updatedAt))
      .limit(10)

    return result.map(r => ({
      agentId: r.entityId,
      score: r.score,
      level: r.level,
      updatedAt: r.updatedAt.toISOString(),
    }))
  } catch {
    return []
  }
}
