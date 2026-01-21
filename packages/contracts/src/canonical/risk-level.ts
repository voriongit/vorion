/**
 * @fileoverview Canonical RiskLevel type definitions for the Vorion Platform.
 *
 * This file provides the authoritative definition for risk levels, unifying
 * the various representations found across packages (enum, string union, numeric)
 * into a single canonical source with conversion utilities.
 *
 * Risk levels classify the potential impact or severity of actions, decisions,
 * and events within the platform.
 *
 * @module @orion/contracts/canonical/risk-level
 */

import { z } from 'zod';

// ============================================================================
// Type Definition
// ============================================================================

/**
 * Canonical risk level type.
 *
 * Uses lowercase string union as the authoritative format.
 * This provides good developer experience while being easily
 * serializable and human-readable.
 *
 * Levels (in ascending severity):
 * - `low`: Minimal risk, standard operation
 * - `medium`: Moderate risk, enhanced monitoring recommended
 * - `high`: Significant risk, requires additional safeguards
 * - `critical`: Severe risk, may require human intervention
 *
 * @example
 * ```typescript
 * const risk: RiskLevel = 'medium';
 * ```
 */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

// ============================================================================
// Constants
// ============================================================================

/**
 * Array of all risk levels in ascending severity order.
 *
 * Useful for iteration, validation, and UI components.
 */
export const RISK_LEVELS: readonly RiskLevel[] = ['low', 'medium', 'high', 'critical'] as const;

/**
 * Numeric values for risk levels (0-3 scale).
 *
 * Enables numeric comparisons and calculations while maintaining
 * the string type as the canonical representation.
 *
 * @example
 * ```typescript
 * RISK_LEVEL_VALUES['critical']; // 3
 * RISK_LEVEL_VALUES['low'];      // 0
 * ```
 */
export const RISK_LEVEL_VALUES: Readonly<Record<RiskLevel, number>> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
} as const;

/**
 * Inverse mapping from numeric values to risk levels.
 *
 * @internal
 */
const NUMERIC_TO_RISK_LEVEL: Readonly<Record<number, RiskLevel>> = {
  0: 'low',
  1: 'medium',
  2: 'high',
  3: 'critical',
} as const;

/**
 * Human-readable labels for risk levels.
 *
 * Useful for display in UIs and reports.
 */
export const RISK_LEVEL_LABELS: Readonly<Record<RiskLevel, string>> = {
  low: 'Low Risk',
  medium: 'Medium Risk',
  high: 'High Risk',
  critical: 'Critical Risk',
} as const;

/**
 * Detailed descriptions for each risk level.
 *
 * Provides guidance on what each level means and when to use it.
 */
export const RISK_LEVEL_DESCRIPTIONS: Readonly<Record<RiskLevel, string>> = {
  low: 'Minimal risk. Standard operation with normal monitoring.',
  medium: 'Moderate risk. Enhanced monitoring and logging recommended.',
  high: 'Significant risk. Additional safeguards and review required.',
  critical: 'Severe risk. Human intervention may be required. Proceed with extreme caution.',
} as const;

/**
 * Color codes for risk levels (for UI display).
 *
 * Uses common color conventions: green for low, yellow/orange for medium,
 * red for high, and dark red for critical.
 */
export const RISK_LEVEL_COLORS: Readonly<Record<RiskLevel, string>> = {
  low: '#22c55e',      // Green
  medium: '#f59e0b',   // Amber
  high: '#ef4444',     // Red
  critical: '#7f1d1d', // Dark Red
} as const;

/**
 * Default risk level for unclassified items.
 */
export const DEFAULT_RISK_LEVEL: RiskLevel = 'low';

// ============================================================================
// Conversion Functions
// ============================================================================

/**
 * Converts a numeric value to a RiskLevel.
 *
 * Handles the 5-level numeric system (0-4) used by some packages
 * by mapping level 4 to 'critical' (same as level 3).
 *
 * @param n - Numeric value (0-4)
 * @returns Corresponding RiskLevel
 *
 * @example
 * ```typescript
 * riskLevelFromNumber(0); // 'low'
 * riskLevelFromNumber(2); // 'high'
 * riskLevelFromNumber(4); // 'critical' (Council's L4 maps to critical)
 * ```
 */
export function riskLevelFromNumber(n: number): RiskLevel {
  if (n <= 0) return 'low';
  if (n === 1) return 'medium';
  if (n === 2) return 'high';
  return 'critical'; // 3, 4, or higher all map to critical
}

/**
 * Converts a RiskLevel to its numeric value.
 *
 * @param level - RiskLevel to convert
 * @returns Numeric value (0-3)
 *
 * @example
 * ```typescript
 * riskLevelToNumber('low');      // 0
 * riskLevelToNumber('critical'); // 3
 * ```
 */
export function riskLevelToNumber(level: RiskLevel): number {
  return RISK_LEVEL_VALUES[level];
}

/**
 * Safely parses a value to RiskLevel.
 *
 * Handles various input formats:
 * - String values (case-insensitive)
 * - Numeric values (0-4)
 * - Enum-style uppercase strings
 *
 * @param value - Value to parse
 * @returns RiskLevel or null if unparseable
 *
 * @example
 * ```typescript
 * parseRiskLevel('LOW');     // 'low'
 * parseRiskLevel('MEDIUM');  // 'medium'
 * parseRiskLevel(2);         // 'high'
 * parseRiskLevel('invalid'); // null
 * ```
 */
export function parseRiskLevel(value: unknown): RiskLevel | null {
  if (typeof value === 'number') {
    if (value >= 0 && value <= 4 && Number.isInteger(value)) {
      return riskLevelFromNumber(value);
    }
    return null;
  }

  if (typeof value === 'string') {
    const normalized = value.toLowerCase().trim();
    if (RISK_LEVELS.includes(normalized as RiskLevel)) {
      return normalized as RiskLevel;
    }
  }

  return null;
}

/**
 * Parses a value to RiskLevel with a default fallback.
 *
 * @param value - Value to parse
 * @param defaultLevel - Default level if parsing fails
 * @returns RiskLevel (parsed or default)
 *
 * @example
 * ```typescript
 * parseRiskLevelOrDefault('high', 'low');    // 'high'
 * parseRiskLevelOrDefault('invalid', 'low'); // 'low'
 * ```
 */
export function parseRiskLevelOrDefault(
  value: unknown,
  defaultLevel: RiskLevel = DEFAULT_RISK_LEVEL
): RiskLevel {
  return parseRiskLevel(value) ?? defaultLevel;
}

// ============================================================================
// Comparison Functions
// ============================================================================

/**
 * Compares two risk levels.
 *
 * @param a - First risk level
 * @param b - Second risk level
 * @returns -1 if a < b, 0 if equal, 1 if a > b
 *
 * @example
 * ```typescript
 * compareRiskLevels('low', 'high');     // -1
 * compareRiskLevels('high', 'medium');  // 1
 * compareRiskLevels('medium', 'medium'); // 0
 * ```
 */
export function compareRiskLevels(a: RiskLevel, b: RiskLevel): -1 | 0 | 1 {
  const diff = RISK_LEVEL_VALUES[a] - RISK_LEVEL_VALUES[b];
  if (diff < 0) return -1;
  if (diff > 0) return 1;
  return 0;
}

/**
 * Checks if a risk level is at least as severe as another.
 *
 * @param level - Level to check
 * @param threshold - Minimum threshold
 * @returns True if level meets or exceeds threshold
 *
 * @example
 * ```typescript
 * isRiskAtLeast('high', 'medium');     // true
 * isRiskAtLeast('low', 'medium');      // false
 * isRiskAtLeast('medium', 'medium');   // true
 * ```
 */
export function isRiskAtLeast(level: RiskLevel, threshold: RiskLevel): boolean {
  return RISK_LEVEL_VALUES[level] >= RISK_LEVEL_VALUES[threshold];
}

/**
 * Checks if a risk level is more severe than another.
 *
 * @param level - Level to check
 * @param other - Level to compare against
 * @returns True if level is more severe than other
 *
 * @example
 * ```typescript
 * isRiskHigherThan('high', 'medium');   // true
 * isRiskHigherThan('medium', 'high');   // false
 * isRiskHigherThan('high', 'high');     // false
 * ```
 */
export function isRiskHigherThan(level: RiskLevel, other: RiskLevel): boolean {
  return RISK_LEVEL_VALUES[level] > RISK_LEVEL_VALUES[other];
}

/**
 * Gets the maximum (most severe) risk level from an array.
 *
 * @param levels - Array of risk levels
 * @returns Most severe risk level, or 'low' if array is empty
 *
 * @example
 * ```typescript
 * maxRiskLevel(['low', 'medium', 'high']); // 'high'
 * maxRiskLevel(['low', 'low']);            // 'low'
 * maxRiskLevel([]);                        // 'low'
 * ```
 */
export function maxRiskLevel(levels: RiskLevel[]): RiskLevel {
  if (levels.length === 0) return 'low';
  return levels.reduce((max, level) =>
    isRiskHigherThan(level, max) ? level : max
  );
}

/**
 * Gets the minimum (least severe) risk level from an array.
 *
 * @param levels - Array of risk levels
 * @returns Least severe risk level, or 'critical' if array is empty
 *
 * @example
 * ```typescript
 * minRiskLevel(['low', 'medium', 'high']); // 'low'
 * minRiskLevel(['high', 'critical']);      // 'high'
 * ```
 */
export function minRiskLevel(levels: RiskLevel[]): RiskLevel {
  if (levels.length === 0) return 'critical';
  return levels.reduce((min, level) =>
    isRiskHigherThan(min, level) ? level : min
  );
}

// ============================================================================
// Escalation Functions
// ============================================================================

/**
 * Escalates a risk level by one step (if possible).
 *
 * @param level - Current risk level
 * @returns Escalated risk level (or same if already critical)
 *
 * @example
 * ```typescript
 * escalateRiskLevel('low');      // 'medium'
 * escalateRiskLevel('high');     // 'critical'
 * escalateRiskLevel('critical'); // 'critical'
 * ```
 */
export function escalateRiskLevel(level: RiskLevel): RiskLevel {
  const currentValue = RISK_LEVEL_VALUES[level];
  const escalatedValue = Math.min(currentValue + 1, 3);
  return NUMERIC_TO_RISK_LEVEL[escalatedValue];
}

/**
 * De-escalates a risk level by one step (if possible).
 *
 * @param level - Current risk level
 * @returns De-escalated risk level (or same if already low)
 *
 * @example
 * ```typescript
 * deescalateRiskLevel('critical'); // 'high'
 * deescalateRiskLevel('medium');   // 'low'
 * deescalateRiskLevel('low');      // 'low'
 * ```
 */
export function deescalateRiskLevel(level: RiskLevel): RiskLevel {
  const currentValue = RISK_LEVEL_VALUES[level];
  const deescalatedValue = Math.max(currentValue - 1, 0);
  return NUMERIC_TO_RISK_LEVEL[deescalatedValue];
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a value is a valid RiskLevel.
 *
 * @param value - Value to check
 * @returns True if value is a valid RiskLevel
 *
 * @example
 * ```typescript
 * isRiskLevel('high');    // true
 * isRiskLevel('severe');  // false
 * isRiskLevel(2);         // false
 * ```
 */
export function isRiskLevel(value: unknown): value is RiskLevel {
  return typeof value === 'string' && RISK_LEVELS.includes(value as RiskLevel);
}

/**
 * Type guard to check if a risk level requires elevated attention.
 *
 * Returns true for 'high' and 'critical' levels.
 *
 * @param level - Risk level to check
 * @returns True if level requires elevated attention
 */
export function requiresElevatedAttention(level: RiskLevel): boolean {
  return level === 'high' || level === 'critical';
}

/**
 * Type guard to check if a risk level is critical.
 *
 * @param level - Risk level to check
 * @returns True if level is critical
 */
export function isCriticalRisk(level: RiskLevel): boolean {
  return level === 'critical';
}

// ============================================================================
// Display Functions
// ============================================================================

/**
 * Gets the human-readable label for a risk level.
 *
 * @param level - Risk level
 * @returns Human-readable label
 */
export function getRiskLevelLabel(level: RiskLevel): string {
  return RISK_LEVEL_LABELS[level];
}

/**
 * Gets the description for a risk level.
 *
 * @param level - Risk level
 * @returns Description string
 */
export function getRiskLevelDescription(level: RiskLevel): string {
  return RISK_LEVEL_DESCRIPTIONS[level];
}

/**
 * Gets the color code for a risk level.
 *
 * @param level - Risk level
 * @returns Hex color code
 */
export function getRiskLevelColor(level: RiskLevel): string {
  return RISK_LEVEL_COLORS[level];
}

// ============================================================================
// Zod Schemas
// ============================================================================

/**
 * Zod schema for RiskLevel validation.
 *
 * Validates that a value is one of the canonical risk level strings.
 *
 * @example
 * ```typescript
 * riskLevelSchema.parse('medium'); // Success
 * riskLevelSchema.parse('severe'); // Throws ZodError
 * ```
 */
export const riskLevelSchema = z.enum(['low', 'medium', 'high', 'critical'], {
  errorMap: () => ({
    message: "Invalid risk level. Must be 'low', 'medium', 'high', or 'critical'.",
  }),
});

/**
 * Zod schema that accepts numeric input and transforms to RiskLevel.
 *
 * @example
 * ```typescript
 * riskLevelFromNumberSchema.parse(2); // 'high'
 * ```
 */
export const riskLevelFromNumberSchema = z
  .number()
  .int()
  .min(0)
  .max(4)
  .transform((n) => riskLevelFromNumber(n));

/**
 * Zod schema that accepts string input (case-insensitive) and transforms to RiskLevel.
 *
 * @example
 * ```typescript
 * riskLevelFlexibleSchema.parse('HIGH'); // 'high'
 * riskLevelFlexibleSchema.parse('Medium'); // 'medium'
 * ```
 */
export const riskLevelFlexibleSchema = z
  .string()
  .transform((s) => s.toLowerCase().trim())
  .pipe(riskLevelSchema);

/**
 * Zod schema that accepts multiple input formats and normalizes to RiskLevel.
 *
 * Accepts: lowercase strings, uppercase strings, numbers (0-4).
 */
export const riskLevelUnionSchema = z.union([
  riskLevelSchema,
  riskLevelFlexibleSchema,
  riskLevelFromNumberSchema,
]);

// ============================================================================
// Legacy Compatibility
// ============================================================================

/**
 * Enum-style representation for compatibility with older code.
 *
 * @deprecated Use RiskLevel string type directly. This is for migration only.
 */
export const RiskLevelEnum = {
  LOW: 'low' as RiskLevel,
  MEDIUM: 'medium' as RiskLevel,
  HIGH: 'high' as RiskLevel,
  CRITICAL: 'critical' as RiskLevel,
} as const;

/**
 * Maps legacy uppercase enum values to canonical RiskLevel.
 *
 * @deprecated Use RiskLevel string type directly. This is for migration only.
 */
export const LEGACY_RISK_LEVEL_MAP: Readonly<Record<string, RiskLevel>> = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
  // Numeric string variants
  '0': 'low',
  '1': 'medium',
  '2': 'high',
  '3': 'critical',
  '4': 'critical',
} as const;
