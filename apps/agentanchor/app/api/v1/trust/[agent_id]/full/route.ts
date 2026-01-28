/**
 * Trust Query API - Extended Response
 *
 * GET /v1/trust/:agent_id/full
 *
 * Extended trust record. Lower frequency, richer data.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateApiKey, checkRateLimit, logApiUsage } from '@/lib/api'
import { createHmac } from 'crypto'

// Trust tier mapping
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

function generateSignature(agentId: string, score: number, tier: number, timestamp: number): string {
  const secret = process.env.TRUST_SIGNING_SECRET || 'default-secret'
  const payload = `${agentId}:${score}:${tier}:${timestamp}`
  return createHmac('sha256', secret).update(payload).digest('base64')
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agent_id: string }> }
) {
  const startTime = Date.now()
  const { agent_id } = await params

  // Validate API key
  const authHeader = request.headers.get('authorization')
  let userId: string | null = null
  let keyId: string | null = null

  if (authHeader?.startsWith('Bearer ')) {
    const key = authHeader.slice(7)
    const validation = await validateApiKey(key)

    if (!validation) {
      return NextResponse.json(
        { error: { code: 'AA_INVALID_SIGNATURE', message: 'Invalid API key' } },
        { status: 401 }
      )
    }

    userId = validation.userId
    keyId = validation.keyId

    const rateLimit = await checkRateLimit(keyId, userId)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: { code: 'AA_RATE_LIMITED', message: 'Rate limit exceeded' } },
        { status: 429 }
      )
    }
  }

  const supabase = createClient()

  try {
    // Fetch full agent data with trust history
    const { data: agent, error } = await supabase
      .from('bots')
      .select(`
        id,
        name,
        trust_score,
        trust_tier,
        status,
        created_at,
        updated_at,
        trust_events:bot_trust_events(
          id,
          event_type,
          score_delta,
          created_at
        )
      `)
      .eq('id', agent_id)
      .single()

    const responseTime = Date.now() - startTime

    if (userId && keyId) {
      await logApiUsage(keyId, userId, `/api/v1/trust/${agent_id}/full`, 'GET', error ? 404 : 200, responseTime)
    }

    if (error || !agent) {
      return NextResponse.json(
        { error: { code: 'AA_INVALID_AGENT', message: 'Agent ID not found or invalid' } },
        { status: 404 }
      )
    }

    const isValid = agent.status !== 'suspended' && agent.status !== 'revoked'
    const tier = TRUST_TIER_MAP[agent.trust_tier] ?? 0
    const timestamp = Date.now()

    // Count violations from trust events
    const events = agent.trust_events || []
    const violations = {
      critical: events.filter((e: any) => e.event_type === 'violation_critical').length,
      major: events.filter((e: any) => e.event_type === 'violation_major').length,
      minor: events.filter((e: any) => e.event_type === 'violation_minor').length,
    }

    // Get last event timestamp
    const lastEvent = events.length > 0
      ? new Date(events[events.length - 1].created_at).getTime()
      : null

    // Check certification status
    const { data: cert } = await supabase
      .from('certifications')
      .select('id, status, expires_at')
      .eq('agent_id', agent_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const response = {
      agent_id,
      score: agent.trust_score,
      tier,
      tier_label: TRUST_TIER_LABELS[tier],
      valid: isValid,
      events_scored: events.length,
      violations,
      last_event: lastEvent,
      cert: cert ? {
        status: cert.status,
        expires: cert.expires_at ? new Date(cert.expires_at).getTime() : undefined,
        cert_id: cert.id,
      } : null,
      sig: generateSignature(agent_id, agent.trust_score, tier, timestamp),
      ttl: 60, // 1 minute cache for full response
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=60',
        'X-Request-Id': crypto.randomUUID(),
        'X-Response-Time': `${responseTime}ms`,
      }
    })
  } catch (err: any) {
    console.error('Trust full query error:', err)
    return NextResponse.json(
      { error: { code: 'internal_error', message: err.message } },
      { status: 500 }
    )
  }
}
