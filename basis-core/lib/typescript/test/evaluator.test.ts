import { describe, it, expect } from 'vitest';
import { evaluateConstraints, type IntentContext } from '../src/evaluator.js';
import type { Constraint } from '../src/types.js';

describe('evaluateConstraints', () => {
  describe('tool_restriction', () => {
    it('should block restricted tools', () => {
      const constraints: Constraint[] = [
        {
          type: 'tool_restriction',
          action: 'block',
          values: ['shell_execute', 'file_delete'],
        },
      ];

      const context: IntentContext = {
        goal: 'Execute shell command',
        tools: ['shell_execute'],
      };

      const result = evaluateConstraints(constraints, context);
      expect(result.blocked).toBe(true);
      expect(result.passed).toBe(false);
      expect(result.evaluations[0].passed).toBe(false);
    });

    it('should allow non-restricted tools', () => {
      const constraints: Constraint[] = [
        {
          type: 'tool_restriction',
          action: 'block',
          values: ['shell_execute'],
        },
      ];

      const context: IntentContext = {
        goal: 'Read a file',
        tools: ['file_read'],
      };

      const result = evaluateConstraints(constraints, context);
      expect(result.blocked).toBe(false);
      expect(result.passed).toBe(true);
    });
  });

  describe('egress_whitelist', () => {
    it('should block endpoints not in whitelist', () => {
      const constraints: Constraint[] = [
        {
          type: 'egress_whitelist',
          action: 'block',
          values: ['api.allowed.com', '*.internal.com'],
        },
      ];

      const context: IntentContext = {
        goal: 'Call external API',
        endpoints: ['api.blocked.com'],
      };

      const result = evaluateConstraints(constraints, context);
      expect(result.blocked).toBe(true);
    });

    it('should allow endpoints in whitelist', () => {
      const constraints: Constraint[] = [
        {
          type: 'egress_whitelist',
          action: 'block',
          values: ['api.allowed.com', '*.internal.com'],
        },
      ];

      const context: IntentContext = {
        goal: 'Call internal API',
        endpoints: ['api.internal.com'],
      };

      const result = evaluateConstraints(constraints, context);
      expect(result.blocked).toBe(false);
    });

    it('should support wildcard patterns', () => {
      const constraints: Constraint[] = [
        {
          type: 'egress_whitelist',
          action: 'block',
          values: ['*.stripe.com'],
        },
      ];

      const context: IntentContext = {
        goal: 'Process payment',
        endpoints: ['api.stripe.com'],
      };

      const result = evaluateConstraints(constraints, context);
      expect(result.blocked).toBe(false);
    });
  });

  describe('egress_blacklist', () => {
    it('should block blacklisted endpoints', () => {
      const constraints: Constraint[] = [
        {
          type: 'egress_blacklist',
          action: 'block',
          values: ['*.openai.com', '*.anthropic.com'],
        },
      ];

      const context: IntentContext = {
        goal: 'Call AI API',
        endpoints: ['api.openai.com'],
      };

      const result = evaluateConstraints(constraints, context);
      expect(result.blocked).toBe(true);
    });
  });

  describe('data_protection', () => {
    it('should detect SSN patterns', () => {
      const constraints: Constraint[] = [
        {
          type: 'data_protection',
          action: 'redact',
          named_pattern: 'ssn_us',
        },
      ];

      const context: IntentContext = {
        goal: 'Process user data',
        content: 'User SSN is 123-45-6789',
      };

      const result = evaluateConstraints(constraints, context);
      expect(result.modified).toBe(true);
      expect(result.modifications.length).toBeGreaterThan(0);
    });

    it('should detect credit card patterns', () => {
      const constraints: Constraint[] = [
        {
          type: 'data_protection',
          action: 'mask',
          named_pattern: 'credit_card',
        },
      ];

      const context: IntentContext = {
        goal: 'Process payment',
        content: 'Card number: 4111111111111111',
      };

      const result = evaluateConstraints(constraints, context);
      expect(result.modified).toBe(true);
    });

    it('should block when action is block', () => {
      const constraints: Constraint[] = [
        {
          type: 'data_protection',
          action: 'block',
          named_pattern: 'ssn_us',
        },
      ];

      const context: IntentContext = {
        goal: 'Process user data',
        content: 'User SSN is 123-45-6789',
      };

      const result = evaluateConstraints(constraints, context);
      expect(result.blocked).toBe(true);
    });

    it('should pass when no sensitive data found', () => {
      const constraints: Constraint[] = [
        {
          type: 'data_protection',
          action: 'redact',
          named_pattern: 'ssn_us',
        },
      ];

      const context: IntentContext = {
        goal: 'Process data',
        content: 'No sensitive data here',
      };

      const result = evaluateConstraints(constraints, context);
      expect(result.passed).toBe(true);
      expect(result.blocked).toBe(false);
      expect(result.modified).toBe(false);
    });

    it('should support custom patterns', () => {
      const constraints: Constraint[] = [
        {
          type: 'data_protection',
          action: 'block',
          pattern: 'SECRET_[A-Z0-9]+',
        },
      ];

      const context: IntentContext = {
        goal: 'Process data',
        content: 'The key is SECRET_ABC123',
      };

      const result = evaluateConstraints(constraints, context);
      expect(result.blocked).toBe(true);
    });
  });

  describe('severity ordering', () => {
    it('should evaluate critical constraints first', () => {
      const constraints: Constraint[] = [
        {
          id: 'low-priority',
          type: 'tool_restriction',
          action: 'warn',
          severity: 'low',
          values: ['tool1'],
        },
        {
          id: 'critical-priority',
          type: 'tool_restriction',
          action: 'block',
          severity: 'critical',
          values: ['tool2'],
        },
      ];

      const context: IntentContext = {
        goal: 'Test',
        tools: ['tool1', 'tool2'],
      };

      const result = evaluateConstraints(constraints, context);
      expect(result.evaluations[0].constraint_id).toBe('critical-priority');
    });
  });

  describe('disabled constraints', () => {
    it('should skip disabled constraints', () => {
      const constraints: Constraint[] = [
        {
          type: 'tool_restriction',
          action: 'block',
          values: ['shell_execute'],
          enabled: false,
        },
      ];

      const context: IntentContext = {
        goal: 'Execute',
        tools: ['shell_execute'],
      };

      const result = evaluateConstraints(constraints, context);
      expect(result.blocked).toBe(false);
      expect(result.evaluations).toHaveLength(0);
    });
  });

  describe('scope filtering', () => {
    it('should only apply constraints to matching trust levels', () => {
      const constraints: Constraint[] = [
        {
          type: 'tool_restriction',
          action: 'block',
          values: ['admin_tool'],
          scope: {
            trust_levels: [0, 1], // Only apply to L0 and L1
          },
        },
      ];

      // L2 user should not be affected
      const context: IntentContext = {
        goal: 'Use admin tool',
        tools: ['admin_tool'],
        trust_level: 2,
      };

      const result = evaluateConstraints(constraints, context);
      expect(result.blocked).toBe(false);
    });
  });
});
