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
export var GovernanceDenialReason;
(function (GovernanceDenialReason) {
    /** User lacks required roles for the action */
    GovernanceDenialReason["MISSING_ROLES"] = "missing_roles";
    /** User lacks required permissions for the action */
    GovernanceDenialReason["MISSING_PERMISSIONS"] = "missing_permissions";
    /** Action is outside the authorized scope */
    GovernanceDenialReason["SCOPE_VIOLATION"] = "scope_violation";
    /** Human oversight/approval is required but not present */
    GovernanceDenialReason["REQUIRES_HUMAN_APPROVAL"] = "requires_human_approval";
})(GovernanceDenialReason || (GovernanceDenialReason = {}));
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
/**
 * Zod schema for GovernanceRole validation.
 */
export const governanceRoleSchema = z.enum(['admin', 'operator', 'trainer', 'consumer', 'reviewer', 'both'], {
    errorMap: () => ({ message: 'Invalid governance role' }),
});
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
export const HIERARCHY_TIERS = {
    hitl: 0,
    orch: 1,
    metagoat: 2,
    agent: 3,
    bot: 4,
};
/**
 * Array of hierarchy levels in authority order (highest first).
 */
export const HIERARCHY_ORDER = [
    'hitl',
    'orch',
    'metagoat',
    'agent',
    'bot',
];
/**
 * Canonical hierarchy level configurations.
 */
export const HIERARCHY_LEVELS = {
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
};
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
/**
 * Zod schema for AuthorityScopeType validation.
 */
export const authorityScopeTypeSchema = z.enum(['governance', 'coordination', 'management', 'execution', 'interaction'], { errorMap: () => ({ message: 'Invalid authority scope type' }) });
/**
 * Zod schema for ControlAction validation.
 */
export const controlActionSchema = z.enum(['allow', 'deny', 'constrain', 'clarify', 'escalate', 'log', 'audit'], { errorMap: () => ({ message: 'Invalid control action' }) });
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
/**
 * Zod schema for AuthorityType validation.
 */
export const authorityTypeSchema = z.enum(['system', 'role', 'delegated', 'temporary', 'emergency'], { errorMap: () => ({ message: 'Invalid authority type' }) });
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
// ============================================================================
// Utility Functions
// ============================================================================
/**
 * Gets the numeric tier for a hierarchy level.
 *
 * @param level - The hierarchy level
 * @returns The numeric tier (0 = highest authority)
 */
export function getHierarchyTier(level) {
    return HIERARCHY_TIERS[level];
}
/**
 * Gets the configuration for a hierarchy level.
 *
 * @param level - The hierarchy level
 * @returns The level configuration
 */
export function getHierarchyLevelConfig(level) {
    return HIERARCHY_LEVELS[level];
}
/**
 * Checks if one hierarchy level has higher authority than another.
 *
 * @param a - First hierarchy level
 * @param b - Second hierarchy level
 * @returns True if a has higher authority than b
 */
export function isHigherAuthority(a, b) {
    return HIERARCHY_TIERS[a] < HIERARCHY_TIERS[b];
}
/**
 * Checks if a hierarchy level can delegate to another level.
 *
 * @param from - The delegating level
 * @param to - The target level
 * @returns True if delegation is allowed
 */
export function canDelegate(from, to) {
    return HIERARCHY_LEVELS[from].canDelegate.includes(to);
}
/**
 * Gets the reporting chain for a hierarchy level.
 *
 * @param level - The starting hierarchy level
 * @returns Array of levels in the reporting chain (from top to starting level)
 */
export function getReportingChain(level) {
    const chain = [level];
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
export function meetsMinimumTrust(level, trustScore) {
    return trustScore >= HIERARCHY_LEVELS[level].minTrustScore;
}
/**
 * Creates an allowed authorization result.
 *
 * @param options - Optional parameters for the result
 * @returns An allowed AuthorizationResult
 */
export function createAllowedResult(options) {
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
export function createDeniedResult(denialReason, options) {
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
export function createGovernanceDeniedResult(governanceDenialReason, options) {
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
export function isHierarchyLevel(value) {
    return (typeof value === 'string' &&
        ['hitl', 'orch', 'metagoat', 'agent', 'bot'].includes(value));
}
/**
 * Type guard to check if a value is a valid AuthorityScopeType.
 *
 * @param value - Value to check
 * @returns True if value is a valid AuthorityScopeType
 */
export function isAuthorityScopeType(value) {
    return (typeof value === 'string' &&
        ['governance', 'coordination', 'management', 'execution', 'interaction'].includes(value));
}
// ============================================================================
// Legacy Compatibility
// ============================================================================
/**
 * Maps numbered hierarchy levels (L0-L8) to canonical named levels.
 *
 * @deprecated Use HierarchyLevel directly. This is for migration only.
 */
export const NUMBERED_LEVEL_TO_NAMED = {
    L0: 'bot',
    L1: 'agent',
    L2: 'metagoat',
    L3: 'orch',
    L4: 'orch',
    L5: 'orch',
    L6: 'hitl',
    L7: 'hitl',
    L8: 'hitl',
};
/**
 * Converts a numbered level to a named hierarchy level.
 *
 * @deprecated Use HierarchyLevel directly. This is for migration only.
 * @param numberedLevel - Numbered level string (L0-L8)
 * @returns The corresponding named HierarchyLevel
 */
export function numberedToNamedLevel(numberedLevel) {
    return NUMBERED_LEVEL_TO_NAMED[numberedLevel] ?? 'bot';
}
//# sourceMappingURL=governance.js.map