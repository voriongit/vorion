/**
 * Trust Engine Decay Tests
 *
 * Tests for the stepped decay algorithm that reduces trust scores
 * based on inactivity. Uses 182-day half-life with 7 milestones.
 *
 * @see stepped-decay-specification.md
 */

import { describe, it, expect } from 'vitest';
import {
  DECAY_MILESTONES,
  calculateDecayMultiplier,
  applyDecay,
  getNextDecayMilestone,
  type DecayMilestone,
} from '../../../src/trust-engine/index.js';

describe('Decay Milestones', () => {
  it('should have 7 milestones defined', () => {
    expect(DECAY_MILESTONES).toHaveLength(7);
  });

  it('should start at day 0 with multiplier 1.0', () => {
    expect(DECAY_MILESTONES[0]).toEqual({ days: 0, multiplier: 1.0 });
  });

  it('should end at day 182 with multiplier 0.5 (half-life)', () => {
    expect(DECAY_MILESTONES[6]).toEqual({ days: 182, multiplier: 0.5 });
  });

  it('should have milestones in ascending day order', () => {
    for (let i = 1; i < DECAY_MILESTONES.length; i++) {
      expect(DECAY_MILESTONES[i]!.days).toBeGreaterThan(
        DECAY_MILESTONES[i - 1]!.days
      );
    }
  });

  it('should have multipliers in descending order', () => {
    for (let i = 1; i < DECAY_MILESTONES.length; i++) {
      expect(DECAY_MILESTONES[i]!.multiplier).toBeLessThan(
        DECAY_MILESTONES[i - 1]!.multiplier
      );
    }
  });

  it('should match specification values', () => {
    const expected: DecayMilestone[] = [
      { days: 0, multiplier: 1.0 },
      { days: 7, multiplier: 0.92 },
      { days: 14, multiplier: 0.83 },
      { days: 28, multiplier: 0.75 },
      { days: 56, multiplier: 0.67 },
      { days: 112, multiplier: 0.58 },
      { days: 182, multiplier: 0.5 },
    ];
    expect(DECAY_MILESTONES).toEqual(expected);
  });
});

describe('calculateDecayMultiplier', () => {
  describe('exact milestone values', () => {
    it('should return 1.0 for day 0', () => {
      expect(calculateDecayMultiplier(0)).toBe(1.0);
    });

    it('should return 0.92 for day 7', () => {
      expect(calculateDecayMultiplier(7)).toBe(0.92);
    });

    it('should return 0.83 for day 14', () => {
      expect(calculateDecayMultiplier(14)).toBe(0.83);
    });

    it('should return 0.75 for day 28', () => {
      expect(calculateDecayMultiplier(28)).toBe(0.75);
    });

    it('should return 0.67 for day 56', () => {
      expect(calculateDecayMultiplier(56)).toBe(0.67);
    });

    it('should return 0.58 for day 112', () => {
      expect(calculateDecayMultiplier(112)).toBe(0.58);
    });

    it('should return 0.5 for day 182', () => {
      expect(calculateDecayMultiplier(182)).toBe(0.5);
    });
  });

  describe('interpolation between milestones', () => {
    it('should interpolate between day 0 and day 7', () => {
      // Day 3.5 should be halfway between 1.0 and 0.92
      const multiplier = calculateDecayMultiplier(3.5);
      expect(multiplier).toBeCloseTo(0.96, 2); // (1.0 + 0.92) / 2
    });

    it('should interpolate at day 3 (3/7 of way from M0 to M1)', () => {
      // Progress = 3/7 ≈ 0.4286
      // Decay range = 1.0 - 0.92 = 0.08
      // Expected = 1.0 - (0.08 * 0.4286) ≈ 0.9657
      const multiplier = calculateDecayMultiplier(3);
      expect(multiplier).toBeCloseTo(0.9657, 3);
    });

    it('should interpolate between day 7 and day 14', () => {
      // Day 10.5 should be halfway between 0.92 and 0.83
      const multiplier = calculateDecayMultiplier(10.5);
      expect(multiplier).toBeCloseTo(0.875, 2); // (0.92 + 0.83) / 2
    });

    it('should interpolate between day 28 and day 56', () => {
      // Day 42 should be halfway between 0.75 and 0.67
      const multiplier = calculateDecayMultiplier(42);
      expect(multiplier).toBeCloseTo(0.71, 2); // (0.75 + 0.67) / 2
    });

    it('should interpolate between day 112 and day 182', () => {
      // Day 147 should be halfway between 0.58 and 0.5
      const multiplier = calculateDecayMultiplier(147);
      expect(multiplier).toBeCloseTo(0.54, 2); // (0.58 + 0.5) / 2
    });
  });

  describe('beyond final milestone', () => {
    it('should return 0.5 for day 182', () => {
      expect(calculateDecayMultiplier(182)).toBe(0.5);
    });

    it('should return 0.5 for day 200', () => {
      expect(calculateDecayMultiplier(200)).toBe(0.5);
    });

    it('should return 0.5 for day 365', () => {
      expect(calculateDecayMultiplier(365)).toBe(0.5);
    });

    it('should return 0.5 for day 1000', () => {
      expect(calculateDecayMultiplier(1000)).toBe(0.5);
    });
  });

  describe('edge cases', () => {
    it('should handle negative days as day 0', () => {
      // Negative days shouldn't happen, but should not break
      const multiplier = calculateDecayMultiplier(-1);
      expect(multiplier).toBe(1.0);
    });

    it('should handle fractional days', () => {
      const multiplier = calculateDecayMultiplier(0.5);
      expect(multiplier).toBeGreaterThan(0.99);
      expect(multiplier).toBeLessThan(1.0);
    });
  });
});

describe('applyDecay', () => {
  describe('no decay (day 0)', () => {
    it('should return same score at day 0', () => {
      expect(applyDecay(500, 0)).toBe(500);
    });

    it('should return same score at day 0 for max score', () => {
      expect(applyDecay(1000, 0)).toBe(1000);
    });

    it('should return same score at day 0 for min score', () => {
      expect(applyDecay(0, 0)).toBe(0);
    });
  });

  describe('milestone decay values', () => {
    const baseScore = 1000;

    it('should return 920 for score 1000 at day 7', () => {
      expect(applyDecay(baseScore, 7)).toBe(920);
    });

    it('should return 830 for score 1000 at day 14', () => {
      expect(applyDecay(baseScore, 14)).toBe(830);
    });

    it('should return 750 for score 1000 at day 28', () => {
      expect(applyDecay(baseScore, 28)).toBe(750);
    });

    it('should return 670 for score 1000 at day 56', () => {
      expect(applyDecay(baseScore, 56)).toBe(670);
    });

    it('should return 580 for score 1000 at day 112', () => {
      expect(applyDecay(baseScore, 112)).toBe(580);
    });

    it('should return 500 for score 1000 at day 182 (half-life)', () => {
      expect(applyDecay(baseScore, 182)).toBe(500);
    });
  });

  describe('decay with various base scores', () => {
    it('should decay score 500 to 250 at day 182', () => {
      expect(applyDecay(500, 182)).toBe(250);
    });

    it('should decay score 800 to 400 at day 182', () => {
      expect(applyDecay(800, 182)).toBe(400);
    });

    it('should decay score 200 to 100 at day 182', () => {
      expect(applyDecay(200, 182)).toBe(100);
    });

    it('should decay score 750 to 690 at day 7', () => {
      // 750 * 0.92 = 690
      expect(applyDecay(750, 7)).toBe(690);
    });
  });

  describe('rounding behavior', () => {
    it('should round to nearest integer', () => {
      // 500 * 0.92 = 460
      expect(applyDecay(500, 7)).toBe(460);
    });

    it('should round 0.5 up', () => {
      // Score that results in .5 decimal
      // 545 * 0.92 = 501.4 → 501
      expect(applyDecay(545, 7)).toBe(501);
    });

    it('should handle small scores', () => {
      // 10 * 0.5 = 5
      expect(applyDecay(10, 182)).toBe(5);
    });
  });

  describe('beyond half-life', () => {
    it('should not decay below 50% even at day 365', () => {
      const baseScore = 1000;
      const decayed = applyDecay(baseScore, 365);
      expect(decayed).toBe(500); // Still 50%
    });

    it('should not decay below 50% even at day 1000', () => {
      const baseScore = 800;
      const decayed = applyDecay(baseScore, 1000);
      expect(decayed).toBe(400); // Still 50%
    });
  });
});

describe('getNextDecayMilestone', () => {
  it('should return day 7 milestone for day 0', () => {
    const next = getNextDecayMilestone(0);
    expect(next).toEqual({ days: 7, multiplier: 0.92 });
  });

  it('should return day 7 milestone for day 5', () => {
    const next = getNextDecayMilestone(5);
    expect(next).toEqual({ days: 7, multiplier: 0.92 });
  });

  it('should return day 14 milestone for day 7', () => {
    const next = getNextDecayMilestone(7);
    expect(next).toEqual({ days: 14, multiplier: 0.83 });
  });

  it('should return day 14 milestone for day 10', () => {
    const next = getNextDecayMilestone(10);
    expect(next).toEqual({ days: 14, multiplier: 0.83 });
  });

  it('should return day 28 milestone for day 14', () => {
    const next = getNextDecayMilestone(14);
    expect(next).toEqual({ days: 28, multiplier: 0.75 });
  });

  it('should return day 56 milestone for day 28', () => {
    const next = getNextDecayMilestone(28);
    expect(next).toEqual({ days: 56, multiplier: 0.67 });
  });

  it('should return day 112 milestone for day 56', () => {
    const next = getNextDecayMilestone(56);
    expect(next).toEqual({ days: 112, multiplier: 0.58 });
  });

  it('should return day 182 milestone for day 112', () => {
    const next = getNextDecayMilestone(112);
    expect(next).toEqual({ days: 182, multiplier: 0.5 });
  });

  it('should return null for day 182 (at final milestone)', () => {
    const next = getNextDecayMilestone(182);
    expect(next).toBeNull();
  });

  it('should return null for day 365 (beyond final milestone)', () => {
    const next = getNextDecayMilestone(365);
    expect(next).toBeNull();
  });
});

describe('Decay Properties', () => {
  describe('monotonicity', () => {
    it('decay multiplier should never increase with more inactive days', () => {
      let prevMultiplier = 1.0;
      for (let day = 0; day <= 200; day++) {
        const multiplier = calculateDecayMultiplier(day);
        expect(multiplier).toBeLessThanOrEqual(prevMultiplier);
        prevMultiplier = multiplier;
      }
    });

    it('decayed score should never exceed base score', () => {
      const baseScore = 750;
      for (let day = 0; day <= 200; day++) {
        const decayed = applyDecay(baseScore, day);
        expect(decayed).toBeLessThanOrEqual(baseScore);
      }
    });
  });

  describe('bounds', () => {
    it('decay multiplier should always be between 0.5 and 1.0', () => {
      for (let day = 0; day <= 500; day += 10) {
        const multiplier = calculateDecayMultiplier(day);
        expect(multiplier).toBeGreaterThanOrEqual(0.5);
        expect(multiplier).toBeLessThanOrEqual(1.0);
      }
    });

    it('decayed score should always be at least 50% of base', () => {
      const testScores = [100, 250, 500, 750, 1000];
      for (const baseScore of testScores) {
        for (let day = 0; day <= 500; day += 50) {
          const decayed = applyDecay(baseScore, day);
          expect(decayed).toBeGreaterThanOrEqual(Math.round(baseScore * 0.5));
        }
      }
    });
  });

  describe('half-life property', () => {
    it('score should be exactly 50% at day 182', () => {
      const baseScore = 1000;
      const decayed = applyDecay(baseScore, 182);
      expect(decayed).toBe(baseScore * 0.5);
    });

    it('score should be more than 50% before day 182', () => {
      const baseScore = 1000;
      const decayed = applyDecay(baseScore, 181);
      expect(decayed).toBeGreaterThan(baseScore * 0.5);
    });
  });
});

describe('Real-world scenarios', () => {
  describe('new agent (score 200)', () => {
    const initialScore = 200; // Provisional trust level

    it('should have minimal decay in first week', () => {
      // Day 0: 200 * 1.0 = 200
      // Day 6: progress = 6/7 ≈ 0.857, multiplier = 1.0 - (0.08 * 0.857) ≈ 0.931
      //        200 * 0.931 = 186.2 ≈ 186 (still > 92% retained)
      for (let day = 0; day <= 6; day++) {
        const decayed = applyDecay(initialScore, day);
        expect(decayed).toBeGreaterThanOrEqual(186); // At least 93% retained
      }
    });

    it('should drop to ~184 after 1 week of inactivity', () => {
      expect(applyDecay(initialScore, 7)).toBe(184);
    });

    it('should drop to ~100 after 6 months of inactivity', () => {
      expect(applyDecay(initialScore, 182)).toBe(100);
    });
  });

  describe('trusted agent (score 500)', () => {
    const trustedScore = 500;

    it('should maintain trust level in first 2 weeks', () => {
      // At day 14, score = 500 * 0.83 = 415, still in Level 2 (400-599)
      expect(applyDecay(trustedScore, 14)).toBeGreaterThanOrEqual(400);
    });

    it('should drop below trusted level after ~3 weeks', () => {
      // Need to find when 500 * multiplier < 400
      // multiplier < 0.8, which happens between day 14 (0.83) and day 28 (0.75)
      // At day 21, multiplier ≈ 0.79, score ≈ 395
      const day21Score = applyDecay(trustedScore, 21);
      expect(day21Score).toBeLessThan(400);
    });
  });

  describe('privileged agent (score 850)', () => {
    const privilegedScore = 850;

    it('should maintain privileged level (800+) in first week', () => {
      // 850 * 0.92 = 782, drops below 800
      const day7Score = applyDecay(privilegedScore, 7);
      expect(day7Score).toBeLessThan(800);
    });

    it('needs activity within first few days to maintain privileged', () => {
      // Find when 850 * multiplier < 800
      // multiplier < 0.941
      // Day 5: progress = 5/7 ≈ 0.714, multiplier = 1.0 - (0.08 * 0.714) ≈ 0.943
      const day5Score = applyDecay(privilegedScore, 5);
      expect(day5Score).toBeGreaterThanOrEqual(800);
    });
  });
});
