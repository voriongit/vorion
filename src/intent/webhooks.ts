/**
 * INTENT Webhook Notifications
 *
 * Outbound webhook notifications for escalation events.
 * Supports configurable URLs per tenant with retry logic.
 * Includes SSRF protection to prevent internal network access.
 */

import { randomUUID, createHmac, timingSafeEqual } from 'node:crypto';
import { and, desc, eq, lt, lte } from 'drizzle-orm';
import { getConfig } from '../common/config.js';
import { createLogger } from '../common/logger.js';
import { getRedis } from '../common/redis.js';
import { getDatabase } from '../common/db.js';
import type { ID } from '../common/types.js';
import { ValidationError, NotFoundError } from '../common/errors.js';
import { encrypt, decrypt, type EncryptedEnvelope } from '../common/encryption.js';
import { getTraceContext, injectTraceToHeaders } from '../common/trace.js';
import type { EscalationRecord } from './escalation.js';
import {
  webhookDeliveries,
  type WebhookDeliveryRow,
  type NewWebhookDeliveryRow,
} from './schema.js';
import {
  webhookCircuitBreakerState,
  webhookCircuitBreakerTripsTotal,
  webhookDeliveriesSkippedTotal,
  webhookCircuitBreakerTransitions,
  recordWebhookDelivery,
  intentRegistry,
} from './metrics.js';
import { Histogram, Counter } from 'prom-client';

// =============================================================================
// Parallel Webhook Delivery Metrics
// =============================================================================

/**
 * Webhook batch delivery duration histogram
 */
const webhookBatchDeliveryDuration = new Histogram({
  name: 'vorion_webhook_batch_delivery_duration_seconds',
  help: 'Time to deliver webhooks to all subscriptions for an event',
  labelNames: ['tenant_id', 'event_type'] as const,
  buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
  registers: [intentRegistry],
});

/**
 * Webhook batch size histogram
 */
const webhookBatchSize = new Histogram({
  name: 'vorion_webhook_batch_size',
  help: 'Number of webhooks in a batch delivery',
  labelNames: ['tenant_id'] as const,
  buckets: [1, 2, 5, 10, 20, 50, 100],
  registers: [intentRegistry],
});

/**
 * Webhook parallel delivery concurrency usage
 */
const webhookConcurrencyUsage = new Histogram({
  name: 'vorion_webhook_concurrency_usage',
  help: 'Number of concurrent webhook deliveries in a batch',
  labelNames: ['tenant_id'] as const,
  buckets: [1, 2, 3, 5, 10],
  registers: [intentRegistry],
});

/**
 * Webhook batch delivery results counter
 */
const webhookBatchResults = new Counter({
  name: 'vorion_webhook_batch_results_total',
  help: 'Results of webhook batch deliveries',
  labelNames: ['tenant_id', 'event_type', 'result'] as const, // result: all_success, partial_success, all_failed
  registers: [intentRegistry],
});

// =============================================================================
// Concurrency Limiter
// =============================================================================

/**
 * Maximum concurrent webhook deliveries per batch.
 * Prevents overwhelming the system or target servers.
 */
const DEFAULT_WEBHOOK_CONCURRENCY = 10;

/**
 * Simple semaphore-based concurrency limiter for parallel operations.
 * Implements a p-limit style pattern without external dependencies.
 */
class ConcurrencyLimiter {
  private running = 0;
  private queue: Array<() => void> = [];

  constructor(private readonly limit: number) {}

  /**
   * Execute a function with concurrency limiting.
   * If at capacity, waits for a slot to become available.
   */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    // Wait for a slot if at capacity
    if (this.running >= this.limit) {
      await new Promise<void>((resolve) => {
        this.queue.push(resolve);
      });
    }

    this.running++;
    try {
      return await fn();
    } finally {
      this.running--;
      // Release next waiting task if any
      const next = this.queue.shift();
      if (next) {
        next();
      }
    }
  }

  /**
   * Get current number of running tasks
   */
  get currentRunning(): number {
    return this.running;
  }
}
import {
  traceWebhookDeliver,
  recordWebhookResult,
} from './tracing.js';

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

// =============================================================================
// HMAC Signature Generation and Verification
// =============================================================================

/**
 * Header name for the HMAC signature
 * Format: v1=<hmac-sha256-hex>
 */
export const SIGNATURE_HEADER = 'X-Vorion-Signature';

/**
 * Header name for the signature timestamp (Unix seconds)
 * Used to prevent replay attacks
 */
export const SIGNATURE_TIMESTAMP_HEADER = 'X-Vorion-Timestamp';

/**
 * Current signature version
 * Allows for future signature algorithm upgrades
 */
const SIGNATURE_VERSION = 'v1';

/**
 * Generate HMAC-SHA256 signature for webhook payload.
 *
 * The signature is computed over a signed payload that combines the timestamp
 * and the JSON payload body to prevent replay attacks. The format is:
 *
 *   signedPayload = `${timestamp}.${payload}`
 *   signature = HMAC-SHA256(secret, signedPayload)
 *
 * The returned signature string includes a version prefix:
 *   `v1=<hex-encoded-hmac>`
 *
 * This versioning allows future algorithm upgrades while maintaining
 * backward compatibility.
 *
 * @param payload - The JSON payload string to sign
 * @param secret - The webhook secret shared with the recipient
 * @param timestamp - Unix timestamp in seconds when the request was generated
 * @returns Versioned signature string in format "v1=<hmac-hex>"
 *
 * @example
 * ```typescript
 * const payload = JSON.stringify({ event: 'test' });
 * const timestamp = Math.floor(Date.now() / 1000);
 * const signature = generateSignature(payload, 'whsec_xxx', timestamp);
 * // Returns: "v1=abc123..."
 * ```
 */
function generateSignature(payload: string, secret: string, timestamp: number): string {
  const signedPayload = `${timestamp}.${payload}`;
  const hmac = createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');
  return `${SIGNATURE_VERSION}=${hmac}`;
}

/**
 * Verify webhook signature for incoming requests.
 *
 * This function is exported for use in client SDKs to verify that webhook
 * requests originated from Vorion and haven't been tampered with.
 *
 * ## Security Features
 *
 * 1. **Timestamp Validation**: Rejects requests with timestamps older than
 *    `toleranceSeconds` (default: 5 minutes) to prevent replay attacks.
 *
 * 2. **Timing-Safe Comparison**: Uses constant-time comparison to prevent
 *    timing attacks that could leak information about the expected signature.
 *
 * 3. **Signed Payload**: The signature covers both timestamp and payload,
 *    ensuring neither can be modified independently.
 *
 * ## Usage in Client SDKs
 *
 * ```typescript
 * import { verifyWebhookSignature, SIGNATURE_HEADER, SIGNATURE_TIMESTAMP_HEADER } from '@vorion/sdk';
 *
 * app.post('/webhook', (req, res) => {
 *   const signature = req.headers[SIGNATURE_HEADER.toLowerCase()];
 *   const timestamp = parseInt(req.headers[SIGNATURE_TIMESTAMP_HEADER.toLowerCase()], 10);
 *   const payload = JSON.stringify(req.body);
 *
 *   if (!verifyWebhookSignature(payload, signature, process.env.WEBHOOK_SECRET, timestamp)) {
 *     return res.status(401).send('Invalid signature');
 *   }
 *
 *   // Process webhook...
 * });
 * ```
 *
 * @param payload - The raw JSON payload string from the request body
 * @param signature - The signature from the X-Vorion-Signature header
 * @param secret - The webhook secret configured for this endpoint
 * @param timestamp - The timestamp from the X-Vorion-Timestamp header (Unix seconds)
 * @param toleranceSeconds - Maximum age of the request in seconds (default: 300 = 5 minutes)
 * @returns true if the signature is valid and timestamp is within tolerance
 *
 * @throws Never throws - returns false for any invalid input
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
  timestamp: number,
  toleranceSeconds = 300
): boolean {
  // Validate inputs
  if (!payload || !signature || !secret || !timestamp) {
    return false;
  }

  // Check timestamp is within tolerance (prevent replay attacks)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > toleranceSeconds) {
    return false;
  }

  // Generate expected signature
  const expectedSignature = generateSignature(payload, secret, timestamp);

  // Convert to buffers for timing-safe comparison
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  // Signatures must be same length for timing-safe comparison
  if (signatureBuffer.length !== expectedBuffer.length) {
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  return timingSafeEqual(signatureBuffer, expectedBuffer);
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
  /**
   * Resolved IP address stored at registration time for DNS pinning.
   * Used to prevent DNS rebinding attacks where an attacker changes DNS
   * after validation to point to internal IPs (e.g., 169.254.169.254).
   */
  resolvedIp?: string;
}

export interface WebhookDeliveryResult {
  success: boolean;
  statusCode?: number;
  error?: string;
  attempts: number;
  deliveredAt?: string;
  /** True if delivery was skipped due to open circuit breaker */
  skippedByCircuitBreaker?: boolean;
}

// =============================================================================
// Circuit Breaker Types
// =============================================================================

/**
 * Circuit breaker states for webhook delivery
 * - closed: Normal operation, deliveries proceed
 * - open: Circuit is tripped, deliveries are skipped
 * - half_open: Testing if webhook is healthy again
 */
export type CircuitBreakerState = 'closed' | 'open' | 'half_open';

/**
 * Circuit breaker state stored in Redis
 */
export interface CircuitBreakerData {
  /** Number of consecutive failures */
  failures: number;
  /** Timestamp when circuit was opened (milliseconds since epoch) */
  openedAt: number | null;
  /** Current state of the circuit */
  state: CircuitBreakerState;
}

/**
 * Numeric values for circuit breaker states (for metrics)
 */
const CIRCUIT_STATE_VALUES: Record<CircuitBreakerState, number> = {
  closed: 0,
  open: 1,
  half_open: 2,
};

/**
 * Internal interface for webhook config as stored in Redis.
 * The secret field is encrypted using AES-256-GCM.
 */
interface StoredWebhookConfig {
  url: string;
  /** Encrypted secret envelope, or undefined if no secret */
  encryptedSecret?: EncryptedEnvelope;
  enabled: boolean;
  events: WebhookEventType[];
  retryAttempts?: number;
  retryDelayMs?: number;
  resolvedIp?: string;
}

/**
 * Check if a stored secret looks like an encrypted envelope.
 * Used to detect legacy unencrypted secrets for migration.
 */
function isEncryptedSecret(value: unknown): value is EncryptedEnvelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ciphertext' in value &&
    'iv' in value &&
    'authTag' in value &&
    'version' in value
  );
}

/**
 * Encrypt a webhook secret for storage.
 * Returns undefined if no secret is provided.
 */
function encryptSecret(secret: string | undefined): EncryptedEnvelope | undefined {
  if (!secret) {
    return undefined;
  }
  return encrypt(secret);
}

/**
 * Decrypt a webhook secret from storage.
 * Handles both encrypted envelopes and legacy plaintext secrets.
 *
 * @param storedConfig - The config as stored in Redis (may be old or new format)
 * @returns The decrypted secret, or undefined if no secret
 */
function decryptStoredSecret(storedConfig: StoredWebhookConfig | WebhookConfig): string | undefined {
  // New format: encrypted secret envelope
  if ('encryptedSecret' in storedConfig && storedConfig.encryptedSecret) {
    if (isEncryptedSecret(storedConfig.encryptedSecret)) {
      return decrypt(storedConfig.encryptedSecret);
    }
  }

  // Legacy format: plaintext secret (for backward compatibility during migration)
  if ('secret' in storedConfig && storedConfig.secret) {
    // Check if it's actually an encrypted envelope stored in 'secret' field
    // (this shouldn't happen, but defensive coding)
    if (typeof storedConfig.secret === 'object' && isEncryptedSecret(storedConfig.secret)) {
      return decrypt(storedConfig.secret as EncryptedEnvelope);
    }

    // Legacy plaintext secret - log warning and return as-is
    logger.warn(
      { hasPlaintextSecret: true },
      'Webhook contains legacy plaintext secret. Consider re-registering to encrypt.'
    );
    return storedConfig.secret as string;
  }

  return undefined;
}

/**
 * Convert a WebhookConfig to StoredWebhookConfig for Redis storage.
 * Encrypts the secret field.
 */
function toStoredConfig(config: WebhookConfig): StoredWebhookConfig {
  const { secret, ...rest } = config;
  const encryptedSecret = encryptSecret(secret);
  const stored: StoredWebhookConfig = {
    url: rest.url,
    enabled: rest.enabled,
    events: rest.events,
  };
  if (encryptedSecret) {
    stored.encryptedSecret = encryptedSecret;
  }
  if (rest.retryAttempts !== undefined) {
    stored.retryAttempts = rest.retryAttempts;
  }
  if (rest.retryDelayMs !== undefined) {
    stored.retryDelayMs = rest.retryDelayMs;
  }
  if (rest.resolvedIp !== undefined) {
    stored.resolvedIp = rest.resolvedIp;
  }
  return stored;
}

/**
 * Convert a StoredWebhookConfig back to WebhookConfig.
 * Decrypts the secret field.
 */
function fromStoredConfig(stored: StoredWebhookConfig | WebhookConfig): WebhookConfig {
  // Handle both old and new format
  const secret = decryptStoredSecret(stored);

  // Build config without the encryptedSecret field
  const config: WebhookConfig = {
    url: stored.url,
    enabled: stored.enabled,
    events: stored.events,
  };

  if (secret) {
    config.secret = secret;
  }
  if (stored.retryAttempts !== undefined) {
    config.retryAttempts = stored.retryAttempts;
  }
  if (stored.retryDelayMs !== undefined) {
    config.retryDelayMs = stored.retryDelayMs;
  }
  if (stored.resolvedIp !== undefined) {
    config.resolvedIp = stored.resolvedIp;
  }

  return config;
}

/**
 * Get webhook configuration from the global config.
 * These values can be overridden per-deployment via environment variables:
 * - VORION_WEBHOOK_TIMEOUT_MS (default: 10000, min: 1000, max: 60000)
 * - VORION_WEBHOOK_RETRY_ATTEMPTS (default: 3)
 * - VORION_WEBHOOK_RETRY_DELAY_MS (default: 1000)
 * - VORION_WEBHOOK_ALLOW_DNS_CHANGE (default: false)
 * - VORION_WEBHOOK_CIRCUIT_FAILURE_THRESHOLD (default: 5)
 * - VORION_WEBHOOK_CIRCUIT_RESET_TIMEOUT_MS (default: 300000 = 5 min)
 */
function getWebhookConfig() {
  const config = getConfig();
  return {
    timeoutMs: config.webhook.timeoutMs,
    retryAttempts: config.webhook.retryAttempts,
    retryDelayMs: config.webhook.retryDelayMs,
    allowDnsChange: config.webhook.allowDnsChange,
    circuitFailureThreshold: config.webhook.circuitFailureThreshold,
    circuitResetTimeoutMs: config.webhook.circuitResetTimeoutMs,
  };
}

// =============================================================================
// DNS Pinning Protection
// =============================================================================

/**
 * DNS Rebinding Attack Detection Result
 */
export interface DnsConsistencyResult {
  valid: boolean;
  reason?: string;
  currentIp?: string;
  storedIp?: string;
}

/**
 * Validate webhook IP consistency (DNS pinning).
 * Compares the currently resolved IP with the IP stored at registration time.
 * This prevents DNS rebinding attacks where an attacker:
 * 1. Registers webhook with attacker.com -> resolves to public IP (passes validation)
 * 2. Changes DNS: attacker.com -> 169.254.169.254 (AWS metadata)
 * 3. Webhook delivery resolves new DNS -> blocked because IP changed
 *
 * @param url The webhook URL to validate
 * @param storedIp The IP address stored at registration time
 * @returns Validation result with current and stored IPs for logging
 */
export async function validateWebhookIpConsistency(
  url: string,
  storedIp: string | undefined
): Promise<DnsConsistencyResult> {
  // If no stored IP (legacy webhook), skip consistency check but log warning
  if (!storedIp) {
    logger.warn(
      { url },
      'Webhook has no stored IP - DNS pinning cannot be enforced. Re-register webhook to enable DNS rebinding protection.'
    );
    return { valid: true, reason: 'No stored IP (legacy webhook)' };
  }

  try {
    const { hostname } = new URL(url);

    // For IP addresses in the URL, compare directly
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
      if (hostname !== storedIp) {
        return {
          valid: false,
          reason: 'IP address in URL does not match stored IP',
          currentIp: hostname,
          storedIp,
        };
      }
      return { valid: true, currentIp: hostname, storedIp };
    }

    // Perform DNS lookup
    const dns = await import('node:dns');
    const { promisify } = await import('node:util');
    const lookup = promisify(dns.lookup);

    const result = await lookup(hostname);
    const currentIp = result.address;

    // Check if IP changed since registration
    if (currentIp !== storedIp) {
      logger.warn(
        { url, currentIp, storedIp },
        'DNS rebinding attack detected: webhook IP changed since registration'
      );
      return {
        valid: false,
        reason: 'DNS resolved IP does not match stored IP from registration',
        currentIp,
        storedIp,
      };
    }

    return { valid: true, currentIp, storedIp };
  } catch (error) {
    logger.warn({ url, storedIp, error }, 'Failed to resolve webhook URL for IP consistency check');
    return {
      valid: false,
      reason: 'Failed to resolve webhook URL hostname',
      storedIp,
    };
  }
}

/**
 * Webhook Service
 *
 * Manages webhook registration, delivery, and persistence.
 * Includes circuit breaker pattern for failing webhooks and
 * persistent delivery records for auditing and replay.
 */
export class WebhookService {
  private redis = getRedis();
  private readonly keyPrefix = 'webhook:';
  private readonly circuitKeyPrefix = 'webhook:circuit:';
  private deliveryRepository: WebhookDeliveryRepository | null = null;

  /**
   * Get the delivery repository instance (lazy initialization).
   * This allows the repository to be created only when persistence is needed.
   */
  private getDeliveryRepository(): WebhookDeliveryRepository {
    if (!this.deliveryRepository) {
      this.deliveryRepository = new WebhookDeliveryRepository();
    }
    return this.deliveryRepository;
  }

  // =========================================================================
  // Circuit Breaker Methods
  // =========================================================================

  /**
   * Get circuit breaker state for a webhook from Redis
   */
  private async getCircuitState(tenantId: ID, webhookId: string): Promise<CircuitBreakerData> {
    const key = `${this.circuitKeyPrefix}${tenantId}:${webhookId}`;
    const data = await this.redis.get(key);

    if (!data) {
      // Default: closed circuit with no failures
      return {
        failures: 0,
        openedAt: null,
        state: 'closed',
      };
    }

    const parsed = JSON.parse(data) as Partial<CircuitBreakerData>;
    // Ensure all required fields have valid values (defensive against corrupt data)
    return {
      failures: typeof parsed.failures === 'number' ? parsed.failures : 0,
      openedAt: typeof parsed.openedAt === 'number' ? parsed.openedAt : null,
      state: (parsed.state === 'closed' || parsed.state === 'open' || parsed.state === 'half_open')
        ? parsed.state
        : 'closed',
    };
  }

  /**
   * Set circuit breaker state for a webhook in Redis
   */
  private async setCircuitState(
    tenantId: ID,
    webhookId: string,
    circuitData: CircuitBreakerData
  ): Promise<void> {
    const key = `${this.circuitKeyPrefix}${tenantId}:${webhookId}`;
    // Store circuit state with a TTL of 24 hours to auto-clean up stale circuits
    const ttlSeconds = 86400;
    await this.redis.set(key, JSON.stringify(circuitData), 'EX', ttlSeconds);

    // Update metrics (with safe default for state)
    const stateValue = CIRCUIT_STATE_VALUES[circuitData.state] ?? 0;
    webhookCircuitBreakerState.set(
      { tenant_id: tenantId, webhook_id: webhookId },
      stateValue
    );
  }

  /**
   * Transition circuit breaker to a new state with logging and metrics
   */
  private async transitionCircuitState(
    tenantId: ID,
    webhookId: string,
    fromState: CircuitBreakerState,
    toState: CircuitBreakerState,
    circuitData: CircuitBreakerData
  ): Promise<void> {
    if (fromState === toState) return;

    logger.info(
      { tenantId, webhookId, fromState, toState, failures: circuitData.failures },
      `Circuit breaker state transition: ${fromState} -> ${toState}`
    );

    webhookCircuitBreakerTransitions.inc({
      tenant_id: tenantId,
      webhook_id: webhookId,
      from_state: fromState,
      to_state: toState,
    });

    if (toState === 'open') {
      webhookCircuitBreakerTripsTotal.inc({
        tenant_id: tenantId,
        webhook_id: webhookId,
      });
    }
  }

  /**
   * Check if circuit breaker allows delivery attempt
   * Returns true if delivery should proceed, false if it should be skipped
   */
  private async shouldAttemptDelivery(
    tenantId: ID,
    webhookId: string
  ): Promise<{ allowed: boolean; circuitData: CircuitBreakerData }> {
    const webhookConfig = getWebhookConfig();
    const circuitData = await this.getCircuitState(tenantId, webhookId);

    switch (circuitData.state) {
      case 'closed':
        // Normal operation - allow delivery
        return { allowed: true, circuitData };

      case 'open': {
        // Check if reset timeout has elapsed
        const now = Date.now();
        const resetTimeout = webhookConfig.circuitResetTimeoutMs;

        if (circuitData.openedAt && now - circuitData.openedAt >= resetTimeout) {
          // Transition to half-open state
          const previousState = circuitData.state;
          circuitData.state = 'half_open';
          await this.setCircuitState(tenantId, webhookId, circuitData);
          await this.transitionCircuitState(tenantId, webhookId, previousState, 'half_open', circuitData);

          logger.info(
            { tenantId, webhookId, elapsedMs: now - circuitData.openedAt },
            'Circuit breaker transitioning to half-open state for test delivery'
          );

          return { allowed: true, circuitData };
        }

        // Circuit is still open - skip delivery
        logger.debug(
          { tenantId, webhookId, openedAt: circuitData.openedAt, resetTimeout },
          'Skipping webhook delivery: circuit breaker is open'
        );

        webhookDeliveriesSkippedTotal.inc({
          tenant_id: tenantId,
          webhook_id: webhookId,
        });

        return { allowed: false, circuitData };
      }

      case 'half_open':
        // Allow one test delivery
        return { allowed: true, circuitData };

      default:
        return { allowed: true, circuitData };
    }
  }

  /**
   * Record delivery success and potentially close the circuit
   */
  private async recordDeliverySuccess(
    tenantId: ID,
    webhookId: string,
    circuitData: CircuitBreakerData
  ): Promise<void> {
    const previousState = circuitData.state;

    // Reset failures and close circuit on success
    circuitData.failures = 0;
    circuitData.openedAt = null;
    circuitData.state = 'closed';

    await this.setCircuitState(tenantId, webhookId, circuitData);

    if (previousState !== 'closed') {
      await this.transitionCircuitState(tenantId, webhookId, previousState, 'closed', circuitData);
      logger.info(
        { tenantId, webhookId, previousState },
        'Circuit breaker closed after successful delivery'
      );
    }
  }

  /**
   * Record delivery failure and potentially open the circuit
   */
  private async recordDeliveryFailure(
    tenantId: ID,
    webhookId: string,
    circuitData: CircuitBreakerData
  ): Promise<void> {
    const webhookConfig = getWebhookConfig();
    const previousState = circuitData.state;

    // Increment failure count
    circuitData.failures += 1;

    if (circuitData.state === 'half_open') {
      // Failed during half-open test - reopen circuit
      circuitData.state = 'open';
      circuitData.openedAt = Date.now();

      await this.setCircuitState(tenantId, webhookId, circuitData);
      await this.transitionCircuitState(tenantId, webhookId, previousState, 'open', circuitData);

      logger.warn(
        { tenantId, webhookId, failures: circuitData.failures },
        'Circuit breaker reopened after failed half-open test'
      );
    } else if (circuitData.failures >= webhookConfig.circuitFailureThreshold) {
      // Exceeded failure threshold - open circuit
      circuitData.state = 'open';
      circuitData.openedAt = Date.now();

      await this.setCircuitState(tenantId, webhookId, circuitData);
      await this.transitionCircuitState(tenantId, webhookId, previousState, 'open', circuitData);

      logger.warn(
        { tenantId, webhookId, failures: circuitData.failures, threshold: webhookConfig.circuitFailureThreshold },
        'Circuit breaker opened after exceeding failure threshold'
      );
    } else {
      // Just record the failure
      await this.setCircuitState(tenantId, webhookId, circuitData);

      logger.debug(
        { tenantId, webhookId, failures: circuitData.failures, threshold: webhookConfig.circuitFailureThreshold },
        'Webhook delivery failure recorded'
      );
    }
  }

  /**
   * Get current circuit breaker status for a webhook (for monitoring/debugging)
   */
  async getCircuitBreakerStatus(tenantId: ID, webhookId: string): Promise<CircuitBreakerData & { timeUntilResetMs?: number }> {
    const webhookConfig = getWebhookConfig();
    const circuitData = await this.getCircuitState(tenantId, webhookId);

    if (circuitData.state === 'open' && circuitData.openedAt) {
      const elapsed = Date.now() - circuitData.openedAt;
      const remaining = Math.max(0, webhookConfig.circuitResetTimeoutMs - elapsed);
      return { ...circuitData, timeUntilResetMs: remaining };
    }

    return circuitData;
  }

  /**
   * Manually reset circuit breaker for a webhook (for administrative use)
   */
  async resetCircuitBreaker(tenantId: ID, webhookId: string): Promise<void> {
    const circuitData = await this.getCircuitState(tenantId, webhookId);
    const previousState = circuitData.state;

    circuitData.failures = 0;
    circuitData.openedAt = null;
    circuitData.state = 'closed';

    await this.setCircuitState(tenantId, webhookId, circuitData);

    if (previousState !== 'closed') {
      await this.transitionCircuitState(tenantId, webhookId, previousState, 'closed', circuitData);
    }

    logger.info(
      { tenantId, webhookId, previousState },
      'Circuit breaker manually reset'
    );
  }

  /**
   * Register a webhook for a tenant
   *
   * Performs SSRF validation and DNS resolution to store the resolved IP
   * for DNS pinning protection against rebinding attacks.
   */
  async registerWebhook(tenantId: ID, config: WebhookConfig): Promise<string> {
    // SSRF protection: validate webhook URL with DNS resolution
    // This also captures the resolved IP for DNS pinning
    const runtimeValidation = await validateWebhookUrlAtRuntime(config.url);
    if (!runtimeValidation.valid) {
      logger.warn(
        { tenantId, url: config.url, reason: runtimeValidation.reason },
        'Webhook registration blocked: SSRF protection'
      );
      throw new ValidationError(`Invalid webhook URL: ${runtimeValidation.reason}`, {
        url: config.url,
        reason: runtimeValidation.reason,
      });
    }

    const webhookId = randomUUID();
    const key = `${this.keyPrefix}config:${tenantId}:${webhookId}`;

    // Store the resolved IP for DNS pinning protection
    // This prevents DNS rebinding attacks where attacker changes DNS after registration
    const configWithResolvedIp: WebhookConfig = { ...config };
    if (runtimeValidation.resolvedIP) {
      configWithResolvedIp.resolvedIp = runtimeValidation.resolvedIP;
    }

    // Encrypt the secret before storing in Redis
    const storedConfig = toStoredConfig(configWithResolvedIp);
    await this.redis.set(key, JSON.stringify(storedConfig));
    await this.redis.sadd(`${this.keyPrefix}tenants:${tenantId}`, webhookId);

    logger.info(
      { tenantId, webhookId, url: config.url, resolvedIp: runtimeValidation.resolvedIP },
      'Webhook registered with DNS pinning'
    );
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
   *
   * Decrypts stored webhook secrets on retrieval. Handles both new encrypted
   * format and legacy plaintext secrets for backward compatibility.
   */
  async getWebhooks(tenantId: ID): Promise<Array<{ id: string; config: WebhookConfig }>> {
    const webhookIds = await this.redis.smembers(`${this.keyPrefix}tenants:${tenantId}`);
    const webhooks: Array<{ id: string; config: WebhookConfig }> = [];

    for (const webhookId of webhookIds) {
      const data = await this.redis.get(`${this.keyPrefix}config:${tenantId}:${webhookId}`);
      if (data) {
        // Parse the stored config (may be old or new format)
        const storedConfig = JSON.parse(data) as StoredWebhookConfig | WebhookConfig;
        // Convert to WebhookConfig, decrypting the secret if needed
        const config = fromStoredConfig(storedConfig);
        webhooks.push({
          id: webhookId,
          config,
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
   * Deliver webhooks to all registered endpoints for a tenant.
   *
   * Uses parallel delivery with controlled concurrency (max 10 concurrent)
   * to improve performance while preventing overwhelming target servers.
   *
   * Creates persistent delivery records before attempting delivery,
   * updating them with success/failure status after each attempt.
   * Includes circuit breaker check to skip consistently failing webhooks.
   *
   * Uses Promise.allSettled to ensure failures of one webhook don't affect others.
   */
  private async deliverToTenant(
    tenantId: ID,
    eventType: WebhookEventType,
    payload: WebhookPayload
  ): Promise<WebhookDeliveryResult[]> {
    const startTime = Date.now();
    const webhooks = await this.getWebhooks(tenantId);
    const deliveryRepo = this.getDeliveryRepository();

    // Filter to only enabled webhooks subscribed to this event type
    const eligibleWebhooks = webhooks.filter(
      ({ config }) => config.enabled && config.events.includes(eventType)
    );

    // Record batch size metric
    webhookBatchSize.observe({ tenant_id: tenantId }, eligibleWebhooks.length);

    if (eligibleWebhooks.length === 0) {
      return [];
    }

    // Create concurrency limiter for parallel delivery
    const concurrencyLimit = Math.min(DEFAULT_WEBHOOK_CONCURRENCY, eligibleWebhooks.length);
    const limiter = new ConcurrencyLimiter(concurrencyLimit);

    // Track max concurrency reached for metrics
    let maxConcurrency = 0;

    /**
     * Deliver to a single webhook subscription with all necessary setup.
     * This function is called in parallel with concurrency limiting.
     */
    const deliverToSubscription = async (
      webhookId: string,
      config: WebhookConfig
    ): Promise<WebhookDeliveryResult> => {
      // Track concurrency usage
      const currentConcurrency = limiter.currentRunning;
      if (currentConcurrency > maxConcurrency) {
        maxConcurrency = currentConcurrency;
      }

      // Create persistent delivery record before attempting delivery
      let deliveryRecord: WebhookDelivery | null = null;
      try {
        deliveryRecord = await deliveryRepo.createDelivery({
          webhookId,
          tenantId,
          eventType,
          payload: payload as unknown as Record<string, unknown>,
        });
      } catch (err) {
        logger.error(
          { webhookId, tenantId, eventType, error: err },
          'Failed to create webhook delivery record, proceeding with delivery anyway'
        );
      }

      // Check circuit breaker before attempting delivery
      const { allowed, circuitData } = await this.shouldAttemptDelivery(tenantId, webhookId);

      if (!allowed) {
        // Circuit is open - skip delivery
        const skippedResult: WebhookDeliveryResult = {
          success: false,
          error: 'Circuit breaker open - webhook delivery skipped',
          attempts: 0,
          skippedByCircuitBreaker: true,
        };

        // Update delivery record with skipped status
        if (deliveryRecord) {
          try {
            await deliveryRepo.updateDeliveryStatus(deliveryRecord.id, {
              status: 'failed',
              attempts: 0,
              lastError: 'Circuit breaker open - webhook delivery skipped',
              lastAttemptAt: new Date(),
            });
          } catch (err) {
            logger.error({ deliveryId: deliveryRecord.id, error: err }, 'Failed to update delivery record');
          }
        }

        await this.storeDeliveryResult(tenantId, webhookId, payload.id, skippedResult);
        return skippedResult;
      }

      // Attempt delivery with retry logic
      const result = await this.deliverWithRetry(
        webhookId,
        config,
        payload,
        tenantId,
        circuitData,
        deliveryRecord?.id ?? null
      );

      // Store delivery result in Redis (legacy - for backwards compatibility)
      await this.storeDeliveryResult(tenantId, webhookId, payload.id, result);

      return result;
    };

    // Execute all deliveries in parallel with concurrency limiting
    // Promise.allSettled ensures failures don't affect other webhooks
    const deliveryPromises = eligibleWebhooks.map(({ id: webhookId, config }) =>
      limiter.run(() => deliverToSubscription(webhookId, config))
    );

    const settledResults = await Promise.allSettled(deliveryPromises);

    // Extract results from settled promises
    const results: WebhookDeliveryResult[] = settledResults.map((settled, index) => {
      if (settled.status === 'fulfilled') {
        return settled.value;
      } else {
        // This shouldn't happen since deliverToSubscription catches errors,
        // but handle it defensively
        const webhookId = eligibleWebhooks[index]?.id ?? 'unknown';
        const errorMessage = settled.reason instanceof Error
          ? settled.reason.message
          : 'Unknown delivery error';

        logger.error(
          { webhookId, tenantId, eventType, error: errorMessage },
          'Unexpected error in parallel webhook delivery'
        );

        return {
          success: false,
          error: errorMessage,
          attempts: 0,
        } as WebhookDeliveryResult;
      }
    });

    // Record batch delivery metrics
    const durationSeconds = (Date.now() - startTime) / 1000;
    webhookBatchDeliveryDuration.observe(
      { tenant_id: tenantId, event_type: eventType },
      durationSeconds
    );
    webhookConcurrencyUsage.observe({ tenant_id: tenantId }, maxConcurrency);

    // Record batch result type
    const successCount = results.filter(r => r.success).length;
    let batchResult: 'all_success' | 'partial_success' | 'all_failed';
    if (successCount === results.length) {
      batchResult = 'all_success';
    } else if (successCount > 0) {
      batchResult = 'partial_success';
    } else {
      batchResult = 'all_failed';
    }
    webhookBatchResults.inc({ tenant_id: tenantId, event_type: eventType, result: batchResult });

    logger.info(
      {
        tenantId,
        eventType,
        totalWebhooks: eligibleWebhooks.length,
        successCount,
        failedCount: results.length - successCount,
        durationMs: Date.now() - startTime,
        maxConcurrency,
      },
      'Parallel webhook batch delivery completed'
    );

    return results;
  }

  /**
   * Deliver webhook with retry logic
   *
   * Uses per-webhook config if provided, otherwise falls back to global config.
   * Global defaults are configurable via environment variables.
   * Updates circuit breaker state and persistent delivery record based on success/failure.
   */
  private async deliverWithRetry(
    webhookId: string,
    config: WebhookConfig,
    payload: WebhookPayload,
    tenantId: ID,
    circuitData: CircuitBreakerData,
    deliveryRecordId: ID | null = null
  ): Promise<WebhookDeliveryResult> {
    const deliveryRepo = this.getDeliveryRepository();

    // Helper to safely update delivery record status
    const updateDeliveryRecord = async (
      status: WebhookDeliveryStatus,
      attempts: number,
      options: {
        lastError?: string | null;
        responseStatus?: number | null;
        responseBody?: string | null;
        deliveredAt?: Date | null;
        nextRetryAt?: Date | null;
      } = {}
    ) => {
      if (!deliveryRecordId) return;
      try {
        await deliveryRepo.updateDeliveryStatus(deliveryRecordId, {
          status,
          attempts,
          lastAttemptAt: new Date(),
          lastError: options.lastError ?? null,
          responseStatus: options.responseStatus ?? null,
          responseBody: options.responseBody ?? null,
          deliveredAt: options.deliveredAt ?? null,
          nextRetryAt: options.nextRetryAt ?? null,
        });
      } catch (err) {
        logger.error({ deliveryId: deliveryRecordId, error: err }, 'Failed to update delivery record');
      }
    };

    // Wrap the entire delivery process with tracing
    return traceWebhookDeliver(
      webhookId,
      config.url,
      payload.eventType,
      async (span) => {
        const webhookDefaults = getWebhookConfig();
        const maxAttempts = config.retryAttempts ?? webhookDefaults.retryAttempts;
        const retryDelay = config.retryDelayMs ?? webhookDefaults.retryDelayMs;

        let lastError: string | undefined;
        let lastStatusCode: number | undefined;
        let lastResponseBody: string | undefined;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            const response = await this.sendWebhook(config.url, payload, config.secret, config.resolvedIp);
            lastStatusCode = response.status;

            // Try to capture response body for debugging (limited to first 1KB)
            try {
              const text = await response.text();
              lastResponseBody = text.substring(0, 1024);
            } catch {
              // Ignore errors reading response body
            }

            if (response.ok) {
              logger.info(
                { webhookId, eventType: payload.eventType, attempt },
                'Webhook delivered successfully'
              );

              // Record success in circuit breaker (may close the circuit)
              await this.recordDeliverySuccess(tenantId, webhookId, circuitData);

              // Update persistent delivery record with success
              await updateDeliveryRecord('delivered', attempt, {
                responseStatus: response.status,
                responseBody: lastResponseBody ?? null,
                deliveredAt: new Date(),
              });

              // Record span result
              recordWebhookResult(span, true, response.status);

              // Record webhook delivery success metric
              recordWebhookDelivery(tenantId, payload.eventType, true);

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

          // Update delivery record with retry status (if not last attempt)
          if (attempt < maxAttempts) {
            const nextRetryAt = calculateNextRetryTime(attempt, retryDelay);
            await updateDeliveryRecord('retrying', attempt, {
              lastError: lastError ?? null,
              responseStatus: lastStatusCode ?? null,
              responseBody: lastResponseBody ?? null,
              nextRetryAt,
            });

            // Wait before retry (exponential backoff)
            const delay = retryDelay * Math.pow(2, attempt - 1);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }

        logger.error(
          { webhookId, eventType: payload.eventType, attempts: maxAttempts, error: lastError },
          'Webhook delivery failed after all retries'
        );

        // Record failure in circuit breaker (may open the circuit)
        await this.recordDeliveryFailure(tenantId, webhookId, circuitData);

        // Update persistent delivery record with final failure
        await updateDeliveryRecord('failed', maxAttempts, {
          lastError: lastError ?? null,
          responseStatus: lastStatusCode ?? null,
          responseBody: lastResponseBody ?? null,
        });

        // Record span result
        recordWebhookResult(span, false, lastStatusCode);

        // Record webhook delivery failure metric
        recordWebhookDelivery(tenantId, payload.eventType, false);

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
    );
  }

  /**
   * Send HTTP request to webhook URL
   *
   * SSRF Protection Strategy:
   * 1. Resolve DNS and validate the IP is not private/internal
   * 2. Make HTTP request directly to the validated IP (not the hostname)
   * 3. Set Host header to original hostname for proper routing
   *
   * This prevents TOCTOU (Time-of-Check-Time-of-Use) attacks where DNS could
   * resolve to a different IP between validation and the actual fetch() call.
   *
   * Timeout is configurable via VORION_WEBHOOK_TIMEOUT_MS environment variable.
   * Default: 10000ms, Min: 1000ms, Max: 60000ms
   */
  private async sendWebhook(
    url: string,
    payload: WebhookPayload,
    secret?: string,
    storedIp?: string
  ): Promise<Response> {
    const webhookConfig = getWebhookConfig();
    const parsedUrl = new URL(url);

    // DNS Pinning: Check IP consistency unless explicitly allowed to change
    // This is the primary defense against DNS rebinding attacks
    if (!webhookConfig.allowDnsChange) {
      const ipConsistency = await validateWebhookIpConsistency(url, storedIp);
      if (!ipConsistency.valid) {
        logger.error(
          {
            url,
            reason: ipConsistency.reason,
            currentIp: ipConsistency.currentIp,
            storedIp: ipConsistency.storedIp,
          },
          'Webhook blocked: DNS rebinding attack detected. Re-register webhook to update IP.'
        );
        throw new ValidationError(
          `Webhook blocked: ${ipConsistency.reason}. Re-register webhook to update pinned IP.`,
          {
            url,
            reason: ipConsistency.reason,
            currentIp: ipConsistency.currentIp,
            storedIp: ipConsistency.storedIp,
          }
        );
      }
    }

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

    // Get the validated IP address to make the request directly to it
    // This prevents TOCTOU attacks where DNS could resolve differently
    // between our validation and the actual fetch() call
    const validatedIp = runtimeValidation.resolvedIP;

    // Build the URL with the validated IP instead of the hostname
    // Preserve the original port, path, and query string
    let targetUrl: string;
    if (validatedIp && validatedIp !== parsedUrl.hostname) {
      // Replace hostname with validated IP for the actual request
      const ipUrl = new URL(url);
      ipUrl.hostname = validatedIp;
      targetUrl = ipUrl.toString();
    } else {
      // URL already uses an IP address or no IP resolved (shouldn't happen)
      targetUrl = url;
    }

    const body = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Vorion-Webhook/1.0',
      'X-Webhook-Event': payload.eventType,
      'X-Webhook-Delivery': payload.id,
      // Set Host header to original hostname for proper routing
      // This ensures the target server routes the request correctly
      // even though we're connecting to the IP directly
      'Host': parsedUrl.host,
    };

    // Add HMAC signature if secret is configured
    // The signature includes the timestamp to prevent replay attacks
    if (secret) {
      const signature = generateSignature(body, secret, timestamp);
      headers[SIGNATURE_HEADER] = signature;
      headers[SIGNATURE_TIMESTAMP_HEADER] = String(timestamp);
    }

    // Add W3C Trace Context headers for distributed tracing
    // This propagates trace context to webhook recipients
    const traceContext = getTraceContext();
    const headersWithTrace = injectTraceToHeaders(headers, traceContext);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), webhookConfig.timeoutMs);

    try {
      logger.debug(
        { targetUrl, originalUrl: url, validatedIp, host: parsedUrl.host },
        'Sending webhook request to validated IP'
      );

      return await fetch(targetUrl, {
        method: 'POST',
        headers: headersWithTrace,
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

  // =========================================================================
  // Persistent Delivery Methods
  // =========================================================================

  /**
   * Get persistent delivery history for a webhook.
   *
   * Returns deliveries from the database (not Redis), ordered by creation time.
   *
   * @param webhookId - Webhook ID
   * @param limit - Maximum number of records (default: 50, max: 100)
   * @returns Array of delivery records
   */
  async getPersistentDeliveryHistory(
    webhookId: ID,
    limit: number = 50
  ): Promise<WebhookDelivery[]> {
    return this.getDeliveryRepository().getDeliveryHistory(webhookId, limit);
  }

  /**
   * Get a single persistent delivery record by ID.
   *
   * @param deliveryId - Delivery ID
   * @returns Delivery record or null if not found
   */
  async getPersistentDeliveryById(deliveryId: ID): Promise<WebhookDelivery | null> {
    return this.getDeliveryRepository().getDeliveryById(deliveryId);
  }

  /**
   * Replay a failed webhook delivery.
   *
   * Marks the delivery for immediate retry and processes it.
   * Only failed deliveries can be replayed.
   *
   * @param deliveryId - Delivery ID to replay
   * @param tenantId - Tenant ID (for authorization)
   * @returns Updated delivery record
   * @throws NotFoundError if delivery not found
   * @throws ValidationError if delivery is not in failed status
   */
  async replayDelivery(deliveryId: ID, tenantId: ID): Promise<WebhookDelivery> {
    const deliveryRepo = this.getDeliveryRepository();

    // Get the delivery record
    const delivery = await deliveryRepo.getDeliveryById(deliveryId);
    if (!delivery) {
      throw new NotFoundError(`Webhook delivery not found: ${deliveryId}`);
    }

    // Verify tenant authorization
    if (delivery.tenantId !== tenantId) {
      throw new NotFoundError(`Webhook delivery not found: ${deliveryId}`);
    }

    // Mark for replay (this validates status and sets nextRetryAt)
    const updatedDelivery = await deliveryRepo.markForReplay(deliveryId);

    logger.info(
      {
        deliveryId,
        webhookId: delivery.webhookId,
        tenantId,
        eventType: delivery.eventType,
      },
      'Webhook delivery queued for replay'
    );

    return updatedDelivery;
  }

  /**
   * Process pending retries.
   *
   * This method is intended to be called by a background worker/scheduler
   * to process deliveries that are in 'retrying' status and have passed
   * their nextRetryAt time.
   *
   * @param limit - Maximum number of deliveries to process (default: 100)
   * @returns Array of processing results
   */
  async processPendingRetries(
    limit: number = 100
  ): Promise<Array<{ deliveryId: ID; success: boolean; error?: string }>> {
    const deliveryRepo = this.getDeliveryRepository();
    const pendingDeliveries = await deliveryRepo.getPendingRetries(limit);
    const results: Array<{ deliveryId: ID; success: boolean; error?: string }> = [];

    for (const delivery of pendingDeliveries) {
      try {
        // Get webhook config
        const webhooks = await this.getWebhooks(delivery.tenantId);
        const webhook = webhooks.find(w => w.id === delivery.webhookId);

        if (!webhook) {
          // Webhook no longer exists - mark delivery as failed
          await deliveryRepo.updateDeliveryStatus(delivery.id, {
            status: 'failed',
            lastError: 'Webhook configuration not found',
            lastAttemptAt: new Date(),
          });
          results.push({
            deliveryId: delivery.id,
            success: false,
            error: 'Webhook configuration not found',
          });
          continue;
        }

        if (!webhook.config.enabled) {
          // Webhook disabled - mark delivery as failed
          await deliveryRepo.updateDeliveryStatus(delivery.id, {
            status: 'failed',
            lastError: 'Webhook is disabled',
            lastAttemptAt: new Date(),
          });
          results.push({
            deliveryId: delivery.id,
            success: false,
            error: 'Webhook is disabled',
          });
          continue;
        }

        // Check circuit breaker
        const { allowed, circuitData } = await this.shouldAttemptDelivery(
          delivery.tenantId,
          delivery.webhookId
        );

        if (!allowed) {
          // Circuit breaker open - calculate next retry time
          const nextRetryAt = calculateNextRetryTime(delivery.attempts + 1);
          await deliveryRepo.updateDeliveryStatus(delivery.id, {
            status: 'retrying',
            lastError: 'Circuit breaker open - delivery postponed',
            lastAttemptAt: new Date(),
            nextRetryAt,
          });
          results.push({
            deliveryId: delivery.id,
            success: false,
            error: 'Circuit breaker open',
          });
          continue;
        }

        // Attempt delivery
        const payload = delivery.payload as unknown as WebhookPayload;
        const result = await this.deliverWithRetry(
          delivery.webhookId,
          webhook.config,
          payload,
          delivery.tenantId,
          circuitData,
          delivery.id
        );

        const resultEntry: { deliveryId: ID; success: boolean; error?: string } = {
          deliveryId: delivery.id,
          success: result.success,
        };
        if (result.error) {
          resultEntry.error = result.error;
        }
        results.push(resultEntry);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(
          { deliveryId: delivery.id, error: errorMessage },
          'Error processing pending retry'
        );
        results.push({
          deliveryId: delivery.id,
          success: false,
          error: errorMessage,
        });
      }
    }

    if (results.length > 0) {
      const successCount = results.filter(r => r.success).length;
      logger.info(
        { total: results.length, success: successCount, failed: results.length - successCount },
        'Processed pending webhook retries'
      );
    }

    return results;
  }

  /**
   * Get failed deliveries for a tenant.
   *
   * @param tenantId - Tenant ID
   * @param limit - Maximum number of records (default: 50, max: 100)
   * @returns Array of failed delivery records
   */
  async getFailedDeliveries(tenantId: ID, limit: number = 50): Promise<WebhookDelivery[]> {
    return this.getDeliveryRepository().getFailedDeliveries(tenantId, limit);
  }
}

/**
 * Create webhook service instance
 */
export function createWebhookService(): WebhookService {
  return new WebhookService();
}

// =============================================================================
// Webhook Delivery Persistence Types
// =============================================================================

/**
 * Webhook delivery status
 */
export type WebhookDeliveryStatus = 'pending' | 'delivered' | 'failed' | 'retrying';

/**
 * Webhook delivery record - represents a persistent delivery attempt
 */
export interface WebhookDelivery {
  id: ID;
  webhookId: ID;
  tenantId: ID;
  eventType: string;
  payload: Record<string, unknown>;
  status: WebhookDeliveryStatus;
  attempts: number;
  lastAttemptAt: string | null;
  lastError: string | null;
  nextRetryAt: string | null;
  deliveredAt: string | null;
  responseStatus: number | null;
  responseBody: string | null;
  createdAt: string;
}

/**
 * Options for creating a new delivery record
 */
export interface CreateDeliveryOptions {
  webhookId: ID;
  tenantId: ID;
  eventType: string;
  payload: Record<string, unknown>;
}

/**
 * Options for updating delivery status
 */
export interface UpdateDeliveryStatusOptions {
  status: WebhookDeliveryStatus;
  attempts?: number;
  lastAttemptAt?: Date;
  lastError?: string | null;
  nextRetryAt?: Date | null;
  deliveredAt?: Date | null;
  responseStatus?: number | null;
  responseBody?: string | null;
}

/**
 * Default page size for delivery history queries
 */
const DEFAULT_DELIVERY_PAGE_SIZE = 50;

/**
 * Maximum page size for delivery history queries
 */
const MAX_DELIVERY_PAGE_SIZE = 100;

/**
 * Map database row to WebhookDelivery
 */
function mapDeliveryRow(row: WebhookDeliveryRow): WebhookDelivery {
  return {
    id: row.id,
    webhookId: row.webhookId,
    tenantId: row.tenantId,
    eventType: row.eventType,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    status: row.status as WebhookDeliveryStatus,
    attempts: row.attempts,
    lastAttemptAt: row.lastAttemptAt?.toISOString() ?? null,
    lastError: row.lastError ?? null,
    nextRetryAt: row.nextRetryAt?.toISOString() ?? null,
    deliveredAt: row.deliveredAt?.toISOString() ?? null,
    responseStatus: row.responseStatus ?? null,
    responseBody: row.responseBody ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Calculate next retry time with exponential backoff.
 *
 * Uses the formula: baseDelay * 2^(attempt - 1)
 * With a maximum delay cap to prevent extremely long waits.
 *
 * @param attempt - Current attempt number (1-based)
 * @param baseDelayMs - Base delay in milliseconds (default: 1000)
 * @param maxDelayMs - Maximum delay cap in milliseconds (default: 1 hour)
 * @returns Date when next retry should occur
 */
export function calculateNextRetryTime(
  attempt: number,
  baseDelayMs: number = 1000,
  maxDelayMs: number = 3600000 // 1 hour
): Date {
  const delayMs = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
  return new Date(Date.now() + delayMs);
}

// =============================================================================
// Webhook Delivery Repository
// =============================================================================

/**
 * Repository for managing webhook delivery persistence.
 *
 * Provides CRUD operations for webhook delivery records, supporting:
 * - Creation of delivery records before attempting delivery
 * - Status updates on success/failure
 * - Retrieval of delivery history for auditing
 * - Fetching pending retries for background processing
 * - Fetching failed deliveries for monitoring/debugging
 */
export class WebhookDeliveryRepository {
  private _db: ReturnType<typeof getDatabase> | null = null;

  /**
   * Get database instance (lazy initialization).
   */
  private get db(): ReturnType<typeof getDatabase> {
    if (!this._db) {
      this._db = getDatabase();
    }
    return this._db;
  }

  /**
   * Create a new delivery record.
   *
   * Call this before attempting webhook delivery to ensure
   * the delivery is tracked even if the process crashes.
   *
   * @param data - Delivery creation options
   * @returns Created delivery record
   */
  async createDelivery(data: CreateDeliveryOptions): Promise<WebhookDelivery> {
    const insertData: NewWebhookDeliveryRow = {
      webhookId: data.webhookId,
      tenantId: data.tenantId,
      eventType: data.eventType,
      payload: data.payload,
      status: 'pending',
      attempts: 0,
    };

    const [row] = await this.db
      .insert(webhookDeliveries)
      .values(insertData)
      .returning();

    if (!row) {
      throw new Error('Failed to create webhook delivery record');
    }

    logger.info(
      { deliveryId: row.id, webhookId: data.webhookId, tenantId: data.tenantId, eventType: data.eventType },
      'Created webhook delivery record'
    );

    return mapDeliveryRow(row);
  }

  /**
   * Update delivery status with details.
   *
   * @param id - Delivery ID
   * @param options - Status update options
   * @returns Updated delivery record
   * @throws NotFoundError if delivery not found
   */
  async updateDeliveryStatus(
    id: ID,
    options: UpdateDeliveryStatusOptions
  ): Promise<WebhookDelivery> {
    const updateData: Partial<WebhookDeliveryRow> = {
      status: options.status,
    };

    if (options.attempts !== undefined) {
      updateData.attempts = options.attempts;
    }
    if (options.lastAttemptAt !== undefined) {
      updateData.lastAttemptAt = options.lastAttemptAt;
    }
    if (options.lastError !== undefined) {
      updateData.lastError = options.lastError;
    }
    if (options.nextRetryAt !== undefined) {
      updateData.nextRetryAt = options.nextRetryAt;
    }
    if (options.deliveredAt !== undefined) {
      updateData.deliveredAt = options.deliveredAt;
    }
    if (options.responseStatus !== undefined) {
      updateData.responseStatus = options.responseStatus;
    }
    if (options.responseBody !== undefined) {
      updateData.responseBody = options.responseBody;
    }

    const [row] = await this.db
      .update(webhookDeliveries)
      .set(updateData)
      .where(eq(webhookDeliveries.id, id))
      .returning();

    if (!row) {
      throw new NotFoundError(`Webhook delivery not found: ${id}`);
    }

    logger.debug(
      { deliveryId: id, status: options.status, attempts: options.attempts },
      'Updated webhook delivery status'
    );

    return mapDeliveryRow(row);
  }

  /**
   * Get delivery by ID.
   *
   * @param id - Delivery ID
   * @returns Delivery record or null if not found
   */
  async getDeliveryById(id: ID): Promise<WebhookDelivery | null> {
    const [row] = await this.db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.id, id));

    return row ? mapDeliveryRow(row) : null;
  }

  /**
   * Get delivery history for a webhook.
   *
   * Returns deliveries ordered by creation time (most recent first).
   *
   * @param webhookId - Webhook ID
   * @param limit - Maximum number of records to return (default: 50, max: 100)
   * @returns Array of delivery records
   */
  async getDeliveryHistory(
    webhookId: ID,
    limit: number = DEFAULT_DELIVERY_PAGE_SIZE
  ): Promise<WebhookDelivery[]> {
    const effectiveLimit = Math.min(limit, MAX_DELIVERY_PAGE_SIZE);

    const rows = await this.db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.webhookId, webhookId))
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(effectiveLimit);

    return rows.map(mapDeliveryRow);
  }

  /**
   * Get pending retries that are due for processing.
   *
   * Returns deliveries with status='retrying' and nextRetryAt <= now.
   *
   * @param limit - Maximum number of records to return (default: 100)
   * @returns Array of delivery records ready for retry
   */
  async getPendingRetries(limit: number = 100): Promise<WebhookDelivery[]> {
    const now = new Date();

    const rows = await this.db
      .select()
      .from(webhookDeliveries)
      .where(
        and(
          eq(webhookDeliveries.status, 'retrying'),
          lte(webhookDeliveries.nextRetryAt, now)
        )
      )
      .orderBy(webhookDeliveries.nextRetryAt)
      .limit(limit);

    return rows.map(mapDeliveryRow);
  }

  /**
   * Get failed deliveries for a tenant.
   *
   * Returns deliveries with status='failed' for monitoring and debugging.
   *
   * @param tenantId - Tenant ID
   * @param limit - Maximum number of records to return (default: 50, max: 100)
   * @returns Array of failed delivery records
   */
  async getFailedDeliveries(
    tenantId: ID,
    limit: number = DEFAULT_DELIVERY_PAGE_SIZE
  ): Promise<WebhookDelivery[]> {
    const effectiveLimit = Math.min(limit, MAX_DELIVERY_PAGE_SIZE);

    const rows = await this.db
      .select()
      .from(webhookDeliveries)
      .where(
        and(
          eq(webhookDeliveries.tenantId, tenantId),
          eq(webhookDeliveries.status, 'failed')
        )
      )
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(effectiveLimit);

    return rows.map(mapDeliveryRow);
  }

  /**
   * Get deliveries by tenant with pagination.
   *
   * @param tenantId - Tenant ID
   * @param options - Pagination options
   * @returns Paginated array of delivery records
   */
  async getDeliveriesByTenant(
    tenantId: ID,
    options: {
      limit?: number;
      offset?: number;
      status?: WebhookDeliveryStatus;
    } = {}
  ): Promise<{ items: WebhookDelivery[]; hasMore: boolean }> {
    const limit = Math.min(options.limit ?? DEFAULT_DELIVERY_PAGE_SIZE, MAX_DELIVERY_PAGE_SIZE);
    const offset = options.offset ?? 0;

    const whereConditions = [eq(webhookDeliveries.tenantId, tenantId)];
    if (options.status) {
      whereConditions.push(eq(webhookDeliveries.status, options.status));
    }

    const rows = await this.db
      .select()
      .from(webhookDeliveries)
      .where(and(...whereConditions))
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(limit + 1)
      .offset(offset);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    return {
      items: items.map(mapDeliveryRow),
      hasMore,
    };
  }

  /**
   * Mark a delivery for immediate replay.
   *
   * Resets the delivery status to 'retrying' with nextRetryAt set to now.
   * Does not reset attempt count to preserve audit history.
   *
   * @param id - Delivery ID
   * @returns Updated delivery record
   * @throws NotFoundError if delivery not found
   */
  async markForReplay(id: ID): Promise<WebhookDelivery> {
    const delivery = await this.getDeliveryById(id);
    if (!delivery) {
      throw new NotFoundError(`Webhook delivery not found: ${id}`);
    }

    // Only allow replay of failed deliveries
    if (delivery.status !== 'failed') {
      throw new ValidationError(
        `Cannot replay delivery with status '${delivery.status}'. Only failed deliveries can be replayed.`,
        { deliveryId: id, currentStatus: delivery.status }
      );
    }

    const updatedDelivery = await this.updateDeliveryStatus(id, {
      status: 'retrying',
      nextRetryAt: new Date(), // Immediate retry
      lastError: null, // Clear last error for retry
    });

    logger.info(
      { deliveryId: id, webhookId: delivery.webhookId, tenantId: delivery.tenantId },
      'Marked webhook delivery for replay'
    );

    return updatedDelivery;
  }

  /**
   * Clean up old delivery records.
   *
   * Deletes deliveries older than the specified retention period.
   * Typically called by a scheduled cleanup job.
   *
   * @param retentionDays - Number of days to retain records
   * @returns Number of records deleted
   */
  async cleanupOldDeliveries(retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.db
      .delete(webhookDeliveries)
      .where(lt(webhookDeliveries.createdAt, cutoffDate))
      .returning({ id: webhookDeliveries.id });

    const deletedCount = result.length;

    if (deletedCount > 0) {
      logger.info(
        { deletedCount, retentionDays, cutoffDate: cutoffDate.toISOString() },
        'Cleaned up old webhook delivery records'
      );
    }

    return deletedCount;
  }
}

/**
 * Create webhook delivery repository instance
 */
export function createWebhookDeliveryRepository(): WebhookDeliveryRepository {
  return new WebhookDeliveryRepository();
}
