/**
 * Public Agent Detail API
 * Returns a single agent by ID from the agents table
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string }>
}

// Create Supabase admin client for reading public agents
// Uses service role to bypass RLS (safe for server-side read-only)
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(supabaseUrl, supabaseKey)
}

// GET /api/agents/public/[id] - Get a single public agent
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const params = await context.params
    const { id } = params
    const supabase = getSupabaseAdmin()

    const { data: agent, error } = await supabase
      .from('agents')
      .select('id, name, description, system_prompt, model, trust_score, config, metadata, created_at, updated_at')
      .eq('id', id)
      .eq('status', 'active')
      .single()

    if (error || !agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    // Parse config and metadata if they're strings
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

    // Transform to expected format
    const transformedAgent = {
      id: agent.id,
      name: agent.name,
      description: agent.description,
      system_prompt: agent.system_prompt,
      model: agent.model,
      specialization: config.specialization || metadata.type || 'General',
      trust_score: score,
      trust_tier: trustTier,
      capabilities: config.capabilities || [],
      personality_traits: config.personalityTraits || [],
      avatar_url: metadata.avatarUrl || null,
      config,
      metadata,
      created_at: agent.created_at,
      updated_at: agent.updated_at
    }

    return NextResponse.json({ agent: transformedAgent })
  } catch (error) {
    console.error('Public agent GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
