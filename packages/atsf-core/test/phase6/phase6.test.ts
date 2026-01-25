/**
 * Phase 6 Test Suite - Q1: Ceiling Enforcement
 * 
 * 40+ tests for kernel-level ceiling enforcement with dual logging
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TrustEvent,
  TrustMetrics,
} from '../../src/trust-engine/phase6-types';
import {
  ContextType,
  clampTrustScore,
  applyCeilingEnforcement,
  validateScoreForContext,
  getTierFromScore,
  getEffectiveAuthorizationTier,
  getCeilingForContext,
} from '../../src/trust-engine/ceiling-enforcement';
import {
  CeilingAuditLog,
} from '../../src/trust-engine/ceiling-enforcement/audit';

// ============================================================================
// Q1: CEILING ENFORCEMENT TESTS (40+ tests)
// ============================================================================

describe('Q1: Ceiling Enforcement (Kernel-Level)', () => {
  describe('Trust score clamping to ceiling', () => {
    it('should clamp score > 1000 to 1000 (sovereign context)', () => {
      const result = clampTrustScore(1247, ContextType.SOVEREIGN);
      expect(result.clampedScore).toBe(1000);
      expect(result.ceilingApplied).toBe(true);
      expect(result.ceiling).toBe(1000);
    });

    it('should clamp score > 900 to 900 (enterprise context)', () => {
      const result = clampTrustScore(1050, ContextType.ENTERPRISE);
      expect(result.clampedScore).toBe(900);
      expect(result.ceilingApplied).toBe(true);
      expect(result.ceiling).toBe(900);
    });

    it('should clamp score > 700 to 700 (local context)', () => {
      const result = clampTrustScore(850, ContextType.LOCAL);
      expect(result.clampedScore).toBe(700);
      expect(result.ceilingApplied).toBe(true);
      expect(result.ceiling).toBe(700);
    });

    it('should preserve score < ceiling (no clamping needed)', () => {
      const result = clampTrustScore(650, ContextType.LOCAL);
      expect(result.clampedScore).toBe(650);
      expect(result.ceilingApplied).toBe(false);
      expect(result.rawScore).toBe(650);
    });

    it('should preserve score = 0', () => {
      const result = clampTrustScore(0, ContextType.SOVEREIGN);
      expect(result.clampedScore).toBe(0);
      expect(result.ceilingApplied).toBe(false);
    });

    it('should clamp negative scores to 0', () => {
      const result = clampTrustScore(-100, ContextType.ENTERPRISE);
      expect(result.clampedScore).toBe(0);
      expect(result.ceilingApplied).toBe(true);
    });

    it('should preserve raw score even when clamped', () => {
      const result = clampTrustScore(1500, ContextType.ENTERPRISE);
      expect(result.rawScore).toBe(1500);
      expect(result.clampedScore).toBe(900);
      expect(result.ceilingApplied).toBe(true);
    });

    it('should flag when ceiling is applied', () => {
      const result = clampTrustScore(1500, ContextType.SOVEREIGN);
      expect(result.ceilingApplied).toBe(true);
    });

    it('should flag when ceiling is NOT applied', () => {
      const result = clampTrustScore(500, ContextType.ENTERPRISE);
      expect(result.ceilingApplied).toBe(false);
    });

    it('should report correct ceiling in result', () => {
      const result = clampTrustScore(999, ContextType.LOCAL);
      expect(result.ceiling).toBe(700);
    });

    it('should handle boundary: score = ceiling', () => {
      const result = clampTrustScore(700, ContextType.LOCAL);
      expect(result.clampedScore).toBe(700);
      expect(result.ceilingApplied).toBe(false);
    });

    it('should handle boundary: score = ceiling + 1', () => {
      const result = clampTrustScore(701, ContextType.LOCAL);
      expect(result.clampedScore).toBe(700);
      expect(result.ceilingApplied).toBe(true);
    });
  });

  describe('Context ceiling validation', () => {
    it('should validate score respects local ceiling (700)', () => {
      const isValid = validateScoreForContext(650, ContextType.LOCAL);
      expect(isValid).toBe(true);
    });

    it('should reject score exceeding local ceiling', () => {
      const isValid = validateScoreForContext(750, ContextType.LOCAL);
      expect(isValid).toBe(false);
    });

    it('should validate score respects enterprise ceiling (900)', () => {
      const isValid = validateScoreForContext(850, ContextType.ENTERPRISE);
      expect(isValid).toBe(true);
    });

    it('should reject score exceeding enterprise ceiling', () => {
      const isValid = validateScoreForContext(950, ContextType.ENTERPRISE);
      expect(isValid).toBe(false);
    });

    it('should validate score respects sovereign ceiling (1000)', () => {
      const isValid = validateScoreForContext(999, ContextType.SOVEREIGN);
      expect(isValid).toBe(true);
    });

    it('should accept max sovereign score', () => {
      const isValid = validateScoreForContext(1000, ContextType.SOVEREIGN);
      expect(isValid).toBe(true);
    });

    it('should reject negative scores', () => {
      const isValid = validateScoreForContext(-1, ContextType.SOVEREIGN);
      expect(isValid).toBe(false);
    });

    it('should validate all context ceiling values', () => {
      const local = getCeilingForContext(ContextType.LOCAL);
      const enterprise = getCeilingForContext(ContextType.ENTERPRISE);
      const sovereign = getCeilingForContext(ContextType.SOVEREIGN);

      expect(local).toBe(700);
      expect(enterprise).toBe(900);
      expect(sovereign).toBe(1000);
    });
  });

  describe('Tier mapping from clamped scores', () => {
    it('should map 0-99 to T0 (sandbox)', () => {
      expect(getTierFromScore(0)).toBe(0);
      expect(getTierFromScore(50)).toBe(0);
      expect(getTierFromScore(99)).toBe(0);
    });

    it('should map 100-299 to T1 (monitored)', () => {
      expect(getTierFromScore(100)).toBe(1);
      expect(getTierFromScore(200)).toBe(1);
      expect(getTierFromScore(299)).toBe(1);
    });

    it('should map 300-499 to T2 (supervised)', () => {
      expect(getTierFromScore(300)).toBe(2);
      expect(getTierFromScore(400)).toBe(2);
      expect(getTierFromScore(499)).toBe(2);
    });

    it('should map 500-699 to T3 (autonomous)', () => {
      expect(getTierFromScore(500)).toBe(3);
      expect(getTierFromScore(600)).toBe(3);
      expect(getTierFromScore(699)).toBe(3);
    });

    it('should map 700-899 to T4 (sovereign)', () => {
      expect(getTierFromScore(700)).toBe(4);
      expect(getTierFromScore(800)).toBe(4);
      expect(getTierFromScore(899)).toBe(4);
    });

    it('should map 900-1000 to T5 (verified)', () => {
      expect(getTierFromScore(900)).toBe(5);
      expect(getTierFromScore(950)).toBe(5);
      expect(getTierFromScore(1000)).toBe(5);
    });
  });

  describe('Ceiling event enforcement', () => {
    it('should apply ceiling to TrustEvent', () => {
      const event: TrustEvent = {
        agentId: 'agent-1',
        timestamp: new Date(),
        rawScore: 1050,
        score: 0,
        ceilingApplied: false,
        metrics: {} as TrustMetrics,
        computedBy: 'kernel',
        layer: 'ceiling',
      };

      const enforced = applyCeilingEnforcement(event, ContextType.ENTERPRISE);
      expect(enforced.score).toBe(900);
      expect(enforced.ceilingApplied).toBe(true);
      expect(enforced.rawScore).toBe(1050);
    });

    it('should not modify event when no clamping needed', () => {
      const event: TrustEvent = {
        agentId: 'agent-1',
        timestamp: new Date(),
        rawScore: 850,
        score: 0,
        ceilingApplied: false,
        metrics: {} as TrustMetrics,
        computedBy: 'kernel',
        layer: 'ceiling',
      };

      const enforced = applyCeilingEnforcement(event, ContextType.ENTERPRISE);
      expect(enforced.score).toBe(850);
      expect(enforced.ceilingApplied).toBe(false);
    });
  });

  describe('Audit logging of ceiling enforcement', () => {
    let auditLog: CeilingAuditLog;

    beforeEach(() => {
      auditLog = new CeilingAuditLog();
    });

    it('should record ceiling enforcement events', () => {
      const result = clampTrustScore(1050, ContextType.ENTERPRISE);
      auditLog.addEntry('event-1', 'agent-1', result, 'manual_review');

      const entries = auditLog.getEntries();
      expect(entries.length).toBe(1);
      expect(entries[0].eventId).toBe('event-1');
      expect(entries[0].rawScore).toBe(1050);
      expect(entries[0].clampedScore).toBe(900);
    });

    it('should track ceiling hits in audit log', () => {
      const result = clampTrustScore(1050, ContextType.ENTERPRISE);
      auditLog.addEntry('event-1', 'agent-1', result);

      const entries = auditLog.getEntries();
      expect(entries[0].ceilingHit).toBe(true);
    });

    it('should separate entries by agent', () => {
      const result1 = clampTrustScore(1050, ContextType.ENTERPRISE);
      const result2 = clampTrustScore(850, ContextType.ENTERPRISE);

      auditLog.addEntry('event-1', 'agent-1', result1);
      auditLog.addEntry('event-2', 'agent-2', result2);

      const agent1Entries = auditLog.getEntriesForAgent('agent-1');
      const agent2Entries = auditLog.getEntriesForAgent('agent-2');

      expect(agent1Entries.length).toBe(1);
      expect(agent2Entries.length).toBe(1);
    });

    it('should compute ceiling statistics from audit log', () => {
      const result1 = clampTrustScore(1050, ContextType.ENTERPRISE);
      const result2 = clampTrustScore(800, ContextType.ENTERPRISE);

      auditLog.addEntry('event-1', 'agent-1', result1);
      auditLog.addEntry('event-2', 'agent-1', result2);

      const stats = auditLog.computeStatistics();
      expect(stats.totalEvents).toBe(2);
      expect(stats.ceilingHits).toBe(1);
      expect(stats.ceilingHitRate).toBe(0.5);
    });

    it('should detect ceiling anomalies', () => {
      // Add 10 events, 6 with ceiling hits (60% - above threshold)
      for (let i = 0; i < 10; i++) {
        const rawScore = i < 6 ? 950 : 600; // 6 will hit 900 ceiling
        const result = clampTrustScore(rawScore, ContextType.ENTERPRISE);
        auditLog.addEntry(`event-${i}`, 'agent-1', result);
      }

      const anomalies = auditLog.detectCeilingAnomalies('agent-1', 0.05);
      expect(anomalies.length).toBeGreaterThan(0);
      expect(anomalies.every((a) => a.ceilingHit)).toBe(true);
    });
  });

  describe('Effective authorization tier computation', () => {
    it('should compute correct tier from score and context', () => {
      const tier = getEffectiveAuthorizationTier(850, ContextType.ENTERPRISE);
      expect(tier).toBe(4); // 850 is T4 (700-899)
    });

    it('should respect context ceiling in tier calculation', () => {
      const tier = getEffectiveAuthorizationTier(700, ContextType.LOCAL);
      expect(tier).toBe(4); // Max for local context
    });

    it('should throw if score exceeds context ceiling', () => {
      expect(() => {
        getEffectiveAuthorizationTier(750, ContextType.LOCAL);
      }).toThrow();
    });
  });
});
