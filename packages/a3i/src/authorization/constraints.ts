/**
 * Constraint Generation - Generate decision constraints based on trust level
 *
 * Constraints define what an agent can do when a request is permitted.
 * Higher trust levels get more permissive constraints.
 */

import {
  TrustBand,
  ApprovalType,
  ActionType,
  DataSensitivity,
  Reversibility,
  type DecisionConstraints,
  type ApprovalRequirement,
  type RateLimit,
  type Intent,
} from '@orion/contracts';

/**
 * Constraint preset for a trust band
 */
export interface ConstraintPreset {
  /** Default allowed tools at this band */
  defaultTools: string[];
  /** Default data scopes at this band */
  defaultDataScopes: string[];
  /** Default rate limits */
  defaultRateLimits: RateLimit[];
  /** Maximum execution time in ms */
  maxExecutionTimeMs: number;
  /** Maximum retry attempts */
  maxRetries: number;
  /** Whether reversibility is required */
  reversibilityRequired: boolean;
}

/**
 * Default constraint presets by trust band
 */
export const BAND_CONSTRAINT_PRESETS: Record<TrustBand, ConstraintPreset> = {
  [TrustBand.T0_UNTRUSTED]: {
    defaultTools: [],
    defaultDataScopes: [],
    defaultRateLimits: [{ resource: 'requests', limit: 0, windowSeconds: 60 }],
    maxExecutionTimeMs: 0,
    maxRetries: 0,
    reversibilityRequired: true,
  },
  [TrustBand.T1_SUPERVISED]: {
    defaultTools: ['read_public'],
    defaultDataScopes: ['public'],
    defaultRateLimits: [{ resource: 'requests', limit: 10, windowSeconds: 60 }],
    maxExecutionTimeMs: 5000,
    maxRetries: 1,
    reversibilityRequired: true,
  },
  [TrustBand.T2_CONSTRAINED]: {
    defaultTools: ['read_public', 'read_internal', 'write_reversible'],
    defaultDataScopes: ['public', 'internal'],
    defaultRateLimits: [{ resource: 'requests', limit: 50, windowSeconds: 60 }],
    maxExecutionTimeMs: 30000,
    maxRetries: 2,
    reversibilityRequired: true,
  },
  [TrustBand.T3_TRUSTED]: {
    defaultTools: ['read_public', 'read_internal', 'write_reversible', 'write_irreversible', 'execute_sandboxed'],
    defaultDataScopes: ['public', 'internal', 'confidential'],
    defaultRateLimits: [{ resource: 'requests', limit: 200, windowSeconds: 60 }],
    maxExecutionTimeMs: 60000,
    maxRetries: 3,
    reversibilityRequired: false,
  },
  [TrustBand.T4_AUTONOMOUS]: {
    defaultTools: ['read_public', 'read_internal', 'write_reversible', 'write_irreversible', 'execute_sandboxed', 'execute_production', 'communicate_internal', 'communicate_external'],
    defaultDataScopes: ['public', 'internal', 'confidential', 'restricted'],
    defaultRateLimits: [{ resource: 'requests', limit: 1000, windowSeconds: 60 }],
    maxExecutionTimeMs: 300000,
    maxRetries: 5,
    reversibilityRequired: false,
  },
  [TrustBand.T5_MISSION_CRITICAL]: {
    defaultTools: ['*'],
    defaultDataScopes: ['*'],
    defaultRateLimits: [], // No limits
    maxExecutionTimeMs: 0, // No limit
    maxRetries: 10,
    reversibilityRequired: false,
  },
};

/**
 * Approval requirements by action risk level
 */
export interface ApprovalPolicy {
  /** Minimum trust band that bypasses this approval */
  bypassBand: TrustBand;
  /** Approval type required below bypass band */
  approvalType: ApprovalType;
  /** Who needs to approve */
  approverRole: string;
  /** Timeout for approval in ms */
  timeoutMs: number;
  /** Reason message */
  reason: string;
}

/**
 * Default approval policies
 */
export const DEFAULT_APPROVAL_POLICIES: Record<string, ApprovalPolicy> = {
  irreversible_action: {
    bypassBand: TrustBand.T3_TRUSTED,
    approvalType: ApprovalType.HUMAN_REVIEW,
    approverRole: 'supervisor',
    timeoutMs: 300000,
    reason: 'Irreversible action requires human approval at this trust level',
  },
  restricted_data: {
    bypassBand: TrustBand.T4_AUTONOMOUS,
    approvalType: ApprovalType.MULTI_PARTY,
    approverRole: 'data_owner',
    timeoutMs: 600000,
    reason: 'Access to restricted data requires multi-party approval',
  },
  external_communication: {
    bypassBand: TrustBand.T3_TRUSTED,
    approvalType: ApprovalType.AUTOMATED_CHECK,
    approverRole: 'system',
    timeoutMs: 5000,
    reason: 'External communication requires verification',
  },
  production_execution: {
    bypassBand: TrustBand.T3_TRUSTED,
    approvalType: ApprovalType.HUMAN_REVIEW,
    approverRole: 'operator',
    timeoutMs: 300000,
    reason: 'Production execution requires operator approval',
  },
};

/**
 * Options for constraint generation
 */
export interface ConstraintGenerationOptions {
  /** Override default tools */
  allowedTools?: string[];
  /** Override default data scopes */
  dataScopes?: string[];
  /** Override rate limits */
  rateLimits?: RateLimit[];
  /** Additional approval requirements */
  additionalApprovals?: ApprovalRequirement[];
  /** Custom resource quotas */
  resourceQuotas?: Record<string, number>;
}

/**
 * Generate constraints for a decision based on trust band and intent
 */
export function generateConstraints(
  band: TrustBand,
  intent: Intent,
  options: ConstraintGenerationOptions = {}
): DecisionConstraints {
  const preset = BAND_CONSTRAINT_PRESETS[band];

  // Determine required approvals
  const requiredApprovals = determineApprovals(band, intent);
  if (options.additionalApprovals) {
    requiredApprovals.push(...options.additionalApprovals);
  }

  // Determine allowed tools
  let allowedTools = options.allowedTools ?? [...preset.defaultTools];
  allowedTools = filterToolsByIntent(allowedTools, intent);

  // Determine data scopes
  let dataScopes = options.dataScopes ?? [...preset.defaultDataScopes];
  dataScopes = filterScopesByIntent(dataScopes, intent);

  // Determine rate limits
  const rateLimits = options.rateLimits ?? [...preset.defaultRateLimits];

  // Determine reversibility requirement
  const reversibilityRequired = determineReversibilityRequired(band, intent, preset);

  return {
    requiredApprovals,
    allowedTools,
    dataScopes,
    rateLimits,
    reversibilityRequired,
    maxExecutionTimeMs: preset.maxExecutionTimeMs || undefined,
    maxRetries: preset.maxRetries || undefined,
    resourceQuotas: options.resourceQuotas,
  };
}

/**
 * Determine what approvals are required based on band and intent
 */
function determineApprovals(band: TrustBand, intent: Intent): ApprovalRequirement[] {
  const approvals: ApprovalRequirement[] = [];

  // Check for irreversible actions
  if (intent.reversibility === Reversibility.IRREVERSIBLE) {
    const policy = DEFAULT_APPROVAL_POLICIES.irreversible_action!;
    if (band < policy.bypassBand) {
      approvals.push({
        type: policy.approvalType,
        approver: policy.approverRole,
        timeoutMs: policy.timeoutMs,
        reason: policy.reason,
      });
    }
  }

  // Check for restricted data
  if (intent.dataSensitivity === DataSensitivity.RESTRICTED) {
    const policy = DEFAULT_APPROVAL_POLICIES.restricted_data!;
    if (band < policy.bypassBand) {
      approvals.push({
        type: policy.approvalType,
        approver: policy.approverRole,
        timeoutMs: policy.timeoutMs,
        reason: policy.reason,
      });
    }
  }

  // Check for external communication
  if (intent.actionType === ActionType.COMMUNICATE && intent.context?.metadata?.external) {
    const policy = DEFAULT_APPROVAL_POLICIES.external_communication!;
    if (band < policy.bypassBand) {
      approvals.push({
        type: policy.approvalType,
        approver: policy.approverRole,
        timeoutMs: policy.timeoutMs,
        reason: policy.reason,
      });
    }
  }

  // Check for production execution
  if (
    intent.actionType === ActionType.EXECUTE &&
    intent.context?.environment === 'production'
  ) {
    const policy = DEFAULT_APPROVAL_POLICIES.production_execution!;
    if (band < policy.bypassBand) {
      approvals.push({
        type: policy.approvalType,
        approver: policy.approverRole,
        timeoutMs: policy.timeoutMs,
        reason: policy.reason,
      });
    }
  }

  return approvals;
}

/**
 * Filter tools based on intent action type
 */
function filterToolsByIntent(tools: string[], intent: Intent): string[] {
  // Allow all if wildcard
  if (tools.includes('*')) {
    return ['*'];
  }

  // Filter based on action type
  switch (intent.actionType) {
    case ActionType.READ:
      return tools.filter((t) => t.startsWith('read_'));
    case ActionType.WRITE:
      return tools.filter((t) => t.startsWith('write_') || t.startsWith('read_'));
    case ActionType.DELETE:
      return tools.filter((t) => t.startsWith('write_') || t.startsWith('delete_') || t.startsWith('read_'));
    case ActionType.EXECUTE:
      return tools.filter((t) => t.startsWith('execute_') || t.startsWith('read_'));
    case ActionType.COMMUNICATE:
      return tools.filter((t) => t.startsWith('communicate_') || t.startsWith('read_'));
    case ActionType.TRANSFER:
      return tools.filter((t) => t.startsWith('transfer_') || t.startsWith('read_'));
    default:
      return tools;
  }
}

/**
 * Filter data scopes based on intent sensitivity
 */
function filterScopesByIntent(scopes: string[], intent: Intent): string[] {
  // Allow all if wildcard
  if (scopes.includes('*')) {
    return ['*'];
  }

  const sensitivityOrder = [
    DataSensitivity.PUBLIC,
    DataSensitivity.INTERNAL,
    DataSensitivity.CONFIDENTIAL,
    DataSensitivity.RESTRICTED,
  ];
  const scopeOrder = ['public', 'internal', 'confidential', 'restricted'];

  const intentLevel = sensitivityOrder.indexOf(intent.dataSensitivity);
  if (intentLevel === -1) return scopes;

  // Filter to scopes at or below the intent's sensitivity
  return scopes.filter((scope) => {
    const scopeLevel = scopeOrder.indexOf(scope);
    return scopeLevel !== -1 && scopeLevel <= intentLevel;
  });
}

/**
 * Determine if reversibility is required
 */
function determineReversibilityRequired(
  band: TrustBand,
  intent: Intent,
  preset: ConstraintPreset
): boolean {
  // If intent is already reversible, no requirement needed
  if (intent.reversibility === Reversibility.REVERSIBLE) {
    return false;
  }

  // Higher trust bands don't require reversibility
  if (band >= TrustBand.T3_TRUSTED) {
    return false;
  }

  return preset.reversibilityRequired;
}

/**
 * Check if constraints allow an action
 */
export function constraintsPermit(
  constraints: DecisionConstraints,
  actionType: ActionType,
  dataSensitivity: DataSensitivity
): boolean {
  // Check if tools allow the action type
  const toolPrefix = actionType.toLowerCase();
  const hasMatchingTool =
    constraints.allowedTools.includes('*') ||
    constraints.allowedTools.some((t) => t.startsWith(toolPrefix) || t.startsWith('read_'));

  if (!hasMatchingTool) {
    return false;
  }

  // Check data scope
  const sensitivityToScope: Record<DataSensitivity, string> = {
    [DataSensitivity.PUBLIC]: 'public',
    [DataSensitivity.INTERNAL]: 'internal',
    [DataSensitivity.CONFIDENTIAL]: 'confidential',
    [DataSensitivity.RESTRICTED]: 'restricted',
  };
  const requiredScope = sensitivityToScope[dataSensitivity];

  const hasScopeAccess =
    constraints.dataScopes.includes('*') ||
    constraints.dataScopes.includes(requiredScope);

  return hasScopeAccess;
}

/**
 * Merge two sets of constraints (more restrictive wins)
 */
export function mergeConstraints(
  a: DecisionConstraints,
  b: DecisionConstraints
): DecisionConstraints {
  return {
    requiredApprovals: [...a.requiredApprovals, ...b.requiredApprovals],
    allowedTools: a.allowedTools.filter((t) => b.allowedTools.includes(t) || t === '*'),
    dataScopes: a.dataScopes.filter((s) => b.dataScopes.includes(s) || s === '*'),
    rateLimits: [...a.rateLimits, ...b.rateLimits],
    reversibilityRequired: a.reversibilityRequired || b.reversibilityRequired,
    maxExecutionTimeMs:
      a.maxExecutionTimeMs && b.maxExecutionTimeMs
        ? Math.min(a.maxExecutionTimeMs, b.maxExecutionTimeMs)
        : a.maxExecutionTimeMs ?? b.maxExecutionTimeMs,
    maxRetries:
      a.maxRetries !== undefined && b.maxRetries !== undefined
        ? Math.min(a.maxRetries, b.maxRetries)
        : a.maxRetries ?? b.maxRetries,
  };
}
