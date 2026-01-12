/**
 * @orion/a3i - Agent Anchor AI Trust Engine
 *
 * The A3I package provides trust scoring, banding, and authorization
 * for AI agents within the ORION platform.
 *
 * @packageDocumentation
 */

// Trust module
export * from './trust/index.js';

// Banding module
export * from './banding/index.js';

// Observation module
export * from './observation/index.js';

// Authorization module
export * from './authorization/index.js';

// API module
export * from './api/index.js';

// Hooks module
export * from './hooks/index.js';

// Execution module
export * from './execution/index.js';

// Orchestrator module
export * from './orchestrator/index.js';

// Canary Probe module (ATSF v2.0)
export * from './canary/index.js';

// Pre-Action Gate module (ATSF v2.0)
export * from './gate/index.js';

// Version
export const VERSION = '0.1.0';
