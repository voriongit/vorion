/**
 * Registry API - Single Agent Profile
 *
 * GET /v1/registry/:agent_id
 *
 * Public agent profile. No auth required.
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agent_id: string }> }
) {
  const { agent_id } = await params
  const supabase = createClient()

  try {
    // Get agent (public data only)
    const { data: agent, error } = await supabase
      .from('bots')
      .select(`
        id,
        name,
        description,
        status,
        trust_score,
        trust_tier,
        capabilities,
        published,
        created_at,
        updated_at,
        metadata
      `)
      .eq('id', agent_id)
      .single()

    if (error || !agent) {
      return NextResponse.json(
        { error: { code: 'AA_INVALID_AGENT', message: 'Agent not found' } },
        { status: 404 }
      )
    }

    // Only return if published or for public lookup
    if (!agent.published && agent.status !== 'active') {
      return NextResponse.json(
        { error: { code: 'AA_INVALID_AGENT', message: 'Agent not found' } },
        { status: 404 }
      )
    }

    // Get certification status
    const { data: cert } = await supabase
      .from('certifications')
      .select('id, status, issued_at, expires_at')
      .eq('agent_id', agent_id)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Get event stats
    const { count: eventCount } = await supabase
      .from('trust_events')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agent_id)

    // Calculate uptime (simplified - based on active status duration)
    const createdAt = new Date(agent.created_at).getTime()
    const now = Date.now()
    const daysSinceCreation = Math.max(1, Math.floor((now - createdAt) / (24 * 60 * 60 * 1000)))
    const uptime30d = Math.min(100, Math.round((daysSinceCreation / 30) * 100))

    const tier = TRUST_TIER_MAP[agent.trust_tier] ?? 0
    const owner = (agent.metadata as any)?.owner || {}

    const profile = {
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
      cert: cert ? {
        status: cert.status,
        cert_id: cert.id,
        issued: cert.issued_at ? new Date(cert.issued_at).getTime() : undefined,
        expires: cert.expires_at ? new Date(cert.expires_at).getTime() : undefined,
      } : null,
      stats: {
        events_total: eventCount || 0,
        uptime_30d: uptime30d,
        avg_response_ms: 250, // Placeholder - would need actual metrics
      },
      links: {
        badge_svg: `/api/badge/${agent.id}?variant=compact`,
        badge_png: `/api/badge/${agent.id}?variant=compact&format=png`,
        verify_url: `/verify/agent/${agent.id}`,
      },
      registered_at: new Date(agent.created_at).getTime(),
      updated_at: new Date(agent.updated_at).getTime(),
    }

    return NextResponse.json(profile, {
      headers: {
        'Cache-Control': 'public, max-age=60',
      }
    })
  } catch (err: any) {
    console.error('Registry profile error:', err)
    return NextResponse.json(
      { error: { code: 'internal_error', message: err.message } },
      { status: 500 }
    )
  }
}
