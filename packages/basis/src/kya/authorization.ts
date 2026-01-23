/**
 * KYA Authorization Manager
 * Capability-based access control + policy enforcement
 */

import {
  AuthorizationRequest,
  AuthorizationDecision,
  CapabilityToken,
  PolicyBundle,
  PolicyEngineConfig,
  Capability,
} from './types.js';

export class AuthorizationManager {
  private policyBundles: Map<string, PolicyBundle>;
  private capabilities: Map<string, CapabilityToken[]>;

  constructor(private config: PolicyEngineConfig) {
    this.policyBundles = new Map();
    this.capabilities = new Map();

    // Load policy bundles
    this.loadPolicyBundles();
  }

  /**
   * Authorize agent action
   */
  async authorize(request: AuthorizationRequest): Promise<AuthorizationDecision> {
    // 1. Get agent capabilities
    const agentCapabilities = this.capabilities.get(request.agentDID) || [];

    // 2. Find matching capability
    const matchingCap = agentCapabilities.find(token =>
      token.capabilities.some((cap: Capability) =>
        this.matchesCapability(cap, request.action, request.resource)
      )
    );

    if (!matchingCap) {
      return {
        allowed: false,
        reason: 'No matching capability',
        trustImpact: -10,
      };
    }

    // 3. Check capability expiry
    const now = new Date();
    const notBefore = new Date(matchingCap.notBefore);
    const notAfter = new Date(matchingCap.notAfter);

    if (now < notBefore || now > notAfter) {
      return {
        allowed: false,
        reason: 'Capability expired or not yet valid',
        trustImpact: -5,
      };
    }

    // 4. Evaluate conditions
    const capability = matchingCap.capabilities.find((cap: Capability) =>
      this.matchesCapability(cap, request.action, request.resource)
    )!;

    if (capability.conditions) {
      const conditionsValid = await this.evaluateConditions(
        capability.conditions,
        request
      );

      if (!conditionsValid) {
        return {
          allowed: false,
          reason: 'Capability conditions not met',
          trustImpact: -5,
        };
      }
    }

    // 5. Check policy constraints
    const policyViolations = await this.checkPolicyConstraints(request);

    if (policyViolations.length > 0) {
      return {
        allowed: false,
        reason: `Policy violations: ${policyViolations.join(', ')}`,
        trustImpact: -20,
      };
    }

    // 6. ALLOW
    return {
      allowed: true,
      reason: 'Authorized',
      conditions: capability.conditions,
      trustImpact: 1,
    };
  }

  /**
   * Grant capability to agent
   */
  async grantCapability(
    agentDID: string,
    capabilityToken: CapabilityToken
  ): Promise<void> {
    const existing = this.capabilities.get(agentDID) || [];
    existing.push(capabilityToken);
    this.capabilities.set(agentDID, existing);
  }

  /**
   * Revoke capability from agent
   */
  async revokeCapability(agentDID: string, capabilityId: string): Promise<void> {
    const existing = this.capabilities.get(agentDID) || [];
    const filtered = existing.filter(cap => cap.id !== capabilityId);
    this.capabilities.set(agentDID, filtered);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Check if capability matches action + resource
   */
  private matchesCapability(
    capability: { action: string; resource: string },
    action: string,
    resource: string
  ): boolean {
    // Exact match
    if (capability.action === action && capability.resource === resource) {
      return true;
    }

    // Wildcard match
    const actionMatch = this.matchesPattern(capability.action, action);
    const resourceMatch = this.matchesPattern(capability.resource, resource);

    return actionMatch && resourceMatch;
  }

  /**
   * Pattern matching with wildcards
   */
  private matchesPattern(pattern: string, value: string): boolean {
    if (pattern === '*') return true;
    if (pattern === value) return true;

    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(value);
  }

  /**
   * Evaluate capability conditions
   */
  private async evaluateConditions(
    conditions: Record<string, unknown>,
    request: AuthorizationRequest
  ): Promise<boolean> {
    // Example condition checks
    if (conditions.maxFileSize && request.resource.startsWith('/')) {
      // Would check actual file size
      return true;
    }

    if (conditions.rateLimit) {
      // Would check rate limiting
      return true;
    }

    if (conditions.methods && Array.isArray(conditions.methods)) {
      // Would check HTTP method
      return true;
    }

    return true;
  }

  /**
   * Check policy constraints (MUST NOT do)
   */
  private async checkPolicyConstraints(
    request: AuthorizationRequest
  ): Promise<string[]> {
    const violations: string[] = [];

    // Get applicable policy bundle
    const policyBundle = this.policyBundles.get(this.config.defaultJurisdiction);

    if (!policyBundle) {
      return violations;
    }

    // Check each constraint
    for (const constraint of policyBundle.constraints) {
      const violated = await this.evaluateConstraint(constraint.rule, request);

      if (violated) {
        violations.push(constraint.description);

        // Apply enforcement action
        if (constraint.enforcement === 'block') {
          // Already blocked by adding to violations
        } else if (constraint.enforcement === 'warn') {
          console.warn(`Policy warning: ${constraint.description}`);
        } else if (constraint.enforcement === 'log') {
          console.log(`Policy logged: ${constraint.description}`);
        }
      }
    }

    return violations;
  }

  /**
   * Evaluate constraint rule (simplified)
   */
  private async evaluateConstraint(
    rule: string,
    request: AuthorizationRequest
  ): Promise<boolean> {
    // Would use CEL (Common Expression Language) or JSON Logic
    // For now, simple keyword matching
    if (rule.includes('no_credential_access') && request.resource.includes('credential')) {
      return true;
    }

    if (rule.includes('no_external_code') && request.action.includes('code.execute')) {
      return true;
    }

    return false;
  }

  /**
   * Load policy bundles from configuration
   */
  private loadPolicyBundles(): void {
    // Would load from files/database
    // For now, create a default policy bundle
    const defaultBundle: PolicyBundle = {
      id: 'vorion-default-v1',
      version: '1.0.0',
      jurisdiction: 'Global',
      constraints: [
        {
          id: 'no-credential-access',
          description: 'Agents cannot access credential files',
          rule: 'no_credential_access',
          severity: 'critical',
          enforcement: 'block',
        },
        {
          id: 'no-external-code',
          description: 'Agents cannot execute external code',
          rule: 'no_external_code',
          severity: 'high',
          enforcement: 'block',
        },
      ],
      obligations: [],
      permissions: [],
    };

    this.policyBundles.set('Global', defaultBundle);
  }
}

// ============================================================================
// Example Usage
// ============================================================================

/*
import { AuthorizationManager } from './authorization';

async function example() {
  const authManager = new AuthorizationManager({
    policyBundlesPath: './policies',
    defaultJurisdiction: 'Global',
  });

  // Grant capability to agent
  await authManager.grantCapability('did:vorion:agent:123', {
    id: 'cap_001',
    issuer: 'did:vorion:org:agentanchor',
    subject: 'did:vorion:agent:123',
    capabilities: [
      {
        action: 'file.write',
        resource: '/data/user_documents/*',
        conditions: {
          maxFileSize: 10485760,
          allowedExtensions: ['.txt', '.md', '.json'],
        },
      },
    ],
    notBefore: new Date().toISOString(),
    notAfter: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    signature: '...',
  });

  // Check authorization
  const decision = await authManager.authorize({
    agentDID: 'did:vorion:agent:123',
    action: 'file.write',
    resource: '/data/user_documents/report.txt',
    context: {
      timestamp: Date.now(),
    },
  });

  console.log('Authorized:', decision.allowed);
  console.log('Reason:', decision.reason);
}
*/
