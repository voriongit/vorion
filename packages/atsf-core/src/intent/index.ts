/**
 * INTENT - Goal Processing
 *
 * Processes and validates incoming intents from AI agents.
 *
 * @packageDocumentation
 */

import { createLogger } from '../common/logger.js';
import type { Intent, ID, IntentStatus } from '../common/types.js';

const logger = createLogger({ component: 'intent' });

/**
 * Intent submission request
 */
export interface IntentSubmission {
  entityId: ID;
  goal: string;
  context: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * Intent service for managing intent lifecycle
 */
export class IntentService {
  private intents: Map<ID, Intent> = new Map();

  /**
   * Submit a new intent for governance
   */
  async submit(submission: IntentSubmission): Promise<Intent> {
    const intent: Intent = {
      id: crypto.randomUUID(),
      entityId: submission.entityId,
      goal: submission.goal,
      context: submission.context,
      metadata: submission.metadata ?? {},
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.intents.set(intent.id, intent);
    logger.info({ intentId: intent.id, goal: intent.goal }, 'Intent submitted');

    return intent;
  }

  /**
   * Get an intent by ID
   */
  async get(id: ID): Promise<Intent | undefined> {
    return this.intents.get(id);
  }

  /**
   * Update intent status
   */
  async updateStatus(id: ID, status: IntentStatus): Promise<Intent | undefined> {
    const intent = this.intents.get(id);
    if (!intent) return undefined;

    intent.status = status;
    intent.updatedAt = new Date().toISOString();
    logger.info({ intentId: id, status }, 'Intent status updated');

    return intent;
  }

  /**
   * List intents for an entity
   */
  async listByEntity(entityId: ID): Promise<Intent[]> {
    return Array.from(this.intents.values()).filter(
      (i) => i.entityId === entityId
    );
  }
}

/**
 * Create a new intent service instance
 */
export function createIntentService(): IntentService {
  return new IntentService();
}
