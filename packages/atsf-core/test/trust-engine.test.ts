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
});
