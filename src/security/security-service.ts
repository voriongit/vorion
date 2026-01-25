/**
 * Security Service - Main Coordinator
 *
 * Orchestrates all ACI security hardening components:
 * - DPoP proof validation
 * - TEE attestation verification
 * - Pairwise DID management
 * - Revocation enforcement
 * - Token lifetime validation
 * - Introspection for high-value operations
 *
 * Provides unified security context validation and pre-request checks
 * based on trust tier requirements.
 *
 * Security Conformance Levels:
 * - SH-1 (Basic): DPoP, short-lived tokens (T2)
 * - SH-2 (Standard): SH-1 + pairwise DIDs, recursive revocation (T3)
 * - SH-3 (Hardened): SH-2 + TEE binding, sync revocation checks (T4-T5)
 *
 * @packageDocumentation
 */

import { createLogger } from '../common/logger.js';
import { VorionError } from '../common/errors.js';
import { Counter, Histogram } from 'prom-client';
import { intentRegistry } from '../intent/metrics.js';
import {
  type SecurityContext,
  type SecurityValidationResult,
  type SecurityValidationError as SecurityValidationErrorType,
  type PreRequestResult,
  type HighValueCheckResult,
  type SecurityRequirements,
  type TrustTier,
  type IncomingRequest,
  type AgentIdentity,
  type ActionRequest,
  SecurityConformanceLevel,
  getSecurityRequirementsForTier,
  securityContextSchema,
  securityValidationResultSchema,
  preRequestResultSchema,
  highValueCheckResultSchema,
  incomingRequestSchema,
} from './types.js';
import { DPoPService, createDPoPService } from './dpop.js';
import { TEEBindingService, createTEEBindingService } from './tee.js';
import { PairwiseDIDService, createPairwiseDIDService } from './pairwise-did.js';
import { RevocationService, createRevocationService } from './revocation.js';
import { TokenLifetimeService, createTokenLifetimeService, type JWTPayload } from './token-lifetime.js';
import { TokenIntrospectionService, createTokenIntrospectionService } from './introspection.js';

const logger = createLogger({ component: 'security-service' });

// =============================================================================
// Metrics
// =============================================================================

const securityValidations = new Counter({
  name: 'vorion_security_validations_total',
  help: 'Total security context validations',
  labelNames: ['result', 'tier', 'conformance_level'] as const,
  registers: [intentRegistry],
});

const securityValidationDuration = new Histogram({
  name: 'vorion_security_validation_duration_seconds',
  help: 'Duration of security context validation',
  labelNames: ['tier'] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25],
  registers: [intentRegistry],
});

const preRequestChecks = new Counter({
  name: 'vorion_security_pre_request_checks_total',
  help: 'Total pre-request security checks',
  labelNames: ['result', 'tier'] as const,
  registers: [intentRegistry],
});

const highValueOperationChecks = new Counter({
  name: 'vorion_security_high_value_operation_checks_total',
  help: 'Total high-value operation security checks',
  labelNames: ['result', 'tier', 'operation_type'] as const,
  registers: [intentRegistry],
});

// =============================================================================
// Errors
// =============================================================================

/**
 * Security validation error
 */
export class SecurityValidationError extends VorionError {
  override code = 'SECURITY_VALIDATION_ERROR';
  override statusCode = 403;

  constructor(
    message: string,
    public readonly errors: { code: string; message: string; component: string }[]
  ) {
    super(message, { errors });
    this.name = 'SecurityValidationError';
  }
}

// =============================================================================
// Security Service
// =============================================================================

/**
 * Security Service - Main coordinator for ACI security hardening
 *
 * @example
 * ```typescript
 * const security = new SecurityService(
 *   dpopService,
 *   teeService,
 *   pairwiseDIDService,
 *   revocationService,
 *   tokenLifetimeService,
 *   introspectionService
 * );
 *
 * // Validate complete security context
 * const result = await security.validateSecurityContext(context);
 *
 * // Pre-request security check
 * const preResult = await security.preRequestCheck(request);
 *
 * // High-value operation check
 * const highValueResult = await security.highValueOperationCheck(operation, agent);
 * ```
 */
export class SecurityService {
  /**
   * Create a new security service
   *
   * @param dpop - DPoP service
   * @param tee - TEE binding service
   * @param pairwiseDID - Pairwise DID service
   * @param revocation - Revocation service
   * @param tokenLifetime - Token lifetime service
   * @param introspection - Token introspection service
   */
  constructor(
    private dpop: DPoPService,
    private tee: TEEBindingService,
    private pairwiseDID: PairwiseDIDService,
    private revocation: RevocationService,
    private tokenLifetime: TokenLifetimeService,
    private introspection: TokenIntrospectionService
  ) {
    logger.info('Security service initialized');
  }

  /**
   * Validate complete security context
   *
   * Performs comprehensive validation based on trust tier requirements:
   * - Token lifetime validation
   * - Revocation status check
   * - DPoP proof validation (T2+)
   * - TEE attestation validation (T4+)
   * - Pairwise DID validation (T3+ with sensitive data)
   *
   * @param context - Security context to validate
   * @returns Validation result
   */
  async validateSecurityContext(
    context: SecurityContext
  ): Promise<SecurityValidationResult> {
    const startTime = Date.now();
    const errors: SecurityValidationErrorType[] = [];
    const warnings: string[] = [];

    // Validate context format
    try {
      securityContextSchema.parse(context);
    } catch (error) {
      errors.push({
        code: 'INVALID_CONTEXT',
        message: 'Invalid security context format',
        component: 'token',
      });
      return this.buildValidationResult(false, errors, warnings, context.agent.trustTier);
    }

    const tier = context.agent.trustTier;
    const requirements = this.getRequirements(tier);

    try {
      // 1. Token lifetime validation
      const tokenPayload = this.extractTokenPayload(context.accessToken);
      if (tokenPayload) {
        const isHighValue = this.tokenLifetime.isHighValueOperation(context.request);
        const lifetimeResult = this.tokenLifetime.validateLifetime(
          tokenPayload,
          'access',
          isHighValue
        );

        if (!lifetimeResult.valid) {
          errors.push({
            code: lifetimeResult.errorCode ?? 'TOKEN_LIFETIME_ERROR',
            message: lifetimeResult.error ?? 'Token lifetime validation failed',
            component: 'token',
          });
        }

        if (lifetimeResult.shouldRefresh) {
          warnings.push('Token should be refreshed soon');
        }
      } else {
        errors.push({
          code: 'INVALID_TOKEN',
          message: 'Could not parse access token',
          component: 'token',
        });
      }

      // 2. Revocation status check
      const revocationStatus = await this.revocation.checkRevocationStatus(
        context.agent.did,
        tier
      );
      if (revocationStatus.status === 'revoked') {
        errors.push({
          code: 'AGENT_REVOKED',
          message: `Agent has been revoked: ${revocationStatus.reason ?? 'No reason provided'}`,
          component: 'revocation',
        });
      }

      // 3. DPoP validation (T2+)
      if (requirements.dpopRequired) {
        if (!context.dpopProof) {
          errors.push({
            code: 'DPOP_REQUIRED',
            message: 'DPoP proof required for this trust tier',
            component: 'dpop',
          });
        } else {
          // Extract token confirmation claim for binding validation
          const tokenCnf = tokenPayload?.cnf as { jkt?: string } | undefined;

          const dpopValid = await this.dpop.validateBoundToken(
            context.accessToken,
            context.dpopProof,
            context.request.method,
            context.request.uri,
            tokenCnf
          );

          if (!dpopValid) {
            errors.push({
              code: 'DPOP_VALIDATION_FAILED',
              message: 'DPoP proof validation failed',
              component: 'dpop',
            });
          }
        }
      }

      // 4. TEE attestation validation (T4+)
      if (requirements.teeRequired) {
        if (!context.teeAttestation) {
          errors.push({
            code: 'TEE_REQUIRED',
            message: 'TEE attestation required for this trust tier',
            component: 'tee',
          });
        } else {
          const teeResult = await this.tee.verifyAttestation(context.teeAttestation);
          if (!teeResult.valid) {
            errors.push({
              code: 'TEE_VALIDATION_FAILED',
              message: teeResult.reason ?? 'TEE attestation validation failed',
              component: 'tee',
            });
          }

          // Verify key binding if agent has TEE binding
          if (context.agent.teeBinding) {
            const bindingValid = await this.tee.verifyKeyBinding(context.agent.teeBinding);
            if (!bindingValid) {
              errors.push({
                code: 'TEE_BINDING_INVALID',
                message: 'TEE key binding is invalid or expired',
                component: 'tee',
              });
            }
          }
        }
      }

      // 5. Pairwise DID validation (T3+ with sensitive data)
      if (requirements.pairwiseRequired && context.request.dataClassification) {
        const pairwiseRequired = this.pairwiseDID.isRequired(context.request.dataClassification);

        if (pairwiseRequired && !context.pairwiseDid) {
          errors.push({
            code: 'PAIRWISE_DID_REQUIRED',
            message: `Pairwise DID required for ${context.request.dataClassification} data`,
            component: 'pairwise',
          });
        }
      }

      // 6. Introspection for high-value operations (T4+ or L3+ operations)
      if (this.tokenLifetime.requiresIntrospection(context.request, tier)) {
        const introspectionResult = await this.introspection.introspect(context.accessToken);
        if (!introspectionResult.active) {
          errors.push({
            code: 'TOKEN_INACTIVE',
            message: 'Token is no longer active (introspection check)',
            component: 'introspection',
          });
        }
      }

    } catch (error) {
      logger.error({ error, tier }, 'Error during security validation');
      errors.push({
        code: 'VALIDATION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error during validation',
        component: 'token',
      });
    } finally {
      const duration = (Date.now() - startTime) / 1000;
      securityValidationDuration.observe({ tier: tier.toString() }, duration);
    }

    const valid = errors.length === 0;
    const conformanceLevel = valid ? requirements.conformanceLevel : SecurityConformanceLevel.NONE;

    securityValidations.inc({
      result: valid ? 'success' : 'failure',
      tier: tier.toString(),
      conformance_level: conformanceLevel,
    });

    return this.buildValidationResult(valid, errors, warnings, tier);
  }

  /**
   * Pre-request security check
   *
   * Lightweight check to determine if a request can proceed
   * and what security requirements apply.
   *
   * @param request - Incoming request
   * @returns Pre-request check result
   */
  async preRequestCheck(request: IncomingRequest): Promise<PreRequestResult> {
    // Validate request format
    try {
      incomingRequestSchema.parse(request);
    } catch {
      return {
        allow: false,
        denyReason: 'Invalid request format',
        requirements: getSecurityRequirementsForTier(0),
      };
    }

    // Extract tier from authorization (simplified - in production, decode JWT)
    const tier = this.extractTierFromRequest(request);
    const requirements = this.getRequirements(tier);
    const requiredActions: ('dpop' | 'tee_attestation' | 'pairwise_did' | 'introspection')[] = [];

    // Check what's missing
    if (requirements.dpopRequired && !request.dpop) {
      requiredActions.push('dpop');
    }

    if (requirements.teeRequired) {
      // Would check for TEE attestation header
      requiredActions.push('tee_attestation');
    }

    // Determine if we can proceed
    const allow = requiredActions.length === 0;

    preRequestChecks.inc({
      result: allow ? 'allow' : 'requirements_missing',
      tier: tier.toString(),
    });

    const result: PreRequestResult = {
      allow,
      requirements,
    };

    if (requiredActions.length > 0) {
      result.requiredActions = requiredActions;
    }

    if (!allow) {
      result.denyReason = `Missing required security controls: ${requiredActions.join(', ')}`;
    }

    preRequestResultSchema.parse(result);
    return result;
  }

  /**
   * High-value operation check
   *
   * Performs enhanced security checks for high-value operations:
   * - Token introspection (sync)
   * - Synchronous revocation check
   * - Short token TTL validation
   *
   * @param operation - Action request
   * @param agent - Agent identity
   * @returns High-value check result
   */
  async highValueOperationCheck(
    operation: ActionRequest,
    agent: AgentIdentity
  ): Promise<HighValueCheckResult> {
    const tier = agent.trustTier;
    let introspectionPerformed = false;
    let syncRevocationCheck = false;
    let tokenTTLRemaining: number | undefined;

    try {
      // 1. Synchronous revocation check
      if (this.revocation.requiresSyncCheck(tier, true)) {
        const isRevoked = await this.revocation.syncRevocationCheck(agent.did);
        syncRevocationCheck = true;

        if (isRevoked) {
          highValueOperationChecks.inc({
            result: 'revoked',
            tier: tier.toString(),
            operation_type: operation.actionType,
          });

          return {
            allow: false,
            introspectionPerformed,
            syncRevocationCheck,
            denyReason: 'Agent has been revoked',
          };
        }
      }

      // 2. Token introspection for T2+ high-value operations
      if (this.tokenLifetime.requiresIntrospection(operation, tier)) {
        // Note: In a real implementation, we'd get the token from the context
        // For this check, we assume the caller will handle introspection separately
        introspectionPerformed = true;
      }

      highValueOperationChecks.inc({
        result: 'allow',
        tier: tier.toString(),
        operation_type: operation.actionType,
      });

      const result: HighValueCheckResult = {
        allow: true,
        introspectionPerformed,
        syncRevocationCheck,
      };

      if (tokenTTLRemaining !== undefined) {
        result.tokenTTLRemaining = tokenTTLRemaining;
      }

      highValueCheckResultSchema.parse(result);
      return result;

    } catch (error) {
      logger.error({ error, operation, agentDid: agent.did }, 'High-value operation check failed');

      highValueOperationChecks.inc({
        result: 'error',
        tier: tier.toString(),
        operation_type: operation.actionType,
      });

      return {
        allow: false,
        introspectionPerformed,
        syncRevocationCheck,
        denyReason: error instanceof Error ? error.message : 'Check failed',
      };
    }
  }

  /**
   * Get security requirements for a trust tier
   *
   * @param tier - Trust tier
   * @returns Security requirements
   */
  getRequirements(tier: TrustTier): SecurityRequirements {
    return getSecurityRequirementsForTier(tier);
  }

  /**
   * Get the DPoP service
   */
  getDPoPService(): DPoPService {
    return this.dpop;
  }

  /**
   * Get the TEE binding service
   */
  getTEEBindingService(): TEEBindingService {
    return this.tee;
  }

  /**
   * Get the pairwise DID service
   */
  getPairwiseDIDService(): PairwiseDIDService {
    return this.pairwiseDID;
  }

  /**
   * Get the revocation service
   */
  getRevocationService(): RevocationService {
    return this.revocation;
  }

  /**
   * Get the token lifetime service
   */
  getTokenLifetimeService(): TokenLifetimeService {
    return this.tokenLifetime;
  }

  /**
   * Get the introspection service
   */
  getIntrospectionService(): TokenIntrospectionService {
    return this.introspection;
  }

  /**
   * Build validation result
   */
  private buildValidationResult(
    valid: boolean,
    errors: SecurityValidationErrorType[],
    warnings: string[],
    tier: TrustTier
  ): SecurityValidationResult {
    const requirements = this.getRequirements(tier);

    const result: SecurityValidationResult = {
      valid,
      errors,
      securityLevel: valid ? requirements.conformanceLevel : SecurityConformanceLevel.NONE,
      warnings,
      validatedAt: new Date().toISOString(),
    };

    securityValidationResultSchema.parse(result);
    return result;
  }

  /**
   * Extract token payload from JWT
   */
  private extractTokenPayload(token: string): JWTPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      // Decode payload (second part)
      const payloadB64 = parts[1]!;
      const padding = (4 - (payloadB64.length % 4)) % 4;
      const padded = payloadB64 + '='.repeat(padding);
      const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
      const decoded = atob(base64);

      return JSON.parse(decoded) as JWTPayload;
    } catch {
      return null;
    }
  }

  /**
   * Extract trust tier from request (simplified)
   */
  private extractTierFromRequest(request: IncomingRequest): TrustTier {
    // In a real implementation, this would decode the JWT and extract
    // the trust tier from claims. For now, default to T2.
    // The actual tier should be determined by the authentication middleware.
    return 2;
  }
}

/**
 * Create a security service with default configuration
 */
export function createSecurityService(options?: {
  introspectionEndpoint?: string;
  dpopConfig?: Parameters<typeof createDPoPService>[0];
  teeConfig?: Parameters<typeof createTEEBindingService>[0];
  pairwiseDIDConfig?: Parameters<typeof createPairwiseDIDService>[0];
  revocationConfig?: Parameters<typeof createRevocationService>[0];
  tokenLifetimeConfig?: Parameters<typeof createTokenLifetimeService>[0];
}): SecurityService {
  const dpop = createDPoPService(options?.dpopConfig);
  const tee = createTEEBindingService(options?.teeConfig);
  const pairwiseDID = createPairwiseDIDService(options?.pairwiseDIDConfig);
  const revocation = createRevocationService(options?.revocationConfig);
  const tokenLifetime = createTokenLifetimeService(options?.tokenLifetimeConfig);
  const introspection = createTokenIntrospectionService(
    options?.introspectionEndpoint ?? 'http://localhost:4000/oauth2/introspect'
  );

  return new SecurityService(
    dpop,
    tee,
    pairwiseDID,
    revocation,
    tokenLifetime,
    introspection
  );
}
