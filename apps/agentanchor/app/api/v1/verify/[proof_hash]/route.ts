/**
 * Proof Verification API
 *
 * GET /v1/verify/:proof_hash
 *
 * Verify a Kaizen proof was recorded and scored.
 *
 * Response:
 * {
 *   valid: boolean;
 *   agent_id?: string;
 *   recorded_at?: number;
 *   outcome?: 'success' | 'fail' | 'abort';
 *   aa_sig: string;  // AgentAnchor attestation
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createHmac } from 'crypto'

function generateVerificationSignature(
  proofHash: string,
  agentId: string | null,
  recordedAt: number | null,
  valid: boolean
): string {
  const secret = process.env.TRUST_SIGNING_SECRET || 'default-secret'
  const payload = `verify:${proofHash}:${agentId || 'null'}:${recordedAt || 0}:${valid}`
  return createHmac('sha256', secret).update(payload).digest('base64')
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ proof_hash: string }> }
) {
  const { proof_hash } = await params

  // Basic validation
  if (!proof_hash || proof_hash.length < 32) {
    return NextResponse.json({
      valid: false,
      aa_sig: generateVerificationSignature(proof_hash, null, null, false),
    })
  }

  const supabase = createClient()

  try {
    // Look up the proof in trust_events
    const { data: event, error } = await supabase
      .from('trust_events')
      .select(`
        id,
        agent_id,
        event_type,
        created_at,
        metadata
      `)
      .eq('proof_hash', proof_hash)
      .single()

    if (error || !event) {
      return NextResponse.json({
        valid: false,
        aa_sig: generateVerificationSignature(proof_hash, null, null, false),
      }, {
        headers: {
          'Cache-Control': 'public, max-age=300',
        }
      })
    }

    // Map event type to outcome
    const outcomeMap: Record<string, 'success' | 'fail' | 'abort'> = {
      execution_success: 'success',
      execution_failure: 'fail',
      execution_abort: 'abort',
    }

    const recordedAt = new Date(event.created_at).getTime()
    const outcome = outcomeMap[event.event_type] || 'success'

    const response = {
      valid: true,
      agent_id: event.agent_id,
      recorded_at: recordedAt,
      outcome,
      aa_sig: generateVerificationSignature(proof_hash, event.agent_id, recordedAt, true),
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=3600', // 1 hour cache for valid proofs
      }
    })
  } catch (err: any) {
    console.error('Proof verification error:', err)
    return NextResponse.json(
      { error: { code: 'internal_error', message: err.message } },
      { status: 500 }
    )
  }
}
