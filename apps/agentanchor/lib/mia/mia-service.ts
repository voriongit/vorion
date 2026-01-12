/**
 * MIA (Missing-In-Action) Protocol Service
 * Epic 10: MIA Protocol
 *
 * Story 10-1: Trainer Activity Tracking (FR116-117)
 * Story 10-2: MIA Detection Engine (FR116)
 * Story 10-3: Graduated Warning System (FR118)
 * Story 10-4: Consumer MIA Notifications (FR119-120)
 * Story 10-5: Platform Takeover Flow (FR121-122)
 */

import { createClient } from '@/lib/supabase/server'

// ============================================================================
// Types
// ============================================================================

export type MIAStatus = 'active' | 'notice' | 'warning' | 'critical' | 'mia'
export type ActivityType = 'login' | 'agent_update' | 'response' | 'listing_update' | 'support_response' | 'payout_request'

export interface TrainerActivity {
  trainerId: string
  lastLogin?: string
  lastAgentUpdate?: string
  lastResponse?: string
  lastListingUpdate?: string
  activityScore: number // 0-100
  miaStatus: MIAStatus
  daysSinceActivity: number
  warningLevel: number // 0-3
  warningsSent: number
}

export interface MIAWarning {
  id: string
  trainerId: string
  level: 'notice' | 'warning' | 'critical' | 'final'
  sentAt: string
  acknowledgedAt?: string
  message: string
  deadline?: string
}

export interface MIATakeover {
  id: string
  trainerId: string
  agentId: string
  reason: 'mia' | 'abandonment' | 'platform_action'
  status: 'pending' | 'temporary' | 'permanent' | 'returned'
  temporaryMaintainerId?: string
  initiatedAt: string
  completedAt?: string
  returnedAt?: string
}

// ============================================================================
// Configuration
// ============================================================================

export const MIA_CONFIG = {
  // Days thresholds
  noticeThreshold: 14,      // 14 days - send notice
  warningThreshold: 21,     // 21 days - send warning
  criticalThreshold: 28,    // 28 days - send critical warning
  miaThreshold: 30,         // 30 days - mark as MIA

  // Grace period after each warning
  gracePeriodDays: 7,

  // Activity weights for score calculation
  activityWeights: {
    login: 1.0,
    agent_update: 2.0,
    response: 2.5,
    listing_update: 1.5,
    support_response: 3.0,
    payout_request: 0.5,
  } as Record<ActivityType, number>,

  // Minimum activity score to be considered active
  minActivityScore: 20,
}

// ============================================================================
// Story 10-1: Trainer Activity Tracking
// ============================================================================

/**
 * Record trainer activity
 */
export async function recordActivity(
  trainerId: string,
  activityType: ActivityType,
  metadata?: Record<string, unknown>
): Promise<void> {
  const supabase = await createClient()
  const now = new Date().toISOString()

  // Insert activity record
  await supabase
    .from('trainer_activity')
    .insert({
      trainer_id: trainerId,
      activity_type: activityType,
      metadata,
      created_at: now,
    })

  // Update trainer profile activity timestamp
  const updateField = getActivityUpdateField(activityType)
  if (updateField) {
    await supabase
      .from('profiles')
      .update({
        [updateField]: now,
        last_activity_at: now,
      })
      .eq('id', trainerId)
  }

  // Reset MIA warnings if trainer becomes active again
  await resetWarningsIfActive(trainerId)
}

function getActivityUpdateField(activityType: ActivityType): string | null {
  const fields: Record<ActivityType, string> = {
    login: 'last_login_at',
    agent_update: 'last_agent_update_at',
    response: 'last_response_at',
    listing_update: 'last_listing_update_at',
    support_response: 'last_support_response_at',
    payout_request: 'last_payout_request_at',
  }
  return fields[activityType] || null
}

/**
 * Get trainer activity summary
 */
export async function getTrainerActivity(trainerId: string): Promise<TrainerActivity | null> {
  const supabase = await createClient()

  // Get trainer profile with activity timestamps
  const { data: profile, error } = await supabase
    .from('profiles')
    .select(`
      id,
      last_login_at,
      last_agent_update_at,
      last_response_at,
      last_listing_update_at,
      last_activity_at
    `)
    .eq('id', trainerId)
    .single()

  if (error || !profile) {
    return null
  }

  // Calculate activity score and MIA status
  const now = new Date()
  const lastActivity = profile.last_activity_at ? new Date(profile.last_activity_at) : null
  const daysSinceActivity = lastActivity
    ? Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24))
    : 999

  const activityScore = await calculateActivityScore(trainerId)
  const miaStatus = getMIAStatus(daysSinceActivity)
  const warningLevel = getWarningLevel(daysSinceActivity)

  // Get warnings count
  const { count: warningsSent } = await supabase
    .from('mia_warnings')
    .select('*', { count: 'exact', head: true })
    .eq('trainer_id', trainerId)

  return {
    trainerId,
    lastLogin: profile.last_login_at,
    lastAgentUpdate: profile.last_agent_update_at,
    lastResponse: profile.last_response_at,
    lastListingUpdate: profile.last_listing_update_at,
    activityScore,
    miaStatus,
    daysSinceActivity,
    warningLevel,
    warningsSent: warningsSent || 0,
  }
}

/**
 * Calculate activity score based on recent activities
 */
async function calculateActivityScore(trainerId: string): Promise<number> {
  const supabase = await createClient()
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: activities } = await supabase
    .from('trainer_activity')
    .select('activity_type, created_at')
    .eq('trainer_id', trainerId)
    .gte('created_at', thirtyDaysAgo.toISOString())

  if (!activities || activities.length === 0) {
    return 0
  }

  // Calculate weighted score
  let score = 0
  const now = new Date()

  for (const activity of activities) {
    const weight = MIA_CONFIG.activityWeights[activity.activity_type as ActivityType] || 1
    const daysSince = Math.floor(
      (now.getTime() - new Date(activity.created_at).getTime()) / (1000 * 60 * 60 * 24)
    )
    // More recent activities count more
    const recencyMultiplier = Math.max(0.1, 1 - (daysSince / 30))
    score += weight * recencyMultiplier * 10
  }

  return Math.min(100, Math.round(score))
}

// ============================================================================
// Story 10-2: MIA Detection Engine
// ============================================================================

function getMIAStatus(daysSinceActivity: number): MIAStatus {
  if (daysSinceActivity >= MIA_CONFIG.miaThreshold) return 'mia'
  if (daysSinceActivity >= MIA_CONFIG.criticalThreshold) return 'critical'
  if (daysSinceActivity >= MIA_CONFIG.warningThreshold) return 'warning'
  if (daysSinceActivity >= MIA_CONFIG.noticeThreshold) return 'notice'
  return 'active'
}

function getWarningLevel(daysSinceActivity: number): number {
  if (daysSinceActivity >= MIA_CONFIG.miaThreshold) return 3
  if (daysSinceActivity >= MIA_CONFIG.criticalThreshold) return 2
  if (daysSinceActivity >= MIA_CONFIG.warningThreshold) return 1
  return 0
}

/**
 * Scan for MIA trainers (run via cron job)
 */
export async function scanForMIATrainers(): Promise<{
  total: number
  notice: string[]
  warning: string[]
  critical: string[]
  mia: string[]
}> {
  const supabase = await createClient()
  const now = new Date()

  // Get all trainers with their last activity
  const { data: trainers } = await supabase
    .from('profiles')
    .select('id, last_activity_at, role')
    .eq('role', 'trainer')

  if (!trainers) {
    return { total: 0, notice: [], warning: [], critical: [], mia: [] }
  }

  const results = {
    total: trainers.length,
    notice: [] as string[],
    warning: [] as string[],
    critical: [] as string[],
    mia: [] as string[],
  }

  for (const trainer of trainers) {
    const lastActivity = trainer.last_activity_at ? new Date(trainer.last_activity_at) : null
    const daysSinceActivity = lastActivity
      ? Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24))
      : 999

    const status = getMIAStatus(daysSinceActivity)

    switch (status) {
      case 'notice':
        results.notice.push(trainer.id)
        break
      case 'warning':
        results.warning.push(trainer.id)
        break
      case 'critical':
        results.critical.push(trainer.id)
        break
      case 'mia':
        results.mia.push(trainer.id)
        break
    }
  }

  return results
}

// ============================================================================
// Story 10-3: Graduated Warning System
// ============================================================================

/**
 * Send MIA warning to trainer
 */
export async function sendMIAWarning(
  trainerId: string,
  level: MIAWarning['level']
): Promise<MIAWarning> {
  const supabase = await createClient()
  const now = new Date()

  // Check if warning at this level was already sent recently
  const recentThreshold = new Date()
  recentThreshold.setDate(recentThreshold.getDate() - MIA_CONFIG.gracePeriodDays)

  const { data: existingWarning } = await supabase
    .from('mia_warnings')
    .select('id')
    .eq('trainer_id', trainerId)
    .eq('level', level)
    .gte('sent_at', recentThreshold.toISOString())
    .single()

  if (existingWarning) {
    throw new Error(`Warning at level "${level}" already sent recently`)
  }

  // Calculate deadline
  const deadline = new Date()
  deadline.setDate(deadline.getDate() + MIA_CONFIG.gracePeriodDays)

  // Generate warning message
  const message = getWarningMessage(level, deadline)

  // Create warning record
  const { data: warning, error } = await supabase
    .from('mia_warnings')
    .insert({
      trainer_id: trainerId,
      level,
      message,
      deadline: deadline.toISOString(),
      sent_at: now.toISOString(),
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create warning: ${error.message}`)
  }

  // TODO: Send actual notification (email, in-app, etc.)
  // await sendNotification(trainerId, 'mia_warning', { level, message, deadline })

  return {
    id: warning.id,
    trainerId,
    level,
    sentAt: warning.sent_at,
    message,
    deadline: deadline.toISOString(),
  }
}

function getWarningMessage(level: MIAWarning['level'], deadline: Date): string {
  const deadlineStr = deadline.toLocaleDateString()

  switch (level) {
    case 'notice':
      return `We noticed you haven't been active recently. Please log in to maintain your agents. Deadline: ${deadlineStr}`
    case 'warning':
      return `Your account has been inactive for an extended period. Your agents may be affected if you don't respond by ${deadlineStr}.`
    case 'critical':
      return `URGENT: Your account is at risk. Your agents will be flagged and consumers notified if no activity by ${deadlineStr}.`
    case 'final':
      return `FINAL NOTICE: Your account will be marked as MIA. Platform takeover of your agents will begin if no action by ${deadlineStr}.`
  }
}

/**
 * Acknowledge a warning
 */
export async function acknowledgeWarning(
  warningId: string,
  trainerId: string
): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('mia_warnings')
    .update({ acknowledged_at: new Date().toISOString() })
    .eq('id', warningId)
    .eq('trainer_id', trainerId)

  if (error) {
    throw new Error(`Failed to acknowledge warning: ${error.message}`)
  }
}

/**
 * Reset warnings when trainer becomes active
 */
async function resetWarningsIfActive(trainerId: string): Promise<void> {
  const supabase = await createClient()

  // Mark all pending warnings as resolved
  await supabase
    .from('mia_warnings')
    .update({
      resolved_at: new Date().toISOString(),
      resolution: 'trainer_active',
    })
    .eq('trainer_id', trainerId)
    .is('resolved_at', null)
}

// ============================================================================
// Story 10-4: Consumer MIA Notifications
// ============================================================================

/**
 * Notify consumers about trainer MIA status
 */
export async function notifyConsumersOfMIA(trainerId: string): Promise<number> {
  const supabase = await createClient()

  // Get all active acquisitions for this trainer's agents
  const { data: acquisitions } = await supabase
    .from('acquisitions')
    .select(`
      id,
      consumer_id,
      agent_id,
      marketplace_listings!inner(
        trainer_id,
        title
      )
    `)
    .eq('marketplace_listings.trainer_id', trainerId)
    .eq('status', 'active')

  if (!acquisitions || acquisitions.length === 0) {
    return 0
  }

  // Get unique consumers
  const consumerIds = [...new Set(acquisitions.map(a => a.consumer_id))]

  // Create notifications for each consumer
  for (const consumerId of consumerIds) {
    const affectedAgents = acquisitions
      .filter(a => a.consumer_id === consumerId)
      .map(a => (a.marketplace_listings as any)?.title || 'Unknown Agent')

    await supabase
      .from('notifications')
      .insert({
        user_id: consumerId,
        type: 'trainer_mia',
        title: 'Trainer Status Update',
        message: `The trainer for ${affectedAgents.length} of your agents has been marked as inactive. Platform continuity measures are in effect.`,
        metadata: {
          trainer_id: trainerId,
          affected_agents: affectedAgents,
        },
      })
  }

  return consumerIds.length
}

// ============================================================================
// Story 10-5: Platform Takeover Flow
// ============================================================================

/**
 * Initiate platform takeover for MIA trainer's agents
 */
export async function initiateTakeover(
  trainerId: string,
  agentId: string,
  reason: MIATakeover['reason'] = 'mia'
): Promise<MIATakeover> {
  const supabase = await createClient()

  // Verify trainer is actually MIA
  const activity = await getTrainerActivity(trainerId)
  if (activity && activity.miaStatus !== 'mia' && reason === 'mia') {
    throw new Error('Trainer is not currently MIA')
  }

  // Check for existing takeover
  const { data: existingTakeover } = await supabase
    .from('mia_takeovers')
    .select('id')
    .eq('agent_id', agentId)
    .in('status', ['pending', 'temporary'])
    .single()

  if (existingTakeover) {
    throw new Error('Takeover already in progress for this agent')
  }

  // Create takeover record
  const { data: takeover, error } = await supabase
    .from('mia_takeovers')
    .insert({
      trainer_id: trainerId,
      agent_id: agentId,
      reason,
      status: 'pending',
      initiated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to initiate takeover: ${error.message}`)
  }

  // Update agent status
  await supabase
    .from('agents')
    .update({
      mia_takeover: true,
      mia_takeover_at: new Date().toISOString(),
    })
    .eq('id', agentId)

  return {
    id: takeover.id,
    trainerId,
    agentId,
    reason,
    status: 'pending',
    initiatedAt: takeover.initiated_at,
  }
}

/**
 * Assign temporary maintainer
 */
export async function assignTemporaryMaintainer(
  takeoverId: string,
  maintainerId: string
): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('mia_takeovers')
    .update({
      status: 'temporary',
      temporary_maintainer_id: maintainerId,
      maintainer_assigned_at: new Date().toISOString(),
    })
    .eq('id', takeoverId)
    .eq('status', 'pending')

  if (error) {
    throw new Error(`Failed to assign maintainer: ${error.message}`)
  }
}

/**
 * Return agent to trainer (after they become active again)
 */
export async function returnAgentToTrainer(
  takeoverId: string,
  trainerId: string
): Promise<void> {
  const supabase = await createClient()

  // Verify trainer is active again
  const activity = await getTrainerActivity(trainerId)
  if (!activity || activity.miaStatus !== 'active') {
    throw new Error('Trainer must be active to reclaim agent')
  }

  const { data: takeover, error: fetchError } = await supabase
    .from('mia_takeovers')
    .select('*')
    .eq('id', takeoverId)
    .eq('trainer_id', trainerId)
    .single()

  if (fetchError || !takeover) {
    throw new Error('Takeover not found')
  }

  // Update takeover status
  await supabase
    .from('mia_takeovers')
    .update({
      status: 'returned',
      returned_at: new Date().toISOString(),
    })
    .eq('id', takeoverId)

  // Update agent status
  await supabase
    .from('agents')
    .update({
      mia_takeover: false,
      mia_takeover_at: null,
    })
    .eq('id', takeover.agent_id)
}

/**
 * Complete permanent takeover (transfer ownership to platform)
 */
export async function completePermanentTakeover(
  takeoverId: string
): Promise<void> {
  const supabase = await createClient()

  const { data: takeover, error: fetchError } = await supabase
    .from('mia_takeovers')
    .select('*')
    .eq('id', takeoverId)
    .in('status', ['pending', 'temporary'])
    .single()

  if (fetchError || !takeover) {
    throw new Error('Takeover not found or already completed')
  }

  // Update takeover status
  await supabase
    .from('mia_takeovers')
    .update({
      status: 'permanent',
      completed_at: new Date().toISOString(),
    })
    .eq('id', takeoverId)

  // Transfer agent to platform account (null owner = platform owned)
  await supabase
    .from('agents')
    .update({
      original_owner_id: takeover.trainer_id,
      owner_id: null, // Platform-owned
      platform_maintained: true,
    })
    .eq('id', takeover.agent_id)
}

/**
 * Get MIA takeovers for a trainer
 */
export async function getTrainerTakeovers(trainerId: string): Promise<MIATakeover[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('mia_takeovers')
    .select('*')
    .eq('trainer_id', trainerId)
    .order('initiated_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch takeovers: ${error.message}`)
  }

  return (data || []).map(t => ({
    id: t.id,
    trainerId: t.trainer_id,
    agentId: t.agent_id,
    reason: t.reason,
    status: t.status,
    temporaryMaintainerId: t.temporary_maintainer_id,
    initiatedAt: t.initiated_at,
    completedAt: t.completed_at,
    returnedAt: t.returned_at,
  }))
}
