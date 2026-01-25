/**
 * Provenance Storage
 *
 * Storage interface and implementations for provenance records.
 * Includes in-memory storage for testing and PostgreSQL for production.
 *
 * @packageDocumentation
 */

import { randomUUID } from 'node:crypto';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { pgTable, uuid, text, integer, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { createLogger } from '../logger.js';
import { getDatabase } from '../db.js';
import type {
  ProvenanceRecord,
  ProvenanceQueryFilters,
  PaginationOptions,
  PaginatedResult,
  Actor,
} from './types.js';

const logger = createLogger({ component: 'provenance-storage' });
const tracer = trace.getTracer('provenance-storage');

// =============================================================================
// DATABASE SCHEMA
// =============================================================================

/**
 * Provenance records table schema
 */
export const provenanceRecords = pgTable(
  'provenance_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityId: uuid('entity_id').notNull(),
    entityType: text('entity_type').notNull(),
    action: text('action').notNull(),
    data: jsonb('data').notNull().$type<Record<string, unknown>>(),
    actor: jsonb('actor').notNull().$type<Actor>(),
    hash: text('hash').notNull(),
    previousHash: text('previous_hash').notNull(),
    chainPosition: integer('chain_position').notNull(),
    tenantId: uuid('tenant_id').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    entityIdIdx: index('provenance_entity_id_idx').on(table.entityId),
    tenantIdIdx: index('provenance_tenant_id_idx').on(table.tenantId),
    entityTypeIdx: index('provenance_entity_type_idx').on(table.entityType),
    actionIdx: index('provenance_action_idx').on(table.action),
    chainPositionIdx: index('provenance_chain_position_idx').on(table.entityId, table.chainPosition),
    createdAtIdx: index('provenance_created_at_idx').on(table.createdAt),
    hashIdx: index('provenance_hash_idx').on(table.hash),
  })
);

// =============================================================================
// STORAGE INTERFACE
// =============================================================================

/**
 * Storage interface for provenance records
 */
export interface ProvenanceStorage {
  /**
   * Save a provenance record
   */
  save(record: ProvenanceRecord): Promise<ProvenanceRecord>;

  /**
   * Save multiple provenance records in batch
   */
  saveBatch(records: ProvenanceRecord[]): Promise<ProvenanceRecord[]>;

  /**
   * Get a provenance record by ID
   */
  getById(id: string, tenantId: string): Promise<ProvenanceRecord | null>;

  /**
   * Get provenance records by entity ID
   */
  getByEntityId(
    entityId: string,
    tenantId: string,
    options?: PaginationOptions
  ): Promise<PaginatedResult<ProvenanceRecord>>;

  /**
   * Query provenance records with filters
   */
  query(
    filters: ProvenanceQueryFilters,
    options?: PaginationOptions
  ): Promise<PaginatedResult<ProvenanceRecord>>;

  /**
   * Delete provenance records for an entity (for testing)
   */
  deleteByEntityId(entityId: string, tenantId: string): Promise<number>;

  /**
   * Clear all records (for testing)
   */
  clear(): Promise<void>;
}

// =============================================================================
// IN-MEMORY STORAGE (FOR TESTING)
// =============================================================================

/**
 * In-memory storage implementation for testing
 */
export class InMemoryProvenanceStorage implements ProvenanceStorage {
  private records: Map<string, ProvenanceRecord> = new Map();

  async save(record: ProvenanceRecord): Promise<ProvenanceRecord> {
    const savedRecord = { ...record };
    if (!savedRecord.id) {
      savedRecord.id = randomUUID();
    }
    this.records.set(savedRecord.id, savedRecord);
    return savedRecord;
  }

  async saveBatch(records: ProvenanceRecord[]): Promise<ProvenanceRecord[]> {
    const savedRecords: ProvenanceRecord[] = [];
    for (const record of records) {
      const saved = await this.save(record);
      savedRecords.push(saved);
    }
    return savedRecords;
  }

  async getById(id: string, tenantId: string): Promise<ProvenanceRecord | null> {
    const record = this.records.get(id);
    if (record && record.tenantId === tenantId) {
      return record;
    }
    return null;
  }

  async getByEntityId(
    entityId: string,
    tenantId: string,
    options?: PaginationOptions
  ): Promise<PaginatedResult<ProvenanceRecord>> {
    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;

    const allRecords = Array.from(this.records.values())
      .filter((r) => r.entityId === entityId && r.tenantId === tenantId)
      .sort((a, b) => b.chainPosition - a.chainPosition);

    const total = allRecords.length;
    const items = allRecords.slice(offset, offset + limit);

    return {
      items,
      total,
      hasMore: offset + items.length < total,
      offset,
      limit,
    };
  }

  async query(
    filters: ProvenanceQueryFilters,
    options?: PaginationOptions
  ): Promise<PaginatedResult<ProvenanceRecord>> {
    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;

    let filtered = Array.from(this.records.values());

    if (filters.tenantId) {
      filtered = filtered.filter((r) => r.tenantId === filters.tenantId);
    }

    if (filters.entityId) {
      filtered = filtered.filter((r) => r.entityId === filters.entityId);
    }

    if (filters.entityType) {
      filtered = filtered.filter((r) => r.entityType === filters.entityType);
    }

    if (filters.actorId) {
      filtered = filtered.filter((r) => r.actor.id === filters.actorId);
    }

    if (filters.actorType) {
      filtered = filtered.filter((r) => r.actor.type === filters.actorType);
    }

    if (filters.action) {
      filtered = filtered.filter((r) => r.action === filters.action);
    }

    if (filters.from) {
      filtered = filtered.filter((r) => new Date(r.createdAt) >= filters.from!);
    }

    if (filters.to) {
      filtered = filtered.filter((r) => new Date(r.createdAt) <= filters.to!);
    }

    // Sort by creation time descending
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = filtered.length;
    const items = filtered.slice(offset, offset + limit);

    return {
      items,
      total,
      hasMore: offset + items.length < total,
      offset,
      limit,
    };
  }

  async deleteByEntityId(entityId: string, tenantId: string): Promise<number> {
    let count = 0;
    for (const [id, record] of this.records.entries()) {
      if (record.entityId === entityId && record.tenantId === tenantId) {
        this.records.delete(id);
        count++;
      }
    }
    return count;
  }

  async clear(): Promise<void> {
    this.records.clear();
  }
}

// =============================================================================
// POSTGRESQL STORAGE
// =============================================================================

/**
 * PostgreSQL storage implementation for production
 */
export class PostgresProvenanceStorage implements ProvenanceStorage {
  async save(record: ProvenanceRecord): Promise<ProvenanceRecord> {
    return tracer.startActiveSpan('provenance.storage.save', async (span) => {
      try {
        const db = getDatabase();

        const [row] = await db
          .insert(provenanceRecords)
          .values({
            id: record.id,
            entityId: record.entityId,
            entityType: record.entityType,
            action: record.action,
            data: record.data,
            actor: record.actor,
            hash: record.hash,
            previousHash: record.previousHash,
            chainPosition: record.chainPosition,
            tenantId: record.tenantId,
            metadata: record.metadata ?? null,
            createdAt: new Date(record.createdAt),
          })
          .returning();

        span.setStatus({ code: SpanStatusCode.OK });
        return this.rowToRecord(row);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage });
        logger.error({ error }, 'Failed to save provenance record');
        throw error;
      } finally {
        span.end();
      }
    });
  }

  async saveBatch(records: ProvenanceRecord[]): Promise<ProvenanceRecord[]> {
    return tracer.startActiveSpan('provenance.storage.saveBatch', async (span) => {
      try {
        span.setAttribute('batch.size', records.length);

        if (records.length === 0) {
          span.setStatus({ code: SpanStatusCode.OK });
          return [];
        }

        const db = getDatabase();

        const values = records.map((record) => ({
          id: record.id,
          entityId: record.entityId,
          entityType: record.entityType,
          action: record.action,
          data: record.data,
          actor: record.actor,
          hash: record.hash,
          previousHash: record.previousHash,
          chainPosition: record.chainPosition,
          tenantId: record.tenantId,
          metadata: record.metadata ?? null,
          createdAt: new Date(record.createdAt),
        }));

        const rows = await db.insert(provenanceRecords).values(values).returning();

        span.setStatus({ code: SpanStatusCode.OK });
        return rows.map((row) => this.rowToRecord(row));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage });
        logger.error({ error }, 'Failed to save provenance batch');
        throw error;
      } finally {
        span.end();
      }
    });
  }

  async getById(id: string, tenantId: string): Promise<ProvenanceRecord | null> {
    return tracer.startActiveSpan('provenance.storage.getById', async (span) => {
      try {
        const db = getDatabase();

        const rows = await db
          .select()
          .from(provenanceRecords)
          .where(
            and(
              eq(provenanceRecords.id, id),
              eq(provenanceRecords.tenantId, tenantId)
            )
          )
          .limit(1);

        span.setStatus({ code: SpanStatusCode.OK });
        return rows.length > 0 ? this.rowToRecord(rows[0]) : null;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage });
        logger.error({ error }, 'Failed to get provenance record');
        throw error;
      } finally {
        span.end();
      }
    });
  }

  async getByEntityId(
    entityId: string,
    tenantId: string,
    options?: PaginationOptions
  ): Promise<PaginatedResult<ProvenanceRecord>> {
    return tracer.startActiveSpan('provenance.storage.getByEntityId', async (span) => {
      try {
        const limit = Math.min(options?.limit ?? 100, 1000);
        const offset = options?.offset ?? 0;

        const db = getDatabase();

        // Get total count
        const countResult = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(provenanceRecords)
          .where(
            and(
              eq(provenanceRecords.entityId, entityId),
              eq(provenanceRecords.tenantId, tenantId)
            )
          );

        const total = countResult[0]?.count ?? 0;

        // Get paginated results
        const rows = await db
          .select()
          .from(provenanceRecords)
          .where(
            and(
              eq(provenanceRecords.entityId, entityId),
              eq(provenanceRecords.tenantId, tenantId)
            )
          )
          .orderBy(desc(provenanceRecords.chainPosition))
          .limit(limit)
          .offset(offset);

        const items = rows.map((row) => this.rowToRecord(row));

        span.setStatus({ code: SpanStatusCode.OK });
        return {
          items,
          total,
          hasMore: offset + items.length < total,
          offset,
          limit,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage });
        logger.error({ error }, 'Failed to get provenance records by entity');
        throw error;
      } finally {
        span.end();
      }
    });
  }

  async query(
    filters: ProvenanceQueryFilters,
    options?: PaginationOptions
  ): Promise<PaginatedResult<ProvenanceRecord>> {
    return tracer.startActiveSpan('provenance.storage.query', async (span) => {
      try {
        const limit = Math.min(options?.limit ?? 100, 1000);
        const offset = options?.offset ?? 0;

        const db = getDatabase();
        const conditions: ReturnType<typeof eq>[] = [];

        if (filters.tenantId) {
          conditions.push(eq(provenanceRecords.tenantId, filters.tenantId));
        }

        if (filters.entityId) {
          conditions.push(eq(provenanceRecords.entityId, filters.entityId));
        }

        if (filters.entityType) {
          conditions.push(eq(provenanceRecords.entityType, filters.entityType));
        }

        if (filters.action) {
          conditions.push(eq(provenanceRecords.action, filters.action));
        }

        if (filters.from) {
          conditions.push(gte(provenanceRecords.createdAt, filters.from));
        }

        if (filters.to) {
          conditions.push(lte(provenanceRecords.createdAt, filters.to));
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        // Get total count
        const countQuery = db
          .select({ count: sql<number>`count(*)::int` })
          .from(provenanceRecords);

        if (whereClause) {
          countQuery.where(whereClause);
        }

        const countResult = await countQuery;
        const total = countResult[0]?.count ?? 0;

        // Get paginated results
        const query = db
          .select()
          .from(provenanceRecords)
          .orderBy(desc(provenanceRecords.createdAt))
          .limit(limit)
          .offset(offset);

        if (whereClause) {
          query.where(whereClause);
        }

        const rows = await query;

        // Filter by actor properties in memory (JSONB filtering)
        let items = rows.map((row) => this.rowToRecord(row));

        if (filters.actorId) {
          items = items.filter((r) => r.actor.id === filters.actorId);
        }

        if (filters.actorType) {
          items = items.filter((r) => r.actor.type === filters.actorType);
        }

        span.setStatus({ code: SpanStatusCode.OK });
        return {
          items,
          total,
          hasMore: offset + items.length < total,
          offset,
          limit,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage });
        logger.error({ error }, 'Failed to query provenance records');
        throw error;
      } finally {
        span.end();
      }
    });
  }

  async deleteByEntityId(entityId: string, tenantId: string): Promise<number> {
    return tracer.startActiveSpan('provenance.storage.deleteByEntityId', async (span) => {
      try {
        const db = getDatabase();

        const result = await db
          .delete(provenanceRecords)
          .where(
            and(
              eq(provenanceRecords.entityId, entityId),
              eq(provenanceRecords.tenantId, tenantId)
            )
          )
          .returning();

        span.setStatus({ code: SpanStatusCode.OK });
        return result.length;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage });
        logger.error({ error }, 'Failed to delete provenance records');
        throw error;
      } finally {
        span.end();
      }
    });
  }

  async clear(): Promise<void> {
    return tracer.startActiveSpan('provenance.storage.clear', async (span) => {
      try {
        const db = getDatabase();
        await db.delete(provenanceRecords);
        span.setStatus({ code: SpanStatusCode.OK });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage });
        logger.error({ error }, 'Failed to clear provenance records');
        throw error;
      } finally {
        span.end();
      }
    });
  }

  private rowToRecord(row: typeof provenanceRecords.$inferSelect): ProvenanceRecord {
    return {
      id: row.id,
      entityId: row.entityId,
      entityType: row.entityType,
      action: row.action,
      data: row.data,
      actor: row.actor,
      hash: row.hash,
      previousHash: row.previousHash,
      chainPosition: row.chainPosition,
      tenantId: row.tenantId,
      metadata: row.metadata ?? undefined,
      createdAt: row.createdAt.toISOString(),
    };
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create an in-memory storage instance (for testing)
 */
export function createInMemoryStorage(): InMemoryProvenanceStorage {
  return new InMemoryProvenanceStorage();
}

/**
 * Create a PostgreSQL storage instance (for production)
 */
export function createPostgresStorage(): PostgresProvenanceStorage {
  return new PostgresProvenanceStorage();
}
