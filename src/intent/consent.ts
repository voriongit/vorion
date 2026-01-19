/**
 * Consent Management Service
 *
 * Provides GDPR/SOC2 compliant consent management for the INTENT module.
 * Handles user consent lifecycle including granting, revoking, validation,
 * and audit trail generation.
 *
 * @packageDocumentation
 */

import { and, desc, eq, isNull, or } from 'drizzle-orm';
import { createLogger } from '../common/logger.js';
import { getDatabase } from '../common/db.js';
import {
  withCircuitBreaker,
  CircuitBreakerOpenError,
} from '../common/circuit-breaker.js';
import type { ID } from '../common/types.js';
import {
  userConsents,
  consentPolicies,
  type UserConsentRow,
  type ConsentPolicyRow,
  type NewUserConsentRow,
} from './schema.js';

// Re-export CircuitBreakerOpenError for consumers
export { CircuitBreakerOpenError };

const logger = createLogger({ component: 'consent-service' });

// =============================================================================
// TYPES
// =============================================================================

/**
 * Supported consent types for data processing
 */
export type ConsentType = 'data_processing' | 'analytics' | 'marketing';

/**
 * Metadata captured when consent is granted or revoked
 */
export interface ConsentMetadata {
  ipAddress?: string;
  userAgent?: string;
}

/**
 * User consent record (mapped from database row)
 */
export interface UserConsent {
  id: ID;
  userId: ID;
  tenantId: ID;
  consentType: ConsentType;
  granted: boolean;
  grantedAt: string | null;
  revokedAt: string | null;
  version: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Consent policy version record
 */
export interface ConsentPolicy {
  id: ID;
  tenantId: ID;
  consentType: ConsentType;
  version: string;
  content: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
}

/**
 * Consent history entry for audit trail
 */
export interface ConsentHistoryEntry {
  id: ID;
  consentType: ConsentType;
  action: 'granted' | 'revoked';
  version: string;
  timestamp: string;
  ipAddress: string | null;
  userAgent: string | null;
}

/**
 * Result of consent validation
 */
export interface ConsentValidationResult {
  valid: boolean;
  consentType: ConsentType;
  grantedAt?: string;
  version?: string;
  reason?: string;
}

/**
 * Error thrown when consent is required but not granted
 */
export class ConsentRequiredError extends Error {
  constructor(
    public userId: ID,
    public tenantId: ID,
    public consentType: ConsentType,
    message?: string
  ) {
    super(message ?? `Consent required: ${consentType} consent not granted for user ${userId}`);
    this.name = 'ConsentRequiredError';
  }
}

/**
 * Error thrown when consent policy is not found
 */
export class ConsentPolicyNotFoundError extends Error {
  constructor(
    public tenantId: ID,
    public consentType: ConsentType,
    public version: string
  ) {
    super(`Consent policy not found: ${consentType} version ${version} for tenant ${tenantId}`);
    this.name = 'ConsentPolicyNotFoundError';
  }
}

// =============================================================================
// CONSENT SERVICE
// =============================================================================

/**
 * Consent management service for GDPR/SOC2 compliance
 */
export class ConsentService {
  constructor(private db = getDatabase()) {}

  /**
   * Grant consent for a specific consent type
   *
   * Creates a new consent record or updates existing one.
   * Records the policy version and metadata for audit purposes.
   * Protected by circuit breaker to prevent cascading failures.
   *
   * @param userId - The user granting consent
   * @param tenantId - The tenant context
   * @param consentType - Type of consent being granted
   * @param version - Policy version being consented to
   * @param metadata - Optional metadata (IP, user agent)
   * @returns The created or updated consent record
   * @throws CircuitBreakerOpenError if the consent service circuit breaker is open
   */
  async grantConsent(
    userId: ID,
    tenantId: ID,
    consentType: ConsentType,
    version: string,
    metadata?: ConsentMetadata
  ): Promise<UserConsent> {
    return withCircuitBreaker('consentService', async () => {
      const now = new Date();

      // Check if consent already exists
      const [existing] = await this.db
        .select()
        .from(userConsents)
        .where(
          and(
            eq(userConsents.userId, userId),
            eq(userConsents.tenantId, tenantId),
            eq(userConsents.consentType, consentType),
            eq(userConsents.granted, true),
            isNull(userConsents.revokedAt)
          )
        )
        .limit(1);

      if (existing) {
        // If already granted with same version, just return existing
        if (existing.version === version) {
          logger.debug(
            { userId, tenantId, consentType, version },
            'Consent already granted with same version'
          );
          return this.mapConsentRow(existing);
        }

        // Different version - revoke old and create new
        await this.db
          .update(userConsents)
          .set({
            revokedAt: now,
            updatedAt: now,
          })
          .where(eq(userConsents.id, existing.id));

        logger.info(
          { userId, tenantId, consentType, oldVersion: existing.version, newVersion: version },
          'Previous consent revoked for version upgrade'
        );
      }

      // Create new consent record
      const [row] = await this.db
        .insert(userConsents)
        .values({
          userId,
          tenantId,
          consentType,
          granted: true,
          grantedAt: now,
          revokedAt: null,
          version,
          ipAddress: metadata?.ipAddress ?? null,
          userAgent: metadata?.userAgent ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      if (!row) {
        throw new Error('Failed to create consent record');
      }

      logger.info(
        { userId, tenantId, consentType, version, consentId: row.id },
        'Consent granted'
      );

      return this.mapConsentRow(row);
    });
  }

  /**
   * Revoke consent for a specific consent type
   *
   * Marks the consent as revoked with a timestamp.
   * Does not delete the record to maintain audit trail.
   * Protected by circuit breaker to prevent cascading failures.
   *
   * @param userId - The user revoking consent
   * @param tenantId - The tenant context
   * @param consentType - Type of consent being revoked
   * @returns The revoked consent record, or null if no active consent found
   * @throws CircuitBreakerOpenError if the consent service circuit breaker is open
   */
  async revokeConsent(
    userId: ID,
    tenantId: ID,
    consentType: ConsentType
  ): Promise<UserConsent | null> {
    return withCircuitBreaker('consentService', async () => {
      const now = new Date();

      const [row] = await this.db
        .update(userConsents)
        .set({
          granted: false,
          revokedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(userConsents.userId, userId),
            eq(userConsents.tenantId, tenantId),
            eq(userConsents.consentType, consentType),
            eq(userConsents.granted, true),
            isNull(userConsents.revokedAt)
          )
        )
        .returning();

      if (!row) {
        logger.debug(
          { userId, tenantId, consentType },
          'No active consent found to revoke'
        );
        return null;
      }

      logger.info(
        { userId, tenantId, consentType, consentId: row.id },
        'Consent revoked'
      );

      return this.mapConsentRow(row);
    });
  }

  /**
   * Get all consents for a user within a tenant
   *
   * Returns both active and revoked consents for a complete view.
   *
   * @param userId - The user ID
   * @param tenantId - The tenant context
   * @returns Array of consent records
   */
  async getConsents(userId: ID, tenantId: ID): Promise<UserConsent[]> {
    const rows = await this.db
      .select()
      .from(userConsents)
      .where(
        and(
          eq(userConsents.userId, userId),
          eq(userConsents.tenantId, tenantId)
        )
      )
      .orderBy(desc(userConsents.createdAt));

    return rows.map((row) => this.mapConsentRow(row));
  }

  /**
   * Get all active consents for a user within a tenant
   *
   * Returns only currently valid consents.
   *
   * @param userId - The user ID
   * @param tenantId - The tenant context
   * @returns Array of active consent records
   */
  async getActiveConsents(userId: ID, tenantId: ID): Promise<UserConsent[]> {
    const rows = await this.db
      .select()
      .from(userConsents)
      .where(
        and(
          eq(userConsents.userId, userId),
          eq(userConsents.tenantId, tenantId),
          eq(userConsents.granted, true),
          isNull(userConsents.revokedAt)
        )
      )
      .orderBy(desc(userConsents.createdAt));

    return rows.map((row) => this.mapConsentRow(row));
  }

  /**
   * Check if a user has valid consent for a specific type
   *
   * Returns true if consent is granted and not revoked.
   *
   * @param userId - The user ID
   * @param tenantId - The tenant context
   * @param consentType - Type of consent to check
   * @returns True if valid consent exists
   */
  async hasValidConsent(
    userId: ID,
    tenantId: ID,
    consentType: ConsentType
  ): Promise<boolean> {
    const [row] = await this.db
      .select({ id: userConsents.id })
      .from(userConsents)
      .where(
        and(
          eq(userConsents.userId, userId),
          eq(userConsents.tenantId, tenantId),
          eq(userConsents.consentType, consentType),
          eq(userConsents.granted, true),
          isNull(userConsents.revokedAt)
        )
      )
      .limit(1);

    return row !== undefined;
  }

  /**
   * Validate consent and return detailed result
   *
   * Provides detailed validation information for audit purposes.
   * Protected by circuit breaker to prevent cascading failures.
   *
   * @param userId - The user ID
   * @param tenantId - The tenant context
   * @param consentType - Type of consent to validate
   * @returns Detailed validation result
   * @throws CircuitBreakerOpenError if the consent service circuit breaker is open
   */
  async validateConsent(
    userId: ID,
    tenantId: ID,
    consentType: ConsentType
  ): Promise<ConsentValidationResult> {
    return withCircuitBreaker('consentService', async () => {
      const [row] = await this.db
        .select()
        .from(userConsents)
        .where(
          and(
            eq(userConsents.userId, userId),
            eq(userConsents.tenantId, tenantId),
            eq(userConsents.consentType, consentType),
            eq(userConsents.granted, true),
            isNull(userConsents.revokedAt)
          )
        )
        .limit(1);

      if (!row) {
        return {
          valid: false,
          consentType,
          reason: 'No active consent found',
        };
      }

      return {
        valid: true,
        consentType,
        grantedAt: row.grantedAt?.toISOString(),
        version: row.version,
      };
    });
  }

  /**
   * Require valid consent or throw an error
   *
   * Use this for consent gate enforcement in intent processing.
   *
   * @param userId - The user ID
   * @param tenantId - The tenant context
   * @param consentType - Type of consent required
   * @throws ConsentRequiredError if consent is not granted
   */
  async requireConsent(
    userId: ID,
    tenantId: ID,
    consentType: ConsentType
  ): Promise<void> {
    const hasConsent = await this.hasValidConsent(userId, tenantId, consentType);

    if (!hasConsent) {
      throw new ConsentRequiredError(userId, tenantId, consentType);
    }
  }

  /**
   * Get consent history for audit trail
   *
   * Returns chronological history of all consent changes.
   *
   * @param userId - The user ID
   * @param tenantId - The tenant context
   * @returns Array of consent history entries
   */
  async getConsentHistory(
    userId: ID,
    tenantId: ID
  ): Promise<ConsentHistoryEntry[]> {
    const rows = await this.db
      .select()
      .from(userConsents)
      .where(
        and(
          eq(userConsents.userId, userId),
          eq(userConsents.tenantId, tenantId)
        )
      )
      .orderBy(desc(userConsents.createdAt));

    const history: ConsentHistoryEntry[] = [];

    for (const row of rows) {
      // Add grant entry
      if (row.grantedAt) {
        history.push({
          id: row.id,
          consentType: row.consentType as ConsentType,
          action: 'granted',
          version: row.version,
          timestamp: row.grantedAt.toISOString(),
          ipAddress: row.ipAddress,
          userAgent: row.userAgent,
        });
      }

      // Add revoke entry if revoked
      if (row.revokedAt) {
        history.push({
          id: row.id,
          consentType: row.consentType as ConsentType,
          action: 'revoked',
          version: row.version,
          timestamp: row.revokedAt.toISOString(),
          ipAddress: row.ipAddress,
          userAgent: row.userAgent,
        });
      }
    }

    // Sort by timestamp descending
    history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return history;
  }

  // ==========================================================================
  // CONSENT POLICY MANAGEMENT
  // ==========================================================================

  /**
   * Create a new consent policy version
   *
   * @param tenantId - The tenant context
   * @param consentType - Type of consent
   * @param version - Policy version
   * @param content - Policy text content
   * @param effectiveFrom - When the policy becomes effective
   * @returns The created policy record
   */
  async createPolicy(
    tenantId: ID,
    consentType: ConsentType,
    version: string,
    content: string,
    effectiveFrom: Date = new Date()
  ): Promise<ConsentPolicy> {
    // Close any currently effective policy
    const now = new Date();
    await this.db
      .update(consentPolicies)
      .set({ effectiveTo: now })
      .where(
        and(
          eq(consentPolicies.tenantId, tenantId),
          eq(consentPolicies.consentType, consentType),
          isNull(consentPolicies.effectiveTo)
        )
      );

    // Create new policy
    const [row] = await this.db
      .insert(consentPolicies)
      .values({
        tenantId,
        consentType,
        version,
        content,
        effectiveFrom,
        effectiveTo: null,
        createdAt: now,
      })
      .returning();

    if (!row) {
      throw new Error('Failed to create consent policy');
    }

    logger.info(
      { tenantId, consentType, version },
      'Consent policy created'
    );

    return this.mapPolicyRow(row);
  }

  /**
   * Get the current effective policy for a consent type
   *
   * @param tenantId - The tenant context
   * @param consentType - Type of consent
   * @returns The current policy or null if none exists
   */
  async getCurrentPolicy(
    tenantId: ID,
    consentType: ConsentType
  ): Promise<ConsentPolicy | null> {
    const [row] = await this.db
      .select()
      .from(consentPolicies)
      .where(
        and(
          eq(consentPolicies.tenantId, tenantId),
          eq(consentPolicies.consentType, consentType),
          isNull(consentPolicies.effectiveTo)
        )
      )
      .limit(1);

    return row ? this.mapPolicyRow(row) : null;
  }

  /**
   * Get a specific policy version
   *
   * @param tenantId - The tenant context
   * @param consentType - Type of consent
   * @param version - Policy version
   * @returns The policy or null if not found
   */
  async getPolicy(
    tenantId: ID,
    consentType: ConsentType,
    version: string
  ): Promise<ConsentPolicy | null> {
    const [row] = await this.db
      .select()
      .from(consentPolicies)
      .where(
        and(
          eq(consentPolicies.tenantId, tenantId),
          eq(consentPolicies.consentType, consentType),
          eq(consentPolicies.version, version)
        )
      )
      .limit(1);

    return row ? this.mapPolicyRow(row) : null;
  }

  /**
   * Get all policy versions for a consent type
   *
   * @param tenantId - The tenant context
   * @param consentType - Type of consent
   * @returns Array of policy records
   */
  async getPolicyHistory(
    tenantId: ID,
    consentType: ConsentType
  ): Promise<ConsentPolicy[]> {
    const rows = await this.db
      .select()
      .from(consentPolicies)
      .where(
        and(
          eq(consentPolicies.tenantId, tenantId),
          eq(consentPolicies.consentType, consentType)
        )
      )
      .orderBy(desc(consentPolicies.effectiveFrom));

    return rows.map((row) => this.mapPolicyRow(row));
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  private mapConsentRow(row: UserConsentRow): UserConsent {
    return {
      id: row.id,
      userId: row.userId,
      tenantId: row.tenantId,
      consentType: row.consentType as ConsentType,
      granted: row.granted,
      grantedAt: row.grantedAt?.toISOString() ?? null,
      revokedAt: row.revokedAt?.toISOString() ?? null,
      version: row.version,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private mapPolicyRow(row: ConsentPolicyRow): ConsentPolicy {
    return {
      id: row.id,
      tenantId: row.tenantId,
      consentType: row.consentType as ConsentType,
      version: row.version,
      content: row.content,
      effectiveFrom: row.effectiveFrom.toISOString(),
      effectiveTo: row.effectiveTo?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}

/**
 * Create a new consent service instance
 */
export function createConsentService(): ConsentService {
  return new ConsentService();
}
