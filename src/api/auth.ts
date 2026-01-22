/**
 * Authentication Middleware
 *
 * Provides JWT-based authentication with tenant context extraction.
 *
 * @packageDocumentation
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { createLogger } from '../common/logger.js';
import { getConfig } from '../common/config.js';
import { createTokenRevocationService, validateJti } from '../common/token-revocation.js';

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
 * Zod schema for JWT payload validation
 */
const jwtPayloadSchema = z.object({
  sub: z.string(),
  tid: z.string(),
  jti: z.string().optional(),
  roles: z.array(z.string()).optional(),
  permissions: z.array(z.string()).optional(),
  iat: z.number().optional(),
  exp: z.number().optional(),
}).passthrough(); // Allow extra fields

/**
 * JWT payload structure
 */
type JwtPayload = z.infer<typeof jwtPayloadSchema>;

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

    const payloadPart = parts[1];
    if (!payloadPart) return null;
    const payload = Buffer.from(payloadPart, 'base64url').toString('utf-8');
    try {
      return jwtPayloadSchema.parse(JSON.parse(payload));
    } catch {
      return null; // Invalid payload structure
    }
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
    void reply.status(401).send({
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
    void reply.status(401).send({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token',
      },
    });
    return;
  }

  // Decode payload
  const payload = decodeToken(token);
  if (!payload?.sub || !payload.tid) {
    void reply.status(401).send({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid token payload',
      },
    });
    return;
  }

  // Check expiration
  if (payload.exp && payload.exp * 1000 < Date.now()) {
    void reply.status(401).send({
      error: {
        code: 'TOKEN_EXPIRED',
        message: 'Token has expired',
      },
    });
    return;
  }

  // Check token revocation
  try {
    const revocationService = createTokenRevocationService();

    // Check if specific token has been revoked (by jti)
    const jtiValidation = validateJti(payload, config);
    if (!jtiValidation.valid) {
      void reply.status(401).send({
        error: {
          code: 'INVALID_TOKEN',
          message: jtiValidation.error ?? 'Invalid token',
        },
      });
      return;
    }

    if (jtiValidation.jti) {
      const isTokenRevoked = await revocationService.isRevoked(jtiValidation.jti);
      if (isTokenRevoked) {
        logger.warn(
          { jti: jtiValidation.jti, userId: payload.sub, requestId: request.id },
          'Revoked token used'
        );
        void reply.status(401).send({
          error: {
            code: 'TOKEN_REVOKED',
            message: 'Token has been revoked',
          },
        });
        return;
      }
    }

    // Check if user's tokens have been revoked (by iat)
    if (payload.iat) {
      const issuedAt = new Date(payload.iat * 1000);
      const isUserRevoked = await revocationService.isUserTokenRevoked(payload.sub, issuedAt);
      if (isUserRevoked) {
        logger.warn(
          { userId: payload.sub, issuedAt: issuedAt.toISOString(), requestId: request.id },
          'User token revoked (issued before revocation timestamp)'
        );
        void reply.status(401).send({
          error: {
            code: 'TOKEN_REVOKED',
            message: 'Token has been revoked',
          },
        });
        return;
      }
    }
  } catch (error) {
    // Handle revocation check errors based on environment
    if (config.env === 'production') {
      logger.error({ error, requestId: request.id }, 'Token revocation check failed');
      void reply.status(401).send({
        error: {
          code: 'TOKEN_VERIFICATION_FAILED',
          message: 'Unable to verify token status',
        },
      });
      return;
    } else {
      // In development, log warning but allow through
      logger.warn(
        { error, requestId: request.id },
        'Token revocation check failed (allowing in dev)'
      );
    }
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
      void reply.status(401).send({
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

      void reply.status(403).send({
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
      void reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
      return;
    }

    const resourceTenantId = getTenantId(request);
    if (!resourceTenantId) {
      void reply.status(400).send({
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

      void reply.status(403).send({
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
      void reply.status(401).send({
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

      void reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient role',
        },
      });
      return;
    }
  };
}
