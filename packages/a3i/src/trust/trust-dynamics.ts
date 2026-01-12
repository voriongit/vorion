/**
 * Trust Dynamics - Asymmetric trust updates per ATSF v2.0
 *
 * Implements:
 * - Logarithmic gain (slow trust building)
 * - Exponential loss (fast trust loss, 10:1 ratio)
 * - Cooldown periods (7 days after any trust drop)
 * - Oscillation detection (circuit breaker trigger)
 *
 * Key principle: "Trust is hard to gain, easy to lose"
 */

import {
  type TrustDynamicsConfig,
  type TrustDynamicsState,
  type CooldownState,
  DEFAULT_TRUST_DYNAMICS,
} from '@orion/contracts';

/**
 * Result of a trust update operation
 */
export interface TrustUpdateResult {
  /** New trust score after update */
  newScore: number;
  /** Delta applied (can be 0 if blocked by cooldown) */
  delta: number;
  /** Whether the update was blocked by cooldown */
  blockedByCooldown: boolean;
  /** Whether this triggered a circuit breaker */
  circuitBreakerTripped: boolean;
  /** Reason for circuit breaker if tripped */
  circuitBreakerReason?: string;
  /** Whether oscillation was detected */
  oscillationDetected: boolean;
  /** Updated dynamics state */
  state: TrustDynamicsState;
}

/**
 * Options for trust update
 */
export interface TrustUpdateOptions {
  /** Current trust score (0-100) */
  currentScore: number;
  /** Whether the observation was successful */
  success: boolean;
  /** Trust ceiling based on observation tier (0-100) */
  ceiling: number;
  /** Magnitude of the outcome (for weighted updates) */
  magnitude?: number;
  /** Whether this is an outcome reversal (provisional success → final failure) */
  isReversal?: boolean;
  /** Current time (for testing) */
  now?: Date;
}

/**
 * TrustDynamicsEngine - Implements asymmetric trust scoring
 */
export class TrustDynamicsEngine {
  private readonly config: TrustDynamicsConfig;
  private readonly states: Map<string, TrustDynamicsState> = new Map();

  constructor(config: Partial<TrustDynamicsConfig> = {}) {
    this.config = { ...DEFAULT_TRUST_DYNAMICS, ...config };
  }

  /**
   * Get or create dynamics state for an agent
   */
  getState(agentId: string): TrustDynamicsState {
    let state = this.states.get(agentId);
    if (!state) {
      state = this.createInitialState(agentId);
      this.states.set(agentId, state);
    }
    return state;
  }

  /**
   * Create initial dynamics state for a new agent
   */
  private createInitialState(agentId: string): TrustDynamicsState {
    return {
      agentId,
      cooldown: { inCooldown: false },
      directionChanges: [],
      lastDirection: 'none',
      circuitBreakerTripped: false,
    };
  }

  /**
   * Update trust score with asymmetric dynamics
   *
   * Gain: delta = gainRate * log(1 + (ceiling - current))
   * Loss: delta = -lossRate * current
   *
   * Gain is blocked during cooldown period.
   * Circuit breaker trips on oscillation or low trust.
   */
  updateTrust(agentId: string, options: TrustUpdateOptions): TrustUpdateResult {
    const now = options.now ?? new Date();
    const state = this.getState(agentId);

    // Check if circuit breaker is already tripped
    if (state.circuitBreakerTripped) {
      return {
        newScore: options.currentScore,
        delta: 0,
        blockedByCooldown: false,
        circuitBreakerTripped: true,
        circuitBreakerReason: state.circuitBreakerReason,
        oscillationDetected: false,
        state,
      };
    }

    // Update cooldown state
    this.updateCooldownState(state, now);

    // Calculate delta based on success/failure
    let delta: number;
    let blockedByCooldown = false;
    const direction: 'gain' | 'loss' = options.success ? 'gain' : 'loss';

    if (options.success) {
      // Logarithmic gain: approaches ceiling asymptotically
      delta = this.calculateGain(options.currentScore, options.ceiling);

      // Block gain during cooldown
      if (state.cooldown.inCooldown) {
        delta = 0;
        blockedByCooldown = true;
      }
    } else {
      // Exponential loss: proportional to current trust
      delta = this.calculateLoss(options.currentScore, options.isReversal);

      // Start cooldown on any loss
      this.startCooldown(state, now, options.isReversal ? 'outcome_reversal' : 'trust_loss');
    }

    // Track direction changes for oscillation detection
    const oscillationDetected = this.trackDirectionChange(state, direction, options.currentScore, now);

    // Apply delta
    let newScore = this.clampScore(options.currentScore + delta, 0, options.ceiling);

    // Check for circuit breaker triggers
    let circuitBreakerTripped = false;
    let circuitBreakerReason: string | undefined;

    if (oscillationDetected) {
      circuitBreakerTripped = true;
      circuitBreakerReason = 'oscillation_detected';
      this.tripCircuitBreaker(state, circuitBreakerReason, now);
    } else if (newScore < this.config.circuitBreakerThreshold) {
      circuitBreakerTripped = true;
      circuitBreakerReason = 'trust_below_threshold';
      this.tripCircuitBreaker(state, circuitBreakerReason, now);
    }

    // Update last direction
    state.lastDirection = direction;

    return {
      newScore,
      delta,
      blockedByCooldown,
      circuitBreakerTripped,
      circuitBreakerReason,
      oscillationDetected,
      state,
    };
  }

  /**
   * Calculate trust gain using logarithmic formula
   * delta = gainRate * log(1 + (ceiling - current))
   *
   * This creates diminishing returns as trust approaches ceiling
   */
  private calculateGain(currentScore: number, ceiling: number): number {
    const headroom = Math.max(0, ceiling - currentScore);
    const delta = this.config.gainRate * Math.log(1 + headroom);
    return Math.max(0, delta);
  }

  /**
   * Calculate trust loss using exponential formula
   * delta = -lossRate * current
   *
   * This creates proportional loss - higher trust means bigger absolute drop
   */
  private calculateLoss(currentScore: number, isReversal?: boolean): number {
    let multiplier = this.config.lossRate;

    // Apply reversal penalty (2x by default)
    if (isReversal) {
      multiplier *= this.config.reversalPenaltyMultiplier;
    }

    const delta = -multiplier * currentScore;
    return delta;
  }

  /**
   * Update cooldown state based on current time
   */
  private updateCooldownState(state: TrustDynamicsState, now: Date): void {
    if (state.cooldown.inCooldown && state.cooldown.cooldownEndsAt) {
      if (now >= state.cooldown.cooldownEndsAt) {
        // Cooldown has expired
        state.cooldown = { inCooldown: false };
      }
    }
  }

  /**
   * Start a cooldown period
   */
  private startCooldown(state: TrustDynamicsState, now: Date, reason: string): void {
    const cooldownMs = this.config.cooldownHours * 60 * 60 * 1000;
    state.cooldown = {
      inCooldown: true,
      cooldownStartedAt: now,
      cooldownEndsAt: new Date(now.getTime() + cooldownMs),
      reason,
    };
  }

  /**
   * Track direction changes for oscillation detection
   * Returns true if oscillation threshold is exceeded
   */
  private trackDirectionChange(
    state: TrustDynamicsState,
    newDirection: 'gain' | 'loss',
    currentScore: number,
    now: Date
  ): boolean {
    // Only track if direction actually changed
    if (state.lastDirection !== 'none' && state.lastDirection !== newDirection) {
      state.directionChanges.push({
        timestamp: now,
        from: state.lastDirection,
        to: newDirection,
        scoreAtChange: currentScore,
      });
    }

    // Clean up old direction changes outside the window
    const windowMs = this.config.oscillationWindowHours * 60 * 60 * 1000;
    const cutoff = new Date(now.getTime() - windowMs);
    state.directionChanges = state.directionChanges.filter(
      (dc) => dc.timestamp >= cutoff
    );

    // Check if oscillation threshold is exceeded
    return state.directionChanges.length >= this.config.oscillationThreshold;
  }

  /**
   * Trip the circuit breaker
   */
  private tripCircuitBreaker(state: TrustDynamicsState, reason: string, now: Date): void {
    state.circuitBreakerTripped = true;
    state.circuitBreakerReason = reason;
    state.circuitBreakerTrippedAt = now;
  }

  /**
   * Reset circuit breaker (requires admin action)
   */
  resetCircuitBreaker(agentId: string, adminOverride: boolean = false): boolean {
    const state = this.states.get(agentId);
    if (!state) return false;

    if (!adminOverride) {
      // Require 24-hour cooldown after circuit breaker
      if (state.circuitBreakerTrippedAt) {
        const minResetTime = new Date(state.circuitBreakerTrippedAt.getTime() + 24 * 60 * 60 * 1000);
        if (new Date() < minResetTime) {
          return false;
        }
      }
    }

    // Reset to half-open state
    state.circuitBreakerTripped = false;
    state.circuitBreakerReason = undefined;
    state.circuitBreakerTrippedAt = undefined;
    state.directionChanges = [];

    return true;
  }

  /**
   * Check if agent is in cooldown
   */
  isInCooldown(agentId: string, now: Date = new Date()): boolean {
    const state = this.states.get(agentId);
    if (!state) return false;

    this.updateCooldownState(state, now);
    return state.cooldown.inCooldown;
  }

  /**
   * Check if circuit breaker is tripped
   */
  isCircuitBreakerTripped(agentId: string): boolean {
    const state = this.states.get(agentId);
    return state?.circuitBreakerTripped ?? false;
  }

  /**
   * Get cooldown info for an agent
   */
  getCooldownInfo(agentId: string, now: Date = new Date()): CooldownState {
    const state = this.states.get(agentId);
    if (!state) return { inCooldown: false };

    this.updateCooldownState(state, now);
    return { ...state.cooldown };
  }

  /**
   * Get time remaining in cooldown (in hours)
   */
  getCooldownRemainingHours(agentId: string, now: Date = new Date()): number {
    const state = this.states.get(agentId);
    if (!state || !state.cooldown.inCooldown || !state.cooldown.cooldownEndsAt) {
      return 0;
    }

    this.updateCooldownState(state, now);
    if (!state.cooldown.inCooldown) return 0;

    const remainingMs = state.cooldown.cooldownEndsAt!.getTime() - now.getTime();
    return Math.max(0, remainingMs / (60 * 60 * 1000));
  }

  /**
   * Apply time-based decay to a trust score
   *
   * Decay formula: score * (1 - decayRate)^days
   */
  applyDecay(currentScore: number, daysSinceUpdate: number, decayRate?: number): number {
    const rate = decayRate ?? this.config.gainRate; // Use gain rate as default decay
    const decayFactor = Math.pow(1 - rate, daysSinceUpdate);
    return currentScore * decayFactor;
  }

  /**
   * Calculate asymmetry ratio (loss rate / gain rate)
   */
  getAsymmetryRatio(): number {
    return this.config.lossRate / this.config.gainRate;
  }

  /**
   * Get the current configuration
   */
  getConfig(): Readonly<TrustDynamicsConfig> {
    return { ...this.config };
  }

  /**
   * Clamp a score within bounds
   */
  private clampScore(score: number, min: number, max: number): number {
    return Math.round(Math.max(min, Math.min(max, score)) * 100) / 100;
  }

  /**
   * Clear all state (for testing)
   */
  clearAllState(): void {
    this.states.clear();
  }
}

/**
 * Create a trust dynamics engine with default configuration
 */
export function createTrustDynamicsEngine(
  config?: Partial<TrustDynamicsConfig>
): TrustDynamicsEngine {
  return new TrustDynamicsEngine(config);
}
