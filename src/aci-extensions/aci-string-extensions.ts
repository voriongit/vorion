/**
 * ACI String Extension Utilities
 *
 * Provides parsing and manipulation functions for ACI strings with
 * extension suffixes. Extensions are declared in ACI strings using
 * the # suffix format.
 *
 * @packageDocumentation
 * @module @vorion/aci-extensions/aci-string-extensions
 * @license Apache-2.0
 *
 * @example
 * ```
 * // ACI string formats:
 * // Without extensions:
 * //   a3i.vorion.banquet-advisor:FHC-L3-T2@1.2.0
 * //
 * // With single extension:
 * //   a3i.vorion.banquet-advisor:FHC-L3-T2@1.2.0#gov
 * //
 * // With multiple extensions:
 * //   a3i.vorion.banquet-advisor:FHC-L3-T2@1.2.0#gov,audit,hipaa
 * ```
 */

import { z } from 'zod';

/**
 * Result of parsing extensions from an ACI string
 */
export interface ParsedExtensions {
  /** The core ACI string (without extension suffix) */
  core: string;
  /** Array of extension shortcodes */
  extensions: string[];
}

/**
 * Zod schema for ParsedExtensions validation
 */
export const ParsedExtensionsSchema = z.object({
  core: z.string().min(1),
  extensions: z.array(z.string()),
});

/**
 * Regular expression for validating extension ID format
 * Format: aci-ext-{name}-v{major}
 * Example: aci-ext-governance-v1
 */
const EXTENSION_ID_REGEX = /^aci-ext-[a-z]+-v\d+$/;

/**
 * Regular expression for validating shortcode format
 * Format: 1-10 lowercase letters
 * Example: gov, audit, hipaa
 */
const SHORTCODE_REGEX = /^[a-z]{1,10}$/;

/**
 * Regular expression for validating ACI string with optional extensions
 * Matches: namespace.publisher.name:DOMAINS-L{level}-T{tier}@version[#extensions]
 */
const ACI_WITH_EXTENSIONS_REGEX =
  /^[a-z0-9]+\.[a-z0-9-]+\.[a-z0-9-]+:[A-Z]+-L[0-5]-T[0-5]@\d+\.\d+\.\d+(#[a-z]+(,[a-z]+)*)?$/;

/**
 * Parse extension suffix from an ACI string
 *
 * Extracts the core ACI string and any extension shortcodes from
 * an ACI string that may include an extension suffix.
 *
 * @param aci - The ACI string to parse (with or without extensions)
 * @returns Object containing core ACI string and array of extensions
 *
 * @example
 * ```typescript
 * // Without extensions
 * parseExtensions('a3i.vorion.agent:FHC-L3-T2@1.0.0');
 * // { core: 'a3i.vorion.agent:FHC-L3-T2@1.0.0', extensions: [] }
 *
 * // With single extension
 * parseExtensions('a3i.vorion.agent:FHC-L3-T2@1.0.0#gov');
 * // { core: 'a3i.vorion.agent:FHC-L3-T2@1.0.0', extensions: ['gov'] }
 *
 * // With multiple extensions
 * parseExtensions('a3i.vorion.agent:FHC-L3-T2@1.0.0#gov,audit,hipaa');
 * // { core: 'a3i.vorion.agent:FHC-L3-T2@1.0.0', extensions: ['gov', 'audit', 'hipaa'] }
 * ```
 */
export function parseExtensions(aci: string): ParsedExtensions {
  const hashIndex = aci.indexOf('#');

  if (hashIndex === -1) {
    return { core: aci, extensions: [] };
  }

  const core = aci.slice(0, hashIndex);
  const extSuffix = aci.slice(hashIndex + 1);

  // Split by comma and trim whitespace
  const extensions = extSuffix
    .split(',')
    .map((e) => e.trim())
    .filter((e) => e.length > 0);

  return { core, extensions };
}

/**
 * Add an extension shortcode to an ACI string
 *
 * If the extension is already present, the string is returned unchanged.
 * Extensions are appended to the end of the extension list.
 *
 * @param aci - The ACI string (with or without existing extensions)
 * @param extension - The extension shortcode to add
 * @returns The ACI string with the extension added
 *
 * @example
 * ```typescript
 * // Add to string without extensions
 * addExtension('a3i.vorion.agent:FHC-L3-T2@1.0.0', 'gov');
 * // 'a3i.vorion.agent:FHC-L3-T2@1.0.0#gov'
 *
 * // Add to string with existing extensions
 * addExtension('a3i.vorion.agent:FHC-L3-T2@1.0.0#gov', 'audit');
 * // 'a3i.vorion.agent:FHC-L3-T2@1.0.0#gov,audit'
 *
 * // Extension already present
 * addExtension('a3i.vorion.agent:FHC-L3-T2@1.0.0#gov', 'gov');
 * // 'a3i.vorion.agent:FHC-L3-T2@1.0.0#gov'
 * ```
 */
export function addExtension(aci: string, extension: string): string {
  const { core, extensions } = parseExtensions(aci);

  // Don't add if already present
  if (extensions.includes(extension)) {
    return aci;
  }

  extensions.push(extension);
  return `${core}#${extensions.join(',')}`;
}

/**
 * Add multiple extensions to an ACI string
 *
 * Adds all specified extensions that are not already present.
 * Extensions are appended in the order provided.
 *
 * @param aci - The ACI string (with or without existing extensions)
 * @param extensionsToAdd - Array of extension shortcodes to add
 * @returns The ACI string with all extensions added
 *
 * @example
 * ```typescript
 * addExtensions('a3i.vorion.agent:FHC-L3-T2@1.0.0', ['gov', 'audit']);
 * // 'a3i.vorion.agent:FHC-L3-T2@1.0.0#gov,audit'
 * ```
 */
export function addExtensions(aci: string, extensionsToAdd: string[]): string {
  let result = aci;
  for (const ext of extensionsToAdd) {
    result = addExtension(result, ext);
  }
  return result;
}

/**
 * Remove an extension shortcode from an ACI string
 *
 * If the extension is not present, the string is returned unchanged.
 * If removing the last extension, the # suffix is also removed.
 *
 * @param aci - The ACI string with extensions
 * @param extension - The extension shortcode to remove
 * @returns The ACI string with the extension removed
 *
 * @example
 * ```typescript
 * // Remove from multiple extensions
 * removeExtension('a3i.vorion.agent:FHC-L3-T2@1.0.0#gov,audit', 'gov');
 * // 'a3i.vorion.agent:FHC-L3-T2@1.0.0#audit'
 *
 * // Remove last extension
 * removeExtension('a3i.vorion.agent:FHC-L3-T2@1.0.0#gov', 'gov');
 * // 'a3i.vorion.agent:FHC-L3-T2@1.0.0'
 *
 * // Extension not present
 * removeExtension('a3i.vorion.agent:FHC-L3-T2@1.0.0#gov', 'audit');
 * // 'a3i.vorion.agent:FHC-L3-T2@1.0.0#gov'
 * ```
 */
export function removeExtension(aci: string, extension: string): string {
  const { core, extensions } = parseExtensions(aci);
  const filtered = extensions.filter((e) => e !== extension);

  if (filtered.length === 0) {
    return core;
  }

  return `${core}#${filtered.join(',')}`;
}

/**
 * Remove multiple extensions from an ACI string
 *
 * @param aci - The ACI string with extensions
 * @param extensionsToRemove - Array of extension shortcodes to remove
 * @returns The ACI string with all specified extensions removed
 */
export function removeExtensions(aci: string, extensionsToRemove: string[]): string {
  const { core, extensions } = parseExtensions(aci);
  const filtered = extensions.filter((e) => !extensionsToRemove.includes(e));

  if (filtered.length === 0) {
    return core;
  }

  return `${core}#${filtered.join(',')}`;
}

/**
 * Check if an ACI string has a specific extension
 *
 * @param aci - The ACI string to check
 * @param extension - The extension shortcode to look for
 * @returns True if the extension is present, false otherwise
 *
 * @example
 * ```typescript
 * hasExtension('a3i.vorion.agent:FHC-L3-T2@1.0.0#gov,audit', 'gov');
 * // true
 *
 * hasExtension('a3i.vorion.agent:FHC-L3-T2@1.0.0#gov', 'audit');
 * // false
 *
 * hasExtension('a3i.vorion.agent:FHC-L3-T2@1.0.0', 'gov');
 * // false
 * ```
 */
export function hasExtension(aci: string, extension: string): boolean {
  const { extensions } = parseExtensions(aci);
  return extensions.includes(extension);
}

/**
 * Check if an ACI string has all specified extensions
 *
 * @param aci - The ACI string to check
 * @param requiredExtensions - Array of extension shortcodes required
 * @returns True if all extensions are present, false otherwise
 */
export function hasAllExtensions(aci: string, requiredExtensions: string[]): boolean {
  const { extensions } = parseExtensions(aci);
  return requiredExtensions.every((ext) => extensions.includes(ext));
}

/**
 * Check if an ACI string has any of the specified extensions
 *
 * @param aci - The ACI string to check
 * @param extensionsToCheck - Array of extension shortcodes to check
 * @returns True if any extension is present, false otherwise
 */
export function hasAnyExtension(aci: string, extensionsToCheck: string[]): boolean {
  const { extensions } = parseExtensions(aci);
  return extensionsToCheck.some((ext) => extensions.includes(ext));
}

/**
 * Validate extension ID format
 *
 * Extension IDs must follow the format: aci-ext-{name}-v{major}
 * Where {name} is lowercase letters and {major} is a positive integer.
 *
 * @param id - The extension ID to validate
 * @returns True if the ID is valid, false otherwise
 *
 * @example
 * ```typescript
 * isValidExtensionId('aci-ext-governance-v1');  // true
 * isValidExtensionId('aci-ext-healthcare-v2'); // true
 * isValidExtensionId('aci-ext-CAPS-v1');       // false (uppercase)
 * isValidExtensionId('my-extension');          // false (wrong format)
 * isValidExtensionId('aci-ext-foo');           // false (missing version)
 * ```
 */
export function isValidExtensionId(id: string): boolean {
  return EXTENSION_ID_REGEX.test(id);
}

/**
 * Validate extension shortcode format
 *
 * Shortcodes must be 1-10 lowercase letters only.
 *
 * @param shortcode - The shortcode to validate
 * @returns True if the shortcode is valid, false otherwise
 *
 * @example
 * ```typescript
 * isValidShortcode('gov');     // true
 * isValidShortcode('hipaa');   // true
 * isValidShortcode('audit');   // true
 * isValidShortcode('GOV');     // false (uppercase)
 * isValidShortcode('gov1');    // false (contains number)
 * isValidShortcode('');        // false (empty)
 * isValidShortcode('verylongcode'); // false (too long)
 * ```
 */
export function isValidShortcode(shortcode: string): boolean {
  return SHORTCODE_REGEX.test(shortcode);
}

/**
 * Validate an ACI string with optional extensions
 *
 * Validates that the ACI string follows the expected format including
 * any extension suffix.
 *
 * @param aci - The ACI string to validate
 * @returns True if the ACI string is valid, false otherwise
 *
 * @example
 * ```typescript
 * isValidACIWithExtensions('a3i.vorion.agent:FHC-L3-T2@1.0.0');           // true
 * isValidACIWithExtensions('a3i.vorion.agent:FHC-L3-T2@1.0.0#gov');       // true
 * isValidACIWithExtensions('a3i.vorion.agent:FHC-L3-T2@1.0.0#gov,audit'); // true
 * isValidACIWithExtensions('invalid-aci-string');                          // false
 * ```
 */
export function isValidACIWithExtensions(aci: string): boolean {
  return ACI_WITH_EXTENSIONS_REGEX.test(aci);
}

/**
 * Get the extension count for an ACI string
 *
 * @param aci - The ACI string to check
 * @returns Number of extensions in the ACI string
 */
export function getExtensionCount(aci: string): number {
  const { extensions } = parseExtensions(aci);
  return extensions.length;
}

/**
 * Replace all extensions in an ACI string
 *
 * Removes any existing extensions and adds the new ones.
 *
 * @param aci - The ACI string (with or without extensions)
 * @param newExtensions - Array of new extension shortcodes
 * @returns ACI string with only the new extensions
 *
 * @example
 * ```typescript
 * replaceExtensions('a3i.vorion.agent:FHC-L3-T2@1.0.0#gov', ['audit', 'hipaa']);
 * // 'a3i.vorion.agent:FHC-L3-T2@1.0.0#audit,hipaa'
 *
 * replaceExtensions('a3i.vorion.agent:FHC-L3-T2@1.0.0#gov', []);
 * // 'a3i.vorion.agent:FHC-L3-T2@1.0.0'
 * ```
 */
export function replaceExtensions(aci: string, newExtensions: string[]): string {
  const { core } = parseExtensions(aci);

  if (newExtensions.length === 0) {
    return core;
  }

  // Remove duplicates while preserving order
  const unique = Array.from(new Set(newExtensions));
  return `${core}#${unique.join(',')}`;
}

/**
 * Sort extensions in an ACI string alphabetically
 *
 * @param aci - The ACI string with extensions
 * @returns ACI string with extensions sorted alphabetically
 */
export function sortExtensions(aci: string): string {
  const { core, extensions } = parseExtensions(aci);

  if (extensions.length === 0) {
    return core;
  }

  const sorted = [...extensions].sort();
  return `${core}#${sorted.join(',')}`;
}

/**
 * Compare two ACI strings for extension equality
 *
 * Checks if two ACI strings have the same extensions (regardless of order).
 *
 * @param aci1 - First ACI string
 * @param aci2 - Second ACI string
 * @returns True if both have the same extensions
 */
export function haveEqualExtensions(aci1: string, aci2: string): boolean {
  const ext1 = parseExtensions(aci1).extensions.sort();
  const ext2 = parseExtensions(aci2).extensions.sort();

  if (ext1.length !== ext2.length) {
    return false;
  }

  return ext1.every((e, i) => e === ext2[i]);
}

/**
 * Extract the core ACI string without extensions
 *
 * @param aci - The ACI string (with or without extensions)
 * @returns The core ACI string
 */
export function getCoreACI(aci: string): string {
  return parseExtensions(aci).core;
}

/**
 * Build an ACI string from core and extensions
 *
 * @param core - The core ACI string
 * @param extensions - Array of extension shortcodes
 * @returns Complete ACI string with extensions
 */
export function buildACI(core: string, extensions: string[]): string {
  if (extensions.length === 0) {
    return core;
  }

  // Remove duplicates while preserving order
  const unique = Array.from(new Set(extensions));
  return `${core}#${unique.join(',')}`;
}

/**
 * Parse extension ID to extract name and version
 *
 * @param extensionId - The extension ID (e.g., 'aci-ext-governance-v1')
 * @returns Object with name and version, or null if invalid
 *
 * @example
 * ```typescript
 * parseExtensionId('aci-ext-governance-v1');
 * // { name: 'governance', version: 1 }
 *
 * parseExtensionId('invalid');
 * // null
 * ```
 */
export function parseExtensionId(
  extensionId: string
): { name: string; version: number } | null {
  const match = extensionId.match(/^aci-ext-([a-z]+)-v(\d+)$/);

  if (!match) {
    return null;
  }

  return {
    name: match[1]!,
    version: parseInt(match[2]!, 10),
  };
}

/**
 * Build an extension ID from name and version
 *
 * @param name - Extension name (lowercase letters)
 * @param version - Major version number
 * @returns Extension ID in format aci-ext-{name}-v{version}
 *
 * @example
 * ```typescript
 * buildExtensionId('governance', 1);
 * // 'aci-ext-governance-v1'
 * ```
 */
export function buildExtensionId(name: string, version: number): string {
  return `aci-ext-${name.toLowerCase()}-v${version}`;
}
