/**
 * ACI Extension Service
 *
 * Main service for coordinating extension execution. Provides a high-level
 * API for processing capability requests, actions, and behavioral verification
 * through the registered extensions.
 *
 * @packageDocumentation
 * @module @vorion/aci-extensions/service
 * @license Apache-2.0
 */

import { createLogger } from '../common/logger.js';
import { NotFoundError, ValidationError } from '../common/errors.js';
import { ExtensionRegistry } from './registry.js';
import { ExtensionExecutor } from './executor.js';
import { parseExtensions } from './aci-string-extensions.js';
import type {
  ACIExtension,
  AgentIdentity,
  CapabilityRequest,
  CapabilityGrant,
  ActionRequest,
  ActionRecord,
  ActionResult,
  RevocationEvent,
  BehaviorVerificationResult,
  ExtensionServiceConfig,
  Constraint,
} from './types.js';

const logger = createLogger({ component: 'aci-extension-service' });

/**
 * Result of processing a capability request
 */
export interface CapabilityRequestResult {
  /** Whether the request was granted */
  granted: boolean;
  /** The capability grant if successful */
  grant?: CapabilityGrant;
  /** Denial reason if not granted */
  denialReason?: string;
  /** Extension that denied the request */
  deniedBy?: string;
  /** Extensions that were evaluated */
  extensionsEvaluated: string[];
}

/**
 * Result of processing an action
 */
export interface ActionProcessingResult {
  /** Whether the action was allowed to proceed */
  proceeded: boolean;
  /** The action result if executed */
  result?: ActionResult;
  /** Blocking reason if not allowed */
  blockingReason?: string;
  /** Extension that blocked the action */
  blockedBy?: string;
  /** Required approvals if any */
  requiredApprovals?: Array<{
    type: 'human' | 'system' | 'manager';
    approver?: string;
    timeout?: number;
  }>;
  /** Extensions that were evaluated */
  extensionsEvaluated: string[];
}

/**
 * ACI Extension Service
 *
 * Provides the main interface for integrating extensions into the
 * Vorion governance system. Coordinates extension loading, execution,
 * and result aggregation.
 *
 * @example
 * ```typescript
 * // Create service
 * const registry = new ExtensionRegistry();
 * const executor = new ExtensionExecutor(registry);
 * const service = new ACIExtensionService(registry, executor);
 *
 * // Register extensions
 * await service.registerExtension(cognigateExtension);
 * await service.registerExtension(auditExtension);
 *
 * // Process a capability request
 * const result = await service.processCapabilityRequest(agent, {
 *   domains: ['data', 'compute'],
 *   level: 3,
 *   context: { source: 'api', purpose: 'data-analysis' },
 * });
 *
 * if (result.granted) {
 *   console.log('Capability granted:', result.grant);
 * }
 * ```
 */
export class ACIExtensionService {
  private registry: ExtensionRegistry;
  private executor: ExtensionExecutor;
  private config: Required<ExtensionServiceConfig>;

  /**
   * Create a new extension service
   *
   * @param registry - Extension registry to use
   * @param executor - Extension executor to use
   * @param config - Optional service configuration
   */
  constructor(
    registry: ExtensionRegistry,
    executor: ExtensionExecutor,
    config?: ExtensionServiceConfig
  ) {
    this.registry = registry;
    this.executor = executor;
    this.config = {
      defaultTimeout: config?.defaultTimeout ?? 1000,
      failFast: config?.failFast ?? false,
      logExecution: config?.logExecution ?? true,
      maxConcurrency: config?.maxConcurrency ?? 10,
    };
  }

  // ===========================================================================
  // EXTENSION MANAGEMENT
  // ===========================================================================

  /**
   * Register an extension with the service
   *
   * @param extension - Extension to register
   */
  async registerExtension(extension: ACIExtension): Promise<void> {
    await this.registry.register(extension);
    logger.info(
      { extensionId: extension.extensionId, shortcode: extension.shortcode },
      'Extension registered with service'
    );
  }

  /**
   * Unregister an extension from the service
   *
   * @param extensionId - ID of extension to unregister
   */
  async unregisterExtension(extensionId: string): Promise<void> {
    await this.registry.unregister(extensionId);
    logger.info({ extensionId }, 'Extension unregistered from service');
  }

  /**
   * Load extensions for an agent based on their ACI string
   *
   * Parses the ACI string's extension suffix and returns the
   * corresponding registered extensions.
   *
   * @param aci - Agent's ACI string (may include #extension suffixes)
   * @returns Array of loaded extensions
   *
   * @example
   * ```typescript
   * // ACI: a3i.vorion.agent:FHC-L3@1.0.0#gov,audit
   * const extensions = service.loadAgentExtensions(agent.aci);
   * // Returns [cognigateExtension, auditExtension]
   * ```
   */
  loadAgentExtensions(aci: string): ACIExtension[] {
    const { extensions: shortcodes } = parseExtensions(aci);

    if (shortcodes.length === 0) {
      logger.debug({ aci }, 'No extensions declared in ACI string');
      return [];
    }

    const extensions = this.registry.getManyByShortcode(shortcodes);

    if (extensions.length < shortcodes.length) {
      const loaded = extensions.map((e) => e.shortcode);
      const missing = shortcodes.filter((s) => !loaded.includes(s));
      logger.warn(
        { aci, requested: shortcodes, loaded, missing },
        'Some requested extensions not found'
      );
    }

    return extensions;
  }

  /**
   * Get extension IDs for an agent
   *
   * @param aci - Agent's ACI string
   * @returns Array of extension IDs
   */
  getAgentExtensionIds(aci: string): string[] {
    return this.loadAgentExtensions(aci).map((e) => e.extensionId);
  }

  // ===========================================================================
  // CAPABILITY PROCESSING
  // ===========================================================================

  /**
   * Process a capability request through all applicable extensions
   *
   * Executes preCheck hooks from all extensions, and if all allow,
   * creates a capability grant and runs postGrant hooks.
   *
   * @param agent - Agent making the request
   * @param request - Capability request
   * @returns Result of processing the request
   */
  async processCapabilityRequest(
    agent: AgentIdentity,
    request: CapabilityRequest
  ): Promise<CapabilityRequestResult> {
    const extensionIds = this.getAgentExtensionIds(agent.aci);

    if (extensionIds.length === 0) {
      logger.debug(
        { agentDid: agent.did },
        'No extensions to evaluate for capability request'
      );

      // No extensions - grant by default
      const grant = this.createDefaultGrant(agent, request);
      return {
        granted: true,
        grant,
        extensionsEvaluated: [],
      };
    }

    // Execute pre-check hooks
    const preCheckResult = await this.executor.executeCapabilityPreCheck(
      extensionIds,
      agent,
      request
    );

    if (!preCheckResult.allow) {
      logger.info(
        {
          agentDid: agent.did,
          deniedBy: preCheckResult.deniedBy,
          reason: preCheckResult.denialReason,
        },
        'Capability request denied by extension'
      );

      return {
        granted: false,
        denialReason: preCheckResult.denialReason,
        deniedBy: preCheckResult.deniedBy,
        extensionsEvaluated: extensionIds,
      };
    }

    // Create initial grant
    let grant = this.createDefaultGrant(agent, request, preCheckResult.constraints);

    // Execute post-grant hooks
    grant = await this.executor.executeCapabilityPostGrant(
      extensionIds,
      agent,
      grant
    );

    logger.info(
      {
        agentDid: agent.did,
        grantId: grant.id,
        extensionCount: extensionIds.length,
      },
      'Capability granted'
    );

    return {
      granted: true,
      grant,
      extensionsEvaluated: extensionIds,
    };
  }

  // ===========================================================================
  // ACTION PROCESSING
  // ===========================================================================

  /**
   * Process an action through all applicable extensions
   *
   * Executes preAction hooks, and if all allow, executes the action
   * and runs postAction hooks. If the action fails, runs onFailure hooks.
   *
   * @param agent - Agent performing the action
   * @param actionRequest - Action to perform
   * @param executeAction - Function to execute the actual action
   * @returns Result of processing the action
   */
  async processAction(
    agent: AgentIdentity,
    actionRequest: ActionRequest,
    executeAction?: (request: ActionRequest) => Promise<ActionResult>
  ): Promise<ActionProcessingResult> {
    const extensionIds = this.getAgentExtensionIds(agent.aci);

    // Execute pre-action hooks
    const preActionResult = await this.executor.executeActionPreAction(
      extensionIds,
      agent,
      actionRequest
    );

    if (!preActionResult.proceed) {
      // Check if it's a required approval situation
      if (preActionResult.requiredApprovals && preActionResult.requiredApprovals.length > 0) {
        logger.info(
          {
            agentDid: agent.did,
            actionType: actionRequest.type,
            approvalsRequired: preActionResult.requiredApprovals.length,
          },
          'Action requires approval'
        );

        return {
          proceeded: false,
          blockingReason: preActionResult.blockingReason,
          blockedBy: preActionResult.blockedBy,
          requiredApprovals: preActionResult.requiredApprovals,
          extensionsEvaluated: extensionIds,
        };
      }

      logger.info(
        {
          agentDid: agent.did,
          actionType: actionRequest.type,
          blockedBy: preActionResult.blockedBy,
          reason: preActionResult.blockingReason,
        },
        'Action blocked by extension'
      );

      return {
        proceeded: false,
        blockingReason: preActionResult.blockingReason,
        blockedBy: preActionResult.blockedBy,
        extensionsEvaluated: extensionIds,
      };
    }

    // Apply any modifications to the request
    let modifiedRequest = actionRequest;
    if (preActionResult.modifications && preActionResult.modifications.length > 0) {
      modifiedRequest = this.applyModifications(
        actionRequest,
        preActionResult.modifications
      );
    }

    // Execute the action
    const actionRecord: ActionRecord = {
      ...modifiedRequest,
      id: crypto.randomUUID(),
      startedAt: new Date(),
    };

    let result: ActionResult;
    let error: Error | undefined;

    try {
      if (executeAction) {
        result = await executeAction(modifiedRequest);
      } else {
        // Default: succeed with no data
        result = { success: true };
      }

      actionRecord.completedAt = new Date();
      actionRecord.result = result;
    } catch (e) {
      error = e instanceof Error ? e : new Error(String(e));
      actionRecord.completedAt = new Date();
      actionRecord.error = error;
      result = { success: false };
    }

    // Execute post-action hooks
    await this.executor.executeActionPostAction(extensionIds, agent, actionRecord);

    // Handle failure if needed
    if (error) {
      const failureResponse = await this.executor.executeActionOnFailure(
        extensionIds,
        agent,
        actionRecord,
        error
      );

      logger.info(
        {
          agentDid: agent.did,
          actionId: actionRecord.id,
          retry: failureResponse.retry,
        },
        'Action failed, failure handlers executed'
      );

      // In a real implementation, you might retry based on failureResponse
    }

    return {
      proceeded: true,
      result,
      extensionsEvaluated: extensionIds,
    };
  }

  // ===========================================================================
  // BEHAVIORAL VERIFICATION
  // ===========================================================================

  /**
   * Run behavioral verification for an agent
   *
   * Collects metrics and runs behavior verification hooks from all
   * applicable extensions.
   *
   * @param agent - Agent to verify
   * @returns Behavior verification result
   */
  async verifyBehavior(agent: AgentIdentity): Promise<BehaviorVerificationResult> {
    const extensionIds = this.getAgentExtensionIds(agent.aci);

    if (extensionIds.length === 0) {
      // No extensions - behavior is within bounds by default
      return {
        inBounds: true,
        driftScore: 0,
        driftCategories: [],
        recommendation: 'continue',
        details: 'No extensions configured for behavioral verification',
      };
    }

    // First collect metrics
    const metricsReport = await this.executor.executeCollectMetrics(
      extensionIds,
      agent
    );

    // Build aggregated metrics for verification
    const now = new Date();
    const windowStart = new Date(now.getTime() - 60 * 60 * 1000); // Last hour

    // Use first extension's metrics as baseline (or aggregate)
    const firstReport = metricsReport.reports[0]?.report;
    const metrics = firstReport?.metrics ?? {
      windowStart,
      windowEnd: now,
      requestCount: 0,
      errorCount: 0,
      avgResponseTime: 0,
      p99ResponseTime: 0,
      actionsByType: {},
      domainsAccessed: [],
      maxLevelUsed: 0,
    };

    // Run behavior verification
    const verificationResult = await this.executor.executeVerifyBehavior(
      extensionIds,
      agent,
      metrics
    );

    logger.info(
      {
        agentDid: agent.did,
        inBounds: verificationResult.inBounds,
        driftScore: verificationResult.maxDriftScore,
        recommendation: verificationResult.recommendation,
      },
      'Behavior verification completed'
    );

    return {
      inBounds: verificationResult.inBounds,
      driftScore: verificationResult.maxDriftScore,
      driftCategories: verificationResult.driftCategories,
      recommendation: verificationResult.recommendation,
      details:
        verificationResult.results.length > 0
          ? `Verified by ${verificationResult.results.length} extensions`
          : 'No verification performed',
    };
  }

  // ===========================================================================
  // REVOCATION HANDLING
  // ===========================================================================

  /**
   * Handle a revocation event
   *
   * Propagates the revocation to all registered extensions that have
   * onRevocation handlers.
   *
   * @param revocation - Revocation event to handle
   */
  async handleRevocation(revocation: RevocationEvent): Promise<void> {
    // Get all registered extensions (not just agent's extensions)
    const allExtensions = this.registry.list();
    const extensionIds = allExtensions.map((e) => e.extensionId);

    await this.executor.executeOnRevocation(extensionIds, revocation);

    logger.info(
      {
        revocationId: revocation.id,
        agentDid: revocation.agentDid,
        scope: revocation.scope,
        extensionCount: extensionIds.length,
      },
      'Revocation event handled'
    );
  }

  // ===========================================================================
  // POLICY EVALUATION
  // ===========================================================================

  /**
   * Evaluate policies for a given context
   *
   * @param agent - Agent to evaluate policies for
   * @param action - Optional action being evaluated
   * @param capability - Optional capability being requested
   * @returns Policy decision
   */
  async evaluatePolicy(
    agent: AgentIdentity,
    action?: ActionRequest,
    capability?: CapabilityRequest
  ): Promise<{
    decision: 'allow' | 'deny' | 'require_approval';
    reasons: string[];
  }> {
    const extensionIds = this.getAgentExtensionIds(agent.aci);

    if (extensionIds.length === 0) {
      return {
        decision: 'allow',
        reasons: ['No policy extensions configured'],
      };
    }

    const now = new Date();
    const result = await this.executor.evaluatePolicy(extensionIds, {
      agent,
      action,
      capability,
      environment: {
        timeOfDay: now.toTimeString().slice(0, 5),
        dayOfWeek: [
          'Sunday',
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
        ][now.getDay()]!,
        isBusinessHours: now.getHours() >= 9 && now.getHours() < 17,
      },
      timestamp: now,
    });

    return {
      decision: result.decision,
      reasons: result.reasons,
    };
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  /**
   * Create a default capability grant
   */
  private createDefaultGrant(
    agent: AgentIdentity,
    request: CapabilityRequest,
    additionalConstraints?: Constraint[]
  ): CapabilityGrant {
    const now = new Date();
    const ttlMs = (request.ttl ?? 3600) * 1000;

    // Convert domain strings to bitmask (simplified)
    const domainBitmask = request.domains.reduce((mask, domain, index) => {
      return mask | (1 << index);
    }, 0);

    return {
      id: crypto.randomUUID(),
      aci: agent.aci,
      domains: domainBitmask,
      level: Math.min(request.level, agent.level),
      issuedAt: now,
      expiresAt: new Date(now.getTime() + ttlMs),
      constraints: additionalConstraints,
    };
  }

  /**
   * Apply modifications to an action request
   */
  private applyModifications(
    request: ActionRequest,
    modifications: Array<{
      field: string;
      original: unknown;
      modified: unknown;
      reason: string;
    }>
  ): ActionRequest {
    const modified = { ...request };

    for (const mod of modifications) {
      const parts = mod.field.split('.');
      let target: Record<string, unknown> = modified as unknown as Record<string, unknown>;

      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i]!;
        if (typeof target[part] === 'object' && target[part] !== null) {
          target = target[part] as Record<string, unknown>;
        }
      }

      const lastPart = parts[parts.length - 1]!;
      target[lastPart] = mod.modified;

      logger.debug(
        { field: mod.field, reason: mod.reason },
        'Action request modified by extension'
      );
    }

    return modified;
  }
}

/**
 * Create a new ACI Extension Service with default configuration
 *
 * @param config - Optional service configuration
 * @returns Configured extension service
 *
 * @example
 * ```typescript
 * const service = createExtensionService();
 *
 * // Register built-in extensions
 * await service.registerExtension(cognigateExtension);
 * await service.registerExtension(monitoringExtension);
 * await service.registerExtension(auditExtension);
 *
 * // Use the service
 * const result = await service.processCapabilityRequest(agent, request);
 * ```
 */
export function createExtensionService(
  config?: ExtensionServiceConfig
): ACIExtensionService {
  const registry = new ExtensionRegistry();
  const executor = new ExtensionExecutor(registry, config);
  return new ACIExtensionService(registry, executor, config);
}

/**
 * Create an extension service with a pre-configured registry
 *
 * @param registry - Pre-configured registry
 * @param config - Optional service configuration
 * @returns Configured extension service
 */
export function createExtensionServiceWithRegistry(
  registry: ExtensionRegistry,
  config?: ExtensionServiceConfig
): ACIExtensionService {
  const executor = new ExtensionExecutor(registry, config);
  return new ACIExtensionService(registry, executor, config);
}
