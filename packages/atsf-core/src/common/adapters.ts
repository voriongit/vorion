/**
 * Type Adapters for Legacy to Canonical Conversion
 *
 * Provides adapter functions to convert between legacy atsf-core types
 * and canonical types from @vorion/contracts for backwards compatibility.
 *
 * @packageDocumentation
 */

import type {
  TrustBand,
  TrustDimensions,
  TrustEvidence,
  RiskProfile,
} from '@vorion/contracts';

import type {
  ID,
  Timestamp,
  TrustLevel,
  TrustScore,
  TrustSignal,
  TrustComponents,
  Intent,
  IntentStatus,
  RiskLevel,
} from './types.js';

// ============================================================================
// Legacy Type Definitions (for explicit typing in adapters)
// ============================================================================

/**
 * Legacy intent structure used in older atsf-core code
 */
export interface LegacyIntent {
  id: ID;
  entityId: ID;
  goal: string;
  context: Record<string, unknown>;
  metadata: Record<string, unknown>;
  status: IntentStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Legacy trust signal structure
 */
export interface LegacySignal {
  id: ID;
  entityId: ID;
  type: string;
  value: number;
  source?: string;
  timestamp: Timestamp;
  metadata?: Record<string, unknown>;
}

/**
 * Canonical intent structure from @vorion/contracts
 */
export interface CanonicalIntent {
  intentId: string;
  agentId: string;
  correlationId: string;
  action: string;
  actionType: string;
  resourceScope: string[];
  dataSensitivity: string;
  reversibility: string;
  context: Record<string, unknown>;
  createdAt: Date;
  expiresAt?: Date;
  source?: string;
}

/**
 * Canonical trust signal (TrustEvidence) from @vorion/contracts
 */
export interface CanonicalTrustSignal {
  evidenceId: string;
  dimension: keyof TrustDimensions;
  impact: number;
  source: string;
  collectedAt: Date;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Trust Level / Trust Band Adapters
// ============================================================================

/**
 * Trust band thresholds for score-to-band mapping (0-1000 scale)
 * Aligned with canonical DEFAULT_BAND_THRESHOLDS from @vorion/contracts
 */
const TRUST_BAND_THRESHOLDS = {
  T0: { min: 0, max: 166 },
  T1: { min: 167, max: 332 },
  T2: { min: 333, max: 499 },
  T3: { min: 500, max: 665 },
  T4: { min: 666, max: 832 },
  T5: { min: 833, max: 1000 },
} as const;

/**
 * Adapts a legacy numeric trust level (0-5) to canonical TrustBand enum
 *
 * @param level - Legacy trust level (0-5)
 * @returns Canonical TrustBand value
 *
 * @example
 * ```typescript
 * const band = adaptLegacyTrustLevel(3);
 * // Returns TrustBand.T3_TRUSTED (value: 3)
 * ```
 */
export function adaptLegacyTrustLevel(level: TrustLevel | number): TrustBand {
  // TrustBand enum values are 0-5, same as legacy TrustLevel
  const clampedLevel = Math.max(0, Math.min(5, Math.floor(level)));
  return clampedLevel as TrustBand;
}

/**
 * Adapts a canonical TrustBand to legacy numeric trust level
 *
 * @param band - Canonical TrustBand enum value
 * @returns Legacy trust level (0-5)
 */
export function adaptTrustBandToLevel(band: TrustBand): TrustLevel {
  return band as TrustLevel;
}

/**
 * Converts a trust score (0-100 or 0-1000) to canonical TrustBand
 *
 * @param score - Trust score (auto-detects 0-100 vs 0-1000 scale)
 * @returns Canonical TrustBand value
 */
export function adaptScoreToTrustBand(score: number): TrustBand {
  // Normalize to 0-1000 scale if score appears to be on 0-100 scale
  const normalizedScore = score <= 100 ? score * 10 : score;
  const clampedScore = Math.max(0, Math.min(1000, normalizedScore));

  if (clampedScore <= TRUST_BAND_THRESHOLDS.T0.max) return 0 as TrustBand;
  if (clampedScore <= TRUST_BAND_THRESHOLDS.T1.max) return 1 as TrustBand;
  if (clampedScore <= TRUST_BAND_THRESHOLDS.T2.max) return 2 as TrustBand;
  if (clampedScore <= TRUST_BAND_THRESHOLDS.T3.max) return 3 as TrustBand;
  if (clampedScore <= TRUST_BAND_THRESHOLDS.T4.max) return 4 as TrustBand;
  return 5 as TrustBand;
}

// ============================================================================
// Intent Adapters
// ============================================================================

/**
 * Adapts a legacy Intent to canonical Intent structure
 *
 * @param intent - Legacy intent from atsf-core
 * @returns Canonical intent compatible with @vorion/contracts
 *
 * @example
 * ```typescript
 * const legacyIntent: LegacyIntent = { id: '123', entityId: 'agent-1', ... };
 * const canonical = adaptLegacyIntent(legacyIntent);
 * ```
 */
export function adaptLegacyIntent(intent: LegacyIntent): CanonicalIntent {
  return {
    intentId: intent.id,
    agentId: intent.entityId,
    correlationId: intent.metadata?.correlationId as string ?? intent.id,
    action: intent.goal,
    actionType: (intent.context?.actionType as string) ?? 'execute',
    resourceScope: (intent.context?.resources as string[]) ?? [],
    dataSensitivity: (intent.context?.dataSensitivity as string) ?? 'INTERNAL',
    reversibility: (intent.context?.reversibility as string) ?? 'REVERSIBLE',
    context: {
      ...intent.context,
      metadata: intent.metadata,
      legacyStatus: intent.status,
    },
    createdAt: new Date(intent.createdAt),
    expiresAt: intent.metadata?.expiresAt
      ? new Date(intent.metadata.expiresAt as string)
      : undefined,
    source: (intent.metadata?.source as string) ?? 'atsf-core-legacy',
  };
}

/**
 * Adapts a canonical Intent back to legacy Intent structure
 *
 * @param intent - Canonical intent from @vorion/contracts
 * @returns Legacy intent compatible with atsf-core
 */
export function adaptCanonicalIntent(intent: CanonicalIntent): LegacyIntent {
  return {
    id: intent.intentId,
    entityId: intent.agentId,
    goal: intent.action,
    context: {
      actionType: intent.actionType,
      resources: intent.resourceScope,
      dataSensitivity: intent.dataSensitivity,
      reversibility: intent.reversibility,
      ...intent.context,
    },
    metadata: {
      correlationId: intent.correlationId,
      source: intent.source,
      ...(intent.context.metadata as Record<string, unknown> ?? {}),
    },
    status: (intent.context.legacyStatus as IntentStatus) ?? 'pending',
    createdAt: intent.createdAt.toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Trust Signal / Evidence Adapters
// ============================================================================

/**
 * Maps legacy signal types to canonical trust dimensions
 */
const SIGNAL_TYPE_TO_DIMENSION: Record<string, keyof TrustDimensions> = {
  // Behavioral signals -> BT
  'behavioral': 'BT',
  'behavioral.task_completed': 'BT',
  'behavioral.task_failed': 'BT',
  'behavioral.api_success': 'BT',
  'behavioral.api_error': 'BT',
  'action': 'BT',
  'error': 'BT',

  // Compliance/Governance signals -> GT
  'compliance': 'GT',
  'credential': 'GT',
  'policy': 'GT',
  'governance': 'GT',

  // Identity/Capability signals -> CT
  'identity': 'CT',
  'capability': 'CT',
  'skill': 'CT',

  // Context signals -> XT
  'context': 'XT',
  'environment': 'XT',
  'temporal': 'XT',

  // Assurance signals -> AC
  'assurance': 'AC',
  'verification': 'AC',
  'audit': 'AC',
};

/**
 * Adapts a legacy TrustSignal to canonical TrustEvidence
 *
 * @param signal - Legacy trust signal from atsf-core
 * @returns Canonical TrustEvidence compatible with @vorion/contracts
 *
 * @example
 * ```typescript
 * const legacySignal: LegacySignal = { id: '123', type: 'behavioral', value: 0.8, ... };
 * const evidence = adaptLegacyTrustSignal(legacySignal);
 * ```
 */
export function adaptLegacyTrustSignal(signal: LegacySignal): CanonicalTrustSignal {
  // Determine dimension from signal type
  const signalTypeKey = signal.type.toLowerCase();
  const dimension = SIGNAL_TYPE_TO_DIMENSION[signalTypeKey]
    ?? SIGNAL_TYPE_TO_DIMENSION[signalTypeKey.split('.')[0]]
    ?? 'BT'; // Default to Behavioral Trust

  // Convert value to impact (-100 to +100 scale)
  // Legacy values are typically 0-1 or 0-100
  let impact: number;
  if (signal.value >= -1 && signal.value <= 1) {
    // 0-1 scale, convert to -100 to +100
    impact = (signal.value - 0.5) * 200;
  } else if (signal.value >= -100 && signal.value <= 100) {
    // Already in correct range
    impact = signal.value;
  } else {
    // 0-100 scale, convert to -100 to +100
    impact = (signal.value - 50) * 2;
  }

  return {
    evidenceId: signal.id,
    dimension,
    impact: Math.max(-100, Math.min(100, impact)),
    source: signal.source ?? 'atsf-core-legacy',
    collectedAt: new Date(signal.timestamp),
    metadata: signal.metadata,
  };
}

/**
 * Adapts canonical TrustEvidence back to legacy TrustSignal
 *
 * @param evidence - Canonical TrustEvidence from @vorion/contracts
 * @param entityId - Entity ID to associate with the signal
 * @returns Legacy TrustSignal compatible with atsf-core
 */
export function adaptCanonicalTrustSignal(
  evidence: CanonicalTrustSignal,
  entityId: ID
): LegacySignal {
  // Convert impact back to 0-1 value scale
  const value = (evidence.impact + 100) / 200;

  return {
    id: evidence.evidenceId,
    entityId,
    type: `${evidence.dimension.toLowerCase()}.evidence`,
    value: Math.max(0, Math.min(1, value)),
    source: evidence.source,
    timestamp: evidence.collectedAt.toISOString(),
    metadata: evidence.metadata,
  };
}

// ============================================================================
// Risk Level Adapters
// ============================================================================

/**
 * Maps numeric risk values to RiskLevel
 */
export function adaptRiskLevelFromNumber(n: number): RiskLevel {
  if (n <= 0.25) return 'low';
  if (n <= 0.5) return 'medium';
  if (n <= 0.75) return 'high';
  return 'critical';
}

/**
 * Maps RiskLevel to numeric value
 */
export function adaptRiskLevelToNumber(level: RiskLevel): number {
  switch (level) {
    case 'low': return 0.125;
    case 'medium': return 0.375;
    case 'high': return 0.625;
    case 'critical': return 0.875;
    default: return 0.5;
  }
}

/**
 * Maps legacy RiskLevel to canonical RiskProfile
 *
 * @param level - Legacy risk level
 * @returns Canonical RiskProfile value
 */
export function adaptRiskLevelToProfile(level: RiskLevel): RiskProfile {
  switch (level) {
    case 'low': return 'IMMEDIATE' as RiskProfile;
    case 'medium': return 'SHORT_TERM' as RiskProfile;
    case 'high': return 'MEDIUM_TERM' as RiskProfile;
    case 'critical': return 'LONG_TERM' as RiskProfile;
    default: return 'SHORT_TERM' as RiskProfile;
  }
}

// ============================================================================
// Trust Components / Dimensions Adapters
// ============================================================================

/**
 * Adapts legacy 4-dimension TrustComponents to canonical 5-dimension TrustDimensions
 *
 * @param components - Legacy TrustComponents (behavioral, compliance, identity, context)
 * @returns Canonical TrustDimensions (CT, BT, GT, XT, AC)
 */
export function adaptLegacyTrustComponents(components: TrustComponents): TrustDimensions {
  return {
    CT: components.identity, // Capability Trust <- identity
    BT: components.behavioral, // Behavioral Trust <- behavioral
    GT: components.compliance, // Governance Trust <- compliance
    XT: components.context, // Contextual Trust <- context
    AC: 50, // Assurance Confidence - default neutral (no legacy equivalent)
  };
}

/**
 * Adapts canonical 5-dimension TrustDimensions to legacy 4-dimension TrustComponents
 *
 * @param dimensions - Canonical TrustDimensions (CT, BT, GT, XT, AC)
 * @returns Legacy TrustComponents (behavioral, compliance, identity, context)
 */
export function adaptCanonicalTrustDimensions(dimensions: TrustDimensions): TrustComponents {
  return {
    behavioral: dimensions.BT,
    compliance: dimensions.GT,
    identity: dimensions.CT,
    context: dimensions.XT,
    // AC (Assurance Confidence) is lost in conversion
  };
}

// ============================================================================
// Batch Adapters
// ============================================================================

/**
 * Batch adapt multiple legacy intents
 */
export function adaptLegacyIntents(intents: LegacyIntent[]): CanonicalIntent[] {
  return intents.map(adaptLegacyIntent);
}

/**
 * Batch adapt multiple legacy signals
 */
export function adaptLegacyTrustSignals(signals: LegacySignal[]): CanonicalTrustSignal[] {
  return signals.map(adaptLegacyTrustSignal);
}

// ============================================================================
// Re-exports for convenience
// ============================================================================

export type {
  TrustBand,
  TrustDimensions,
  TrustEvidence,
  RiskProfile,
} from '@vorion/contracts';

export type {
  TrustLevel,
  TrustScore,
  TrustSignal,
  TrustComponents,
  Intent,
  IntentStatus,
  RiskLevel,
} from './types.js';
