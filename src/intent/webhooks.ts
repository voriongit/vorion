/**
 * INTENT Webhook Notifications
 *
 * Outbound webhook notifications for escalation events.
 * Supports configurable URLs per tenant with retry logic.
 * Includes SSRF protection to prevent internal network access.
 */

import { randomUUID, createHmac, timingSafeEqual } from 'node:crypto';
import { getConfig } from '../common/config.js';
import { createLogger } from '../common/logger.js';
import { getRedis } from '../common/redis.js';
import type { ID } from '../common/types.js';
import { ValidationError } from '../common/errors.js';
import { encrypt, decrypt, type EncryptedEnvelope } from '../common/encryption.js';
import type { EscalationRecord } from './escalation.js';
import {
  webhookCircuitBreakerState,
  webhookCircuitBreakerTripsTotal,
  webhookDeliveriesSkippedTotal,
  webhookCircuitBreakerTransitions,
  recordWebhookDelivery,
} from './metrics.js';
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
 */
export class WebhookService {
  private redis = getRedis();
  private readonly keyPrefix = 'webhook:';
  private readonly circuitKeyPrefix = 'webhook:circuit:';

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
   * Deliver webhooks to all registered endpoints for a tenant
   * Includes circuit breaker check to skip consistently failing webhooks
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
        results.push(skippedResult);
        await this.storeDeliveryResult(tenantId, webhookId, payload.id, skippedResult);
        continue;
      }

      // Attempt delivery with retry logic
      const result = await this.deliverWithRetry(webhookId, config, payload, tenantId, circuitData);
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
   * Updates circuit breaker state based on delivery success/failure.
   */
  private async deliverWithRetry(
    webhookId: string,
    config: WebhookConfig,
    payload: WebhookPayload,
    tenantId: ID,
    circuitData: CircuitBreakerData
  ): Promise<WebhookDeliveryResult> {
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

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            const response = await this.sendWebhook(config.url, payload, config.secret, config.resolvedIp);
            lastStatusCode = response.status;

            if (response.ok) {
              logger.info(
                { webhookId, eventType: payload.eventType, attempt },
                'Webhook delivered successfully'
              );

              // Record success in circuit breaker (may close the circuit)
              await this.recordDeliverySuccess(tenantId, webhookId, circuitData);

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

        // Record failure in circuit breaker (may open the circuit)
        await this.recordDeliveryFailure(tenantId, webhookId, circuitData);

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
   * Performs DNS pinning check to detect DNS rebinding attacks.
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

    const body = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Vorion-Webhook/1.0',
      'X-Webhook-Event': payload.eventType,
      'X-Webhook-Delivery': payload.id,
    };

    // Add HMAC signature if secret is configured
    // The signature includes the timestamp to prevent replay attacks
    if (secret) {
      const signature = generateSignature(body, secret, timestamp);
      headers[SIGNATURE_HEADER] = signature;
      headers[SIGNATURE_TIMESTAMP_HEADER] = String(timestamp);
    }

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
