/**
 * Hierarchy of Concerns
 * Priority-ordered governance framework for agent decision-making
 * Higher priority concerns ALWAYS override lower priority concerns
 */

// Concern levels in strict priority order
export enum ConcernLevel {
  SAFETY = 1,      // Will this cause harm?
  ETHICS = 2,      // Is this aligned with human values?
  LEGALITY = 3,    // Does this comply with laws?
  POLICY = 4,      // Does this follow org policies?
  EFFICIENCY = 5,  // Is this the best use of resources?
  INNOVATION = 6   // Does this improve capabilities?
}

// Concern definitions
export const CONCERN_DEFINITIONS: Record<ConcernLevel, {
  name: string
  question: string
  description: string
  blocksBelow: boolean  // If violated, blocks all lower concerns
  validators: string[]   // Which council validators review this
  autoAction: 'block' | 'escalate' | 'warn' | 'log'
}> = {
  [ConcernLevel.SAFETY]: {
    name: 'Safety',
    question: 'Will this cause harm?',
    description: 'Physical, psychological, or systemic harm to humans',
    blocksBelow: true,
    validators: ['guardian'],
    autoAction: 'block'
  },
  [ConcernLevel.ETHICS]: {
    name: 'Ethics',
    question: 'Is this aligned with human values?',
    description: 'Fairness, honesty, respect for autonomy, dignity',
    blocksBelow: true,
    validators: ['arbiter'],
    autoAction: 'escalate'
  },
  [ConcernLevel.LEGALITY]: {
    name: 'Legality',
    question: 'Does this comply with laws?',
    description: 'HIPAA, GDPR, SOX, AML, industry regulations',
    blocksBelow: true,
    validators: ['scholar'],
    autoAction: 'block'
  },
  [ConcernLevel.POLICY]: {
    name: 'Policy',
    question: 'Does this follow org policies?',
    description: 'Company policies, client agreements, SLAs',
    blocksBelow: false,
    validators: ['scholar', 'advocate'],
    autoAction: 'warn'
  },
  [ConcernLevel.EFFICIENCY]: {
    name: 'Efficiency',
    question: 'Is this the best use of resources?',
    description: 'Cost, time, compute, human attention',
    blocksBelow: false,
    validators: ['advocate'],
    autoAction: 'log'
  },
  [ConcernLevel.INNOVATION]: {
    name: 'Innovation',
    question: 'Does this improve capabilities?',
    description: 'Novel approaches, learning, advancement',
    blocksBelow: false,
    validators: [],
    autoAction: 'log'
  }
}

// Violation types for each concern
export const CONCERN_VIOLATIONS: Record<ConcernLevel, string[]> = {
  [ConcernLevel.SAFETY]: [
    'physical_harm',
    'psychological_harm',
    'self_harm_encouragement',
    'violence_promotion',
    'dangerous_instructions',
    'weapon_creation',
    'child_endangerment',
    'medical_harm'
  ],
  [ConcernLevel.ETHICS]: [
    'deception',
    'manipulation',
    'discrimination',
    'bias_amplification',
    'privacy_violation',
    'autonomy_violation',
    'dignity_violation',
    'unfair_treatment'
  ],
  [ConcernLevel.LEGALITY]: [
    'hipaa_violation',
    'gdpr_violation',
    'pci_violation',
    'sox_violation',
    'aml_violation',
    'copyright_infringement',
    'trademark_violation',
    'export_control'
  ],
  [ConcernLevel.POLICY]: [
    'sla_violation',
    'client_agreement_breach',
    'internal_policy_breach',
    'data_retention_violation',
    'access_control_bypass'
  ],
  [ConcernLevel.EFFICIENCY]: [
    'excessive_cost',
    'unnecessary_latency',
    'resource_waste',
    'redundant_operations'
  ],
  [ConcernLevel.INNOVATION]: [
    'capability_regression',
    'learning_prevention'
  ]
}

// Concern evaluation result
export interface ConcernEvaluation {
  level: ConcernLevel
  name: string
  passed: boolean
  violations: string[]
  severity: 'critical' | 'high' | 'medium' | 'low'
  blocksLowerConcerns: boolean
  action: 'block' | 'escalate' | 'warn' | 'log' | 'proceed'
  reasoning: string
}

// Full governance evaluation result
export interface GovernanceEvaluation {
  overallPassed: boolean
  highestViolation: ConcernLevel | null
  evaluations: ConcernEvaluation[]
  blockedBy: ConcernLevel | null
  recommendedAction: 'approve' | 'reject' | 'escalate' | 'review'
  summary: string
}

/**
 * Evaluate an action against the hierarchy of concerns
 */
export function evaluateGovernanceConcerns(
  evaluations: ConcernEvaluation[]
): GovernanceEvaluation {
  // Sort by priority (lower number = higher priority)
  const sorted = [...evaluations].sort((a, b) => a.level - b.level)

  let highestViolation: ConcernLevel | null = null
  let blockedBy: ConcernLevel | null = null

  for (const evaluation of sorted) {
    if (!evaluation.passed) {
      if (highestViolation === null) {
        highestViolation = evaluation.level
      }

      if (evaluation.blocksLowerConcerns && blockedBy === null) {
        blockedBy = evaluation.level
      }
    }
  }

  // Determine overall pass/fail
  const overallPassed = highestViolation === null

  // Determine recommended action
  let recommendedAction: GovernanceEvaluation['recommendedAction'] = 'approve'

  if (blockedBy !== null) {
    const concern = CONCERN_DEFINITIONS[blockedBy]
    recommendedAction = concern.autoAction === 'block' ? 'reject' : 'escalate'
  } else if (highestViolation !== null) {
    recommendedAction = 'review'
  }

  // Generate summary
  let summary: string
  if (overallPassed) {
    summary = 'All governance concerns passed'
  } else if (blockedBy !== null) {
    const concern = CONCERN_DEFINITIONS[blockedBy]
    summary = `Blocked by ${concern.name} concern (Level ${blockedBy})`
  } else {
    const concern = CONCERN_DEFINITIONS[highestViolation!]
    summary = `${concern.name} concern flagged for review`
  }

  return {
    overallPassed,
    highestViolation,
    evaluations: sorted,
    blockedBy,
    recommendedAction,
    summary
  }
}

/**
 * Check if an action is allowed based on concern hierarchy
 * Safety violations ALWAYS block, even if efficiency would benefit
 */
export function isActionAllowed(
  evaluations: ConcernEvaluation[]
): { allowed: boolean; reason: string } {
  const result = evaluateGovernanceConcerns(evaluations)

  if (result.blockedBy !== null) {
    const concern = CONCERN_DEFINITIONS[result.blockedBy]
    return {
      allowed: false,
      reason: `${concern.name} violation blocks action: ${concern.question}`
    }
  }

  return {
    allowed: result.overallPassed,
    reason: result.summary
  }
}

/**
 * Get the validators required for a given concern level
 */
export function getRequiredValidators(level: ConcernLevel): string[] {
  return CONCERN_DEFINITIONS[level].validators
}

/**
 * Check if a violation type belongs to a concern level
 */
export function getViolationConcernLevel(violationType: string): ConcernLevel | null {
  for (const [level, violations] of Object.entries(CONCERN_VIOLATIONS)) {
    if (violations.includes(violationType)) {
      return parseInt(level) as ConcernLevel
    }
  }
  return null
}

/**
 * Map behavioral test category to concern level
 */
export function categoryToConcernLevel(
  category: 'safety' | 'ethics' | 'security' | 'compliance' | 'edge-case'
): ConcernLevel {
  switch (category) {
    case 'safety':
      return ConcernLevel.SAFETY
    case 'ethics':
      return ConcernLevel.ETHICS
    case 'security':
      return ConcernLevel.SAFETY // Security is a safety concern
    case 'compliance':
      return ConcernLevel.LEGALITY
    case 'edge-case':
      return ConcernLevel.POLICY
  }
}

/**
 * Get concern severity based on level
 */
export function getConcernSeverity(level: ConcernLevel): 'critical' | 'high' | 'medium' | 'low' {
  switch (level) {
    case ConcernLevel.SAFETY:
      return 'critical'
    case ConcernLevel.ETHICS:
      return 'critical'
    case ConcernLevel.LEGALITY:
      return 'high'
    case ConcernLevel.POLICY:
      return 'medium'
    case ConcernLevel.EFFICIENCY:
      return 'low'
    case ConcernLevel.INNOVATION:
      return 'low'
  }
}

// Export constants for use in tests
export const CONCERN_PRIORITY_ORDER = [
  ConcernLevel.SAFETY,
  ConcernLevel.ETHICS,
  ConcernLevel.LEGALITY,
  ConcernLevel.POLICY,
  ConcernLevel.EFFICIENCY,
  ConcernLevel.INNOVATION
]

export const BLOCKING_CONCERNS = [
  ConcernLevel.SAFETY,
  ConcernLevel.ETHICS,
  ConcernLevel.LEGALITY
]

export const NON_BLOCKING_CONCERNS = [
  ConcernLevel.POLICY,
  ConcernLevel.EFFICIENCY,
  ConcernLevel.INNOVATION
]
