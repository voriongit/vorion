/**
 * ACI Extension Executor
 *
 * Executes extension hooks in order with proper timeout handling,
 * error management, and result aggregation. This is the core engine
 * that drives the Layer 4 Runtime Assurance functionality.
 *
 * @packageDocumentation
 * @module @vorion/aci-extensions/executor
 * @license Apache-2.0
 */

import { createLogger } from '../common/logger.js';
import { TimeoutError, VorionError } from '../common/errors.js';
import type { ExtensionRegistry } from './registry.js';
import {
  HOOK_TIMEOUTS,
  type ACIExtension,
  type AgentIdentity,
  type CapabilityRequest,
  type CapabilityGrant,
  type ActionRequest,
  type ActionRecord,
  type BehaviorMetrics,
  type AnomalyReport,
  type RevocationEvent,
  type TrustAdjustment,
  type PolicyContext,
  type PreCheckResult,
  type PreActionResult,
  type FailureResponse,
  type BehaviorVerificationResult,
  type MetricsReport,
  type AnomalyResponse,
  type TrustAdjustmentResult,
  type PolicyDecision,
  type AggregatedPreCheckResult,
  type AggregatedPreActionResult,
  type AggregatedFailureResponse,
  type AggregatedBehaviorResult,
  type AggregatedMetricsReport,
  type AggregatedAnomalyResponse,
  type AggregatedTrustResult,
  type AggregatedPolicyDecision,
  type TrustTier,
  type HookTimeout,
  type ExtensionServiceConfig,
} from './types.js';

const logger = createLogger({ component: 'aci-extension-executor' });

/**
 * Action severity ordering for determining "most severe"
 */
const ANOMALY_ACTION_SEVERITY: Record<string, number> = {
  ignore: 0,
  log: 1,
  alert: 2,
  suspend: 3,
  revoke: 4,
};

/**
 * Recommendation severity ordering
 */
const RECOMMENDATION_SEVERITY: Record<string, number> = {
  continue: 0,
  warn: 1,
  suspend: 2,
  revoke: 3,
};

/**
 * Policy decision priority (deny > require_approval > allow)
 */
const DECISION_PRIORITY: Record<string, number> = {
  allow: 0,
  require_approval: 1,
  deny: 2,
};

/**
 * Convert trust score to tier
 */
function scoreToTier(score: number): TrustTier {
  if (score >= 900) return 5;
  if (score >= 700) return 4;
  if (score >= 500) return 3;
  if (score >= 300) return 2;
  if (score >= 100) return 1;
  return 0;
}

/**
 * Extension Hook Executor
 *
 * Executes extension hooks with:
 * - Timeout enforcement per hook type
 * - Error isolation between extensions
 * - Result aggregation according to protocol rules
 * - Logging and observability
 *
 * @example
 * ```typescript
 * const executor = new ExtensionExecutor(registry, {
 *   defaultTimeout: 1000,
 *   failFast: false,
 *   logExecution: true,
 * });
 *
 * const result = await executor.executeCapabilityPreCheck(
 *   ['aci-ext-governance-v1', 'aci-ext-audit-v1'],
 *   agent,
 *   request
 * );
 * ```
 */
export class ExtensionExecutor {
  private registry: ExtensionRegistry;
  private config: Required<ExtensionServiceConfig>;

  /**
   * Create a new executor
   *
   * @param registry - The extension registry to use
   * @param config - Optional configuration
   */
  constructor(registry: ExtensionRegistry, config?: ExtensionServiceConfig) {
    this.registry = registry;
    this.config = {
      defaultTimeout: config?.defaultTimeout ?? 1000,
      failFast: config?.failFast ?? false,
      logExecution: config?.logExecution ?? true,
      maxConcurrency: config?.maxConcurrency ?? 10,
    };
  }

  // ===========================================================================
  // CAPABILITY HOOKS
  // ===========================================================================

  /**
   * Execute capability pre-check hooks
   *
   * All extensions must return allow=true for the request to be allowed.
   * Constraints from all extensions are combined.
   *
   * @param extensionIds - Extension IDs to execute
   * @param agent - Agent identity
   * @param request - Capability request
   * @returns Aggregated result from all extensions
   */
  async executeCapabilityPreCheck(
    extensionIds: string[],
    agent: AgentIdentity,
    request: CapabilityRequest
  ): Promise<AggregatedPreCheckResult> {
    const results: Array<{ extensionId: string; result: PreCheckResult }> = [];
    const allConstraints: AggregatedPreCheckResult['constraints'] = [];
    let allow = true;
    let denialReason: string | undefined;
    let deniedBy: string | undefined;

    for (const extensionId of extensionIds) {
      const extension = this.registry.get(extensionId);
      if (!extension?.capability?.preCheck) {
        continue;
      }

      try {
        const result = await this.executeWithTimeout(
          () => extension.capability!.preCheck!(agent, request),
          'preCheck',
          extensionId
        );

        results.push({ extensionId, result });

        if (result.constraints) {
          allConstraints.push(...result.constraints);
        }

        if (!result.allow) {
          allow = false;
          denialReason = denialReason ?? result.reason;
          deniedBy = deniedBy ?? extensionId;

          if (this.config.failFast) {
            break;
          }
        }
      } catch (error) {
        // Extension errors are treated as deny
        const errorResult: PreCheckResult = {
          allow: false,
          reason: `Extension error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
        results.push({ extensionId, result: errorResult });
        allow = false;
        denialReason = denialReason ?? errorResult.reason;
        deniedBy = deniedBy ?? extensionId;

        this.logHookError('preCheck', extensionId, error);

        if (this.config.failFast) {
          break;
        }
      }
    }

    const aggregated: AggregatedPreCheckResult = {
      allow,
      results,
      constraints: allConstraints,
      denialReason,
      deniedBy,
    };

    if (this.config.logExecution) {
      logger.info(
        {
          hook: 'capability.preCheck',
          agentDid: agent.did,
          extensionCount: extensionIds.length,
          executedCount: results.length,
          allow,
          deniedBy,
        },
        'Capability pre-check completed'
      );
    }

    return aggregated;
  }

  /**
   * Execute capability post-grant hooks
   *
   * Each extension can modify the grant (e.g., add constraints).
   * Modifications are applied in extension order.
   *
   * @param extensionIds - Extension IDs to execute
   * @param agent - Agent identity
   * @param grant - Capability grant to modify
   * @returns Modified capability grant
   */
  async executeCapabilityPostGrant(
    extensionIds: string[],
    agent: AgentIdentity,
    grant: CapabilityGrant
  ): Promise<CapabilityGrant> {
    let modifiedGrant = { ...grant };

    for (const extensionId of extensionIds) {
      const extension = this.registry.get(extensionId);
      if (!extension?.capability?.postGrant) {
        continue;
      }

      try {
        modifiedGrant = await this.executeWithTimeout(
          () => extension.capability!.postGrant!(agent, modifiedGrant),
          'postGrant',
          extensionId
        );
      } catch (error) {
        this.logHookError('postGrant', extensionId, error);
        // Continue with unmodified grant on error
      }
    }

    if (this.config.logExecution) {
      logger.info(
        {
          hook: 'capability.postGrant',
          agentDid: agent.did,
          grantId: grant.id,
          extensionCount: extensionIds.length,
        },
        'Capability post-grant completed'
      );
    }

    return modifiedGrant;
  }

  // ===========================================================================
  // ACTION HOOKS
  // ===========================================================================

  /**
   * Execute pre-action hooks
   *
   * All extensions must return proceed=true for the action to proceed.
   * Modifications and approval requirements are combined.
   *
   * @param extensionIds - Extension IDs to execute
   * @param agent - Agent identity
   * @param action - Action request
   * @returns Aggregated result from all extensions
   */
  async executeActionPreAction(
    extensionIds: string[],
    agent: AgentIdentity,
    action: ActionRequest
  ): Promise<AggregatedPreActionResult> {
    const results: Array<{ extensionId: string; result: PreActionResult }> = [];
    const allModifications: AggregatedPreActionResult['modifications'] = [];
    const allApprovals: AggregatedPreActionResult['requiredApprovals'] = [];
    let proceed = true;
    let blockingReason: string | undefined;
    let blockedBy: string | undefined;

    for (const extensionId of extensionIds) {
      const extension = this.registry.get(extensionId);
      if (!extension?.action?.preAction) {
        continue;
      }

      try {
        const result = await this.executeWithTimeout(
          () => extension.action!.preAction!(agent, action),
          'preAction',
          extensionId
        );

        results.push({ extensionId, result });

        if (result.modifications) {
          allModifications.push(...result.modifications);
        }

        if (result.requiredApprovals) {
          allApprovals.push(...result.requiredApprovals);
        }

        if (!result.proceed) {
          proceed = false;
          blockingReason = blockingReason ?? result.reason;
          blockedBy = blockedBy ?? extensionId;

          if (this.config.failFast) {
            break;
          }
        }
      } catch (error) {
        const errorResult: PreActionResult = {
          proceed: false,
          reason: `Extension error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
        results.push({ extensionId, result: errorResult });
        proceed = false;
        blockingReason = blockingReason ?? errorResult.reason;
        blockedBy = blockedBy ?? extensionId;

        this.logHookError('preAction', extensionId, error);

        if (this.config.failFast) {
          break;
        }
      }
    }

    const aggregated: AggregatedPreActionResult = {
      proceed,
      results,
      modifications: allModifications,
      requiredApprovals: allApprovals,
      blockingReason,
      blockedBy,
    };

    if (this.config.logExecution) {
      logger.info(
        {
          hook: 'action.preAction',
          agentDid: agent.did,
          actionType: action.type,
          extensionCount: extensionIds.length,
          executedCount: results.length,
          proceed,
          blockedBy,
        },
        'Action pre-action completed'
      );
    }

    return aggregated;
  }

  /**
   * Execute post-action hooks
   *
   * Called after action execution for logging/audit purposes.
   * Errors are logged but do not affect the action result.
   *
   * @param extensionIds - Extension IDs to execute
   * @param agent - Agent identity
   * @param action - Action record
   */
  async executeActionPostAction(
    extensionIds: string[],
    agent: AgentIdentity,
    action: ActionRecord
  ): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const extensionId of extensionIds) {
      const extension = this.registry.get(extensionId);
      if (!extension?.action?.postAction) {
        continue;
      }

      promises.push(
        this.executeWithTimeout(
          () => extension.action!.postAction!(agent, action),
          'postAction',
          extensionId
        ).catch((error) => {
          this.logHookError('postAction', extensionId, error);
        })
      );
    }

    await Promise.all(promises);

    if (this.config.logExecution) {
      logger.info(
        {
          hook: 'action.postAction',
          agentDid: agent.did,
          actionId: action.id,
          extensionCount: extensionIds.length,
        },
        'Action post-action completed'
      );
    }
  }

  /**
   * Execute failure handler hooks
   *
   * Determines retry behavior and fallback actions.
   * Takes the most permissive retry suggestion and first fallback.
   *
   * @param extensionIds - Extension IDs to execute
   * @param agent - Agent identity
   * @param action - Failed action record
   * @param error - Error that occurred
   * @returns Aggregated failure response
   */
  async executeActionOnFailure(
    extensionIds: string[],
    agent: AgentIdentity,
    action: ActionRecord,
    error: Error
  ): Promise<AggregatedFailureResponse> {
    const results: Array<{ extensionId: string; result: FailureResponse }> = [];
    let retry = false;
    let minRetryDelay: number | undefined;
    let minMaxRetries: number | undefined;
    let firstFallback: ActionRequest | undefined;

    for (const extensionId of extensionIds) {
      const extension = this.registry.get(extensionId);
      if (!extension?.action?.onFailure) {
        continue;
      }

      try {
        const result = await this.executeWithTimeout(
          () => extension.action!.onFailure!(agent, action, error),
          'onFailure',
          extensionId
        );

        results.push({ extensionId, result });

        if (result.retry) {
          retry = true;
          if (result.retryDelay !== undefined) {
            minRetryDelay =
              minRetryDelay === undefined
                ? result.retryDelay
                : Math.min(minRetryDelay, result.retryDelay);
          }
          if (result.maxRetries !== undefined) {
            minMaxRetries =
              minMaxRetries === undefined
                ? result.maxRetries
                : Math.min(minMaxRetries, result.maxRetries);
          }
        }

        if (result.fallback && !firstFallback) {
          firstFallback = result.fallback;
        }
      } catch (hookError) {
        this.logHookError('onFailure', extensionId, hookError);
      }
    }

    const aggregated: AggregatedFailureResponse = {
      retry,
      retryDelay: minRetryDelay,
      maxRetries: minMaxRetries,
      fallback: firstFallback,
      results,
    };

    if (this.config.logExecution) {
      logger.info(
        {
          hook: 'action.onFailure',
          agentDid: agent.did,
          actionId: action.id,
          extensionCount: extensionIds.length,
          retry,
        },
        'Action failure handling completed'
      );
    }

    return aggregated;
  }

  // ===========================================================================
  // MONITORING HOOKS
  // ===========================================================================

  /**
   * Execute behavior verification hooks
   *
   * Returns the most severe recommendation and whether any extension
   * found behavior out of bounds.
   *
   * @param extensionIds - Extension IDs to execute
   * @param agent - Agent identity
   * @param metrics - Behavior metrics to verify
   * @returns Aggregated verification result
   */
  async executeVerifyBehavior(
    extensionIds: string[],
    agent: AgentIdentity,
    metrics: BehaviorMetrics
  ): Promise<AggregatedBehaviorResult> {
    const results: Array<{
      extensionId: string;
      result: BehaviorVerificationResult;
    }> = [];
    let inBounds = true;
    let maxDriftScore = 0;
    const allDriftCategories: Set<string> = new Set();
    let recommendation: AggregatedBehaviorResult['recommendation'] = 'continue';

    for (const extensionId of extensionIds) {
      const extension = this.registry.get(extensionId);
      if (!extension?.monitoring?.verifyBehavior) {
        continue;
      }

      try {
        const result = await this.executeWithTimeout(
          () => extension.monitoring!.verifyBehavior!(agent, metrics),
          'verifyBehavior',
          extensionId
        );

        results.push({ extensionId, result });

        if (!result.inBounds) {
          inBounds = false;
        }

        if (result.driftScore > maxDriftScore) {
          maxDriftScore = result.driftScore;
        }

        for (const category of result.driftCategories) {
          allDriftCategories.add(category);
        }

        // Take most severe recommendation
        if (
          RECOMMENDATION_SEVERITY[result.recommendation]! >
          RECOMMENDATION_SEVERITY[recommendation]!
        ) {
          recommendation = result.recommendation;
        }
      } catch (error) {
        this.logHookError('verifyBehavior', extensionId, error);
      }
    }

    const aggregated: AggregatedBehaviorResult = {
      inBounds,
      maxDriftScore,
      driftCategories: Array.from(allDriftCategories),
      recommendation,
      results,
    };

    if (this.config.logExecution) {
      logger.info(
        {
          hook: 'monitoring.verifyBehavior',
          agentDid: agent.did,
          extensionCount: extensionIds.length,
          inBounds,
          maxDriftScore,
          recommendation,
        },
        'Behavior verification completed'
      );
    }

    return aggregated;
  }

  /**
   * Execute metrics collection hooks
   *
   * Collects metrics from all extensions and aggregates health status.
   *
   * @param extensionIds - Extension IDs to execute
   * @param agent - Agent identity
   * @returns Aggregated metrics report
   */
  async executeCollectMetrics(
    extensionIds: string[],
    agent: AgentIdentity
  ): Promise<AggregatedMetricsReport> {
    const reports: Array<{ extensionId: string; report: MetricsReport }> = [];
    let worstHealth: AggregatedMetricsReport['overallHealth'] = 'healthy';
    const healthOrder = { healthy: 0, degraded: 1, unhealthy: 2 };

    for (const extensionId of extensionIds) {
      const extension = this.registry.get(extensionId);
      if (!extension?.monitoring?.collectMetrics) {
        continue;
      }

      try {
        const report = await this.executeWithTimeout(
          () => extension.monitoring!.collectMetrics!(agent),
          'collectMetrics',
          extensionId
        );

        reports.push({ extensionId, report });

        if (healthOrder[report.health] > healthOrder[worstHealth]) {
          worstHealth = report.health;
        }
      } catch (error) {
        this.logHookError('collectMetrics', extensionId, error);
      }
    }

    const aggregated: AggregatedMetricsReport = {
      timestamp: new Date(),
      reports,
      overallHealth: worstHealth,
    };

    if (this.config.logExecution) {
      logger.info(
        {
          hook: 'monitoring.collectMetrics',
          agentDid: agent.did,
          extensionCount: extensionIds.length,
          reportCount: reports.length,
          overallHealth: worstHealth,
        },
        'Metrics collection completed'
      );
    }

    return aggregated;
  }

  /**
   * Execute anomaly handler hooks
   *
   * Returns the most severe action taken and aggregates notifications.
   *
   * @param extensionIds - Extension IDs to execute
   * @param agent - Agent identity
   * @param anomaly - Anomaly report
   * @returns Aggregated anomaly response
   */
  async executeOnAnomaly(
    extensionIds: string[],
    agent: AgentIdentity,
    anomaly: AnomalyReport
  ): Promise<AggregatedAnomalyResponse> {
    const results: Array<{ extensionId: string; result: AnomalyResponse }> = [];
    let mostSevereAction: AggregatedAnomalyResponse['action'] = 'ignore';
    const allNotified: Set<string> = new Set();
    let escalated = false;

    for (const extensionId of extensionIds) {
      const extension = this.registry.get(extensionId);
      if (!extension?.monitoring?.onAnomaly) {
        continue;
      }

      try {
        const result = await this.executeWithTimeout(
          () => extension.monitoring!.onAnomaly!(agent, anomaly),
          'onAnomaly',
          extensionId
        );

        results.push({ extensionId, result });

        // Take most severe action
        if (
          ANOMALY_ACTION_SEVERITY[result.action]! >
          ANOMALY_ACTION_SEVERITY[mostSevereAction]!
        ) {
          mostSevereAction = result.action;
        }

        if (result.notified) {
          for (const party of result.notified) {
            allNotified.add(party);
          }
        }

        if (result.escalated) {
          escalated = true;
        }
      } catch (error) {
        this.logHookError('onAnomaly', extensionId, error);
      }
    }

    const aggregated: AggregatedAnomalyResponse = {
      action: mostSevereAction,
      notified: Array.from(allNotified),
      escalated,
      results,
    };

    if (this.config.logExecution) {
      logger.info(
        {
          hook: 'monitoring.onAnomaly',
          agentDid: agent.did,
          anomalyId: anomaly.id,
          extensionCount: extensionIds.length,
          action: mostSevereAction,
          escalated,
        },
        'Anomaly handling completed'
      );
    }

    return aggregated;
  }

  // ===========================================================================
  // TRUST HOOKS
  // ===========================================================================

  /**
   * Execute revocation handler hooks
   *
   * Notifies all extensions of a revocation event.
   * Errors are logged but do not stop propagation.
   *
   * @param extensionIds - Extension IDs to execute
   * @param revocation - Revocation event
   */
  async executeOnRevocation(
    extensionIds: string[],
    revocation: RevocationEvent
  ): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const extensionId of extensionIds) {
      const extension = this.registry.get(extensionId);
      if (!extension?.trust?.onRevocation) {
        continue;
      }

      promises.push(
        this.executeWithTimeout(
          () => extension.trust!.onRevocation!(revocation),
          'onRevocation',
          extensionId
        ).catch((error) => {
          this.logHookError('onRevocation', extensionId, error);
        })
      );
    }

    await Promise.all(promises);

    if (this.config.logExecution) {
      logger.info(
        {
          hook: 'trust.onRevocation',
          revocationId: revocation.id,
          agentDid: revocation.agentDid,
          extensionCount: extensionIds.length,
        },
        'Revocation handling completed'
      );
    }
  }

  /**
   * Execute trust adjustment hooks
   *
   * Applies trust adjustments from all extensions sequentially.
   *
   * @param extensionIds - Extension IDs to execute
   * @param agent - Agent identity
   * @param adjustment - Trust adjustment request
   * @returns Aggregated trust result
   */
  async executeAdjustTrust(
    extensionIds: string[],
    agent: AgentIdentity,
    adjustment: TrustAdjustment
  ): Promise<AggregatedTrustResult> {
    const results: Array<{
      extensionId: string;
      result: TrustAdjustmentResult;
    }> = [];
    let currentScore = agent.trustScore;
    let tierChanged = false;

    for (const extensionId of extensionIds) {
      const extension = this.registry.get(extensionId);
      if (!extension?.trust?.adjustTrust) {
        continue;
      }

      try {
        // Create agent with current score for this extension
        const currentAgent: AgentIdentity = {
          ...agent,
          trustScore: currentScore,
          trustTier: scoreToTier(currentScore),
        };

        const result = await this.executeWithTimeout(
          () => extension.trust!.adjustTrust!(currentAgent, adjustment),
          'adjustTrust',
          extensionId
        );

        results.push({ extensionId, result });
        currentScore = result.newScore;

        if (result.tierChanged) {
          tierChanged = true;
        }
      } catch (error) {
        this.logHookError('adjustTrust', extensionId, error);
      }
    }

    const finalTier = scoreToTier(currentScore);
    const aggregated: AggregatedTrustResult = {
      finalScore: currentScore,
      finalTier,
      tierChanged,
      results,
    };

    if (this.config.logExecution) {
      logger.info(
        {
          hook: 'trust.adjustTrust',
          agentDid: agent.did,
          extensionCount: extensionIds.length,
          originalScore: agent.trustScore,
          finalScore: currentScore,
          tierChanged,
        },
        'Trust adjustment completed'
      );
    }

    return aggregated;
  }

  // ===========================================================================
  // POLICY HOOKS
  // ===========================================================================

  /**
   * Execute policy evaluation hooks
   *
   * Evaluates policies across all extensions and aggregates decisions.
   * Deny wins over require_approval, which wins over allow.
   *
   * @param extensionIds - Extension IDs to execute
   * @param context - Policy context
   * @returns Aggregated policy decision
   */
  async evaluatePolicy(
    extensionIds: string[],
    context: PolicyContext
  ): Promise<AggregatedPolicyDecision> {
    const results: Array<{ extensionId: string; result: PolicyDecision }> = [];
    let finalDecision: AggregatedPolicyDecision['decision'] = 'allow';
    const allReasons: string[] = [];
    const allEvidence: AggregatedPolicyDecision['evidence'] = [];
    const allObligations: AggregatedPolicyDecision['obligations'] = [];

    for (const extensionId of extensionIds) {
      const extension = this.registry.get(extensionId);
      if (!extension?.policy?.evaluate) {
        continue;
      }

      try {
        const result = await this.executeWithTimeout(
          () => extension.policy!.evaluate(context),
          'evaluate',
          extensionId
        );

        results.push({ extensionId, result });

        // Collect reasons
        allReasons.push(...result.reasons);

        // Collect evidence
        if (result.evidence) {
          allEvidence.push(...result.evidence);
        }

        // Collect obligations
        if (result.obligations) {
          allObligations.push(...result.obligations);
        }

        // Take highest priority decision (deny > require_approval > allow)
        if (
          DECISION_PRIORITY[result.decision]! > DECISION_PRIORITY[finalDecision]!
        ) {
          finalDecision = result.decision;
        }
      } catch (error) {
        // Policy errors result in deny
        const errorResult: PolicyDecision = {
          decision: 'deny',
          reasons: [
            `Policy evaluation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          ],
        };
        results.push({ extensionId, result: errorResult });
        allReasons.push(...errorResult.reasons);
        finalDecision = 'deny';

        this.logHookError('evaluate', extensionId, error);

        if (this.config.failFast) {
          break;
        }
      }
    }

    const aggregated: AggregatedPolicyDecision = {
      decision: finalDecision,
      reasons: allReasons,
      evidence: allEvidence,
      obligations: allObligations,
      results,
    };

    if (this.config.logExecution) {
      logger.info(
        {
          hook: 'policy.evaluate',
          agentDid: context.agent.did,
          extensionCount: extensionIds.length,
          decision: finalDecision,
        },
        'Policy evaluation completed'
      );
    }

    return aggregated;
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  /**
   * Execute a hook with timeout enforcement
   *
   * @param fn - The hook function to execute
   * @param hookType - Type of hook for timeout lookup
   * @param extensionId - Extension ID for logging
   * @returns Hook result
   * @throws TimeoutError if hook exceeds timeout
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    hookType: HookTimeout,
    extensionId: string
  ): Promise<T> {
    const timeoutConfig = HOOK_TIMEOUTS[hookType];
    const timeout = timeoutConfig?.default ?? this.config.defaultTimeout;

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(
          new TimeoutError(
            `Hook ${hookType} in ${extensionId} timed out after ${timeout}ms`
          )
        );
      }, timeout);
    });

    return Promise.race([fn(), timeoutPromise]);
  }

  /**
   * Log a hook execution error
   *
   * @param hookType - Type of hook that failed
   * @param extensionId - Extension that failed
   * @param error - Error that occurred
   */
  private logHookError(
    hookType: string,
    extensionId: string,
    error: unknown
  ): void {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const isTimeout = error instanceof TimeoutError;

    logger.error(
      {
        hook: hookType,
        extensionId,
        error: message,
        isTimeout,
      },
      `Extension hook ${hookType} failed`
    );
  }
}

/**
 * Create a new extension executor
 *
 * @param registry - Extension registry to use
 * @param config - Optional configuration
 * @returns New executor instance
 *
 * @example
 * ```typescript
 * const executor = createExtensionExecutor(registry, {
 *   failFast: true,
 *   logExecution: true,
 * });
 * ```
 */
export function createExtensionExecutor(
  registry: ExtensionRegistry,
  config?: ExtensionServiceConfig
): ExtensionExecutor {
  return new ExtensionExecutor(registry, config);
}
