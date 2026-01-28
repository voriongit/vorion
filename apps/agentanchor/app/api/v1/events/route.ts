/**
 * Event Ingestion API
 *
 * POST /v1/events
 *
 * Submit execution events (Kaizen proofs) for scoring.
 * Accepts batches. Returns score delta.
 *
 * Request:
 * {
 *   agent_id: string;
 *   proofs: Array<{
 *     h: string;      // merkle root hash
 *     t: number;      // execution timestamp
 *     d: number;      // duration ms
 *     o: 'success' | 'fail' | 'abort';  // outcome
 *     v?: string;     // violation code if any
 *   }>;
 *   batch_sig: string;
 * }
 *
 * Response:
 * {
 *   accepted: number;
 *   rejected: number;
 *   errors?: Array<{ index: number; code: string; msg: string }>;
 *   score_prev: number;
 *   score_new: number;
 *   score_delta: number;
 *   tier_change?: { from: number; to: number };
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateApiKey, checkRateLimit, logApiUsage } from '@/lib/api'
import { createHmac, createHash } from 'crypto'
import { z } from 'zod'

// Validation schema
const ProofSchema = z.object({
  h: z.string().min(32).max(128),           // hash
  t: z.number().int().positive(),            // timestamp
  d: z.number().int().nonnegative(),         // duration
  o: z.enum(['success', 'fail', 'abort']),   // outcome
  v: z.string().optional(),                  // violation code
})

const EventBatchSchema = z.object({
  agent_id: z.string().uuid(),
  proofs: z.array(ProofSchema).min(1).max(100),
  batch_sig: z.string(),
})

// Trust tier thresholds
const TIER_THRESHOLDS = [0, 100, 300, 500, 700, 900]

function getTier(score: number): number {
  for (let i = TIER_THRESHOLDS.length - 1; i >= 0; i--) {
    if (score >= TIER_THRESHOLDS[i]) return i
  }
  return 0
}

// Score adjustments by outcome
const SCORE_ADJUSTMENTS = {
  success: 5,       // +5 per successful execution
  fail: -10,        // -10 per failure
  abort: -25,       // -25 per abort (enforcement triggered)
}

// Violation penalties
const VIOLATION_PENALTIES: Record<string, number> = {
  'KZ_POLICY_DENIED': -15,
  'KZ_BASIS_VIOLATION': -30,
  'KZ_TIMEOUT': -5,
  'KZ_RESOURCE_LOCKED': -2,
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  // Validate API key
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: { code: 'AA_INVALID_SIGNATURE', message: 'Missing API key' } },
      { status: 401 }
    )
  }

  const key = authHeader.slice(7)
  const validation = await validateApiKey(key)

  if (!validation) {
    return NextResponse.json(
      { error: { code: 'AA_INVALID_SIGNATURE', message: 'Invalid API key' } },
      { status: 401 }
    )
  }

  const { userId, keyId } = validation

  // Rate limit (100/min for event batches)
  const rateLimit = await checkRateLimit(keyId, userId)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: { code: 'AA_RATE_LIMITED', message: 'Rate limit exceeded' } },
      { status: 429 }
    )
  }

  try {
    // Parse and validate request body
    const body = await request.json()
    const parsed = EventBatchSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'validation_error', message: parsed.error.message } },
        { status: 400 }
      )
    }

    const { agent_id, proofs, batch_sig } = parsed.data

    // Verify batch signature (HMAC of serialized proofs)
    const secret = process.env.TRUST_SIGNING_SECRET || 'default-secret'
    const expectedSig = createHmac('sha256', secret)
      .update(JSON.stringify({ agent_id, proofs }))
      .digest('base64')

    // Note: In production, verify batch_sig matches expectedSig
    // For now, we'll accept any valid signature format

    const supabase = createClient()

    // Get current agent trust score
    const { data: agent, error: agentError } = await supabase
      .from('bots')
      .select('id, trust_score, trust_tier, creator_id')
      .eq('id', agent_id)
      .single()

    if (agentError || !agent) {
      return NextResponse.json(
        { error: { code: 'AA_INVALID_AGENT', message: 'Agent not found' } },
        { status: 404 }
      )
    }

    // Verify ownership
    if (agent.creator_id !== userId) {
      return NextResponse.json(
        { error: { code: 'AA_INVALID_AGENT', message: 'Not authorized for this agent' } },
        { status: 403 }
      )
    }

    const scorePrev = agent.trust_score
    const tierPrev = getTier(scorePrev)

    // Process proofs
    let accepted = 0
    let rejected = 0
    const errors: Array<{ index: number; code: string; msg: string }> = []
    let totalDelta = 0

    for (let i = 0; i < proofs.length; i++) {
      const proof = proofs[i]

      // Check for duplicate proof hash
      const { data: existing } = await supabase
        .from('trust_events')
        .select('id')
        .eq('proof_hash', proof.h)
        .maybeSingle()

      if (existing) {
        rejected++
        errors.push({ index: i, code: 'AA_DUPLICATE_PROOF', msg: 'Proof already submitted' })
        continue
      }

      // Calculate score delta for this proof
      let delta = SCORE_ADJUSTMENTS[proof.o]

      // Apply violation penalty if present
      if (proof.v && VIOLATION_PENALTIES[proof.v]) {
        delta += VIOLATION_PENALTIES[proof.v]
      }

      totalDelta += delta

      // Record the trust event
      await supabase.from('trust_events').insert({
        agent_id,
        event_type: proof.o === 'success' ? 'execution_success' :
                    proof.o === 'fail' ? 'execution_failure' : 'execution_abort',
        proof_hash: proof.h,
        score_delta: delta,
        metadata: {
          duration_ms: proof.d,
          timestamp: proof.t,
          violation_code: proof.v,
        },
        created_at: new Date(proof.t).toISOString(),
      })

      accepted++
    }

    // Calculate new score (clamped to 0-1000)
    const scoreNew = Math.max(0, Math.min(1000, scorePrev + totalDelta))
    const tierNew = getTier(scoreNew)

    // Update agent trust score
    const tierLabel = ['untrusted', 'novice', 'proven', 'trusted', 'elite', 'legendary'][tierNew]
    await supabase
      .from('bots')
      .update({
        trust_score: scoreNew,
        trust_tier: tierLabel,
        updated_at: new Date().toISOString(),
      })
      .eq('id', agent_id)

    const responseTime = Date.now() - startTime
    await logApiUsage(keyId, userId, '/api/v1/events', 'POST', 200, responseTime)

    const response: any = {
      accepted,
      rejected,
      score_prev: scorePrev,
      score_new: scoreNew,
      score_delta: scoreNew - scorePrev,
    }

    if (errors.length > 0) {
      response.errors = errors
    }

    if (tierNew !== tierPrev) {
      response.tier_change = { from: tierPrev, to: tierNew }
    }

    return NextResponse.json(response, {
      headers: {
        'X-Request-Id': crypto.randomUUID(),
        'X-Response-Time': `${responseTime}ms`,
      }
    })
  } catch (err: any) {
    console.error('Event ingestion error:', err)
    return NextResponse.json(
      { error: { code: 'internal_error', message: err.message } },
      { status: 500 }
    )
  }
}
