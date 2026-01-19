/**
 * Blackboard System Unit Tests
 *
 * Tests for the stigmergic coordination system - shared knowledge
 * space where agents collaborate through indirect communication.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Blackboard } from './Blackboard.js';
import type { BlackboardEntry, BlackboardEntryType } from '../types.js';

describe('Blackboard', () => {
  let blackboard: Blackboard;

  beforeEach(() => {
    blackboard = new Blackboard();
  });

  // ===========================================================================
  // Core Operations Tests
  // ===========================================================================

  describe('post', () => {
    it('creates a new entry with defaults', () => {
      const entry = blackboard.post({
        type: 'PROBLEM',
        title: 'Test Problem',
        author: 'agent-1',
        content: { description: 'A test problem' },
      });

      expect(entry.id).toBeDefined();
      expect(entry.type).toBe('PROBLEM');
      expect(entry.title).toBe('Test Problem');
      expect(entry.author).toBe('agent-1');
      expect(entry.status).toBe('OPEN');
      expect(entry.confidence).toBe(50); // default
      expect(entry.visibility).toBe('ALL'); // default
      expect(entry.priority).toBe('MEDIUM'); // default
      expect(entry.contributions).toHaveLength(0);
    });

    it('accepts custom parameters', () => {
      const entry = blackboard.post({
        type: 'SOLUTION',
        title: 'Critical Solution',
        author: 'agent-2',
        content: 'The answer',
        confidence: 90,
        priority: 'CRITICAL',
        visibility: 'HIGHER_TIERS',
        dependencies: ['dep-1', 'dep-2'],
      });

      expect(entry.confidence).toBe(90);
      expect(entry.priority).toBe('CRITICAL');
      expect(entry.visibility).toBe('HIGHER_TIERS');
      expect(entry.dependencies).toEqual(['dep-1', 'dep-2']);
    });

    it('emits entry:posted event', () => {
      const spy = vi.fn();
      blackboard.on('entry:posted', spy);

      const entry = blackboard.post({
        type: 'OBSERVATION',
        title: 'Test',
        author: 'agent-1',
        content: 'test',
      });

      expect(spy).toHaveBeenCalledWith(entry);
    });
  });

  describe('contribute', () => {
    let entryId: string;

    beforeEach(() => {
      const entry = blackboard.post({
        type: 'PROBLEM',
        title: 'Open Problem',
        author: 'agent-1',
        content: 'Need solutions',
        confidence: 50,
      });
      entryId = entry.id;
    });

    it('adds contribution to entry', () => {
      const updated = blackboard.contribute(entryId, {
        agentId: 'agent-2',
        content: 'My suggestion',
        confidence: 70,
      });

      expect(updated?.contributions).toHaveLength(1);
      expect(updated?.contributions[0].agentId).toBe('agent-2');
      expect(updated?.contributions[0].content).toBe('My suggestion');
    });

    it('updates average confidence', () => {
      // Initial confidence: 50
      // Contribution confidence: 90
      // Average: (50 + 90) / 2 = 70
      const updated = blackboard.contribute(entryId, {
        agentId: 'agent-2',
        content: 'High confidence solution',
        confidence: 90,
      });

      expect(updated?.confidence).toBe(70);
    });

    it('returns null for non-existent entry', () => {
      const result = blackboard.contribute('nonexistent', {
        agentId: 'agent-1',
        content: 'test',
        confidence: 50,
      });

      expect(result).toBeNull();
    });

    it('emits entry:contributed event', () => {
      const spy = vi.fn();
      blackboard.on('entry:contributed', spy);

      blackboard.contribute(entryId, {
        agentId: 'agent-3',
        content: 'Contribution',
        confidence: 60,
      });

      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls[0][0].id).toBe(entryId);
    });
  });

  describe('resolve', () => {
    let entryId: string;

    beforeEach(() => {
      const entry = blackboard.post({
        type: 'PROBLEM',
        title: 'Problem to Solve',
        author: 'agent-1',
        content: 'Needs resolution',
      });
      entryId = entry.id;
    });

    it('marks entry as resolved', () => {
      const resolved = blackboard.resolve(entryId, {
        resolution: 'Problem solved!',
        resolvedBy: 'agent-2',
      });

      expect(resolved?.status).toBe('RESOLVED');
      expect(resolved?.resolution).toBe('Problem solved!');
      expect(resolved?.resolvedAt).toBeDefined();
    });

    it('emits entry:resolved event', () => {
      const spy = vi.fn();
      blackboard.on('entry:resolved', spy);

      blackboard.resolve(entryId, {
        resolution: 'Done',
        resolvedBy: 'agent-1',
      });

      expect(spy).toHaveBeenCalled();
    });

    it('returns null for non-existent entry', () => {
      const result = blackboard.resolve('nonexistent', {
        resolution: 'test',
        resolvedBy: 'agent-1',
      });

      expect(result).toBeNull();
    });
  });

  describe('updateStatus', () => {
    it('updates entry status', () => {
      const entry = blackboard.post({
        type: 'TASK',
        title: 'Task',
        author: 'agent-1',
        content: 'Do something',
      });

      const updated = blackboard.updateStatus(entry.id, 'IN_PROGRESS');

      expect(updated?.status).toBe('IN_PROGRESS');
    });

    it('emits entry:archived for ARCHIVED status', () => {
      const entry = blackboard.post({
        type: 'OBSERVATION',
        title: 'Old observation',
        author: 'agent-1',
        content: 'outdated',
      });

      const archivedSpy = vi.fn();
      blackboard.on('entry:archived', archivedSpy);

      blackboard.updateStatus(entry.id, 'ARCHIVED');

      expect(archivedSpy).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Query Operations Tests
  // ===========================================================================

  describe('query operations', () => {
    beforeEach(() => {
      // Seed test data
      blackboard.post({ type: 'PROBLEM', title: 'Problem 1', author: 'agent-1', content: 'p1' });
      blackboard.post({ type: 'PROBLEM', title: 'Problem 2', author: 'agent-2', content: 'p2' });
      blackboard.post({ type: 'SOLUTION', title: 'Solution 1', author: 'agent-1', content: 's1' });
      blackboard.post({ type: 'PATTERN', title: 'Pattern 1', author: 'agent-3', content: 'pattern' });
      blackboard.post({ type: 'ANTI_PATTERN', title: 'Anti-Pattern', author: 'agent-1', content: 'avoid this' });
      blackboard.post({ type: 'DECISION', title: 'Pending Decision', author: 'agent-2', content: 'decide' });
    });

    it('gets entry by ID', () => {
      const entry = blackboard.post({
        type: 'OBSERVATION',
        title: 'Test',
        author: 'agent-1',
        content: 'test',
      });

      const retrieved = blackboard.get(entry.id);
      expect(retrieved?.title).toBe('Test');
    });

    it('gets entries by type', () => {
      const problems = blackboard.getByType('PROBLEM');
      expect(problems).toHaveLength(2);
      expect(problems.every(e => e.type === 'PROBLEM')).toBe(true);
    });

    it('gets entries by status', () => {
      const open = blackboard.getByStatus('OPEN');
      expect(open.length).toBeGreaterThan(0);
      expect(open.every(e => e.status === 'OPEN')).toBe(true);
    });

    it('gets open problems', () => {
      const problems = blackboard.getOpenProblems();
      expect(problems).toHaveLength(2);
    });

    it('gets patterns (only resolved)', () => {
      // Resolve the pattern
      const patterns = blackboard.getByType('PATTERN');
      blackboard.resolve(patterns[0].id, { resolution: 'Confirmed', resolvedBy: 'agent-1' });

      const confirmedPatterns = blackboard.getPatterns();
      expect(confirmedPatterns).toHaveLength(1);
    });

    it('gets anti-patterns', () => {
      const antiPatterns = blackboard.getAntiPatterns();
      expect(antiPatterns).toHaveLength(1);
      expect(antiPatterns[0].title).toBe('Anti-Pattern');
    });

    it('gets pending decisions', () => {
      const decisions = blackboard.getPendingDecisions();
      expect(decisions).toHaveLength(1);
      expect(decisions[0].title).toBe('Pending Decision');
    });

    it('gets entries by author', () => {
      const agent1Entries = blackboard.getByAuthor('agent-1');
      expect(agent1Entries).toHaveLength(3);
    });

    it('gets recent entries', () => {
      const recent = blackboard.getRecent(3);
      expect(recent).toHaveLength(3);
      // Most recent should be first
      expect(recent[0].updatedAt.getTime()).toBeGreaterThanOrEqual(
        recent[1].updatedAt.getTime()
      );
    });
  });

  describe('search', () => {
    beforeEach(() => {
      blackboard.post({ type: 'PROBLEM', title: 'Authentication Bug', author: 'a1', content: 'Login fails' });
      blackboard.post({ type: 'SOLUTION', title: 'Fix Login', author: 'a2', content: 'Use OAuth' });
      blackboard.post({ type: 'PATTERN', title: 'Security Pattern', author: 'a1', content: 'Always validate input' });
    });

    it('searches by title keyword', () => {
      const results = blackboard.search('login');
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('searches by content keyword', () => {
      const results = blackboard.search('OAuth');
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Fix Login');
    });

    it('is case-insensitive', () => {
      const results = blackboard.search('AUTHENTICATION');
      expect(results).toHaveLength(1);
    });

    it('returns empty array for no matches', () => {
      const results = blackboard.search('xyznonexistent');
      expect(results).toHaveLength(0);
    });
  });

  describe('visibility filtering', () => {
    it('returns all entries for ALL visibility', () => {
      blackboard.post({
        type: 'OBSERVATION',
        title: 'Public',
        author: 'agent-1',
        content: 'visible to all',
        visibility: 'ALL',
      });

      const visible = blackboard.getVisibleTo('any-agent', 1);
      expect(visible.length).toBeGreaterThanOrEqual(1);
    });

    it('restricts HIGHER_TIERS to T3+', () => {
      blackboard.post({
        type: 'DECISION',
        title: 'Executive Decision',
        author: 'agent-1',
        content: 'strategic',
        visibility: 'HIGHER_TIERS',
      });

      const t2Visible = blackboard.getVisibleTo('t2-agent', 2);
      const t3Visible = blackboard.getVisibleTo('t3-agent', 3);

      const t2Decision = t2Visible.find(e => e.title === 'Executive Decision');
      const t3Decision = t3Visible.find(e => e.title === 'Executive Decision');

      expect(t2Decision).toBeUndefined();
      expect(t3Decision).toBeDefined();
    });

    it('restricts SPECIFIC_AGENTS to listed agents', () => {
      blackboard.post({
        type: 'HYPOTHESIS',
        title: 'Secret Hypothesis',
        author: 'agent-1',
        content: 'classified',
        visibility: 'SPECIFIC_AGENTS',
        visibleTo: ['agent-2', 'agent-3'],
      });

      const agent1Visible = blackboard.getVisibleTo('agent-1', 5);
      const agent2Visible = blackboard.getVisibleTo('agent-2', 5);

      const agent1Secret = agent1Visible.find(e => e.title === 'Secret Hypothesis');
      const agent2Secret = agent2Visible.find(e => e.title === 'Secret Hypothesis');

      expect(agent1Secret).toBeUndefined();
      expect(agent2Secret).toBeDefined();
    });
  });

  describe('dependencies', () => {
    it('gets entries that depend on a specific entry', () => {
      const baseEntry = blackboard.post({
        type: 'PROBLEM',
        title: 'Base Problem',
        author: 'a1',
        content: 'root',
      });

      blackboard.post({
        type: 'PARTIAL_SOLUTION',
        title: 'Depends on Base',
        author: 'a2',
        content: 'partial',
        dependencies: [baseEntry.id],
      });

      blackboard.post({
        type: 'SOLUTION',
        title: 'Also Depends',
        author: 'a3',
        content: 'full',
        dependencies: [baseEntry.id],
      });

      const dependents = blackboard.getDependents(baseEntry.id);
      expect(dependents).toHaveLength(2);
    });
  });

  describe('critical entries', () => {
    it('gets unresolved critical entries', () => {
      blackboard.post({
        type: 'PROBLEM',
        title: 'Critical Bug',
        author: 'a1',
        content: 'system down',
        priority: 'CRITICAL',
      });

      blackboard.post({
        type: 'PROBLEM',
        title: 'Minor Issue',
        author: 'a1',
        content: 'low priority',
        priority: 'LOW',
      });

      const critical = blackboard.getCritical();
      expect(critical).toHaveLength(1);
      expect(critical[0].title).toBe('Critical Bug');
    });

    it('excludes resolved critical entries', () => {
      const entry = blackboard.post({
        type: 'PROBLEM',
        title: 'Was Critical',
        author: 'a1',
        content: 'fixed now',
        priority: 'CRITICAL',
      });

      blackboard.resolve(entry.id, { resolution: 'Fixed', resolvedBy: 'a2' });

      const critical = blackboard.getCritical();
      expect(critical.find(e => e.title === 'Was Critical')).toBeUndefined();
    });
  });

  // ===========================================================================
  // Statistics & Persistence Tests
  // ===========================================================================

  describe('statistics', () => {
    beforeEach(() => {
      blackboard.post({ type: 'PROBLEM', title: 'P1', author: 'a1', content: 'p1', priority: 'HIGH' });
      blackboard.post({ type: 'PROBLEM', title: 'P2', author: 'a2', content: 'p2', priority: 'LOW' });
      blackboard.post({ type: 'SOLUTION', title: 'S1', author: 'a1', content: 's1', priority: 'HIGH' });
    });

    it('returns accurate statistics', () => {
      const stats = blackboard.getStats();

      expect(stats.total).toBe(3);
      expect(stats.byType.PROBLEM).toBe(2);
      expect(stats.byType.SOLUTION).toBe(1);
      expect(stats.byStatus.OPEN).toBe(3);
      expect(stats.byPriority.HIGH).toBe(2);
      expect(stats.byPriority.LOW).toBe(1);
      expect(stats.avgConfidence).toBe(50); // default confidence
    });

    it('counts contributions', () => {
      const entries = blackboard.getByType('PROBLEM');
      blackboard.contribute(entries[0].id, { agentId: 'a3', content: 'c1', confidence: 60 });
      blackboard.contribute(entries[0].id, { agentId: 'a4', content: 'c2', confidence: 70 });

      const stats = blackboard.getStats();
      expect(stats.totalContributions).toBe(2);
    });
  });

  describe('export/import', () => {
    it('exports all entries', () => {
      blackboard.post({ type: 'PROBLEM', title: 'P1', author: 'a1', content: 'p1' });
      blackboard.post({ type: 'SOLUTION', title: 'S1', author: 'a2', content: 's1' });

      const exported = blackboard.export();

      expect(exported).toHaveLength(2);
      expect(exported.some(e => e.title === 'P1')).toBe(true);
    });

    it('imports entries correctly', () => {
      const entries: BlackboardEntry[] = [
        {
          id: 'imported-1',
          type: 'PATTERN',
          title: 'Imported Pattern',
          author: 'external',
          content: 'imported content',
          confidence: 80,
          dependencies: [],
          contributions: [],
          status: 'RESOLVED',
          visibility: 'ALL',
          priority: 'MEDIUM',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      blackboard.import(entries);

      const retrieved = blackboard.get('imported-1');
      expect(retrieved?.title).toBe('Imported Pattern');
    });

    it('clears all entries', () => {
      blackboard.post({ type: 'OBSERVATION', title: 'O1', author: 'a1', content: 'o1' });
      blackboard.post({ type: 'OBSERVATION', title: 'O2', author: 'a2', content: 'o2' });

      blackboard.clear();

      expect(blackboard.export()).toHaveLength(0);
    });
  });
});
