/**
 * Token Lifetime Enforcement Service
 *
 * Implements token lifetime constraints for ACI security hardening.
 * Enforces maximum TTLs for different token types and triggers proactive
 * refresh when tokens approach expiration.
 *
 * Default TTLs per ACI spec:
 * - Access tokens: 300 seconds (5 minutes)
 * - Refresh tokens: 86400 seconds (24 hours)
 * - ID tokens: 300 seconds (5 minutes)
 * - High-value operations: 60 seconds (1 minute)
 *
 * @packageDocumentation
 */

import { createLogger } from '../common/logger.js';
import { VorionError } from '../common/errors.js';
import { Counter, Histogram } from 'prom-client';
import { intentRegistry } from '../intent/metrics.js';
import {
  type TokenLifetimeConfig,
  type ActionRequest,
  type TrustTier,
  DEFAULT_TOKEN_LIFETIME_CONFIG,
  tokenLifetimeConfigSchema,
} from './types.js';

const logger = createLogger({ component: 'security-token-lifetime' });

// =============================================================================
// Metrics
// =============================================================================

const tokenLifetimeValidations = new Counter({
  name: 'vorion_security_token_lifetime_validations_total',
  help: 'Total token lifetime validations',
  labelNames: ['type', 'result'] as const, // type: access/refresh/id, result: valid/expired/too_long
  registers: [intentRegistry],
});

const tokenTTLRemaining = new Histogram({
  name: 'vorion_security_token_ttl_remaining_seconds',
  help: 'Distribution of remaining TTL when tokens are validated',
  labelNames: ['type'] as const,
  buckets: [0, 10, 30, 60, 120, 300, 600, 1800, 3600],
  registers: [intentRegistry],
});

const tokenRefreshRecommendations = new Counter({
  name: 'vorion_security_token_refresh_recommendations_total',
  help: 'Total times token refresh was recommended',
  labelNames: ['type'] as const,
  registers: [intentRegistry],
});

const introspectionRequirements = new Counter({
  name: 'vorion_security_introspection_requirements_total',
  help: 'Total times introspection was required for operations',
  labelNames: ['operation_type', 'tier'] as const,
  registers: [intentRegistry],
});

// =============================================================================
// Errors
// =============================================================================

/**
 * Token lifetime error
 */
export class TokenLifetimeError extends VorionError {
  override code = 'TOKEN_LIFETIME_ERROR';
  override statusCode = 401;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details);
    this.name = 'TokenLifetimeError';
  }
}

/**
 * Token expired error
 */
export class TokenExpiredError extends TokenLifetimeError {
  override code = 'TOKEN_EXPIRED';

  constructor(tokenType: string, expiresAt: Date) {
    super(`${tokenType} token has expired`, { tokenType, expiresAt: expiresAt.toISOString() });
    this.name = 'TokenExpiredError';
  }
}

/**
 * Token TTL too long error
 */
export class TokenTTLTooLongError extends TokenLifetimeError {
  override code = 'TOKEN_TTL_TOO_LONG';

  constructor(tokenType: string, actualTTL: number, maxTTL: number) {
    super(`${tokenType} token TTL exceeds maximum allowed`, {
      tokenType,
      actualTTL,
      maxTTL,
    });
    this.name = 'TokenTTLTooLongError';
  }
}

// =============================================================================
// Types
// =============================================================================

/**
 * Token type enumeration
 */
export type TokenType = 'access' | 'refresh' | 'id';

/**
 * JWT payload with standard claims
 */
export interface JWTPayload {
  /** Subject identifier */
  sub?: string;
  /** Issuer */
  iss?: string;
  /** Audience */
  aud?: string | string[];
  /** Expiration time (Unix timestamp) */
  exp?: number;
  /** Issued at (Unix timestamp) */
  iat?: number;
  /** Not before (Unix timestamp) */
  nbf?: number;
  /** JWT ID */
  jti?: string;
  /** Additional claims */
  [key: string]: unknown;
}

/**
 * Token lifetime validation result
 */
export interface TokenLifetimeValidationResult {
  /** Whether the token lifetime is valid */
  valid: boolean;
  /** Remaining TTL in seconds */
  remainingTTL: number;
  /** Whether refresh is recommended */
  shouldRefresh: boolean;
  /** Error message if invalid */
  error?: string;
  /** Error code */
  errorCode?: 'EXPIRED' | 'TTL_TOO_LONG' | 'MISSING_EXP' | 'MISSING_IAT';
}

/**
 * High-value operation types that require shorter token TTL
 */
export const HIGH_VALUE_OPERATIONS = [
  'financial_transaction',
  'pii_access',
  'external_api_call',
  'data_export',
  'privilege_escalation',
  'delegation_creation',
  'admin_action',
  'security_config_change',
] as const;

export type HighValueOperation = (typeof HIGH_VALUE_OPERATIONS)[number];

// =============================================================================
// Token Lifetime Service
// =============================================================================

/**
 * Token Lifetime Service for enforcing token TTL constraints
 *
 * @example
 * ```typescript
 * const tokenLifetime = new TokenLifetimeService({
 *   accessTokenMaxTTL: 300, // 5 minutes
 *   refreshTokenMaxTTL: 86400, // 24 hours
 *   idTokenMaxTTL: 300, // 5 minutes
 *   highValueOperationTTL: 60, // 1 minute
 *   refreshThreshold: 0.2, // Refresh when 20% TTL remaining
 * });
 *
 * // Validate token lifetime
 * const valid = tokenLifetime.validateLifetime(tokenPayload, 'access');
 *
 * // Check if refresh needed
 * const shouldRefresh = tokenLifetime.shouldRefresh(tokenPayload);
 *
 * // Check if introspection required
 * const needsIntrospection = tokenLifetime.requiresIntrospection(request, tier);
 * ```
 */
export class TokenLifetimeService {
  private config: TokenLifetimeConfig;

  /**
   * Create a new token lifetime service
   *
   * @param config - Token lifetime configuration
   */
  constructor(config: Partial<TokenLifetimeConfig> = {}) {
    const parsed = tokenLifetimeConfigSchema.parse({
      ...DEFAULT_TOKEN_LIFETIME_CONFIG,
      ...config,
    });
    this.config = { ...DEFAULT_TOKEN_LIFETIME_CONFIG, ...parsed };

    logger.info(
      {
        accessTokenMaxTTL: this.config.accessTokenMaxTTL,
        refreshTokenMaxTTL: this.config.refreshTokenMaxTTL,
        highValueOperationTTL: this.config.highValueOperationTTL,
        refreshThreshold: this.config.refreshThreshold,
      },
      'Token lifetime service initialized'
    );
  }

  /**
   * Get maximum TTL for a token type
   *
   * @param tokenType - Type of token
   * @param isHighValue - Whether this is for a high-value operation
   * @returns Maximum TTL in seconds
   */
  getMaxTTL(tokenType: TokenType, isHighValue: boolean = false): number {
    // High-value operations always use the shortest TTL
    if (isHighValue && tokenType === 'access') {
      return this.config.highValueOperationTTL;
    }

    switch (tokenType) {
      case 'access':
        return this.config.accessTokenMaxTTL;
      case 'refresh':
        return this.config.refreshTokenMaxTTL;
      case 'id':
        return this.config.idTokenMaxTTL;
      default:
        return this.config.accessTokenMaxTTL;
    }
  }

  /**
   * Validate token lifetime
   *
   * Checks that:
   * 1. Token has required exp and iat claims
   * 2. Token is not expired
   * 3. Token TTL does not exceed maximum allowed
   *
   * @param token - JWT payload
   * @param tokenType - Type of token
   * @param isHighValue - Whether this is for a high-value operation
   * @returns Validation result
   */
  validateLifetime(
    token: JWTPayload,
    tokenType: TokenType,
    isHighValue: boolean = false
  ): TokenLifetimeValidationResult {
    // Check for required claims
    if (token.exp === undefined) {
      tokenLifetimeValidations.inc({ type: tokenType, result: 'missing_exp' });
      return {
        valid: false,
        remainingTTL: 0,
        shouldRefresh: false,
        error: 'Token missing exp claim',
        errorCode: 'MISSING_EXP',
      };
    }

    if (token.iat === undefined) {
      tokenLifetimeValidations.inc({ type: tokenType, result: 'missing_iat' });
      return {
        valid: false,
        remainingTTL: 0,
        shouldRefresh: false,
        error: 'Token missing iat claim',
        errorCode: 'MISSING_IAT',
      };
    }

    const now = Math.floor(Date.now() / 1000);
    const remainingTTL = token.exp - now;
    const totalTTL = token.exp - token.iat;
    const maxTTL = this.getMaxTTL(tokenType, isHighValue);

    // Record TTL metric
    tokenTTLRemaining.observe({ type: tokenType }, Math.max(0, remainingTTL));

    // Check if expired
    if (remainingTTL <= 0) {
      tokenLifetimeValidations.inc({ type: tokenType, result: 'expired' });
      return {
        valid: false,
        remainingTTL: 0,
        shouldRefresh: false,
        error: 'Token has expired',
        errorCode: 'EXPIRED',
      };
    }

    // Check if TTL exceeds maximum
    if (totalTTL > maxTTL) {
      tokenLifetimeValidations.inc({ type: tokenType, result: 'too_long' });
      logger.warn(
        { tokenType, totalTTL, maxTTL, jti: token.jti },
        'Token TTL exceeds maximum allowed'
      );
      return {
        valid: false,
        remainingTTL,
        shouldRefresh: true,
        error: `Token TTL (${totalTTL}s) exceeds maximum (${maxTTL}s)`,
        errorCode: 'TTL_TOO_LONG',
      };
    }

    // Check if refresh should be recommended
    const refreshThreshold = totalTTL * this.config.refreshThreshold;
    const shouldRefresh = remainingTTL <= refreshThreshold;

    if (shouldRefresh) {
      tokenRefreshRecommendations.inc({ type: tokenType });
    }

    tokenLifetimeValidations.inc({ type: tokenType, result: 'valid' });

    return {
      valid: true,
      remainingTTL,
      shouldRefresh,
    };
  }

  /**
   * Check if token should be refreshed
   *
   * Returns true if remaining TTL is below the refresh threshold.
   *
   * @param token - JWT payload
   * @returns Whether token should be refreshed
   */
  shouldRefresh(token: JWTPayload): boolean {
    if (token.exp === undefined || token.iat === undefined) {
      return true; // Refresh tokens with missing claims
    }

    const now = Math.floor(Date.now() / 1000);
    const remainingTTL = token.exp - now;
    const totalTTL = token.exp - token.iat;
    const refreshThreshold = totalTTL * this.config.refreshThreshold;

    return remainingTTL <= refreshThreshold;
  }

  /**
   * Check if introspection is required for an operation
   *
   * Introspection is required for:
   * - High-value operations (L3+)
   * - Operations from T4+ trust tiers
   * - Operations accessing sensitive data
   *
   * @param operation - Action request
   * @param tier - Trust tier
   * @returns Whether introspection is required
   */
  requiresIntrospection(operation: ActionRequest, tier: TrustTier): boolean {
    // T4+ always requires introspection
    if (tier >= 4) {
      introspectionRequirements.inc({ operation_type: operation.actionType, tier: tier.toString() });
      return true;
    }

    // High-value operations for T2+ require introspection
    if (tier >= 2 && this.isHighValueOperation(operation)) {
      introspectionRequirements.inc({ operation_type: operation.actionType, tier: tier.toString() });
      return true;
    }

    // L3+ operations require introspection
    if (operation.actionLevel >= 3) {
      introspectionRequirements.inc({ operation_type: operation.actionType, tier: tier.toString() });
      return true;
    }

    return false;
  }

  /**
   * Check if an operation is high-value
   *
   * @param operation - Action request
   * @returns Whether operation is high-value
   */
  isHighValueOperation(operation: ActionRequest): boolean {
    // Check explicit flag
    if (operation.isHighValue) {
      return true;
    }

    // Check operation type
    const actionType = operation.actionType.toLowerCase();
    for (const highValue of HIGH_VALUE_OPERATIONS) {
      if (actionType.includes(highValue) || actionType === highValue) {
        return true;
      }
    }

    // Check action level
    if (operation.actionLevel >= 3) {
      return true;
    }

    return false;
  }

  /**
   * Get remaining TTL for a token
   *
   * @param token - JWT payload
   * @returns Remaining TTL in seconds (0 if expired or invalid)
   */
  getRemainingTTL(token: JWTPayload): number {
    if (token.exp === undefined) {
      return 0;
    }

    const now = Math.floor(Date.now() / 1000);
    return Math.max(0, token.exp - now);
  }

  /**
   * Check if a token is expired
   *
   * @param token - JWT payload
   * @returns Whether token is expired
   */
  isExpired(token: JWTPayload): boolean {
    if (token.exp === undefined) {
      return true; // Treat tokens without exp as expired
    }

    const now = Math.floor(Date.now() / 1000);
    return token.exp <= now;
  }

  /**
   * Calculate when a token should be refreshed
   *
   * @param token - JWT payload
   * @returns Timestamp when refresh should occur (null if already should refresh)
   */
  getRefreshTime(token: JWTPayload): Date | null {
    if (token.exp === undefined || token.iat === undefined) {
      return null;
    }

    const totalTTL = token.exp - token.iat;
    const refreshThreshold = totalTTL * this.config.refreshThreshold;
    const refreshTime = token.exp - refreshThreshold;
    const now = Math.floor(Date.now() / 1000);

    if (refreshTime <= now) {
      return null; // Should already refresh
    }

    return new Date(refreshTime * 1000);
  }

  /**
   * Validate token for high-value operation
   *
   * Enforces stricter TTL requirements for high-value operations.
   *
   * @param token - JWT payload
   * @returns Whether token is valid for high-value operation
   */
  validateForHighValueOperation(token: JWTPayload): TokenLifetimeValidationResult {
    return this.validateLifetime(token, 'access', true);
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<TokenLifetimeConfig> {
    return { ...this.config };
  }
}

/**
 * Create a token lifetime service with default configuration for ACI
 */
export function createTokenLifetimeService(
  config?: Partial<TokenLifetimeConfig>
): TokenLifetimeService {
  return new TokenLifetimeService(config);
}
