/**
 * Trust Engine - Behavioral Trust Scoring
 *
 * Calculates and maintains trust scores for entities based on behavioral signals.
 *
 * @packageDocumentation
 */

import { createLogger } from '../common/logger.js';
import type {
  TrustScore,
  TrustLevel,
  TrustSignal,
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
  signals: TrustSignal[];
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
 * Trust Engine service
 */
export class TrustEngine {
  private records: Map<ID, TrustRecord> = new Map();
  private readonly decayRate: number;

  constructor(decayRate: number = 0.01) {
    this.decayRate = decayRate;
  }

  /**
   * Get the decay rate used for trust score calculations
   */
  getDecayRate(): number {
    return this.decayRate;
  }

  /**
   * Calculate trust score for an entity
   */
  async calculate(entityId: ID): Promise<TrustCalculation> {
    const record = this.records.get(entityId);
    const signals = record?.signals ?? [];

    // Calculate component scores
    const components = this.calculateComponents(signals);

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
    const record = this.records.get(entityId);

    if (record) {
      // Apply decay if stale
      const staleness = Date.now() - new Date(record.lastCalculatedAt).getTime();
      if (staleness > 60000) {
        // Recalculate if older than 1 minute
        const calculation = await this.calculate(entityId);
        record.score = calculation.score;
        record.level = calculation.level;
        record.components = calculation.components;
        record.lastCalculatedAt = new Date().toISOString();
      }
    }

    return record;
  }

  /**
   * Record a trust signal
   */
  async recordSignal(signal: TrustSignal): Promise<void> {
    let record = this.records.get(signal.entityId);

    if (!record) {
      record = this.createInitialRecord(signal.entityId);
      this.records.set(signal.entityId, record);
    }

    // Add signal
    record.signals.push(signal);

    // Keep only recent signals (last 1000)
    if (record.signals.length > 1000) {
      record.signals = record.signals.slice(-1000);
    }

    // Recalculate
    const calculation = await this.calculate(signal.entityId);

    // Update record
    const previousScore = record.score;
    record.score = calculation.score;
    record.level = calculation.level;
    record.components = calculation.components;
    record.lastCalculatedAt = new Date().toISOString();

    // Record history if significant change
    if (Math.abs(calculation.score - previousScore) >= 10) {
      record.history.push({
        score: calculation.score,
        level: calculation.level,
        reason: `Signal: ${signal.type}`,
        timestamp: new Date().toISOString(),
      });

      // Keep last 100 history entries
      if (record.history.length > 100) {
        record.history = record.history.slice(-100);
      }
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
  async initializeEntity(entityId: ID, initialLevel: TrustLevel = 1): Promise<TrustRecord> {
    const score = TRUST_THRESHOLDS[initialLevel].min;
    const record: TrustRecord = {
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
      lastCalculatedAt: new Date().toISOString(),
      history: [
        {
          score,
          level: initialLevel,
          reason: 'Initial registration',
          timestamp: new Date().toISOString(),
        },
      ],
    };

    this.records.set(entityId, record);
    logger.info({ entityId, initialLevel }, 'Entity trust initialized');

    return record;
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
  private calculateComponents(signals: TrustSignal[]): TrustComponents {
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
  private averageSignalValue(signals: TrustSignal[], defaultValue: number): number {
    if (signals.length === 0) return defaultValue;

    // Weight recent signals more heavily
    const now = Date.now();
    let weightedSum = 0;
    let totalWeight = 0;

    for (const signal of signals) {
      const age = now - new Date(signal.timestamp).getTime();
      const weight = Math.exp(-age / (7 * 24 * 60 * 60 * 1000)); // 7-day half-life
      weightedSum += signal.value * weight;
      totalWeight += weight;
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
   * Create initial trust record
   */
  private createInitialRecord(entityId: ID): TrustRecord {
    return {
      entityId,
      score: 200, // Start at L1 minimum
      level: 1,
      components: {
        behavioral: 0.5,
        compliance: 0.5,
        identity: 0.5,
        context: 0.5,
      },
      signals: [],
      lastCalculatedAt: new Date().toISOString(),
      history: [],
    };
  }
}

/**
 * Create a new Trust Engine instance
 */
export function createTrustEngine(decayRate?: number): TrustEngine {
  return new TrustEngine(decayRate);
}
