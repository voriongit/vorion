/**
 * @agentanchor/aci-spec
 * 
 * Agent Classification Identifier (ACI) - The certification standard for AI agents
 * 
 * @packageDocumentation
 * @module @agentanchor/aci-spec
 * @license Apache-2.0
 */

// Re-export all types and utilities
export * from './types';

// Version info
export const ACI_SPEC_VERSION = '1.0.0';

// Quick validation helper
export { validateACI as validate } from './types';

// Default export for convenience
import { parseACI, validateACI, satisfiesRequirements } from './types';

export default {
  parse: parseACI,
  validate: validateACI,
  satisfies: satisfiesRequirements,
  version: ACI_SPEC_VERSION,
};
