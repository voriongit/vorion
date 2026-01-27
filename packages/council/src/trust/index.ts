/**
 * Trust System - 7-Tier Multi-Dimensional Gating
 *
 * Exports:
 * - Simulation: 12-dimension trust model definitions and simulation engine
 * - Telemetry: Real-time behavior metric collection
 * - Gating: Live promotion/demotion enforcement
 * - Presets: ACI-compliant weight configurations
 */

// Core types and constants
export {
    TRUST_TIERS,
    DIMENSIONS,
    DIMENSION_WEIGHTS,
    GATING_THRESHOLDS,
    AGENT_ARCHETYPES,
    type TierName,
    type TrustTier,
    type Dimension,
    type AgentArchetype,
    type SimulationResult,
    type SimulationDay,
    simulateAgent,
    runAllSimulations,
} from './simulation';

// Telemetry collection
export {
    TelemetryCollector,
    getTelemetryCollector,
    recordTaskSuccess,
    recordTaskFailure,
    recordPolicyViolation,
    recordConsentEvent,
    recordCollaboration,
    type TelemetryEvent,
    type TelemetryEventType,
    type AgentTrustState,
    type DimensionState,
    type TrustSnapshot,
} from './telemetry';

// Gating engine
export {
    GatingEngine,
    getGatingEngine,
    canPromote,
    requestPromotion,
    runAutoGating,
    type GatingDecision,
    type PromotionRequest,
    type TierChangeAudit,
} from './gating';

// Presets (ACI compatibility)
export {
    ACI_CANONICAL_PRESETS,
    AXIOM_DELTAS,
    TRUST_TIERS as LEGACY_TRUST_TIERS,
    CREATION_MODIFIERS,
    ROLE_DEFINITIONS,
    T3_BASELINE,
    createAxiomPreset,
    bootstrapAgentTrustConfigs,
} from './presets';

// Re-export for convenience
export { default as bmadPresets } from './bmad-presets';
