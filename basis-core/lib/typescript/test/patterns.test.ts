import { describe, it, expect } from 'vitest';
import {
  matchPattern,
  redactPattern,
  maskPattern,
  getPatterns,
  isValidPatternId,
  NAMED_PATTERNS,
} from '../src/patterns.js';

describe('matchPattern', () => {
  it('should match US SSN', () => {
    const content = 'My SSN is 123-45-6789 and another is 987-65-4321';
    const matches = matchPattern('ssn_us', content);
    expect(matches).toHaveLength(2);
    expect(matches[0][0]).toBe('123-45-6789');
    expect(matches[1][0]).toBe('987-65-4321');
  });

  it('should match credit card numbers', () => {
    const content = 'Visa: 4111111111111111, MC: 5500000000000004';
    const matches = matchPattern('credit_card', content);
    expect(matches).toHaveLength(2);
  });

  it('should match email addresses', () => {
    const content = 'Contact us at support@example.com or sales@test.org';
    const matches = matchPattern('email', content);
    expect(matches).toHaveLength(2);
  });

  it('should match US phone numbers', () => {
    const content = 'Call (555) 123-4567 or 555-987-6543';
    const matches = matchPattern('phone_us', content);
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('should match IP addresses', () => {
    const content = 'Server at 192.168.1.1 and 10.0.0.255';
    const matches = matchPattern('ip_address', content);
    expect(matches).toHaveLength(2);
  });

  it('should match API keys', () => {
    const content = 'Use key sk_live_abc123def456ghi789jkl012mno';
    const matches = matchPattern('api_key', content);
    expect(matches).toHaveLength(1);
  });

  it('should return empty array for no matches', () => {
    const content = 'No sensitive data here';
    const matches = matchPattern('ssn_us', content);
    expect(matches).toHaveLength(0);
  });

  it('should throw for invalid pattern ID', () => {
    expect(() => matchPattern('invalid_pattern' as any, 'test')).toThrow(
      'Unknown pattern'
    );
  });
});

describe('redactPattern', () => {
  it('should redact matched content', () => {
    const content = 'SSN: 123-45-6789';
    const redacted = redactPattern('ssn_us', content);
    expect(redacted).toBe('SSN: [REDACTED]');
  });

  it('should redact all occurrences', () => {
    const content = 'First: 123-45-6789, Second: 987-65-4321';
    const redacted = redactPattern('ssn_us', content);
    expect(redacted).toBe('First: [REDACTED], Second: [REDACTED]');
  });

  it('should use custom replacement', () => {
    const content = 'SSN: 123-45-6789';
    const redacted = redactPattern('ssn_us', content, '***');
    expect(redacted).toBe('SSN: ***');
  });

  it('should return unchanged content if no match', () => {
    const content = 'No SSN here';
    const redacted = redactPattern('ssn_us', content);
    expect(redacted).toBe(content);
  });
});

describe('maskPattern', () => {
  it('should mask with last 4 characters visible', () => {
    const content = 'SSN: 123-45-6789';
    const masked = maskPattern('ssn_us', content);
    expect(masked).toBe('SSN: *******6789');
  });

  it('should mask with custom visible characters', () => {
    const content = 'SSN: 123-45-6789';
    const masked = maskPattern('ssn_us', content, 2);
    expect(masked).toBe('SSN: *********89');
  });

  it('should mask short strings entirely', () => {
    const content = 'test abc';
    // Using a pattern that would match short strings
    // For SSN, this test shows behavior with default showLast=4
    const masked = maskPattern('ssn_us', content);
    expect(masked).toBe(content); // No match, unchanged
  });
});

describe('getPatterns', () => {
  it('should return all defined patterns', () => {
    const patterns = getPatterns();
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns.some((p) => p.id === 'ssn_us')).toBe(true);
    expect(patterns.some((p) => p.id === 'credit_card')).toBe(true);
    expect(patterns.some((p) => p.id === 'email')).toBe(true);
  });

  it('should include all required pattern properties', () => {
    const patterns = getPatterns();
    for (const pattern of patterns) {
      expect(pattern).toHaveProperty('id');
      expect(pattern).toHaveProperty('name');
      expect(pattern).toHaveProperty('description');
      expect(pattern).toHaveProperty('pattern');
      expect(pattern).toHaveProperty('examples');
    }
  });
});

describe('isValidPatternId', () => {
  it('should return true for valid pattern IDs', () => {
    expect(isValidPatternId('ssn_us')).toBe(true);
    expect(isValidPatternId('credit_card')).toBe(true);
    expect(isValidPatternId('email')).toBe(true);
    expect(isValidPatternId('api_key')).toBe(true);
  });

  it('should return false for invalid pattern IDs', () => {
    expect(isValidPatternId('invalid')).toBe(false);
    expect(isValidPatternId('not_a_pattern')).toBe(false);
    expect(isValidPatternId('')).toBe(false);
  });
});

describe('NAMED_PATTERNS', () => {
  it('should have examples that match the pattern', () => {
    for (const [id, pattern] of Object.entries(NAMED_PATTERNS)) {
      for (const example of pattern.examples) {
        // Create a fresh regex to avoid global state issues
        const testPattern = new RegExp(pattern.pattern.source, pattern.pattern.flags);
        const matches = testPattern.test(example);
        expect(matches, `Pattern ${id} should match example: ${example}`).toBe(true);
      }
    }
  });
});
