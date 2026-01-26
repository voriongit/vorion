/**
 * Q5: Provenance Capture + Policy Interpretation
 *
 * Separates immutable provenance (what) from mutable policy (how to interpret):
 * - AgentProvenance: IMMUTABLE - captured at instantiation
 * - CreationModifierPolicy: MUTABLE - can evolve independently
 *
 * Key Features:
 * - Tamper-proof provenance records
 * - Policy versioning with supersession chains
 * - Condition-based modifier evaluation
 * - Full audit trail for regulator review
 *
 * @packageDocumentation
 */

import { createLogger } from '../common/logger.js';
import {
  type AgentProvenance,
  type CreationModifierPolicy,
  type CreationModifierConditions,
  type ModifierEvaluationRecord,
  CreationType,
  agentProvenanceSchema,
  creationModifierPolicySchema,
  modifierEvaluationRecordSchema,
} from './types.js';

const logger = createLogger({ component: 'phase6:provenance' });

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
// PROVENANCE CREATION (IMMUTABLE)
// =============================================================================

/**
 * Input for creating agent provenance
 */
export interface CreateProvenanceInput {
  agentId: string;
  creationType: CreationType;
  parentAgentId?: string;
  parentProvenance?: AgentProvenance;
  createdBy: string;
}

/**
 * Create immutable agent provenance record
 * This captures the origin story of an agent and cannot be modified.
 */
export async function createProvenance(
  input: CreateProvenanceInput
): Promise<AgentProvenance> {
  // Validate parent chain for cloned/evolved/promoted
  if (input.creationType === CreationType.CLONED ||
      input.creationType === CreationType.EVOLVED ||
      input.creationType === CreationType.PROMOTED) {
    if (!input.parentAgentId || !input.parentProvenance) {
      throw new Error(
        `${input.creationType} agents must have parent provenance`
      );
    }
  }

  const now = new Date();

  // Create hash data
  const hashData = {
    agentId: input.agentId,
    creationType: input.creationType,
    parentAgentId: input.parentAgentId,
    parentProvenanceHash: input.parentProvenance?.provenanceHash,
    createdAt: now.toISOString(),
    createdBy: input.createdBy,
  };

  const provenanceHash = await calculateHash(JSON.stringify(hashData));

  const provenance: AgentProvenance = {
    agentId: input.agentId,
    creationType: input.creationType,
    parentAgentId: input.parentAgentId,
    parentProvenanceHash: input.parentProvenance?.provenanceHash,
    createdAt: now,
    createdBy: input.createdBy,
    provenanceHash,
  };

  // Validate with Zod
  const parsed = agentProvenanceSchema.safeParse(provenance);
  if (!parsed.success) {
    throw new Error(`Invalid provenance: ${parsed.error.message}`);
  }

  logger.info(
    {
      agentId: provenance.agentId,
      creationType: provenance.creationType,
      parentAgentId: input.parentAgentId,
    },
    'Provenance created (immutable)'
  );

  return Object.freeze(provenance);
}

/**
 * Verify provenance integrity
 */
export async function verifyProvenance(
  provenance: AgentProvenance
): Promise<{ valid: boolean; reason?: string }> {
  // Recalculate hash
  const hashData = {
    agentId: provenance.agentId,
    creationType: provenance.creationType,
    parentAgentId: provenance.parentAgentId,
    parentProvenanceHash: provenance.parentProvenanceHash,
    createdAt: provenance.createdAt.toISOString(),
    createdBy: provenance.createdBy,
  };

  const expectedHash = await calculateHash(JSON.stringify(hashData));

  if (provenance.provenanceHash !== expectedHash) {
    return { valid: false, reason: 'Provenance hash mismatch - possible tampering' };
  }

  return { valid: true };
}

// =============================================================================
// CREATION MODIFIER POLICIES (MUTABLE)
// =============================================================================

/**
 * Default modifiers per creation type
 */
export const DEFAULT_CREATION_MODIFIERS: Record<CreationType, number> = {
  [CreationType.FRESH]: 0,       // No modifier - baseline trust
  [CreationType.CLONED]: -50,    // Clone inherits parent concerns
  [CreationType.EVOLVED]: 100,   // Has verifiable history
  [CreationType.PROMOTED]: 150,  // Earned advancement
  [CreationType.IMPORTED]: -100, // Unknown external provenance
};

/**
 * Input for creating modifier policy
 */
export interface CreateModifierPolicyInput {
  policyId: string;
  creationType: CreationType;
  baselineModifier?: number;
  conditions?: CreationModifierConditions;
  effectiveFrom?: Date;
  effectiveUntil?: Date;
  createdBy: string;
  supersedes?: string;
}

/**
 * Create a new creation modifier policy
 */
export async function createModifierPolicy(
  input: CreateModifierPolicyInput
): Promise<CreationModifierPolicy> {
  const now = new Date();
  const baselineModifier = input.baselineModifier ?? DEFAULT_CREATION_MODIFIERS[input.creationType];

  const policyData = {
    policyId: input.policyId,
    creationType: input.creationType,
    baselineModifier,
    conditions: input.conditions,
    effectiveFrom: input.effectiveFrom ?? now,
    createdAt: now,
    createdBy: input.createdBy,
    supersedes: input.supersedes,
  };

  const policyHash = await calculateHash(JSON.stringify(policyData));

  const policy: CreationModifierPolicy = {
    policyId: input.policyId,
    version: 1,
    creationType: input.creationType,
    baselineModifier,
    conditions: input.conditions,
    effectiveFrom: input.effectiveFrom ?? now,
    effectiveUntil: input.effectiveUntil,
    createdAt: now,
    createdBy: input.createdBy,
    policyHash,
    supersedes: input.supersedes,
  };

  // Validate with Zod
  const parsed = creationModifierPolicySchema.safeParse(policy);
  if (!parsed.success) {
    throw new Error(`Invalid policy: ${parsed.error.message}`);
  }

  logger.info(
    {
      policyId: policy.policyId,
      creationType: policy.creationType,
      baselineModifier,
    },
    'Modifier policy created'
  );

  return policy;
}

/**
 * Create a new version of an existing policy
 */
export async function updateModifierPolicy(
  existingPolicy: CreationModifierPolicy,
  updates: Partial<Omit<CreateModifierPolicyInput, 'policyId' | 'creationType' | 'createdBy'>>,
  updatedBy: string
): Promise<CreationModifierPolicy> {
  const now = new Date();

  const policyData = {
    policyId: existingPolicy.policyId,
    version: existingPolicy.version + 1,
    creationType: existingPolicy.creationType,
    baselineModifier: updates.baselineModifier ?? existingPolicy.baselineModifier,
    conditions: updates.conditions ?? existingPolicy.conditions,
    effectiveFrom: updates.effectiveFrom ?? now,
    effectiveUntil: updates.effectiveUntil,
    createdAt: now,
    createdBy: updatedBy,
    supersedes: existingPolicy.policyHash,
  };

  const policyHash = await calculateHash(JSON.stringify(policyData));

  const newPolicy: CreationModifierPolicy = {
    ...policyData,
    policyHash,
  };

  // Validate with Zod
  const parsed = creationModifierPolicySchema.safeParse(newPolicy);
  if (!parsed.success) {
    throw new Error(`Invalid policy update: ${parsed.error.message}`);
  }

  logger.info(
    {
      policyId: newPolicy.policyId,
      version: newPolicy.version,
      supersedes: existingPolicy.policyHash,
    },
    'Modifier policy updated'
  );

  return newPolicy;
}

// =============================================================================
// MODIFIER EVALUATION
// =============================================================================

/**
 * Evaluation context for modifier calculation
 */
export interface ModifierEvaluationContext {
  provenance: AgentProvenance;
  parentProvenance?: AgentProvenance;
  parentTrustScore?: number;
  organizationId?: string;
  attestations?: string[];
}

/**
 * Evaluate conditions against context
 */
function evaluateConditions(
  conditions: CreationModifierConditions | undefined,
  context: ModifierEvaluationContext
): { matches: boolean; matchedConditions: string[] } {
  if (!conditions) {
    return { matches: true, matchedConditions: ['baseline'] };
  }

  const matchedConditions: string[] = [];

  // Check parent creation type
  if (conditions.parentCreationType !== undefined) {
    if (context.parentProvenance?.creationType === conditions.parentCreationType) {
      matchedConditions.push(`parentCreationType:${conditions.parentCreationType}`);
    } else {
      return { matches: false, matchedConditions };
    }
  }

  // Check parent trust score range
  if (conditions.parentTrustScore !== undefined) {
    if (context.parentTrustScore !== undefined) {
      if (
        context.parentTrustScore >= conditions.parentTrustScore.min &&
        context.parentTrustScore <= conditions.parentTrustScore.max
      ) {
        matchedConditions.push(`parentTrustScore:${conditions.parentTrustScore.min}-${conditions.parentTrustScore.max}`);
      } else {
        return { matches: false, matchedConditions };
      }
    } else {
      return { matches: false, matchedConditions };
    }
  }

  // Check trusted sources
  if (conditions.trustedSources !== undefined && conditions.trustedSources.length > 0) {
    if (context.organizationId && conditions.trustedSources.includes(context.organizationId)) {
      matchedConditions.push(`trustedSource:${context.organizationId}`);
    } else {
      return { matches: false, matchedConditions };
    }
  }

  // Check required attestations
  if (conditions.requiredAttestations !== undefined && conditions.requiredAttestations.length > 0) {
    const hasAll = conditions.requiredAttestations.every(
      (required) => context.attestations?.includes(required)
    );
    if (hasAll) {
      matchedConditions.push(`attestations:${conditions.requiredAttestations.join(',')}`);
    } else {
      return { matches: false, matchedConditions };
    }
  }

  return { matches: matchedConditions.length > 0, matchedConditions };
}

/**
 * Evaluate modifier for a provenance record
 */
export async function evaluateModifier(
  context: ModifierEvaluationContext,
  policies: CreationModifierPolicy[]
): Promise<ModifierEvaluationRecord> {
  // Find applicable policy (matching creation type, currently effective)
  const now = new Date();
  const applicablePolicies = policies
    .filter((p) => p.creationType === context.provenance.creationType)
    .filter((p) => p.effectiveFrom <= now)
    .filter((p) => !p.effectiveUntil || p.effectiveUntil > now)
    .sort((a, b) => b.version - a.version); // Prefer latest version

  if (applicablePolicies.length === 0) {
    // Fall back to default modifier
    const defaultModifier = DEFAULT_CREATION_MODIFIERS[context.provenance.creationType];

    const hashData = {
      agentId: context.provenance.agentId,
      provenanceHash: context.provenance.provenanceHash,
      computedModifier: defaultModifier,
      evaluatedAt: now.toISOString(),
    };

    const record: ModifierEvaluationRecord = {
      evaluationId: crypto.randomUUID(),
      agentId: context.provenance.agentId,
      provenanceHash: context.provenance.provenanceHash,
      policyId: 'default',
      policyVersion: 0,
      computedModifier: defaultModifier,
      conditionsMatched: ['default'],
      evaluatedAt: now,
      evaluationHash: await calculateHash(JSON.stringify(hashData)),
    };

    return record;
  }

  // Use first matching policy
  const policy = applicablePolicies[0];
  const { matches, matchedConditions } = evaluateConditions(policy.conditions, context);

  const computedModifier = matches ? policy.baselineModifier : 0;

  const hashData = {
    agentId: context.provenance.agentId,
    provenanceHash: context.provenance.provenanceHash,
    policyId: policy.policyId,
    policyVersion: policy.version,
    computedModifier,
    conditionsMatched: matchedConditions,
    evaluatedAt: now.toISOString(),
  };

  const record: ModifierEvaluationRecord = {
    evaluationId: crypto.randomUUID(),
    agentId: context.provenance.agentId,
    provenanceHash: context.provenance.provenanceHash,
    policyId: policy.policyId,
    policyVersion: policy.version,
    computedModifier,
    conditionsMatched: matchedConditions,
    evaluatedAt: now,
    evaluationHash: await calculateHash(JSON.stringify(hashData)),
  };

  // Validate with Zod
  const parsed = modifierEvaluationRecordSchema.safeParse(record);
  if (!parsed.success) {
    throw new Error(`Invalid evaluation record: ${parsed.error.message}`);
  }

  logger.debug(
    {
      agentId: record.agentId,
      policyId: record.policyId,
      modifier: record.computedModifier,
    },
    'Modifier evaluated'
  );

  return record;
}

// =============================================================================
// PROVENANCE SERVICE
// =============================================================================

/**
 * Service for managing agent provenance and modifier policies
 */
export class ProvenanceService {
  private provenances: Map<string, AgentProvenance> = new Map();
  private policies: Map<string, CreationModifierPolicy[]> = new Map(); // policyId -> versions
  private evaluations: Map<string, ModifierEvaluationRecord[]> = new Map(); // agentId -> evaluations

  /**
   * Create and register provenance for an agent
   */
  async createProvenance(input: CreateProvenanceInput): Promise<AgentProvenance> {
    // Validate parent if specified
    if (input.parentAgentId) {
      const parentProvenance = this.provenances.get(input.parentAgentId);
      if (!parentProvenance) {
        throw new Error(`Parent agent ${input.parentAgentId} not found`);
      }
      input.parentProvenance = parentProvenance;
    }

    const provenance = await createProvenance(input);
    this.provenances.set(input.agentId, provenance);
    return provenance;
  }

  /**
   * Get provenance for an agent
   */
  getProvenance(agentId: string): AgentProvenance | undefined {
    return this.provenances.get(agentId);
  }

  /**
   * Create a new modifier policy
   */
  async createPolicy(input: CreateModifierPolicyInput): Promise<CreationModifierPolicy> {
    const policy = await createModifierPolicy(input);

    const versions = this.policies.get(input.policyId) ?? [];
    versions.push(policy);
    this.policies.set(input.policyId, versions);

    return policy;
  }

  /**
   * Update an existing policy
   */
  async updatePolicy(
    policyId: string,
    updates: Partial<Omit<CreateModifierPolicyInput, 'policyId' | 'creationType' | 'createdBy'>>,
    updatedBy: string
  ): Promise<CreationModifierPolicy> {
    const versions = this.policies.get(policyId);
    if (!versions || versions.length === 0) {
      throw new Error(`Policy ${policyId} not found`);
    }

    const currentPolicy = versions[versions.length - 1];
    const newPolicy = await updateModifierPolicy(currentPolicy, updates, updatedBy);

    versions.push(newPolicy);
    return newPolicy;
  }

  /**
   * Get current version of a policy
   */
  getPolicy(policyId: string): CreationModifierPolicy | undefined {
    const versions = this.policies.get(policyId);
    return versions?.[versions.length - 1];
  }

  /**
   * Get all policy versions
   */
  getPolicyVersions(policyId: string): readonly CreationModifierPolicy[] {
    return this.policies.get(policyId) ?? [];
  }

  /**
   * Get all active policies
   */
  getActivePolicies(): CreationModifierPolicy[] {
    const now = new Date();
    const active: CreationModifierPolicy[] = [];

    for (const versions of this.policies.values()) {
      const current = versions[versions.length - 1];
      if (current.effectiveFrom <= now && (!current.effectiveUntil || current.effectiveUntil > now)) {
        active.push(current);
      }
    }

    return active;
  }

  /**
   * Evaluate modifier for an agent
   */
  async evaluateModifier(agentId: string): Promise<ModifierEvaluationRecord> {
    const provenance = this.provenances.get(agentId);
    if (!provenance) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // Get parent provenance if exists
    let parentProvenance: AgentProvenance | undefined;
    if (provenance.parentAgentId) {
      parentProvenance = this.provenances.get(provenance.parentAgentId);
    }

    const context: ModifierEvaluationContext = {
      provenance,
      parentProvenance,
    };

    const record = await evaluateModifier(context, this.getActivePolicies());

    // Store evaluation
    const agentEvaluations = this.evaluations.get(agentId) ?? [];
    agentEvaluations.push(record);
    this.evaluations.set(agentId, agentEvaluations);

    return record;
  }

  /**
   * Get evaluation history for an agent
   */
  getEvaluationHistory(agentId: string): readonly ModifierEvaluationRecord[] {
    return this.evaluations.get(agentId) ?? [];
  }

  /**
   * Verify provenance chain for an agent
   */
  async verifyProvenanceChain(agentId: string): Promise<{
    valid: boolean;
    chain: string[];
    issues: string[];
  }> {
    const chain: string[] = [];
    const issues: string[] = [];

    let currentId: string | undefined = agentId;

    while (currentId) {
      const provenance = this.provenances.get(currentId);
      if (!provenance) {
        issues.push(`Provenance for ${currentId} not found`);
        break;
      }

      chain.push(currentId);

      const result = await verifyProvenance(provenance);
      if (!result.valid) {
        issues.push(`${currentId}: ${result.reason}`);
      }

      currentId = provenance.parentAgentId;
    }

    return {
      valid: issues.length === 0,
      chain,
      issues,
    };
  }

  /**
   * Get statistics
   */
  getStats(): {
    provenanceCount: number;
    policyCount: number;
    evaluationCount: number;
    byCreationType: Record<CreationType, number>;
  } {
    const byCreationType: Record<CreationType, number> = {
      [CreationType.FRESH]: 0,
      [CreationType.CLONED]: 0,
      [CreationType.EVOLVED]: 0,
      [CreationType.PROMOTED]: 0,
      [CreationType.IMPORTED]: 0,
    };

    for (const provenance of this.provenances.values()) {
      byCreationType[provenance.creationType]++;
    }

    let evaluationCount = 0;
    for (const evals of this.evaluations.values()) {
      evaluationCount += evals.length;
    }

    return {
      provenanceCount: this.provenances.size,
      policyCount: this.policies.size,
      evaluationCount,
      byCreationType,
    };
  }
}

/**
 * Create a new provenance service instance
 */
export function createProvenanceService(): ProvenanceService {
  return new ProvenanceService();
}

/**
 * Initialize default modifier policies
 */
export async function initializeDefaultPolicies(service: ProvenanceService): Promise<void> {
  // Fresh agents - no modifier
  await service.createPolicy({
    policyId: 'default:fresh',
    creationType: CreationType.FRESH,
    baselineModifier: 0,
    createdBy: 'system',
  });

  // Cloned agents - penalty for unknown inheritance
  await service.createPolicy({
    policyId: 'default:cloned',
    creationType: CreationType.CLONED,
    baselineModifier: -50,
    conditions: {
      parentTrustScore: { min: 0, max: 500 },
    },
    createdBy: 'system',
  });

  // Cloned from trusted parent - reduced penalty
  await service.createPolicy({
    policyId: 'trusted:cloned',
    creationType: CreationType.CLONED,
    baselineModifier: -20,
    conditions: {
      parentTrustScore: { min: 500, max: 1000 },
    },
    createdBy: 'system',
  });

  // Evolved agents - bonus for verifiable history
  await service.createPolicy({
    policyId: 'default:evolved',
    creationType: CreationType.EVOLVED,
    baselineModifier: 100,
    createdBy: 'system',
  });

  // Promoted agents - significant bonus
  await service.createPolicy({
    policyId: 'default:promoted',
    creationType: CreationType.PROMOTED,
    baselineModifier: 150,
    createdBy: 'system',
  });

  // Imported agents - penalty for unknown origin
  await service.createPolicy({
    policyId: 'default:imported',
    creationType: CreationType.IMPORTED,
    baselineModifier: -100,
    createdBy: 'system',
  });

  // Imported from trusted source - reduced penalty
  await service.createPolicy({
    policyId: 'trusted:imported',
    creationType: CreationType.IMPORTED,
    baselineModifier: -30,
    conditions: {
      trustedSources: ['org:verified-partner', 'org:internal'],
    },
    createdBy: 'system',
  });

  logger.info('Default modifier policies initialized');
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  type AgentProvenance,
  type CreationModifierPolicy,
  type CreationModifierConditions,
  type ModifierEvaluationRecord,
  CreationType,
} from './types.js';
