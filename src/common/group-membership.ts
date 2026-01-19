/**
 * Group Membership Verification Service
 *
 * Provides authoritative verification of user group memberships against the database,
 * not trusting JWT claims which can be manipulated by attackers.
 *
 * This is a CRITICAL security component that prevents escalation authorization bypass attacks.
 *
 * @packageDocumentation
 */

import { and, eq } from 'drizzle-orm';
import { getDatabase } from './db.js';
import { createLogger } from './logger.js';
import { getRedis } from './redis.js';
import type { ID } from './types.js';
import {
  groupMemberships,
  escalationApprovers,
} from '../intent/schema.js';

const logger = createLogger({ component: 'group-membership' });

/**
 * Cache TTL for group membership lookups (5 minutes)
 */
const CACHE_TTL_SECONDS = 300;

/**
 * Cache key prefix for group membership
 */
const CACHE_PREFIX = 'group:membership:';

/**
 * Result of a group membership verification
 */
export interface GroupMembershipResult {
  /** Whether the user is a verified member of the group */
  isMember: boolean;
  /** Source of the verification (database, cache, or external directory) */
  source: 'database' | 'cache' | 'directory';
  /** When the membership was verified */
  verifiedAt: string;
  /** Optional additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Result of an escalation approver check
 */
export interface EscalationApproverResult {
  /** Whether the user is an assigned approver for this escalation */
  isApprover: boolean;
  /** When the user was assigned as approver (if applicable) */
  assignedAt?: string;
  /** Who assigned the user as approver (if applicable) */
  assignedBy?: string;
}

/**
 * Options for verifying group membership
 */
export interface VerifyGroupMembershipOptions {
  /** Skip cache and verify directly against database */
  skipCache?: boolean;
  /** Include external directory check (if configured) */
  checkExternalDirectory?: boolean;
}

/**
 * Options for assigning an approver to an escalation
 */
export interface AssignApproverOptions {
  /** The escalation ID */
  escalationId: ID;
  /** The user ID to assign as approver */
  userId: ID;
  /** The tenant ID for isolation */
  tenantId: ID;
  /** Who is making the assignment */
  assignedBy: ID;
}

/**
 * Verify if a user is a member of a specific group within a tenant.
 * This function queries the authoritative database source, NOT JWT claims.
 *
 * @param userId - The user ID to check
 * @param groupName - The group name to check membership for
 * @param tenantId - The tenant context for multi-tenancy isolation
 * @param options - Optional verification options
 * @returns Promise resolving to verification result
 */
export async function verifyGroupMembership(
  userId: string,
  groupName: string,
  tenantId: string,
  options: VerifyGroupMembershipOptions = {}
): Promise<GroupMembershipResult> {
  const { skipCache = false } = options;
  const cacheKey = `${CACHE_PREFIX}${tenantId}:${userId}:${groupName}`;

  // Check cache first (unless skipped)
  if (!skipCache) {
    try {
      const redis = getRedis();
      const cached = await redis.get(cacheKey);
      if (cached) {
        const result = JSON.parse(cached) as GroupMembershipResult;
        logger.debug(
          { userId, groupName, tenantId, cached: true },
          'Group membership cache hit'
        );
        return { ...result, source: 'cache' };
      }
    } catch (error) {
      // Cache miss or error - proceed to database
      logger.warn(
        { error, userId, groupName, tenantId },
        'Group membership cache error, falling back to database'
      );
    }
  }

  // Query authoritative database source
  const db = getDatabase();
  const now = new Date().toISOString();

  try {
    const [membership] = await db
      .select()
      .from(groupMemberships)
      .where(
        and(
          eq(groupMemberships.userId, userId),
          eq(groupMemberships.groupName, groupName),
          eq(groupMemberships.tenantId, tenantId),
          eq(groupMemberships.active, true)
        )
      )
      .limit(1);

    const result: GroupMembershipResult = {
      isMember: !!membership,
      source: 'database',
      verifiedAt: now,
    };

    if (membership) {
      result.metadata = {
        membershipId: membership.id,
        joinedAt: membership.createdAt,
      };
    }

    // Cache the result
    try {
      const redis = getRedis();
      await redis.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL_SECONDS);
    } catch (error) {
      logger.warn({ error }, 'Failed to cache group membership result');
    }

    logger.debug(
      { userId, groupName, tenantId, isMember: result.isMember },
      'Group membership verified against database'
    );

    return result;
  } catch (error) {
    logger.error(
      { error, userId, groupName, tenantId },
      'Failed to verify group membership'
    );
    throw error;
  }
}

/**
 * Check if a user is an explicitly assigned approver for an escalation.
 * This provides a more fine-grained authorization than group membership.
 *
 * @param escalationId - The escalation ID
 * @param userId - The user ID to check
 * @param tenantId - The tenant context for isolation
 * @returns Promise resolving to approver check result
 */
export async function isAssignedApprover(
  escalationId: string,
  userId: string,
  tenantId: string
): Promise<EscalationApproverResult> {
  const db = getDatabase();

  try {
    const [approver] = await db
      .select()
      .from(escalationApprovers)
      .where(
        and(
          eq(escalationApprovers.escalationId, escalationId),
          eq(escalationApprovers.userId, userId),
          eq(escalationApprovers.tenantId, tenantId)
        )
      )
      .limit(1);

    if (approver) {
      logger.debug(
        { escalationId, userId, tenantId },
        'User is assigned approver for escalation'
      );
      return {
        isApprover: true,
        assignedAt: approver.assignedAt.toISOString(),
        assignedBy: approver.assignedBy,
      };
    }

    return { isApprover: false };
  } catch (error) {
    logger.error(
      { error, escalationId, userId, tenantId },
      'Failed to check escalation approver assignment'
    );
    throw error;
  }
}

/**
 * Assign a user as an approver for a specific escalation.
 *
 * @param options - Assignment options
 * @returns Promise resolving to the created assignment
 */
export async function assignApprover(
  options: AssignApproverOptions
): Promise<{ id: string; assignedAt: string }> {
  const { escalationId, userId, tenantId, assignedBy } = options;
  const db = getDatabase();
  const now = new Date();

  try {
    const [existing] = await db
      .select()
      .from(escalationApprovers)
      .where(
        and(
          eq(escalationApprovers.escalationId, escalationId),
          eq(escalationApprovers.userId, userId),
          eq(escalationApprovers.tenantId, tenantId)
        )
      )
      .limit(1);

    if (existing) {
      logger.debug(
        { escalationId, userId, tenantId },
        'User already assigned as approver'
      );
      return {
        id: existing.id,
        assignedAt: existing.assignedAt.toISOString(),
      };
    }

    const [assignment] = await db
      .insert(escalationApprovers)
      .values({
        escalationId,
        userId,
        tenantId,
        assignedBy,
        assignedAt: now,
      })
      .returning();

    if (!assignment) {
      throw new Error('Failed to create approver assignment');
    }

    logger.info(
      { escalationId, userId, tenantId, assignedBy },
      'Approver assigned to escalation'
    );

    return {
      id: assignment.id,
      assignedAt: assignment.assignedAt.toISOString(),
    };
  } catch (error) {
    logger.error(
      { error, escalationId, userId, tenantId },
      'Failed to assign approver to escalation'
    );
    throw error;
  }
}

/**
 * Remove an approver assignment from an escalation.
 *
 * @param escalationId - The escalation ID
 * @param userId - The user ID to remove
 * @param tenantId - The tenant context
 * @returns Promise resolving to true if removed, false if not found
 */
export async function removeApprover(
  escalationId: string,
  userId: string,
  tenantId: string
): Promise<boolean> {
  const db = getDatabase();

  try {
    const result = await db
      .delete(escalationApprovers)
      .where(
        and(
          eq(escalationApprovers.escalationId, escalationId),
          eq(escalationApprovers.userId, userId),
          eq(escalationApprovers.tenantId, tenantId)
        )
      )
      .returning({ id: escalationApprovers.id });

    const removed = result.length > 0;

    if (removed) {
      logger.info(
        { escalationId, userId, tenantId },
        'Approver removed from escalation'
      );
    }

    return removed;
  } catch (error) {
    logger.error(
      { error, escalationId, userId, tenantId },
      'Failed to remove approver from escalation'
    );
    throw error;
  }
}

/**
 * List all assigned approvers for an escalation.
 *
 * @param escalationId - The escalation ID
 * @param tenantId - The tenant context
 * @returns Promise resolving to list of approver assignments
 */
export async function listApprovers(
  escalationId: string,
  tenantId: string
): Promise<Array<{ userId: string; assignedAt: string; assignedBy: string }>> {
  const db = getDatabase();

  try {
    const approvers = await db
      .select()
      .from(escalationApprovers)
      .where(
        and(
          eq(escalationApprovers.escalationId, escalationId),
          eq(escalationApprovers.tenantId, tenantId)
        )
      );

    return approvers.map((a) => ({
      userId: a.userId,
      assignedAt: a.assignedAt.toISOString(),
      assignedBy: a.assignedBy,
    }));
  } catch (error) {
    logger.error(
      { error, escalationId, tenantId },
      'Failed to list escalation approvers'
    );
    throw error;
  }
}

/**
 * Invalidate cached group membership for a user.
 * Call this when group memberships are updated.
 *
 * @param userId - The user ID
 * @param tenantId - The tenant context
 * @param groupName - Optional specific group to invalidate (all groups if not specified)
 */
export async function invalidateGroupMembershipCache(
  userId: string,
  tenantId: string,
  groupName?: string
): Promise<void> {
  try {
    const redis = getRedis();

    if (groupName) {
      const cacheKey = `${CACHE_PREFIX}${tenantId}:${userId}:${groupName}`;
      await redis.del(cacheKey);
    } else {
      // Invalidate all group memberships for this user
      // Note: This requires SCAN in production for large datasets
      const pattern = `${CACHE_PREFIX}${tenantId}:${userId}:*`;
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    }

    logger.debug(
      { userId, tenantId, groupName },
      'Group membership cache invalidated'
    );
  } catch (error) {
    logger.warn(
      { error, userId, tenantId, groupName },
      'Failed to invalidate group membership cache'
    );
  }
}
