/**
 * Trust Score Service - Handles trust score changes and history
 * Story 4-2: Trust Score Changes (FR51, FR52)
 */

import { createClient } from '@/lib/supabase/server'
import { TrustTier, TRUST_TIERS, getTrustTierFromScore } from './types'

// Trust change reasons and their impacts
export const TRUST_IMPACTS = {
  // Positive changes (FR51)
  task_success_low: { change: 1, reason: 'Completed low-risk task successfully' },
  task_success_medium: { change: 2, reason: 'Completed medium-risk task successfully' },
  task_success_high: { change: 5, reason: 'Completed high-risk task successfully' },
  council_approval: { change: 10, reason: 'Council approved action' },
  user_positive_feedback: { change: 15, reason: 'Received positive user feedback' },
  training_milestone: { change: 20, reason: 'Completed training milestone' },
  examination_passed: { change: 50, reason: 'Passed Council examination' },
  commendation: { change: 25, reason: 'Received commendation' },

  // Negative changes (FR52)
  task_failure: { change: -5, reason: 'Task execution failed' },
  council_denial: { change: -20, reason: 'Council denied action' },
  user_negative_feedback: { change: -15, reason: 'Received negative user feedback' },
  policy_violation_minor: { change: -25, reason: 'Minor policy violation' },
  policy_violation_major: { change: -50, reason: 'Major policy violation' },
  complaint_filed: { change: -30, reason: 'Complaint filed against agent' },
  suspension: { change: -100, reason: 'Agent suspended' },

  // Neutral/System
  decay: { change: -1, reason: 'Inactivity decay' },
  manual_adjustment: { change: 0, reason: 'Manual adjustment by admin' },
  graduation: { change: 0, reason: 'Graduated from Academy' },
} as const

export type TrustChangeType = keyof typeof TRUST_IMPACTS

export interface TrustChangeResult {
  success: boolean
  previousScore: number
  newScore: number
  previousTier: TrustTier
  newTier: TrustTier
  change: number
  reason: string
  tierChanged: boolean
  historyId?: string
  error?: string
}

export interface TrustHistoryEntry {
  id: string
  agent_id: string
  previous_score: number
  score: number
  change_amount: number
  tier: TrustTier
  reason: string
  source: string
  recorded_at: string
  metadata?: Record<string, unknown>
}

/**
 * Apply a trust score change to an agent
 */
export async function applyTrustChange(
  agentId: string,
  changeType: TrustChangeType,
  customChange?: number,
  customReason?: string,
  metadata?: Record<string, unknown>
): Promise<TrustChangeResult> {
  const supabase = createClient()

  try {
    // Get current agent trust score
    const { data: agent, error: agentError } = await supabase
      .from('bots')
      .select('id, trust_score, trust_tier, status')
      .eq('id', agentId)
      .single()

    if (agentError || !agent) {
      return {
        success: false,
        previousScore: 0,
        newScore: 0,
        previousTier: 'untrusted',
        newTier: 'untrusted',
        change: 0,
        reason: 'Agent not found',
        tierChanged: false,
        error: 'Agent not found',
      }
    }

    const impact = TRUST_IMPACTS[changeType]
    const change = customChange ?? impact.change
    const reason = customReason ?? impact.reason

    const previousScore = agent.trust_score || 0
    const previousTier = (agent.trust_tier as TrustTier) || 'untrusted'

    // Calculate new score (clamped to 0-1000)
    const newScore = Math.max(0, Math.min(1000, previousScore + change))
    const newTier = getTrustTierFromScore(newScore)
    const tierChanged = previousTier !== newTier

    // Update agent's trust score
    const { error: updateError } = await supabase
      .from('bots')
      .update({
        trust_score: newScore,
        trust_tier: newTier,
        updated_at: new Date().toISOString(),
      })
      .eq('id', agentId)

    if (updateError) {
      throw updateError
    }

    // Record in trust history
    const { data: historyEntry, error: historyError } = await supabase
      .from('trust_history')
      .insert({
        agent_id: agentId,
        previous_score: previousScore,
        score: newScore,
        change_amount: change,
        tier: newTier,
        reason,
        source: changeType,
        metadata: metadata || {},
      })
      .select('id')
      .single()

    if (historyError) {
      console.error('Failed to record trust history:', historyError)
    }

    return {
      success: true,
      previousScore,
      newScore,
      previousTier,
      newTier,
      change,
      reason,
      tierChanged,
      historyId: historyEntry?.id,
    }
  } catch (error) {
    console.error('Trust change failed:', error)
    return {
      success: false,
      previousScore: 0,
      newScore: 0,
      previousTier: 'untrusted',
      newTier: 'untrusted',
      change: 0,
      reason: 'Failed to apply trust change',
      tierChanged: false,
      error: String(error),
    }
  }
}

/**
 * Get trust history for an agent
 */
export async function getTrustHistory(
  agentId: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ entries: TrustHistoryEntry[]; total: number }> {
  const supabase = createClient()

  try {
    // Get count
    const { count } = await supabase
      .from('trust_history')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agentId)

    // Get entries
    const { data, error } = await supabase
      .from('trust_history')
      .select('*')
      .eq('agent_id', agentId)
      .order('recorded_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    return {
      entries: data || [],
      total: count || 0,
    }
  } catch (error) {
    console.error('Failed to get trust history:', error)
    return { entries: [], total: 0 }
  }
}

/**
 * Get trust score trend data for charts
 */
export async function getTrustTrend(
  agentId: string,
  days: number = 30
): Promise<Array<{ date: string; score: number; tier: TrustTier }>> {
  const supabase = createClient()

  try {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const { data, error } = await supabase
      .from('trust_history')
      .select('score, tier, recorded_at')
      .eq('agent_id', agentId)
      .gte('recorded_at', startDate.toISOString())
      .order('recorded_at', { ascending: true })

    if (error) throw error

    return (data || []).map((entry) => ({
      date: entry.recorded_at,
      score: entry.score,
      tier: entry.tier as TrustTier,
    }))
  } catch (error) {
    console.error('Failed to get trust trend:', error)
    return []
  }
}

/**
 * Calculate trust change for a Council decision
 */
export function calculateCouncilDecisionImpact(
  approved: boolean,
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
): { change: number; reason: string } {
  if (approved) {
    switch (riskLevel) {
      case 'critical':
        return { change: 15, reason: 'Critical action approved by Council' }
      case 'high':
        return { change: 10, reason: 'High-risk action approved by Council' }
      case 'medium':
        return { change: 5, reason: 'Medium-risk action approved by Council' }
      default:
        return { change: 2, reason: 'Action approved by Council' }
    }
  } else {
    switch (riskLevel) {
      case 'critical':
        return { change: -50, reason: 'Critical action denied by Council' }
      case 'high':
        return { change: -30, reason: 'High-risk action denied by Council' }
      case 'medium':
        return { change: -15, reason: 'Medium-risk action denied by Council' }
      default:
        return { change: -5, reason: 'Action denied by Council' }
    }
  }
}

/**
 * Check if agent can perform action based on trust tier
 */
export function canPerformAction(
  tier: TrustTier,
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
): { allowed: boolean; reason: string } {
  const tierOrder: TrustTier[] = ['untrusted', 'novice', 'proven', 'trusted', 'elite', 'legendary']
  const tierIndex = tierOrder.indexOf(tier)

  switch (riskLevel) {
    case 'low':
      // All tiers except untrusted can do low-risk
      if (tierIndex >= 1) {
        return { allowed: true, reason: 'Low-risk action permitted' }
      }
      return { allowed: false, reason: 'Untrusted agents cannot perform autonomous actions' }

    case 'medium':
      // Proven and above
      if (tierIndex >= 2) {
        return { allowed: true, reason: 'Medium-risk action permitted for Proven+ tier' }
      }
      return { allowed: false, reason: 'Medium-risk actions require Proven tier or higher' }

    case 'high':
      // Trusted and above
      if (tierIndex >= 3) {
        return { allowed: true, reason: 'High-risk action permitted for Trusted+ tier' }
      }
      return { allowed: false, reason: 'High-risk actions require Trusted tier or higher' }

    case 'critical':
      // Always requires approval, but Elite+ can request
      if (tierIndex >= 4) {
        return { allowed: false, reason: 'Critical actions always require human approval' }
      }
      return { allowed: false, reason: 'Critical actions require Elite tier and human approval' }

    default:
      return { allowed: false, reason: 'Unknown risk level' }
  }
}
