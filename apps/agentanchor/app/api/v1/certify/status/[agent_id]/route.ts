/**
 * Certification API - Check Status
 *
 * GET /v1/certify/status/:agent_id
 *
 * Check certification application status.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateApiKey } from '@/lib/api'

const TRUST_TIER_MAP: Record<string, number> = {
  untrusted: 0,
  novice: 1,
  proven: 2,
  trusted: 3,
  elite: 4,
  legendary: 4,
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agent_id: string }> }
) {
  const { agent_id } = await params

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

  const supabase = createClient()

  try {
    // Get agent
    const { data: agent, error: agentError } = await supabase
      .from('bots')
      .select('id, trust_tier, creator_id')
      .eq('id', agent_id)
      .single()

    if (agentError || !agent) {
      return NextResponse.json(
        { error: { code: 'AA_INVALID_AGENT', message: 'Agent not found' } },
        { status: 404 }
      )
    }

    // Get active certification
    const { data: cert } = await supabase
      .from('certifications')
      .select(`
        id,
        target_tier,
        status,
        issued_at,
        expires_at,
        required_actions,
        reviewer_notes,
        created_at,
        updated_at
      `)
      .eq('agent_id', agent_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Get certification history
    const { data: history } = await supabase
      .from('trust_events')
      .select('event_type, created_at, metadata')
      .eq('agent_id', agent_id)
      .in('event_type', [
        'certification_applied',
        'certification_approved',
        'certification_rejected',
        'certification_renewed',
        'certification_expired',
      ])
      .order('created_at', { ascending: false })
      .limit(20)

    const currentTier = TRUST_TIER_MAP[agent.trust_tier] ?? 0

    const response: any = {
      agent_id,
      current_tier: currentTier,
    }

    // Add pending application if exists
    if (cert && ['pending', 'in_review'].includes(cert.status)) {
      response.application = {
        application_id: cert.id,
        target_tier: cert.target_tier,
        status: cert.status,
        submitted_at: new Date(cert.created_at).getTime(),
        updated_at: new Date(cert.updated_at).getTime(),
        reviewer_notes: cert.reviewer_notes,
        required_actions: (cert.required_actions || []).map((a: any) => ({
          action: a.action,
          description: a.description,
          completed: a.completed || false,
          due: a.due,
        })),
      }
    }

    // Add active certification if approved
    if (cert && cert.status === 'approved' && cert.issued_at) {
      response.certification = {
        cert_id: cert.id,
        tier: cert.target_tier,
        issued_at: new Date(cert.issued_at).getTime(),
        expires_at: cert.expires_at ? new Date(cert.expires_at).getTime() : null,
        renewal_opens: cert.expires_at
          ? new Date(cert.expires_at).getTime() - 30 * 24 * 60 * 60 * 1000 // 30 days before expiry
          : null,
      }
    }

    // Add history
    response.history = (history || []).map((h: any) => ({
      event: h.event_type,
      timestamp: new Date(h.created_at).getTime(),
      details: h.metadata?.notes || h.metadata?.reason,
    }))

    return NextResponse.json(response)
  } catch (err: any) {
    console.error('Certification status error:', err)
    return NextResponse.json(
      { error: { code: 'internal_error', message: err.message } },
      { status: 500 }
    )
  }
}
