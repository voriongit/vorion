/**
 * BASIS Policy Parser
 *
 * Parses Policy Bundles from JSON and YAML formats.
 */

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { validatePolicy } from './validator.js';
import type { PolicyBundle } from './types.js';

/**
 * Parse result
 */
export interface ParseResult {
  success: boolean;
  policy?: PolicyBundle;
  errors: string[];
  format: 'json' | 'yaml' | 'unknown';
}

/**
 * Detect content format
 */
function detectFormat(content: string): 'json' | 'yaml' | 'unknown' {
  const trimmed = content.trim();

  // JSON starts with { or [
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return 'json';
  }

  // YAML indicators
  if (
    trimmed.startsWith('---') ||
    trimmed.includes('basis_version:') ||
    trimmed.includes('policy_id:')
  ) {
    return 'yaml';
  }

  return 'unknown';
}

/**
 * Parse a Policy Bundle from a string (JSON or YAML)
 *
 * @param content - The policy content as a string
 * @param format - Optional format hint ('json' | 'yaml')
 * @returns Parse result with policy or errors
 *
 * @example
 * ```typescript
 * import { parsePolicy } from '@vorion/basis-core';
 * import { readFileSync } from 'fs';
 *
 * const content = readFileSync('policy.yaml', 'utf-8');
 * const result = parsePolicy(content);
 *
 * if (result.success) {
 *   console.log('Parsed policy:', result.policy.policy_id);
 * }
 * ```
 */
export function parsePolicy(
  content: string,
  format?: 'json' | 'yaml'
): ParseResult {
  const detectedFormat = format ?? detectFormat(content);

  // Parse based on format
  let parsed: unknown;

  if (detectedFormat === 'json') {
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'JSON parse error';
      return {
        success: false,
        errors: [`JSON parse error: ${message}`],
        format: 'json',
      };
    }
  } else if (detectedFormat === 'yaml') {
    try {
      parsed = parseYaml(content);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'YAML parse error';
      return {
        success: false,
        errors: [`YAML parse error: ${message}`],
        format: 'yaml',
      };
    }
  } else {
    return {
      success: false,
      errors: ['Unable to detect format. Please specify json or yaml.'],
      format: 'unknown',
    };
  }

  // Validate against schema
  const validation = validatePolicy(parsed);

  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors.map(
        (e) => `${e.path}: ${e.message}`
      ),
      format: detectedFormat,
    };
  }

  return {
    success: true,
    policy: validation.policy,
    errors: [],
    format: detectedFormat,
  };
}

/**
 * Parse a Policy Bundle from a file path
 *
 * @param filePath - Path to the policy file
 * @returns Parse result
 */
export async function parsePolicyFile(filePath: string): Promise<ParseResult> {
  const { readFile } = await import('fs/promises');

  try {
    const content = await readFile(filePath, 'utf-8');

    // Detect format from extension
    let format: 'json' | 'yaml' | undefined;
    if (filePath.endsWith('.json')) {
      format = 'json';
    } else if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
      format = 'yaml';
    }

    return parsePolicy(content, format);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'File read error';
    return {
      success: false,
      errors: [`File error: ${message}`],
      format: 'unknown',
    };
  }
}

/**
 * Serialize a Policy Bundle to JSON
 */
export function toJson(policy: PolicyBundle, pretty = true): string {
  return JSON.stringify(policy, null, pretty ? 2 : 0);
}

/**
 * Serialize a Policy Bundle to YAML
 */
export function toYaml(policy: PolicyBundle): string {
  return stringifyYaml(policy);
}
