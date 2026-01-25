/**
 * REPLAY - Intent Replay System
 *
 * Re-executes or simulates past intents for:
 * - Debugging issues
 * - Policy testing ("what-if" scenarios)
 * - Compliance audits
 * - Training and demonstrations
 *
 * @packageDocumentation
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
import type { Policy, MultiPolicyEvaluationResult } from '../../policy/types.js';
import { createLogger } from '../../common/logger.js';
import {
  SnapshotManager,
  createSnapshotManager,
  type SystemSnapshot,
  type TrustSnapshot,
  type PolicySnapshot,
  type EnvironmentSnapshot,
  type SnapshotCaptureOptions,
  type SnapshotRestoreOptions,
  type RestoredContext,
} from './snapshot.js';
import {
  ReplayComparator,
  createReplayComparator,
  type ComparisonReport,
  type OriginalExecution,
  type ComparisonOptions,
  type Difference,
  type DifferenceType,
  type DifferenceSeverity,
  type PolicyComparison,
  type TimingComparison,
} from './comparator.js';
import {
  SimulationEngine,
  createSimulationEngine,
  type CreateIntent,
  type SimulationContext,
  type SimulationResult,
  type BulkSimulationOptions,
  type BulkSimulationResult,
} from './simulator.js';

const logger = createLogger({ component: 'replay-engine' });

// Tracer for replay operations
const TRACER_NAME = 'vorion.replay';
const tracer = trace.getTracer(TRACER_NAME, '1.0.0');

/**
 * Options for replay execution
 */
export interface ReplayOptions {
  /** If true, don't persist any changes (simulation only) */
  dryRun?: boolean;
  /** Stop execution at a specific step */
  stopAt?: ReplayStep;
  /** Override policy for replay */
  modifyPolicy?: {
    /** Policies to use instead of snapshot */
    policies?: Policy[];
    /** Additional policies to include */
    additionalPolicies?: Policy[];
    /** Policy IDs to exclude */
    excludePolicies?: ID[];
  };
  /** Execution speed factor (1.0 = real-time, 2.0 = 2x speed, 0 = instant) */
  speedFactor?: number;
  /** Override trust score for replay */
  trustScoreOverride?: TrustScore;
  /** Override trust level for replay */
  trustLevelOverride?: TrustLevel;
  /** Generate comparison report with original */
  generateComparison?: boolean;
  /** Include detailed step execution data */
  includeStepDetails?: boolean;
}

/**
 * Steps in the replay execution
 */
export type ReplayStep =
  | 'restore'
  | 'trust-evaluation'
  | 'policy-evaluation'
  | 'decision'
  | 'execution'
  | 'complete';

/**
 * Individual step in replay execution
 */
export interface ReplayStepResult {
  step: ReplayStep;
  status: 'completed' | 'skipped' | 'stopped' | 'error';
  durationMs: number;
  data?: Record<string, unknown>;
  error?: string;
}

/**
 * Result of a replay execution
 */
export interface ReplayResult {
  replayId: ID;
  intentId: ID;
  snapshotId: ID;
  tenantId: ID;
  replayedAt: Timestamp;

  /** Whether the replay completed successfully */
  success: boolean;

  /** Whether this was a dry run */
  dryRun: boolean;

  /** Execution steps */
  steps: ReplayStepResult[];

  /** Final outcome */
  outcome: {
    action: ControlAction;
    reason?: string;
    trustScore: TrustScore;
    trustLevel: TrustLevel;
    policiesApplied?: Array<{
      policyId: ID;
      policyName: string;
      action: ControlAction;
      reason?: string;
    }>;
  };

  /** Differences from original execution */
  differences: Difference[];

  /** Timing information */
  timing: {
    totalDurationMs: number;
    stepBreakdown: Record<ReplayStep, number>;
  };

  /** Comparison report if requested */
  comparison?: ComparisonReport;

  /** Error information if failed */
  error?: {
    message: string;
    step?: ReplayStep;
  };
}

/**
 * Simple policy evaluation for replay
 */
function evaluatePolicies(
  intent: Intent,
  policies: PolicySnapshot[],
  trust: TrustSnapshot
): {
  action: ControlAction;
  reason?: string;
  policiesApplied: Array<{
    policyId: ID;
    policyName: string;
    action: ControlAction;
    reason?: string;
  }>;
} {
  const policiesApplied: Array<{
    policyId: ID;
    policyName: string;
    action: ControlAction;
    reason?: string;
  }> = [];

  let finalAction: ControlAction = 'allow';
  let finalReason: string | undefined;

  const actionPriority: Record<ControlAction, number> = {
    deny: 1,
    escalate: 2,
    limit: 3,
    monitor: 4,
    terminate: 5,
    allow: 6,
  };

  for (const policy of policies) {
    // Check target matching
    const intentTypeMatch = !policy.definition.target?.intentTypes?.length ||
      policy.definition.target.intentTypes.includes(intent.intentType ?? 'generic');

    const trustMatch = !policy.definition.target?.trustLevels?.length ||
      policy.definition.target.trustLevels.includes(trust.level);

    if (!intentTypeMatch || !trustMatch) {
      continue;
    }

    // Find matching rules
    for (const rule of policy.definition.rules) {
      if (!rule.enabled) continue;

      // Simplified rule matching
      const matched = true; // In real implementation, evaluate conditions

      if (matched) {
        policiesApplied.push({
          policyId: policy.id,
          policyName: policy.name,
          action: rule.then.action,
          reason: rule.then.reason,
        });

        if (actionPriority[rule.then.action] < actionPriority[finalAction]) {
          finalAction = rule.then.action;
          finalReason = rule.then.reason;
        }

        break; // First matching rule per policy
      }
    }
  }

  // If no rules matched, use default action
  if (policiesApplied.length === 0 && policies.length > 0) {
    const defaultAction = policies[0]?.definition.defaultAction ?? 'allow';
    policiesApplied.push({
      policyId: policies[0]?.id ?? 'default',
      policyName: policies[0]?.name ?? 'Default',
      action: defaultAction,
      reason: 'Default action applied',
    });
    finalAction = defaultAction;
    finalReason = 'Default action applied';
  }

  return {
    action: finalAction,
    reason: finalReason,
    policiesApplied,
  };
}

/**
 * ReplayEngine - Main class for replaying intent executions
 */
export class ReplayEngine {
  private snapshotManager: SnapshotManager;
  private comparator: ReplayComparator;
  private simulator: SimulationEngine;

  constructor(
    snapshotManager?: SnapshotManager,
    comparator?: ReplayComparator,
    simulator?: SimulationEngine
  ) {
    this.snapshotManager = snapshotManager ?? createSnapshotManager();
    this.comparator = comparator ?? createReplayComparator();
    this.simulator = simulator ?? createSimulationEngine();
  }

  /**
   * Replay a past intent execution
   */
  async replay(
    intentId: ID,
    options: ReplayOptions = {}
  ): Promise<ReplayResult> {
    return tracer.startActiveSpan(
      'replay.execute',
      { kind: SpanKind.INTERNAL },
      async (span: Span) => {
        const startTime = Date.now();
        const replayId = randomUUID();
        const steps: ReplayStepResult[] = [];
        const stepTiming: Record<ReplayStep, number> = {
          restore: 0,
          'trust-evaluation': 0,
          'policy-evaluation': 0,
          decision: 0,
          execution: 0,
          complete: 0,
        };

        try {
          span.setAttributes({
            'replay.id': replayId,
            'replay.intent_id': intentId,
            'replay.dry_run': options.dryRun ?? false,
            'replay.stop_at': options.stopAt ?? 'complete',
          });

          // Step 1: Restore snapshot
          const restoreStart = Date.now();
          const snapshot = await this.snapshotManager.getByIntentId(intentId);

          if (!snapshot) {
            const error = 'Snapshot not found for intent';
            steps.push({
              step: 'restore',
              status: 'error',
              durationMs: Date.now() - restoreStart,
              error,
            });

            return this.buildErrorResult(replayId, intentId, '', '', steps, error, 'restore', options);
          }

          const restored = await this.snapshotManager.restore(snapshot.id, {
            trustOverride: options.trustScoreOverride !== undefined || options.trustLevelOverride !== undefined
              ? {
                  score: options.trustScoreOverride ?? snapshot.trust.score,
                  level: options.trustLevelOverride ?? snapshot.trust.level,
                }
              : undefined,
          });

          if (!restored) {
            const error = 'Failed to restore snapshot';
            steps.push({
              step: 'restore',
              status: 'error',
              durationMs: Date.now() - restoreStart,
              error,
            });

            return this.buildErrorResult(replayId, intentId, snapshot.id, snapshot.tenantId, steps, error, 'restore', options);
          }

          stepTiming.restore = Date.now() - restoreStart;
          steps.push({
            step: 'restore',
            status: 'completed',
            durationMs: stepTiming.restore,
            data: options.includeStepDetails ? { snapshotId: snapshot.id } : undefined,
          });

          if (options.stopAt === 'restore') {
            return this.buildStoppedResult(replayId, intentId, snapshot, restored, steps, stepTiming, options);
          }

          // Apply speed factor delay
          if (options.speedFactor && options.speedFactor > 0 && options.speedFactor !== 1) {
            // Simulate processing time based on speed factor
            // speedFactor 2.0 = half the original time, 0.5 = double the time
            await this.delay(100 / options.speedFactor);
          }

          // Step 2: Trust evaluation
          const trustStart = Date.now();
          const trust = options.trustScoreOverride !== undefined || options.trustLevelOverride !== undefined
            ? {
                ...restored.trust,
                score: options.trustScoreOverride ?? restored.trust.score,
                level: options.trustLevelOverride ?? restored.trust.level,
              }
            : restored.trust;

          stepTiming['trust-evaluation'] = Date.now() - trustStart;
          steps.push({
            step: 'trust-evaluation',
            status: 'completed',
            durationMs: stepTiming['trust-evaluation'],
            data: options.includeStepDetails ? { trustScore: trust.score, trustLevel: trust.level } : undefined,
          });

          if (options.stopAt === 'trust-evaluation') {
            return this.buildStoppedResult(replayId, intentId, snapshot, restored, steps, stepTiming, options, trust);
          }

          // Step 3: Policy evaluation
          const policyStart = Date.now();
          let policies = restored.policies;

          // Apply policy modifications
          if (options.modifyPolicy) {
            if (options.modifyPolicy.policies) {
              policies = options.modifyPolicy.policies.map((p) => ({
                id: p.id,
                name: p.name,
                namespace: p.namespace,
                version: p.version,
                checksum: p.checksum,
                definition: p.definition,
                capturedAt: new Date().toISOString(),
              }));
            }

            if (options.modifyPolicy.additionalPolicies) {
              const additional = options.modifyPolicy.additionalPolicies.map((p) => ({
                id: p.id,
                name: p.name,
                namespace: p.namespace,
                version: p.version,
                checksum: p.checksum,
                definition: p.definition,
                capturedAt: new Date().toISOString(),
              }));
              policies = [...policies, ...additional];
            }

            if (options.modifyPolicy.excludePolicies) {
              policies = policies.filter((p) => !options.modifyPolicy?.excludePolicies?.includes(p.id));
            }
          }

          const evalResult = evaluatePolicies(restored.intent, policies, trust);

          stepTiming['policy-evaluation'] = Date.now() - policyStart;
          steps.push({
            step: 'policy-evaluation',
            status: 'completed',
            durationMs: stepTiming['policy-evaluation'],
            data: options.includeStepDetails ? {
              policiesEvaluated: policies.length,
              policiesApplied: evalResult.policiesApplied.length,
            } : undefined,
          });

          if (options.stopAt === 'policy-evaluation') {
            return this.buildStoppedResult(replayId, intentId, snapshot, restored, steps, stepTiming, options, trust, evalResult);
          }

          // Step 4: Decision
          const decisionStart = Date.now();
          stepTiming.decision = Date.now() - decisionStart;
          steps.push({
            step: 'decision',
            status: 'completed',
            durationMs: stepTiming.decision,
            data: options.includeStepDetails ? { action: evalResult.action, reason: evalResult.reason } : undefined,
          });

          if (options.stopAt === 'decision') {
            return this.buildStoppedResult(replayId, intentId, snapshot, restored, steps, stepTiming, options, trust, evalResult);
          }

          // Step 5: Execution (if not dry run and action is allow)
          const executionStart = Date.now();
          if (!options.dryRun && evalResult.action === 'allow') {
            // In a real implementation, this would trigger actual execution
            stepTiming.execution = Date.now() - executionStart;
            steps.push({
              step: 'execution',
              status: 'completed',
              durationMs: stepTiming.execution,
              data: options.includeStepDetails ? { executed: true } : undefined,
            });
          } else {
            steps.push({
              step: 'execution',
              status: 'skipped',
              durationMs: 0,
              data: options.includeStepDetails ? {
                reason: options.dryRun ? 'dry run' : `action is ${evalResult.action}`,
              } : undefined,
            });
          }

          if (options.stopAt === 'execution') {
            return this.buildStoppedResult(replayId, intentId, snapshot, restored, steps, stepTiming, options, trust, evalResult);
          }

          // Step 6: Complete
          stepTiming.complete = 0;
          steps.push({
            step: 'complete',
            status: 'completed',
            durationMs: 0,
          });

          // Build differences (compare with original)
          const differences: Difference[] = [];
          if (snapshot.intent.trustScore !== trust.score) {
            differences.push({
              type: 'trust_score',
              severity: 'info',
              path: 'trust.score',
              originalValue: snapshot.intent.trustScore,
              replayValue: trust.score,
              description: `Trust score changed from ${snapshot.intent.trustScore} to ${trust.score}`,
            });
          }

          // Generate comparison report if requested
          let comparison: ComparisonReport | undefined;
          if (options.generateComparison) {
            const originalExecution: OriginalExecution = {
              intentId: snapshot.intentId,
              action: (snapshot.intent.status === 'approved' ? 'allow' : snapshot.intent.status === 'denied' ? 'deny' : 'escalate') as ControlAction,
              policiesApplied: [],
              trustScore: snapshot.trust.score,
              trustLevel: snapshot.trust.level,
              durationMs: 0,
              evaluatedAt: snapshot.capturedAt,
            };

            comparison = await this.comparator.compare(originalExecution, {
              replayId,
              intentId,
              snapshotId: snapshot.id,
              tenantId: snapshot.tenantId,
              replayedAt: new Date().toISOString(),
              success: true,
              dryRun: options.dryRun ?? false,
              steps,
              outcome: {
                action: evalResult.action,
                reason: evalResult.reason,
                trustScore: trust.score,
                trustLevel: trust.level,
                policiesApplied: evalResult.policiesApplied,
              },
              differences,
              timing: {
                totalDurationMs: Date.now() - startTime,
                stepBreakdown: stepTiming,
              },
            });
          }

          const result: ReplayResult = {
            replayId,
            intentId,
            snapshotId: snapshot.id,
            tenantId: snapshot.tenantId,
            replayedAt: new Date().toISOString(),
            success: true,
            dryRun: options.dryRun ?? false,
            steps,
            outcome: {
              action: evalResult.action,
              reason: evalResult.reason,
              trustScore: trust.score,
              trustLevel: trust.level,
              policiesApplied: evalResult.policiesApplied,
            },
            differences,
            timing: {
              totalDurationMs: Date.now() - startTime,
              stepBreakdown: stepTiming,
            },
            comparison,
          };

          logger.info(
            {
              replayId,
              intentId,
              action: evalResult.action,
              dryRun: options.dryRun,
              durationMs: result.timing.totalDurationMs,
            },
            'Replay completed'
          );

          span.setAttributes({
            'replay.success': true,
            'replay.action': evalResult.action,
            'replay.duration_ms': result.timing.totalDurationMs,
          });
          span.setStatus({ code: SpanStatusCode.OK });

          return result;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage });
          if (error instanceof Error) {
            span.recordException(error);
          }

          return this.buildErrorResult(replayId, intentId, '', '', steps, errorMessage, 'restore', options);
        } finally {
          span.end();
        }
      }
    );
  }

  /**
   * Get the snapshot manager instance
   */
  getSnapshotManager(): SnapshotManager {
    return this.snapshotManager;
  }

  /**
   * Get the comparator instance
   */
  getComparator(): ReplayComparator {
    return this.comparator;
  }

  /**
   * Get the simulator instance
   */
  getSimulator(): SimulationEngine {
    return this.simulator;
  }

  /**
   * Capture a snapshot for an intent
   */
  async captureSnapshot(
    intent: Intent,
    trustData: {
      score: TrustScore;
      level: TrustLevel;
      components?: {
        behavioral: number;
        compliance: number;
        identity: number;
        context: number;
      };
    },
    policies: Policy[],
    options?: SnapshotCaptureOptions
  ): Promise<SystemSnapshot> {
    return this.snapshotManager.capture(intent, trustData, policies, options);
  }

  /**
   * Helper to delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Build error result
   */
  private buildErrorResult(
    replayId: ID,
    intentId: ID,
    snapshotId: ID,
    tenantId: ID,
    steps: ReplayStepResult[],
    error: string,
    errorStep: ReplayStep,
    options: ReplayOptions
  ): ReplayResult {
    return {
      replayId,
      intentId,
      snapshotId,
      tenantId,
      replayedAt: new Date().toISOString(),
      success: false,
      dryRun: options.dryRun ?? false,
      steps,
      outcome: {
        action: 'deny',
        reason: 'Replay failed',
        trustScore: 0,
        trustLevel: 0,
      },
      differences: [],
      timing: {
        totalDurationMs: 0,
        stepBreakdown: {
          restore: 0,
          'trust-evaluation': 0,
          'policy-evaluation': 0,
          decision: 0,
          execution: 0,
          complete: 0,
        },
      },
      error: {
        message: error,
        step: errorStep,
      },
    };
  }

  /**
   * Build stopped result
   */
  private buildStoppedResult(
    replayId: ID,
    intentId: ID,
    snapshot: SystemSnapshot,
    restored: RestoredContext,
    steps: ReplayStepResult[],
    stepTiming: Record<ReplayStep, number>,
    options: ReplayOptions,
    trust?: TrustSnapshot,
    evalResult?: {
      action: ControlAction;
      reason?: string;
      policiesApplied: Array<{
        policyId: ID;
        policyName: string;
        action: ControlAction;
        reason?: string;
      }>;
    }
  ): ReplayResult {
    const totalDuration = Object.values(stepTiming).reduce((a, b) => a + b, 0);

    return {
      replayId,
      intentId,
      snapshotId: snapshot.id,
      tenantId: snapshot.tenantId,
      replayedAt: new Date().toISOString(),
      success: true,
      dryRun: options.dryRun ?? false,
      steps,
      outcome: {
        action: evalResult?.action ?? 'allow',
        reason: evalResult?.reason ?? 'Stopped before decision',
        trustScore: trust?.score ?? restored.trust.score,
        trustLevel: trust?.level ?? restored.trust.level,
        policiesApplied: evalResult?.policiesApplied,
      },
      differences: [],
      timing: {
        totalDurationMs: totalDuration,
        stepBreakdown: stepTiming,
      },
    };
  }
}

/**
 * Create a new ReplayEngine instance
 */
export function createReplayEngine(): ReplayEngine {
  return new ReplayEngine();
}

// Re-export types and classes from submodules
export {
  // Snapshot types
  SnapshotManager,
  createSnapshotManager,
  type SystemSnapshot,
  type TrustSnapshot,
  type PolicySnapshot,
  type EnvironmentSnapshot,
  type SnapshotCaptureOptions,
  type SnapshotRestoreOptions,
  type RestoredContext,
} from './snapshot.js';

export {
  // Comparator types
  ReplayComparator,
  createReplayComparator,
  type ComparisonReport,
  type OriginalExecution,
  type ComparisonOptions,
  type Difference,
  type DifferenceType,
  type DifferenceSeverity,
  type PolicyComparison,
  type TimingComparison,
} from './comparator.js';

export {
  // Simulator types
  SimulationEngine,
  createSimulationEngine,
  type CreateIntent,
  type SimulationContext,
  type SimulationResult,
  type BulkSimulationOptions,
  type BulkSimulationResult,
} from './simulator.js';
