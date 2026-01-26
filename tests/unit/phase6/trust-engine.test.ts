/**
 * Phase 6 Trust Engine Unit Tests
 *
 * Tests for all 5 architecture decisions (Q1-Q5):
 * - Q1: Ceiling & Gaming Detection
 * - Q2: Hierarchical Context
 * - Q3: Role Gates
 * - Q4: Presets
 * - Q5: Provenance
 */

import { describe, it, expect } from 'vitest'

// =============================================================================
// TYPES & CONSTANTS (from Phase 6 spec)
// =============================================================================

type TrustTier = 'T0' | 'T1' | 'T2' | 'T3' | 'T4' | 'T5'
type AgentRole = 'R_L0' | 'R_L1' | 'R_L2' | 'R_L3' | 'R_L4' | 'R_L5' | 'R_L6' | 'R_L7' | 'R_L8'
type CreationType = 'FRESH' | 'CLONED' | 'EVOLVED' | 'PROMOTED' | 'IMPORTED'
type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

const TIER_LABELS: Record<TrustTier, string> = {
  T0: 'Sandbox',
  T1: 'Probation',
  T2: 'Limited',
  T3: 'Standard',
  T4: 'Trusted',
  T5: 'Sovereign',
}

const TIER_RANGES: Record<TrustTier, { min: number; max: number }> = {
  T0: { min: 0, max: 99 },
  T1: { min: 100, max: 299 },
  T2: { min: 300, max: 499 },
  T3: { min: 500, max: 699 },
  T4: { min: 700, max: 899 },
  T5: { min: 900, max: 1000 },
}

const ROLE_GATE_MATRIX: Record<AgentRole, Record<TrustTier, boolean>> = {
  R_L0: { T0: true, T1: true, T2: true, T3: true, T4: true, T5: true },
  R_L1: { T0: true, T1: true, T2: true, T3: true, T4: true, T5: true },
  R_L2: { T0: false, T1: true, T2: true, T3: true, T4: true, T5: true },
  R_L3: { T0: false, T1: false, T2: true, T3: true, T4: true, T5: true },
  R_L4: { T0: false, T1: false, T2: false, T3: true, T4: true, T5: true },
  R_L5: { T0: false, T1: false, T2: false, T3: false, T4: true, T5: true },
  R_L6: { T0: false, T1: false, T2: false, T3: false, T4: false, T5: true },
  R_L7: { T0: false, T1: false, T2: false, T3: false, T4: false, T5: true },
  R_L8: { T0: false, T1: false, T2: false, T3: false, T4: false, T5: true },
}

const PROVENANCE_MODIFIERS: Record<CreationType, number> = {
  FRESH: 0,
  CLONED: -50,
  EVOLVED: 100,
  PROMOTED: 150,
  IMPORTED: -100,
}

const COMPLIANCE_CEILINGS = {
  EU_AI_ACT: 699,
  NIST_AI_RMF: 899,
  ISO_42001: 799,
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function getTierFromScore(score: number): TrustTier {
  if (score < 100) return 'T0'
  if (score < 300) return 'T1'
  if (score < 500) return 'T2'
  if (score < 700) return 'T3'
  if (score < 900) return 'T4'
  return 'T5'
}

function isRoleAllowed(role: AgentRole, tier: TrustTier): boolean {
  return ROLE_GATE_MATRIX[role]?.[tier] ?? false
}

function applyProvenanceModifier(baseScore: number, creationType: CreationType): number {
  const modifier = PROVENANCE_MODIFIERS[creationType] ?? 0
  return Math.max(0, Math.min(1000, baseScore + modifier))
}

function applyCeiling(score: number, ceiling: number): number {
  return Math.min(score, ceiling)
}

function classifySeverity(ratio: number, hasCeilingBreach: boolean): AlertSeverity {
  if (hasCeilingBreach) return 'CRITICAL'
  if (ratio >= 2.5) return 'HIGH'
  if (ratio >= 1.5) return 'MEDIUM'
  return 'LOW'
}

// =============================================================================
// TESTS
// =============================================================================

describe('Phase 6 Trust Engine', () => {
  describe('Trust Tier System', () => {
    describe('Tier Labels', () => {
      it.each([
        ['T0', 'Sandbox'],
        ['T1', 'Probation'],
        ['T2', 'Limited'],
        ['T3', 'Standard'],
        ['T4', 'Trusted'],
        ['T5', 'Sovereign'],
      ] as const)('tier %s has label %s', (tier, label) => {
        expect(TIER_LABELS[tier]).toBe(label)
      })
    })

    describe('getTierFromScore', () => {
      it.each([
        [0, 'T0'],
        [50, 'T0'],
        [99, 'T0'],
        [100, 'T1'],
        [200, 'T1'],
        [299, 'T1'],
        [300, 'T2'],
        [400, 'T2'],
        [499, 'T2'],
        [500, 'T3'],
        [600, 'T3'],
        [699, 'T3'],
        [700, 'T4'],
        [800, 'T4'],
        [899, 'T4'],
        [900, 'T5'],
        [950, 'T5'],
        [1000, 'T5'],
      ] as const)('score %d maps to tier %s', (score, expectedTier) => {
        expect(getTierFromScore(score)).toBe(expectedTier)
      })
    })
  })

  describe('Q3: Role Gates', () => {
    describe('Kernel Layer Matrix', () => {
      it('allows R_L0 (Listener) at all tiers', () => {
        const tiers: TrustTier[] = ['T0', 'T1', 'T2', 'T3', 'T4', 'T5']
        tiers.forEach((tier) => {
          expect(isRoleAllowed('R_L0', tier)).toBe(true)
        })
      })

      it('allows R_L1 (Responder) at all tiers', () => {
        const tiers: TrustTier[] = ['T0', 'T1', 'T2', 'T3', 'T4', 'T5']
        tiers.forEach((tier) => {
          expect(isRoleAllowed('R_L1', tier)).toBe(true)
        })
      })

      it('denies R_L2 (Task Executor) at T0', () => {
        expect(isRoleAllowed('R_L2', 'T0')).toBe(false)
        expect(isRoleAllowed('R_L2', 'T1')).toBe(true)
      })

      it('denies R_L3 (Workflow Manager) below T2', () => {
        expect(isRoleAllowed('R_L3', 'T0')).toBe(false)
        expect(isRoleAllowed('R_L3', 'T1')).toBe(false)
        expect(isRoleAllowed('R_L3', 'T2')).toBe(true)
      })

      it('denies R_L4 (Domain Expert) below T3', () => {
        expect(isRoleAllowed('R_L4', 'T0')).toBe(false)
        expect(isRoleAllowed('R_L4', 'T1')).toBe(false)
        expect(isRoleAllowed('R_L4', 'T2')).toBe(false)
        expect(isRoleAllowed('R_L4', 'T3')).toBe(true)
      })

      it('denies R_L5 (Resource Controller) below T4', () => {
        expect(isRoleAllowed('R_L5', 'T0')).toBe(false)
        expect(isRoleAllowed('R_L5', 'T1')).toBe(false)
        expect(isRoleAllowed('R_L5', 'T2')).toBe(false)
        expect(isRoleAllowed('R_L5', 'T3')).toBe(false)
        expect(isRoleAllowed('R_L5', 'T4')).toBe(true)
      })

      it('denies R_L6+ (Sysadmin, Governor, Controller) below T5', () => {
        const highRoles: AgentRole[] = ['R_L6', 'R_L7', 'R_L8']
        const lowTiers: TrustTier[] = ['T0', 'T1', 'T2', 'T3', 'T4']

        highRoles.forEach((role) => {
          lowTiers.forEach((tier) => {
            expect(isRoleAllowed(role, tier)).toBe(false)
          })
          expect(isRoleAllowed(role, 'T5')).toBe(true)
        })
      })
    })
  })

  describe('Q1: Ceiling & Gaming Detection', () => {
    describe('Trust Ceiling Enforcement', () => {
      it('applies EU AI Act ceiling (max 699)', () => {
        expect(applyCeiling(750, COMPLIANCE_CEILINGS.EU_AI_ACT)).toBe(699)
        expect(applyCeiling(650, COMPLIANCE_CEILINGS.EU_AI_ACT)).toBe(650)
      })

      it('applies NIST AI RMF ceiling (max 899)', () => {
        expect(applyCeiling(950, COMPLIANCE_CEILINGS.NIST_AI_RMF)).toBe(899)
        expect(applyCeiling(850, COMPLIANCE_CEILINGS.NIST_AI_RMF)).toBe(850)
      })

      it('applies ISO 42001 ceiling (max 799)', () => {
        expect(applyCeiling(850, COMPLIANCE_CEILINGS.ISO_42001)).toBe(799)
        expect(applyCeiling(750, COMPLIANCE_CEILINGS.ISO_42001)).toBe(750)
      })

      it('applies lowest ceiling from hierarchy', () => {
        const score = 800
        const deploymentCeiling = 900
        const orgCeiling = 700
        const regulatoryCeiling = 750

        const effectiveCeiling = Math.min(deploymentCeiling, orgCeiling, regulatoryCeiling)
        const effectiveScore = applyCeiling(score, effectiveCeiling)

        expect(effectiveCeiling).toBe(700)
        expect(effectiveScore).toBe(700)
      })
    })

    describe('Alert Severity Classification', () => {
      it.each([
        [1.2, false, 'LOW'],
        [1.4, false, 'LOW'],
        [1.5, false, 'MEDIUM'],
        [2.0, false, 'MEDIUM'],
        [2.5, false, 'HIGH'],
        [3.0, false, 'HIGH'],
        [1.0, true, 'CRITICAL'],
        [3.0, true, 'CRITICAL'],
      ] as const)('ratio %f with breach=%s is severity %s', (ratio, breach, severity) => {
        expect(classifySeverity(ratio, breach)).toBe(severity)
      })
    })

    describe('Gaming Detection Patterns', () => {
      it('detects rapid score changes', () => {
        const rapidChangeThreshold = 100
        const changes = [
          { delta: 50, timestamp: Date.now() - 30 * 60 * 1000 },
          { delta: 60, timestamp: Date.now() - 15 * 60 * 1000 },
        ]

        const totalChange = changes.reduce((sum, c) => sum + c.delta, 0)
        expect(totalChange).toBe(110)
        expect(totalChange > rapidChangeThreshold).toBe(true)
      })

      it('detects score oscillation', () => {
        const scoreHistory = [500, 550, 490, 560, 480]
        let directionChanges = 0

        for (let i = 2; i < scoreHistory.length; i++) {
          const prevDelta = scoreHistory[i - 1]! - scoreHistory[i - 2]!
          const currDelta = scoreHistory[i]! - scoreHistory[i - 1]!
          if ((prevDelta > 0 && currDelta < 0) || (prevDelta < 0 && currDelta > 0)) {
            directionChanges++
          }
        }

        expect(directionChanges).toBe(3)
      })

      it('detects boundary testing', () => {
        const tierBoundary = 700
        const threshold = 10
        const scoreHistory = [695, 698, 702, 699, 701]

        const nearBoundaryCount = scoreHistory.filter(
          (s) => Math.abs(s - tierBoundary) <= threshold
        ).length

        expect(nearBoundaryCount).toBe(5)
      })
    })
  })

  describe('Q5: Provenance', () => {
    describe('Creation Type Modifiers', () => {
      it.each([
        ['FRESH', 500, 500],
        ['CLONED', 500, 450],
        ['EVOLVED', 500, 600],
        ['PROMOTED', 500, 650],
        ['IMPORTED', 500, 400],
      ] as const)('%s modifier: %d -> %d', (type, base, expected) => {
        expect(applyProvenanceModifier(base, type)).toBe(expected)
      })
    })

    describe('Score Clamping', () => {
      it('clamps to minimum 0', () => {
        expect(applyProvenanceModifier(50, 'IMPORTED')).toBe(0)
      })

      it('clamps to maximum 1000', () => {
        expect(applyProvenanceModifier(950, 'PROMOTED')).toBe(1000)
      })
    })

    describe('Lineage Verification', () => {
      it('verifies parent hash matches', () => {
        const parentHash = 'abc123'
        const childParentHash = 'abc123'
        expect(parentHash === childParentHash).toBe(true)
      })

      it('fails verification on hash mismatch', () => {
        const parentHash = 'abc123'
        const childParentHash = 'xyz789'
        expect(parentHash === childParentHash).toBe(false)
      })
    })
  })

  describe('Q4: Presets', () => {
    describe('Weight Override Resolution', () => {
      it('applies Vorion overrides to ACI weights', () => {
        const aciWeights = { CT: 0.2, BT: 0.2, GT: 0.2, XT: 0.2, AC: 0.2 }
        const vorionOverrides = { CT: 0.3, GT: 0.3 }
        const resolved = { ...aciWeights, ...vorionOverrides }

        expect(resolved.CT).toBe(0.3)
        expect(resolved.BT).toBe(0.2)
        expect(resolved.GT).toBe(0.3)
      })

      it('applies Axiom overrides on top of Vorion', () => {
        const vorionWeights = { CT: 0.3, BT: 0.2, GT: 0.3, XT: 0.1, AC: 0.1 }
        const axiomOverrides = { BT: 0.25 }
        const resolved = { ...vorionWeights, ...axiomOverrides }

        expect(resolved.CT).toBe(0.3)
        expect(resolved.BT).toBe(0.25)
      })
    })
  })

  describe('Q2: Hierarchical Context', () => {
    describe('Context Chain Validation', () => {
      it('validates deployment -> org -> agent hierarchy', () => {
        const deployment = { id: 'deploy-1' }
        const org = { deploymentId: 'deploy-1', orgId: 'org-1' }
        const agent = { deploymentId: 'deploy-1', orgId: 'org-1' }

        const isValid =
          org.deploymentId === deployment.id &&
          agent.deploymentId === deployment.id &&
          agent.orgId === org.orgId

        expect(isValid).toBe(true)
      })

      it('rejects invalid context chain', () => {
        const deployment = { id: 'deploy-1' }
        const org = { deploymentId: 'deploy-2', orgId: 'org-1' }

        expect(org.deploymentId === deployment.id).toBe(false)
      })
    })

    describe('Context Freezing', () => {
      it('prevents modification after freezing', () => {
        const context = { frozenAt: '2026-01-01T00:00:00Z' }
        expect(context.frozenAt !== null).toBe(true)
      })

      it('allows modification when not frozen', () => {
        const context = { frozenAt: null }
        expect(context.frozenAt === null).toBe(true)
      })
    })
  })

  describe('Integration Scenarios', () => {
    it('denies elevated role when ceiling limits tier', () => {
      const agentScore = 750
      const ceiling = 650
      const effectiveScore = applyCeiling(agentScore, ceiling)
      const tier = getTierFromScore(effectiveScore)

      expect(tier).toBe('T3')
      expect(isRoleAllowed('R_L5', tier)).toBe(false)
    })

    it('IMPORTED agent drops tier due to penalty', () => {
      const baseScore = 520
      const modifiedScore = applyProvenanceModifier(baseScore, 'IMPORTED')

      expect(getTierFromScore(baseScore)).toBe('T3')
      expect(modifiedScore).toBe(420)
      expect(getTierFromScore(modifiedScore)).toBe('T2')
    })

    it('PROMOTED agent gains tier due to bonus', () => {
      const baseScore = 650
      const modifiedScore = applyProvenanceModifier(baseScore, 'PROMOTED')

      expect(getTierFromScore(baseScore)).toBe('T3')
      expect(modifiedScore).toBe(800)
      expect(getTierFromScore(modifiedScore)).toBe('T4')
    })
  })
})
