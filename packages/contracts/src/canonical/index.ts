/**
 * Canonical Module
 *
 * Single source of truth for all canonical type definitions in the Vorion Platform.
 * Import types from this module to ensure consistency across packages.
 *
 * @packageDocumentation
 */

// Core types
export * from './trust-band.js';
export * from './trust-score.js';
export * from './risk-level.js';
export * from './intent.js';
export * from './trust-signal.js';

// Runtime validation
export * from './validation.js';
