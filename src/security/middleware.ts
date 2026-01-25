/**
 * Fastify Security Middleware
 *
 * Provides Fastify plugins and middleware for ACI security hardening:
 * - DPoP proof verification
 * - Token introspection for high-value operations
 * - Revocation checking
 * - Security context decoration
 *
 * @packageDocumentation
 */

import type {
  FastifyInstance,
  FastifyRequest,
  FastifyReply,
  FastifyPluginCallback,
  preHandlerHookHandler,
} from 'fastify';
import fp from 'fastify-plugin';
import { createLogger } from '../common/logger.js';
import { Counter, Histogram } from 'prom-client';
import { intentRegistry } from '../intent/metrics.js';
import {
  type SecurityPluginOptions,
  type TrustTier,
  type SecurityRequirements,
  type IncomingRequest,
  securityPluginOptionsSchema,
  getSecurityRequirementsForTier,
} from './types.js';
import { DPoPService, createDPoPService, DPoPError } from './dpop.js';
import { TokenIntrospectionService, createTokenIntrospectionService, TokenInactiveError } from './introspection.js';
import { RevocationService, createRevocationService, AgentRevokedError } from './revocation.js';
import { SecurityService, createSecurityService } from './security-service.js';

const logger = createLogger({ component: 'security-middleware' });

// =============================================================================
// Metrics
// =============================================================================

const middlewareExecutions = new Counter({
  name: 'vorion_security_middleware_executions_total',
  help: 'Total security middleware executions',
  labelNames: ['middleware', 'result'] as const,
  registers: [intentRegistry],
});

const middlewareDuration = new Histogram({
  name: 'vorion_security_middleware_duration_seconds',
  help: 'Duration of security middleware execution',
  labelNames: ['middleware'] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1],
  registers: [intentRegistry],
});

// =============================================================================
// Types
// =============================================================================

/**
 * Fastify middleware function type
 */
export type FastifyMiddleware = preHandlerHookHandler;

/**
 * Decorated request with security context
 */
export interface SecurityRequestContext {
  /** Security service instance */
  security: SecurityService;
  /** Agent trust tier */
  trustTier: TrustTier;
  /** Security requirements for this tier */
  requirements: SecurityRequirements;
  /** Agent DID (from JWT sub claim) */
  agentDid?: string;
  /** DPoP key thumbprint (if DPoP was verified) */
  dpopKeyThumbprint?: string;
  /** Whether this is a high-value operation */
  isHighValueOperation?: boolean;
}

declare module 'fastify' {
  interface FastifyRequest {
    securityContext?: SecurityRequestContext;
  }
}

// =============================================================================
// DPoP Middleware
// =============================================================================

/**
 * Create DPoP verification middleware
 *
 * Verifies DPoP proofs for requests from trust tiers that require it.
 * Extracts the DPoP header, validates the proof, and optionally validates
 * token binding.
 *
 * @param dpopService - DPoP service instance
 * @param options - Middleware options
 * @returns Fastify preHandler hook
 *
 * @example
 * ```typescript
 * const dpop = createDPoPService({ requiredForTiers: [2, 3, 4, 5] });
 *
 * fastify.addHook('preHandler', dpopMiddleware(dpop, {
 *   skipPaths: ['/health', '/metrics'],
 * }));
 * ```
 */
export function dpopMiddleware(
  dpopService: DPoPService,
  options: { skipPaths?: string[] } = {}
): FastifyMiddleware {
  const skipPaths = new Set(options.skipPaths ?? []);

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const startTime = Date.now();

    // Skip configured paths
    if (skipPaths.has(request.url) || skipPaths.has(request.routeOptions.url ?? '')) {
      return;
    }

    try {
      // Get trust tier from security context or default
      const tier = request.securityContext?.trustTier ?? 0;

      // Check if DPoP is required for this tier
      if (!dpopService.isRequired(tier)) {
        middlewareExecutions.inc({ middleware: 'dpop', result: 'skipped' });
        return;
      }

      // Get DPoP header
      const dpopHeader = request.headers['dpop'] as string | undefined;
      if (!dpopHeader) {
        middlewareExecutions.inc({ middleware: 'dpop', result: 'missing' });

        return reply.status(401).send({
          error: {
            code: 'DPOP_REQUIRED',
            message: 'DPoP proof required',
            requirements: ['DPoP header with valid proof'],
          },
        });
      }

      // Build expected URI
      const protocol = request.protocol;
      const host = request.hostname;
      const uri = `${protocol}://${host}${request.url}`;

      // Verify the proof
      const result = await dpopService.verifyProof(
        dpopHeader,
        request.method,
        uri
      );

      if (!result.valid) {
        middlewareExecutions.inc({ middleware: 'dpop', result: 'invalid' });

        return reply.status(401).send({
          error: {
            code: result.errorCode ?? 'DPOP_INVALID',
            message: result.error ?? 'DPoP proof validation failed',
          },
        });
      }

      // Store key thumbprint in security context
      if (request.securityContext && result.keyThumbprint) {
        request.securityContext.dpopKeyThumbprint = result.keyThumbprint;
      }

      middlewareExecutions.inc({ middleware: 'dpop', result: 'success' });
      logger.debug({ keyThumbprint: result.keyThumbprint }, 'DPoP proof verified');

    } catch (error) {
      middlewareExecutions.inc({ middleware: 'dpop', result: 'error' });
      logger.error({ error }, 'DPoP middleware error');

      if (error instanceof DPoPError) {
        return reply.status(401).send({
          error: {
            code: error.code,
            message: error.message,
          },
        });
      }

      throw error;
    } finally {
      const duration = (Date.now() - startTime) / 1000;
      middlewareDuration.observe({ middleware: 'dpop' }, duration);
    }
  };
}

// =============================================================================
// Introspection Middleware
// =============================================================================

/**
 * Create token introspection middleware for high-value operations
 *
 * Performs real-time token validation via introspection endpoint
 * for operations that require it (T4+ or L3+ operations).
 *
 * @param introspectionService - Token introspection service
 * @param options - Middleware options
 * @returns Fastify preHandler hook
 *
 * @example
 * ```typescript
 * const introspection = createTokenIntrospectionService('https://auth.example.com/introspect');
 *
 * // Apply to specific routes
 * fastify.route({
 *   method: 'POST',
 *   url: '/financial-transaction',
 *   preHandler: [introspectionMiddleware(introspection)],
 *   handler: handleTransaction,
 * });
 * ```
 */
export function introspectionMiddleware(
  introspectionService: TokenIntrospectionService,
  options: {
    /** Force introspection regardless of tier */
    alwaysIntrospect?: boolean;
    /** Cache TTL override in milliseconds */
    cacheTTL?: number;
    /** Skip introspection for these paths */
    skipPaths?: string[];
  } = {}
): FastifyMiddleware {
  const skipPaths = new Set(options.skipPaths ?? []);

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const startTime = Date.now();

    // Skip configured paths
    if (skipPaths.has(request.url) || skipPaths.has(request.routeOptions.url ?? '')) {
      return;
    }

    try {
      // Check if introspection is required
      const tier = request.securityContext?.trustTier ?? 0;
      const isHighValue = request.securityContext?.isHighValueOperation ?? false;

      // T4+ always requires introspection, T2-T3 for high-value operations
      const shouldIntrospect =
        options.alwaysIntrospect ||
        tier >= 4 ||
        (isHighValue && tier >= 2);

      if (!shouldIntrospect) {
        middlewareExecutions.inc({ middleware: 'introspection', result: 'skipped' });
        return;
      }

      // Extract token from Authorization header
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        middlewareExecutions.inc({ middleware: 'introspection', result: 'no_token' });
        return reply.status(401).send({
          error: {
            code: 'MISSING_TOKEN',
            message: 'Bearer token required',
          },
        });
      }

      const token = authHeader.substring(7);

      // Perform introspection
      const result = await introspectionService.cachedIntrospect(token, options.cacheTTL);

      if (!result.active) {
        middlewareExecutions.inc({ middleware: 'introspection', result: 'inactive' });
        return reply.status(401).send({
          error: {
            code: 'TOKEN_INACTIVE',
            message: 'Token is no longer active',
          },
        });
      }

      middlewareExecutions.inc({ middleware: 'introspection', result: 'success' });
      logger.debug({ jti: result.jti, fromCache: result.fromCache }, 'Token introspection passed');

    } catch (error) {
      middlewareExecutions.inc({ middleware: 'introspection', result: 'error' });
      logger.error({ error }, 'Introspection middleware error');

      if (error instanceof TokenInactiveError) {
        return reply.status(401).send({
          error: {
            code: 'TOKEN_INACTIVE',
            message: error.message,
          },
        });
      }

      // For introspection failures, we might want to fail open or closed
      // depending on configuration. Default: fail closed
      return reply.status(503).send({
        error: {
          code: 'INTROSPECTION_UNAVAILABLE',
          message: 'Unable to verify token status',
        },
      });
    } finally {
      const duration = (Date.now() - startTime) / 1000;
      middlewareDuration.observe({ middleware: 'introspection' }, duration);
    }
  };
}

// =============================================================================
// Revocation Middleware
// =============================================================================

/**
 * Create revocation check middleware
 *
 * Verifies that the agent has not been revoked. For high-trust tiers
 * or high-value operations, performs synchronous revocation check.
 *
 * @param revocationService - Revocation service
 * @param options - Middleware options
 * @returns Fastify preHandler hook
 *
 * @example
 * ```typescript
 * const revocation = createRevocationService();
 *
 * fastify.addHook('preHandler', revocationMiddleware(revocation, {
 *   skipPaths: ['/health'],
 * }));
 * ```
 */
export function revocationMiddleware(
  revocationService: RevocationService,
  options: {
    /** Skip revocation check for these paths */
    skipPaths?: string[];
    /** Force synchronous check regardless of tier */
    alwaysSyncCheck?: boolean;
  } = {}
): FastifyMiddleware {
  const skipPaths = new Set(options.skipPaths ?? []);

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const startTime = Date.now();

    // Skip configured paths
    if (skipPaths.has(request.url) || skipPaths.has(request.routeOptions.url ?? '')) {
      return;
    }

    try {
      // Get agent DID from security context or JWT
      const agentDid = request.securityContext?.agentDid;
      if (!agentDid) {
        // No agent DID, skip revocation check
        middlewareExecutions.inc({ middleware: 'revocation', result: 'skipped' });
        return;
      }

      const tier = request.securityContext?.trustTier ?? 0;
      const isHighValue = request.securityContext?.isHighValueOperation ?? false;

      // Determine if sync check is needed
      const needsSyncCheck =
        options.alwaysSyncCheck ||
        revocationService.requiresSyncCheck(tier, isHighValue);

      // Check revocation status
      let isRevoked: boolean;
      if (needsSyncCheck) {
        isRevoked = await revocationService.syncRevocationCheck(agentDid);
      } else {
        const status = await revocationService.checkRevocationStatus(agentDid, tier);
        isRevoked = status.status === 'revoked';
      }

      if (isRevoked) {
        middlewareExecutions.inc({ middleware: 'revocation', result: 'revoked' });
        return reply.status(403).send({
          error: {
            code: 'AGENT_REVOKED',
            message: 'Agent access has been revoked',
          },
        });
      }

      middlewareExecutions.inc({ middleware: 'revocation', result: 'success' });

    } catch (error) {
      middlewareExecutions.inc({ middleware: 'revocation', result: 'error' });
      logger.error({ error }, 'Revocation middleware error');

      if (error instanceof AgentRevokedError) {
        return reply.status(403).send({
          error: {
            code: 'AGENT_REVOKED',
            message: error.message,
          },
        });
      }

      // Fail closed for revocation check errors
      return reply.status(503).send({
        error: {
          code: 'REVOCATION_CHECK_FAILED',
          message: 'Unable to verify agent status',
        },
      });
    } finally {
      const duration = (Date.now() - startTime) / 1000;
      middlewareDuration.observe({ middleware: 'revocation' }, duration);
    }
  };
}

// =============================================================================
// Security Context Middleware
// =============================================================================

/**
 * Create security context initialization middleware
 *
 * Extracts security-related information from the request and
 * decorates it with a security context for downstream middleware.
 *
 * @param securityService - Security service instance
 * @param options - Middleware options
 * @returns Fastify preHandler hook
 */
export function securityContextMiddleware(
  securityService: SecurityService,
  options: {
    /** Skip for these paths */
    skipPaths?: string[];
    /** Function to extract trust tier from request */
    extractTier?: (request: FastifyRequest) => TrustTier;
    /** Function to extract agent DID from request */
    extractAgentDid?: (request: FastifyRequest) => string | undefined;
    /** High-value operation paths */
    highValuePaths?: string[];
  } = {}
): FastifyMiddleware {
  const skipPaths = new Set(options.skipPaths ?? []);
  const highValuePaths = new Set(options.highValuePaths ?? []);

  const defaultExtractTier = (request: FastifyRequest): TrustTier => {
    // Try to extract from JWT claims
    const user = (request as { user?: { trustTier?: number; tier?: number } }).user;
    return (user?.trustTier ?? user?.tier ?? 2) as TrustTier;
  };

  const defaultExtractAgentDid = (request: FastifyRequest): string | undefined => {
    const user = (request as { user?: { sub?: string; did?: string } }).user;
    return user?.did ?? user?.sub;
  };

  const extractTier = options.extractTier ?? defaultExtractTier;
  const extractAgentDid = options.extractAgentDid ?? defaultExtractAgentDid;

  return async (request: FastifyRequest): Promise<void> => {
    // Skip configured paths
    if (skipPaths.has(request.url) || skipPaths.has(request.routeOptions.url ?? '')) {
      return;
    }

    const tier = extractTier(request);
    const agentDid = extractAgentDid(request);
    const isHighValue = highValuePaths.has(request.routeOptions.url ?? '') ||
                        highValuePaths.has(request.url);

    request.securityContext = {
      security: securityService,
      trustTier: tier,
      requirements: getSecurityRequirementsForTier(tier),
      agentDid,
      isHighValueOperation: isHighValue,
    };
  };
}

// =============================================================================
// Security Hardening Plugin
// =============================================================================

/**
 * Fastify plugin for comprehensive security hardening
 *
 * Registers all security middleware and decorates requests with
 * security context. Applies DPoP, introspection, and revocation
 * checks based on configuration.
 *
 * @example
 * ```typescript
 * await fastify.register(securityHardeningPlugin, {
 *   dpop: { requiredForTiers: [2, 3, 4, 5] },
 *   introspectionEndpoint: 'https://auth.example.com/introspect',
 *   skipPaths: ['/health', '/metrics', '/docs'],
 *   enableMetrics: true,
 * });
 * ```
 */
const securityHardeningPluginCallback: FastifyPluginCallback<SecurityPluginOptions> = (
  fastify: FastifyInstance,
  options: SecurityPluginOptions,
  done: (err?: Error) => void
) => {
  try {
    // Validate options
    const validatedOptions = securityPluginOptionsSchema.parse(options);

    // Create services
    const dpopService = createDPoPService(validatedOptions.dpop);
    const introspectionService = validatedOptions.introspectionEndpoint
      ? createTokenIntrospectionService(validatedOptions.introspectionEndpoint)
      : createTokenIntrospectionService('http://localhost:4000/oauth2/introspect');
    const revocationService = createRevocationService(
      validatedOptions.revocationSLAs as import('./types.js').RevocationSLA[] | undefined
    );
    const securityService = createSecurityService({
      dpopConfig: validatedOptions.dpop,
      teeConfig: validatedOptions.tee,
      pairwiseDIDConfig: validatedOptions.pairwiseDid,
      introspectionEndpoint: validatedOptions.introspectionEndpoint,
      tokenLifetimeConfig: validatedOptions.tokenLifetime,
    });

    const skipPaths = validatedOptions.skipPaths ?? [];

    // Register security context middleware (first)
    fastify.addHook('preHandler', securityContextMiddleware(securityService, { skipPaths }));

    // Register DPoP middleware
    fastify.addHook('preHandler', dpopMiddleware(dpopService, { skipPaths }));

    // Register revocation middleware
    fastify.addHook('preHandler', revocationMiddleware(revocationService, { skipPaths }));

    // Register introspection middleware (for high-value operations)
    fastify.addHook('preHandler', introspectionMiddleware(introspectionService, { skipPaths }));

    // Decorate fastify instance with security service
    fastify.decorate('securityService', securityService);

    logger.info(
      { skipPaths: skipPaths.length, metricsEnabled: validatedOptions.enableMetrics },
      'Security hardening plugin registered'
    );

    done();
  } catch (error) {
    done(error instanceof Error ? error : new Error(String(error)));
  }
};

/**
 * Security hardening Fastify plugin
 */
export const securityHardeningPlugin = fp(securityHardeningPluginCallback, {
  name: 'vorion-security-hardening',
  fastify: '5.x',
});

// Declare Fastify decorator
declare module 'fastify' {
  interface FastifyInstance {
    securityService?: SecurityService;
  }
}

// =============================================================================
// Utility Middleware
// =============================================================================

/**
 * Create a high-value operation marker middleware
 *
 * Marks requests as high-value operations, triggering additional
 * security checks (introspection, sync revocation check).
 *
 * @returns Fastify preHandler hook
 */
export function markHighValueOperation(): FastifyMiddleware {
  return async (request: FastifyRequest): Promise<void> => {
    if (request.securityContext) {
      request.securityContext.isHighValueOperation = true;
    }
  };
}

/**
 * Create a tier requirement middleware
 *
 * Requires a minimum trust tier for the route.
 *
 * @param minimumTier - Minimum required trust tier
 * @returns Fastify preHandler hook
 */
export function requireTier(minimumTier: TrustTier): FastifyMiddleware {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const currentTier = request.securityContext?.trustTier ?? 0;

    if (currentTier < minimumTier) {
      return reply.status(403).send({
        error: {
          code: 'INSUFFICIENT_TRUST_TIER',
          message: `This operation requires trust tier T${minimumTier} or higher`,
          currentTier,
          requiredTier: minimumTier,
        },
      });
    }
  };
}

/**
 * Create a DPoP required middleware
 *
 * Requires DPoP proof regardless of trust tier.
 *
 * @param dpopService - DPoP service
 * @returns Fastify preHandler hook
 */
export function requireDPoP(dpopService: DPoPService): FastifyMiddleware {
  return dpopMiddleware(dpopService);
}
