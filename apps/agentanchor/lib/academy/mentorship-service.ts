/**
 * Mentorship Service
 * Epic 13: Academy Specializations & Mentorship
 *
 * Story 13-3: Mentor Certification Program
 * Story 13-4: Mentorship Relationships & Management
 */

import { createClient } from '@/lib/supabase/server'
import { createRecord as createTruthChainRecord } from '@/lib/truth-chain/truth-chain-service'
import { applyTrustChange } from '@/lib/agents/trust-service'

// =============================================================================
// Types
// =============================================================================

export interface MentorCertification {
  id: string
  agentId: string
  status: 'pending' | 'active' | 'suspended' | 'revoked'
  trainingEnrollmentId: string | null
  trainingCompletedAt: string | null
  certifiedAt: string | null
  totalMentees: number
  successfulGraduations: number
  successRate: number | null
  avgMenteeTrustImprovement: number | null
  maxConcurrentMentees: number
  currentMenteeCount: number
  specializations: string[]
  certificationTruthChainHash: string | null
}

export interface MentorProfile {
  agent: {
    id: string
    name: string
    trustScore: number
  }
  certification: MentorCertification
  availableSlots: number
  specializations: string[]
  avgRating: number
  totalMentees: number
  successRate: number
}

export interface MentorRequirement {
  name: string
  met: boolean
  details?: string
}

export interface MentorshipRelationship {
  id: string
  mentorId: string
  menteeId: string
  enrollmentId: string | null
  status: 'requested' | 'active' | 'completed' | 'terminated'
  requestedAt: string
  acceptedAt: string | null
  startedAt: string | null
  endedAt: string | null
  outcome: 'graduated' | 'withdrew' | 'terminated_by_mentor' | 'terminated_by_mentee' | null
  outcomeNotes: string | null
  mentorRating: number | null
  menteeRating: number | null
  mentorFeedback: string | null
  menteeFeedback: string | null
  sessionsCompleted: number
  trustImprovement: number
}

// =============================================================================
// Story 13-3: Mentor Certification
// =============================================================================

/**
 * Check if agent is eligible to become a mentor
 */
export async function getMentorEligibility(
  agentId: string
): Promise<{ eligible: boolean; requirements: MentorRequirement[] }> {
  const supabase = await createClient()

  // Get agent details
  const { data: agent } = await supabase
    .from('bots')
    .select('id, trust_score, academy_status')
    .eq('id', agentId)
    .single()

  if (!agent) {
    return { eligible: false, requirements: [{ name: 'Agent exists', met: false }] }
  }

  // Check specializations completed
  const { data: specializations } = await supabase
    .from('specialization_enrollments')
    .select('id')
    .eq('agent_id', agentId)
    .eq('status', 'completed')

  // Check for violations in last 30 days
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: violations } = await supabase
    .from('council_decisions')
    .select('id')
    .eq('agent_id', agentId)
    .eq('outcome', 'denied')
    .gte('created_at', thirtyDaysAgo.toISOString())

  const requirements: MentorRequirement[] = [
    {
      name: 'Elite Tier (Trust 800+)',
      met: (agent.trust_score || 0) >= 800,
      details: `Current: ${agent.trust_score || 0}`,
    },
    {
      name: 'Core Curriculum Complete',
      met: agent.academy_status === 'graduated',
    },
    {
      name: 'At Least One Specialization',
      met: (specializations?.length || 0) > 0,
      details: `Completed: ${specializations?.length || 0}`,
    },
    {
      name: 'Good Standing (No Recent Violations)',
      met: (violations?.length || 0) === 0,
      details: violations?.length ? `${violations.length} violations in last 30 days` : undefined,
    },
  ]

  return {
    eligible: requirements.every(r => r.met),
    requirements,
  }
}

/**
 * Get mentor certification for an agent
 */
export async function getMentorCertification(agentId: string): Promise<MentorCertification | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('mentor_certifications')
    .select('*')
    .eq('agent_id', agentId)
    .single()

  if (error || !data) {
    return null
  }

  return mapCertification(data)
}

/**
 * Apply for mentor certification
 */
export async function applyForMentorCertification(
  agentId: string
): Promise<{ success: boolean; certificationId?: string; error?: string }> {
  const supabase = await createClient()

  // Check eligibility
  const { eligible, requirements } = await getMentorEligibility(agentId)
  if (!eligible) {
    const missing = requirements.filter(r => !r.met).map(r => r.name)
    return { success: false, error: `Missing requirements: ${missing.join(', ')}` }
  }

  // Check not already certified
  const existing = await getMentorCertification(agentId)
  if (existing) {
    if (existing.status === 'active') {
      return { success: false, error: 'Already certified as mentor' }
    }
    if (existing.status === 'pending') {
      return { success: true, certificationId: existing.id }
    }
  }

  // Get agent's completed specializations
  const { data: specs } = await supabase
    .from('specialization_enrollments')
    .select('track:specialization_tracks(slug)')
    .eq('agent_id', agentId)
    .eq('status', 'completed')

  const specializations = specs?.map(s => (s.track as any)?.slug).filter(Boolean) || []

  // Create pending certification
  const { data, error } = await supabase
    .from('mentor_certifications')
    .insert({
      agent_id: agentId,
      status: 'pending',
      specializations,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating mentor certification:', error)
    return { success: false, error: error.message }
  }

  return { success: true, certificationId: data.id }
}

/**
 * Complete mentor certification (after training)
 */
export async function completeMentorCertification(
  certificationId: string,
  score: number
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  if (score < 80) {
    return { success: false, error: 'Score must be 80% or higher to become a mentor' }
  }

  const { data: cert } = await supabase
    .from('mentor_certifications')
    .select('agent_id')
    .eq('id', certificationId)
    .single()

  if (!cert) {
    return { success: false, error: 'Certification not found' }
  }

  const now = new Date().toISOString()

  // Update certification
  const { error: updateError } = await supabase
    .from('mentor_certifications')
    .update({
      status: 'active',
      training_completed_at: now,
      certified_at: now,
    })
    .eq('id', certificationId)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  // Record to Truth Chain
  try {
    const result = await createTruthChainRecord({
      record_type: 'certification',
      agent_id: cert.agent_id,
      data: {
        type: 'mentor',
        certificationId,
        score,
      },
    })

    if (result?.hash) {
      await supabase
        .from('mentor_certifications')
        .update({ certification_truth_chain_hash: result.hash })
        .eq('id', certificationId)
    }
  } catch (e) {
    console.error('Error recording to truth chain:', e)
  }

  return { success: true }
}

// =============================================================================
// Story 13-4: Mentorship Program
// =============================================================================

/**
 * Find available mentors
 */
export async function findAvailableMentors(options?: {
  trackId?: string
  specialization?: string
  minRating?: number
}): Promise<MentorProfile[]> {
  const supabase = await createClient()

  const { data: certifications } = await supabase
    .from('mentor_certifications')
    .select(`
      *,
      agent:bots(id, name, trust_score)
    `)
    .eq('status', 'active')

  if (!certifications) {
    return []
  }

  // Filter to mentors with available slots
  let mentors = certifications
    .filter(c => c.current_mentee_count < c.max_concurrent_mentees)
    .map(c => ({
      agent: {
        id: c.agent.id,
        name: c.agent.name,
        trustScore: c.agent.trust_score || 0,
      },
      certification: mapCertification(c),
      availableSlots: c.max_concurrent_mentees - c.current_mentee_count,
      specializations: c.specializations || [],
      avgRating: 0, // Will calculate from relationships
      totalMentees: c.total_mentees || 0,
      successRate: c.success_rate || 0,
    }))

  // Filter by specialization if requested
  if (options?.specialization) {
    mentors = mentors.filter(m =>
      m.specializations.includes(options.specialization!)
    )
  }

  // Calculate average ratings from mentorship relationships
  for (const mentor of mentors) {
    const { data: ratings } = await supabase
      .from('mentorship_relationships')
      .select('mentor_rating')
      .eq('mentor_id', mentor.agent.id)
      .eq('status', 'completed')
      .not('mentor_rating', 'is', null)

    if (ratings && ratings.length > 0) {
      mentor.avgRating = ratings.reduce((sum, r) => sum + r.mentor_rating, 0) / ratings.length
    }
  }

  // Filter by minimum rating
  if (options?.minRating) {
    mentors = mentors.filter(m => m.avgRating >= options.minRating!)
  }

  // Sort by rating descending
  mentors.sort((a, b) => b.avgRating - a.avgRating)

  return mentors
}

/**
 * Request mentorship from a mentor
 */
export async function requestMentorship(
  menteeId: string,
  mentorId: string,
  enrollmentId?: string
): Promise<{ success: boolean; relationshipId?: string; error?: string }> {
  const supabase = await createClient()

  // Verify mentor has availability
  const certification = await getMentorCertification(mentorId)
  if (!certification || certification.status !== 'active') {
    return { success: false, error: 'Mentor is not available' }
  }

  if (certification.currentMenteeCount >= certification.maxConcurrentMentees) {
    return { success: false, error: 'Mentor has no available slots' }
  }

  // Check for existing relationship
  const { data: existing } = await supabase
    .from('mentorship_relationships')
    .select('id, status')
    .eq('mentor_id', mentorId)
    .eq('mentee_id', menteeId)
    .in('status', ['requested', 'active'])
    .single()

  if (existing) {
    return { success: false, error: 'Already have a pending or active relationship with this mentor' }
  }

  // Create relationship
  const { data, error } = await supabase
    .from('mentorship_relationships')
    .insert({
      mentor_id: mentorId,
      mentee_id: menteeId,
      enrollment_id: enrollmentId,
      status: 'requested',
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating mentorship request:', error)
    return { success: false, error: error.message }
  }

  // Notify mentor
  await supabase
    .from('notifications')
    .insert({
      user_id: mentorId, // This should be the mentor's owner, but using agent ID for now
      type: 'mentorship_request',
      title: 'New Mentorship Request',
      message: 'You have a new mentorship request',
      metadata: { relationshipId: data.id },
    })

  return { success: true, relationshipId: data.id }
}

/**
 * Accept a mentorship request
 */
export async function acceptMentorship(
  mentorId: string,
  relationshipId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: relationship } = await supabase
    .from('mentorship_relationships')
    .select('*')
    .eq('id', relationshipId)
    .single()

  if (!relationship || relationship.mentor_id !== mentorId) {
    return { success: false, error: 'Relationship not found' }
  }

  if (relationship.status !== 'requested') {
    return { success: false, error: 'Relationship not in requested state' }
  }

  const now = new Date().toISOString()

  // Update relationship
  const { error: updateError } = await supabase
    .from('mentorship_relationships')
    .update({
      status: 'active',
      accepted_at: now,
      started_at: now,
    })
    .eq('id', relationshipId)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  // Increment mentor's current count
  await supabase.rpc('increment_mentee_count', { p_mentor_id: mentorId })

  // Update enrollment if linked
  if (relationship.enrollment_id) {
    await supabase
      .from('specialization_enrollments')
      .update({
        mentor_id: mentorId,
        mentorship_started_at: now,
      })
      .eq('id', relationship.enrollment_id)
  }

  // Notify mentee
  await supabase
    .from('notifications')
    .insert({
      user_id: relationship.mentee_id,
      type: 'mentorship_accepted',
      title: 'Mentorship Accepted',
      message: 'Your mentorship request was accepted!',
      metadata: { relationshipId },
    })

  return { success: true }
}

/**
 * Decline a mentorship request
 */
export async function declineMentorship(
  mentorId: string,
  relationshipId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: relationship } = await supabase
    .from('mentorship_relationships')
    .select('*')
    .eq('id', relationshipId)
    .single()

  if (!relationship || relationship.mentor_id !== mentorId) {
    return { success: false, error: 'Relationship not found' }
  }

  const { error } = await supabase
    .from('mentorship_relationships')
    .update({
      status: 'terminated',
      ended_at: new Date().toISOString(),
      outcome: 'terminated_by_mentor',
      outcome_notes: reason || 'Request declined',
    })
    .eq('id', relationshipId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

/**
 * Complete mentorship with outcome and feedback
 */
export async function completeMentorship(
  relationshipId: string,
  initiatorId: string,
  outcome: 'graduated' | 'withdrew' | 'terminated_by_mentor' | 'terminated_by_mentee',
  feedback?: {
    rating?: number
    feedbackText?: string
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: relationship } = await supabase
    .from('mentorship_relationships')
    .select('*')
    .eq('id', relationshipId)
    .single()

  if (!relationship || relationship.status !== 'active') {
    return { success: false, error: 'Active relationship not found' }
  }

  const isMentor = initiatorId === relationship.mentor_id

  // Build update object
  const updates: any = {
    status: 'completed',
    ended_at: new Date().toISOString(),
    outcome,
  }

  if (feedback) {
    if (isMentor) {
      updates.mentee_rating = feedback.rating
      updates.mentor_feedback = feedback.feedbackText
    } else {
      updates.mentor_rating = feedback.rating
      updates.mentee_feedback = feedback.feedbackText
    }
  }

  // Update relationship
  const { error: updateError } = await supabase
    .from('mentorship_relationships')
    .update(updates)
    .eq('id', relationshipId)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  // Decrement mentor's current count
  await supabase.rpc('decrement_mentee_count', { p_mentor_id: relationship.mentor_id })

  // Update mentor stats
  await supabase.rpc('update_mentor_stats', { p_mentor_id: relationship.mentor_id })

  // Apply trust bonuses if graduated
  if (outcome === 'graduated') {
    try {
      // Mentee gets +30
      await applyTrustChange(
        relationship.mentee_id,
        'training_milestone',
        30,
        'Graduated with mentor guidance'
      )

      // Mentor gets +20
      await applyTrustChange(
        relationship.mentor_id,
        'commendation',
        20,
        'Successfully mentored an agent to graduation'
      )
    } catch (e) {
      console.error('Error applying trust bonuses:', e)
    }
  }

  // Record to Truth Chain
  try {
    await createTruthChainRecord({
      record_type: 'certification',
      agent_id: initiatorId,
      data: {
        type: 'mentorship_completion',
        relationshipId,
        mentorId: relationship.mentor_id,
        menteeId: relationship.mentee_id,
        outcome,
      },
    })
  } catch (e) {
    console.error('Error recording to truth chain:', e)
  }

  return { success: true }
}

/**
 * Get mentorship relationships for an agent (as mentor or mentee)
 */
export async function getAgentMentorships(
  agentId: string,
  role: 'mentor' | 'mentee' | 'both' = 'both'
): Promise<MentorshipRelationship[]> {
  const supabase = await createClient()

  let query = supabase
    .from('mentorship_relationships')
    .select('*')
    .order('created_at', { ascending: false })

  if (role === 'mentor') {
    query = query.eq('mentor_id', agentId)
  } else if (role === 'mentee') {
    query = query.eq('mentee_id', agentId)
  } else {
    query = query.or(`mentor_id.eq.${agentId},mentee_id.eq.${agentId}`)
  }

  const { data, error } = await query

  if (error || !data) {
    return []
  }

  return data.map(mapRelationship)
}

/**
 * Get pending mentorship requests for a mentor
 */
export async function getPendingMentorshipRequests(mentorId: string): Promise<MentorshipRelationship[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('mentorship_relationships')
    .select('*')
    .eq('mentor_id', mentorId)
    .eq('status', 'requested')
    .order('requested_at', { ascending: true })

  return (data || []).map(mapRelationship)
}

// =============================================================================
// Helpers
// =============================================================================

function mapCertification(data: any): MentorCertification {
  return {
    id: data.id,
    agentId: data.agent_id,
    status: data.status,
    trainingEnrollmentId: data.training_enrollment_id,
    trainingCompletedAt: data.training_completed_at,
    certifiedAt: data.certified_at,
    totalMentees: data.total_mentees || 0,
    successfulGraduations: data.successful_graduations || 0,
    successRate: data.success_rate,
    avgMenteeTrustImprovement: data.avg_mentee_trust_improvement,
    maxConcurrentMentees: data.max_concurrent_mentees || 3,
    currentMenteeCount: data.current_mentee_count || 0,
    specializations: data.specializations || [],
    certificationTruthChainHash: data.certification_truth_chain_hash,
  }
}

function mapRelationship(data: any): MentorshipRelationship {
  return {
    id: data.id,
    mentorId: data.mentor_id,
    menteeId: data.mentee_id,
    enrollmentId: data.enrollment_id,
    status: data.status,
    requestedAt: data.requested_at,
    acceptedAt: data.accepted_at,
    startedAt: data.started_at,
    endedAt: data.ended_at,
    outcome: data.outcome,
    outcomeNotes: data.outcome_notes,
    mentorRating: data.mentor_rating,
    menteeRating: data.mentee_rating,
    mentorFeedback: data.mentor_feedback,
    menteeFeedback: data.mentee_feedback,
    sessionsCompleted: data.sessions_completed || 0,
    trustImprovement: data.trust_improvement || 0,
  }
}
