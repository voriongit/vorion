/**
 * Registry API - Search Agents
 *
 * GET /v1/registry
 *
 * Search/list registered agents.
 *
 * Query params:
 *   q: text search
 *   tier: minimum tier (0-4)
 *   capability: BASIS capability code
 *   certified: only certified agents
 *   sort: 'score' | 'events' | 'name' | 'recent'
 *   order: 'asc' | 'desc'
 *   limit: max 100
 *   cursor: pagination cursor
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const TRUST_TIER_MAP: Record<string, number> = {
  untrusted: 0,
  novice: 1,
  proven: 2,
  trusted: 3,
  elite: 4,
  legendary: 4,
}

const TRUST_TIER_LABELS: Record<number, string> = {
  0: 'Unregistered',
  1: 'Registered',
  2: 'Verified',
  3: 'Certified',
  4: 'Certified+',
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const q = searchParams.get('q')
  const minTier = parseInt(searchParams.get('tier') || '0', 10)
  const capability = searchParams.get('capability')
  const certifiedOnly = searchParams.get('certified') === 'true'
  const sort = searchParams.get('sort') || 'score'
  const order = searchParams.get('order') || 'desc'
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)
  const cursor = searchParams.get('cursor')

  const supabase = createClient()

  try {
    // Build query for published agents
    let query = supabase
      .from('bots')
      .select(`
        id,
        name,
        description,
        status,
        trust_score,
        trust_tier,
        capabilities,
        created_at,
        updated_at,
        metadata
      `)
      .eq('published', true)
      .eq('status', 'active')

    // Text search
    if (q) {
      query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`)
    }

    // Minimum tier filter
    if (minTier > 0) {
      const tierNames = Object.entries(TRUST_TIER_MAP)
        .filter(([_, v]) => v >= minTier)
        .map(([k, _]) => k)
      query = query.in('trust_tier', tierNames)
    }

    // Capability filter
    if (capability) {
      query = query.contains('capabilities', [capability])
    }

    // Sorting
    const sortColumn = {
      score: 'trust_score',
      events: 'trust_score', // Proxy for activity
      name: 'name',
      recent: 'updated_at',
    }[sort] || 'trust_score'

    query = query.order(sortColumn, { ascending: order === 'asc' })

    // Pagination
    if (cursor) {
      const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString())
      query = query.gt('id', decoded.lastId)
    }

    query = query.limit(limit + 1) // Fetch one extra to check for more

    const { data: agents, error } = await query

    if (error) {
      throw error
    }

    // Check for certifications if filter active
    let certifiedAgentIds: Set<string> = new Set()
    if (certifiedOnly && agents && agents.length > 0) {
      const { data: certs } = await supabase
        .from('certifications')
        .select('agent_id')
        .in('agent_id', agents.map(a => a.id))
        .eq('status', 'approved')

      certifiedAgentIds = new Set((certs || []).map(c => c.agent_id))
    }

    // Format response
    let filteredAgents = agents || []
    if (certifiedOnly) {
      filteredAgents = filteredAgents.filter(a => certifiedAgentIds.has(a.id))
    }

    const hasMore = filteredAgents.length > limit
    const resultAgents = filteredAgents.slice(0, limit)

    const registryProfiles = resultAgents.map(agent => {
      const tier = TRUST_TIER_MAP[agent.trust_tier] ?? 0
      const owner = (agent.metadata as any)?.owner || {}

      return {
        agent_id: agent.id,
        name: agent.name,
        description: agent.description,
        owner: {
          name: owner.name || 'Unknown',
          verified: tier >= 2,
        },
        capabilities: agent.capabilities || [],
        trust: {
          score: agent.trust_score,
          tier,
          tier_label: TRUST_TIER_LABELS[tier],
        },
        cert: certifiedAgentIds.has(agent.id) ? {
          status: 'approved',
        } : null,
        links: {
          badge_svg: `/api/badge/${agent.id}?variant=compact`,
          badge_png: `/api/badge/${agent.id}?variant=compact&format=png`,
          verify_url: `/verify/agent/${agent.id}`,
        },
        registered_at: new Date(agent.created_at).getTime(),
        updated_at: new Date(agent.updated_at).getTime(),
      }
    })

    const response: any = {
      agents: registryProfiles,
      total: registryProfiles.length,
    }

    if (hasMore && resultAgents.length > 0) {
      const lastAgent = resultAgents[resultAgents.length - 1]
      response.cursor = Buffer.from(JSON.stringify({ lastId: lastAgent.id })).toString('base64')
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=60',
      }
    })
  } catch (err: any) {
    console.error('Registry search error:', err)
    return NextResponse.json(
      { error: { code: 'internal_error', message: err.message } },
      { status: 500 }
    )
  }
}
