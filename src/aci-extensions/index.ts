/**
 * ACI Extension Protocol Implementation
 *
 * Enables Layer 4 (Runtime Assurance) functionality through a pluggable
 * extension system. This module provides the core infrastructure for:
 *
 * - Extension registration and lifecycle management
 * - Hook execution with timeout enforcement
 * - Result aggregation across multiple extensions
 * - ACI string extension parsing
 *
 * @packageDocumentation
 * @module @vorion/aci-extensions
 * @license Apache-2.0
 *
 * @example
 * ```typescript
 * import {
 *   createExtensionService,
 *   cognigateExtension,
 *   monitoringExtension,
 *   auditExtension,
 * } from './aci-extensions';
 *
 * // Create and configure the service
 * const service = createExtensionService({
 *   failFast: true,
 *   logExecution: true,
 * });
 *
 * // Register built-in extensions
 * await service.registerExtension(cognigateExtension);
 * await service.registerExtension(monitoringExtension);
 * await service.registerExtension(auditExtension);
 *
 * // Process a capability request
 * const agent = {
 *   did: 'did:web:agents.vorion.org:banquet-advisor',
 *   aci: 'a3i.vorion.banquet-advisor:FHC-L3@1.2.0#gov,audit',
 *   publisher: 'vorion',
 *   name: 'Banquet Advisor',
 *   trustTier: 2,
 *   trustScore: 650,
 *   domains: 7,
 *   level: 3,
 *   version: '1.2.0',
 * };
 *
 * const result = await service.processCapabilityRequest(agent, {
 *   domains: ['food', 'hospitality', 'catering'],
 *   level: 3,
 *   context: {
 *     source: 'api',
 *     purpose: 'menu-planning',
 *   },
 * });
 *
 * if (result.granted) {
 *   console.log('Capability granted:', result.grant);
 * } else {
 *   console.log('Denied by:', result.deniedBy, '-', result.denialReason);
 * }
 * ```
 */

// =============================================================================
// TYPES
// =============================================================================

export type {
  // Core types
  TrustTier,
  AgentIdentity,
  Attestation,

  // Capability types
  RequestContext,
  Constraint,
  CapabilityRequest,
  CapabilityGrant,

  // Action types
  ActionTarget,
  ActionRequest,
  SideEffect,
  ActionResult,
  ActionRecord,

  // Hook result types
  PreCheckResult,
  ActionModification,
  ApprovalRequirement,
  PreActionResult,
  ExpiryDecision,
  FailureResponse,

  // Monitoring types
  BehaviorMetrics,
  BehaviorVerificationResult,
  MetricsReport,
  AnomalyReport,
  AnomalyResponse,

  // Trust types
  RevocationEvent,
  TrustAdjustment,
  TrustAdjustmentResult,
  AttestationVerificationResult,

  // Policy types
  EnvironmentContext,
  PolicyContext,
  PolicyEvidence,
  PolicyObligation,
  PolicyDecision,
  PolicySource,

  // Extension interface
  LifecycleHooks,
  CapabilityHooks,
  ActionHooks,
  MonitoringHooks,
  TrustHooks,
  PolicyEngine,
  ACIExtension,

  // Aggregated result types
  AggregatedPreCheckResult,
  AggregatedPreActionResult,
  AggregatedFailureResponse,
  AggregatedBehaviorResult,
  AggregatedMetricsReport,
  AggregatedAnomalyResponse,
  AggregatedTrustResult,
  AggregatedPolicyDecision,

  // Registry types
  ExtensionInfo,
  ValidationResult,

  // Service types
  ExtensionServiceConfig,
  HookTimeout,
} from './types.js';

// =============================================================================
// ZOD SCHEMAS
// =============================================================================

export {
  // Core schemas
  TrustTierSchema,
  AgentIdentitySchema,
  AttestationSchema,

  // Capability schemas
  RequestContextSchema,
  ConstraintSchema,
  CapabilityRequestSchema,
  CapabilityGrantSchema,

  // Action schemas
  ActionTargetSchema,
  ActionRequestSchema,
  SideEffectSchema,
  ActionResultSchema,
  ActionRecordSchema,

  // Hook result schemas
  PreCheckResultSchema,
  ActionModificationSchema,
  ApprovalRequirementSchema,
  PreActionResultSchema,
  ExpiryDecisionSchema,
  FailureResponseSchema,

  // Monitoring schemas
  BehaviorMetricsSchema,
  BehaviorVerificationResultSchema,
  MetricsReportSchema,
  AnomalyReportSchema,
  AnomalyResponseSchema,

  // Trust schemas
  RevocationEventSchema,
  TrustAdjustmentSchema,
  TrustAdjustmentResultSchema,
  AttestationVerificationResultSchema,

  // Policy schemas
  EnvironmentContextSchema,
  PolicyContextSchema,
  PolicyEvidenceSchema,
  PolicyObligationSchema,
  PolicyDecisionSchema,
  PolicySourceSchema,

  // Extension metadata schema
  ACIExtensionMetadataSchema,

  // Registry/service schemas
  ValidationResultSchema,
  ExtensionServiceConfigSchema,

  // Constants
  HOOK_TIMEOUTS,
} from './types.js';

// =============================================================================
// REGISTRY
// =============================================================================

export { ExtensionRegistry, createExtensionRegistry } from './registry.js';

// =============================================================================
// EXECUTOR
// =============================================================================

export { ExtensionExecutor, createExtensionExecutor } from './executor.js';

// =============================================================================
// ACI STRING UTILITIES
// =============================================================================

export {
  // Parsing
  parseExtensions,
  type ParsedExtensions,
  ParsedExtensionsSchema,

  // Manipulation
  addExtension,
  addExtensions,
  removeExtension,
  removeExtensions,
  replaceExtensions,
  sortExtensions,

  // Querying
  hasExtension,
  hasAllExtensions,
  hasAnyExtension,
  getExtensionCount,
  haveEqualExtensions,
  getCoreACI,

  // Building
  buildACI,
  buildExtensionId,

  // Validation
  isValidExtensionId,
  isValidShortcode,
  isValidACIWithExtensions,

  // Extension ID parsing
  parseExtensionId,
} from './aci-string-extensions.js';

// =============================================================================
// SERVICE
// =============================================================================

export {
  ACIExtensionService,
  createExtensionService,
  createExtensionServiceWithRegistry,
  type CapabilityRequestResult,
  type ActionProcessingResult,
} from './service.js';

// =============================================================================
// BUILT-IN EXTENSIONS
// =============================================================================

// Cognigate Governance Extension
export {
  cognigateExtension,
  createGovernanceExtension,
} from './builtin-extensions/governance.js';

// Behavioral Monitoring Extension
export {
  monitoringExtension,
  createMonitoringExtension,
} from './builtin-extensions/monitoring.js';

// Audit Trail Extension
export {
  auditExtension,
  createAuditExtension,
  queryAuditEvents,
  verifyAuditChain,
  type AuditEventType,
} from './builtin-extensions/audit.js';

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Create a fully configured extension service with all built-in extensions
 *
 * This is the quickest way to get started with the ACI Extension Protocol.
 * It creates a service with the governance, monitoring, and audit extensions
 * pre-registered.
 *
 * @param config - Optional service configuration
 * @returns Configured extension service with built-in extensions
 *
 * @example
 * ```typescript
 * const service = await createFullExtensionService();
 *
 * // Service is ready to use with gov, mon, and audit extensions
 * const result = await service.processCapabilityRequest(agent, request);
 * ```
 */
export async function createFullExtensionService(
  config?: import('./types.js').ExtensionServiceConfig
): Promise<import('./service.js').ACIExtensionService> {
  const { createExtensionService: createService } = await import('./service.js');
  const { cognigateExtension: gov } = await import('./builtin-extensions/governance.js');
  const { monitoringExtension: mon } = await import('./builtin-extensions/monitoring.js');
  const { auditExtension: audit } = await import('./builtin-extensions/audit.js');

  const service = createService(config);

  await service.registerExtension(gov);
  await service.registerExtension(mon);
  await service.registerExtension(audit);

  return service;
}
