/**
 * REPLAY - Simulation Engine
 *
 * Provides "what-if" policy testing and bulk simulation
 * for policy impact analysis before deployment.
 */

import { randomUUID } from 'node:crypto';
import { trace, SpanKind, SpanStatusCode, type Span } from '@opentelemetry/api';
import type {
  ID,
  Intent,
  ControlAction,
  TrustLevel,
  TrustScore,
  Timestamp,
} from '../../common/types.js';
import type {
  Policy,
  PolicyEvaluationContext,
  MultiPolicyEvaluationResult,
} from '../../policy/types.js';
import { createLogger } from '../../common/logger.js';

const logger = createLogger({ component: 'simulation-engine' });

// Tracer for simulation operations
const TRACER_NAME = 'vorion.replay.simulator';
const tracer = trace.getTracer(TRACER_NAME, '1.0.0');

/**
 * Input for creating a simulation intent
 */
export interface CreateIntent {
  entityId: ID;
  goal: string;
  intentType?: string;
  context?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  priority?: number;
}

/**
 * Context for simulation
 */
export interface SimulationContext {
  tenantId: ID;
  /** Trust score to use for simulation (0-1000) */
  trustScore: TrustScore;
  /** Trust level to use for simulation (0-5) */
  trustLevel: TrustLevel;
  /** Policies to evaluate against */
  policies: Policy[];
  /** Entity attributes */
  entityAttributes?: Record<string, unknown>;
  /** Environment overrides */
  environment?: {
    timestamp?: Timestamp;
    timezone?: string;
    custom?: Record<string, unknown>;
  };
}

/**
 * Result of simulating a single intent
 */
export interface SimulationResult {
  simulationId: ID;
  intentId: ID;
  tenantId: ID;
  simulatedAt: Timestamp;

  /** Whether the simulation completed successfully */
  success: boolean;

  /** The simulated outcome */
  outcome: {
    action: ControlAction;
    reason?: string;
    policiesMatched: number;
    policiesEvaluated: number;
  };

  /** Policy evaluation details */
  policyDetails: Array<{
    policyId: ID;
    policyName: string;
    matched: boolean;
    action?: ControlAction;
    reason?: string;
    rulesMatched: number;
    rulesEvaluated: number;
  }>;

  /** Input used for simulation */
  input: {
    intent: CreateIntent;
    trustScore: TrustScore;
    trustLevel: TrustLevel;
  };

  /** Timing information */
  timing: {
    durationMs: number;
  };

  /** Error information if simulation failed */
  error?: {
    message: string;
    code?: string;
  };
}

/**
 * Options for bulk simulation
 */
export interface BulkSimulationOptions {
  /** Continue processing on individual simulation failures */
  continueOnError?: boolean;
  /** Maximum concurrent simulations */
  concurrency?: number;
  /** Timeout per simulation in milliseconds */
  timeoutMs?: number;
}

/**
 * Result of bulk simulation
 */
export interface BulkSimulationResult {
  batchId: ID;
  startedAt: Timestamp;
  completedAt: Timestamp;
  totalDurationMs: number;

  /** Summary statistics */
  summary: {
    total: number;
    succeeded: number;
    failed: number;
    allowCount: number;
    denyCount: number;
    escalateCount: number;
    otherCount: number;
  };

  /** Individual simulation results */
  results: SimulationResult[];

  /** Aggregate policy impact */
  policyImpact: Array<{
    policyId: ID;
    policyName: string;
    timesMatched: number;
    timesEvaluated: number;
    matchRate: number;
    actionBreakdown: Record<ControlAction, number>;
  }>;
}

/**
 * Policy evaluation mock for simulation
 * In a real implementation, this would use the actual policy evaluator
 */
function evaluatePolicies(
  context: PolicyEvaluationContext,
  policies: Policy[]
): MultiPolicyEvaluationResult {
  const now = new Date().toISOString();
  const startTime = Date.now();
  const policiesEvaluated: MultiPolicyEvaluationResult['policiesEvaluated'] = [];

  let finalAction: ControlAction = 'allow';
  let finalReason: string | undefined;
  let appliedPolicy: MultiPolicyEvaluationResult['appliedPolicy'];

  for (const policy of policies) {
    const policyStart = Date.now();
    const rulesEvaluated: MultiPolicyEvaluationResult['policiesEvaluated'][0]['rulesEvaluated'] = [];
    const matchedRules: MultiPolicyEvaluationResult['policiesEvaluated'][0]['matchedRules'] = [];

    // Simple rule evaluation simulation
    for (const rule of policy.definition.rules) {
      if (!rule.enabled) continue;

      // Check if intent type matches (simplified)
      const intentTypeMatch = !policy.definition.target?.intentTypes?.length ||
        policy.definition.target.intentTypes.includes(context.intent.intentType ?? 'generic');

      // Check trust level
      const trustMatch = !policy.definition.target?.trustLevels?.length ||
        policy.definition.target.trustLevels.includes(context.entity.trustLevel);

      const ruleResult = {
        ruleId: rule.id,
        ruleName: rule.name,
        matched: intentTypeMatch && trustMatch,
        conditionsMet: intentTypeMatch && trustMatch,
        action: rule.then.action,
        reason: rule.then.reason,
        durationMs: Date.now() - policyStart,
      };

      rulesEvaluated.push(ruleResult);

      if (ruleResult.matched) {
        matchedRules.push(ruleResult);
      }
    }

    // Determine policy action
    const policyAction = matchedRules.length > 0
      ? matchedRules[0]?.action ?? policy.definition.defaultAction
      : policy.definition.defaultAction;

    const policyResult = {
      policyId: policy.id,
      policyName: policy.name,
      policyVersion: policy.version,
      matched: matchedRules.length > 0,
      action: policyAction,
      reason: matchedRules[0]?.reason ?? policy.definition.defaultReason,
      rulesEvaluated,
      matchedRules,
      durationMs: Date.now() - policyStart,
      evaluatedAt: now,
    };

    policiesEvaluated.push(policyResult);

    // Most restrictive action wins
    if (policyResult.matched) {
      const actionPriority: Record<ControlAction, number> = {
        deny: 1,
        escalate: 2,
        limit: 3,
        monitor: 4,
        terminate: 5,
        allow: 6,
      };

      if (actionPriority[policyAction] < actionPriority[finalAction]) {
        finalAction = policyAction;
        finalReason = policyResult.reason;
        appliedPolicy = policyResult;
      }
    }
  }

  return {
    passed: finalAction === 'allow',
    finalAction,
    reason: finalReason,
    policiesEvaluated,
    appliedPolicy,
    totalDurationMs: Date.now() - startTime,
    evaluatedAt: now,
  };
}

/**
 * SimulationEngine - Runs "what-if" simulations for policy testing
 */
export class SimulationEngine {
  private readonly defaultConcurrency = 10;
  private readonly defaultTimeoutMs = 5000;

  /**
   * Simulate a single intent with given context
   */
  async simulate(
    intent: CreateIntent,
    context: SimulationContext
  ): Promise<SimulationResult> {
    return tracer.startActiveSpan(
      'simulator.simulate',
      { kind: SpanKind.INTERNAL },
      async (span: Span) => {
        const startTime = Date.now();
        const simulationId = randomUUID();
        const intentId = randomUUID();

        try {
          span.setAttributes({
            'simulation.id': simulationId,
            'simulation.intent_id': intentId,
            'simulation.tenant_id': context.tenantId,
            'simulation.policy_count': context.policies.length,
          });

          // Build evaluation context
          const evalContext: PolicyEvaluationContext = {
            intent: {
              id: intentId,
              tenantId: context.tenantId,
              entityId: intent.entityId,
              goal: intent.goal,
              intentType: intent.intentType ?? 'generic',
              context: intent.context ?? {},
              metadata: intent.metadata ?? {},
              priority: intent.priority ?? 0,
              status: 'pending',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            entity: {
              id: intent.entityId,
              type: (context.entityAttributes?.['type'] as string) ?? 'agent',
              trustScore: context.trustScore,
              trustLevel: context.trustLevel,
              attributes: context.entityAttributes ?? {},
            },
            environment: {
              timestamp: context.environment?.timestamp ?? new Date().toISOString(),
              timezone: context.environment?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
              requestId: simulationId,
            },
            custom: context.environment?.custom,
          };

          // Evaluate policies
          const evalResult = evaluatePolicies(evalContext, context.policies);

          const policyDetails = evalResult.policiesEvaluated.map((p) => ({
            policyId: p.policyId,
            policyName: p.policyName,
            matched: p.matched,
            action: p.action,
            reason: p.reason,
            rulesMatched: p.matchedRules.length,
            rulesEvaluated: p.rulesEvaluated.length,
          }));

          const result: SimulationResult = {
            simulationId,
            intentId,
            tenantId: context.tenantId,
            simulatedAt: new Date().toISOString(),
            success: true,
            outcome: {
              action: evalResult.finalAction,
              reason: evalResult.reason,
              policiesMatched: evalResult.policiesEvaluated.filter((p) => p.matched).length,
              policiesEvaluated: evalResult.policiesEvaluated.length,
            },
            policyDetails,
            input: {
              intent,
              trustScore: context.trustScore,
              trustLevel: context.trustLevel,
            },
            timing: {
              durationMs: Date.now() - startTime,
            },
          };

          logger.info(
            {
              simulationId,
              action: result.outcome.action,
              policiesMatched: result.outcome.policiesMatched,
              durationMs: result.timing.durationMs,
            },
            'Simulation completed'
          );

          span.setAttributes({
            'simulation.action': result.outcome.action,
            'simulation.policies_matched': result.outcome.policiesMatched,
            'simulation.duration_ms': result.timing.durationMs,
          });
          span.setStatus({ code: SpanStatusCode.OK });

          return result;
        } catch (error) {
          const errorResult: SimulationResult = {
            simulationId,
            intentId,
            tenantId: context.tenantId,
            simulatedAt: new Date().toISOString(),
            success: false,
            outcome: {
              action: 'deny',
              reason: 'Simulation failed',
              policiesMatched: 0,
              policiesEvaluated: 0,
            },
            policyDetails: [],
            input: {
              intent,
              trustScore: context.trustScore,
              trustLevel: context.trustLevel,
            },
            timing: {
              durationMs: Date.now() - startTime,
            },
            error: {
              message: error instanceof Error ? error.message : 'Unknown error',
            },
          };

          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : 'Unknown error',
          });
          if (error instanceof Error) {
            span.recordException(error);
          }

          return errorResult;
        } finally {
          span.end();
        }
      }
    );
  }

  /**
   * Run bulk simulation for policy impact analysis
   */
  async simulateBulk(
    intents: CreateIntent[],
    context: SimulationContext,
    options: BulkSimulationOptions = {}
  ): Promise<BulkSimulationResult> {
    return tracer.startActiveSpan(
      'simulator.simulate_bulk',
      { kind: SpanKind.INTERNAL },
      async (span: Span) => {
        const startTime = Date.now();
        const batchId = randomUUID();
        const startedAt = new Date().toISOString();

        try {
          span.setAttributes({
            'simulation.batch_id': batchId,
            'simulation.tenant_id': context.tenantId,
            'simulation.intent_count': intents.length,
            'simulation.policy_count': context.policies.length,
          });

          const concurrency = options.concurrency ?? this.defaultConcurrency;
          const continueOnError = options.continueOnError ?? true;

          logger.info(
            {
              batchId,
              intentCount: intents.length,
              concurrency,
            },
            'Starting bulk simulation'
          );

          // Run simulations with concurrency control
          const results: SimulationResult[] = [];
          const batches = this.chunkArray(intents, concurrency);

          for (const batch of batches) {
            const batchResults = await Promise.all(
              batch.map(async (intent) => {
                try {
                  return await this.simulate(intent, context);
                } catch (error) {
                  if (!continueOnError) {
                    throw error;
                  }
                  return {
                    simulationId: randomUUID(),
                    intentId: randomUUID(),
                    tenantId: context.tenantId,
                    simulatedAt: new Date().toISOString(),
                    success: false,
                    outcome: {
                      action: 'deny' as ControlAction,
                      reason: 'Simulation error',
                      policiesMatched: 0,
                      policiesEvaluated: 0,
                    },
                    policyDetails: [],
                    input: {
                      intent,
                      trustScore: context.trustScore,
                      trustLevel: context.trustLevel,
                    },
                    timing: { durationMs: 0 },
                    error: {
                      message: error instanceof Error ? error.message : 'Unknown error',
                    },
                  };
                }
              })
            );
            results.push(...batchResults);
          }

          // Calculate summary
          const succeeded = results.filter((r) => r.success).length;
          const failed = results.filter((r) => !r.success).length;
          const allowCount = results.filter((r) => r.outcome.action === 'allow').length;
          const denyCount = results.filter((r) => r.outcome.action === 'deny').length;
          const escalateCount = results.filter((r) => r.outcome.action === 'escalate').length;
          const otherCount = results.length - allowCount - denyCount - escalateCount;

          // Calculate policy impact
          const policyImpact = this.calculatePolicyImpact(results, context.policies);

          const completedAt = new Date().toISOString();
          const totalDurationMs = Date.now() - startTime;

          const bulkResult: BulkSimulationResult = {
            batchId,
            startedAt,
            completedAt,
            totalDurationMs,
            summary: {
              total: results.length,
              succeeded,
              failed,
              allowCount,
              denyCount,
              escalateCount,
              otherCount,
            },
            results,
            policyImpact,
          };

          logger.info(
            {
              batchId,
              total: results.length,
              succeeded,
              failed,
              allowCount,
              denyCount,
              escalateCount,
              durationMs: totalDurationMs,
            },
            'Bulk simulation completed'
          );

          span.setAttributes({
            'simulation.total': results.length,
            'simulation.succeeded': succeeded,
            'simulation.failed': failed,
            'simulation.allow_count': allowCount,
            'simulation.deny_count': denyCount,
            'simulation.duration_ms': totalDurationMs,
          });
          span.setStatus({ code: SpanStatusCode.OK });

          return bulkResult;
        } catch (error) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : 'Unknown error',
          });
          if (error instanceof Error) {
            span.recordException(error);
          }
          throw error;
        } finally {
          span.end();
        }
      }
    );
  }

  /**
   * Calculate policy impact from simulation results
   */
  private calculatePolicyImpact(
    results: SimulationResult[],
    policies: Policy[]
  ): BulkSimulationResult['policyImpact'] {
    const impact = new Map<ID, {
      policyId: ID;
      policyName: string;
      timesMatched: number;
      timesEvaluated: number;
      actionBreakdown: Record<ControlAction, number>;
    }>();

    // Initialize impact for all policies
    for (const policy of policies) {
      impact.set(policy.id, {
        policyId: policy.id,
        policyName: policy.name,
        timesMatched: 0,
        timesEvaluated: 0,
        actionBreakdown: {
          allow: 0,
          deny: 0,
          escalate: 0,
          limit: 0,
          monitor: 0,
          terminate: 0,
        },
      });
    }

    // Aggregate results
    for (const result of results) {
      for (const detail of result.policyDetails) {
        const entry = impact.get(detail.policyId);
        if (entry) {
          entry.timesEvaluated++;
          if (detail.matched) {
            entry.timesMatched++;
            if (detail.action) {
              entry.actionBreakdown[detail.action]++;
            }
          }
        }
      }
    }

    // Convert to array and calculate match rates
    return Array.from(impact.values()).map((entry) => ({
      ...entry,
      matchRate: entry.timesEvaluated > 0
        ? entry.timesMatched / entry.timesEvaluated
        : 0,
    }));
  }

  /**
   * Split array into chunks for concurrent processing
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Run what-if analysis with policy modifications
   */
  async whatIf(
    intent: CreateIntent,
    baseContext: SimulationContext,
    modifications: {
      /** Modified policies to test */
      modifiedPolicies?: Policy[];
      /** Additional policies to add */
      additionalPolicies?: Policy[];
      /** Policy IDs to exclude */
      excludePolicies?: ID[];
      /** Trust score override */
      trustScoreOverride?: TrustScore;
      /** Trust level override */
      trustLevelOverride?: TrustLevel;
    }
  ): Promise<{
    baseline: SimulationResult;
    modified: SimulationResult;
    comparison: {
      actionChanged: boolean;
      originalAction: ControlAction;
      modifiedAction: ControlAction;
      policyDifferences: Array<{
        policyId: ID;
        policyName: string;
        baselineMatched: boolean;
        modifiedMatched: boolean;
        actionChange?: { from: ControlAction; to: ControlAction };
      }>;
    };
  }> {
    return tracer.startActiveSpan(
      'simulator.what_if',
      { kind: SpanKind.INTERNAL },
      async (span: Span) => {
        try {
          // Run baseline simulation
          const baseline = await this.simulate(intent, baseContext);

          // Build modified context
          let modifiedPolicies = [...baseContext.policies];

          // Apply policy modifications
          if (modifications.modifiedPolicies) {
            for (const mod of modifications.modifiedPolicies) {
              const index = modifiedPolicies.findIndex((p) => p.id === mod.id);
              if (index >= 0) {
                modifiedPolicies[index] = mod;
              }
            }
          }

          // Add additional policies
          if (modifications.additionalPolicies) {
            modifiedPolicies.push(...modifications.additionalPolicies);
          }

          // Exclude policies
          if (modifications.excludePolicies) {
            modifiedPolicies = modifiedPolicies.filter(
              (p) => !modifications.excludePolicies?.includes(p.id)
            );
          }

          const modifiedContext: SimulationContext = {
            ...baseContext,
            policies: modifiedPolicies,
            trustScore: modifications.trustScoreOverride ?? baseContext.trustScore,
            trustLevel: modifications.trustLevelOverride ?? baseContext.trustLevel,
          };

          // Run modified simulation
          const modified = await this.simulate(intent, modifiedContext);

          // Build comparison
          const policyDifferences: Array<{
            policyId: ID;
            policyName: string;
            baselineMatched: boolean;
            modifiedMatched: boolean;
            actionChange?: { from: ControlAction; to: ControlAction };
          }> = [];

          const baselineMap = new Map(baseline.policyDetails.map((p) => [p.policyId, p]));
          const modifiedMap = new Map(modified.policyDetails.map((p) => [p.policyId, p]));

          const allPolicyIds = new Set([...baselineMap.keys(), ...modifiedMap.keys()]);

          for (const policyId of allPolicyIds) {
            const base = baselineMap.get(policyId);
            const mod = modifiedMap.get(policyId);

            if (base || mod) {
              const diff: {
                policyId: ID;
                policyName: string;
                baselineMatched: boolean;
                modifiedMatched: boolean;
                actionChange?: { from: ControlAction; to: ControlAction };
              } = {
                policyId,
                policyName: base?.policyName ?? mod?.policyName ?? 'Unknown',
                baselineMatched: base?.matched ?? false,
                modifiedMatched: mod?.matched ?? false,
              };

              if (base?.action && mod?.action && base.action !== mod.action) {
                diff.actionChange = { from: base.action, to: mod.action };
              }

              policyDifferences.push(diff);
            }
          }

          const result = {
            baseline,
            modified,
            comparison: {
              actionChanged: baseline.outcome.action !== modified.outcome.action,
              originalAction: baseline.outcome.action,
              modifiedAction: modified.outcome.action,
              policyDifferences,
            },
          };

          span.setAttributes({
            'what_if.action_changed': result.comparison.actionChanged,
            'what_if.original_action': result.comparison.originalAction,
            'what_if.modified_action': result.comparison.modifiedAction,
          });
          span.setStatus({ code: SpanStatusCode.OK });

          return result;
        } catch (error) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : 'Unknown error',
          });
          if (error instanceof Error) {
            span.recordException(error);
          }
          throw error;
        } finally {
          span.end();
        }
      }
    );
  }
}

/**
 * Create a new SimulationEngine instance
 */
export function createSimulationEngine(): SimulationEngine {
  return new SimulationEngine();
}
