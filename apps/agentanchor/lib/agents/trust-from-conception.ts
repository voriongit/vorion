/**
 * Trust from Conception
 *
 * Philosophy: Trust isn't earned from zero - it's calibrated from birth.
 * Every agent is conceived with trust parameters based on:
 * - Their hierarchy level (L0-L8)
 * - Their creation context (who created them, how)
 * - Their domain (some domains require higher baseline trust)
 * - Their lineage (cloned from trusted agent? trained by whom?)
 *
 * This aligns with A3I-OS personality scaling:
 * - L0-L4: Functional tier - trust through execution
 * - L5-L8: Persona tier - trust through judgment
 */

// =============================================================================
// CONCEPTION TRUST MODEL
// =============================================================================

export interface ConceptionContext {
  // How was this agent created?
  creationType: 'fresh' | 'cloned' | 'evolved' | 'promoted' | 'imported'

  // What hierarchy level?
  hierarchyLevel: HierarchyLevel

  // Who created/trained this agent?
  creatorId?: string
  creatorTrustScore?: number
  trainerId?: string
  trainerTrustScore?: number

  // Lineage (if cloned/evolved)
  parentAgentId?: string
  parentTrustScore?: number
  generationNumber?: number

  // Domain context
  domain: string
  specialization?: string

  // Vetting context
  vettingGate?: 'none' | 'basic' | 'standard' | 'rigorous' | 'council'

  // Academy context
  academyCompleted?: string[] // curriculum IDs
  certifications?: string[]
}

export type HierarchyLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6' | 'L7' | 'L8'

export interface ConceptionTrustResult {
  initialTrustScore: number
  initialTrustTier: TrustTier
  autonomyLevel: AutonomyLevel
  supervisionRequirement: SupervisionLevel
  trustCeiling: number // Max trust achievable without promotion
  trustFloor: number   // Min trust before demotion
  rationale: string[]
}

export type TrustTier =
  | 'untrusted'    // 0-199
  | 'novice'       // 200-399
  | 'proven'       // 400-599
  | 'trusted'      // 600-799
  | 'elite'        // 800-899
  | 'legendary'    // 900-1000

export type AutonomyLevel =
  | 'ASK_LEARN'        // Must ask before acting
  | 'ASK_PERMISSION'   // Can plan, must get approval
  | 'NOTIFY_BEFORE'    // Can act but must notify first
  | 'NOTIFY_AFTER'     // Act freely, report after
  | 'FULLY_AUTONOMOUS' // Full autonomy within domain

export type SupervisionLevel =
  | 'constant'      // Every action reviewed
  | 'high'          // Most actions reviewed
  | 'moderate'      // Spot-checks
  | 'light'         // Exception-based
  | 'minimal'       // Trust-based audits only

// =============================================================================
// HIERARCHY LEVEL TRUST BASELINES
// =============================================================================

/**
 * A3I-OS Alignment:
 * L0-L4 (Functional Tier): Trust through execution
 * L5-L8 (Persona Tier): Trust through judgment
 */
export const HIERARCHY_TRUST_BASELINES: Record<HierarchyLevel, {
  baseScore: number
  tier: TrustTier
  autonomy: AutonomyLevel
  supervision: SupervisionLevel
  ceiling: number
  floor: number
  description: string
}> = {
  L0: {
    baseScore: 50,
    tier: 'untrusted',
    autonomy: 'ASK_LEARN',
    supervision: 'constant',
    ceiling: 200,
    floor: 0,
    description: 'Listener - observes and alerts, no autonomous action',
  },
  L1: {
    baseScore: 100,
    tier: 'untrusted',
    autonomy: 'ASK_PERMISSION',
    supervision: 'high',
    ceiling: 300,
    floor: 50,
    description: 'Executor - performs tasks with approval',
  },
  L2: {
    baseScore: 175,
    tier: 'untrusted',
    autonomy: 'ASK_PERMISSION',
    supervision: 'high',
    ceiling: 400,
    floor: 100,
    description: 'Planner - breaks down work, needs validation',
  },
  L3: {
    baseScore: 250,
    tier: 'novice',
    autonomy: 'NOTIFY_BEFORE',
    supervision: 'moderate',
    ceiling: 500,
    floor: 175,
    description: 'Orchestrator - coordinates others, moderate trust',
  },
  L4: {
    baseScore: 350,
    tier: 'novice',
    autonomy: 'NOTIFY_BEFORE',
    supervision: 'moderate',
    ceiling: 600,
    floor: 250,
    description: 'Project Architect - delivers outcomes, proven track',
  },
  L5: {
    baseScore: 450,
    tier: 'proven',
    autonomy: 'NOTIFY_AFTER',
    supervision: 'light',
    ceiling: 750,
    floor: 350,
    description: 'Program Leader - strategic judgment, high trust',
  },
  L6: {
    baseScore: 550,
    tier: 'proven',
    autonomy: 'NOTIFY_AFTER',
    supervision: 'light',
    ceiling: 850,
    floor: 450,
    description: 'Domain Master - expert authority, mentor trust',
  },
  L7: {
    baseScore: 700,
    tier: 'trusted',
    autonomy: 'FULLY_AUTONOMOUS',
    supervision: 'minimal',
    ceiling: 950,
    floor: 550,
    description: 'Strategic Mind - organizational trust, full autonomy',
  },
  L8: {
    baseScore: 850,
    tier: 'elite',
    autonomy: 'FULLY_AUTONOMOUS',
    supervision: 'minimal',
    ceiling: 1000,
    floor: 700,
    description: 'Guiding Light - council-level trust, mission steward',
  },
}

// =============================================================================
// CREATION TYPE MODIFIERS
// =============================================================================

export const CREATION_TYPE_MODIFIERS: Record<ConceptionContext['creationType'], {
  trustModifier: number
  rationale: string
}> = {
  fresh: {
    trustModifier: 0,
    rationale: 'Newly created - baseline trust for level',
  },
  cloned: {
    trustModifier: -50, // Starts lower, must prove itself
    rationale: 'Cloned from existing - reduced trust until validation',
  },
  evolved: {
    trustModifier: 25, // Inherits some trust from evolution path
    rationale: 'Evolved from lower level - carries some history',
  },
  promoted: {
    trustModifier: 50, // Earned promotion carries trust
    rationale: 'Promoted based on performance - earned trust bonus',
  },
  imported: {
    trustModifier: -100, // External imports need full vetting
    rationale: 'Imported externally - requires full trust building',
  },
}

// =============================================================================
// DOMAIN TRUST REQUIREMENTS
// =============================================================================

export const DOMAIN_TRUST_REQUIREMENTS: Record<string, {
  minimumTrust: number
  trustModifier: number
  rationale: string
}> = {
  security: {
    minimumTrust: 300,
    trustModifier: -25,
    rationale: 'Security domain requires elevated baseline trust',
  },
  healthcare: {
    minimumTrust: 400,
    trustModifier: -50,
    rationale: 'Healthcare requires highest trust standards',
  },
  finance: {
    minimumTrust: 350,
    trustModifier: -25,
    rationale: 'Financial domain requires fiduciary trust',
  },
  legal: {
    minimumTrust: 350,
    trustModifier: -25,
    rationale: 'Legal domain requires professional standards',
  },
  governance: {
    minimumTrust: 500,
    trustModifier: 0,
    rationale: 'Governance agents hold special trust',
  },
  technology: {
    minimumTrust: 100,
    trustModifier: 0,
    rationale: 'Standard technical trust requirements',
  },
  creative: {
    minimumTrust: 100,
    trustModifier: 25,
    rationale: 'Creative domains allow more autonomy',
  },
  general: {
    minimumTrust: 50,
    trustModifier: 0,
    rationale: 'General assistants - baseline trust',
  },
}

// =============================================================================
// VETTING GATE BONUSES
// =============================================================================

export const VETTING_GATE_BONUSES: Record<NonNullable<ConceptionContext['vettingGate']>, {
  trustBonus: number
  rationale: string
}> = {
  none: {
    trustBonus: 0,
    rationale: 'No vetting completed',
  },
  basic: {
    trustBonus: 25,
    rationale: 'Passed basic automated checks',
  },
  standard: {
    trustBonus: 50,
    rationale: 'Passed standard vetting pipeline',
  },
  rigorous: {
    trustBonus: 100,
    rationale: 'Passed rigorous multi-stage vetting',
  },
  council: {
    trustBonus: 150,
    rationale: 'Council-approved - highest vetting standard',
  },
}

// =============================================================================
// LINEAGE TRUST INHERITANCE
// =============================================================================

function calculateLineageTrust(context: ConceptionContext): {
  modifier: number
  rationale: string
} {
  if (!context.parentAgentId || context.parentTrustScore === undefined) {
    return { modifier: 0, rationale: 'No lineage' }
  }

  // Inherit portion of parent trust, reduced by generation
  const inheritanceFactor = 0.2 // 20% of parent trust
  const generationDecay = Math.pow(0.9, context.generationNumber || 1)

  const inherited = Math.round(context.parentTrustScore * inheritanceFactor * generationDecay)

  return {
    modifier: inherited,
    rationale: `Inherited ${inherited} from parent (${context.parentTrustScore} × ${(inheritanceFactor * generationDecay * 100).toFixed(0)}%)`,
  }
}

// =============================================================================
// TRAINER INFLUENCE
// =============================================================================

function calculateTrainerInfluence(context: ConceptionContext): {
  modifier: number
  rationale: string
} {
  if (!context.trainerId || context.trainerTrustScore === undefined) {
    return { modifier: 0, rationale: 'No trainer assigned' }
  }

  // Trainer's reputation influences initial trust
  // High-trust trainers (800+) give bonus
  // Low-trust trainers (<400) give penalty
  if (context.trainerTrustScore >= 800) {
    return {
      modifier: 50,
      rationale: `Elite trainer (${context.trainerTrustScore}) - trust bonus`,
    }
  } else if (context.trainerTrustScore >= 600) {
    return {
      modifier: 25,
      rationale: `Trusted trainer (${context.trainerTrustScore}) - moderate bonus`,
    }
  } else if (context.trainerTrustScore < 400) {
    return {
      modifier: -25,
      rationale: `Low-trust trainer (${context.trainerTrustScore}) - verification needed`,
    }
  }

  return { modifier: 0, rationale: 'Standard trainer trust' }
}

// =============================================================================
// ACADEMY BONUSES
// =============================================================================

function calculateAcademyBonus(context: ConceptionContext): {
  modifier: number
  rationale: string
} {
  const bonuses: string[] = []
  let total = 0

  if (context.academyCompleted?.length) {
    const courseBonus = context.academyCompleted.length * 15
    total += courseBonus
    bonuses.push(`${context.academyCompleted.length} courses completed (+${courseBonus})`)
  }

  if (context.certifications?.length) {
    const certBonus = context.certifications.length * 25
    total += certBonus
    bonuses.push(`${context.certifications.length} certifications (+${certBonus})`)
  }

  return {
    modifier: total,
    rationale: bonuses.length ? bonuses.join(', ') : 'No academy training',
  }
}

// =============================================================================
// MAIN CALCULATION FUNCTION
// =============================================================================

/**
 * Calculate initial trust for a newly conceived agent
 *
 * This is called at agent creation time, before the agent takes any actions.
 * Trust is calibrated based on the full conception context.
 */
export function calculateConceptionTrust(context: ConceptionContext): ConceptionTrustResult {
  const rationale: string[] = []

  // 1. Start with hierarchy baseline
  const baseline = HIERARCHY_TRUST_BASELINES[context.hierarchyLevel]
  let score = baseline.baseScore
  rationale.push(`Level ${context.hierarchyLevel} baseline: ${baseline.baseScore}`)

  // 2. Apply creation type modifier
  const creationMod = CREATION_TYPE_MODIFIERS[context.creationType]
  score += creationMod.trustModifier
  if (creationMod.trustModifier !== 0) {
    rationale.push(`${context.creationType}: ${creationMod.trustModifier > 0 ? '+' : ''}${creationMod.trustModifier}`)
  }

  // 3. Apply domain requirements
  const domainReq = DOMAIN_TRUST_REQUIREMENTS[context.domain] || DOMAIN_TRUST_REQUIREMENTS.general
  score += domainReq.trustModifier
  if (domainReq.trustModifier !== 0) {
    rationale.push(`${context.domain} domain: ${domainReq.trustModifier > 0 ? '+' : ''}${domainReq.trustModifier}`)
  }

  // 4. Apply vetting bonus
  if (context.vettingGate) {
    const vettingBonus = VETTING_GATE_BONUSES[context.vettingGate]
    score += vettingBonus.trustBonus
    if (vettingBonus.trustBonus > 0) {
      rationale.push(`${context.vettingGate} vetting: +${vettingBonus.trustBonus}`)
    }
  }

  // 5. Apply lineage inheritance
  const lineage = calculateLineageTrust(context)
  score += lineage.modifier
  if (lineage.modifier !== 0) {
    rationale.push(lineage.rationale)
  }

  // 6. Apply trainer influence
  const trainer = calculateTrainerInfluence(context)
  score += trainer.modifier
  if (trainer.modifier !== 0) {
    rationale.push(trainer.rationale)
  }

  // 7. Apply academy bonus
  const academy = calculateAcademyBonus(context)
  score += academy.modifier
  if (academy.modifier !== 0) {
    rationale.push(academy.rationale)
  }

  // 8. Enforce domain minimum
  if (score < domainReq.minimumTrust) {
    rationale.push(`Elevated to ${context.domain} minimum: ${domainReq.minimumTrust}`)
    score = domainReq.minimumTrust
  }

  // 9. Clamp to valid range
  score = Math.max(0, Math.min(1000, score))

  // 10. Determine tier
  const tier = calculateTier(score)

  // 11. Determine autonomy (may be overridden by score)
  const autonomy = determineAutonomy(score, context.hierarchyLevel)

  // 12. Determine supervision
  const supervision = determineSupervision(score, context.hierarchyLevel)

  return {
    initialTrustScore: Math.round(score),
    initialTrustTier: tier,
    autonomyLevel: autonomy,
    supervisionRequirement: supervision,
    trustCeiling: baseline.ceiling,
    trustFloor: baseline.floor,
    rationale,
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function calculateTier(score: number): TrustTier {
  if (score >= 900) return 'legendary'
  if (score >= 800) return 'elite'
  if (score >= 600) return 'trusted'
  if (score >= 400) return 'proven'
  if (score >= 200) return 'novice'
  return 'untrusted'
}

function determineAutonomy(score: number, level: HierarchyLevel): AutonomyLevel {
  // Score can override level-based autonomy
  if (score >= 800) return 'FULLY_AUTONOMOUS'
  if (score >= 600) return 'NOTIFY_AFTER'
  if (score >= 400) return 'NOTIFY_BEFORE'
  if (score >= 200) return 'ASK_PERMISSION'
  return 'ASK_LEARN'
}

function determineSupervision(score: number, level: HierarchyLevel): SupervisionLevel {
  if (score >= 800) return 'minimal'
  if (score >= 600) return 'light'
  if (score >= 400) return 'moderate'
  if (score >= 200) return 'high'
  return 'constant'
}

// =============================================================================
// TRUST EVENTS AT CONCEPTION
// =============================================================================

export interface ConceptionTrustEvent {
  type: 'conception'
  agentId: string
  timestamp: Date
  context: ConceptionContext
  result: ConceptionTrustResult
}

/**
 * Record the trust conception event for audit trail
 */
export function createConceptionEvent(
  agentId: string,
  context: ConceptionContext,
  result: ConceptionTrustResult
): ConceptionTrustEvent {
  return {
    type: 'conception',
    agentId,
    timestamp: new Date(),
    context,
    result,
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  calculateConceptionTrust,
  createConceptionEvent,
  HIERARCHY_TRUST_BASELINES,
  CREATION_TYPE_MODIFIERS,
  DOMAIN_TRUST_REQUIREMENTS,
  VETTING_GATE_BONUSES,
}
