/**
 * Phase 6 Webhooks Service
 *
 * Manages webhook subscriptions and delivery for Phase 6 Trust Engine events
 */

import { createHmac, timingSafeEqual } from 'crypto';

// =============================================================================
// Types
// =============================================================================

export type WebhookEventType =
  | 'role_gate.evaluated'
  | 'role_gate.denied'
  | 'role_gate.escalated'
  | 'ceiling.checked'
  | 'ceiling.exceeded'
  | 'ceiling.warning'
  | 'provenance.created'
  | 'alert.created'
  | 'alert.acknowledged'
  | 'alert.resolved'
  | 'preset.applied';

export interface Webhook {
  id: string;
  url: string;
  events: WebhookEventType[];
  secret: string;
  enabled: boolean;
  organizationId?: string;
  createdAt: Date;
  lastTriggeredAt?: Date;
  failureCount: number;
}

export interface WebhookPayload<T = unknown> {
  id: string;
  event: WebhookEventType;
  timestamp: string;
  data: T;
  organizationId?: string;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: WebhookEventType;
  payload: WebhookPayload;
  statusCode?: number;
  responseTimeMs?: number;
  error?: string;
  deliveredAt: Date;
}

export interface WebhookConfig {
  maxRetries: number;
  retryDelayMs: number;
  timeoutMs: number;
  maxPayloadSize: number;
  signatureHeader: string;
  timestampHeader: string;
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: WebhookConfig = {
  maxRetries: 3,
  retryDelayMs: 1000,
  timeoutMs: 30000,
  maxPayloadSize: 1024 * 1024, // 1MB
  signatureHeader: 'X-Phase6-Signature',
  timestampHeader: 'X-Phase6-Timestamp',
};

// =============================================================================
// In-Memory Store (replace with database in production)
// =============================================================================

const webhooksStore = new Map<string, Webhook>();
const deliveriesStore: WebhookDelivery[] = [];
const deliveryQueue: Array<{ webhook: Webhook; payload: WebhookPayload }> = [];

// =============================================================================
// Signature Generation & Verification
// =============================================================================

/**
 * Generate HMAC signature for webhook payload
 */
export function generateSignature(
  payload: string,
  secret: string,
  timestamp: string
): string {
  const signedPayload = `${timestamp}.${payload}`;
  return createHmac('sha256', secret).update(signedPayload).digest('hex');
}

/**
 * Verify webhook signature
 */
export function verifySignature(
  payload: string,
  signature: string,
  secret: string,
  timestamp: string,
  toleranceSeconds: number = 300
): boolean {
  // Check timestamp is recent
  const timestampMs = parseInt(timestamp, 10);
  const nowMs = Date.now();
  if (Math.abs(nowMs - timestampMs) > toleranceSeconds * 1000) {
    return false;
  }

  // Verify signature
  const expectedSignature = generateSignature(payload, secret, timestamp);
  const sigBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');

  if (sigBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(sigBuffer, expectedBuffer);
}

// =============================================================================
// Webhook Management
// =============================================================================

/**
 * Create a new webhook subscription
 */
export function createWebhook(
  url: string,
  events: WebhookEventType[],
  options: { secret?: string; organizationId?: string } = {}
): Webhook {
  const id = crypto.randomUUID();
  const secret = options.secret || crypto.randomUUID().replace(/-/g, '');

  const webhook: Webhook = {
    id,
    url,
    events,
    secret,
    enabled: true,
    organizationId: options.organizationId,
    createdAt: new Date(),
    failureCount: 0,
  };

  webhooksStore.set(id, webhook);
  return webhook;
}

/**
 * Get webhook by ID
 */
export function getWebhook(id: string): Webhook | undefined {
  return webhooksStore.get(id);
}

/**
 * List all webhooks
 */
export function listWebhooks(organizationId?: string): Webhook[] {
  const webhooks = Array.from(webhooksStore.values());
  if (organizationId) {
    return webhooks.filter((w) => w.organizationId === organizationId);
  }
  return webhooks;
}

/**
 * Update webhook
 */
export function updateWebhook(
  id: string,
  updates: Partial<Pick<Webhook, 'url' | 'events' | 'enabled'>>
): Webhook | undefined {
  const webhook = webhooksStore.get(id);
  if (!webhook) return undefined;

  const updated = { ...webhook, ...updates };
  webhooksStore.set(id, updated);
  return updated;
}

/**
 * Delete webhook
 */
export function deleteWebhook(id: string): boolean {
  return webhooksStore.delete(id);
}

/**
 * Get webhooks subscribed to an event
 */
export function getWebhooksForEvent(
  event: WebhookEventType,
  organizationId?: string
): Webhook[] {
  return Array.from(webhooksStore.values()).filter(
    (w) =>
      w.enabled &&
      w.events.includes(event) &&
      (!organizationId || w.organizationId === organizationId)
  );
}

// =============================================================================
// Event Dispatch
// =============================================================================

/**
 * Dispatch an event to all subscribed webhooks
 */
export async function dispatchEvent<T>(
  event: WebhookEventType,
  data: T,
  options: { organizationId?: string } = {}
): Promise<void> {
  const webhooks = getWebhooksForEvent(event, options.organizationId);

  if (webhooks.length === 0) {
    return;
  }

  const payload: WebhookPayload<T> = {
    id: crypto.randomUUID(),
    event,
    timestamp: new Date().toISOString(),
    data,
    organizationId: options.organizationId,
  };

  // Queue deliveries
  for (const webhook of webhooks) {
    deliveryQueue.push({ webhook, payload });
  }

  // Process queue (in production, use a proper job queue)
  processDeliveryQueue();
}

/**
 * Process the delivery queue
 */
async function processDeliveryQueue(): Promise<void> {
  while (deliveryQueue.length > 0) {
    const item = deliveryQueue.shift();
    if (!item) break;

    await deliverWebhook(item.webhook, item.payload);
  }
}

/**
 * Deliver a webhook with retries
 */
async function deliverWebhook(
  webhook: Webhook,
  payload: WebhookPayload,
  config: WebhookConfig = DEFAULT_CONFIG
): Promise<WebhookDelivery> {
  const payloadString = JSON.stringify(payload);
  const timestamp = Date.now().toString();
  const signature = generateSignature(payloadString, webhook.secret, timestamp);

  let lastError: Error | undefined;
  let statusCode: number | undefined;
  let responseTimeMs: number | undefined;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    if (attempt > 0) {
      // Exponential backoff
      await sleep(config.retryDelayMs * Math.pow(2, attempt - 1));
    }

    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [config.signatureHeader]: signature,
          [config.timestampHeader]: timestamp,
          'User-Agent': 'Vorion-Phase6-Webhooks/1.0',
        },
        body: payloadString,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      responseTimeMs = Date.now() - startTime;
      statusCode = response.status;

      if (response.ok) {
        // Success - reset failure count
        webhook.failureCount = 0;
        webhook.lastTriggeredAt = new Date();
        webhooksStore.set(webhook.id, webhook);

        const delivery = recordDelivery(webhook.id, payload, {
          statusCode,
          responseTimeMs,
        });
        return delivery;
      }

      // Non-retryable error
      if (statusCode >= 400 && statusCode < 500 && statusCode !== 429) {
        break;
      }
    } catch (error) {
      lastError = error as Error;
      responseTimeMs = Date.now() - startTime;
    }
  }

  // All retries failed
  webhook.failureCount++;
  webhooksStore.set(webhook.id, webhook);

  // Disable webhook after too many failures
  if (webhook.failureCount >= 10) {
    webhook.enabled = false;
    webhooksStore.set(webhook.id, webhook);
  }

  return recordDelivery(webhook.id, payload, {
    statusCode,
    responseTimeMs,
    error: lastError?.message || `HTTP ${statusCode}`,
  });
}

/**
 * Record a webhook delivery attempt
 */
function recordDelivery(
  webhookId: string,
  payload: WebhookPayload,
  result: {
    statusCode?: number;
    responseTimeMs?: number;
    error?: string;
  }
): WebhookDelivery {
  const delivery: WebhookDelivery = {
    id: crypto.randomUUID(),
    webhookId,
    event: payload.event,
    payload,
    statusCode: result.statusCode,
    responseTimeMs: result.responseTimeMs,
    error: result.error,
    deliveredAt: new Date(),
  };

  deliveriesStore.push(delivery);

  // Keep only last 1000 deliveries in memory
  if (deliveriesStore.length > 1000) {
    deliveriesStore.shift();
  }

  return delivery;
}

/**
 * Get delivery history for a webhook
 */
export function getDeliveryHistory(
  webhookId: string,
  limit: number = 50
): WebhookDelivery[] {
  return deliveriesStore
    .filter((d) => d.webhookId === webhookId)
    .slice(-limit)
    .reverse();
}

// =============================================================================
// Event Helpers
// =============================================================================

/**
 * Dispatch role gate evaluation event
 */
export async function dispatchRoleGateEvaluated(data: {
  agentId: string;
  role: string;
  tier: string;
  decision: 'ALLOW' | 'DENY' | 'ESCALATE';
  reason?: string;
  organizationId?: string;
}): Promise<void> {
  const event: WebhookEventType =
    data.decision === 'DENY'
      ? 'role_gate.denied'
      : data.decision === 'ESCALATE'
        ? 'role_gate.escalated'
        : 'role_gate.evaluated';

  await dispatchEvent(event, data, { organizationId: data.organizationId });
}

/**
 * Dispatch ceiling check event
 */
export async function dispatchCeilingChecked(data: {
  agentId: string;
  resourceType: string;
  currentUsage: number;
  ceiling: number;
  allowed: boolean;
  organizationId?: string;
}): Promise<void> {
  const usagePercent = (data.currentUsage / data.ceiling) * 100;

  let event: WebhookEventType = 'ceiling.checked';
  if (!data.allowed) {
    event = 'ceiling.exceeded';
  } else if (usagePercent >= 80) {
    event = 'ceiling.warning';
  }

  await dispatchEvent(event, data, { organizationId: data.organizationId });
}

/**
 * Dispatch provenance created event
 */
export async function dispatchProvenanceCreated(data: {
  provenanceId: string;
  type: string;
  agentId: string;
  decision: string;
  organizationId?: string;
}): Promise<void> {
  await dispatchEvent('provenance.created', data, {
    organizationId: data.organizationId,
  });
}

/**
 * Dispatch alert event
 */
export async function dispatchAlertEvent(
  event: 'alert.created' | 'alert.acknowledged' | 'alert.resolved',
  data: {
    alertId: string;
    type: string;
    severity: string;
    agentId: string;
    description: string;
    organizationId?: string;
  }
): Promise<void> {
  await dispatchEvent(event, data, { organizationId: data.organizationId });
}

/**
 * Dispatch preset applied event
 */
export async function dispatchPresetApplied(data: {
  presetId: string;
  presetName: string;
  appliedBy: string;
  changes: unknown[];
  organizationId?: string;
}): Promise<void> {
  await dispatchEvent('preset.applied', data, {
    organizationId: data.organizationId,
  });
}

// =============================================================================
// Test Webhook
// =============================================================================

/**
 * Send a test event to a webhook
 */
export async function testWebhook(webhookId: string): Promise<{
  success: boolean;
  statusCode?: number;
  responseTimeMs?: number;
  error?: string;
}> {
  const webhook = webhooksStore.get(webhookId);
  if (!webhook) {
    return { success: false, error: 'Webhook not found' };
  }

  const testPayload: WebhookPayload = {
    id: crypto.randomUUID(),
    event: 'role_gate.evaluated',
    timestamp: new Date().toISOString(),
    data: {
      test: true,
      message: 'This is a test webhook delivery',
    },
    organizationId: webhook.organizationId,
  };

  const delivery = await deliverWebhook(webhook, testPayload);

  return {
    success: !delivery.error,
    statusCode: delivery.statusCode,
    responseTimeMs: delivery.responseTimeMs,
    error: delivery.error,
  };
}

// =============================================================================
// Utilities
// =============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
// Exports
// =============================================================================

export const webhookService = {
  create: createWebhook,
  get: getWebhook,
  list: listWebhooks,
  update: updateWebhook,
  delete: deleteWebhook,
  dispatch: dispatchEvent,
  test: testWebhook,
  getDeliveryHistory,
  verifySignature,
};
