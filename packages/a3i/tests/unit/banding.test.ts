import { describe, it, expect, beforeEach } from 'vitest';
import {
  TrustBand,
  getBand,
  getBandRange,
  getBandName,
  getNextBand,
  getPreviousBand,
  isHigherBand,
  BAND_DESCRIPTIONS,
} from '../../src/banding/bands.js';
import {
  HysteresisCalculator,
  createHysteresisCalculator,
  type BandHistoryEntry,
} from '../../src/banding/hysteresis.js';
import {
  BandCalculator,
  createBandCalculator,
  TransitionType,
} from '../../src/banding/band-calculator.js';

describe('Trust Bands', () => {
  describe('getBand', () => {
    it('should map scores to correct bands', () => {
      expect(getBand(10)).toBe(TrustBand.T0_UNTRUSTED);
      expect(getBand(30)).toBe(TrustBand.T1_SUPERVISED);
      expect(getBand(50)).toBe(TrustBand.T2_CONSTRAINED);
      expect(getBand(65)).toBe(TrustBand.T3_TRUSTED);
      expect(getBand(80)).toBe(TrustBand.T4_AUTONOMOUS);
      expect(getBand(95)).toBe(TrustBand.T5_MISSION_CRITICAL);
    });

    it('should handle boundary values', () => {
      expect(getBand(0)).toBe(TrustBand.T0_UNTRUSTED);
      expect(getBand(20)).toBe(TrustBand.T0_UNTRUSTED);
      expect(getBand(21)).toBe(TrustBand.T1_SUPERVISED);
      expect(getBand(100)).toBe(TrustBand.T5_MISSION_CRITICAL);
    });
  });

  describe('getBandRange', () => {
    it('should return correct range for each band', () => {
      expect(getBandRange(TrustBand.T0_UNTRUSTED)).toEqual({ min: 0, max: 20 });
      expect(getBandRange(TrustBand.T3_TRUSTED)).toEqual({ min: 56, max: 70 });
      expect(getBandRange(TrustBand.T5_MISSION_CRITICAL)).toEqual({ min: 86, max: 100 });
    });
  });

  describe('getBandName', () => {
    it('should return human-readable names', () => {
      expect(getBandName(TrustBand.T0_UNTRUSTED)).toBe('Untrusted');
      expect(getBandName(TrustBand.T5_MISSION_CRITICAL)).toBe('Mission Critical');
    });
  });

  describe('getNextBand', () => {
    it('should return next band', () => {
      expect(getNextBand(TrustBand.T2_CONSTRAINED)).toBe(TrustBand.T3_TRUSTED);
      expect(getNextBand(TrustBand.T5_MISSION_CRITICAL)).toBe(null);
    });
  });

  describe('getPreviousBand', () => {
    it('should return previous band', () => {
      expect(getPreviousBand(TrustBand.T3_TRUSTED)).toBe(TrustBand.T2_CONSTRAINED);
      expect(getPreviousBand(TrustBand.T0_UNTRUSTED)).toBe(null);
    });
  });

  describe('isHigherBand', () => {
    it('should compare bands correctly', () => {
      expect(isHigherBand(TrustBand.T4_AUTONOMOUS, TrustBand.T2_CONSTRAINED)).toBe(true);
      expect(isHigherBand(TrustBand.T1_SUPERVISED, TrustBand.T3_TRUSTED)).toBe(false);
    });
  });

  describe('BAND_DESCRIPTIONS', () => {
    it('should have descriptions for all bands', () => {
      for (const band of Object.values(TrustBand).filter(v => typeof v === 'number')) {
        expect(BAND_DESCRIPTIONS[band as TrustBand]).toBeDefined();
        expect(BAND_DESCRIPTIONS[band as TrustBand].name).toBeDefined();
        expect(BAND_DESCRIPTIONS[band as TrustBand].typicalCapabilities.length).toBeGreaterThan(0);
      }
    });
  });
});

describe('Hysteresis', () => {
  let hysteresis: HysteresisCalculator;

  beforeEach(() => {
    hysteresis = createHysteresisCalculator({ hysteresis: 3 });
  });

  describe('calculateBandWithHysteresis', () => {
    it('should prevent oscillation near thresholds', () => {
      // Score of 42 is just above T1 max (40), but within hysteresis of 3
      // Should stay at T1 if currently T1
      const result = hysteresis.calculateBandWithHysteresis(
        TrustBand.T1_SUPERVISED,
        42
      );
      expect(result).toBe(TrustBand.T1_SUPERVISED);
    });

    it('should allow transitions outside hysteresis zone', () => {
      // Score of 50 is well above T1 max (40) + hysteresis (3)
      const result = hysteresis.calculateBandWithHysteresis(
        TrustBand.T1_SUPERVISED,
        50
      );
      expect(result).toBe(TrustBand.T2_CONSTRAINED);
    });

    it('should prevent demotion in hysteresis zone', () => {
      // Score of 53 is within T2 range but close to T1
      // With hysteresis, should stay T2 if T2 min is 41
      const result = hysteresis.calculateBandWithHysteresis(
        TrustBand.T2_CONSTRAINED,
        40
      );
      expect(result).toBe(TrustBand.T2_CONSTRAINED);
    });
  });

  describe('canPromoteByTime', () => {
    it('should require minimum days at band', () => {
      const history: BandHistoryEntry[] = [
        {
          band: TrustBand.T2_CONSTRAINED,
          score: 50,
          timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        },
      ];

      const result = hysteresis.canPromoteByTime(history, TrustBand.T3_TRUSTED);
      expect(result.allowed).toBe(false);
      expect(result.daysAtCurrentBand).toBe(3);
      expect(result.daysRequired).toBe(7); // Default promotion delay
    });

    it('should allow promotion after sufficient time', () => {
      const history: BandHistoryEntry[] = [
        {
          band: TrustBand.T2_CONSTRAINED,
          score: 50,
          timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
        },
      ];

      const result = hysteresis.canPromoteByTime(history, TrustBand.T3_TRUSTED);
      expect(result.allowed).toBe(true);
    });
  });

  describe('getPromotionThreshold', () => {
    it('should return correct threshold', () => {
      // T2 max is 55, hysteresis is 3, so threshold is 58
      const threshold = hysteresis.getPromotionThreshold(TrustBand.T2_CONSTRAINED);
      expect(threshold).toBe(58);
    });

    it('should return null for max band', () => {
      expect(hysteresis.getPromotionThreshold(TrustBand.T5_MISSION_CRITICAL)).toBe(null);
    });
  });

  describe('getDemotionThreshold', () => {
    it('should return correct threshold', () => {
      // T2 min is 41, hysteresis is 3, so threshold is 38
      const threshold = hysteresis.getDemotionThreshold(TrustBand.T2_CONSTRAINED);
      expect(threshold).toBe(38);
    });

    it('should return null for min band', () => {
      expect(hysteresis.getDemotionThreshold(TrustBand.T0_UNTRUSTED)).toBe(null);
    });
  });
});

describe('BandCalculator', () => {
  let calculator: BandCalculator;

  beforeEach(() => {
    calculator = createBandCalculator({ promotionDelay: 7, hysteresis: 3 });
  });

  describe('evaluateTransition', () => {
    it('should allow immediate demotion', () => {
      calculator.recordScoreSnapshot('agent-1', TrustBand.T3_TRUSTED, 65);

      const result = calculator.evaluateTransition(
        'agent-1',
        TrustBand.T3_TRUSTED,
        35 // Clear demotion
      );

      expect(result.allowed).toBe(true);
      expect(result.transitionType).toBe(TransitionType.DEMOTION);
      expect(result.newBand).toBeLessThan(TrustBand.T3_TRUSTED);
    });

    it('should block promotion without time requirement', () => {
      // Record that agent just entered T2
      calculator.recordScoreSnapshot('agent-1', TrustBand.T2_CONSTRAINED, 50);

      const result = calculator.evaluateTransition(
        'agent-1',
        TrustBand.T2_CONSTRAINED,
        65 // Would be T3
      );

      expect(result.allowed).toBe(false);
      expect(result.transitionType).toBe(TransitionType.PROMOTION);
      expect(result.daysUntilPromotion).toBeGreaterThan(0);
    });

    it('should allow promotion after time requirement', () => {
      // Record that agent has been at T2 for 10 days
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      calculator.recordScoreSnapshot('agent-1', TrustBand.T2_CONSTRAINED, 50, tenDaysAgo);

      const result = calculator.evaluateTransition(
        'agent-1',
        TrustBand.T2_CONSTRAINED,
        65 // Clear promotion
      );

      expect(result.allowed).toBe(true);
      expect(result.transitionType).toBe(TransitionType.PROMOTION);
      expect(result.newBand).toBe(TrustBand.T3_TRUSTED);
    });

    it('should block transition within hysteresis zone', () => {
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      calculator.recordScoreSnapshot('agent-1', TrustBand.T2_CONSTRAINED, 50, tenDaysAgo);

      // Score of 57 is above T2 max (55) but within hysteresis (3)
      const result = calculator.evaluateTransition(
        'agent-1',
        TrustBand.T2_CONSTRAINED,
        57
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('hysteresis');
    });
  });

  describe('calculateStability', () => {
    it('should calculate stability metrics', () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      calculator.recordScoreSnapshot('agent-1', TrustBand.T3_TRUSTED, 65, thirtyDaysAgo);

      const stability = calculator.calculateStability('agent-1');

      expect(stability.currentBand).toBe(TrustBand.T3_TRUSTED);
      expect(stability.daysAtBand).toBeGreaterThanOrEqual(29);
      expect(stability.recentTransitions).toBe(0);
      expect(stability.stable).toBe(true);
    });

    it('should detect unstable agents', () => {
      const now = new Date();

      // Simulate multiple transitions
      calculator.recordScoreSnapshot('agent-1', TrustBand.T2_CONSTRAINED, 50, new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000));
      calculator.recordScoreSnapshot('agent-1', TrustBand.T3_TRUSTED, 60, new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000));
      calculator.recordScoreSnapshot('agent-1', TrustBand.T2_CONSTRAINED, 45, new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000));
      calculator.recordScoreSnapshot('agent-1', TrustBand.T3_TRUSTED, 65, new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000));

      const stability = calculator.calculateStability('agent-1', now);

      expect(stability.recentTransitions).toBeGreaterThan(0);
      expect(stability.stabilityScore).toBeLessThan(0.7);
    });
  });

  describe('getTransitionEvents', () => {
    it('should record transition events', () => {
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      calculator.recordScoreSnapshot('agent-1', TrustBand.T3_TRUSTED, 65, tenDaysAgo);

      // Force a demotion
      calculator.evaluateTransition('agent-1', TrustBand.T3_TRUSTED, 25);

      const events = calculator.getTransitionEvents('agent-1');
      expect(events.length).toBe(1);
      expect(events[0]!.transitionType).toBe(TransitionType.DEMOTION);
    });
  });
});
