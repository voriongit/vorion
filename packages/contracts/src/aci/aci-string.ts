/**
 * @fileoverview ACI String Parser and Generator
 *
 * Provides parsing, generation, and validation for Agent Classification
 * Identifier (ACI) strings. ACI strings follow the format:
 *
 *   `{registry}.{organization}.{agentClass}:{domains}-L{level}-T{tier}@{version}`
 *
 * Example: `a3i.acme-corp.invoice-bot:ABF-L3-T2@1.0.0`
 *
 * @module @vorion/contracts/aci/aci-string
 */

import { z } from 'zod';
import {
  type DomainCode,
  encodeDomains,
  formatDomainString,
  isDomainCode,
} from './domains.js';
import { CapabilityLevel, isCapabilityLevel } from './levels.js';
import { CertificationTier, isCertificationTier } from './tiers.js';

// ============================================================================
// ACI Regex Pattern
// ============================================================================

/**
 * Regular expression for parsing ACI strings.
 *
 * Format: `{registry}.{organization}.{agentClass}:{domains}-L{level}-T{tier}@{version}`
 *
 * Groups:
 * 1. registry - Certifying registry (e.g., 'a3i')
 * 2. organization - Operating organization (e.g., 'acme-corp')
 * 3. agentClass - Agent classification (e.g., 'invoice-bot')
 * 4. domains - Capability domain codes (e.g., 'ABF')
 * 5. level - Autonomy level (0-5)
 * 6. tier - Trust tier (0-5)
 * 7. version - Semantic version (e.g., '1.0.0')
 */
export const ACI_REGEX = /^([a-z0-9]+)\.([a-z0-9-]+)\.([a-z0-9-]+):([A-Z]+)-L([0-5])-T([0-5])@(\d+\.\d+\.\d+)$/;

/**
 * Looser regex for partial ACI validation.
 */
export const ACI_PARTIAL_REGEX = /^([a-z0-9]+)\.([a-z0-9-]+)\.([a-z0-9-]+):([A-Z]+)-L([0-5])-T([0-5])(@\d+\.\d+\.\d+)?$/;

// ============================================================================
// Parsed ACI Interface
// ============================================================================

/**
 * Parsed components of an ACI string.
 */
export interface ParsedACI {
  /** Full ACI string */
  readonly aci: string;
  /** Certifying registry (e.g., 'a3i') */
  readonly registry: string;
  /** Operating organization */
  readonly organization: string;
  /** Agent classification */
  readonly agentClass: string;
  /** Capability domain codes */
  readonly domains: readonly DomainCode[];
  /** Domain bitmask for efficient queries */
  readonly domainsBitmask: number;
  /** Autonomy/capability level */
  readonly level: CapabilityLevel;
  /** Trust/certification tier */
  readonly certificationTier: CertificationTier;
  /** Semantic version string */
  readonly version: string;
}

/**
 * Zod schema for ParsedACI validation.
 */
export const parsedACISchema = z.object({
  aci: z.string().min(1),
  registry: z.string().min(1).regex(/^[a-z0-9]+$/),
  organization: z.string().min(1).regex(/^[a-z0-9-]+$/),
  agentClass: z.string().min(1).regex(/^[a-z0-9-]+$/),
  domains: z.array(z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'S'])).min(1),
  domainsBitmask: z.number().int().min(0),
  level: z.nativeEnum(CapabilityLevel),
  certificationTier: z.nativeEnum(CertificationTier),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
});

// ============================================================================
// ACI Parse Error
// ============================================================================

/**
 * Error thrown when ACI parsing fails.
 */
export class ACIParseError extends Error {
  /** The invalid ACI string that caused the error */
  public readonly aci: string;
  /** Error code for programmatic handling */
  public readonly code: ACIParseErrorCode;

  constructor(message: string, aci: string, code: ACIParseErrorCode = 'INVALID_FORMAT') {
    super(message);
    this.name = 'ACIParseError';
    this.aci = aci;
    this.code = code;
  }
}

/**
 * Error codes for ACI parse errors.
 */
export type ACIParseErrorCode =
  | 'INVALID_FORMAT'
  | 'INVALID_REGISTRY'
  | 'INVALID_ORGANIZATION'
  | 'INVALID_AGENT_CLASS'
  | 'INVALID_DOMAINS'
  | 'NO_DOMAINS'
  | 'INVALID_LEVEL'
  | 'INVALID_TIER'
  | 'INVALID_VERSION';

// ============================================================================
// Parsing Functions
// ============================================================================

/**
 * Parses an ACI string into its components.
 *
 * @param aci - The ACI string to parse
 * @returns Parsed ACI components
 * @throws ACIParseError if the ACI string is invalid
 *
 * @example
 * ```typescript
 * const parsed = parseACI('a3i.acme-corp.invoice-bot:ABF-L3-T2@1.0.0');
 * // {
 * //   aci: 'a3i.acme-corp.invoice-bot:ABF-L3-T2@1.0.0',
 * //   registry: 'a3i',
 * //   organization: 'acme-corp',
 * //   agentClass: 'invoice-bot',
 * //   domains: ['A', 'B', 'F'],
 * //   domainsBitmask: 0x023,
 * //   level: CapabilityLevel.L3_EXECUTE,
 * //   certificationTier: CertificationTier.T2_TESTED,
 * //   version: '1.0.0'
 * // }
 * ```
 */
export function parseACI(aci: string): ParsedACI {
  const match = aci.match(ACI_REGEX);

  if (!match) {
    throw new ACIParseError(`Invalid ACI format: ${aci}`, aci, 'INVALID_FORMAT');
  }

  const [, registry, organization, agentClass, domainsStr, levelStr, tierStr, version] = match;

  // Validate and parse domains
  const domainChars = domainsStr!.split('');
  const invalidDomains = domainChars.filter((d) => !isDomainCode(d));

  if (invalidDomains.length > 0) {
    throw new ACIParseError(
      `Invalid domain codes: ${invalidDomains.join(', ')}`,
      aci,
      'INVALID_DOMAINS'
    );
  }

  if (domainChars.length === 0) {
    throw new ACIParseError('ACI must have at least one domain', aci, 'NO_DOMAINS');
  }

  const domains = domainChars as DomainCode[];
  const domainsBitmask = encodeDomains(domains);

  // Parse level and tier
  const level = parseInt(levelStr!, 10) as CapabilityLevel;
  const certificationTier = parseInt(tierStr!, 10) as CertificationTier;

  return {
    aci,
    registry: registry!,
    organization: organization!,
    agentClass: agentClass!,
    domains,
    domainsBitmask,
    level,
    certificationTier,
    version: version!,
  };
}

/**
 * Safely parses an ACI string, returning null on failure.
 *
 * @param aci - The ACI string to parse
 * @returns Parsed ACI or null if invalid
 */
export function tryParseACI(aci: string): ParsedACI | null {
  try {
    return parseACI(aci);
  } catch {
    return null;
  }
}

/**
 * Safely parses an ACI string, returning a result object.
 *
 * @param aci - The ACI string to parse
 * @returns Result object with success flag and parsed ACI or error
 */
export function safeParseACI(
  aci: string
): { success: true; data: ParsedACI } | { success: false; error: ACIParseError } {
  try {
    return { success: true, data: parseACI(aci) };
  } catch (error) {
    if (error instanceof ACIParseError) {
      return { success: false, error };
    }
    return {
      success: false,
      error: new ACIParseError(String(error), aci, 'INVALID_FORMAT'),
    };
  }
}

// ============================================================================
// Generation Functions
// ============================================================================

/**
 * Options for generating an ACI string.
 */
export interface GenerateACIOptions {
  /** Certifying registry (e.g., 'a3i') */
  registry: string;
  /** Operating organization */
  organization: string;
  /** Agent classification */
  agentClass: string;
  /** Capability domains */
  domains: readonly DomainCode[];
  /** Autonomy level */
  level: CapabilityLevel;
  /** Trust/certification tier */
  certificationTier: CertificationTier;
  /** Semantic version */
  version: string;
}

/**
 * Generates an ACI string from components.
 *
 * @param options - ACI components
 * @returns Generated ACI string
 *
 * @example
 * ```typescript
 * const aci = generateACI({
 *   registry: 'a3i',
 *   organization: 'acme-corp',
 *   agentClass: 'invoice-bot',
 *   domains: ['A', 'B', 'F'],
 *   level: CapabilityLevel.L3_EXECUTE,
 *   certificationTier: CertificationTier.T2_TESTED,
 *   version: '1.0.0',
 * });
 * // 'a3i.acme-corp.invoice-bot:ABF-L3-T2@1.0.0'
 * ```
 */
export function generateACI(options: GenerateACIOptions): string {
  const {
    registry,
    organization,
    agentClass,
    domains,
    level,
    certificationTier,
    version,
  } = options;

  // Validate components
  if (!/^[a-z0-9]+$/.test(registry)) {
    throw new Error(`Invalid registry: ${registry}. Must be lowercase alphanumeric.`);
  }

  if (!/^[a-z0-9-]+$/.test(organization)) {
    throw new Error(`Invalid organization: ${organization}. Must be lowercase alphanumeric with hyphens.`);
  }

  if (!/^[a-z0-9-]+$/.test(agentClass)) {
    throw new Error(`Invalid agent class: ${agentClass}. Must be lowercase alphanumeric with hyphens.`);
  }

  if (domains.length === 0) {
    throw new Error('At least one domain is required.');
  }

  const invalidDomains = domains.filter((d) => !isDomainCode(d));
  if (invalidDomains.length > 0) {
    throw new Error(`Invalid domain codes: ${invalidDomains.join(', ')}`);
  }

  if (!isCapabilityLevel(level)) {
    throw new Error(`Invalid level: ${level}. Must be 0-5.`);
  }

  if (!isCertificationTier(certificationTier)) {
    throw new Error(`Invalid certification tier: ${certificationTier}. Must be 0-5.`);
  }

  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`Invalid version: ${version}. Must be semantic version (e.g., 1.0.0).`);
  }

  // Format domains (sorted, deduplicated)
  const domainsStr = formatDomainString(domains);

  return `${registry}.${organization}.${agentClass}:${domainsStr}-L${level}-T${certificationTier}@${version}`;
}

/**
 * Generates an ACI string from individual parameters.
 *
 * @param registry - Certifying registry
 * @param organization - Operating organization
 * @param agentClass - Agent classification
 * @param domains - Capability domains
 * @param level - Autonomy level
 * @param certificationTier - Trust tier
 * @param version - Semantic version
 * @returns Generated ACI string
 */
export function generateACIString(
  registry: string,
  organization: string,
  agentClass: string,
  domains: readonly DomainCode[],
  level: CapabilityLevel,
  certificationTier: CertificationTier,
  version: string
): string {
  return generateACI({
    registry,
    organization,
    agentClass,
    domains,
    level,
    certificationTier,
    version,
  });
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validation error for ACI strings.
 */
export interface ACIValidationError {
  /** Error code */
  code: string;
  /** Human-readable message */
  message: string;
  /** Path to the error (if applicable) */
  path?: string;
}

/**
 * Validation warning for ACI strings.
 */
export interface ACIValidationWarning {
  /** Warning code */
  code: string;
  /** Human-readable message */
  message: string;
  /** Path to the warning (if applicable) */
  path?: string;
}

/**
 * Result of ACI validation.
 */
export interface ACIValidationResult {
  /** Whether the ACI is valid */
  valid: boolean;
  /** Validation errors */
  errors: ACIValidationError[];
  /** Validation warnings */
  warnings: ACIValidationWarning[];
  /** Parsed ACI if valid */
  parsed?: ParsedACI;
}

/**
 * Validates an ACI string.
 *
 * @param aci - The ACI string to validate
 * @returns Validation result
 *
 * @example
 * ```typescript
 * const result = validateACI('a3i.acme-corp.bot:A-L5-T1@1.0.0');
 * // {
 * //   valid: true,
 * //   errors: [],
 * //   warnings: [{ code: 'L5_LOW_TRUST', message: '...' }],
 * //   parsed: { ... }
 * // }
 * ```
 */
export function validateACI(aci: string): ACIValidationResult {
  const errors: ACIValidationError[] = [];
  const warnings: ACIValidationWarning[] = [];

  try {
    const parsed = parseACI(aci);

    // Check for common issues

    // L5 agents should typically have high trust
    if (
      parsed.level === CapabilityLevel.L5_SOVEREIGN &&
      parsed.certificationTier < CertificationTier.T4_VERIFIED
    ) {
      warnings.push({
        code: 'L5_LOW_TRUST',
        message: 'L5 (Sovereign) agents typically require T4+ certification tier',
      });
    }

    // L4 agents should have at least T3 trust
    if (
      parsed.level === CapabilityLevel.L4_AUTONOMOUS &&
      parsed.certificationTier < CertificationTier.T3_CERTIFIED
    ) {
      warnings.push({
        code: 'L4_LOW_TRUST',
        message: 'L4 (Autonomous) agents typically require T3+ certification tier',
      });
    }

    // Security domain with low trust
    if (
      parsed.domains.includes('S') &&
      parsed.certificationTier < CertificationTier.T2_TESTED
    ) {
      warnings.push({
        code: 'SECURITY_LOW_TRUST',
        message: 'Security domain agents should have at least T2 certification',
      });
    }

    // Finance domain with low trust
    if (
      parsed.domains.includes('F') &&
      parsed.certificationTier < CertificationTier.T2_TESTED
    ) {
      warnings.push({
        code: 'FINANCE_LOW_TRUST',
        message: 'Finance domain agents should have at least T2 certification',
      });
    }

    return {
      valid: true,
      errors,
      warnings,
      parsed,
    };
  } catch (e) {
    if (e instanceof ACIParseError) {
      errors.push({ code: e.code, message: e.message });
    } else {
      errors.push({ code: 'UNKNOWN_ERROR', message: String(e) });
    }

    return { valid: false, errors, warnings };
  }
}

/**
 * Checks if a string is a valid ACI format.
 *
 * @param aci - String to check
 * @returns True if the string is a valid ACI
 */
export function isValidACI(aci: string): boolean {
  return ACI_REGEX.test(aci) && validateACI(aci).valid;
}

/**
 * Type guard to check if a value is a valid ACI string.
 *
 * @param value - Value to check
 * @returns True if value is a valid ACI string
 */
export function isACIString(value: unknown): value is string {
  return typeof value === 'string' && isValidACI(value);
}

// ============================================================================
// ACI Manipulation
// ============================================================================

/**
 * Updates specific fields in an ACI and returns a new ACI string.
 *
 * @param aci - Original ACI string
 * @param updates - Fields to update
 * @returns New ACI string with updates applied
 */
export function updateACI(
  aci: string,
  updates: Partial<Omit<GenerateACIOptions, 'registry' | 'organization' | 'agentClass'>>
): string {
  const parsed = parseACI(aci);

  return generateACI({
    registry: parsed.registry,
    organization: parsed.organization,
    agentClass: parsed.agentClass,
    domains: updates.domains ?? parsed.domains,
    level: updates.level ?? parsed.level,
    certificationTier: updates.certificationTier ?? parsed.certificationTier,
    version: updates.version ?? parsed.version,
  });
}

/**
 * Increments the version in an ACI string.
 *
 * @param aci - Original ACI string
 * @param type - Version component to increment ('major' | 'minor' | 'patch')
 * @returns New ACI string with incremented version
 */
export function incrementACIVersion(
  aci: string,
  type: 'major' | 'minor' | 'patch' = 'patch'
): string {
  const parsed = parseACI(aci);
  const [major, minor, patch] = parsed.version.split('.').map(Number);

  let newVersion: string;
  switch (type) {
    case 'major':
      newVersion = `${major! + 1}.0.0`;
      break;
    case 'minor':
      newVersion = `${major}.${minor! + 1}.0`;
      break;
    case 'patch':
    default:
      newVersion = `${major}.${minor}.${patch! + 1}`;
      break;
  }

  return updateACI(aci, { version: newVersion });
}

// ============================================================================
// Zod Schemas
// ============================================================================

/**
 * Zod schema for ACI string validation.
 */
export const aciStringSchema = z
  .string()
  .refine((val) => ACI_REGEX.test(val), {
    message: 'Invalid ACI format. Expected: registry.org.class:DOMAINS-Ln-Tn@x.y.z',
  });

/**
 * Zod schema for ACI string with parsing transform.
 */
export const aciSchema = aciStringSchema.transform((aci) => parseACI(aci));

/**
 * Zod schema for GenerateACIOptions.
 */
export const generateACIOptionsSchema = z.object({
  registry: z.string().min(1).regex(/^[a-z0-9]+$/),
  organization: z.string().min(1).regex(/^[a-z0-9-]+$/),
  agentClass: z.string().min(1).regex(/^[a-z0-9-]+$/),
  domains: z.array(z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'S'])).min(1),
  level: z.nativeEnum(CapabilityLevel),
  certificationTier: z.nativeEnum(CertificationTier),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
});

/**
 * Zod schema for ACIValidationError.
 */
export const aciValidationErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  path: z.string().optional(),
});

/**
 * Zod schema for ACIValidationWarning.
 */
export const aciValidationWarningSchema = z.object({
  code: z.string(),
  message: z.string(),
  path: z.string().optional(),
});

/**
 * Zod schema for ACIValidationResult.
 */
export const aciValidationResultSchema = z.object({
  valid: z.boolean(),
  errors: z.array(aciValidationErrorSchema),
  warnings: z.array(aciValidationWarningSchema),
  parsed: parsedACISchema.optional(),
});
