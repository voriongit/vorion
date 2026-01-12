/**
 * Trust Profile Service - High-level profile management
 *
 * Provides business logic for trust profile operations:
 * - Create, read, update profiles
 * - Calculate new profiles from evidence
 * - Recalculate existing profiles
 * - Profile history and snapshots
 *
 * Hook integration:
 * - TRUST_CHANGE: Fired when a profile is created, updated, or refreshed
 * - TRUST_VIOLATION: Fired when significant trust drops or anomalies detected
 */

import { v4 as uuidv4 } from 'uuid';
import {
  ObservationTier,
  TrustBand,
  type TrustProfile,
  type TrustProfileSummary,
  type TrustEvidence,
  type TrustWeights,
} from '@vorion/contracts';
import { TrustCalculator, type TrustCalculatorConfig } from './trust-calculator.js';
import {
  type TrustProfileStore,
  type ProfileQueryFilter,
  type ProfileQueryOptions,
  type ProfileQueryResult,
  type ProfileHistoryEntry,
  createInMemoryStore,
} from './profile-store.js';
import type { HookManager } from '../hooks/index.js';

// Re-export query types for convenience
export type { ProfileQueryFilter, ProfileQueryOptions, ProfileQueryResult, ProfileHistoryEntry };

/**
 * Configuration for the profile service
 */
export interface ProfileServiceConfig {
  /** Custom profile store (defaults to in-memory) */
  store?: TrustProfileStore;
  /** Calculator configuration */
  calculatorConfig?: TrustCalculatorConfig;
  /** Auto-recalculate profiles older than this (ms) */
  autoRecalculateAfterMs?: number;
  /** Enable profile caching */
  enableCaching?: boolean;
  /** Hook manager for trust change/violation events */
  hookManager?: HookManager;
  /** Enable hooks (default: true if hookManager provided) */
  enableHooks?: boolean;
  /** Threshold for band drop to trigger violation (default: 1) */
  bandDropViolationThreshold?: number;
  /** Threshold for score drop percentage to trigger violation (default: 20) */
  scoreDropViolationThreshold?: number;
}

/**
 * Options for creating a new profile
 */
export interface CreateProfileOptions {
  /** Specific profile ID (auto-generated if not provided) */
  profileId?: string;
  /** Custom weights for calculation */
  weights?: Partial<TrustWeights>;
  /** Time reference for calculation */
  now?: Date;
}

/**
 * Options for updating a profile
 */
export interface UpdateProfileOptions {
  /** Custom weights for recalculation */
  weights?: Partial<TrustWeights>;
  /** Time reference for calculation */
  now?: Date;
  /** Force recalculation even if recent */
  force?: boolean;
}

/**
 * Result of a profile operation
 */
export interface ProfileOperationResult {
  success: boolean;
  profile?: TrustProfile;
  error?: string;
  isNew?: boolean;
  previousVersion?: number;
}

/**
 * TrustProfileService - Manages trust profiles for agents
 */
export class TrustProfileService {
  private readonly store: TrustProfileStore;
  private readonly calculator: TrustCalculator;
  private readonly hookManager?: HookManager;
  private readonly config: Required<Omit<ProfileServiceConfig, 'hookManager'>>;

  constructor(config: ProfileServiceConfig = {}) {
    this.store = config.store ?? createInMemoryStore();
    this.calculator = new TrustCalculator(config.calculatorConfig);
    this.hookManager = config.hookManager;
    this.config = {
      store: this.store,
      calculatorConfig: config.calculatorConfig ?? {},
      autoRecalculateAfterMs: config.autoRecalculateAfterMs ?? 24 * 60 * 60 * 1000, // 24h
      enableCaching: config.enableCaching ?? false,
      enableHooks: config.enableHooks ?? (config.hookManager !== undefined),
      bandDropViolationThreshold: config.bandDropViolationThreshold ?? 1,
      scoreDropViolationThreshold: config.scoreDropViolationThreshold ?? 20,
    };
  }

  /**
   * Create a new trust profile for an agent
   */
  async create(
    agentId: string,
    observationTier: ObservationTier,
    evidence: TrustEvidence[],
    options: CreateProfileOptions = {}
  ): Promise<ProfileOperationResult> {
    try {
      // Check if profile already exists
      const existing = await this.store.get(agentId);
      if (existing) {
        return {
          success: false,
          error: `Profile already exists for agent ${agentId}. Use update() instead.`,
        };
      }

      // Calculate the profile
      const profile = this.calculator.calculate(agentId, observationTier, evidence, {
        weights: options.weights,
        now: options.now,
      });

      // Override profile ID if provided
      if (options.profileId) {
        (profile as { profileId: string }).profileId = options.profileId;
      }

      // Save to store
      const saved = await this.store.save(profile);

      // Fire trust change hook for new profile
      await this.fireTrustChangeHook(null, saved, 'Profile created');

      return {
        success: true,
        profile: saved,
        isNew: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get a trust profile by agent ID
   */
  async get(agentId: string): Promise<TrustProfile | null> {
    return this.store.get(agentId);
  }

  /**
   * Get a profile by its unique profile ID
   */
  async getByProfileId(profileId: string): Promise<TrustProfile | null> {
    return this.store.getByProfileId(profileId);
  }

  /**
   * Get or create a profile for an agent
   */
  async getOrCreate(
    agentId: string,
    observationTier: ObservationTier,
    initialEvidence: TrustEvidence[] = [],
    options: CreateProfileOptions = {}
  ): Promise<ProfileOperationResult> {
    const existing = await this.store.get(agentId);
    if (existing) {
      return {
        success: true,
        profile: existing,
        isNew: false,
      };
    }
    return this.create(agentId, observationTier, initialEvidence, options);
  }

  /**
   * Update an existing profile with new evidence
   */
  async update(
    agentId: string,
    newEvidence: TrustEvidence[],
    options: UpdateProfileOptions = {}
  ): Promise<ProfileOperationResult> {
    try {
      const existing = await this.store.get(agentId);
      if (!existing) {
        return {
          success: false,
          error: `No profile found for agent ${agentId}. Use create() first.`,
        };
      }

      // Recalculate with new evidence
      const updated = this.calculator.recalculate(existing, newEvidence, {
        weights: options.weights,
        now: options.now,
      });

      // Save updated profile
      const saved = await this.store.save(updated);

      // Fire trust change hook
      await this.fireTrustChangeHook(existing, saved, 'Evidence updated');

      // Check for trust violations
      await this.checkForViolations(existing, saved);

      return {
        success: true,
        profile: saved,
        isNew: false,
        previousVersion: existing.version,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Recalculate a profile with decay applied (no new evidence)
   */
  async refresh(
    agentId: string,
    options: { now?: Date; force?: boolean } = {}
  ): Promise<ProfileOperationResult> {
    try {
      const existing = await this.store.get(agentId);
      if (!existing) {
        return {
          success: false,
          error: `No profile found for agent ${agentId}`,
        };
      }

      const now = options.now ?? new Date();
      const age = now.getTime() - existing.calculatedAt.getTime();

      // Skip if not old enough (unless forced)
      if (!options.force && age < this.config.autoRecalculateAfterMs) {
        return {
          success: true,
          profile: existing,
          isNew: false,
        };
      }

      // Apply decay
      const refreshed = this.calculator.applyDecay(existing, { now });

      // Save updated profile
      const saved = await this.store.save(refreshed);

      // Fire trust change hook if there was a change
      if (existing.band !== saved.band || existing.adjustedScore !== saved.adjustedScore) {
        await this.fireTrustChangeHook(existing, saved, 'Decay applied');
        await this.checkForViolations(existing, saved);
      }

      return {
        success: true,
        profile: saved,
        isNew: false,
        previousVersion: existing.version,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Delete a profile
   */
  async delete(agentId: string): Promise<boolean> {
    return this.store.delete(agentId);
  }

  /**
   * Check if a profile exists
   */
  async exists(agentId: string): Promise<boolean> {
    return this.store.exists(agentId);
  }

  /**
   * Query profiles with filters
   */
  async query(
    filter?: ProfileQueryFilter,
    options?: ProfileQueryOptions
  ): Promise<ProfileQueryResult> {
    return this.store.query(filter, options);
  }

  /**
   * Get profile history for an agent
   */
  async getHistory(agentId: string, limit?: number): Promise<ProfileHistoryEntry[]> {
    return this.store.getHistory(agentId, limit);
  }

  /**
   * Get summaries for multiple agents
   */
  async getSummaries(agentIds: string[]): Promise<TrustProfileSummary[]> {
    return this.store.getSummaries(agentIds);
  }

  /**
   * Get all agent IDs with profiles
   */
  async listAgentIds(options?: ProfileQueryOptions): Promise<string[]> {
    const result = await this.store.query({}, options);
    return result.profiles.map((p) => p.agentId);
  }

  /**
   * Bulk create or update profiles
   */
  async bulkUpsert(
    profiles: Array<{
      agentId: string;
      observationTier: ObservationTier;
      evidence: TrustEvidence[];
    }>,
    options: CreateProfileOptions = {}
  ): Promise<ProfileOperationResult[]> {
    const results: ProfileOperationResult[] = [];

    for (const item of profiles) {
      const existing = await this.store.get(item.agentId);
      if (existing) {
        const result = await this.update(item.agentId, item.evidence, options);
        results.push(result);
      } else {
        const result = await this.create(
          item.agentId,
          item.observationTier,
          item.evidence,
          options
        );
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Get profiles that need recalculation
   */
  async getStaleProfiles(
    maxAge: number = this.config.autoRecalculateAfterMs
  ): Promise<TrustProfile[]> {
    const cutoff = new Date(Date.now() - maxAge);
    const result = await this.store.query({ calculatedBefore: cutoff });
    return result.profiles;
  }

  /**
   * Refresh all stale profiles
   */
  async refreshStaleProfiles(
    maxAge?: number,
    options?: { now?: Date }
  ): Promise<ProfileOperationResult[]> {
    const stale = await this.getStaleProfiles(maxAge);
    const results: ProfileOperationResult[] = [];

    for (const profile of stale) {
      const result = await this.refresh(profile.agentId, { ...options, force: true });
      results.push(result);
    }

    return results;
  }

  /**
   * Get the underlying calculator
   */
  getCalculator(): TrustCalculator {
    return this.calculator;
  }

  /**
   * Get the underlying store
   */
  getStore(): TrustProfileStore {
    return this.store;
  }

  /**
   * Clear all profiles (for testing)
   */
  async clear(): Promise<void> {
    await this.store.clear();
  }

  /**
   * Get the hook manager
   */
  getHookManager(): HookManager | undefined {
    return this.hookManager;
  }

  // ============================================================
  // Private Hook Methods
  // ============================================================

  /**
   * Fire trust change hook
   */
  private async fireTrustChangeHook(
    previousProfile: TrustProfile | null,
    newProfile: TrustProfile,
    reason: string
  ): Promise<void> {
    if (!this.config.enableHooks || !this.hookManager) {
      return;
    }

    // For new profiles, create a "zero" previous profile for comparison
    const previous = previousProfile ?? this.createZeroProfile(newProfile.agentId);

    await this.hookManager.executeTrustChange({
      correlationId: uuidv4(),
      agentId: newProfile.agentId,
      previousProfile: previous,
      newProfile,
      reason,
    });
  }

  /**
   * Check for trust violations and fire hooks
   */
  private async checkForViolations(
    previousProfile: TrustProfile,
    newProfile: TrustProfile
  ): Promise<void> {
    if (!this.config.enableHooks || !this.hookManager) {
      return;
    }

    const violations: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      details: Record<string, unknown>;
    }> = [];

    // Check for band drop
    const bandDrop = previousProfile.band - newProfile.band;
    if (bandDrop >= this.config.bandDropViolationThreshold) {
      const severity = bandDrop >= 2 ? 'critical' : 'high';
      violations.push({
        type: 'band_drop',
        severity,
        details: {
          previousBand: previousProfile.band,
          newBand: newProfile.band,
          bandDrop,
        },
      });
    }

    // Check for significant score drop
    const scoreDrop = previousProfile.adjustedScore - newProfile.adjustedScore;
    const scoreDropPercent = (scoreDrop / previousProfile.adjustedScore) * 100;
    if (scoreDropPercent >= this.config.scoreDropViolationThreshold) {
      const severity = scoreDropPercent >= 40 ? 'critical' : scoreDropPercent >= 30 ? 'high' : 'medium';
      violations.push({
        type: 'score_drop',
        severity,
        details: {
          previousScore: previousProfile.adjustedScore,
          newScore: newProfile.adjustedScore,
          scoreDrop,
          scoreDropPercent,
        },
      });
    }

    // Fire violation hooks
    for (const violation of violations) {
      await this.hookManager.executeTrustViolation({
        correlationId: uuidv4(),
        agentId: newProfile.agentId,
        profile: newProfile,
        violationType: violation.type,
        details: violation.details,
        severity: violation.severity,
      });
    }
  }

  /**
   * Create a zero profile for comparison (used for new profile creation)
   */
  private createZeroProfile(agentId: string): TrustProfile {
    return {
      profileId: 'zero',
      agentId,
      dimensions: { CT: 50, BT: 50, GT: 50, XT: 50, AC: 50 },
      weights: { CT: 0.25, BT: 0.25, GT: 0.20, XT: 0.15, AC: 0.15 },
      compositeScore: 50,
      observationTier: ObservationTier.BLACK_BOX,
      adjustedScore: 50,
      band: TrustBand.T0_UNTRUSTED,
      calculatedAt: new Date(0),
      evidence: [],
      version: 0,
    };
  }
}

/**
 * Create a TrustProfileService with default configuration
 */
export function createProfileService(config?: ProfileServiceConfig): TrustProfileService {
  return new TrustProfileService(config);
}
