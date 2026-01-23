/**
 * KYA (Know Your Agent) Framework SDK
 *
 * TypeScript SDK for KYA framework integration
 * Part of BASIS (Blockchain Agent Standard for Identity and Security)
 */

export * from './identity.js';
export * from './authorization.js';
export * from './accountability.js';
export * from './behavior.js';
export * from './types.js';

import { IdentityVerifier } from './identity.js';
import { AuthorizationManager } from './authorization.js';
import { AccountabilityChain } from './accountability.js';
import { BehaviorMonitor } from './behavior.js';
import { KYAConfig, AnomalyAlert } from './types.js';

/**
 * Main KYA Framework SDK
 */
export class KYA {
  public identity: IdentityVerifier;
  public authorization: AuthorizationManager;
  public accountability: AccountabilityChain;
  public behavior: BehaviorMonitor;

  constructor(config: KYAConfig) {
    this.identity = new IdentityVerifier(config.didResolver);
    this.authorization = new AuthorizationManager(config.policyEngine);
    this.accountability = new AccountabilityChain(config.database);
    this.behavior = new BehaviorMonitor(config.database);
  }

  /**
   * Complete agent verification flow
   * 1. Verify identity (DID + signature)
   * 2. Check authorization (capabilities + policies)
   * 3. Log to accountability chain
   * 4. Monitor behavior for anomalies
   */
  async verifyAgent(params: {
    agentDID: string;
    action: string;
    resource: string;
    proof: {
      challenge: string;
      signature: string;
      timestamp: number;
    };
  }): Promise<{
    allowed: boolean;
    reason: string;
    trustScore: number;
    anomalies: string[];
  }> {
    // 1. Identity verification
    const identityValid = await this.identity.verify({
      did: params.agentDID,
      challenge: params.proof.challenge,
      signature: params.proof.signature,
      timestamp: params.proof.timestamp,
      publicKey: '', // Will be resolved from DID
    });

    if (!identityValid) {
      return {
        allowed: false,
        reason: 'Identity verification failed',
        trustScore: 0,
        anomalies: [],
      };
    }

    // 2. Authorization check
    const authDecision = await this.authorization.authorize({
      agentDID: params.agentDID,
      action: params.action,
      resource: params.resource,
      context: {
        timestamp: Date.now(),
      },
    });

    if (!authDecision.allowed) {
      return {
        allowed: false,
        reason: authDecision.reason,
        trustScore: 0,
        anomalies: [],
      };
    }

    // 3. Behavior monitoring (detect anomalies)
    const anomalies = await this.behavior.detectAnomalies(params.agentDID);

    // 4. Log to accountability chain
    await this.accountability.append({
      id: this.generateId(),
      timestamp: Date.now(),
      agentDID: params.agentDID,
      action: params.action,
      resource: params.resource,
      outcome: 'success',
      evidence: {
        intentHash: '',
        authorizationDecision: authDecision,
      },
      signature: params.proof.signature,
      chainLink: { prevHash: null },
    });

    return {
      allowed: true,
      reason: 'Verified and authorized',
      trustScore: await this.behavior.getTrustScore(params.agentDID),
      anomalies: anomalies.map((a: AnomalyAlert) => a.type),
    };
  }

  private generateId(): string {
    return `kya_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
}
