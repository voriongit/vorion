/**
 * Provenance Tracking Tests
 *
 * Comprehensive tests for the provenance tracking system including:
 * - Tracking tests
 * - Chain verification tests
 * - Tamper detection tests
 * - Query tests
 * - Storage tests (in-memory)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  ProvenanceTracker,
  createProvenanceTracker,
  ProvenanceChain,
  createProvenanceChain,
  InMemoryProvenanceStorage,
  createInMemoryStorage,
  ProvenanceQueryBuilder,
  createQueryBuilder,
  type ProvenanceRecord,
  type Actor,
  type ProvenanceStorage,
} from '../../../src/common/provenance/index.js';

// Mock the audit module
vi.mock('../../../src/intent/audit.js', () => ({
  recordAudit: vi.fn(),
}));

// Mock OpenTelemetry tracer
vi.mock('@opentelemetry/api', () => ({
  trace: {
    getTracer: () => ({
      startActiveSpan: async (_name: string, fn: (span: { setAttribute: () => void; setStatus: () => void; end: () => void }) => Promise<unknown>) => {
        const mockSpan = {
          setAttribute: vi.fn(),
          setStatus: vi.fn(),
          end: vi.fn(),
        };
        return fn(mockSpan);
      },
    }),
  },
  SpanStatusCode: {
    OK: 0,
    ERROR: 1,
  },
}));

describe('Provenance Tracking Module', () => {
  // =============================================================================
  // STORAGE TESTS
  // =============================================================================
  describe('InMemoryProvenanceStorage', () => {
    let storage: InMemoryProvenanceStorage;
    const tenantId = randomUUID();

    beforeEach(() => {
      storage = createInMemoryStorage();
    });

    const createTestRecord = (overrides?: Partial<ProvenanceRecord>): ProvenanceRecord => ({
      id: randomUUID(),
      entityId: randomUUID(),
      entityType: 'intent',
      action: 'create',
      data: { test: 'data' },
      actor: { id: randomUUID(), type: 'user', metadata: {} },
      hash: 'testhash123',
      previousHash: '',
      chainPosition: 1,
      tenantId,
      createdAt: new Date().toISOString(),
      ...overrides,
    });

    describe('save', () => {
      it('should save a provenance record', async () => {
        const record = createTestRecord();
        const saved = await storage.save(record);

        expect(saved).toBeDefined();
        expect(saved.id).toBe(record.id);
        expect(saved.entityId).toBe(record.entityId);
        expect(saved.action).toBe(record.action);
      });

      it('should generate id if not provided', async () => {
        const record = createTestRecord();
        delete (record as Partial<ProvenanceRecord>).id;

        const saved = await storage.save(record as ProvenanceRecord);

        expect(saved.id).toBeDefined();
        expect(saved.id.length).toBeGreaterThan(0);
      });
    });

    describe('saveBatch', () => {
      it('should save multiple records', async () => {
        const records = [createTestRecord(), createTestRecord(), createTestRecord()];
        const saved = await storage.saveBatch(records);

        expect(saved).toHaveLength(3);
        saved.forEach((record, i) => {
          expect(record.id).toBe(records[i].id);
        });
      });

      it('should handle empty batch', async () => {
        const saved = await storage.saveBatch([]);
        expect(saved).toHaveLength(0);
      });
    });

    describe('getById', () => {
      it('should retrieve record by id', async () => {
        const record = createTestRecord();
        await storage.save(record);

        const retrieved = await storage.getById(record.id, tenantId);

        expect(retrieved).not.toBeNull();
        expect(retrieved?.id).toBe(record.id);
      });

      it('should return null for non-existent id', async () => {
        const retrieved = await storage.getById(randomUUID(), tenantId);
        expect(retrieved).toBeNull();
      });

      it('should return null for wrong tenant', async () => {
        const record = createTestRecord();
        await storage.save(record);

        const retrieved = await storage.getById(record.id, randomUUID());
        expect(retrieved).toBeNull();
      });
    });

    describe('getByEntityId', () => {
      it('should retrieve records for an entity', async () => {
        const entityId = randomUUID();
        const records = [
          createTestRecord({ entityId, chainPosition: 1 }),
          createTestRecord({ entityId, chainPosition: 2 }),
          createTestRecord({ entityId, chainPosition: 3 }),
        ];

        for (const record of records) {
          await storage.save(record);
        }

        const result = await storage.getByEntityId(entityId, tenantId);

        expect(result.items).toHaveLength(3);
        expect(result.total).toBe(3);
        expect(result.hasMore).toBe(false);
      });

      it('should return records sorted by chain position descending', async () => {
        const entityId = randomUUID();
        const records = [
          createTestRecord({ entityId, chainPosition: 1 }),
          createTestRecord({ entityId, chainPosition: 3 }),
          createTestRecord({ entityId, chainPosition: 2 }),
        ];

        for (const record of records) {
          await storage.save(record);
        }

        const result = await storage.getByEntityId(entityId, tenantId);

        expect(result.items[0].chainPosition).toBe(3);
        expect(result.items[1].chainPosition).toBe(2);
        expect(result.items[2].chainPosition).toBe(1);
      });

      it('should support pagination', async () => {
        const entityId = randomUUID();
        for (let i = 1; i <= 5; i++) {
          await storage.save(createTestRecord({ entityId, chainPosition: i }));
        }

        const page1 = await storage.getByEntityId(entityId, tenantId, { limit: 2, offset: 0 });
        const page2 = await storage.getByEntityId(entityId, tenantId, { limit: 2, offset: 2 });

        expect(page1.items).toHaveLength(2);
        expect(page1.hasMore).toBe(true);
        expect(page2.items).toHaveLength(2);
        expect(page2.hasMore).toBe(true);
      });
    });

    describe('query', () => {
      beforeEach(async () => {
        const records = [
          createTestRecord({ entityType: 'intent', action: 'create' }),
          createTestRecord({ entityType: 'intent', action: 'update' }),
          createTestRecord({ entityType: 'policy', action: 'create' }),
          createTestRecord({
            entityType: 'agent',
            action: 'create',
            actor: { id: 'actor1', type: 'system', metadata: {} },
          }),
        ];

        for (const record of records) {
          await storage.save(record);
        }
      });

      it('should filter by entity type', async () => {
        const result = await storage.query({ tenantId, entityType: 'intent' });
        expect(result.items).toHaveLength(2);
        result.items.forEach((item) => expect(item.entityType).toBe('intent'));
      });

      it('should filter by action', async () => {
        const result = await storage.query({ tenantId, action: 'create' });
        expect(result.items).toHaveLength(3);
        result.items.forEach((item) => expect(item.action).toBe('create'));
      });

      it('should filter by actor type', async () => {
        const result = await storage.query({ tenantId, actorType: 'system' });
        expect(result.items).toHaveLength(1);
        expect(result.items[0].actor.type).toBe('system');
      });

      it('should filter by time range', async () => {
        const now = new Date();
        const past = new Date(now.getTime() - 10000);
        const future = new Date(now.getTime() + 10000);

        const result = await storage.query({
          tenantId,
          from: past,
          to: future,
        });

        expect(result.items.length).toBeGreaterThan(0);
      });

      it('should combine multiple filters', async () => {
        const result = await storage.query({
          tenantId,
          entityType: 'intent',
          action: 'create',
        });

        expect(result.items).toHaveLength(1);
        expect(result.items[0].entityType).toBe('intent');
        expect(result.items[0].action).toBe('create');
      });
    });

    describe('deleteByEntityId', () => {
      it('should delete all records for an entity', async () => {
        const entityId = randomUUID();
        await storage.save(createTestRecord({ entityId }));
        await storage.save(createTestRecord({ entityId }));

        const deleted = await storage.deleteByEntityId(entityId, tenantId);

        expect(deleted).toBe(2);

        const result = await storage.getByEntityId(entityId, tenantId);
        expect(result.items).toHaveLength(0);
      });
    });

    describe('clear', () => {
      it('should remove all records', async () => {
        await storage.save(createTestRecord());
        await storage.save(createTestRecord());

        await storage.clear();

        const result = await storage.query({ tenantId });
        expect(result.items).toHaveLength(0);
      });
    });
  });

  // =============================================================================
  // TRACKER TESTS
  // =============================================================================
  describe('ProvenanceTracker', () => {
    let storage: ProvenanceStorage;
    let tracker: ProvenanceTracker;
    const tenantId = randomUUID();

    beforeEach(() => {
      storage = createInMemoryStorage();
      tracker = createProvenanceTracker(storage);
    });

    const createTestActor = (overrides?: Partial<Actor>): Actor => ({
      id: randomUUID(),
      type: 'user',
      metadata: { role: 'admin' },
      ...overrides,
    });

    describe('track', () => {
      it('should create a provenance record', async () => {
        const actor = createTestActor();
        const data = { id: randomUUID(), name: 'Test Entity' };

        const record = await tracker.track('intent', 'create', data, actor, tenantId);

        expect(record).toBeDefined();
        expect(record.entityType).toBe('intent');
        expect(record.action).toBe('create');
        expect(record.actor.id).toBe(actor.id);
        expect(record.data).toEqual(data);
        expect(record.chainPosition).toBe(1);
        expect(record.previousHash).toBe('');
        expect(record.hash).toBeDefined();
      });

      it('should chain records for the same entity', async () => {
        const actor = createTestActor();
        const entityId = randomUUID();
        const data = { id: entityId, name: 'Test Entity' };

        const record1 = await tracker.track('intent', 'create', data, actor, tenantId);
        const record2 = await tracker.track(
          'intent',
          'update',
          { ...data, name: 'Updated' },
          actor,
          tenantId
        );

        expect(record1.chainPosition).toBe(1);
        expect(record2.chainPosition).toBe(2);
        expect(record2.previousHash).toBe(record1.hash);
      });

      it('should include metadata when provided', async () => {
        const actor = createTestActor();
        const metadata = { source: 'api', version: '1.0' };

        const record = await tracker.track(
          'intent',
          'create',
          { id: randomUUID() },
          actor,
          tenantId,
          metadata
        );

        expect(record.metadata).toEqual(metadata);
      });

      it('should handle different actor types', async () => {
        const systemActor = createTestActor({ type: 'system' });
        const agentActor = createTestActor({ type: 'agent' });
        const userActor = createTestActor({ type: 'user' });

        const r1 = await tracker.track('intent', 'create', { id: '1' }, systemActor, tenantId);
        const r2 = await tracker.track('intent', 'create', { id: '2' }, agentActor, tenantId);
        const r3 = await tracker.track('intent', 'create', { id: '3' }, userActor, tenantId);

        expect(r1.actor.type).toBe('system');
        expect(r2.actor.type).toBe('agent');
        expect(r3.actor.type).toBe('user');
      });
    });

    describe('getHistory', () => {
      it('should return complete history for an entity', async () => {
        const actor = createTestActor();
        const entityId = randomUUID();

        await tracker.track('intent', 'create', { id: entityId }, actor, tenantId);
        await tracker.track('intent', 'update', { id: entityId, v: 2 }, actor, tenantId);
        await tracker.track('intent', 'update', { id: entityId, v: 3 }, actor, tenantId);

        const history = await tracker.getHistory(entityId, tenantId);

        expect(history).toHaveLength(3);
      });

      it('should return empty array for non-existent entity', async () => {
        const history = await tracker.getHistory(randomUUID(), tenantId);
        expect(history).toHaveLength(0);
      });
    });

    describe('getRecord', () => {
      it('should return a specific record', async () => {
        const actor = createTestActor();
        const created = await tracker.track(
          'intent',
          'create',
          { id: randomUUID() },
          actor,
          tenantId
        );

        const record = await tracker.getRecord(created.id, tenantId);

        expect(record).not.toBeNull();
        expect(record?.id).toBe(created.id);
      });

      it('should return null for non-existent record', async () => {
        const record = await tracker.getRecord(randomUUID(), tenantId);
        expect(record).toBeNull();
      });
    });

    describe('trackBatch', () => {
      it('should track multiple records', async () => {
        const actor = createTestActor();
        const records = [
          {
            entityId: randomUUID(),
            entityType: 'intent',
            action: 'create',
            data: { name: 'Entity 1' },
            actor,
            tenantId,
          },
          {
            entityId: randomUUID(),
            entityType: 'policy',
            action: 'create',
            data: { name: 'Entity 2' },
            actor,
            tenantId,
          },
        ];

        const results = await tracker.trackBatch(records);

        expect(results).toHaveLength(2);
        expect(results[0].entityType).toBe('intent');
        expect(results[1].entityType).toBe('policy');
      });
    });
  });

  // =============================================================================
  // CHAIN TESTS
  // =============================================================================
  describe('ProvenanceChain', () => {
    let storage: ProvenanceStorage;
    let tracker: ProvenanceTracker;
    let chain: ProvenanceChain;
    const tenantId = randomUUID();

    beforeEach(() => {
      storage = createInMemoryStorage();
      tracker = createProvenanceTracker(storage);
      chain = createProvenanceChain();
    });

    const createTestActor = (): Actor => ({
      id: randomUUID(),
      type: 'user',
      metadata: {},
    });

    describe('verify', () => {
      it('should verify a valid chain', async () => {
        const actor = createTestActor();
        const entityId = randomUUID();

        await tracker.track('intent', 'create', { id: entityId }, actor, tenantId);
        await tracker.track('intent', 'update', { id: entityId, v: 2 }, actor, tenantId);
        await tracker.track('intent', 'update', { id: entityId, v: 3 }, actor, tenantId);

        const history = await tracker.getHistory(entityId, tenantId);
        const result = await chain.verify(history);

        expect(result.valid).toBe(true);
        expect(result.recordsVerified).toBe(3);
        expect(result.error).toBeUndefined();
      });

      it('should verify an empty chain', async () => {
        const result = await chain.verify([]);

        expect(result.valid).toBe(true);
        expect(result.recordsVerified).toBe(0);
      });

      it('should detect invalid first record', async () => {
        const actor = createTestActor();
        const entityId = randomUUID();

        await tracker.track('intent', 'create', { id: entityId }, actor, tenantId);

        const history = await tracker.getHistory(entityId, tenantId);

        // Tamper with first record's previous hash
        history[0].previousHash = 'tampered';

        const result = await chain.verify(history);

        expect(result.valid).toBe(false);
        expect(result.invalidAtPosition).toBe(1);
        expect(result.error).toContain('First record');
      });

      it('should detect hash mismatch', async () => {
        const actor = createTestActor();
        const entityId = randomUUID();

        await tracker.track('intent', 'create', { id: entityId }, actor, tenantId);
        await tracker.track('intent', 'update', { id: entityId, v: 2 }, actor, tenantId);

        const history = await tracker.getHistory(entityId, tenantId);

        // Tamper with record data
        history[0].data = { tampered: true };

        const result = await chain.verify(history);

        expect(result.valid).toBe(false);
        expect(result.error).toContain('Hash mismatch');
      });

      it('should detect broken chain linkage', async () => {
        const actor = createTestActor();
        const entityId = randomUUID();

        await tracker.track('intent', 'create', { id: entityId }, actor, tenantId);
        await tracker.track('intent', 'update', { id: entityId, v: 2 }, actor, tenantId);

        const history = await tracker.getHistory(entityId, tenantId);

        // Break chain linkage
        const sortedHistory = history.sort((a, b) => a.chainPosition - b.chainPosition);
        sortedHistory[1].previousHash = 'wrong-hash';

        const result = await chain.verify(sortedHistory);

        expect(result.valid).toBe(false);
        // When previousHash is modified, the hash check fails first because
        // the expected hash is calculated from record content including previousHash
        expect(result.error).toMatch(/Hash mismatch|Chain linkage broken/);
      });
    });

    describe('detectTampering', () => {
      it('should return no tampering for valid chain', async () => {
        const actor = createTestActor();
        const entityId = randomUUID();

        await tracker.track('intent', 'create', { id: entityId }, actor, tenantId);
        await tracker.track('intent', 'update', { id: entityId, v: 2 }, actor, tenantId);

        const history = await tracker.getHistory(entityId, tenantId);
        const result = await chain.detectTampering(history);

        expect(result.tampered).toBe(false);
        expect(result.details).toBeUndefined();
      });

      it('should detect content tampering', async () => {
        const actor = createTestActor();
        const entityId = randomUUID();

        await tracker.track('intent', 'create', { id: entityId }, actor, tenantId);

        const history = await tracker.getHistory(entityId, tenantId);

        // Tamper with record
        history[0].data = { tampered: true };

        const result = await chain.detectTampering(history);

        expect(result.tampered).toBe(true);
        expect(result.details).toBeDefined();
        expect(result.details?.length).toBeGreaterThan(0);
        expect(result.details?.[0].reason).toContain('hash mismatch');
      });

      it('should detect chain linkage tampering', async () => {
        const actor = createTestActor();
        const entityId = randomUUID();

        await tracker.track('intent', 'create', { id: entityId }, actor, tenantId);
        await tracker.track('intent', 'update', { id: entityId, v: 2 }, actor, tenantId);

        const history = await tracker.getHistory(entityId, tenantId);
        const sortedHistory = history.sort((a, b) => a.chainPosition - b.chainPosition);

        // Break chain linkage
        sortedHistory[1].previousHash = 'tampered';

        const result = await chain.detectTampering(sortedHistory);

        expect(result.tampered).toBe(true);
        expect(result.details?.some((d) => d.reason.includes('previous hash'))).toBe(true);
      });

      it('should handle empty chain', async () => {
        const result = await chain.detectTampering([]);

        expect(result.tampered).toBe(false);
        expect(result.details).toBeUndefined();
      });
    });

    describe('getLastHash', () => {
      it('should return last hash in chain', async () => {
        const actor = createTestActor();
        const entityId = randomUUID();

        const r1 = await tracker.track('intent', 'create', { id: entityId }, actor, tenantId);
        const r2 = await tracker.track('intent', 'update', { id: entityId, v: 2 }, actor, tenantId);

        const history = await tracker.getHistory(entityId, tenantId);
        const lastHash = chain.getLastHash(history);

        expect(lastHash).toBe(r2.hash);
      });

      it('should return empty string for empty chain', () => {
        const lastHash = chain.getLastHash([]);
        expect(lastHash).toBe('');
      });
    });

    describe('getNextPosition', () => {
      it('should return next position', async () => {
        const actor = createTestActor();
        const entityId = randomUUID();

        await tracker.track('intent', 'create', { id: entityId }, actor, tenantId);
        await tracker.track('intent', 'update', { id: entityId, v: 2 }, actor, tenantId);

        const history = await tracker.getHistory(entityId, tenantId);
        const nextPos = chain.getNextPosition(history);

        expect(nextPos).toBe(3);
      });

      it('should return 1 for empty chain', () => {
        const nextPos = chain.getNextPosition([]);
        expect(nextPos).toBe(1);
      });
    });
  });

  // =============================================================================
  // QUERY BUILDER TESTS
  // =============================================================================
  describe('ProvenanceQueryBuilder', () => {
    let storage: ProvenanceStorage;
    let tracker: ProvenanceTracker;
    let queryBuilder: ProvenanceQueryBuilder;
    const tenantId = randomUUID();

    beforeEach(async () => {
      storage = createInMemoryStorage();
      tracker = createProvenanceTracker(storage);
      queryBuilder = createQueryBuilder(storage);

      // Seed test data
      const userActor: Actor = { id: 'user1', type: 'user', metadata: {} };
      const systemActor: Actor = { id: 'system1', type: 'system', metadata: {} };

      await tracker.track('intent', 'create', { id: 'e1' }, userActor, tenantId);
      await tracker.track('intent', 'update', { id: 'e1' }, userActor, tenantId);
      await tracker.track('policy', 'create', { id: 'e2' }, systemActor, tenantId);
      await tracker.track('agent', 'create', { id: 'e3' }, systemActor, tenantId);
    });

    describe('execute', () => {
      it('should execute query with filters', async () => {
        const result = await queryBuilder.inTenant(tenantId).ofType('intent').execute();

        expect(result.items).toHaveLength(2);
        result.items.forEach((item) => expect(item.entityType).toBe('intent'));
      });

      it('should support chained filters', async () => {
        const result = await queryBuilder
          .inTenant(tenantId)
          .ofType('intent')
          .withAction('create')
          .execute();

        expect(result.items).toHaveLength(1);
        expect(result.items[0].action).toBe('create');
      });
    });

    describe('pagination', () => {
      it('should support limit and offset', async () => {
        const result = await queryBuilder.inTenant(tenantId).limit(2).offset(0).execute();

        expect(result.items).toHaveLength(2);
        expect(result.limit).toBe(2);
        expect(result.offset).toBe(0);
      });

      it('should support page method', async () => {
        const page1 = await queryBuilder.inTenant(tenantId).page(1, 2).execute();
        const page2 = await queryBuilder.clone().inTenant(tenantId).page(2, 2).execute();

        expect(page1.items).toHaveLength(2);
        expect(page1.offset).toBe(0);
        expect(page2.items).toHaveLength(2);
        expect(page2.offset).toBe(2);
      });
    });

    describe('all', () => {
      it('should return all matching records', async () => {
        const records = await queryBuilder.inTenant(tenantId).all();
        expect(records).toHaveLength(4);
      });
    });

    describe('first', () => {
      it('should return first matching record', async () => {
        const record = await queryBuilder.inTenant(tenantId).ofType('policy').first();

        expect(record).not.toBeNull();
        expect(record?.entityType).toBe('policy');
      });

      it('should return null when no match', async () => {
        const record = await queryBuilder.inTenant(tenantId).ofType('nonexistent').first();
        expect(record).toBeNull();
      });
    });

    describe('count', () => {
      it('should return count of matching records', async () => {
        const count = await queryBuilder.inTenant(tenantId).count();
        expect(count).toBe(4);
      });

      it('should respect filters for count', async () => {
        const count = await queryBuilder.inTenant(tenantId).ofType('intent').count();
        expect(count).toBe(2);
      });
    });

    describe('export', () => {
      it('should export to JSON format', async () => {
        // Export uses all() which gets all records, so we expect all 4 records
        const json = await queryBuilder.inTenant(tenantId).export('json');

        const parsed = JSON.parse(json);
        expect(parsed.exportedAt).toBeDefined();
        expect(parsed.recordCount).toBe(4);
        expect(parsed.records).toHaveLength(4);
      });

      it('should export to CSV format', async () => {
        // Export uses all() which gets all records, so we expect all 4 records
        const csv = await queryBuilder.inTenant(tenantId).export('csv');

        const lines = csv.split('\n');
        expect(lines.length).toBe(5); // Header + 4 records
        expect(lines[0]).toContain('id');
        expect(lines[0]).toContain('entityId');
        expect(lines[0]).toContain('action');
      });

      it('should handle empty results for CSV', async () => {
        const csv = await queryBuilder.inTenant(randomUUID()).export('csv');

        // CSV with no results still has header line, split creates empty string at end
        const lines = csv.split('\n').filter(line => line.length > 0);
        expect(lines.length).toBe(1); // Header only
        expect(lines[0]).toContain('id');
      });
    });

    describe('clone', () => {
      it('should create independent copy', async () => {
        const original = queryBuilder.inTenant(tenantId).ofType('intent');
        const cloned = original.clone().withAction('create');

        const originalResult = await original.execute();
        const clonedResult = await cloned.execute();

        expect(originalResult.items).toHaveLength(2);
        expect(clonedResult.items).toHaveLength(1);
      });
    });

    describe('reset', () => {
      it('should clear all filters', async () => {
        const builder = queryBuilder.inTenant(tenantId).ofType('intent').withAction('create');
        builder.reset();
        builder.inTenant(tenantId);

        const result = await builder.execute();
        expect(result.items).toHaveLength(4);
      });
    });

    describe('filter methods', () => {
      it('should filter by actor', async () => {
        const result = await queryBuilder.inTenant(tenantId).byActor('user1').execute();

        expect(result.items).toHaveLength(2);
        result.items.forEach((item) => expect(item.actor.id).toBe('user1'));
      });

      it('should filter by actor type', async () => {
        const result = await queryBuilder.inTenant(tenantId).byActorType('system').execute();

        expect(result.items).toHaveLength(2);
        result.items.forEach((item) => expect(item.actor.type).toBe('system'));
      });

      it('should filter by time range', async () => {
        const now = new Date();
        const past = new Date(now.getTime() - 60000);
        const future = new Date(now.getTime() + 60000);

        const result = await queryBuilder
          .inTenant(tenantId)
          .inTimeRange(past, future)
          .execute();

        expect(result.items.length).toBeGreaterThan(0);
      });

      it('should filter by since', async () => {
        const past = new Date(Date.now() - 60000);
        const result = await queryBuilder.inTenant(tenantId).since(past).execute();

        expect(result.items.length).toBeGreaterThan(0);
      });

      it('should filter by until', async () => {
        const future = new Date(Date.now() + 60000);
        const result = await queryBuilder.inTenant(tenantId).until(future).execute();

        expect(result.items.length).toBeGreaterThan(0);
      });
    });
  });

  // =============================================================================
  // INTEGRATION TESTS
  // =============================================================================
  describe('Integration Tests', () => {
    let storage: ProvenanceStorage;
    let tracker: ProvenanceTracker;
    let chain: ProvenanceChain;
    let queryBuilder: ProvenanceQueryBuilder;
    const tenantId = randomUUID();

    beforeEach(() => {
      storage = createInMemoryStorage();
      tracker = createProvenanceTracker(storage);
      chain = createProvenanceChain();
      queryBuilder = createQueryBuilder(storage);
    });

    it('should track entity lifecycle and maintain chain integrity', async () => {
      const actor: Actor = { id: randomUUID(), type: 'user', metadata: { role: 'admin' } };
      const entityId = randomUUID();

      // Create
      await tracker.track(
        'intent',
        'create',
        { id: entityId, name: 'Test Intent', status: 'pending' },
        actor,
        tenantId
      );

      // Update
      await tracker.track(
        'intent',
        'update',
        { id: entityId, name: 'Test Intent', status: 'approved' },
        actor,
        tenantId
      );

      // Execute
      await tracker.track(
        'intent',
        'execute',
        { id: entityId, name: 'Test Intent', status: 'completed' },
        actor,
        tenantId
      );

      // Verify history
      const history = await tracker.getHistory(entityId, tenantId);
      expect(history).toHaveLength(3);

      // Verify chain integrity
      const verification = await chain.verify(history);
      expect(verification.valid).toBe(true);
      expect(verification.recordsVerified).toBe(3);

      // Verify no tampering
      const tamperResult = await chain.detectTampering(history);
      expect(tamperResult.tampered).toBe(false);

      // Query history
      const queryResult = await queryBuilder
        .inTenant(tenantId)
        .forEntity(entityId)
        .withAction('update')
        .execute();

      expect(queryResult.items).toHaveLength(1);
      expect(queryResult.items[0].action).toBe('update');
    });

    it('should detect and report tampering attempts', async () => {
      const actor: Actor = { id: randomUUID(), type: 'user', metadata: {} };
      const entityId = randomUUID();

      // Create records
      await tracker.track('intent', 'create', { id: entityId }, actor, tenantId);
      await tracker.track('intent', 'update', { id: entityId, v: 2 }, actor, tenantId);
      await tracker.track('intent', 'update', { id: entityId, v: 3 }, actor, tenantId);

      // Get history and tamper with middle record
      const history = await tracker.getHistory(entityId, tenantId);
      const sortedHistory = history.sort((a, b) => a.chainPosition - b.chainPosition);

      // Simulate tampering
      sortedHistory[1].data = { id: entityId, v: 2, tampered: true };

      // Detect tampering
      const tamperResult = await chain.detectTampering(sortedHistory);

      expect(tamperResult.tampered).toBe(true);
      expect(tamperResult.details).toBeDefined();
      expect(tamperResult.details?.length).toBeGreaterThan(0);

      // Verify also catches tampering
      const verification = await chain.verify(sortedHistory);
      expect(verification.valid).toBe(false);
    });

    it('should support multi-tenant isolation', async () => {
      const tenant1 = randomUUID();
      const tenant2 = randomUUID();
      const actor: Actor = { id: randomUUID(), type: 'user', metadata: {} };

      // Create records in both tenants
      await tracker.track('intent', 'create', { id: 'e1' }, actor, tenant1);
      await tracker.track('intent', 'create', { id: 'e2' }, actor, tenant2);
      await tracker.track('policy', 'create', { id: 'e3' }, actor, tenant1);

      // Query tenant1
      const tenant1Results = await queryBuilder.inTenant(tenant1).execute();
      expect(tenant1Results.items).toHaveLength(2);
      tenant1Results.items.forEach((item) => expect(item.tenantId).toBe(tenant1));

      // Query tenant2
      const tenant2Results = await queryBuilder.reset().inTenant(tenant2).execute();
      expect(tenant2Results.items).toHaveLength(1);
      expect(tenant2Results.items[0].tenantId).toBe(tenant2);
    });

    it('should export complete audit trail', async () => {
      const actor: Actor = { id: randomUUID(), type: 'user', metadata: { department: 'IT' } };
      const entityId = randomUUID();

      // Create audit trail
      await tracker.track('intent', 'create', { id: entityId }, actor, tenantId);
      await tracker.track('intent', 'approve', { id: entityId }, actor, tenantId);
      await tracker.track('intent', 'execute', { id: entityId }, actor, tenantId);
      await tracker.track('intent', 'complete', { id: entityId }, actor, tenantId);

      // Export as JSON
      const jsonExport = await queryBuilder.inTenant(tenantId).forEntity(entityId).export('json');

      const parsed = JSON.parse(jsonExport);
      expect(parsed.recordCount).toBe(4);
      expect(parsed.records[0].entityId).toBe(entityId);

      // Export as CSV
      const csvExport = await queryBuilder
        .reset()
        .inTenant(tenantId)
        .forEntity(entityId)
        .export('csv');

      const csvLines = csvExport.split('\n');
      expect(csvLines.length).toBe(5); // Header + 4 records
    });
  });
});
