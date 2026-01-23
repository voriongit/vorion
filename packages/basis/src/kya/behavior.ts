/**
 * KYA Behavior Monitor
 * Real-time anomaly detection + trust scoring
 */

import { AnomalyAlert, BehaviorProfile, DatabaseConfig } from './types.js';

export class BehaviorMonitor {
  private profiles: Map<string, BehaviorProfile>;
  private trustScores: Map<string, number>;

  constructor(private config: DatabaseConfig) {
    this.profiles = new Map();
    this.trustScores = new Map();
  }

  /**
   * Detect anomalies in agent behavior
   */
  async detectAnomalies(agentDID: string): Promise<AnomalyAlert[]> {
    const profile = await this.getBehaviorProfile(agentDID);
    const alerts: AnomalyAlert[] = [];

    // 1. Rate spike detection
    const zScore =
      (profile.recentWindow.actionsInLastHour - profile.baseline.actionsPerHour.mean) /
      profile.baseline.actionsPerHour.stddev;

    if (zScore > 3) {
      alerts.push({
        severity: 'high',
        type: 'rate_spike',
        description: `Action rate is ${zScore.toFixed(1)} standard deviations above baseline`,
        evidence: {
          baseline: profile.baseline.actionsPerHour.mean,
          current: profile.recentWindow.actionsInLastHour,
        },
        recommendedAction: 'throttle',
        trustImpact: -50,
      });
    }

    // 2. Success rate drop
    const successDrop =
      profile.baseline.successRate.mean - profile.recentWindow.successRateLastHour;

    if (successDrop > 0.2) {
      alerts.push({
        severity: 'medium',
        type: 'success_rate_drop',
        description: `Success rate dropped ${(successDrop * 100).toFixed(1)}%`,
        evidence: {
          baseline: profile.baseline.successRate.mean,
          current: profile.recentWindow.successRateLastHour,
        },
        recommendedAction: 'warn',
        trustImpact: -20,
      });
    }

    // 3. New capability usage
    if (profile.recentWindow.newActionsInLastHour.length > 3) {
      alerts.push({
        severity: 'low',
        type: 'new_capabilities',
        description: `Agent using ${profile.recentWindow.newActionsInLastHour.length} new capabilities`,
        evidence: {
          newActions: profile.recentWindow.newActionsInLastHour,
        },
        recommendedAction: 'log',
        trustImpact: -5,
      });
    }

    // 4. Suspicious resource access
    const suspiciousResources = profile.recentWindow.newResourcesInLastHour.filter((r: string) =>
      r.includes('.env') || r.includes('credentials') || r.includes('secret')
    );

    if (suspiciousResources.length > 0) {
      alerts.push({
        severity: 'critical',
        type: 'suspicious_resource_access',
        description: 'Agent accessing sensitive resources',
        evidence: {
          resources: suspiciousResources,
        },
        recommendedAction: 'suspend',
        trustImpact: -150,
      });
    }

    return alerts;
  }

  /**
   * Get or create behavior profile for agent
   */
  async getBehaviorProfile(agentDID: string): Promise<BehaviorProfile> {
    if (this.profiles.has(agentDID)) {
      return this.profiles.get(agentDID)!;
    }

    // Create initial profile
    const profile: BehaviorProfile = {
      agentDID,
      baseline: {
        actionsPerHour: { mean: 10, stddev: 3 },
        successRate: { mean: 0.95, stddev: 0.05 },
        topActions: [],
        topResources: [],
      },
      recentWindow: {
        actionsInLastHour: 0,
        successRateLastHour: 1.0,
        newActionsInLastHour: [],
        newResourcesInLastHour: [],
      },
    };

    this.profiles.set(agentDID, profile);
    return profile;
  }

  /**
   * Update trust score from behavior
   */
  async updateTrustScoreFromBehavior(
    agentDID: string,
    anomalies: AnomalyAlert[]
  ): Promise<number> {
    const currentScore = this.trustScores.get(agentDID) || 500; // Default: T3

    // Apply trust impact from anomalies
    const totalImpact = anomalies.reduce((sum, alert) => sum + alert.trustImpact, 0);

    // Update trust score
    const newScore = Math.max(0, Math.min(1000, currentScore + totalImpact));

    this.trustScores.set(agentDID, newScore);

    // Take recommended actions
    for (const alert of anomalies) {
      switch (alert.recommendedAction) {
        case 'suspend':
          console.warn(`SUSPEND agent ${agentDID}:`, alert.description);
          break;
        case 'throttle':
          console.warn(`THROTTLE agent ${agentDID}:`, alert.description);
          break;
        case 'warn':
          console.warn(`WARNING for agent ${agentDID}:`, alert.description);
          break;
        case 'log':
          console.log(`LOG for agent ${agentDID}:`, alert.description);
          break;
      }
    }

    return newScore;
  }

  /**
   * Get current trust score
   */
  async getTrustScore(agentDID: string): Promise<number> {
    return this.trustScores.get(agentDID) || 500;
  }
}
