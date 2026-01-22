/**
 * Enforce Metrics Tests
 *
 * Tests for the enforcement metrics module.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordDecision,
  recordEscalation,
  recordConstraintEvaluation,
  recordCacheHit,
  recordCacheMiss,
  setActiveEscalations,
  setCacheSize,
  getMetrics,
  getMetricsContentType,
} from '../../../src/enforce/metrics.js';

describe('Enforce Metrics', () => {
  describe('recordDecision', () => {
    it('should record allowed decision', () => {
      expect(() => {
        recordDecision('tenant-1', 'allow', false, 10);
      }).not.toThrow();
    });

    it('should record denied decision', () => {
      expect(() => {
        recordDecision('tenant-1', 'deny', false, 5);
      }).not.toThrow();
    });

    it('should record cached decision', () => {
      expect(() => {
        recordDecision('tenant-1', 'allow', true, 1);
      }).not.toThrow();
    });

    it('should record escalated decision', () => {
      expect(() => {
        recordDecision('tenant-1', 'escalate', false, 15);
      }).not.toThrow();
    });
  });

  describe('recordEscalation', () => {
    it('should record escalation event', () => {
      expect(() => {
        recordEscalation('tenant-1', 'rule-1', 'high');
      }).not.toThrow();
    });

    it('should record critical escalation', () => {
      expect(() => {
        recordEscalation('tenant-2', 'rule-2', 'critical');
      }).not.toThrow();
    });

    it('should record low priority escalation', () => {
      expect(() => {
        recordEscalation('tenant-3', 'rule-3', 'low');
      }).not.toThrow();
    });
  });

  describe('recordConstraintEvaluation', () => {
    it('should record passed constraint', () => {
      expect(() => {
        recordConstraintEvaluation('tenant-1', 'trust_level', true, 2);
      }).not.toThrow();
    });

    it('should record failed constraint', () => {
      expect(() => {
        recordConstraintEvaluation('tenant-1', 'policy_rule', false, 5);
      }).not.toThrow();
    });

    it('should record rate limit constraint', () => {
      expect(() => {
        recordConstraintEvaluation('tenant-1', 'rate_limit', true, 1);
      }).not.toThrow();
    });
  });

  describe('cache metrics', () => {
    it('should record cache hit', () => {
      expect(() => {
        recordCacheHit('tenant-1');
      }).not.toThrow();
    });

    it('should record cache miss', () => {
      expect(() => {
        recordCacheMiss('tenant-1');
      }).not.toThrow();
    });

    it('should set cache size', () => {
      expect(() => {
        setCacheSize('tenant-1', 100);
      }).not.toThrow();
    });
  });

  describe('gauge metrics', () => {
    it('should set active escalations', () => {
      expect(() => {
        setActiveEscalations('tenant-1', 'high', 5);
      }).not.toThrow();
    });

    it('should set zero active escalations', () => {
      expect(() => {
        setActiveEscalations('tenant-1', 'critical', 0);
      }).not.toThrow();
    });
  });

  describe('getMetrics', () => {
    beforeEach(() => {
      // Record some metrics
      recordDecision('tenant-1', 'allow', false, 10);
      recordDecision('tenant-1', 'deny', false, 5);
      recordCacheHit('tenant-1');
      recordCacheMiss('tenant-1');
    });

    it('should return Prometheus formatted metrics', async () => {
      const metrics = await getMetrics();
      expect(typeof metrics).toBe('string');
      expect(metrics).toContain('vorion_enforce');
    });

    it('should include decision counter', async () => {
      const metrics = await getMetrics();
      expect(metrics).toContain('vorion_enforce_decisions_total');
    });

    it('should include cache metrics', async () => {
      const metrics = await getMetrics();
      expect(metrics).toContain('vorion_enforce_cache_hits_total');
      expect(metrics).toContain('vorion_enforce_cache_misses_total');
    });

    it('should include histogram metrics', async () => {
      const metrics = await getMetrics();
      expect(metrics).toContain('vorion_enforce_decision_duration_seconds');
    });
  });

  describe('getMetricsContentType', () => {
    it('should return correct content type', () => {
      const contentType = getMetricsContentType();
      expect(contentType).toContain('text/plain');
    });
  });
});
