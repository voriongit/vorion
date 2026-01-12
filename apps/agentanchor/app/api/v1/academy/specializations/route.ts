/**
 * Specialization Tracks API
 * Epic 13 - Story 13-1: Specialization Tracks Definition
 *
 * GET /api/v1/academy/specializations - List all tracks
 * POST /api/v1/academy/specializations - Enroll in a track (Story 13-2)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getAvailableTracks,
  getTrackBySlug,
  enrollInSpecialization,
  checkTrackEligibility,
} from '@/lib/academy/specialization-service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') || undefined
    const agentId = searchParams.get('agentId') || undefined
    const slug = searchParams.get('slug') || undefined

    // If slug provided, get single track
    if (slug) {
      const track = await getTrackBySlug(slug)
      if (!track) {
        return NextResponse.json(
          { success: false, error: 'Track not found' },
          { status: 404 }
        )
      }

      // Check eligibility if agentId provided
      let eligibility = null
      if (agentId) {
        eligibility = await checkTrackEligibility(agentId, track.id)
      }

      return NextResponse.json({
        success: true,
        data: { track, eligibility },
      })
    }

    // Get all tracks
    const tracks = await getAvailableTracks({ category, agentId })

    return NextResponse.json({
      success: true,
      data: tracks,
    })
  } catch (error) {
    console.error('Error fetching specializations:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch specializations' },
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
    const { agentId, trackId, mentorId } = body

    if (!agentId || !trackId) {
      return NextResponse.json(
        { success: false, error: 'agentId and trackId are required' },
        { status: 400 }
      )
    }

    // Verify user owns the agent
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

    const result = await enrollInSpecialization(agentId, trackId, mentorId)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      data: { enrollmentId: result.enrollmentId },
    }, { status: 201 })
  } catch (error) {
    console.error('Error enrolling in specialization:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to enroll in specialization' },
      { status: 500 }
    )
  }
}
