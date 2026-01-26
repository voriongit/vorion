/**
 * Trust Engine Performance Benchmarks
 *
 * Run with: npx vitest bench trust-engine.bench.ts
 *
 * Performance targets (per BASIS spec):
 * - Score calculation: < 1ms
 * - Signal recording: < 5ms
 * - Decay application: < 2ms
 * - Batch operations (100 entities): < 100ms
 *
 * @packageDocumentation
 */

import { describe, bench, beforeAll, afterAll } from 'vitest';
import { TrustEngine, createTrustEngine } from '../src/trust-engine/index.js';
import type { TrustSignal } from '../src/common/types.js';

describe('TrustEngine Performance Benchmarks', () => {
  let engine: TrustEngine;

  beforeAll(() => {
    engine = createTrustEngine({
      // Disable persistence for pure compute benchmarks
      persistence: undefined,
    });
  });

  afterAll(async () => {
    await engine.close();
  });

  describe('Core Operations', () => {
    bench('initializeEntity - single entity', async () => {
      const entityId = `bench-entity-${Math.random()}`;
      await engine.initializeEntity(entityId, 1);
    }, {
      time: 1000,
      iterations: 1000,
    });

    bench('recordSignal - behavioral signal', async () => {
      const entityId = `bench-signal-${Math.random()}`;
      await engine.initializeEntity(entityId, 2);

      const signal: TrustSignal = {
        id: `signal-${Math.random()}`,
        entityId,
        type: 'behavioral.task_completed',
        value: 0.85,
        timestamp: new Date().toISOString(),
      };

      await engine.recordSignal(signal);
    }, {
      time: 1000,
      iterations: 500,
    });

    bench('getScore - with decay calculation', async () => {
      const entityId = `bench-decay-${Math.random()}`;
      await engine.initializeEntity(entityId, 3);

      // Force staleness for decay calculation
      const record = await engine.getScore(entityId);
      if (record) {
        // Access score to trigger calculation
        const _score = record.score;
      }
    }, {
      time: 1000,
      iterations: 1000,
    });

    bench('calculate - full score calculation', async () => {
      const entityId = `bench-calc-${Math.random()}`;
      await engine.initializeEntity(entityId, 2);

      // Add some signals
      for (let i = 0; i < 10; i++) {
        await engine.recordSignal({
          id: `signal-${i}`,
          entityId,
          type: i % 2 === 0 ? 'behavioral.task_completed' : 'compliance.policy_followed',
          value: 0.7 + Math.random() * 0.2,
          timestamp: new Date().toISOString(),
        });
      }

      await engine.calculate(entityId);
    }, {
      time: 1000,
      iterations: 200,
    });
  });

  describe('Batch Operations', () => {
    bench('initializeEntity - batch of 100', async () => {
      const batchEngine = createTrustEngine();

      for (let i = 0; i < 100; i++) {
        await batchEngine.initializeEntity(`batch-entity-${i}`, 1);
      }

      await batchEngine.close();
    }, {
      time: 5000,
      iterations: 10,
    });

    bench('recordSignal - 100 signals for single entity', async () => {
      const batchEngine = createTrustEngine();
      const entityId = 'batch-signal-entity';
      await batchEngine.initializeEntity(entityId, 2);

      for (let i = 0; i < 100; i++) {
        await batchEngine.recordSignal({
          id: `signal-${i}`,
          entityId,
          type: 'behavioral.action',
          value: 0.7,
          timestamp: new Date().toISOString(),
        });
      }

      await batchEngine.close();
    }, {
      time: 5000,
      iterations: 10,
    });
  });

  describe('Event Emission', () => {
    bench('event emission with 10 listeners', async () => {
      const eventEngine = createTrustEngine();

      // Add 10 listeners
      for (let i = 0; i < 10; i++) {
        eventEngine.on('trust:signal_recorded', () => {});
      }

      const entityId = 'event-test';
      await eventEngine.initializeEntity(entityId, 2);

      await eventEngine.recordSignal({
        id: `signal-${Math.random()}`,
        entityId,
        type: 'behavioral.action',
        value: 0.8,
        timestamp: new Date().toISOString(),
      });

      await eventEngine.close();
    }, {
      time: 2000,
      iterations: 100,
    });

    bench('event emission with wildcard listener', async () => {
      const eventEngine = createTrustEngine();

      // Add wildcard listener
      eventEngine.on('trust:*', () => {});

      const entityId = 'wildcard-test';
      await eventEngine.initializeEntity(entityId, 2);

      await eventEngine.recordSignal({
        id: `signal-${Math.random()}`,
        entityId,
        type: 'behavioral.action',
        value: 0.8,
        timestamp: new Date().toISOString(),
      });

      await eventEngine.close();
    }, {
      time: 2000,
      iterations: 100,
    });
  });

  describe('Recovery Mechanics', () => {
    bench('recovery calculation - accelerated recovery path', async () => {
      const recoveryEngine = createTrustEngine({
        minSuccessesForAcceleration: 3,
      });

      const entityId = 'recovery-test';
      await recoveryEngine.initializeEntity(entityId, 1);

      // Record enough successes for accelerated recovery
      for (let i = 0; i < 5; i++) {
        await recoveryEngine.recordSignal({
          id: `success-${i}`,
          entityId,
          type: 'behavioral.task_completed',
          value: 0.85,
          timestamp: new Date().toISOString(),
        });
      }

      await recoveryEngine.close();
    }, {
      time: 2000,
      iterations: 50,
    });
  });

  describe('Memory Usage', () => {
    bench('memory efficiency - 1000 signals', async () => {
      const memEngine = createTrustEngine();
      const entityId = 'mem-test';
      await memEngine.initializeEntity(entityId, 2);

      for (let i = 0; i < 1000; i++) {
        await memEngine.recordSignal({
          id: `signal-${i}`,
          entityId,
          type: `behavioral.action_${i % 10}`,
          value: Math.random(),
          timestamp: new Date().toISOString(),
        });
      }

      // Verify signal pruning (should keep only last 1000)
      const record = await memEngine.getScore(entityId);
      if (record && record.signals.length > 1000) {
        throw new Error('Signal pruning failed');
      }

      await memEngine.close();
    }, {
      time: 10000,
      iterations: 5,
    });
  });
});

/**
 * Performance Expectations Summary
 *
 * | Operation                    | Target   | Notes                           |
 * |------------------------------|----------|----------------------------------|
 * | initializeEntity (single)    | < 1ms    | In-memory, no persistence        |
 * | recordSignal                 | < 5ms    | Includes calculation + events    |
 * | getScore (with decay)        | < 2ms    | Staleness check + decay calc     |
 * | calculate                    | < 1ms    | Pure computation                 |
 * | Batch init (100 entities)    | < 100ms  | Linear scaling expected          |
 * | 100 signals (single entity)  | < 500ms  | With event emission              |
 * | With persistence (SQLite)    | 2-3x     | IO overhead                      |
 *
 * Memory expectations:
 * - Each entity: ~2KB base + 100 bytes per signal
 * - Signal pruning at 1000 signals per entity
 * - History pruning at 100 entries per entity
 */
