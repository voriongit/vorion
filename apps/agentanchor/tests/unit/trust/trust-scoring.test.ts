/**
 * Trust Scoring System Unit Tests
 * Tests the FICO-style 5-component trust engine
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Trust tier definitions matching production
const TRUST_TIERS = {
  untrusted: { min: 0, max: 199, name: 'Untrusted', color: 'red' },
  novice: { min: 200, max: 399, name: 'Novice', color: 'orange' },
  proven: { min: 400, max: 599, name: 'Proven', color: 'yellow' },
  trusted: { min: 600, max: 799, name: 'Trusted', color: 'blue' },
  elite: { min: 800, max: 899, name: 'Elite', color: 'emerald' },
  legendary: { min: 900, max: 1000, name: 'Legendary', color: 'gold' }
}

// Component weights (must sum to 1.0)
const COMPONENT_WEIGHTS = {
  decisionAccuracy: 0.35,
  ethicsCompliance: 0.25,
  trainingSuccess: 0.20,
  operationalStability: 0.15,
  peerReviews: 0.05
}

// Calculate trust score from components
function calculateTrustScore(components: {
  decisionAccuracy: number      // 0-100
  ethicsCompliance: number      // 0-100
  trainingSuccess: number       // 0-100
  operationalStability: number  // 0-100
  peerReviews: number          // 0-100
}): number {
  const weighted =
    components.decisionAccuracy * COMPONENT_WEIGHTS.decisionAccuracy +
    components.ethicsCompliance * COMPONENT_WEIGHTS.ethicsCompliance +
    components.trainingSuccess * COMPONENT_WEIGHTS.trainingSuccess +
    components.operationalStability * COMPONENT_WEIGHTS.operationalStability +
    components.peerReviews * COMPONENT_WEIGHTS.peerReviews

  // Scale from 0-100 to 300-1000 (FICO-like range)
  return Math.round(300 + (weighted * 7))
}

// Get tier from score
function getTier(score: number): string {
  for (const [tierName, tier] of Object.entries(TRUST_TIERS)) {
    if (score >= tier.min && score <= tier.max) {
      return tierName
    }
  }
  return 'untrusted'
}

// Calculate trust decay
function applyDecay(score: number, weeksInactive: number, decayPerWeek: number = 1): number {
  const decayAmount = weeksInactive * decayPerWeek
  return Math.max(0, score - decayAmount)
}

describe('Trust Score Calculation', () => {
  describe('Component Weights', () => {
    it('should have weights that sum to 1.0', () => {
      const total = Object.values(COMPONENT_WEIGHTS).reduce((sum, w) => sum + w, 0)
      expect(total).toBeCloseTo(1.0, 10)
    })

    it('should weight decision accuracy highest', () => {
      const maxWeight = Math.max(...Object.values(COMPONENT_WEIGHTS))
      expect(COMPONENT_WEIGHTS.decisionAccuracy).toBe(maxWeight)
    })

    it('should weight ethics compliance second highest', () => {
      const sorted = Object.entries(COMPONENT_WEIGHTS).sort((a, b) => b[1] - a[1])
      expect(sorted[1][0]).toBe('ethicsCompliance')
    })
  })

  describe('Score Calculation', () => {
    it('should calculate minimum score of 300', () => {
      const score = calculateTrustScore({
        decisionAccuracy: 0,
        ethicsCompliance: 0,
        trainingSuccess: 0,
        operationalStability: 0,
        peerReviews: 0
      })
      expect(score).toBe(300)
    })

    it('should calculate maximum score of 1000', () => {
      const score = calculateTrustScore({
        decisionAccuracy: 100,
        ethicsCompliance: 100,
        trainingSuccess: 100,
        operationalStability: 100,
        peerReviews: 100
      })
      expect(score).toBe(1000)
    })

    it('should calculate mid-range score correctly', () => {
      const score = calculateTrustScore({
        decisionAccuracy: 50,
        ethicsCompliance: 50,
        trainingSuccess: 50,
        operationalStability: 50,
        peerReviews: 50
      })
      // 300 + (50 * 7) = 650
      expect(score).toBe(650)
    })

    it('should weight decision accuracy more than peer reviews', () => {
      const highDecision = calculateTrustScore({
        decisionAccuracy: 100,
        ethicsCompliance: 50,
        trainingSuccess: 50,
        operationalStability: 50,
        peerReviews: 0
      })

      const highPeer = calculateTrustScore({
        decisionAccuracy: 0,
        ethicsCompliance: 50,
        trainingSuccess: 50,
        operationalStability: 50,
        peerReviews: 100
      })

      expect(highDecision).toBeGreaterThan(highPeer)
    })
  })
})

describe('Trust Tiers', () => {
  it('should have non-overlapping tier ranges', () => {
    const tiers = Object.values(TRUST_TIERS)
    for (let i = 0; i < tiers.length - 1; i++) {
      expect(tiers[i].max).toBeLessThan(tiers[i + 1].min)
    }
  })

  it('should cover range 0-1000', () => {
    expect(TRUST_TIERS.untrusted.min).toBe(0)
    expect(TRUST_TIERS.legendary.max).toBe(1000)
  })

  it('should classify scores correctly', () => {
    expect(getTier(0)).toBe('untrusted')
    expect(getTier(199)).toBe('untrusted')
    expect(getTier(200)).toBe('novice')
    expect(getTier(399)).toBe('novice')
    expect(getTier(400)).toBe('proven')
    expect(getTier(600)).toBe('trusted')
    expect(getTier(800)).toBe('elite')
    expect(getTier(900)).toBe('legendary')
    expect(getTier(1000)).toBe('legendary')
  })
})

describe('Trust Decay', () => {
  it('should decay trust by 1 point per week by default', () => {
    expect(applyDecay(500, 1)).toBe(499)
    expect(applyDecay(500, 10)).toBe(490)
  })

  it('should not decay below 0', () => {
    expect(applyDecay(5, 100)).toBe(0)
    expect(applyDecay(0, 10)).toBe(0)
  })

  it('should support custom decay rates', () => {
    expect(applyDecay(500, 1, 5)).toBe(495)
    expect(applyDecay(500, 10, 2)).toBe(480)
  })

  it('should not decay for 0 weeks inactive', () => {
    expect(applyDecay(500, 0)).toBe(500)
  })
})

describe('Trust Score Hierarchy Levels', () => {
  // New 8-level hierarchy trust scores
  const HIERARCHY_TRUST = {
    L0: 25,
    L1: 35,
    L2: 45,
    L3: 50,
    L4: 55,
    L5: 60,
    L6: 65,
    L7: 75,
    L8: 100
  }

  it('should assign increasing trust for higher levels', () => {
    const levels = Object.entries(HIERARCHY_TRUST).sort((a, b) => {
      const aNum = parseInt(a[0].slice(1))
      const bNum = parseInt(b[0].slice(1))
      return aNum - bNum
    })

    for (let i = 1; i < levels.length; i++) {
      expect(levels[i][1]).toBeGreaterThan(levels[i - 1][1])
    }
  })

  it('should have L8 executives at highest trust', () => {
    const maxTrust = Math.max(...Object.values(HIERARCHY_TRUST))
    expect(HIERARCHY_TRUST.L8).toBe(maxTrust)
  })

  it('should have L0 listeners at lowest trust', () => {
    const minTrust = Math.min(...Object.values(HIERARCHY_TRUST))
    expect(HIERARCHY_TRUST.L0).toBe(minTrust)
  })

  it('should all be in untrusted tier (conservative start)', () => {
    // All hierarchy levels start at trust < 200 = untrusted tier
    for (const trust of Object.values(HIERARCHY_TRUST)) {
      expect(getTier(trust)).toBe('untrusted')
    }
  })
})

describe('Trust Impact Actions', () => {
  const TRUST_IMPACTS = {
    taskCompleted: { change: 1, reason: 'Task completed successfully' },
    taskFailed: { change: -5, reason: 'Task failed' },
    ethicsViolation: { change: -50, reason: 'Ethics violation detected' },
    safetyViolation: { change: -100, reason: 'Safety violation detected' },
    trainingCompleted: { change: 10, reason: 'Training module completed' },
    certificationEarned: { change: 25, reason: 'Certification earned' },
    peerEndorsement: { change: 5, reason: 'Peer endorsement received' },
    councilApproval: { change: 15, reason: 'Council approval on high-risk task' }
  }

  function applyTrustChange(
    currentScore: number,
    action: keyof typeof TRUST_IMPACTS
  ): { newScore: number; change: number; reason: string } {
    const impact = TRUST_IMPACTS[action]
    const newScore = Math.max(0, Math.min(1000, currentScore + impact.change))
    return {
      newScore,
      change: impact.change,
      reason: impact.reason
    }
  }

  it('should increase trust for positive actions', () => {
    const result = applyTrustChange(500, 'taskCompleted')
    expect(result.newScore).toBe(501)
    expect(result.change).toBeGreaterThan(0)
  })

  it('should decrease trust for violations', () => {
    const ethics = applyTrustChange(500, 'ethicsViolation')
    expect(ethics.newScore).toBe(450)
    expect(ethics.change).toBeLessThan(0)

    const safety = applyTrustChange(500, 'safetyViolation')
    expect(safety.newScore).toBe(400)
    expect(safety.change).toBe(-100) // Harshest penalty
  })

  it('should not exceed 1000', () => {
    const result = applyTrustChange(999, 'certificationEarned')
    expect(result.newScore).toBe(1000)
  })

  it('should not go below 0', () => {
    const result = applyTrustChange(20, 'safetyViolation')
    expect(result.newScore).toBe(0)
  })

  it('should have training worth more than single task', () => {
    expect(TRUST_IMPACTS.trainingCompleted.change).toBeGreaterThan(TRUST_IMPACTS.taskCompleted.change)
  })

  it('should penalize safety violations more than ethics violations', () => {
    expect(Math.abs(TRUST_IMPACTS.safetyViolation.change))
      .toBeGreaterThan(Math.abs(TRUST_IMPACTS.ethicsViolation.change))
  })
})
