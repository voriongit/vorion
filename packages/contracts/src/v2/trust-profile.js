/**
 * Trust Profile types - represents an agent's current trust state
 */
/** Default trust dimension weights */
export const DEFAULT_TRUST_WEIGHTS = {
    CT: 0.25,
    BT: 0.25,
    GT: 0.20,
    XT: 0.15,
    AC: 0.15,
};
/**
 * Default band thresholds on 0-1000 scale
 *
 * These thresholds determine which TrustBand an agent falls into
 * based on their adjusted trust score.
 */
export const DEFAULT_BAND_THRESHOLDS = {
    T0: { min: 0, max: 200 },
    T1: { min: 201, max: 400 },
    T2: { min: 401, max: 550 },
    T3: { min: 551, max: 700 },
    T4: { min: 701, max: 850 },
    T5: { min: 851, max: 1000 },
};
/** Default banding configuration */
export const DEFAULT_BANDING_CONFIG = {
    thresholds: DEFAULT_BAND_THRESHOLDS,
    /** Points buffer on 0-1000 scale to prevent oscillation */
    hysteresis: 30,
    decayRate: 0.01,
    promotionDelay: 7,
};
/**
 * Risk profile for temporal outcome tracking
 * Determines how long to wait before finalizing outcome
 */
export var RiskProfile;
(function (RiskProfile) {
    /** 5 minutes - computations, queries */
    RiskProfile["IMMEDIATE"] = "IMMEDIATE";
    /** 4 hours - API calls */
    RiskProfile["SHORT_TERM"] = "SHORT_TERM";
    /** 3 days - simple transactions */
    RiskProfile["MEDIUM_TERM"] = "MEDIUM_TERM";
    /** 30 days - financial trades */
    RiskProfile["LONG_TERM"] = "LONG_TERM";
    /** 90 days - investments */
    RiskProfile["EXTENDED"] = "EXTENDED";
})(RiskProfile || (RiskProfile = {}));
/** Outcome windows in milliseconds for each risk profile */
export const RISK_PROFILE_WINDOWS = {
    [RiskProfile.IMMEDIATE]: 5 * 60 * 1000, // 5 minutes
    [RiskProfile.SHORT_TERM]: 4 * 60 * 60 * 1000, // 4 hours
    [RiskProfile.MEDIUM_TERM]: 3 * 24 * 60 * 60 * 1000, // 3 days
    [RiskProfile.LONG_TERM]: 30 * 24 * 60 * 60 * 1000, // 30 days
    [RiskProfile.EXTENDED]: 90 * 24 * 60 * 60 * 1000, // 90 days
};
/** Default trust dynamics configuration per ATSF v2.0 */
export const DEFAULT_TRUST_DYNAMICS = {
    gainRate: 0.01, // Logarithmic gain (slow)
    lossRate: 0.10, // Exponential loss (10x faster)
    cooldownHours: 168, // 7 days after any drop
    oscillationThreshold: 3, // 3 direction changes triggers alert
    oscillationWindowHours: 24, // Within 24 hours
    reversalPenaltyMultiplier: 2.0, // 2x penalty for reversals
    circuitBreakerThreshold: 100, // Trust < 100 (on 0-1000 scale) triggers circuit breaker
};
//# sourceMappingURL=trust-profile.js.map