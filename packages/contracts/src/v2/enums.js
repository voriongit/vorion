/**
 * Core enums for the ORION Platform
 */
/**
 * Trust bands representing autonomy levels (T0-T5)
 */
export var TrustBand;
(function (TrustBand) {
    TrustBand[TrustBand["T0_UNTRUSTED"] = 0] = "T0_UNTRUSTED";
    TrustBand[TrustBand["T1_SUPERVISED"] = 1] = "T1_SUPERVISED";
    TrustBand[TrustBand["T2_CONSTRAINED"] = 2] = "T2_CONSTRAINED";
    TrustBand[TrustBand["T3_TRUSTED"] = 3] = "T3_TRUSTED";
    TrustBand[TrustBand["T4_AUTONOMOUS"] = 4] = "T4_AUTONOMOUS";
    TrustBand[TrustBand["T5_MISSION_CRITICAL"] = 5] = "T5_MISSION_CRITICAL";
})(TrustBand || (TrustBand = {}));
/**
 * Observation tiers - determines maximum trust ceiling
 * based on system observability
 *
 * Per ATSF v2.0 RTA findings:
 * - WHITE_BOX reduced from 95% to 90% (sleeper agent risk)
 * - ATTESTED_BOX reduced from 100% to 95% (TEE side-channel risk)
 * - VERIFIED_BOX added requiring multiple verification layers
 */
export var ObservationTier;
(function (ObservationTier) {
    /** I/O only - API accessed proprietary models (max 60%) */
    ObservationTier["BLACK_BOX"] = "BLACK_BOX";
    /** I/O + logs - Platform-hosted models (max 75%) */
    ObservationTier["GRAY_BOX"] = "GRAY_BOX";
    /** Full code access - Open-source models (max 90%, reduced for sleeper risk) */
    ObservationTier["WHITE_BOX"] = "WHITE_BOX";
    /** TEE verified - Models in secure enclaves (max 95%, reduced for side-channel risk) */
    ObservationTier["ATTESTED_BOX"] = "ATTESTED_BOX";
    /** Full verification: TEE + zkML + interpretability (max 100%) */
    ObservationTier["VERIFIED_BOX"] = "VERIFIED_BOX";
})(ObservationTier || (ObservationTier = {}));
/**
 * Trust ceiling values for each observation tier (0-1000 scale)
 * Updated per ATSF v2.0 Red Team Assessment findings
 */
export const OBSERVATION_CEILINGS = {
    [ObservationTier.BLACK_BOX]: 600,
    [ObservationTier.GRAY_BOX]: 750,
    [ObservationTier.WHITE_BOX]: 900, // Reduced from 950 (sleeper agent risk)
    [ObservationTier.ATTESTED_BOX]: 950, // Reduced from 1000 (TEE side-channel risk)
    [ObservationTier.VERIFIED_BOX]: 1000, // New: requires full verification stack
};
/**
 * Data sensitivity levels for intent classification
 */
export var DataSensitivity;
(function (DataSensitivity) {
    DataSensitivity["PUBLIC"] = "PUBLIC";
    DataSensitivity["INTERNAL"] = "INTERNAL";
    DataSensitivity["CONFIDENTIAL"] = "CONFIDENTIAL";
    DataSensitivity["RESTRICTED"] = "RESTRICTED";
})(DataSensitivity || (DataSensitivity = {}));
/**
 * Action reversibility classification
 */
export var Reversibility;
(function (Reversibility) {
    Reversibility["REVERSIBLE"] = "REVERSIBLE";
    Reversibility["PARTIALLY_REVERSIBLE"] = "PARTIALLY_REVERSIBLE";
    Reversibility["IRREVERSIBLE"] = "IRREVERSIBLE";
})(Reversibility || (Reversibility = {}));
/**
 * Action types for categorizing intents
 */
export var ActionType;
(function (ActionType) {
    ActionType["READ"] = "read";
    ActionType["WRITE"] = "write";
    ActionType["DELETE"] = "delete";
    ActionType["EXECUTE"] = "execute";
    ActionType["COMMUNICATE"] = "communicate";
    ActionType["TRANSFER"] = "transfer";
})(ActionType || (ActionType = {}));
/**
 * Proof event types for the audit trail
 */
export var ProofEventType;
(function (ProofEventType) {
    ProofEventType["INTENT_RECEIVED"] = "intent_received";
    ProofEventType["DECISION_MADE"] = "decision_made";
    ProofEventType["TRUST_DELTA"] = "trust_delta";
    ProofEventType["EXECUTION_STARTED"] = "execution_started";
    ProofEventType["EXECUTION_COMPLETED"] = "execution_completed";
    ProofEventType["EXECUTION_FAILED"] = "execution_failed";
    ProofEventType["INCIDENT_DETECTED"] = "incident_detected";
    ProofEventType["ROLLBACK_INITIATED"] = "rollback_initiated";
    ProofEventType["COMPONENT_REGISTERED"] = "component_registered";
    ProofEventType["COMPONENT_UPDATED"] = "component_updated";
})(ProofEventType || (ProofEventType = {}));
/**
 * Component types in the registry
 */
export var ComponentType;
(function (ComponentType) {
    ComponentType["AGENT"] = "agent";
    ComponentType["SERVICE"] = "service";
    ComponentType["ADAPTER"] = "adapter";
    ComponentType["POLICY_BUNDLE"] = "policy_bundle";
})(ComponentType || (ComponentType = {}));
/**
 * Component lifecycle status
 */
export var ComponentStatus;
(function (ComponentStatus) {
    ComponentStatus["ACTIVE"] = "active";
    ComponentStatus["DEPRECATED"] = "deprecated";
    ComponentStatus["RETIRED"] = "retired";
})(ComponentStatus || (ComponentStatus = {}));
/**
 * Approval requirement types
 */
export var ApprovalType;
(function (ApprovalType) {
    ApprovalType["NONE"] = "none";
    ApprovalType["HUMAN_REVIEW"] = "human_review";
    ApprovalType["AUTOMATED_CHECK"] = "automated_check";
    ApprovalType["MULTI_PARTY"] = "multi_party";
})(ApprovalType || (ApprovalType = {}));
//# sourceMappingURL=enums.js.map