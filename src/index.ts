/**
 * Vorion - Governed AI Execution Platform
 *
 * @packageDocumentation
 */

export * from './common/types.js';
export * from './basis/index.js';
export * from './intent/index.js';
export * from './enforce/index.js';
export * from './cognigate/index.js';
export * from './proof/index.js';
export * from './trust-engine/index.js';

// Version
export const VERSION = '0.1.0';

// Main entry point for server
export { createServer } from './api/server.js';
