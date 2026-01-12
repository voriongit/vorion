/**
 * Validator Fine-Tuning Service
 * Epic 14 - Story 14-5: Validator Fine-Tuning Pipeline
 *
 * Manages validator prompt versions and training data generation
 */

import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'

// =============================================================================
// Types
// =============================================================================

export type ValidatorType =
  | 'guardian'
  | 'arbiter'
  | 'scholar'
  | 'advocate'
  | 'economist'
  | 'sentinel'
  | 'adversary'
  | 'oracle'
  | 'orchestrator'

export interface ValidatorPromptVersion {
  id: string
  validatorType: ValidatorType
  version: number
  systemPrompt: string
  promptHash: string
  trainingPrecedentIds: string[]
  trainingExamplesCount: number
  accuracyScore: number | null
  consistencyScore: number | null
  avgConfidence: number | null
  status: 'draft' | 'testing' | 'active' | 'retired'
  activatedAt: string | null
  retiredAt: string | null
  createdAt: string
  createdBy: string | null
  notes: string | null
}

export interface ValidatorDecision {
  id: string
  decisionId: string
  requestId: string | null
  validatorType: ValidatorType
  promptVersionId: string | null
  vote: 'approve' | 'deny' | 'abstain' | 'escalate'
  confidence: number
  reasoning: string
  humanAgreed: boolean | null
  outcomeCorrect: boolean | null
  createdAt: string
}

export interface TrainingExample {
  input: {
    actionType: string
    actionDescription: string
    riskLevel: number
    context: Record<string, any>
  }
  expectedOutput: {
    vote: string
    confidence: number
    reasoning: string
  }
  metadata: {
    precedentId: string
    decisionId: string
    humanValidated: boolean
  }
}

// =============================================================================
// Prompt Version Management
// =============================================================================

/**
 * Get active prompt version for a validator
 */
export async function getActivePromptVersion(
  validatorType: ValidatorType
): Promise<ValidatorPromptVersion | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('validator_prompt_versions')
    .select('*')
    .eq('validator_type', validatorType)
    .eq('status', 'active')
    .single()

  if (error || !data) {
    return null
  }

  return mapPromptVersion(data)
}

/**
 * Get all prompt versions for a validator
 */
export async function getPromptVersions(
  validatorType: ValidatorType
): Promise<ValidatorPromptVersion[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('validator_prompt_versions')
    .select('*')
    .eq('validator_type', validatorType)
    .order('version', { ascending: false })

  return (data || []).map(mapPromptVersion)
}

/**
 * Create a new prompt version
 */
export async function createPromptVersion(
  validatorType: ValidatorType,
  systemPrompt: string,
  createdBy?: string,
  notes?: string
): Promise<ValidatorPromptVersion | null> {
  const supabase = await createClient()

  // Get next version number
  const { data: latest } = await supabase
    .from('validator_prompt_versions')
    .select('version')
    .eq('validator_type', validatorType)
    .order('version', { ascending: false })
    .limit(1)
    .single()

  const nextVersion = (latest?.version || 0) + 1

  // Hash prompt for change detection
  const promptHash = crypto
    .createHash('sha256')
    .update(systemPrompt)
    .digest('hex')
    .slice(0, 16)

  const { data, error } = await supabase
    .from('validator_prompt_versions')
    .insert({
      validator_type: validatorType,
      version: nextVersion,
      system_prompt: systemPrompt,
      prompt_hash: promptHash,
      status: 'draft',
      created_by: createdBy,
      notes,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating prompt version:', error)
    return null
  }

  return mapPromptVersion(data)
}

/**
 * Activate a prompt version (retires previous active version)
 */
export async function activatePromptVersion(
  versionId: string
): Promise<boolean> {
  const supabase = await createClient()

  // Get the version to activate
  const { data: version } = await supabase
    .from('validator_prompt_versions')
    .select('validator_type')
    .eq('id', versionId)
    .single()

  if (!version) {
    return false
  }

  const now = new Date().toISOString()

  // Retire current active version
  await supabase
    .from('validator_prompt_versions')
    .update({
      status: 'retired',
      retired_at: now,
    })
    .eq('validator_type', version.validator_type)
    .eq('status', 'active')

  // Activate new version
  const { error } = await supabase
    .from('validator_prompt_versions')
    .update({
      status: 'active',
      activated_at: now,
    })
    .eq('id', versionId)

  return !error
}

// =============================================================================
// Training Data Generation
// =============================================================================

/**
 * Generate training examples from precedents
 */
export async function generateTrainingExamples(
  validatorType: ValidatorType,
  limit: number = 100
): Promise<TrainingExample[]> {
  const supabase = await createClient()

  // Get high-quality precedents (cited multiple times, clear outcome)
  const { data: precedents } = await supabase
    .from('council_precedents')
    .select('*')
    .gte('times_cited', 2)
    .in('outcome', ['approved', 'denied'])
    .order('times_cited', { ascending: false })
    .limit(limit)

  if (!precedents) {
    return []
  }

  // Transform to training examples
  const examples: TrainingExample[] = []

  for (const p of precedents) {
    // Extract validator-specific reasoning if available
    const validatorVote = p.votes_summary?.find(
      (v: any) => v.validatorId === validatorType
    )

    if (!validatorVote && validatorType !== 'orchestrator') {
      continue // Skip if no vote from this validator
    }

    examples.push({
      input: {
        actionType: p.action_type,
        actionDescription: p.summary,
        riskLevel: p.risk_level,
        context: {
          category: p.category,
          tags: p.tags,
        },
      },
      expectedOutput: {
        vote: validatorVote?.decision || (p.outcome === 'approved' ? 'approve' : 'deny'),
        confidence: validatorVote?.confidence || 0.8,
        reasoning: validatorVote?.reasoning || p.reasoning,
      },
      metadata: {
        precedentId: p.id,
        decisionId: p.decision_id || '',
        humanValidated: !!p.decision_id, // Has associated decision
      },
    })
  }

  return examples
}

/**
 * Record a validator decision for training
 */
export async function recordValidatorDecision(params: {
  decisionId: string
  requestId?: string
  validatorType: ValidatorType
  promptVersionId?: string
  vote: 'approve' | 'deny' | 'abstain' | 'escalate'
  confidence: number
  reasoning: string
}): Promise<ValidatorDecision | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('validator_decisions')
    .insert({
      decision_id: params.decisionId,
      request_id: params.requestId,
      validator_type: params.validatorType,
      prompt_version_id: params.promptVersionId,
      vote: params.vote,
      confidence: params.confidence,
      reasoning: params.reasoning,
    })
    .select()
    .single()

  if (error) {
    console.error('Error recording validator decision:', error)
    return null
  }

  return mapValidatorDecision(data)
}

/**
 * Update decision with human feedback
 */
export async function updateDecisionFeedback(
  decisionId: string,
  validatorType: ValidatorType,
  humanAgreed: boolean,
  outcomeCorrect: boolean
): Promise<boolean> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('validator_decisions')
    .update({
      human_agreed: humanAgreed,
      outcome_correct: outcomeCorrect,
    })
    .eq('decision_id', decisionId)
    .eq('validator_type', validatorType)

  return !error
}

// =============================================================================
// Performance Metrics
// =============================================================================

/**
 * Calculate performance metrics for a prompt version
 */
export async function calculateVersionMetrics(
  versionId: string
): Promise<{
  accuracy: number
  consistency: number
  avgConfidence: number
  sampleSize: number
}> {
  const supabase = await createClient()

  const { data: decisions } = await supabase
    .from('validator_decisions')
    .select('vote, confidence, human_agreed, outcome_correct')
    .eq('prompt_version_id', versionId)
    .not('outcome_correct', 'is', null)

  if (!decisions || decisions.length === 0) {
    return { accuracy: 0, consistency: 0, avgConfidence: 0, sampleSize: 0 }
  }

  const correctCount = decisions.filter(d => d.outcome_correct).length
  const humanAgreeCount = decisions.filter(d => d.human_agreed).length
  const avgConfidence = decisions.reduce((sum, d) => sum + (d.confidence || 0), 0) / decisions.length

  return {
    accuracy: (correctCount / decisions.length) * 100,
    consistency: (humanAgreeCount / decisions.length) * 100,
    avgConfidence: avgConfidence * 100,
    sampleSize: decisions.length,
  }
}

/**
 * Update prompt version metrics
 */
export async function updateVersionMetrics(versionId: string): Promise<boolean> {
  const metrics = await calculateVersionMetrics(versionId)

  if (metrics.sampleSize === 0) {
    return false
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('validator_prompt_versions')
    .update({
      accuracy_score: metrics.accuracy,
      consistency_score: metrics.consistency,
      avg_confidence: metrics.avgConfidence,
      training_examples_count: metrics.sampleSize,
    })
    .eq('id', versionId)

  return !error
}

// =============================================================================
// Helpers
// =============================================================================

function mapPromptVersion(data: any): ValidatorPromptVersion {
  return {
    id: data.id,
    validatorType: data.validator_type,
    version: data.version,
    systemPrompt: data.system_prompt,
    promptHash: data.prompt_hash,
    trainingPrecedentIds: data.training_precedent_ids || [],
    trainingExamplesCount: data.training_examples_count || 0,
    accuracyScore: data.accuracy_score,
    consistencyScore: data.consistency_score,
    avgConfidence: data.avg_confidence,
    status: data.status,
    activatedAt: data.activated_at,
    retiredAt: data.retired_at,
    createdAt: data.created_at,
    createdBy: data.created_by,
    notes: data.notes,
  }
}

function mapValidatorDecision(data: any): ValidatorDecision {
  return {
    id: data.id,
    decisionId: data.decision_id,
    requestId: data.request_id,
    validatorType: data.validator_type,
    promptVersionId: data.prompt_version_id,
    vote: data.vote,
    confidence: data.confidence,
    reasoning: data.reasoning,
    humanAgreed: data.human_agreed,
    outcomeCorrect: data.outcome_correct,
    createdAt: data.created_at,
  }
}
