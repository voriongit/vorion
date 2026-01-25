/**
 * REPLAY - Snapshot Manager
 *
 * Captures and restores system state at intent execution time
 * for accurate replay and "what-if" analysis.
 */

import { randomUUID } from 'node:crypto';
import { trace, SpanKind, SpanStatusCode, type Span } from '@opentelemetry/api';
import type {
  ID,
  Intent,
  TrustLevel,
  TrustScore,
  Timestamp,
} from '../../common/types.js';
import type { Policy, PolicyEvaluationContext } from '../../policy/types.js';
import { createLogger } from '../../common/logger.js';

const logger = createLogger({ component: 'snapshot-manager' });

// Tracer for snapshot operations
const TRACER_NAME = 'vorion.replay.snapshot';
const tracer = trace.getTracer(TRACER_NAME, '1.0.0');

/**
 * Trust state snapshot at a point in time
 */
export interface TrustSnapshot {
  entityId: ID;
  score: TrustScore;
  level: TrustLevel;
  components: {
    behavioral: number;
    compliance: number;
    identity: number;
    context: number;
  };
  capturedAt: Timestamp;
}

/**
 * Policy snapshot at a point in time
 */
export interface PolicySnapshot {
  id: ID;
  name: string;
  namespace: string;
  version: number;
  checksum: string;
  definition: Policy['definition'];
  capturedAt: Timestamp;
}

/**
 * Environment context snapshot
 */
export interface EnvironmentSnapshot {
  timestamp: Timestamp;
  timezone: string;
  requestId: ID;
  custom?: Record<string, unknown>;
}

/**
 * Complete system snapshot for replay
 */
export interface SystemSnapshot {
  id: ID;
  intentId: ID;
  tenantId: ID;

  /** The original intent state */
  intent: Intent;

  /** Trust scores at execution time */
  trust: TrustSnapshot;

  /** Active policies at execution time */
  policies: PolicySnapshot[];

  /** Environment context */
  environment: EnvironmentSnapshot;

  /** Additional metadata */
  metadata: Record<string, unknown>;

  /** When this snapshot was captured */
  capturedAt: Timestamp;

  /** Version of the snapshot format */
  version: '1.0';
}

/**
 * Options for snapshot capture
 */
export interface SnapshotCaptureOptions {
  /** Include full policy definitions (larger but more accurate) */
  includePolicyDefinitions?: boolean;
  /** Include custom context data */
  customContext?: Record<string, unknown>;
  /** Metadata to attach to snapshot */
  metadata?: Record<string, unknown>;
}

/**
 * Options for snapshot restoration
 */
export interface SnapshotRestoreOptions {
  /** Override trust scores */
  trustOverride?: Partial<TrustSnapshot>;
  /** Override policies */
  policyOverrides?: Partial<PolicySnapshot>[];
  /** Override environment */
  environmentOverride?: Partial<EnvironmentSnapshot>;
}

/**
 * Restored context ready for replay
 */
export interface RestoredContext {
  intent: Intent;
  trust: TrustSnapshot;
  policies: PolicySnapshot[];
  environment: EnvironmentSnapshot;
  evaluationContext: PolicyEvaluationContext;
}

/**
 * In-memory snapshot store (should be replaced with persistent storage in production)
 */
const snapshotStore = new Map<ID, SystemSnapshot>();

/**
 * SnapshotManager - Captures and restores system state for replay
 */
export class SnapshotManager {
  /**
   * Capture a complete system snapshot at the current point in time
   */
  async capture(
    intent: Intent,
    trustData: {
      score: TrustScore;
      level: TrustLevel;
      components?: {
        behavioral: number;
        compliance: number;
        identity: number;
        context: number;
      };
    },
    policies: Policy[],
    options: SnapshotCaptureOptions = {}
  ): Promise<SystemSnapshot> {
    return tracer.startActiveSpan(
      'snapshot.capture',
      { kind: SpanKind.INTERNAL },
      async (span: Span) => {
        try {
          const now = new Date().toISOString();
          const snapshotId = randomUUID();

          span.setAttributes({
            'snapshot.id': snapshotId,
            'snapshot.intent_id': intent.id,
            'snapshot.tenant_id': intent.tenantId,
            'snapshot.policy_count': policies.length,
          });

          // Capture trust snapshot
          const trustSnapshot: TrustSnapshot = {
            entityId: intent.entityId,
            score: trustData.score,
            level: trustData.level,
            components: trustData.components ?? {
              behavioral: 0,
              compliance: 0,
              identity: 0,
              context: 0,
            },
            capturedAt: now,
          };

          // Capture policy snapshots
          const policySnapshots: PolicySnapshot[] = policies.map((policy) => ({
            id: policy.id,
            name: policy.name,
            namespace: policy.namespace,
            version: policy.version,
            checksum: policy.checksum,
            definition: options.includePolicyDefinitions ? policy.definition : {
              version: '1.0',
              rules: [],
              defaultAction: policy.definition.defaultAction,
            },
            capturedAt: now,
          }));

          // Capture environment snapshot
          const environmentSnapshot: EnvironmentSnapshot = {
            timestamp: now,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            requestId: randomUUID(),
            custom: options.customContext,
          };

          const snapshot: SystemSnapshot = {
            id: snapshotId,
            intentId: intent.id,
            tenantId: intent.tenantId,
            intent: { ...intent },
            trust: trustSnapshot,
            policies: policySnapshots,
            environment: environmentSnapshot,
            metadata: options.metadata ?? {},
            capturedAt: now,
            version: '1.0',
          };

          // Store snapshot
          snapshotStore.set(snapshotId, snapshot);

          logger.info(
            {
              snapshotId,
              intentId: intent.id,
              policyCount: policies.length,
            },
            'System snapshot captured'
          );

          span.setStatus({ code: SpanStatusCode.OK });
          return snapshot;
        } catch (error) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : 'Unknown error',
          });
          if (error instanceof Error) {
            span.recordException(error);
          }
          throw error;
        } finally {
          span.end();
        }
      }
    );
  }

  /**
   * Retrieve a snapshot by ID
   */
  async get(snapshotId: ID): Promise<SystemSnapshot | null> {
    return snapshotStore.get(snapshotId) ?? null;
  }

  /**
   * Retrieve a snapshot by intent ID
   */
  async getByIntentId(intentId: ID): Promise<SystemSnapshot | null> {
    for (const snapshot of snapshotStore.values()) {
      if (snapshot.intentId === intentId) {
        return snapshot;
      }
    }
    return null;
  }

  /**
   * Restore a snapshot to create a replay context
   */
  async restore(
    snapshotId: ID,
    options: SnapshotRestoreOptions = {}
  ): Promise<RestoredContext | null> {
    return tracer.startActiveSpan(
      'snapshot.restore',
      { kind: SpanKind.INTERNAL },
      async (span: Span) => {
        try {
          span.setAttribute('snapshot.id', snapshotId);

          const snapshot = await this.get(snapshotId);
          if (!snapshot) {
            logger.warn({ snapshotId }, 'Snapshot not found');
            span.setStatus({ code: SpanStatusCode.ERROR, message: 'Snapshot not found' });
            return null;
          }

          // Apply trust overrides
          const trust: TrustSnapshot = {
            ...snapshot.trust,
            ...options.trustOverride,
          };

          // Apply policy overrides
          let policies = [...snapshot.policies];
          if (options.policyOverrides) {
            for (const override of options.policyOverrides) {
              const index = policies.findIndex((p) => p.id === override.id);
              if (index >= 0) {
                policies[index] = { ...policies[index], ...override } as PolicySnapshot;
              }
            }
          }

          // Apply environment overrides
          const environment: EnvironmentSnapshot = {
            ...snapshot.environment,
            ...options.environmentOverride,
          };

          // Build evaluation context for replay
          const evaluationContext: PolicyEvaluationContext = {
            intent: {
              ...snapshot.intent,
              intentType: snapshot.intent.intentType ?? 'generic',
            },
            entity: {
              id: snapshot.intent.entityId,
              type: (snapshot.intent.metadata['entityType'] as string) ?? 'agent',
              trustScore: trust.score,
              trustLevel: trust.level,
              attributes: snapshot.intent.metadata,
            },
            environment: {
              timestamp: environment.timestamp,
              timezone: environment.timezone,
              requestId: environment.requestId,
            },
            custom: environment.custom,
          };

          logger.info(
            { snapshotId, intentId: snapshot.intentId },
            'Snapshot restored for replay'
          );

          span.setStatus({ code: SpanStatusCode.OK });
          return {
            intent: snapshot.intent,
            trust,
            policies,
            environment,
            evaluationContext,
          };
        } catch (error) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : 'Unknown error',
          });
          if (error instanceof Error) {
            span.recordException(error);
          }
          throw error;
        } finally {
          span.end();
        }
      }
    );
  }

  /**
   * Delete a snapshot
   */
  async delete(snapshotId: ID): Promise<boolean> {
    const existed = snapshotStore.has(snapshotId);
    snapshotStore.delete(snapshotId);
    if (existed) {
      logger.info({ snapshotId }, 'Snapshot deleted');
    }
    return existed;
  }

  /**
   * List all snapshots for a tenant
   */
  async listByTenant(tenantId: ID): Promise<SystemSnapshot[]> {
    const snapshots: SystemSnapshot[] = [];
    for (const snapshot of snapshotStore.values()) {
      if (snapshot.tenantId === tenantId) {
        snapshots.push(snapshot);
      }
    }
    return snapshots.sort(
      (a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime()
    );
  }

  /**
   * Clear all snapshots (for testing)
   */
  async clear(): Promise<void> {
    snapshotStore.clear();
    logger.info({}, 'All snapshots cleared');
  }

  /**
   * Get snapshot count
   */
  async count(): Promise<number> {
    return snapshotStore.size;
  }
}

/**
 * Create a new SnapshotManager instance
 */
export function createSnapshotManager(): SnapshotManager {
  return new SnapshotManager();
}
