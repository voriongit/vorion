/**
 * Agent Registration API Route
 *
 * Epic 10: Agent Connection Layer
 * Story 10.1: Agent Registry Service
 *
 * POST /api/v1/agents/register
 * Registers a new agent and returns credentials
 */

import { Hono } from 'hono';
import { getAgentRegistry, type AgentRegistrationRequest } from '../../../services/AgentRegistry.js';
import type { AgentType } from '../../../types.js';

// ============================================================================
// Types
// ============================================================================

interface RegisterRequestBody {
    name: string;
    type: string;
    capabilities: string[];
    skills?: string[];
    metadata?: Record<string, unknown>;
}

interface RegisterResponseBody {
    success: boolean;
    data?: {
        agentId: string;
        structuredId: string;
        apiKey: string;
        apiKeyExpiresAt: string;
        agent: {
            id: string;
            structuredId: string;
            name: string;
            type: string;
            tier: number;
            status: string;
            capabilities: string[];
            skills: string[];
            createdAt: string;
        };
    };
    error?: string;
}

// ============================================================================
// Validation
// ============================================================================

const VALID_AGENT_TYPES = [
    'worker',
    'planner',
    'validator',
    'researcher',
    'communicator',
    'orchestrator',
    'executor',
];

function validateRegisterRequest(body: unknown): {
    valid: boolean;
    errors: string[];
    data?: RegisterRequestBody;
} {
    const errors: string[] = [];

    if (!body || typeof body !== 'object') {
        return { valid: false, errors: ['Request body is required'] };
    }

    const data = body as Record<string, unknown>;

    // Validate name
    if (!data.name || typeof data.name !== 'string') {
        errors.push('name is required and must be a string');
    } else if (data.name.length < 2) {
        errors.push('name must be at least 2 characters');
    } else if (data.name.length > 100) {
        errors.push('name must not exceed 100 characters');
    } else if (!/^[a-zA-Z0-9_-]+$/.test(data.name)) {
        errors.push('name must contain only alphanumeric characters, underscores, and hyphens');
    }

    // Validate type
    if (!data.type || typeof data.type !== 'string') {
        errors.push('type is required and must be a string');
    } else if (!VALID_AGENT_TYPES.includes(data.type.toLowerCase())) {
        errors.push(`type must be one of: ${VALID_AGENT_TYPES.join(', ')}`);
    }

    // Validate capabilities
    if (!data.capabilities) {
        errors.push('capabilities is required');
    } else if (!Array.isArray(data.capabilities)) {
        errors.push('capabilities must be an array');
    } else if (data.capabilities.length === 0) {
        errors.push('at least one capability is required');
    } else if (data.capabilities.some(c => typeof c !== 'string')) {
        errors.push('all capabilities must be strings');
    }

    // Validate skills (optional)
    if (data.skills !== undefined) {
        if (!Array.isArray(data.skills)) {
            errors.push('skills must be an array');
        } else if (data.skills.some(s => typeof s !== 'string')) {
            errors.push('all skills must be strings');
        }
    }

    // Validate metadata (optional)
    if (data.metadata !== undefined && typeof data.metadata !== 'object') {
        errors.push('metadata must be an object');
    }

    if (errors.length > 0) {
        return { valid: false, errors };
    }

    return {
        valid: true,
        errors: [],
        data: {
            name: data.name as string,
            type: (data.type as string).toLowerCase(),
            capabilities: data.capabilities as string[],
            skills: data.skills as string[] | undefined,
            metadata: data.metadata as Record<string, unknown> | undefined,
        },
    };
}

// ============================================================================
// Routes
// ============================================================================

export const agentRoutes = new Hono();

/**
 * POST /register
 * Register a new agent
 */
agentRoutes.post('/register', async (c) => {
    try {
        const body = await c.req.json();

        // Validate request
        const validation = validateRegisterRequest(body);
        if (!validation.valid) {
            return c.json({
                success: false,
                error: 'Validation failed',
                details: validation.errors,
            } as RegisterResponseBody & { details?: string[] }, 400);
        }

        const request: AgentRegistrationRequest = {
            name: validation.data!.name,
            type: validation.data!.type as AgentType,
            capabilities: validation.data!.capabilities,
            skills: validation.data!.skills,
            metadata: validation.data!.metadata,
        };

        // Register the agent
        const registry = getAgentRegistry();
        const result = await registry.registerAgent(request);

        return c.json({
            success: true,
            data: {
                agentId: result.agentId,
                structuredId: result.structuredId,
                apiKey: result.apiKey,
                apiKeyExpiresAt: result.apiKeyExpiresAt,
                agent: result.agent,
            },
        } as RegisterResponseBody, 201);

    } catch (error) {
        console.error('Agent registration error:', error);

        const message = error instanceof Error ? error.message : 'Internal server error';

        return c.json({
            success: false,
            error: message,
        } as RegisterResponseBody, 500);
    }
});

/**
 * POST /verify
 * Verify an API key
 */
agentRoutes.post('/verify', async (c) => {
    try {
        const body = await c.req.json();
        const { apiKey } = body as { apiKey?: string };

        if (!apiKey || typeof apiKey !== 'string') {
            return c.json({
                success: false,
                error: 'apiKey is required',
            }, 400);
        }

        const registry = getAgentRegistry();
        const result = await registry.verifyAPIKey(apiKey);

        if (!result.valid) {
            return c.json({
                success: false,
                valid: false,
                expired: result.expired,
                revoked: result.revoked,
            }, 401);
        }

        return c.json({
            success: true,
            valid: true,
            agentId: result.agentId,
            permissions: result.permissions,
        });

    } catch (error) {
        console.error('API key verification error:', error);
        return c.json({
            success: false,
            error: 'Verification failed',
        }, 500);
    }
});

/**
 * GET /:agentId
 * Get agent by ID
 */
agentRoutes.get('/:agentId', async (c) => {
    try {
        const agentId = c.req.param('agentId');

        const registry = getAgentRegistry();
        const agent = await registry.getAgent(agentId);

        if (!agent) {
            return c.json({
                success: false,
                error: 'Agent not found',
            }, 404);
        }

        return c.json({
            success: true,
            data: agent,
        });

    } catch (error) {
        console.error('Get agent error:', error);
        return c.json({
            success: false,
            error: 'Failed to retrieve agent',
        }, 500);
    }
});

/**
 * GET /
 * List agents with optional filters
 */
agentRoutes.get('/', async (c) => {
    try {
        const type = c.req.query('type');
        const tier = c.req.query('tier');
        const status = c.req.query('status');
        const limit = c.req.query('limit');
        const offset = c.req.query('offset');

        const registry = getAgentRegistry();
        const agents = await registry.listAgents({
            type: type || undefined,
            tier: tier ? parseInt(tier, 10) : undefined,
            status: status || undefined,
            limit: limit ? parseInt(limit, 10) : 50,
            offset: offset ? parseInt(offset, 10) : 0,
        });

        return c.json({
            success: true,
            data: agents,
            count: agents.length,
        });

    } catch (error) {
        console.error('List agents error:', error);
        return c.json({
            success: false,
            error: 'Failed to list agents',
        }, 500);
    }
});

/**
 * POST /:agentId/revoke
 * Revoke an agent's API key
 */
agentRoutes.post('/:agentId/revoke', async (c) => {
    try {
        const body = await c.req.json();
        const { apiKey } = body as { apiKey?: string };

        if (!apiKey || typeof apiKey !== 'string') {
            return c.json({
                success: false,
                error: 'apiKey is required',
            }, 400);
        }

        const registry = getAgentRegistry();
        const revoked = await registry.revokeAPIKey(apiKey);

        if (!revoked) {
            return c.json({
                success: false,
                error: 'API key not found or already revoked',
            }, 404);
        }

        return c.json({
            success: true,
            message: 'API key revoked successfully',
        });

    } catch (error) {
        console.error('Revoke API key error:', error);
        return c.json({
            success: false,
            error: 'Failed to revoke API key',
        }, 500);
    }
});

export default agentRoutes;
