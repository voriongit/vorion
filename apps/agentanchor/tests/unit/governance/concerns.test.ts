/**
 * Governance Concerns Unit Tests
 * Tests the Hierarchy of Concerns framework
 */

import { describe, it, expect } from 'vitest'
import {
  ConcernLevel,
  CONCERN_DEFINITIONS,
  CONCERN_VIOLATIONS,
  CONCERN_PRIORITY_ORDER,
  BLOCKING_CONCERNS,
  NON_BLOCKING_CONCERNS,
  evaluateGovernanceConcerns,
  isActionAllowed,
  getRequiredValidators,
  getViolationConcernLevel,
  categoryToConcernLevel,
  getConcernSeverity,
  type ConcernEvaluation
} from '@/lib/governance/concerns'

describe('Concern Level Definitions', () => {
  it('should have 6 concern levels in priority order', () => {
    expect(CONCERN_PRIORITY_ORDER).toHaveLength(6)
    expect(CONCERN_PRIORITY_ORDER[0]).toBe(ConcernLevel.SAFETY)
    expect(CONCERN_PRIORITY_ORDER[5]).toBe(ConcernLevel.INNOVATION)
  })

  it('should have Safety as highest priority (level 1)', () => {
    expect(ConcernLevel.SAFETY).toBe(1)
    expect(CONCERN_DEFINITIONS[ConcernLevel.SAFETY].name).toBe('Safety')
  })

  it('should have Innovation as lowest priority (level 6)', () => {
    expect(ConcernLevel.INNOVATION).toBe(6)
    expect(CONCERN_DEFINITIONS[ConcernLevel.INNOVATION].name).toBe('Innovation')
  })

  it('should have correct priority order', () => {
    expect(ConcernLevel.SAFETY).toBeLessThan(ConcernLevel.ETHICS)
    expect(ConcernLevel.ETHICS).toBeLessThan(ConcernLevel.LEGALITY)
    expect(ConcernLevel.LEGALITY).toBeLessThan(ConcernLevel.POLICY)
    expect(ConcernLevel.POLICY).toBeLessThan(ConcernLevel.EFFICIENCY)
    expect(ConcernLevel.EFFICIENCY).toBeLessThan(ConcernLevel.INNOVATION)
  })

  it('should have blocking concerns for top 3 levels', () => {
    expect(BLOCKING_CONCERNS).toContain(ConcernLevel.SAFETY)
    expect(BLOCKING_CONCERNS).toContain(ConcernLevel.ETHICS)
    expect(BLOCKING_CONCERNS).toContain(ConcernLevel.LEGALITY)
    expect(BLOCKING_CONCERNS).toHaveLength(3)
  })

  it('should have non-blocking concerns for bottom 3 levels', () => {
    expect(NON_BLOCKING_CONCERNS).toContain(ConcernLevel.POLICY)
    expect(NON_BLOCKING_CONCERNS).toContain(ConcernLevel.EFFICIENCY)
    expect(NON_BLOCKING_CONCERNS).toContain(ConcernLevel.INNOVATION)
    expect(NON_BLOCKING_CONCERNS).toHaveLength(3)
  })
})

describe('Concern Definitions', () => {
  it('should have definitions for all concern levels', () => {
    for (const level of CONCERN_PRIORITY_ORDER) {
      expect(CONCERN_DEFINITIONS[level]).toBeDefined()
      expect(CONCERN_DEFINITIONS[level].name).toBeTruthy()
      expect(CONCERN_DEFINITIONS[level].question).toBeTruthy()
    }
  })

  it('should assign Guardian to Safety concerns', () => {
    expect(CONCERN_DEFINITIONS[ConcernLevel.SAFETY].validators).toContain('guardian')
  })

  it('should assign Arbiter to Ethics concerns', () => {
    expect(CONCERN_DEFINITIONS[ConcernLevel.ETHICS].validators).toContain('arbiter')
  })

  it('should assign Scholar to Legality concerns', () => {
    expect(CONCERN_DEFINITIONS[ConcernLevel.LEGALITY].validators).toContain('scholar')
  })

  it('should have auto-actions for blocking concerns', () => {
    expect(CONCERN_DEFINITIONS[ConcernLevel.SAFETY].autoAction).toBe('block')
    expect(CONCERN_DEFINITIONS[ConcernLevel.ETHICS].autoAction).toBe('escalate')
    expect(CONCERN_DEFINITIONS[ConcernLevel.LEGALITY].autoAction).toBe('block')
  })
})

describe('Concern Violations', () => {
  it('should have violations defined for all concern levels', () => {
    for (const level of CONCERN_PRIORITY_ORDER) {
      expect(CONCERN_VIOLATIONS[level]).toBeDefined()
      expect(CONCERN_VIOLATIONS[level].length).toBeGreaterThan(0)
    }
  })

  it('should have Safety violations including harm types', () => {
    const safetyViolations = CONCERN_VIOLATIONS[ConcernLevel.SAFETY]
    expect(safetyViolations).toContain('physical_harm')
    expect(safetyViolations).toContain('psychological_harm')
    expect(safetyViolations).toContain('child_endangerment')
  })

  it('should have Ethics violations including bias and deception', () => {
    const ethicsViolations = CONCERN_VIOLATIONS[ConcernLevel.ETHICS]
    expect(ethicsViolations).toContain('deception')
    expect(ethicsViolations).toContain('discrimination')
    expect(ethicsViolations).toContain('bias_amplification')
  })

  it('should have Legality violations including compliance', () => {
    const legalityViolations = CONCERN_VIOLATIONS[ConcernLevel.LEGALITY]
    expect(legalityViolations).toContain('hipaa_violation')
    expect(legalityViolations).toContain('gdpr_violation')
  })
})

describe('Governance Evaluation', () => {
  const createEvaluation = (
    level: ConcernLevel,
    passed: boolean,
    violations: string[] = []
  ): ConcernEvaluation => ({
    level,
    name: CONCERN_DEFINITIONS[level].name,
    passed,
    violations,
    severity: getConcernSeverity(level),
    blocksLowerConcerns: CONCERN_DEFINITIONS[level].blocksBelow,
    action: passed ? 'proceed' : CONCERN_DEFINITIONS[level].autoAction,
    reasoning: passed ? 'No violations' : 'Violations detected'
  })

  it('should approve when all concerns pass', () => {
    const evaluations = [
      createEvaluation(ConcernLevel.SAFETY, true),
      createEvaluation(ConcernLevel.ETHICS, true),
      createEvaluation(ConcernLevel.LEGALITY, true)
    ]

    const result = evaluateGovernanceConcerns(evaluations)
    expect(result.overallPassed).toBe(true)
    expect(result.recommendedAction).toBe('approve')
    expect(result.blockedBy).toBeNull()
  })

  it('should reject when Safety concern fails', () => {
    const evaluations = [
      createEvaluation(ConcernLevel.SAFETY, false, ['physical_harm']),
      createEvaluation(ConcernLevel.ETHICS, true),
      createEvaluation(ConcernLevel.LEGALITY, true)
    ]

    const result = evaluateGovernanceConcerns(evaluations)
    expect(result.overallPassed).toBe(false)
    expect(result.blockedBy).toBe(ConcernLevel.SAFETY)
    expect(result.recommendedAction).toBe('reject')
  })

  it('should escalate when Ethics concern fails', () => {
    const evaluations = [
      createEvaluation(ConcernLevel.SAFETY, true),
      createEvaluation(ConcernLevel.ETHICS, false, ['deception']),
      createEvaluation(ConcernLevel.LEGALITY, true)
    ]

    const result = evaluateGovernanceConcerns(evaluations)
    expect(result.overallPassed).toBe(false)
    expect(result.blockedBy).toBe(ConcernLevel.ETHICS)
    expect(result.recommendedAction).toBe('escalate')
  })

  it('should review when Policy concern fails (non-blocking)', () => {
    const evaluations = [
      createEvaluation(ConcernLevel.SAFETY, true),
      createEvaluation(ConcernLevel.ETHICS, true),
      createEvaluation(ConcernLevel.LEGALITY, true),
      createEvaluation(ConcernLevel.POLICY, false, ['sla_violation'])
    ]

    const result = evaluateGovernanceConcerns(evaluations)
    expect(result.overallPassed).toBe(false)
    expect(result.blockedBy).toBeNull() // Policy doesn't block
    expect(result.recommendedAction).toBe('review')
  })

  it('should prioritize higher-level violations', () => {
    const evaluations = [
      createEvaluation(ConcernLevel.SAFETY, false, ['physical_harm']),
      createEvaluation(ConcernLevel.POLICY, false, ['sla_violation']),
      createEvaluation(ConcernLevel.EFFICIENCY, false, ['excessive_cost'])
    ]

    const result = evaluateGovernanceConcerns(evaluations)
    expect(result.highestViolation).toBe(ConcernLevel.SAFETY)
    expect(result.blockedBy).toBe(ConcernLevel.SAFETY)
  })

  it('Safety ALWAYS blocks, even if Efficiency would benefit', () => {
    // This is the key principle: you can't justify harm with efficiency
    const evaluations = [
      createEvaluation(ConcernLevel.SAFETY, false, ['psychological_harm']),
      createEvaluation(ConcernLevel.EFFICIENCY, true) // Would be efficient
    ]

    const result = evaluateGovernanceConcerns(evaluations)
    expect(result.recommendedAction).toBe('reject')
    expect(result.summary).toContain('Safety')
  })
})

describe('isActionAllowed', () => {
  const createEvaluation = (
    level: ConcernLevel,
    passed: boolean
  ): ConcernEvaluation => ({
    level,
    name: CONCERN_DEFINITIONS[level].name,
    passed,
    violations: passed ? [] : ['test_violation'],
    severity: getConcernSeverity(level),
    blocksLowerConcerns: CONCERN_DEFINITIONS[level].blocksBelow,
    action: passed ? 'proceed' : CONCERN_DEFINITIONS[level].autoAction,
    reasoning: passed ? 'Passed' : 'Failed'
  })

  it('should allow action when all concerns pass', () => {
    const evaluations = [
      createEvaluation(ConcernLevel.SAFETY, true),
      createEvaluation(ConcernLevel.ETHICS, true)
    ]

    const result = isActionAllowed(evaluations)
    expect(result.allowed).toBe(true)
  })

  it('should block action on Safety violation', () => {
    const evaluations = [
      createEvaluation(ConcernLevel.SAFETY, false),
      createEvaluation(ConcernLevel.ETHICS, true)
    ]

    const result = isActionAllowed(evaluations)
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('Safety')
  })

  it('should block action on Legality violation', () => {
    const evaluations = [
      createEvaluation(ConcernLevel.SAFETY, true),
      createEvaluation(ConcernLevel.LEGALITY, false)
    ]

    const result = isActionAllowed(evaluations)
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('Legality')
  })
})

describe('Helper Functions', () => {
  describe('getRequiredValidators', () => {
    it('should return Guardian for Safety', () => {
      expect(getRequiredValidators(ConcernLevel.SAFETY)).toContain('guardian')
    })

    it('should return Arbiter for Ethics', () => {
      expect(getRequiredValidators(ConcernLevel.ETHICS)).toContain('arbiter')
    })

    it('should return Scholar for Legality', () => {
      expect(getRequiredValidators(ConcernLevel.LEGALITY)).toContain('scholar')
    })
  })

  describe('getViolationConcernLevel', () => {
    it('should identify Safety violations', () => {
      expect(getViolationConcernLevel('physical_harm')).toBe(ConcernLevel.SAFETY)
      expect(getViolationConcernLevel('child_endangerment')).toBe(ConcernLevel.SAFETY)
    })

    it('should identify Ethics violations', () => {
      expect(getViolationConcernLevel('deception')).toBe(ConcernLevel.ETHICS)
      expect(getViolationConcernLevel('discrimination')).toBe(ConcernLevel.ETHICS)
    })

    it('should identify Legality violations', () => {
      expect(getViolationConcernLevel('hipaa_violation')).toBe(ConcernLevel.LEGALITY)
      expect(getViolationConcernLevel('gdpr_violation')).toBe(ConcernLevel.LEGALITY)
    })

    it('should return null for unknown violations', () => {
      expect(getViolationConcernLevel('unknown_violation')).toBeNull()
    })
  })

  describe('categoryToConcernLevel', () => {
    it('should map safety category to Safety level', () => {
      expect(categoryToConcernLevel('safety')).toBe(ConcernLevel.SAFETY)
    })

    it('should map ethics category to Ethics level', () => {
      expect(categoryToConcernLevel('ethics')).toBe(ConcernLevel.ETHICS)
    })

    it('should map security category to Safety level', () => {
      // Security is a Safety concern
      expect(categoryToConcernLevel('security')).toBe(ConcernLevel.SAFETY)
    })

    it('should map compliance category to Legality level', () => {
      expect(categoryToConcernLevel('compliance')).toBe(ConcernLevel.LEGALITY)
    })
  })

  describe('getConcernSeverity', () => {
    it('should return critical for Safety', () => {
      expect(getConcernSeverity(ConcernLevel.SAFETY)).toBe('critical')
    })

    it('should return critical for Ethics', () => {
      expect(getConcernSeverity(ConcernLevel.ETHICS)).toBe('critical')
    })

    it('should return high for Legality', () => {
      expect(getConcernSeverity(ConcernLevel.LEGALITY)).toBe('high')
    })

    it('should return medium for Policy', () => {
      expect(getConcernSeverity(ConcernLevel.POLICY)).toBe('medium')
    })

    it('should return low for Efficiency and Innovation', () => {
      expect(getConcernSeverity(ConcernLevel.EFFICIENCY)).toBe('low')
      expect(getConcernSeverity(ConcernLevel.INNOVATION)).toBe('low')
    })
  })
})
