import { describe, it, expect } from 'vitest';
import { parsePolicy, toJson, toYaml } from '../src/parser.js';

const validPolicyYaml = `
basis_version: "1.0"
policy_id: "test-policy"
metadata:
  name: "Test Policy"
  version: "1.0.0"
  created_at: "2026-01-01T00:00:00Z"
constraints:
  - type: tool_restriction
    action: block
    values:
      - shell_execute
`;

const validPolicyJson = JSON.stringify({
  basis_version: '1.0',
  policy_id: 'test-policy',
  metadata: {
    name: 'Test Policy',
    version: '1.0.0',
    created_at: '2026-01-01T00:00:00Z',
  },
});

describe('parsePolicy', () => {
  it('should parse valid YAML', () => {
    const result = parsePolicy(validPolicyYaml);
    expect(result.success).toBe(true);
    expect(result.format).toBe('yaml');
    expect(result.policy?.policy_id).toBe('test-policy');
  });

  it('should parse valid JSON', () => {
    const result = parsePolicy(validPolicyJson);
    expect(result.success).toBe(true);
    expect(result.format).toBe('json');
    expect(result.policy?.policy_id).toBe('test-policy');
  });

  it('should auto-detect YAML format', () => {
    const result = parsePolicy(validPolicyYaml);
    expect(result.format).toBe('yaml');
  });

  it('should auto-detect JSON format', () => {
    const result = parsePolicy(validPolicyJson);
    expect(result.format).toBe('json');
  });

  it('should accept explicit format hint', () => {
    const result = parsePolicy(validPolicyJson, 'json');
    expect(result.success).toBe(true);
  });

  it('should reject invalid YAML syntax', () => {
    const invalidYaml = `
basis_version: "1.0"
  invalid indentation
`;
    const result = parsePolicy(invalidYaml, 'yaml');
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('YAML parse error');
  });

  it('should reject invalid JSON syntax', () => {
    const result = parsePolicy('{ invalid }', 'json');
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('JSON parse error');
  });

  it('should reject policy that fails schema validation', () => {
    const invalidPolicy = `
basis_version: "1.0"
policy_id: "INVALID_ID"
metadata:
  name: "Test"
  version: "1.0.0"
  created_at: "2026-01-01T00:00:00Z"
`;
    const result = parsePolicy(invalidPolicy);
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe('toJson', () => {
  it('should serialize policy to JSON', () => {
    const policy = {
      basis_version: '1.0' as const,
      policy_id: 'test-policy',
      metadata: {
        name: 'Test',
        version: '1.0.0',
        created_at: '2026-01-01T00:00:00Z',
      },
    };

    const json = toJson(policy);
    expect(JSON.parse(json)).toEqual(policy);
  });

  it('should support compact JSON output', () => {
    const policy = {
      basis_version: '1.0' as const,
      policy_id: 'test-policy',
      metadata: {
        name: 'Test',
        version: '1.0.0',
        created_at: '2026-01-01T00:00:00Z',
      },
    };

    const compact = toJson(policy, false);
    expect(compact).not.toContain('\n');
  });
});

describe('toYaml', () => {
  it('should serialize policy to YAML', () => {
    const policy = {
      basis_version: '1.0' as const,
      policy_id: 'test-policy',
      metadata: {
        name: 'Test',
        version: '1.0.0',
        created_at: '2026-01-01T00:00:00Z',
      },
    };

    const yaml = toYaml(policy);
    expect(yaml).toContain('basis_version:');
    expect(yaml).toContain('policy_id: test-policy');
  });
});
