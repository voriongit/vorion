import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { tmpdir } from 'os';
import { unlink, mkdir, rm } from 'fs/promises';
import {
  MemoryPersistenceProvider,
  FilePersistenceProvider,
  createMemoryProvider,
  createFileProvider,
  createPersistenceProvider,
} from '../src/persistence/index.js';
import type { TrustRecord } from '../src/trust-engine/index.js';

const createTestRecord = (entityId: string, score: number, level: 0 | 1 | 2 | 3 | 4 | 5): TrustRecord => ({
  entityId,
  score,
  level,
  components: {
    behavioral: 0.5,
    compliance: 0.5,
    identity: 0.5,
    context: 0.5,
  },
  signals: [],
  lastCalculatedAt: new Date().toISOString(),
  history: [],
  recentFailures: [],
});

describe('MemoryPersistenceProvider', () => {
  let provider: MemoryPersistenceProvider;

  beforeEach(async () => {
    provider = createMemoryProvider();
    await provider.initialize();
  });

  afterEach(async () => {
    await provider.close();
  });

  it('should have name "memory"', () => {
    expect(provider.name).toBe('memory');
  });

  it('should save and retrieve records', async () => {
    const record = createTestRecord('agent-001', 500, 3);
    await provider.save(record);

    const retrieved = await provider.get('agent-001');
    expect(retrieved).toBeDefined();
    expect(retrieved!.entityId).toBe('agent-001');
    expect(retrieved!.score).toBe(500);
  });

  it('should return undefined for non-existent records', async () => {
    const retrieved = await provider.get('non-existent');
    expect(retrieved).toBeUndefined();
  });

  it('should delete records', async () => {
    const record = createTestRecord('agent-001', 500, 3);
    await provider.save(record);

    const deleted = await provider.delete('agent-001');
    expect(deleted).toBe(true);

    const retrieved = await provider.get('agent-001');
    expect(retrieved).toBeUndefined();
  });

  it('should return false when deleting non-existent records', async () => {
    const deleted = await provider.delete('non-existent');
    expect(deleted).toBe(false);
  });

  it('should list all entity IDs', async () => {
    await provider.save(createTestRecord('agent-001', 500, 3));
    await provider.save(createTestRecord('agent-002', 600, 3));
    await provider.save(createTestRecord('agent-003', 700, 4));

    const ids = await provider.listIds();
    expect(ids).toHaveLength(3);
    expect(ids).toContain('agent-001');
    expect(ids).toContain('agent-002');
    expect(ids).toContain('agent-003');
  });

  it('should check if entity exists', async () => {
    await provider.save(createTestRecord('agent-001', 500, 3));

    expect(await provider.exists('agent-001')).toBe(true);
    expect(await provider.exists('agent-002')).toBe(false);
  });

  it('should count records', async () => {
    expect(await provider.count()).toBe(0);

    await provider.save(createTestRecord('agent-001', 500, 3));
    expect(await provider.count()).toBe(1);

    await provider.save(createTestRecord('agent-002', 600, 3));
    expect(await provider.count()).toBe(2);
  });

  it('should clear all records', async () => {
    await provider.save(createTestRecord('agent-001', 500, 3));
    await provider.save(createTestRecord('agent-002', 600, 3));

    await provider.clear();

    expect(await provider.count()).toBe(0);
  });

  describe('query', () => {
    beforeEach(async () => {
      await provider.save(createTestRecord('agent-001', 200, 1));
      await provider.save(createTestRecord('agent-002', 400, 2));
      await provider.save(createTestRecord('agent-003', 600, 3));
      await provider.save(createTestRecord('agent-004', 800, 4));
    });

    it('should filter by minLevel', async () => {
      const results = await provider.query({ minLevel: 3 });
      expect(results).toHaveLength(2);
      expect(results.every((r) => r.level >= 3)).toBe(true);
    });

    it('should filter by maxLevel', async () => {
      const results = await provider.query({ maxLevel: 2 });
      expect(results).toHaveLength(2);
      expect(results.every((r) => r.level <= 2)).toBe(true);
    });

    it('should filter by minScore', async () => {
      const results = await provider.query({ minScore: 500 });
      expect(results).toHaveLength(2);
      expect(results.every((r) => r.score >= 500)).toBe(true);
    });

    it('should filter by maxScore', async () => {
      const results = await provider.query({ maxScore: 500 });
      expect(results).toHaveLength(2);
      expect(results.every((r) => r.score <= 500)).toBe(true);
    });

    it('should sort by score descending by default', async () => {
      const results = await provider.query();
      expect(results[0]!.score).toBe(800);
      expect(results[3]!.score).toBe(200);
    });

    it('should sort by score ascending', async () => {
      const results = await provider.query({ sortBy: 'score', sortOrder: 'asc' });
      expect(results[0]!.score).toBe(200);
      expect(results[3]!.score).toBe(800);
    });

    it('should apply limit', async () => {
      const results = await provider.query({ limit: 2 });
      expect(results).toHaveLength(2);
    });

    it('should apply offset', async () => {
      const results = await provider.query({ offset: 2, limit: 2 });
      expect(results).toHaveLength(2);
    });

    it('should combine filters', async () => {
      const results = await provider.query({
        minLevel: 2,
        maxLevel: 3,
        sortBy: 'score',
        sortOrder: 'asc',
      });
      expect(results).toHaveLength(2);
      expect(results[0]!.level).toBe(2);
      expect(results[1]!.level).toBe(3);
    });
  });

  it('should return copies of records to prevent mutation', async () => {
    const original = createTestRecord('agent-001', 500, 3);
    await provider.save(original);

    const retrieved = await provider.get('agent-001');
    retrieved!.score = 999;

    const retrievedAgain = await provider.get('agent-001');
    expect(retrievedAgain!.score).toBe(500);
  });
});

describe('FilePersistenceProvider', () => {
  let provider: FilePersistenceProvider;
  let testDir: string;
  let testPath: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `atsf-test-${Date.now()}`);
    testPath = join(testDir, 'trust-records.json');
    await mkdir(testDir, { recursive: true });

    provider = createFileProvider({ path: testPath });
    await provider.initialize();
  });

  afterEach(async () => {
    await provider.close();
    try {
      await rm(testDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should have name "file"', () => {
    expect(provider.name).toBe('file');
  });

  it('should save and retrieve records', async () => {
    const record = createTestRecord('agent-001', 500, 3);
    await provider.save(record);

    const retrieved = await provider.get('agent-001');
    expect(retrieved).toBeDefined();
    expect(retrieved!.entityId).toBe('agent-001');
    expect(retrieved!.score).toBe(500);
  });

  it('should persist records to disk', async () => {
    const record = createTestRecord('agent-001', 500, 3);
    await provider.save(record);
    await provider.close();

    // Create new provider and load from file
    const newProvider = createFileProvider({ path: testPath });
    await newProvider.initialize();

    const retrieved = await newProvider.get('agent-001');
    expect(retrieved).toBeDefined();
    expect(retrieved!.entityId).toBe('agent-001');

    await newProvider.close();
  });

  it('should delete records', async () => {
    await provider.save(createTestRecord('agent-001', 500, 3));

    const deleted = await provider.delete('agent-001');
    expect(deleted).toBe(true);

    const retrieved = await provider.get('agent-001');
    expect(retrieved).toBeUndefined();
  });

  it('should support auto-save interval', async () => {
    const autoSaveProvider = createFileProvider({
      path: join(testDir, 'auto-save.json'),
      autoSaveIntervalMs: 50,
    });
    await autoSaveProvider.initialize();

    await autoSaveProvider.save(createTestRecord('agent-001', 500, 3));

    // Wait for auto-save
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Create new provider and verify data was saved
    const newProvider = createFileProvider({
      path: join(testDir, 'auto-save.json'),
    });
    await newProvider.initialize();

    const retrieved = await newProvider.get('agent-001');
    expect(retrieved).toBeDefined();

    await autoSaveProvider.close();
    await newProvider.close();
  });

  it('should handle query operations', async () => {
    await provider.save(createTestRecord('agent-001', 200, 1));
    await provider.save(createTestRecord('agent-002', 400, 2));
    await provider.save(createTestRecord('agent-003', 600, 3));

    const results = await provider.query({ minScore: 300 });
    expect(results).toHaveLength(2);
  });
});

describe('createPersistenceProvider', () => {
  it('should create memory provider', () => {
    const provider = createPersistenceProvider({ type: 'memory' });
    expect(provider.name).toBe('memory');
  });

  it('should create file provider with path', () => {
    const provider = createPersistenceProvider({
      type: 'file',
      path: '/tmp/test.json',
    });
    expect(provider.name).toBe('file');
  });

  it('should throw for file provider without path', () => {
    expect(() => createPersistenceProvider({ type: 'file' })).toThrow(
      'File persistence requires a path'
    );
  });

  it('should throw for sqlite provider (not implemented)', () => {
    expect(() =>
      createPersistenceProvider({ type: 'sqlite', path: '/tmp/test.db' })
    ).toThrow('SQLite persistence not yet implemented');
  });
});
