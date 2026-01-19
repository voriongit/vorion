/**
 * Authorization Utilities
 *
 * Provides role-based access control (RBAC) utilities for API endpoints.
 *
 * @packageDocumentation
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { createLogger } from './logger.js';

const authzLogger = createLogger({ component: 'authorization' });

/**
 * User payload extracted from JWT token
 */
export interface AuthUser {
  sub?: string;
  tenantId?: string;
  roles?: string[];
  groups?: string[];
  [key: string]: unknown;
}

/**
 * Authorization check result
 */
export interface AuthorizationResult {
  allowed: boolean;
  reason?: string;
  matchedRoles?: string[];
}

/**
 * Policy endpoint role definitions
 */
export const POLICY_ROLES = {
  /** Roles that can read policies */
  READ: ['admin', 'tenant:admin', 'policy:admin', 'policy_reader', 'policy_writer'],
  /** Roles that can create and update policies */
  WRITE: ['admin', 'tenant:admin', 'policy:admin', 'policy_writer'],
  /** Roles that can delete policies */
  DELETE: ['admin', 'tenant:admin', 'policy:admin'],
} as const;

/**
 * Check if user has any of the required roles
 *
 * @param userRoles - Array of roles the user has
 * @param requiredRoles - Array of roles that would grant access
 * @returns Authorization result with matched roles if allowed
 */
export function hasAnyRole(
  userRoles: string[] | undefined,
  requiredRoles: readonly string[]
): AuthorizationResult {
  const roles = userRoles ?? [];

  if (roles.length === 0) {
    return {
      allowed: false,
      reason: 'No roles found in token',
    };
  }

  const matchedRoles = roles.filter((role) => requiredRoles.includes(role));

  if (matchedRoles.length > 0) {
    return {
      allowed: true,
      matchedRoles,
    };
  }

  return {
    allowed: false,
    reason: `Required roles: ${requiredRoles.join(', ')}. User roles: ${roles.join(', ')}`,
  };
}

/**
 * Check if user has all of the required roles
 *
 * @param userRoles - Array of roles the user has
 * @param requiredRoles - Array of roles that are all required
 * @returns Authorization result
 */
export function hasAllRoles(
  userRoles: string[] | undefined,
  requiredRoles: readonly string[]
): AuthorizationResult {
  const roles = userRoles ?? [];

  if (roles.length === 0) {
    return {
      allowed: false,
      reason: 'No roles found in token',
    };
  }

  const missingRoles = requiredRoles.filter((role) => !roles.includes(role));

  if (missingRoles.length === 0) {
    return {
      allowed: true,
      matchedRoles: [...requiredRoles],
    };
  }

  return {
    allowed: false,
    reason: `Missing required roles: ${missingRoles.join(', ')}`,
  };
}

/**
 * Extract user information from Fastify request
 *
 * @param request - Fastify request object (with JWT user property)
 * @returns AuthUser extracted from JWT payload
 */
export function getAuthUser(request: FastifyRequest): AuthUser {
  // The JWT plugin adds the user property to the request
  // Cast through unknown to avoid strict type checking
  return (request as unknown as { user: AuthUser }).user;
}

/**
 * Authorization error response structure
 */
export interface AuthorizationError {
  code: 'FORBIDDEN';
  message: string;
  requiredRoles?: readonly string[];
}

/**
 * Create a standard 403 Forbidden response
 *
 * @param reason - Reason for denial
 * @param requiredRoles - Optional list of required roles to include in response
 * @returns Formatted error response
 */
export function createForbiddenResponse(
  reason: string,
  requiredRoles?: readonly string[]
): { error: AuthorizationError } {
  const error: AuthorizationError = {
    code: 'FORBIDDEN',
    message: reason,
  };

  if (requiredRoles) {
    error.requiredRoles = requiredRoles;
  }

  return { error };
}

/**
 * Higher-order function to create an authorization guard for route handlers
 *
 * @param requiredRoles - Roles that grant access to this endpoint
 * @param options - Additional options for the guard
 * @returns A preHandler hook function for Fastify
 *
 * @example
 * ```typescript
 * api.get('/policies', {
 *   preHandler: requireRoles(POLICY_ROLES.READ),
 * }, async (request, reply) => {
 *   // Handler code
 * });
 * ```
 */
export function requireRoles(
  requiredRoles: readonly string[],
  options: {
    /** Log authorization failures */
    logFailures?: boolean;
    /** Custom message for authorization failures */
    customMessage?: string;
  } = {}
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  const { logFailures = true, customMessage } = options;

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const user = getAuthUser(request);
    const result = hasAnyRole(user.roles, requiredRoles);

    if (!result.allowed) {
      if (logFailures) {
        authzLogger.warn(
          {
            userId: user.sub,
            tenantId: user.tenantId,
            userRoles: user.roles,
            requiredRoles: [...requiredRoles],
            path: request.url,
            method: request.method,
            reason: result.reason,
          },
          'Authorization denied'
        );
      }

      const message = customMessage ?? `Access denied: ${result.reason}`;
      return reply.status(403).send(createForbiddenResponse(message, requiredRoles));
    }

    // Authorization passed - log at debug level for audit trail
    authzLogger.debug(
      {
        userId: user.sub,
        tenantId: user.tenantId,
        matchedRoles: result.matchedRoles,
        path: request.url,
        method: request.method,
      },
      'Authorization granted'
    );
  };
}

/**
 * Inline authorization check for use within route handlers
 * Returns true if authorized, sends 403 response and returns false if not
 *
 * @param request - Fastify request object
 * @param reply - Fastify reply object
 * @param requiredRoles - Roles that grant access
 * @param options - Additional options
 * @returns true if authorized, false if not (response already sent)
 *
 * @example
 * ```typescript
 * api.delete('/policies/:id', async (request, reply) => {
 *   if (!await checkAuthorization(request, reply, POLICY_ROLES.DELETE)) {
 *     return; // Response already sent
 *   }
 *   // Handler code
 * });
 * ```
 */
export async function checkAuthorization(
  request: FastifyRequest,
  reply: FastifyReply,
  requiredRoles: readonly string[],
  options: {
    logFailures?: boolean;
    customMessage?: string;
  } = {}
): Promise<boolean> {
  const { logFailures = true, customMessage } = options;
  const user = getAuthUser(request);
  const result = hasAnyRole(user.roles, requiredRoles);

  if (!result.allowed) {
    if (logFailures) {
      authzLogger.warn(
        {
          userId: user.sub,
          tenantId: user.tenantId,
          userRoles: user.roles,
          requiredRoles: [...requiredRoles],
          path: request.url,
          method: request.method,
          reason: result.reason,
        },
        'Authorization denied'
      );
    }

    const message = customMessage ?? `Access denied: ${result.reason}`;
    await reply.status(403).send(createForbiddenResponse(message, requiredRoles));
    return false;
  }

  authzLogger.debug(
    {
      userId: user.sub,
      tenantId: user.tenantId,
      matchedRoles: result.matchedRoles,
      path: request.url,
      method: request.method,
    },
    'Authorization granted'
  );

  return true;
}
