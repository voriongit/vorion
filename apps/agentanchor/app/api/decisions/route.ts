import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { councilDecisions, agents } from '@/drizzle/schema'
import { desc, eq, sql, and, gte } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  try {
    const db = await getDb()
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '20')
    const agentId = searchParams.get('agent_id')

    // Build query conditions
    const conditions = []
    if (agentId) {
      conditions.push(eq(councilDecisions.agentId, agentId))
    }

    // Fetch recent decisions
    const decisions = await db
      .select({
        id: councilDecisions.id,
        agent_id: councilDecisions.agentId,
        agent_name: agents.name,
        action_type: councilDecisions.decisionType,
        decision: councilDecisions.outcome,
        risk_level: councilDecisions.riskLevel,
        reasoning: councilDecisions.reasoning,
        constraints: councilDecisions.modificationDetails,
        created_at: councilDecisions.createdAt,
      })
      .from(councilDecisions)
      .leftJoin(agents, eq(councilDecisions.agentId, agents.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(councilDecisions.createdAt))
      .limit(limit)

    // Map outcomes to B2B decision types
    const mappedDecisions = decisions.map((d) => ({
      ...d,
      decision: mapOutcomeToDecision(d.decision),
    }))

    // Calculate stats
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [statsResult] = await db
      .select({
        total_decisions: sql<number>`count(*)::int`,
        decisions_today: sql<number>`count(*) filter (where ${councilDecisions.createdAt} >= ${today})::int`,
        allow_count: sql<number>`count(*) filter (where ${councilDecisions.outcome} = 'approved')::int`,
        escalation_count: sql<number>`count(*) filter (where ${councilDecisions.outcome} = 'escalated')::int`,
      })
      .from(councilDecisions)

    const totalDecisions = statsResult?.total_decisions || 0
    const stats = {
      total_decisions: totalDecisions,
      decisions_today: statsResult?.decisions_today || 0,
      allow_rate: totalDecisions > 0 ? (statsResult?.allow_count || 0) / totalDecisions : 0,
      escalation_rate: totalDecisions > 0 ? (statsResult?.escalation_count || 0) / totalDecisions : 0,
      avg_response_ms: 45, // Placeholder - would track actual latency
    }

    return NextResponse.json({
      decisions: mappedDecisions,
      stats,
    })
  } catch (error) {
    console.error('Error fetching decisions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch decisions' },
      { status: 500 }
    )
  }
}

function mapOutcomeToDecision(outcome: string | null): string {
  switch (outcome) {
    case 'approved':
      return 'allow'
    case 'rejected':
      return 'deny'
    case 'escalated':
      return 'escalate'
    case 'modified':
      return 'degrade'
    default:
      return 'allow'
  }
}
