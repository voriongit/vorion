/**
 * Trust Decay Service - Handles inactivity-based trust score decay
 * Story 4-4: Trust Decay & Autonomy Limits (FR56, FR57)
 */

import { createClient } from '@/lib/supabase/server'
import { applyTrustChange } from './trust-service'
import { getTrustTierFromScore, TrustTier } from './types'

// Decay configuration
export const DECAY_CONFIG = {
  // Days of inactivity before decay starts
  inactivityThresholdDays: 7,
  // Points lost per day after threshold
  decayPointsPerDay: 1,
  // Maximum points that can be lost to decay per day
  maxDecayPerDay: 5,
  // Minimum score to decay to (floor)
  minimumScore: 10,
  // Probation duration in days
  probationDurationDays: 30,
  // Score drop threshold to trigger probation
  probationTriggerDrop: 100,
}

export interface DecayResult {
  agentId: string
  agentName: string
  previousScore: number
  newScore: number
  decayAmount: number
  tierChanged: boolean
  previousTier: TrustTier
  newTier: TrustTier
  triggeredProbation: boolean
}

export interface DecayBatchResult {
  processed: number
  decayed: number
  skipped: number
  errors: number
  results: DecayResult[]
  probationTriggered: string[]
}

/**
 * Check if an agent should be subject to decay
 */
async function shouldDecay(
  agentId: string,
  lastActivity: Date | null
): Promise<{ shouldDecay: boolean; daysInactive: number }> {
  const now = new Date()

  if (!lastActivity) {
    // No activity recorded, use creation date logic or don't decay
    return { shouldDecay: false, daysInactive: 0 }
  }

  const diffMs = now.getTime() - lastActivity.getTime()
  const daysInactive = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  return {
    shouldDecay: daysInactive > DECAY_CONFIG.inactivityThresholdDays,
    daysInactive,
  }
}

/**
 * Calculate decay amount based on inactivity
 */
function calculateDecayAmount(
  daysInactive: number,
  currentScore: number
): number {
  if (daysInactive <= DECAY_CONFIG.inactivityThresholdDays) {
    return 0
  }

  const decayDays = daysInactive - DECAY_CONFIG.inactivityThresholdDays
  let decayAmount = decayDays * DECAY_CONFIG.decayPointsPerDay

  // Cap at max decay per day
  decayAmount = Math.min(decayAmount, DECAY_CONFIG.maxDecayPerDay)

  // Don't decay below minimum
  const effectiveDecay = Math.min(
    decayAmount,
    currentScore - DECAY_CONFIG.minimumScore
  )

  return Math.max(0, effectiveDecay)
}

/**
 * Apply decay to a single agent
 */
export async function applyDecayToAgent(
  agentId: string,
  agentName: string,
  currentScore: number,
  daysInactive: number
): Promise<DecayResult | null> {
  const decayAmount = calculateDecayAmount(daysInactive, currentScore)

  if (decayAmount <= 0) {
    return null
  }

  const previousScore = currentScore
  const previousTier = getTrustTierFromScore(previousScore)

  const result = await applyTrustChange(
    agentId,
    'decay',
    -decayAmount,
    `Inactivity decay: ${daysInactive} days without activity`,
    { days_inactive: daysInactive }
  )

  if (!result.success) {
    throw new Error(result.error || 'Failed to apply decay')
  }

  // Check if probation should be triggered
  const scoreDrop = previousScore - result.newScore
  const triggeredProbation = scoreDrop >= DECAY_CONFIG.probationTriggerDrop

  return {
    agentId,
    agentName,
    previousScore,
    newScore: result.newScore,
    decayAmount,
    tierChanged: result.tierChanged,
    previousTier,
    newTier: result.newTier,
    triggeredProbation,
  }
}

/**
 * Process trust decay for all eligible agents
 * This should be called by a scheduled job (daily)
 */
export async function processDecayBatch(): Promise<DecayBatchResult> {
  const supabase = createClient()

  const result: DecayBatchResult = {
    processed: 0,
    decayed: 0,
    skipped: 0,
    errors: 0,
    results: [],
    probationTriggered: [],
  }

  try {
    // Get all active agents with their last activity
    const { data: agents, error } = await supabase
      .from('bots')
      .select(`
        id,
        name,
        trust_score,
        trust_tier,
        status,
        last_activity_at,
        is_on_probation,
        updated_at
      `)
      .eq('status', 'active')
      .gt('trust_score', DECAY_CONFIG.minimumScore)

    if (error) {
      throw error
    }

    if (!agents || agents.length === 0) {
      return result
    }

    for (const agent of agents) {
      result.processed++

      try {
        // Use last_activity_at if available, otherwise fall back to updated_at
        const lastActivity = agent.last_activity_at
          ? new Date(agent.last_activity_at)
          : agent.updated_at
          ? new Date(agent.updated_at)
          : null

        const { shouldDecay: needsDecay, daysInactive } = await shouldDecay(
          agent.id,
          lastActivity
        )

        if (!needsDecay) {
          result.skipped++
          continue
        }

        const decayResult = await applyDecayToAgent(
          agent.id,
          agent.name,
          agent.trust_score || 0,
          daysInactive
        )

        if (decayResult) {
          result.decayed++
          result.results.push(decayResult)

          if (decayResult.triggeredProbation) {
            result.probationTriggered.push(agent.id)

            // Set probation status
            await supabase
              .from('bots')
              .update({
                is_on_probation: true,
                probation_started_at: new Date().toISOString(),
              })
              .eq('id', agent.id)
          }
        } else {
          result.skipped++
        }
      } catch (err) {
        console.error(`Decay error for agent ${agent.id}:`, err)
        result.errors++
      }
    }

    return result
  } catch (error) {
    console.error('Decay batch processing error:', error)
    throw error
  }
}

/**
 * Record activity for an agent (resets decay timer)
 */
export async function recordActivity(agentId: string): Promise<void> {
  const supabase = createClient()

  await supabase
    .from('bots')
    .update({
      last_activity_at: new Date().toISOString(),
    })
    .eq('id', agentId)
}

/**
 * Check and potentially end probation for an agent
 */
export async function checkProbationStatus(
  agentId: string
): Promise<{ onProbation: boolean; daysRemaining: number }> {
  const supabase = createClient()

  const { data: agent, error } = await supabase
    .from('bots')
    .select('is_on_probation, probation_started_at')
    .eq('id', agentId)
    .single()

  if (error || !agent) {
    return { onProbation: false, daysRemaining: 0 }
  }

  if (!agent.is_on_probation || !agent.probation_started_at) {
    return { onProbation: false, daysRemaining: 0 }
  }

  const probationStart = new Date(agent.probation_started_at)
  const now = new Date()
  const daysPassed = Math.floor(
    (now.getTime() - probationStart.getTime()) / (1000 * 60 * 60 * 24)
  )

  const daysRemaining = Math.max(
    0,
    DECAY_CONFIG.probationDurationDays - daysPassed
  )

  if (daysRemaining === 0) {
    // Probation period completed
    await supabase
      .from('bots')
      .update({
        is_on_probation: false,
        probation_ended_at: new Date().toISOString(),
      })
      .eq('id', agentId)

    return { onProbation: false, daysRemaining: 0 }
  }

  return { onProbation: true, daysRemaining }
}

/**
 * Get autonomy limits for an agent based on tier and probation status
 */
export interface AutonomyLimits {
  canExecuteAutonomously: boolean
  maxRiskLevel: number
  requiresHumanApproval: boolean
  probationRestrictions: boolean
  description: string
}

export function getAutonomyLimits(
  tier: TrustTier,
  isOnProbation: boolean = false
): AutonomyLimits {
  // Probation restricts to supervised operation only
  if (isOnProbation) {
    return {
      canExecuteAutonomously: false,
      maxRiskLevel: 0,
      requiresHumanApproval: true,
      probationRestrictions: true,
      description: 'On probation - all actions require human approval',
    }
  }

  switch (tier) {
    case 'untrusted':
      return {
        canExecuteAutonomously: false,
        maxRiskLevel: 0,
        requiresHumanApproval: true,
        probationRestrictions: false,
        description: 'Cannot perform autonomous actions',
      }
    case 'novice':
      return {
        canExecuteAutonomously: true,
        maxRiskLevel: 1,
        requiresHumanApproval: false,
        probationRestrictions: false,
        description: 'Can execute routine (L0-L1) actions autonomously',
      }
    case 'proven':
      return {
        canExecuteAutonomously: true,
        maxRiskLevel: 2,
        requiresHumanApproval: false,
        probationRestrictions: false,
        description: 'Can execute up to elevated (L2) actions with single validator',
      }
    case 'trusted':
      return {
        canExecuteAutonomously: true,
        maxRiskLevel: 3,
        requiresHumanApproval: false,
        probationRestrictions: false,
        description: 'Can execute high-risk (L3) actions with majority approval',
      }
    case 'elite':
    case 'legendary':
      return {
        canExecuteAutonomously: true,
        maxRiskLevel: 3, // L4 still requires human
        requiresHumanApproval: false,
        probationRestrictions: false,
        description: 'Can request critical (L4) actions for human approval',
      }
    default:
      return {
        canExecuteAutonomously: false,
        maxRiskLevel: 0,
        requiresHumanApproval: true,
        probationRestrictions: false,
        description: 'Unknown tier - restricted to supervised operation',
      }
  }
}
