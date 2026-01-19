/**
 * Agent Authentication Middleware
 *
 * Epic 10: Agent Connection Layer
 * Story 10.4: Agent Authentication
 *
 * Provides authentication for agent API requests:
 * - API key authentication via header, query, or body
 * - Permission checking
 * - Agent context injection
 */

import { Context, Next, MiddlewareHandler } from 'hono';
import { getApiKeyManager, type ApiKeyVerifyResult } from '../../services/ApiKeyManager.js';
import { getAgentRegistry } from '../../services/AgentRegistry.js';

// ============================================================================
// Types
// ============================================================================

export interface AgentContext {
    agentId: string;
    keyId: string;
    permissions: string[];
    authenticated: true;
}

export interface AgentAuthConfig {
    required?: boolean;
    requiredPermissions?: string[];
    skipPaths?: string[];
    allowQueryParam?: boolean;
    allowBodyParam?: boolean;
}

// Extend Hono context
declare module 'hono' {
    interface ContextVariableMap {
        agent: AgentContext | null;
        authResult: ApiKeyVerifyResult;
    }
}

// ============================================================================
// Constants
// ============================================================================

const AUTH_HEADER = 'authorization';
const API_KEY_HEADER = 'x-api-key';
const BEARER_PREFIX = 'Bearer ';

// ============================================================================
// Middleware
// ============================================================================

/**
 * Agent authentication middleware
 * Extracts and validates API key from request
 */
export function agentAuthMiddleware(config: AgentAuthConfig = {}): MiddlewareHandler {
    const {
        required = true,
        requiredPermissions = [],
        skipPaths = [],
        allowQueryParam = true,
        allowBodyParam = false,
    } = config;

    return async (c: Context, next: Next) => {
        // Skip certain paths
        const path = c.req.path;
        if (skipPaths.some(skip => path.startsWith(skip))) {
            c.set('agent', null);
            return next();
        }

        // Extract API key
        const apiKey = extractApiKey(c, { allowQueryParam, allowBodyParam });

        if (!apiKey) {
            if (required) {
                return c.json({
                    success: false,
                    error: 'Authentication required',
                    code: 'AUTH_REQUIRED',
                }, 401);
            }
            c.set('agent', null);
            return next();
        }

        // Verify API key
        const manager = getApiKeyManager();
        const result = await manager.verifyKey(apiKey);
        c.set('authResult', result);

        if (!result.valid) {
            if (result.revoked) {
                return c.json({
                    success: false,
                    error: 'API key has been revoked',
                    code: 'KEY_REVOKED',
                }, 401);
            }
            if (result.expired) {
                return c.json({
                    success: false,
                    error: 'API key has expired',
                    code: 'KEY_EXPIRED',
                }, 401);
            }
            return c.json({
                success: false,
                error: 'Invalid API key',
                code: 'INVALID_KEY',
            }, 401);
        }

        // Check required permissions
        if (requiredPermissions.length > 0) {
            const hasPermissions = requiredPermissions.every(
                perm => result.permissions?.includes(perm)
            );
            if (!hasPermissions) {
                return c.json({
                    success: false,
                    error: 'Insufficient permissions',
                    code: 'INSUFFICIENT_PERMISSIONS',
                    required: requiredPermissions,
                    provided: result.permissions,
                }, 403);
            }
        }

        // Set agent context
        c.set('agent', {
            agentId: result.agentId!,
            keyId: result.keyId!,
            permissions: result.permissions!,
            authenticated: true,
        });

        return next();
    };
}

/**
 * Permission check middleware
 * Use after agentAuthMiddleware to check specific permissions
 */
export function requirePermissions(...permissions: string[]): MiddlewareHandler {
    return async (c: Context, next: Next) => {
        const agent = c.get('agent');

        if (!agent) {
            return c.json({
                success: false,
                error: 'Authentication required',
                code: 'AUTH_REQUIRED',
            }, 401);
        }

        const hasPermissions = permissions.every(
            perm => agent.permissions.includes(perm)
        );

        if (!hasPermissions) {
            return c.json({
                success: false,
                error: 'Insufficient permissions',
                code: 'INSUFFICIENT_PERMISSIONS',
                required: permissions,
                provided: agent.permissions,
            }, 403);
        }

        return next();
    };
}

/**
 * Agent ownership check middleware
 * Ensures the authenticated agent owns the resource
 */
export function requireAgentOwnership(agentIdParam: string = 'agentId'): MiddlewareHandler {
    return async (c: Context, next: Next) => {
        const agent = c.get('agent');
        const resourceAgentId = c.req.param(agentIdParam);

        if (!agent) {
            return c.json({
                success: false,
                error: 'Authentication required',
                code: 'AUTH_REQUIRED',
            }, 401);
        }

        if (agent.agentId !== resourceAgentId) {
            return c.json({
                success: false,
                error: 'Access denied to this resource',
                code: 'OWNERSHIP_REQUIRED',
            }, 403);
        }

        return next();
    };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Extract API key from request
 */
function extractApiKey(
    c: Context,
    options: { allowQueryParam: boolean; allowBodyParam: boolean }
): string | null {
    // 1. Authorization header (Bearer token)
    const authHeader = c.req.header(AUTH_HEADER);
    if (authHeader?.startsWith(BEARER_PREFIX)) {
        return authHeader.substring(BEARER_PREFIX.length);
    }

    // 2. X-API-Key header
    const apiKeyHeader = c.req.header(API_KEY_HEADER);
    if (apiKeyHeader) {
        return apiKeyHeader;
    }

    // 3. Query parameter (if allowed)
    if (options.allowQueryParam) {
        const queryKey = c.req.query('apiKey') || c.req.query('api_key');
        if (queryKey) {
            return queryKey;
        }
    }

    // 4. Body parameter (if allowed, for POST/PUT requests)
    if (options.allowBodyParam) {
        try {
            const contentType = c.req.header('content-type');
            if (contentType?.includes('application/json')) {
                // Note: This requires body parsing middleware
                const body = c.req.raw.body;
                // Body parsing would be handled here
            }
        } catch {
            // Ignore body parsing errors
        }
    }

    return null;
}

/**
 * Get authenticated agent from context
 */
export function getAuthenticatedAgent(c: Context): AgentContext | null {
    return c.get('agent');
}

/**
 * Check if request is authenticated
 */
export function isAuthenticated(c: Context): boolean {
    return c.get('agent') !== null;
}

/**
 * Check if agent has permission
 */
export function hasPermission(c: Context, permission: string): boolean {
    const agent = c.get('agent');
    return agent?.permissions.includes(permission) ?? false;
}

// ============================================================================
// Combined Security Middleware
// ============================================================================

/**
 * Create a combined agent security middleware stack
 */
export function createAgentSecurityMiddleware(config: {
    auth?: AgentAuthConfig;
    requiredPermissions?: string[];
}): MiddlewareHandler[] {
    const middlewares: MiddlewareHandler[] = [];

    // Add auth middleware
    middlewares.push(agentAuthMiddleware(config.auth));

    // Add permission check if specified
    if (config.requiredPermissions && config.requiredPermissions.length > 0) {
        middlewares.push(requirePermissions(...config.requiredPermissions));
    }

    return middlewares;
}
