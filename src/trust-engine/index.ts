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
import { getDatabase } from '../common/db.js';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  trustRecords,
  trustSignals,
  trustHistory,
  type TrustRecord as TrustRecordRow,
  type NewTrustRecord,
  type NewTrustSignal,
  type NewTrustHistory,
  type TrustSignal as TrustSignalRow,
  type TrustHistory as TrustHistoryRow,
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
 * Entity trust record
 */
export interface TrustRecord {
  entityId: ID;
  score: TrustScore;
  level: TrustLevel;
  components: TrustComponents;
  signals: TrustSignalType[];
  lastCalculatedAt: string;
  history: TrustHistoryEntry[];
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
 */
export class TrustEngine {
  private db: NodePgDatabase | null = null;
  private initialized: boolean = false;

  constructor(_decayRate: number = 0.01) {
    // decayRate parameter reserved for future use
  }

  /**
   * Initialize the service
   */
  initialize(): void {
    if (this.initialized) return;

    this.db = getDatabase();
    this.initialized = true;
    logger.info('Trust engine initialized with database persistence');
  }

  /**
   * Ensure service is initialized
   */
  private ensureInitialized(): NodePgDatabase {
    if (!this.initialized || !this.db) {
      this.initialize();
    }
    return this.db!;
  }

  /**
   * Calculate trust score for an entity
   */
  async calculate(entityId: ID): Promise<TrustCalculation> {
    const db = this.ensureInitialized();

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
    const domainSignals: TrustSignalType[] = signals.map((s: TrustSignalRow) => ({
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
    const db = this.ensureInitialized();

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

    return {
      entityId: record.entityId,
      score: record.score,
      level: parseInt(record.level) as TrustLevel,
      components: {
        behavioral: record.behavioralScore,
        compliance: record.complianceScore,
        identity: record.identityScore,
        context: record.contextScore,
      },
      signals: signals.map((s: TrustSignalRow) => ({
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
      history: history.map((h: TrustHistoryRow) => ({
        score: h.score,
        level: parseInt(h.level) as TrustLevel,
        reason: h.reason,
        timestamp: h.timestamp.toISOString(),
      })),
    };
  }

  /**
   * Record a trust signal
   */
  async recordSignal(signal: TrustSignalType): Promise<void> {
    const db = this.ensureInitialized();

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
      // Create initial record
      const initialRecord: NewTrustRecord = {
        entityId: signal.entityId,
        score: 200,
        level: '1',
        behavioralScore: 0.5,
        complianceScore: 0.5,
        identityScore: 0.5,
        contextScore: 0.5,
        signalCount: 1,
        lastCalculatedAt: new Date(),
      };

      await db.insert(trustRecords).values(initialRecord);
      const insertedRecord: TrustRecordRow = {
        id: crypto.randomUUID(),
        entityId: signal.entityId,
        score: 200,
        level: '1',
        behavioralScore: 0.5,
        complianceScore: 0.5,
        identityScore: 0.5,
        contextScore: 0.5,
        signalCount: 1,
        lastCalculatedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      record = [insertedRecord];
    }

    const currentRecord = record[0]!;
    const previousScore = currentRecord.score;
    const previousLevel = parseInt(currentRecord.level) as TrustLevel;

    // Recalculate
    const calculation = await this.calculate(signal.entityId);

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
        signalCount: sql`${trustRecords.signalCount} + 1`,
        lastCalculatedAt: new Date(),
        updatedAt: new Date(),
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
        signalId: insertedSignal?.id ?? null,
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
    const db = this.ensureInitialized();

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
      history: [
        {
          score,
          level: initialLevel,
          reason: 'Initial registration',
          timestamp: now.toISOString(),
        },
      ],
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
}

/**
 * Create a new Trust Engine instance
 */
export function createTrustEngine(decayRate?: number): TrustEngine {
  return new TrustEngine(decayRate);
}

