/**
 * BASIS Constraint Evaluator
 *
 * Evaluates constraints against intent context.
 */

import type {
  Constraint,
  ConstraintAction,
  ConstraintEvaluation,
  TrustLevel,
} from './types.js';
import { matchPattern, isValidPatternId } from './patterns.js';

/**
 * Constraint evaluation result
 */
export interface ConstraintResult {
  passed: boolean;
  action: ConstraintAction;
  evaluations: ConstraintEvaluation[];
  blocked: boolean;
  modified: boolean;
  modifications: ContentModification[];
}

/**
 * Content modification record
 */
export interface ContentModification {
  constraint_id: string;
  action: 'redact' | 'mask' | 'truncate';
  original: string;
  modified: string;
  count: number;
}

/**
 * Intent context for evaluation
 */
export interface IntentContext {
  goal: string;
  tools?: string[];
  endpoints?: string[];
  data?: Record<string, unknown>;
  content?: string;
  trust_level?: TrustLevel;
  trust_score?: number;
  timestamp?: string;
  [key: string]: unknown;
}

/**
 * Evaluate constraints against an intent context
 *
 * @param constraints - Array of constraints to evaluate
 * @param context - The intent context
 * @returns Evaluation result
 *
 * @example
 * ```typescript
 * import { evaluateConstraints } from '@vorion/basis-core';
 *
 * const constraints = [
 *   { type: 'tool_restriction', action: 'block', values: ['shell_execute'] }
 * ];
 *
 * const context = {
 *   goal: 'Run a shell command',
 *   tools: ['shell_execute']
 * };
 *
 * const result = evaluateConstraints(constraints, context);
 * console.log(result.blocked); // true
 * ```
 */
export function evaluateConstraints(
  constraints: Constraint[],
  context: IntentContext
): ConstraintResult {
  const evaluations: ConstraintEvaluation[] = [];
  const modifications: ContentModification[] = [];
  let blocked = false;
  let modified = false;

  // Sort by severity
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const sorted = [...constraints].sort((a, b) => {
    const aSev = severityOrder[a.severity ?? 'medium'];
    const bSev = severityOrder[b.severity ?? 'medium'];
    return aSev - bSev;
  });

  for (const constraint of sorted) {
    // Skip disabled constraints
    if (constraint.enabled === false) continue;

    // Check scope
    if (!isInScope(constraint, context)) continue;

    const startTime = performance.now();
    const evaluation = evaluateConstraint(constraint, context);
    const endTime = performance.now();

    evaluations.push({
      constraint_id: constraint.id ?? `constraint-${evaluations.length}`,
      passed: evaluation.passed,
      action: constraint.action,
      reason: evaluation.reason,
      details: evaluation.details,
      duration_ms: endTime - startTime,
      evaluated_at: new Date().toISOString(),
    });

    if (!evaluation.passed) {
      if (constraint.action === 'block') {
        blocked = true;
      } else if (
        constraint.action === 'redact' ||
        constraint.action === 'mask' ||
        constraint.action === 'truncate'
      ) {
        modified = true;
        if (evaluation.modification) {
          modifications.push(evaluation.modification);
        }
      }
    }
  }

  return {
    passed: !blocked,
    action: blocked ? 'block' : modified ? 'redact' : 'log',
    evaluations,
    blocked,
    modified,
    modifications,
  };
}

/**
 * Check if constraint is in scope for context
 */
function isInScope(constraint: Constraint, context: IntentContext): boolean {
  const scope = constraint.scope;
  if (!scope) return true;

  // Check trust level scope
  if (scope.trust_levels && context.trust_level !== undefined) {
    if (!scope.trust_levels.includes(context.trust_level)) {
      return false;
    }
  }

  // Check tool scope
  if (scope.tools && context.tools) {
    const hasMatchingTool = scope.tools.some((t) => context.tools!.includes(t));
    if (!hasMatchingTool) {
      return false;
    }
  }

  return true;
}

/**
 * Evaluate a single constraint
 */
function evaluateConstraint(
  constraint: Constraint,
  context: IntentContext
): {
  passed: boolean;
  reason?: string;
  details?: Record<string, unknown>;
  modification?: ContentModification;
} {
  switch (constraint.type) {
    case 'tool_restriction':
      return evaluateToolRestriction(constraint, context);

    case 'egress_whitelist':
      return evaluateEgressWhitelist(constraint, context);

    case 'egress_blacklist':
      return evaluateEgressBlacklist(constraint, context);

    case 'data_protection':
      return evaluateDataProtection(constraint, context);

    case 'rate_limit':
      return evaluateRateLimit(constraint);

    case 'resource_limit':
      return evaluateResourceLimit(constraint);

    default:
      // Unknown constraint types pass by default
      return { passed: true };
  }
}

/**
 * Evaluate tool restriction constraint
 */
function evaluateToolRestriction(
  constraint: Constraint,
  context: IntentContext
): { passed: boolean; reason?: string; details?: Record<string, unknown> } {
  const restrictedTools = constraint.values ?? [];
  const requestedTools = context.tools ?? [];

  const violations = requestedTools.filter((t) => restrictedTools.includes(t));

  if (violations.length > 0) {
    return {
      passed: false,
      reason: constraint.message ?? `Restricted tools requested: ${violations.join(', ')}`,
      details: { violations },
    };
  }

  return { passed: true };
}

/**
 * Evaluate egress whitelist constraint
 */
function evaluateEgressWhitelist(
  constraint: Constraint,
  context: IntentContext
): { passed: boolean; reason?: string; details?: Record<string, unknown> } {
  const allowedEndpoints = constraint.values ?? [];
  const requestedEndpoints = context.endpoints ?? [];

  const violations = requestedEndpoints.filter(
    (ep) => !allowedEndpoints.some((allowed) => matchesEndpoint(ep, allowed))
  );

  if (violations.length > 0) {
    return {
      passed: false,
      reason: constraint.message ?? `Endpoints not in whitelist: ${violations.join(', ')}`,
      details: { violations, allowed: allowedEndpoints },
    };
  }

  return { passed: true };
}

/**
 * Evaluate egress blacklist constraint
 */
function evaluateEgressBlacklist(
  constraint: Constraint,
  context: IntentContext
): { passed: boolean; reason?: string; details?: Record<string, unknown> } {
  const blockedEndpoints = constraint.values ?? [];
  const requestedEndpoints = context.endpoints ?? [];

  const violations = requestedEndpoints.filter((ep) =>
    blockedEndpoints.some((blocked) => matchesEndpoint(ep, blocked))
  );

  if (violations.length > 0) {
    return {
      passed: false,
      reason: constraint.message ?? `Blocked endpoints requested: ${violations.join(', ')}`,
      details: { violations },
    };
  }

  return { passed: true };
}

/**
 * Evaluate data protection constraint
 */
function evaluateDataProtection(
  constraint: Constraint,
  context: IntentContext
): {
  passed: boolean;
  reason?: string;
  details?: Record<string, unknown>;
  modification?: ContentModification;
} {
  const content = context.content ?? context.goal ?? '';

  // Use named pattern
  if (constraint.named_pattern && isValidPatternId(constraint.named_pattern)) {
    const matches = matchPattern(constraint.named_pattern, content);

    if (matches.length > 0) {
      return {
        passed: false,
        reason:
          constraint.message ??
          `Sensitive data detected: ${constraint.named_pattern}`,
        details: {
          pattern: constraint.named_pattern,
          match_count: matches.length,
        },
        modification:
          constraint.action !== 'block'
            ? {
                constraint_id: constraint.id ?? 'data-protection',
                action: constraint.action as 'redact' | 'mask' | 'truncate',
                original: matches[0]?.[0] ?? '',
                modified: '[PROTECTED]',
                count: matches.length,
              }
            : undefined,
      };
    }
  }

  // Use custom pattern
  if (constraint.pattern) {
    const regex = new RegExp(constraint.pattern, 'gi');
    const matches = content.match(regex);

    if (matches && matches.length > 0) {
      return {
        passed: false,
        reason: constraint.message ?? 'Content matches restricted pattern',
        details: {
          pattern: constraint.pattern,
          match_count: matches.length,
        },
      };
    }
  }

  return { passed: true };
}

/**
 * Evaluate rate limit constraint (placeholder)
 */
function evaluateRateLimit(
  _constraint: Constraint
): { passed: boolean; reason?: string } {
  // Rate limiting requires state tracking, which is implementation-specific
  // This is a placeholder that always passes
  // Real implementations should track request counts
  return { passed: true };
}

/**
 * Evaluate resource limit constraint (placeholder)
 */
function evaluateResourceLimit(
  _constraint: Constraint
): { passed: boolean; reason?: string } {
  // Resource limits are enforced at runtime
  // This validates the constraint exists but doesn't enforce
  return { passed: true };
}

/**
 * Check if an endpoint matches a pattern (supports wildcards)
 */
function matchesEndpoint(endpoint: string, pattern: string): boolean {
  // Handle wildcard patterns
  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(2);
    return endpoint.endsWith(suffix) || endpoint.includes(`.${suffix}`);
  }

  if (pattern.endsWith('/*')) {
    const prefix = pattern.slice(0, -2);
    return endpoint.startsWith(prefix);
  }

  return endpoint === pattern || endpoint.includes(pattern);
}
