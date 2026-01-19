/**
 * Feature Flags Configuration
 *
 * TRUST-1.8 & TRUST-2.6: Feature flags for gradual rollout of enhanced features.
 * These flags allow rollback to legacy behavior if issues are detected.
 */

// ============================================================================
// Feature Flag Definitions
// ============================================================================

export interface FeatureFlags {
    /**
     * Use FICO-style multi-component trust scoring.
     * When disabled, falls back to legacy single-score calculation.
     * @default true
     */
    USE_FICO_SCORING: boolean;

    /**
     * Use cryptographic hash-chained audit logging.
     * When disabled, falls back to legacy audit log without hashes.
     * @default true
     */
    USE_CRYPTO_AUDIT: boolean;

    /**
     * Enable council governance system.
     * When disabled, all decisions bypass council review.
     * @default false (not yet implemented)
     */
    ENABLE_COUNCIL: boolean;

    /**
     * Enable delegation and autonomy budget system.
     * When disabled, all actions require explicit approval.
     * @default false (not yet implemented)
     */
    ENABLE_DELEGATION: boolean;

    /**
     * Enable detailed component breakdown in API responses.
     * When disabled, only returns aggregate score.
     * @default true
     */
    EXPOSE_COMPONENT_SCORES: boolean;

    /**
     * Enable automatic HITL level fading based on trust performance.
     * When disabled, HITL level must be manually adjusted.
     * @default true
     */
    AUTO_FADE_HITL: boolean;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_FEATURES: FeatureFlags = {
    USE_FICO_SCORING: true,
    USE_CRYPTO_AUDIT: true,
    ENABLE_COUNCIL: true,  // TRUST-3: Council governance now implemented
    ENABLE_DELEGATION: true,  // TRUST-4: Delegation & Autonomy now implemented
    EXPOSE_COMPONENT_SCORES: true,
    AUTO_FADE_HITL: true,
};

// ============================================================================
// Feature Flag Manager
// ============================================================================

class FeatureFlagManager {
    private flags: FeatureFlags;
    private overrides: Partial<FeatureFlags> = {};

    constructor(defaults: FeatureFlags = DEFAULT_FEATURES) {
        this.flags = { ...defaults };
    }

    /**
     * Check if a feature is enabled.
     */
    isEnabled(flag: keyof FeatureFlags): boolean {
        if (flag in this.overrides) {
            return this.overrides[flag]!;
        }
        return this.flags[flag];
    }

    /**
     * Set a feature flag override.
     * Overrides persist until cleared.
     */
    setOverride(flag: keyof FeatureFlags, value: boolean): void {
        this.overrides[flag] = value;
    }

    /**
     * Clear a specific override.
     */
    clearOverride(flag: keyof FeatureFlags): void {
        delete this.overrides[flag];
    }

    /**
     * Clear all overrides.
     */
    clearAllOverrides(): void {
        this.overrides = {};
    }

    /**
     * Get all current flag values (including overrides).
     */
    getAllFlags(): FeatureFlags {
        return { ...this.flags, ...this.overrides };
    }

    /**
     * Get flag value with explicit type.
     */
    get<K extends keyof FeatureFlags>(flag: K): FeatureFlags[K] {
        return this.isEnabled(flag) as FeatureFlags[K];
    }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const FEATURES = new FeatureFlagManager();

// Convenience accessors
export const isEnabled = (flag: keyof FeatureFlags): boolean => FEATURES.isEnabled(flag);
export const setFeatureFlag = (flag: keyof FeatureFlags, value: boolean): void => FEATURES.setOverride(flag, value);
