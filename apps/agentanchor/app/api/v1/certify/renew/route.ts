/**
 * Certification API - Renew Certification
 *
 * POST /v1/certify/renew
 *
 * Initiate certification renewal.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateApiKey } from '@/lib/api'
import { z } from 'zod'

const RenewRequestSchema = z.object({
  agent_id: z.string().uuid(),
  cert_id: z.string().uuid(),
  attestations: z.object({
    no_material_changes: z.boolean(),
    basis_compliant: z.boolean(),
    terms_accepted: z.boolean(),
  }),
  changes_since_last: z.string().max(2000).optional(),
})

export async function POST(request: NextRequest) {
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

  try {
    const body = await request.json()
    const parsed = RenewRequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'validation_error', message: parsed.error.message } },
        { status: 400 }
      )
    }

    const { agent_id, cert_id, attestations, changes_since_last } = parsed.data

    // Verify all attestations
    if (!attestations.no_material_changes || !attestations.basis_compliant || !attestations.terms_accepted) {
      return NextResponse.json(
        { error: { code: 'validation_error', message: 'All attestations must be accepted' } },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Get agent and verify ownership
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

    if (agent.creator_id !== validation.userId) {
      return NextResponse.json(
        { error: { code: 'AA_INVALID_AGENT', message: 'Not authorized for this agent' } },
        { status: 403 }
      )
    }

    // Get current certification
    const { data: cert, error: certError } = await supabase
      .from('certifications')
      .select('*')
      .eq('id', cert_id)
      .eq('agent_id', agent_id)
      .eq('status', 'approved')
      .single()

    if (certError || !cert) {
      return NextResponse.json(
        { error: { code: 'AA_CERT_EXPIRED', message: 'Certification not found or not active' } },
        { status: 404 }
      )
    }

    // Check if within renewal window (30 days before expiry)
    const now = Date.now()
    const expiresAt = cert.expires_at ? new Date(cert.expires_at).getTime() : null
    const renewalWindowStart = expiresAt ? expiresAt - 30 * 24 * 60 * 60 * 1000 : now

    if (expiresAt && now < renewalWindowStart) {
      return NextResponse.json(
        { error: { code: 'validation_error', message: 'Renewal window not yet open' } },
        { status: 400 }
      )
    }

    // Determine if auto-approve or review required
    const needsReview =
      changes_since_last && changes_since_last.length > 100 || // Significant changes noted
      agent.trust_score < 500 || // Score dropped below threshold
      !attestations.no_material_changes // Material changes declared

    if (needsReview) {
      // Create new application for review
      const { data: renewal, error: renewalError } = await supabase
        .from('certifications')
        .insert({
          agent_id,
          target_tier: cert.target_tier,
          status: 'in_review',
          contact: cert.contact,
          attestations,
          notes: changes_since_last,
          previous_cert_id: cert_id,
        })
        .select('id')
        .single()

      if (renewalError) {
        throw renewalError
      }

      // Record event
      await supabase.from('trust_events').insert({
        agent_id,
        event_type: 'certification_renewal_requested',
        score_delta: 0,
        metadata: { renewal_id: renewal.id, requires_review: true },
      })

      return NextResponse.json({
        renewal_id: renewal.id,
        status: 'review_required',
        review_reason: changes_since_last
          ? 'Material changes require review'
          : 'Trust score below renewal threshold',
      })
    } else {
      // Auto-approve renewal
      const newExpiresAt = new Date()
      newExpiresAt.setFullYear(newExpiresAt.getFullYear() + 1) // 1 year renewal

      // Update existing cert
      await supabase
        .from('certifications')
        .update({
          issued_at: new Date().toISOString(),
          expires_at: newExpiresAt.toISOString(),
          attestations,
          renewed_at: new Date().toISOString(),
        })
        .eq('id', cert_id)

      // Record event
      await supabase.from('trust_events').insert({
        agent_id,
        event_type: 'certification_renewed',
        score_delta: 0,
        metadata: { cert_id, auto_approved: true },
      })

      return NextResponse.json({
        renewal_id: cert_id,
        status: 'auto_approved',
        new_expires: newExpiresAt.getTime(),
      })
    }
  } catch (err: any) {
    console.error('Certification renew error:', err)
    return NextResponse.json(
      { error: { code: 'internal_error', message: err.message } },
      { status: 500 }
    )
  }
}
