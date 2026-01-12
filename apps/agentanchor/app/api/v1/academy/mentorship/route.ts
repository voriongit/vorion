/**
 * Mentorship API
 * Epic 13 - Stories 13-3, 13-4
 *
 * GET /api/v1/academy/mentorship/mentors - Find available mentors
 * GET /api/v1/academy/mentorship/eligibility - Check mentor eligibility
 * POST /api/v1/academy/mentorship/apply - Apply for mentor certification
 * POST /api/v1/academy/mentorship/request - Request mentorship
 * POST /api/v1/academy/mentorship/accept - Accept mentorship request
 * POST /api/v1/academy/mentorship/complete - Complete mentorship
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  findAvailableMentors,
  getMentorEligibility,
  getMentorCertification,
  applyForMentorCertification,
  completeMentorCertification,
  requestMentorship,
  acceptMentorship,
  declineMentorship,
  completeMentorship,
  getAgentMentorships,
  getPendingMentorshipRequests,
} from '@/lib/academy/mentorship-service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const agentId = searchParams.get('agentId')

    // Find available mentors
    if (action === 'mentors') {
      const specialization = searchParams.get('specialization') || undefined
      const minRating = searchParams.get('minRating')
        ? parseFloat(searchParams.get('minRating')!)
        : undefined

      const mentors = await findAvailableMentors({ specialization, minRating })
      return NextResponse.json({ success: true, data: mentors })
    }

    // Check mentor eligibility
    if (action === 'eligibility' && agentId) {
      const eligibility = await getMentorEligibility(agentId)
      return NextResponse.json({ success: true, data: eligibility })
    }

    // Get mentor certification
    if (action === 'certification' && agentId) {
      const certification = await getMentorCertification(agentId)
      return NextResponse.json({ success: true, data: certification })
    }

    // Get pending mentorship requests
    if (action === 'pending' && agentId) {
      const pending = await getPendingMentorshipRequests(agentId)
      return NextResponse.json({ success: true, data: pending })
    }

    // Get agent's mentorships
    if (action === 'relationships' && agentId) {
      const role = searchParams.get('role') as 'mentor' | 'mentee' | 'both' || 'both'
      const relationships = await getAgentMentorships(agentId, role)
      return NextResponse.json({ success: true, data: relationships })
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action or missing parameters' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error in mentorship GET:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { action } = body

    // Apply for mentor certification
    if (action === 'apply') {
      const { agentId } = body
      if (!agentId) {
        return NextResponse.json(
          { success: false, error: 'agentId is required' },
          { status: 400 }
        )
      }

      // Verify ownership
      const { data: agent } = await supabase
        .from('bots')
        .select('user_id')
        .eq('id', agentId)
        .single()

      if (!agent || agent.user_id !== user.id) {
        return NextResponse.json(
          { success: false, error: 'Agent not found or not owned by you' },
          { status: 403 }
        )
      }

      const result = await applyForMentorCertification(agentId)
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        )
      }

      return NextResponse.json({
        success: true,
        data: { certificationId: result.certificationId },
      }, { status: 201 })
    }

    // Complete mentor certification
    if (action === 'complete-certification') {
      const { certificationId, score } = body
      if (!certificationId || score === undefined) {
        return NextResponse.json(
          { success: false, error: 'certificationId and score are required' },
          { status: 400 }
        )
      }

      const result = await completeMentorCertification(certificationId, score)
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        )
      }

      return NextResponse.json({ success: true })
    }

    // Request mentorship
    if (action === 'request') {
      const { menteeId, mentorId, enrollmentId } = body
      if (!menteeId || !mentorId) {
        return NextResponse.json(
          { success: false, error: 'menteeId and mentorId are required' },
          { status: 400 }
        )
      }

      const result = await requestMentorship(menteeId, mentorId, enrollmentId)
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        )
      }

      return NextResponse.json({
        success: true,
        data: { relationshipId: result.relationshipId },
      }, { status: 201 })
    }

    // Accept mentorship
    if (action === 'accept') {
      const { mentorId, relationshipId } = body
      if (!mentorId || !relationshipId) {
        return NextResponse.json(
          { success: false, error: 'mentorId and relationshipId are required' },
          { status: 400 }
        )
      }

      const result = await acceptMentorship(mentorId, relationshipId)
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        )
      }

      return NextResponse.json({ success: true })
    }

    // Decline mentorship
    if (action === 'decline') {
      const { mentorId, relationshipId, reason } = body
      if (!mentorId || !relationshipId) {
        return NextResponse.json(
          { success: false, error: 'mentorId and relationshipId are required' },
          { status: 400 }
        )
      }

      const result = await declineMentorship(mentorId, relationshipId, reason)
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        )
      }

      return NextResponse.json({ success: true })
    }

    // Complete mentorship
    if (action === 'complete') {
      const { relationshipId, initiatorId, outcome, rating, feedbackText } = body
      if (!relationshipId || !initiatorId || !outcome) {
        return NextResponse.json(
          { success: false, error: 'relationshipId, initiatorId, and outcome are required' },
          { status: 400 }
        )
      }

      const result = await completeMentorship(
        relationshipId,
        initiatorId,
        outcome,
        rating || feedbackText ? { rating, feedbackText } : undefined
      )

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        )
      }

      return NextResponse.json({ success: true })
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error in mentorship POST:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
