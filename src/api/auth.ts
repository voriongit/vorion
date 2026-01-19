/**
 * Authentication Middleware
 *
 * Provides JWT-based authentication with tenant context extraction.
 *
 * @packageDocumentation
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { createLogger } from '../common/logger.js';
import { getConfig } from '../common/config.js';

const logger = createLogger({ component: 'auth' });

/**
 * Authenticated user context
 */
export interface AuthContext {
  userId: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
}

/**
 * JWT payload structure
 */
interface JwtPayload {
  sub: string; // userId
  tid: string; // tenantId
  roles?: string[];
  permissions?: string[];
  iat?: number;
  exp?: number;
}

/**
 * Extend FastifyRequest with auth context
 */
declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}

/**
 * Decode and verify JWT token
 * Note: In production, use @fastify/jwt with proper verification
 */
function decodeToken(token: string): JwtPayload | null {
  try {
    // Basic JWT decode (header.payload.signature)
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = Buffer.from(parts[1]!, 'base64url').toString('utf-8');
    return JSON.parse(payload) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Verify JWT signature
 * Note: This is a placeholder - use @fastify/jwt in production
 */
async function verifySignature(token: string, secret: string): Promise<boolean> {
  try {
    const config = getConfig();

    // In development, skip verification if using dev secret
    if (config.env === 'development' && secret.includes('dev-only')) {
      return true;
    }

    // For production, implement proper HMAC verification
    // This should use crypto.subtle.verify() with the JWT signature
    const parts = token.split('.');
    if (parts.length !== 3) return false;

    const [header, payload, signature] = parts;
    const data = `${header}.${payload}`;

    // Use Web Crypto API for verification
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signatureBytes = Buffer.from(signature!, 'base64url');
    return await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      encoder.encode(data)
    );
  } catch {
    return false;
  }
}

/**
 * Authentication middleware
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const config = getConfig();

  // Extract token from Authorization header
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    reply.status(401).send({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid authorization header',
      },
    });
    return;
  }

  const token = authHeader.slice(7);

  // Verify signature
  const isValid = await verifySignature(token, config.jwt.secret);
  if (!isValid) {
    logger.warn({ requestId: request.id }, 'Invalid token signature');
    reply.status(401).send({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token',
      },
    });
    return;
  }

  // Decode payload
  const payload = decodeToken(token);
  if (!payload || !payload.sub || !payload.tid) {
    reply.status(401).send({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid token payload',
      },
    });
    return;
  }

  // Check expiration
  if (payload.exp && payload.exp * 1000 < Date.now()) {
    reply.status(401).send({
      error: {
        code: 'TOKEN_EXPIRED',
        message: 'Token has expired',
      },
    });
    return;
  }

  // Set auth context
  request.auth = {
    userId: payload.sub,
    tenantId: payload.tid,
    roles: payload.roles ?? [],
    permissions: payload.permissions ?? [],
  };

  logger.debug(
    {
      userId: payload.sub,
      tenantId: payload.tid,
      requestId: request.id,
    },
    'Request authenticated'
  );
}

/**
 * Authorization middleware factory
 * Checks if user has required permission
 */
export function requirePermission(permission: string) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.auth) {
      reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
      return;
    }

    if (!request.auth.permissions.includes(permission)) {
      logger.warn(
        {
          userId: request.auth.userId,
          tenantId: request.auth.tenantId,
          requiredPermission: permission,
          requestId: request.id,
        },
        'Permission denied'
      );

      reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
        },
      });
      return;
    }
  };
}

/**
 * Tenant authorization middleware
 * Verifies user can access the specified tenant's resources
 */
export function requireTenantAccess(getTenantId: (request: FastifyRequest) => string | undefined) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.auth) {
      reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
      return;
    }

    const resourceTenantId = getTenantId(request);
    if (!resourceTenantId) {
      reply.status(400).send({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Tenant ID required',
        },
      });
      return;
    }

    // Check if user's tenant matches resource tenant
    // Or if user has admin role for cross-tenant access
    const hasAccess =
      request.auth.tenantId === resourceTenantId ||
      request.auth.roles.includes('admin') ||
      request.auth.roles.includes('super_admin');

    if (!hasAccess) {
      logger.warn(
        {
          userId: request.auth.userId,
          userTenantId: request.auth.tenantId,
          resourceTenantId,
          requestId: request.id,
        },
        'Tenant access denied'
      );

      reply.status(403).send({
        error: {
          code: 'TENANT_ACCESS_DENIED',
          message: 'Access denied to this tenant resource',
        },
      });
      return;
    }
  };
}

/**
 * Role check middleware factory
 */
export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.auth) {
      reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
      return;
    }

    const hasRole = roles.some((role) => request.auth!.roles.includes(role));
    if (!hasRole) {
      logger.warn(
        {
          userId: request.auth.userId,
          tenantId: request.auth.tenantId,
          requiredRoles: roles,
          userRoles: request.auth.roles,
          requestId: request.id,
        },
        'Role check failed'
      );

      reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient role',
        },
      });
      return;
    }
  };
}
