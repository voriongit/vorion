/**
 * TrustEngine Unit Tests
 *
 * Critical tests for the trust scoring system - the foundation
 * of Aurais's security and governance model.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TrustEngine } from './TrustEngine.js';
import type { AgentId, TrustLevel } from '../types.js';

describe('TrustEngine', () => {
  let engine: TrustEngine;

  beforeEach(() => {
    engine = new TrustEngine();
  });

  // ===========================================================================
  // Trust Creation Tests
  // ===========================================================================

  describe('createTrust', () => {
    it('creates sovereign (T5) agent with full trust', () => {
      const score = engine.createTrust('t5-executor', {
        tier: 5,
        parentId: null,
        initialTrust: 1000,
      });

      expect(score.level).toBe('SOVEREIGN');
      expect(score.numeric).toBe(1000);
      expect(score.inherited).toBe(1000); // T5 base trust stored as inherited
      expect(score.earned).toBe(0);
      expect(score.penalties).toBe(0);
      expect(score.parentId).toBeNull();
    });

    it('creates child agent with 80% inherited trust', () => {
      // Create parent first
      engine.createTrust('parent', { tier: 5, parentId: null, initialTrust: 1000 });

      // Create child
      const childScore = engine.createTrust('child', {
        tier: 4,
        parentId: 'parent',
      });

      expect(childScore.inherited).toBe(800); // 80% of 1000
      expect(childScore.numeric).toBe(800);
      expect(childScore.parentId).toBe('parent');
      expect(childScore.level).toBe('EXECUTIVE'); // 700-899 range
    });

    it('throws error if parent does not exist', () => {
      expect(() => {
        engine.createTrust('orphan', {
          tier: 3,
          parentId: 'nonexistent',
        });
      }).toThrow('Parent agent nonexistent not found');
    });

    it('tracks lineage correctly', () => {
      engine.createTrust('parent', { tier: 5, parentId: null });
      engine.createTrust('child1', { tier: 4, parentId: 'parent' });
      engine.createTrust('child2', { tier: 4, parentId: 'parent' });

      const lineage = engine.getLineage('parent');
      expect(lineage).toContain('child1');
      expect(lineage).toContain('child2');
      expect(lineage.length).toBe(2);
    });
  });

  // ===========================================================================
  // Trust Level Threshold Tests
  // ===========================================================================

  describe('trust level thresholds', () => {
    it('assigns SOVEREIGN level for 900-1000', () => {
      const score = engine.createTrust('sovereign', {
        tier: 5,
        parentId: null,
        initialTrust: 950,
      });
      expect(score.level).toBe('SOVEREIGN');
    });

    it('assigns EXECUTIVE level for 750-899', () => {
      engine.createTrust('parent', { tier: 5, parentId: null, initialTrust: 825 });
      const parentScore = engine.getTrust('parent');
      expect(parentScore?.level).toBe('EXECUTIVE');
    });

    it('assigns TACTICAL level for 600-749', () => {
      engine.createTrust('parent', { tier: 5, parentId: null, initialTrust: 675 });
      const score = engine.getTrust('parent');
      expect(score?.level).toBe('TACTICAL');
    });

    it('assigns OPERATIONAL level for 450-599', () => {
      engine.createTrust('parent', { tier: 5, parentId: null, initialTrust: 525 });
      const score = engine.getTrust('parent');
      expect(score?.level).toBe('OPERATIONAL');
    });

    it('assigns WORKER level for 300-449', () => {
      engine.createTrust('parent', { tier: 5, parentId: null, initialTrust: 375 });
      const score = engine.getTrust('parent');
      expect(score?.level).toBe('WORKER');
    });

    it('assigns PASSIVE level for 0-299', () => {
      engine.createTrust('parent', { tier: 5, parentId: null, initialTrust: 150 });
      const score = engine.getTrust('parent');
      expect(score?.level).toBe('PASSIVE');
    });
  });

  // ===========================================================================
  // Reward System Tests
  // ===========================================================================

  describe('reward', () => {
    it('increases earned trust correctly', () => {
      engine.createTrust('agent', { tier: 5, parentId: null, initialTrust: 500 });

      const updated = engine.reward('agent', 50, 'Good performance');

      expect(updated?.earned).toBe(50);
      expect(updated?.numeric).toBe(550);
    });

    it('caps trust at 1000', () => {
      engine.createTrust('agent', { tier: 5, parentId: null, initialTrust: 980 });

      const updated = engine.reward('agent', 100, 'Excellent work');

      expect(updated?.numeric).toBe(1000);
    });

    it('triggers level change event when crossing threshold', () => {
      // Start at 745 (TACTICAL: 600-749), reward 10 to get 755 (EXECUTIVE: 750-899)
      engine.createTrust('agent', { tier: 5, parentId: null, initialTrust: 745 });

      const levelChangeSpy = vi.fn();
      engine.on('trust:level-changed', levelChangeSpy);

      engine.reward('agent', 10, 'Crossed threshold');

      expect(levelChangeSpy).toHaveBeenCalledWith('agent', 'TACTICAL', 'EXECUTIVE');
    });

    it('returns null for non-existent agent', () => {
      const result = engine.reward('nonexistent', 50, 'test');
      expect(result).toBeNull();
    });

    it('emits reward event', () => {
      engine.createTrust('agent', { tier: 5, parentId: null, initialTrust: 500 });

      const rewardSpy = vi.fn();
      engine.on('trust:reward', rewardSpy);

      engine.reward('agent', 25, 'Task completed');

      expect(rewardSpy).toHaveBeenCalledWith('agent', 'Task completed', 25);
    });
  });

  // ===========================================================================
  // Penalty System Tests
  // ===========================================================================

  describe('penalize', () => {
    it('decreases trust correctly', () => {
      engine.createTrust('agent', { tier: 5, parentId: null, initialTrust: 500 });

      const updated = engine.penalize('agent', 100, 'Violation');

      expect(updated?.penalties).toBe(100);
      expect(updated?.numeric).toBe(400);
    });

    it('floors trust at 0', () => {
      engine.createTrust('agent', { tier: 5, parentId: null, initialTrust: 50 });

      const updated = engine.penalize('agent', 100, 'Major violation');

      expect(updated?.numeric).toBe(0);
      expect(updated?.level).toBe('PASSIVE');
    });

    it('propagates 50% penalty to parent', () => {
      engine.createTrust('parent', { tier: 5, parentId: null, initialTrust: 1000 });
      engine.createTrust('child', { tier: 4, parentId: 'parent' });

      engine.penalize('child', 100, 'Child violation');

      const parentScore = engine.getTrust('parent');
      expect(parentScore?.penalties).toBe(50); // 50% propagation
      expect(parentScore?.numeric).toBe(950);
    });

    it('stops propagation at root (no infinite loop)', () => {
      engine.createTrust('root', { tier: 5, parentId: null, initialTrust: 1000 });

      // This should not throw or infinite loop
      engine.penalize('root', 100, 'Root violation');

      const rootScore = engine.getTrust('root');
      expect(rootScore?.numeric).toBe(900);
    });

    it('triggers level change event when dropping below threshold', () => {
      // Start at 755 (EXECUTIVE: 750-899), penalize 10 to get 745 (TACTICAL: 600-749)
      engine.createTrust('agent', { tier: 5, parentId: null, initialTrust: 755 });

      const levelChangeSpy = vi.fn();
      engine.on('trust:level-changed', levelChangeSpy);

      engine.penalize('agent', 10, 'Minor violation');

      expect(levelChangeSpy).toHaveBeenCalledWith('agent', 'EXECUTIVE', 'TACTICAL');
    });

    it('emits violation event', () => {
      engine.createTrust('agent', { tier: 5, parentId: null, initialTrust: 500 });

      const violationSpy = vi.fn();
      engine.on('trust:violation', violationSpy);

      engine.penalize('agent', 50, 'Policy breach');

      expect(violationSpy).toHaveBeenCalledWith('agent', 'Policy breach', 50);
    });
  });

  // ===========================================================================
  // Spawn Validation Tests
  // ===========================================================================

  describe('validateSpawn', () => {
    beforeEach(() => {
      engine.createTrust('requestor', { tier: 5, parentId: null, initialTrust: 800 });
    });

    it('validates successful spawn request', () => {
      const report = engine.validateSpawn('requestor', {
        requestedTier: 4,
        trustBudget: 300,
        purpose: 'Create worker',
      });

      expect(report.isValid).toBe(true);
      expect(report.errors).toHaveLength(0);
    });

    it('rejects spawn above max tier', () => {
      // T5 can only spawn T4 and below
      const report = engine.validateSpawn('requestor', {
        requestedTier: 5,
        trustBudget: 300,
        purpose: 'Create T5',
      });

      expect(report.isValid).toBe(false);
      expect(report.errors).toContain('Cannot spawn tier 5. Max allowed: 4');
    });

    it('rejects spawn exceeding trust budget', () => {
      // Can only allocate 50% of own trust (800 * 0.5 = 400)
      const report = engine.validateSpawn('requestor', {
        requestedTier: 4,
        trustBudget: 500,
        purpose: 'Greedy spawn',
      });

      expect(report.isValid).toBe(false);
      expect(report.errors[0]).toContain('Trust budget 500 exceeds available');
    });

    it('returns error for unknown agent', () => {
      const report = engine.validateSpawn('unknown', {
        requestedTier: 3,
        trustBudget: 100,
        purpose: 'test',
      });

      expect(report.isValid).toBe(false);
      expect(report.errors).toContain('Agent not found in trust registry');
    });

    it('adds HITL warning for high-tier spawns at high governance', () => {
      engine.setHITLLevel(60);

      const report = engine.validateSpawn('requestor', {
        requestedTier: 3,
        trustBudget: 200,
        purpose: 'Create T3',
      });

      expect(report.warnings).toContain(
        'High-tier spawn requires HITL approval at current governance level'
      );
    });
  });

  // ===========================================================================
  // Chain Verification Tests
  // ===========================================================================

  describe('verifyChain', () => {
    it('verifies valid trust chain', () => {
      engine.createTrust('t5', { tier: 5, parentId: null });
      engine.createTrust('t4', { tier: 4, parentId: 't5' });
      engine.createTrust('t3', { tier: 3, parentId: 't4' });

      const result = engine.verifyChain('t3');

      expect(result.valid).toBe(true);
      expect(result.chain).toEqual(['t5', 't4', 't3']);
    });

    it('returns invalid for broken chain', () => {
      engine.createTrust('orphan', { tier: 5, parentId: null });

      // Manually break the chain by checking non-existent
      const result = engine.verifyChain('nonexistent');

      expect(result.valid).toBe(false);
    });
  });

  // ===========================================================================
  // HITL Management Tests
  // ===========================================================================

  describe('HITL management', () => {
    it('starts at 100% HITL level', () => {
      expect(engine.getHITLLevel()).toBe(100);
    });

    it('allows setting HITL level', () => {
      engine.setHITLLevel(75);
      expect(engine.getHITLLevel()).toBe(75);
    });

    it('clamps HITL level between 0 and 100', () => {
      engine.setHITLLevel(-10);
      expect(engine.getHITLLevel()).toBe(0);

      engine.setHITLLevel(150);
      expect(engine.getHITLLevel()).toBe(100);
    });

    it('fades HITL gradually', () => {
      engine.setHITLLevel(100);
      engine.fadeHITL(5);
      expect(engine.getHITLLevel()).toBe(95);
    });

    it('determines HITL requirements correctly', () => {
      engine.setHITLLevel(75);

      expect(engine.requiresHITL('SPAWN')).toBe(true);    // threshold 50
      expect(engine.requiresHITL('DECISION')).toBe(true); // threshold 70
      expect(engine.requiresHITL('STRATEGY')).toBe(true); // threshold 30

      engine.setHITLLevel(40);

      expect(engine.requiresHITL('SPAWN')).toBe(false);
      expect(engine.requiresHITL('DECISION')).toBe(false);
      expect(engine.requiresHITL('STRATEGY')).toBe(true);
    });
  });

  // ===========================================================================
  // Statistics & Export Tests
  // ===========================================================================

  describe('statistics', () => {
    it('returns accurate stats', () => {
      engine.createTrust('t5-1', { tier: 5, parentId: null, initialTrust: 1000 });
      engine.createTrust('t5-2', { tier: 5, parentId: null, initialTrust: 900 });
      engine.createTrust('t4', { tier: 4, parentId: 't5-1' });

      const stats = engine.getStats();

      expect(stats.totalAgents).toBe(3);
      expect(stats.byLevel.SOVEREIGN).toBe(2);
      expect(stats.byLevel.EXECUTIVE).toBe(1);
      expect(stats.avgTrust).toBeGreaterThan(0);
    });

    it('exports and imports trust data', () => {
      engine.createTrust('agent', { tier: 5, parentId: null, initialTrust: 750 });
      engine.reward('agent', 50, 'test');

      const exported = engine.export();

      const newEngine = new TrustEngine();
      newEngine.import(exported);

      const imported = newEngine.getTrust('agent');
      expect(imported?.numeric).toBe(800);
      expect(imported?.earned).toBe(50);
    });
  });
});
