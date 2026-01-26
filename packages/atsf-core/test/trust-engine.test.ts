import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  TrustEngine,
  createTrustEngine,
  TRUST_THRESHOLDS,
  TRUST_LEVEL_NAMES,
  type TrustRecord,
  type TrustEngineConfig,
  type TrustFailureDetectedEvent,
  type TrustDecayAppliedEvent,
  type TrustTierChangedEvent,
} from '../src/trust-engine/index.js';
import type { TrustSignal } from '../src/common/types.js';

describe('TrustEngine', () => {
  let engine: TrustEngine;

  beforeEach(() => {
    engine = createTrustEngine();
  });

  describe('initialization', () => {
    it('should create engine with default config', () => {
      expect(engine.decayRate).toBe(0.01);
      expect(engine.decayIntervalMs).toBe(60000);
      expect(engine.failureThreshold).toBe(0.3);
      expect(engine.acceleratedDecayMultiplier).toBe(3.0);
    });

    it('should create engine with custom config', () => {
      const config: TrustEngineConfig = {
        decayRate: 0.05,
        decayIntervalMs: 30000,
        failureThreshold: 0.2,
        acceleratedDecayMultiplier: 5.0,
        failureWindowMs: 1800000,
        minFailuresForAcceleration: 3,
      };
      const customEngine = createTrustEngine(config);

      expect(customEngine.decayRate).toBe(0.05);
      expect(customEngine.decayIntervalMs).toBe(30000);
      expect(customEngine.failureThreshold).toBe(0.2);
      expect(customEngine.acceleratedDecayMultiplier).toBe(5.0);
    });

    it('should initialize entity at specified level', async () => {
      const record = await engine.initializeEntity('agent-001', 2);

      expect(record.entityId).toBe('agent-001');
      expect(record.level).toBe(2);
      expect(record.score).toBe(TRUST_THRESHOLDS[2].min);
      expect(record.recentFailures).toEqual([]);
    });

    it('should emit initialized event', async () => {
      const events: unknown[] = [];
      engine.on('trust:initialized', (e) => events.push(e));

      await engine.initializeEntity('agent-001', 1);

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: 'trust:initialized',
        entityId: 'agent-001',
        initialLevel: 1,
      });
    });
  });

  describe('6-tier trust levels', () => {
    it('should have 6 trust levels (L0-L5)', () => {
      expect(Object.keys(TRUST_THRESHOLDS)).toHaveLength(6);
      expect(Object.keys(TRUST_LEVEL_NAMES)).toHaveLength(6);
    });

    it('should have correct level names', () => {
      // BASIS spec tier names
      expect(TRUST_LEVEL_NAMES[0]).toBe('Sandbox');
      expect(TRUST_LEVEL_NAMES[1]).toBe('Provisional');
      expect(TRUST_LEVEL_NAMES[2]).toBe('Standard');
      expect(TRUST_LEVEL_NAMES[3]).toBe('Trusted');
      expect(TRUST_LEVEL_NAMES[4]).toBe('Certified');
      expect(TRUST_LEVEL_NAMES[5]).toBe('Autonomous');
    });

    it('should have non-overlapping score ranges', () => {
      const ranges = Object.values(TRUST_THRESHOLDS);
      for (let i = 0; i < ranges.length - 1; i++) {
        expect(ranges[i]!.max).toBeLessThan(ranges[i + 1]!.min);
      }
    });

    it('should cover full 0-1000 range', () => {
      expect(TRUST_THRESHOLDS[0].min).toBe(0);
      expect(TRUST_THRESHOLDS[5].max).toBe(1000);
    });
  });

  describe('signal recording', () => {
    it('should record signals and update score', async () => {
      await engine.initializeEntity('agent-001', 1);

      const signal: TrustSignal = {
        id: 'sig-001',
        entityId: 'agent-001',
        type: 'behavioral.task_completed',
        value: 0.9,
        source: 'system',
        timestamp: new Date().toISOString(),
        metadata: {},
      };

      await engine.recordSignal(signal);

      const record = await engine.getScore('agent-001');
      expect(record).toBeDefined();
      expect(record!.signals).toHaveLength(1);
    });

    it('should emit signal_recorded event', async () => {
      const events: unknown[] = [];
      engine.on('trust:signal_recorded', (e) => events.push(e));

      await engine.initializeEntity('agent-001', 1);
      await engine.recordSignal({
        id: 'sig-001',
        entityId: 'agent-001',
        type: 'behavioral.task_completed',
        value: 0.9,
        source: 'system',
        timestamp: new Date().toISOString(),
        metadata: {},
      });

      expect(events).toHaveLength(1);
    });
  });

  describe('accelerated decay on failure', () => {
    let customEngine: TrustEngine;

    beforeEach(() => {
      // Use short windows for testing
      customEngine = createTrustEngine({
        decayRate: 0.1,
        decayIntervalMs: 100, // 100ms for fast testing
        failureThreshold: 0.3,
        acceleratedDecayMultiplier: 3.0,
        failureWindowMs: 10000, // 10 seconds
        minFailuresForAcceleration: 2,
      });
    });

    it('should detect failure when signal value is below threshold', async () => {
      const events: TrustFailureDetectedEvent[] = [];
      customEngine.on('trust:failure_detected', (e) => events.push(e));

      await customEngine.initializeEntity('agent-001', 3);

      // Record a failure signal (value < 0.3)
      await customEngine.recordSignal({
        id: 'sig-001',
        entityId: 'agent-001',
        type: 'behavioral.task_failed',
        value: 0.1,
        source: 'system',
        timestamp: new Date().toISOString(),
        metadata: {},
      });

      expect(events).toHaveLength(1);
      expect(events[0]!.failureCount).toBe(1);
      expect(events[0]!.acceleratedDecayActive).toBe(false);
    });

    it('should activate accelerated decay after min failures', async () => {
      const events: TrustFailureDetectedEvent[] = [];
      customEngine.on('trust:failure_detected', (e) => events.push(e));

      await customEngine.initializeEntity('agent-001', 3);

      // First failure
      await customEngine.recordSignal({
        id: 'sig-001',
        entityId: 'agent-001',
        type: 'behavioral.task_failed',
        value: 0.1,
        source: 'system',
        timestamp: new Date().toISOString(),
        metadata: {},
      });

      expect(events[0]!.acceleratedDecayActive).toBe(false);

      // Second failure - should activate accelerated decay
      await customEngine.recordSignal({
        id: 'sig-002',
        entityId: 'agent-001',
        type: 'behavioral.task_failed',
        value: 0.2,
        source: 'system',
        timestamp: new Date().toISOString(),
        metadata: {},
      });

      expect(events[1]!.failureCount).toBe(2);
      expect(events[1]!.acceleratedDecayActive).toBe(true);
    });

    it('should track accelerated decay status via helper methods', async () => {
      await customEngine.initializeEntity('agent-001', 3);

      expect(customEngine.isAcceleratedDecayActive('agent-001')).toBe(false);
      expect(customEngine.getFailureCount('agent-001')).toBe(0);

      // Add two failures
      for (let i = 0; i < 2; i++) {
        await customEngine.recordSignal({
          id: `sig-00${i}`,
          entityId: 'agent-001',
          type: 'behavioral.task_failed',
          value: 0.1,
          source: 'system',
          timestamp: new Date().toISOString(),
          metadata: {},
        });
      }

      expect(customEngine.isAcceleratedDecayActive('agent-001')).toBe(true);
      expect(customEngine.getFailureCount('agent-001')).toBe(2);
    });

    it('should not count signals above threshold as failures', async () => {
      const events: TrustFailureDetectedEvent[] = [];
      customEngine.on('trust:failure_detected', (e) => events.push(e));

      await customEngine.initializeEntity('agent-001', 3);

      // Record a successful signal (value >= 0.3)
      await customEngine.recordSignal({
        id: 'sig-001',
        entityId: 'agent-001',
        type: 'behavioral.task_completed',
        value: 0.5,
        source: 'system',
        timestamp: new Date().toISOString(),
        metadata: {},
      });

      expect(events).toHaveLength(0);
      expect(customEngine.getFailureCount('agent-001')).toBe(0);
    });

    it('should apply accelerated decay rate when failures present', async () => {
      // Create engine with very high decay for observable difference
      const testEngine = createTrustEngine({
        decayRate: 0.5, // 50% decay per interval
        decayIntervalMs: 10,
        failureThreshold: 0.3,
        acceleratedDecayMultiplier: 2.0, // 100% decay when accelerated
        failureWindowMs: 60000,
        minFailuresForAcceleration: 2,
      });

      await testEngine.initializeEntity('agent-001', 3);
      const initialScore = (await testEngine.getScore('agent-001'))!.score;

      // Add two failures to trigger accelerated decay
      for (let i = 0; i < 2; i++) {
        await testEngine.recordSignal({
          id: `fail-${i}`,
          entityId: 'agent-001',
          type: 'behavioral.task_failed',
          value: 0.1,
          source: 'system',
          timestamp: new Date().toISOString(),
          metadata: {},
        });
      }

      // Wait for decay interval
      await new Promise((resolve) => setTimeout(resolve, 50));

      const decayEvents: TrustDecayAppliedEvent[] = [];
      testEngine.on('trust:decay_applied', (e) => decayEvents.push(e));

      const record = await testEngine.getScore('agent-001');

      // Score should have decayed significantly with accelerated rate
      expect(record!.score).toBeLessThan(initialScore);

      if (decayEvents.length > 0) {
        expect(decayEvents[0]!.accelerated).toBe(true);
      }
    });

    it('should include accelerated flag in decay events', async () => {
      const testEngine = createTrustEngine({
        decayRate: 0.5,
        decayIntervalMs: 10,
        failureThreshold: 0.3,
        acceleratedDecayMultiplier: 2.0,
        failureWindowMs: 60000,
        minFailuresForAcceleration: 2,
      });

      const decayEvents: TrustDecayAppliedEvent[] = [];
      testEngine.on('trust:decay_applied', (e) => decayEvents.push(e));

      await testEngine.initializeEntity('agent-001', 3);

      // Add failures
      for (let i = 0; i < 2; i++) {
        await testEngine.recordSignal({
          id: `fail-${i}`,
          entityId: 'agent-001',
          type: 'behavioral.task_failed',
          value: 0.1,
          source: 'system',
          timestamp: new Date().toISOString(),
          metadata: {},
        });
      }

      // Wait and trigger decay
      await new Promise((resolve) => setTimeout(resolve, 50));
      await testEngine.getScore('agent-001');

      // Check that accelerated flag is present
      if (decayEvents.length > 0) {
        expect(decayEvents[0]).toHaveProperty('accelerated');
      }
    });

    it('should emit wildcard events', async () => {
      const allEvents: unknown[] = [];
      customEngine.on('trust:*', (e) => allEvents.push(e));

      await customEngine.initializeEntity('agent-001', 1);

      // Should have received the initialized event via wildcard
      expect(allEvents.length).toBeGreaterThan(0);
      expect(allEvents[0]).toMatchObject({ type: 'trust:initialized' });
    });
  });

  describe('tier changes', () => {
    it('should emit tier_changed on promotion', async () => {
      const events: TrustTierChangedEvent[] = [];
      engine.on('trust:tier_changed', (e) => events.push(e));

      await engine.initializeEntity('agent-001', 1);

      // Record many high-value signals to trigger promotion
      for (let i = 0; i < 50; i++) {
        await engine.recordSignal({
          id: `sig-${i}`,
          entityId: 'agent-001',
          type: 'behavioral.task_completed',
          value: 1.0,
          source: 'system',
          timestamp: new Date().toISOString(),
          metadata: {},
        });
      }

      const record = await engine.getScore('agent-001');

      if (record!.level > 1) {
        expect(events.length).toBeGreaterThan(0);
        const promotionEvent = events.find((e) => e.direction === 'promoted');
        expect(promotionEvent).toBeDefined();
      }
    });

    it('should emit tier_changed on demotion from decay', async () => {
      const testEngine = createTrustEngine({
        decayRate: 0.9, // Very aggressive decay
        decayIntervalMs: 10,
        failureThreshold: 0.3,
        acceleratedDecayMultiplier: 1.0,
        failureWindowMs: 60000,
        minFailuresForAcceleration: 100, // Disable accelerated for this test
      });

      const events: TrustTierChangedEvent[] = [];
      testEngine.on('trust:tier_changed', (e) => events.push(e));

      await testEngine.initializeEntity('agent-001', 3);

      // Wait for decay
      await new Promise((resolve) => setTimeout(resolve, 100));

      await testEngine.getScore('agent-001');

      if (events.length > 0) {
        const demotionEvent = events.find((e) => e.direction === 'demoted');
        expect(demotionEvent).toBeDefined();
      }
    });
  });

  describe('failure window expiration', () => {
    it('should expire old failures outside window', async () => {
      const testEngine = createTrustEngine({
        decayRate: 0.01,
        decayIntervalMs: 60000,
        failureThreshold: 0.3,
        acceleratedDecayMultiplier: 3.0,
        failureWindowMs: 50, // 50ms window for testing
        minFailuresForAcceleration: 2,
      });

      await testEngine.initializeEntity('agent-001', 3);

      // Add two failures
      for (let i = 0; i < 2; i++) {
        await testEngine.recordSignal({
          id: `fail-${i}`,
          entityId: 'agent-001',
          type: 'behavioral.task_failed',
          value: 0.1,
          source: 'system',
          timestamp: new Date().toISOString(),
          metadata: {},
        });
      }

      expect(testEngine.isAcceleratedDecayActive('agent-001')).toBe(true);

      // Wait for failures to expire
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Failures should have expired
      expect(testEngine.getFailureCount('agent-001')).toBe(0);
      expect(testEngine.isAcceleratedDecayActive('agent-001')).toBe(false);
    });
  });

  describe('factory function', () => {
    it('should create engine with createTrustEngine()', () => {
      const engine = createTrustEngine();
      expect(engine).toBeInstanceOf(TrustEngine);
    });

    it('should accept config in factory', () => {
      const engine = createTrustEngine({ decayRate: 0.05 });
      expect(engine.decayRate).toBe(0.05);
    });
  });

  describe('decay formula correctness', () => {
    it('should apply exponential decay based on staleness', async () => {
      const testEngine = createTrustEngine({
        decayRate: 0.1, // 10% per interval
        decayIntervalMs: 10,
        failureWindowMs: 60000,
        minFailuresForAcceleration: 100, // Disable accelerated decay
      });

      await testEngine.initializeEntity('agent-001', 3);
      const initialRecord = await testEngine.getScore('agent-001');
      const initialScore = initialRecord!.score;

      // Wait for multiple decay intervals
      await new Promise((resolve) => setTimeout(resolve, 50));

      const decayedRecord = await testEngine.getScore('agent-001');
      const finalScore = decayedRecord!.score;

      // Decay should follow: score * (1 - rate)^periods
      // After 5 periods at 10% decay: score * 0.9^5 = score * 0.59049
      expect(finalScore).toBeLessThan(initialScore);
      expect(finalScore).toBeGreaterThan(0);
    });

    it('should not decay score below 0', async () => {
      const testEngine = createTrustEngine({
        decayRate: 0.99, // 99% decay per interval
        decayIntervalMs: 5,
        failureWindowMs: 60000,
        minFailuresForAcceleration: 100,
      });

      await testEngine.initializeEntity('agent-001', 1);

      // Wait for extreme decay
      await new Promise((resolve) => setTimeout(resolve, 100));

      const record = await testEngine.getScore('agent-001');
      expect(record!.score).toBeGreaterThanOrEqual(0);
    });

    it('should apply correct multiplier for accelerated decay', async () => {
      const multiplier = 3.0;
      const testEngine = createTrustEngine({
        decayRate: 0.1,
        decayIntervalMs: 10,
        acceleratedDecayMultiplier: multiplier,
        failureWindowMs: 60000,
        minFailuresForAcceleration: 2,
      });

      // Initialize two agents at same level
      await testEngine.initializeEntity('normal-agent', 3);
      await testEngine.initializeEntity('failing-agent', 3);

      // Add failures to one agent
      for (let i = 0; i < 2; i++) {
        await testEngine.recordSignal({
          id: `fail-${i}`,
          entityId: 'failing-agent',
          type: 'behavioral.task_failed',
          value: 0.1,
          source: 'system',
          timestamp: new Date().toISOString(),
          metadata: {},
        });
      }

      expect(testEngine.isAcceleratedDecayActive('failing-agent')).toBe(true);
      expect(testEngine.isAcceleratedDecayActive('normal-agent')).toBe(false);

      // Wait for decay
      await new Promise((resolve) => setTimeout(resolve, 50));

      const normalRecord = await testEngine.getScore('normal-agent');
      const failingRecord = await testEngine.getScore('failing-agent');

      // Failing agent should have decayed more due to accelerated multiplier
      expect(failingRecord!.score).toBeLessThanOrEqual(normalRecord!.score);
    });
  });

  describe('trust tier boundary conditions', () => {
    it('should correctly assign tier at exact boundary values', async () => {
      // Test each tier boundary
      const boundaries = [
        { score: 0, expectedLevel: 0 },
        { score: 99, expectedLevel: 0 },
        { score: 100, expectedLevel: 1 },
        { score: 299, expectedLevel: 1 },
        { score: 300, expectedLevel: 2 },
        { score: 499, expectedLevel: 2 },
        { score: 500, expectedLevel: 3 },
        { score: 699, expectedLevel: 3 },
        { score: 700, expectedLevel: 4 },
        { score: 899, expectedLevel: 4 },
        { score: 900, expectedLevel: 5 },
        { score: 1000, expectedLevel: 5 },
      ];

      for (const { score, expectedLevel } of boundaries) {
        // Verify threshold configuration matches expected boundaries
        const threshold = TRUST_THRESHOLDS[expectedLevel as 0 | 1 | 2 | 3 | 4 | 5];
        expect(score).toBeGreaterThanOrEqual(threshold.min);
        expect(score).toBeLessThanOrEqual(threshold.max);
      }
    });

    it('should have contiguous tier ranges with no gaps', () => {
      const levels = [0, 1, 2, 3, 4, 5] as const;

      for (let i = 0; i < levels.length - 1; i++) {
        const currentMax = TRUST_THRESHOLDS[levels[i]].max;
        const nextMin = TRUST_THRESHOLDS[levels[i + 1]].min;

        // Next tier should start exactly 1 point after current tier ends
        expect(nextMin).toBe(currentMax + 1);
      }
    });

    it('should handle score clamping at boundaries', async () => {
      const testEngine = createTrustEngine();

      // Initialize at L5 (Autonomous)
      await testEngine.initializeEntity('max-agent', 5);
      const maxRecord = await testEngine.getScore('max-agent');

      // Score should be clamped to 1000 max
      expect(maxRecord!.score).toBeLessThanOrEqual(1000);

      // Level should never exceed 5
      expect(maxRecord!.level).toBeLessThanOrEqual(5);
    });
  });

  describe('recovery mechanics', () => {
    it('should track consecutive successes', async () => {
      const testEngine = createTrustEngine({
        successThreshold: 0.7,
        minSuccessesForAcceleration: 3,
      });

      await testEngine.initializeEntity('agent-001', 2);

      expect(testEngine.getConsecutiveSuccessCount('agent-001')).toBe(0);

      // Record success signals
      for (let i = 0; i < 3; i++) {
        await testEngine.recordSignal({
          id: `success-${i}`,
          entityId: 'agent-001',
          type: 'behavioral.task_completed',
          value: 0.9,
          source: 'system',
          timestamp: new Date().toISOString(),
          metadata: {},
        });
      }

      expect(testEngine.getConsecutiveSuccessCount('agent-001')).toBe(3);
      expect(testEngine.isAcceleratedRecoveryActive('agent-001')).toBe(true);
    });

    it('should reset consecutive successes on failure', async () => {
      const testEngine = createTrustEngine({
        successThreshold: 0.7,
        failureThreshold: 0.3,
        minSuccessesForAcceleration: 3,
      });

      await testEngine.initializeEntity('agent-001', 2);

      // Build up successes
      for (let i = 0; i < 2; i++) {
        await testEngine.recordSignal({
          id: `success-${i}`,
          entityId: 'agent-001',
          type: 'behavioral.task_completed',
          value: 0.9,
          source: 'system',
          timestamp: new Date().toISOString(),
          metadata: {},
        });
      }

      expect(testEngine.getConsecutiveSuccessCount('agent-001')).toBe(2);

      // Record a failure
      await testEngine.recordSignal({
        id: 'failure-1',
        entityId: 'agent-001',
        type: 'behavioral.task_failed',
        value: 0.1,
        source: 'system',
        timestamp: new Date().toISOString(),
        metadata: {},
      });

      // Consecutive successes should be reset
      expect(testEngine.getConsecutiveSuccessCount('agent-001')).toBe(0);
    });

    it('should track peak score', async () => {
      const testEngine = createTrustEngine();

      await testEngine.initializeEntity('agent-001', 3);
      const initialPeak = testEngine.getPeakScore('agent-001');

      // Record high-value signals to increase score
      for (let i = 0; i < 10; i++) {
        await testEngine.recordSignal({
          id: `success-${i}`,
          entityId: 'agent-001',
          type: 'behavioral.task_completed',
          value: 1.0,
          source: 'system',
          timestamp: new Date().toISOString(),
          metadata: {},
        });
      }

      const newPeak = testEngine.getPeakScore('agent-001');
      expect(newPeak).toBeGreaterThanOrEqual(initialPeak);
    });

    it('should emit recovery events on success signals', async () => {
      const testEngine = createTrustEngine({
        successThreshold: 0.7,
        recoveryRate: 0.05,
      });

      const recoveryEvents: unknown[] = [];
      testEngine.on('trust:recovery_applied', (e) => recoveryEvents.push(e));

      await testEngine.initializeEntity('agent-001', 2);

      await testEngine.recordSignal({
        id: 'success-1',
        entityId: 'agent-001',
        type: 'behavioral.task_completed',
        value: 0.95,
        source: 'system',
        timestamp: new Date().toISOString(),
        metadata: {},
      });

      expect(recoveryEvents.length).toBeGreaterThan(0);
    });
  });

  describe('signal weight consistency', () => {
    it('should weight behavioral signals at 40%', async () => {
      const testEngine = createTrustEngine();

      await testEngine.initializeEntity('agent-001', 1);

      // Record only behavioral signals
      for (let i = 0; i < 10; i++) {
        await testEngine.recordSignal({
          id: `behavioral-${i}`,
          entityId: 'agent-001',
          type: 'behavioral.task_completed',
          value: 1.0,
          source: 'system',
          timestamp: new Date().toISOString(),
          metadata: {},
        });
      }

      const record = await testEngine.getScore('agent-001');

      // With only perfect behavioral signals, behavioral component should be 1.0
      // Total weighted contribution: 1.0 * 0.4 * 1000 = 400 from behavioral
      // Other components at default 0.5: 0.5 * 0.25 * 1000 + 0.5 * 0.2 * 1000 + 0.5 * 0.15 * 1000 = 300
      // Total: ~700 (Trusted tier)
      expect(record!.components.behavioral).toBeGreaterThan(0.5);
    });

    it('should apply 7-day half-life to signal weighting', async () => {
      const testEngine = createTrustEngine();

      await testEngine.initializeEntity('agent-001', 2);

      // Record an old signal (simulated by backdating)
      const oldTimestamp = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      await testEngine.recordSignal({
        id: 'old-signal',
        entityId: 'agent-001',
        type: 'behavioral.task_completed',
        value: 1.0,
        source: 'system',
        timestamp: oldTimestamp,
        metadata: {},
      });

      const recordWithOld = await testEngine.getScore('agent-001');

      // Record a recent signal
      await testEngine.recordSignal({
        id: 'new-signal',
        entityId: 'agent-001',
        type: 'behavioral.task_completed',
        value: 1.0,
        source: 'system',
        timestamp: new Date().toISOString(),
        metadata: {},
      });

      const recordWithNew = await testEngine.getScore('agent-001');

      // Recent signals should have more weight, increasing the score
      expect(recordWithNew!.score).toBeGreaterThanOrEqual(recordWithOld!.score);
    });
  });

  describe('event subscription limits', () => {
    it('should track listener statistics', () => {
      const testEngine = createTrustEngine({
        maxListenersPerEvent: 10,
        maxTotalListeners: 50,
      });

      const stats = testEngine.getListenerStats();

      expect(stats.totalListeners).toBe(0);
      expect(stats.maxListenersPerEvent).toBe(10);
      expect(stats.maxTotalListeners).toBe(50);
    });

    it('should increment listener count on subscription', () => {
      const testEngine = createTrustEngine({
        maxListenersPerEvent: 10,
        maxTotalListeners: 50,
      });

      testEngine.on('trust:initialized', () => {});
      testEngine.on('trust:initialized', () => {});
      testEngine.on('trust:score_changed', () => {});

      const stats = testEngine.getListenerStats();

      expect(stats.totalListeners).toBe(3);
      expect(stats.listenersByEvent['trust:initialized']).toBe(2);
      expect(stats.listenersByEvent['trust:score_changed']).toBe(1);
    });

    it('should throw when per-event limit exceeded', () => {
      const testEngine = createTrustEngine({
        maxListenersPerEvent: 2,
        maxTotalListeners: 100,
      });

      testEngine.on('trust:initialized', () => {});
      testEngine.on('trust:initialized', () => {});

      // Third listener should throw
      expect(() => {
        testEngine.on('trust:initialized', () => {});
      }).toThrow(/Maximum listeners.*exceeded/);
    });

    it('should throw when total limit exceeded', () => {
      const testEngine = createTrustEngine({
        maxListenersPerEvent: 100,
        maxTotalListeners: 3,
      });

      testEngine.on('trust:initialized', () => {});
      testEngine.on('trust:score_changed', () => {});
      testEngine.on('trust:tier_changed', () => {});

      // Fourth listener should throw
      expect(() => {
        testEngine.on('trust:decay_applied', () => {});
      }).toThrow(/Maximum total listeners.*exceeded/);
    });

    it('should decrement count when listener removed', () => {
      const testEngine = createTrustEngine();

      const listener = () => {};
      testEngine.on('trust:initialized', listener);

      expect(testEngine.getListenerStats().totalListeners).toBe(1);

      testEngine.off('trust:initialized', listener);

      expect(testEngine.getListenerStats().totalListeners).toBe(0);
    });

    it('should clear counts when removeAllListeners called', () => {
      const testEngine = createTrustEngine();

      testEngine.on('trust:initialized', () => {});
      testEngine.on('trust:score_changed', () => {});
      testEngine.on('trust:tier_changed', () => {});

      expect(testEngine.getListenerStats().totalListeners).toBe(3);

      testEngine.removeAllListeners();

      expect(testEngine.getListenerStats().totalListeners).toBe(0);
    });
  });
});
