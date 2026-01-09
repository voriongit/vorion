/**
 * BASIS Rule Evaluator Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RuleEvaluator, createEvaluator } from '../../../src/basis/evaluator.js';
import { parseNamespace } from '../../../src/basis/parser.js';
import type { EvaluationContext } from '../../../src/basis/types.js';

describe('RuleEvaluator', () => {
  let evaluator: RuleEvaluator;

  beforeEach(() => {
    evaluator = createEvaluator();
  });

  describe('registerNamespace', () => {
    it('should register a namespace successfully', () => {
      const namespace = parseNamespace({
        namespace: 'test',
        rules: [],
      });

      expect(() => evaluator.registerNamespace(namespace)).not.toThrow();
    });
  });

  describe('evaluate', () => {
    it('should return allow when no rules match', async () => {
      const context: EvaluationContext = {
        intent: {
          id: 'int_123',
          type: 'test_action',
          goal: 'Test goal',
          context: {},
        },
        entity: {
          id: 'ent_456',
          type: 'agent',
          trustScore: 500,
          trustLevel: 2,
          attributes: {},
        },
        environment: {
          timestamp: new Date().toISOString(),
          timezone: 'UTC',
          requestId: 'req_789',
        },
        custom: {},
      };

      const result = await evaluator.evaluate(context);

      expect(result.passed).toBe(true);
      expect(result.finalAction).toBe('allow');
      expect(result.rulesEvaluated).toHaveLength(0);
    });

    it('should evaluate matching rules', async () => {
      const namespace = parseNamespace({
        namespace: 'test',
        rules: [
          {
            id: 'rule_001',
            name: 'Test Rule',
            when: {
              intentType: 'test_action',
            },
            evaluate: [
              {
                condition: 'true',
                result: 'allow',
                reason: 'Always allow test actions',
              },
            ],
          },
        ],
      });

      evaluator.registerNamespace(namespace);

      const context: EvaluationContext = {
        intent: {
          id: 'int_123',
          type: 'test_action',
          goal: 'Test goal',
          context: {},
        },
        entity: {
          id: 'ent_456',
          type: 'agent',
          trustScore: 500,
          trustLevel: 2,
          attributes: {},
        },
        environment: {
          timestamp: new Date().toISOString(),
          timezone: 'UTC',
          requestId: 'req_789',
        },
        custom: {},
      };

      const result = await evaluator.evaluate(context);

      expect(result.passed).toBe(true);
      expect(result.finalAction).toBe('allow');
      expect(result.rulesEvaluated).toHaveLength(1);
      expect(result.rulesEvaluated[0]?.ruleName).toBe('Test Rule');
    });

    it('should return deny when a rule denies', async () => {
      const namespace = parseNamespace({
        namespace: 'test',
        rules: [
          {
            id: 'rule_001',
            name: 'Deny Rule',
            when: {
              intentType: 'blocked_action',
            },
            evaluate: [
              {
                condition: 'true',
                result: 'deny',
                reason: 'This action is not allowed',
              },
            ],
          },
        ],
      });

      evaluator.registerNamespace(namespace);

      const context: EvaluationContext = {
        intent: {
          id: 'int_123',
          type: 'blocked_action',
          goal: 'Blocked goal',
          context: {},
        },
        entity: {
          id: 'ent_456',
          type: 'agent',
          trustScore: 500,
          trustLevel: 2,
          attributes: {},
        },
        environment: {
          timestamp: new Date().toISOString(),
          timezone: 'UTC',
          requestId: 'req_789',
        },
        custom: {},
      };

      const result = await evaluator.evaluate(context);

      expect(result.passed).toBe(false);
      expect(result.finalAction).toBe('deny');
      expect(result.violatedRules).toHaveLength(1);
    });

    it('should respect rule priority order', async () => {
      const namespace = parseNamespace({
        namespace: 'test',
        rules: [
          {
            id: 'rule_low_priority',
            name: 'Low Priority',
            priority: 100,
            when: { intentType: '*' },
            evaluate: [{ condition: 'true', result: 'allow' }],
          },
          {
            id: 'rule_high_priority',
            name: 'High Priority',
            priority: 10,
            when: { intentType: '*' },
            evaluate: [{ condition: 'true', result: 'deny' }],
          },
        ],
      });

      evaluator.registerNamespace(namespace);

      const context: EvaluationContext = {
        intent: {
          id: 'int_123',
          type: 'any_action',
          goal: 'Test',
          context: {},
        },
        entity: {
          id: 'ent_456',
          type: 'agent',
          trustScore: 500,
          trustLevel: 2,
          attributes: {},
        },
        environment: {
          timestamp: new Date().toISOString(),
          timezone: 'UTC',
          requestId: 'req_789',
        },
        custom: {},
      };

      const result = await evaluator.evaluate(context);

      // High priority deny should be evaluated first
      expect(result.finalAction).toBe('deny');
      expect(result.rulesEvaluated[0]?.ruleName).toBe('High Priority');
    });
  });
});
