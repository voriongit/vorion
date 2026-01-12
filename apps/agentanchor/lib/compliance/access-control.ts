/**
 * Compliance Access Control Service
 * SOC 2 CC6.1-CC6.8, HIPAA §164.312, ISO 27001 A.5.15-A.8.5
 */

import { complianceAuditLogger } from './audit-logger';
import type {
  ComplianceFramework,
  AgentComplianceContext,
} from './types';

// =============================================================================
// Access Control Types
// =============================================================================

export type AccessLevel = 'none' | 'read' | 'write' | 'admin';

export type ResourceType =
  | 'agent'
  | 'conversation'
  | 'message'
  | 'phi'
  | 'configuration'
  | 'audit_log'
  | 'compliance_report'
  | 'user_data';

export interface AccessRequest {
  userId: string;
  agentId?: string;
  resourceType: ResourceType;
  resourceId: string;
  action: 'read' | 'write' | 'delete' | 'execute' | 'export';
  purpose?: string;
  ipAddress?: string;
}

export interface AccessDecision {
  allowed: boolean;
  reason: string;
  requiredMFA: boolean;
  auditRequired: boolean;
  restrictions?: string[];
  expiresAt?: Date;
}

export interface AccessPolicy {
  id: string;
  name: string;
  resourceType: ResourceType;
  conditions: AccessCondition[];
  actions: ('read' | 'write' | 'delete' | 'execute' | 'export')[];
  effect: 'allow' | 'deny';
  priority: number;
  frameworks: ComplianceFramework[];
}

export interface AccessCondition {
  attribute: string;
  operator: 'equals' | 'not_equals' | 'in' | 'not_in' | 'greater_than' | 'less_than' | 'contains';
  value: unknown;
}

// =============================================================================
// Access Control Service
// =============================================================================

export class ComplianceAccessControl {
  private static instance: ComplianceAccessControl;
  private policies: AccessPolicy[] = [];
  private sessionCache: Map<string, SessionInfo> = new Map();

  private constructor() {
    this.initializeDefaultPolicies();
  }

  static getInstance(): ComplianceAccessControl {
    if (!ComplianceAccessControl.instance) {
      ComplianceAccessControl.instance = new ComplianceAccessControl();
    }
    return ComplianceAccessControl.instance;
  }

  /**
   * Check if access should be granted
   */
  async checkAccess(request: AccessRequest): Promise<AccessDecision> {
    try {
      // Get user session
      const session = await this.getSession(request.userId);

      // Check authentication
      if (!session || !session.authenticated) {
        await this.logAccessDenied(request, 'Not authenticated');
        return {
          allowed: false,
          reason: 'Authentication required',
          requiredMFA: true,
          auditRequired: true,
        };
      }

      // Check session expiry
      if (session.expiresAt && session.expiresAt < new Date()) {
        await this.logAccessDenied(request, 'Session expired');
        return {
          allowed: false,
          reason: 'Session expired',
          requiredMFA: true,
          auditRequired: true,
        };
      }

      // PHI access requires additional checks (HIPAA)
      if (request.resourceType === 'phi') {
        return this.checkPHIAccess(request, session);
      }

      // Evaluate policies
      const applicablePolicies = this.getApplicablePolicies(request);
      const decision = this.evaluatePolicies(request, session, applicablePolicies);

      // Log access decision
      if (decision.allowed) {
        await this.logAccessGranted(request);
      } else {
        await this.logAccessDenied(request, decision.reason);
      }

      return decision;
    } catch (error) {
      console.error('[AccessControl] Error checking access:', error);
      await this.logAccessDenied(request, 'Internal error');
      return {
        allowed: false,
        reason: 'Access check failed',
        requiredMFA: false,
        auditRequired: true,
      };
    }
  }

  /**
   * Check PHI access (HIPAA specific)
   */
  private async checkPHIAccess(request: AccessRequest, session: SessionInfo): Promise<AccessDecision> {
    // MFA required for PHI access
    if (!session.mfaVerified) {
      await this.logAccessDenied(request, 'MFA required for PHI');
      return {
        allowed: false,
        reason: 'Multi-factor authentication required for PHI access',
        requiredMFA: true,
        auditRequired: true,
      };
    }

    // Check PHI authorization
    if (!session.phiAuthorized) {
      await this.logAccessDenied(request, 'No PHI authorization');
      return {
        allowed: false,
        reason: 'PHI access not authorized for this user',
        requiredMFA: false,
        auditRequired: true,
      };
    }

    // Verify purpose (minimum necessary)
    if (!request.purpose) {
      await this.logAccessDenied(request, 'Purpose required for PHI');
      return {
        allowed: false,
        reason: 'Purpose must be specified for PHI access (minimum necessary)',
        requiredMFA: false,
        auditRequired: true,
      };
    }

    const validPurposes = ['treatment', 'payment', 'operations', 'research'];
    if (!validPurposes.includes(request.purpose)) {
      await this.logAccessDenied(request, 'Invalid PHI purpose');
      return {
        allowed: false,
        reason: `Invalid purpose: ${request.purpose}. Must be one of: ${validPurposes.join(', ')}`,
        requiredMFA: false,
        auditRequired: true,
      };
    }

    // Log successful PHI access
    await complianceAuditLogger.logPHIAccess({
      userId: request.userId,
      agentId: request.agentId || '',
      action: request.action === 'read' ? 'view' : request.action as 'view' | 'create' | 'modify' | 'delete' | 'export' | 'transmit',
      phiType: 'general',
      patientIdentifierHash: request.resourceId,
      purpose: request.purpose as 'treatment' | 'payment' | 'operations' | 'research' | 'other',
      authorized: true,
      minimumNecessary: true,
    });

    return {
      allowed: true,
      reason: 'PHI access granted',
      requiredMFA: false,
      auditRequired: true,
      restrictions: ['minimum_necessary', 'no_export_without_approval'],
    };
  }

  /**
   * Grant access to a user for a resource
   */
  async grantAccess(params: {
    userId: string;
    resourceType: ResourceType;
    resourceId: string;
    level: AccessLevel;
    grantedBy: string;
    expiresAt?: Date;
    reason?: string;
  }): Promise<void> {
    await complianceAuditLogger.logAccessControl({
      userId: params.userId,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      action: 'granted',
      permission: params.level,
      reason: params.reason,
    });

    // In production, persist to database
    console.log(`[AccessControl] Granted ${params.level} access to ${params.userId} for ${params.resourceType}:${params.resourceId}`);
  }

  /**
   * Revoke access from a user
   */
  async revokeAccess(params: {
    userId: string;
    resourceType: ResourceType;
    resourceId: string;
    revokedBy: string;
    reason: string;
  }): Promise<void> {
    await complianceAuditLogger.logAccessControl({
      userId: params.userId,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      action: 'revoked',
      permission: 'all',
      reason: params.reason,
    });

    console.log(`[AccessControl] Revoked access from ${params.userId} for ${params.resourceType}:${params.resourceId}`);
  }

  /**
   * Get agent compliance context
   */
  async getAgentComplianceContext(agentId: string): Promise<AgentComplianceContext> {
    // In production, fetch from database
    return {
      agentId,
      frameworks: ['soc2', 'iso27001'],
      phiAuthorized: false,
      phiPurposes: [],
      minimumNecessaryEnforced: true,
      dataClassification: 'internal',
      encryptionRequired: true,
      auditLoggingEnabled: true,
      retentionPeriod: 2555, // 7 years in days
      accessLevel: 'read',
      mfaRequired: false,
      activeControls: ['CC6.1', 'CC6.2', 'A.5.15', 'A.8.3'],
    };
  }

  /**
   * Enable healthcare/PHI capabilities for an agent
   */
  async enableHealthcareAccess(agentId: string, params: {
    enabledBy: string;
    purposes: ('treatment' | 'payment' | 'operations' | 'research')[];
    trainingCompleted: boolean;
    baaInPlace: boolean;
  }): Promise<AgentComplianceContext> {
    if (!params.trainingCompleted) {
      throw new Error('HIPAA training must be completed before enabling PHI access');
    }

    if (!params.baaInPlace) {
      throw new Error('Business Associate Agreement must be in place for PHI access');
    }

    await complianceAuditLogger.logConfigChange({
      userId: params.enabledBy,
      configType: 'agent',
      resourceId: agentId,
      changeType: 'update',
      previousValue: { phiAuthorized: false },
      newValue: { phiAuthorized: true, phiPurposes: params.purposes },
      reason: 'Healthcare/PHI access enabled',
    });

    return {
      agentId,
      frameworks: ['soc2', 'hipaa', 'iso27001'],
      phiAuthorized: true,
      phiPurposes: params.purposes,
      minimumNecessaryEnforced: true,
      dataClassification: 'restricted',
      encryptionRequired: true,
      auditLoggingEnabled: true,
      retentionPeriod: 2555, // 7 years
      accessLevel: 'read',
      mfaRequired: true,
      activeControls: [
        'CC6.1', 'CC6.2', // SOC 2
        '164.308(a)(4)', '164.312(a)(1)', '164.312(b)', // HIPAA
        'A.5.15', 'A.8.3', 'A.8.24', // ISO 27001
      ],
    };
  }

  /**
   * Perform access review (SOC 2 CC6.4, HIPAA §164.308(a)(4), ISO A.5.18)
   */
  async performAccessReview(params: {
    reviewerId: string;
    scope: 'all' | 'phi' | 'privileged';
    startDate: Date;
    endDate: Date;
  }): Promise<AccessReviewResult> {
    const reviewId = `review_${Date.now()}`;

    await complianceAuditLogger.logComplianceActivity({
      activityType: 'control_tested',
      userId: params.reviewerId,
      framework: 'soc2',
      controlId: 'CC6.4',
      resourceId: reviewId,
      details: {
        scope: params.scope,
        dateRange: { start: params.startDate, end: params.endDate },
      },
    });

    // In production, query access records and identify issues
    return {
      reviewId,
      reviewedBy: params.reviewerId,
      reviewedAt: new Date(),
      scope: params.scope,
      totalAccounts: 0,
      accountsReviewed: 0,
      issuesFound: [],
      recommendations: [],
      nextReviewDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
    };
  }

  // =============================================================================
  // Private Methods
  // =============================================================================

  private initializeDefaultPolicies(): void {
    this.policies = [
      // Deny all PHI access without MFA
      {
        id: 'phi-mfa-required',
        name: 'PHI MFA Required',
        resourceType: 'phi',
        conditions: [
          { attribute: 'session.mfaVerified', operator: 'equals', value: false },
        ],
        actions: ['read', 'write', 'delete', 'export'],
        effect: 'deny',
        priority: 100,
        frameworks: ['hipaa'],
      },

      // Deny export of restricted data without approval
      {
        id: 'restricted-export-deny',
        name: 'Deny Restricted Data Export',
        resourceType: 'user_data',
        conditions: [
          { attribute: 'data.classification', operator: 'equals', value: 'restricted' },
          { attribute: 'user.exportApproved', operator: 'equals', value: false },
        ],
        actions: ['export'],
        effect: 'deny',
        priority: 90,
        frameworks: ['soc2', 'hipaa', 'iso27001'],
      },

      // Allow read access to own data
      {
        id: 'own-data-read',
        name: 'Read Own Data',
        resourceType: 'user_data',
        conditions: [
          { attribute: 'resource.ownerId', operator: 'equals', value: '${user.id}' },
        ],
        actions: ['read'],
        effect: 'allow',
        priority: 50,
        frameworks: ['soc2', 'iso27001'],
      },

      // Deny audit log modification
      {
        id: 'audit-log-immutable',
        name: 'Audit Logs Immutable',
        resourceType: 'audit_log',
        conditions: [],
        actions: ['write', 'delete'],
        effect: 'deny',
        priority: 100,
        frameworks: ['soc2', 'hipaa', 'iso27001'],
      },
    ];
  }

  private getApplicablePolicies(request: AccessRequest): AccessPolicy[] {
    return this.policies
      .filter(p => p.resourceType === request.resourceType)
      .filter(p => p.actions.includes(request.action))
      .sort((a, b) => b.priority - a.priority);
  }

  private evaluatePolicies(
    request: AccessRequest,
    session: SessionInfo,
    policies: AccessPolicy[]
  ): AccessDecision {
    for (const policy of policies) {
      const conditionsMet = this.evaluateConditions(policy.conditions, request, session);

      if (conditionsMet) {
        if (policy.effect === 'deny') {
          return {
            allowed: false,
            reason: `Denied by policy: ${policy.name}`,
            requiredMFA: false,
            auditRequired: true,
          };
        } else {
          return {
            allowed: true,
            reason: `Allowed by policy: ${policy.name}`,
            requiredMFA: false,
            auditRequired: true,
          };
        }
      }
    }

    // Default deny
    return {
      allowed: false,
      reason: 'No matching policy found - default deny',
      requiredMFA: false,
      auditRequired: true,
    };
  }

  private evaluateConditions(
    conditions: AccessCondition[],
    _request: AccessRequest,
    _session: SessionInfo
  ): boolean {
    // Simplified condition evaluation
    // In production, implement full expression evaluation
    return conditions.length === 0;
  }

  private async getSession(userId: string): Promise<SessionInfo | null> {
    // Check cache first
    const cached = this.sessionCache.get(userId);
    if (cached && (!cached.expiresAt || cached.expiresAt > new Date())) {
      return cached;
    }

    // In production, fetch from session store
    // For now, return a mock session
    const session: SessionInfo = {
      userId,
      authenticated: true,
      mfaVerified: false,
      phiAuthorized: false,
      roles: ['user'],
      expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 hours
    };

    this.sessionCache.set(userId, session);
    return session;
  }

  private async logAccessGranted(request: AccessRequest): Promise<void> {
    await complianceAuditLogger.logAccessControl({
      userId: request.userId,
      agentId: request.agentId,
      resourceType: request.resourceType,
      resourceId: request.resourceId,
      action: 'granted',
      permission: request.action,
    });
  }

  private async logAccessDenied(request: AccessRequest, reason: string): Promise<void> {
    await complianceAuditLogger.logAccessControl({
      userId: request.userId,
      agentId: request.agentId,
      resourceType: request.resourceType,
      resourceId: request.resourceId,
      action: 'denied',
      permission: request.action,
      reason,
    });
  }
}

// =============================================================================
// Supporting Types
// =============================================================================

interface SessionInfo {
  userId: string;
  authenticated: boolean;
  mfaVerified: boolean;
  phiAuthorized: boolean;
  roles: string[];
  expiresAt?: Date;
}

interface AccessReviewResult {
  reviewId: string;
  reviewedBy: string;
  reviewedAt: Date;
  scope: string;
  totalAccounts: number;
  accountsReviewed: number;
  issuesFound: {
    accountId: string;
    issue: string;
    severity: string;
  }[];
  recommendations: string[];
  nextReviewDate: Date;
}

// Export singleton
export const complianceAccessControl = ComplianceAccessControl.getInstance();
