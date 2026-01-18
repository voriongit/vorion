/**
 * INTENT Webhook Notifications
 *
 * Outbound webhook notifications for escalation events.
 * Supports configurable URLs per tenant with retry logic.
 */

import { randomUUID } from 'node:crypto';
import { createLogger } from '../common/logger.js';
import { getRedis } from '../common/redis.js';
import type { ID } from '../common/types.js';
import type { EscalationRecord } from './escalation.js';

const logger = createLogger({ component: 'webhooks' });

export type WebhookEventType =
  | 'escalation.created'
  | 'escalation.approved'
  | 'escalation.rejected'
  | 'escalation.timeout'
  | 'intent.approved'
  | 'intent.denied'
  | 'intent.completed';

export interface WebhookPayload {
  id: string;
  eventType: WebhookEventType;
  timestamp: string;
  tenantId: ID;
  data: Record<string, unknown>;
}

export interface WebhookConfig {
  url: string;
  secret?: string;
  enabled: boolean;
  events: WebhookEventType[];
  retryAttempts?: number;
  retryDelayMs?: number;
}

export interface WebhookDeliveryResult {
  success: boolean;
  statusCode?: number;
  error?: string;
  attempts: number;
  deliveredAt?: string;
}

const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 1000;
const WEBHOOK_TIMEOUT_MS = 10000;

/**
 * Webhook Service
 */
export class WebhookService {
  private redis = getRedis();
  private readonly keyPrefix = 'webhook:';

  /**
   * Register a webhook for a tenant
   */
  async registerWebhook(tenantId: ID, config: WebhookConfig): Promise<string> {
    const webhookId = randomUUID();
    const key = `${this.keyPrefix}config:${tenantId}:${webhookId}`;

    await this.redis.set(key, JSON.stringify(config));
    await this.redis.sadd(`${this.keyPrefix}tenants:${tenantId}`, webhookId);

    logger.info({ tenantId, webhookId, url: config.url }, 'Webhook registered');
    return webhookId;
  }

  /**
   * Unregister a webhook
   */
  async unregisterWebhook(tenantId: ID, webhookId: string): Promise<boolean> {
    const key = `${this.keyPrefix}config:${tenantId}:${webhookId}`;
    const deleted = await this.redis.del(key);
    await this.redis.srem(`${this.keyPrefix}tenants:${tenantId}`, webhookId);

    if (deleted > 0) {
      logger.info({ tenantId, webhookId }, 'Webhook unregistered');
      return true;
    }
    return false;
  }

  /**
   * Get all webhooks for a tenant
   */
  async getWebhooks(tenantId: ID): Promise<Array<{ id: string; config: WebhookConfig }>> {
    const webhookIds = await this.redis.smembers(`${this.keyPrefix}tenants:${tenantId}`);
    const webhooks: Array<{ id: string; config: WebhookConfig }> = [];

    for (const webhookId of webhookIds) {
      const data = await this.redis.get(`${this.keyPrefix}config:${tenantId}:${webhookId}`);
      if (data) {
        webhooks.push({
          id: webhookId,
          config: JSON.parse(data) as WebhookConfig,
        });
      }
    }

    return webhooks;
  }

  /**
   * Send webhook notification for an escalation event
   */
  async notifyEscalation(
    eventType: 'escalation.created' | 'escalation.approved' | 'escalation.rejected' | 'escalation.timeout',
    escalation: EscalationRecord
  ): Promise<WebhookDeliveryResult[]> {
    const payload: WebhookPayload = {
      id: randomUUID(),
      eventType,
      timestamp: new Date().toISOString(),
      tenantId: escalation.tenantId,
      data: {
        escalationId: escalation.id,
        intentId: escalation.intentId,
        reason: escalation.reason,
        reasonCategory: escalation.reasonCategory,
        escalatedTo: escalation.escalatedTo,
        status: escalation.status,
        resolution: escalation.resolution,
        createdAt: escalation.createdAt,
        updatedAt: escalation.updatedAt,
      },
    };

    return this.deliverToTenant(escalation.tenantId, eventType, payload);
  }

  /**
   * Send webhook notification for an intent event
   */
  async notifyIntent(
    eventType: 'intent.approved' | 'intent.denied' | 'intent.completed',
    intentId: ID,
    tenantId: ID,
    additionalData?: Record<string, unknown>
  ): Promise<WebhookDeliveryResult[]> {
    const payload: WebhookPayload = {
      id: randomUUID(),
      eventType,
      timestamp: new Date().toISOString(),
      tenantId,
      data: {
        intentId,
        ...additionalData,
      },
    };

    return this.deliverToTenant(tenantId, eventType, payload);
  }

  /**
   * Deliver webhooks to all registered endpoints for a tenant
   */
  private async deliverToTenant(
    tenantId: ID,
    eventType: WebhookEventType,
    payload: WebhookPayload
  ): Promise<WebhookDeliveryResult[]> {
    const webhooks = await this.getWebhooks(tenantId);
    const results: WebhookDeliveryResult[] = [];

    for (const { id: webhookId, config } of webhooks) {
      if (!config.enabled) continue;
      if (!config.events.includes(eventType)) continue;

      const result = await this.deliverWithRetry(webhookId, config, payload);
      results.push(result);

      // Store delivery result
      await this.storeDeliveryResult(tenantId, webhookId, payload.id, result);
    }

    return results;
  }

  /**
   * Deliver webhook with retry logic
   */
  private async deliverWithRetry(
    webhookId: string,
    config: WebhookConfig,
    payload: WebhookPayload
  ): Promise<WebhookDeliveryResult> {
    const maxAttempts = config.retryAttempts ?? DEFAULT_RETRY_ATTEMPTS;
    const retryDelay = config.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;

    let lastError: string | undefined;
    let lastStatusCode: number | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await this.sendWebhook(config.url, payload, config.secret);
        lastStatusCode = response.status;

        if (response.ok) {
          logger.info(
            { webhookId, eventType: payload.eventType, attempt },
            'Webhook delivered successfully'
          );
          return {
            success: true,
            statusCode: response.status,
            attempts: attempt,
            deliveredAt: new Date().toISOString(),
          };
        }

        lastError = `HTTP ${response.status}: ${response.statusText}`;
        logger.warn(
          { webhookId, attempt, statusCode: response.status },
          'Webhook delivery failed, will retry'
        );
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
        logger.warn(
          { webhookId, attempt, error: lastError },
          'Webhook delivery error, will retry'
        );
      }

      // Wait before retry (exponential backoff)
      if (attempt < maxAttempts) {
        const delay = retryDelay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    logger.error(
      { webhookId, eventType: payload.eventType, attempts: maxAttempts, error: lastError },
      'Webhook delivery failed after all retries'
    );

    const failureResult: WebhookDeliveryResult = {
      success: false,
      attempts: maxAttempts,
    };

    if (lastStatusCode !== undefined) {
      failureResult.statusCode = lastStatusCode;
    }
    if (lastError !== undefined) {
      failureResult.error = lastError;
    }

    return failureResult;
  }

  /**
   * Send HTTP request to webhook URL
   */
  private async sendWebhook(
    url: string,
    payload: WebhookPayload,
    secret?: string
  ): Promise<Response> {
    const body = JSON.stringify(payload);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Vorion-Webhook/1.0',
      'X-Webhook-Event': payload.eventType,
      'X-Webhook-Delivery': payload.id,
    };

    // Add signature if secret is configured
    if (secret) {
      const { createHmac } = await import('node:crypto');
      const signature = createHmac('sha256', secret)
        .update(body)
        .digest('hex');
      headers['X-Webhook-Signature'] = `sha256=${signature}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

    try {
      return await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Store delivery result for auditing
   */
  private async storeDeliveryResult(
    tenantId: ID,
    webhookId: string,
    deliveryId: string,
    result: WebhookDeliveryResult
  ): Promise<void> {
    const key = `${this.keyPrefix}delivery:${tenantId}:${webhookId}:${deliveryId}`;
    await this.redis.set(key, JSON.stringify(result), 'EX', 86400 * 7); // 7 days retention
  }

  /**
   * Get recent deliveries for a webhook
   */
  async getDeliveries(
    tenantId: ID,
    webhookId: string,
    limit = 100
  ): Promise<Array<{ id: string; result: WebhookDeliveryResult }>> {
    const pattern = `${this.keyPrefix}delivery:${tenantId}:${webhookId}:*`;
    const keys = await this.redis.keys(pattern);
    const deliveries: Array<{ id: string; result: WebhookDeliveryResult }> = [];

    // Sort by key (includes delivery ID) and take most recent
    const sortedKeys = keys.sort().reverse().slice(0, limit);

    for (const key of sortedKeys) {
      const data = await this.redis.get(key);
      if (data) {
        const deliveryId = key.split(':').pop() ?? '';
        deliveries.push({
          id: deliveryId,
          result: JSON.parse(data) as WebhookDeliveryResult,
        });
      }
    }

    return deliveries;
  }
}

/**
 * Create webhook service instance
 */
export function createWebhookService(): WebhookService {
  return new WebhookService();
}
