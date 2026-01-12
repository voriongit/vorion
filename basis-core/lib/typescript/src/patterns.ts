/**
 * BASIS Named Patterns
 *
 * Pre-defined patterns for common sensitive data types.
 */

import type { NamedPatternId } from './types.js';

/**
 * Named pattern definition
 */
export interface NamedPattern {
  id: NamedPatternId;
  name: string;
  description: string;
  pattern: RegExp;
  examples: string[];
}

/**
 * Named patterns registry
 */
export const NAMED_PATTERNS: Record<NamedPatternId, NamedPattern> = {
  ssn_us: {
    id: 'ssn_us',
    name: 'US Social Security Number',
    description: 'US SSN in XXX-XX-XXXX format',
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    examples: ['123-45-6789'],
  },

  ssn_uk: {
    id: 'ssn_uk',
    name: 'UK National Insurance Number',
    description: 'UK NIN in AB123456C format',
    pattern: /\b[A-Z]{2}\d{6}[A-Z]\b/gi,
    examples: ['AB123456C'],
  },

  credit_card: {
    id: 'credit_card',
    name: 'Credit Card Number',
    description: 'Major credit card numbers (Visa, MC, Amex, Discover)',
    pattern:
      /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
    examples: ['4111111111111111', '5500000000000004'],
  },

  email: {
    id: 'email',
    name: 'Email Address',
    description: 'Standard email address format',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    examples: ['user@example.com'],
  },

  phone_us: {
    id: 'phone_us',
    name: 'US Phone Number',
    description: 'US phone numbers in various formats',
    pattern:
      /\b(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    examples: ['(555) 123-4567', '555-123-4567', '+1-555-123-4567'],
  },

  phone_intl: {
    id: 'phone_intl',
    name: 'International Phone Number',
    description: 'International phone numbers with country code',
    pattern: /(?<![a-zA-Z0-9])\+[1-9]\d{1,14}(?![a-zA-Z0-9])/g,
    examples: ['+442071234567', '+14155551234'],
  },

  ip_address: {
    id: 'ip_address',
    name: 'IP Address',
    description: 'IPv4 and IPv6 addresses',
    pattern:
      /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b|(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}/g,
    examples: ['192.168.1.1', '2001:0db8:85a3:0000:0000:8a2e:0370:7334'],
  },

  api_key: {
    id: 'api_key',
    name: 'API Key',
    description: 'Common API key formats (sk_, pk_, api_, key_)',
    pattern:
      /\b(?:sk|pk|api|key)_(?:live|test|prod)?_?[a-zA-Z0-9]{20,}\b/gi,
    examples: ['sk_live_abc123def456ghi789jkl012'],
  },

  jwt_token: {
    id: 'jwt_token',
    name: 'JWT Token',
    description: 'JSON Web Tokens',
    pattern: /\beyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*\b/g,
    examples: ['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'],
  },

  password: {
    id: 'password',
    name: 'Password Pattern',
    description: 'Common password field patterns',
    pattern:
      /(?:password|passwd|pwd|secret|credential)[\s:=]+["']?[^\s"']{8,}["']?/gi,
    examples: ['password: mySecretPass123'],
  },

  pii_name: {
    id: 'pii_name',
    name: 'Personal Name',
    description: 'Common name patterns (heuristic)',
    pattern:
      /\b(?:Mr\.?|Mrs\.?|Ms\.?|Dr\.?|Prof\.?)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g,
    examples: ['Mr. John Smith', 'Dr. Jane Doe'],
  },

  pii_address: {
    id: 'pii_address',
    name: 'Physical Address',
    description: 'US street address patterns',
    pattern:
      /\b\d+\s+[A-Za-z]+(?:\s+[A-Za-z]+)*\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct)\.?\b/gi,
    examples: ['123 Main Street', '456 Oak Avenue'],
  },

  pii_dob: {
    id: 'pii_dob',
    name: 'Date of Birth',
    description: 'Common date formats that may indicate DOB',
    pattern:
      /\b(?:DOB|Date of Birth|Birth Date|Born)[\s:]+\d{1,4}[\/\-]\d{1,2}[\/\-]\d{1,4}\b/gi,
    examples: ['DOB: 01/15/1990', 'Date of Birth: 1990-01-15'],
  },

  phi_medical: {
    id: 'phi_medical',
    name: 'Medical Record Identifier',
    description: 'Common medical record number patterns',
    pattern:
      /\b(?:MRN|Medical Record|Patient ID|Chart)[\s:#]+[A-Z0-9]{6,}\b/gi,
    examples: ['MRN: ABC123456', 'Patient ID: 12345678'],
  },

  financial_account: {
    id: 'financial_account',
    name: 'Financial Account',
    description: 'Bank account and routing numbers',
    pattern:
      /\b(?:Account|Acct|Routing)[\s:#]+\d{8,17}\b/gi,
    examples: ['Account: 123456789012', 'Routing: 021000021'],
  },
};

/**
 * Match a named pattern against content
 *
 * @param patternId - The named pattern identifier
 * @param content - The content to search
 * @returns Array of matches
 */
export function matchPattern(
  patternId: NamedPatternId,
  content: string
): RegExpMatchArray[] {
  const pattern = NAMED_PATTERNS[patternId];
  if (!pattern) {
    throw new Error(`Unknown pattern: ${patternId}`);
  }

  // Reset lastIndex for global patterns
  pattern.pattern.lastIndex = 0;

  const matches: RegExpMatchArray[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.pattern.exec(content)) !== null) {
    matches.push(match);
  }

  return matches;
}

/**
 * Redact matches of a named pattern
 *
 * @param patternId - The named pattern identifier
 * @param content - The content to redact
 * @param replacement - Replacement string (default: '[REDACTED]')
 * @returns Redacted content
 */
export function redactPattern(
  patternId: NamedPatternId,
  content: string,
  replacement = '[REDACTED]'
): string {
  const pattern = NAMED_PATTERNS[patternId];
  if (!pattern) {
    throw new Error(`Unknown pattern: ${patternId}`);
  }

  pattern.pattern.lastIndex = 0;
  return content.replace(pattern.pattern, replacement);
}

/**
 * Mask matches of a named pattern (show last N characters)
 *
 * @param patternId - The named pattern identifier
 * @param content - The content to mask
 * @param showLast - Number of characters to show at end (default: 4)
 * @returns Masked content
 */
export function maskPattern(
  patternId: NamedPatternId,
  content: string,
  showLast = 4
): string {
  const pattern = NAMED_PATTERNS[patternId];
  if (!pattern) {
    throw new Error(`Unknown pattern: ${patternId}`);
  }

  pattern.pattern.lastIndex = 0;
  return content.replace(pattern.pattern, (match) => {
    if (match.length <= showLast) {
      return '*'.repeat(match.length);
    }
    return '*'.repeat(match.length - showLast) + match.slice(-showLast);
  });
}

/**
 * Get all defined named patterns
 */
export function getPatterns(): NamedPattern[] {
  return Object.values(NAMED_PATTERNS);
}

/**
 * Check if a pattern ID is valid
 */
export function isValidPatternId(id: string): id is NamedPatternId {
  return id in NAMED_PATTERNS;
}
