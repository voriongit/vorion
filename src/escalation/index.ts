/**
 * Escalation Service
 *
 * Manages escalation requests for human-in-the-loop decisions.
 * Provides tenant-scoped access and full audit trail.
 *
 * @packageDocumentation
 */

import { eq, and, lt, desc, sql } from 'drizzle-orm';
import { createLogger } from '../common/logger.js';
import { getDatabase, type Database } from '../common/db.js';
import {
  escalations,
  escalationAudit,
  type NewEscalation,
  type NewEscalationAudit,
  type Escalation,
} from '../db/schema/escalations.js';
import type { ID } from '../common/types.js';

const logger = createLogger({ component: 'escalation' });

/**
 * Escalation creation request
 */
export interface CreateEscalationRequest {
  tenantId: ID;
  intentId: ID;
  entityId: ID;
  reason: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  escalatedTo: string;
  escalatedBy: ID;
  context: Record<string, unknown>;
  requestedAction: string;
  timeoutMinutes: number;
}

/**
 * Escalation resolution request
 */
export interface ResolveEscalationRequest {
  escalationId: ID;
  resolution: 'approved' | 'rejected';
  resolvedBy: ID;
  notes: string;
}

/**
 * Escalation query options
 */
export interface EscalationQuery {
  tenantId: ID;
  status?: 'pending' | 'approved' | 'rejected' | 'timeout' | 'cancelled';
  intentId?: ID;
  entityId?: ID;
  escalatedTo?: string;
  limit?: number;
  offset?: number;
}

/**
 * Escalation response
 */
export interface EscalationResponse {
  id: ID;
  tenantId: ID;
  intentId: ID;
  entityId: ID;
  reason: string;
  priority: string;
  status: string;
  escalatedTo: string;
  escalatedBy?: ID;
  context?: Record<string, unknown>;
  requestedAction?: string;
  resolvedBy?: ID;
  resolvedAt?: string;
  resolution?: string;
  resolutionNotes?: string;
  timeoutAt: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Escalation Service
 */
export class EscalationService {
  private db: Database | null = null;
  private initialized: boolean = false;

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.db = await getDatabase();
    this.initialized = true;
    logger.info('Escalation service initialized');
  }

  /**
   * Ensure service is initialized
   */
  private async ensureInitialized(): Promise<Database> {
    if (!this.initialized || !this.db) {
      await this.initialize();
    }
    return this.db!;
  }

  /**
   * Create a new escalation
   */
  async create(request: CreateEscalationRequest): Promise<EscalationResponse> {
    const db = await this.ensureInitialized();

    const timeoutAt = new Date(Date.now() + request.timeoutMinutes * 60 * 1000);

    const newEscalation: NewEscalation = {
      tenantId: request.tenantId,
      intentId: request.intentId,
      entityId: request.entityId,
      reason: request.reason,
      priority: request.priority,
      escalatedTo: request.escalatedTo,
      escalatedBy: request.escalatedBy,
      context: request.context,
      requestedAction: request.requestedAction,
      timeoutAt,
    };

    const [created] = await db
      .insert(escalations)
      .values(newEscalation)
      .returning();

    // Create audit log
    await this.logAudit(db, {
      escalationId: created!.id,
      tenantId: request.tenantId,
      action: 'created',
      actorId: request.escalatedBy ?? null,
      actorType: request.escalatedBy ? 'user' : 'system',
      newStatus: 'pending',
      details: { reason: request.reason, priority: request.priority },
    });

    logger.info(
      {
        escalationId: created!.id,
        intentId: request.intentId,
        escalatedTo: request.escalatedTo,
        timeoutAt: timeoutAt.toISOString(),
      },
      'Escalation created'
    );

    return this.toResponse(created!);
  }

  /**
   * Get an escalation by ID with tenant authorization
   */
  async get(id: ID, tenantId: ID): Promise<EscalationResponse | null> {
    const db = await this.ensureInitialized();

    const result = await db
      .select()
      .from(escalations)
      .where(and(eq(escalations.id, id), eq(escalations.tenantId, tenantId)))
      .limit(1);

    if (result.length === 0) return null;

    return this.toResponse(result[0]!);
  }

  /**
   * Query escalations with tenant scope
   */
  async query(query: EscalationQuery): Promise<EscalationResponse[]> {
    const db = await this.ensureInitialized();

    const conditions = [eq(escalations.tenantId, query.tenantId)];

    if (query.status) {
      conditions.push(eq(escalations.status, query.status));
    }

    if (query.intentId) {
      conditions.push(eq(escalations.intentId, query.intentId));
    }

    if (query.entityId) {
      conditions.push(eq(escalations.entityId, query.entityId));
    }

    if (query.escalatedTo) {
      conditions.push(eq(escalations.escalatedTo, query.escalatedTo));
    }

    const results = await db
      .select()
      .from(escalations)
      .where(and(...conditions))
      .orderBy(desc(escalations.createdAt))
      .limit(query.limit ?? 100)
      .offset(query.offset ?? 0);

    return results.map((r) => this.toResponse(r));
  }

  /**
   * Resolve an escalation (approve or reject)
   */
  async resolve(request: ResolveEscalationRequest, tenantId: ID): Promise<EscalationResponse | null> {
    const db = await this.ensureInitialized();

    // Get current escalation with tenant check
    const current = await db
      .select()
      .from(escalations)
      .where(
        and(
          eq(escalations.id, request.escalationId),
          eq(escalations.tenantId, tenantId)
        )
      )
      .limit(1);

    if (current.length === 0) {
      logger.warn(
        { escalationId: request.escalationId, tenantId },
        'Escalation not found or tenant mismatch'
      );
      return null;
    }

    const escalation = current[0]!;

    // Check if already resolved
    if (escalation.status !== 'pending') {
      logger.warn(
        {
          escalationId: request.escalationId,
          currentStatus: escalation.status,
        },
        'Escalation already resolved'
      );
      throw new Error(`Escalation already resolved with status: ${escalation.status}`);
    }

    const now = new Date();

    // Update escalation
    const [updated] = await db
      .update(escalations)
      .set({
        status: request.resolution,
        resolvedBy: request.resolvedBy,
        resolvedAt: now,
        resolution: request.resolution,
        resolutionNotes: request.notes || null,
        updatedAt: now,
      })
      .where(eq(escalations.id, request.escalationId))
      .returning();

    // Create audit log
    await this.logAudit(db, {
      escalationId: request.escalationId,
      tenantId,
      action: request.resolution,
      actorId: request.resolvedBy,
      actorType: 'user',
      previousStatus: 'pending',
      newStatus: request.resolution,
      details: { notes: request.notes },
    });

    logger.info(
      {
        escalationId: request.escalationId,
        resolution: request.resolution,
        resolvedBy: request.resolvedBy,
      },
      'Escalation resolved'
    );

    return this.toResponse(updated!);
  }

  /**
   * Cancel an escalation
   */
  async cancel(id: ID, tenantId: ID, cancelledBy: ID, reason?: string): Promise<EscalationResponse | null> {
    const db = await this.ensureInitialized();

    const current = await db
      .select()
      .from(escalations)
      .where(and(eq(escalations.id, id), eq(escalations.tenantId, tenantId)))
      .limit(1);

    if (current.length === 0) return null;

    if (current[0]!.status !== 'pending') {
      throw new Error(`Cannot cancel escalation with status: ${current[0]!.status}`);
    }

    const now = new Date();

    const [updated] = await db
      .update(escalations)
      .set({
        status: 'cancelled',
        resolvedBy: cancelledBy,
        resolvedAt: now,
        resolutionNotes: reason ?? null,
        updatedAt: now,
      })
      .where(eq(escalations.id, id))
      .returning();

    await this.logAudit(db, {
      escalationId: id,
      tenantId,
      action: 'cancelled',
      actorId: cancelledBy,
      actorType: 'user',
      previousStatus: 'pending',
      newStatus: 'cancelled',
      details: { reason },
    });

    logger.info({ escalationId: id, cancelledBy, reason }, 'Escalation cancelled');

    return this.toResponse(updated!);
  }

  /**
   * Process timed-out escalations
   */
  async processTimeouts(): Promise<number> {
    const db = await this.ensureInitialized();

    const now = new Date();

    // Find and update timed-out escalations
    const timedOut = await db
      .update(escalations)
      .set({
        status: 'timeout',
        updatedAt: now,
      })
      .where(
        and(
          eq(escalations.status, 'pending'),
          lt(escalations.timeoutAt, now)
        )
      )
      .returning();

    // Log audit for each
    for (const escalation of timedOut) {
      await this.logAudit(db, {
        escalationId: escalation.id,
        tenantId: escalation.tenantId,
        action: 'timeout',
        actorType: 'system',
        previousStatus: 'pending',
        newStatus: 'timeout',
        details: { timeoutAt: escalation.timeoutAt.toISOString() },
      });
    }

    if (timedOut.length > 0) {
      logger.info({ count: timedOut.length }, 'Processed timed-out escalations');
    }

    return timedOut.length;
  }

  /**
   * Get escalation audit trail
   */
  async getAuditTrail(escalationId: ID, tenantId: ID): Promise<Array<{
    action: string;
    actorId?: string;
    actorType: string;
    previousStatus?: string;
    newStatus?: string;
    details?: Record<string, unknown>;
    timestamp: string;
  }>> {
    const db = await this.ensureInitialized();

    const audit = await db
      .select()
      .from(escalationAudit)
      .where(
        and(
          eq(escalationAudit.escalationId, escalationId),
          eq(escalationAudit.tenantId, tenantId)
        )
      )
      .orderBy(desc(escalationAudit.timestamp));

    return audit.map((a) => ({
      action: a.action,
      actorId: a.actorId ?? undefined,
      actorType: a.actorType,
      previousStatus: a.previousStatus ?? undefined,
      newStatus: a.newStatus ?? undefined,
      details: (a.details as Record<string, unknown>) ?? undefined,
      timestamp: a.timestamp.toISOString(),
    }));
  }

  /**
   * Get pending escalation count for tenant
   */
  async getPendingCount(tenantId: ID): Promise<number> {
    const db = await this.ensureInitialized();

    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(escalations)
      .where(
        and(
          eq(escalations.tenantId, tenantId),
          eq(escalations.status, 'pending')
        )
      );

    return result[0]?.count ?? 0;
  }

  /**
   * Log audit entry
   */
  private async logAudit(db: Database, entry: Omit<NewEscalationAudit, 'id' | 'timestamp'>): Promise<void> {
    await db.insert(escalationAudit).values(entry);
  }

  /**
   * Convert database row to response
   */
  private toResponse(row: Escalation): EscalationResponse {
    return {
      id: row.id,
      tenantId: row.tenantId,
      intentId: row.intentId,
      entityId: row.entityId,
      reason: row.reason,
      priority: row.priority,
      status: row.status,
      escalatedTo: row.escalatedTo,
      escalatedBy: row.escalatedBy ?? undefined,
      context: (row.context as Record<string, unknown>) ?? undefined,
      requestedAction: row.requestedAction ?? undefined,
      resolvedBy: row.resolvedBy ?? undefined,
      resolvedAt: row.resolvedAt?.toISOString(),
      resolution: row.resolution ?? undefined,
      resolutionNotes: row.resolutionNotes ?? undefined,
      timeoutAt: row.timeoutAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

/**
 * Create a new escalation service instance
 */
export function createEscalationService(): EscalationService {
  return new EscalationService();
}
