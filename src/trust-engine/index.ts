/**
 * Trust Engine - Behavioral Trust Scoring
 *
 * Calculates and maintains trust scores for entities based on behavioral signals.
 * Persists to PostgreSQL for durability.
 *
 * @packageDocumentation
 */

import { eq, and, gte, desc, sql } from 'drizzle-orm';
import { createLogger } from '../common/logger.js';
import { getDatabase, type Database } from '../common/db.js';
import {
  trustRecords,
  trustSignals,
  trustHistory,
  type NewTrustRecord,
  type NewTrustSignal,
  type NewTrustHistory,
} from '../db/schema/trust.js';
import type {
  TrustScore,
  TrustLevel,
  TrustSignal as TrustSignalType,
  TrustComponents,
  ID,
} from '../common/types.js';

const logger = createLogger({ component: 'trust-engine' });

/**
 * Trust level thresholds
 */
export const TRUST_THRESHOLDS: Record<TrustLevel, { min: number; max: number }> = {
  0: { min: 0, max: 199 },
  1: { min: 200, max: 399 },
  2: { min: 400, max: 599 },
  3: { min: 600, max: 799 },
  4: { min: 800, max: 1000 },
};

/**
 * Trust level names
 */
export const TRUST_LEVEL_NAMES: Record<TrustLevel, string> = {
  0: 'Untrusted',
  1: 'Provisional',
  2: 'Trusted',
  3: 'Verified',
  4: 'Privileged',
};

/**
 * Signal weights for score calculation
 */
export const SIGNAL_WEIGHTS: Record<keyof TrustComponents, number> = {
  behavioral: 0.4,
  compliance: 0.25,
  identity: 0.2,
  context: 0.15,
};

/**
 * Decay milestone definition
 */
interface DecayMilestone {
  days: number;
  multiplier: number;
}

/**
 * Stepped decay milestones
 *
 * Trust decays incrementally based on days since last activity.
 * 182-day half-life ensures agents must demonstrate ongoing trustworthy behavior.
 *
 * @see stepped-decay-specification.md
 */
export const DECAY_MILESTONES: DecayMilestone[] = [
  { days: 0, multiplier: 1.0 },
  { days: 7, multiplier: 0.92 },
  { days: 14, multiplier: 0.83 },
  { days: 28, multiplier: 0.75 },
  { days: 56, multiplier: 0.67 },
  { days: 112, multiplier: 0.58 },
  { days: 182, multiplier: 0.5 },
];

/**
 * Entity trust record
 */
export interface TrustRecord {
  entityId: ID;
  score: TrustScore;
  level: TrustLevel;
  components: TrustComponents;
  signals: TrustSignalType[];
  lastCalculatedAt: string;
  lastActivityAt: string;
  history: TrustHistoryEntry[];
  // Decay information
  decayApplied: boolean;
  decayMultiplier: number;
  baseScore: TrustScore;
  nextMilestone: { days: number; multiplier: number } | null;
}

/**
 * Trust history entry
 */
export interface TrustHistoryEntry {
  score: TrustScore;
  level: TrustLevel;
  reason: string;
  timestamp: string;
}

/**
 * Trust calculation result
 */
export interface TrustCalculation {
  score: TrustScore;
  level: TrustLevel;
  components: TrustComponents;
  factors: string[];
}

/**
 * Trust Engine service with PostgreSQL persistence
 *
 * Uses stepped decay milestones (182-day half-life) for trust score degradation.
 * @see DECAY_MILESTONES
 */
export class TrustEngine {
  private db: Database | null = null;
  private initialized: boolean = false;

  constructor() {
    // Decay is now handled via DECAY_MILESTONES (stepped decay)
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.db = await getDatabase();
    this.initialized = true;
    logger.info('Trust engine initialized with database persistence');
  }

  /**
   * Ensure service is initialized
   */
  private async ensureInitialized(): Promise<Database> {
    if (!this.initialized || !this.db) {
      await this.initialize();
    }
    return this.db!;
  }

  /**
   * Calculate trust score for an entity
   */
  async calculate(entityId: ID): Promise<TrustCalculation> {
    const db = await this.ensureInitialized();

    // Get recent signals for the entity (last 7 days for weighted calculation)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const signals = await db
      .select()
      .from(trustSignals)
      .where(
        and(
          eq(trustSignals.entityId, entityId),
          gte(trustSignals.timestamp, sevenDaysAgo)
        )
      )
      .orderBy(desc(trustSignals.timestamp))
      .limit(1000);

    // Convert to domain signals
    const domainSignals: TrustSignalType[] = signals.map((s) => ({
      id: s.id,
      entityId: s.entityId,
      type: s.type,
      value: s.value,
      weight: s.weight,
      source: s.source ?? '',
      metadata: (s.metadata as Record<string, unknown>) ?? {},
      timestamp: s.timestamp.toISOString(),
    }));

    // Calculate component scores
    const components = this.calculateComponents(domainSignals);

    // Calculate weighted total
    const score = Math.round(
      components.behavioral * SIGNAL_WEIGHTS.behavioral * 1000 +
        components.compliance * SIGNAL_WEIGHTS.compliance * 1000 +
        components.identity * SIGNAL_WEIGHTS.identity * 1000 +
        components.context * SIGNAL_WEIGHTS.context * 1000
    );

    // Clamp to valid range
    const clampedScore = Math.max(0, Math.min(1000, score));
    const level = this.scoreToLevel(clampedScore);

    const factors = this.getSignificantFactors(components);

    logger.debug(
      { entityId, score: clampedScore, level, components },
      'Trust calculated'
    );

    return {
      score: clampedScore,
      level,
      components,
      factors,
    };
  }

  /**
   * Get trust score for an entity
   */
  async getScore(entityId: ID): Promise<TrustRecord | undefined> {
    const db = await this.ensureInitialized();

    const result = await db
      .select()
      .from(trustRecords)
      .where(eq(trustRecords.entityId, entityId))
      .limit(1);

    if (result.length === 0) return undefined;

    const record = result[0]!;

    // Check if recalculation is needed (older than 1 minute)
    const staleness = Date.now() - record.lastCalculatedAt.getTime();
    if (staleness > 60000) {
      // Recalculate
      const calculation = await this.calculate(entityId);

      // Update record
      await db
        .update(trustRecords)
        .set({
          score: calculation.score,
          level: calculation.level.toString() as '0' | '1' | '2' | '3' | '4',
          behavioralScore: calculation.components.behavioral,
          complianceScore: calculation.components.compliance,
          identityScore: calculation.components.identity,
          contextScore: calculation.components.context,
          lastCalculatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(trustRecords.entityId, entityId));

      record.score = calculation.score;
      record.level = calculation.level.toString() as '0' | '1' | '2' | '3' | '4';
      record.behavioralScore = calculation.components.behavioral;
      record.complianceScore = calculation.components.compliance;
      record.identityScore = calculation.components.identity;
      record.contextScore = calculation.components.context;
      record.lastCalculatedAt = new Date();
    }

    // Get recent signals
    const signals = await db
      .select()
      .from(trustSignals)
      .where(eq(trustSignals.entityId, entityId))
      .orderBy(desc(trustSignals.timestamp))
      .limit(100);

    // Get history
    const history = await db
      .select()
      .from(trustHistory)
      .where(eq(trustHistory.entityId, entityId))
      .orderBy(desc(trustHistory.timestamp))
      .limit(100);

    // Apply stepped decay based on inactivity
    const lastActivityAt = record.lastActivityAt ?? record.lastCalculatedAt;
    const daysSinceActivity = this.calculateInactiveDays(lastActivityAt);
    const decayMultiplier = this.calculateDecayMultiplier(daysSinceActivity);
    const baseScore = record.score;
    const decayedScore = this.applyDecay(baseScore, daysSinceActivity);
    const decayApplied = daysSinceActivity > 0;

    // Recalculate level based on decayed score
    const decayedLevel = this.scoreToLevel(decayedScore);

    logger.debug(
      {
        entityId,
        baseScore,
        decayedScore,
        daysSinceActivity,
        decayMultiplier,
      },
      'Decay applied to trust score'
    );

    return {
      entityId: record.entityId,
      score: decayedScore,
      level: decayedLevel,
      components: {
        behavioral: record.behavioralScore,
        compliance: record.complianceScore,
        identity: record.identityScore,
        context: record.contextScore,
      },
      signals: signals.map((s) => ({
        id: s.id,
        entityId: s.entityId,
        type: s.type,
        value: s.value,
        weight: s.weight,
        source: s.source ?? '',
        metadata: (s.metadata as Record<string, unknown>) ?? {},
        timestamp: s.timestamp.toISOString(),
      })),
      lastCalculatedAt: record.lastCalculatedAt.toISOString(),
      lastActivityAt: lastActivityAt.toISOString(),
      history: history.map((h) => ({
        score: h.score,
        level: parseInt(h.level) as TrustLevel,
        reason: h.reason,
        timestamp: h.timestamp.toISOString(),
      })),
      // Decay information
      decayApplied,
      decayMultiplier,
      baseScore,
      nextMilestone: this.getNextMilestone(daysSinceActivity),
    };
  }

  /**
   * Record a trust signal
   */
  async recordSignal(signal: TrustSignalType): Promise<void> {
    const db = await this.ensureInitialized();

    // Insert the signal
    const newSignal: NewTrustSignal = {
      entityId: signal.entityId,
      type: signal.type,
      value: signal.value,
      weight: signal.weight ?? 1.0,
      source: signal.source ?? null,
      metadata: signal.metadata ?? null,
      timestamp: signal.timestamp ? new Date(signal.timestamp) : new Date(),
    };

    const [insertedSignal] = await db
      .insert(trustSignals)
      .values(newSignal)
      .returning();

    // Get or create trust record
    let record = await db
      .select()
      .from(trustRecords)
      .where(eq(trustRecords.entityId, signal.entityId))
      .limit(1);

    if (record.length === 0) {
      // Create initial record with lastActivityAt for decay tracking
      const nowDate = new Date();
      const initialRecord: NewTrustRecord = {
        entityId: signal.entityId,
        score: 200,
        level: '1',
        behavioralScore: 0.5,
        complianceScore: 0.5,
        identityScore: 0.5,
        contextScore: 0.5,
        signalCount: 1,
        lastCalculatedAt: nowDate,
        lastActivityAt: nowDate,
      };

      await db.insert(trustRecords).values(initialRecord);
      record = [{ ...initialRecord, id: crypto.randomUUID(), createdAt: nowDate, updatedAt: nowDate, lastActivityAt: nowDate }] as any;
    }

    const currentRecord = record[0]!;
    const previousScore = currentRecord.score;
    const previousLevel = parseInt(currentRecord.level) as TrustLevel;

    // Recalculate
    const calculation = await this.calculate(signal.entityId);

    // Update record - reset decay clock with lastActivityAt
    const now = new Date();
    await db
      .update(trustRecords)
      .set({
        score: calculation.score,
        level: calculation.level.toString() as '0' | '1' | '2' | '3' | '4',
        behavioralScore: calculation.components.behavioral,
        complianceScore: calculation.components.compliance,
        identityScore: calculation.components.identity,
        contextScore: calculation.components.context,
        signalCount: sql`${trustRecords.signalCount} + 1`,
        lastCalculatedAt: now,
        lastActivityAt: now, // Reset decay clock on trust-positive activity
        updatedAt: now,
      })
      .where(eq(trustRecords.entityId, signal.entityId));

    // Record history if significant change
    if (Math.abs(calculation.score - previousScore) >= 10) {
      const historyEntry: NewTrustHistory = {
        entityId: signal.entityId,
        score: calculation.score,
        previousScore,
        level: calculation.level.toString() as '0' | '1' | '2' | '3' | '4',
        previousLevel: previousLevel.toString() as '0' | '1' | '2' | '3' | '4',
        reason: `Signal: ${signal.type}`,
        signalId: insertedSignal?.id,
        timestamp: new Date(),
      };

      await db.insert(trustHistory).values(historyEntry);
    }

    logger.debug(
      {
        entityId: signal.entityId,
        signalType: signal.type,
        newScore: calculation.score,
      },
      'Signal recorded'
    );
  }

  /**
   * Initialize trust for a new entity
   */
  async initializeEntity(
    entityId: ID,
    initialLevel: TrustLevel = 1
  ): Promise<TrustRecord> {
    const db = await this.ensureInitialized();

    const score = TRUST_THRESHOLDS[initialLevel].min;
    const now = new Date();

    const newRecord: NewTrustRecord = {
      entityId,
      score,
      level: initialLevel.toString() as '0' | '1' | '2' | '3' | '4',
      behavioralScore: 0.5,
      complianceScore: 0.5,
      identityScore: 0.5,
      contextScore: 0.5,
      signalCount: 0,
      lastCalculatedAt: now,
      lastActivityAt: now,
    };

    await db.insert(trustRecords).values(newRecord);

    // Record initial history
    const historyEntry: NewTrustHistory = {
      entityId,
      score,
      level: initialLevel.toString() as '0' | '1' | '2' | '3' | '4',
      reason: 'Initial registration',
      timestamp: now,
    };

    await db.insert(trustHistory).values(historyEntry);

    logger.info({ entityId, initialLevel }, 'Entity trust initialized');

    return {
      entityId,
      score,
      level: initialLevel,
      components: {
        behavioral: 0.5,
        compliance: 0.5,
        identity: 0.5,
        context: 0.5,
      },
      signals: [],
      lastCalculatedAt: now.toISOString(),
      lastActivityAt: now.toISOString(),
      history: [
        {
          score,
          level: initialLevel,
          reason: 'Initial registration',
          timestamp: now.toISOString(),
        },
      ],
      // New entity has no decay
      decayApplied: false,
      decayMultiplier: 1.0,
      baseScore: score,
      nextMilestone: DECAY_MILESTONES[1] ?? null,
    };
  }

  /**
   * Convert score to trust level
   */
  private scoreToLevel(score: TrustScore): TrustLevel {
    for (const [level, { min, max }] of Object.entries(TRUST_THRESHOLDS)) {
      if (score >= min && score <= max) {
        return parseInt(level) as TrustLevel;
      }
    }
    return 0;
  }

  /**
   * Calculate component scores from signals
   */
  private calculateComponents(signals: TrustSignalType[]): TrustComponents {
    // Group signals by type
    const behavioral = signals.filter((s) => s.type.startsWith('behavioral.'));
    const compliance = signals.filter((s) => s.type.startsWith('compliance.'));
    const identity = signals.filter((s) => s.type.startsWith('identity.'));
    const context = signals.filter((s) => s.type.startsWith('context.'));

    return {
      behavioral: this.averageSignalValue(behavioral, 0.5),
      compliance: this.averageSignalValue(compliance, 0.5),
      identity: this.averageSignalValue(identity, 0.5),
      context: this.averageSignalValue(context, 0.5),
    };
  }

  /**
   * Calculate average signal value with default
   */
  private averageSignalValue(
    signals: TrustSignalType[],
    defaultValue: number
  ): number {
    if (signals.length === 0) return defaultValue;

    // Weight recent signals more heavily
    const now = Date.now();
    let weightedSum = 0;
    let totalWeight = 0;

    for (const signal of signals) {
      const age = now - new Date(signal.timestamp).getTime();
      const timeWeight = Math.exp(-age / (7 * 24 * 60 * 60 * 1000)); // 7-day half-life
      const signalWeight = signal.weight ?? 1.0;
      const combinedWeight = timeWeight * signalWeight;

      weightedSum += signal.value * combinedWeight;
      totalWeight += combinedWeight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : defaultValue;
  }

  /**
   * Get significant factors affecting the score
   */
  private getSignificantFactors(components: TrustComponents): string[] {
    const factors: string[] = [];

    if (components.behavioral < 0.3) {
      factors.push('Low behavioral trust');
    }
    if (components.compliance < 0.3) {
      factors.push('Low compliance score');
    }
    if (components.identity < 0.3) {
      factors.push('Weak identity verification');
    }
    if (components.context < 0.3) {
      factors.push('Unusual context signals');
    }

    return factors;
  }

  /**
   * Calculate decay multiplier based on days since last activity
   *
   * Uses stepped milestones with interpolation for smooth decay.
   * 182-day half-life: after 182 days of inactivity, score is 50% of original.
   */
  private calculateDecayMultiplier(daysSinceLastActivity: number): number {
    // Find the applicable milestone and next milestone
    let applicableMilestone = DECAY_MILESTONES[0]!;
    let nextMilestone: DecayMilestone | null = null;

    for (let i = 0; i < DECAY_MILESTONES.length; i++) {
      if (daysSinceLastActivity >= DECAY_MILESTONES[i]!.days) {
        applicableMilestone = DECAY_MILESTONES[i]!;
        nextMilestone = DECAY_MILESTONES[i + 1] ?? null;
      }
    }

    // If beyond final milestone, use final multiplier
    if (!nextMilestone) {
      return applicableMilestone.multiplier;
    }

    // Interpolate between milestones for smooth decay
    const daysIntoMilestone = daysSinceLastActivity - applicableMilestone.days;
    const milestoneDuration = nextMilestone.days - applicableMilestone.days;
    const progress = daysIntoMilestone / milestoneDuration;

    const decayRange = applicableMilestone.multiplier - nextMilestone.multiplier;
    return applicableMilestone.multiplier - decayRange * progress;
  }

  /**
   * Apply decay to a base score
   */
  private applyDecay(baseScore: number, daysSinceLastActivity: number): number {
    const multiplier = this.calculateDecayMultiplier(daysSinceLastActivity);
    return Math.round(baseScore * multiplier);
  }

  /**
   * Calculate days since last activity from a date
   */
  private calculateInactiveDays(lastActivityAt: Date): number {
    const now = Date.now();
    const lastActivity = lastActivityAt.getTime();
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.floor((now - lastActivity) / msPerDay);
  }

  /**
   * Get the next decay milestone for an entity
   */
  private getNextMilestone(
    daysSinceLastActivity: number
  ): { days: number; multiplier: number } | null {
    for (const milestone of DECAY_MILESTONES) {
      if (milestone.days > daysSinceLastActivity) {
        return milestone;
      }
    }
    return null; // Already at or past final milestone
  }
}

/**
 * Create a new Trust Engine instance
 */
export function createTrustEngine(): TrustEngine {
  return new TrustEngine();
}
