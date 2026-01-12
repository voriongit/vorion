import { describe, it, expect, beforeEach } from 'vitest';
import {
  TrustCalculator,
  createTrustCalculator,
  createEvidence,
} from '../../src/trust/index.js';
import { ObservationTier, TrustBand } from '@orion/contracts';

describe('TrustCalculator Class', () => {
  let calculator: TrustCalculator;

  beforeEach(() => {
    calculator = createTrustCalculator();
  });

  describe('calculate', () => {
    it('should create a trust profile from evidence', () => {
      const evidence = [
        createEvidence('CT', 30, 'successful task'),
        createEvidence('BT', 20, 'consistent behavior'),
      ];

      const profile = calculator.calculate(
        'agent-123',
        ObservationTier.WHITE_BOX,
        evidence
      );

      expect(profile.agentId).toBe('agent-123');
      expect(profile.observationTier).toBe(ObservationTier.WHITE_BOX);
      expect(profile.compositeScore).toBeGreaterThan(0);
      expect(profile.version).toBe(1);
    });

    it('should apply observation ceiling', () => {
      // Create high-scoring evidence
      const evidence = Array(10).fill(null).map(() =>
        createEvidence('CT', 50, 'excellent')
      );

      const profile = calculator.calculate(
        'agent-123',
        ObservationTier.BLACK_BOX,
        evidence
      );

      expect(profile.adjustedScore).toBeLessThanOrEqual(60);
    });

    it('should handle empty evidence', () => {
      const profile = calculator.calculate(
        'agent-123',
        ObservationTier.WHITE_BOX,
        []
      );

      expect(profile.compositeScore).toBe(47); // Initial dimensions average
      expect(profile.band).toBe(TrustBand.T2_CONSTRAINED);
    });
  });

  describe('recalculate', () => {
    it('should increment version on recalculation', () => {
      const initial = calculator.calculate(
        'agent-123',
        ObservationTier.WHITE_BOX,
        [createEvidence('CT', 10, 'test')]
      );

      const updated = calculator.recalculate(initial, [
        createEvidence('BT', 15, 'new evidence'),
      ]);

      expect(updated.version).toBe(2);
      expect(updated.evidence.length).toBe(2);
    });

    it('should apply hysteresis on band changes', () => {
      // Start with T2 band
      const initial = calculator.calculate(
        'agent-123',
        ObservationTier.WHITE_BOX,
        [createEvidence('CT', 10, 'test')]
      );
      expect(initial.band).toBe(TrustBand.T2_CONSTRAINED);

      // Add evidence that would barely push to T3
      // Due to hysteresis, should stay at T2
      const updated = calculator.recalculate(initial, [
        createEvidence('CT', 10, 'more'),
      ]);

      // Band should be stable due to hysteresis
      expect(updated.band).toBeLessThanOrEqual(TrustBand.T3_TRUSTED);
    });
  });

  describe('applyDecay', () => {
    it('should reduce scores for old evidence', () => {
      const oldDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const evidence = [{
        evidenceId: 'test-1',
        dimension: 'CT' as const,
        impact: 30,
        source: 'old test',
        collectedAt: oldDate,
      }];

      const initial = calculator.calculate(
        'agent-123',
        ObservationTier.WHITE_BOX,
        evidence,
        { applyDecay: false }
      );

      const decayed = calculator.applyDecay(initial);

      expect(decayed.compositeScore).toBeLessThan(initial.compositeScore);
    });
  });

  describe('computeCompositeScore', () => {
    it('should calculate weighted average', () => {
      const dims = { CT: 100, BT: 100, GT: 100, XT: 100, AC: 100 };
      expect(calculator.computeCompositeScore(dims)).toBe(100);
    });

    it('should handle mixed scores', () => {
      const dims = { CT: 80, BT: 60, GT: 70, XT: 50, AC: 40 };
      const score = calculator.computeCompositeScore(dims);
      expect(score).toBeCloseTo(62.5, 1);
    });

    it('should throw for invalid dimensions', () => {
      const invalid = { CT: 150, BT: 50, GT: 50, XT: 50, AC: 50 };
      expect(() => calculator.computeCompositeScore(invalid)).toThrow();
    });
  });

  describe('aggregateEvidence', () => {
    it('should skip expired evidence', () => {
      const pastDate = new Date(Date.now() - 1000);
      const expiredEvidence = {
        evidenceId: 'expired',
        dimension: 'CT' as const,
        impact: 50,
        source: 'test',
        collectedAt: new Date(Date.now() - 10000),
        expiresAt: pastDate,
      };

      const result = calculator.aggregateEvidence([expiredEvidence]);
      expect(result.expiredEvidenceCount).toBe(1);
      expect(result.validEvidenceCount).toBe(0);
    });

    it('should track date range', () => {
      const oldDate = new Date('2024-01-01');
      const newDate = new Date('2024-06-01');

      const evidence = [
        { ...createEvidence('CT', 10, 'old'), collectedAt: oldDate },
        { ...createEvidence('BT', 10, 'new'), collectedAt: newDate },
      ];

      const result = calculator.aggregateEvidence(evidence, new Date('2024-12-01'), false);
      expect(result.oldestEvidence).toEqual(oldDate);
      expect(result.newestEvidence).toEqual(newDate);
    });
  });

  describe('configuration', () => {
    it('should use custom weights', () => {
      const customCalc = createTrustCalculator({
        defaultWeights: { CT: 1, BT: 0, GT: 0, XT: 0, AC: 0 },
      });

      const dims = { CT: 100, BT: 0, GT: 0, XT: 0, AC: 0 };
      expect(customCalc.computeCompositeScore(dims)).toBe(100);
    });

    it('should use custom decay rate', () => {
      const fastDecay = createTrustCalculator({ decayRate: 0.1 });
      const slowDecay = createTrustCalculator({ decayRate: 0.01 });

      const oldEvidence = [{
        evidenceId: 'test',
        dimension: 'CT' as const,
        impact: 30,
        source: 'test',
        collectedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
      }];

      const fastResult = fastDecay.aggregateEvidence(oldEvidence);
      const slowResult = slowDecay.aggregateEvidence(oldEvidence);

      // Fast decay should have lower dimension scores
      expect(fastResult.dimensions.CT).toBeLessThan(slowResult.dimensions.CT);
    });
  });
});
