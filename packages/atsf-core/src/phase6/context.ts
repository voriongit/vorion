/**
 * Q2: Hierarchical Context System
 *
 * Implements 4-Tier Context with Tiered Immutability:
 * - Tier 1: Deployment Context (IMMUTABLE - set at deployment)
 * - Tier 2: Organizational Context (LOCKED POST-STARTUP)
 * - Tier 3: Agent Context (FROZEN AT CREATION)
 * - Tier 4: Operation Context (EPHEMERAL - per-request)
 *
 * Key Features:
 * - Cryptographic hash chain for integrity verification
 * - Parent chain validation (each tier references parent)
 * - Ceiling inheritance (child cannot exceed parent)
 * - Regulatory framework propagation
 *
 * @packageDocumentation
 */

import { createLogger } from '../common/logger.js';
import {
  type DeploymentContext,
  type OrganizationalContext,
  type OrganizationalConstraints,
  type AgentContext,
  type OperationContext,
  type ContextValidationResult,
  ContextType,
  TrustTier,
  RegulatoryFramework,
  CONTEXT_CEILINGS,
  deploymentContextSchema,
  organizationalContextSchema,
  agentContextSchema,
  operationContextSchema,
} from './types.js';

const logger = createLogger({ component: 'phase6:context' });

// =============================================================================
// HASH UTILITIES
// =============================================================================

/**
 * Calculate SHA-256 hash for context integrity
 */
async function calculateHash(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Create deterministic hash from context data
 */
async function hashContextData(data: Record<string, unknown>): Promise<string> {
  // Sort keys for deterministic serialization
  const sortedKeys = Object.keys(data).sort();
  const sortedData: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    sortedData[key] = data[key];
  }
  return calculateHash(JSON.stringify(sortedData));
}

// =============================================================================
// TIER 1: DEPLOYMENT CONTEXT (IMMUTABLE)
// =============================================================================

/**
 * Input for creating deployment context
 */
export interface CreateDeploymentContextInput {
  deploymentId: string;
  regulatoryFramework: RegulatoryFramework;
  maxAllowedTier: TrustTier;
  allowedContextTypes: ContextType[];
  deployedBy: string;
}

/**
 * Create an immutable deployment context
 * Once created, this cannot be modified without redeployment.
 */
export async function createDeploymentContext(
  input: CreateDeploymentContextInput
): Promise<DeploymentContext> {
  const now = new Date();

  // Calculate deployment hash from configuration
  const configData = {
    deploymentId: input.deploymentId,
    regulatoryFramework: input.regulatoryFramework,
    maxAllowedTier: input.maxAllowedTier,
    allowedContextTypes: input.allowedContextTypes,
    deployedAt: now.toISOString(),
    deployedBy: input.deployedBy,
  };

  const deploymentHash = await hashContextData(configData);

  const context: DeploymentContext = {
    deploymentId: input.deploymentId,
    deploymentHash,
    regulatoryFramework: input.regulatoryFramework,
    maxAllowedTier: input.maxAllowedTier,
    allowedContextTypes: input.allowedContextTypes,
    deployedAt: now,
    deployedBy: input.deployedBy,
    immutable: true,
  };

  // Validate with Zod
  const parsed = deploymentContextSchema.safeParse(context);
  if (!parsed.success) {
    logger.error({ errors: parsed.error.errors }, 'Invalid deployment context');
    throw new Error(`Invalid deployment context: ${parsed.error.message}`);
  }

  logger.info(
    {
      deploymentId: context.deploymentId,
      framework: context.regulatoryFramework,
      maxTier: context.maxAllowedTier,
    },
    'Deployment context created'
  );

  return Object.freeze(context);
}

/**
 * Verify deployment context integrity
 */
export async function verifyDeploymentContext(
  context: DeploymentContext
): Promise<{ valid: boolean; reason?: string }> {
  // Recalculate hash
  const configData = {
    deploymentId: context.deploymentId,
    regulatoryFramework: context.regulatoryFramework,
    maxAllowedTier: context.maxAllowedTier,
    allowedContextTypes: context.allowedContextTypes,
    deployedAt: context.deployedAt.toISOString(),
    deployedBy: context.deployedBy,
  };

  const expectedHash = await hashContextData(configData);

  if (context.deploymentHash !== expectedHash) {
    return { valid: false, reason: 'Deployment hash mismatch - possible tampering' };
  }

  // Validate immutability marker
  if (context.immutable !== true) {
    return { valid: false, reason: 'Immutability marker missing' };
  }

  return { valid: true };
}

// =============================================================================
// TIER 2: ORGANIZATIONAL CONTEXT (LOCKED POST-STARTUP)
// =============================================================================

/**
 * Input for creating organizational context
 */
export interface CreateOrganizationalContextInput {
  orgId: string;
  tenantId: string;
  parentDeployment: DeploymentContext;
  constraints: Omit<OrganizationalConstraints, 'maxTrustTier'> & {
    maxTrustTier?: TrustTier;
  };
}

/**
 * Builder for organizational context
 * Allows configuration during startup, then locks.
 */
export class OrganizationalContextBuilder {
  private context: Partial<OrganizationalContext>;
  private locked: boolean = false;

  constructor(input: CreateOrganizationalContextInput) {
    // Validate parent deployment first
    if (!input.parentDeployment.immutable) {
      throw new Error('Parent deployment context must be immutable');
    }

    // Ensure max trust tier doesn't exceed parent
    const parentMaxTier = input.parentDeployment.maxAllowedTier;
    const requestedMaxTier = input.constraints.maxTrustTier ?? parentMaxTier;

    // Tier comparison (T0 < T1 < ... < T5)
    const tierOrder = [TrustTier.T0, TrustTier.T1, TrustTier.T2, TrustTier.T3, TrustTier.T4, TrustTier.T5];
    const parentTierIdx = tierOrder.indexOf(parentMaxTier);
    const requestedTierIdx = tierOrder.indexOf(requestedMaxTier);

    const effectiveMaxTier = requestedTierIdx <= parentTierIdx ? requestedMaxTier : parentMaxTier;

    const constraints: OrganizationalConstraints = {
      maxTrustTier: effectiveMaxTier,
      deniedDomains: input.constraints.deniedDomains,
      requiredAttestations: input.constraints.requiredAttestations,
      dataClassification: input.constraints.dataClassification,
      auditLevel: input.constraints.auditLevel,
    };

    this.context = {
      orgId: input.orgId,
      tenantId: input.tenantId,
      parentDeployment: input.parentDeployment,
      constraints,
    };
  }

  /**
   * Update constraints (only allowed before locking)
   */
  updateConstraints(updates: Partial<OrganizationalConstraints>): this {
    if (this.locked) {
      throw new Error('Organizational context is locked - cannot modify constraints');
    }

    // Ensure updates don't exceed parent deployment ceiling
    if (updates.maxTrustTier !== undefined) {
      const parentMaxTier = this.context.parentDeployment!.maxAllowedTier;
      const tierOrder = [TrustTier.T0, TrustTier.T1, TrustTier.T2, TrustTier.T3, TrustTier.T4, TrustTier.T5];
      const parentTierIdx = tierOrder.indexOf(parentMaxTier);
      const requestedTierIdx = tierOrder.indexOf(updates.maxTrustTier);

      if (requestedTierIdx > parentTierIdx) {
        throw new Error(`Cannot set maxTrustTier to ${updates.maxTrustTier} - parent deployment limits to ${parentMaxTier}`);
      }
    }

    this.context.constraints = {
      ...this.context.constraints!,
      ...updates,
    };
    return this;
  }

  /**
   * Add denied domain
   */
  addDeniedDomain(domain: string): this {
    if (this.locked) {
      throw new Error('Organizational context is locked - cannot add denied domains');
    }
    this.context.constraints = {
      ...this.context.constraints!,
      deniedDomains: [...this.context.constraints!.deniedDomains, domain],
    };
    return this;
  }

  /**
   * Add required attestation
   */
  addRequiredAttestation(attestation: string): this {
    if (this.locked) {
      throw new Error('Organizational context is locked - cannot add attestations');
    }
    this.context.constraints = {
      ...this.context.constraints!,
      requiredAttestations: [...this.context.constraints!.requiredAttestations, attestation],
    };
    return this;
  }

  /**
   * Lock the organizational context (no further modifications allowed)
   */
  async lock(): Promise<OrganizationalContext> {
    if (this.locked) {
      throw new Error('Organizational context is already locked');
    }

    const now = new Date();

    // Calculate org hash including parent chain
    const hashData = {
      orgId: this.context.orgId,
      tenantId: this.context.tenantId,
      parentDeploymentHash: this.context.parentDeployment!.deploymentHash,
      constraints: this.context.constraints,
      lockedAt: now.toISOString(),
    };

    const orgHash = await hashContextData(hashData);

    const lockedContext: OrganizationalContext = {
      orgId: this.context.orgId!,
      tenantId: this.context.tenantId!,
      parentDeployment: this.context.parentDeployment!,
      lockedAt: now,
      constraints: this.context.constraints!,
      orgHash,
    };

    // Validate with Zod
    const parsed = organizationalContextSchema.safeParse(lockedContext);
    if (!parsed.success) {
      throw new Error(`Invalid organizational context: ${parsed.error.message}`);
    }

    this.locked = true;

    logger.info(
      {
        orgId: lockedContext.orgId,
        tenantId: lockedContext.tenantId,
        maxTier: lockedContext.constraints.maxTrustTier,
      },
      'Organizational context locked'
    );

    return Object.freeze(lockedContext);
  }

  /**
   * Check if context is locked
   */
  isLocked(): boolean {
    return this.locked;
  }
}

/**
 * Create and immediately lock organizational context
 */
export async function createOrganizationalContext(
  input: CreateOrganizationalContextInput
): Promise<OrganizationalContext> {
  const builder = new OrganizationalContextBuilder(input);
  return builder.lock();
}

/**
 * Verify organizational context integrity
 */
export async function verifyOrganizationalContext(
  context: OrganizationalContext
): Promise<{ valid: boolean; reason?: string }> {
  // Verify parent first
  const parentResult = await verifyDeploymentContext(context.parentDeployment);
  if (!parentResult.valid) {
    return { valid: false, reason: `Parent deployment invalid: ${parentResult.reason}` };
  }

  // Verify org is locked
  if (!context.lockedAt) {
    return { valid: false, reason: 'Organizational context not locked' };
  }

  // Recalculate hash
  const hashData = {
    orgId: context.orgId,
    tenantId: context.tenantId,
    parentDeploymentHash: context.parentDeployment.deploymentHash,
    constraints: context.constraints,
    lockedAt: context.lockedAt.toISOString(),
  };

  const expectedHash = await hashContextData(hashData);

  if (context.orgHash !== expectedHash) {
    return { valid: false, reason: 'Organizational hash mismatch - possible tampering' };
  }

  // Verify constraints don't exceed parent
  const tierOrder = [TrustTier.T0, TrustTier.T1, TrustTier.T2, TrustTier.T3, TrustTier.T4, TrustTier.T5];
  const parentTierIdx = tierOrder.indexOf(context.parentDeployment.maxAllowedTier);
  const orgTierIdx = tierOrder.indexOf(context.constraints.maxTrustTier);

  if (orgTierIdx > parentTierIdx) {
    return {
      valid: false,
      reason: `Organizational tier ${context.constraints.maxTrustTier} exceeds parent ${context.parentDeployment.maxAllowedTier}`,
    };
  }

  return { valid: true };
}

// =============================================================================
// TIER 3: AGENT CONTEXT (FROZEN AT CREATION)
// =============================================================================

/**
 * Input for creating agent context
 */
export interface CreateAgentContextInput {
  agentId: string;
  parentOrg: OrganizationalContext;
  contextType: ContextType;
  createdBy: string;
}

/**
 * Create an agent context (frozen at creation)
 * Once created, this cannot be modified for the lifetime of the agent.
 */
export async function createAgentContext(
  input: CreateAgentContextInput
): Promise<AgentContext> {
  // Verify parent is locked
  if (!input.parentOrg.lockedAt) {
    throw new Error('Parent organizational context must be locked before creating agent context');
  }

  // Verify context type is allowed by deployment
  if (!input.parentOrg.parentDeployment.allowedContextTypes.includes(input.contextType)) {
    throw new Error(
      `Context type ${input.contextType} not allowed by deployment - allowed: ${input.parentOrg.parentDeployment.allowedContextTypes.join(', ')}`
    );
  }

  const now = new Date();

  // Calculate context hash including parent chain
  const hashData = {
    agentId: input.agentId,
    parentOrgHash: input.parentOrg.orgHash,
    contextType: input.contextType,
    createdAt: now.toISOString(),
    createdBy: input.createdBy,
  };

  const contextHash = await hashContextData(hashData);

  const context: AgentContext = {
    agentId: input.agentId,
    parentOrg: input.parentOrg,
    contextType: input.contextType,
    createdAt: now,
    createdBy: input.createdBy,
    contextHash,
  };

  // Validate with Zod
  const parsed = agentContextSchema.safeParse(context);
  if (!parsed.success) {
    throw new Error(`Invalid agent context: ${parsed.error.message}`);
  }

  logger.info(
    {
      agentId: context.agentId,
      contextType: context.contextType,
      parentOrgId: input.parentOrg.orgId,
    },
    'Agent context created (frozen)'
  );

  return Object.freeze(context);
}

/**
 * Verify agent context integrity
 */
export async function verifyAgentContext(
  context: AgentContext
): Promise<{ valid: boolean; reason?: string }> {
  // Verify parent chain
  const orgResult = await verifyOrganizationalContext(context.parentOrg);
  if (!orgResult.valid) {
    return { valid: false, reason: `Parent organization invalid: ${orgResult.reason}` };
  }

  // Verify context type is still allowed
  if (!context.parentOrg.parentDeployment.allowedContextTypes.includes(context.contextType)) {
    return {
      valid: false,
      reason: `Context type ${context.contextType} no longer allowed by deployment`,
    };
  }

  // Recalculate hash
  const hashData = {
    agentId: context.agentId,
    parentOrgHash: context.parentOrg.orgHash,
    contextType: context.contextType,
    createdAt: context.createdAt.toISOString(),
    createdBy: context.createdBy,
  };

  const expectedHash = await hashContextData(hashData);

  if (context.contextHash !== expectedHash) {
    return { valid: false, reason: 'Agent context hash mismatch - possible tampering' };
  }

  return { valid: true };
}

/**
 * Get the effective ceiling for an agent context
 * Considers: deployment ceiling, org ceiling, and context type ceiling
 */
export function getAgentContextCeiling(context: AgentContext): number {
  // Context type ceiling
  const contextCeiling = CONTEXT_CEILINGS[context.contextType];

  // Org constraint ceiling (convert tier to score)
  const tierOrder = [TrustTier.T0, TrustTier.T1, TrustTier.T2, TrustTier.T3, TrustTier.T4, TrustTier.T5];
  const tierScores = [99, 299, 499, 699, 899, 1000];
  const orgTierIdx = tierOrder.indexOf(context.parentOrg.constraints.maxTrustTier);
  const orgCeiling = tierScores[orgTierIdx];

  // Deployment ceiling
  const deploymentTierIdx = tierOrder.indexOf(context.parentOrg.parentDeployment.maxAllowedTier);
  const deploymentCeiling = tierScores[deploymentTierIdx];

  // Return minimum of all ceilings
  return Math.min(contextCeiling, orgCeiling, deploymentCeiling);
}

// =============================================================================
// TIER 4: OPERATION CONTEXT (EPHEMERAL)
// =============================================================================

/**
 * Input for creating operation context
 */
export interface CreateOperationContextInput {
  parentAgent: AgentContext;
  requestMetadata?: Record<string, unknown>;
  ttlMs?: number; // Time to live in milliseconds (default: 5 minutes)
}

/**
 * Create an ephemeral operation context
 * Automatically expires after TTL.
 */
export async function createOperationContext(
  input: CreateOperationContextInput
): Promise<OperationContext> {
  // Verify parent agent context
  const agentResult = await verifyAgentContext(input.parentAgent);
  if (!agentResult.valid) {
    throw new Error(`Invalid parent agent context: ${agentResult.reason}`);
  }

  const now = new Date();
  const ttlMs = input.ttlMs ?? 5 * 60 * 1000; // Default 5 minutes
  const expiresAt = new Date(now.getTime() + ttlMs);

  const context: OperationContext = {
    operationId: crypto.randomUUID(),
    parentAgent: input.parentAgent,
    requestMetadata: input.requestMetadata ?? {},
    correlationId: crypto.randomUUID(),
    startedAt: now,
    expiresAt,
    ephemeral: true,
  };

  // Validate with Zod
  const parsed = operationContextSchema.safeParse(context);
  if (!parsed.success) {
    throw new Error(`Invalid operation context: ${parsed.error.message}`);
  }

  logger.debug(
    {
      operationId: context.operationId,
      agentId: input.parentAgent.agentId,
      ttlMs,
    },
    'Operation context created (ephemeral)'
  );

  return context; // Not frozen - can be modified during operation
}

/**
 * Check if operation context is expired
 */
export function isOperationExpired(context: OperationContext): boolean {
  return new Date() > context.expiresAt;
}

/**
 * Get the effective ceiling for an operation
 * Inherits from agent context ceiling
 */
export function getOperationCeiling(context: OperationContext): number {
  return getAgentContextCeiling(context.parentAgent);
}

// =============================================================================
// FULL CONTEXT CHAIN VALIDATION
// =============================================================================

/**
 * Validate entire context hierarchy from operation to deployment
 */
export async function validateContextChain(
  context: OperationContext | AgentContext | OrganizationalContext | DeploymentContext
): Promise<ContextValidationResult> {
  const violations: string[] = [];
  let hashChainValid = true;
  let tier: ContextValidationResult['tier'];

  // Determine context tier and validate
  if ('ephemeral' in context && context.ephemeral === true) {
    // Operation context
    tier = 'operation';
    const opContext = context as OperationContext;

    if (isOperationExpired(opContext)) {
      violations.push('Operation context has expired');
    }

    // Validate parent chain
    const agentResult = await verifyAgentContext(opContext.parentAgent);
    if (!agentResult.valid) {
      violations.push(`Agent context invalid: ${agentResult.reason}`);
      hashChainValid = false;
    }
  } else if ('contextHash' in context) {
    // Agent context
    tier = 'agent';
    const agentContext = context as AgentContext;

    const result = await verifyAgentContext(agentContext);
    if (!result.valid) {
      violations.push(result.reason!);
      hashChainValid = false;
    }
  } else if ('orgHash' in context) {
    // Organizational context
    tier = 'organizational';
    const orgContext = context as OrganizationalContext;

    const result = await verifyOrganizationalContext(orgContext);
    if (!result.valid) {
      violations.push(result.reason!);
      hashChainValid = false;
    }
  } else {
    // Deployment context
    tier = 'deployment';
    const deployContext = context as DeploymentContext;

    const result = await verifyDeploymentContext(deployContext);
    if (!result.valid) {
      violations.push(result.reason!);
      hashChainValid = false;
    }
  }

  return {
    valid: violations.length === 0,
    tier,
    reason: violations.length > 0 ? violations.join('; ') : undefined,
    constraintViolations: violations,
    hashChainValid,
    validatedAt: new Date(),
  };
}

// =============================================================================
// CONTEXT SERVICE
// =============================================================================

/**
 * Service for managing the 4-tier context hierarchy
 */
export class ContextService {
  private deployments: Map<string, DeploymentContext> = new Map();
  private organizations: Map<string, OrganizationalContext> = new Map();
  private agents: Map<string, AgentContext> = new Map();
  private activeOperations: Map<string, OperationContext> = new Map();

  /**
   * Register a deployment context
   */
  registerDeployment(context: DeploymentContext): void {
    if (this.deployments.has(context.deploymentId)) {
      throw new Error(`Deployment ${context.deploymentId} already registered`);
    }
    this.deployments.set(context.deploymentId, context);
    logger.info({ deploymentId: context.deploymentId }, 'Deployment registered');
  }

  /**
   * Register an organizational context
   */
  registerOrganization(context: OrganizationalContext): void {
    if (!context.lockedAt) {
      throw new Error('Cannot register unlocked organizational context');
    }
    if (this.organizations.has(context.orgId)) {
      throw new Error(`Organization ${context.orgId} already registered`);
    }
    this.organizations.set(context.orgId, context);
    logger.info({ orgId: context.orgId, tenantId: context.tenantId }, 'Organization registered');
  }

  /**
   * Register an agent context
   */
  registerAgent(context: AgentContext): void {
    if (this.agents.has(context.agentId)) {
      throw new Error(`Agent ${context.agentId} already registered`);
    }
    this.agents.set(context.agentId, context);
    logger.info({ agentId: context.agentId }, 'Agent registered');
  }

  /**
   * Create and register an operation context
   */
  async createOperation(input: CreateOperationContextInput): Promise<OperationContext> {
    const context = await createOperationContext(input);
    this.activeOperations.set(context.operationId, context);
    return context;
  }

  /**
   * Complete an operation (removes from active)
   */
  completeOperation(operationId: string): void {
    this.activeOperations.delete(operationId);
    logger.debug({ operationId }, 'Operation completed');
  }

  /**
   * Get deployment by ID
   */
  getDeployment(deploymentId: string): DeploymentContext | undefined {
    return this.deployments.get(deploymentId);
  }

  /**
   * Get organization by ID
   */
  getOrganization(orgId: string): OrganizationalContext | undefined {
    return this.organizations.get(orgId);
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): AgentContext | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get active operation by ID
   */
  getOperation(operationId: string): OperationContext | undefined {
    return this.activeOperations.get(operationId);
  }

  /**
   * Cleanup expired operations
   */
  cleanupExpiredOperations(): number {
    let cleaned = 0;
    for (const [id, context] of this.activeOperations) {
      if (isOperationExpired(context)) {
        this.activeOperations.delete(id);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      logger.debug({ cleaned }, 'Cleaned up expired operations');
    }
    return cleaned;
  }

  /**
   * Get statistics
   */
  getStats(): {
    deployments: number;
    organizations: number;
    agents: number;
    activeOperations: number;
  } {
    return {
      deployments: this.deployments.size,
      organizations: this.organizations.size,
      agents: this.agents.size,
      activeOperations: this.activeOperations.size,
    };
  }
}

/**
 * Create a new context service instance
 */
export function createContextService(): ContextService {
  return new ContextService();
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  type DeploymentContext,
  type OrganizationalContext,
  type OrganizationalConstraints,
  type AgentContext,
  type OperationContext,
  type ContextValidationResult,
  ContextType,
  TrustTier,
  RegulatoryFramework,
  CONTEXT_CEILINGS,
} from './types.js';
