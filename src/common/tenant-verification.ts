/**
 * Tenant Membership Verification Service
 *
 * Provides secure verification that a user is a member of a tenant before
 * allowing access to tenant-scoped resources. Uses Redis caching for performance.
 *
 * SECURITY: This service is critical for preventing cross-tenant data exposure.
 * The JWT tenantId claim cannot be trusted alone - it must be verified against
 * actual membership records.
 *
 * @packageDocumentation
 */

import { eq, and } from 'drizzle-orm';
import { getDatabase } from './db.js';
import { getRedis } from './redis.js';
import { createLogger } from './logger.js';
import { ForbiddenError } from './errors.js';
import { tenantMemberships } from '../intent/schema.js';

const logger = createLogger({ component: 'tenant-verification' });

/** Cache TTL in seconds (5 minutes) */
const MEMBERSHIP_CACHE_TTL_SECONDS = 300;

/** Redis key prefix for membership cache */
const CACHE_KEY_PREFIX = 'tenant:membership:';

/**
 * Build the Redis cache key for a user-tenant membership
 */
function buildCacheKey(userId: string, tenantId: string): string {
  return `${CACHE_KEY_PREFIX}${userId}:${tenantId}`;
}

/**
 * Tenant membership verification result
 */
export interface TenantMembershipResult {
  /** Whether the user is a member of the tenant */
  isMember: boolean;
  /** The user's role in the tenant (if member) */
  role?: string;
  /** Whether the result was served from cache */
  cached: boolean;
}

/**
 * Verify that a user is a member of a tenant.
 *
 * This function first checks Redis cache for a cached membership result.
 * If not cached, it queries the database and caches the result.
 *
 * @param userId - The user ID from the JWT `sub` claim
 * @param tenantId - The tenant ID from the JWT `tenantId` claim
 * @returns Promise resolving to membership verification result
 *
 * @example
 * ```typescript
 * const result = await verifyTenantMembership(userId, tenantId);
 * if (!result.isMember) {
 *   throw new ForbiddenError('User is not a member of this tenant');
 * }
 * ```
 */
export async function verifyTenantMembership(
  userId: string,
  tenantId: string
): Promise<TenantMembershipResult> {
  const cacheKey = buildCacheKey(userId, tenantId);
  const redis = getRedis();

  try {
    // Check cache first
    const cached = await redis.get(cacheKey);
    if (cached !== null) {
      const parsed = JSON.parse(cached) as { isMember: boolean; role?: string };
      logger.debug(
        { userId, tenantId, cached: true, isMember: parsed.isMember },
        'Tenant membership cache hit'
      );
      return {
        isMember: parsed.isMember,
        role: parsed.role,
        cached: true,
      };
    }
  } catch (error) {
    // Log but don't fail on cache errors - fall through to DB check
    logger.warn(
      { userId, tenantId, error: error instanceof Error ? error.message : 'Unknown error' },
      'Failed to read from membership cache'
    );
  }

  // Cache miss - query database
  const db = getDatabase();
  const membership = await db
    .select({
      role: tenantMemberships.role,
    })
    .from(tenantMemberships)
    .where(
      and(
        eq(tenantMemberships.userId, userId),
        eq(tenantMemberships.tenantId, tenantId)
      )
    )
    .limit(1);

  const isMember = membership.length > 0;
  const role = membership[0]?.role;

  // Cache the result
  try {
    const cacheValue = JSON.stringify({ isMember, role });
    await redis.setex(cacheKey, MEMBERSHIP_CACHE_TTL_SECONDS, cacheValue);
    logger.debug(
      { userId, tenantId, isMember, role },
      'Cached tenant membership result'
    );
  } catch (error) {
    // Log but don't fail on cache write errors
    logger.warn(
      { userId, tenantId, error: error instanceof Error ? error.message : 'Unknown error' },
      'Failed to write to membership cache'
    );
  }

  logger.debug(
    { userId, tenantId, cached: false, isMember, role },
    'Tenant membership database lookup'
  );

  return {
    isMember,
    role,
    cached: false,
  };
}

/**
 * Verify tenant membership and throw ForbiddenError if user is not a member.
 *
 * This is a convenience function that combines verification with error handling
 * for use in request handlers.
 *
 * @param userId - The user ID from the JWT `sub` claim
 * @param tenantId - The tenant ID from the JWT `tenantId` claim
 * @throws ForbiddenError if the user is not a member of the tenant
 *
 * @example
 * ```typescript
 * // In a request handler:
 * await requireTenantMembership(user.sub, payload.tenantId);
 * // If we reach here, user is verified as tenant member
 * ```
 */
export async function requireTenantMembership(
  userId: string,
  tenantId: string
): Promise<void> {
  const result = await verifyTenantMembership(userId, tenantId);

  if (!result.isMember) {
    logger.warn(
      { userId, tenantId },
      'Cross-tenant access attempt blocked'
    );
    throw new ForbiddenError('Access denied: user is not a member of this tenant', {
      userId,
      tenantId,
    });
  }
}

/**
 * Invalidate the cached membership for a user-tenant pair.
 *
 * Call this when a user's membership changes (added, removed, or role changed).
 *
 * @param userId - The user ID
 * @param tenantId - The tenant ID
 */
export async function invalidateMembershipCache(
  userId: string,
  tenantId: string
): Promise<void> {
  const cacheKey = buildCacheKey(userId, tenantId);
  const redis = getRedis();

  try {
    await redis.del(cacheKey);
    logger.debug({ userId, tenantId }, 'Invalidated tenant membership cache');
  } catch (error) {
    logger.warn(
      { userId, tenantId, error: error instanceof Error ? error.message : 'Unknown error' },
      'Failed to invalidate membership cache'
    );
  }
}

/**
 * Invalidate all cached memberships for a user.
 *
 * Call this when a user is removed from the system or all their memberships change.
 *
 * @param userId - The user ID
 */
export async function invalidateUserMembershipCache(userId: string): Promise<void> {
  const redis = getRedis();
  const pattern = `${CACHE_KEY_PREFIX}${userId}:*`;

  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
      logger.debug({ userId, keysDeleted: keys.length }, 'Invalidated all user membership cache');
    }
  } catch (error) {
    logger.warn(
      { userId, error: error instanceof Error ? error.message : 'Unknown error' },
      'Failed to invalidate user membership cache'
    );
  }
}

/**
 * Invalidate all cached memberships for a tenant.
 *
 * Call this when tenant membership rules change globally.
 *
 * @param tenantId - The tenant ID
 */
export async function invalidateTenantMembershipCache(tenantId: string): Promise<void> {
  const redis = getRedis();
  const pattern = `${CACHE_KEY_PREFIX}*:${tenantId}`;

  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
      logger.debug({ tenantId, keysDeleted: keys.length }, 'Invalidated all tenant membership cache');
    }
  } catch (error) {
    logger.warn(
      { tenantId, error: error instanceof Error ? error.message : 'Unknown error' },
      'Failed to invalidate tenant membership cache'
    );
  }
}
