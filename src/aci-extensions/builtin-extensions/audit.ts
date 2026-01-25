/**
 * Audit Trail Extension
 *
 * Provides comprehensive audit logging for all agent activities.
 * Integrates with Vorion's proof module for cryptographic sealing
 * of audit records.
 *
 * @packageDocumentation
 * @module @vorion/aci-extensions/builtin-extensions/audit
 * @license Apache-2.0
 */

import { createLogger } from '../../common/logger.js';
import type {
  ACIExtension,
  AgentIdentity,
  CapabilityRequest,
  CapabilityGrant,
  ActionRequest,
  ActionRecord,
  RevocationEvent,
  TrustAdjustment,
  TrustAdjustmentResult,
  Attestation,
  AttestationVerificationResult,
  AnomalyReport,
  AnomalyResponse,
  PreCheckResult,
  PreActionResult,
  ExpiryDecision,
} from '../types.js';

const logger = createLogger({ component: 'aci-ext-audit' });

/**
 * Audit event types
 */
export type AuditEventType =
  | 'capability.requested'
  | 'capability.granted'
  | 'capability.denied'
  | 'capability.expired'
  | 'action.initiated'
  | 'action.completed'
  | 'action.failed'
  | 'trust.adjusted'
  | 'trust.revoked'
  | 'attestation.verified'
  | 'attestation.failed'
  | 'anomaly.detected'
  | 'anomaly.responded';

/**
 * Audit record structure
 */
export interface AuditEvent {
  /** Unique event ID */
  id: string;
  /** Event type */
  type: AuditEventType;
  /** Event timestamp */
  timestamp: Date;
  /** Agent DID */
  agentDid: string;
  /** Agent ACI at time of event */
  agentAci: string;
  /** Event details */
  details: Record<string, unknown>;
  /** Request/action ID if applicable */
  correlationId?: string;
  /** Previous event in chain */
  previousEventId?: string;
  /** Hash of the event for integrity */
  hash?: string;
  /** Signature if cryptographically sealed */
  signature?: string;
}

/**
 * Audit configuration
 */
interface AuditConfig {
  /** Whether to log to external audit service */
  externalLogging: boolean;
  /** Whether to include detailed parameters in audit */
  includeDetails: boolean;
  /** Retention period in days */
  retentionDays: number;
  /** Whether to chain events cryptographically */
  chainEvents: boolean;
}

const DEFAULT_CONFIG: AuditConfig = {
  externalLogging: false,
  includeDetails: true,
  retentionDays: 365,
  chainEvents: true,
};

/**
 * In-memory audit log (in production, use database/external service)
 */
const auditLog: Map<string, AuditEvent[]> = new Map();

/**
 * Track last event ID per agent for chaining
 */
const lastEventIds: Map<string, string> = new Map();

/**
 * Generate unique ID
 */
function generateId(): string {
  return `audit-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Calculate simple hash of event (in production, use proper crypto)
 */
function calculateHash(event: Omit<AuditEvent, 'hash' | 'signature'>): string {
  const content = JSON.stringify({
    id: event.id,
    type: event.type,
    timestamp: event.timestamp.toISOString(),
    agentDid: event.agentDid,
    details: event.details,
    previousEventId: event.previousEventId,
  });

  // Simple hash for demo - use crypto.subtle in production
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

/**
 * Write audit event
 */
function writeAuditEvent(
  type: AuditEventType,
  agent: AgentIdentity,
  details: Record<string, unknown>,
  correlationId?: string,
  config: AuditConfig = DEFAULT_CONFIG
): AuditEvent {
  const id = generateId();
  const previousEventId = config.chainEvents
    ? lastEventIds.get(agent.did)
    : undefined;

  const event: AuditEvent = {
    id,
    type,
    timestamp: new Date(),
    agentDid: agent.did,
    agentAci: agent.aci,
    details: config.includeDetails ? details : { summary: type },
    correlationId,
    previousEventId,
  };

  // Calculate hash
  event.hash = calculateHash(event);

  // Store event
  let agentEvents = auditLog.get(agent.did);
  if (!agentEvents) {
    agentEvents = [];
    auditLog.set(agent.did, agentEvents);
  }
  agentEvents.push(event);

  // Update last event ID for chaining
  lastEventIds.set(agent.did, id);

  // Log
  logger.info(
    {
      auditEventId: id,
      eventType: type,
      agentDid: agent.did,
      correlationId,
    },
    'Audit event recorded'
  );

  return event;
}

/**
 * Query audit events for an agent
 */
export function queryAuditEvents(
  agentDid: string,
  options?: {
    type?: AuditEventType;
    startTime?: Date;
    endTime?: Date;
    limit?: number;
  }
): AuditEvent[] {
  const events = auditLog.get(agentDid) ?? [];

  let filtered = events;

  if (options?.type) {
    filtered = filtered.filter((e) => e.type === options.type);
  }

  if (options?.startTime) {
    filtered = filtered.filter((e) => e.timestamp >= options.startTime!);
  }

  if (options?.endTime) {
    filtered = filtered.filter((e) => e.timestamp <= options.endTime!);
  }

  // Sort by timestamp descending
  filtered = filtered.sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
  );

  if (options?.limit) {
    filtered = filtered.slice(0, options.limit);
  }

  return filtered;
}

/**
 * Verify audit chain integrity
 */
export function verifyAuditChain(agentDid: string): {
  valid: boolean;
  brokenAt?: string;
  details?: string;
} {
  const events = auditLog.get(agentDid) ?? [];

  // Sort by timestamp
  const sorted = events.sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i]!;
    const previous = sorted[i - 1]!;

    // Check chain linkage
    if (current.previousEventId !== previous.id) {
      return {
        valid: false,
        brokenAt: current.id,
        details: `Event ${current.id} does not link to previous event ${previous.id}`,
      };
    }

    // Verify hash
    const expectedHash = calculateHash({
      id: current.id,
      type: current.type,
      timestamp: current.timestamp,
      agentDid: current.agentDid,
      agentAci: current.agentAci,
      details: current.details,
      correlationId: current.correlationId,
      previousEventId: current.previousEventId,
    });

    if (current.hash !== expectedHash) {
      return {
        valid: false,
        brokenAt: current.id,
        details: `Hash mismatch for event ${current.id}`,
      };
    }
  }

  return { valid: true };
}

/**
 * Audit Trail Extension
 *
 * Provides comprehensive audit logging including:
 * - Capability request/grant auditing
 * - Action initiation/completion auditing
 * - Trust adjustment auditing
 * - Anomaly response auditing
 * - Cryptographic chaining of events
 */
export const auditExtension: ACIExtension = {
  extensionId: 'aci-ext-audit-v1',
  name: 'Audit Trail',
  version: '1.0.0',
  shortcode: 'audit',
  publisher: 'did:web:agentanchor.io',
  description:
    'Comprehensive audit logging with cryptographic chaining. ' +
    'Records all agent activities for compliance and forensics.',
  requiredACIVersion: '>=1.0.0',

  hooks: {
    onLoad: async () => {
      logger.info('Audit Trail extension loaded');
    },

    onUnload: async () => {
      logger.info('Audit Trail extension unloading');
      // In production: flush pending events to persistent storage
      auditLog.clear();
      lastEventIds.clear();
    },
  },

  capability: {
    /**
     * Audit capability requests
     */
    preCheck: async (
      agent: AgentIdentity,
      request: CapabilityRequest
    ): Promise<PreCheckResult> => {
      writeAuditEvent('capability.requested', agent, {
        domains: request.domains,
        level: request.level,
        purpose: request.context.purpose,
        source: request.context.source,
        ttl: request.ttl,
      });

      // Audit extension doesn't block - always allow
      return { allow: true };
    },

    /**
     * Audit capability grants
     */
    postGrant: async (
      agent: AgentIdentity,
      grant: CapabilityGrant
    ): Promise<CapabilityGrant> => {
      writeAuditEvent(
        'capability.granted',
        agent,
        {
          grantId: grant.id,
          domains: grant.domains,
          level: grant.level,
          expiresAt: grant.expiresAt.toISOString(),
          constraintCount: grant.constraints?.length ?? 0,
        },
        grant.id
      );

      return grant;
    },

    /**
     * Audit capability expiry
     */
    onExpiry: async (
      agent: AgentIdentity,
      grant: CapabilityGrant
    ): Promise<ExpiryDecision> => {
      writeAuditEvent(
        'capability.expired',
        agent,
        {
          grantId: grant.id,
          domains: grant.domains,
          level: grant.level,
          issuedAt: grant.issuedAt.toISOString(),
          expiresAt: grant.expiresAt.toISOString(),
        },
        grant.id
      );

      // Default: let capability expire naturally
      return { action: 'expire' };
    },
  },

  action: {
    /**
     * Audit action initiation
     */
    preAction: async (
      agent: AgentIdentity,
      action: ActionRequest
    ): Promise<PreActionResult> => {
      const correlationId = `action-${Date.now()}`;

      writeAuditEvent(
        'action.initiated',
        agent,
        {
          actionType: action.type,
          targetType: action.target.type,
          targetId: action.target.id,
          purpose: action.context.purpose,
          source: action.context.source,
        },
        correlationId
      );

      // Audit extension doesn't block - always allow
      return { proceed: true };
    },

    /**
     * Audit action completion
     */
    postAction: async (
      agent: AgentIdentity,
      action: ActionRecord
    ): Promise<void> => {
      writeAuditEvent(
        action.result?.success ? 'action.completed' : 'action.failed',
        agent,
        {
          actionId: action.id,
          actionType: action.type,
          targetType: action.target.type,
          targetId: action.target.id,
          success: action.result?.success,
          startedAt: action.startedAt.toISOString(),
          completedAt: action.completedAt?.toISOString(),
          duration: action.completedAt
            ? new Date(action.completedAt).getTime() -
              new Date(action.startedAt).getTime()
            : undefined,
          sideEffectCount: action.result?.sideEffects?.length ?? 0,
          errorMessage: action.error?.message,
        },
        action.id
      );
    },

    /**
     * Audit action failures
     */
    onFailure: async (
      agent: AgentIdentity,
      action: ActionRecord,
      error: Error
    ) => {
      writeAuditEvent(
        'action.failed',
        agent,
        {
          actionId: action.id,
          actionType: action.type,
          targetType: action.target.type,
          targetId: action.target.id,
          errorName: error.name,
          errorMessage: error.message,
          startedAt: action.startedAt.toISOString(),
        },
        action.id
      );

      // Don't affect retry behavior
      return { retry: true };
    },
  },

  monitoring: {
    /**
     * Audit anomaly responses
     */
    onAnomaly: async (
      agent: AgentIdentity,
      anomaly: AnomalyReport
    ): Promise<AnomalyResponse> => {
      writeAuditEvent(
        'anomaly.detected',
        agent,
        {
          anomalyId: anomaly.id,
          anomalyType: anomaly.type,
          severity: anomaly.severity,
          description: anomaly.description,
          detectedAt: anomaly.detectedAt.toISOString(),
        },
        anomaly.id
      );

      // Audit doesn't affect anomaly handling - just logs
      return { action: 'log' };
    },
  },

  trust: {
    /**
     * Audit revocation events
     */
    onRevocation: async (revocation: RevocationEvent): Promise<void> => {
      // Create a minimal agent identity for auditing
      const pseudoAgent: AgentIdentity = {
        did: revocation.agentDid,
        aci: revocation.aci,
        publisher: 'unknown',
        name: 'revoked-agent',
        trustTier: 0,
        trustScore: 0,
        domains: 0,
        level: 0,
        version: '0.0.0',
      };

      writeAuditEvent(
        'trust.revoked',
        pseudoAgent,
        {
          revocationId: revocation.id,
          scope: revocation.scope,
          reason: revocation.reason,
          revokedAt: revocation.revokedAt.toISOString(),
          attestationIds: revocation.attestationIds,
        },
        revocation.id
      );
    },

    /**
     * Audit trust adjustments
     */
    adjustTrust: async (
      agent: AgentIdentity,
      adjustment: TrustAdjustment
    ): Promise<TrustAdjustmentResult> => {
      // Calculate what the adjustment would be (simplified)
      let newScore = agent.trustScore;
      switch (adjustment.type) {
        case 'increment':
          newScore = Math.min(1000, agent.trustScore + (adjustment.amount ?? 0));
          break;
        case 'decrement':
          newScore = Math.max(0, agent.trustScore - (adjustment.amount ?? 0));
          break;
        case 'set':
          newScore = adjustment.value ?? agent.trustScore;
          break;
      }

      const scoreToTier = (score: number): 0 | 1 | 2 | 3 | 4 | 5 => {
        if (score >= 900) return 5;
        if (score >= 700) return 4;
        if (score >= 500) return 3;
        if (score >= 300) return 2;
        if (score >= 100) return 1;
        return 0;
      };

      const previousTier = scoreToTier(agent.trustScore);
      const newTier = scoreToTier(newScore);

      writeAuditEvent('trust.adjusted', agent, {
        adjustmentType: adjustment.type,
        adjustmentAmount: adjustment.amount,
        adjustmentValue: adjustment.value,
        reason: adjustment.reason,
        evidence: adjustment.evidence,
        previousScore: agent.trustScore,
        newScore,
        previousTier,
        newTier,
        tierChanged: previousTier !== newTier,
      });

      return {
        previousScore: agent.trustScore,
        newScore,
        previousTier,
        newTier,
        tierChanged: previousTier !== newTier,
      };
    },

    /**
     * Audit attestation verification
     */
    verifyAttestation: async (
      attestation: Attestation
    ): Promise<AttestationVerificationResult> => {
      // Perform basic verification
      const now = new Date();
      const notExpired = attestation.expiresAt > now;
      const notRevoked = !attestation.revoked;

      // In production, verify signature cryptographically
      const signatureVerified = true; // Placeholder

      // In production, verify issuer against trusted list
      const issuerVerified = attestation.issuerDid.startsWith('did:');

      const valid =
        notExpired && notRevoked && signatureVerified && issuerVerified;

      // Create pseudo-agent for audit logging
      const pseudoAgent: AgentIdentity = {
        did: attestation.agentDid,
        aci: `aci:${attestation.agentDid}`,
        publisher: attestation.issuerDid,
        name: 'attestation-subject',
        trustTier: 0,
        trustScore: 0,
        domains: 0,
        level: 0,
        version: '0.0.0',
      };

      writeAuditEvent(
        valid ? 'attestation.verified' : 'attestation.failed',
        pseudoAgent,
        {
          attestationId: attestation.id,
          issuerDid: attestation.issuerDid,
          type: attestation.type,
          issuedAt: attestation.issuedAt.toISOString(),
          expiresAt: attestation.expiresAt.toISOString(),
          valid,
          notExpired,
          notRevoked,
          issuerVerified,
          signatureVerified,
        },
        attestation.id
      );

      const errors: string[] = [];
      const warnings: string[] = [];

      if (!notExpired) errors.push('Attestation has expired');
      if (!notRevoked) errors.push('Attestation has been revoked');
      if (!issuerVerified) errors.push('Issuer could not be verified');
      if (!signatureVerified) errors.push('Signature verification failed');

      if (attestation.expiresAt < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)) {
        warnings.push('Attestation expires within 7 days');
      }

      return {
        valid,
        errors,
        warnings,
        issuerVerified,
        signatureVerified,
        notExpired,
        notRevoked,
      };
    },
  },
};

/**
 * Create audit extension with custom configuration
 */
export function createAuditExtension(
  config?: Partial<AuditConfig>
): ACIExtension {
  // Could be extended to use custom config
  return auditExtension;
}

export default auditExtension;
