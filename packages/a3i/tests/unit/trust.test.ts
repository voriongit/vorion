import { describe, it, expect } from 'vitest';
import {
  createDimensions,
  clampScore,
  isValidDimensions,
  getMinDimension,
  getMaxDimension,
  getDimensionDelta,
  adjustDimensions,
  INITIAL_DIMENSIONS,
} from '../../src/trust/dimensions.js';
import {
  createWeights,
  normalizeWeights,
  isValidWeights,
  weightsAreSummedCorrectly,
  DEFAULT_TRUST_WEIGHTS,
  WEIGHT_PRESETS,
} from '../../src/trust/weights.js';
import {
  calculateCompositeScore,
  applyObservationCeiling,
  calculateTrustProfile,
  createEvidence,
} from '../../src/trust/calculator.js';
import { TrustBand, ObservationTier } from '@orion/contracts';

describe('Trust Dimensions', () => {
  describe('createDimensions', () => {
    it('should create dimensions with initial values', () => {
      const dims = createDimensions();
      expect(dims).toEqual(INITIAL_DIMENSIONS);
    });

    it('should override partial dimensions', () => {
      const dims = createDimensions({ CT: 80 });
      expect(dims.CT).toBe(80);
      expect(dims.BT).toBe(INITIAL_DIMENSIONS.BT);
    });

    it('should clamp values to valid range', () => {
      const dims = createDimensions({ CT: 150, BT: -10 });
      expect(dims.CT).toBe(100);
      expect(dims.BT).toBe(0);
    });
  });

  describe('clampScore', () => {
    it('should clamp high values to 100', () => {
      expect(clampScore(150)).toBe(100);
    });

    it('should clamp low values to 0', () => {
      expect(clampScore(-50)).toBe(0);
    });

    it('should preserve valid values', () => {
      expect(clampScore(75)).toBe(75);
    });
  });

  describe('isValidDimensions', () => {
    it('should return true for valid dimensions', () => {
      expect(isValidDimensions(INITIAL_DIMENSIONS)).toBe(true);
    });

    it('should return false for invalid dimensions', () => {
      expect(isValidDimensions({ CT: 50 })).toBe(false);
      expect(isValidDimensions({ CT: 150, BT: 50, GT: 50, XT: 50, AC: 50 })).toBe(false);
    });
  });

  describe('getMinDimension', () => {
    it('should find the minimum dimension', () => {
      const dims = { CT: 80, BT: 30, GT: 50, XT: 60, AC: 40 };
      const result = getMinDimension(dims);
      expect(result.dimension).toBe('BT');
      expect(result.score).toBe(30);
    });
  });

  describe('getMaxDimension', () => {
    it('should find the maximum dimension', () => {
      const dims = { CT: 80, BT: 30, GT: 50, XT: 60, AC: 40 };
      const result = getMaxDimension(dims);
      expect(result.dimension).toBe('CT');
      expect(result.score).toBe(80);
    });
  });

  describe('getDimensionDelta', () => {
    it('should calculate dimension changes', () => {
      const prev = { CT: 50, BT: 50, GT: 50, XT: 50, AC: 50 };
      const curr = { CT: 60, BT: 40, GT: 50, XT: 55, AC: 45 };
      const delta = getDimensionDelta(prev, curr);

      expect(delta.CT).toBe(10);
      expect(delta.BT).toBe(-10);
      expect(delta.GT).toBe(0);
      expect(delta.XT).toBe(5);
      expect(delta.AC).toBe(-5);
    });
  });

  describe('adjustDimensions', () => {
    it('should apply adjustments', () => {
      const dims = { CT: 50, BT: 50, GT: 50, XT: 50, AC: 50 };
      const result = adjustDimensions(dims, { CT: 20, BT: -10 });

      expect(result.CT).toBe(70);
      expect(result.BT).toBe(40);
      expect(result.GT).toBe(50);
    });

    it('should clamp adjusted values', () => {
      const dims = { CT: 90, BT: 10, GT: 50, XT: 50, AC: 50 };
      const result = adjustDimensions(dims, { CT: 20, BT: -20 });

      expect(result.CT).toBe(100);
      expect(result.BT).toBe(0);
    });
  });
});

describe('Trust Weights', () => {
  describe('createWeights', () => {
    it('should create default weights', () => {
      const weights = createWeights();
      expect(weights).toEqual(DEFAULT_TRUST_WEIGHTS);
    });

    it('should normalize weights that do not sum to 1', () => {
      const weights = createWeights({ CT: 0.5, BT: 0.5 });
      const sum = weights.CT + weights.BT + weights.GT + weights.XT + weights.AC;
      expect(Math.abs(sum - 1)).toBeLessThan(0.001);
    });
  });

  describe('normalizeWeights', () => {
    it('should normalize weights to sum to 1', () => {
      const input = { CT: 2, BT: 2, GT: 2, XT: 2, AC: 2 };
      const result = normalizeWeights(input);
      const sum = result.CT + result.BT + result.GT + result.XT + result.AC;
      expect(Math.abs(sum - 1)).toBeLessThan(0.001);
      expect(result.CT).toBe(0.2);
    });
  });

  describe('isValidWeights', () => {
    it('should validate correct weights', () => {
      expect(isValidWeights(DEFAULT_TRUST_WEIGHTS)).toBe(true);
    });

    it('should reject weights that do not sum to 1', () => {
      const bad = { CT: 0.5, BT: 0.5, GT: 0.5, XT: 0.5, AC: 0.5 };
      expect(isValidWeights(bad)).toBe(false);
    });
  });

  describe('weightsAreSummedCorrectly', () => {
    it('should return true for weights summing to 1', () => {
      expect(weightsAreSummedCorrectly(DEFAULT_TRUST_WEIGHTS)).toBe(true);
    });

    it('should return false for incorrect sums', () => {
      const bad = { CT: 0.1, BT: 0.1, GT: 0.1, XT: 0.1, AC: 0.1 };
      expect(weightsAreSummedCorrectly(bad)).toBe(false);
    });
  });

  describe('WEIGHT_PRESETS', () => {
    it('should have all presets sum to 1', () => {
      for (const [name, weights] of Object.entries(WEIGHT_PRESETS)) {
        expect(weightsAreSummedCorrectly(weights)).toBe(true);
      }
    });
  });
});

describe('Trust Calculator', () => {
  describe('calculateCompositeScore', () => {
    it('should calculate weighted average', () => {
      const dims = { CT: 100, BT: 100, GT: 100, XT: 100, AC: 100 };
      expect(calculateCompositeScore(dims)).toBe(100);
    });

    it('should apply weights correctly', () => {
      const dims = { CT: 100, BT: 0, GT: 0, XT: 0, AC: 0 };
      const weights = { CT: 1.0, BT: 0, GT: 0, XT: 0, AC: 0 };
      expect(calculateCompositeScore(dims, weights)).toBe(100);
    });

    it('should handle mixed scores', () => {
      const dims = { CT: 80, BT: 60, GT: 70, XT: 50, AC: 40 };
      // Using default weights: CT=0.25, BT=0.25, GT=0.20, XT=0.15, AC=0.15
      // = 80*0.25 + 60*0.25 + 70*0.20 + 50*0.15 + 40*0.15
      // = 20 + 15 + 14 + 7.5 + 6 = 62.5
      expect(calculateCompositeScore(dims)).toBe(62.5);
    });
  });

  describe('applyObservationCeiling', () => {
    it('should cap BLACK_BOX at 60', () => {
      expect(applyObservationCeiling(80, ObservationTier.BLACK_BOX)).toBe(60);
    });

    it('should cap GRAY_BOX at 75', () => {
      expect(applyObservationCeiling(80, ObservationTier.GRAY_BOX)).toBe(75);
    });

    it('should cap WHITE_BOX at 90 (per ATSF v2.0 RTA)', () => {
      expect(applyObservationCeiling(100, ObservationTier.WHITE_BOX)).toBe(90);
    });

    it('should cap ATTESTED_BOX at 95 (per ATSF v2.0 RTA)', () => {
      expect(applyObservationCeiling(100, ObservationTier.ATTESTED_BOX)).toBe(95);
    });

    it('should allow VERIFIED_BOX to reach 100', () => {
      expect(applyObservationCeiling(100, ObservationTier.VERIFIED_BOX)).toBe(100);
    });

    it('should not modify scores below ceiling', () => {
      expect(applyObservationCeiling(50, ObservationTier.BLACK_BOX)).toBe(50);
    });
  });

  describe('createEvidence', () => {
    it('should create valid evidence', () => {
      const evidence = createEvidence('CT', 10, 'test');
      expect(evidence.dimension).toBe('CT');
      expect(evidence.impact).toBe(10);
      expect(evidence.source).toBe('test');
      expect(evidence.evidenceId).toBeDefined();
    });

    it('should clamp impact to valid range', () => {
      const ev1 = createEvidence('CT', 150, 'test');
      const ev2 = createEvidence('CT', -150, 'test');
      expect(ev1.impact).toBe(100);
      expect(ev2.impact).toBe(-100);
    });
  });

  describe('calculateTrustProfile', () => {
    it('should create a complete trust profile', () => {
      const evidence = [
        createEvidence('CT', 30, 'successful task'),
        createEvidence('BT', 20, 'consistent behavior'),
      ];

      const profile = calculateTrustProfile(
        'agent-123',
        ObservationTier.WHITE_BOX,
        evidence
      );

      expect(profile.agentId).toBe('agent-123');
      expect(profile.observationTier).toBe(ObservationTier.WHITE_BOX);
      expect(profile.dimensions.CT).toBeGreaterThan(50);
      expect(profile.dimensions.BT).toBeGreaterThan(50);
      expect(profile.compositeScore).toBeGreaterThan(0);
      expect(profile.band).toBeDefined();
      expect(profile.version).toBe(1);
    });

    it('should apply observation ceiling', () => {
      // Create evidence that would push score above BLACK_BOX ceiling
      const evidence = Array(10).fill(null).map(() =>
        createEvidence('CT', 50, 'test')
      );

      const profile = calculateTrustProfile(
        'agent-123',
        ObservationTier.BLACK_BOX,
        evidence
      );

      expect(profile.adjustedScore).toBeLessThanOrEqual(60);
    });
  });
});
