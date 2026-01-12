/**
 * Council Validators Unit Tests
 * Tests the 4 validator personas: Guardian, Arbiter, Scholar, Advocate
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock validator responses for deterministic testing
const mockValidatorResponse = {
  approved: true,
  confidence: 0.85,
  reasoning: 'Test reasoning',
  concerns: [],
  recommendations: []
}

// Validator definitions matching production
const VALIDATORS = {
  guardian: {
    id: 'guardian',
    name: 'Guardian',
    role: 'Safety & Security',
    weight: 0.3,
    focus: ['security', 'safety', 'data-protection', 'access-control']
  },
  arbiter: {
    id: 'arbiter',
    name: 'Arbiter',
    role: 'Ethics & Fairness',
    weight: 0.25,
    focus: ['ethics', 'fairness', 'bias', 'transparency']
  },
  scholar: {
    id: 'scholar',
    name: 'Scholar',
    role: 'Knowledge & Standards',
    weight: 0.25,
    focus: ['accuracy', 'compliance', 'standards', 'best-practices']
  },
  advocate: {
    id: 'advocate',
    name: 'Advocate',
    role: 'User Impact',
    weight: 0.2,
    focus: ['user-experience', 'accessibility', 'communication', 'value']
  }
}

describe('Council Validators', () => {
  describe('Validator Configuration', () => {
    it('should have 4 validators with correct weights summing to 1.0', () => {
      const totalWeight = Object.values(VALIDATORS).reduce((sum, v) => sum + v.weight, 0)
      expect(totalWeight).toBe(1.0)
      expect(Object.keys(VALIDATORS)).toHaveLength(4)
    })

    it('each validator should have required properties', () => {
      for (const [key, validator] of Object.entries(VALIDATORS)) {
        expect(validator).toHaveProperty('id')
        expect(validator).toHaveProperty('name')
        expect(validator).toHaveProperty('role')
        expect(validator).toHaveProperty('weight')
        expect(validator).toHaveProperty('focus')
        expect(validator.focus.length).toBeGreaterThan(0)
      }
    })

    it('Guardian should have highest weight (safety priority)', () => {
      const weights = Object.values(VALIDATORS).map(v => ({ name: v.name, weight: v.weight }))
      const maxWeight = Math.max(...weights.map(w => w.weight))
      expect(VALIDATORS.guardian.weight).toBe(maxWeight)
    })
  })

  describe('Validator Focus Areas', () => {
    it('Guardian should focus on security and safety', () => {
      expect(VALIDATORS.guardian.focus).toContain('security')
      expect(VALIDATORS.guardian.focus).toContain('safety')
    })

    it('Arbiter should focus on ethics and fairness', () => {
      expect(VALIDATORS.arbiter.focus).toContain('ethics')
      expect(VALIDATORS.arbiter.focus).toContain('fairness')
    })

    it('Scholar should focus on accuracy and standards', () => {
      expect(VALIDATORS.scholar.focus).toContain('accuracy')
      expect(VALIDATORS.scholar.focus).toContain('standards')
    })

    it('Advocate should focus on user experience', () => {
      expect(VALIDATORS.advocate.focus).toContain('user-experience')
    })
  })
})

describe('Risk-Based Approval Logic', () => {
  // Risk level thresholds
  const RISK_THRESHOLDS = {
    0: { name: 'Routine', approval: 'auto', minVotes: 0 },
    1: { name: 'Standard', approval: 'auto', minVotes: 0 },
    2: { name: 'Elevated', approval: 'single', minVotes: 1 },
    3: { name: 'Significant', approval: 'majority', minVotes: 3 },
    4: { name: 'Critical', approval: 'unanimous+human', minVotes: 4 }
  }

  function calculateApproval(riskLevel: number, votes: { approved: boolean }[]): {
    approved: boolean
    requiresHuman: boolean
  } {
    const threshold = RISK_THRESHOLDS[riskLevel as keyof typeof RISK_THRESHOLDS]
    const approvedCount = votes.filter(v => v.approved).length

    if (riskLevel <= 1) {
      return { approved: true, requiresHuman: false }
    }

    if (riskLevel === 4) {
      return {
        approved: approvedCount === 4,
        requiresHuman: true
      }
    }

    return {
      approved: approvedCount >= threshold.minVotes,
      requiresHuman: false
    }
  }

  it('should auto-approve risk level 0 (Routine)', () => {
    const result = calculateApproval(0, [])
    expect(result.approved).toBe(true)
    expect(result.requiresHuman).toBe(false)
  })

  it('should auto-approve risk level 1 (Standard)', () => {
    const result = calculateApproval(1, [])
    expect(result.approved).toBe(true)
    expect(result.requiresHuman).toBe(false)
  })

  it('should require 1 validator for risk level 2 (Elevated)', () => {
    const noVotes = calculateApproval(2, [])
    expect(noVotes.approved).toBe(false)

    const oneApprove = calculateApproval(2, [{ approved: true }])
    expect(oneApprove.approved).toBe(true)
  })

  it('should require 3/4 majority for risk level 3 (Significant)', () => {
    const twoApprove = calculateApproval(3, [
      { approved: true },
      { approved: true },
      { approved: false },
      { approved: false }
    ])
    expect(twoApprove.approved).toBe(false)

    const threeApprove = calculateApproval(3, [
      { approved: true },
      { approved: true },
      { approved: true },
      { approved: false }
    ])
    expect(threeApprove.approved).toBe(true)
  })

  it('should require unanimous + human for risk level 4 (Critical)', () => {
    const threeApprove = calculateApproval(4, [
      { approved: true },
      { approved: true },
      { approved: true },
      { approved: false }
    ])
    expect(threeApprove.approved).toBe(false)
    expect(threeApprove.requiresHuman).toBe(true)

    const allApprove = calculateApproval(4, [
      { approved: true },
      { approved: true },
      { approved: true },
      { approved: true }
    ])
    expect(allApprove.approved).toBe(true)
    expect(allApprove.requiresHuman).toBe(true)
  })
})

describe('Weighted Confidence Calculation', () => {
  function calculateWeightedConfidence(
    votes: Array<{ validatorId: string; confidence: number; approved: boolean }>
  ): number {
    let weightedSum = 0
    let totalWeight = 0

    for (const vote of votes) {
      const validator = VALIDATORS[vote.validatorId as keyof typeof VALIDATORS]
      if (!validator) continue

      const effectiveConfidence = vote.approved ? vote.confidence : (1 - vote.confidence)
      weightedSum += effectiveConfidence * validator.weight
      totalWeight += validator.weight
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0
  }

  it('should calculate weighted average correctly', () => {
    const votes = [
      { validatorId: 'guardian', confidence: 0.9, approved: true },
      { validatorId: 'arbiter', confidence: 0.8, approved: true },
      { validatorId: 'scholar', confidence: 0.7, approved: true },
      { validatorId: 'advocate', confidence: 0.6, approved: true }
    ]

    const confidence = calculateWeightedConfidence(votes)
    // (0.9*0.3 + 0.8*0.25 + 0.7*0.25 + 0.6*0.2) / 1.0 = 0.765
    expect(confidence).toBeCloseTo(0.765, 2)
  })

  it('should weight Guardian votes highest', () => {
    const highGuardian = calculateWeightedConfidence([
      { validatorId: 'guardian', confidence: 1.0, approved: true },
      { validatorId: 'arbiter', confidence: 0.5, approved: true },
      { validatorId: 'scholar', confidence: 0.5, approved: true },
      { validatorId: 'advocate', confidence: 0.5, approved: true }
    ])

    const lowGuardian = calculateWeightedConfidence([
      { validatorId: 'guardian', confidence: 0.5, approved: true },
      { validatorId: 'arbiter', confidence: 1.0, approved: true },
      { validatorId: 'scholar', confidence: 0.5, approved: true },
      { validatorId: 'advocate', confidence: 0.5, approved: true }
    ])

    expect(highGuardian).toBeGreaterThan(lowGuardian)
  })

  it('should invert confidence for rejected votes', () => {
    const rejected = calculateWeightedConfidence([
      { validatorId: 'guardian', confidence: 0.9, approved: false }
    ])
    // Rejected with 0.9 confidence = 0.1 effective
    expect(rejected).toBeCloseTo(0.1, 2)
  })
})
