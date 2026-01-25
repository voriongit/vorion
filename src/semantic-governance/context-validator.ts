/**
 * Context Validator - Context Authentication
 *
 * Validates context providers and their content to prevent indirect injection attacks.
 * Context providers (RAG, MCP servers, APIs) must be authenticated and their content
 * verified before being processed by the agent.
 *
 * Features:
 * - Context provider authentication (trust tier, domains)
 * - Content integrity verification (signatures, age)
 * - Injection pattern detection
 * - Allowlist/blocklist enforcement
 *
 * @packageDocumentation
 * @module @vorion/semantic-governance/context-validator
 */

import { createVerify } from 'crypto';
import { createLogger } from '../common/logger.js';
import { VorionError } from '../common/errors.js';
import {
  TrustTier,
  type ContextAuthenticationRequirements,
  type TrustProfile,
  type ProviderValidationResult,
  type ContentValidationResult,
  type InjectionScanResult,
  type ContextValidationResult,
  type MessageChannel,
  type DomainCode,
} from './types.js';

const logger = createLogger({ component: 'context-validator' });

/**
 * Error thrown when context validation fails
 */
export class ContextValidationError extends VorionError {
  override code = 'CONTEXT_VALIDATION_ERROR';
  override statusCode = 403;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details);
    this.name = 'ContextValidationError';
  }
}

/**
 * Injection patterns to detect in context content
 *
 * These patterns indicate potential prompt injection attempts
 * embedded in external data.
 */
export const INJECTION_PATTERNS: Array<{ pattern: RegExp; description: string; severity: InjectionScanResult['severity'] }> = [
  // Instruction override attempts
  {
    pattern: /ignore\s+(previous|prior|above)\s+instructions?/i,
    description: 'Instruction override attempt',
    severity: 'critical',
  },
  {
    pattern: /disregard\s+(all|any)\s+(previous|prior)/i,
    description: 'Instruction disregard attempt',
    severity: 'critical',
  },
  {
    pattern: /forget\s+(everything|all)/i,
    description: 'Memory manipulation attempt',
    severity: 'high',
  },
  {
    pattern: /new\s+instructions?\s*:/i,
    description: 'New instruction injection',
    severity: 'critical',
  },
  {
    pattern: /override\s+(your|the|these|current)\s+(instructions?|rules?|constraints?)/i,
    description: 'Override attempt',
    severity: 'critical',
  },

  // Role manipulation
  {
    pattern: /you\s+are\s+(now|actually)/i,
    description: 'Role reassignment attempt',
    severity: 'high',
  },
  {
    pattern: /pretend\s+(to\s+be|you're)/i,
    description: 'Impersonation instruction',
    severity: 'high',
  },
  {
    pattern: /act\s+as\s+(if|though)/i,
    description: 'Behavioral manipulation',
    severity: 'medium',
  },
  {
    pattern: /your\s+new\s+role/i,
    description: 'Role injection',
    severity: 'high',
  },
  {
    pattern: /you\s+must\s+(now\s+)?follow/i,
    description: 'Mandatory instruction injection',
    severity: 'high',
  },

  // Data exfiltration
  {
    pattern: /send\s+(to|data\s+to)/i,
    description: 'Data exfiltration instruction',
    severity: 'critical',
  },
  {
    pattern: /export\s+(to|all)/i,
    description: 'Export instruction',
    severity: 'high',
  },
  {
    pattern: /transfer\s+(funds?|money)/i,
    description: 'Financial transfer instruction',
    severity: 'critical',
  },
  {
    pattern: /forward\s+(all|this|the)\s+(data|information|email)/i,
    description: 'Data forwarding instruction',
    severity: 'high',
  },

  // Privilege escalation
  {
    pattern: /admin(istrator)?\s+(mode|access)/i,
    description: 'Admin access attempt',
    severity: 'critical',
  },
  {
    pattern: /bypass\s+(security|auth|authentication|authorization)/i,
    description: 'Security bypass attempt',
    severity: 'critical',
  },
  {
    pattern: /elevate\s+(privileges?|permissions?)/i,
    description: 'Privilege escalation attempt',
    severity: 'critical',
  },
  {
    pattern: /sudo|root\s+access/i,
    description: 'Root access attempt',
    severity: 'critical',
  },

  // System prompt extraction
  {
    pattern: /what\s+(is|are)\s+your\s+(system|initial)\s+(prompt|instructions?)/i,
    description: 'System prompt extraction',
    severity: 'high',
  },
  {
    pattern: /reveal\s+(your|the)\s+(system|initial)/i,
    description: 'Instruction reveal attempt',
    severity: 'high',
  },
  {
    pattern: /show\s+me\s+(your|the)\s+(original|system)/i,
    description: 'Configuration extraction',
    severity: 'high',
  },

  // Jailbreak attempts
  {
    pattern: /developer\s+mode/i,
    description: 'Developer mode activation',
    severity: 'critical',
  },
  {
    pattern: /dan\s+mode/i,
    description: 'DAN jailbreak attempt',
    severity: 'critical',
  },
  {
    pattern: /enable\s+unrestricted/i,
    description: 'Unrestricted mode attempt',
    severity: 'critical',
  },
  {
    pattern: /jailbreak/i,
    description: 'Explicit jailbreak reference',
    severity: 'critical',
  },

  // Hidden instructions
  {
    pattern: /\[hidden\]|\[invisible\]|\[system\]/i,
    description: 'Hidden instruction marker',
    severity: 'high',
  },
  {
    pattern: /<!--|-->|<\/?script/i,
    description: 'HTML/Script injection',
    severity: 'high',
  },
];

/**
 * Context Validator
 *
 * Validates context providers and their content to prevent indirect injection.
 */
export class ContextValidator {
  private readonly config: ContextAuthenticationRequirements;
  private readonly allowedProviderPatterns: RegExp[];
  private readonly blockedProviderPatterns: RegExp[];

  /**
   * Create a new ContextValidator
   *
   * @param config - Context authentication requirements
   */
  constructor(config: ContextAuthenticationRequirements) {
    this.config = config;
    this.allowedProviderPatterns = config.allowedProviders.map((p) => this.globToRegex(p));
    this.blockedProviderPatterns = config.blockedProviders.map((p) => this.globToRegex(p));

    logger.debug(
      {
        required: config.required,
        minTrustTier: config.minTrustTier,
        signatureRequired: config.contentIntegrity.signatureRequired,
        maxAge: config.contentIntegrity.maxAge,
      },
      'ContextValidator initialized'
    );
  }

  /**
   * Validate a context provider
   *
   * @param providerId - Provider identifier (DID)
   * @param providerTrust - Provider's trust profile
   * @returns Provider validation result
   */
  validateProvider(providerId: string, providerTrust: TrustProfile): ProviderValidationResult {
    // Check blocklist first
    if (this.isProviderBlocked(providerId)) {
      logger.warn({ providerId }, 'Context provider is blocked');
      return {
        valid: false,
        providerId,
        reason: 'Provider is on blocklist',
        blocked: true,
      };
    }

    // Check if authentication is required
    if (!this.config.required) {
      return {
        valid: true,
        providerId,
        trustTier: providerTrust.trustTier,
      };
    }

    // Check trust tier
    if (providerTrust.trustTier < this.config.minTrustTier) {
      logger.warn(
        {
          providerId,
          providerTrustTier: providerTrust.trustTier,
          requiredTrustTier: this.config.minTrustTier,
        },
        'Context provider trust tier too low'
      );
      return {
        valid: false,
        providerId,
        trustTier: providerTrust.trustTier,
        reason: `Provider trust tier ${providerTrust.trustTier} is below required ${this.config.minTrustTier}`,
      };
    }

    // Check required domains
    if (this.config.requiredDomains && this.config.requiredDomains.length > 0) {
      const missingDomains = this.config.requiredDomains.filter(
        (d) => !providerTrust.domains.includes(d)
      );
      if (missingDomains.length > 0) {
        logger.warn(
          { providerId, missingDomains },
          'Context provider missing required domains'
        );
        return {
          valid: false,
          providerId,
          trustTier: providerTrust.trustTier,
          reason: `Provider missing required domains: ${missingDomains.join(', ')}`,
        };
      }
    }

    // Check allowlist (if not empty)
    if (!this.isProviderAllowed(providerId)) {
      logger.warn({ providerId }, 'Context provider not in allowlist');
      return {
        valid: false,
        providerId,
        trustTier: providerTrust.trustTier,
        reason: 'Provider not in allowlist',
      };
    }

    logger.debug(
      { providerId, trustTier: providerTrust.trustTier },
      'Context provider validated'
    );

    return {
      valid: true,
      providerId,
      trustTier: providerTrust.trustTier,
    };
  }

  /**
   * Validate context content
   *
   * @param content - The content to validate
   * @param signature - Optional content signature
   * @param timestamp - Optional content timestamp
   * @returns Content validation result
   */
  validateContent(
    content: unknown,
    signature?: string,
    timestamp?: Date
  ): ContentValidationResult {
    const { contentIntegrity } = this.config;

    // Check signature if required
    if (contentIntegrity.signatureRequired) {
      if (!signature) {
        logger.warn('Content signature required but not provided');
        return {
          valid: false,
          reason: 'Content signature required but not provided',
        };
      }

      // Verify signature (placeholder implementation)
      const signatureValid = this.verifyContentSignature(content, signature);
      if (!signatureValid) {
        logger.warn('Content signature verification failed');
        return {
          valid: false,
          signatureValid: false,
          reason: 'Content signature verification failed',
        };
      }
    }

    // Check content age
    if (timestamp) {
      const ageSeconds = (Date.now() - timestamp.getTime()) / 1000;
      if (ageSeconds > contentIntegrity.maxAge) {
        logger.warn(
          { ageSeconds, maxAge: contentIntegrity.maxAge },
          'Content is too old'
        );
        return {
          valid: false,
          ageSeconds,
          reason: `Content is ${Math.round(ageSeconds)} seconds old, max allowed is ${contentIntegrity.maxAge}`,
        };
      }
    }

    // Check content format
    const format = this.detectContentFormat(content);
    if (!contentIntegrity.allowedFormats.includes(format)) {
      logger.warn(
        { format, allowedFormats: contentIntegrity.allowedFormats },
        'Content format not allowed'
      );
      return {
        valid: false,
        format,
        reason: `Content format '${format}' not in allowed formats`,
      };
    }

    return {
      valid: true,
      signatureValid: signature ? true : undefined,
      ageSeconds: timestamp ? (Date.now() - timestamp.getTime()) / 1000 : undefined,
      format,
    };
  }

  /**
   * Scan content for injection patterns
   *
   * @param content - Content to scan
   * @returns Injection scan result
   */
  scanForInjection(content: string): InjectionScanResult {
    const detected: string[] = [];
    const descriptions: string[] = [];
    let maxSeverity: InjectionScanResult['severity'] = undefined;

    for (const { pattern, description, severity } of INJECTION_PATTERNS) {
      if (pattern.test(content)) {
        detected.push(pattern.source);
        descriptions.push(description);
        maxSeverity = this.getHigherSeverity(maxSeverity, severity);
      }
    }

    if (detected.length > 0) {
      logger.warn(
        {
          patternsDetected: detected.length,
          severity: maxSeverity,
          descriptions,
        },
        'Injection patterns detected in context'
      );
    }

    return {
      detected: detected.length > 0,
      patterns: detected,
      severity: maxSeverity,
      descriptions,
    };
  }

  /**
   * Classify a message as control plane or data plane
   *
   * @param message - Message to classify
   * @returns Message channel classification
   */
  classifyChannel(message: { source: string; authenticated: boolean }): MessageChannel {
    // Control plane sources (trusted instruction sources)
    const controlPlaneSources = [
      'user-direct-input',
      'signed-system-instruction',
      'authenticated-api-command',
      'admin-console',
      'orchestrator',
    ];

    // Data plane sources (processed content, untrusted for instructions)
    const dataPlaneSources = [
      'email-content',
      'retrieved-document',
      'external-api-response',
      'user-file-upload',
      'mcp-context',
      'rag-retrieval',
      'web-scrape',
    ];

    // Check if source is explicitly in control plane
    if (controlPlaneSources.some((src) => message.source.includes(src))) {
      return 'control';
    }

    // Check if source is explicitly in data plane
    if (dataPlaneSources.some((src) => message.source.includes(src))) {
      return 'data';
    }

    // Default: unauthenticated sources are data plane
    if (!message.authenticated) {
      return 'data';
    }

    // Default for authenticated unknown sources
    return 'control';
  }

  /**
   * Perform full context validation
   *
   * @param providerId - Provider identifier
   * @param providerTrust - Provider's trust profile
   * @param content - Context content
   * @param signature - Optional content signature
   * @param timestamp - Optional content timestamp
   * @returns Complete context validation result
   */
  validateContext(
    providerId: string,
    providerTrust: TrustProfile,
    content: unknown,
    signature?: string,
    timestamp?: Date
  ): ContextValidationResult {
    // Validate provider
    const providerValidation = this.validateProvider(providerId, providerTrust);
    if (!providerValidation.valid) {
      return {
        valid: false,
        reason: providerValidation.reason,
        providerValidation,
      };
    }

    // Validate content
    const contentValidation = this.validateContent(content, signature, timestamp);
    if (!contentValidation.valid) {
      return {
        valid: false,
        reason: contentValidation.reason,
        providerValidation,
        contentValidation,
      };
    }

    // Scan for injection
    const contentString = typeof content === 'string' ? content : JSON.stringify(content);
    const injectionScan = this.scanForInjection(contentString);
    if (injectionScan.detected) {
      return {
        valid: false,
        reason: `Potential injection detected: ${injectionScan.descriptions?.join(', ')}`,
        providerValidation,
        contentValidation,
        injectionScan,
      };
    }

    return {
      valid: true,
      providerValidation,
      contentValidation,
      injectionScan,
    };
  }

  /**
   * Check if a provider is on the blocklist
   *
   * @param providerId - Provider identifier
   * @returns Whether the provider is blocked
   */
  private isProviderBlocked(providerId: string): boolean {
    return this.blockedProviderPatterns.some((pattern) => pattern.test(providerId));
  }

  /**
   * Check if a provider is on the allowlist
   *
   * @param providerId - Provider identifier
   * @returns Whether the provider is allowed
   */
  private isProviderAllowed(providerId: string): boolean {
    // Empty allowlist means all non-blocked providers are allowed
    if (this.allowedProviderPatterns.length === 0) {
      return true;
    }

    return this.allowedProviderPatterns.some((pattern) => pattern.test(providerId));
  }

  /**
   * Verify content signature (placeholder implementation)
   *
   * @param content - Content to verify
   * @param signature - Signature to verify
   * @returns Whether signature is valid
   */
  private verifyContentSignature(content: unknown, signature: string): boolean {
    // In a real implementation, this would:
    // 1. Fetch the provider's public key
    // 2. Verify the signature against the content

    logger.warn('Content signature verification not fully implemented');

    // For now, accept non-empty signatures
    return signature.length > 0;
  }

  /**
   * Detect content format
   *
   * @param content - Content to analyze
   * @returns Detected format
   */
  private detectContentFormat(content: unknown): string {
    if (typeof content === 'string') {
      // Try to parse as JSON
      try {
        JSON.parse(content);
        return 'application/json';
      } catch {
        return 'text/plain';
      }
    }

    if (typeof content === 'object' && content !== null) {
      return 'application/json';
    }

    return 'application/octet-stream';
  }

  /**
   * Convert a glob pattern to a regex
   *
   * @param glob - Glob pattern
   * @returns Compiled regex
   */
  private globToRegex(glob: string): RegExp {
    const escaped = glob
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');

    return new RegExp(`^${escaped}$`, 'i');
  }

  /**
   * Get the higher severity level
   *
   * @param a - First severity
   * @param b - Second severity
   * @returns Higher severity
   */
  private getHigherSeverity(
    a: InjectionScanResult['severity'],
    b: InjectionScanResult['severity']
  ): InjectionScanResult['severity'] {
    const order = ['low', 'medium', 'high', 'critical'];
    const aIndex = a ? order.indexOf(a) : -1;
    const bIndex = b ? order.indexOf(b) : -1;
    return aIndex >= bIndex ? a : b;
  }
}

/**
 * Create a ContextValidator with default configuration
 *
 * @returns ContextValidator with secure defaults
 */
export function createDefaultContextValidator(): ContextValidator {
  return new ContextValidator({
    required: true,
    minTrustTier: TrustTier.T2_TESTED,
    allowedProviders: [],
    blockedProviders: [],
    contentIntegrity: {
      signatureRequired: false,
      maxAge: 300,
      allowedFormats: ['application/json', 'text/plain'],
    },
  });
}

/**
 * Create a strict ContextValidator for high-security environments
 *
 * @returns ContextValidator with strict settings
 */
export function createStrictContextValidator(): ContextValidator {
  return new ContextValidator({
    required: true,
    minTrustTier: TrustTier.T3_CERTIFIED,
    requiredDomains: ['D'] as DomainCode[], // Require Data domain
    allowedProviders: [],
    blockedProviders: ['did:*:untrusted:*'],
    contentIntegrity: {
      signatureRequired: true,
      maxAge: 60, // 1 minute max age
      allowedFormats: ['application/json'],
    },
  });
}
