/**
 * @fileoverview ACI Skill Codes and Bitmask Operations
 *
 * Defines the skill codes used for fine-grained capability matching,
 * with bitmask encoding for efficient queries and skill matching.
 *
 * Skills represent specific capabilities within domains. While domains
 * define broad capability areas (A-I, S), skills provide granular
 * specialization within those areas.
 *
 * @module @vorion/contracts/aci/skills
 */

import { z } from 'zod';

// ============================================================================
// Skill Code Type
// ============================================================================

/**
 * Skill codes representing specific agent capabilities.
 *
 * Skills are organized into categories:
 *
 * **Content & Generation:**
 * - TG: Text Generation - General text creation and composition
 * - CW: Content Writing - Blog posts, articles, marketing copy
 * - CR: Creative Writing - Fiction, storytelling, creative content
 * - TD: Technical Documentation - Docs, guides, specifications
 * - TR: Translation - Language translation services
 * - SM: Summarization - Content condensation and extraction
 *
 * **Analysis & Research:**
 * - DA: Data Analysis - Statistical analysis, data processing
 * - RS: Research - Information gathering and synthesis
 * - QA: Question Answering - Q&A, knowledge retrieval
 *
 * **Development & Technical:**
 * - CA: Code Assistance - Programming help, debugging
 * - DV: Development - Software development tasks
 * - RV: Review - Code review, content review
 * - WS: Web Search - Internet search and retrieval
 * - FO: File Operations - File manipulation, I/O
 * - AI: API Integration - External API interactions
 *
 * **Business & Operations:**
 * - PL: Planning - Task planning, scheduling
 * - CM: Communication - Messaging, notifications
 * - CS: Customer Support - Customer service interactions
 * - AU: Automation - Workflow automation
 *
 * **Security & Governance:**
 * - SC: Security - Security-related operations
 * - GV: Governance - Policy and compliance
 */
export type SkillCode =
  | 'TG'  // Text Generation
  | 'CW'  // Content Writing
  | 'CR'  // Creative Writing
  | 'TD'  // Technical Documentation
  | 'TR'  // Translation
  | 'SM'  // Summarization
  | 'DA'  // Data Analysis
  | 'RS'  // Research
  | 'QA'  // Question Answering
  | 'CA'  // Code Assistance
  | 'DV'  // Development
  | 'RV'  // Review
  | 'WS'  // Web Search
  | 'FO'  // File Operations
  | 'AI'  // API Integration
  | 'PL'  // Planning
  | 'CM'  // Communication
  | 'CS'  // Customer Support
  | 'AU'  // Automation
  | 'SC'  // Security
  | 'GV'; // Governance

/**
 * Array of all valid skill codes.
 */
export const SKILL_CODES: readonly SkillCode[] = [
  'TG', 'CW', 'CR', 'TD', 'TR', 'SM',  // Content & Generation
  'DA', 'RS', 'QA',                     // Analysis & Research
  'CA', 'DV', 'RV', 'WS', 'FO', 'AI',  // Development & Technical
  'PL', 'CM', 'CS', 'AU',              // Business & Operations
  'SC', 'GV',                           // Security & Governance
] as const;

/**
 * Zod schema for SkillCode validation.
 */
export const skillCodeSchema = z.enum([
  'TG', 'CW', 'CR', 'TD', 'TR', 'SM',
  'DA', 'RS', 'QA',
  'CA', 'DV', 'RV', 'WS', 'FO', 'AI',
  'PL', 'CM', 'CS', 'AU',
  'SC', 'GV',
], {
  errorMap: () => ({ message: `Invalid skill code. Must be one of: ${SKILL_CODES.join(', ')}` }),
});

// ============================================================================
// Skill Definition
// ============================================================================

/**
 * Skill category for grouping related skills.
 */
export type SkillCategory =
  | 'content'
  | 'analysis'
  | 'development'
  | 'business'
  | 'security';

/**
 * Complete definition for a skill.
 */
export interface SkillDefinition {
  /** Two-character skill code */
  readonly code: SkillCode;
  /** Human-readable skill name */
  readonly name: string;
  /** Bitmask value for efficient queries (power of 2) */
  readonly bit: number;
  /** Description of the skill's scope */
  readonly description: string;
  /** Category grouping */
  readonly category: SkillCategory;
  /** Legacy string identifier for backward compatibility */
  readonly legacyId?: string;
}

/**
 * Skill definitions with their bitmask values.
 *
 * Each skill has a unique bitmask value (power of 2) for efficient
 * storage and querying of skill combinations.
 *
 * Using 32-bit integers, we can support up to 32 skills (21 currently defined).
 */
export const SKILL_DEFINITIONS: Readonly<Record<SkillCode, SkillDefinition>> = {
  // Content & Generation (bits 0-5)
  TG: { code: 'TG', name: 'Text Generation', bit: 0x00001, description: 'General text creation and composition', category: 'content', legacyId: 'text_generation' },
  CW: { code: 'CW', name: 'Content Writing', bit: 0x00002, description: 'Blog posts, articles, marketing copy', category: 'content', legacyId: 'content_writing' },
  CR: { code: 'CR', name: 'Creative Writing', bit: 0x00004, description: 'Fiction, storytelling, creative content', category: 'content', legacyId: 'creative_writing' },
  TD: { code: 'TD', name: 'Technical Documentation', bit: 0x00008, description: 'Docs, guides, specifications', category: 'content', legacyId: 'technical_documentation' },
  TR: { code: 'TR', name: 'Translation', bit: 0x00010, description: 'Language translation services', category: 'content', legacyId: 'translation' },
  SM: { code: 'SM', name: 'Summarization', bit: 0x00020, description: 'Content condensation and extraction', category: 'content', legacyId: 'summarization' },

  // Analysis & Research (bits 6-8)
  DA: { code: 'DA', name: 'Data Analysis', bit: 0x00040, description: 'Statistical analysis, data processing', category: 'analysis', legacyId: 'data_analysis' },
  RS: { code: 'RS', name: 'Research', bit: 0x00080, description: 'Information gathering and synthesis', category: 'analysis' },
  QA: { code: 'QA', name: 'Question Answering', bit: 0x00100, description: 'Q&A, knowledge retrieval', category: 'analysis', legacyId: 'question_answering' },

  // Development & Technical (bits 9-14)
  CA: { code: 'CA', name: 'Code Assistance', bit: 0x00200, description: 'Programming help, debugging', category: 'development', legacyId: 'code_assistance' },
  DV: { code: 'DV', name: 'Development', bit: 0x00400, description: 'Software development tasks', category: 'development' },
  RV: { code: 'RV', name: 'Review', bit: 0x00800, description: 'Code review, content review', category: 'development' },
  WS: { code: 'WS', name: 'Web Search', bit: 0x01000, description: 'Internet search and retrieval', category: 'development', legacyId: 'web_search' },
  FO: { code: 'FO', name: 'File Operations', bit: 0x02000, description: 'File manipulation, I/O', category: 'development', legacyId: 'file_operations' },
  AI: { code: 'AI', name: 'API Integration', bit: 0x04000, description: 'External API interactions', category: 'development', legacyId: 'api_integration' },

  // Business & Operations (bits 15-18)
  PL: { code: 'PL', name: 'Planning', bit: 0x08000, description: 'Task planning, scheduling', category: 'business' },
  CM: { code: 'CM', name: 'Communication', bit: 0x10000, description: 'Messaging, notifications', category: 'business' },
  CS: { code: 'CS', name: 'Customer Support', bit: 0x20000, description: 'Customer service interactions', category: 'business', legacyId: 'customer_support' },
  AU: { code: 'AU', name: 'Automation', bit: 0x40000, description: 'Workflow automation', category: 'business' },

  // Security & Governance (bits 19-20)
  SC: { code: 'SC', name: 'Security', bit: 0x80000, description: 'Security-related operations', category: 'security' },
  GV: { code: 'GV', name: 'Governance', bit: 0x100000, description: 'Policy and compliance', category: 'security' },
} as const;

/**
 * Human-readable skill names indexed by code.
 */
export const SKILL_NAMES: Readonly<Record<SkillCode, string>> = Object.fromEntries(
  Object.entries(SKILL_DEFINITIONS).map(([code, def]) => [code, def.name])
) as Record<SkillCode, string>;

/**
 * Bitmask value representing all skills combined.
 */
export const ALL_SKILLS_BITMASK = Object.values(SKILL_DEFINITIONS).reduce(
  (mask, skill) => mask | skill.bit,
  0
);

/**
 * Skills grouped by category.
 */
export const SKILLS_BY_CATEGORY: Readonly<Record<SkillCategory, readonly SkillCode[]>> = {
  content: ['TG', 'CW', 'CR', 'TD', 'TR', 'SM'],
  analysis: ['DA', 'RS', 'QA'],
  development: ['CA', 'DV', 'RV', 'WS', 'FO', 'AI'],
  business: ['PL', 'CM', 'CS', 'AU'],
  security: ['SC', 'GV'],
} as const;

// ============================================================================
// Legacy ID Mapping
// ============================================================================

/**
 * Map legacy string identifiers to skill codes.
 */
export const LEGACY_ID_TO_SKILL: Readonly<Record<string, SkillCode>> = {
  text_generation: 'TG',
  content_writing: 'CW',
  creative_writing: 'CR',
  technical_documentation: 'TD',
  translation: 'TR',
  summarization: 'SM',
  data_analysis: 'DA',
  question_answering: 'QA',
  code_assistance: 'CA',
  web_search: 'WS',
  file_operations: 'FO',
  api_integration: 'AI',
  customer_support: 'CS',
} as const;

/**
 * Converts a legacy skill ID to a skill code.
 *
 * @param legacyId - Legacy string identifier
 * @returns Skill code or undefined if not found
 */
export function legacyIdToSkillCode(legacyId: string): SkillCode | undefined {
  return LEGACY_ID_TO_SKILL[legacyId];
}

/**
 * Converts an array of legacy skill IDs to skill codes.
 *
 * @param legacyIds - Array of legacy string identifiers
 * @returns Array of skill codes (unrecognized IDs are filtered out)
 */
export function legacyIdsToSkillCodes(legacyIds: readonly string[]): SkillCode[] {
  return legacyIds
    .map((id) => LEGACY_ID_TO_SKILL[id])
    .filter((code): code is SkillCode => code !== undefined);
}

// ============================================================================
// Bitmask Encoding/Decoding
// ============================================================================

/**
 * Encodes an array of skill codes into a bitmask.
 *
 * @param skills - Array of skill codes to encode
 * @returns Bitmask integer representing the skills
 *
 * @example
 * ```typescript
 * encodeSkills(['TG', 'CA']);     // 0x201 (513)
 * encodeSkills(['DA', 'RS']);     // 0x0C0 (192)
 * encodeSkills([]);               // 0
 * ```
 */
export function encodeSkills(skills: readonly SkillCode[]): number {
  return skills.reduce((mask, code) => {
    const skill = SKILL_DEFINITIONS[code];
    return mask | skill.bit;
  }, 0);
}

/**
 * Decodes a bitmask into an array of skill codes.
 *
 * @param bitmask - Bitmask integer to decode
 * @returns Array of skill codes present in the bitmask
 *
 * @example
 * ```typescript
 * decodeSkills(0x201);  // ['TG', 'CA']
 * decodeSkills(0x0C0);  // ['DA', 'RS']
 * decodeSkills(0);      // []
 * ```
 */
export function decodeSkills(bitmask: number): SkillCode[] {
  return SKILL_CODES.filter((code) => (bitmask & SKILL_DEFINITIONS[code].bit) !== 0);
}

/**
 * Parses a skill string (e.g., "TG,CA,DA") into an array of codes.
 *
 * @param skillString - Comma-separated skill codes
 * @returns Array of valid skill codes
 *
 * @example
 * ```typescript
 * parseSkillString('TG,CA,DA');  // ['TG', 'CA', 'DA']
 * parseSkillString('TGCADA');    // ['TG', 'CA', 'DA']
 * parseSkillString('');          // []
 * ```
 */
export function parseSkillString(skillString: string): SkillCode[] {
  if (!skillString) return [];

  // Try comma-separated first
  if (skillString.includes(',')) {
    return skillString
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter((s): s is SkillCode => isSkillCode(s));
  }

  // Try parsing as concatenated two-letter codes
  const codes: SkillCode[] = [];
  for (let i = 0; i < skillString.length; i += 2) {
    const code = skillString.slice(i, i + 2).toUpperCase();
    if (isSkillCode(code)) {
      codes.push(code);
    }
  }
  return codes;
}

/**
 * Formats an array of skill codes into a sorted string.
 *
 * @param skills - Array of skill codes
 * @returns Sorted, deduplicated comma-separated string
 *
 * @example
 * ```typescript
 * formatSkillString(['DA', 'TG', 'CA']);  // 'CA,DA,TG'
 * formatSkillString(['TG', 'TG']);        // 'TG'
 * ```
 */
export function formatSkillString(skills: readonly SkillCode[]): string {
  const unique = [...new Set(skills)];
  return unique.sort().join(',');
}

// ============================================================================
// Skill Matching Operations
// ============================================================================

/**
 * Checks if a skill bitmask contains all required skills.
 *
 * @param agentSkills - Agent's skill bitmask
 * @param requiredSkills - Required skills bitmask
 * @returns True if agent has all required skills
 *
 * @example
 * ```typescript
 * const agentMask = encodeSkills(['TG', 'CA', 'DA']);
 * const required = encodeSkills(['TG', 'CA']);
 * hasSkills(agentMask, required);  // true
 * ```
 */
export function hasSkills(agentSkills: number, requiredSkills: number): boolean {
  return (agentSkills & requiredSkills) === requiredSkills;
}

/**
 * Checks if an agent satisfies skill requirements.
 *
 * @param agentSkills - Agent's skill codes
 * @param requiredSkills - Required skill codes
 * @returns True if agent has all required skills
 */
export function satisfiesSkillRequirements(
  agentSkills: readonly SkillCode[],
  requiredSkills: readonly SkillCode[]
): boolean {
  const agentMask = encodeSkills(agentSkills);
  const requiredMask = encodeSkills(requiredSkills);
  return hasSkills(agentMask, requiredMask);
}

/**
 * Returns the intersection of two skill sets.
 *
 * @param skills1 - First skill set
 * @param skills2 - Second skill set
 * @returns Skills present in both sets
 */
export function intersectSkills(
  skills1: readonly SkillCode[],
  skills2: readonly SkillCode[]
): SkillCode[] {
  const mask1 = encodeSkills(skills1);
  const mask2 = encodeSkills(skills2);
  return decodeSkills(mask1 & mask2);
}

/**
 * Returns the union of two skill sets.
 *
 * @param skills1 - First skill set
 * @param skills2 - Second skill set
 * @returns All skills from both sets
 */
export function unionSkills(
  skills1: readonly SkillCode[],
  skills2: readonly SkillCode[]
): SkillCode[] {
  const mask1 = encodeSkills(skills1);
  const mask2 = encodeSkills(skills2);
  return decodeSkills(mask1 | mask2);
}

/**
 * Returns skills in the first set but not in the second.
 *
 * @param skills1 - First skill set
 * @param skills2 - Second skill set
 * @returns Skills unique to the first set
 */
export function differenceSkills(
  skills1: readonly SkillCode[],
  skills2: readonly SkillCode[]
): SkillCode[] {
  const mask1 = encodeSkills(skills1);
  const mask2 = encodeSkills(skills2);
  return decodeSkills(mask1 & ~mask2);
}

// ============================================================================
// Skill Metadata Functions
// ============================================================================

/**
 * Gets the complete definition for a skill code.
 *
 * @param code - Skill code
 * @returns Skill definition or undefined if not found
 */
export function getSkillDefinition(code: SkillCode): SkillDefinition {
  return SKILL_DEFINITIONS[code];
}

/**
 * Gets the human-readable name for a skill code.
 *
 * @param code - Skill code
 * @returns Skill name
 */
export function getSkillName(code: SkillCode): string {
  return SKILL_DEFINITIONS[code].name;
}

/**
 * Gets the bitmask value for a skill code.
 *
 * @param code - Skill code
 * @returns Bitmask value
 */
export function getSkillBit(code: SkillCode): number {
  return SKILL_DEFINITIONS[code].bit;
}

/**
 * Gets the category for a skill code.
 *
 * @param code - Skill code
 * @returns Skill category
 */
export function getSkillCategory(code: SkillCode): SkillCategory {
  return SKILL_DEFINITIONS[code].category;
}

/**
 * Gets all skills in a category.
 *
 * @param category - Skill category
 * @returns Array of skill codes in that category
 */
export function getSkillsInCategory(category: SkillCategory): readonly SkillCode[] {
  return SKILLS_BY_CATEGORY[category];
}

/**
 * Counts the number of skills in a bitmask.
 *
 * @param bitmask - Skill bitmask
 * @returns Number of skills
 */
export function countSkills(bitmask: number): number {
  let count = 0;
  let mask = bitmask;
  while (mask) {
    count += mask & 1;
    mask >>>= 1;
  }
  return count;
}

// ============================================================================
// Type Guards and Validation
// ============================================================================

/**
 * Type guard to check if a value is a valid skill code.
 *
 * @param value - Value to check
 * @returns True if value is a valid SkillCode
 */
export function isSkillCode(value: unknown): value is SkillCode {
  return typeof value === 'string' && SKILL_CODES.includes(value as SkillCode);
}

/**
 * Type guard to check if an array contains only valid skill codes.
 *
 * @param values - Array to check
 * @returns True if all values are valid SkillCodes
 */
export function isSkillCodeArray(values: unknown): values is SkillCode[] {
  return Array.isArray(values) && values.every(isSkillCode);
}

// ============================================================================
// Zod Schemas
// ============================================================================

/**
 * Zod schema for SkillDefinition validation.
 */
export const skillDefinitionSchema = z.object({
  code: skillCodeSchema,
  name: z.string().min(1),
  bit: z.number().int().positive(),
  description: z.string().min(1),
  category: z.enum(['content', 'analysis', 'development', 'business', 'security']),
  legacyId: z.string().optional(),
});

/**
 * Zod schema for skill code array validation.
 */
export const skillCodeArraySchema = z.array(skillCodeSchema);

/**
 * Zod schema for skill bitmask validation (21 bits max).
 */
export const skillBitmaskSchema = z.number().int().min(0).max(ALL_SKILLS_BITMASK);

/**
 * Zod schema for skill string validation (comma-separated codes).
 */
export const skillStringSchema = z
  .string()
  .refine(
    (val) => {
      if (!val) return true;
      const codes = parseSkillString(val);
      return codes.length > 0;
    },
    { message: 'Invalid skill string format' }
  )
  .transform((val) => parseSkillString(val));
