/**
 * @fileoverview ACI Capability Levels (L0-L5)
 *
 * Defines the autonomy/capability levels used in ACI strings. Levels represent
 * what actions an agent is permitted to perform, ranging from read-only
 * observation (L0) to full autonomy (L5).
 *
 * @module @vorion/contracts/aci/levels
 */

import { z } from 'zod';

// ============================================================================
// Capability Level Enum
// ============================================================================

/**
 * Capability levels defining agent autonomy.
 *
 * Levels form a hierarchy where higher levels include the capabilities
 * of all lower levels:
 *
 * - L0: Read-only access, monitoring, observation
 * - L1: Can suggest and recommend, but not modify
 * - L2: Can prepare drafts and stage changes for review
 * - L3: Can execute operations with human approval
 * - L4: Self-directed operation within defined bounds
 * - L5: Full autonomy, typically for mission-critical certified agents
 */
export enum CapabilityLevel {
  /** Read-only, monitoring - Can observe but not interact */
  L0_OBSERVE = 0,
  /** Advisory - Can suggest and recommend actions */
  L1_ADVISE = 1,
  /** Drafting - Can prepare changes for human review */
  L2_DRAFT = 2,
  /** Execute - Can execute with human approval */
  L3_EXECUTE = 3,
  /** Autonomous - Self-directed within bounds */
  L4_AUTONOMOUS = 4,
  /** Sovereign - Full autonomy (highest certification) */
  L5_SOVEREIGN = 5,
}

/**
 * Array of all capability levels in ascending order.
 */
export const CAPABILITY_LEVELS = [
  CapabilityLevel.L0_OBSERVE,
  CapabilityLevel.L1_ADVISE,
  CapabilityLevel.L2_DRAFT,
  CapabilityLevel.L3_EXECUTE,
  CapabilityLevel.L4_AUTONOMOUS,
  CapabilityLevel.L5_SOVEREIGN,
] as const;

/**
 * Zod schema for CapabilityLevel enum validation.
 */
export const capabilityLevelSchema = z.nativeEnum(CapabilityLevel, {
  errorMap: () => ({ message: 'Invalid capability level. Must be L0-L5 (0-5).' }),
});

// ============================================================================
// Level Names and Descriptions
// ============================================================================

/**
 * Human-readable names for capability levels.
 */
export const CAPABILITY_LEVEL_NAMES: Readonly<Record<CapabilityLevel, string>> = {
  [CapabilityLevel.L0_OBSERVE]: 'Observe',
  [CapabilityLevel.L1_ADVISE]: 'Advise',
  [CapabilityLevel.L2_DRAFT]: 'Draft',
  [CapabilityLevel.L3_EXECUTE]: 'Execute',
  [CapabilityLevel.L4_AUTONOMOUS]: 'Autonomous',
  [CapabilityLevel.L5_SOVEREIGN]: 'Sovereign',
} as const;

/**
 * Short codes for capability levels (without the L prefix).
 */
export const CAPABILITY_LEVEL_CODES: Readonly<Record<CapabilityLevel, string>> = {
  [CapabilityLevel.L0_OBSERVE]: 'L0',
  [CapabilityLevel.L1_ADVISE]: 'L1',
  [CapabilityLevel.L2_DRAFT]: 'L2',
  [CapabilityLevel.L3_EXECUTE]: 'L3',
  [CapabilityLevel.L4_AUTONOMOUS]: 'L4',
  [CapabilityLevel.L5_SOVEREIGN]: 'L5',
} as const;

/**
 * Detailed descriptions for each capability level.
 */
export const CAPABILITY_LEVEL_DESCRIPTIONS: Readonly<Record<CapabilityLevel, string>> = {
  [CapabilityLevel.L0_OBSERVE]:
    'Read-only access for monitoring and observation. Cannot modify state or interact with systems.',
  [CapabilityLevel.L1_ADVISE]:
    'Can analyze and provide recommendations. May suggest actions but cannot execute them.',
  [CapabilityLevel.L2_DRAFT]:
    'Can prepare drafts, stage changes, and create proposals. All changes require review before application.',
  [CapabilityLevel.L3_EXECUTE]:
    'Can execute operations with explicit human approval. Each action requires confirmation.',
  [CapabilityLevel.L4_AUTONOMOUS]:
    'Self-directed operation within predefined bounds. Can act independently within policy constraints.',
  [CapabilityLevel.L5_SOVEREIGN]:
    'Full autonomy with minimal oversight. Reserved for highest-certified agents in mission-critical roles.',
} as const;

/**
 * Capabilities granted at each level (cumulative).
 */
export const CAPABILITY_LEVEL_ABILITIES: Readonly<Record<CapabilityLevel, readonly string[]>> = {
  [CapabilityLevel.L0_OBSERVE]: ['read', 'monitor', 'report'],
  [CapabilityLevel.L1_ADVISE]: ['read', 'monitor', 'report', 'analyze', 'recommend'],
  [CapabilityLevel.L2_DRAFT]: ['read', 'monitor', 'report', 'analyze', 'recommend', 'draft', 'stage'],
  [CapabilityLevel.L3_EXECUTE]: [
    'read', 'monitor', 'report', 'analyze', 'recommend', 'draft', 'stage',
    'execute_with_approval', 'modify_with_approval',
  ],
  [CapabilityLevel.L4_AUTONOMOUS]: [
    'read', 'monitor', 'report', 'analyze', 'recommend', 'draft', 'stage',
    'execute_with_approval', 'modify_with_approval',
    'execute_within_bounds', 'modify_within_bounds', 'delegate',
  ],
  [CapabilityLevel.L5_SOVEREIGN]: [
    'read', 'monitor', 'report', 'analyze', 'recommend', 'draft', 'stage',
    'execute_with_approval', 'modify_with_approval',
    'execute_within_bounds', 'modify_within_bounds', 'delegate',
    'execute_any', 'modify_any', 'spawn_agents', 'override_constraints',
  ],
} as const;

// ============================================================================
// Level Configuration
// ============================================================================

/**
 * Configuration for a capability level.
 */
export interface CapabilityLevelConfig {
  /** The capability level */
  readonly level: CapabilityLevel;
  /** Short code (L0-L5) */
  readonly code: string;
  /** Human-readable name */
  readonly name: string;
  /** Detailed description */
  readonly description: string;
  /** Abilities granted at this level */
  readonly abilities: readonly string[];
  /** Whether human approval is required for actions */
  readonly requiresApproval: boolean;
  /** Whether this level can operate autonomously */
  readonly canOperateAutonomously: boolean;
  /** Minimum certification tier typically required */
  readonly minCertificationTier: number;
}

/**
 * Complete configuration for all capability levels.
 */
export const CAPABILITY_LEVEL_CONFIGS: Readonly<Record<CapabilityLevel, CapabilityLevelConfig>> = {
  [CapabilityLevel.L0_OBSERVE]: {
    level: CapabilityLevel.L0_OBSERVE,
    code: 'L0',
    name: 'Observe',
    description: CAPABILITY_LEVEL_DESCRIPTIONS[CapabilityLevel.L0_OBSERVE],
    abilities: CAPABILITY_LEVEL_ABILITIES[CapabilityLevel.L0_OBSERVE],
    requiresApproval: false,
    canOperateAutonomously: false,
    minCertificationTier: 0,
  },
  [CapabilityLevel.L1_ADVISE]: {
    level: CapabilityLevel.L1_ADVISE,
    code: 'L1',
    name: 'Advise',
    description: CAPABILITY_LEVEL_DESCRIPTIONS[CapabilityLevel.L1_ADVISE],
    abilities: CAPABILITY_LEVEL_ABILITIES[CapabilityLevel.L1_ADVISE],
    requiresApproval: false,
    canOperateAutonomously: false,
    minCertificationTier: 1,
  },
  [CapabilityLevel.L2_DRAFT]: {
    level: CapabilityLevel.L2_DRAFT,
    code: 'L2',
    name: 'Draft',
    description: CAPABILITY_LEVEL_DESCRIPTIONS[CapabilityLevel.L2_DRAFT],
    abilities: CAPABILITY_LEVEL_ABILITIES[CapabilityLevel.L2_DRAFT],
    requiresApproval: true,
    canOperateAutonomously: false,
    minCertificationTier: 2,
  },
  [CapabilityLevel.L3_EXECUTE]: {
    level: CapabilityLevel.L3_EXECUTE,
    code: 'L3',
    name: 'Execute',
    description: CAPABILITY_LEVEL_DESCRIPTIONS[CapabilityLevel.L3_EXECUTE],
    abilities: CAPABILITY_LEVEL_ABILITIES[CapabilityLevel.L3_EXECUTE],
    requiresApproval: true,
    canOperateAutonomously: false,
    minCertificationTier: 3,
  },
  [CapabilityLevel.L4_AUTONOMOUS]: {
    level: CapabilityLevel.L4_AUTONOMOUS,
    code: 'L4',
    name: 'Autonomous',
    description: CAPABILITY_LEVEL_DESCRIPTIONS[CapabilityLevel.L4_AUTONOMOUS],
    abilities: CAPABILITY_LEVEL_ABILITIES[CapabilityLevel.L4_AUTONOMOUS],
    requiresApproval: false,
    canOperateAutonomously: true,
    minCertificationTier: 4,
  },
  [CapabilityLevel.L5_SOVEREIGN]: {
    level: CapabilityLevel.L5_SOVEREIGN,
    code: 'L5',
    name: 'Sovereign',
    description: CAPABILITY_LEVEL_DESCRIPTIONS[CapabilityLevel.L5_SOVEREIGN],
    abilities: CAPABILITY_LEVEL_ABILITIES[CapabilityLevel.L5_SOVEREIGN],
    requiresApproval: false,
    canOperateAutonomously: true,
    minCertificationTier: 5,
  },
} as const;

// ============================================================================
// Level Comparison Helpers
// ============================================================================

/**
 * Checks if one level is higher than another.
 *
 * @param level - The level to check
 * @param other - The level to compare against
 * @returns True if level is higher than other
 *
 * @example
 * ```typescript
 * isLevelHigher(CapabilityLevel.L3_EXECUTE, CapabilityLevel.L2_DRAFT);  // true
 * isLevelHigher(CapabilityLevel.L1_ADVISE, CapabilityLevel.L3_EXECUTE); // false
 * ```
 */
export function isLevelHigher(level: CapabilityLevel, other: CapabilityLevel): boolean {
  return level > other;
}

/**
 * Checks if one level is at least as high as another.
 *
 * @param level - The level to check
 * @param minLevel - The minimum level required
 * @returns True if level meets or exceeds minLevel
 *
 * @example
 * ```typescript
 * meetsLevel(CapabilityLevel.L3_EXECUTE, CapabilityLevel.L2_DRAFT);     // true
 * meetsLevel(CapabilityLevel.L2_DRAFT, CapabilityLevel.L2_DRAFT);       // true
 * meetsLevel(CapabilityLevel.L1_ADVISE, CapabilityLevel.L3_EXECUTE);    // false
 * ```
 */
export function meetsLevel(level: CapabilityLevel, minLevel: CapabilityLevel): boolean {
  return level >= minLevel;
}

/**
 * Compares two capability levels.
 *
 * @param a - First level
 * @param b - Second level
 * @returns -1 if a < b, 0 if equal, 1 if a > b
 */
export function compareLevels(a: CapabilityLevel, b: CapabilityLevel): -1 | 0 | 1 {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Gets the minimum of two capability levels.
 *
 * @param a - First level
 * @param b - Second level
 * @returns The lower level
 */
export function minLevel(a: CapabilityLevel, b: CapabilityLevel): CapabilityLevel {
  return Math.min(a, b) as CapabilityLevel;
}

/**
 * Gets the maximum of two capability levels.
 *
 * @param a - First level
 * @param b - Second level
 * @returns The higher level
 */
export function maxLevel(a: CapabilityLevel, b: CapabilityLevel): CapabilityLevel {
  return Math.max(a, b) as CapabilityLevel;
}

/**
 * Clamps a level to a range.
 *
 * @param level - The level to clamp
 * @param min - Minimum allowed level
 * @param max - Maximum allowed level
 * @returns The clamped level
 */
export function clampLevel(
  level: CapabilityLevel,
  min: CapabilityLevel = CapabilityLevel.L0_OBSERVE,
  max: CapabilityLevel = CapabilityLevel.L5_SOVEREIGN
): CapabilityLevel {
  return Math.max(min, Math.min(max, level)) as CapabilityLevel;
}

// ============================================================================
// Level Information Helpers
// ============================================================================

/**
 * Gets the configuration for a capability level.
 *
 * @param level - The capability level
 * @returns Level configuration
 */
export function getLevelConfig(level: CapabilityLevel): CapabilityLevelConfig {
  return CAPABILITY_LEVEL_CONFIGS[level];
}

/**
 * Gets the human-readable name for a capability level.
 *
 * @param level - The capability level
 * @returns Level name
 */
export function getLevelName(level: CapabilityLevel): string {
  return CAPABILITY_LEVEL_NAMES[level];
}

/**
 * Gets the short code (L0-L5) for a capability level.
 *
 * @param level - The capability level
 * @returns Level code
 */
export function getLevelCode(level: CapabilityLevel): string {
  return CAPABILITY_LEVEL_CODES[level];
}

/**
 * Gets the description for a capability level.
 *
 * @param level - The capability level
 * @returns Level description
 */
export function getLevelDescription(level: CapabilityLevel): string {
  return CAPABILITY_LEVEL_DESCRIPTIONS[level];
}

/**
 * Checks if a level has a specific ability.
 *
 * @param level - The capability level
 * @param ability - The ability to check
 * @returns True if the level grants this ability
 */
export function hasAbility(level: CapabilityLevel, ability: string): boolean {
  return CAPABILITY_LEVEL_ABILITIES[level].includes(ability);
}

/**
 * Checks if a level requires approval for actions.
 *
 * @param level - The capability level
 * @returns True if approval is required
 */
export function requiresApproval(level: CapabilityLevel): boolean {
  return CAPABILITY_LEVEL_CONFIGS[level].requiresApproval;
}

/**
 * Checks if a level can operate autonomously.
 *
 * @param level - The capability level
 * @returns True if autonomous operation is allowed
 */
export function canOperateAutonomously(level: CapabilityLevel): boolean {
  return CAPABILITY_LEVEL_CONFIGS[level].canOperateAutonomously;
}

// ============================================================================
// Parsing and Validation
// ============================================================================

/**
 * Parses a level string (e.g., "L3" or "3") to a CapabilityLevel.
 *
 * @param levelStr - Level string to parse
 * @returns Parsed CapabilityLevel
 * @throws Error if the string is not a valid level
 *
 * @example
 * ```typescript
 * parseLevel('L3');  // CapabilityLevel.L3_EXECUTE
 * parseLevel('3');   // CapabilityLevel.L3_EXECUTE
 * parseLevel('L0');  // CapabilityLevel.L0_OBSERVE
 * ```
 */
export function parseLevel(levelStr: string): CapabilityLevel {
  const normalized = levelStr.toUpperCase().replace(/^L/, '');
  const level = parseInt(normalized, 10);

  if (isNaN(level) || level < 0 || level > 5) {
    throw new Error(`Invalid capability level: ${levelStr}. Must be L0-L5 or 0-5.`);
  }

  return level as CapabilityLevel;
}

/**
 * Safely parses a level string, returning null on failure.
 *
 * @param levelStr - Level string to parse
 * @returns Parsed CapabilityLevel or null
 */
export function tryParseLevel(levelStr: string): CapabilityLevel | null {
  try {
    return parseLevel(levelStr);
  } catch {
    return null;
  }
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a value is a valid CapabilityLevel.
 *
 * @param value - Value to check
 * @returns True if value is a valid CapabilityLevel
 */
export function isCapabilityLevel(value: unknown): value is CapabilityLevel {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 5
  );
}

// ============================================================================
// Zod Schemas
// ============================================================================

/**
 * Zod schema for level configuration.
 */
export const capabilityLevelConfigSchema = z.object({
  level: capabilityLevelSchema,
  code: z.string().regex(/^L[0-5]$/),
  name: z.string().min(1),
  description: z.string().min(1),
  abilities: z.array(z.string()).readonly(),
  requiresApproval: z.boolean(),
  canOperateAutonomously: z.boolean(),
  minCertificationTier: z.number().int().min(0).max(5),
});

/**
 * Zod schema for parsing level strings.
 */
export const levelStringSchema = z
  .string()
  .regex(/^[Ll]?[0-5]$/, 'Level must be L0-L5 or 0-5')
  .transform((str) => parseLevel(str));
