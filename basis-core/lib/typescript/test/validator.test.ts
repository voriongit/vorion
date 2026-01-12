import { describe, it, expect } from 'vitest';
import { validatePolicy, isValidPolicyId, isValidVersion, isSupportedBasisVersion } from '../src/validator.js';

describe('validatePolicy', () => {
  it('should validate a minimal valid policy', () => {
    const policy = {
      basis_version: '1.0',
      policy_id: 'test-policy',
      metadata: {
        name: 'Test Policy',
        version: '1.0.0',
        created_at: '2026-01-01T00:00:00Z',
      },
    };

    const result = validatePolicy(policy);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.policy).toEqual(policy);
  });

  it('should validate a policy with constraints', () => {
    const policy = {
      basis_version: '1.0',
      policy_id: 'constrained-policy',
      metadata: {
        name: 'Constrained Policy',
        version: '1.0.0',
        created_at: '2026-01-01T00:00:00Z',
      },
      constraints: [
        {
          type: 'tool_restriction',
          action: 'block',
          values: ['shell_execute', 'file_write'],
          message: 'Dangerous tools prohibited',
        },
        {
          type: 'data_protection',
          action: 'redact',
          named_pattern: 'ssn_us',
        },
      ],
    };

    const result = validatePolicy(policy);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should validate a policy with obligations', () => {
    const policy = {
      basis_version: '1.0',
      policy_id: 'obligation-policy',
      metadata: {
        name: 'Obligation Policy',
        version: '1.0.0',
        created_at: '2026-01-01T00:00:00Z',
      },
      obligations: [
        {
          trigger: 'transaction_value > 1000',
          action: 'require_human_approval',
          parameters: {
            approvers: ['manager'],
            timeout: '4h',
          },
        },
      ],
    };

    const result = validatePolicy(policy);
    expect(result.valid).toBe(true);
  });

  it('should reject policy with missing required fields', () => {
    const policy = {
      basis_version: '1.0',
      // missing policy_id and metadata
    };

    const result = validatePolicy(policy);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should reject policy with invalid policy_id format', () => {
    const policy = {
      basis_version: '1.0',
      policy_id: 'Invalid_Policy_ID', // uppercase and underscore not allowed
      metadata: {
        name: 'Test',
        version: '1.0.0',
        created_at: '2026-01-01T00:00:00Z',
      },
    };

    const result = validatePolicy(policy);
    expect(result.valid).toBe(false);
  });

  it('should reject policy with invalid constraint type', () => {
    const policy = {
      basis_version: '1.0',
      policy_id: 'bad-constraint',
      metadata: {
        name: 'Test',
        version: '1.0.0',
        created_at: '2026-01-01T00:00:00Z',
      },
      constraints: [
        {
          type: 'invalid_type',
          action: 'block',
        },
      ],
    };

    const result = validatePolicy(policy);
    expect(result.valid).toBe(false);
  });

  it('should parse and validate JSON string', () => {
    const policyJson = JSON.stringify({
      basis_version: '1.0',
      policy_id: 'json-policy',
      metadata: {
        name: 'JSON Policy',
        version: '1.0.0',
        created_at: '2026-01-01T00:00:00Z',
      },
    });

    const result = validatePolicy(policyJson);
    expect(result.valid).toBe(true);
  });

  it('should reject invalid JSON string', () => {
    const result = validatePolicy('{ invalid json }');
    expect(result.valid).toBe(false);
    expect(result.errors[0].keyword).toBe('parse');
  });
});

describe('isValidPolicyId', () => {
  it('should accept valid policy IDs', () => {
    expect(isValidPolicyId('my-policy')).toBe(true);
    expect(isValidPolicyId('policy123')).toBe(true);
    expect(isValidPolicyId('corp-finance-limited')).toBe(true);
    expect(isValidPolicyId('abc')).toBe(true);
  });

  it('should reject invalid policy IDs', () => {
    expect(isValidPolicyId('My-Policy')).toBe(false); // uppercase
    expect(isValidPolicyId('ab')).toBe(false); // too short
    expect(isValidPolicyId('-invalid')).toBe(false); // starts with hyphen
    expect(isValidPolicyId('invalid-')).toBe(false); // ends with hyphen
    expect(isValidPolicyId('has spaces')).toBe(false);
    expect(isValidPolicyId('has_underscore')).toBe(false);
  });
});

describe('isValidVersion', () => {
  it('should accept valid semantic versions', () => {
    expect(isValidVersion('1.0.0')).toBe(true);
    expect(isValidVersion('2.1.3')).toBe(true);
    expect(isValidVersion('0.0.1')).toBe(true);
    expect(isValidVersion('1.0.0-beta')).toBe(true);
    expect(isValidVersion('1.0.0-alpha1')).toBe(true);
  });

  it('should reject invalid versions', () => {
    expect(isValidVersion('1.0')).toBe(false);
    expect(isValidVersion('v1.0.0')).toBe(false);
    expect(isValidVersion('1.0.0.0')).toBe(false);
  });
});

describe('isSupportedBasisVersion', () => {
  it('should accept supported versions', () => {
    expect(isSupportedBasisVersion('1.0')).toBe(true);
    expect(isSupportedBasisVersion('1.1')).toBe(true);
  });

  it('should reject unsupported versions', () => {
    expect(isSupportedBasisVersion('0.9')).toBe(false);
    expect(isSupportedBasisVersion('2.0')).toBe(false);
  });
});
