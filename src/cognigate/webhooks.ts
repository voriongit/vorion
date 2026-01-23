/**
 * COGNIGATE Webhook Service
 *
 * Event webhook delivery system for the Constrained Execution Runtime.
 * Provides reliable notification of execution lifecycle events to external
 * systems with HMAC-SHA256 signatures, exponential backoff retry, circuit
 * breaker protection, and dead letter handling.
 *
 * @packageDocumentation
 */

import { createHmac } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import { createLogger } from '../common/logger.js';
import { withCircuitBreaker } from '../common/circuit-breaker.js';
import type { ID, Timestamp } from '../common/types.js';

const logger = createLogger({ component: 'cognigate-webhooks' });

// ============================================================================
// Constants
// ============================================================================

/** Default delivery timeout in milliseconds */
const DEFAULT_DELIVERY_TIMEOUT_MS = 10000;

/** Maximum retry attempts before dead-lettering */
const MAX_RETRY_ATTEMPTS = 5;

/** Base delay for exponential backoff in milliseconds */
const BACKOFF_BASE_MS = 1000;

/** Maximum backoff delay in milliseconds (30 minutes) */
const BACKOFF_MAX_MS = 1800000;

/** HMAC signature algorithm */
const HMAC_ALGORITHM = 'sha256';

/** Signature header name */
const SIGNATURE_HEADER = 'X-Vorion-Cognigate-Signature';

/** Timestamp header name */
const TIMESTAMP_HEADER = 'X-Vorion-Cognigate-Timestamp';

/** Event type header name */
const EVENT_TYPE_HEADER = 'X-Vorion-Cognigate-Event';

/** Delivery ID header name */
const DELIVERY_ID_HEADER = 'X-Vorion-Cognigate-Delivery-Id';

// ============================================================================
// Types
// ============================================================================

/**
 * Webhook event types emitted by the Cognigate module
 */
export type CognigateWebhookEvent =
  | 'execution.started'
  | 'execution.completed'
  | 'execution.failed'
  | 'execution.terminated'
  | 'execution.timeout'
  | 'resource.warning'
  | 'resource.violation'
  | 'handler.registered'
  | 'handler.degraded'
  | 'escalation.created'
  | 'escalation.resolved';

/**
 * Webhook subscription configuration
 */
export interface WebhookSubscription {
  /** Unique subscription identifier */
  id: ID;
  /** Tenant this subscription belongs to */
  tenantId: ID;
  /** Delivery URL (HTTPS required in production) */
  url: string;
  /** Events this subscription listens for */
  events: CognigateWebhookEvent[];
  /** HMAC secret for payload signing */
  secret: string;
  /** Whether this subscription is active */
  enabled: boolean;
  /** When the subscription was created */
  createdAt: Timestamp;
  /** Optional description */
  description?: string;
  /** Custom headers to include in delivery */
  customHeaders?: Record<string, string>;
}

/**
 * Webhook delivery payload sent to subscribers
 */
export interface WebhookDeliveryPayload {
  /** Unique delivery ID */
  id: string;
  /** Event type */
  event: CognigateWebhookEvent;
  /** Tenant ID */
  tenantId: ID;
  /** ISO timestamp of event occurrence */
  timestamp: Timestamp;
  /** Event-specific data */
  data: Record<string, unknown>;
}

/**
 * Result of a webhook delivery attempt
 */
export interface WebhookDeliveryResult {
  /** Whether delivery succeeded */
  success: boolean;
  /** Subscription ID */
  subscriptionId: ID;
  /** Delivery ID */
  deliveryId: string;
  /** HTTP status code returned */
  statusCode?: number;
  /** Error message if failed */
  error?: string;
  /** Number of attempts made */
  attempts: number;
  /** When successfully delivered */
  deliveredAt?: Timestamp;
  /** When next retry will occur */
  nextRetryAt?: Timestamp;
}

/**
 * Item in the retry queue
 */
interface WebhookRetryItem {
  /** Subscription to deliver to */
  subscription: WebhookSubscription;
  /** Event type */
  event: CognigateWebhookEvent;
  /** Payload to deliver */
  payload: Record<string, unknown>;
  /** Delivery ID for tracking */
  deliveryId: string;
  /** Current attempt number */
  attempt: number;
  /** When to attempt next delivery */
  nextAttemptAt: number;
  /** When this item was first queued */
  createdAt: number;
}

/**
 * Webhook delivery metrics
 */
export interface WebhookMetrics {
  /** Total deliveries attempted */
  totalDeliveries: number;
  /** Successful deliveries */
  successfulDeliveries: number;
  /** Failed deliveries (after all retries) */
  failedDeliveries: number;
  /** Items currently in retry queue */
  retryQueueSize: number;
  /** Items in dead letter queue */
  deadLetterCount: number;
}

/**
 * Options for the webhook service
 */
export interface WebhookServiceOptions {
  /** Delivery timeout in milliseconds (default: 10000) */
  deliveryTimeoutMs?: number;
  /** Maximum retry attempts (default: 5) */
  maxRetries?: number;
  /** Retry processor interval in milliseconds (default: 5000) */
  retryIntervalMs?: number;
  /** Circuit breaker service name prefix (default: 'cognigateWebhook') */
  circuitBreakerPrefix?: string;
}

// ============================================================================
// Webhook Service Implementation
// ============================================================================

/**
 * Webhook delivery service for the Cognigate module.
 *
 * Manages subscriptions and delivers event notifications to registered
 * endpoints with guaranteed-at-least-once semantics through retry logic.
 *
 * @example
 * ```typescript
 * const webhookService = new CognigateWebhookService();
 *
 * // Register subscription
 * webhookService.subscribe({
 *   id: 'sub-1',
 *   tenantId: 'tenant-1',
 *   url: 'https://example.com/webhook',
 *   events: ['execution.completed', 'execution.failed'],
 *   secret: 'whsec_...',
 *   enabled: true,
 *   createdAt: new Date().toISOString(),
 * });
 *
 * // Emit event
 * await webhookService.emit('execution.completed', 'tenant-1', {
 *   executionId: 'exec-123',
 *   status: 'completed',
 * });
 *
 * // Start background retry processing
 * webhookService.startRetryProcessor();
 * ```
 */
export class CognigateWebhookService {
  /** Subscriptions indexed by tenant ID */
  private subscriptions: Map<string, WebhookSubscription[]> = new Map();

  /** Queue of failed deliveries awaiting retry */
  private retryQueue: WebhookRetryItem[] = [];

  /** Dead letter items (exceeded max retries) */
  private deadLetterQueue: WebhookRetryItem[] = [];

  /** Retry processor interval handle */
  private retryInterval?: NodeJS.Timeout | undefined;

  /** Delivery metrics */
  private metrics: WebhookMetrics = {
    totalDeliveries: 0,
    successfulDeliveries: 0,
    failedDeliveries: 0,
    retryQueueSize: 0,
    deadLetterCount: 0,
  };

  /** Configuration options */
  private readonly deliveryTimeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryIntervalMs: number;
  private readonly circuitBreakerPrefix: string;

  constructor(options?: WebhookServiceOptions) {
    this.deliveryTimeoutMs = options?.deliveryTimeoutMs ?? DEFAULT_DELIVERY_TIMEOUT_MS;
    this.maxRetries = options?.maxRetries ?? MAX_RETRY_ATTEMPTS;
    this.retryIntervalMs = options?.retryIntervalMs ?? 5000;
    this.circuitBreakerPrefix = options?.circuitBreakerPrefix ?? 'cognigateWebhook';
  }

  // ==========================================================================
  // Subscription Management
  // ==========================================================================

  /**
   * Register a webhook subscription.
   *
   * @param subscription - The subscription configuration
   */
  subscribe(subscription: WebhookSubscription): void {
    const tenantSubs = this.subscriptions.get(subscription.tenantId) ?? [];
    const existingIndex = tenantSubs.findIndex((s) => s.id === subscription.id);

    if (existingIndex >= 0) {
      tenantSubs[existingIndex] = subscription;
      logger.info(
        { subscriptionId: subscription.id, tenantId: subscription.tenantId },
        'Webhook subscription updated'
      );
    } else {
      tenantSubs.push(subscription);
      logger.info(
        { subscriptionId: subscription.id, tenantId: subscription.tenantId, events: subscription.events },
        'Webhook subscription registered'
      );
    }

    this.subscriptions.set(subscription.tenantId, tenantSubs);
  }

  /**
   * Remove a webhook subscription by ID.
   *
   * @param id - The subscription ID to remove
   * @returns True if the subscription was found and removed
   */
  unsubscribe(id: ID): boolean {
    const entries = Array.from(this.subscriptions);
    for (const [tenantId, subs] of entries) {
      const index = subs.findIndex((s) => s.id === id);
      if (index >= 0) {
        subs.splice(index, 1);
        this.subscriptions.set(tenantId, subs);

        logger.info({ subscriptionId: id, tenantId }, 'Webhook subscription removed');
        return true;
      }
    }

    logger.debug({ subscriptionId: id }, 'Webhook subscription not found for removal');
    return false;
  }

  /**
   * Get all subscriptions for a tenant.
   *
   * @param tenantId - The tenant identifier
   * @returns Array of webhook subscriptions
   */
  getSubscriptions(tenantId: ID): WebhookSubscription[] {
    return this.subscriptions.get(tenantId) ?? [];
  }

  /**
   * Get a specific subscription by ID.
   *
   * @param id - The subscription ID
   * @returns The subscription or null
   */
  getSubscription(id: ID): WebhookSubscription | null {
    const allSubs = Array.from(this.subscriptions.values());
    for (const subs of allSubs) {
      const sub = subs.find((s) => s.id === id);
      if (sub) return sub;
    }
    return null;
  }

  // ==========================================================================
  // Event Emission
  // ==========================================================================

  /**
   * Emit a webhook event to all matching subscribers for a tenant.
   *
   * @param event - The event type
   * @param tenantId - The tenant identifier
   * @param payload - Event-specific data
   */
  async emit(
    event: CognigateWebhookEvent,
    tenantId: ID,
    payload: Record<string, unknown>
  ): Promise<void> {
    const subscriptions = this.getMatchingSubscriptions(tenantId, event);

    if (subscriptions.length === 0) {
      logger.debug({ event, tenantId }, 'No matching webhook subscriptions for event');
      return;
    }

    logger.info(
      { event, tenantId, subscriberCount: subscriptions.length },
      'Emitting cognigate webhook event'
    );

    const deliveryPromises = subscriptions.map((subscription) =>
      this.deliverWithRetry(subscription, event, payload)
    );

    // Deliver in parallel but don't fail the caller
    const results = await Promise.allSettled(deliveryPromises);

    for (const result of results) {
      if (result.status === 'rejected') {
        logger.error(
          { event, tenantId, error: result.reason },
          'Webhook delivery promise rejected unexpectedly'
        );
      }
    }
  }

  // ==========================================================================
  // Delivery Logic
  // ==========================================================================

  /**
   * Deliver a webhook event to a subscription with retry on failure.
   */
  private async deliverWithRetry(
    subscription: WebhookSubscription,
    event: CognigateWebhookEvent,
    payload: Record<string, unknown>
  ): Promise<WebhookDeliveryResult> {
    const deliveryId = randomUUID();
    const success = await this.deliver(subscription, event, payload, deliveryId);

    this.metrics.totalDeliveries++;

    if (success) {
      this.metrics.successfulDeliveries++;
      return {
        success: true,
        subscriptionId: subscription.id,
        deliveryId,
        attempts: 1,
        deliveredAt: new Date().toISOString(),
      };
    }

    // Queue for retry
    const retryItem: WebhookRetryItem = {
      subscription,
      event,
      payload,
      deliveryId,
      attempt: 1,
      nextAttemptAt: Date.now() + this.calculateBackoff(1),
      createdAt: Date.now(),
    };

    this.retryQueue.push(retryItem);
    this.metrics.retryQueueSize = this.retryQueue.length;

    logger.info(
      { subscriptionId: subscription.id, deliveryId, nextAttemptMs: this.calculateBackoff(1) },
      'Webhook delivery queued for retry'
    );

    return {
      success: false,
      subscriptionId: subscription.id,
      deliveryId,
      attempts: 1,
      nextRetryAt: new Date(retryItem.nextAttemptAt).toISOString(),
    };
  }

  /**
   * Perform a single delivery attempt to a subscription endpoint.
   *
   * @returns True if delivery succeeded, false otherwise
   */
  private async deliver(
    subscription: WebhookSubscription,
    event: CognigateWebhookEvent,
    payload: Record<string, unknown>,
    deliveryId: string
  ): Promise<boolean> {
    const deliveryPayload: WebhookDeliveryPayload = {
      id: deliveryId,
      event,
      tenantId: subscription.tenantId,
      timestamp: new Date().toISOString(),
      data: payload,
    };

    const payloadString = JSON.stringify(deliveryPayload);
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = this.signPayload(payloadString, subscription.secret, timestamp);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      [SIGNATURE_HEADER]: signature,
      [TIMESTAMP_HEADER]: timestamp.toString(),
      [EVENT_TYPE_HEADER]: event,
      [DELIVERY_ID_HEADER]: deliveryId,
      'User-Agent': 'Vorion-Cognigate-Webhook/1.0',
      ...subscription.customHeaders,
    };

    try {
      const result = await withCircuitBreaker(
        `${this.circuitBreakerPrefix}:${subscription.id}`,
        async () => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), this.deliveryTimeoutMs);

          try {
            const response = await fetch(subscription.url, {
              method: 'POST',
              headers,
              body: payloadString,
              signal: controller.signal,
            });

            clearTimeout(timeoutId);
            return response;
          } catch (fetchError) {
            clearTimeout(timeoutId);
            throw fetchError;
          }
        }
      );

      if (result.ok) {
        logger.debug(
          { subscriptionId: subscription.id, deliveryId, statusCode: result.status },
          'Webhook delivered successfully'
        );
        return true;
      }

      logger.warn(
        { subscriptionId: subscription.id, deliveryId, statusCode: result.status },
        'Webhook delivery received non-2xx response'
      );
      return false;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn(
        { subscriptionId: subscription.id, deliveryId, error: errorMessage },
        'Webhook delivery failed'
      );
      return false;
    }
  }

  /**
   * Generate HMAC-SHA256 signature for a webhook payload.
   *
   * @param payload - The JSON payload string
   * @param secret - The subscription's HMAC secret
   * @param timestamp - Unix timestamp for replay protection
   * @returns The signature string in format 'v1=<hex>'
   */
  private signPayload(payload: string, secret: string, timestamp: number): string {
    const signatureInput = `${timestamp}.${payload}`;
    const hmac = createHmac(HMAC_ALGORITHM, secret);
    hmac.update(signatureInput);
    return `v1=${hmac.digest('hex')}`;
  }

  /**
   * Calculate exponential backoff delay with jitter.
   *
   * @param attempt - Current attempt number (1-based)
   * @returns Delay in milliseconds
   */
  private calculateBackoff(attempt: number): number {
    const baseDelay = BACKOFF_BASE_MS * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 1000;
    return Math.min(baseDelay + jitter, BACKOFF_MAX_MS);
  }

  /**
   * Get subscriptions matching a specific event for a tenant.
   */
  private getMatchingSubscriptions(
    tenantId: ID,
    event: CognigateWebhookEvent
  ): WebhookSubscription[] {
    const tenantSubs = this.subscriptions.get(tenantId) ?? [];
    return tenantSubs.filter(
      (sub) => sub.enabled && sub.events.includes(event)
    );
  }

  // ==========================================================================
  // Retry Processing
  // ==========================================================================

  /**
   * Process failed deliveries that are due for retry.
   * Called periodically by the retry processor interval.
   */
  private async retryFailed(): Promise<void> {
    const now = Date.now();
    const dueItems: WebhookRetryItem[] = [];
    const remainingItems: WebhookRetryItem[] = [];

    for (const item of this.retryQueue) {
      if (item.nextAttemptAt <= now) {
        dueItems.push(item);
      } else {
        remainingItems.push(item);
      }
    }

    this.retryQueue = remainingItems;

    if (dueItems.length === 0) {
      return;
    }

    logger.debug({ count: dueItems.length }, 'Processing webhook retry queue');

    for (const item of dueItems) {
      const success = await this.deliver(
        item.subscription,
        item.event,
        item.payload,
        item.deliveryId
      );

      if (success) {
        this.metrics.successfulDeliveries++;
        logger.info(
          { subscriptionId: item.subscription.id, deliveryId: item.deliveryId, attempt: item.attempt + 1 },
          'Webhook retry delivered successfully'
        );
        continue;
      }

      const nextAttempt = item.attempt + 1;

      if (nextAttempt >= this.maxRetries) {
        // Move to dead letter queue
        this.deadLetterQueue.push(item);
        this.metrics.failedDeliveries++;
        this.metrics.deadLetterCount = this.deadLetterQueue.length;

        logger.error(
          {
            subscriptionId: item.subscription.id,
            deliveryId: item.deliveryId,
            attempts: nextAttempt,
            event: item.event,
          },
          'Webhook delivery exhausted all retries, moved to dead letter queue'
        );
        continue;
      }

      // Re-queue with increased backoff
      const retryItem: WebhookRetryItem = {
        ...item,
        attempt: nextAttempt,
        nextAttemptAt: now + this.calculateBackoff(nextAttempt),
      };

      this.retryQueue.push(retryItem);

      logger.debug(
        {
          subscriptionId: item.subscription.id,
          deliveryId: item.deliveryId,
          attempt: nextAttempt,
          nextAttemptMs: this.calculateBackoff(nextAttempt),
        },
        'Webhook re-queued for retry'
      );
    }

    this.metrics.retryQueueSize = this.retryQueue.length;
  }

  // ==========================================================================
  // Lifecycle Management
  // ==========================================================================

  /**
   * Start the background retry processor.
   * Periodically checks the retry queue and re-attempts failed deliveries.
   */
  startRetryProcessor(): void {
    if (this.retryInterval) {
      logger.warn('Webhook retry processor already running');
      return;
    }

    this.retryInterval = setInterval(async () => {
      try {
        await this.retryFailed();
      } catch (error) {
        logger.error({ error }, 'Error in webhook retry processor');
      }
    }, this.retryIntervalMs);

    logger.info(
      { intervalMs: this.retryIntervalMs },
      'Webhook retry processor started'
    );
  }

  /**
   * Stop the background retry processor.
   */
  stopRetryProcessor(): void {
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
      this.retryInterval = undefined;
      logger.info('Webhook retry processor stopped');
    }
  }

  /**
   * Gracefully shut down the webhook service.
   * Stops the retry processor and logs remaining queue state.
   */
  async shutdown(): Promise<void> {
    this.stopRetryProcessor();

    if (this.retryQueue.length > 0) {
      logger.warn(
        { retryQueueSize: this.retryQueue.length, deadLetterCount: this.deadLetterQueue.length },
        'Webhook service shutting down with pending retries'
      );
    }

    logger.info(
      {
        totalDeliveries: this.metrics.totalDeliveries,
        successfulDeliveries: this.metrics.successfulDeliveries,
        failedDeliveries: this.metrics.failedDeliveries,
      },
      'Webhook service shut down'
    );
  }

  // ==========================================================================
  // Metrics & Monitoring
  // ==========================================================================

  /**
   * Get current webhook delivery metrics.
   *
   * @returns Current metrics snapshot
   */
  getMetrics(): WebhookMetrics {
    return {
      ...this.metrics,
      retryQueueSize: this.retryQueue.length,
      deadLetterCount: this.deadLetterQueue.length,
    };
  }

  /**
   * Get items in the dead letter queue.
   *
   * @returns Array of dead-lettered items with delivery details
   */
  getDeadLetterItems(): Array<{
    deliveryId: string;
    subscriptionId: ID;
    event: CognigateWebhookEvent;
    attempts: number;
    createdAt: Timestamp;
  }> {
    return this.deadLetterQueue.map((item) => ({
      deliveryId: item.deliveryId,
      subscriptionId: item.subscription.id,
      event: item.event,
      attempts: item.attempt,
      createdAt: new Date(item.createdAt).toISOString(),
    }));
  }

  /**
   * Retry a specific dead-lettered delivery.
   *
   * @param deliveryId - The delivery ID to retry
   * @returns True if the item was found and re-queued
   */
  retryDeadLetter(deliveryId: string): boolean {
    const index = this.deadLetterQueue.findIndex((item) => item.deliveryId === deliveryId);
    if (index < 0) {
      return false;
    }

    const item = this.deadLetterQueue.splice(index, 1)[0]!;
    const retryItem: WebhookRetryItem = {
      ...item,
      attempt: 0,
      nextAttemptAt: Date.now(),
    };

    this.retryQueue.push(retryItem);
    this.metrics.deadLetterCount = this.deadLetterQueue.length;
    this.metrics.retryQueueSize = this.retryQueue.length;

    logger.info(
      { deliveryId, subscriptionId: item.subscription.id },
      'Dead letter item re-queued for retry'
    );

    return true;
  }

  /**
   * Clear all subscriptions and queues. Primarily for testing.
   */
  reset(): void {
    this.stopRetryProcessor();
    this.subscriptions.clear();
    this.retryQueue = [];
    this.deadLetterQueue = [];
    this.metrics = {
      totalDeliveries: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0,
      retryQueueSize: 0,
      deadLetterCount: 0,
    };
    logger.debug('Webhook service reset');
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/** Singleton webhook service instance */
let webhookServiceInstance: CognigateWebhookService | null = null;

/**
 * Get or create the shared webhook service singleton.
 *
 * @param options - Optional configuration for first creation
 * @returns The shared CognigateWebhookService instance
 */
export function getCognigateWebhookService(options?: WebhookServiceOptions): CognigateWebhookService {
  if (!webhookServiceInstance) {
    webhookServiceInstance = new CognigateWebhookService(options);
  }
  return webhookServiceInstance;
}

/**
 * Create a new webhook service instance (non-singleton).
 *
 * @param options - Optional configuration
 * @returns A new CognigateWebhookService instance
 */
export function createCognigateWebhookService(options?: WebhookServiceOptions): CognigateWebhookService {
  return new CognigateWebhookService(options);
}

/**
 * Reset the singleton instance. Primarily for testing.
 */
export function resetCognigateWebhookService(): void {
  if (webhookServiceInstance) {
    void webhookServiceInstance.shutdown();
  }
  webhookServiceInstance = null;
}

// ============================================================================
// Signature Verification Utility
// ============================================================================

/**
 * Verify a webhook signature from an incoming request.
 * Useful for consumers of Cognigate webhooks to verify authenticity.
 *
 * @param payload - The raw request body string
 * @param signature - The signature from the X-Vorion-Cognigate-Signature header
 * @param secret - The subscription's HMAC secret
 * @param timestamp - The timestamp from the X-Vorion-Cognigate-Timestamp header
 * @param toleranceSeconds - Maximum age of the timestamp (default: 300s)
 * @returns Verification result
 */
export function verifyCognigateWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
  timestamp: number,
  toleranceSeconds: number = 300
): { valid: boolean; error?: string } {
  // Check timestamp tolerance for replay protection
  const now = Math.floor(Date.now() / 1000);
  const diff = Math.abs(now - timestamp);

  if (diff > toleranceSeconds) {
    return {
      valid: false,
      error: `Timestamp outside tolerance: ${diff}s > ${toleranceSeconds}s`,
    };
  }

  // Parse signature format
  const parts = signature.split('=');
  if (parts.length !== 2 || parts[0] !== 'v1') {
    return { valid: false, error: 'Invalid signature format (expected v1=<hex>)' };
  }

  const providedHash = parts[1]!;

  // Compute expected signature
  const signatureInput = `${timestamp}.${payload}`;
  const hmac = createHmac(HMAC_ALGORITHM, secret);
  hmac.update(signatureInput);
  const expectedHash = hmac.digest('hex');

  // Constant-time comparison
  if (providedHash.length !== expectedHash.length) {
    return { valid: false, error: 'Signature length mismatch' };
  }

  let mismatch = 0;
  for (let i = 0; i < providedHash.length; i++) {
    mismatch |= providedHash.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  }

  if (mismatch !== 0) {
    return { valid: false, error: 'Signature verification failed' };
  }

  return { valid: true };
}
