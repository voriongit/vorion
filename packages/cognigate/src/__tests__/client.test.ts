/**
 * Cognigate SDK Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Cognigate, CognigateError } from '../client.js';
import { TrustTier, TIER_THRESHOLDS } from '../types.js';

describe('Cognigate', () => {
  describe('constructor', () => {
    it('throws error when API key is missing', () => {
      expect(() => new Cognigate({ apiKey: '' })).toThrow(CognigateError);
      expect(() => new Cognigate({ apiKey: '' })).toThrow('API key is required');
    });

    it('creates client with valid API key', () => {
      const client = new Cognigate({ apiKey: 'test-key' });
      expect(client).toBeInstanceOf(Cognigate);
      expect(client.agents).toBeDefined();
      expect(client.trust).toBeDefined();
      expect(client.governance).toBeDefined();
      expect(client.proofs).toBeDefined();
    });

    it('uses default config values', () => {
      const client = new Cognigate({ apiKey: 'test-key' });
      // Check that sub-clients are properly initialized
      expect(client.agents).toBeDefined();
    });

    it('accepts custom config values', () => {
      const client = new Cognigate({
        apiKey: 'test-key',
        baseUrl: 'https://custom.api.com',
        timeout: 60000,
        retries: 5,
        debug: true,
      });
      expect(client).toBeInstanceOf(Cognigate);
    });
  });

  describe('getTierFromScore', () => {
    it('returns T0_SANDBOX for scores 0-199', () => {
      expect(Cognigate.getTierFromScore(0)).toBe(TrustTier.T0_SANDBOX);
      expect(Cognigate.getTierFromScore(100)).toBe(TrustTier.T0_SANDBOX);
      expect(Cognigate.getTierFromScore(199)).toBe(TrustTier.T0_SANDBOX);
    });

    it('returns T1_OBSERVED for scores 200-349', () => {
      expect(Cognigate.getTierFromScore(200)).toBe(TrustTier.T1_OBSERVED);
      expect(Cognigate.getTierFromScore(275)).toBe(TrustTier.T1_OBSERVED);
      expect(Cognigate.getTierFromScore(349)).toBe(TrustTier.T1_OBSERVED);
    });

    it('returns T2_PROVISIONAL for scores 350-499', () => {
      expect(Cognigate.getTierFromScore(350)).toBe(TrustTier.T2_PROVISIONAL);
      expect(Cognigate.getTierFromScore(425)).toBe(TrustTier.T2_PROVISIONAL);
      expect(Cognigate.getTierFromScore(499)).toBe(TrustTier.T2_PROVISIONAL);
    });

    it('returns T3_VERIFIED for scores 500-649', () => {
      expect(Cognigate.getTierFromScore(500)).toBe(TrustTier.T3_VERIFIED);
      expect(Cognigate.getTierFromScore(575)).toBe(TrustTier.T3_VERIFIED);
      expect(Cognigate.getTierFromScore(649)).toBe(TrustTier.T3_VERIFIED);
    });

    it('returns T4_OPERATIONAL for scores 650-799', () => {
      expect(Cognigate.getTierFromScore(650)).toBe(TrustTier.T4_OPERATIONAL);
      expect(Cognigate.getTierFromScore(725)).toBe(TrustTier.T4_OPERATIONAL);
      expect(Cognigate.getTierFromScore(799)).toBe(TrustTier.T4_OPERATIONAL);
    });

    it('returns T5_TRUSTED for scores 800-875', () => {
      expect(Cognigate.getTierFromScore(800)).toBe(TrustTier.T5_TRUSTED);
      expect(Cognigate.getTierFromScore(837)).toBe(TrustTier.T5_TRUSTED);
      expect(Cognigate.getTierFromScore(875)).toBe(TrustTier.T5_TRUSTED);
    });

    it('returns T6_CERTIFIED for scores 876-949', () => {
      expect(Cognigate.getTierFromScore(876)).toBe(TrustTier.T6_CERTIFIED);
      expect(Cognigate.getTierFromScore(912)).toBe(TrustTier.T6_CERTIFIED);
      expect(Cognigate.getTierFromScore(949)).toBe(TrustTier.T6_CERTIFIED);
    });

    it('returns T7_AUTONOMOUS for scores 950-1000', () => {
      expect(Cognigate.getTierFromScore(950)).toBe(TrustTier.T7_AUTONOMOUS);
      expect(Cognigate.getTierFromScore(975)).toBe(TrustTier.T7_AUTONOMOUS);
      expect(Cognigate.getTierFromScore(1000)).toBe(TrustTier.T7_AUTONOMOUS);
    });
  });

  describe('getTierName', () => {
    it('returns correct tier names', () => {
      expect(Cognigate.getTierName(TrustTier.T0_SANDBOX)).toBe('Sandbox');
      expect(Cognigate.getTierName(TrustTier.T1_OBSERVED)).toBe('Observed');
      expect(Cognigate.getTierName(TrustTier.T2_PROVISIONAL)).toBe('Provisional');
      expect(Cognigate.getTierName(TrustTier.T3_VERIFIED)).toBe('Verified');
      expect(Cognigate.getTierName(TrustTier.T4_OPERATIONAL)).toBe('Operational');
      expect(Cognigate.getTierName(TrustTier.T5_TRUSTED)).toBe('Trusted');
      expect(Cognigate.getTierName(TrustTier.T6_CERTIFIED)).toBe('Certified');
      expect(Cognigate.getTierName(TrustTier.T7_AUTONOMOUS)).toBe('Autonomous');
    });
  });

  describe('getTierThresholds', () => {
    it('returns correct thresholds', () => {
      const t4 = Cognigate.getTierThresholds(TrustTier.T4_OPERATIONAL);
      expect(t4.min).toBe(650);
      expect(t4.max).toBe(799);
      expect(t4.name).toBe('Operational');
    });
  });
});

describe('TIER_THRESHOLDS', () => {
  it('has all 8 tiers defined', () => {
    expect(Object.keys(TIER_THRESHOLDS)).toHaveLength(8);
  });

  it('tiers are contiguous (no gaps)', () => {
    const tiers = [
      TrustTier.T0_SANDBOX,
      TrustTier.T1_OBSERVED,
      TrustTier.T2_PROVISIONAL,
      TrustTier.T3_VERIFIED,
      TrustTier.T4_OPERATIONAL,
      TrustTier.T5_TRUSTED,
      TrustTier.T6_CERTIFIED,
      TrustTier.T7_AUTONOMOUS,
    ];

    for (let i = 0; i < tiers.length - 1; i++) {
      const current = TIER_THRESHOLDS[tiers[i]];
      const next = TIER_THRESHOLDS[tiers[i + 1]];
      expect(current.max + 1).toBe(next.min);
    }
  });

  it('covers full 0-1000 range', () => {
    expect(TIER_THRESHOLDS[TrustTier.T0_SANDBOX].min).toBe(0);
    expect(TIER_THRESHOLDS[TrustTier.T7_AUTONOMOUS].max).toBe(1000);
  });
});

describe('CognigateError', () => {
  it('creates error with all properties', () => {
    const error = new CognigateError('Test error', 'TEST_CODE', 400, { foo: 'bar' });

    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_CODE');
    expect(error.status).toBe(400);
    expect(error.details).toEqual({ foo: 'bar' });
    expect(error.name).toBe('CognigateError');
  });

  it('is instanceof Error', () => {
    const error = new CognigateError('Test', 'CODE');
    expect(error instanceof Error).toBe(true);
    expect(error instanceof CognigateError).toBe(true);
  });
});
