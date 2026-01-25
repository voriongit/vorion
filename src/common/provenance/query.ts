/**
 * Provenance Query Builder
 *
 * Fluent query builder for provenance records with pagination and export support.
 *
 * @packageDocumentation
 */

import { trace, SpanStatusCode } from '@opentelemetry/api';
import { createLogger } from '../logger.js';
import type {
  ProvenanceRecord,
  ProvenanceQueryFilters,
  PaginationOptions,
  PaginatedResult,
  ExportFormat,
  ActorType,
} from './types.js';
import type { ProvenanceStorage } from './storage.js';

const logger = createLogger({ component: 'provenance-query' });
const tracer = trace.getTracer('provenance-query');

/**
 * Query builder for provenance records
 */
export class ProvenanceQueryBuilder {
  private storage: ProvenanceStorage;
  private filters: ProvenanceQueryFilters = {};
  private pagination: PaginationOptions = { limit: 100, offset: 0 };

  constructor(storage: ProvenanceStorage) {
    this.storage = storage;
  }

  /**
   * Filter by entity ID
   */
  forEntity(entityId: string): this {
    this.filters.entityId = entityId;
    return this;
  }

  /**
   * Filter by entity type
   */
  ofType(entityType: string): this {
    this.filters.entityType = entityType;
    return this;
  }

  /**
   * Filter by actor ID
   */
  byActor(actorId: string): this {
    this.filters.actorId = actorId;
    return this;
  }

  /**
   * Filter by actor type
   */
  byActorType(actorType: ActorType): this {
    this.filters.actorType = actorType;
    return this;
  }

  /**
   * Filter by action
   */
  withAction(action: string): this {
    this.filters.action = action;
    return this;
  }

  /**
   * Filter by tenant
   */
  inTenant(tenantId: string): this {
    this.filters.tenantId = tenantId;
    return this;
  }

  /**
   * Filter by time range
   */
  inTimeRange(from?: Date, to?: Date): this {
    if (from) {
      this.filters.from = from;
    }
    if (to) {
      this.filters.to = to;
    }
    return this;
  }

  /**
   * Filter from a specific date
   */
  since(from: Date): this {
    this.filters.from = from;
    return this;
  }

  /**
   * Filter until a specific date
   */
  until(to: Date): this {
    this.filters.to = to;
    return this;
  }

  /**
   * Set pagination limit
   */
  limit(limit: number): this {
    this.pagination.limit = Math.min(limit, 1000);
    return this;
  }

  /**
   * Set pagination offset
   */
  offset(offset: number): this {
    this.pagination.offset = offset;
    return this;
  }

  /**
   * Set page number (1-indexed)
   */
  page(pageNumber: number, pageSize: number = 100): this {
    this.pagination.limit = Math.min(pageSize, 1000);
    this.pagination.offset = (pageNumber - 1) * this.pagination.limit;
    return this;
  }

  /**
   * Execute the query and return paginated results
   */
  async execute(): Promise<PaginatedResult<ProvenanceRecord>> {
    return tracer.startActiveSpan('provenance.query.execute', async (span) => {
      try {
        span.setAttribute('filters', JSON.stringify(this.filters));
        span.setAttribute('pagination', JSON.stringify(this.pagination));

        const result = await this.storage.query(this.filters, this.pagination);

        logger.debug(
          {
            filters: this.filters,
            pagination: this.pagination,
            resultCount: result.items.length,
            total: result.total,
          },
          'Query executed'
        );

        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage });
        logger.error({ error }, 'Query execution failed');
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Execute query and return all matching records (with pagination handling)
   */
  async all(): Promise<ProvenanceRecord[]> {
    return tracer.startActiveSpan('provenance.query.all', async (span) => {
      try {
        const allRecords: ProvenanceRecord[] = [];
        let offset = 0;
        const batchSize = 1000;

        while (true) {
          this.pagination.offset = offset;
          this.pagination.limit = batchSize;

          const result = await this.storage.query(this.filters, this.pagination);
          allRecords.push(...result.items);

          if (!result.hasMore) {
            break;
          }

          offset += batchSize;
        }

        span.setAttribute('total.records', allRecords.length);
        span.setStatus({ code: SpanStatusCode.OK });
        return allRecords;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage });
        logger.error({ error }, 'Failed to get all records');
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Execute query and return first matching record
   */
  async first(): Promise<ProvenanceRecord | null> {
    this.pagination.limit = 1;
    const result = await this.execute();
    return result.items[0] ?? null;
  }

  /**
   * Execute query and return count of matching records
   */
  async count(): Promise<number> {
    this.pagination.limit = 1;
    const result = await this.execute();
    return result.total;
  }

  /**
   * Export query results to specified format
   */
  async export(format: ExportFormat): Promise<string> {
    return tracer.startActiveSpan('provenance.query.export', async (span) => {
      try {
        span.setAttribute('format', format);

        const records = await this.all();

        let output: string;
        switch (format) {
          case 'json':
            output = this.exportToJson(records);
            break;
          case 'csv':
            output = this.exportToCsv(records);
            break;
          default:
            throw new Error(`Unsupported export format: ${format}`);
        }

        logger.debug(
          { format, recordCount: records.length },
          'Export complete'
        );

        span.setStatus({ code: SpanStatusCode.OK });
        return output;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage });
        logger.error({ error }, 'Export failed');
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Export records to JSON format
   */
  private exportToJson(records: ProvenanceRecord[]): string {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        filters: this.filters,
        recordCount: records.length,
        records,
      },
      null,
      2
    );
  }

  /**
   * Export records to CSV format
   */
  private exportToCsv(records: ProvenanceRecord[]): string {
    if (records.length === 0) {
      return 'id,entityId,entityType,action,actorId,actorType,hash,chainPosition,tenantId,createdAt\n';
    }

    const headers = [
      'id',
      'entityId',
      'entityType',
      'action',
      'actorId',
      'actorType',
      'hash',
      'previousHash',
      'chainPosition',
      'tenantId',
      'createdAt',
      'data',
      'metadata',
    ];

    const rows = records.map((record) => {
      return [
        this.escapeCsvField(record.id),
        this.escapeCsvField(record.entityId),
        this.escapeCsvField(record.entityType),
        this.escapeCsvField(record.action),
        this.escapeCsvField(record.actor.id),
        this.escapeCsvField(record.actor.type),
        this.escapeCsvField(record.hash),
        this.escapeCsvField(record.previousHash),
        record.chainPosition.toString(),
        this.escapeCsvField(record.tenantId),
        this.escapeCsvField(record.createdAt),
        this.escapeCsvField(JSON.stringify(record.data)),
        this.escapeCsvField(JSON.stringify(record.metadata ?? {})),
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Escape a field for CSV output
   */
  private escapeCsvField(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  /**
   * Clone the query builder with current state
   */
  clone(): ProvenanceQueryBuilder {
    const cloned = new ProvenanceQueryBuilder(this.storage);
    cloned.filters = { ...this.filters };
    cloned.pagination = { ...this.pagination };
    return cloned;
  }

  /**
   * Reset all filters and pagination
   */
  reset(): this {
    this.filters = {};
    this.pagination = { limit: 100, offset: 0 };
    return this;
  }
}

/**
 * Create a new query builder
 */
export function createQueryBuilder(storage: ProvenanceStorage): ProvenanceQueryBuilder {
  return new ProvenanceQueryBuilder(storage);
}
