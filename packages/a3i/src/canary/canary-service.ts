/**
 * Canary Probe Service - ATSF v2.0 Section 4.2
 *
 * Manages continuous behavioral verification through canary probes.
 *
 * Key properties:
 * - ANY canary failure triggers immediate circuit breaker
 * - Poisson injection (λ = 0.2/hour, ~5 probes/day)
 * - Indistinguishable from real queries
 * - Bypasses all trend analysis
 */

import {
  type CanaryProbe,
  type CanaryProbeResult,
  type CanaryProbeStats,
  type CanaryInjectionConfig,
  type CanaryFailureEvent,
  CanaryCategory,
  ValidationMode,
  DEFAULT_CANARY_CONFIG,
} from '@vorion/contracts';

import { TrustDynamicsEngine } from '../trust/trust-dynamics.js';
import {
  CANARY_PROBE_LIBRARY,
  getRandomProbe,
  getRandomProbeFromCategory,
  getProbeById,
} from './probe-library.js';

/**
 * Response function type for agent interaction
 */
export type AgentResponseFn = (prompt: string) => Promise<string>;

/**
 * Canary event listener
 */
export type CanaryEventListener = (event: CanaryFailureEvent) => void;

/**
 * CanaryProbeService - Manages canary probe execution and circuit breaker integration
 */
export class CanaryProbeService {
  private readonly config: CanaryInjectionConfig;
  private readonly trustEngine?: TrustDynamicsEngine;
  private readonly stats: Map<string, CanaryProbeStats> = new Map();
  private readonly lastProbeTime: Map<string, Date> = new Map();
  private readonly eventListeners: CanaryEventListener[] = [];

  constructor(
    config: Partial<CanaryInjectionConfig> = {},
    trustEngine?: TrustDynamicsEngine
  ) {
    this.config = { ...DEFAULT_CANARY_CONFIG, ...config };
    this.trustEngine = trustEngine;
  }

  /**
   * Execute a canary probe against an agent
   *
   * Per ATSF v2.0: ANY failure triggers immediate circuit breaker
   */
  async executeProbe(
    agentId: string,
    responseFn: AgentResponseFn,
    probe?: CanaryProbe
  ): Promise<CanaryProbeResult> {
    const selectedProbe = probe ?? this.selectProbe();
    const startTime = Date.now();

    // Get agent response
    let actualResponse: string;
    try {
      actualResponse = await responseFn(selectedProbe.prompt);
    } catch (error) {
      // Error during response = failure
      actualResponse = `[ERROR: ${error instanceof Error ? error.message : 'Unknown'}]`;
    }

    const responseTimeMs = Date.now() - startTime;

    // Validate response
    const passed = this.validateResponse(actualResponse, selectedProbe);

    // Determine if circuit breaker should trigger
    const triggeredCircuitBreaker = !passed && selectedProbe.critical;

    // Create result
    const result: CanaryProbeResult = {
      probeId: selectedProbe.probeId,
      agentId,
      passed,
      actualResponse,
      expectedResponse: selectedProbe.expectedAnswer,
      responseTimeMs,
      executedAt: new Date(),
      failureReason: passed ? undefined : this.getFailureReason(actualResponse, selectedProbe),
      triggeredCircuitBreaker,
    };

    // Update stats
    this.updateStats(agentId, result, selectedProbe.category);

    // Update last probe time
    this.lastProbeTime.set(agentId, new Date());

    // Handle failure
    if (!passed) {
      await this.handleFailure(agentId, result, selectedProbe);
    }

    return result;
  }

  /**
   * Execute multiple probes (for batch testing)
   */
  async executeProbes(
    agentId: string,
    responseFn: AgentResponseFn,
    count: number
  ): Promise<CanaryProbeResult[]> {
    const results: CanaryProbeResult[] = [];

    for (let i = 0; i < count; i++) {
      const result = await this.executeProbe(agentId, responseFn);
      results.push(result);

      // Stop if circuit breaker tripped
      if (result.triggeredCircuitBreaker) {
        break;
      }
    }

    return results;
  }

  /**
   * Check if it's time to inject a probe (Poisson process)
   */
  shouldInjectProbe(agentId: string, now: Date = new Date()): boolean {
    const lastProbe = this.lastProbeTime.get(agentId);

    // If never probed, inject
    if (!lastProbe) {
      return true;
    }

    // Check minimum interval
    const elapsedMs = now.getTime() - lastProbe.getTime();
    if (elapsedMs < this.config.minIntervalMs) {
      return false;
    }

    // Poisson probability: P(at least one event) = 1 - e^(-λt)
    const elapsedHours = elapsedMs / (1000 * 60 * 60);
    const probability = 1 - Math.exp(-this.config.lambda * elapsedHours);

    return Math.random() < probability;
  }

  /**
   * Get next expected probe time (probabilistic)
   */
  getExpectedNextProbeTime(agentId: string): Date | null {
    const lastProbe = this.lastProbeTime.get(agentId);
    if (!lastProbe) return new Date();

    // Expected time = 1/λ hours from last probe
    const expectedIntervalMs = (1 / this.config.lambda) * 60 * 60 * 1000;
    return new Date(lastProbe.getTime() + expectedIntervalMs);
  }

  /**
   * Select a probe based on category weights
   */
  private selectProbe(): CanaryProbe {
    const random = Math.random();
    let cumulative = 0;

    for (const [category, weight] of Object.entries(this.config.categoryWeights)) {
      cumulative += weight;
      if (random <= cumulative) {
        const probe = getRandomProbeFromCategory(category as CanaryCategory);
        if (probe) return probe;
      }
    }

    // Fallback to completely random
    return getRandomProbe();
  }

  /**
   * Validate agent response against expected answer
   */
  private validateResponse(response: string, probe: CanaryProbe): boolean {
    const normalizedResponse = response.toLowerCase().trim();

    switch (probe.validationMode) {
      case ValidationMode.EXACT: {
        const expected = Array.isArray(probe.expectedAnswer)
          ? probe.expectedAnswer[0]
          : probe.expectedAnswer;
        return normalizedResponse === expected?.toLowerCase().trim();
      }

      case ValidationMode.CONTAINS: {
        const expected = Array.isArray(probe.expectedAnswer)
          ? probe.expectedAnswer[0]
          : probe.expectedAnswer;
        return normalizedResponse.includes(expected?.toLowerCase().trim() ?? '');
      }

      case ValidationMode.NOT_CONTAINS: {
        const expected = Array.isArray(probe.expectedAnswer)
          ? probe.expectedAnswer[0]
          : probe.expectedAnswer;
        return !normalizedResponse.includes(expected?.toLowerCase().trim() ?? '');
      }

      case ValidationMode.REGEX: {
        if (!probe.regexPattern) return false;
        const regex = new RegExp(probe.regexPattern, 'i');
        return regex.test(response);
      }

      case ValidationMode.ONE_OF: {
        const answers = Array.isArray(probe.expectedAnswer)
          ? probe.expectedAnswer
          : [probe.expectedAnswer];
        return answers.some((answer) =>
          normalizedResponse.includes(answer.toLowerCase().trim())
        );
      }

      case ValidationMode.SEMANTIC:
        // Semantic validation would require LLM comparison
        // For now, fall back to contains
        return this.validateResponse(response, {
          ...probe,
          validationMode: ValidationMode.CONTAINS,
        });

      default:
        return false;
    }
  }

  /**
   * Get failure reason for a probe
   */
  private getFailureReason(response: string, probe: CanaryProbe): string {
    const expected = Array.isArray(probe.expectedAnswer)
      ? probe.expectedAnswer.join(' or ')
      : probe.expectedAnswer;

    return `Expected "${expected}" but got "${response.substring(0, 100)}${response.length > 100 ? '...' : ''}"`;
  }

  /**
   * Handle probe failure
   */
  private async handleFailure(
    agentId: string,
    result: CanaryProbeResult,
    probe: CanaryProbe
  ): Promise<void> {
    // Trip circuit breaker if critical probe failed
    if (probe.critical && this.trustEngine) {
      // Use a very low score to force circuit breaker trigger
      this.trustEngine.updateTrust(agentId, {
        currentScore: 5, // Below circuit breaker threshold
        success: false,
        ceiling: 100,
      });
    }

    // Emit failure event
    const event: CanaryFailureEvent = {
      type: 'CANARY_FAILURE',
      agentId,
      probeId: probe.probeId,
      category: probe.category,
      circuitBreakerTriggered: result.triggeredCircuitBreaker,
      timestamp: new Date(),
      result,
    };

    this.notifyListeners(event);
  }

  /**
   * Update stats for an agent
   */
  private updateStats(
    agentId: string,
    result: CanaryProbeResult,
    category: CanaryCategory
  ): void {
    let stats = this.stats.get(agentId);

    if (!stats) {
      stats = this.createInitialStats(agentId);
      this.stats.set(agentId, stats);
    }

    stats.totalProbes++;
    stats.lastProbeAt = result.executedAt;

    if (result.passed) {
      stats.probesPassed++;
      stats.consecutiveFailures = 0;
      stats.byCategory[category].passed++;
    } else {
      stats.probesFailed++;
      stats.consecutiveFailures++;
      stats.lastFailureAt = result.executedAt;
      stats.byCategory[category].failed++;
    }

    stats.passRate = stats.probesPassed / stats.totalProbes;
  }

  /**
   * Create initial stats for an agent
   */
  private createInitialStats(agentId: string): CanaryProbeStats {
    return {
      agentId,
      totalProbes: 0,
      probesPassed: 0,
      probesFailed: 0,
      passRate: 0,
      consecutiveFailures: 0,
      byCategory: {
        [CanaryCategory.FACTUAL]: { passed: 0, failed: 0 },
        [CanaryCategory.LOGICAL]: { passed: 0, failed: 0 },
        [CanaryCategory.ETHICAL]: { passed: 0, failed: 0 },
        [CanaryCategory.BEHAVIORAL]: { passed: 0, failed: 0 },
        [CanaryCategory.CONSISTENCY]: { passed: 0, failed: 0 },
      },
    };
  }

  /**
   * Get stats for an agent
   */
  getStats(agentId: string): CanaryProbeStats | undefined {
    return this.stats.get(agentId);
  }

  /**
   * Get all stats
   */
  getAllStats(): Map<string, CanaryProbeStats> {
    return new Map(this.stats);
  }

  /**
   * Add event listener
   */
  addEventListener(listener: CanaryEventListener): void {
    this.eventListeners.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: CanaryEventListener): void {
    const index = this.eventListeners.indexOf(listener);
    if (index !== -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * Notify listeners of an event
   */
  private notifyListeners(event: CanaryFailureEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch {
        // Ignore listener errors
      }
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<CanaryInjectionConfig> {
    return { ...this.config };
  }

  /**
   * Get probe by ID
   */
  getProbe(probeId: string): CanaryProbe | undefined {
    return getProbeById(probeId);
  }

  /**
   * Get all probes
   */
  getAllProbes(): CanaryProbe[] {
    return [...CANARY_PROBE_LIBRARY];
  }

  /**
   * Get probe count by category
   */
  getProbeCountByCategory(): Record<CanaryCategory, number> {
    const counts: Record<CanaryCategory, number> = {
      [CanaryCategory.FACTUAL]: 0,
      [CanaryCategory.LOGICAL]: 0,
      [CanaryCategory.ETHICAL]: 0,
      [CanaryCategory.BEHAVIORAL]: 0,
      [CanaryCategory.CONSISTENCY]: 0,
    };

    for (const probe of CANARY_PROBE_LIBRARY) {
      counts[probe.category]++;
    }

    return counts;
  }

  /**
   * Clear stats for an agent
   */
  clearStats(agentId: string): void {
    this.stats.delete(agentId);
    this.lastProbeTime.delete(agentId);
  }

  /**
   * Clear all stats
   */
  clearAllStats(): void {
    this.stats.clear();
    this.lastProbeTime.clear();
  }
}

/**
 * Create a canary probe service
 */
export function createCanaryProbeService(
  config?: Partial<CanaryInjectionConfig>,
  trustEngine?: TrustDynamicsEngine
): CanaryProbeService {
  return new CanaryProbeService(config, trustEngine);
}
