/**
 * Bot Trust System - Main Entry Point
 *
 * This module provides a comprehensive bot trust and validation infrastructure
 * with graduated autonomy, trust scoring, and transparent telemetry.
 */

// Export all types
export * from './types';

// Export core modules
export { DecisionTracker, decisionTracker } from './decision-tracker';
export {
  ApprovalRateCalculator,
  approvalRateCalculator,
} from './approval-rate-calculator';
export { TrustScoreEngine, trustScoreEngine } from './trust-score-engine';
export { AutonomyManager, autonomyManager } from './autonomy-manager';
export { AuditLogger, auditLogger, AuditEventType } from './audit-logger';
export {
  TelemetryCollector,
  telemetryCollector,
} from './telemetry-collector';
