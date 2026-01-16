/**
 * Trust Engine - Behavioral Trust Scoring
 *
 * Calculates and maintains trust scores for entities based on behavioral signals.
 * Features 6-tier trust system with event emission for observability.
 *
 * @packageDocumentation
 */

import { EventEmitter } from 'events';
import { createLogger } from '../common/logger.js';
import type {
  TrustScore,
  TrustLevel,
  TrustSignal,
  TrustComponents,
  ID,
} from '../common/types.js';
import type { PersistenceProvider } from '../persistence/types.js';

const logger = createLogger({ component: 'trust-engine' });

/**
 * Trust level thresholds (6 tiers) - per BASIS specification
 */
export const TRUST_THRESHOLDS: Record<TrustLevel, { min: number; max: number }> = {
  0: { min: 0, max: 99 },       // Sandbox
  1: { min: 100, max: 299 },    // Provisional
  2: { min: 300, max: 499 },    // Standard
  3: { min: 500, max: 699 },    // Trusted
  4: { min: 700, max: 899 },    // Certified
  5: { min: 900, max: 1000 },   // Autonomous
};

/**
 * Trust level names (6 tiers) - per BASIS specification
 */
export const TRUST_LEVEL_NAMES: Record<TrustLevel, string> = {
  0: 'Sandbox',
  1: 'Provisional',
  2: 'Standard',
  3: 'Trusted',
  4: 'Certified',
  5: 'Autonomous',
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
 * Trust event types
 */
export type TrustEventType =
  | 'trust:initialized'
  | 'trust:signal_recorded'
  | 'trust:score_changed'
  | 'trust:tier_changed'
  | 'trust:decay_applied'
  | 'trust:failure_detected';

/**
 * Base trust event
 */
export interface TrustEvent {
  type: TrustEventType;
  entityId: ID;
  timestamp: string;
}

/**
 * Entity initialized event
 */
export interface TrustInitializedEvent extends TrustEvent {
  type: 'trust:initialized';
  initialScore: TrustScore;
  initialLevel: TrustLevel;
}

/**
 * Signal recorded event
 */
export interface TrustSignalRecordedEvent extends TrustEvent {
  type: 'trust:signal_recorded';
  signal: TrustSignal;
  previousScore: TrustScore;
  newScore: TrustScore;
}

/**
 * Score changed event
 */
export interface TrustScoreChangedEvent extends TrustEvent {
  type: 'trust:score_changed';
  previousScore: TrustScore;
  newScore: TrustScore;
  delta: number;
  reason: string;
}

/**
 * Tier changed event
 */
export interface TrustTierChangedEvent extends TrustEvent {
  type: 'trust:tier_changed';
  previousLevel: TrustLevel;
  newLevel: TrustLevel;
  previousLevelName: string;
  newLevelName: string;
  direction: 'promoted' | 'demoted';
}

/**
 * Decay applied event
 */
export interface TrustDecayAppliedEvent extends TrustEvent {
  type: 'trust:decay_applied';
  previousScore: TrustScore;
  newScore: TrustScore;
  decayAmount: number;
  stalenessMs: number;
  accelerated: boolean;
}

/**
 * Failure detected event
 */
export interface TrustFailureDetectedEvent extends TrustEvent {
  type: 'trust:failure_detected';
  signal: TrustSignal;
  failureCount: number;
  acceleratedDecayActive: boolean;
}

/**
 * Union of all trust events
 */
export type AnyTrustEvent =
  | TrustInitializedEvent
  | TrustSignalRecordedEvent
  | TrustScoreChangedEvent
  | TrustTierChangedEvent
  | TrustDecayAppliedEvent
  | TrustFailureDetectedEvent;

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
  /** Recent failure timestamps for accelerated decay */
  recentFailures: string[];
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
 * Trust Engine configuration
 */
export interface TrustEngineConfig {
  /** Base decay rate per interval (default: 0.01 = 1%) */
  decayRate?: number;
  /** Decay interval in milliseconds (default: 60000 = 1 minute) */
  decayIntervalMs?: number;
  /** Signal value threshold below which a signal is considered a failure (default: 0.3) */
  failureThreshold?: number;
  /** Multiplier applied to decay rate when entity has recent failures (default: 3.0) */
  acceleratedDecayMultiplier?: number;
  /** Time window in ms to consider failures as "recent" (default: 3600000 = 1 hour) */
  failureWindowMs?: number;
  /** Minimum failures within window to trigger accelerated decay (default: 2) */
  minFailuresForAcceleration?: number;
  /** Persistence provider for storing trust records */
  persistence?: PersistenceProvider;
  /** Auto-persist changes (default: true when persistence is provided) */
  autoPersist?: boolean;
}

/**
 * Trust Engine service with event emission
 */
export class TrustEngine extends EventEmitter {
  private records: Map<ID, TrustRecord> = new Map();
  private _decayRate: number;
  private _decayIntervalMs: number;
  private _failureThreshold: number;
  private _acceleratedDecayMultiplier: number;
  private _failureWindowMs: number;
  private _minFailuresForAcceleration: number;
  private _persistence?: PersistenceProvider;
  private _autoPersist: boolean;

  constructor(config: TrustEngineConfig = {}) {
    super();
    this._decayRate = config.decayRate ?? 0.01;
    this._decayIntervalMs = config.decayIntervalMs ?? 60000;
    this._failureThreshold = config.failureThreshold ?? 0.3;
    this._acceleratedDecayMultiplier = config.acceleratedDecayMultiplier ?? 3.0;
    this._failureWindowMs = config.failureWindowMs ?? 3600000; // 1 hour
    this._minFailuresForAcceleration = config.minFailuresForAcceleration ?? 2;
    this._persistence = config.persistence;
    this._autoPersist = config.autoPersist ?? (config.persistence !== undefined);
  }

  /**
   * Get the current decay rate
   */
  get decayRate(): number {
    return this._decayRate;
  }

  /**
   * Get the decay interval in milliseconds
   */
  get decayIntervalMs(): number {
    return this._decayIntervalMs;
  }

  /**
   * Get the failure threshold
   */
  get failureThreshold(): number {
    return this._failureThreshold;
  }

  /**
   * Get the accelerated decay multiplier
   */
  get acceleratedDecayMultiplier(): number {
    return this._acceleratedDecayMultiplier;
  }

  /**
   * Get the persistence provider
   */
  get persistence(): PersistenceProvider | undefined {
    return this._persistence;
  }

  /**
   * Load all records from persistence
   */
  async loadFromPersistence(): Promise<number> {
    if (!this._persistence) {
      throw new Error('No persistence provider configured');
    }

    const records = await this._persistence.query();
    this.records.clear();

    for (const record of records) {
      this.records.set(record.entityId, record);
    }

    logger.info({ count: records.length }, 'Loaded trust records from persistence');
    return records.length;
  }

  /**
   * Save all records to persistence
   */
  async saveToPersistence(): Promise<number> {
    if (!this._persistence) {
      throw new Error('No persistence provider configured');
    }

    let count = 0;
    for (const record of this.records.values()) {
      await this._persistence.save(record);
      count++;
    }

    logger.info({ count }, 'Saved trust records to persistence');
    return count;
  }

  /**
   * Persist a single record if auto-persist is enabled
   */
  private async autoPersistRecord(record: TrustRecord): Promise<void> {
    if (this._persistence && this._autoPersist) {
      await this._persistence.save(record);
    }
  }

  /**
   * Close the trust engine and persistence provider
   */
  async close(): Promise<void> {
    if (this._persistence) {
      await this._persistence.close();
    }
    this.removeAllListeners();
  }

  /**
   * Emit a trust event
   */
  private emitTrustEvent(event: AnyTrustEvent): void {
    this.emit(event.type, event);
    this.emit('trust:*', event); // Wildcard for all events
    logger.debug({ event }, 'Trust event emitted');
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
   * Check if an entity has accelerated decay active
   */
  private hasAcceleratedDecay(record: TrustRecord): boolean {
    const now = Date.now();
    const recentFailures = record.recentFailures.filter(
      (timestamp) => now - new Date(timestamp).getTime() < this._failureWindowMs
    );
    return recentFailures.length >= this._minFailuresForAcceleration;
  }

  /**
   * Clean up old failure timestamps outside the window
   */
  private cleanupFailures(record: TrustRecord): void {
    const now = Date.now();
    record.recentFailures = record.recentFailures.filter(
      (timestamp) => now - new Date(timestamp).getTime() < this._failureWindowMs
    );
  }

  /**
   * Get trust score for an entity (with automatic decay)
   */
  async getScore(entityId: ID): Promise<TrustRecord | undefined> {
    const record = this.records.get(entityId);

    if (record) {
      // Clean up old failures
      this.cleanupFailures(record);

      // Apply decay if stale
      const staleness = Date.now() - new Date(record.lastCalculatedAt).getTime();
      if (staleness > this._decayIntervalMs) {
        const previousScore = record.score;
        const previousLevel = record.level;

        // Check if accelerated decay should apply
        const accelerated = this.hasAcceleratedDecay(record);
        const effectiveDecayRate = accelerated
          ? this._decayRate * this._acceleratedDecayMultiplier
          : this._decayRate;

        // Apply decay based on staleness
        const decayPeriods = Math.floor(staleness / this._decayIntervalMs);
        const decayMultiplier = Math.pow(1 - effectiveDecayRate, decayPeriods);
        const decayedScore = Math.round(record.score * decayMultiplier);
        const clampedScore = Math.max(0, decayedScore);

        record.score = clampedScore;
        record.level = this.scoreToLevel(clampedScore);
        record.lastCalculatedAt = new Date().toISOString();

        // Emit decay event
        if (previousScore !== record.score) {
          this.emitTrustEvent({
            type: 'trust:decay_applied',
            entityId,
            timestamp: new Date().toISOString(),
            previousScore,
            newScore: record.score,
            decayAmount: previousScore - record.score,
            stalenessMs: staleness,
            accelerated,
          });

          // Emit tier change if applicable
          if (previousLevel !== record.level) {
            this.emitTrustEvent({
              type: 'trust:tier_changed',
              entityId,
              timestamp: new Date().toISOString(),
              previousLevel,
              newLevel: record.level,
              previousLevelName: TRUST_LEVEL_NAMES[previousLevel],
              newLevelName: TRUST_LEVEL_NAMES[record.level],
              direction: record.level < previousLevel ? 'demoted' : 'promoted',
            });
          }

          // Auto-persist after decay
          await this.autoPersistRecord(record);
        }
      }
    }

    return record;
  }

  /**
   * Record a trust signal
   */
  async recordSignal(signal: TrustSignal): Promise<void> {
    let record = this.records.get(signal.entityId);
    let isNewEntity = false;

    if (!record) {
      record = this.createInitialRecord(signal.entityId);
      this.records.set(signal.entityId, record);
      isNewEntity = true;
    }

    const previousScore = record.score;
    const previousLevel = record.level;

    // Detect failure signals
    if (signal.value < this._failureThreshold) {
      record.recentFailures.push(signal.timestamp);
      this.cleanupFailures(record);

      const acceleratedDecayActive = this.hasAcceleratedDecay(record);

      this.emitTrustEvent({
        type: 'trust:failure_detected',
        entityId: signal.entityId,
        timestamp: new Date().toISOString(),
        signal,
        failureCount: record.recentFailures.length,
        acceleratedDecayActive,
      });

      logger.warn(
        {
          entityId: signal.entityId,
          signalType: signal.type,
          signalValue: signal.value,
          failureCount: record.recentFailures.length,
          acceleratedDecayActive,
        },
        'Failure signal detected'
      );
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

    // Emit signal recorded event
    this.emitTrustEvent({
      type: 'trust:signal_recorded',
      entityId: signal.entityId,
      timestamp: new Date().toISOString(),
      signal,
      previousScore,
      newScore: calculation.score,
    });

    // Emit score changed event if significant
    if (Math.abs(calculation.score - previousScore) >= 5) {
      this.emitTrustEvent({
        type: 'trust:score_changed',
        entityId: signal.entityId,
        timestamp: new Date().toISOString(),
        previousScore,
        newScore: calculation.score,
        delta: calculation.score - previousScore,
        reason: `Signal: ${signal.type}`,
      });
    }

    // Emit tier changed event if applicable
    if (previousLevel !== calculation.level && !isNewEntity) {
      this.emitTrustEvent({
        type: 'trust:tier_changed',
        entityId: signal.entityId,
        timestamp: new Date().toISOString(),
        previousLevel,
        newLevel: calculation.level,
        previousLevelName: TRUST_LEVEL_NAMES[previousLevel],
        newLevelName: TRUST_LEVEL_NAMES[calculation.level],
        direction: calculation.level > previousLevel ? 'promoted' : 'demoted',
      });
    }

    // Auto-persist if enabled
    await this.autoPersistRecord(record);

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
      recentFailures: [],
    };

    this.records.set(entityId, record);

    // Auto-persist if enabled
    await this.autoPersistRecord(record);

    // Emit initialized event
    this.emitTrustEvent({
      type: 'trust:initialized',
      entityId,
      timestamp: new Date().toISOString(),
      initialScore: score,
      initialLevel,
    });

    logger.info({ entityId, initialLevel }, 'Entity trust initialized');

    return record;
  }

  /**
   * Get all entity IDs
   */
  getEntityIds(): ID[] {
    return Array.from(this.records.keys());
  }

  /**
   * Get trust level name
   */
  getLevelName(level: TrustLevel): string {
    return TRUST_LEVEL_NAMES[level];
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
      score: TRUST_THRESHOLDS[1].min, // Start at L1 (Provisional) minimum
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
      recentFailures: [],
    };
  }

  /**
   * Check if accelerated decay is currently active for an entity
   */
  isAcceleratedDecayActive(entityId: ID): boolean {
    const record = this.records.get(entityId);
    if (!record) return false;
    return this.hasAcceleratedDecay(record);
  }

  /**
   * Get current failure count for an entity
   */
  getFailureCount(entityId: ID): number {
    const record = this.records.get(entityId);
    if (!record) return 0;
    this.cleanupFailures(record);
    return record.recentFailures.length;
  }
}

/**
 * Create a new Trust Engine instance
 */
export function createTrustEngine(config?: TrustEngineConfig): TrustEngine {
  return new TrustEngine(config);
}
