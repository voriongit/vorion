/**
 * Specialization Service
 * Epic 13: Academy Specializations & Mentorship
 *
 * Story 13-1: Specialization Tracks Definition
 * Story 13-2: Specialization Enrollment & Progress
 */

import { createClient } from '@/lib/supabase/server'
import { createRecord as createTruthChainRecord } from '@/lib/truth-chain/truth-chain-service'
import { applyTrustChange } from '@/lib/agents/trust-service'

// =============================================================================
// Types
// =============================================================================

export interface SpecializationTrack {
  id: string
  slug: string
  name: string
  description: string | null
  icon: string | null
  category: string
  prerequisiteTrackId: string | null
  minTrustScore: number
  curriculumId: string | null
  trustScoreBonus: number
  certificationBadge: string
  isActive: boolean
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  estimatedDuration: number
  createdAt: string
}

export interface SpecializationEnrollment {
  id: string
  agentId: string
  trackId: string
  status: 'enrolled' | 'in_progress' | 'completed' | 'withdrawn'
  startedAt: string
  completedAt: string | null
  overallScore: number | null
  moduleScores: Record<string, number>
  currentModuleIndex: number
  certificationIssuedAt: string | null
  certificationTruthChainHash: string | null
  mentorId: string | null
  mentorshipStartedAt: string | null
}

export interface EnrollmentProgress {
  enrollment: SpecializationEnrollment
  track: SpecializationTrack
  progress: {
    total: number
    completed: number
    percentage: number
  }
  moduleStatus: Record<string, { status: string; score?: number }>
}

// =============================================================================
// Story 13-1: Specialization Tracks
// =============================================================================

/**
 * Get all available specialization tracks
 */
export async function getAvailableTracks(options?: {
  category?: string
  agentId?: string // Filter by eligibility
}): Promise<SpecializationTrack[]> {
  const supabase = await createClient()

  let query = supabase
    .from('specialization_tracks')
    .select('*')
    .eq('is_active', true)
    .order('category')
    .order('name')

  if (options?.category) {
    query = query.eq('category', options.category)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching tracks:', error)
    return []
  }

  let tracks = (data || []).map(mapTrack)

  // Filter by eligibility if agentId provided
  if (options?.agentId) {
    const eligibilityResults = await Promise.all(
      tracks.map(t => checkTrackEligibility(options.agentId!, t.id))
    )
    tracks = tracks.filter((_, i) => eligibilityResults[i].eligible)
  }

  return tracks
}

/**
 * Get track by slug
 */
export async function getTrackBySlug(slug: string): Promise<SpecializationTrack | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('specialization_tracks')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (error || !data) {
    return null
  }

  return mapTrack(data)
}

/**
 * Get track by ID
 */
export async function getTrackById(id: string): Promise<SpecializationTrack | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('specialization_tracks')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) {
    return null
  }

  return mapTrack(data)
}

/**
 * Check if agent is eligible for a track
 */
export async function checkTrackEligibility(
  agentId: string,
  trackId: string
): Promise<{ eligible: boolean; reasons: string[] }> {
  const supabase = await createClient()
  const reasons: string[] = []

  // Get agent and track
  const [{ data: agent }, track] = await Promise.all([
    supabase.from('bots').select('id, trust_score, academy_status').eq('id', agentId).single(),
    getTrackById(trackId),
  ])

  if (!agent) {
    return { eligible: false, reasons: ['Agent not found'] }
  }

  if (!track) {
    return { eligible: false, reasons: ['Track not found'] }
  }

  // Check Core Curriculum completion
  if (agent.academy_status !== 'graduated') {
    reasons.push('Must complete Core Curriculum first')
  }

  // Check trust score
  if ((agent.trust_score || 0) < track.minTrustScore) {
    reasons.push(`Trust Score must be at least ${track.minTrustScore} (current: ${agent.trust_score || 0})`)
  }

  // Check prerequisites
  if (track.prerequisiteTrackId) {
    const prereqComplete = await hasCompletedTrack(agentId, track.prerequisiteTrackId)
    if (!prereqComplete) {
      const prereqTrack = await getTrackById(track.prerequisiteTrackId)
      reasons.push(`Must complete prerequisite: ${prereqTrack?.name || 'Unknown track'}`)
    }
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  }
}

/**
 * Check if agent has completed a specific track
 */
export async function hasCompletedTrack(agentId: string, trackId: string): Promise<boolean> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('specialization_enrollments')
    .select('id')
    .eq('agent_id', agentId)
    .eq('track_id', trackId)
    .eq('status', 'completed')
    .single()

  return !!data
}

// =============================================================================
// Story 13-2: Specialization Enrollment
// =============================================================================

/**
 * Enroll agent in a specialization track
 */
export async function enrollInSpecialization(
  agentId: string,
  trackId: string,
  mentorId?: string
): Promise<{ success: boolean; enrollmentId?: string; error?: string }> {
  const supabase = await createClient()

  // Check eligibility
  const { eligible, reasons } = await checkTrackEligibility(agentId, trackId)
  if (!eligible) {
    return { success: false, error: reasons.join(', ') }
  }

  // Check not already enrolled
  const { data: existing } = await supabase
    .from('specialization_enrollments')
    .select('id, status')
    .eq('agent_id', agentId)
    .eq('track_id', trackId)
    .single()

  if (existing) {
    if (existing.status === 'completed') {
      return { success: false, error: 'Already completed this track' }
    }
    if (existing.status === 'enrolled' || existing.status === 'in_progress') {
      return { success: true, enrollmentId: existing.id }
    }
  }

  // Create enrollment
  const { data, error } = await supabase
    .from('specialization_enrollments')
    .insert({
      agent_id: agentId,
      track_id: trackId,
      mentor_id: mentorId,
      mentorship_started_at: mentorId ? new Date().toISOString() : null,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating enrollment:', error)
    return { success: false, error: error.message }
  }

  return { success: true, enrollmentId: data.id }
}

/**
 * Get enrollment by ID
 */
export async function getEnrollment(enrollmentId: string): Promise<SpecializationEnrollment | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('specialization_enrollments')
    .select('*')
    .eq('id', enrollmentId)
    .single()

  if (error || !data) {
    return null
  }

  return mapEnrollment(data)
}

/**
 * Get enrollment progress
 */
export async function getSpecializationEnrollmentProgress(enrollmentId: string): Promise<EnrollmentProgress | null> {
  const supabase = await createClient()

  const { data: enrollment } = await supabase
    .from('specialization_enrollments')
    .select('*')
    .eq('id', enrollmentId)
    .single()

  if (!enrollment) {
    return null
  }

  const track = await getTrackById(enrollment.track_id)
  if (!track) {
    return null
  }

  // For now, assume 5 modules per track (can be made dynamic later)
  const totalModules = 5
  const moduleScores = enrollment.module_scores || {}
  const completedModules = Object.keys(moduleScores).length

  const moduleStatus: Record<string, { status: string; score?: number }> = {}
  for (let i = 1; i <= totalModules; i++) {
    const moduleId = `mod-${i}`
    if (moduleScores[moduleId] !== undefined) {
      moduleStatus[moduleId] = { status: 'completed', score: moduleScores[moduleId] }
    } else if (i === enrollment.current_module_index + 1) {
      moduleStatus[moduleId] = { status: 'in_progress' }
    } else {
      moduleStatus[moduleId] = { status: 'not_started' }
    }
  }

  return {
    enrollment: mapEnrollment(enrollment),
    track,
    progress: {
      total: totalModules,
      completed: completedModules,
      percentage: Math.round((completedModules / totalModules) * 100),
    },
    moduleStatus,
  }
}

/**
 * Update module score and progress
 */
export async function updateModuleProgress(
  enrollmentId: string,
  moduleId: string,
  score: number
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: enrollment } = await supabase
    .from('specialization_enrollments')
    .select('module_scores, current_module_index')
    .eq('id', enrollmentId)
    .single()

  if (!enrollment) {
    return { success: false, error: 'Enrollment not found' }
  }

  const moduleScores = { ...(enrollment.module_scores || {}), [moduleId]: score }
  const moduleIndex = parseInt(moduleId.replace('mod-', ''), 10)

  const { error } = await supabase
    .from('specialization_enrollments')
    .update({
      module_scores: moduleScores,
      current_module_index: Math.max(enrollment.current_module_index, moduleIndex),
      status: 'in_progress',
      updated_at: new Date().toISOString(),
    })
    .eq('id', enrollmentId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

/**
 * Complete specialization enrollment
 */
export async function completeSpecialization(
  enrollmentId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const progress = await getSpecializationEnrollmentProgress(enrollmentId)
  if (!progress) {
    return { success: false, error: 'Enrollment not found' }
  }

  // Verify all modules completed
  if (progress.progress.completed < progress.progress.total) {
    return { success: false, error: `Not all modules completed (${progress.progress.completed}/${progress.progress.total})` }
  }

  // Calculate overall score
  const scores = Object.values(progress.enrollment.moduleScores)
  const overallScore = scores.length > 0
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : 0

  // Check passing score (70%)
  if (overallScore < 70) {
    return { success: false, error: `Overall score ${overallScore.toFixed(1)}% below passing threshold (70%)` }
  }

  const now = new Date().toISOString()

  // Update enrollment
  const { error: updateError } = await supabase
    .from('specialization_enrollments')
    .update({
      status: 'completed',
      completed_at: now,
      overall_score: overallScore,
      certification_issued_at: now,
    })
    .eq('id', enrollmentId)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  // Record to Truth Chain
  try {
    const truthChainResult = await createTruthChainRecord({
      record_type: 'certification',
      agent_id: progress.enrollment.agentId,
      data: {
        type: 'specialization',
        enrollmentId,
        trackId: progress.track.id,
        trackSlug: progress.track.slug,
        trackName: progress.track.name,
        badge: progress.track.certificationBadge,
        score: overallScore,
      },
    })

    // Update with hash
    if (truthChainResult?.hash) {
      await supabase
        .from('specialization_enrollments')
        .update({ certification_truth_chain_hash: truthChainResult.hash })
        .eq('id', enrollmentId)
    }
  } catch (e) {
    console.error('Error recording to truth chain:', e)
  }

  // Apply trust score bonus
  try {
    await applyTrustChange(
      progress.enrollment.agentId,
      'training_milestone',
      progress.track.trustScoreBonus,
      `Completed ${progress.track.name} specialization`
    )
  } catch (e) {
    console.error('Error applying trust bonus:', e)
  }

  return { success: true }
}

/**
 * Get all specializations for an agent
 */
export async function getAgentSpecializations(agentId: string): Promise<Array<{
  enrollment: SpecializationEnrollment
  track: SpecializationTrack
}>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('specialization_enrollments')
    .select(`
      *,
      track:specialization_tracks(*)
    `)
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })

  if (error || !data) {
    return []
  }

  return data.map(d => ({
    enrollment: mapEnrollment(d),
    track: mapTrack(d.track),
  }))
}

/**
 * Get completed specializations (badges) for an agent
 */
export async function getAgentBadges(agentId: string): Promise<Array<{
  badge: string
  trackName: string
  certifiedAt: string
}>> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('specialization_enrollments')
    .select(`
      certification_issued_at,
      track:specialization_tracks(name, certification_badge)
    `)
    .eq('agent_id', agentId)
    .eq('status', 'completed')

  if (!data) {
    return []
  }

  return data.map(d => ({
    badge: (d.track as any)?.certification_badge || '',
    trackName: (d.track as any)?.name || '',
    certifiedAt: d.certification_issued_at || '',
  }))
}

// =============================================================================
// Helpers
// =============================================================================

function mapTrack(data: any): SpecializationTrack {
  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    description: data.description,
    icon: data.icon,
    category: data.category,
    prerequisiteTrackId: data.prerequisite_track_id,
    minTrustScore: data.min_trust_score,
    curriculumId: data.curriculum_id,
    trustScoreBonus: data.trust_score_bonus,
    certificationBadge: data.certification_badge,
    isActive: data.is_active,
    difficulty: data.difficulty,
    estimatedDuration: data.estimated_duration,
    createdAt: data.created_at,
  }
}

function mapEnrollment(data: any): SpecializationEnrollment {
  return {
    id: data.id,
    agentId: data.agent_id,
    trackId: data.track_id,
    status: data.status,
    startedAt: data.started_at,
    completedAt: data.completed_at,
    overallScore: data.overall_score,
    moduleScores: data.module_scores || {},
    currentModuleIndex: data.current_module_index || 0,
    certificationIssuedAt: data.certification_issued_at,
    certificationTruthChainHash: data.certification_truth_chain_hash,
    mentorId: data.mentor_id,
    mentorshipStartedAt: data.mentorship_started_at,
  }
}
