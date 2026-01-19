/**
 * RBAC (Role-Based Access Control) Middleware
 *
 * Provides role-based authorization for Mission Control endpoints.
 * Integrates with existing Google OAuth for user context and extracts
 * role/org information from user claims.
 *
 * Story 1.1: RBAC Middleware & Role-Based Access
 * FRs: FR51, FR52, FR53
 */

import type { Context, Next } from 'hono';

// ============================================================================
// Types
// ============================================================================

/**
 * User roles for Mission Control access
 * Hierarchical: each role includes permissions of lower roles
 */
export type UserRole =
    | 'viewer'      // Read-only access to basic info
    | 'operator'    // Standard operations, approve/deny decisions
    | 'supervisor'  // Team oversight, investigation management
    | 'director'    // Executive access, rule approval
    | 'compliance'  // Audit access, evidence packages
    | 'admin';      // Full system access

/**
 * Role hierarchy for permission checking
 * Higher index = more permissions
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
    viewer: 0,
    operator: 1,
    supervisor: 2,
    director: 3,
    compliance: 3,  // Same level as director, different scope
    admin: 4,
};

/**
 * User context extracted from authentication
 */
export interface UserContext {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    orgId: string;
    picture?: string;
}

/**
 * RFC 7807 Problem Details response
 */
export interface ProblemDetails {
    type: string;
    title: string;
    status: number;
    detail: string;
    instance?: string;
}

// ============================================================================
// RFC 7807 Error Responses
// ============================================================================

/**
 * Create an RFC 7807 Problem Details response
 */
function problemDetails(
    type: string,
    title: string,
    status: number,
    detail: string,
    instance?: string
): ProblemDetails {
    return {
        type,
        title,
        status,
        detail,
        ...(instance && { instance }),
    };
}

/**
 * 401 Unauthorized response
 */
export function unauthorizedError(detail: string = 'Authentication required'): ProblemDetails {
    return problemDetails(
        'https://aurais.ai/errors/unauthorized',
        'Unauthorized',
        401,
        detail
    );
}

/**
 * 403 Forbidden response
 */
export function forbiddenError(detail: string = 'Insufficient permissions'): ProblemDetails {
    return problemDetails(
        'https://aurais.ai/errors/forbidden',
        'Forbidden',
        403,
        detail
    );
}

/**
 * 404 Not Found response (for cross-org access attempts)
 */
export function notFoundError(detail: string = 'Resource not found'): ProblemDetails {
    return problemDetails(
        'https://aurais.ai/errors/not-found',
        'Not Found',
        404,
        detail
    );
}

// ============================================================================
// User Context Extraction
// ============================================================================

/**
 * Demo user mappings for development
 * In production, roles would come from Supabase user metadata or JWT claims
 */
const DEMO_USER_ROLES: Record<string, { role: UserRole; orgId: string }> = {
    'demo@aurais.ai': { role: 'operator', orgId: 'demo-org' },
    'admin@aurais.ai': { role: 'admin', orgId: 'demo-org' },
    'supervisor@aurais.ai': { role: 'supervisor', orgId: 'demo-org' },
    'director@aurais.ai': { role: 'director', orgId: 'demo-org' },
    'compliance@aurais.ai': { role: 'compliance', orgId: 'demo-org' },
    'viewer@aurais.ai': { role: 'viewer', orgId: 'demo-org' },
    // Cross-org test user
    'other@company.com': { role: 'operator', orgId: 'other-org' },
};

/**
 * Extract user context from request
 * Uses Google OAuth user if available, falls back to demo user
 */
export function extractUserContext(c: Context): UserContext | null {
    // Check for Google OAuth user (set by googleAuthMiddleware)
    const googleUser = c.get('user') as { email: string; name: string; sub: string; picture?: string } | undefined;

    if (googleUser) {
        // Look up role from demo mapping or default to operator
        const userMapping = DEMO_USER_ROLES[googleUser.email] || { role: 'operator', orgId: 'demo-org' };

        return {
            id: googleUser.sub,
            email: googleUser.email,
            name: googleUser.name,
            role: userMapping.role,
            orgId: userMapping.orgId,
            picture: googleUser.picture,
        };
    }

    // Check for demo session (from sessionStorage on frontend)
    const authHeader = c.req.header('Authorization');
    if (authHeader?.startsWith('Demo ')) {
        const demoEmail = authHeader.slice(5);
        const userMapping = DEMO_USER_ROLES[demoEmail];
        if (userMapping) {
            return {
                id: `demo-${demoEmail}`,
                email: demoEmail,
                name: demoEmail.split('@')[0] || 'Demo User',
                role: userMapping.role,
                orgId: userMapping.orgId,
            };
        }
    }

    return null;
}

/**
 * Check if user has sufficient role level
 */
export function hasRole(userRole: UserRole, requiredRoles: UserRole[]): boolean {
    const userLevel = ROLE_HIERARCHY[userRole];

    // Check if user's role matches any required role exactly
    // OR if user's role is higher in hierarchy than any required role
    return requiredRoles.some(requiredRole => {
        const requiredLevel = ROLE_HIERARCHY[requiredRole];
        return userLevel >= requiredLevel;
    });
}

// ============================================================================
// Middleware
// ============================================================================

export interface RequireAuthConfig {
    optional?: boolean;  // If true, continues without auth but sets user if present
}

/**
 * Middleware that requires authentication
 * Sets user context on the Hono context for downstream handlers
 */
export function requireAuth(config: RequireAuthConfig = {}) {
    return async (c: Context, next: Next): Promise<Response | void> => {
        const user = extractUserContext(c);

        if (!user) {
            if (config.optional) {
                await next();
                return;
            }
            return c.json(unauthorizedError('Valid authentication token required'), 401);
        }

        // Set user context for downstream handlers
        c.set('userContext', user);
        c.set('orgId', user.orgId);
        c.set('userRole', user.role);

        await next();
    };
}

/**
 * Middleware factory that requires specific role(s)
 *
 * @param roles - One or more roles that are allowed access
 * @returns Hono middleware function
 *
 * @example
 * // Single role
 * app.get('/route', requireRole('operator'), handler);
 *
 * // Multiple roles (any match)
 * app.get('/route', requireRole('supervisor', 'director'), handler);
 */
export function requireRole(...roles: UserRole[]) {
    return async (c: Context, next: Next): Promise<Response | void> => {
        // First check authentication
        const user = extractUserContext(c);

        if (!user) {
            return c.json(unauthorizedError('Valid authentication token required'), 401);
        }

        // Check role authorization
        if (!hasRole(user.role, roles)) {
            return c.json(
                forbiddenError(
                    `Access denied. Required role: ${roles.join(' or ')}. Your role: ${user.role}`
                ),
                403
            );
        }

        // Set user context for downstream handlers
        c.set('userContext', user);
        c.set('orgId', user.orgId);
        c.set('userRole', user.role);

        await next();
    };
}

/**
 * Middleware that verifies org_id matches for resource access
 * Used after requireRole to ensure users can only access their org's data
 *
 * @param getResourceOrgId - Function to extract org_id from the resource
 * @returns Hono middleware function
 *
 * @example
 * app.get('/agents/:id', requireRole('operator'), requireOrgAccess(
 *   async (c) => {
 *     const agent = await getAgent(c.req.param('id'));
 *     return agent?.org_id;
 *   }
 * ), handler);
 */
export function requireOrgAccess(
    getResourceOrgId: (c: Context) => Promise<string | null | undefined> | string | null | undefined
) {
    return async (c: Context, next: Next): Promise<Response | void> => {
        const userOrgId = c.get('orgId') as string | undefined;

        if (!userOrgId) {
            return c.json(unauthorizedError('Organization context required'), 401);
        }

        const resourceOrgId = await getResourceOrgId(c);

        // If resource doesn't exist or org doesn't match, return 404
        // (Don't reveal existence of resources in other orgs)
        if (!resourceOrgId || resourceOrgId !== userOrgId) {
            return c.json(notFoundError('Resource not found'), 404);
        }

        await next();
    };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get user context from Hono context (for use in handlers)
 */
export function getUserContext(c: Context): UserContext | null {
    return c.get('userContext') as UserContext | null;
}

/**
 * Get organization ID from Hono context
 */
export function getOrgId(c: Context): string | null {
    return c.get('orgId') as string | null;
}

/**
 * Get user role from Hono context
 */
export function getUserRole(c: Context): UserRole | null {
    return c.get('userRole') as UserRole | null;
}

/**
 * Check if current user is admin
 */
export function isAdmin(c: Context): boolean {
    return getUserRole(c) === 'admin';
}

/**
 * Check if current user can access supervisor features
 */
export function isSupervisorOrAbove(c: Context): boolean {
    const role = getUserRole(c);
    return role ? hasRole(role, ['supervisor']) : false;
}

/**
 * Check if current user can access director features
 */
export function isDirectorOrAbove(c: Context): boolean {
    const role = getUserRole(c);
    return role ? hasRole(role, ['director']) : false;
}
