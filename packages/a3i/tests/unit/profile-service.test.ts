/**
 * Tests for TrustProfileService and InMemoryProfileStore
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { ObservationTier, TrustBand, type TrustEvidence } from '@orion/contracts';
import {
  TrustProfileService,
  createProfileService,
  InMemoryProfileStore,
  createInMemoryStore,
} from '../../src/trust/index.js';

// Helper to create test evidence
function createEvidence(
  dimension: 'CT' | 'BT' | 'GT' | 'XT' | 'AC',
  impact: number,
  daysAgo: number = 0
): TrustEvidence {
  const collectedAt = new Date();
  collectedAt.setDate(collectedAt.getDate() - daysAgo);
  return {
    evidenceId: uuidv4(),
    dimension,
    impact,
    source: 'test',
    collectedAt,
  };
}

describe('InMemoryProfileStore', () => {
  let store: InMemoryProfileStore;

  beforeEach(() => {
    store = new InMemoryProfileStore();
  });

  describe('basic operations', () => {
    it('should start empty', async () => {
      expect(store.size).toBe(0);
      expect(await store.get('agent-1')).toBeNull();
    });

    it('should save and retrieve a profile', async () => {
      const profile = {
        profileId: uuidv4(),
        agentId: 'agent-1',
        dimensions: { CT: 50, BT: 50, GT: 50, XT: 50, AC: 50 },
        weights: { CT: 0.25, BT: 0.25, GT: 0.20, XT: 0.15, AC: 0.15 },
        compositeScore: 50,
        observationTier: ObservationTier.BLACK_BOX,
        adjustedScore: 50,
        band: TrustBand.T2_CONSTRAINED,
        calculatedAt: new Date(),
        evidence: [],
        version: 1,
      };

      await store.save(profile);
      expect(store.size).toBe(1);

      const retrieved = await store.get('agent-1');
      expect(retrieved).toEqual(profile);
    });

    it('should retrieve by profile ID', async () => {
      const profileId = uuidv4();
      const profile = {
        profileId,
        agentId: 'agent-1',
        dimensions: { CT: 50, BT: 50, GT: 50, XT: 50, AC: 50 },
        weights: { CT: 0.25, BT: 0.25, GT: 0.20, XT: 0.15, AC: 0.15 },
        compositeScore: 50,
        observationTier: ObservationTier.BLACK_BOX,
        adjustedScore: 50,
        band: TrustBand.T2_CONSTRAINED,
        calculatedAt: new Date(),
        evidence: [],
        version: 1,
      };

      await store.save(profile);
      const retrieved = await store.getByProfileId(profileId);
      expect(retrieved).toEqual(profile);
    });

    it('should delete a profile', async () => {
      const profile = {
        profileId: uuidv4(),
        agentId: 'agent-1',
        dimensions: { CT: 50, BT: 50, GT: 50, XT: 50, AC: 50 },
        weights: { CT: 0.25, BT: 0.25, GT: 0.20, XT: 0.15, AC: 0.15 },
        compositeScore: 50,
        observationTier: ObservationTier.BLACK_BOX,
        adjustedScore: 50,
        band: TrustBand.T2_CONSTRAINED,
        calculatedAt: new Date(),
        evidence: [],
        version: 1,
      };

      await store.save(profile);
      expect(await store.exists('agent-1')).toBe(true);

      const deleted = await store.delete('agent-1');
      expect(deleted).toBe(true);
      expect(await store.exists('agent-1')).toBe(false);
    });

    it('should return false when deleting non-existent profile', async () => {
      const deleted = await store.delete('non-existent');
      expect(deleted).toBe(false);
    });

    it('should clear all profiles', async () => {
      await store.save({
        profileId: uuidv4(),
        agentId: 'agent-1',
        dimensions: { CT: 50, BT: 50, GT: 50, XT: 50, AC: 50 },
        weights: { CT: 0.25, BT: 0.25, GT: 0.20, XT: 0.15, AC: 0.15 },
        compositeScore: 50,
        observationTier: ObservationTier.BLACK_BOX,
        adjustedScore: 50,
        band: TrustBand.T2_CONSTRAINED,
        calculatedAt: new Date(),
        evidence: [],
        version: 1,
      });
      await store.save({
        profileId: uuidv4(),
        agentId: 'agent-2',
        dimensions: { CT: 60, BT: 60, GT: 60, XT: 60, AC: 60 },
        weights: { CT: 0.25, BT: 0.25, GT: 0.20, XT: 0.15, AC: 0.15 },
        compositeScore: 60,
        observationTier: ObservationTier.GRAY_BOX,
        adjustedScore: 60,
        band: TrustBand.T3_TRUSTED,
        calculatedAt: new Date(),
        evidence: [],
        version: 1,
      });

      expect(store.size).toBe(2);
      await store.clear();
      expect(store.size).toBe(0);
    });
  });

  describe('history tracking', () => {
    it('should track history on updates', async () => {
      const profile1 = {
        profileId: uuidv4(),
        agentId: 'agent-1',
        dimensions: { CT: 50, BT: 50, GT: 50, XT: 50, AC: 50 },
        weights: { CT: 0.25, BT: 0.25, GT: 0.20, XT: 0.15, AC: 0.15 },
        compositeScore: 50,
        observationTier: ObservationTier.BLACK_BOX,
        adjustedScore: 50,
        band: TrustBand.T2_CONSTRAINED,
        calculatedAt: new Date(),
        evidence: [],
        version: 1,
      };

      await store.save(profile1);

      const profile2 = {
        ...profile1,
        profileId: uuidv4(),
        compositeScore: 60,
        adjustedScore: 60,
        band: TrustBand.T3_TRUSTED,
        version: 2,
      };

      await store.save(profile2);

      const history = await store.getHistory('agent-1');
      expect(history.length).toBe(1);
      expect(history[0]!.profile.version).toBe(1);
    });
  });

  describe('querying', () => {
    beforeEach(async () => {
      // Add multiple profiles
      const now = new Date();
      for (let i = 0; i < 5; i++) {
        const calculatedAt = new Date(now.getTime() - i * 60000); // 1 minute apart
        await store.save({
          profileId: uuidv4(),
          agentId: `agent-${i}`,
          dimensions: { CT: 50 + i * 10, BT: 50, GT: 50, XT: 50, AC: 50 },
          weights: { CT: 0.25, BT: 0.25, GT: 0.20, XT: 0.15, AC: 0.15 },
          compositeScore: 50 + i * 2.5,
          observationTier: ObservationTier.BLACK_BOX,
          adjustedScore: Math.min(50 + i * 2.5, 60),
          band: i < 3 ? TrustBand.T2_CONSTRAINED : TrustBand.T3_TRUSTED,
          calculatedAt,
          evidence: [],
          version: 1,
        });
      }
    });

    it('should query all profiles', async () => {
      const result = await store.query();
      expect(result.total).toBe(5);
      expect(result.profiles.length).toBe(5);
    });

    it('should filter by agent IDs', async () => {
      const result = await store.query({ agentIds: ['agent-1', 'agent-2'] });
      expect(result.total).toBe(2);
    });

    it('should filter by score range', async () => {
      const result = await store.query({ minScore: 55 });
      expect(result.total).toBeGreaterThan(0);
      result.profiles.forEach((p) => {
        expect(p.adjustedScore).toBeGreaterThanOrEqual(55);
      });
    });

    it('should filter by bands', async () => {
      const result = await store.query({ bands: [TrustBand.T3_TRUSTED] });
      result.profiles.forEach((p) => {
        expect(p.band).toBe(TrustBand.T3_TRUSTED);
      });
    });

    it('should apply pagination', async () => {
      const page1 = await store.query({}, { limit: 2, offset: 0 });
      expect(page1.profiles.length).toBe(2);
      expect(page1.total).toBe(5);

      const page2 = await store.query({}, { limit: 2, offset: 2 });
      expect(page2.profiles.length).toBe(2);
      expect(page2.offset).toBe(2);
    });

    it('should sort by adjusted score', async () => {
      const result = await store.query({}, { orderBy: 'adjustedScore', orderDir: 'asc' });
      for (let i = 1; i < result.profiles.length; i++) {
        expect(result.profiles[i]!.adjustedScore).toBeGreaterThanOrEqual(
          result.profiles[i - 1]!.adjustedScore
        );
      }
    });
  });

  describe('summaries', () => {
    it('should get summaries for multiple agents', async () => {
      await store.save({
        profileId: uuidv4(),
        agentId: 'agent-1',
        dimensions: { CT: 50, BT: 50, GT: 50, XT: 50, AC: 50 },
        weights: { CT: 0.25, BT: 0.25, GT: 0.20, XT: 0.15, AC: 0.15 },
        compositeScore: 50,
        observationTier: ObservationTier.BLACK_BOX,
        adjustedScore: 50,
        band: TrustBand.T2_CONSTRAINED,
        calculatedAt: new Date(),
        evidence: [],
        version: 1,
      });
      await store.save({
        profileId: uuidv4(),
        agentId: 'agent-2',
        dimensions: { CT: 70, BT: 70, GT: 70, XT: 70, AC: 70 },
        weights: { CT: 0.25, BT: 0.25, GT: 0.20, XT: 0.15, AC: 0.15 },
        compositeScore: 70,
        observationTier: ObservationTier.WHITE_BOX,
        adjustedScore: 70,
        band: TrustBand.T3_TRUSTED,
        calculatedAt: new Date(),
        evidence: [],
        version: 1,
      });

      const summaries = await store.getSummaries(['agent-1', 'agent-2', 'agent-3']);
      expect(summaries.length).toBe(2);
      expect(summaries[0]!.agentId).toBe('agent-1');
      expect(summaries[1]!.agentId).toBe('agent-2');
    });
  });
});

describe('TrustProfileService', () => {
  let service: TrustProfileService;

  beforeEach(() => {
    service = new TrustProfileService();
  });

  describe('create', () => {
    it('should create a new profile', async () => {
      const evidence = [
        createEvidence('CT', 10),
        createEvidence('BT', 15),
      ];

      const result = await service.create('agent-1', ObservationTier.BLACK_BOX, evidence);

      expect(result.success).toBe(true);
      expect(result.isNew).toBe(true);
      expect(result.profile).toBeDefined();
      expect(result.profile!.agentId).toBe('agent-1');
      expect(result.profile!.observationTier).toBe(ObservationTier.BLACK_BOX);
    });

    it('should fail if profile already exists', async () => {
      await service.create('agent-1', ObservationTier.BLACK_BOX, []);
      const result = await service.create('agent-1', ObservationTier.BLACK_BOX, []);

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });

    it('should use custom profile ID if provided', async () => {
      const customId = 'custom-profile-123';
      const result = await service.create('agent-1', ObservationTier.BLACK_BOX, [], {
        profileId: customId,
      });

      expect(result.success).toBe(true);
      expect(result.profile!.profileId).toBe(customId);
    });

    it('should apply observation ceiling', async () => {
      // Evidence that would produce high score
      const evidence = [
        createEvidence('CT', 40),
        createEvidence('BT', 40),
        createEvidence('GT', 40),
        createEvidence('XT', 40),
        createEvidence('AC', 40),
      ];

      const result = await service.create('agent-1', ObservationTier.BLACK_BOX, evidence);

      expect(result.success).toBe(true);
      // BLACK_BOX caps at 60
      expect(result.profile!.adjustedScore).toBeLessThanOrEqual(60);
    });
  });

  describe('get', () => {
    it('should retrieve existing profile', async () => {
      await service.create('agent-1', ObservationTier.BLACK_BOX, []);
      const profile = await service.get('agent-1');

      expect(profile).toBeDefined();
      expect(profile!.agentId).toBe('agent-1');
    });

    it('should return null for non-existent profile', async () => {
      const profile = await service.get('non-existent');
      expect(profile).toBeNull();
    });
  });

  describe('getOrCreate', () => {
    it('should return existing profile if found', async () => {
      const createResult = await service.create('agent-1', ObservationTier.BLACK_BOX, []);
      const getResult = await service.getOrCreate('agent-1', ObservationTier.GRAY_BOX, []);

      expect(getResult.isNew).toBe(false);
      expect(getResult.profile!.profileId).toBe(createResult.profile!.profileId);
    });

    it('should create new profile if not found', async () => {
      const result = await service.getOrCreate('agent-1', ObservationTier.BLACK_BOX, []);

      expect(result.success).toBe(true);
      expect(result.isNew).toBe(true);
    });
  });

  describe('update', () => {
    it('should update existing profile with new evidence', async () => {
      await service.create('agent-1', ObservationTier.BLACK_BOX, [createEvidence('CT', 5)]);

      const newEvidence = [createEvidence('BT', 10)];
      const result = await service.update('agent-1', newEvidence);

      expect(result.success).toBe(true);
      expect(result.isNew).toBe(false);
      expect(result.profile!.version).toBe(2);
      expect(result.previousVersion).toBe(1);
    });

    it('should fail for non-existent profile', async () => {
      const result = await service.update('non-existent', []);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No profile found');
    });
  });

  describe('refresh', () => {
    it('should recalculate profile with decay', async () => {
      await service.create('agent-1', ObservationTier.BLACK_BOX, [createEvidence('CT', 10)]);

      // Force refresh
      const result = await service.refresh('agent-1', { force: true });

      expect(result.success).toBe(true);
      expect(result.profile!.version).toBe(2);
    });

    it('should skip refresh if profile is recent', async () => {
      await service.create('agent-1', ObservationTier.BLACK_BOX, []);
      const original = await service.get('agent-1');

      // Don't force, profile is fresh
      const result = await service.refresh('agent-1');

      expect(result.success).toBe(true);
      expect(result.profile!.version).toBe(original!.version);
    });
  });

  describe('delete', () => {
    it('should delete existing profile', async () => {
      await service.create('agent-1', ObservationTier.BLACK_BOX, []);
      expect(await service.exists('agent-1')).toBe(true);

      await service.delete('agent-1');
      expect(await service.exists('agent-1')).toBe(false);
    });
  });

  describe('query', () => {
    beforeEach(async () => {
      await service.create('agent-1', ObservationTier.BLACK_BOX, [createEvidence('CT', 5)]);
      await service.create('agent-2', ObservationTier.GRAY_BOX, [createEvidence('CT', 20)]);
      await service.create('agent-3', ObservationTier.WHITE_BOX, [createEvidence('CT', 40)]);
    });

    it('should query all profiles', async () => {
      const result = await service.query();
      expect(result.total).toBe(3);
    });

    it('should filter by minimum score', async () => {
      const result = await service.query({ minScore: 60 });
      result.profiles.forEach((p) => {
        expect(p.adjustedScore).toBeGreaterThanOrEqual(60);
      });
    });

    it('should list agent IDs', async () => {
      const ids = await service.listAgentIds();
      expect(ids).toContain('agent-1');
      expect(ids).toContain('agent-2');
      expect(ids).toContain('agent-3');
    });
  });

  describe('history', () => {
    it('should track profile history', async () => {
      await service.create('agent-1', ObservationTier.BLACK_BOX, [createEvidence('CT', 5)]);
      await service.update('agent-1', [createEvidence('BT', 10)]);
      await service.update('agent-1', [createEvidence('GT', 15)]);

      const history = await service.getHistory('agent-1');
      expect(history.length).toBe(2); // Original + first update
    });
  });

  describe('bulk operations', () => {
    it('should bulk upsert profiles', async () => {
      const items = [
        { agentId: 'agent-1', observationTier: ObservationTier.BLACK_BOX, evidence: [] },
        { agentId: 'agent-2', observationTier: ObservationTier.GRAY_BOX, evidence: [] },
      ];

      const results = await service.bulkUpsert(items as any);
      expect(results.length).toBe(2);
      expect(results.every((r) => r.success)).toBe(true);
    });
  });

  describe('stale profile detection', () => {
    it('should find stale profiles', async () => {
      // Create a profile with old calculation date
      const store = service.getStore();
      await store.save({
        profileId: uuidv4(),
        agentId: 'old-agent',
        dimensions: { CT: 50, BT: 50, GT: 50, XT: 50, AC: 50 },
        weights: { CT: 0.25, BT: 0.25, GT: 0.20, XT: 0.15, AC: 0.15 },
        compositeScore: 50,
        observationTier: ObservationTier.BLACK_BOX,
        adjustedScore: 50,
        band: TrustBand.T2_CONSTRAINED,
        calculatedAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 48 hours ago
        evidence: [],
        version: 1,
      });

      const stale = await service.getStaleProfiles(24 * 60 * 60 * 1000); // 24h threshold
      expect(stale.length).toBe(1);
      expect(stale[0]!.agentId).toBe('old-agent');
    });
  });

  describe('factory function', () => {
    it('should create service with createProfileService', () => {
      const service = createProfileService();
      expect(service).toBeInstanceOf(TrustProfileService);
    });

    it('should accept custom store', () => {
      const customStore = createInMemoryStore();
      const service = createProfileService({ store: customStore });
      expect(service.getStore()).toBe(customStore);
    });
  });

  describe('trust change hooks', () => {
    it('should fire trust change hook on create', async () => {
      const hookCalls: Array<{ agentId: string; reason: string }> = [];
      const { createHookManager } = await import('../../src/hooks/index.js');
      const hookManager = createHookManager();

      hookManager.onTrustChange('test-change-hook', async (ctx) => {
        hookCalls.push({ agentId: ctx.agentId, reason: ctx.reason });
        return { success: true, durationMs: 1 };
      });

      const service = new TrustProfileService({ hookManager });

      await service.create('agent-1', ObservationTier.WHITE_BOX, [
        createEvidence('CT', 10),
      ]);

      expect(hookCalls).toHaveLength(1);
      expect(hookCalls[0]!.agentId).toBe('agent-1');
      expect(hookCalls[0]!.reason).toBe('Profile created');
    });

    it('should fire trust change hook on update', async () => {
      const hookCalls: Array<{ agentId: string; reason: string }> = [];
      const { createHookManager } = await import('../../src/hooks/index.js');
      const hookManager = createHookManager();

      hookManager.onTrustChange('test-change-hook', async (ctx) => {
        hookCalls.push({ agentId: ctx.agentId, reason: ctx.reason });
        return { success: true, durationMs: 1 };
      });

      const service = new TrustProfileService({ hookManager });

      await service.create('agent-1', ObservationTier.WHITE_BOX, [
        createEvidence('CT', 10),
      ]);

      // Clear the create hook call
      hookCalls.length = 0;

      await service.update('agent-1', [createEvidence('BT', 15)]);

      expect(hookCalls).toHaveLength(1);
      expect(hookCalls[0]!.agentId).toBe('agent-1');
      expect(hookCalls[0]!.reason).toBe('Evidence updated');
    });

    it('should pass previous and new profiles to hook', async () => {
      let receivedContext: Record<string, unknown> | null = null;
      const { createHookManager } = await import('../../src/hooks/index.js');
      const hookManager = createHookManager();

      hookManager.onTrustChange('context-hook', async (ctx) => {
        receivedContext = {
          previousProfile: ctx.previousProfile,
          newProfile: ctx.newProfile,
        };
        return { success: true, durationMs: 1 };
      });

      const service = new TrustProfileService({ hookManager });

      await service.create('agent-1', ObservationTier.WHITE_BOX, [
        createEvidence('CT', 10),
      ]);

      const firstProfile = await service.get('agent-1');
      receivedContext = null;

      await service.update('agent-1', [createEvidence('BT', 15)]);

      expect(receivedContext).not.toBeNull();
      const ctx = receivedContext as Record<string, unknown>;
      expect(ctx.previousProfile).toBeDefined();
      expect(ctx.newProfile).toBeDefined();
      expect((ctx.previousProfile as { agentId: string }).agentId).toBe('agent-1');
      expect((ctx.newProfile as { agentId: string }).agentId).toBe('agent-1');
    });

    it('should not fire hooks when disabled', async () => {
      const hookCalls: string[] = [];
      const { createHookManager } = await import('../../src/hooks/index.js');
      const hookManager = createHookManager();

      hookManager.onTrustChange('test-hook', async () => {
        hookCalls.push('called');
        return { success: true, durationMs: 1 };
      });

      const service = new TrustProfileService({ hookManager, enableHooks: false });

      await service.create('agent-1', ObservationTier.WHITE_BOX, [
        createEvidence('CT', 10),
      ]);

      expect(hookCalls).toHaveLength(0);
    });
  });

  describe('trust violation hooks', () => {
    it('should fire violation hook on significant band drop', async () => {
      const violations: Array<{ type: string; severity: string }> = [];
      const { createHookManager } = await import('../../src/hooks/index.js');
      const hookManager = createHookManager();

      hookManager.onTrustViolation('test-violation-hook', async (ctx) => {
        violations.push({ type: ctx.violationType, severity: ctx.severity });
        return { success: true, durationMs: 1 };
      });

      const service = new TrustProfileService({ hookManager });

      // Create a high-trust agent
      await service.create('agent-1', ObservationTier.WHITE_BOX, [
        createEvidence('CT', 30),
        createEvidence('BT', 30),
        createEvidence('GT', 30),
        createEvidence('XT', 30),
        createEvidence('AC', 30),
      ]);

      const initial = await service.get('agent-1');
      expect(initial!.band).toBeGreaterThanOrEqual(TrustBand.T3_TRUSTED);

      // Add very negative evidence to cause band drop
      await service.update('agent-1', [
        createEvidence('CT', -60),
        createEvidence('BT', -60),
        createEvidence('GT', -60),
        createEvidence('XT', -60),
        createEvidence('AC', -60),
      ]);

      // Should have fired a band_drop violation
      const bandDropViolation = violations.find((v) => v.type === 'band_drop');
      expect(bandDropViolation).toBeDefined();
    });

    it('should fire violation hook on significant score drop', async () => {
      const violations: Array<{ type: string; details: Record<string, unknown> }> = [];
      const { createHookManager } = await import('../../src/hooks/index.js');
      const hookManager = createHookManager();

      hookManager.onTrustViolation('test-violation-hook', async (ctx) => {
        violations.push({ type: ctx.violationType, details: ctx.details });
        return { success: true, durationMs: 1 };
      });

      const service = new TrustProfileService({
        hookManager,
        scoreDropViolationThreshold: 10, // Lower threshold for testing
      });

      // Create agent with high initial score
      await service.create('agent-1', ObservationTier.WHITE_BOX, [
        createEvidence('CT', 20),
        createEvidence('BT', 20),
      ]);

      // Add negative evidence to cause score drop
      await service.update('agent-1', [
        createEvidence('CT', -30),
        createEvidence('BT', -30),
      ]);

      // Should have fired a score_drop violation
      const scoreDropViolation = violations.find((v) => v.type === 'score_drop');
      expect(scoreDropViolation).toBeDefined();
      expect(scoreDropViolation!.details.scoreDropPercent).toBeGreaterThan(0);
    });

    it('should set severity based on drop magnitude', async () => {
      const violations: Array<{ type: string; severity: string }> = [];
      const { createHookManager } = await import('../../src/hooks/index.js');
      const hookManager = createHookManager();

      hookManager.onTrustViolation('test-violation-hook', async (ctx) => {
        violations.push({ type: ctx.violationType, severity: ctx.severity });
        return { success: true, durationMs: 1 };
      });

      const service = new TrustProfileService({
        hookManager,
        bandDropViolationThreshold: 1,
      });

      // Create a high-trust agent at T4+
      await service.create('agent-1', ObservationTier.WHITE_BOX, [
        createEvidence('CT', 40),
        createEvidence('BT', 40),
        createEvidence('GT', 40),
        createEvidence('XT', 40),
        createEvidence('AC', 40),
      ]);

      // Cause a 2+ band drop (should be critical severity)
      await service.update('agent-1', [
        createEvidence('CT', -80),
        createEvidence('BT', -80),
        createEvidence('GT', -80),
        createEvidence('XT', -80),
        createEvidence('AC', -80),
      ]);

      const bandDropViolation = violations.find((v) => v.type === 'band_drop');
      expect(bandDropViolation).toBeDefined();
      // A 2+ band drop should be critical
      if (bandDropViolation) {
        expect(['high', 'critical']).toContain(bandDropViolation.severity);
      }
    });

    it('should expose hook manager via getter', async () => {
      const { createHookManager } = await import('../../src/hooks/index.js');
      const hookManager = createHookManager();
      const service = new TrustProfileService({ hookManager });

      expect(service.getHookManager()).toBe(hookManager);
    });
  });
});
