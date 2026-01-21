#!/usr/bin/env tsx
/**
 * Schema Drift Detection Script
 *
 * Checks for schema inconsistencies across the Vorion Platform codebase.
 * Ensures all type definitions match the canonical definitions in packages/contracts.
 *
 * Canonical Type Location:
 *   packages/contracts/src/canonical/
 *
 * Types defined in the canonical directory are considered authoritative.
 * When a type exists in both canonical AND elsewhere, only the non-canonical
 * location is flagged for migration.
 *
 * Issue Types:
 *   [M] Migration - Type should be imported from canonical location (actionable)
 *   [D] Duplicate - Type defined in multiple non-canonical places
 *   [-] Missing   - Enum/type is missing required values
 *   [~] Mismatch  - Value doesn't match canonical definition
 *   [+] Extra     - Enum/type has unexpected values
 *   [R] Range     - Value outside valid range
 *
 * Exit codes:
 *   0 - No drift detected
 *   1 - Schema drift detected
 *   2 - Script execution error
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Canonical Type Definitions
// ============================================================================

/**
 * Canonical TrustBand values (T0-T5)
 * Accepts both canonical names and legacy v2 names
 */
const CANONICAL_TRUST_BANDS = [
  // Canonical names (from canonical/trust-band.ts)
  'T0_UNTRUSTED',
  'T1_OBSERVED',
  'T2_LIMITED',
  'T3_STANDARD',
  'T4_TRUSTED',
  'T5_CERTIFIED',
  // Legacy v2 names (from v2/enums.ts)
  'T1_SUPERVISED',
  'T2_CONSTRAINED',
  'T3_TRUSTED',      // v2 name for T3
  'T4_AUTONOMOUS',
  'T5_MISSION_CRITICAL',
] as const;

/**
 * Canonical TrustBand numeric values
 */
const CANONICAL_TRUST_BAND_VALUES = {
  T0_UNTRUSTED: 0,
  T1_SUPERVISED: 1,
  T2_CONSTRAINED: 2,
  T3_TRUSTED: 3,
  T4_AUTONOMOUS: 4,
  T5_MISSION_CRITICAL: 5,
} as const;

/**
 * Canonical ObservationTier values
 */
const CANONICAL_OBSERVATION_TIERS = [
  'BLACK_BOX',
  'GRAY_BOX',
  'WHITE_BOX',
  'ATTESTED_BOX',
  'VERIFIED_BOX',
] as const;

/**
 * Canonical trust ceiling values per observation tier (0-1000 scale)
 */
const CANONICAL_OBSERVATION_CEILINGS = {
  BLACK_BOX: 600,
  GRAY_BOX: 750,
  WHITE_BOX: 900,
  ATTESTED_BOX: 950,
  VERIFIED_BOX: 1000,
} as const;

/**
 * Canonical DataSensitivity values
 */
const CANONICAL_DATA_SENSITIVITY = [
  'PUBLIC',
  'INTERNAL',
  'CONFIDENTIAL',
  'RESTRICTED',
] as const;

/**
 * Canonical Reversibility values
 */
const CANONICAL_REVERSIBILITY = [
  'REVERSIBLE',
  'PARTIALLY_REVERSIBLE',
  'IRREVERSIBLE',
] as const;

/**
 * Canonical ActionType values
 */
const CANONICAL_ACTION_TYPES = [
  'read',
  'write',
  'delete',
  'execute',
  'communicate',
  'transfer',
] as const;

/**
 * Canonical ProofEventType values
 */
const CANONICAL_PROOF_EVENT_TYPES = [
  'intent_received',
  'decision_made',
  'trust_delta',
  'execution_started',
  'execution_completed',
  'execution_failed',
  'incident_detected',
  'rollback_initiated',
  'component_registered',
  'component_updated',
] as const;

/**
 * Canonical ComponentType values
 */
const CANONICAL_COMPONENT_TYPES = [
  'agent',
  'service',
  'adapter',
  'policy_bundle',
] as const;

/**
 * Canonical ComponentStatus values
 */
const CANONICAL_COMPONENT_STATUS = [
  'active',
  'deprecated',
  'retired',
] as const;

/**
 * Canonical ApprovalType values
 */
const CANONICAL_APPROVAL_TYPES = [
  'none',
  'human_review',
  'automated_check',
  'multi_party',
] as const;

/**
 * Canonical TrustDeltaReason values
 */
const CANONICAL_TRUST_DELTA_REASONS = [
  'positive_evidence',
  'negative_evidence',
  'manual_adjustment',
  'time_decay',
  'band_promotion',
  'band_demotion',
  'recalculation',
  'observation_tier_change',
  'policy_change',
] as const;

/**
 * Canonical RiskProfile values
 */
const CANONICAL_RISK_PROFILES = [
  'IMMEDIATE',
  'SHORT_TERM',
  'MEDIUM_TERM',
  'LONG_TERM',
  'EXTENDED',
] as const;

/**
 * Canonical DenialReason values
 */
const CANONICAL_DENIAL_REASONS = [
  'insufficient_trust',
  'policy_violation',
  'resource_restricted',
  'data_sensitivity_exceeded',
  'rate_limit_exceeded',
  'context_mismatch',
  'expired_intent',
  'system_error',
] as const;

/**
 * Canonical TrustScore range (0-1000 scale)
 */
const CANONICAL_TRUST_SCORE_RANGE = {
  min: 0,
  max: 1000,
} as const;

/**
 * Canonical BandThresholds (0-1000 scale)
 */
const CANONICAL_BAND_THRESHOLDS = {
  T0: { min: 0, max: 166 },
  T1: { min: 167, max: 332 },
  T2: { min: 333, max: 499 },
  T3: { min: 500, max: 665 },
  T4: { min: 666, max: 832 },
  T5: { min: 833, max: 1000 },
} as const;

// ============================================================================
// Types
// ============================================================================

interface DriftIssue {
  file: string;
  line: number;
  type: 'missing' | 'mismatch' | 'duplicate' | 'invalid_range' | 'extra' | 'migration';
  message: string;
  expected?: string;
  found?: string;
}

interface ScanResult {
  issues: DriftIssue[];
  scannedFiles: number;
}

// ============================================================================
// Utilities
// ============================================================================

const ROOT_DIR = path.resolve(__dirname, '..');
const CONTRACTS_DIR = path.join(ROOT_DIR, 'packages', 'contracts', 'src');
const CANONICAL_DIR = path.join(CONTRACTS_DIR, 'canonical');

/**
 * Check if a file path is within the canonical type location.
 * Files in packages/contracts/src/canonical/ are considered authoritative.
 */
function isCanonicalFile(filePath: string): boolean {
  const relativePath = path.relative(ROOT_DIR, filePath);
  const normalizedPath = relativePath.replace(/\\/g, '/');
  return normalizedPath.startsWith('packages/contracts/src/canonical/');
}

/**
 * Get all TypeScript files in a directory recursively
 */
function getTypeScriptFiles(dir: string): string[] {
  const files: string[] = [];

  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    // Skip node_modules and dist directories
    if (entry.name === 'node_modules' || entry.name === 'dist') {
      continue;
    }

    if (entry.isDirectory()) {
      files.push(...getTypeScriptFiles(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Read file and return lines with line numbers
 */
function readFileLines(filePath: string): { content: string; lines: string[] } {
  const content = fs.readFileSync(filePath, 'utf-8');
  return { content, lines: content.split('\n') };
}

/**
 * Find line number for a pattern match
 */
function findLineNumber(lines: string[], pattern: RegExp, startLine = 0): number {
  for (let i = startLine; i < lines.length; i++) {
    if (pattern.test(lines[i])) {
      return i + 1; // 1-indexed
    }
  }
  return -1;
}

/**
 * Extract enum values from TypeScript content
 */
function extractEnumValues(content: string, enumName: string): { values: string[]; line: number } {
  const enumPattern = new RegExp(`enum\\s+${enumName}\\s*\\{([^}]+)\\}`, 's');
  const match = content.match(enumPattern);

  if (!match) {
    return { values: [], line: -1 };
  }

  const enumBody = match[1];
  const values: string[] = [];

  // Match enum member names (must start with letter or underscore, not digits)
  // This ignores numeric values assigned to enum members
  const memberPattern = /^\s*([A-Z_][A-Z0-9_]*)\s*(?:=|,)/gim;
  let memberMatch: RegExpExecArray | null;

  while ((memberMatch = memberPattern.exec(enumBody)) !== null) {
    const value = memberMatch[1].trim();
    if (value && !value.startsWith('//') && !/^\d+$/.test(value)) {
      values.push(value);
    }
  }

  // Find line number
  const lines = content.split('\n');
  const line = findLineNumber(lines, new RegExp(`enum\\s+${enumName}\\s*\\{`));

  return { values, line };
}

/**
 * Check for duplicate type definitions across files.
 * Types in packages/contracts/src/canonical/ are considered authoritative.
 * When a type exists in both canonical and non-canonical locations,
 * only the non-canonical location is flagged for migration.
 */
function checkDuplicateDefinitions(files: string[]): DriftIssue[] {
  const issues: DriftIssue[] = [];
  const definitions = new Map<string, { file: string; line: number; isCanonical: boolean }[]>();

  const typePatterns = [
    /export\s+enum\s+(\w+)/g,
    /export\s+interface\s+(\w+)/g,
    /export\s+type\s+(\w+)\s*=/g,
  ];

  for (const filePath of files) {
    // Skip test files and d.ts files
    if (filePath.includes('.test.') || filePath.includes('.spec.') || filePath.endsWith('.d.ts')) {
      continue;
    }

    const { content, lines } = readFileLines(filePath);
    const relativePath = path.relative(ROOT_DIR, filePath);
    const fileIsCanonical = isCanonicalFile(filePath);

    for (const pattern of typePatterns) {
      let match: RegExpExecArray | null;
      // Reset lastIndex for each file
      pattern.lastIndex = 0;

      while ((match = pattern.exec(content)) !== null) {
        const typeName = match[1];
        const lineNum = findLineNumber(lines, new RegExp(match[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

        if (!definitions.has(typeName)) {
          definitions.set(typeName, []);
        }
        definitions.get(typeName)!.push({
          file: relativePath,
          line: lineNum,
          isCanonical: fileIsCanonical
        });
      }
    }
  }

  // Check for duplicates and migrations needed
  for (const [typeName, locations] of definitions) {
    // Filter out re-exports (files that just re-export from index)
    const actualDefinitions = locations.filter((loc) => !loc.file.includes('index.ts'));

    if (actualDefinitions.length <= 1) {
      continue;
    }

    // Separate canonical and non-canonical definitions
    const canonicalDefs = actualDefinitions.filter((loc) => loc.isCanonical);
    const nonCanonicalDefs = actualDefinitions.filter((loc) => !loc.isCanonical);

    // If there's a canonical definition, flag non-canonical ones for migration
    if (canonicalDefs.length > 0 && nonCanonicalDefs.length > 0) {
      const canonicalLoc = canonicalDefs[0];
      for (const loc of nonCanonicalDefs) {
        issues.push({
          file: loc.file,
          line: loc.line,
          type: 'migration',
          message: `Type '${typeName}' should be imported from canonical location`,
          expected: `Import from packages/contracts/src/canonical/`,
          found: `Local definition should migrate to use ${canonicalLoc.file}`,
        });
      }
    }
    // If no canonical definition exists, flag as duplicate (old behavior)
    else if (canonicalDefs.length === 0 && nonCanonicalDefs.length > 1) {
      // Check if they're in different packages (which is OK for re-exports)
      const packages = new Set(nonCanonicalDefs.map((loc) => loc.file.split('/')[0]));

      if (packages.size > 1 || nonCanonicalDefs.some((loc) => !loc.file.startsWith('packages/contracts'))) {
        for (const loc of nonCanonicalDefs.slice(1)) {
          issues.push({
            file: loc.file,
            line: loc.line,
            type: 'duplicate',
            message: `Duplicate definition of '${typeName}'`,
            expected: `Single definition in packages/contracts (consider adding to canonical/)`,
            found: `Also defined in ${nonCanonicalDefs[0].file}:${nonCanonicalDefs[0].line}`,
          });
        }
      }
    }
    // Don't flag canonical definitions as duplicates of each other
    // (e.g., agent.ts and governance.ts may both define shared types)
  }

  return issues;
}

// ============================================================================
// Schema Validators
// ============================================================================

/**
 * Validate TrustBand enum definition
 * Accepts two valid naming conventions:
 * - Canonical: T0_UNTRUSTED, T1_OBSERVED, T2_LIMITED, T3_STANDARD, T4_TRUSTED, T5_CERTIFIED
 * - V2: T0_UNTRUSTED, T1_SUPERVISED, T2_CONSTRAINED, T3_TRUSTED, T4_AUTONOMOUS, T5_MISSION_CRITICAL
 */
function validateTrustBandEnum(filePath: string, content: string): DriftIssue[] {
  const issues: DriftIssue[] = [];
  const relativePath = path.relative(ROOT_DIR, filePath);
  const { values, line } = extractEnumValues(content, 'TrustBand');

  if (values.length === 0) {
    return issues; // No TrustBand enum in this file
  }

  // Check that all found values are valid TrustBand names
  for (const found of values) {
    if (!CANONICAL_TRUST_BANDS.includes(found as typeof CANONICAL_TRUST_BANDS[number])) {
      issues.push({
        file: relativePath,
        line,
        type: 'extra',
        message: `TrustBand enum has unexpected value '${found}'`,
        expected: 'Valid TrustBand name (T0_UNTRUSTED, T1_OBSERVED/SUPERVISED, etc.)',
        found: found,
      });
    }
  }

  // Check that enum has 6 members (one for each band T0-T5)
  if (values.length !== 6 && values.length > 0) {
    issues.push({
      file: relativePath,
      line,
      type: 'mismatch',
      message: `TrustBand enum should have exactly 6 members (T0-T5)`,
      expected: '6 members',
      found: `${values.length} members: ${values.join(', ')}`,
    });
  }

  return issues;
}

/**
 * Validate ObservationTier enum definition
 */
function validateObservationTierEnum(filePath: string, content: string): DriftIssue[] {
  const issues: DriftIssue[] = [];
  const relativePath = path.relative(ROOT_DIR, filePath);
  const { values, line } = extractEnumValues(content, 'ObservationTier');

  if (values.length === 0) {
    return issues;
  }

  for (const expected of CANONICAL_OBSERVATION_TIERS) {
    if (!values.includes(expected)) {
      issues.push({
        file: relativePath,
        line,
        type: 'missing',
        message: `ObservationTier enum is missing value '${expected}'`,
        expected: expected,
        found: values.join(', '),
      });
    }
  }

  for (const found of values) {
    if (!CANONICAL_OBSERVATION_TIERS.includes(found as typeof CANONICAL_OBSERVATION_TIERS[number])) {
      issues.push({
        file: relativePath,
        line,
        type: 'extra',
        message: `ObservationTier enum has unexpected value '${found}'`,
        expected: CANONICAL_OBSERVATION_TIERS.join(', '),
        found: found,
      });
    }
  }

  return issues;
}

/**
 * Validate DataSensitivity enum definition
 */
function validateDataSensitivityEnum(filePath: string, content: string): DriftIssue[] {
  const issues: DriftIssue[] = [];
  const relativePath = path.relative(ROOT_DIR, filePath);
  const { values, line } = extractEnumValues(content, 'DataSensitivity');

  if (values.length === 0) {
    return issues;
  }

  for (const expected of CANONICAL_DATA_SENSITIVITY) {
    if (!values.includes(expected)) {
      issues.push({
        file: relativePath,
        line,
        type: 'missing',
        message: `DataSensitivity enum is missing value '${expected}'`,
        expected: expected,
        found: values.join(', '),
      });
    }
  }

  for (const found of values) {
    if (!CANONICAL_DATA_SENSITIVITY.includes(found as typeof CANONICAL_DATA_SENSITIVITY[number])) {
      issues.push({
        file: relativePath,
        line,
        type: 'extra',
        message: `DataSensitivity enum has unexpected value '${found}'`,
        expected: CANONICAL_DATA_SENSITIVITY.join(', '),
        found: found,
      });
    }
  }

  return issues;
}

/**
 * Validate Reversibility enum definition
 */
function validateReversibilityEnum(filePath: string, content: string): DriftIssue[] {
  const issues: DriftIssue[] = [];
  const relativePath = path.relative(ROOT_DIR, filePath);
  const { values, line } = extractEnumValues(content, 'Reversibility');

  if (values.length === 0) {
    return issues;
  }

  for (const expected of CANONICAL_REVERSIBILITY) {
    if (!values.includes(expected)) {
      issues.push({
        file: relativePath,
        line,
        type: 'missing',
        message: `Reversibility enum is missing value '${expected}'`,
        expected: expected,
        found: values.join(', '),
      });
    }
  }

  for (const found of values) {
    if (!CANONICAL_REVERSIBILITY.includes(found as typeof CANONICAL_REVERSIBILITY[number])) {
      issues.push({
        file: relativePath,
        line,
        type: 'extra',
        message: `Reversibility enum has unexpected value '${found}'`,
        expected: CANONICAL_REVERSIBILITY.join(', '),
        found: found,
      });
    }
  }

  return issues;
}

/**
 * Validate ActionType enum definition
 */
function validateActionTypeEnum(filePath: string, content: string): DriftIssue[] {
  const issues: DriftIssue[] = [];
  const relativePath = path.relative(ROOT_DIR, filePath);
  const { values, line } = extractEnumValues(content, 'ActionType');

  if (values.length === 0) {
    return issues;
  }

  // ActionType values are the keys (READ, WRITE, etc.), not the string values
  const expectedKeys = ['READ', 'WRITE', 'DELETE', 'EXECUTE', 'COMMUNICATE', 'TRANSFER'];

  for (const expected of expectedKeys) {
    if (!values.includes(expected)) {
      issues.push({
        file: relativePath,
        line,
        type: 'missing',
        message: `ActionType enum is missing value '${expected}'`,
        expected: expected,
        found: values.join(', '),
      });
    }
  }

  for (const found of values) {
    if (!expectedKeys.includes(found)) {
      issues.push({
        file: relativePath,
        line,
        type: 'extra',
        message: `ActionType enum has unexpected value '${found}'`,
        expected: expectedKeys.join(', '),
        found: found,
      });
    }
  }

  return issues;
}

/**
 * Validate ProofEventType enum definition
 */
function validateProofEventTypeEnum(filePath: string, content: string): DriftIssue[] {
  const issues: DriftIssue[] = [];
  const relativePath = path.relative(ROOT_DIR, filePath);
  const { values, line } = extractEnumValues(content, 'ProofEventType');

  if (values.length === 0) {
    return issues;
  }

  const expectedKeys = [
    'INTENT_RECEIVED',
    'DECISION_MADE',
    'TRUST_DELTA',
    'EXECUTION_STARTED',
    'EXECUTION_COMPLETED',
    'EXECUTION_FAILED',
    'INCIDENT_DETECTED',
    'ROLLBACK_INITIATED',
    'COMPONENT_REGISTERED',
    'COMPONENT_UPDATED',
  ];

  for (const expected of expectedKeys) {
    if (!values.includes(expected)) {
      issues.push({
        file: relativePath,
        line,
        type: 'missing',
        message: `ProofEventType enum is missing value '${expected}'`,
        expected: expected,
        found: values.join(', '),
      });
    }
  }

  for (const found of values) {
    if (!expectedKeys.includes(found)) {
      issues.push({
        file: relativePath,
        line,
        type: 'extra',
        message: `ProofEventType enum has unexpected value '${found}'`,
        expected: expectedKeys.join(', '),
        found: found,
      });
    }
  }

  return issues;
}

/**
 * Validate TrustDeltaReason enum definition
 */
function validateTrustDeltaReasonEnum(filePath: string, content: string): DriftIssue[] {
  const issues: DriftIssue[] = [];
  const relativePath = path.relative(ROOT_DIR, filePath);
  const { values, line } = extractEnumValues(content, 'TrustDeltaReason');

  if (values.length === 0) {
    return issues;
  }

  const expectedKeys = [
    'POSITIVE_EVIDENCE',
    'NEGATIVE_EVIDENCE',
    'MANUAL_ADJUSTMENT',
    'TIME_DECAY',
    'BAND_PROMOTION',
    'BAND_DEMOTION',
    'RECALCULATION',
    'OBSERVATION_TIER_CHANGE',
    'POLICY_CHANGE',
  ];

  for (const expected of expectedKeys) {
    if (!values.includes(expected)) {
      issues.push({
        file: relativePath,
        line,
        type: 'missing',
        message: `TrustDeltaReason enum is missing value '${expected}'`,
        expected: expected,
        found: values.join(', '),
      });
    }
  }

  for (const found of values) {
    if (!expectedKeys.includes(found)) {
      issues.push({
        file: relativePath,
        line,
        type: 'extra',
        message: `TrustDeltaReason enum has unexpected value '${found}'`,
        expected: expectedKeys.join(', '),
        found: found,
      });
    }
  }

  return issues;
}

/**
 * Validate DenialReason enum definition
 */
function validateDenialReasonEnum(filePath: string, content: string): DriftIssue[] {
  const issues: DriftIssue[] = [];
  const relativePath = path.relative(ROOT_DIR, filePath);
  const { values, line } = extractEnumValues(content, 'DenialReason');

  if (values.length === 0) {
    return issues;
  }

  const expectedKeys = [
    'INSUFFICIENT_TRUST',
    'POLICY_VIOLATION',
    'RESOURCE_RESTRICTED',
    'DATA_SENSITIVITY_EXCEEDED',
    'RATE_LIMIT_EXCEEDED',
    'CONTEXT_MISMATCH',
    'EXPIRED_INTENT',
    'SYSTEM_ERROR',
  ];

  for (const expected of expectedKeys) {
    if (!values.includes(expected)) {
      issues.push({
        file: relativePath,
        line,
        type: 'missing',
        message: `DenialReason enum is missing value '${expected}'`,
        expected: expected,
        found: values.join(', '),
      });
    }
  }

  for (const found of values) {
    if (!expectedKeys.includes(found)) {
      issues.push({
        file: relativePath,
        line,
        type: 'extra',
        message: `DenialReason enum has unexpected value '${found}'`,
        expected: expectedKeys.join(', '),
        found: found,
      });
    }
  }

  return issues;
}

/**
 * Validate RiskProfile enum definition
 */
function validateRiskProfileEnum(filePath: string, content: string): DriftIssue[] {
  const issues: DriftIssue[] = [];
  const relativePath = path.relative(ROOT_DIR, filePath);
  const { values, line } = extractEnumValues(content, 'RiskProfile');

  if (values.length === 0) {
    return issues;
  }

  for (const expected of CANONICAL_RISK_PROFILES) {
    if (!values.includes(expected)) {
      issues.push({
        file: relativePath,
        line,
        type: 'missing',
        message: `RiskProfile enum is missing value '${expected}'`,
        expected: expected,
        found: values.join(', '),
      });
    }
  }

  for (const found of values) {
    if (!CANONICAL_RISK_PROFILES.includes(found as typeof CANONICAL_RISK_PROFILES[number])) {
      issues.push({
        file: relativePath,
        line,
        type: 'extra',
        message: `RiskProfile enum has unexpected value '${found}'`,
        expected: CANONICAL_RISK_PROFILES.join(', '),
        found: found,
      });
    }
  }

  return issues;
}

/**
 * Validate trust score ranges in code
 */
function validateTrustScoreRanges(filePath: string, content: string): DriftIssue[] {
  const issues: DriftIssue[] = [];
  const relativePath = path.relative(ROOT_DIR, filePath);
  const lines = content.split('\n');

  // Look for trust score validations with incorrect ranges
  const rangePatterns = [
    /trustScore\s*>=?\s*(\d+)/g,
    /trustScore\s*<=?\s*(\d+)/g,
    /score\s*>=?\s*(\d+).*trust/gi,
    /score\s*<=?\s*(\d+).*trust/gi,
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip comments
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
      continue;
    }

    for (const pattern of rangePatterns) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = pattern.exec(line)) !== null) {
        const value = parseInt(match[1], 10);

        if (value < CANONICAL_TRUST_SCORE_RANGE.min || value > CANONICAL_TRUST_SCORE_RANGE.max) {
          // This might be a false positive (could be ms, not trust score), so be careful
          if (value > 100 && !line.toLowerCase().includes('ms') && !line.toLowerCase().includes('time')) {
            issues.push({
              file: relativePath,
              line: i + 1,
              type: 'invalid_range',
              message: `Potential trust score value '${value}' is outside valid range`,
              expected: `${CANONICAL_TRUST_SCORE_RANGE.min}-${CANONICAL_TRUST_SCORE_RANGE.max}`,
              found: String(value),
            });
          }
        }
      }
    }
  }

  return issues;
}

/**
 * Validate band thresholds
 */
function validateBandThresholds(filePath: string, content: string): DriftIssue[] {
  const issues: DriftIssue[] = [];
  const relativePath = path.relative(ROOT_DIR, filePath);
  const lines = content.split('\n');

  // Look for actual BAND_THRESHOLDS assignment (not just any reference)
  const thresholdsDefPattern = /(?:DEFAULT_)?BAND_THRESHOLDS\s*[=:]\s*\{/i;

  if (!thresholdsDefPattern.test(content)) {
    return issues;
  }

  // Check for specific threshold values
  for (const [band, range] of Object.entries(CANONICAL_BAND_THRESHOLDS)) {
    const bandPattern = new RegExp(`${band}[^}]*min:\\s*(\\d+)[^}]*max:\\s*(\\d+)`, 's');
    const match = content.match(bandPattern);

    if (match) {
      const min = parseInt(match[1], 10);
      const max = parseInt(match[2], 10);

      if (min !== range.min || max !== range.max) {
        const lineNum = findLineNumber(lines, new RegExp(`${band}[^}]*min`));
        issues.push({
          file: relativePath,
          line: lineNum,
          type: 'mismatch',
          message: `Band threshold for ${band} doesn't match canonical values`,
          expected: `min: ${range.min}, max: ${range.max}`,
          found: `min: ${min}, max: ${max}`,
        });
      }
    }
  }

  return issues;
}

/**
 * Validate observation ceiling values
 */
function validateObservationCeilings(filePath: string, content: string): DriftIssue[] {
  const issues: DriftIssue[] = [];
  const relativePath = path.relative(ROOT_DIR, filePath);
  const lines = content.split('\n');

  // Look for OBSERVATION_CEILINGS definition (must be an actual assignment)
  const ceilingsDefPattern = /OBSERVATION_CEILINGS\s*[=:]\s*\{/;
  if (!ceilingsDefPattern.test(content)) {
    return issues;
  }

  for (const [tier, ceiling] of Object.entries(CANONICAL_OBSERVATION_CEILINGS)) {
    // Match patterns like [ObservationTier.BLACK_BOX]: 600 or BLACK_BOX: 600
    // Only match values >= 50 to avoid false positives from ordering objects
    const patterns = [
      new RegExp(`\\[?(?:ObservationTier\\.)?${tier}\\]?:\\s*(\\d{2,})`),
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);

      if (match) {
        const value = parseInt(match[1], 10);

        // Skip values that are clearly not ceiling values (e.g., ordering 1-5)
        if (value < 50) {
          continue;
        }

        if (value !== ceiling) {
          const lineNum = findLineNumber(lines, pattern);
          issues.push({
            file: relativePath,
            line: lineNum,
            type: 'mismatch',
            message: `Observation ceiling for ${tier} doesn't match canonical value`,
            expected: String(ceiling),
            found: String(value),
          });
        }
      }
    }
  }

  return issues;
}

// ============================================================================
// Main Scanning Logic
// ============================================================================

/**
 * Scan a single file for schema drift.
 * Files in the canonical directory are considered authoritative and are not validated
 * for drift (they ARE the source of truth).
 */
function scanFile(filePath: string): DriftIssue[] {
  const issues: DriftIssue[] = [];

  // Skip canonical files - they are the authoritative source
  if (isCanonicalFile(filePath)) {
    return issues;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    // Run all validators
    issues.push(...validateTrustBandEnum(filePath, content));
    issues.push(...validateObservationTierEnum(filePath, content));
    issues.push(...validateDataSensitivityEnum(filePath, content));
    issues.push(...validateReversibilityEnum(filePath, content));
    issues.push(...validateActionTypeEnum(filePath, content));
    issues.push(...validateProofEventTypeEnum(filePath, content));
    issues.push(...validateTrustDeltaReasonEnum(filePath, content));
    issues.push(...validateDenialReasonEnum(filePath, content));
    issues.push(...validateRiskProfileEnum(filePath, content));
    issues.push(...validateTrustScoreRanges(filePath, content));
    issues.push(...validateBandThresholds(filePath, content));
    issues.push(...validateObservationCeilings(filePath, content));
  } catch (error) {
    console.error(`Error scanning ${filePath}:`, error);
  }

  return issues;
}

/**
 * Run the full schema drift scan
 */
function runScan(): ScanResult {
  const issues: DriftIssue[] = [];
  let scannedFiles = 0;

  console.log('Schema Drift Detection');
  console.log('======================\n');
  console.log('Scanning directories:');

  // Directories to scan
  const scanDirs = [
    path.join(ROOT_DIR, 'packages'),
    path.join(ROOT_DIR, 'apps'),
    path.join(ROOT_DIR, 'src'),
  ];

  const allFiles: string[] = [];

  for (const dir of scanDirs) {
    if (fs.existsSync(dir)) {
      console.log(`  - ${path.relative(ROOT_DIR, dir)}`);
      allFiles.push(...getTypeScriptFiles(dir));
    }
  }

  console.log(`\nFound ${allFiles.length} TypeScript files to scan.\n`);

  // Check for duplicate definitions
  console.log('Checking for duplicate type definitions...');
  issues.push(...checkDuplicateDefinitions(allFiles));

  // Scan each file for schema drift
  console.log('Checking for schema drift...\n');

  for (const filePath of allFiles) {
    const fileIssues = scanFile(filePath);
    issues.push(...fileIssues);
    scannedFiles++;

    // Progress indicator for large codebases
    if (scannedFiles % 100 === 0) {
      process.stdout.write(`  Scanned ${scannedFiles}/${allFiles.length} files\r`);
    }
  }

  return { issues, scannedFiles };
}

/**
 * Format and print issues
 */
function printIssues(issues: DriftIssue[]): void {
  if (issues.length === 0) {
    console.log('No schema drift detected.\n');
    return;
  }

  console.log(`Found ${issues.length} issue(s):\n`);

  // Group by file
  const byFile = new Map<string, DriftIssue[]>();

  for (const issue of issues) {
    if (!byFile.has(issue.file)) {
      byFile.set(issue.file, []);
    }
    byFile.get(issue.file)!.push(issue);
  }

  for (const [file, fileIssues] of byFile) {
    console.log(`${file}:`);

    for (const issue of fileIssues) {
      const typeIcon = {
        missing: '[-]',
        mismatch: '[~]',
        duplicate: '[D]',
        invalid_range: '[R]',
        extra: '[+]',
        migration: '[M]',
      }[issue.type];

      console.log(`  ${typeIcon} Line ${issue.line}: ${issue.message}`);

      if (issue.expected) {
        console.log(`      Expected: ${issue.expected}`);
      }
      if (issue.found) {
        console.log(`      Found: ${issue.found}`);
      }
    }

    console.log();
  }

  // Print summary by issue type
  const summary = issues.reduce((acc, issue) => {
    acc[issue.type] = (acc[issue.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('Summary:');
  console.log('--------');
  if (summary.migration) console.log(`  [M] Migration needed: ${summary.migration} (types to import from canonical/)`);
  if (summary.duplicate) console.log(`  [D] Duplicates: ${summary.duplicate} (types defined in multiple places)`);
  if (summary.missing) console.log(`  [-] Missing values: ${summary.missing}`);
  if (summary.mismatch) console.log(`  [~] Mismatches: ${summary.mismatch}`);
  if (summary.extra) console.log(`  [+] Extra values: ${summary.extra}`);
  if (summary.invalid_range) console.log(`  [R] Invalid ranges: ${summary.invalid_range}`);
  console.log();
}

/**
 * Generate GitHub-compatible annotations
 */
function printGitHubAnnotations(issues: DriftIssue[]): void {
  for (const issue of issues) {
    // Migration and duplicate issues are warnings (actionable but not breaking)
    // Other issues (missing, mismatch, invalid_range, extra) are errors
    const level = (issue.type === 'duplicate' || issue.type === 'migration') ? 'warning' : 'error';
    const message = `${issue.message}${issue.expected ? ` (expected: ${issue.expected})` : ''}`;
    console.log(`::${level} file=${issue.file},line=${issue.line}::${message}`);
  }
}

// ============================================================================
// Entry Point
// ============================================================================

function main(): void {
  const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

  try {
    const { issues, scannedFiles } = runScan();

    console.log(`\nScanned ${scannedFiles} files.\n`);

    if (isCI && issues.length > 0) {
      printGitHubAnnotations(issues);
      console.log();
    }

    printIssues(issues);

    if (issues.length > 0) {
      console.log('Schema drift detected. Please fix the issues above.');
      console.log('See docs/SCHEMA-GUIDELINES.md for canonical type definitions.\n');
      process.exit(1);
    }

    console.log('All schema checks passed.\n');
    process.exit(0);
  } catch (error) {
    console.error('Schema drift check failed:', error);
    process.exit(2);
  }
}

main();
