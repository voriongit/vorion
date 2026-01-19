/**
 * Policy Service Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validatePolicyDefinition } from '../../../src/policy/service.js';
import type { PolicyDefinition } from '../../../src/policy/types.js';

// Mock the database
vi.mock('../../../src/common/db.js', () => ({
  getDatabase: vi.fn(() => ({
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{
          id: 'policy-123',
          tenantId: 'tenant-456',
          name: 'Test Policy',
          namespace: 'default',
          description: 'Test description',
          version: 1,
          status: 'draft',
          definition: {},
          checksum: 'abc123',
          createdBy: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          publishedAt: null,
        }]),
      })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([]),
          orderBy: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([]),
            offset: vi.fn().mockResolvedValue([]),
          })),
        })),
      })),
    })),
    transaction: vi.fn((fn) => fn({
      insert: vi.fn(() => ({
        values: vi.fn().mockResolvedValue([]),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([]),
          })),
        })),
      })),
    })),
  })),
}));

describe('Policy Validation', () => {
  describe('validatePolicyDefinition', () => {
    it('should accept valid policy definition', () => {
      const definition: PolicyDefinition = {
        version: '1.0',
        rules: [
          {
            id: 'rule-1',
            name: 'Test Rule',
            priority: 1,
            enabled: true,
            when: {
              type: 'field',
              field: 'intent.goal',
              operator: 'equals',
              value: 'test',
            },
            then: {
              action: 'allow',
            },
          },
        ],
        defaultAction: 'deny',
      };

      const result = validatePolicyDefinition(definition);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject non-object definition', () => {
      const result = validatePolicyDefinition('invalid');
      expect(result.valid).toBe(false);
      expect(result.errors[0]?.code).toBe('INVALID_TYPE');
    });

    it('should reject invalid version', () => {
      const definition = {
        version: '2.0',
        rules: [],
        defaultAction: 'deny',
      };

      const result = validatePolicyDefinition(definition);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'INVALID_VERSION')).toBe(true);
    });

    it('should reject missing rules array', () => {
      const definition = {
        version: '1.0',
        defaultAction: 'deny',
      };

      const result = validatePolicyDefinition(definition);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'MISSING_RULES')).toBe(true);
    });

    it('should reject invalid defaultAction', () => {
      const definition = {
        version: '1.0',
        rules: [],
        defaultAction: 'invalid_action',
      };

      const result = validatePolicyDefinition(definition);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'INVALID_DEFAULT_ACTION')).toBe(true);
    });

    it('should validate all valid actions', () => {
      const validActions = ['allow', 'deny', 'escalate', 'limit', 'monitor', 'terminate'];

      for (const action of validActions) {
        const definition = {
          version: '1.0',
          rules: [],
          defaultAction: action,
        };

        const result = validatePolicyDefinition(definition);
        expect(result.valid).toBe(true);
      }
    });

    describe('Rule Validation', () => {
      const createDefinition = (rule: Record<string, unknown>): unknown => ({
        version: '1.0',
        rules: [rule],
        defaultAction: 'deny',
      });

      it('should reject rule without id', () => {
        const definition = createDefinition({
          name: 'Test Rule',
          priority: 1,
          when: { type: 'field', field: 'x', operator: 'equals', value: 'y' },
          then: { action: 'allow' },
        });

        const result = validatePolicyDefinition(definition);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.code === 'MISSING_RULE_ID')).toBe(true);
      });

      it('should reject rule without name', () => {
        const definition = createDefinition({
          id: 'rule-1',
          priority: 1,
          when: { type: 'field', field: 'x', operator: 'equals', value: 'y' },
          then: { action: 'allow' },
        });

        const result = validatePolicyDefinition(definition);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.code === 'MISSING_RULE_NAME')).toBe(true);
      });

      it('should reject rule without priority', () => {
        const definition = createDefinition({
          id: 'rule-1',
          name: 'Test',
          when: { type: 'field', field: 'x', operator: 'equals', value: 'y' },
          then: { action: 'allow' },
        });

        const result = validatePolicyDefinition(definition);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.code === 'MISSING_PRIORITY')).toBe(true);
      });

      it('should reject rule without when condition', () => {
        const definition = createDefinition({
          id: 'rule-1',
          name: 'Test',
          priority: 1,
          then: { action: 'allow' },
        });

        const result = validatePolicyDefinition(definition);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.code === 'MISSING_WHEN')).toBe(true);
      });

      it('should reject rule without then action', () => {
        const definition = createDefinition({
          id: 'rule-1',
          name: 'Test',
          priority: 1,
          when: { type: 'field', field: 'x', operator: 'equals', value: 'y' },
        });

        const result = validatePolicyDefinition(definition);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.code === 'MISSING_THEN')).toBe(true);
      });

      it('should reject rule with invalid action', () => {
        const definition = createDefinition({
          id: 'rule-1',
          name: 'Test',
          priority: 1,
          when: { type: 'field', field: 'x', operator: 'equals', value: 'y' },
          then: { action: 'invalid' },
        });

        const result = validatePolicyDefinition(definition);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.code === 'INVALID_ACTION')).toBe(true);
      });
    });

    describe('Condition Validation', () => {
      const createWithCondition = (condition: Record<string, unknown>): unknown => ({
        version: '1.0',
        rules: [
          {
            id: 'rule-1',
            name: 'Test',
            priority: 1,
            when: condition,
            then: { action: 'allow' },
          },
        ],
        defaultAction: 'deny',
      });

      it('should validate field condition', () => {
        const definition = createWithCondition({
          type: 'field',
          field: 'intent.goal',
          operator: 'equals',
          value: 'test',
        });

        const result = validatePolicyDefinition(definition);
        expect(result.valid).toBe(true);
      });

      it('should reject field condition without field path', () => {
        const definition = createWithCondition({
          type: 'field',
          operator: 'equals',
          value: 'test',
        });

        const result = validatePolicyDefinition(definition);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.code === 'MISSING_FIELD_PATH')).toBe(true);
      });

      it('should reject field condition without operator', () => {
        const definition = createWithCondition({
          type: 'field',
          field: 'intent.goal',
          value: 'test',
        });

        const result = validatePolicyDefinition(definition);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.code === 'MISSING_OPERATOR')).toBe(true);
      });

      it('should validate compound condition', () => {
        const definition = createWithCondition({
          type: 'compound',
          operator: 'and',
          conditions: [
            { type: 'field', field: 'x', operator: 'equals', value: 'y' },
            { type: 'field', field: 'a', operator: 'equals', value: 'b' },
          ],
        });

        const result = validatePolicyDefinition(definition);
        expect(result.valid).toBe(true);
      });

      it('should reject compound with invalid operator', () => {
        const definition = createWithCondition({
          type: 'compound',
          operator: 'xor',
          conditions: [],
        });

        const result = validatePolicyDefinition(definition);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.code === 'INVALID_LOGICAL_OPERATOR')).toBe(true);
      });

      it('should reject compound without conditions array', () => {
        const definition = createWithCondition({
          type: 'compound',
          operator: 'and',
        });

        const result = validatePolicyDefinition(definition);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.code === 'MISSING_CONDITIONS')).toBe(true);
      });

      it('should validate trust condition', () => {
        const definition = createWithCondition({
          type: 'trust',
          level: 3,
          operator: 'greater_than_or_equal',
        });

        const result = validatePolicyDefinition(definition);
        expect(result.valid).toBe(true);
      });

      it('should reject trust with invalid level', () => {
        const definition = createWithCondition({
          type: 'trust',
          level: 10,
          operator: 'equals',
        });

        const result = validatePolicyDefinition(definition);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.code === 'INVALID_TRUST_LEVEL')).toBe(true);
      });

      it('should validate time condition', () => {
        const definition = createWithCondition({
          type: 'time',
          field: 'hour',
          operator: 'greater_than',
          value: 9,
        });

        const result = validatePolicyDefinition(definition);
        expect(result.valid).toBe(true);
      });

      it('should reject time with invalid field', () => {
        const definition = createWithCondition({
          type: 'time',
          field: 'invalid',
          operator: 'equals',
          value: 10,
        });

        const result = validatePolicyDefinition(definition);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.code === 'INVALID_TIME_FIELD')).toBe(true);
      });

      it('should reject unknown condition type', () => {
        const definition = createWithCondition({
          type: 'unknown',
        });

        const result = validatePolicyDefinition(definition);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.code === 'INVALID_CONDITION_TYPE')).toBe(true);
      });

      it('should validate nested compound conditions', () => {
        const definition = createWithCondition({
          type: 'compound',
          operator: 'and',
          conditions: [
            {
              type: 'compound',
              operator: 'or',
              conditions: [
                { type: 'field', field: 'x', operator: 'equals', value: 'y' },
                { type: 'trust', level: 2, operator: 'greater_than' },
              ],
            },
            { type: 'time', field: 'hour', operator: 'in', value: [9, 10, 11] },
          ],
        });

        const result = validatePolicyDefinition(definition);
        expect(result.valid).toBe(true);
      });
    });
  });
});
