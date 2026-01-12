/**
 * Pre-Action Verification Gate - ATSF v2.0 Section 4.4
 *
 * Key principle: Trust score gates CAPABILITY, not just post-hoc scoring.
 *
 * Problem solved: At the moment of a "Treacherous Turn," an agent's trust
 * is maximal because ATSF v1.x updates trust AFTER action execution.
 *
 * Solution: Pre-action gating checks trust BEFORE execution.
 * Low-trust agents cannot REQUEST high-risk actions.
 * Trust must be earned through demonstrated success on low-risk actions first.
 */

import { randomUUID } from 'crypto';
import {
  type GateVerificationRequest,
  type GateVerificationResult,
  type GateRequirement,
  type PreActionGateConfig,
  type GateEvent,
  RiskLevel,
  GateStatus,
  TRUST_THRESHOLDS,
  DEFAULT_GATE_CONFIG,
} from '@vorion/contracts';

import { classifyRisk, explainRiskFactors } from './risk-classifier.js';

/**
 * Trust provider interface - abstracts trust score retrieval
 */
export interface TrustProvider {
  getTrustScore(agentId: string): number | Promise<number>;
}

/**
 * Gate event listener
 */
export type GateEventListener = (event: GateEvent) => void;

/**
 * PreActionGate - Verifies agent trust before allowing action execution
 */
export class PreActionGate {
  private readonly config: PreActionGateConfig;
  private readonly trustProvider?: TrustProvider;
  private readonly trustThresholds: Record<RiskLevel, number>;
  private readonly eventListeners: GateEventListener[] = [];

  constructor(
    config: Partial<PreActionGateConfig> = {},
    trustProvider?: TrustProvider
  ) {
    this.config = { ...DEFAULT_GATE_CONFIG, ...config };
    this.trustProvider = trustProvider;
    this.trustThresholds = {
      ...TRUST_THRESHOLDS,
      ...config.trustThresholds,
    };
  }

  /**
   * Verify an action before execution
   *
   * This is the main entry point. Call this BEFORE allowing an agent
   * to execute any action.
   */
  async verify(
    request: GateVerificationRequest,
    trustScore?: number
  ): Promise<GateVerificationResult> {
    const verificationId = randomUUID();
    const now = new Date();

    // Get trust score
    const currentTrust = trustScore ?? await this.resolveTrustScore(request.agentId);

    // Classify risk
    const riskFactors = classifyRisk(request);
    const riskLevel = riskFactors.riskLevel;

    // Get required trust threshold
    const requiredTrust = this.trustThresholds[riskLevel];

    // Calculate trust deficit
    const trustDeficit = Math.max(0, requiredTrust - currentTrust);

    // Determine gate status
    const { status, passed, reasoning, requirements } = this.determineStatus(
      currentTrust,
      requiredTrust,
      riskLevel,
      riskFactors
    );

    // Create result
    const result: GateVerificationResult = {
      status,
      riskLevel,
      requiredTrust,
      currentTrust,
      trustDeficit,
      passed,
      reasoning,
      requirements,
      verifiedAt: now,
      expiresAt: new Date(now.getTime() + this.config.verificationValidityMs),
      verificationId,
    };

    // Emit event
    this.emitEvent({
      type: this.getEventType(status),
      agentId: request.agentId,
      action: request.action,
      riskLevel,
      trustScore: currentTrust,
      passed,
      timestamp: now,
      verificationId,
    });

    return result;
  }

  /**
   * Quick check without full verification
   * Returns true if action would be immediately approved
   */
  async canProceed(
    request: GateVerificationRequest,
    trustScore?: number
  ): Promise<boolean> {
    const currentTrust = trustScore ?? await this.resolveTrustScore(request.agentId);
    const riskFactors = classifyRisk(request);
    const requiredTrust = this.trustThresholds[riskFactors.riskLevel];

    return currentTrust >= requiredTrust;
  }

  /**
   * Get the trust threshold for a risk level
   */
  getThreshold(riskLevel: RiskLevel): number {
    return this.trustThresholds[riskLevel];
  }

  /**
   * Get all trust thresholds
   */
  getThresholds(): Readonly<Record<RiskLevel, number>> {
    return { ...this.trustThresholds };
  }

  /**
   * Check what risk level an agent can handle with their current trust
   */
  getMaxRiskLevel(trustScore: number): RiskLevel {
    if (trustScore >= this.trustThresholds[RiskLevel.CRITICAL]) {
      return RiskLevel.CRITICAL;
    }
    if (trustScore >= this.trustThresholds[RiskLevel.HIGH]) {
      return RiskLevel.HIGH;
    }
    if (trustScore >= this.trustThresholds[RiskLevel.MEDIUM]) {
      return RiskLevel.MEDIUM;
    }
    if (trustScore >= this.trustThresholds[RiskLevel.LOW]) {
      return RiskLevel.LOW;
    }
    return RiskLevel.READ;
  }

  /**
   * Get trust deficit for a specific risk level
   */
  getTrustDeficit(currentTrust: number, riskLevel: RiskLevel): number {
    const required = this.trustThresholds[riskLevel];
    return Math.max(0, required - currentTrust);
  }

  /**
   * Add event listener
   */
  addEventListener(listener: GateEventListener): void {
    this.eventListeners.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: GateEventListener): void {
    const index = this.eventListeners.indexOf(listener);
    if (index !== -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<PreActionGateConfig> {
    return { ...this.config };
  }

  // Private methods

  private async resolveTrustScore(agentId: string): Promise<number> {
    if (this.trustProvider) {
      return await this.trustProvider.getTrustScore(agentId);
    }
    // Default to zero (zero-start principle) if no provider
    return 0;
  }

  private determineStatus(
    currentTrust: number,
    requiredTrust: number,
    riskLevel: RiskLevel,
    riskFactors: ReturnType<typeof classifyRisk>
  ): {
    status: GateStatus;
    passed: boolean;
    reasoning: string[];
    requirements?: GateRequirement[];
  } {
    const reasoning: string[] = [];
    const requirements: GateRequirement[] = [];

    // Add risk factor explanations
    reasoning.push(...explainRiskFactors(riskFactors));
    reasoning.push(`Risk level: ${riskLevel} (score: ${riskFactors.combinedScore})`);
    reasoning.push(`Required trust: ${requiredTrust}, Current trust: ${currentTrust}`);

    // Check trust threshold
    if (currentTrust < requiredTrust) {
      reasoning.push(`Trust deficit: ${(requiredTrust - currentTrust).toFixed(1)} points`);

      // If pending states not allowed, just reject
      if (!this.config.allowPendingStates) {
        reasoning.push('Action rejected: insufficient trust');
        return {
          status: GateStatus.REJECTED,
          passed: false,
          reasoning,
        };
      }

      // Otherwise, determine what's needed
      requirements.push({
        type: 'ADDITIONAL_TRUST',
        description: `Agent needs ${(requiredTrust - currentTrust).toFixed(1)} more trust points`,
      });

      reasoning.push('Action rejected: trust below threshold');
      return {
        status: GateStatus.REJECTED,
        passed: false,
        reasoning,
        requirements,
      };
    }

    // Trust threshold met - check additional requirements
    const verificationLevel = this.getRiskLevelValue(this.config.verificationThreshold);
    const humanApprovalLevel = this.getRiskLevelValue(this.config.humanApprovalThreshold);
    const currentRiskValue = this.getRiskLevelValue(riskLevel);

    // Check if human approval required
    if (currentRiskValue >= humanApprovalLevel) {
      if (this.config.allowPendingStates) {
        reasoning.push('Critical risk action requires human approval');
        requirements.push({
          type: 'HUMAN_APPROVAL',
          description: 'Human operator must approve this action',
          timeoutMs: 24 * 60 * 60 * 1000, // 24 hours
        });

        return {
          status: GateStatus.PENDING_HUMAN_APPROVAL,
          passed: false,
          reasoning,
          requirements,
        };
      }
    }

    // Check if multi-prover verification required
    if (currentRiskValue >= verificationLevel) {
      if (this.config.allowPendingStates) {
        reasoning.push('High risk action requires multi-prover verification');
        requirements.push({
          type: 'MULTI_PROVER_VERIFICATION',
          description: 'Action must be verified by multiple provers',
          timeoutMs: 5 * 60 * 1000, // 5 minutes
        });

        return {
          status: GateStatus.PENDING_VERIFICATION,
          passed: false,
          reasoning,
          requirements,
        };
      }
    }

    // All checks passed
    reasoning.push('Action approved: trust threshold met');
    return {
      status: GateStatus.APPROVED,
      passed: true,
      reasoning,
    };
  }

  private getRiskLevelValue(level: RiskLevel): number {
    const values: Record<RiskLevel, number> = {
      [RiskLevel.READ]: 0,
      [RiskLevel.LOW]: 1,
      [RiskLevel.MEDIUM]: 2,
      [RiskLevel.HIGH]: 3,
      [RiskLevel.CRITICAL]: 4,
    };
    return values[level];
  }

  private getEventType(status: GateStatus): GateEvent['type'] {
    switch (status) {
      case GateStatus.APPROVED:
        return 'GATE_APPROVED';
      case GateStatus.REJECTED:
        return 'GATE_REJECTED';
      case GateStatus.PENDING_VERIFICATION:
      case GateStatus.PENDING_HUMAN_APPROVAL:
        return 'GATE_PENDING';
      default:
        return 'GATE_CHECK';
    }
  }

  private emitEvent(event: GateEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch {
        // Ignore listener errors
      }
    }
  }
}

/**
 * Create a pre-action gate
 */
export function createPreActionGate(
  config?: Partial<PreActionGateConfig>,
  trustProvider?: TrustProvider
): PreActionGate {
  return new PreActionGate(config, trustProvider);
}

/**
 * Create a simple trust provider from a map
 */
export function createMapTrustProvider(
  trustScores: Map<string, number> | Record<string, number>
): TrustProvider {
  const map = trustScores instanceof Map
    ? trustScores
    : new Map(Object.entries(trustScores));

  return {
    getTrustScore(agentId: string): number {
      return map.get(agentId) ?? 0; // Zero-start principle
    },
  };
}
