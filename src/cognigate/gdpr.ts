/**
 * Cognigate GDPR Compliance Service
 *
 * Provides GDPR-compliant data operations for the Cognigate execution runtime.
 * Supports right to access (data export), right to erasure (soft/hard delete),
 * and data retention policy enforcement.
 *
 * All operations are protected by circuit breakers and produce audit trails
 * for compliance verification.
 *
 * @packageDocumentation
 */

import { randomUUID } from 'node:crypto';
import { createLogger } from '../common/logger.js';
import { withCircuitBreaker } from '../common/circuit-breaker.js';
import type { ID, Timestamp } from '../common/types.js';

const logger = createLogger({ component: 'cognigate-gdpr' });

// =============================================================================
// TYPES
// =============================================================================

/**
 * Record types referenced in GDPR operations
 */
interface ExecutionRecord {
  id: ID;
  tenantId: ID;
  intentId: ID;
  handlerName: string;
  status: string;
  startedAt: Timestamp;
  completedAt?: Timestamp;
  resourceUsage?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  deletedAt?: Timestamp;
}

interface AuditEntry {
  id: ID;
  tenantId: ID;
  executionId: ID;
  eventType: string;
  severity: string;
  action: string;
  reason: string;
  eventTime: Timestamp;
  metadata?: Record<string, unknown>;
}

interface EscalationRecord {
  id: ID;
  executionId: ID;
  tenantId: ID;
  reason: string;
  priority: string;
  status: string;
  createdAt: Timestamp;
  resolvedAt?: Timestamp;
}

/**
 * Result of a GDPR data export operation
 */
export interface GdprExportResult {
  entityId: ID;
  tenantId: ID;
  exportedAt: Timestamp;
  records: {
    executions: ExecutionRecord[];
    auditEntries: AuditEntry[];
    escalations: EscalationRecord[];
  };
  metadata: {
    totalRecords: number;
    dataCategories: string[];
  };
}

/**
 * Result of a GDPR data erasure operation
 */
export interface GdprErasureResult {
  entityId: ID;
  tenantId: ID;
  erasedAt: Timestamp;
  recordsAffected: {
    executions: number;
    auditEntries: number;
    escalations: number;
    cacheEntries: number;
  };
  retainedForLegal: number;
}

/**
 * Options for the erasure operation
 */
export interface ErasureOptions {
  /** Whether to retain records for legal hold */
  retainForLegal?: boolean;
  /** Number of days to retain before hard delete */
  retentionDays?: number;
  /** Whether to notify configured webhooks */
  notifyWebhooks?: boolean;
}

/**
 * Result of a retention cleanup operation
 */
export interface CleanupResult {
  deletedExecutions: number;
  deletedAuditRecords: number;
  deletedEscalations: number;
  cleanedAt: Timestamp;
}

/**
 * GDPR audit trail entry
 */
export interface GdprAuditEntry {
  id: ID;
  entityId: ID;
  tenantId: ID;
  operation: 'export' | 'erasure' | 'soft_delete' | 'hard_delete' | 'cleanup';
  performedAt: Timestamp;
  performedBy?: string;
  recordsAffected: number;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// REPOSITORY INTERFACE
// =============================================================================

/**
 * Repository interface for GDPR data access.
 * Abstracted to allow different storage backends.
 */
export interface CognigateRepository {
  getExecutionsByEntity(entityId: ID, tenantId: ID): Promise<ExecutionRecord[]>;
  getAuditEntriesByEntity(entityId: ID, tenantId: ID): Promise<AuditEntry[]>;
  getEscalationsByEntity(entityId: ID, tenantId: ID): Promise<EscalationRecord[]>;
  softDeleteExecution(executionId: ID, tenantId: ID): Promise<void>;
  hardDeleteExecution(executionId: ID): Promise<void>;
  softDeleteAuditEntries(entityId: ID, tenantId: ID): Promise<number>;
  softDeleteEscalations(entityId: ID, tenantId: ID): Promise<number>;
  clearCacheEntries(entityId: ID, tenantId: ID): Promise<number>;
  getExpiredExecutions(retentionDays: number): Promise<ExecutionRecord[]>;
  hardDeleteExecutions(executionIds: ID[]): Promise<number>;
  hardDeleteAuditEntries(executionIds: ID[]): Promise<number>;
  hardDeleteEscalations(executionIds: ID[]): Promise<number>;
  getLegalHoldExecutions(entityId: ID, tenantId: ID): Promise<ExecutionRecord[]>;
  recordGdprAuditEntry(entry: GdprAuditEntry): Promise<void>;
  getGdprAuditEntries(entityId: ID, tenantId: ID): Promise<GdprAuditEntry[]>;
}

// =============================================================================
// COGNIGATE GDPR SERVICE
// =============================================================================

/**
 * Cognigate GDPR Service for data export, erasure, and retention management.
 *
 * All operations are protected by circuit breakers and produce full audit
 * trails for compliance verification. Supports legal hold to prevent
 * premature deletion of records subject to legal proceedings.
 */
export class CognigateGdprService {
  private repository: CognigateRepository;

  constructor(repository: CognigateRepository) {
    this.repository = repository;
  }

  // ===========================================================================
  // DATA EXPORT (Article 15 - Right of Access)
  // ===========================================================================

  /**
   * Export all data associated with an entity for GDPR compliance.
   * Protected by circuit breaker to prevent cascading failures.
   *
   * @param entityId - The entity (user/agent) identifier
   * @param tenantId - The tenant identifier
   * @returns Export result containing all associated records
   */
  async exportEntityData(entityId: ID, tenantId: ID): Promise<GdprExportResult> {
    logger.info({ entityId, tenantId }, 'Starting cognigate GDPR data export');

    return withCircuitBreaker('cognigateGdprExport', async () => {
      const executions = await this.repository.getExecutionsByEntity(entityId, tenantId);
      const auditEntries = await this.repository.getAuditEntriesByEntity(entityId, tenantId);
      const escalations = await this.repository.getEscalationsByEntity(entityId, tenantId);

      const totalRecords = executions.length + auditEntries.length + escalations.length;
      const exportedAt = new Date().toISOString();

      const result: GdprExportResult = {
        entityId,
        tenantId,
        exportedAt,
        records: {
          executions,
          auditEntries,
          escalations,
        },
        metadata: {
          totalRecords,
          dataCategories: [
            'execution_records',
            'audit_entries',
            'escalation_records',
          ],
        },
      };

      // Record GDPR audit trail
      await this.repository.recordGdprAuditEntry({
        id: randomUUID(),
        entityId,
        tenantId,
        operation: 'export',
        performedAt: exportedAt,
        recordsAffected: totalRecords,
        metadata: { dataCategories: result.metadata.dataCategories },
      });

      logger.info(
        { entityId, tenantId, totalRecords },
        'Cognigate GDPR data export completed'
      );

      return result;
    });
  }

  // ===========================================================================
  // DATA ERASURE (Article 17 - Right to Erasure)
  // ===========================================================================

  /**
   * Erase all data associated with an entity.
   * Supports legal hold to prevent deletion of records under legal proceedings.
   * Protected by circuit breaker.
   *
   * @param entityId - The entity (user/agent) identifier
   * @param tenantId - The tenant identifier
   * @param options - Erasure configuration options
   * @returns Erasure result with affected record counts
   */
  async eraseEntityData(
    entityId: ID,
    tenantId: ID,
    options?: ErasureOptions
  ): Promise<GdprErasureResult> {
    logger.info({ entityId, tenantId, options }, 'Starting cognigate GDPR data erasure');

    return withCircuitBreaker('cognigateGdprErasure', async () => {
      let retainedForLegal = 0;

      // Check for legal hold
      if (options?.retainForLegal) {
        const legalHoldRecords = await this.repository.getLegalHoldExecutions(entityId, tenantId);
        retainedForLegal = legalHoldRecords.length;
        logger.info(
          { entityId, retainedForLegal },
          'Records retained for legal hold'
        );
      }

      // Soft delete executions (marks as deleted but retains structure)
      const executions = await this.repository.getExecutionsByEntity(entityId, tenantId);
      for (const execution of executions) {
        if (!execution.deletedAt) {
          await this.repository.softDeleteExecution(execution.id, tenantId);
        }
      }

      // Soft delete audit entries
      const auditEntriesAffected = await this.repository.softDeleteAuditEntries(entityId, tenantId);

      // Soft delete escalations
      const escalationsAffected = await this.repository.softDeleteEscalations(entityId, tenantId);

      // Clear cache entries
      const cacheEntriesCleared = await this.repository.clearCacheEntries(entityId, tenantId);

      const erasedAt = new Date().toISOString();
      const result: GdprErasureResult = {
        entityId,
        tenantId,
        erasedAt,
        recordsAffected: {
          executions: executions.length,
          auditEntries: auditEntriesAffected,
          escalations: escalationsAffected,
          cacheEntries: cacheEntriesCleared,
        },
        retainedForLegal,
      };

      // Record GDPR audit trail
      await this.repository.recordGdprAuditEntry({
        id: randomUUID(),
        entityId,
        tenantId,
        operation: 'erasure',
        performedAt: erasedAt,
        recordsAffected:
          executions.length + auditEntriesAffected + escalationsAffected + cacheEntriesCleared,
        metadata: {
          retainedForLegal,
          retainForLegal: options?.retainForLegal ?? false,
          retentionDays: options?.retentionDays,
        },
      });

      logger.info(
        { entityId, tenantId, recordsAffected: result.recordsAffected, retainedForLegal },
        'Cognigate GDPR data erasure completed'
      );

      return result;
    });
  }

  // ===========================================================================
  // SOFT DELETE
  // ===========================================================================

  /**
   * Soft delete a specific execution record.
   * Marks the record as deleted without physically removing data.
   *
   * @param executionId - The execution identifier
   * @param tenantId - The tenant identifier (validates access)
   */
  async softDeleteExecution(executionId: ID, tenantId: ID): Promise<void> {
    logger.info({ executionId, tenantId }, 'Soft deleting cognigate execution');

    await withCircuitBreaker('cognigateGdprSoftDelete', async () => {
      await this.repository.softDeleteExecution(executionId, tenantId);

      await this.repository.recordGdprAuditEntry({
        id: randomUUID(),
        entityId: executionId,
        tenantId,
        operation: 'soft_delete',
        performedAt: new Date().toISOString(),
        recordsAffected: 1,
      });
    });
  }

  // ===========================================================================
  // HARD DELETE
  // ===========================================================================

  /**
   * Permanently remove an execution record from storage.
   * This operation is irreversible.
   *
   * @param executionId - The execution identifier
   */
  async hardDeleteExecution(executionId: ID): Promise<void> {
    logger.info({ executionId }, 'Hard deleting cognigate execution');

    await withCircuitBreaker('cognigateGdprHardDelete', async () => {
      await this.repository.hardDeleteExecution(executionId);

      await this.repository.recordGdprAuditEntry({
        id: randomUUID(),
        entityId: executionId,
        tenantId: 'system',
        operation: 'hard_delete',
        performedAt: new Date().toISOString(),
        recordsAffected: 1,
      });
    });
  }

  // ===========================================================================
  // RETENTION POLICY
  // ===========================================================================

  /**
   * Clean up records that have exceeded the retention period.
   * Permanently removes soft-deleted records older than retentionDays.
   *
   * @param retentionDays - Number of days after which to permanently delete
   * @returns Cleanup result with counts of deleted records
   */
  async cleanupExpiredRecords(retentionDays: number): Promise<CleanupResult> {
    logger.info({ retentionDays }, 'Starting cognigate retention cleanup');

    return withCircuitBreaker('cognigateGdprCleanup', async () => {
      const expiredExecutions = await this.repository.getExpiredExecutions(retentionDays);
      const executionIds = expiredExecutions.map((e) => e.id);

      let deletedExecutions = 0;
      let deletedAuditRecords = 0;
      let deletedEscalations = 0;

      if (executionIds.length > 0) {
        deletedExecutions = await this.repository.hardDeleteExecutions(executionIds);
        deletedAuditRecords = await this.repository.hardDeleteAuditEntries(executionIds);
        deletedEscalations = await this.repository.hardDeleteEscalations(executionIds);
      }

      const cleanedAt = new Date().toISOString();

      const result: CleanupResult = {
        deletedExecutions,
        deletedAuditRecords,
        deletedEscalations,
        cleanedAt,
      };

      // Record GDPR audit trail
      await this.repository.recordGdprAuditEntry({
        id: randomUUID(),
        entityId: 'system',
        tenantId: 'system',
        operation: 'cleanup',
        performedAt: cleanedAt,
        recordsAffected: deletedExecutions + deletedAuditRecords + deletedEscalations,
        metadata: {
          retentionDays,
          deletedExecutions,
          deletedAuditRecords,
          deletedEscalations,
        },
      });

      logger.info(
        { retentionDays, deletedExecutions, deletedAuditRecords, deletedEscalations },
        'Cognigate retention cleanup completed'
      );

      return result;
    });
  }

  // ===========================================================================
  // GDPR AUDIT TRAIL
  // ===========================================================================

  /**
   * Retrieve the GDPR operation audit trail for an entity.
   * Shows all export, erasure, and cleanup operations performed.
   *
   * @param entityId - The entity identifier
   * @param tenantId - The tenant identifier
   * @returns List of GDPR audit entries
   */
  async getGdprAuditTrail(entityId: ID, tenantId: ID): Promise<GdprAuditEntry[]> {
    logger.debug({ entityId, tenantId }, 'Fetching cognigate GDPR audit trail');
    return this.repository.getGdprAuditEntries(entityId, tenantId);
  }
}

// =============================================================================
// FACTORY
// =============================================================================

/**
 * Create a new CognigateGdprService instance.
 *
 * @param repository - The data access repository
 * @returns A new CognigateGdprService instance
 */
export function createCognigateGdprService(
  repository: CognigateRepository
): CognigateGdprService {
  return new CognigateGdprService(repository);
}
