/**
 * Trust Profile Store - Abstract storage interface and implementations
 *
 * Provides pluggable storage backends for trust profiles:
 * - In-memory (for testing and development)
 * - Future: Supabase (for production)
 */

import type { TrustProfile, TrustProfileSummary } from '@vorion/contracts';

/**
 * Profile query options
 */
export interface ProfileQueryOptions {
  /** Maximum number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Order by field */
  orderBy?: 'calculatedAt' | 'adjustedScore' | 'agentId';
  /** Order direction */
  orderDir?: 'asc' | 'desc';
}

/**
 * Profile query filter
 */
export interface ProfileQueryFilter {
  /** Filter by agent IDs */
  agentIds?: string[];
  /** Minimum adjusted score */
  minScore?: number;
  /** Maximum adjusted score */
  maxScore?: number;
  /** Filter by trust bands */
  bands?: number[];
  /** Calculated after this date */
  calculatedAfter?: Date;
  /** Calculated before this date */
  calculatedBefore?: Date;
}

/**
 * Profile query result
 */
export interface ProfileQueryResult {
  profiles: TrustProfile[];
  total: number;
  offset: number;
  limit: number;
}

/**
 * Profile history entry
 */
export interface ProfileHistoryEntry {
  profile: TrustProfile;
  timestamp: Date;
  reason?: string;
}

/**
 * Abstract interface for trust profile storage
 */
export interface TrustProfileStore {
  /**
   * Get a profile by agent ID
   */
  get(agentId: string): Promise<TrustProfile | null>;

  /**
   * Get a specific profile version by profile ID
   */
  getByProfileId(profileId: string): Promise<TrustProfile | null>;

  /**
   * Save a profile (creates or updates)
   */
  save(profile: TrustProfile): Promise<TrustProfile>;

  /**
   * Delete a profile by agent ID
   */
  delete(agentId: string): Promise<boolean>;

  /**
   * Query profiles with filters
   */
  query(filter?: ProfileQueryFilter, options?: ProfileQueryOptions): Promise<ProfileQueryResult>;

  /**
   * Get profile history for an agent
   */
  getHistory(agentId: string, limit?: number): Promise<ProfileHistoryEntry[]>;

  /**
   * Check if a profile exists for an agent
   */
  exists(agentId: string): Promise<boolean>;

  /**
   * Get profile summaries for multiple agents
   */
  getSummaries(agentIds: string[]): Promise<TrustProfileSummary[]>;

  /**
   * Clear all profiles (for testing)
   */
  clear(): Promise<void>;
}

/**
 * In-memory implementation of TrustProfileStore
 * Suitable for testing and development
 */
export class InMemoryProfileStore implements TrustProfileStore {
  private readonly profiles: Map<string, TrustProfile> = new Map();
  private readonly history: Map<string, ProfileHistoryEntry[]> = new Map();

  async get(agentId: string): Promise<TrustProfile | null> {
    return this.profiles.get(agentId) ?? null;
  }

  async getByProfileId(profileId: string): Promise<TrustProfile | null> {
    for (const profile of this.profiles.values()) {
      if (profile.profileId === profileId) {
        return profile;
      }
    }
    return null;
  }

  async save(profile: TrustProfile): Promise<TrustProfile> {
    const existing = this.profiles.get(profile.agentId);

    // Store current as history before updating
    if (existing) {
      const agentHistory = this.history.get(profile.agentId) ?? [];
      agentHistory.push({
        profile: { ...existing },
        timestamp: new Date(),
        reason: 'profile_updated',
      });
      this.history.set(profile.agentId, agentHistory);
    }

    this.profiles.set(profile.agentId, profile);
    return profile;
  }

  async delete(agentId: string): Promise<boolean> {
    const existed = this.profiles.has(agentId);
    this.profiles.delete(agentId);
    this.history.delete(agentId);
    return existed;
  }

  async query(
    filter: ProfileQueryFilter = {},
    options: ProfileQueryOptions = {}
  ): Promise<ProfileQueryResult> {
    let profiles = Array.from(this.profiles.values());

    // Apply filters
    if (filter.agentIds && filter.agentIds.length > 0) {
      profiles = profiles.filter((p) => filter.agentIds!.includes(p.agentId));
    }
    if (filter.minScore !== undefined) {
      profiles = profiles.filter((p) => p.adjustedScore >= filter.minScore!);
    }
    if (filter.maxScore !== undefined) {
      profiles = profiles.filter((p) => p.adjustedScore <= filter.maxScore!);
    }
    if (filter.bands && filter.bands.length > 0) {
      profiles = profiles.filter((p) => filter.bands!.includes(p.band));
    }
    if (filter.calculatedAfter) {
      profiles = profiles.filter((p) => p.calculatedAt >= filter.calculatedAfter!);
    }
    if (filter.calculatedBefore) {
      profiles = profiles.filter((p) => p.calculatedAt <= filter.calculatedBefore!);
    }

    const total = profiles.length;

    // Apply sorting
    const orderBy = options.orderBy ?? 'calculatedAt';
    const orderDir = options.orderDir ?? 'desc';
    profiles.sort((a, b) => {
      let comparison = 0;
      if (orderBy === 'calculatedAt') {
        comparison = a.calculatedAt.getTime() - b.calculatedAt.getTime();
      } else if (orderBy === 'adjustedScore') {
        comparison = a.adjustedScore - b.adjustedScore;
      } else if (orderBy === 'agentId') {
        comparison = a.agentId.localeCompare(b.agentId);
      }
      return orderDir === 'asc' ? comparison : -comparison;
    });

    // Apply pagination
    const offset = options.offset ?? 0;
    const limit = options.limit ?? 100;
    profiles = profiles.slice(offset, offset + limit);

    return { profiles, total, offset, limit };
  }

  async getHistory(agentId: string, limit: number = 50): Promise<ProfileHistoryEntry[]> {
    const history = this.history.get(agentId) ?? [];
    return history.slice(-limit).reverse(); // Most recent first
  }

  async exists(agentId: string): Promise<boolean> {
    return this.profiles.has(agentId);
  }

  async getSummaries(agentIds: string[]): Promise<TrustProfileSummary[]> {
    const summaries: TrustProfileSummary[] = [];
    for (const agentId of agentIds) {
      const profile = this.profiles.get(agentId);
      if (profile) {
        summaries.push({
          agentId: profile.agentId,
          compositeScore: profile.compositeScore,
          adjustedScore: profile.adjustedScore,
          band: profile.band,
          observationTier: profile.observationTier,
          calculatedAt: profile.calculatedAt,
        });
      }
    }
    return summaries;
  }

  async clear(): Promise<void> {
    this.profiles.clear();
    this.history.clear();
  }

  /**
   * Get count of stored profiles (for testing)
   */
  get size(): number {
    return this.profiles.size;
  }
}

/**
 * Create a new in-memory profile store
 */
export function createInMemoryStore(): TrustProfileStore {
  return new InMemoryProfileStore();
}
