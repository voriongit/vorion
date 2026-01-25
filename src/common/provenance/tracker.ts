/**
 * Provenance Tracker
 *
 * Core tracking functionality for entity provenance.
 * Tracks who created what, when, and how it changed.
 *
 * @packageDocumentation
 */

import { randomUUID } from 'node:crypto';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { createLogger } from '../logger.js';
import { sha256 } from '../crypto.js';
import type {
  Actor,
  ProvenanceRecord,
  CreateProvenanceRecord,
} from './types.js';
import type { ProvenanceStorage } from './storage.js';
import { recordAudit } from '../../intent/audit.js';

const logger = createLogger({ component: 'provenance-tracker' });
const tracer = trace.getTracer('provenance-tracker');

/**
 * ProvenanceTracker class for tracking entity changes
 */
export class ProvenanceTracker {
  private storage: ProvenanceStorage;

  constructor(storage: ProvenanceStorage) {
    this.storage = storage;
  }

  /**
   * Track a provenance event for an entity
   *
   * @param entity - Entity type being tracked
   * @param action - Action performed
   * @param data - Data snapshot at time of action
   * @param actor - Actor who performed the action
   * @param tenantId - Tenant identifier
   * @param metadata - Optional additional metadata
   * @returns Created provenance record
   */
  async track(
    entity: string,
    action: string,
    data: Record<string, unknown>,
    actor: Actor,
    tenantId: string,
    metadata?: Record<string, unknown>
  ): Promise<ProvenanceRecord> {
    return tracer.startActiveSpan('provenance.track', async (span) => {
      try {
        span.setAttribute('entity.type', entity);
        span.setAttribute('action', action);
        span.setAttribute('actor.id', actor.id);
        span.setAttribute('actor.type', actor.type);
        span.setAttribute('tenant.id', tenantId);

        // Extract entity ID from data or generate one
        const entityId = (data['id'] as string) || (data['entityId'] as string) || randomUUID();

        // Get the last record for this entity to build the chain
        const history = await this.storage.getByEntityId(entityId, tenantId, { limit: 1 });
        const lastRecord = history.items[0];

        const previousHash = lastRecord?.hash || '';
        const chainPosition = lastRecord ? lastRecord.chainPosition + 1 : 1;

        // Use the same timestamp for both hashing and record creation
        const createdAt = new Date().toISOString();

        // Create the record content for hashing
        const recordContent = {
          entityId,
          entityType: entity,
          action,
          data,
          actor,
          tenantId,
          previousHash,
          chainPosition,
          timestamp: createdAt,
        };

        // Calculate hash of record content
        const hash = await sha256(JSON.stringify(recordContent));

        const record: ProvenanceRecord = {
          id: randomUUID(),
          entityId,
          entityType: entity,
          action,
          data,
          actor,
          hash,
          previousHash,
          chainPosition,
          tenantId,
          metadata,
          createdAt,
        };

        // Store the record
        const storedRecord = await this.storage.save(record);

        logger.debug(
          {
            recordId: storedRecord.id,
            entityId,
            entityType: entity,
            action,
            actorId: actor.id,
            chainPosition,
          },
          'Provenance record created'
        );

        // Record audit entry asynchronously
        recordAudit({
          tenantId,
          userId: actor.type === 'user' ? actor.id : 'system',
          action: 'intent.create' as const,
          resourceType: 'intent',
          resourceId: entityId,
          metadata: {
            provenanceRecordId: storedRecord.id,
            entityType: entity,
            provenanceAction: action,
          },
        });

        span.setStatus({ code: SpanStatusCode.OK });
        return storedRecord;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage });
        logger.error({ error }, 'Failed to track provenance');
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Get provenance history for an entity
   *
   * @param entityId - Entity identifier
   * @param tenantId - Tenant identifier
   * @returns Array of provenance records ordered by chain position
   */
  async getHistory(entityId: string, tenantId: string): Promise<ProvenanceRecord[]> {
    return tracer.startActiveSpan('provenance.getHistory', async (span) => {
      try {
        span.setAttribute('entity.id', entityId);
        span.setAttribute('tenant.id', tenantId);

        const result = await this.storage.getByEntityId(entityId, tenantId);

        logger.debug(
          { entityId, recordCount: result.items.length },
          'Retrieved provenance history'
        );

        span.setStatus({ code: SpanStatusCode.OK });
        return result.items;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage });
        logger.error({ error, entityId }, 'Failed to get provenance history');
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Get a single provenance record by ID
   *
   * @param recordId - Record identifier
   * @param tenantId - Tenant identifier
   * @returns Provenance record or null if not found
   */
  async getRecord(recordId: string, tenantId: string): Promise<ProvenanceRecord | null> {
    return tracer.startActiveSpan('provenance.getRecord', async (span) => {
      try {
        span.setAttribute('record.id', recordId);
        span.setAttribute('tenant.id', tenantId);

        const record = await this.storage.getById(recordId, tenantId);

        span.setStatus({ code: SpanStatusCode.OK });
        return record;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage });
        logger.error({ error, recordId }, 'Failed to get provenance record');
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Track a batch of provenance events
   *
   * @param records - Array of records to create
   * @returns Array of created provenance records
   */
  async trackBatch(records: CreateProvenanceRecord[]): Promise<ProvenanceRecord[]> {
    return tracer.startActiveSpan('provenance.trackBatch', async (span) => {
      try {
        span.setAttribute('batch.size', records.length);

        const results: ProvenanceRecord[] = [];
        for (const record of records) {
          const result = await this.track(
            record.entityType,
            record.action,
            record.data,
            record.actor,
            record.tenantId,
            record.metadata
          );
          results.push(result);
        }

        logger.debug(
          { batchSize: records.length },
          'Batch provenance tracking complete'
        );

        span.setStatus({ code: SpanStatusCode.OK });
        return results;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage });
        logger.error({ error, batchSize: records.length }, 'Failed to track batch provenance');
        throw error;
      } finally {
        span.end();
      }
    });
  }
}

/**
 * Create a new ProvenanceTracker instance
 */
export function createProvenanceTracker(storage: ProvenanceStorage): ProvenanceTracker {
  return new ProvenanceTracker(storage);
}
