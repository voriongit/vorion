/**
 * Trust Query API - Compact Response
 *
 * GET /v1/trust/:agent_id
 *
 * Primary trust check. Designed for high-frequency calls.
 * Response is cacheable (see ttl).
 *
 * Response format (minimal, ~120 bytes):
 * {
 *   s: number;      // score (0-1000)
 *   t: TrustTier;   // tier (0-4)
 *   v: boolean;     // valid (not suspended/revoked)
 *   sig: string;    // AgentAnchor attestation
 *   ttl: number;    // cache validity (seconds)
 * }
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
  legendary: 4, // Cap at 4 for API contract
}

/**
 * Generate HMAC signature for trust response
 */
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

    // Check rate limit (1000/min per agent for trust queries)
    const rateLimit = await checkRateLimit(keyId, userId)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: { code: 'AA_RATE_LIMITED', message: 'Rate limit exceeded' } },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': '1000',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 60),
          }
        }
      )
    }
  }

  const supabase = createClient()

  try {
    // Fetch agent trust data
    const { data: agent, error } = await supabase
      .from('bots')
      .select('id, trust_score, trust_tier, status')
      .eq('id', agent_id)
      .single()

    const responseTime = Date.now() - startTime

    if (userId && keyId) {
      await logApiUsage(keyId, userId, `/api/v1/trust/${agent_id}`, 'GET', error ? 404 : 200, responseTime)
    }

    if (error || !agent) {
      return NextResponse.json(
        { error: { code: 'AA_INVALID_AGENT', message: 'Agent ID not found or invalid' } },
        { status: 404 }
      )
    }

    // Check if agent is suspended
    const isValid = agent.status !== 'suspended' && agent.status !== 'revoked'
    const tier = TRUST_TIER_MAP[agent.trust_tier] ?? 0
    const timestamp = Date.now()

    // Generate compact response
    const response = {
      s: agent.trust_score,
      t: tier,
      v: isValid,
      sig: generateSignature(agent_id, agent.trust_score, tier, timestamp),
      ttl: 300, // 5 minutes cache
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=300',
        'X-Request-Id': crypto.randomUUID(),
        'X-Response-Time': `${responseTime}ms`,
      }
    })
  } catch (err: any) {
    console.error('Trust query error:', err)
    return NextResponse.json(
      { error: { code: 'internal_error', message: err.message } },
      { status: 500 }
    )
  }
}
