/**
 * Public Agents API
 * Returns all public/marketplace agents from the agents table
 * This includes seeded agents that don't require user ownership
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// Create Supabase admin client for reading public agents
// Uses service role to bypass RLS (safe for server-side read-only)
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(supabaseUrl, supabaseKey)
}

// GET /api/agents/public - List all public agents
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()

    // Parse query params
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('query')
    const category = searchParams.get('category')
    const minTrust = searchParams.get('min_trust')
    const sortBy = searchParams.get('sort_by') || 'trust_score'
    const page = parseInt(searchParams.get('page') || '1')
    const perPage = parseInt(searchParams.get('per_page') || '24')
    const offset = (page - 1) * perPage

    // Build query for agents table
    let agentQuery = supabase
      .from('agents')
      .select('id, name, description, trust_score, config, metadata, created_at', { count: 'exact' })
      .eq('status', 'active')

    // Filter by search query
    if (query) {
      agentQuery = agentQuery.or(`name.ilike.%${query}%,description.ilike.%${query}%`)
    }

    // Filter by minimum trust score
    if (minTrust) {
      agentQuery = agentQuery.gte('trust_score', parseInt(minTrust))
    }

    // Sorting
    switch (sortBy) {
      case 'trust_score':
        agentQuery = agentQuery.order('trust_score', { ascending: false })
        break
      case 'name':
        agentQuery = agentQuery.order('name', { ascending: true })
        break
      case 'newest':
        agentQuery = agentQuery.order('created_at', { ascending: false })
        break
      default:
        agentQuery = agentQuery.order('trust_score', { ascending: false })
    }

    // Pagination
    agentQuery = agentQuery.range(offset, offset + perPage - 1)

    const { data: agents, error, count } = await agentQuery

    if (error) {
      console.error('Error fetching public agents:', error)
      return NextResponse.json(
        { error: 'Failed to fetch agents', details: error.message },
        { status: 500 }
      )
    }

    // Transform agents to expected format
    const transformedAgents = (agents || []).map(agent => {
      const config = typeof agent.config === 'string' ? JSON.parse(agent.config) : agent.config || {}
      const metadata = typeof agent.metadata === 'string' ? JSON.parse(agent.metadata) : agent.metadata || {}

      // Calculate trust tier from score (must match TrustTier type: lowercase)
      const score = agent.trust_score || 0
      let trustTier = 'untrusted'
      if (score >= 900) trustTier = 'legendary'
      else if (score >= 800) trustTier = 'elite'
      else if (score >= 600) trustTier = 'trusted'
      else if (score >= 400) trustTier = 'proven'
      else if (score >= 200) trustTier = 'novice'

      return {
        id: agent.id,
        name: agent.name,
        description: agent.description,
        specialization: config.specialization || metadata.type || 'General',
        trust_score: score,
        trust_tier: trustTier,
        capabilities: config.capabilities || [],
        personality_traits: config.personalityTraits || [],
        avatar_url: metadata.avatarUrl || null,
        created_at: agent.created_at
      }
    })

    // Get unique specializations for categories (sample from first 1000)
    const { data: allAgents } = await supabase
      .from('agents')
      .select('config, metadata')
      .eq('status', 'active')
      .limit(1000)

    const categoriesSet = new Set<string>()
    ;(allAgents || []).forEach(a => {
      const config = typeof a.config === 'string' ? JSON.parse(a.config) : a.config || {}
      const metadata = typeof a.metadata === 'string' ? JSON.parse(a.metadata) : a.metadata || {}
      const spec = config.specialization || metadata.type
      if (spec) categoriesSet.add(spec)
    })
    const categories = Array.from(categoriesSet).sort()

    return NextResponse.json({
      agents: transformedAgents,
      total: count || 0,
      page,
      per_page: perPage,
      has_more: (offset + transformedAgents.length) < (count || 0),
      categories,
    })
  } catch (error) {
    console.error('Public agents GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
