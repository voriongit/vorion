/**
 * Decision types - the result of authorizing an intent
 */
/**
 * Denial reasons enum for structured denials
 */
export var DenialReason;
(function (DenialReason) {
    DenialReason["INSUFFICIENT_TRUST"] = "insufficient_trust";
    DenialReason["POLICY_VIOLATION"] = "policy_violation";
    DenialReason["RESOURCE_RESTRICTED"] = "resource_restricted";
    DenialReason["DATA_SENSITIVITY_EXCEEDED"] = "data_sensitivity_exceeded";
    DenialReason["RATE_LIMIT_EXCEEDED"] = "rate_limit_exceeded";
    DenialReason["CONTEXT_MISMATCH"] = "context_mismatch";
    DenialReason["EXPIRED_INTENT"] = "expired_intent";
    DenialReason["SYSTEM_ERROR"] = "system_error";
})(DenialReason || (DenialReason = {}));
//# sourceMappingURL=decision.js.map