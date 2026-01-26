/**
 * Q3: Stratified Role Gates (3-Layer Enforcement)
 *
 * Implements three-layer role+trust enforcement:
 * - Layer 1: Kernel (structure validation from pre-computed matrix)
 * - Layer 2: Policy (authorization via policy-as-code rules)
 * - Layer 3: BASIS/ENFORCE (runtime context with dual-control override)
 *
 * Key Features:
 * - Pre-computed role gate matrix (compile-time verification)
 * - Policy rules with priority, conditions, and actions
 * - Dual-control override for exceptional cases
 * - Full audit trail of all evaluations
 *
 * @packageDocumentation
 */

import { createLogger } from '../common/logger.js';
import {
  type RoleGateEntry,
  type RoleGatePolicy,
  type RoleGatePolicyRule,
  type RoleGateCondition,
  type RoleGateEvaluation,
  AgentRole,
  TrustTier,
  ContextType,
  ROLE_GATE_MATRIX,
  validateRoleGateKernel,
  roleGatePolicySchema,
  roleGateEvaluationSchema,
} from './types.js';

const logger = createLogger({ component: 'phase6:role-gates' });

// =============================================================================
// HASH UTILITIES
// =============================================================================

/**
 * Calculate SHA-256 hash
 */
async function calculateHash(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// =============================================================================
// KERNEL LAYER (Pre-computed Matrix)
// =============================================================================

/**
 * Get all role gate entries
 */
export function getRoleGateMatrix(): readonly RoleGateEntry[] {
  const entries: RoleGateEntry[] = [];

  for (const role of Object.values(AgentRole)) {
    const allowedTiers: TrustTier[] = [];
    let minimumTier: TrustTier = TrustTier.T5;

    for (const tier of Object.values(TrustTier)) {
      if (ROLE_GATE_MATRIX[role][tier]) {
        allowedTiers.push(tier);
        // Track minimum tier
        const tierOrder = [TrustTier.T0, TrustTier.T1, TrustTier.T2, TrustTier.T3, TrustTier.T4, TrustTier.T5];
        if (tierOrder.indexOf(tier) < tierOrder.indexOf(minimumTier)) {
          minimumTier = tier;
        }
      }
    }

    entries.push({
      role,
      minimumTier,
      allowedTiers,
    });
  }

  return entries;
}

/**
 * Get minimum required tier for a role
 */
export function getMinimumTierForRole(role: AgentRole): TrustTier {
  for (const tier of [TrustTier.T0, TrustTier.T1, TrustTier.T2, TrustTier.T3, TrustTier.T4, TrustTier.T5]) {
    if (ROLE_GATE_MATRIX[role][tier]) {
      return tier;
    }
  }
  return TrustTier.T5; // Fallback - requires highest tier
}

/**
 * Kernel layer validation result
 */
export interface KernelLayerResult {
  valid: boolean;
  matrixAllows: boolean;
  reason?: string;
}

/**
 * Kernel layer: Validate role+tier combination against matrix
 * This is the fastest check - uses pre-computed matrix.
 */
export function evaluateKernelLayer(role: AgentRole, tier: TrustTier): KernelLayerResult {
  const matrixAllows = validateRoleGateKernel(role, tier);

  if (!matrixAllows) {
    const minimumTier = getMinimumTierForRole(role);
    return {
      valid: false,
      matrixAllows: false,
      reason: `Role ${role} requires minimum tier ${minimumTier}, current tier ${tier}`,
    };
  }

  return {
    valid: true,
    matrixAllows: true,
  };
}

// =============================================================================
// POLICY LAYER (Authorization Rules)
// =============================================================================

/**
 * Policy evaluation context
 */
export interface PolicyEvaluationContext {
  role: AgentRole;
  tier: TrustTier;
  contextType?: ContextType;
  domains?: string[];
  currentTime?: Date;
  attestations?: string[];
}

/**
 * Check if condition matches context
 */
function conditionMatches(condition: RoleGateCondition, context: PolicyEvaluationContext): boolean {
  // Check roles
  if (condition.roles && condition.roles.length > 0) {
    if (!condition.roles.includes(context.role)) {
      return false;
    }
  }

  // Check tiers
  if (condition.tiers && condition.tiers.length > 0) {
    if (!condition.tiers.includes(context.tier)) {
      return false;
    }
  }

  // Check context types
  if (condition.contextTypes && condition.contextTypes.length > 0) {
    if (!context.contextType || !condition.contextTypes.includes(context.contextType)) {
      return false;
    }
  }

  // Check domains
  if (condition.domains && condition.domains.length > 0) {
    if (!context.domains || !condition.domains.some((d) => context.domains!.includes(d))) {
      return false;
    }
  }

  // Check time window
  if (condition.timeWindow) {
    const now = context.currentTime ?? new Date();
    const currentHHMM = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    if (currentHHMM < condition.timeWindow.start || currentHHMM > condition.timeWindow.end) {
      return false;
    }
  }

  // Check attestations
  if (condition.requiresAttestation && condition.requiresAttestation.length > 0) {
    if (!context.attestations) {
      return false;
    }
    for (const required of condition.requiresAttestation) {
      if (!context.attestations.includes(required)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Policy layer result
 */
export interface PolicyLayerResult {
  valid: boolean;
  appliedRuleId?: string;
  appliedPolicyVersion?: number;
  action: 'ALLOW' | 'DENY' | 'ESCALATE';
  reason: string;
}

/**
 * Policy layer: Evaluate authorization rules
 */
export function evaluatePolicyLayer(
  context: PolicyEvaluationContext,
  policy: RoleGatePolicy
): PolicyLayerResult {
  // Sort rules by priority (lower number = higher priority)
  const sortedRules = [...policy.rules].sort((a, b) => a.priority - b.priority);

  for (const rule of sortedRules) {
    if (conditionMatches(rule.condition, context)) {
      return {
        valid: rule.action === 'ALLOW',
        appliedRuleId: rule.ruleId,
        appliedPolicyVersion: policy.version,
        action: rule.action,
        reason: rule.reason,
      };
    }
  }

  // No rules matched - default allow (kernel already validated)
  return {
    valid: true,
    action: 'ALLOW',
    reason: 'No policy rules matched - default allow',
  };
}

// =============================================================================
// BASIS/ENFORCE LAYER (Runtime Context)
// =============================================================================

/**
 * Override request for dual-control scenarios
 */
export interface OverrideRequest {
  requestedBy: string;
  approvedBy: string;
  reason: string;
  expiresAt: Date;
}

/**
 * BASIS layer context
 */
export interface BasisLayerContext {
  agentId: string;
  contextConstraints: {
    allowedRoles?: AgentRole[];
    deniedRoles?: AgentRole[];
    requiresOverride?: boolean;
    overrideRequest?: OverrideRequest;
  };
}

/**
 * Validate override request
 */
function validateOverride(override: OverrideRequest): { valid: boolean; reason?: string } {
  const now = new Date();

  // Check expiration
  if (override.expiresAt < now) {
    return { valid: false, reason: 'Override has expired' };
  }

  // Check dual-control (requester != approver)
  if (override.requestedBy === override.approvedBy) {
    return { valid: false, reason: 'Override requires dual-control (different requester and approver)' };
  }

  return { valid: true };
}

/**
 * BASIS layer result
 */
export interface BasisLayerResult {
  valid: boolean;
  requiresOverride: boolean;
  overrideSignatures?: string[];
  contextConstraintsMet: boolean;
  reason?: string;
}

/**
 * BASIS/ENFORCE layer: Runtime context validation
 */
export function evaluateBasisLayer(
  role: AgentRole,
  context: BasisLayerContext
): BasisLayerResult {
  // Check denied roles
  if (context.contextConstraints.deniedRoles?.includes(role)) {
    return {
      valid: false,
      requiresOverride: false,
      contextConstraintsMet: false,
      reason: `Role ${role} is explicitly denied by context constraints`,
    };
  }

  // Check allowed roles (if specified, role must be in list)
  if (context.contextConstraints.allowedRoles && context.contextConstraints.allowedRoles.length > 0) {
    if (!context.contextConstraints.allowedRoles.includes(role)) {
      return {
        valid: false,
        requiresOverride: true,
        contextConstraintsMet: false,
        reason: `Role ${role} not in allowed roles list`,
      };
    }
  }

  // Check if override is required
  if (context.contextConstraints.requiresOverride) {
    if (!context.contextConstraints.overrideRequest) {
      return {
        valid: false,
        requiresOverride: true,
        contextConstraintsMet: true,
        reason: 'Override required but not provided',
      };
    }

    const overrideResult = validateOverride(context.contextConstraints.overrideRequest);
    if (!overrideResult.valid) {
      return {
        valid: false,
        requiresOverride: true,
        contextConstraintsMet: true,
        reason: overrideResult.reason,
      };
    }

    return {
      valid: true,
      requiresOverride: true,
      overrideSignatures: [
        context.contextConstraints.overrideRequest.requestedBy,
        context.contextConstraints.overrideRequest.approvedBy,
      ],
      contextConstraintsMet: true,
    };
  }

  return {
    valid: true,
    requiresOverride: false,
    contextConstraintsMet: true,
  };
}

// =============================================================================
// FULL ROLE GATE EVALUATION
// =============================================================================

/**
 * Evaluate all three layers and produce final decision
 */
export async function evaluateRoleGate(
  agentId: string,
  role: AgentRole,
  tier: TrustTier,
  policy: RoleGatePolicy,
  basisContext: BasisLayerContext,
  policyContext?: Partial<PolicyEvaluationContext>
): Promise<RoleGateEvaluation> {
  const now = new Date();

  // Layer 1: Kernel
  const kernelResult = evaluateKernelLayer(role, tier);

  // Layer 2: Policy
  const fullPolicyContext: PolicyEvaluationContext = {
    role,
    tier,
    ...policyContext,
  };
  const policyResult = evaluatePolicyLayer(fullPolicyContext, policy);

  // Layer 3: BASIS/ENFORCE
  const basisResult = evaluateBasisLayer(role, basisContext);

  // Determine final decision
  let decision: 'ALLOW' | 'DENY' | 'ESCALATE';

  if (!kernelResult.valid) {
    // Kernel denial cannot be overridden
    decision = 'DENY';
  } else if (!policyResult.valid) {
    decision = policyResult.action;
  } else if (!basisResult.valid) {
    decision = basisResult.requiresOverride ? 'ESCALATE' : 'DENY';
  } else {
    decision = 'ALLOW';
  }

  const evaluationData = {
    evaluationId: crypto.randomUUID(),
    agentId,
    role,
    tier,
    timestamp: now,
    kernelResult: {
      valid: kernelResult.valid,
      matrixAllows: kernelResult.matrixAllows,
      reason: kernelResult.reason,
    },
    policyResult: {
      valid: policyResult.valid,
      appliedRuleId: policyResult.appliedRuleId,
      appliedPolicyVersion: policyResult.appliedPolicyVersion,
      action: policyResult.action,
      reason: policyResult.reason,
    },
    basisResult: {
      valid: basisResult.valid,
      requiresOverride: basisResult.requiresOverride,
      overrideSignatures: basisResult.overrideSignatures,
      contextConstraintsMet: basisResult.contextConstraintsMet,
      reason: basisResult.reason,
    },
    decision,
    decidedAt: now,
  };

  const evaluationHash = await calculateHash(JSON.stringify(evaluationData));

  const evaluation: RoleGateEvaluation = {
    ...evaluationData,
    evaluationHash,
  };

  // Validate with Zod
  const parsed = roleGateEvaluationSchema.safeParse(evaluation);
  if (!parsed.success) {
    throw new Error(`Invalid role gate evaluation: ${parsed.error.message}`);
  }

  if (decision !== 'ALLOW') {
    logger.warn(
      {
        agentId,
        role,
        tier,
        decision,
        kernelValid: kernelResult.valid,
        policyValid: policyResult.valid,
        basisValid: basisResult.valid,
      },
      'Role gate denied or escalated'
    );
  }

  return evaluation;
}

// =============================================================================
// DEFAULT POLICIES
// =============================================================================

/**
 * Create default role gate policy
 */
export async function createDefaultRoleGatePolicy(createdBy: string): Promise<RoleGatePolicy> {
  const now = new Date();

  const policy: RoleGatePolicy = {
    policyId: 'default:role-gate-policy',
    version: 1,
    rules: [
      // Rule 1: Block sovereign roles (R-L6+) in non-sovereign contexts
      {
        ruleId: 'rule:sovereign-context-required',
        name: 'Sovereign Context Required for High Roles',
        condition: {
          roles: [AgentRole.R_L6, AgentRole.R_L7, AgentRole.R_L8],
          contextTypes: [ContextType.LOCAL, ContextType.ENTERPRISE],
        },
        action: 'DENY',
        priority: 10,
        reason: 'Sovereign roles (R-L6+) require sovereign context',
      },

      // Rule 2: Require attestation for orchestrators
      {
        ruleId: 'rule:orchestrator-attestation',
        name: 'Orchestrator Attestation Required',
        condition: {
          roles: [AgentRole.R_L3],
          requiresAttestation: ['capability:orchestration'],
        },
        action: 'ALLOW',
        priority: 20,
        reason: 'Orchestrators require capability attestation',
      },
      {
        ruleId: 'rule:orchestrator-no-attestation',
        name: 'Orchestrator Without Attestation',
        condition: {
          roles: [AgentRole.R_L3],
        },
        action: 'ESCALATE',
        priority: 21,
        reason: 'Orchestrator without attestation requires approval',
      },

      // Rule 3: Allow basic roles everywhere
      {
        ruleId: 'rule:basic-roles-allowed',
        name: 'Basic Roles Allowed',
        condition: {
          roles: [AgentRole.R_L0, AgentRole.R_L1],
        },
        action: 'ALLOW',
        priority: 100,
        reason: 'Listener and executor roles are generally allowed',
      },

      // Rule 4: Business hours restriction for architects
      {
        ruleId: 'rule:architect-business-hours',
        name: 'Architect Business Hours Only',
        condition: {
          roles: [AgentRole.R_L4],
          timeWindow: { start: '09:00', end: '17:00' },
        },
        action: 'ALLOW',
        priority: 30,
        reason: 'Architects allowed during business hours',
      },
      {
        ruleId: 'rule:architect-outside-hours',
        name: 'Architect Outside Hours Escalation',
        condition: {
          roles: [AgentRole.R_L4],
        },
        action: 'ESCALATE',
        priority: 31,
        reason: 'Architect operations outside business hours require approval',
      },
    ],
    effectiveFrom: now,
    createdAt: now,
    createdBy,
    policyHash: await calculateHash(JSON.stringify({
      policyId: 'default:role-gate-policy',
      version: 1,
      createdAt: now.toISOString(),
    })),
  };

  return policy;
}

// =============================================================================
// ROLE GATE SERVICE
// =============================================================================

/**
 * Service for managing role gate evaluations
 */
export class RoleGateService {
  private policies: Map<string, RoleGatePolicy[]> = new Map(); // policyId -> versions
  private evaluations: Map<string, RoleGateEvaluation[]> = new Map(); // agentId -> evaluations
  private defaultPolicy?: RoleGatePolicy;

  /**
   * Initialize with default policy
   */
  async initialize(createdBy: string = 'system'): Promise<void> {
    this.defaultPolicy = await createDefaultRoleGatePolicy(createdBy);
    const versions = [this.defaultPolicy];
    this.policies.set(this.defaultPolicy.policyId, versions);
    logger.info('Role gate service initialized with default policy');
  }

  /**
   * Register a custom policy
   */
  registerPolicy(policy: RoleGatePolicy): void {
    const versions = this.policies.get(policy.policyId) ?? [];
    versions.push(policy);
    this.policies.set(policy.policyId, versions);
    logger.info({ policyId: policy.policyId, version: policy.version }, 'Policy registered');
  }

  /**
   * Get current policy version
   */
  getPolicy(policyId: string): RoleGatePolicy | undefined {
    const versions = this.policies.get(policyId);
    return versions?.[versions.length - 1];
  }

  /**
   * Get default policy
   */
  getDefaultPolicy(): RoleGatePolicy | undefined {
    return this.defaultPolicy;
  }

  /**
   * Evaluate role gate for an agent
   */
  async evaluate(
    agentId: string,
    role: AgentRole,
    tier: TrustTier,
    basisContext: BasisLayerContext,
    options?: {
      policyId?: string;
      policyContext?: Partial<PolicyEvaluationContext>;
    }
  ): Promise<RoleGateEvaluation> {
    // Get policy
    const policy = options?.policyId
      ? this.getPolicy(options.policyId)
      : this.defaultPolicy;

    if (!policy) {
      throw new Error('No policy available for evaluation');
    }

    // Evaluate
    const evaluation = await evaluateRoleGate(
      agentId,
      role,
      tier,
      policy,
      basisContext,
      options?.policyContext
    );

    // Store evaluation
    const agentEvaluations = this.evaluations.get(agentId) ?? [];
    agentEvaluations.push(evaluation);
    this.evaluations.set(agentId, agentEvaluations);

    return evaluation;
  }

  /**
   * Quick check (kernel layer only)
   */
  quickCheck(role: AgentRole, tier: TrustTier): boolean {
    return validateRoleGateKernel(role, tier);
  }

  /**
   * Get evaluation history for an agent
   */
  getEvaluationHistory(agentId: string): readonly RoleGateEvaluation[] {
    return this.evaluations.get(agentId) ?? [];
  }

  /**
   * Get all evaluations that resulted in denial or escalation
   */
  getDeniedEvaluations(): readonly RoleGateEvaluation[] {
    const denied: RoleGateEvaluation[] = [];

    for (const evaluations of this.evaluations.values()) {
      for (const evaluation of evaluations) {
        if (evaluation.decision !== 'ALLOW') {
          denied.push(evaluation);
        }
      }
    }

    return denied.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalEvaluations: number;
    byDecision: Record<'ALLOW' | 'DENY' | 'ESCALATE', number>;
    byRole: Record<AgentRole, number>;
    policyCount: number;
  } {
    const byDecision = { ALLOW: 0, DENY: 0, ESCALATE: 0 };
    const byRole: Record<AgentRole, number> = {} as Record<AgentRole, number>;

    for (const role of Object.values(AgentRole)) {
      byRole[role] = 0;
    }

    let totalEvaluations = 0;

    for (const evaluations of this.evaluations.values()) {
      for (const evaluation of evaluations) {
        totalEvaluations++;
        byDecision[evaluation.decision]++;
        byRole[evaluation.role]++;
      }
    }

    return {
      totalEvaluations,
      byDecision,
      byRole,
      policyCount: this.policies.size,
    };
  }
}

/**
 * Create a new role gate service
 */
export function createRoleGateService(): RoleGateService {
  return new RoleGateService();
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  type RoleGateEntry,
  type RoleGatePolicy,
  type RoleGatePolicyRule,
  type RoleGateCondition,
  type RoleGateEvaluation,
  AgentRole,
  TrustTier,
  ROLE_GATE_MATRIX,
  validateRoleGateKernel,
} from './types.js';
