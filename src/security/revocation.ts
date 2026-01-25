/**
 * Revocation Management Service
 *
 * Implements revocation enforcement with SLA guarantees for ACI security hardening.
 * Handles recursive revocation when an agent in a delegation chain is revoked,
 * ensuring all downstream capabilities are invalidated.
 *
 * Key features:
 * - Tier-based revocation SLAs
 * - Recursive delegation chain revocation
 * - Token invalidation
 * - Webhook notifications
 * - Synchronous revocation checks for high-value operations
 * - Event subscription system
 *
 * Revocation SLAs per ACI spec:
 * - T0-T1: 60 seconds max propagation
 * - T2: 30 seconds max propagation
 * - T3: 10 seconds max propagation
 * - T4-T5: 1 second max propagation (sync check always)
 *
 * @packageDocumentation
 */

import { createLogger } from '../common/logger.js';
import { VorionError } from '../common/errors.js';
import { Counter, Histogram, Gauge } from 'prom-client';
import { intentRegistry } from '../intent/metrics.js';
import {
  type RevocationSLA,
  type RevocationPropagation,
  type RevocationResult,
  type RevocationStatus,
  type RevocationEvent,
  type TrustTier,
  DEFAULT_REVOCATION_SLAS,
  RevocationStatusEnum,
  revocationSLASchema,
  revocationPropagationSchema,
  revocationResultSchema,
  revocationStatusSchema,
  revocationEventSchema,
} from './types.js';

const logger = createLogger({ component: 'security-revocation' });

// =============================================================================
// Metrics
// =============================================================================

const revocationsTotal = new Counter({
  name: 'vorion_security_revocations_total',
  help: 'Total revocations processed',
  labelNames: ['outcome'] as const, // success, partial, failed
  registers: [intentRegistry],
});

const descendantsRevoked = new Counter({
  name: 'vorion_security_descendants_revoked_total',
  help: 'Total descendant DIDs revoked during recursive revocation',
  registers: [intentRegistry],
});

const tokensInvalidated = new Counter({
  name: 'vorion_security_tokens_invalidated_total',
  help: 'Total tokens invalidated during revocation',
  registers: [intentRegistry],
});

const revocationDuration = new Histogram({
  name: 'vorion_security_revocation_duration_seconds',
  help: 'Duration of revocation operations',
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [intentRegistry],
});

const revocationChecks = new Counter({
  name: 'vorion_security_revocation_checks_total',
  help: 'Total revocation status checks',
  labelNames: ['type', 'result'] as const, // type: sync/cached, result: active/revoked
  registers: [intentRegistry],
});

const revocationCacheHits = new Counter({
  name: 'vorion_security_revocation_cache_hits_total',
  help: 'Total revocation cache hits',
  registers: [intentRegistry],
});

const activeRevocations = new Gauge({
  name: 'vorion_security_active_revocations',
  help: 'Number of active revocations in the system',
  registers: [intentRegistry],
});

// =============================================================================
// Errors
// =============================================================================

/**
 * Revocation-specific error
 */
export class RevocationError extends VorionError {
  override code = 'REVOCATION_ERROR';
  override statusCode = 500;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details);
    this.name = 'RevocationError';
  }
}

/**
 * Agent is revoked error
 */
export class AgentRevokedError extends VorionError {
  override code = 'AGENT_REVOKED';
  override statusCode = 403;

  constructor(did: string, reason?: string) {
    super(`Agent ${did} has been revoked${reason ? `: ${reason}` : ''}`, { did, reason });
    this.name = 'AgentRevokedError';
  }
}

// =============================================================================
// Types
// =============================================================================

/**
 * Revocation event callback
 */
export type RevocationEventCallback = (event: RevocationEvent) => void | Promise<void>;

/**
 * Delegation registry interface for querying delegation chains
 */
export interface DelegationRegistry {
  /** Get all delegations from a DID */
  getDelegationsFrom(did: string): Promise<Array<{ delegateDid: string; delegationId: string }>>;
  /** Revoke a delegation */
  revokeDelegation(delegationId: string, reason: string): Promise<void>;
}

/**
 * Token service interface for invalidating tokens
 */
export interface TokenService {
  /** Invalidate all tokens for an agent */
  invalidateForAgent(did: string): Promise<number>;
}

/**
 * Webhook service interface
 */
export interface WebhookService {
  /** Notify webhooks of an event */
  notify(eventType: string, payload: unknown): Promise<void>;
}

// =============================================================================
// Revocation Cache
// =============================================================================

interface CachedRevocationStatus {
  status: RevocationStatus;
  cachedAt: number;
}

/**
 * In-memory revocation cache
 * For production, use Redis-backed implementation
 */
class RevocationCache {
  private cache = new Map<string, CachedRevocationStatus>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(private defaultTTLMs: number = 60000) {
    // Cleanup expired entries every 30 seconds
    this.cleanupInterval = setInterval(() => this.cleanup(), 30000);
  }

  get(did: string, maxAgeMs: number): RevocationStatus | null {
    const entry = this.cache.get(did);
    if (!entry) {
      return null;
    }

    const age = Date.now() - entry.cachedAt;
    if (age > maxAgeMs) {
      this.cache.delete(did);
      return null;
    }

    revocationCacheHits.inc();
    return {
      ...entry.status,
      fromCache: true,
      cacheAgeMs: age,
    };
  }

  set(did: string, status: RevocationStatus): void {
    this.cache.set(did, {
      status: { ...status, fromCache: false },
      cachedAt: Date.now(),
    });
  }

  invalidate(did: string): void {
    this.cache.delete(did);
  }

  private cleanup(): void {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    for (const [did, entry] of entries) {
      if (now - entry.cachedAt > this.defaultTTLMs) {
        this.cache.delete(did);
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
  }
}

// =============================================================================
// Revocation Service
// =============================================================================

/**
 * Revocation Service for managing agent revocation with SLA enforcement
 *
 * @example
 * ```typescript
 * const revocation = new RevocationService(
 *   DEFAULT_REVOCATION_SLAS,
 *   delegationRegistry,
 *   tokenService,
 *   webhookService
 * );
 *
 * // Revoke an agent with recursive propagation
 * const result = await revocation.revokeAgent({
 *   revokedDid: 'did:aci:a3i:vorion:agent-123',
 *   reason: 'Security incident',
 *   propagationPolicy: {
 *     terminateDescendants: true,
 *     gracePeriodMs: 0,
 *     notifyWebhooks: true,
 *   },
 * });
 *
 * // Check revocation status
 * const status = await revocation.checkRevocationStatus('did:aci:a3i:vorion:agent-123');
 * ```
 */
export class RevocationService {
  private slaConfig: Map<TrustTier, RevocationSLA>;
  private cache: RevocationCache;
  private revocations: Map<string, RevocationResult>; // did -> revocation
  private eventCallbacks: Set<RevocationEventCallback>;

  /**
   * Create a new revocation service
   *
   * @param slaConfig - Revocation SLAs per tier
   * @param delegationRegistry - Optional delegation registry for recursive revocation
   * @param tokenService - Optional token service for invalidation
   * @param webhookService - Optional webhook service for notifications
   */
  constructor(
    slaConfig: RevocationSLA[] = DEFAULT_REVOCATION_SLAS,
    private delegationRegistry?: DelegationRegistry,
    private tokenService?: TokenService,
    private webhookService?: WebhookService
  ) {
    // Validate and store SLA config
    this.slaConfig = new Map();
    for (const sla of slaConfig) {
      revocationSLASchema.parse(sla);
      this.slaConfig.set(sla.tier, sla);
    }

    this.cache = new RevocationCache();
    this.revocations = new Map();
    this.eventCallbacks = new Set();

    logger.info(
      { slaCount: this.slaConfig.size },
      'Revocation service initialized'
    );
  }

  /**
   * Revoke an agent with recursive propagation
   *
   * @param revocation - Revocation request
   * @returns Revocation result
   */
  async revokeAgent(revocation: RevocationPropagation): Promise<RevocationResult> {
    const startTime = Date.now();
    revocationPropagationSchema.parse(revocation);

    const revocationId = crypto.randomUUID();

    logger.info(
      { revocationId, did: revocation.revokedDid, reason: revocation.reason },
      'Starting agent revocation'
    );

    try {
      // Propagate to descendants if configured
      let descendantsRevoked: string[] = [];
      if (revocation.propagationPolicy.terminateDescendants) {
        descendantsRevoked = await this.propagateToDescendants(
          revocation.revokedDid,
          revocation.reason,
          revocation.propagationPolicy.gracePeriodMs
        );
      }

      // Invalidate tokens
      let invalidatedCount = 0;
      if (this.tokenService) {
        invalidatedCount = await this.invalidateTokens(revocation.revokedDid);
        // Also invalidate tokens for descendants
        for (const descendantDid of descendantsRevoked) {
          invalidatedCount += await this.invalidateTokens(descendantDid);
        }
      }

      // Create result
      const result: RevocationResult = {
        revocationId,
        revokedDid: revocation.revokedDid,
        descendantsRevoked,
        tokensInvalidated: invalidatedCount,
        propagationComplete: true,
        timestamp: new Date(),
      };

      revocationResultSchema.parse(result);

      // Store revocation
      this.revocations.set(revocation.revokedDid, result);
      this.cache.invalidate(revocation.revokedDid);
      activeRevocations.set(this.revocations.size);

      // Emit events
      await this.emitEvent({
        type: 'agent.revoked',
        revocationId,
        did: revocation.revokedDid,
        reason: revocation.reason,
        timestamp: new Date(),
        metadata: { descendantsRevoked: descendantsRevoked.length },
      });

      // Notify webhooks
      if (revocation.propagationPolicy.notifyWebhooks && this.webhookService) {
        try {
          await this.webhookService.notify('revocation', {
            revocationId,
            agentDid: revocation.revokedDid,
            reason: revocation.reason,
            descendantsRevoked,
            tokensInvalidated: invalidatedCount,
            timestamp: result.timestamp.toISOString(),
          });
        } catch (error) {
          logger.error({ error, revocationId }, 'Failed to notify webhooks');
        }
      }

      // Update metrics
      revocationsTotal.inc({ outcome: 'success' });
      descendantsRevokedCounter(descendantsRevoked.length);
      tokensInvalidated.inc(invalidatedCount);

      logger.info(
        {
          revocationId,
          did: revocation.revokedDid,
          descendantsRevoked: descendantsRevoked.length,
          tokensInvalidated: invalidatedCount,
          durationMs: Date.now() - startTime,
        },
        'Agent revocation completed'
      );

      return result;
    } catch (error) {
      revocationsTotal.inc({ outcome: 'failed' });
      logger.error({ error, revocationId, did: revocation.revokedDid }, 'Agent revocation failed');
      throw new RevocationError(
        `Failed to revoke agent: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { revocationId, did: revocation.revokedDid }
      );
    } finally {
      const duration = (Date.now() - startTime) / 1000;
      revocationDuration.observe(duration);
    }
  }

  /**
   * Check revocation status of a DID
   *
   * @param did - DID to check
   * @param tier - Trust tier for SLA-based caching
   * @returns Revocation status
   */
  async checkRevocationStatus(did: string, tier?: TrustTier): Promise<RevocationStatus> {
    // Get cache TTL based on tier
    const sla = tier !== undefined ? this.slaConfig.get(tier) : undefined;
    const cacheTTL = sla?.maxPropagationLatencyMs ?? 60000;

    // Check cache first
    const cached = this.cache.get(did, cacheTTL);
    if (cached) {
      revocationChecks.inc({ type: 'cached', result: cached.status });
      return cached;
    }

    // Perform fresh check
    const revocation = this.revocations.get(did);

    const status: RevocationStatus = revocation
      ? {
          did,
          status: RevocationStatusEnum.REVOKED,
          revokedAt: revocation.timestamp,
          reason: 'Agent revoked', // We could store reason in revocation result
          fromCache: false,
        }
      : {
          did,
          status: RevocationStatusEnum.ACTIVE,
          fromCache: false,
        };

    revocationStatusSchema.parse(status);

    // Cache the result
    this.cache.set(did, status);

    revocationChecks.inc({
      type: 'sync',
      result: status.status === RevocationStatusEnum.REVOKED ? 'revoked' : 'active',
    });

    return status;
  }

  /**
   * Get SLA for a trust tier
   *
   * @param tier - Trust tier
   * @returns Revocation SLA
   */
  getSLA(tier: TrustTier): RevocationSLA {
    const sla = this.slaConfig.get(tier);
    if (!sla) {
      // Return default SLA for unknown tiers
      return {
        tier,
        maxPropagationLatencyMs: 60000,
        syncCheckRequired: false,
        introspectionRequired: false,
      };
    }
    return sla;
  }

  /**
   * Synchronous revocation check for high-value operations
   *
   * Always performs a fresh check, bypassing cache.
   *
   * @param did - DID to check
   * @returns Whether DID is revoked (true = revoked)
   */
  async syncRevocationCheck(did: string): Promise<boolean> {
    // Invalidate cache to force fresh check
    this.cache.invalidate(did);

    const status = await this.checkRevocationStatus(did);
    return status.status === RevocationStatusEnum.REVOKED;
  }

  /**
   * Subscribe to revocation events
   *
   * @param callback - Callback to invoke on revocation events
   * @returns Unsubscribe function
   */
  onRevocation(callback: RevocationEventCallback): () => void {
    this.eventCallbacks.add(callback);
    return () => {
      this.eventCallbacks.delete(callback);
    };
  }

  /**
   * Check if synchronous revocation check is required
   *
   * @param tier - Trust tier
   * @param isHighValueOperation - Whether this is a high-value operation
   * @returns Whether sync check is required
   */
  requiresSyncCheck(tier: TrustTier, isHighValueOperation: boolean = false): boolean {
    const sla = this.getSLA(tier);

    // T4+ always requires sync check
    if (sla.syncCheckRequired) {
      return true;
    }

    // High-value operations for L3+ require sync check
    if (isHighValueOperation) {
      return true;
    }

    return false;
  }

  /**
   * Propagate revocation to descendants in delegation chain
   */
  private async propagateToDescendants(
    revokedDid: string,
    reason: string,
    gracePeriodMs: number
  ): Promise<string[]> {
    if (!this.delegationRegistry) {
      return [];
    }

    const revokedDescendants: string[] = [];

    // Apply grace period
    if (gracePeriodMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, gracePeriodMs));
    }

    try {
      // Get all delegations from this agent
      const delegations = await this.delegationRegistry.getDelegationsFrom(revokedDid);

      for (const delegation of delegations) {
        // Revoke the delegation
        await this.delegationRegistry.revokeDelegation(
          delegation.delegationId,
          `Parent revoked: ${revokedDid}`
        );

        revokedDescendants.push(delegation.delegateDid);

        // Emit event
        await this.emitEvent({
          type: 'delegation.terminated',
          revocationId: crypto.randomUUID(),
          did: delegation.delegateDid,
          reason: `Parent agent revoked: ${reason}`,
          timestamp: new Date(),
          metadata: { parentDid: revokedDid },
        });

        // Recursively revoke descendants
        const childDescendants = await this.propagateToDescendants(
          delegation.delegateDid,
          `Ancestor revoked: ${revokedDid}`,
          0 // No grace period for recursive calls
        );

        revokedDescendants.push(...childDescendants);
      }
    } catch (error) {
      logger.error({ error, revokedDid }, 'Error propagating revocation to descendants');
    }

    return revokedDescendants;
  }

  /**
   * Invalidate active tokens for an agent
   */
  private async invalidateTokens(did: string): Promise<number> {
    if (!this.tokenService) {
      return 0;
    }

    try {
      const count = await this.tokenService.invalidateForAgent(did);

      if (count > 0) {
        await this.emitEvent({
          type: 'token.invalidated',
          revocationId: crypto.randomUUID(),
          did,
          reason: 'Agent revoked',
          timestamp: new Date(),
          metadata: { count },
        });
      }

      return count;
    } catch (error) {
      logger.error({ error, did }, 'Error invalidating tokens');
      return 0;
    }
  }

  /**
   * Emit a revocation event to subscribers
   */
  private async emitEvent(event: RevocationEvent): Promise<void> {
    revocationEventSchema.parse(event);

    const callbacks = Array.from(this.eventCallbacks);
    for (const callback of callbacks) {
      try {
        await callback(event);
      } catch (error) {
        logger.error({ error, event }, 'Error in revocation event callback');
      }
    }
  }

  /**
   * Clear a revocation (for testing or admin operations)
   */
  clearRevocation(did: string): void {
    this.revocations.delete(did);
    this.cache.invalidate(did);
    activeRevocations.set(this.revocations.size);
    logger.info({ did }, 'Revocation cleared');
  }

  /**
   * Get all active revocations
   */
  getActiveRevocations(): RevocationResult[] {
    return Array.from(this.revocations.values());
  }

  /**
   * Destroy the service (cleanup)
   */
  destroy(): void {
    this.cache.destroy();
    this.eventCallbacks.clear();
    this.revocations.clear();
  }
}

// Helper to increment descendants counter with a specific value
function descendantsRevokedCounter(count: number): void {
  for (let i = 0; i < count; i++) {
    descendantsRevoked.inc();
  }
}

/**
 * Create a revocation service with default configuration for ACI
 */
export function createRevocationService(
  slaConfig?: RevocationSLA[],
  delegationRegistry?: DelegationRegistry,
  tokenService?: TokenService,
  webhookService?: WebhookService
): RevocationService {
  return new RevocationService(
    slaConfig ?? DEFAULT_REVOCATION_SLAS,
    delegationRegistry,
    tokenService,
    webhookService
  );
}
