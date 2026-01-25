/**
 * Vorion - Governed AI Execution Platform
 *
 * @packageDocumentation
 */

export * from './common/types.js';
export * from './basis/index.js';

// Intent module - explicitly exclude scoreToTier and tierToMinScore to avoid conflict with trust-engine
export {
  PAYLOAD_LIMITS,
  intentPayloadSchema,
  intentSubmissionSchema,
  bulkIntentOptionsSchema,
  bulkIntentSubmissionSchema,
  IntentService,
  createIntentService,
  ConsentService,
  ConsentRequiredError,
  ConsentPolicyNotFoundError,
  createConsentService,
  intentOpenApiSpec,
  getOpenApiSpec,
  getOpenApiSpecJson,
  registerIntentRoutes,
  isServerShuttingDown,
  getActiveRequestCount,
  trackRequest,
  gracefulShutdown,
  registerShutdownHandlers,
  shutdownRequestHook,
  shutdownResponseHook,
  resetShutdownState,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  IntentClassifier,
  createIntentClassifier,
  RiskAssessor,
  createRiskAssessor,
  ACTION_PATTERNS,
  RESOURCE_SENSITIVITY,
  matchActionPattern,
  matchResourceSensitivity,
  getResourceSensitivityLevel,
  getResourceRiskTier,
  inferCategoryFromAction,
  requiresApproval,
  // Renamed exports to avoid conflict with trust-engine
  scoreToTier as riskScoreToTier,
  tierToMinScore as riskTierToMinScore,
} from './intent/index.js';

export type {
  IntentSubmission,
  BulkIntentOptions,
  BulkIntentSubmission,
  BulkIntentFailure,
  BulkIntentResult,
  SubmitOptions,
  ListOptions,
  CancelOptions,
  IntentWithEvents,
  ConsentType,
  ConsentMetadata,
  UserConsent,
  ConsentPolicy,
  ConsentHistoryEntry,
  ConsentValidationResult,
  GracefulShutdownOptions,
  PaginatedResult,
  Classification,
  IntentClassifierConfig,
  CreateIntent,
  RiskAssessment,
  HistoricalPattern,
  RiskAssessorConfig,
  RiskFactor,
  RequiredApprovals,
  ApprovalType,
  IntentCategory,
  RiskTier,
  ActionPattern,
  ResourceSensitivity,
} from './intent/index.js';

export * from './enforce/index.js';
export * from './cognigate/index.js';
export * from './proof/index.js';
export * from './trust-engine/index.js';

// Version
export const VERSION = '0.1.0';

// Main entry point for server
export { createServer } from './api/server.js';
