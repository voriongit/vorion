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
import {
  getDatabase,
  withStatementTimeout,
  DEFAULT_STATEMENT_TIMEOUT_MS,
} from '../common/db.js';
import { getConfig } from '../common/config.js';
import { VorionError } from '../common/types.js';
import {
  encryptObject,
  decryptObject,
  isEncryptedField,
  computeHash,
  computeChainedHash,
} from '../common/encryption.js';
import {
  traceEncryptSync,
  traceDecryptSync,
} from './tracing.js';
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

// =============================================================================
// PAGINATION CONSTANTS
// =============================================================================

/** Default page size when no limit is specified */
export const DEFAULT_PAGE_SIZE = 50;

/** Maximum allowed page size to prevent unbounded queries */
export const MAX_PAGE_SIZE = 1000;

/**
 * Paginated result with metadata for cursor/offset-based pagination
 */
export interface PaginatedResult<T> {
  /** The items in the current page */
  items: T[];
  /** Total count of matching items (if available) */
  total?: number;
  /** The limit used for this query */
  limit: number;
  /** The offset used for this query (for offset-based pagination) */
  offset?: number;
  /** Cursor for the next page (for cursor-based pagination) */
  nextCursor?: ID;
  /** Whether there are more items after this page */
  hasMore: boolean;
}

export interface ListIntentFilters {
  tenantId: ID;
  entityId?: ID;
  status?: IntentStatus;
  /** Page size limit (default: DEFAULT_PAGE_SIZE, max: MAX_PAGE_SIZE) */
  limit?: number;
  /** Offset for pagination (default: 0) */
  offset?: number;
  /** Cursor for pagination (intent ID) - mutually exclusive with offset */
  cursor?: ID;
  /** Include soft-deleted intents */
  includeDeleted?: boolean;
  /**
   * If true, throw an error when limit exceeds MAX_PAGE_SIZE instead of silently capping.
   * Default: false (silently cap to MAX_PAGE_SIZE for backwards compatibility)
   */
  strictLimitValidation?: boolean;
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
    // Calculate size of encrypted data for tracing
    const sizeBytes = typeof data === 'object' && data !== null
      ? JSON.stringify(data).length
      : 0;

    return traceDecryptSync(sizeBytes, () => {
      return decryptObject(data);
    });
  }
  return (data ?? {}) as Record<string, unknown>;
}

/**
 * Encrypt context/metadata if encryption is enabled
 */
function encryptIfEnabled(data: Record<string, unknown>): unknown {
  const config = getConfig();
  if (config.intent.encryptContext) {
    // Calculate size of data to encrypt for tracing
    const sizeBytes = JSON.stringify(data).length;

    return traceEncryptSync(sizeBytes, () => {
      return encryptObject(data);
    });
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
    trustScore: row.trustScore ?? null,
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

    return this.db.transaction(async (tx) => {
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

  /**
   * Create multiple intents in a single batch operation.
   *
   * This method provides optimized performance for bulk inserts by using
   * a single database transaction. Note that individual intents will not
   * have initial events recorded - use this for high-performance scenarios
   * where event tracking can be handled separately.
   *
   * @param intentsData - Array of intent data to insert
   * @returns Array of created intents
   */
  async createIntentsBatch(intentsData: NewIntentRow[]): Promise<Intent[]> {
    if (intentsData.length === 0) {
      return [];
    }

    const encryptedData = intentsData.map((data) => ({
      ...data,
      context: encryptIfEnabled(data.context as Record<string, unknown>),
      metadata: encryptIfEnabled((data.metadata ?? {}) as Record<string, unknown>),
    }));

    const rows = await this.db.insert(intents).values(encryptedData).returning();
    return rows.map(mapRow);
  }

  /**
   * Create multiple intents with their initial events in a single transaction.
   *
   * This method provides atomicity for bulk inserts - either all intents
   * and events are created, or none are. This is the recommended method
   * for enterprise batch operations where audit trail is required.
   *
   * @param intentsWithEvents - Array of intent data with corresponding event data
   * @returns Array of created intents
   */
  async createIntentsBatchWithEvents(
    intentsWithEvents: Array<{
      intentData: NewIntentRow;
      eventData: Omit<NewIntentEventRow, 'intentId'>;
    }>
  ): Promise<Intent[]> {
    if (intentsWithEvents.length === 0) {
      return [];
    }

    return this.db.transaction(async (tx) => {
      // Prepare encrypted intent data
      const encryptedIntents = intentsWithEvents.map(({ intentData }) => ({
        ...intentData,
        context: encryptIfEnabled(intentData.context as Record<string, unknown>),
        metadata: encryptIfEnabled((intentData.metadata ?? {}) as Record<string, unknown>),
      }));

      // Batch insert all intents
      const intentRows = await tx.insert(intents).values(encryptedIntents).returning();

      // Prepare event data with intent IDs and hashes
      const eventRows = intentRows.map((intentRow, index) => {
        const eventData = intentsWithEvents[index]?.eventData;
        if (!eventData) {
          throw new Error(`Missing event data for intent at index ${index}`);
        }

        const eventPayload = {
          ...eventData,
          intentId: intentRow.id,
        };
        const eventHash = computeHash(JSON.stringify(eventPayload));

        return {
          ...eventPayload,
          hash: eventHash,
          previousHash: null, // First event in chain
        };
      });

      // Batch insert all events
      await tx.insert(intentEvents).values(eventRows);

      return intentRows.map(mapRow);
    });
  }

  /**
   * Record multiple events in a single batch operation.
   *
   * Note: This does NOT chain hashes across events - each event
   * gets its own independent hash. For scenarios requiring event
   * chain integrity, use recordEvent() individually.
   *
   * @param events - Array of events to record
   */
  async recordEventsBatch(events: NewIntentEventRow[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    // Compute hashes for all events (without chaining)
    const eventsWithHashes = events.map((event) => {
      const eventData = JSON.stringify({
        intentId: event.intentId,
        eventType: event.eventType,
        payload: event.payload,
        occurredAt: new Date().toISOString(),
      });
      const hash = computeHash(eventData);

      return {
        ...event,
        hash,
        previousHash: null, // Independent hashes for batch
      };
    });

    await this.db.insert(intentEvents).values(eventsWithHashes);
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
   * Update status and record event atomically within a transaction.
   * Ensures data integrity: either both operations succeed or neither does.
   */
  async updateStatusWithEvent(
    id: ID,
    tenantId: ID,
    status: IntentStatus,
    eventType: string,
    eventPayload: Record<string, unknown>
  ): Promise<Intent | null> {
    return this.db.transaction(async (tx) => {
      // Update the intent status
      const [row] = await tx
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

      if (!row) return null;

      // Record the event with hash chain integrity (within same transaction)
      const [lastEvent] = await tx
        .select({ hash: intentEvents.hash })
        .from(intentEvents)
        .where(eq(intentEvents.intentId, id))
        .orderBy(desc(intentEvents.occurredAt))
        .limit(1)
        .for('update');

      const previousHash = lastEvent?.hash ?? '0'.repeat(64);
      const eventData = JSON.stringify({
        intentId: id,
        eventType,
        payload: eventPayload,
        occurredAt: new Date().toISOString(),
      });
      const hash = computeChainedHash(eventData, previousHash);

      await tx.insert(intentEvents).values({
        intentId: id,
        eventType,
        payload: eventPayload,
        hash,
        previousHash,
      });

      return mapRow(row);
    });
  }

  /**
   * Cancel an intent and record evaluation + event atomically within a transaction.
   * Ensures data integrity: either all operations succeed or none do.
   */
  async cancelIntentWithEvent(
    id: ID,
    tenantId: ID,
    reason: string,
    evaluationResult: Record<string, unknown>,
    eventPayload: Record<string, unknown>
  ): Promise<Intent | null> {
    return this.db.transaction(async (tx) => {
      // Update the intent to cancelled status
      const [row] = await tx
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

      if (!row) return null;

      // Record evaluation
      await tx.insert(intentEvaluations).values({
        intentId: id,
        tenantId,
        result: evaluationResult,
      });

      // Record the event with hash chain integrity
      const [lastEvent] = await tx
        .select({ hash: intentEvents.hash })
        .from(intentEvents)
        .where(eq(intentEvents.intentId, id))
        .orderBy(desc(intentEvents.occurredAt))
        .limit(1)
        .for('update');

      const previousHash = lastEvent?.hash ?? '0'.repeat(64);
      const eventData = JSON.stringify({
        intentId: id,
        eventType: 'intent.cancelled',
        payload: eventPayload,
        occurredAt: new Date().toISOString(),
      });
      const hash = computeChainedHash(eventData, previousHash);

      await tx.insert(intentEvents).values({
        intentId: id,
        eventType: 'intent.cancelled',
        payload: eventPayload,
        hash,
        previousHash,
      });

      return mapRow(row);
    });
  }

  /**
   * Soft delete an intent and record event atomically within a transaction.
   * Ensures data integrity: either both operations succeed or neither does.
   */
  async softDeleteWithEvent(id: ID, tenantId: ID): Promise<Intent | null> {
    return this.db.transaction(async (tx) => {
      const deletedAt = new Date();

      // Soft delete the intent
      const [row] = await tx
        .update(intents)
        .set({
          deletedAt,
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

      if (!row) return null;

      // Record the event with hash chain integrity
      const [lastEvent] = await tx
        .select({ hash: intentEvents.hash })
        .from(intentEvents)
        .where(eq(intentEvents.intentId, id))
        .orderBy(desc(intentEvents.occurredAt))
        .limit(1)
        .for('update');

      const previousHash = lastEvent?.hash ?? '0'.repeat(64);
      const eventPayload = { deletedAt: deletedAt.toISOString() };
      const eventData = JSON.stringify({
        intentId: id,
        eventType: 'intent.deleted',
        payload: eventPayload,
        occurredAt: new Date().toISOString(),
      });
      const hash = computeChainedHash(eventData, previousHash);

      await tx.insert(intentEvents).values({
        intentId: id,
        eventType: 'intent.deleted',
        payload: eventPayload,
        hash,
        previousHash,
      });

      return mapRow(row);
    });
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
   * List intents with cursor-based or offset-based pagination.
   * Enforces strict pagination limits to prevent unbounded queries.
   * Uses statement timeout to prevent long-running queries.
   *
   * @param filters - Query filters and pagination options
   * @returns Paginated result with items and pagination metadata
   * @throws VorionError if strictLimitValidation is true and limit > MAX_PAGE_SIZE
   * @throws StatementTimeoutError if the query exceeds the timeout
   */
  async listIntents(filters: ListIntentFilters): Promise<PaginatedResult<Intent>> {
    const {
      tenantId,
      entityId,
      status,
      cursor,
      includeDeleted,
      strictLimitValidation = false,
      offset = 0,
    } = filters;

    // Validate and enforce pagination limits
    const requestedLimit = filters.limit ?? DEFAULT_PAGE_SIZE;

    if (strictLimitValidation && requestedLimit > MAX_PAGE_SIZE) {
      throw new VorionError(
        `Requested limit ${requestedLimit} exceeds maximum allowed limit of ${MAX_PAGE_SIZE}`,
        'PAGINATION_LIMIT_EXCEEDED'
      );
    }

    // Cap limit at MAX_PAGE_SIZE (silently if not strict)
    const limit = Math.min(requestedLimit, MAX_PAGE_SIZE);

    return withStatementTimeout(async () => {
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

      // Query with LIMIT + 1 to detect hasMore
      const rows = await this.db
        .select()
        .from(intents)
        .where(whereClause)
        .orderBy(desc(intents.createdAt))
        .limit(limit + 1)
        .offset(cursor ? 0 : offset); // Only use offset for offset-based pagination

      // Determine if there are more results
      const hasMore = rows.length > limit;
      const resultRows = hasMore ? rows.slice(0, limit) : rows;
      const items = resultRows.map(mapRow);

      // Determine next cursor for cursor-based pagination
      const lastItem = items[items.length - 1];

      // Build result object conditionally to satisfy exactOptionalPropertyTypes
      const result: PaginatedResult<Intent> = {
        items,
        limit,
        hasMore,
      };

      // Only include offset for offset-based pagination (not cursor-based)
      if (!cursor) {
        result.offset = offset;
      }

      // Only include nextCursor when there are more results
      if (hasMore && lastItem) {
        result.nextCursor = lastItem.id;
      }

      return result;
    }, DEFAULT_STATEMENT_TIMEOUT_MS, 'listIntents');
  }

  /**
   * Record event with cryptographic hash for tamper detection.
   * Uses a transaction with row-level locking to prevent TOCTOU race conditions
   * when multiple concurrent events try to chain to the same previous hash.
   */
  async recordEvent(event: NewIntentEventRow): Promise<void> {
    await this.db.transaction(async (tx) => {
      // Use FOR UPDATE to lock the last event row, preventing concurrent reads
      // from seeing the same "last hash" before either insert completes
      const [lastEvent] = await tx
        .select({ hash: intentEvents.hash })
        .from(intentEvents)
        .where(eq(intentEvents.intentId, event.intentId))
        .orderBy(desc(intentEvents.occurredAt))
        .limit(1)
        .for('update');

      const previousHash = lastEvent?.hash ?? '0'.repeat(64);
      const eventData = JSON.stringify({
        intentId: event.intentId,
        eventType: event.eventType,
        payload: event.payload,
        occurredAt: new Date().toISOString(),
      });
      const hash = computeChainedHash(eventData, previousHash);

      await tx.insert(intentEvents).values({
        ...event,
        hash,
        previousHash,
      });
    });
  }

  /**
   * Get recent events for an intent with pagination limits.
   *
   * @param intentId - The intent ID to get events for
   * @param limit - Page size limit (default: DEFAULT_PAGE_SIZE, max: MAX_PAGE_SIZE)
   * @param offset - Offset for pagination (default: 0)
   * @returns Paginated result with events and pagination metadata
   */
  async getRecentEvents(
    intentId: ID,
    limit: number = DEFAULT_PAGE_SIZE,
    offset: number = 0
  ): Promise<PaginatedResult<IntentEventRecord>> {
    // Enforce pagination limits
    const effectiveLimit = Math.min(limit, MAX_PAGE_SIZE);

    // Query with LIMIT + 1 to detect hasMore
    const rows = await this.db
      .select()
      .from(intentEvents)
      .where(eq(intentEvents.intentId, intentId))
      .orderBy(desc(intentEvents.occurredAt))
      .limit(effectiveLimit + 1)
      .offset(offset);

    // Determine if there are more results
    const hasMore = rows.length > effectiveLimit;
    const resultRows = hasMore ? rows.slice(0, effectiveLimit) : rows;

    const items = resultRows.map((row) => ({
      id: row.id,
      intentId: row.intentId,
      eventType: row.eventType,
      payload: (row.payload ?? {}) as Record<string, unknown>,
      occurredAt: row.occurredAt?.toISOString() ?? new Date().toISOString(),
      hash: row.hash,
      previousHash: row.previousHash,
    }));

    return {
      items,
      limit: effectiveLimit,
      offset,
      hasMore,
    };
  }

  /**
   * Configuration for event chain verification
   */
  static readonly EVENT_CHAIN_VERIFICATION_BATCH_SIZE = 100;
  static readonly EVENT_CHAIN_VERIFICATION_MAX_EVENTS = 10000;

  /**
   * Verify event chain integrity with pagination to prevent memory exhaustion.
   *
   * This method loads events in batches and verifies the hash chain incrementally,
   * returning early on the first invalid hash. This prevents memory exhaustion
   * for intents with thousands of events.
   *
   * @param intentId - The intent ID to verify events for
   * @param options - Optional configuration
   * @param options.batchSize - Number of events to load per batch (default: 100)
   * @param options.maxEvents - Maximum events to verify before stopping (default: 10000)
   * @returns Verification result with validity status and any error details
   */
  async verifyEventChain(
    intentId: ID,
    options?: {
      batchSize?: number;
      maxEvents?: number;
    }
  ): Promise<{
    valid: boolean;
    invalidAt?: number;
    error?: string;
    eventsVerified?: number;
    truncated?: boolean;
  }> {
    const batchSize = options?.batchSize ?? IntentRepository.EVENT_CHAIN_VERIFICATION_BATCH_SIZE;
    const maxEvents = options?.maxEvents ?? IntentRepository.EVENT_CHAIN_VERIFICATION_MAX_EVENTS;

    let previousHash = '0'.repeat(64);
    let offset = 0;
    let totalEventsVerified = 0;
    let hasMoreEvents = true;

    while (hasMoreEvents) {
      // Check if we've hit the max events limit
      if (totalEventsVerified >= maxEvents) {
        return {
          valid: true,
          eventsVerified: totalEventsVerified,
          truncated: true,
          error: `Verification stopped after ${maxEvents} events (limit reached). Chain valid up to this point.`,
        };
      }

      // Calculate how many events to fetch in this batch
      const remainingAllowed = maxEvents - totalEventsVerified;
      const currentBatchSize = Math.min(batchSize, remainingAllowed);

      // Fetch a batch of events
      const events = await this.db
        .select()
        .from(intentEvents)
        .where(eq(intentEvents.intentId, intentId))
        .orderBy(intentEvents.occurredAt)
        .limit(currentBatchSize + 1) // Fetch one extra to detect if there are more
        .offset(offset);

      // Check if there are more events after this batch
      hasMoreEvents = events.length > currentBatchSize;
      const eventsToProcess = hasMoreEvents ? events.slice(0, currentBatchSize) : events;

      // If no events in first batch, return valid (empty chain is valid)
      if (eventsToProcess.length === 0 && offset === 0) {
        return { valid: true, eventsVerified: 0 };
      }

      // If no more events to process, we're done
      if (eventsToProcess.length === 0) {
        break;
      }

      // Verify each event in the batch
      for (let i = 0; i < eventsToProcess.length; i++) {
        const event = eventsToProcess[i];
        if (!event) continue;

        const globalIndex = offset + i;

        // Verify previous hash link
        if (event.previousHash !== previousHash) {
          return {
            valid: false,
            invalidAt: globalIndex,
            eventsVerified: globalIndex,
            error: `Chain broken at event ${globalIndex}: expected previousHash ${previousHash}, got ${event.previousHash}`,
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
            invalidAt: globalIndex,
            eventsVerified: globalIndex,
            error: `Hash mismatch at event ${globalIndex}: content may have been tampered`,
          };
        }

        previousHash = event.hash ?? previousHash;
        totalEventsVerified++;
      }

      // Move to next batch
      offset += eventsToProcess.length;
    }

    return {
      valid: true,
      eventsVerified: totalEventsVerified,
    };
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

  /**
   * List evaluations for an intent with pagination limits.
   *
   * @param intentId - The intent ID to get evaluations for
   * @param limit - Page size limit (default: DEFAULT_PAGE_SIZE, max: MAX_PAGE_SIZE)
   * @param offset - Offset for pagination (default: 0)
   * @returns Paginated result with evaluations and pagination metadata
   */
  async listEvaluations(
    intentId: ID,
    limit: number = DEFAULT_PAGE_SIZE,
    offset: number = 0
  ): Promise<PaginatedResult<IntentEvaluationRecord>> {
    // Enforce pagination limits
    const effectiveLimit = Math.min(limit, MAX_PAGE_SIZE);

    // Query with LIMIT + 1 to detect hasMore
    const rows = await this.db
      .select()
      .from(intentEvaluations)
      .where(eq(intentEvaluations.intentId, intentId))
      .orderBy(desc(intentEvaluations.createdAt))
      .limit(effectiveLimit + 1)
      .offset(offset);

    // Determine if there are more results
    const hasMore = rows.length > effectiveLimit;
    const resultRows = hasMore ? rows.slice(0, effectiveLimit) : rows;

    return {
      items: resultRows.map(mapEvaluation),
      limit: effectiveLimit,
      offset,
      hasMore,
    };
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
