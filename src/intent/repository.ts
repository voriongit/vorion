import { and, desc, eq, inArray, isNotNull, isNull, lt, sql } from 'drizzle-orm';
import type {
  ID,
  Intent,
  IntentEvaluationRecord,
  IntentStatus,
  TrustLevel,
  TrustScore,
  EvaluationPayload,
} from '../common/types.js';
import { getDatabase } from '../common/db.js';
import { getConfig } from '../common/config.js';
import {
  encryptObject,
  decryptObject,
  isEncryptedField,
  computeHash,
  computeChainedHash,
} from '../common/encryption.js';
import {
  intentEvents,
  intentEvaluations,
  intents,
  type IntentEvaluationRow,
  type IntentRow,
  type NewIntentEventRow,
  type NewIntentEvaluationRow,
  type NewIntentRow,
} from './schema.js';

export interface ListIntentFilters {
  tenantId: ID;
  entityId?: ID;
  status?: IntentStatus;
  limit?: number;
  /** Cursor for pagination (intent ID) */
  cursor?: ID;
  /** Include soft-deleted intents */
  includeDeleted?: boolean;
}

export interface IntentEventRecord {
  id: ID;
  intentId: ID;
  eventType: string;
  payload: Record<string, unknown>;
  occurredAt: string;
  hash?: string | null;
  previousHash?: string | null;
}

/**
 * Decrypt context/metadata if encrypted
 */
function decryptIfNeeded(data: unknown): Record<string, unknown> {
  if (isEncryptedField(data)) {
    return decryptObject(data);
  }
  return (data ?? {}) as Record<string, unknown>;
}

/**
 * Encrypt context/metadata if encryption is enabled
 */
function encryptIfEnabled(data: Record<string, unknown>): unknown {
  const config = getConfig();
  if (config.intent.encryptContext) {
    return encryptObject(data);
  }
  return data;
}

function mapRow(row: IntentRow): Intent {
  return {
    id: row.id,
    tenantId: row.tenantId,
    entityId: row.entityId,
    goal: row.goal,
    intentType: row.intentType,
    priority: row.priority ?? 0,
    context: decryptIfNeeded(row.context),
    metadata: decryptIfNeeded(row.metadata),
    trustSnapshot: (row.trustSnapshot ?? null) as Record<string, unknown> | null,
    trustLevel: (row.trustLevel ?? null) as TrustLevel | null,
    trustScore: (row.trustScore ?? null) as TrustScore | null,
    status: row.status,
    createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
    updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
    cancellationReason: row.cancellationReason ?? null,
  };
}

function mapEvaluation(row: IntentEvaluationRow): IntentEvaluationRecord {
  return {
    id: row.id,
    intentId: row.intentId,
    tenantId: row.tenantId,
    result: (row.result ?? { stage: 'error', error: { message: 'Unknown', timestamp: new Date().toISOString() } }) as EvaluationPayload,
    createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
  };
}

export class IntentRepository {
  constructor(private db = getDatabase()) {}

  /**
   * Create intent with encryption and return the created intent
   */
  async createIntent(data: NewIntentRow): Promise<Intent> {
    const encryptedData = {
      ...data,
      context: encryptIfEnabled(data.context as Record<string, unknown>),
      metadata: encryptIfEnabled((data.metadata ?? {}) as Record<string, unknown>),
    };

    const [row] = await this.db.insert(intents).values(encryptedData).returning();
    if (!row) throw new Error('Failed to insert intent');
    return mapRow(row);
  }

  /**
   * Create intent within a transaction, including initial event
   */
  async createIntentWithEvent(
    intentData: NewIntentRow,
    eventData: Omit<NewIntentEventRow, 'intentId'>
  ): Promise<Intent> {
    const encryptedData = {
      ...intentData,
      context: encryptIfEnabled(intentData.context as Record<string, unknown>),
      metadata: encryptIfEnabled((intentData.metadata ?? {}) as Record<string, unknown>),
    };

    return await this.db.transaction(async (tx) => {
      const [intentRow] = await tx.insert(intents).values(encryptedData).returning();
      if (!intentRow) throw new Error('Failed to insert intent');

      // Compute hash for event integrity
      const eventPayload = {
        ...eventData,
        intentId: intentRow.id,
      };
      const eventHash = computeHash(JSON.stringify(eventPayload));

      await tx.insert(intentEvents).values({
        ...eventPayload,
        hash: eventHash,
        previousHash: null, // First event in chain
      });

      return mapRow(intentRow);
    });
  }

  async findById(id: ID, tenantId: ID): Promise<Intent | null> {
    const [row] = await this.db
      .select()
      .from(intents)
      .where(
        and(
          eq(intents.id, id),
          eq(intents.tenantId, tenantId),
          isNull(intents.deletedAt) // Exclude soft-deleted
        )
      );

    return row ? mapRow(row) : null;
  }

  /**
   * Find by ID including soft-deleted (for audit purposes)
   */
  async findByIdIncludeDeleted(id: ID, tenantId: ID): Promise<Intent | null> {
    const [row] = await this.db
      .select()
      .from(intents)
      .where(and(eq(intents.id, id), eq(intents.tenantId, tenantId)));

    return row ? mapRow(row) : null;
  }

  async findByDedupeHash(hash: string, tenantId: ID): Promise<Intent | null> {
    const [row] = await this.db
      .select()
      .from(intents)
      .where(
        and(
          eq(intents.dedupeHash, hash),
          eq(intents.tenantId, tenantId),
          isNull(intents.deletedAt)
        )
      );

    return row ? mapRow(row) : null;
  }

  async updateStatus(
    id: ID,
    tenantId: ID,
    status: IntentStatus
  ): Promise<Intent | null> {
    const [row] = await this.db
      .update(intents)
      .set({ status, updatedAt: new Date() })
      .where(
        and(
          eq(intents.id, id),
          eq(intents.tenantId, tenantId),
          isNull(intents.deletedAt)
        )
      )
      .returning();

    return row ? mapRow(row) : null;
  }

  /**
   * Cancel an intent with reason
   */
  async cancelIntent(
    id: ID,
    tenantId: ID,
    reason: string
  ): Promise<Intent | null> {
    const [row] = await this.db
      .update(intents)
      .set({
        status: 'cancelled',
        cancellationReason: reason,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(intents.id, id),
          eq(intents.tenantId, tenantId),
          isNull(intents.deletedAt),
          // Can only cancel pending, evaluating, or escalated intents
          inArray(intents.status, ['pending', 'evaluating', 'escalated'])
        )
      )
      .returning();

    return row ? mapRow(row) : null;
  }

  /**
   * Soft delete an intent (GDPR compliant)
   */
  async softDelete(id: ID, tenantId: ID): Promise<Intent | null> {
    const [row] = await this.db
      .update(intents)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
        // Clear sensitive data but keep audit trail
        context: {},
        metadata: {},
      })
      .where(
        and(
          eq(intents.id, id),
          eq(intents.tenantId, tenantId),
          isNull(intents.deletedAt)
        )
      )
      .returning();

    return row ? mapRow(row) : null;
  }

  /**
   * Permanently delete soft-deleted intents older than retention period
   * CRITICAL: Only deletes records where deletedAt IS NOT NULL to prevent accidental deletion
   */
  async purgeDeletedIntents(retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.db
      .delete(intents)
      .where(
        and(
          isNotNull(intents.deletedAt), // Safety: only purge soft-deleted intents
          lt(intents.deletedAt, cutoffDate)
        )
      )
      .returning({ id: intents.id });

    return result.length;
  }

  /**
   * List intents with cursor-based pagination
   */
  async listIntents(filters: ListIntentFilters): Promise<Intent[]> {
    const { tenantId, entityId, status, limit = 50, cursor, includeDeleted } = filters;
    const clauses = [eq(intents.tenantId, tenantId)];

    if (!includeDeleted) {
      clauses.push(isNull(intents.deletedAt));
    }

    if (entityId) {
      clauses.push(eq(intents.entityId, entityId));
    }

    if (status) {
      clauses.push(eq(intents.status, status));
    }

    // Cursor-based pagination: get items created before cursor
    if (cursor) {
      // First get the cursor intent's createdAt
      const [cursorIntent] = await this.db
        .select({ createdAt: intents.createdAt })
        .from(intents)
        .where(eq(intents.id, cursor));

      if (cursorIntent?.createdAt) {
        clauses.push(lt(intents.createdAt, cursorIntent.createdAt));
      }
    }

    const whereClause = clauses.length > 1 ? and(...clauses) : clauses[0];

    const rows = await this.db
      .select()
      .from(intents)
      .where(whereClause)
      .orderBy(desc(intents.createdAt))
      .limit(Math.min(limit, 100));

    return rows.map(mapRow);
  }

  /**
   * Record event with cryptographic hash for tamper detection
   */
  async recordEvent(event: NewIntentEventRow): Promise<void> {
    // Get the last event for this intent to chain hashes
    const [lastEvent] = await this.db
      .select({ hash: intentEvents.hash })
      .from(intentEvents)
      .where(eq(intentEvents.intentId, event.intentId))
      .orderBy(desc(intentEvents.occurredAt))
      .limit(1);

    const previousHash = lastEvent?.hash ?? '0'.repeat(64);
    const eventData = JSON.stringify({
      intentId: event.intentId,
      eventType: event.eventType,
      payload: event.payload,
      occurredAt: new Date().toISOString(),
    });
    const hash = computeChainedHash(eventData, previousHash);

    await this.db.insert(intentEvents).values({
      ...event,
      hash,
      previousHash,
    });
  }

  async getRecentEvents(intentId: ID, limit = 10): Promise<IntentEventRecord[]> {
    const rows = await this.db
      .select()
      .from(intentEvents)
      .where(eq(intentEvents.intentId, intentId))
      .orderBy(desc(intentEvents.occurredAt))
      .limit(limit);

    return rows.map((row) => ({
      id: row.id,
      intentId: row.intentId,
      eventType: row.eventType,
      payload: (row.payload ?? {}) as Record<string, unknown>,
      occurredAt: row.occurredAt?.toISOString() ?? new Date().toISOString(),
      hash: row.hash,
      previousHash: row.previousHash,
    }));
  }

  /**
   * Verify event chain integrity
   */
  async verifyEventChain(intentId: ID): Promise<{
    valid: boolean;
    invalidAt?: number;
    error?: string;
  }> {
    const events = await this.db
      .select()
      .from(intentEvents)
      .where(eq(intentEvents.intentId, intentId))
      .orderBy(intentEvents.occurredAt);

    let previousHash = '0'.repeat(64);

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      if (!event) continue;

      // Verify previous hash link
      if (event.previousHash !== previousHash) {
        return {
          valid: false,
          invalidAt: i,
          error: `Chain broken at event ${i}: expected previousHash ${previousHash}, got ${event.previousHash}`,
        };
      }

      // Verify event hash
      const eventData = JSON.stringify({
        intentId: event.intentId,
        eventType: event.eventType,
        payload: event.payload,
        occurredAt: event.occurredAt?.toISOString(),
      });
      const expectedHash = computeChainedHash(eventData, previousHash);

      if (event.hash !== expectedHash) {
        return {
          valid: false,
          invalidAt: i,
          error: `Hash mismatch at event ${i}: content may have been tampered`,
        };
      }

      previousHash = event.hash ?? previousHash;
    }

    return { valid: true };
  }

  async updateTrustMetadata(
    intentId: ID,
    tenantId: ID,
    trustSnapshot: Record<string, unknown> | null,
    trustLevel?: TrustLevel,
    trustScore?: TrustScore
  ): Promise<Intent | null> {
    const [row] = await this.db
      .update(intents)
      .set({
        trustSnapshot,
        trustLevel: trustLevel ?? null,
        trustScore: trustScore ?? null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(intents.id, intentId),
          eq(intents.tenantId, tenantId),
          isNull(intents.deletedAt)
        )
      )
      .returning();

    return row ? mapRow(row) : null;
  }

  async recordEvaluation(
    evaluation: NewIntentEvaluationRow
  ): Promise<IntentEvaluationRecord> {
    const [row] = await this.db
      .insert(intentEvaluations)
      .values(evaluation)
      .returning();
    if (!row) throw new Error('Failed to insert intent evaluation');
    return mapEvaluation(row);
  }

  async listEvaluations(intentId: ID): Promise<IntentEvaluationRecord[]> {
    const rows = await this.db
      .select()
      .from(intentEvaluations)
      .where(eq(intentEvaluations.intentId, intentId))
      .orderBy(desc(intentEvaluations.createdAt));
    return rows.map(mapEvaluation);
  }

  async countActiveIntents(tenantId: ID): Promise<number> {
    const activeStatuses: IntentStatus[] = [
      'pending',
      'evaluating',
      'escalated',
      'executing',
    ];
    const [row] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(intents)
      .where(
        and(
          eq(intents.tenantId, tenantId),
          inArray(intents.status, activeStatuses),
          isNull(intents.deletedAt)
        )
      );

    const count = row?.count ?? 0;
    return Number(count);
  }

  /**
   * Delete old events for retention compliance
   */
  async deleteOldEvents(retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.db
      .delete(intentEvents)
      .where(lt(intentEvents.occurredAt, cutoffDate))
      .returning({ id: intentEvents.id });

    return result.length;
  }
}
