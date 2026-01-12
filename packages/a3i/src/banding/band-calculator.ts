/**
 * BandCalculator - Trust band management with asymmetric transitions
 *
 * Key principles:
 * - Fast demotion: Safety-critical, immediate response to issues
 * - Slow promotion: Build trust gradually over time
 * - Hysteresis: Prevent oscillation near thresholds
 * - History tracking: Evidence-based promotion decisions
 */

import { v4 as uuidv4 } from 'uuid';
import { TrustBand, type BandingConfig, DEFAULT_BANDING_CONFIG } from '@vorion/contracts';
import { getBand, getNextBand, getBandName } from './bands.js';
import { HysteresisCalculator, type BandHistoryEntry } from './hysteresis.js';

/**
 * Band transition types
 */
export enum TransitionType {
  NONE = 'none',
  PROMOTION = 'promotion',
  DEMOTION = 'demotion',
}

/**
 * Result of a band transition attempt
 */
export interface TransitionResult {
  /** Was the transition allowed? */
  allowed: boolean;
  /** Type of transition */
  transitionType: TransitionType;
  /** Previous band */
  previousBand: TrustBand;
  /** New band (same as previous if not allowed) */
  newBand: TrustBand;
  /** Reason for the result */
  reason: string;
  /** Days until promotion (if blocked by time) */
  daysUntilPromotion?: number;
  /** Score needed for transition */
  scoreThreshold?: number;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Band stability metrics
 */
export interface BandStability {
  /** Current band */
  currentBand: TrustBand;
  /** Days at current band */
  daysAtBand: number;
  /** Number of transitions in last 30 days */
  recentTransitions: number;
  /** Is the band stable? */
  stable: boolean;
  /** Stability score (0-1) */
  stabilityScore: number;
}

/**
 * Band transition event for audit trail
 */
export interface BandTransitionEvent {
  /** Unique event ID */
  eventId: string;
  /** Agent ID */
  agentId: string;
  /** Transition type */
  transitionType: TransitionType;
  /** Previous band */
  fromBand: TrustBand;
  /** New band */
  toBand: TrustBand;
  /** Score at transition */
  score: number;
  /** Reason for transition */
  reason: string;
  /** Timestamp */
  timestamp: Date;
}

/**
 * BandCalculator - Manages trust band transitions
 */
export class BandCalculator {
  private readonly config: BandingConfig;
  private readonly hysteresis: HysteresisCalculator;
  private readonly historyByAgent: Map<string, BandHistoryEntry[]> = new Map();
  private readonly transitionEvents: BandTransitionEvent[] = [];

  constructor(config: Partial<BandingConfig> = {}) {
    this.config = { ...DEFAULT_BANDING_CONFIG, ...config };
    this.hysteresis = new HysteresisCalculator(this.config);
  }

  /**
   * Get the trust band for a score
   */
  getBand(score: number): TrustBand {
    return getBand(score, this.config.thresholds);
  }

  /**
   * Evaluate a potential band transition
   */
  evaluateTransition(
    agentId: string,
    currentBand: TrustBand,
    newScore: number,
    options: { now?: Date } = {}
  ): TransitionResult {
    const now = options.now ?? new Date();
    const rawNewBand = this.getBand(newScore);

    // No change
    if (rawNewBand === currentBand) {
      return {
        allowed: false,
        transitionType: TransitionType.NONE,
        previousBand: currentBand,
        newBand: currentBand,
        reason: 'Score still within current band range',
        timestamp: now,
      };
    }

    // Demotion - always immediate
    if (rawNewBand < currentBand) {
      return this.evaluateDemotion(agentId, currentBand, rawNewBand, newScore, now);
    }

    // Promotion - requires time and hysteresis
    return this.evaluatePromotion(agentId, currentBand, rawNewBand, newScore, now);
  }

  /**
   * Evaluate a demotion (always immediate for safety)
   */
  private evaluateDemotion(
    agentId: string,
    currentBand: TrustBand,
    _targetBand: TrustBand,
    score: number,
    now: Date
  ): TransitionResult {
    // Apply hysteresis - need to be clearly below threshold
    const effectiveBand = this.hysteresis.calculateBandWithHysteresis(
      currentBand,
      score
    );

    if (effectiveBand === currentBand) {
      const demotionThreshold = this.hysteresis.getDemotionThreshold(currentBand);
      return {
        allowed: false,
        transitionType: TransitionType.DEMOTION,
        previousBand: currentBand,
        newBand: currentBand,
        reason: 'Score within hysteresis buffer, demotion blocked',
        scoreThreshold: demotionThreshold ?? undefined,
        timestamp: now,
      };
    }

    // Demotion allowed
    this.recordTransition(agentId, currentBand, effectiveBand, score, 'Score dropped below threshold', now);

    return {
      allowed: true,
      transitionType: TransitionType.DEMOTION,
      previousBand: currentBand,
      newBand: effectiveBand,
      reason: `Demoted from ${getBandName(currentBand)} to ${getBandName(effectiveBand)}`,
      timestamp: now,
    };
  }

  /**
   * Evaluate a promotion (requires time at current band)
   */
  private evaluatePromotion(
    agentId: string,
    currentBand: TrustBand,
    _targetBand: TrustBand,
    score: number,
    now: Date
  ): TransitionResult {
    // Can only promote one level at a time
    const nextBand = getNextBand(currentBand);
    if (nextBand === null) {
      return {
        allowed: false,
        transitionType: TransitionType.PROMOTION,
        previousBand: currentBand,
        newBand: currentBand,
        reason: 'Already at maximum trust band (T5)',
        timestamp: now,
      };
    }

    // Apply hysteresis - need to be clearly above threshold
    const effectiveBand = this.hysteresis.calculateBandWithHysteresis(
      currentBand,
      score
    );

    if (effectiveBand === currentBand) {
      const promotionThreshold = this.hysteresis.getPromotionThreshold(currentBand);
      return {
        allowed: false,
        transitionType: TransitionType.PROMOTION,
        previousBand: currentBand,
        newBand: currentBand,
        reason: 'Score within hysteresis buffer, promotion blocked',
        scoreThreshold: promotionThreshold ?? undefined,
        timestamp: now,
      };
    }

    // Check time requirement
    const history = this.getHistory(agentId);
    const timeCheck = this.hysteresis.canPromoteByTime(history, nextBand);

    if (!timeCheck.allowed) {
      const daysRemaining = timeCheck.daysRequired - timeCheck.daysAtCurrentBand;
      return {
        allowed: false,
        transitionType: TransitionType.PROMOTION,
        previousBand: currentBand,
        newBand: currentBand,
        reason: `Promotion requires ${timeCheck.daysRequired} days at current band (${timeCheck.daysAtCurrentBand} days so far)`,
        daysUntilPromotion: Math.max(0, daysRemaining),
        timestamp: now,
      };
    }

    // Promotion allowed
    this.recordTransition(agentId, currentBand, nextBand, score, 'Met promotion requirements', now);

    return {
      allowed: true,
      transitionType: TransitionType.PROMOTION,
      previousBand: currentBand,
      newBand: nextBand,
      reason: `Promoted from ${getBandName(currentBand)} to ${getBandName(nextBand)}`,
      timestamp: now,
    };
  }

  /**
   * Record a band transition
   */
  private recordTransition(
    agentId: string,
    fromBand: TrustBand,
    toBand: TrustBand,
    score: number,
    reason: string,
    timestamp: Date
  ): void {
    // Update history
    const history = this.getHistory(agentId);
    history.push({ band: toBand, score, timestamp });
    this.historyByAgent.set(agentId, history);

    // Record event
    const event: BandTransitionEvent = {
      eventId: uuidv4(),
      agentId,
      transitionType: toBand > fromBand ? TransitionType.PROMOTION : TransitionType.DEMOTION,
      fromBand,
      toBand,
      score,
      reason,
      timestamp,
    };
    this.transitionEvents.push(event);
  }

  /**
   * Record a score snapshot (for history tracking)
   */
  recordScoreSnapshot(
    agentId: string,
    band: TrustBand,
    score: number,
    timestamp: Date = new Date()
  ): void {
    const history = this.getHistory(agentId);

    // Only add if band changed or first entry
    if (history.length === 0 || history[history.length - 1]!.band !== band) {
      history.push({ band, score, timestamp });
      this.historyByAgent.set(agentId, history);
    }
  }

  /**
   * Get band history for an agent
   */
  getHistory(agentId: string): BandHistoryEntry[] {
    return this.historyByAgent.get(agentId) ?? [];
  }

  /**
   * Get transition events for an agent
   */
  getTransitionEvents(agentId: string): BandTransitionEvent[] {
    return this.transitionEvents.filter((e) => e.agentId === agentId);
  }

  /**
   * Calculate band stability metrics
   */
  calculateStability(agentId: string, now: Date = new Date()): BandStability {
    const history = this.getHistory(agentId);

    if (history.length === 0) {
      return {
        currentBand: TrustBand.T0_UNTRUSTED,
        daysAtBand: 0,
        recentTransitions: 0,
        stable: false,
        stabilityScore: 0,
      };
    }

    const currentEntry = history[history.length - 1]!;
    const daysAtBand = (now.getTime() - currentEntry.timestamp.getTime()) / (1000 * 60 * 60 * 24);

    // Count transitions in last 30 days
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    let recentTransitions = 0;
    for (let i = 1; i < history.length; i++) {
      if (
        history[i]!.timestamp > thirtyDaysAgo &&
        history[i]!.band !== history[i - 1]!.band
      ) {
        recentTransitions++;
      }
    }

    // Calculate stability score
    // - More days at band = more stable
    // - Fewer transitions = more stable
    const timeComponent = Math.min(1, daysAtBand / 30); // Max at 30 days
    const transitionComponent = Math.max(0, 1 - recentTransitions * 0.2); // Penalty for transitions
    const stabilityScore = (timeComponent + transitionComponent) / 2;

    return {
      currentBand: currentEntry.band,
      daysAtBand: Math.floor(daysAtBand),
      recentTransitions,
      stable: stabilityScore >= 0.7,
      stabilityScore: Math.round(stabilityScore * 100) / 100,
    };
  }

  /**
   * Clear history for an agent (for testing)
   */
  clearHistory(agentId: string): void {
    this.historyByAgent.delete(agentId);
  }

  /**
   * Get configuration
   */
  getConfig(): Readonly<BandingConfig> {
    return { ...this.config };
  }
}

/**
 * Create a BandCalculator with default configuration
 */
export function createBandCalculator(
  config?: Partial<BandingConfig>
): BandCalculator {
  return new BandCalculator(config);
}
