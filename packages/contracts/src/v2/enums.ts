/**
 * Core enums for the ORION Platform
 */

/**
 * Trust bands representing autonomy levels (T0-T5)
 */
export enum TrustBand {
  T0_UNTRUSTED = 0,
  T1_SUPERVISED = 1,
  T2_CONSTRAINED = 2,
  T3_TRUSTED = 3,
  T4_AUTONOMOUS = 4,
  T5_MISSION_CRITICAL = 5,
}

/**
 * Observation tiers - determines maximum trust ceiling
 * based on system observability
 *
 * Per ATSF v2.0 RTA findings:
 * - WHITE_BOX reduced from 95% to 90% (sleeper agent risk)
 * - ATTESTED_BOX reduced from 100% to 95% (TEE side-channel risk)
 * - VERIFIED_BOX added requiring multiple verification layers
 */
export enum ObservationTier {
  /** I/O only - API accessed proprietary models (max 60%) */
  BLACK_BOX = 'BLACK_BOX',
  /** I/O + logs - Platform-hosted models (max 75%) */
  GRAY_BOX = 'GRAY_BOX',
  /** Full code access - Open-source models (max 90%, reduced for sleeper risk) */
  WHITE_BOX = 'WHITE_BOX',
  /** TEE verified - Models in secure enclaves (max 95%, reduced for side-channel risk) */
  ATTESTED_BOX = 'ATTESTED_BOX',
  /** Full verification: TEE + zkML + interpretability (max 100%) */
  VERIFIED_BOX = 'VERIFIED_BOX',
}

/**
 * Trust ceiling values for each observation tier (0-1000 scale)
 * Updated per ATSF v2.0 Red Team Assessment findings
 */
export const OBSERVATION_CEILINGS: Record<ObservationTier, number> = {
  [ObservationTier.BLACK_BOX]: 600,
  [ObservationTier.GRAY_BOX]: 750,
  [ObservationTier.WHITE_BOX]: 900,     // Reduced from 950 (sleeper agent risk)
  [ObservationTier.ATTESTED_BOX]: 950,  // Reduced from 1000 (TEE side-channel risk)
  [ObservationTier.VERIFIED_BOX]: 1000, // New: requires full verification stack
};

/**
 * Data sensitivity levels for intent classification
 */
export enum DataSensitivity {
  PUBLIC = 'PUBLIC',
  INTERNAL = 'INTERNAL',
  CONFIDENTIAL = 'CONFIDENTIAL',
  RESTRICTED = 'RESTRICTED',
}

/**
 * Action reversibility classification
 */
export enum Reversibility {
  REVERSIBLE = 'REVERSIBLE',
  PARTIALLY_REVERSIBLE = 'PARTIALLY_REVERSIBLE',
  IRREVERSIBLE = 'IRREVERSIBLE',
}

/**
 * Action types for categorizing intents
 */
export enum ActionType {
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete',
  EXECUTE = 'execute',
  COMMUNICATE = 'communicate',
  TRANSFER = 'transfer',
}

/**
 * Proof event types for the audit trail
 */
export enum ProofEventType {
  INTENT_RECEIVED = 'intent_received',
  DECISION_MADE = 'decision_made',
  TRUST_DELTA = 'trust_delta',
  EXECUTION_STARTED = 'execution_started',
  EXECUTION_COMPLETED = 'execution_completed',
  EXECUTION_FAILED = 'execution_failed',
  INCIDENT_DETECTED = 'incident_detected',
  ROLLBACK_INITIATED = 'rollback_initiated',
  COMPONENT_REGISTERED = 'component_registered',
  COMPONENT_UPDATED = 'component_updated',
}

/**
 * Component types in the registry
 */
export enum ComponentType {
  AGENT = 'agent',
  SERVICE = 'service',
  ADAPTER = 'adapter',
  POLICY_BUNDLE = 'policy_bundle',
}

/**
 * Component lifecycle status
 */
export enum ComponentStatus {
  ACTIVE = 'active',
  DEPRECATED = 'deprecated',
  RETIRED = 'retired',
}

/**
 * Approval requirement types
 */
export enum ApprovalType {
  NONE = 'none',
  HUMAN_REVIEW = 'human_review',
  AUTOMATED_CHECK = 'automated_check',
  MULTI_PARTY = 'multi_party',
}
