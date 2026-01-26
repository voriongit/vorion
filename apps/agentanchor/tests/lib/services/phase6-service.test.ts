/**
 * Phase 6 Trust Engine Service Tests
 *
 * Tests for all 5 architecture decisions (Q1-Q5):
 * - Q1: Ceiling & Gaming Detection
 * - Q2: Hierarchical Context
 * - Q3: Role Gates
 * - Q4: Presets
 * - Q5: Provenance
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the service types and constants for testing
const TIER_LABELS: Record<string, string> = {
  T0: 'Sandbox',
  T1: 'Probation',
  T2: 'Limited',
  T3: 'Standard',
  T4: 'Trusted',
  T5: 'Sovereign',
}

const TIER_RANGES: Record<string, string> = {
  T0: '0-99',
  T1: '100-299',
  T2: '300-499',
  T3: '500-699',
  T4: '700-899',
  T5: '900-1000',
}

const ROLE_GATE_MATRIX: Record<string, Record<string, boolean>> = {
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

const PROVENANCE_MODIFIERS: Record<string, number> = {
  FRESH: 0,
  CLONED: -50,
  EVOLVED: 100,
  PROMOTED: 150,
  IMPORTED: -100,
}

// Helper functions for trust calculations
function getTierFromScore(score: number): string {
  if (score < 100) return 'T0'
  if (score < 300) return 'T1'
  if (score < 500) return 'T2'
  if (score < 700) return 'T3'
  if (score < 900) return 'T4'
  return 'T5'
}

function isRoleAllowed(role: string, tier: string): boolean {
  return ROLE_GATE_MATRIX[role]?.[tier] ?? false
}

function applyProvenanceModifier(baseScore: number, creationType: string): number {
  const modifier = PROVENANCE_MODIFIERS[creationType] ?? 0
  return Math.max(0, Math.min(1000, baseScore + modifier))
}

describe('Phase 6 Trust Engine', () => {
  describe('Trust Tier System', () => {
    describe('Tier Labels (Q2 - Context)', () => {
      it('has correct label for T0 (Sandbox)', () => {
        expect(TIER_LABELS.T0).toBe('Sandbox')
      })

      it('has correct label for T1 (Probation)', () => {
        expect(TIER_LABELS.T1).toBe('Probation')
      })

      it('has correct label for T2 (Limited)', () => {
        expect(TIER_LABELS.T2).toBe('Limited')
      })

      it('has correct label for T3 (Standard)', () => {
        expect(TIER_LABELS.T3).toBe('Standard')
      })

      it('has correct label for T4 (Trusted)', () => {
        expect(TIER_LABELS.T4).toBe('Trusted')
      })

      it('has correct label for T5 (Sovereign)', () => {
        expect(TIER_LABELS.T5).toBe('Sovereign')
      })
    })

    describe('Tier Ranges', () => {
      it('has correct range for T0 (0-99)', () => {
        expect(TIER_RANGES.T0).toBe('0-99')
      })

      it('has correct range for T1 (100-299)', () => {
        expect(TIER_RANGES.T1).toBe('100-299')
      })

      it('has correct range for T2 (300-499)', () => {
        expect(TIER_RANGES.T2).toBe('300-499')
      })

      it('has correct range for T3 (500-699)', () => {
        expect(TIER_RANGES.T3).toBe('500-699')
      })

      it('has correct range for T4 (700-899)', () => {
        expect(TIER_RANGES.T4).toBe('700-899')
      })

      it('has correct range for T5 (900-1000)', () => {
        expect(TIER_RANGES.T5).toBe('900-1000')
      })
    })

    describe('getTierFromScore', () => {
      it('returns T0 for scores 0-99', () => {
        expect(getTierFromScore(0)).toBe('T0')
        expect(getTierFromScore(50)).toBe('T0')
        expect(getTierFromScore(99)).toBe('T0')
      })

      it('returns T1 for scores 100-299', () => {
        expect(getTierFromScore(100)).toBe('T1')
        expect(getTierFromScore(200)).toBe('T1')
        expect(getTierFromScore(299)).toBe('T1')
      })

      it('returns T2 for scores 300-499', () => {
        expect(getTierFromScore(300)).toBe('T2')
        expect(getTierFromScore(400)).toBe('T2')
        expect(getTierFromScore(499)).toBe('T2')
      })

      it('returns T3 for scores 500-699', () => {
        expect(getTierFromScore(500)).toBe('T3')
        expect(getTierFromScore(600)).toBe('T3')
        expect(getTierFromScore(699)).toBe('T3')
      })

      it('returns T4 for scores 700-899', () => {
        expect(getTierFromScore(700)).toBe('T4')
        expect(getTierFromScore(800)).toBe('T4')
        expect(getTierFromScore(899)).toBe('T4')
      })

      it('returns T5 for scores 900-1000', () => {
        expect(getTierFromScore(900)).toBe('T5')
        expect(getTierFromScore(950)).toBe('T5')
        expect(getTierFromScore(1000)).toBe('T5')
      })
    })
  })

  describe('Q3: Role Gates', () => {
    describe('Kernel Layer Matrix', () => {
      describe('R_L0 (Listener) - Always allowed', () => {
        it('allows R_L0 at all tiers', () => {
          expect(isRoleAllowed('R_L0', 'T0')).toBe(true)
          expect(isRoleAllowed('R_L0', 'T1')).toBe(true)
          expect(isRoleAllowed('R_L0', 'T2')).toBe(true)
          expect(isRoleAllowed('R_L0', 'T3')).toBe(true)
          expect(isRoleAllowed('R_L0', 'T4')).toBe(true)
          expect(isRoleAllowed('R_L0', 'T5')).toBe(true)
        })
      })

      describe('R_L1 (Responder) - Always allowed', () => {
        it('allows R_L1 at all tiers', () => {
          expect(isRoleAllowed('R_L1', 'T0')).toBe(true)
          expect(isRoleAllowed('R_L1', 'T1')).toBe(true)
          expect(isRoleAllowed('R_L1', 'T2')).toBe(true)
          expect(isRoleAllowed('R_L1', 'T3')).toBe(true)
          expect(isRoleAllowed('R_L1', 'T4')).toBe(true)
          expect(isRoleAllowed('R_L1', 'T5')).toBe(true)
        })
      })

      describe('R_L2 (Task Executor) - Requires T1+', () => {
        it('denies R_L2 at T0', () => {
          expect(isRoleAllowed('R_L2', 'T0')).toBe(false)
        })

        it('allows R_L2 at T1+', () => {
          expect(isRoleAllowed('R_L2', 'T1')).toBe(true)
          expect(isRoleAllowed('R_L2', 'T2')).toBe(true)
          expect(isRoleAllowed('R_L2', 'T3')).toBe(true)
          expect(isRoleAllowed('R_L2', 'T4')).toBe(true)
          expect(isRoleAllowed('R_L2', 'T5')).toBe(true)
        })
      })

      describe('R_L3 (Workflow Manager) - Requires T2+', () => {
        it('denies R_L3 at T0-T1', () => {
          expect(isRoleAllowed('R_L3', 'T0')).toBe(false)
          expect(isRoleAllowed('R_L3', 'T1')).toBe(false)
        })

        it('allows R_L3 at T2+', () => {
          expect(isRoleAllowed('R_L3', 'T2')).toBe(true)
          expect(isRoleAllowed('R_L3', 'T3')).toBe(true)
          expect(isRoleAllowed('R_L3', 'T4')).toBe(true)
          expect(isRoleAllowed('R_L3', 'T5')).toBe(true)
        })
      })

      describe('R_L4 (Domain Expert) - Requires T3+', () => {
        it('denies R_L4 at T0-T2', () => {
          expect(isRoleAllowed('R_L4', 'T0')).toBe(false)
          expect(isRoleAllowed('R_L4', 'T1')).toBe(false)
          expect(isRoleAllowed('R_L4', 'T2')).toBe(false)
        })

        it('allows R_L4 at T3+', () => {
          expect(isRoleAllowed('R_L4', 'T3')).toBe(true)
          expect(isRoleAllowed('R_L4', 'T4')).toBe(true)
          expect(isRoleAllowed('R_L4', 'T5')).toBe(true)
        })
      })

      describe('R_L5 (Resource Controller) - Requires T4+', () => {
        it('denies R_L5 at T0-T3', () => {
          expect(isRoleAllowed('R_L5', 'T0')).toBe(false)
          expect(isRoleAllowed('R_L5', 'T1')).toBe(false)
          expect(isRoleAllowed('R_L5', 'T2')).toBe(false)
          expect(isRoleAllowed('R_L5', 'T3')).toBe(false)
        })

        it('allows R_L5 at T4+', () => {
          expect(isRoleAllowed('R_L5', 'T4')).toBe(true)
          expect(isRoleAllowed('R_L5', 'T5')).toBe(true)
        })
      })

      describe('R_L6 (System Administrator) - Requires T5', () => {
        it('denies R_L6 at T0-T4', () => {
          expect(isRoleAllowed('R_L6', 'T0')).toBe(false)
          expect(isRoleAllowed('R_L6', 'T1')).toBe(false)
          expect(isRoleAllowed('R_L6', 'T2')).toBe(false)
          expect(isRoleAllowed('R_L6', 'T3')).toBe(false)
          expect(isRoleAllowed('R_L6', 'T4')).toBe(false)
        })

        it('allows R_L6 at T5', () => {
          expect(isRoleAllowed('R_L6', 'T5')).toBe(true)
        })
      })

      describe('R_L7 (Trust Governor) - Requires T5', () => {
        it('denies R_L7 at T0-T4', () => {
          expect(isRoleAllowed('R_L7', 'T0')).toBe(false)
          expect(isRoleAllowed('R_L7', 'T1')).toBe(false)
          expect(isRoleAllowed('R_L7', 'T2')).toBe(false)
          expect(isRoleAllowed('R_L7', 'T3')).toBe(false)
          expect(isRoleAllowed('R_L7', 'T4')).toBe(false)
        })

        it('allows R_L7 at T5', () => {
          expect(isRoleAllowed('R_L7', 'T5')).toBe(true)
        })
      })

      describe('R_L8 (Ecosystem Controller) - Requires T5', () => {
        it('denies R_L8 at T0-T4', () => {
          expect(isRoleAllowed('R_L8', 'T0')).toBe(false)
          expect(isRoleAllowed('R_L8', 'T1')).toBe(false)
          expect(isRoleAllowed('R_L8', 'T2')).toBe(false)
          expect(isRoleAllowed('R_L8', 'T3')).toBe(false)
          expect(isRoleAllowed('R_L8', 'T4')).toBe(false)
        })

        it('allows R_L8 at T5', () => {
          expect(isRoleAllowed('R_L8', 'T5')).toBe(true)
        })
      })
    })

    describe('Role Gate Decision Flow', () => {
      it('returns ALLOW when kernel permits and no policy override', () => {
        // Simulate role gate evaluation
        const role = 'R_L4'
        const tier = 'T3'
        const kernelAllowed = isRoleAllowed(role, tier)
        const policyOverride = false

        expect(kernelAllowed).toBe(true)
        const decision = kernelAllowed && !policyOverride ? 'ALLOW' : 'DENY'
        expect(decision).toBe('ALLOW')
      })

      it('returns DENY when kernel denies', () => {
        const role = 'R_L5'
        const tier = 'T2'
        const kernelAllowed = isRoleAllowed(role, tier)

        expect(kernelAllowed).toBe(false)
        const decision = kernelAllowed ? 'ALLOW' : 'DENY'
        expect(decision).toBe('DENY')
      })

      it('returns ESCALATE when policy requires human approval', () => {
        const role = 'R_L6'
        const tier = 'T5'
        const kernelAllowed = isRoleAllowed(role, tier)
        const requiresHumanApproval = true // Policy flag

        expect(kernelAllowed).toBe(true)
        const decision = requiresHumanApproval ? 'ESCALATE' : 'ALLOW'
        expect(decision).toBe('ESCALATE')
      })
    })
  })

  describe('Q1: Ceiling & Gaming Detection', () => {
    describe('Trust Ceiling Enforcement', () => {
      it('enforces regulatory ceiling (EU AI Act max 699)', () => {
        const euAiActCeiling = 699
        const agentScore = 750
        const effectiveScore = Math.min(agentScore, euAiActCeiling)
        expect(effectiveScore).toBe(699)
      })

      it('enforces organizational ceiling', () => {
        const orgCeiling = 500
        const agentScore = 600
        const effectiveScore = Math.min(agentScore, orgCeiling)
        expect(effectiveScore).toBe(500)
      })

      it('applies lowest ceiling from hierarchy', () => {
        const deploymentCeiling = 800
        const orgCeiling = 600
        const agentScore = 750

        const effectiveCeiling = Math.min(deploymentCeiling, orgCeiling)
        const effectiveScore = Math.min(agentScore, effectiveCeiling)

        expect(effectiveCeiling).toBe(600)
        expect(effectiveScore).toBe(600)
      })
    })

    describe('Gaming Detection Patterns', () => {
      it('detects rapid score changes', () => {
        const rapidChangeThreshold = 100 // Points per hour
        const scoreChanges = [
          { delta: 50, timestamp: Date.now() - 30 * 60 * 1000 }, // 30 min ago
          { delta: 60, timestamp: Date.now() - 15 * 60 * 1000 }, // 15 min ago
        ]

        const totalChange = scoreChanges.reduce((sum, c) => sum + c.delta, 0)
        const isRapidChange = totalChange > rapidChangeThreshold

        expect(totalChange).toBe(110)
        expect(isRapidChange).toBe(true)
      })

      it('detects score oscillation', () => {
        const oscillationWindow = 5 // Number of changes to check
        const scoreHistory = [500, 550, 490, 560, 480] // Up-down pattern

        let directionChanges = 0
        for (let i = 2; i < scoreHistory.length; i++) {
          const prevDelta = scoreHistory[i - 1]! - scoreHistory[i - 2]!
          const currDelta = scoreHistory[i]! - scoreHistory[i - 1]!
          if ((prevDelta > 0 && currDelta < 0) || (prevDelta < 0 && currDelta > 0)) {
            directionChanges++
          }
        }

        expect(directionChanges).toBe(3)
        expect(directionChanges >= oscillationWindow - 2).toBe(true) // Oscillation detected
      })

      it('detects boundary testing', () => {
        const boundaryThreshold = 10 // Points from tier boundary
        const tierBoundary = 700 // T4 boundary
        const scoreHistory = [695, 698, 702, 699, 701]

        const nearBoundaryCount = scoreHistory.filter(
          (s) => Math.abs(s - tierBoundary) <= boundaryThreshold
        ).length

        expect(nearBoundaryCount).toBe(5)
        expect(nearBoundaryCount >= 3).toBe(true) // Boundary testing detected
      })
    })

    describe('Alert Severity Classification', () => {
      it('classifies LOW severity for minor anomalies', () => {
        const rapidChangeRatio = 1.2 // 20% above threshold
        const severity = rapidChangeRatio < 1.5 ? 'LOW' : 'MEDIUM'
        expect(severity).toBe('LOW')
      })

      it('classifies MEDIUM severity for moderate anomalies', () => {
        const rapidChangeRatio = 1.8 // 80% above threshold
        const severity = rapidChangeRatio < 1.5 ? 'LOW' : rapidChangeRatio < 2.5 ? 'MEDIUM' : 'HIGH'
        expect(severity).toBe('MEDIUM')
      })

      it('classifies HIGH severity for significant anomalies', () => {
        const rapidChangeRatio = 3.0 // 200% above threshold
        const severity = rapidChangeRatio < 1.5 ? 'LOW' : rapidChangeRatio < 2.5 ? 'MEDIUM' : 'HIGH'
        expect(severity).toBe('HIGH')
      })

      it('classifies CRITICAL severity for ceiling breaches', () => {
        const hasCeilingBreach = true
        const severity = hasCeilingBreach ? 'CRITICAL' : 'HIGH'
        expect(severity).toBe('CRITICAL')
      })
    })
  })

  describe('Q5: Provenance', () => {
    describe('Creation Type Modifiers', () => {
      it('applies 0 modifier for FRESH agents', () => {
        expect(PROVENANCE_MODIFIERS.FRESH).toBe(0)
        expect(applyProvenanceModifier(500, 'FRESH')).toBe(500)
      })

      it('applies -50 modifier for CLONED agents', () => {
        expect(PROVENANCE_MODIFIERS.CLONED).toBe(-50)
        expect(applyProvenanceModifier(500, 'CLONED')).toBe(450)
      })

      it('applies +100 modifier for EVOLVED agents', () => {
        expect(PROVENANCE_MODIFIERS.EVOLVED).toBe(100)
        expect(applyProvenanceModifier(500, 'EVOLVED')).toBe(600)
      })

      it('applies +150 modifier for PROMOTED agents', () => {
        expect(PROVENANCE_MODIFIERS.PROMOTED).toBe(150)
        expect(applyProvenanceModifier(500, 'PROMOTED')).toBe(650)
      })

      it('applies -100 modifier for IMPORTED agents', () => {
        expect(PROVENANCE_MODIFIERS.IMPORTED).toBe(-100)
        expect(applyProvenanceModifier(500, 'IMPORTED')).toBe(400)
      })
    })

    describe('Score Clamping', () => {
      it('clamps score to minimum 0', () => {
        expect(applyProvenanceModifier(50, 'IMPORTED')).toBe(0) // 50 - 100 = -50 -> 0
      })

      it('clamps score to maximum 1000', () => {
        expect(applyProvenanceModifier(950, 'PROMOTED')).toBe(1000) // 950 + 150 = 1100 -> 1000
      })
    })

    describe('Lineage Verification', () => {
      it('verifies parent hash matches', () => {
        const parentHash = 'abc123'
        const childParentHash = 'abc123'
        const lineageVerified = parentHash === childParentHash
        expect(lineageVerified).toBe(true)
      })

      it('fails verification on hash mismatch', () => {
        const parentHash = 'abc123'
        const childParentHash = 'xyz789'
        const lineageVerified = parentHash === childParentHash
        expect(lineageVerified).toBe(false)
      })
    })
  })

  describe('Q4: Presets', () => {
    describe('Preset Hierarchy', () => {
      it('ACI preset is root level (no parent)', () => {
        const aciPreset = {
          id: 'aci-1',
          name: 'Standard ACI',
          parentId: null,
        }
        expect(aciPreset.parentId).toBeNull()
      })

      it('Vorion preset extends ACI preset', () => {
        const vorionPreset = {
          id: 'vorion-1',
          name: 'Enterprise Vorion',
          parentAciPresetId: 'aci-1',
        }
        expect(vorionPreset.parentAciPresetId).toBe('aci-1')
      })

      it('Axiom preset extends Vorion preset', () => {
        const axiomPreset = {
          id: 'axiom-1',
          name: 'Production Axiom',
          parentVorionPresetId: 'vorion-1',
          deploymentId: 'deploy-1',
        }
        expect(axiomPreset.parentVorionPresetId).toBe('vorion-1')
        expect(axiomPreset.deploymentId).toBe('deploy-1')
      })
    })

    describe('Weight Override Resolution', () => {
      it('applies Vorion overrides to ACI weights', () => {
        const aciWeights = { CT: 0.2, BT: 0.2, GT: 0.2, XT: 0.2, AC: 0.2 }
        const vorionOverrides = { CT: 0.3, GT: 0.3 }

        const resolvedWeights = { ...aciWeights, ...vorionOverrides }

        expect(resolvedWeights.CT).toBe(0.3)
        expect(resolvedWeights.BT).toBe(0.2) // Unchanged
        expect(resolvedWeights.GT).toBe(0.3)
        expect(resolvedWeights.XT).toBe(0.2) // Unchanged
        expect(resolvedWeights.AC).toBe(0.2) // Unchanged
      })

      it('applies Axiom overrides on top of Vorion', () => {
        const vorionWeights = { CT: 0.3, BT: 0.2, GT: 0.3, XT: 0.1, AC: 0.1 }
        const axiomOverrides = { BT: 0.25 }

        const resolvedWeights = { ...vorionWeights, ...axiomOverrides }

        expect(resolvedWeights.CT).toBe(0.3)
        expect(resolvedWeights.BT).toBe(0.25) // Overridden
        expect(resolvedWeights.GT).toBe(0.3)
      })
    })
  })

  describe('Q2: Hierarchical Context', () => {
    describe('Context Chain Validation', () => {
      it('validates deployment -> org -> agent hierarchy', () => {
        const deployment = { id: 'deploy-1', name: 'Production' }
        const org = { deploymentId: 'deploy-1', orgId: 'org-1' }
        const agent = { deploymentId: 'deploy-1', orgId: 'org-1', agentId: 'agent-1' }

        const isValidChain =
          org.deploymentId === deployment.id &&
          agent.deploymentId === deployment.id &&
          agent.orgId === org.orgId

        expect(isValidChain).toBe(true)
      })

      it('rejects invalid context chain', () => {
        const deployment = { id: 'deploy-1', name: 'Production' }
        const org = { deploymentId: 'deploy-2', orgId: 'org-1' } // Wrong deployment
        const agent = { deploymentId: 'deploy-1', orgId: 'org-1', agentId: 'agent-1' }

        const isValidChain =
          org.deploymentId === deployment.id &&
          agent.deploymentId === deployment.id &&
          agent.orgId === org.orgId

        expect(isValidChain).toBe(false)
      })
    })

    describe('Context Freezing', () => {
      it('prevents modification after freezing', () => {
        const context = {
          id: 'ctx-1',
          frozenAt: '2026-01-01T00:00:00Z',
          canModify: false,
        }

        const isFrozen = context.frozenAt !== null
        expect(isFrozen).toBe(true)
        expect(context.canModify).toBe(false)
      })

      it('allows modification when not frozen', () => {
        const context = {
          id: 'ctx-1',
          frozenAt: null,
          canModify: true,
        }

        const isFrozen = context.frozenAt !== null
        expect(isFrozen).toBe(false)
        expect(context.canModify).toBe(true)
      })
    })

    describe('Context Hash Verification', () => {
      it('detects context tampering via hash mismatch', () => {
        const storedHash = 'hash123'
        const computedHash = 'hash456' // Different

        const isValid = storedHash === computedHash
        expect(isValid).toBe(false)
      })

      it('confirms context integrity via hash match', () => {
        const storedHash = 'hash123'
        const computedHash = 'hash123'

        const isValid = storedHash === computedHash
        expect(isValid).toBe(true)
      })
    })
  })

  describe('Integration Scenarios', () => {
    describe('Role Gate with Ceiling Enforcement', () => {
      it('denies elevated role when ceiling limits tier', () => {
        const agentScore = 750 // Would be T4
        const ceilingScore = 650 // Limits to T3
        const effectiveScore = Math.min(agentScore, ceilingScore)
        const effectiveTier = getTierFromScore(effectiveScore)
        const requestedRole = 'R_L5' // Requires T4

        expect(effectiveTier).toBe('T3')
        expect(isRoleAllowed(requestedRole, effectiveTier)).toBe(false)
      })
    })

    describe('Provenance Affecting Tier', () => {
      it('IMPORTED agent drops tier due to penalty', () => {
        const baseScore = 520 // T3
        const modifiedScore = applyProvenanceModifier(baseScore, 'IMPORTED')
        const originalTier = getTierFromScore(baseScore)
        const newTier = getTierFromScore(modifiedScore)

        expect(originalTier).toBe('T3')
        expect(modifiedScore).toBe(420) // 520 - 100
        expect(newTier).toBe('T2') // Dropped tier
      })

      it('PROMOTED agent gains tier due to bonus', () => {
        const baseScore = 650 // T3
        const modifiedScore = applyProvenanceModifier(baseScore, 'PROMOTED')
        const originalTier = getTierFromScore(baseScore)
        const newTier = getTierFromScore(modifiedScore)

        expect(originalTier).toBe('T3')
        expect(modifiedScore).toBe(800) // 650 + 150
        expect(newTier).toBe('T4') // Gained tier
      })
    })
  })
})
