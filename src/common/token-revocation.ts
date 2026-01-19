/**
 * JWT Token Revocation Service
 *
 * Uses Redis to maintain a blacklist of revoked tokens.
 * Tokens are stored with TTL matching their expiration time.
 *
 * @packageDocumentation
 */

import { getRedis } from './redis.js';
import { createLogger } from './logger.js';
import { getConfig } from './config.js';
import { tokensRevokedTotal } from '../intent/metrics.js';
import { createAuditService } from '../audit/service.js';

const logger = createLogger({ component: 'token-revocation' });

const REVOKED_TOKEN_PREFIX = 'token:revoked:';
const USER_REVOCATION_PREFIX = 'token:user-revocation:';

export interface TokenRevocationService {
  revokeToken(jti: string, expiresAt: Date): Promise<void>;
  isRevoked(jti: string): Promise<boolean>;
  revokeAllForUser(userId: string, issuedBefore: Date): Promise<void>;
  isUserTokenRevoked(userId: string, issuedAt: Date): Promise<boolean>;
}

/**
 * Revoke a single token by its JTI (JWT ID)
 *
 * @param jti - The JWT ID claim from the token
 * @param expiresAt - When the token expires (used for TTL)
 */
async function revokeToken(jti: string, expiresAt: Date): Promise<void> {
  const redis = getRedis();

  // Calculate TTL in seconds (time until token expires naturally)
  const ttlMs = expiresAt.getTime() - Date.now();

  // Don't store if token is already expired
  if (ttlMs <= 0) {
    logger.debug({ jti }, 'Token already expired, skipping revocation storage');
    return;
  }

  const ttlSeconds = Math.ceil(ttlMs / 1000);
  const key = `${REVOKED_TOKEN_PREFIX}${jti}`;

  // Store with automatic expiration
  await redis.setex(key, ttlSeconds, '1');

  // Increment metrics
  tokensRevokedTotal.inc({ type: 'single' });

  logger.info(
    { jti, ttlSeconds },
    'Token revoked'
  );
}

/**
 * Check if a token has been revoked
 *
 * @param jti - The JWT ID claim from the token
 * @returns true if the token is revoked, false otherwise
 */
async function isRevoked(jti: string): Promise<boolean> {
  const redis = getRedis();
  const key = `${REVOKED_TOKEN_PREFIX}${jti}`;

  const result = await redis.exists(key);
  return result === 1;
}

/**
 * Revoke all tokens for a user issued before a specific time
 *
 * This is useful for security incidents where all sessions need to be terminated.
 * Instead of tracking every token, we store a timestamp and check against it.
 *
 * @param userId - The user ID (sub claim)
 * @param issuedBefore - Revoke all tokens issued before this time
 */
async function revokeAllForUser(userId: string, issuedBefore: Date): Promise<void> {
  const redis = getRedis();
  const config = getConfig();

  const key = `${USER_REVOCATION_PREFIX}${userId}`;
  const timestamp = issuedBefore.getTime().toString();

  // Store with TTL equal to max token lifetime (refresh token expiration)
  // This ensures the revocation record exists until all affected tokens expire
  const ttlSeconds = parseExpirationToSeconds(config.jwt.refreshExpiration);

  await redis.setex(key, ttlSeconds, timestamp);

  // Increment metrics
  tokensRevokedTotal.inc({ type: 'user_all' });

  logger.info(
    { userId, issuedBefore: issuedBefore.toISOString(), ttlSeconds },
    'All user tokens revoked'
  );
}

/**
 * Check if a user's token was issued before a revocation timestamp
 *
 * @param userId - The user ID (sub claim)
 * @param issuedAt - When the token was issued (iat claim)
 * @returns true if the token should be considered revoked
 */
async function isUserTokenRevoked(userId: string, issuedAt: Date): Promise<boolean> {
  const redis = getRedis();
  const key = `${USER_REVOCATION_PREFIX}${userId}`;

  const revocationTimestamp = await redis.get(key);

  if (!revocationTimestamp) {
    return false;
  }

  const revocationTime = parseInt(revocationTimestamp, 10);
  return issuedAt.getTime() < revocationTime;
}

/**
 * Parse JWT expiration string to seconds
 * Supports formats like "1h", "7d", "30m", "3600"
 */
function parseExpirationToSeconds(expiration: string): number {
  const match = expiration.match(/^(\d+)([smhd])?$/);

  if (!match) {
    // Default to 7 days if parsing fails
    logger.warn({ expiration }, 'Could not parse expiration, defaulting to 7 days');
    return 7 * 24 * 60 * 60;
  }

  const value = parseInt(match[1] ?? '0', 10);
  const unit = match[2] ?? 's';

  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 60 * 60;
    case 'd':
      return value * 24 * 60 * 60;
    default:
      return value;
  }
}

/**
 * Create a token revocation service instance
 */
export function createTokenRevocationService(): TokenRevocationService {
  return {
    revokeToken,
    isRevoked,
    revokeAllForUser,
    isUserTokenRevoked,
  };
}

/**
 * Validate that a token has a JTI claim
 * Returns the jti if valid, or handles missing jti based on environment
 */
export function validateJti(
  payload: { jti?: string },
  config: { env: string; jwt: { requireJti: boolean } }
): { valid: boolean; jti?: string; error?: string } {
  if (payload.jti) {
    return { valid: true, jti: payload.jti };
  }

  // In production with requireJti enabled, reject tokens without jti
  if (config.jwt.requireJti && config.env === 'production') {
    logger.warn('Token missing jti claim in production with requireJti enabled');
    return { valid: false, error: 'Token missing required jti claim' };
  }

  // In development or with requireJti disabled, log warning but allow
  logger.warn('Token missing jti claim, skipping revocation check');
  return { valid: true };
}

/**
 * Record a token revocation audit event
 */
export async function recordTokenRevocationAudit(
  tenantId: string,
  userId: string,
  eventType: 'token.revoked' | 'token.user_all_revoked',
  actor: { type: 'user' | 'service' | 'system'; id: string; name?: string; ip?: string },
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const auditService = createAuditService();
    const auditInput: Parameters<typeof auditService.record>[0] = {
      tenantId,
      eventType,
      actor,
      target: { type: 'user', id: userId },
      action: eventType === 'token.revoked' ? 'revoke_token' : 'revoke_all_tokens',
      outcome: 'success',
    };
    if (metadata) {
      auditInput.metadata = metadata;
    }
    await auditService.record(auditInput);
  } catch (error) {
    // Don't fail the revocation if audit logging fails
    logger.error({ error, eventType, userId }, 'Failed to record token revocation audit');
  }
}
