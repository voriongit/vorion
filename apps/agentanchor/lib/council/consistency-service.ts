/**
 * Decision Consistency Service
 * Epic 14 - Story 14-4: Consistency Tracking
 *
 * Detects and tracks when validator decisions diverge from precedent
 */

import { createClient } from '@/lib/supabase/server'
import { generateEmbedding, findSimilarPrecedents } from './precedent-flywheel'

// =============================================================================
// Types
// =============================================================================

export type InconsistencyType =
  | 'outcome_mismatch'     // Same scenario, different outcome
  | 'reasoning_divergence' // Same outcome, different reasoning
  | 'severity_mismatch'    // Similar risk, very different treatment
  | 'precedent_ignored'    // High similarity precedent not cited

export interface ConsistencyFlag {
  id: string
  decisionId: string
  precedentId: string
  similarityScore: number
  inconsistencyType: InconsistencyType
  currentOutcome: string
  precedentOutcome: string
  divergenceExplanation: string | null
  status: 'flagged' | 'reviewed' | 'justified' | 'corrected'
  reviewedBy: string | null
  reviewedAt: string | null
  reviewNotes: string | null
  createdAt: string
}

export interface ConsistencyReport {
  decisionId: string
  isConsistent: boolean
  flags: ConsistencyFlag[]
  overallSimilarity: number
  recommendation: string | null
}

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Check a decision for consistency with precedent
 */
export async function checkDecisionConsistency(
  decisionId: string,
  actionDescription: string,
  actionType: string,
  outcome: string,
  reasoning: string
): Promise<ConsistencyReport> {
  const flags: ConsistencyFlag[] = []

  // Find similar precedents
  const similarPrecedents = await findSimilarPrecedents(
    `${actionType}: ${actionDescription}`,
    {
      threshold: 0.75, // Higher threshold for consistency check
      limit: 10,
      useCache: false, // Always fresh for consistency checks
    }
  )

  if (similarPrecedents.length === 0) {
    return {
      decisionId,
      isConsistent: true,
      flags: [],
      overallSimilarity: 0,
      recommendation: 'No similar precedents found - this may establish new precedent',
    }
  }

  // Check for outcome mismatches
  for (const precedent of similarPrecedents) {
    if (precedent.similarity >= 0.85 && precedent.outcome !== outcome) {
      const flag = await createConsistencyFlag({
        decisionId,
        precedentId: precedent.id,
        similarityScore: precedent.similarity,
        inconsistencyType: 'outcome_mismatch',
        currentOutcome: outcome,
        precedentOutcome: precedent.outcome,
        divergenceExplanation: `${Math.round(precedent.similarity * 100)}% similar case resulted in "${precedent.outcome}" but current decision is "${outcome}"`,
      })
      if (flag) flags.push(flag)
    }
  }

  // Check for severity mismatches
  const avgRiskLevel = similarPrecedents.reduce((sum, p) => sum + p.riskLevel, 0) / similarPrecedents.length
  const highSimilarityPrecedents = similarPrecedents.filter(p => p.similarity > 0.8)

  if (highSimilarityPrecedents.length >= 2) {
    const riskLevels = highSimilarityPrecedents.map(p => p.riskLevel)
    const riskVariance = Math.max(...riskLevels) - Math.min(...riskLevels)

    if (riskVariance > 2) {
      const flag = await createConsistencyFlag({
        decisionId,
        precedentId: highSimilarityPrecedents[0].id,
        similarityScore: highSimilarityPrecedents[0].similarity,
        inconsistencyType: 'severity_mismatch',
        currentOutcome: outcome,
        precedentOutcome: highSimilarityPrecedents[0].outcome,
        divergenceExplanation: `Similar cases show significant risk level variance (${Math.min(...riskLevels)}-${Math.max(...riskLevels)})`,
      })
      if (flag) flags.push(flag)
    }
  }

  // Calculate overall similarity
  const overallSimilarity = similarPrecedents.length > 0
    ? similarPrecedents.reduce((sum, p) => sum + p.similarity, 0) / similarPrecedents.length
    : 0

  // Generate recommendation
  let recommendation: string | null = null
  if (flags.length > 0) {
    const outcomeMismatches = flags.filter(f => f.inconsistencyType === 'outcome_mismatch')
    if (outcomeMismatches.length > 0) {
      recommendation = `Review recommended: ${outcomeMismatches.length} similar precedent(s) had different outcome`
    }
  } else if (overallSimilarity > 0.8) {
    recommendation = 'Decision aligns well with existing precedent'
  }

  return {
    decisionId,
    isConsistent: flags.length === 0,
    flags,
    overallSimilarity,
    recommendation,
  }
}

/**
 * Create a consistency flag
 */
async function createConsistencyFlag(params: {
  decisionId: string
  precedentId: string
  similarityScore: number
  inconsistencyType: InconsistencyType
  currentOutcome: string
  precedentOutcome: string
  divergenceExplanation: string
}): Promise<ConsistencyFlag | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('decision_consistency_log')
    .insert({
      decision_id: params.decisionId,
      precedent_id: params.precedentId,
      similarity_score: params.similarityScore,
      inconsistency_type: params.inconsistencyType,
      current_outcome: params.currentOutcome,
      precedent_outcome: params.precedentOutcome,
      divergence_explanation: params.divergenceExplanation,
      status: 'flagged',
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating consistency flag:', error)
    return null
  }

  return mapFlag(data)
}

/**
 * Get consistency flags for a decision
 */
export async function getDecisionFlags(decisionId: string): Promise<ConsistencyFlag[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('decision_consistency_log')
    .select('*')
    .eq('decision_id', decisionId)
    .order('created_at', { ascending: false })

  return (data || []).map(mapFlag)
}

/**
 * Review and resolve a consistency flag
 */
export async function resolveConsistencyFlag(
  flagId: string,
  reviewerId: string,
  resolution: 'justified' | 'corrected',
  notes: string
): Promise<boolean> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('decision_consistency_log')
    .update({
      status: resolution,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      review_notes: notes,
    })
    .eq('id', flagId)

  return !error
}

/**
 * Get unresolved consistency flags (for dashboard)
 */
export async function getUnresolvedFlags(limit: number = 50): Promise<ConsistencyFlag[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('decision_consistency_log')
    .select('*')
    .eq('status', 'flagged')
    .order('similarity_score', { ascending: false })
    .limit(limit)

  return (data || []).map(mapFlag)
}

/**
 * Get consistency metrics for reporting
 */
export async function getConsistencyMetrics(
  days: number = 30
): Promise<{
  totalDecisions: number
  flaggedDecisions: number
  consistencyRate: number
  byType: Record<InconsistencyType, number>
}> {
  const supabase = await createClient()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  // Get all flags in period
  const { data: flags } = await supabase
    .from('decision_consistency_log')
    .select('decision_id, inconsistency_type')
    .gte('created_at', startDate.toISOString())

  // Get unique flagged decisions
  const flaggedDecisions = new Set((flags || []).map(f => f.decision_id)).size

  // Count by type
  const byType: Record<InconsistencyType, number> = {
    outcome_mismatch: 0,
    reasoning_divergence: 0,
    severity_mismatch: 0,
    precedent_ignored: 0,
  }

  for (const flag of flags || []) {
    byType[flag.inconsistency_type as InconsistencyType]++
  }

  // Estimate total decisions (from council_decisions table)
  const { count: totalDecisions } = await supabase
    .from('council_decisions')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', startDate.toISOString())

  const total = totalDecisions || 1
  const consistencyRate = ((total - flaggedDecisions) / total) * 100

  return {
    totalDecisions: total,
    flaggedDecisions,
    consistencyRate,
    byType,
  }
}

// =============================================================================
// Helpers
// =============================================================================

function mapFlag(data: any): ConsistencyFlag {
  return {
    id: data.id,
    decisionId: data.decision_id,
    precedentId: data.precedent_id,
    similarityScore: data.similarity_score,
    inconsistencyType: data.inconsistency_type,
    currentOutcome: data.current_outcome,
    precedentOutcome: data.precedent_outcome,
    divergenceExplanation: data.divergence_explanation,
    status: data.status,
    reviewedBy: data.reviewed_by,
    reviewedAt: data.reviewed_at,
    reviewNotes: data.review_notes,
    createdAt: data.created_at,
  }
}
