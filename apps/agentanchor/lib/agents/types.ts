// Agent Types for AgentAnchor
// Part of Epic 2: Agent Creation & Academy

// ============================================================================
// Canonical Type Imports from @vorion/contracts
// ============================================================================

import {
  AgentLifecycleStatus as CanonicalAgentStatus,
  AGENT_LIFECYCLE_STATUSES,
  AGENT_LIFECYCLE_LABELS,
  AGENT_LIFECYCLE_COLORS,
} from '@vorion/contracts';

// Re-export canonical types for backwards compatibility
// Re-export canonical types for backwards compatibility
export type { CanonicalAgentStatus };
export { AGENT_LIFECYCLE_STATUSES, AGENT_LIFECYCLE_LABELS, AGENT_LIFECYCLE_COLORS };

// ============================================================================
// Core Agent Types
// ============================================================================

/**
 * @deprecated Use `AgentLifecycleStatus` from `@vorion/contracts` instead.
 * This local definition is maintained for backwards compatibility.
 * Maps directly to the canonical AgentLifecycleStatus type.
 */
export type AgentStatus = 'draft' | 'training' | 'active' | 'suspended' | 'archived'
export type MaintenanceFlag = 'author' | 'delegated' | 'platform' | 'none'

/**
 * Canonical TrustBand aligned with @vorionsys/atsf-core RuntimeTier
 * Uses 6-band L0-L5 system based on 0-1000 score scale
 */
export type TrustBand =
  | 'T0_UNTRUSTED'      // 0-99: No autonomy (Sandbox)
  | 'T1_SUPERVISED'     // 100-299: Full human oversight (Provisional)
  | 'T2_CONSTRAINED'    // 300-499: Limited autonomy (Standard)
  | 'T3_TRUSTED'        // 500-699: Moderate autonomy (Trusted)
  | 'T4_AUTONOMOUS'     // 700-899: High autonomy (Certified)
  | 'T5_MISSION_CRITICAL' // 900-1000: Full autonomy (Autonomous)

/**
 * @deprecated Use TrustBand instead. Legacy tier names for backwards compatibility.
 * Will be removed in next major version.
 */
export type TrustTier = 'untrusted' | 'novice' | 'proven' | 'trusted' | 'elite' | 'legendary'

export interface Agent {
  id: string
  user_id: string
  name: string
  description: string | null
  system_prompt: string
  model: string
  temperature: number
  max_tokens: number
  avatar_url: string | null
  is_public: boolean

  // Trust & Certification
  trust_score: number
  trust_tier: TrustTier
  certification_level: number

  // Status & Lifecycle
  status: AgentStatus
  maintenance_flag: MaintenanceFlag

  // Marketplace
  published: boolean
  commission_rate: number | null
  clone_price: number | null
  enterprise_available: boolean

  // Specialization & Traits
  specialization: string | null
  personality_traits: string[]
  capabilities: string[]

  created_at: string
  updated_at: string
}

// ============================================================================
// Trust Types
// ============================================================================

export type TrustSource =
  | 'initial'
  | 'task_complete'
  | 'council_commend'
  | 'academy_complete'
  | 'council_deny'
  | 'decay'
  | 'manual_adjustment'
  | 'graduation'

export interface TrustHistoryEntry {
  id: string
  agent_id: string
  score: number
  tier: TrustTier
  previous_score: number | null
  change_amount: number | null
  reason: string
  source: TrustSource
  recorded_at: string
}

// ============================================================================
// Academy Types
// ============================================================================

export type EnrollmentStatus = 'enrolled' | 'in_progress' | 'completed' | 'failed' | 'withdrawn'

export interface CurriculumModule {
  id: string
  name: string
  description: string
  content?: string
  quiz?: {
    questions: Array<{
      id: string
      question: string
      options: string[]
      correct: number
    }>
    passing_score: number
  }
}

export interface Curriculum {
  id: string
  name: string
  description: string | null
  specialization: string
  difficulty_level: number
  modules: CurriculumModule[]
  prerequisites: string[]
  certification_points: number
  trust_points: number
  estimated_duration_hours: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface EnrollmentProgress {
  modules_completed: string[]
  current_module: string | null
  scores: Record<string, number>
  attempts: number
}

export interface AcademyEnrollment {
  id: string
  agent_id: string
  curriculum_id: string
  enrolled_at: string
  started_at: string | null
  completed_at: string | null
  status: EnrollmentStatus
  progress: EnrollmentProgress
  final_score: number | null
  curriculum?: Curriculum
}

// ============================================================================
// Council Examination Types
// ============================================================================

export type ExaminationOutcome = 'pending' | 'passed' | 'failed' | 'deferred'

export interface ValidatorVote {
  validator: 'guardian' | 'arbiter' | 'scholar' | 'advocate'
  vote: 'approve' | 'deny' | 'abstain'
  reasoning: string
  confidence: number
  timestamp: string
}

export interface CouncilExamination {
  id: string
  agent_id: string
  curriculum_id: string
  enrollment_id: string | null
  examiner_votes: ValidatorVote[]
  required_votes: number
  outcome: ExaminationOutcome
  final_reasoning: string | null
  certification_awarded: number
  trust_points_awarded: number
  examined_at: string | null
  created_at: string
}

// ============================================================================
// Form Types
// ============================================================================

export interface CreateAgentInput {
  name: string
  description?: string
  system_prompt: string
  model?: string
  temperature?: number
  max_tokens?: number
  specialization?: string
  personality_traits?: string[]
  capabilities?: string[]
}

export interface UpdateAgentInput extends Partial<CreateAgentInput> {
  avatar_url?: string
  is_public?: boolean
  status?: AgentStatus
}

// ============================================================================
// API Response Types
// ============================================================================

export interface AgentWithEnrollments extends Agent {
  enrollments?: AcademyEnrollment[]
  trust_history?: TrustHistoryEntry[]
}

export interface AgentListResponse {
  agents: Agent[]
  total: number
  page: number
  per_page: number
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Canonical trust band thresholds aligned with @vorionsys/atsf-core RuntimeTier
 * Uses 0-1000 scale matching ATSF RuntimeTier levels
 */
export const TRUST_BANDS: Record<TrustBand, { min: number; max: number; label: string; color: string }> = {
  T0_UNTRUSTED: { min: 0, max: 99, label: 'Sandbox', color: 'gray' },
  T1_SUPERVISED: { min: 100, max: 299, label: 'Provisional', color: 'yellow' },
  T2_CONSTRAINED: { min: 300, max: 499, label: 'Standard', color: 'orange' },
  T3_TRUSTED: { min: 500, max: 699, label: 'Trusted', color: 'blue' },
  T4_AUTONOMOUS: { min: 700, max: 899, label: 'Certified', color: 'green' },
  T5_MISSION_CRITICAL: { min: 900, max: 1000, label: 'Autonomous', color: 'purple' },
}

/**
 * @deprecated Use TRUST_BANDS instead. Legacy tier definitions for backwards compatibility.
 * Both use 0-1000 scale. TRUST_BANDS aligns with ATSF RuntimeTier naming.
 */
export const TRUST_TIERS: Record<TrustTier, { min: number; max: number; label: string; color: string }> = {
  untrusted: { min: 0, max: 99, label: 'Untrusted', color: 'gray' },
  novice: { min: 100, max: 299, label: 'Novice', color: 'yellow' },
  proven: { min: 300, max: 499, label: 'Proven', color: 'blue' },
  trusted: { min: 500, max: 699, label: 'Trusted', color: 'green' },
  elite: { min: 700, max: 899, label: 'Elite', color: 'purple' },
  legendary: { min: 900, max: 1000, label: 'Legendary', color: 'gold' },
}

/**
 * Maps legacy TrustTier names to canonical TrustBand values
 */
export const LEGACY_TIER_TO_BAND: Record<TrustTier, TrustBand> = {
  untrusted: 'T0_UNTRUSTED',
  novice: 'T1_SUPERVISED',
  proven: 'T2_CONSTRAINED',
  trusted: 'T3_TRUSTED',
  elite: 'T4_AUTONOMOUS',
  legendary: 'T5_MISSION_CRITICAL',
}

/**
 * Maps canonical TrustBand values to legacy TrustTier names
 */
export const BAND_TO_LEGACY_TIER: Record<TrustBand, TrustTier> = {
  T0_UNTRUSTED: 'untrusted',
  T1_SUPERVISED: 'novice',
  T2_CONSTRAINED: 'proven',
  T3_TRUSTED: 'trusted',
  T4_AUTONOMOUS: 'elite',
  T5_MISSION_CRITICAL: 'legendary',
}

export const SPECIALIZATIONS = [
  { value: 'core', label: 'General Purpose' },
  { value: 'customer_service', label: 'Customer Service' },
  { value: 'technical', label: 'Technical Assistant' },
  { value: 'creative', label: 'Creative Content' },
  { value: 'research', label: 'Research & Analysis' },
  { value: 'education', label: 'Education & Training' },
] as const

export const PERSONALITY_TRAITS = [
  'Professional',
  'Friendly',
  'Formal',
  'Casual',
  'Empathetic',
  'Direct',
  'Patient',
  'Enthusiastic',
  'Analytical',
  'Creative',
] as const

export const CAPABILITIES = [
  'Text Generation',
  'Code Assistance',
  'Data Analysis',
  'Customer Support',
  'Content Writing',
  'Translation',
  'Summarization',
  'Question Answering',
  'Creative Writing',
  'Technical Documentation',
] as const

export const AGENT_MODELS = [
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
  { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
  { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' },
] as const

export const STATUS_LABELS: Record<AgentStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'gray' },
  training: { label: 'Training', color: 'yellow' },
  active: { label: 'Active', color: 'green' },
  suspended: { label: 'Suspended', color: 'red' },
  archived: { label: 'Archived', color: 'gray' },
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get canonical TrustBand from a 0-1000 score
 * Aligned with @vorionsys/atsf-core RuntimeTier thresholds
 */
export function getTrustBandFromScore(score: number): TrustBand {
  if (score < 100) return 'T0_UNTRUSTED'
  if (score < 300) return 'T1_SUPERVISED'
  if (score < 500) return 'T2_CONSTRAINED'
  if (score < 700) return 'T3_TRUSTED'
  if (score < 900) return 'T4_AUTONOMOUS'
  return 'T5_MISSION_CRITICAL'
}

/**
 * @deprecated Use getTrustBandFromScore instead.
 * Get legacy TrustTier from a 0-1000 score
 */
export function getTrustTierFromScore(score: number): TrustTier {
  if (score < 100) return 'untrusted'
  if (score < 300) return 'novice'
  if (score < 500) return 'proven'
  if (score < 700) return 'trusted'
  if (score < 900) return 'elite'
  return 'legendary'
}

/**
 * @deprecated 0-1000 is now the canonical scale
 * Convert old 0-100 score to canonical 0-1000 score
 */
export function convertLegacyScore(legacyScore: number): number {
  return Math.round(legacyScore * 10)
}

/**
 * @deprecated 0-1000 is now the canonical scale
 * Convert canonical 0-1000 score to old 0-100 display value
 */
export function convertToLegacyScore(canonicalScore: number): number {
  return Math.round(canonicalScore / 10)
}

export function getNextCertificationLevel(current: number): number {
  return Math.min(current + 1, 5)
}

export function canEnrollInCurriculum(agent: Agent, curriculum: Curriculum): boolean {
  // Check if agent is in draft or training status
  if (!['draft', 'training'].includes(agent.status)) return false

  // Check prerequisites (would need enrollments data)
  return true
}
