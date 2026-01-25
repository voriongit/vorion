/**
 * REPLAY - Comparator
 *
 * Compares replay results with original execution for
 * debugging, compliance audits, and policy impact analysis.
 */

import { trace, SpanKind, SpanStatusCode, type Span } from '@opentelemetry/api';
import type { ID, ControlAction, Timestamp } from '../../common/types.js';
import { createLogger } from '../../common/logger.js';
import type { ReplayResult } from './index.js';

const logger = createLogger({ component: 'replay-comparator' });

// Tracer for comparison operations
const TRACER_NAME = 'vorion.replay.comparator';
const tracer = trace.getTracer(TRACER_NAME, '1.0.0');

/**
 * Type of difference detected
 */
export type DifferenceType =
  | 'decision'
  | 'policy_applied'
  | 'policy_missing'
  | 'trust_score'
  | 'trust_level'
  | 'timing'
  | 'evaluation_order'
  | 'constraint'
  | 'metadata';

/**
 * Severity of the difference
 */
export type DifferenceSeverity = 'info' | 'warning' | 'critical';

/**
 * Individual difference between original and replay
 */
export interface Difference {
  type: DifferenceType;
  severity: DifferenceSeverity;
  path: string;
  originalValue: unknown;
  replayValue: unknown;
  description: string;
  impact?: string;
}

/**
 * Timing comparison
 */
export interface TimingComparison {
  originalDurationMs: number;
  replayDurationMs: number;
  differenceMs: number;
  percentageChange: number;
  significant: boolean;
}

/**
 * Policy comparison
 */
export interface PolicyComparison {
  policyId: ID;
  policyName: string;
  originalApplied: boolean;
  replayApplied: boolean;
  originalAction?: ControlAction;
  replayAction?: ControlAction;
  actionChanged: boolean;
}

/**
 * Complete comparison report
 */
export interface ComparisonReport {
  id: ID;
  intentId: ID;
  replayId: ID;
  generatedAt: Timestamp;

  /** Overall match status */
  isMatch: boolean;

  /** Decision comparison */
  decision: {
    originalAction: ControlAction;
    replayAction: ControlAction;
    matches: boolean;
  };

  /** All differences found */
  differences: Difference[];

  /** Policy-level comparison */
  policyComparison: PolicyComparison[];

  /** Timing comparison */
  timing: TimingComparison;

  /** Summary statistics */
  summary: {
    totalDifferences: number;
    criticalDifferences: number;
    warningDifferences: number;
    infoDifferences: number;
    policiesCompared: number;
    policiesChanged: number;
  };

  /** Recommendations based on differences */
  recommendations: string[];
}

/**
 * Original execution result for comparison
 */
export interface OriginalExecution {
  intentId: ID;
  action: ControlAction;
  policiesApplied: Array<{
    policyId: ID;
    policyName: string;
    action: ControlAction;
    reason?: string;
  }>;
  trustScore: number;
  trustLevel: number;
  durationMs: number;
  evaluatedAt: Timestamp;
  metadata?: Record<string, unknown>;
}

/**
 * Options for comparison
 */
export interface ComparisonOptions {
  /** Threshold for significant timing difference (percentage) */
  timingThresholdPercent?: number;
  /** Include info-level differences */
  includeInfoDifferences?: boolean;
  /** Generate recommendations */
  generateRecommendations?: boolean;
}

/**
 * ReplayComparator - Compares replay results with original execution
 */
export class ReplayComparator {
  private readonly defaultTimingThreshold = 20; // 20% difference is significant

  /**
   * Compare a replay result with the original execution
   */
  async compare(
    original: OriginalExecution,
    replay: ReplayResult,
    options: ComparisonOptions = {}
  ): Promise<ComparisonReport> {
    return tracer.startActiveSpan(
      'comparator.compare',
      { kind: SpanKind.INTERNAL },
      async (span: Span) => {
        try {
          const now = new Date().toISOString();
          const reportId = `cmp-${Date.now()}`;

          span.setAttributes({
            'comparison.id': reportId,
            'comparison.intent_id': original.intentId,
            'comparison.replay_id': replay.replayId,
          });

          const differences: Difference[] = [];
          const timingThreshold = options.timingThresholdPercent ?? this.defaultTimingThreshold;

          // Compare decisions
          const decisionMatches = original.action === replay.outcome.action;
          if (!decisionMatches) {
            differences.push({
              type: 'decision',
              severity: 'critical',
              path: 'outcome.action',
              originalValue: original.action,
              replayValue: replay.outcome.action,
              description: `Decision changed from '${original.action}' to '${replay.outcome.action}'`,
              impact: this.assessDecisionImpact(original.action, replay.outcome.action),
            });
          }

          // Compare trust scores
          if (original.trustScore !== replay.outcome.trustScore) {
            const scoreDiff = Math.abs(original.trustScore - replay.outcome.trustScore);
            const severity = scoreDiff > 100 ? 'warning' : 'info';
            if (severity !== 'info' || options.includeInfoDifferences) {
              differences.push({
                type: 'trust_score',
                severity,
                path: 'trust.score',
                originalValue: original.trustScore,
                replayValue: replay.outcome.trustScore,
                description: `Trust score changed by ${scoreDiff} points`,
              });
            }
          }

          // Compare trust levels
          if (original.trustLevel !== replay.outcome.trustLevel) {
            differences.push({
              type: 'trust_level',
              severity: 'warning',
              path: 'trust.level',
              originalValue: original.trustLevel,
              replayValue: replay.outcome.trustLevel,
              description: `Trust level changed from T${original.trustLevel} to T${replay.outcome.trustLevel}`,
              impact: 'Trust level changes can affect policy evaluation outcomes',
            });
          }

          // Compare policies
          const policyComparison = this.comparePolicies(
            original.policiesApplied,
            replay.outcome.policiesApplied ?? [],
            differences,
            options.includeInfoDifferences ?? false
          );

          // Compare timing
          const timing = this.compareTiming(
            original.durationMs,
            replay.timing.totalDurationMs,
            timingThreshold,
            differences,
            options.includeInfoDifferences ?? false
          );

          // Count differences by severity
          const criticalCount = differences.filter((d) => d.severity === 'critical').length;
          const warningCount = differences.filter((d) => d.severity === 'warning').length;
          const infoCount = differences.filter((d) => d.severity === 'info').length;

          // Generate recommendations
          const recommendations = options.generateRecommendations !== false
            ? this.generateRecommendations(differences, policyComparison)
            : [];

          const report: ComparisonReport = {
            id: reportId,
            intentId: original.intentId,
            replayId: replay.replayId,
            generatedAt: now,
            isMatch: differences.filter((d) => d.severity !== 'info').length === 0,
            decision: {
              originalAction: original.action,
              replayAction: replay.outcome.action,
              matches: decisionMatches,
            },
            differences,
            policyComparison,
            timing,
            summary: {
              totalDifferences: differences.length,
              criticalDifferences: criticalCount,
              warningDifferences: warningCount,
              infoDifferences: infoCount,
              policiesCompared: policyComparison.length,
              policiesChanged: policyComparison.filter((p) => p.actionChanged).length,
            },
            recommendations,
          };

          logger.info(
            {
              reportId,
              intentId: original.intentId,
              isMatch: report.isMatch,
              totalDifferences: differences.length,
              criticalDifferences: criticalCount,
            },
            'Comparison report generated'
          );

          span.setAttributes({
            'comparison.is_match': report.isMatch,
            'comparison.total_differences': differences.length,
            'comparison.critical_differences': criticalCount,
          });
          span.setStatus({ code: SpanStatusCode.OK });

          return report;
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
   * Compare policy applications
   */
  private comparePolicies(
    originalPolicies: OriginalExecution['policiesApplied'],
    replayPolicies: ReplayResult['outcome']['policiesApplied'],
    differences: Difference[],
    includeInfo: boolean
  ): PolicyComparison[] {
    const comparisons: PolicyComparison[] = [];
    const originalMap = new Map(originalPolicies.map((p) => [p.policyId, p]));
    const replayMap = new Map((replayPolicies ?? []).map((p) => [p.policyId, p]));

    // Check all original policies
    for (const [policyId, original] of originalMap) {
      const replay = replayMap.get(policyId);
      const comparison: PolicyComparison = {
        policyId,
        policyName: original.policyName,
        originalApplied: true,
        replayApplied: !!replay,
        originalAction: original.action,
        replayAction: replay?.action,
        actionChanged: !replay || original.action !== replay.action,
      };
      comparisons.push(comparison);

      if (!replay) {
        differences.push({
          type: 'policy_missing',
          severity: 'warning',
          path: `policies.${policyId}`,
          originalValue: original,
          replayValue: null,
          description: `Policy '${original.policyName}' was not applied in replay`,
        });
      } else if (original.action !== replay.action) {
        differences.push({
          type: 'policy_applied',
          severity: 'warning',
          path: `policies.${policyId}.action`,
          originalValue: original.action,
          replayValue: replay.action,
          description: `Policy '${original.policyName}' action changed from '${original.action}' to '${replay.action}'`,
        });
      }
    }

    // Check for new policies in replay
    for (const [policyId, replay] of replayMap) {
      if (!originalMap.has(policyId)) {
        comparisons.push({
          policyId,
          policyName: replay.policyName,
          originalApplied: false,
          replayApplied: true,
          replayAction: replay.action,
          actionChanged: true,
        });

        if (includeInfo) {
          differences.push({
            type: 'policy_applied',
            severity: 'info',
            path: `policies.${policyId}`,
            originalValue: null,
            replayValue: replay,
            description: `Policy '${replay.policyName}' was newly applied in replay`,
          });
        }
      }
    }

    return comparisons;
  }

  /**
   * Compare timing
   */
  private compareTiming(
    originalMs: number,
    replayMs: number,
    thresholdPercent: number,
    differences: Difference[],
    includeInfo: boolean
  ): TimingComparison {
    const differenceMs = replayMs - originalMs;
    const percentageChange = originalMs > 0
      ? (differenceMs / originalMs) * 100
      : replayMs > 0 ? 100 : 0;
    const significant = Math.abs(percentageChange) > thresholdPercent;

    const comparison: TimingComparison = {
      originalDurationMs: originalMs,
      replayDurationMs: replayMs,
      differenceMs,
      percentageChange,
      significant,
    };

    if (significant || includeInfo) {
      differences.push({
        type: 'timing',
        severity: significant ? 'warning' : 'info',
        path: 'timing.duration',
        originalValue: originalMs,
        replayValue: replayMs,
        description: `Execution time changed by ${Math.abs(percentageChange).toFixed(1)}% (${differenceMs > 0 ? '+' : ''}${differenceMs}ms)`,
      });
    }

    return comparison;
  }

  /**
   * Assess the impact of a decision change
   */
  private assessDecisionImpact(original: ControlAction, replay: ControlAction): string {
    const impactMap: Record<string, Record<string, string>> = {
      allow: {
        deny: 'Previously allowed action would now be blocked',
        escalate: 'Previously allowed action would now require approval',
      },
      deny: {
        allow: 'Previously blocked action would now be allowed - security risk',
        escalate: 'Previously blocked action would now be escalated',
      },
      escalate: {
        allow: 'Previously escalated action would now be auto-approved',
        deny: 'Previously escalated action would now be auto-denied',
      },
    };

    return impactMap[original]?.[replay] ?? 'Decision outcome changed';
  }

  /**
   * Generate recommendations based on differences
   */
  private generateRecommendations(
    differences: Difference[],
    policyComparisons: PolicyComparison[]
  ): string[] {
    const recommendations: string[] = [];

    // Check for critical decision changes
    const decisionDiff = differences.find((d) => d.type === 'decision');
    if (decisionDiff) {
      recommendations.push(
        'Critical: Decision outcome changed. Review policy configurations and trust score calculations.'
      );
    }

    // Check for missing policies
    const missingPolicies = differences.filter((d) => d.type === 'policy_missing');
    if (missingPolicies.length > 0) {
      recommendations.push(
        `${missingPolicies.length} policies were not applied in replay. Verify policy namespace and target configurations.`
      );
    }

    // Check for trust level changes
    const trustLevelDiff = differences.find((d) => d.type === 'trust_level');
    if (trustLevelDiff) {
      recommendations.push(
        'Trust level changed between original and replay. This may affect policy matching.'
      );
    }

    // Check for significant timing changes
    const timingDiff = differences.find((d) => d.type === 'timing' && d.severity === 'warning');
    if (timingDiff) {
      recommendations.push(
        'Significant timing difference detected. This may indicate performance issues or different system load.'
      );
    }

    // Check for policy action changes
    const changedPolicies = policyComparisons.filter(
      (p) => p.originalApplied && p.replayApplied && p.actionChanged
    );
    if (changedPolicies.length > 0) {
      recommendations.push(
        `${changedPolicies.length} policies produced different actions. Review policy rule conditions and order.`
      );
    }

    return recommendations;
  }

  /**
   * Generate a summary text from a comparison report
   */
  summarize(report: ComparisonReport): string {
    const lines: string[] = [
      `Comparison Report: ${report.id}`,
      `Intent: ${report.intentId} | Replay: ${report.replayId}`,
      `Generated: ${report.generatedAt}`,
      '',
      `Overall Match: ${report.isMatch ? 'YES' : 'NO'}`,
      `Decision: ${report.decision.originalAction} -> ${report.decision.replayAction} (${report.decision.matches ? 'unchanged' : 'CHANGED'})`,
      '',
      `Differences: ${report.summary.totalDifferences} total`,
      `  - Critical: ${report.summary.criticalDifferences}`,
      `  - Warning: ${report.summary.warningDifferences}`,
      `  - Info: ${report.summary.infoDifferences}`,
      '',
      `Policies: ${report.summary.policiesCompared} compared, ${report.summary.policiesChanged} changed`,
      `Timing: ${report.timing.originalDurationMs}ms -> ${report.timing.replayDurationMs}ms (${report.timing.percentageChange.toFixed(1)}%)`,
    ];

    if (report.recommendations.length > 0) {
      lines.push('', 'Recommendations:');
      for (const rec of report.recommendations) {
        lines.push(`  - ${rec}`);
      }
    }

    return lines.join('\n');
  }
}

/**
 * Create a new ReplayComparator instance
 */
export function createReplayComparator(): ReplayComparator {
  return new ReplayComparator();
}
