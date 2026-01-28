/**
 * Certification API - Apply for Certification
 *
 * POST /v1/certify/apply
 *
 * Apply for certification upgrade (CERTIFIED or CERTIFIED_PLUS).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateApiKey, checkRateLimit } from '@/lib/api'
import { z } from 'zod'

const ApplyRequestSchema = z.object({
  agent_id: z.string().uuid(),
  target_tier: z.number().int().min(3).max(4), // CERTIFIED (3) or CERTIFIED_PLUS (4)
  contact: z.object({
    name: z.string().min(1).max(100),
    email: z.string().email(),
    phone: z.string().optional(),
  }),
  attestations: z.object({
    basis_compliant: z.boolean(),
    security_review: z.boolean(),
    terms_accepted: z.boolean(),
  }),
  documents: z.array(z.object({
    type: z.enum(['security_audit', 'soc2', 'penetration_test', 'other']),
    url: z.string().url(),
    name: z.string(),
  })).optional(),
  notes: z.string().max(1000).optional(),
})

// Tier requirements
const TIER_REQUIREMENTS = {
  3: { // CERTIFIED
    minScore: 500,
    minEvents: 1000,
    maxViolations: 0,
    reviewDays: 14,
  },
  4: { // CERTIFIED_PLUS
    minScore: 700,
    minEvents: 5000,
    maxViolations: 0,
    reviewDays: 30,
    requiresDocuments: ['security_audit', 'soc2'],
  },
}

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
    const parsed = ApplyRequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'validation_error', message: parsed.error.message } },
        { status: 400 }
      )
    }

    const { agent_id, target_tier, contact, attestations, documents, notes } = parsed.data

    // Verify all attestations are true
    if (!attestations.basis_compliant || !attestations.security_review || !attestations.terms_accepted) {
      return NextResponse.json(
        { error: { code: 'validation_error', message: 'All attestations must be accepted' } },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Get agent and verify ownership
    const { data: agent, error: agentError } = await supabase
      .from('bots')
      .select(`
        id,
        trust_score,
        trust_tier,
        creator_id,
        trust_events:trust_events(count)
      `)
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

    // Check existing pending application
    const { data: existingApp } = await supabase
      .from('certifications')
      .select('id, status')
      .eq('agent_id', agent_id)
      .in('status', ['pending', 'in_review'])
      .maybeSingle()

    if (existingApp) {
      return NextResponse.json(
        { error: { code: 'validation_error', message: 'Application already pending' } },
        { status: 400 }
      )
    }

    // Check tier requirements
    const requirements = TIER_REQUIREMENTS[target_tier as 3 | 4]
    const eventCount = (agent as any).trust_events?.[0]?.count || 0
    const requiredActions: Array<{ action: string; description: string; due?: number }> = []

    if (agent.trust_score < requirements.minScore) {
      requiredActions.push({
        action: 'increase_score',
        description: `Trust score must be at least ${requirements.minScore} (current: ${agent.trust_score})`,
      })
    }

    if (eventCount < requirements.minEvents) {
      requiredActions.push({
        action: 'more_events',
        description: `At least ${requirements.minEvents} scored events required (current: ${eventCount})`,
      })
    }

    // Check for required documents (CERTIFIED_PLUS)
    if (target_tier === 4 && requirements.requiresDocuments) {
      const docTypes = documents?.map(d => d.type) || []
      for (const required of requirements.requiresDocuments) {
        if (!docTypes.includes(required as any)) {
          requiredActions.push({
            action: 'submit_document',
            description: `${required.replace('_', ' ')} document required`,
            due: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
          })
        }
      }
    }

    // Create certification application
    const { data: application, error: appError } = await supabase
      .from('certifications')
      .insert({
        agent_id,
        target_tier,
        status: requiredActions.length > 0 ? 'pending' : 'in_review',
        contact,
        attestations,
        documents: documents || [],
        notes,
        required_actions: requiredActions,
      })
      .select('id')
      .single()

    if (appError) {
      console.error('Certification application error:', appError)
      return NextResponse.json(
        { error: { code: 'internal_error', message: 'Failed to create application' } },
        { status: 500 }
      )
    }

    // Record event
    await supabase.from('trust_events').insert({
      agent_id,
      event_type: 'certification_applied',
      score_delta: 0,
      metadata: { target_tier, application_id: application.id },
    })

    return NextResponse.json({
      application_id: application.id,
      status: requiredActions.length > 0 ? 'pending' : 'in_review',
      estimated_review_days: requirements.reviewDays,
      required_actions: requiredActions,
    }, { status: 201 })
  } catch (err: any) {
    console.error('Certification apply error:', err)
    return NextResponse.json(
      { error: { code: 'internal_error', message: err.message } },
      { status: 500 }
    )
  }
}
