/**
 * Trust Service Unit Tests
 * Epic 4: Trust Score System
 */

import { describe, it, expect } from 'vitest'
import {
  TRUST_IMPACTS,
  calculateCouncilDecisionImpact,
  canPerformAction,
} from '@/lib/agents/trust-service'

describe('Trust Service', () => {
  describe('TRUST_IMPACTS', () => {
    describe('Positive impacts (FR51)', () => {
      it('has correct impact for low-risk task success', () => {
        expect(TRUST_IMPACTS.task_success_low.change).toBe(1)
      })

      it('has correct impact for medium-risk task success', () => {
        expect(TRUST_IMPACTS.task_success_medium.change).toBe(2)
      })

      it('has correct impact for high-risk task success', () => {
        expect(TRUST_IMPACTS.task_success_high.change).toBe(5)
      })

      it('has correct impact for council approval', () => {
        expect(TRUST_IMPACTS.council_approval.change).toBe(10)
      })

      it('has correct impact for positive user feedback', () => {
        expect(TRUST_IMPACTS.user_positive_feedback.change).toBe(15)
      })

      it('has correct impact for training milestone', () => {
        expect(TRUST_IMPACTS.training_milestone.change).toBe(20)
      })

      it('has correct impact for examination passed', () => {
        expect(TRUST_IMPACTS.examination_passed.change).toBe(50)
      })

      it('has correct impact for commendation', () => {
        expect(TRUST_IMPACTS.commendation.change).toBe(25)
      })
    })

    describe('Negative impacts (FR52)', () => {
      it('has correct impact for task failure', () => {
        expect(TRUST_IMPACTS.task_failure.change).toBe(-5)
      })

      it('has correct impact for council denial', () => {
        expect(TRUST_IMPACTS.council_denial.change).toBe(-20)
      })

      it('has correct impact for negative user feedback', () => {
        expect(TRUST_IMPACTS.user_negative_feedback.change).toBe(-15)
      })

      it('has correct impact for minor policy violation', () => {
        expect(TRUST_IMPACTS.policy_violation_minor.change).toBe(-25)
      })

      it('has correct impact for major policy violation', () => {
        expect(TRUST_IMPACTS.policy_violation_major.change).toBe(-50)
      })

      it('has correct impact for complaint filed', () => {
        expect(TRUST_IMPACTS.complaint_filed.change).toBe(-30)
      })

      it('has correct impact for suspension', () => {
        expect(TRUST_IMPACTS.suspension.change).toBe(-100)
      })
    })

    describe('Neutral/System impacts', () => {
      it('has correct decay value', () => {
        expect(TRUST_IMPACTS.decay.change).toBe(-1)
      })

      it('has zero change for manual adjustment', () => {
        expect(TRUST_IMPACTS.manual_adjustment.change).toBe(0)
      })

      it('has zero change for graduation', () => {
        expect(TRUST_IMPACTS.graduation.change).toBe(0)
      })
    })
  })

  describe('calculateCouncilDecisionImpact', () => {
    describe('Approved decisions', () => {
      it('returns +2 for low risk approved', () => {
        const result = calculateCouncilDecisionImpact(true, 'low')
        expect(result.change).toBe(2)
        expect(result.reason).toContain('approved')
      })

      it('returns +5 for medium risk approved', () => {
        const result = calculateCouncilDecisionImpact(true, 'medium')
        expect(result.change).toBe(5)
      })

      it('returns +10 for high risk approved', () => {
        const result = calculateCouncilDecisionImpact(true, 'high')
        expect(result.change).toBe(10)
      })

      it('returns +15 for critical risk approved', () => {
        const result = calculateCouncilDecisionImpact(true, 'critical')
        expect(result.change).toBe(15)
      })
    })

    describe('Denied decisions', () => {
      it('returns -5 for low risk denied', () => {
        const result = calculateCouncilDecisionImpact(false, 'low')
        expect(result.change).toBe(-5)
        expect(result.reason).toContain('denied')
      })

      it('returns -15 for medium risk denied', () => {
        const result = calculateCouncilDecisionImpact(false, 'medium')
        expect(result.change).toBe(-15)
      })

      it('returns -30 for high risk denied', () => {
        const result = calculateCouncilDecisionImpact(false, 'high')
        expect(result.change).toBe(-30)
      })

      it('returns -50 for critical risk denied', () => {
        const result = calculateCouncilDecisionImpact(false, 'critical')
        expect(result.change).toBe(-50)
      })
    })
  })

  describe('canPerformAction', () => {
    describe('Low risk actions', () => {
      it('allows novice tier for low risk', () => {
        const result = canPerformAction('novice', 'low')
        expect(result.allowed).toBe(true)
      })

      it('allows proven tier for low risk', () => {
        const result = canPerformAction('proven', 'low')
        expect(result.allowed).toBe(true)
      })

      it('denies untrusted tier for low risk', () => {
        const result = canPerformAction('untrusted', 'low')
        expect(result.allowed).toBe(false)
        expect(result.reason).toContain('Untrusted')
      })
    })

    describe('Medium risk actions', () => {
      it('allows proven tier for medium risk', () => {
        const result = canPerformAction('proven', 'medium')
        expect(result.allowed).toBe(true)
      })

      it('allows trusted tier for medium risk', () => {
        const result = canPerformAction('trusted', 'medium')
        expect(result.allowed).toBe(true)
      })

      it('denies novice tier for medium risk', () => {
        const result = canPerformAction('novice', 'medium')
        expect(result.allowed).toBe(false)
        expect(result.reason).toContain('Proven tier')
      })
    })

    describe('High risk actions', () => {
      it('allows trusted tier for high risk', () => {
        const result = canPerformAction('trusted', 'high')
        expect(result.allowed).toBe(true)
      })

      it('allows elite tier for high risk', () => {
        const result = canPerformAction('elite', 'high')
        expect(result.allowed).toBe(true)
      })

      it('denies proven tier for high risk', () => {
        const result = canPerformAction('proven', 'high')
        expect(result.allowed).toBe(false)
        expect(result.reason).toContain('Trusted tier')
      })
    })

    describe('Critical risk actions', () => {
      it('always denies critical risk even for elite', () => {
        const result = canPerformAction('elite', 'critical')
        expect(result.allowed).toBe(false)
        expect(result.reason).toContain('human approval')
      })

      it('always denies critical risk for legendary', () => {
        const result = canPerformAction('legendary', 'critical')
        expect(result.allowed).toBe(false)
      })

      it('denies and mentions elite requirement for lower tiers', () => {
        const result = canPerformAction('trusted', 'critical')
        expect(result.allowed).toBe(false)
        expect(result.reason).toContain('Elite tier')
      })
    })
  })
})
