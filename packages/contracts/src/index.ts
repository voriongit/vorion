/**
 * @orion/contracts
 *
 * Shared schemas, types, and validators for the ORION Platform.
 *
 * @packageDocumentation
 */

// Re-export all v2 contracts
export * from './v2/index.js';

// Re-export validators
// export * from './validators/index.js';
export * from './canonical/agent.js';

// Re-export canonical validation utilities as namespace to avoid naming conflicts
export * as Canonical from './canonical/index.js';
