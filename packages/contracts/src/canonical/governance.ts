/**
 * @fileoverview Canonical Governance type definitions for the Vorion Platform.
 *
 * This file provides the authoritative definitions for governance-related types
 * including authorization results, authentication context, hierarchy levels,
 * and authority scopes. These types unify various implementations across the
 * codebase into a single source of truth.
 *
 * @module @vorion/contracts/canonical/governance
 */

import { z } from 'zod';
import { DenialReason } from '../v2/decision.js';

// Re-export DenialReason for convenience
export { DenialReason };

// ============================================================================
// Authorization Result
// ============================================================================

/**
 * Extended denial reasons for governance-specific scenarios.
 *
 * These extend the base DenialReason enum with governance-specific codes.
 * Use DenialReason for trust/policy denials, and these for RBAC/scope denials.
 */
export enum GovernanceDenialReason {
  /** User lacks required roles for the action */
  MISSING_ROLES = 'missing_roles',
  /** User lacks required permissions for the action */
  MISSING_PERMISSIONS = 'missing_permissions',
  /** Action is outside the authorized scope */
  SCOPE_VIOLATION = 'scope_violation',
  /** Human oversight/approval is required but not present */
  REQUIRES_HUMAN_APPROVAL = 'requires_human_approval',
}

/**
 * Zod schema for GovernanceDenialReason enum validation.
 */
export const governanceDenialReasonSchema = z.nativeEnum(GovernanceDenialReason, {
  errorMap: () => ({ message: 'Invalid governance denial reason' }),
});

/**
 * Zod schema for base DenialReason enum validation (from v2/decision.ts).
 */
export const denialReasonSchema = z.nativeEnum(DenialReason, {
  errorMap: () => ({ message: 'Invalid denial reason' }),
});

/**
 * Zod schema for combined denial reasons (DenialReason or GovernanceDenialReason).
 */
export const anyDenialReasonSchema = z.union([
  denialReasonSchema,
  governanceDenialReasonSchema,
]);

/**
 * Result of an authorization check.
 *
 * Unifies simple RBAC-style checks (roles/permissions) and more complex
 * trust-based authorization decisions. Provides rich context about why
 * a request was allowed or denied.
 */
export interface AuthorizationResult {
  /** Whether the action is authorized */
  readonly allowed: boolean;

  /** Human-readable explanation of the decision */
  readonly reason?: string;

  /** Specific denial reason code (when allowed=false) - trust/policy denial */
  readonly denialReason?: DenialReason;

  /** Specific denial reason code (when allowed=false) - governance/RBAC denial */
  readonly governanceDenialReason?: GovernanceDenialReason;

  /** Roles that matched the authorization requirement (RBAC) */
  readonly matchedRoles?: readonly string[];

  /** Permissions that matched the authorization requirement (RBAC) */
  readonly matchedPermissions?: readonly string[];

  /** Constraints that apply to the authorized action */
  readonly constraints?: AuthorizationConstraints;

  /** Recommended remediation steps if denied */
  readonly remediations?: readonly string[];

  /** When this authorization decision expires */
  readonly expiresAt?: Date;
}

/**
 * Constraints applied to an authorized action.
 *
 * Even when an action is allowed, these constraints define the
 * boundaries within which it must be executed.
 */
export interface AuthorizationConstraints {
  /** Maximum number of operations allowed */
  readonly maxOperations?: number;

  /** Time window in milliseconds for the authorization */
  readonly validityMs?: number;

  /** Resource identifiers this authorization applies to */
  readonly resources?: readonly string[];

  /** Data sensitivity levels allowed */
  readonly allowedSensitivity?: readonly string[];

  /** Whether human oversight is required during execution */
  readonly requiresOversight?: boolean;

  /** Additional custom constraints */
  readonly custom?: Readonly<Record<string, unknown>>;
}

/**
 * Zod schema for AuthorizationConstraints.
 */
export const authorizationConstraintsSchema = z.object({
  maxOperations: z.number().int().positive().optional(),
  validityMs: z.number().int().positive().optional(),
  resources: z.array(z.string()).optional(),
  allowedSensitivity: z.array(z.string()).optional(),
  requiresOversight: z.boolean().optional(),
  custom: z.record(z.unknown()).optional(),
});

/**
 * Zod schema for AuthorizationResult.
 */
export const authorizationResultSchema = z.object({
  allowed: z.boolean(),
  reason: z.string().optional(),
  denialReason: denialReasonSchema.optional(),
  governanceDenialReason: governanceDenialReasonSchema.optional(),
  matchedRoles: z.array(z.string()).readonly().optional(),
  matchedPermissions: z.array(z.string()).readonly().optional(),
  constraints: authorizationConstraintsSchema.optional(),
  remediations: z.array(z.string()).readonly().optional(),
  expiresAt: z.date().optional(),
});

/** TypeScript type inferred from the Zod schema */
export type AuthorizationResultType = z.infer<typeof authorizationResultSchema>;

// ============================================================================
// Authentication Context
// ============================================================================

/**
 * Governance roles for permission-based access control.
 *
 * Defines roles specific to governance operations.
 * These roles determine what governance actions a user can perform.
 *
 * Note: For user management roles, see UserRole in agent.ts
 */
export type GovernanceRole =
  | 'admin'      // Full system access
  | 'operator'   // Day-to-day operations
  | 'trainer'    // Agent training and certification
  | 'consumer'   // Agent usage only
  | 'reviewer'   // Audit and review access
  | 'both';      // Combined trainer + consumer

/**
 * Zod schema for GovernanceRole validation.
 */
export const governanceRoleSchema = z.enum(['admin', 'operator', 'trainer', 'consumer', 'reviewer', 'both'], {
  errorMap: () => ({ message: 'Invalid governance role' }),
});

/**
 * Authentication context for an authenticated user/entity.
 *
 * Contains identity information extracted from JWT tokens or session data.
 * Used throughout the system to make authorization decisions.
 */
export interface AuthContext {
  /** Unique identifier for the authenticated user */
  readonly userId: string;

  /** Tenant/organization the user belongs to */
  readonly tenantId: string;

  /** Roles assigned to the user */
  readonly roles: readonly string[];

  /** Fine-grained permissions assigned to the user */
  readonly permissions: readonly string[];

  /** User's primary governance role (for UI/simple RBAC) */
  readonly governanceRole?: GovernanceRole;

  /** Current session identifier */
  readonly sessionId?: string;

  /** Agent ID if this context represents an agent */
  readonly agentId?: string;

  /** Hierarchy level if this context represents a hierarchical entity */
  readonly hierarchyLevel?: HierarchyLevel;

  /** Additional attributes from the authentication source */
  readonly attributes?: Readonly<Record<string, unknown>>;
}

/**
 * Zod schema for AuthContext.
 */
export const authContextSchema = z.object({
  userId: z.string().min(1),
  tenantId: z.string().min(1),
  roles: z.array(z.string()).readonly(),
  permissions: z.array(z.string()).readonly(),
  governanceRole: governanceRoleSchema.optional(),
  sessionId: z.string().optional(),
  agentId: z.string().optional(),
  hierarchyLevel: z.lazy(() => hierarchyLevelSchema).optional(),
  attributes: z.record(z.unknown()).readonly().optional(),
});

/** TypeScript type inferred from the Zod schema */
export type AuthContextType = z.infer<typeof authContextSchema>;

// ============================================================================
// Hierarchy Levels
// ============================================================================

/**
 * Canonical hierarchy levels for agent/entity organization.
 *
 * The platform supports two hierarchy models that can be unified:
 *
 * **Named Hierarchy** (5 tiers, semantic):
 * - HITL: Human-In-The-Loop (ultimate authority)
 * - ORCH: Orchestrators (workflow coordination)
 * - METAGOAT: Meta-agents (optimization/training)
 * - AGENT: Domain specialists (task execution)
 * - BOT: User-facing interfaces
 *
 * **Numbered Hierarchy** (9 tiers, granular):
 * - L8: Mission stewardship (equivalent to HITL)
 * - L7-L5: Strategic/organizational levels
 * - L4-L3: Project/coordination levels (ORCH)
 * - L2: Planning level (METAGOAT)
 * - L1: Execution level (AGENT)
 * - L0: Interface level (BOT)
 *
 * The canonical definition uses the named approach with numeric tiers
 * for granularity within each named level.
 */
export type HierarchyLevel =
  | 'hitl'      // Tier 0 - Human authority (highest)
  | 'orch'      // Tier 1 - Orchestrators
  | 'metagoat'  // Tier 2 - Meta-level agents
  | 'agent'     // Tier 3 - Domain specialists
  | 'bot';      // Tier 4 - User-facing (lowest)

/**
 * Zod schema for HierarchyLevel validation.
 */
export const hierarchyLevelSchema = z.enum(['hitl', 'orch', 'metagoat', 'agent', 'bot'], {
  errorMap: () => ({ message: 'Invalid hierarchy level. Must be hitl, orch, metagoat, agent, or bot.' }),
});

/**
 * Numeric tier mapping for hierarchy levels.
 * Lower numbers = higher authority.
 */
export const HIERARCHY_TIERS: Readonly<Record<HierarchyLevel, number>> = {
  hitl: 0,
  orch: 1,
  metagoat: 2,
  agent: 3,
  bot: 4,
} as const;

/**
 * Array of hierarchy levels in authority order (highest first).
 */
export const HIERARCHY_ORDER: readonly HierarchyLevel[] = [
  'hitl',
  'orch',
  'metagoat',
  'agent',
  'bot',
] as const;

/**
 * Configuration for a hierarchy level.
 */
export interface HierarchyLevelConfig {
  /** The hierarchy level */
  readonly level: HierarchyLevel;

  /** Numeric tier (0 = highest authority) */
  readonly tier: number;

  /** Human-readable name */
  readonly name: string;

  /** Description of the level's responsibilities */
  readonly description: string;

  /** Scope of authority for this level */
  readonly authorityScope: AuthorityScopeType;

  /** Authority score (0-100, higher = more authority) */
  readonly authority: number;

  /** Levels this entity can delegate to */
  readonly canDelegate: readonly HierarchyLevel[];

  /** Level this entity reports to (null for HITL) */
  readonly reportsTo: HierarchyLevel | null;

  /** Maximum autonomy level (1-5) */
  readonly maxAutonomyLevel: number;

  /** Whether this level can train other entities */
  readonly canTrainOthers: boolean;

  /** Whether this level can approve other entities */
  readonly canApproveOthers: boolean;

  /** Whether human oversight is required for this level */
  readonly requiresHumanOversight: boolean;

  /** Minimum trust score required (0-1000) */
  readonly minTrustScore: number;
}

/**
 * Canonical hierarchy level configurations.
 */
export const HIERARCHY_LEVELS: Readonly<Record<HierarchyLevel, HierarchyLevelConfig>> = {
  hitl: {
    level: 'hitl',
    tier: 0,
    name: 'Human-In-The-Loop',
    description: 'Human oversight and ultimate authority. Makes final decisions on ethics, safety, strategic direction, and high-stakes operations.',
    authorityScope: 'governance',
    authority: 100,
    canDelegate: ['orch', 'metagoat', 'agent', 'bot'],
    reportsTo: null,
    maxAutonomyLevel: 5,
    canTrainOthers: true,
    canApproveOthers: true,
    requiresHumanOversight: false,
    minTrustScore: 0,
  },
  orch: {
    level: 'orch',
    tier: 1,
    name: 'Orchestrator',
    description: 'Coordinates complex multi-agent workflows. Manages resource allocation, task distribution, and cross-team collaboration.',
    authorityScope: 'coordination',
    authority: 80,
    canDelegate: ['metagoat', 'agent', 'bot'],
    reportsTo: 'hitl',
    maxAutonomyLevel: 4,
    canTrainOthers: true,
    canApproveOthers: true,
    requiresHumanOversight: true,
    minTrustScore: 800,
  },
  metagoat: {
    level: 'metagoat',
    tier: 2,
    name: 'Metagoat',
    description: 'Meta-level agent that optimizes, teaches, and manages other agents. Handles strategy, capability enhancement, and performance optimization.',
    authorityScope: 'management',
    authority: 60,
    canDelegate: ['agent', 'bot'],
    reportsTo: 'orch',
    maxAutonomyLevel: 4,
    canTrainOthers: true,
    canApproveOthers: true,
    requiresHumanOversight: false,
    minTrustScore: 600,
  },
  agent: {
    level: 'agent',
    tier: 3,
    name: 'Agent',
    description: 'Domain specialist with deep expertise. Executes complex tasks, provides recommendations, and manages bots within their specialty.',
    authorityScope: 'execution',
    authority: 40,
    canDelegate: ['bot'],
    reportsTo: 'metagoat',
    maxAutonomyLevel: 3,
    canTrainOthers: false,
    canApproveOthers: false,
    requiresHumanOversight: false,
    minTrustScore: 400,
  },
  bot: {
    level: 'bot',
    tier: 4,
    name: 'Bot',
    description: 'User-facing interface with defined persona and guardrails. Handles direct interactions, follows scripts, and escalates when needed.',
    authorityScope: 'interaction',
    authority: 20,
    canDelegate: [],
    reportsTo: 'agent',
    maxAutonomyLevel: 2,
    canTrainOthers: false,
    canApproveOthers: false,
    requiresHumanOversight: false,
    minTrustScore: 200,
  },
} as const;

/**
 * Zod schema for HierarchyLevelConfig.
 */
export const hierarchyLevelConfigSchema = z.object({
  level: hierarchyLevelSchema,
  tier: z.number().int().min(0).max(10),
  name: z.string().min(1),
  description: z.string().min(1),
  authorityScope: z.lazy(() => authorityScopeTypeSchema),
  authority: z.number().int().min(0).max(100),
  canDelegate: z.array(hierarchyLevelSchema).readonly(),
  reportsTo: hierarchyLevelSchema.nullable(),
  maxAutonomyLevel: z.number().int().min(1).max(5),
  canTrainOthers: z.boolean(),
  canApproveOthers: z.boolean(),
  requiresHumanOversight: z.boolean(),
  minTrustScore: z.number().int().min(0).max(1000),
});

// ============================================================================
// Authority Scope
// ============================================================================

/**
 * Authority scope types defining what kind of authority an entity has.
 */
export type AuthorityScopeType =
  | 'governance'    // Policy and ethics oversight
  | 'coordination'  // Workflow and resource coordination
  | 'management'    // Entity and capability management
  | 'execution'     // Task and operation execution
  | 'interaction';  // User-facing interaction

/**
 * Zod schema for AuthorityScopeType validation.
 */
export const authorityScopeTypeSchema = z.enum(
  ['governance', 'coordination', 'management', 'execution', 'interaction'],
  { errorMap: () => ({ message: 'Invalid authority scope type' }) }
);

/**
 * Control actions that can be taken by governance rules.
 */
export type ControlAction =
  | 'allow'      // Permit the action
  | 'deny'       // Block the action
  | 'constrain'  // Allow with constraints
  | 'clarify'    // Require clarification
  | 'escalate'   // Escalate to higher authority
  | 'log'        // Log only, no enforcement
  | 'audit';     // Special audit handling

/**
 * Zod schema for ControlAction validation.
 */
export const controlActionSchema = z.enum(
  ['allow', 'deny', 'constrain', 'clarify', 'escalate', 'log', 'audit'],
  { errorMap: () => ({ message: 'Invalid control action' }) }
);

/**
 * Detailed authority scope definition.
 *
 * Defines the specific boundaries of an authority, including what namespaces,
 * actions, resources, and capabilities fall under its purview.
 */
export interface AuthorityScope {
  /** High-level type of authority */
  readonly type: AuthorityScopeType;

  /** Namespaces this authority applies to */
  readonly namespaces: readonly string[];

  /** Actions this authority can authorize */
  readonly actions: readonly ControlAction[];

  /** Resource patterns this authority applies to */
  readonly resources: readonly string[];

  /** Capabilities this authority can grant */
  readonly capabilities: readonly string[];

  /** Time-based restrictions */
  readonly timeRestrictions?: AuthorityScopeTimeRestriction;

  /** Geographic or context-based restrictions */
  readonly contextRestrictions?: Readonly<Record<string, unknown>>;
}

/**
 * Time-based restrictions for an authority scope.
 */
export interface AuthorityScopeTimeRestriction {
  /** Days of week when authority is valid (0=Sunday) */
  readonly daysOfWeek?: readonly number[];

  /** Start time (HH:MM format) */
  readonly startTime?: string;

  /** End time (HH:MM format) */
  readonly endTime?: string;

  /** Timezone for time restrictions */
  readonly timezone?: string;
}

/**
 * Zod schema for AuthorityScopeTimeRestriction.
 */
export const authorityScopeTimeRestrictionSchema = z.object({
  daysOfWeek: z.array(z.number().int().min(0).max(6)).readonly().optional(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  timezone: z.string().optional(),
});

/**
 * Zod schema for AuthorityScope.
 */
export const authorityScopeSchema = z.object({
  type: authorityScopeTypeSchema,
  namespaces: z.array(z.string()).readonly(),
  actions: z.array(controlActionSchema).readonly(),
  resources: z.array(z.string()).readonly(),
  capabilities: z.array(z.string()).readonly(),
  timeRestrictions: authorityScopeTimeRestrictionSchema.optional(),
  contextRestrictions: z.record(z.unknown()).readonly().optional(),
});

/** TypeScript type inferred from the Zod schema */
export type AuthorityScopeZodType = z.infer<typeof authorityScopeSchema>;

// ============================================================================
// Authority Definition
// ============================================================================

/**
 * Types of authority that can be held.
 */
export type AuthorityType =
  | 'system'      // Built-in system authority
  | 'role'        // Role-based authority
  | 'delegated'   // Delegated from another authority
  | 'temporary'   // Time-limited authority
  | 'emergency';  // Emergency override authority

/**
 * Zod schema for AuthorityType validation.
 */
export const authorityTypeSchema = z.enum(
  ['system', 'role', 'delegated', 'temporary', 'emergency'],
  { errorMap: () => ({ message: 'Invalid authority type' }) }
);

/**
 * Complete authority definition.
 *
 * Represents a grant of authority to perform specific actions within
 * defined scopes, with associated permissions and constraints.
 */
export interface Authority {
  /** Unique identifier for this authority */
  readonly authorityId: string;

  /** Human-readable name */
  readonly name: string;

  /** Type of authority */
  readonly type: AuthorityType;

  /** Scope of this authority */
  readonly scope: AuthorityScope;

  /** Specific permissions granted */
  readonly permissions: readonly Permission[];

  /** Authority this was delegated from (if delegated) */
  readonly delegatedFrom?: string;

  /** Minimum trust level required to use this authority */
  readonly requiredTrustLevel: number;

  /** When this authority expires */
  readonly expiresAt?: Date;

  /** Whether this authority is currently active */
  readonly active: boolean;

  /** Audit metadata */
  readonly audit: AuthorityAudit;
}

/**
 * Permission granted by an authority.
 */
export interface Permission {
  /** Unique identifier for this permission */
  readonly permissionId: string;

  /** Action this permission allows */
  readonly action: string;

  /** Resource this permission applies to */
  readonly resource: string;

  /** Conditions that must be met for the permission to apply */
  readonly conditions?: Readonly<Record<string, unknown>>;

  /** Whether the permission is granted (true) or denied (false) */
  readonly granted: boolean;
}

/**
 * Audit information for an authority.
 */
export interface AuthorityAudit {
  /** When the authority was created */
  readonly createdAt: Date;

  /** Who created the authority */
  readonly createdBy: string;

  /** When the authority was last updated */
  readonly updatedAt: Date;

  /** Who last updated the authority */
  readonly updatedBy: string;

  /** When the authority was approved (if required) */
  readonly approvedAt?: Date;

  /** Who approved the authority */
  readonly approvedBy?: string;
}

/**
 * Zod schema for Permission.
 */
export const permissionSchema = z.object({
  permissionId: z.string().min(1),
  action: z.string().min(1),
  resource: z.string().min(1),
  conditions: z.record(z.unknown()).readonly().optional(),
  granted: z.boolean(),
});

/**
 * Zod schema for AuthorityAudit.
 */
export const authorityAuditSchema = z.object({
  createdAt: z.date(),
  createdBy: z.string().min(1),
  updatedAt: z.date(),
  updatedBy: z.string().min(1),
  approvedAt: z.date().optional(),
  approvedBy: z.string().optional(),
});

/**
 * Zod schema for Authority.
 */
export const authoritySchema = z.object({
  authorityId: z.string().min(1),
  name: z.string().min(1),
  type: authorityTypeSchema,
  scope: authorityScopeSchema,
  permissions: z.array(permissionSchema).readonly(),
  delegatedFrom: z.string().optional(),
  requiredTrustLevel: z.number().int().min(0).max(1000),
  expiresAt: z.date().optional(),
  active: z.boolean(),
  audit: authorityAuditSchema,
});

/** TypeScript type inferred from the Zod schema */
export type AuthorityZodType = z.infer<typeof authoritySchema>;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Gets the numeric tier for a hierarchy level.
 *
 * @param level - The hierarchy level
 * @returns The numeric tier (0 = highest authority)
 */
export function getHierarchyTier(level: HierarchyLevel): number {
  return HIERARCHY_TIERS[level];
}

/**
 * Gets the configuration for a hierarchy level.
 *
 * @param level - The hierarchy level
 * @returns The level configuration
 */
export function getHierarchyLevelConfig(level: HierarchyLevel): HierarchyLevelConfig {
  return HIERARCHY_LEVELS[level];
}

/**
 * Checks if one hierarchy level has higher authority than another.
 *
 * @param a - First hierarchy level
 * @param b - Second hierarchy level
 * @returns True if a has higher authority than b
 */
export function isHigherAuthority(a: HierarchyLevel, b: HierarchyLevel): boolean {
  return HIERARCHY_TIERS[a] < HIERARCHY_TIERS[b];
}

/**
 * Checks if a hierarchy level can delegate to another level.
 *
 * @param from - The delegating level
 * @param to - The target level
 * @returns True if delegation is allowed
 */
export function canDelegate(from: HierarchyLevel, to: HierarchyLevel): boolean {
  return HIERARCHY_LEVELS[from].canDelegate.includes(to);
}

/**
 * Gets the reporting chain for a hierarchy level.
 *
 * @param level - The starting hierarchy level
 * @returns Array of levels in the reporting chain (from top to starting level)
 */
export function getReportingChain(level: HierarchyLevel): HierarchyLevel[] {
  const chain: HierarchyLevel[] = [level];
  let current = HIERARCHY_LEVELS[level].reportsTo;

  while (current !== null) {
    chain.unshift(current);
    current = HIERARCHY_LEVELS[current].reportsTo;
  }

  return chain;
}

/**
 * Checks if a trust score meets the minimum requirement for a hierarchy level.
 *
 * @param level - The hierarchy level
 * @param trustScore - The trust score to check (0-1000)
 * @returns True if the trust score meets the minimum
 */
export function meetsMinimumTrust(level: HierarchyLevel, trustScore: number): boolean {
  return trustScore >= HIERARCHY_LEVELS[level].minTrustScore;
}

/**
 * Creates an allowed authorization result.
 *
 * @param options - Optional parameters for the result
 * @returns An allowed AuthorizationResult
 */
export function createAllowedResult(options?: {
  reason?: string;
  matchedRoles?: string[];
  matchedPermissions?: string[];
  constraints?: AuthorizationConstraints;
  expiresAt?: Date;
}): AuthorizationResult {
  return {
    allowed: true,
    reason: options?.reason ?? 'Authorization granted',
    matchedRoles: options?.matchedRoles,
    matchedPermissions: options?.matchedPermissions,
    constraints: options?.constraints,
    expiresAt: options?.expiresAt,
  };
}

/**
 * Creates a denied authorization result for trust/policy denials.
 *
 * @param denialReason - The reason for denial (from DenialReason enum)
 * @param options - Optional parameters for the result
 * @returns A denied AuthorizationResult
 */
export function createDeniedResult(
  denialReason: DenialReason,
  options?: {
    reason?: string;
    remediations?: string[];
  }
): AuthorizationResult {
  return {
    allowed: false,
    denialReason,
    reason: options?.reason ?? `Authorization denied: ${denialReason}`,
    remediations: options?.remediations,
  };
}

/**
 * Creates a denied authorization result for governance/RBAC denials.
 *
 * @param governanceDenialReason - The reason for denial (from GovernanceDenialReason enum)
 * @param options - Optional parameters for the result
 * @returns A denied AuthorizationResult
 */
export function createGovernanceDeniedResult(
  governanceDenialReason: GovernanceDenialReason,
  options?: {
    reason?: string;
    remediations?: string[];
  }
): AuthorizationResult {
  return {
    allowed: false,
    governanceDenialReason,
    reason: options?.reason ?? `Authorization denied: ${governanceDenialReason}`,
    remediations: options?.remediations,
  };
}

/**
 * Type guard to check if a value is a valid HierarchyLevel.
 *
 * @param value - Value to check
 * @returns True if value is a valid HierarchyLevel
 */
export function isHierarchyLevel(value: unknown): value is HierarchyLevel {
  return (
    typeof value === 'string' &&
    ['hitl', 'orch', 'metagoat', 'agent', 'bot'].includes(value)
  );
}

/**
 * Type guard to check if a value is a valid AuthorityScopeType.
 *
 * @param value - Value to check
 * @returns True if value is a valid AuthorityScopeType
 */
export function isAuthorityScopeType(value: unknown): value is AuthorityScopeType {
  return (
    typeof value === 'string' &&
    ['governance', 'coordination', 'management', 'execution', 'interaction'].includes(value)
  );
}

// ============================================================================
// Legacy Compatibility
// ============================================================================

/**
 * Maps numbered hierarchy levels (L0-L8) to canonical named levels.
 *
 * @deprecated Use HierarchyLevel directly. This is for migration only.
 */
export const NUMBERED_LEVEL_TO_NAMED: Readonly<Record<string, HierarchyLevel>> = {
  L0: 'bot',
  L1: 'agent',
  L2: 'metagoat',
  L3: 'orch',
  L4: 'orch',
  L5: 'orch',
  L6: 'hitl',
  L7: 'hitl',
  L8: 'hitl',
} as const;

/**
 * Converts a numbered level to a named hierarchy level.
 *
 * @deprecated Use HierarchyLevel directly. This is for migration only.
 * @param numberedLevel - Numbered level string (L0-L8)
 * @returns The corresponding named HierarchyLevel
 */
export function numberedToNamedLevel(numberedLevel: string): HierarchyLevel {
  return NUMBERED_LEVEL_TO_NAMED[numberedLevel] ?? 'bot';
}
