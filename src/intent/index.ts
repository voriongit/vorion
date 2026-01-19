/**
 * INTENT - Goal Processing
 *
 * Processes and validates incoming intents from AI agents.
 * Uses PostgreSQL for persistence and a singleton queue for processing.
 *
 * @packageDocumentation
 */

import { eq, and, desc, sql } from 'drizzle-orm';
import { createLogger } from '../common/logger.js';
import { getDatabase, type Database } from '../common/db.js';
import {
  intents,
  intentProcessingLog,
  type NewIntent,
  type NewIntentProcessingLog,
} from '../db/schema/intents.js';
import { getIntentQueue } from './queue.js';
import type { Intent, ID, IntentStatus } from '../common/types.js';

const logger = createLogger({ component: 'intent' });

/**
 * Intent submission request
 */
export interface IntentSubmission {
  tenantId: ID;
  entityId: ID;
  goal: string;
  context: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  priority?: number;
}

/**
 * Intent query options
 */
export interface IntentQuery {
  tenantId: ID;
  entityId?: ID;
  status?: IntentStatus;
  limit?: number;
  offset?: number;
}

/**
 * Intent response
 */
export interface IntentResponse {
  id: ID;
  tenantId: ID;
  entityId: ID;
  goal: string;
  context: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  status: IntentStatus;
  priority: number;
  queuedAt?: string;
  processingStartedAt?: string;
  processingCompletedAt?: string;
  processAttempts: number;
  lastError?: string;
  decisionId?: ID;
  proofId?: ID;
  escalationId?: ID;
  createdAt: string;
  updatedAt: string;
}

/**
 * Intent service for managing intent lifecycle with PostgreSQL persistence
 */
export class IntentService {
  private db: Database | null = null;
  private initialized: boolean = false;

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.db = await getDatabase();
    this.initialized = true;
    logger.info('Intent service initialized');
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
   * Submit a new intent for governance
   */
  async submit(submission: IntentSubmission): Promise<IntentResponse> {
    const db = await this.ensureInitialized();

    const newIntent: NewIntent = {
      tenantId: submission.tenantId,
      entityId: submission.entityId,
      goal: submission.goal,
      context: submission.context,
      metadata: submission.metadata ?? null,
      priority: submission.priority ?? 0,
      status: 'pending',
      queuedAt: new Date(),
    };

    const [created] = await db.insert(intents).values(newIntent).returning();

    // Log the submission
    await this.logProcessing(db, {
      intentId: created!.id,
      tenantId: submission.tenantId,
      phase: 'queued',
      newStatus: 'pending',
      details: { goal: submission.goal, priority: submission.priority },
    });

    // Add to processing queue
    const queue = getIntentQueue();
    await queue.enqueue(this.toIntent(created!), submission.priority ?? 0);

    logger.info(
      { intentId: created!.id, goal: submission.goal },
      'Intent submitted and queued'
    );

    return this.toResponse(created!);
  }

  /**
   * Get an intent by ID with tenant authorization
   */
  async get(id: ID, tenantId: ID): Promise<IntentResponse | null> {
    const db = await this.ensureInitialized();

    const result = await db
      .select()
      .from(intents)
      .where(and(eq(intents.id, id), eq(intents.tenantId, tenantId)))
      .limit(1);

    if (result.length === 0) return null;

    return this.toResponse(result[0]!);
  }

  /**
   * Query intents with tenant scope
   */
  async query(query: IntentQuery): Promise<IntentResponse[]> {
    const db = await this.ensureInitialized();

    const conditions = [eq(intents.tenantId, query.tenantId)];

    if (query.entityId) {
      conditions.push(eq(intents.entityId, query.entityId));
    }

    if (query.status) {
      conditions.push(eq(intents.status, query.status));
    }

    const results = await db
      .select()
      .from(intents)
      .where(and(...conditions))
      .orderBy(desc(intents.createdAt))
      .limit(query.limit ?? 100)
      .offset(query.offset ?? 0);

    return results.map((r) => this.toResponse(r));
  }

  /**
   * Update intent status
   */
  async updateStatus(
    id: ID,
    tenantId: ID,
    status: IntentStatus,
    details?: {
      decisionId?: ID;
      proofId?: ID;
      escalationId?: ID;
      error?: string;
    }
  ): Promise<IntentResponse | null> {
    const db = await this.ensureInitialized();

    const current = await db
      .select()
      .from(intents)
      .where(and(eq(intents.id, id), eq(intents.tenantId, tenantId)))
      .limit(1);

    if (current.length === 0) return null;

    const previousStatus = current[0]!.status;
    const now = new Date();

    const updateData: Partial<NewIntent> = {
      status,
      updatedAt: now,
    };

    // Set timing based on status
    if (status === 'evaluating' || status === 'executing') {
      updateData.processingStartedAt = now;
    } else if (['completed', 'failed', 'approved', 'denied'].includes(status)) {
      updateData.processingCompletedAt = now;
    }

    // Set references and error
    if (details?.decisionId) updateData.decisionId = details.decisionId;
    if (details?.proofId) updateData.proofId = details.proofId;
    if (details?.escalationId) updateData.escalationId = details.escalationId;
    if (details?.error) updateData.lastError = details.error;

    const [updated] = await db
      .update(intents)
      .set(updateData)
      .where(eq(intents.id, id))
      .returning();

    // Log status change
    await this.logProcessing(db, {
      intentId: id,
      tenantId,
      phase: status === 'failed' ? 'failed' : 'status_changed',
      previousStatus,
      newStatus: status,
      error: details?.error ?? null,
      details: details ?? null,
    });

    logger.info({ intentId: id, previousStatus, newStatus: status }, 'Intent status updated');

    return this.toResponse(updated!);
  }

  /**
   * Increment processing attempts
   */
  async incrementAttempts(id: ID): Promise<void> {
    const db = await this.ensureInitialized();

    await db
      .update(intents)
      .set({
        processAttempts: sql`${intents.processAttempts} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(intents.id, id));
  }

  /**
   * Get pending intents count for tenant
   */
  async getPendingCount(tenantId: ID): Promise<number> {
    const db = await this.ensureInitialized();

    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(intents)
      .where(
        and(
          eq(intents.tenantId, tenantId),
          eq(intents.status, 'pending')
        )
      );

    return result[0]?.count ?? 0;
  }

  /**
   * Get processing log for an intent
   */
  async getProcessingLog(intentId: ID, tenantId: ID): Promise<Array<{
    phase: string;
    previousStatus?: string;
    newStatus?: string;
    durationMs?: number;
    attempt?: number;
    details?: Record<string, unknown>;
    error?: string;
    timestamp: string;
  }>> {
    const db = await this.ensureInitialized();

    const logs = await db
      .select()
      .from(intentProcessingLog)
      .where(
        and(
          eq(intentProcessingLog.intentId, intentId),
          eq(intentProcessingLog.tenantId, tenantId)
        )
      )
      .orderBy(desc(intentProcessingLog.timestamp));

    return logs.map((l) => {
      const entry: {
        phase: string;
        previousStatus?: string;
        newStatus?: string;
        durationMs?: number;
        attempt?: number;
        details?: Record<string, unknown>;
        error?: string;
        timestamp: string;
      } = {
        phase: l.phase,
        timestamp: l.timestamp.toISOString(),
      };
      if (l.previousStatus !== null) entry.previousStatus = l.previousStatus;
      if (l.newStatus !== null) entry.newStatus = l.newStatus;
      if (l.durationMs !== null) entry.durationMs = l.durationMs;
      if (l.attempt !== null) entry.attempt = l.attempt;
      if (l.details !== null) entry.details = l.details as Record<string, unknown>;
      if (l.error !== null) entry.error = l.error;
      return entry;
    });
  }

  /**
   * Log processing event
   */
  private async logProcessing(
    db: Database,
    entry: Omit<NewIntentProcessingLog, 'id' | 'timestamp'>
  ): Promise<void> {
    await db.insert(intentProcessingLog).values(entry);
  }

  /**
   * Convert database row to domain Intent
   */
  private toIntent(row: typeof intents.$inferSelect): Intent {
    return {
      id: row.id,
      entityId: row.entityId,
      goal: row.goal,
      context: row.context,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /**
   * Convert database row to response
   */
  private toResponse(row: typeof intents.$inferSelect): IntentResponse {
    const response: IntentResponse = {
      id: row.id,
      tenantId: row.tenantId,
      entityId: row.entityId,
      goal: row.goal,
      context: row.context,
      status: row.status,
      priority: row.priority,
      processAttempts: row.processAttempts,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
    if (row.metadata !== null) response.metadata = row.metadata as Record<string, unknown>;
    if (row.queuedAt !== null) response.queuedAt = row.queuedAt.toISOString();
    if (row.processingStartedAt !== null) response.processingStartedAt = row.processingStartedAt.toISOString();
    if (row.processingCompletedAt !== null) response.processingCompletedAt = row.processingCompletedAt.toISOString();
    if (row.lastError !== null) response.lastError = row.lastError;
    if (row.decisionId !== null) response.decisionId = row.decisionId;
    if (row.proofId !== null) response.proofId = row.proofId;
    if (row.escalationId !== null) response.escalationId = row.escalationId;
    return response;
  }
}

/**
 * Create a new intent service instance
 */
export function createIntentService(): IntentService {
  return new IntentService();
}

// Re-export queue utilities
export { getIntentQueue, initializeIntentQueue, type IntentProcessor } from './queue.js';
