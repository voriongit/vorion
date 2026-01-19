/**
 * Policy Evaluator Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  PolicyEvaluator,
  createPolicyEvaluator,
} from '../../../src/policy/evaluator.js';
import type {
  Policy,
  PolicyDefinition,
  PolicyEvaluationContext,
} from '../../../src/policy/types.js';

describe('PolicyEvaluator', () => {
  let evaluator: PolicyEvaluator;

  beforeEach(() => {
    evaluator = createPolicyEvaluator();
  });

  const createContext = (overrides?: Partial<PolicyEvaluationContext>): PolicyEvaluationContext => ({
    intent: {
      id: 'intent-123',
      tenantId: 'tenant-456',
      entityId: 'entity-789',
      goal: 'Test goal',
      intentType: 'action.execute',
      context: { resource: 'database', operation: 'write' },
      metadata: {},
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    entity: {
      id: 'entity-789',
      type: 'agent',
      trustScore: 750,
      trustLevel: 3,
      attributes: { role: 'admin', department: 'engineering' },
    },
    environment: {
      timestamp: new Date().toISOString(),
      timezone: 'UTC',
      requestId: 'req-abc',
    },
    ...overrides,
  });

  const createPolicy = (
    definition: PolicyDefinition,
    overrides?: Partial<Policy>
  ): Policy => ({
    id: 'policy-1',
    tenantId: 'tenant-456',
    name: 'Test Policy',
    namespace: 'default',
    version: 1,
    status: 'published',
    definition,
    checksum: 'abc123',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  });

  describe('evaluatePolicy', () => {
    it('should return default action when no rules match', async () => {
      const policy = createPolicy({
        version: '1.0',
        rules: [
          {
            id: 'rule-1',
            name: 'Never matches',
            priority: 1,
            enabled: true,
            when: {
              type: 'field',
              field: 'intent.goal',
              operator: 'equals',
              value: 'nonexistent',
            },
            then: { action: 'deny', reason: 'Should not match' },
          },
        ],
        defaultAction: 'allow',
      });

      const context = createContext();
      const result = await evaluator.evaluatePolicy(policy, context);

      expect(result.action).toBe('allow');
      expect(result.matched).toBe(false);
      expect(result.matchedRules).toHaveLength(0);
    });

    it('should deny when rule matches with deny action', async () => {
      const policy = createPolicy({
        version: '1.0',
        rules: [
          {
            id: 'rule-1',
            name: 'Deny writes',
            priority: 1,
            enabled: true,
            when: {
              type: 'field',
              field: 'intent.context.operation',
              operator: 'equals',
              value: 'write',
            },
            then: { action: 'deny', reason: 'Write operations not allowed' },
          },
        ],
        defaultAction: 'allow',
      });

      const context = createContext();
      const result = await evaluator.evaluatePolicy(policy, context);

      expect(result.action).toBe('deny');
      expect(result.matched).toBe(true);
      expect(result.reason).toBe('Write operations not allowed');
      expect(result.matchedRules).toHaveLength(1);
    });

    it('should skip disabled rules', async () => {
      const policy = createPolicy({
        version: '1.0',
        rules: [
          {
            id: 'rule-1',
            name: 'Disabled rule',
            priority: 1,
            enabled: false,
            when: {
              type: 'field',
              field: 'intent.goal',
              operator: 'equals',
              value: 'Test goal',
            },
            then: { action: 'deny', reason: 'Should be skipped' },
          },
        ],
        defaultAction: 'allow',
      });

      const context = createContext();
      const result = await evaluator.evaluatePolicy(policy, context);

      expect(result.action).toBe('allow');
      expect(result.rulesEvaluated).toHaveLength(0);
    });

    it('should respect rule priority order', async () => {
      const policy = createPolicy({
        version: '1.0',
        rules: [
          {
            id: 'rule-low-priority',
            name: 'Low priority allow',
            priority: 10,
            enabled: true,
            when: {
              type: 'field',
              field: 'intent.goal',
              operator: 'exists',
              value: true,
            },
            then: { action: 'allow' },
          },
          {
            id: 'rule-high-priority',
            name: 'High priority deny',
            priority: 1,
            enabled: true,
            when: {
              type: 'field',
              field: 'intent.goal',
              operator: 'exists',
              value: true,
            },
            then: { action: 'deny', reason: 'Blocked by high priority rule' },
          },
        ],
        defaultAction: 'allow',
      });

      const context = createContext();
      const result = await evaluator.evaluatePolicy(policy, context);

      // High priority rule should be evaluated first and cause short-circuit
      expect(result.action).toBe('deny');
      expect(result.reason).toBe('Blocked by high priority rule');
    });
  });

  describe('Field Conditions', () => {
    it('should evaluate equals condition', async () => {
      const policy = createPolicy({
        version: '1.0',
        rules: [
          {
            id: 'rule-1',
            name: 'Check goal',
            priority: 1,
            enabled: true,
            when: {
              type: 'field',
              field: 'intent.goal',
              operator: 'equals',
              value: 'Test goal',
            },
            then: { action: 'deny' },
          },
        ],
        defaultAction: 'allow',
      });

      const context = createContext();
      const result = await evaluator.evaluatePolicy(policy, context);

      expect(result.action).toBe('deny');
    });

    it('should evaluate not_equals condition', async () => {
      const policy = createPolicy({
        version: '1.0',
        rules: [
          {
            id: 'rule-1',
            name: 'Check goal not equal',
            priority: 1,
            enabled: true,
            when: {
              type: 'field',
              field: 'intent.goal',
              operator: 'not_equals',
              value: 'Other goal',
            },
            then: { action: 'escalate' },
          },
        ],
        defaultAction: 'allow',
      });

      const context = createContext();
      const result = await evaluator.evaluatePolicy(policy, context);

      expect(result.action).toBe('escalate');
    });

    it('should evaluate in condition', async () => {
      const policy = createPolicy({
        version: '1.0',
        rules: [
          {
            id: 'rule-1',
            name: 'Check operation in list',
            priority: 1,
            enabled: true,
            when: {
              type: 'field',
              field: 'intent.context.operation',
              operator: 'in',
              value: ['read', 'write', 'delete'],
            },
            then: { action: 'monitor' },
          },
        ],
        defaultAction: 'allow',
      });

      const context = createContext();
      const result = await evaluator.evaluatePolicy(policy, context);

      expect(result.action).toBe('monitor');
    });

    it('should evaluate contains condition', async () => {
      const policy = createPolicy({
        version: '1.0',
        rules: [
          {
            id: 'rule-1',
            name: 'Check goal contains',
            priority: 1,
            enabled: true,
            when: {
              type: 'field',
              field: 'intent.goal',
              operator: 'contains',
              value: 'Test',
            },
            then: { action: 'limit' },
          },
        ],
        defaultAction: 'allow',
      });

      const context = createContext();
      const result = await evaluator.evaluatePolicy(policy, context);

      expect(result.action).toBe('limit');
    });

    it('should evaluate exists condition', async () => {
      const policy = createPolicy({
        version: '1.0',
        rules: [
          {
            id: 'rule-1',
            name: 'Check field exists',
            priority: 1,
            enabled: true,
            when: {
              type: 'field',
              field: 'intent.context.resource',
              operator: 'exists',
              value: true,
            },
            then: { action: 'escalate' },
          },
        ],
        defaultAction: 'allow',
      });

      const context = createContext();
      const result = await evaluator.evaluatePolicy(policy, context);

      expect(result.action).toBe('escalate');
    });

    it('should evaluate not_exists condition', async () => {
      const policy = createPolicy({
        version: '1.0',
        rules: [
          {
            id: 'rule-1',
            name: 'Check field not exists',
            priority: 1,
            enabled: true,
            when: {
              type: 'field',
              field: 'intent.context.nonexistent',
              operator: 'not_exists',
              value: true,
            },
            then: { action: 'deny' },
          },
        ],
        defaultAction: 'allow',
      });

      const context = createContext();
      const result = await evaluator.evaluatePolicy(policy, context);

      expect(result.action).toBe('deny');
    });

    it('should evaluate numeric comparisons', async () => {
      const policy = createPolicy({
        version: '1.0',
        rules: [
          {
            id: 'rule-1',
            name: 'Check trust score',
            priority: 1,
            enabled: true,
            when: {
              type: 'field',
              field: 'entity.trustScore',
              operator: 'greater_than_or_equal',
              value: 700,
            },
            then: { action: 'allow' },
          },
        ],
        defaultAction: 'deny',
      });

      const context = createContext();
      const result = await evaluator.evaluatePolicy(policy, context);

      expect(result.action).toBe('allow');
    });

    it('should evaluate matches (regex) condition', async () => {
      const policy = createPolicy({
        version: '1.0',
        rules: [
          {
            id: 'rule-1',
            name: 'Check goal regex',
            priority: 1,
            enabled: true,
            when: {
              type: 'field',
              field: 'intent.goal',
              operator: 'matches',
              value: '^Test.*$',
            },
            then: { action: 'deny' },
          },
        ],
        defaultAction: 'allow',
      });

      const context = createContext();
      const result = await evaluator.evaluatePolicy(policy, context);

      expect(result.action).toBe('deny');
    });
  });

  describe('Compound Conditions', () => {
    it('should evaluate AND condition', async () => {
      const policy = createPolicy({
        version: '1.0',
        rules: [
          {
            id: 'rule-1',
            name: 'Check multiple conditions',
            priority: 1,
            enabled: true,
            when: {
              type: 'compound',
              operator: 'and',
              conditions: [
                {
                  type: 'field',
                  field: 'intent.context.operation',
                  operator: 'equals',
                  value: 'write',
                },
                {
                  type: 'field',
                  field: 'entity.type',
                  operator: 'equals',
                  value: 'agent',
                },
              ],
            },
            then: { action: 'escalate', reason: 'Agent write requires approval' },
          },
        ],
        defaultAction: 'allow',
      });

      const context = createContext();
      const result = await evaluator.evaluatePolicy(policy, context);

      expect(result.action).toBe('escalate');
    });

    it('should evaluate OR condition', async () => {
      const policy = createPolicy({
        version: '1.0',
        rules: [
          {
            id: 'rule-1',
            name: 'Check either condition',
            priority: 1,
            enabled: true,
            when: {
              type: 'compound',
              operator: 'or',
              conditions: [
                {
                  type: 'field',
                  field: 'intent.context.operation',
                  operator: 'equals',
                  value: 'delete', // false
                },
                {
                  type: 'field',
                  field: 'entity.type',
                  operator: 'equals',
                  value: 'agent', // true
                },
              ],
            },
            then: { action: 'deny' },
          },
        ],
        defaultAction: 'allow',
      });

      const context = createContext();
      const result = await evaluator.evaluatePolicy(policy, context);

      expect(result.action).toBe('deny');
    });

    it('should evaluate NOT condition', async () => {
      const policy = createPolicy({
        version: '1.0',
        rules: [
          {
            id: 'rule-1',
            name: 'Check NOT condition',
            priority: 1,
            enabled: true,
            when: {
              type: 'compound',
              operator: 'not',
              conditions: [
                {
                  type: 'field',
                  field: 'entity.type',
                  operator: 'equals',
                  value: 'user', // false, so NOT is true
                },
              ],
            },
            then: { action: 'deny' },
          },
        ],
        defaultAction: 'allow',
      });

      const context = createContext();
      const result = await evaluator.evaluatePolicy(policy, context);

      expect(result.action).toBe('deny');
    });

    it('should evaluate nested compound conditions', async () => {
      const policy = createPolicy({
        version: '1.0',
        rules: [
          {
            id: 'rule-1',
            name: 'Complex nested condition',
            priority: 1,
            enabled: true,
            when: {
              type: 'compound',
              operator: 'and',
              conditions: [
                {
                  type: 'field',
                  field: 'entity.type',
                  operator: 'equals',
                  value: 'agent',
                },
                {
                  type: 'compound',
                  operator: 'or',
                  conditions: [
                    {
                      type: 'field',
                      field: 'intent.context.operation',
                      operator: 'equals',
                      value: 'write',
                    },
                    {
                      type: 'field',
                      field: 'intent.context.operation',
                      operator: 'equals',
                      value: 'delete',
                    },
                  ],
                },
              ],
            },
            then: { action: 'escalate' },
          },
        ],
        defaultAction: 'allow',
      });

      const context = createContext();
      const result = await evaluator.evaluatePolicy(policy, context);

      expect(result.action).toBe('escalate');
    });
  });

  describe('Trust Conditions', () => {
    it('should evaluate trust level equals', async () => {
      const policy = createPolicy({
        version: '1.0',
        rules: [
          {
            id: 'rule-1',
            name: 'Check trust level',
            priority: 1,
            enabled: true,
            when: {
              type: 'trust',
              level: 3,
              operator: 'equals',
            },
            then: { action: 'allow' },
          },
        ],
        defaultAction: 'deny',
      });

      const context = createContext();
      const result = await evaluator.evaluatePolicy(policy, context);

      expect(result.action).toBe('allow');
    });

    it('should evaluate trust level less than', async () => {
      const policy = createPolicy({
        version: '1.0',
        rules: [
          {
            id: 'rule-1',
            name: 'Check trust level too low',
            priority: 1,
            enabled: true,
            when: {
              type: 'trust',
              level: 2,
              operator: 'less_than',
            },
            then: { action: 'deny', reason: 'Trust level too low' },
          },
        ],
        defaultAction: 'allow',
      });

      const context = createContext({ entity: { ...createContext().entity, trustLevel: 1 } });
      const result = await evaluator.evaluatePolicy(policy, context);

      expect(result.action).toBe('deny');
    });
  });

  describe('evaluateMultiple', () => {
    it('should evaluate multiple policies and return most restrictive action', async () => {
      const policy1 = createPolicy(
        {
          version: '1.0',
          rules: [
            {
              id: 'rule-1',
              name: 'Allow rule',
              priority: 1,
              enabled: true,
              when: {
                type: 'field',
                field: 'intent.goal',
                operator: 'exists',
                value: true,
              },
              then: { action: 'allow' },
            },
          ],
          defaultAction: 'allow',
        },
        { id: 'policy-1', name: 'Policy 1' }
      );

      const policy2 = createPolicy(
        {
          version: '1.0',
          rules: [
            {
              id: 'rule-1',
              name: 'Escalate rule',
              priority: 1,
              enabled: true,
              when: {
                type: 'field',
                field: 'entity.type',
                operator: 'equals',
                value: 'agent',
              },
              then: { action: 'escalate', reason: 'Agents require escalation' },
            },
          ],
          defaultAction: 'allow',
        },
        { id: 'policy-2', name: 'Policy 2' }
      );

      const context = createContext();
      const result = await evaluator.evaluateMultiple([policy1, policy2], context);

      expect(result.finalAction).toBe('escalate');
      expect(result.policiesEvaluated).toHaveLength(2);
      expect(result.appliedPolicy?.policyName).toBe('Policy 2');
    });

    it('should short-circuit on deny', async () => {
      const policy1 = createPolicy(
        {
          version: '1.0',
          rules: [
            {
              id: 'rule-1',
              name: 'Deny rule',
              priority: 1,
              enabled: true,
              when: {
                type: 'field',
                field: 'intent.goal',
                operator: 'exists',
                value: true,
              },
              then: { action: 'deny', reason: 'Denied by policy 1' },
            },
          ],
          defaultAction: 'allow',
        },
        { id: 'policy-1', name: 'Policy 1' }
      );

      const policy2 = createPolicy(
        {
          version: '1.0',
          rules: [
            {
              id: 'rule-1',
              name: 'Allow rule',
              priority: 1,
              enabled: true,
              when: {
                type: 'field',
                field: 'intent.goal',
                operator: 'exists',
                value: true,
              },
              then: { action: 'allow' },
            },
          ],
          defaultAction: 'allow',
        },
        { id: 'policy-2', name: 'Policy 2' }
      );

      const context = createContext();
      const result = await evaluator.evaluateMultiple([policy1, policy2], context);

      expect(result.finalAction).toBe('deny');
      expect(result.passed).toBe(false);
      expect(result.policiesEvaluated).toHaveLength(1); // Short-circuited
    });

    it('should filter policies by target', async () => {
      const policy1 = createPolicy(
        {
          version: '1.0',
          target: {
            intentTypes: ['action.execute'],
          },
          rules: [
            {
              id: 'rule-1',
              name: 'Rule for action.execute',
              priority: 1,
              enabled: true,
              when: {
                type: 'field',
                field: 'intent.goal',
                operator: 'exists',
                value: true,
              },
              then: { action: 'escalate' },
            },
          ],
          defaultAction: 'allow',
        },
        { id: 'policy-1', name: 'Execute Policy' }
      );

      const policy2 = createPolicy(
        {
          version: '1.0',
          target: {
            intentTypes: ['action.query'], // Won't match
          },
          rules: [
            {
              id: 'rule-1',
              name: 'Rule for action.query',
              priority: 1,
              enabled: true,
              when: {
                type: 'field',
                field: 'intent.goal',
                operator: 'exists',
                value: true,
              },
              then: { action: 'deny' },
            },
          ],
          defaultAction: 'allow',
        },
        { id: 'policy-2', name: 'Query Policy' }
      );

      const context = createContext();
      const result = await evaluator.evaluateMultiple([policy1, policy2], context);

      // Only policy1 should be evaluated
      expect(result.policiesEvaluated).toHaveLength(1);
      expect(result.finalAction).toBe('escalate');
    });

    it('should filter by entity type target', async () => {
      const policy = createPolicy({
        version: '1.0',
        target: {
          entityTypes: ['user'], // Won't match 'agent'
        },
        rules: [
          {
            id: 'rule-1',
            name: 'Users only',
            priority: 1,
            enabled: true,
            when: {
              type: 'field',
              field: 'intent.goal',
              operator: 'exists',
              value: true,
            },
            then: { action: 'deny' },
          },
        ],
        defaultAction: 'allow',
      });

      const context = createContext();
      const result = await evaluator.evaluateMultiple([policy], context);

      expect(result.policiesEvaluated).toHaveLength(0);
      expect(result.finalAction).toBe('allow');
    });

    it('should filter by trust level target', async () => {
      const policy = createPolicy({
        version: '1.0',
        target: {
          trustLevels: [4], // Won't match level 3
        },
        rules: [
          {
            id: 'rule-1',
            name: 'High trust only',
            priority: 1,
            enabled: true,
            when: {
              type: 'field',
              field: 'intent.goal',
              operator: 'exists',
              value: true,
            },
            then: { action: 'allow' },
          },
        ],
        defaultAction: 'deny',
      });

      const context = createContext();
      const result = await evaluator.evaluateMultiple([policy], context);

      expect(result.policiesEvaluated).toHaveLength(0);
      expect(result.finalAction).toBe('allow');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty policies array', async () => {
      const context = createContext();
      const result = await evaluator.evaluateMultiple([], context);

      expect(result.finalAction).toBe('allow');
      expect(result.passed).toBe(true);
      expect(result.policiesEvaluated).toHaveLength(0);
    });

    it('should handle policy with no rules', async () => {
      const policy = createPolicy({
        version: '1.0',
        rules: [],
        defaultAction: 'deny',
      });

      const context = createContext();
      const result = await evaluator.evaluatePolicy(policy, context);

      expect(result.action).toBe('deny');
      expect(result.rulesEvaluated).toHaveLength(0);
    });

    it('should handle deeply nested field paths', async () => {
      const policy = createPolicy({
        version: '1.0',
        rules: [
          {
            id: 'rule-1',
            name: 'Check nested field',
            priority: 1,
            enabled: true,
            when: {
              type: 'field',
              field: 'entity.attributes.role',
              operator: 'equals',
              value: 'admin',
            },
            then: { action: 'allow' },
          },
        ],
        defaultAction: 'deny',
      });

      const context = createContext();
      const result = await evaluator.evaluatePolicy(policy, context);

      expect(result.action).toBe('allow');
    });

    it('should handle undefined nested field gracefully', async () => {
      const policy = createPolicy({
        version: '1.0',
        rules: [
          {
            id: 'rule-1',
            name: 'Check undefined field',
            priority: 1,
            enabled: true,
            when: {
              type: 'field',
              field: 'intent.context.deeply.nested.field',
              operator: 'equals',
              value: 'something',
            },
            then: { action: 'deny' },
          },
        ],
        defaultAction: 'allow',
      });

      const context = createContext();
      const result = await evaluator.evaluatePolicy(policy, context);

      expect(result.action).toBe('allow'); // Condition not met
    });
  });
});
