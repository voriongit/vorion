/**
 * INTENT Webhook Notifications
 *
 * Outbound webhook notifications for escalation events.
 * Supports configurable URLs per tenant with retry logic.
 * Includes SSRF protection to prevent internal network access.
 */

import { randomUUID } from 'node:crypto';
import { getConfig } from '../common/config.js';
import { createLogger } from '../common/logger.js';
import { getRedis } from '../common/redis.js';
import type { ID } from '../common/types.js';
import { ValidationError } from '../common/errors.js';
import type { EscalationRecord } from './escalation.js';

const logger = createLogger({ component: 'webhooks' });

// =============================================================================
// SSRF Protection
// =============================================================================

/**
 * Check if an IP address is in a private/internal range
 */
function isPrivateIP(ip: string): boolean {
  // IPv4 private ranges
  const ipv4PrivateRanges = [
    /^127\./, // Loopback
    /^10\./, // Class A private
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Class B private
    /^192\.168\./, // Class C private
    /^169\.254\./, // Link-local
    /^0\./, // Current network
    /^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./, // Shared address space (CGNAT)
    /^192\.0\.0\./, // IETF Protocol Assignments
    /^192\.0\.2\./, // TEST-NET-1
    /^198\.51\.100\./, // TEST-NET-2
    /^203\.0\.113\./, // TEST-NET-3
    /^224\./, // Multicast
    /^240\./, // Reserved
    /^255\.255\.255\.255$/, // Broadcast
  ];

  // IPv6 private/special ranges
  const ipv6PrivateRanges = [
    /^::1$/, // Loopback
    /^fe80:/i, // Link-local
    /^fc00:/i, // Unique local address
    /^fd00:/i, // Unique local address
    /^ff00:/i, // Multicast
    /^::ffff:127\./i, // IPv4-mapped loopback
    /^::ffff:10\./i, // IPv4-mapped Class A private
    /^::ffff:172\.(1[6-9]|2[0-9]|3[0-1])\./i, // IPv4-mapped Class B private
    /^::ffff:192\.168\./i, // IPv4-mapped Class C private
  ];

  // Check IPv4
  for (const range of ipv4PrivateRanges) {
    if (range.test(ip)) {
      return true;
    }
  }

  // Check IPv6
  for (const range of ipv6PrivateRanges) {
    if (range.test(ip)) {
      return true;
    }
  }

  return false;
}

/**
 * Validate a webhook URL for SSRF protection
 */
export async function validateWebhookUrl(url: string): Promise<{ valid: boolean; reason?: string }> {
  try {
    const parsed = new URL(url);

    // Only allow HTTPS (except for localhost in development)
    if (parsed.protocol !== 'https:') {
      // Allow HTTP only for localhost in non-production
      const isDevelopment = process.env['VORION_ENV'] !== 'production';
      const isLocalhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';

      if (!(isDevelopment && isLocalhost)) {
        return { valid: false, reason: 'Webhook URL must use HTTPS' };
      }
    }

    // Block internal hostnames
    const blockedHostnames = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '::1',
      'metadata.google.internal', // GCP metadata
      '169.254.169.254', // AWS/Azure/GCP metadata
      'metadata.internal',
      'kubernetes.default',
      'kubernetes.default.svc',
    ];

    if (blockedHostnames.includes(parsed.hostname.toLowerCase())) {
      // Allow localhost only in development
      const isDevelopment = process.env['VORION_ENV'] !== 'production';
      const isLocalhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';

      if (!(isDevelopment && isLocalhost)) {
        return { valid: false, reason: 'Webhook URL hostname is blocked' };
      }
    }

    // Block internal domains
    const blockedPatterns = [
      /\.internal$/i,
      /\.local$/i,
      /\.localhost$/i,
      /\.svc$/i,
      /\.cluster\.local$/i,
      /\.corp$/i,
      /\.lan$/i,
      /\.home$/i,
    ];

    for (const pattern of blockedPatterns) {
      if (pattern.test(parsed.hostname)) {
        return { valid: false, reason: 'Webhook URL domain pattern is blocked' };
      }
    }

    // Resolve hostname and check for private IPs
    // Note: In production, use dns.lookup to resolve the hostname
    // For now, we'll check if the hostname itself is an IP
    const ipMatch = parsed.hostname.match(/^(\d{1,3}\.){3}\d{1,3}$/);
    if (ipMatch && isPrivateIP(parsed.hostname)) {
      return { valid: false, reason: 'Webhook URL resolves to private IP address' };
    }

    // Block ports commonly used for internal services
    const blockedPorts = ['22', '23', '25', '3306', '5432', '6379', '27017', '9200', '11211'];
    if (parsed.port && blockedPorts.includes(parsed.port)) {
      return { valid: false, reason: `Webhook URL port ${parsed.port} is blocked` };
    }

    return { valid: true };
  } catch {
    return { valid: false, reason: 'Invalid webhook URL format' };
  }
}

/**
 * Validate URL at connection time (DNS resolution check)
 * This performs actual DNS resolution to catch DNS rebinding attacks
 */
export async function validateWebhookUrlAtRuntime(url: string): Promise<{ valid: boolean; reason?: string; resolvedIP?: string }> {
  const basicValidation = await validateWebhookUrl(url);
  if (!basicValidation.valid) {
    return basicValidation;
  }

  try {
    const { hostname } = new URL(url);

    // Skip DNS check for IP addresses (already validated)
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
      return { valid: true, resolvedIP: hostname };
    }

    // Perform DNS lookup
    const dns = await import('node:dns');
    const { promisify } = await import('node:util');
    const lookup = promisify(dns.lookup);

    const result = await lookup(hostname);
    const resolvedIP = result.address;

    if (isPrivateIP(resolvedIP)) {
      logger.warn(
        { url, resolvedIP },
        'SSRF attempt detected: webhook URL resolves to private IP'
      );
      return {
        valid: false,
        reason: 'Webhook URL resolves to private IP address',
        resolvedIP,
      };
    }

    return { valid: true, resolvedIP };
  } catch (error) {
    logger.warn({ url, error }, 'Failed to resolve webhook URL');
    return { valid: false, reason: 'Failed to resolve webhook URL hostname' };
  }
}

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

/**
 * Get webhook configuration from the global config.
 * These values can be overridden per-deployment via environment variables:
 * - VORION_WEBHOOK_TIMEOUT_MS (default: 10000, min: 1000, max: 60000)
 * - VORION_WEBHOOK_RETRY_ATTEMPTS (default: 3)
 * - VORION_WEBHOOK_RETRY_DELAY_MS (default: 1000)
 */
function getWebhookConfig() {
  const config = getConfig();
  return {
    timeoutMs: config.webhook.timeoutMs,
    retryAttempts: config.webhook.retryAttempts,
    retryDelayMs: config.webhook.retryDelayMs,
  };
}

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
    // SSRF protection: validate webhook URL
    const validation = await validateWebhookUrl(config.url);
    if (!validation.valid) {
      logger.warn(
        { tenantId, url: config.url, reason: validation.reason },
        'Webhook registration blocked: SSRF protection'
      );
      throw new ValidationError(`Invalid webhook URL: ${validation.reason}`, {
        url: config.url,
        reason: validation.reason,
      });
    }

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
   *
   * Uses per-webhook config if provided, otherwise falls back to global config.
   * Global defaults are configurable via environment variables.
   */
  private async deliverWithRetry(
    webhookId: string,
    config: WebhookConfig,
    payload: WebhookPayload
  ): Promise<WebhookDeliveryResult> {
    const webhookDefaults = getWebhookConfig();
    const maxAttempts = config.retryAttempts ?? webhookDefaults.retryAttempts;
    const retryDelay = config.retryDelayMs ?? webhookDefaults.retryDelayMs;

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
   *
   * Timeout is configurable via VORION_WEBHOOK_TIMEOUT_MS environment variable.
   * Default: 10000ms, Min: 1000ms, Max: 60000ms
   */
  private async sendWebhook(
    url: string,
    payload: WebhookPayload,
    secret?: string
  ): Promise<Response> {
    // Runtime SSRF protection: validate URL with DNS resolution
    // This catches DNS rebinding attacks where URL was valid at registration
    // but DNS record changed to point to internal IP
    const runtimeValidation = await validateWebhookUrlAtRuntime(url);
    if (!runtimeValidation.valid) {
      logger.error(
        { url, reason: runtimeValidation.reason, resolvedIP: runtimeValidation.resolvedIP },
        'Webhook blocked at runtime: SSRF protection'
      );
      throw new ValidationError(`Webhook blocked: ${runtimeValidation.reason}`, {
        url,
        reason: runtimeValidation.reason,
        resolvedIP: runtimeValidation.resolvedIP,
      });
    }

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

    const webhookConfig = getWebhookConfig();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), webhookConfig.timeoutMs);

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
   *
   * Uses a Redis SET index to track delivery IDs per webhook, avoiding the need
   * for expensive KEYS operations when retrieving deliveries.
   */
  private async storeDeliveryResult(
    tenantId: ID,
    webhookId: string,
    deliveryId: string,
    result: WebhookDeliveryResult
  ): Promise<void> {
    const key = `${this.keyPrefix}delivery:${tenantId}:${webhookId}:${deliveryId}`;
    const indexKey = `${this.keyPrefix}delivery-index:${tenantId}:${webhookId}`;
    const ttlSeconds = 86400 * 7; // 7 days retention

    // Store the delivery result with TTL
    await this.redis.set(key, JSON.stringify(result), 'EX', ttlSeconds);

    // Add delivery ID to the index SET with timestamp prefix for ordering
    // Format: "timestamp:deliveryId" allows lexicographic sorting by time
    const timestamp = Date.now();
    const indexEntry = `${timestamp}:${deliveryId}`;
    await this.redis.zadd(indexKey, timestamp, indexEntry);

    // Set TTL on the index key (refresh on each write)
    await this.redis.expire(indexKey, ttlSeconds);
  }

  /**
   * Get recent deliveries for a webhook
   *
   * Uses a Redis sorted set index instead of KEYS command.
   * KEYS is O(n) and blocks Redis during execution, causing latency spikes.
   * ZREVRANGE on the index is O(log(n) + m) where m is the limit, much more efficient.
   */
  async getDeliveries(
    tenantId: ID,
    webhookId: string,
    limit = 100
  ): Promise<Array<{ id: string; result: WebhookDeliveryResult }>> {
    const indexKey = `${this.keyPrefix}delivery-index:${tenantId}:${webhookId}`;
    const deliveries: Array<{ id: string; result: WebhookDeliveryResult }> = [];

    // Get most recent delivery IDs from sorted set (sorted by timestamp descending)
    const indexEntries = await this.redis.zrevrange(indexKey, 0, limit - 1);

    if (indexEntries.length === 0) {
      return deliveries;
    }

    // Extract delivery IDs and fetch their data
    // Index entries are in format "timestamp:deliveryId"
    for (const entry of indexEntries) {
      const colonIndex = entry.indexOf(':');
      if (colonIndex === -1) continue;

      const deliveryId = entry.substring(colonIndex + 1);
      const key = `${this.keyPrefix}delivery:${tenantId}:${webhookId}:${deliveryId}`;
      const data = await this.redis.get(key);

      if (data) {
        deliveries.push({
          id: deliveryId,
          result: JSON.parse(data) as WebhookDeliveryResult,
        });
      } else {
        // Data expired but index entry remains - clean up stale index entry
        await this.redis.zrem(indexKey, entry);
      }
    }

    return deliveries;
  }

  /**
   * Clean up stale index entries for a webhook
   *
   * This removes index entries pointing to expired delivery records.
   * Called periodically or on-demand to maintain index hygiene.
   */
  async cleanupDeliveryIndex(tenantId: ID, webhookId: string): Promise<number> {
    const indexKey = `${this.keyPrefix}delivery-index:${tenantId}:${webhookId}`;
    let cleanedCount = 0;

    // Get all index entries
    const indexEntries = await this.redis.zrange(indexKey, 0, -1);

    for (const entry of indexEntries) {
      const colonIndex = entry.indexOf(':');
      if (colonIndex === -1) continue;

      const deliveryId = entry.substring(colonIndex + 1);
      const key = `${this.keyPrefix}delivery:${tenantId}:${webhookId}:${deliveryId}`;
      const exists = await this.redis.exists(key);

      if (!exists) {
        await this.redis.zrem(indexKey, entry);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info({ tenantId, webhookId, cleanedCount }, 'Cleaned up stale delivery index entries');
    }

    return cleanedCount;
  }
}

/**
 * Create webhook service instance
 */
export function createWebhookService(): WebhookService {
  return new WebhookService();
}
