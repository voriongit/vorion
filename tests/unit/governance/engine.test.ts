/**
 * Governance Engine Tests
 *
 * Comprehensive tests for the governance engine including:
 * - Policy matching
 * - Rule evaluation for each operator
 * - Multiple policy evaluation
 * - Conflict resolution (deny wins)
 * - Edge cases
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  GovernanceEngine,
  createGovernanceEngine,
  RuleEvaluator,
  createRuleEvaluator,
  PolicySetManager,
  createPolicy,
  createPolicySet,
  resolveConflicts,
  type Policy,
  type PolicySet,
  type EvaluationResult,
  type EvaluationContext,
  type RuleGroup,
} from '../../../src/governance/index.js';
import type { Intent } from '../../../src/common/types.js';

// =============================================================================
// TEST HELPERS
// =============================================================================

function createTestIntent(overrides?: Partial<Intent>): Intent {
  return {
    id: 'intent-123',
    tenantId: 'tenant-456',
    entityId: 'entity-789',
    goal: 'access-database',
    intentType: 'data.read',
    context: {
      resource: 'database',
      operation: 'read',
      table: 'users',
    },
    metadata: {},
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createTestPolicy(overrides?: Partial<Policy>): Policy {
  return createPolicy({
    id: 'policy-1',
    name: 'Test Policy',
    rules: {
      logic: 'AND',
      rules: [
        { field: 'intent.goal', operator: 'eq', value: 'access-database' },
      ],
    },
    effect: 'allow',
    priority: 100,
    enabled: true,
    ...overrides,
  });
}

function createTestContext(intent: Intent): EvaluationContext {
  return {
    intent,
    context: intent.context as Record<string, unknown>,
  };
}

// =============================================================================
// RULE EVALUATOR TESTS
// =============================================================================

describe('RuleEvaluator', () => {
  let evaluator: RuleEvaluator;

  beforeEach(() => {
    evaluator = createRuleEvaluator();
  });

  describe('Operator: eq (equals)', () => {
    it('should match when values are equal', () => {
      const intent = createTestIntent({ goal: 'test-goal' });
      const context = createTestContext(intent);
      const rule = { field: 'intent.goal', operator: 'eq' as const, value: 'test-goal' };

      const result = evaluator.evaluateRule(rule, context);

      expect(result.matched).toBe(true);
      expect(result.actualValue).toBe('test-goal');
    });

    it('should not match when values are different', () => {
      const intent = createTestIntent({ goal: 'test-goal' });
      const context = createTestContext(intent);
      const rule = { field: 'intent.goal', operator: 'eq' as const, value: 'other-goal' };

      const result = evaluator.evaluateRule(rule, context);

      expect(result.matched).toBe(false);
    });
  });

  describe('Operator: ne (not equals)', () => {
    it('should match when values are different', () => {
      const intent = createTestIntent({ goal: 'test-goal' });
      const context = createTestContext(intent);
      const rule = { field: 'intent.goal', operator: 'ne' as const, value: 'other-goal' };

      const result = evaluator.evaluateRule(rule, context);

      expect(result.matched).toBe(true);
    });

    it('should not match when values are equal', () => {
      const intent = createTestIntent({ goal: 'test-goal' });
      const context = createTestContext(intent);
      const rule = { field: 'intent.goal', operator: 'ne' as const, value: 'test-goal' };

      const result = evaluator.evaluateRule(rule, context);

      expect(result.matched).toBe(false);
    });
  });

  describe('Operator: gt (greater than)', () => {
    it('should match when actual is greater than expected', () => {
      const intent = createTestIntent({ priority: 5 });
      const context = createTestContext(intent);
      const rule = { field: 'intent.priority', operator: 'gt' as const, value: 3 };

      const result = evaluator.evaluateRule(rule, context);

      expect(result.matched).toBe(true);
    });

    it('should not match when actual is less than expected', () => {
      const intent = createTestIntent({ priority: 2 });
      const context = createTestContext(intent);
      const rule = { field: 'intent.priority', operator: 'gt' as const, value: 3 };

      const result = evaluator.evaluateRule(rule, context);

      expect(result.matched).toBe(false);
    });

    it('should not match when values are equal', () => {
      const intent = createTestIntent({ priority: 3 });
      const context = createTestContext(intent);
      const rule = { field: 'intent.priority', operator: 'gt' as const, value: 3 };

      const result = evaluator.evaluateRule(rule, context);

      expect(result.matched).toBe(false);
    });
  });

  describe('Operator: lt (less than)', () => {
    it('should match when actual is less than expected', () => {
      const intent = createTestIntent({ priority: 2 });
      const context = createTestContext(intent);
      const rule = { field: 'intent.priority', operator: 'lt' as const, value: 5 };

      const result = evaluator.evaluateRule(rule, context);

      expect(result.matched).toBe(true);
    });

    it('should not match when actual is greater than expected', () => {
      const intent = createTestIntent({ priority: 7 });
      const context = createTestContext(intent);
      const rule = { field: 'intent.priority', operator: 'lt' as const, value: 5 };

      const result = evaluator.evaluateRule(rule, context);

      expect(result.matched).toBe(false);
    });
  });

  describe('Operator: gte (greater than or equal)', () => {
    it('should match when actual is greater than expected', () => {
      const intent = createTestIntent({ priority: 5 });
      const context = createTestContext(intent);
      const rule = { field: 'intent.priority', operator: 'gte' as const, value: 3 };

      const result = evaluator.evaluateRule(rule, context);

      expect(result.matched).toBe(true);
    });

    it('should match when values are equal', () => {
      const intent = createTestIntent({ priority: 3 });
      const context = createTestContext(intent);
      const rule = { field: 'intent.priority', operator: 'gte' as const, value: 3 };

      const result = evaluator.evaluateRule(rule, context);

      expect(result.matched).toBe(true);
    });

    it('should not match when actual is less than expected', () => {
      const intent = createTestIntent({ priority: 2 });
      const context = createTestContext(intent);
      const rule = { field: 'intent.priority', operator: 'gte' as const, value: 3 };

      const result = evaluator.evaluateRule(rule, context);

      expect(result.matched).toBe(false);
    });
  });

  describe('Operator: lte (less than or equal)', () => {
    it('should match when actual is less than expected', () => {
      const intent = createTestIntent({ priority: 2 });
      const context = createTestContext(intent);
      const rule = { field: 'intent.priority', operator: 'lte' as const, value: 5 };

      const result = evaluator.evaluateRule(rule, context);

      expect(result.matched).toBe(true);
    });

    it('should match when values are equal', () => {
      const intent = createTestIntent({ priority: 5 });
      const context = createTestContext(intent);
      const rule = { field: 'intent.priority', operator: 'lte' as const, value: 5 };

      const result = evaluator.evaluateRule(rule, context);

      expect(result.matched).toBe(true);
    });

    it('should not match when actual is greater than expected', () => {
      const intent = createTestIntent({ priority: 7 });
      const context = createTestContext(intent);
      const rule = { field: 'intent.priority', operator: 'lte' as const, value: 5 };

      const result = evaluator.evaluateRule(rule, context);

      expect(result.matched).toBe(false);
    });
  });

  describe('Operator: in (value in array)', () => {
    it('should match when value is in array', () => {
      const intent = createTestIntent({
        context: { operation: 'read' },
      });
      const context = createTestContext(intent);
      const rule = {
        field: 'intent.context.operation',
        operator: 'in' as const,
        value: ['read', 'write', 'delete'],
      };

      const result = evaluator.evaluateRule(rule, context);

      expect(result.matched).toBe(true);
    });

    it('should not match when value is not in array', () => {
      const intent = createTestIntent({
        context: { operation: 'execute' },
      });
      const context = createTestContext(intent);
      const rule = {
        field: 'intent.context.operation',
        operator: 'in' as const,
        value: ['read', 'write', 'delete'],
      };

      const result = evaluator.evaluateRule(rule, context);

      expect(result.matched).toBe(false);
    });

    it('should handle non-array expected value gracefully', () => {
      const intent = createTestIntent();
      const context = createTestContext(intent);
      const rule = {
        field: 'intent.goal',
        operator: 'in' as const,
        value: 'not-an-array',
      };

      const result = evaluator.evaluateRule(rule, context);

      expect(result.matched).toBe(false);
    });
  });

  describe('Operator: contains', () => {
    it('should match when string contains substring', () => {
      const intent = createTestIntent({ goal: 'access-database-users' });
      const context = createTestContext(intent);
      const rule = { field: 'intent.goal', operator: 'contains' as const, value: 'database' };

      const result = evaluator.evaluateRule(rule, context);

      expect(result.matched).toBe(true);
    });

    it('should not match when string does not contain substring', () => {
      const intent = createTestIntent({ goal: 'access-files' });
      const context = createTestContext(intent);
      const rule = { field: 'intent.goal', operator: 'contains' as const, value: 'database' };

      const result = evaluator.evaluateRule(rule, context);

      expect(result.matched).toBe(false);
    });

    it('should handle non-string values gracefully', () => {
      const intent = createTestIntent({ priority: 5 });
      const context = createTestContext(intent);
      const rule = { field: 'intent.priority', operator: 'contains' as const, value: '5' };

      const result = evaluator.evaluateRule(rule, context);

      expect(result.matched).toBe(false);
    });
  });

  describe('Operator: matches (regex)', () => {
    it('should match when regex pattern matches', () => {
      const intent = createTestIntent({ goal: 'access-database-v2' });
      const context = createTestContext(intent);
      const rule = {
        field: 'intent.goal',
        operator: 'matches' as const,
        value: '^access-.*-v\\d+$',
      };

      const result = evaluator.evaluateRule(rule, context);

      expect(result.matched).toBe(true);
    });

    it('should not match when regex pattern does not match', () => {
      const intent = createTestIntent({ goal: 'delete-database' });
      const context = createTestContext(intent);
      const rule = {
        field: 'intent.goal',
        operator: 'matches' as const,
        value: '^access-.*$',
      };

      const result = evaluator.evaluateRule(rule, context);

      expect(result.matched).toBe(false);
    });

    it('should handle invalid regex gracefully', () => {
      const intent = createTestIntent();
      const context = createTestContext(intent);
      const rule = {
        field: 'intent.goal',
        operator: 'matches' as const,
        value: '[invalid(regex',
      };

      const result = evaluator.evaluateRule(rule, context);

      expect(result.matched).toBe(false);
    });
  });

  describe('Rule Groups', () => {
    it('should evaluate AND logic correctly when all rules match', () => {
      const intent = createTestIntent({
        goal: 'access-database',
        context: { operation: 'read' },
      });
      const context = createTestContext(intent);
      const ruleGroup: RuleGroup = {
        logic: 'AND',
        rules: [
          { field: 'intent.goal', operator: 'eq', value: 'access-database' },
          { field: 'intent.context.operation', operator: 'eq', value: 'read' },
        ],
      };

      const result = evaluator.evaluateRuleGroup(ruleGroup, context);

      expect(result.matched).toBe(true);
      expect(result.ruleResults).toHaveLength(2);
    });

    it('should evaluate AND logic correctly when one rule fails', () => {
      const intent = createTestIntent({
        goal: 'access-database',
        context: { operation: 'write' },
      });
      const context = createTestContext(intent);
      const ruleGroup: RuleGroup = {
        logic: 'AND',
        rules: [
          { field: 'intent.goal', operator: 'eq', value: 'access-database' },
          { field: 'intent.context.operation', operator: 'eq', value: 'read' },
        ],
      };

      const result = evaluator.evaluateRuleGroup(ruleGroup, context);

      expect(result.matched).toBe(false);
    });

    it('should evaluate OR logic correctly when one rule matches', () => {
      const intent = createTestIntent({
        goal: 'access-database',
        context: { operation: 'write' },
      });
      const context = createTestContext(intent);
      const ruleGroup: RuleGroup = {
        logic: 'OR',
        rules: [
          { field: 'intent.goal', operator: 'eq', value: 'access-files' },
          { field: 'intent.context.operation', operator: 'eq', value: 'write' },
        ],
      };

      const result = evaluator.evaluateRuleGroup(ruleGroup, context);

      expect(result.matched).toBe(true);
    });

    it('should evaluate OR logic correctly when no rules match', () => {
      const intent = createTestIntent({
        goal: 'access-database',
        context: { operation: 'read' },
      });
      const context = createTestContext(intent);
      const ruleGroup: RuleGroup = {
        logic: 'OR',
        rules: [
          { field: 'intent.goal', operator: 'eq', value: 'access-files' },
          { field: 'intent.context.operation', operator: 'eq', value: 'delete' },
        ],
      };

      const result = evaluator.evaluateRuleGroup(ruleGroup, context);

      expect(result.matched).toBe(false);
    });

    it('should short-circuit AND evaluation on first failure', () => {
      const intent = createTestIntent();
      const context = createTestContext(intent);
      const ruleGroup: RuleGroup = {
        logic: 'AND',
        rules: [
          { field: 'intent.goal', operator: 'eq', value: 'wrong-goal' },
          { field: 'intent.goal', operator: 'eq', value: 'access-database' },
        ],
      };

      const result = evaluator.evaluateRuleGroup(ruleGroup, context);

      expect(result.matched).toBe(false);
      // Should have stopped after first failure
      expect(result.ruleResults).toHaveLength(1);
    });

    it('should short-circuit OR evaluation on first match', () => {
      const intent = createTestIntent();
      const context = createTestContext(intent);
      const ruleGroup: RuleGroup = {
        logic: 'OR',
        rules: [
          { field: 'intent.goal', operator: 'eq', value: 'access-database' },
          { field: 'intent.goal', operator: 'eq', value: 'wrong-goal' },
        ],
      };

      const result = evaluator.evaluateRuleGroup(ruleGroup, context);

      expect(result.matched).toBe(true);
      // Should have stopped after first match
      expect(result.ruleResults).toHaveLength(1);
    });
  });

  describe('Field Path Resolution', () => {
    it('should resolve nested field paths', () => {
      const intent = createTestIntent({
        context: {
          database: {
            table: 'users',
            schema: 'public',
          },
        },
      });
      const context = createTestContext(intent);
      const rule = {
        field: 'intent.context.database.table',
        operator: 'eq' as const,
        value: 'users',
      };

      const result = evaluator.evaluateRule(rule, context);

      expect(result.matched).toBe(true);
      expect(result.actualValue).toBe('users');
    });

    it('should return undefined for non-existent paths', () => {
      const intent = createTestIntent();
      const context = createTestContext(intent);
      const rule = {
        field: 'intent.nonexistent.path',
        operator: 'eq' as const,
        value: 'value',
      };

      const result = evaluator.evaluateRule(rule, context);

      expect(result.matched).toBe(false);
      expect(result.actualValue).toBeUndefined();
    });
  });
});

// =============================================================================
// GOVERNANCE ENGINE TESTS
// =============================================================================

describe('GovernanceEngine', () => {
  let engine: GovernanceEngine;

  beforeEach(() => {
    engine = createGovernanceEngine();
  });

  describe('Policy Matching', () => {
    it('should match intent against a single policy', () => {
      const intent = createTestIntent();
      const policy = createTestPolicy();

      const result = engine.evaluateIntent(intent, [policy]);

      expect(result.permitted).toBe(true);
      expect(result.decision).toBe('allow');
      expect(result.matchedPolicies).toHaveLength(1);
    });

    it('should not match when policy rules do not match', () => {
      const intent = createTestIntent({ goal: 'different-goal' });
      const policy = createTestPolicy({
        rules: {
          logic: 'AND',
          rules: [{ field: 'intent.goal', operator: 'eq', value: 'access-database' }],
        },
      });

      const result = engine.evaluateIntent(intent, [policy]);

      expect(result.matchedPolicies).toHaveLength(0);
    });

    it('should match policy with conditions', () => {
      const intent = createTestIntent({
        intentType: 'data.read',
        context: { resource: 'database' },
      });
      const policy = createTestPolicy({
        conditions: {
          intentTypes: ['data.read'],
          resources: ['database'],
        },
        rules: {
          logic: 'AND',
          rules: [{ field: 'intent.goal', operator: 'eq', value: 'access-database' }],
        },
      });

      const result = engine.evaluateIntent(intent, [policy]);

      expect(result.matchedPolicies).toHaveLength(1);
    });

    it('should not match policy when conditions do not match', () => {
      const intent = createTestIntent({
        intentType: 'data.write',
      });
      const policy = createTestPolicy({
        conditions: {
          intentTypes: ['data.read'],
        },
      });

      const result = engine.evaluateIntent(intent, [policy]);

      expect(result.matchedPolicies).toHaveLength(0);
    });

    it('should skip disabled policies', () => {
      const intent = createTestIntent();
      const policy = createTestPolicy({ enabled: false });

      const result = engine.evaluateIntent(intent, [policy]);

      expect(result.matchedPolicies).toHaveLength(0);
    });
  });

  describe('Multiple Policy Evaluation', () => {
    it('should evaluate multiple policies in priority order', () => {
      const intent = createTestIntent();
      const highPriorityPolicy = createTestPolicy({
        id: 'high-priority',
        name: 'High Priority',
        priority: 10,
        effect: 'allow',
      });
      const lowPriorityPolicy = createTestPolicy({
        id: 'low-priority',
        name: 'Low Priority',
        priority: 100,
        effect: 'deny',
      });

      const result = engine.evaluateIntent(intent, [lowPriorityPolicy, highPriorityPolicy]);

      // Both should match, but allow should win in deny-overrides if no deny
      expect(result.policiesEvaluated).toHaveLength(2);
      expect(result.matchedPolicies).toHaveLength(2);
    });

    it('should return all matched policies in audit', () => {
      const intent = createTestIntent();
      const policy1 = createTestPolicy({ id: 'policy-1', name: 'Policy 1' });
      const policy2 = createTestPolicy({ id: 'policy-2', name: 'Policy 2' });

      const result = engine.evaluateIntent(intent, [policy1, policy2]);

      expect(result.matchedPolicies).toHaveLength(2);
      expect(result.matchedPolicies.map(p => p.policyId)).toContain('policy-1');
      expect(result.matchedPolicies.map(p => p.policyId)).toContain('policy-2');
    });
  });

  describe('Conflict Resolution', () => {
    describe('deny-overrides strategy', () => {
      it('should deny when any policy denies', () => {
        const engine = createGovernanceEngine({ conflictResolution: 'deny-overrides' });
        const intent = createTestIntent();
        const allowPolicy = createTestPolicy({ id: 'allow', effect: 'allow', priority: 10 });
        const denyPolicy = createTestPolicy({ id: 'deny', effect: 'deny', priority: 20 });

        const result = engine.evaluateIntent(intent, [allowPolicy, denyPolicy]);

        expect(result.decision).toBe('deny');
        expect(result.permitted).toBe(false);
      });

      it('should allow when all policies allow', () => {
        const engine = createGovernanceEngine({ conflictResolution: 'deny-overrides' });
        const intent = createTestIntent();
        const policy1 = createTestPolicy({ id: 'p1', effect: 'allow' });
        const policy2 = createTestPolicy({ id: 'p2', effect: 'allow' });

        const result = engine.evaluateIntent(intent, [policy1, policy2]);

        expect(result.decision).toBe('allow');
        expect(result.permitted).toBe(true);
      });

      it('should short-circuit on deny', () => {
        const engine = createGovernanceEngine({ conflictResolution: 'deny-overrides' });
        const intent = createTestIntent();
        const denyPolicy = createTestPolicy({ id: 'deny', effect: 'deny', priority: 10 });
        const allowPolicy = createTestPolicy({ id: 'allow', effect: 'allow', priority: 20 });

        const result = engine.evaluateIntent(intent, [denyPolicy, allowPolicy]);

        // Should only have evaluated the deny policy
        expect(result.policiesEvaluated).toHaveLength(1);
        expect(result.decision).toBe('deny');
      });
    });

    describe('allow-overrides strategy', () => {
      it('should allow when any policy allows', () => {
        const engine = createGovernanceEngine({ conflictResolution: 'allow-overrides' });
        const intent = createTestIntent();
        const denyPolicy = createTestPolicy({ id: 'deny', effect: 'deny' });
        const allowPolicy = createTestPolicy({ id: 'allow', effect: 'allow' });

        const result = engine.evaluateIntent(intent, [denyPolicy, allowPolicy]);

        expect(result.decision).toBe('allow');
        expect(result.permitted).toBe(true);
      });
    });

    describe('first-match strategy', () => {
      it('should use first matching policy effect', () => {
        const engine = createGovernanceEngine({ conflictResolution: 'first-match' });
        const intent = createTestIntent();
        const firstPolicy = createTestPolicy({ id: 'first', effect: 'deny', priority: 10 });
        const secondPolicy = createTestPolicy({ id: 'second', effect: 'allow', priority: 20 });

        const result = engine.evaluateIntent(intent, [firstPolicy, secondPolicy]);

        expect(result.decision).toBe('deny');
      });
    });

    describe('priority-based strategy', () => {
      it('should use highest priority (lowest number) policy effect', () => {
        const engine = createGovernanceEngine({ conflictResolution: 'priority-based' });
        const intent = createTestIntent();
        const lowPriority = createTestPolicy({ id: 'low', effect: 'deny', priority: 100 });
        const highPriority = createTestPolicy({ id: 'high', effect: 'allow', priority: 10 });

        const result = engine.evaluateIntent(intent, [lowPriority, highPriority]);

        expect(result.decision).toBe('allow');
      });
    });
  });

  describe('resolveConflicts helper', () => {
    it('should return allow for empty effects', () => {
      const result = resolveConflicts([], 'deny-overrides');
      expect(result).toBe('allow');
    });

    it('should handle deny-overrides with mixed effects', () => {
      const effects = [
        { effect: 'allow' as const, priority: 10 },
        { effect: 'deny' as const, priority: 20 },
      ];
      const result = resolveConflicts(effects, 'deny-overrides');
      expect(result).toBe('deny');
    });

    it('should handle allow-overrides with mixed effects', () => {
      const effects = [
        { effect: 'deny' as const, priority: 10 },
        { effect: 'allow' as const, priority: 20 },
      ];
      const result = resolveConflicts(effects, 'allow-overrides');
      expect(result).toBe('allow');
    });
  });

  describe('Edge Cases', () => {
    it('should use default decision when no policies are provided', () => {
      const engine = createGovernanceEngine({ defaultDecision: 'allow' });
      const intent = createTestIntent();

      const result = engine.evaluateIntent(intent, []);

      expect(result.decision).toBe('allow');
      expect(result.permitted).toBe(true);
      expect(result.reason).toBe('No matching policies found');
    });

    it('should use default decision when no policies match', () => {
      const engine = createGovernanceEngine({ defaultDecision: 'deny' });
      const intent = createTestIntent({ goal: 'unmatched-goal' });
      const policy = createTestPolicy({
        rules: {
          logic: 'AND',
          rules: [{ field: 'intent.goal', operator: 'eq', value: 'specific-goal' }],
        },
      });

      const result = engine.evaluateIntent(intent, [policy]);

      expect(result.decision).toBe('deny');
      expect(result.permitted).toBe(false);
    });

    it('should handle all deny policies', () => {
      const intent = createTestIntent();
      const policy1 = createTestPolicy({ id: 'p1', effect: 'deny' });
      const policy2 = createTestPolicy({ id: 'p2', effect: 'deny' });

      const result = engine.evaluateIntent(intent, [policy1, policy2]);

      expect(result.decision).toBe('deny');
      expect(result.permitted).toBe(false);
    });

    it('should include audit trail for rule evaluation', () => {
      const intent = createTestIntent();
      const policy = createTestPolicy({
        rules: {
          logic: 'AND',
          rules: [
            { field: 'intent.goal', operator: 'eq', value: 'access-database' },
            { field: 'intent.context.operation', operator: 'eq', value: 'read' },
          ],
        },
      });

      const result = engine.evaluateIntent(intent, [policy]);

      expect(result.matchedPolicies[0]?.ruleAudit).toHaveLength(2);
      expect(result.matchedPolicies[0]?.ruleAudit[0]?.field).toBe('intent.goal');
      expect(result.matchedPolicies[0]?.ruleAudit[0]?.matched).toBe(true);
    });

    it('should handle policies with empty rules', () => {
      const intent = createTestIntent();
      const policy = createTestPolicy({
        rules: {
          logic: 'AND',
          rules: [],
        },
      });

      const result = engine.evaluateIntent(intent, [policy]);

      // Empty AND rules should match (vacuous truth)
      expect(result.matchedPolicies).toHaveLength(1);
    });
  });

  describe('Policy Condition Wildcards', () => {
    it('should match wildcard actions', () => {
      const intent = createTestIntent({ goal: 'access-database-users' });
      const policy = createTestPolicy({
        conditions: { actions: ['access-*'] },
        rules: {
          logic: 'AND',
          rules: [{ field: 'intent.goal', operator: 'contains', value: 'database' }],
        },
      });

      const result = engine.evaluateIntent(intent, [policy]);

      expect(result.matchedPolicies).toHaveLength(1);
    });

    it('should match wildcard resources', () => {
      const intent = createTestIntent({
        context: { resource: 'database-users' },
      });
      const policy = createTestPolicy({
        conditions: { resources: ['database-*'] },
      });

      const result = engine.evaluateIntent(intent, [policy]);

      expect(result.matchedPolicies).toHaveLength(1);
    });

    it('should match any with asterisk', () => {
      const intent = createTestIntent({
        intentType: 'data.write',
      });
      const policy = createTestPolicy({
        conditions: { intentTypes: ['*'] },
      });

      const result = engine.evaluateIntent(intent, [policy]);

      expect(result.matchedPolicies).toHaveLength(1);
    });
  });
});

// =============================================================================
// POLICY SET MANAGER TESTS
// =============================================================================

describe('PolicySetManager', () => {
  let manager: PolicySetManager;

  beforeEach(() => {
    manager = new PolicySetManager();
  });

  it('should add and retrieve policy sets', () => {
    const policySet = createPolicySet({
      id: 'set-1',
      name: 'Test Set',
      policies: [createTestPolicy()],
    });

    manager.addPolicySet(policySet);
    const retrieved = manager.getPolicySet('set-1');

    expect(retrieved).toBeDefined();
    expect(retrieved?.name).toBe('Test Set');
  });

  it('should remove policy sets', () => {
    const policySet = createPolicySet({
      id: 'set-1',
      name: 'Test Set',
      policies: [],
    });

    manager.addPolicySet(policySet);
    const removed = manager.removePolicySet('set-1');

    expect(removed).toBe(true);
    expect(manager.getPolicySet('set-1')).toBeUndefined();
  });

  it('should get all enabled policies sorted by priority', () => {
    const policySet = createPolicySet({
      id: 'set-1',
      name: 'Test Set',
      policies: [
        createTestPolicy({ id: 'p1', priority: 100, enabled: true }),
        createTestPolicy({ id: 'p2', priority: 10, enabled: true }),
        createTestPolicy({ id: 'p3', priority: 50, enabled: false }),
      ],
    });

    manager.addPolicySet(policySet);
    const policies = manager.getAllEnabledPolicies();

    expect(policies).toHaveLength(2);
    expect(policies[0]?.id).toBe('p2'); // Priority 10 first
    expect(policies[1]?.id).toBe('p1'); // Priority 100 second
  });

  it('should find matching policies', () => {
    const policySet = createPolicySet({
      id: 'set-1',
      name: 'Test Set',
      policies: [
        createTestPolicy({
          id: 'p1',
          conditions: { intentTypes: ['data.read'] },
        }),
        createTestPolicy({
          id: 'p2',
          conditions: { intentTypes: ['data.write'] },
        }),
      ],
    });

    manager.addPolicySet(policySet);
    const matching = manager.findMatchingPolicies(undefined, undefined, 'data.read');

    expect(matching).toHaveLength(1);
    expect(matching[0]?.id).toBe('p1');
  });

  it('should clear all policy sets', () => {
    manager.addPolicySet(createPolicySet({ id: 's1', name: 'Set 1', policies: [] }));
    manager.addPolicySet(createPolicySet({ id: 's2', name: 'Set 2', policies: [] }));

    manager.clear();

    expect(manager.getAllPolicySets()).toHaveLength(0);
  });
});

// =============================================================================
// GOVERNANCE ENGINE POLICY SET INTEGRATION
// =============================================================================

describe('GovernanceEngine PolicySet Integration', () => {
  let engine: GovernanceEngine;

  beforeEach(() => {
    engine = createGovernanceEngine();
  });

  it('should add and use policy sets', () => {
    const policySet = createPolicySet({
      id: 'set-1',
      name: 'Security Policies',
      policies: [createTestPolicy()],
    });

    engine.addPolicySet(policySet);
    const policies = engine.loadPoliciesFromSets();

    expect(policies).toHaveLength(1);
  });

  it('should remove policy sets', () => {
    const policySet = createPolicySet({
      id: 'set-1',
      name: 'Security Policies',
      policies: [createTestPolicy()],
    });

    engine.addPolicySet(policySet);
    engine.removePolicySet('set-1');
    const policies = engine.loadPoliciesFromSets();

    expect(policies).toHaveLength(0);
  });

  it('should evaluate intent against loaded policy sets', () => {
    const intent = createTestIntent();
    const policySet = createPolicySet({
      id: 'set-1',
      name: 'Security Policies',
      policies: [
        createTestPolicy({ id: 'p1', effect: 'allow' }),
      ],
    });

    engine.addPolicySet(policySet);
    const policies = engine.loadPoliciesFromSets();
    const result = engine.evaluateIntent(intent, policies);

    expect(result.permitted).toBe(true);
  });

  it('should find matching policies from sets', () => {
    const policySet = createPolicySet({
      id: 'set-1',
      name: 'Security Policies',
      policies: [
        createTestPolicy({
          id: 'p1',
          conditions: { actions: ['access-*'] },
        }),
      ],
    });

    engine.addPolicySet(policySet);
    const matching = engine.findMatchingPolicies('access-database');

    expect(matching).toHaveLength(1);
  });

  it('should clear all policies', () => {
    engine.addPolicySet(createPolicySet({
      id: 's1',
      name: 'Set 1',
      policies: [createTestPolicy()],
    }));

    engine.clearPolicies();
    const policies = engine.loadPoliciesFromSets();

    expect(policies).toHaveLength(0);
  });
});
