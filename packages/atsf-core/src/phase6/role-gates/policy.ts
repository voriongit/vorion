/**
 * Q3: Role Gates - BASIS Policy Enforcement Layer
 * Dynamic policy engine with per-agent exceptions, domain filtering, and audit logging
 *
 * Architecture:
 * - Dynamic policy rules (add/remove at runtime)
 * - Per-agent exceptions with expiration
 * - Domain-scoped rule application
 * - Full audit trail of all evaluations
 * - Version tracking on policy changes
 */

import { AgentRole, TrustTier } from './kernel.js';

/**
 * Policy rule definition
 */
export interface PolicyRule {
  role: AgentRole;
  tier: TrustTier;
  allowed: boolean;
  reason: string;
  domains?: string[]; // Optional domain filter
}

/**
 * Per-agent policy exception
 */
export interface PolicyException {
  agentId: string;
  role: AgentRole;
  tier: TrustTier;
  allowed: boolean;
  reason: string;
  approvedBy: string;
  expiresAt?: Date;
}

/**
 * Policy decision result
 */
export interface PolicyDecision {
  allowed: boolean;
  reason: string;
  source: 'exception' | 'rule' | 'default';
  appliedAt: Date;
}

/**
 * Policy audit log entry
 */
export interface PolicyAuditEntry {
  timestamp: Date;
  agentId: string;
  role: AgentRole;
  tier: TrustTier;
  domain?: string;
  decision: PolicyDecision;
}

/**
 * BasisPolicyEngine: Dynamic policy enforcement with exceptions and domain filtering
 */
export class BasisPolicyEngine {
  private rules: Map<string, PolicyRule> = new Map();
  private exceptions: Map<string, PolicyException[]> = new Map();
  private auditLog: PolicyAuditEntry[] = [];
  private policyVersion: string = '1.0.0';
  private versionCounter: number = 0;

  /**
   * Add a policy rule
   */
  addRule(rule: PolicyRule): void {
    const key = `${rule.role}:${rule.tier}`;
    this.rules.set(key, rule);
    this.incrementVersion();
  }

  /**
   * Remove a policy rule
   */
  removeRule(role: AgentRole, tier: TrustTier): void {
    const key = `${role}:${tier}`;
    if (this.rules.has(key)) {
      this.rules.delete(key);
      this.incrementVersion();
    }
  }

  /**
   * Add an agent-specific exception
   */
  addException(exception: PolicyException): void {
    const key = exception.agentId;
    if (!this.exceptions.has(key)) {
      this.exceptions.set(key, []);
    }
    this.exceptions.get(key)!.push(exception);
    this.incrementVersion();
  }

  /**
   * Remove an agent-specific exception
   */
  removeException(agentId: string, role: AgentRole, tier: TrustTier): void {
    const key = agentId;
    const exceptions = this.exceptions.get(key);
    if (exceptions) {
      const index = exceptions.findIndex(
        (e) => e.role === role && e.tier === tier
      );
      if (index >= 0) {
        exceptions.splice(index, 1);
        this.incrementVersion();
      }
    }
  }

  /**
   * Evaluate policy for an agent
   * Returns decision based on exceptions -> rules -> default allow
   */
  evaluatePolicy(
    agentId: string,
    role: AgentRole,
    tier: TrustTier,
    domain?: string
  ): PolicyDecision {
    const timestamp = new Date();

    // Check agent-specific exceptions first
    const agentExceptions = this.exceptions.get(agentId) || [];
    for (const exception of agentExceptions) {
      if (
        exception.role === role &&
        exception.tier === tier &&
        !this.isExpired(exception)
      ) {
        const decision: PolicyDecision = {
          allowed: exception.allowed,
          reason: exception.reason,
          source: 'exception',
          appliedAt: timestamp,
        };
        this.logAudit({ timestamp, agentId, role, tier, domain, decision });
        return decision;
      }
    }

    // Check policy rules
    const ruleKey = `${role}:${tier}`;
    const rule = this.rules.get(ruleKey);
    if (rule) {
      // Check domain filter if present
      if (rule.domains && domain && !rule.domains.includes(domain)) {
        // Domain filter doesn't match, fall through to default
      } else if (!rule.domains || !domain || rule.domains.includes(domain)) {
        const decision: PolicyDecision = {
          allowed: rule.allowed,
          reason: rule.reason,
          source: 'rule',
          appliedAt: timestamp,
        };
        this.logAudit({ timestamp, agentId, role, tier, domain, decision });
        return decision;
      }
    }

    // Default: allow
    const decision: PolicyDecision = {
      allowed: true,
      reason: 'No matching rule or exception (default allow)',
      source: 'default',
      appliedAt: timestamp,
    };
    this.logAudit({ timestamp, agentId, role, tier, domain, decision });
    return decision;
  }

  /**
   * Get audit log for specific agent
   */
  getAgentAuditLog(agentId: string): PolicyAuditEntry[] {
    return this.auditLog.filter((entry) => entry.agentId === agentId);
  }

  /**
   * Get full audit log
   */
  getAuditLog(): PolicyAuditEntry[] {
    return [...this.auditLog];
  }

  /**
   * Get current policy version
   */
  getPolicyVersion(): string {
    return this.policyVersion;
  }

  /**
   * Check if exception has expired
   */
  private isExpired(exception: PolicyException): boolean {
    if (!exception.expiresAt) {
      return false;
    }
    return new Date() > exception.expiresAt;
  }

  /**
   * Log an audit entry
   */
  private logAudit(entry: PolicyAuditEntry): void {
    this.auditLog.push(entry);
  }

  /**
   * Increment version for policy tracking
   */
  private incrementVersion(): void {
    this.versionCounter++;
    const [major, minor] = this.policyVersion.split('.').map(Number);
    this.policyVersion = `${major}.${minor + 1}`;
  }
}
