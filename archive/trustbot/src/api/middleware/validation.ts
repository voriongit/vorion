/**
 * Input Validation Middleware
 *
 * Provides Zod-based validation schemas for all API endpoints.
 * Validates request bodies, query parameters, and path parameters.
 */

import { Context, Next } from 'hono';

// ============================================================================
// Simple Validation (No External Dependencies)
// ============================================================================

export interface ValidationError {
    field: string;
    message: string;
    received?: unknown;
}

export interface ValidationResult<T> {
    success: boolean;
    data?: T;
    errors?: ValidationError[];
}

// ============================================================================
// Validation Functions
// ============================================================================

function isString(value: unknown): value is string {
    return typeof value === 'string';
}

function isNumber(value: unknown): value is number {
    return typeof value === 'number' && !isNaN(value);
}

function isBoolean(value: unknown): value is boolean {
    return typeof value === 'boolean';
}

function isArray(value: unknown): value is unknown[] {
    return Array.isArray(value);
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// ============================================================================
// Task Validation
// ============================================================================

export interface CreateTaskInput {
    title: string;
    description: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    requiredTier?: number;
}

export function validateCreateTask(input: unknown): ValidationResult<CreateTaskInput> {
    const errors: ValidationError[] = [];

    if (!isObject(input)) {
        return { success: false, errors: [{ field: 'body', message: 'Request body must be an object' }] };
    }

    // Title validation
    if (!isString(input.title)) {
        errors.push({ field: 'title', message: 'Title is required and must be a string' });
    } else if (input.title.length < 1) {
        errors.push({ field: 'title', message: 'Title cannot be empty' });
    } else if (input.title.length > 200) {
        errors.push({ field: 'title', message: 'Title cannot exceed 200 characters' });
    }

    // Description validation
    if (!isString(input.description)) {
        errors.push({ field: 'description', message: 'Description is required and must be a string' });
    } else if (input.description.length > 5000) {
        errors.push({ field: 'description', message: 'Description cannot exceed 5000 characters' });
    }

    // Priority validation
    const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    if (input.priority !== undefined) {
        if (!isString(input.priority) || !validPriorities.includes(input.priority)) {
            errors.push({
                field: 'priority',
                message: `Priority must be one of: ${validPriorities.join(', ')}`,
                received: input.priority
            });
        }
    }

    // RequiredTier validation
    if (input.requiredTier !== undefined) {
        if (!isNumber(input.requiredTier) || input.requiredTier < 0 || input.requiredTier > 5) {
            errors.push({
                field: 'requiredTier',
                message: 'Required tier must be a number between 0 and 5',
                received: input.requiredTier
            });
        }
    }

    if (errors.length > 0) {
        return { success: false, errors };
    }

    return {
        success: true,
        data: {
            title: (input.title as string).trim(),
            description: (input.description as string).trim(),
            priority: input.priority as CreateTaskInput['priority'],
            requiredTier: input.requiredTier as number | undefined,
        },
    };
}

// ============================================================================
// Agent Validation
// ============================================================================

export interface SpawnAgentInput {
    name: string;
    type: string;
    tier: number;
}

export function validateSpawnAgent(input: unknown): ValidationResult<SpawnAgentInput> {
    const errors: ValidationError[] = [];

    if (!isObject(input)) {
        return { success: false, errors: [{ field: 'body', message: 'Request body must be an object' }] };
    }

    // Name validation
    if (!isString(input.name)) {
        errors.push({ field: 'name', message: 'Name is required and must be a string' });
    } else if (input.name.length < 1) {
        errors.push({ field: 'name', message: 'Name cannot be empty' });
    } else if (input.name.length > 50) {
        errors.push({ field: 'name', message: 'Name cannot exceed 50 characters' });
    } else if (!/^[a-zA-Z0-9_-]+$/.test(input.name)) {
        errors.push({ field: 'name', message: 'Name can only contain letters, numbers, underscores, and hyphens' });
    }

    // Type validation
    const validTypes = ['EXECUTOR', 'PLANNER', 'VALIDATOR', 'EVOLVER', 'SPAWNER', 'LISTENER', 'WORKER', 'SPECIALIST', 'ORCHESTRATOR'];
    if (!isString(input.type)) {
        errors.push({ field: 'type', message: 'Type is required and must be a string' });
    } else if (!validTypes.includes(input.type.toUpperCase())) {
        errors.push({
            field: 'type',
            message: `Type must be one of: ${validTypes.join(', ')}`,
            received: input.type
        });
    }

    // Tier validation
    if (!isNumber(input.tier)) {
        errors.push({ field: 'tier', message: 'Tier is required and must be a number' });
    } else if (input.tier < 0 || input.tier > 5) {
        errors.push({
            field: 'tier',
            message: 'Tier must be between 0 and 5',
            received: input.tier
        });
    }

    if (errors.length > 0) {
        return { success: false, errors };
    }

    return {
        success: true,
        data: {
            name: (input.name as string).trim(),
            type: (input.type as string).toUpperCase(),
            tier: input.tier as number,
        },
    };
}

// ============================================================================
// Delegation Validation
// ============================================================================

export interface DelegationRequestInput {
    agentId: string;
    capabilities: string[];
    reason: string;
    duration: number;
}

export function validateDelegationRequest(input: unknown): ValidationResult<DelegationRequestInput> {
    const errors: ValidationError[] = [];

    if (!isObject(input)) {
        return { success: false, errors: [{ field: 'body', message: 'Request body must be an object' }] };
    }

    // AgentId validation
    if (!isString(input.agentId)) {
        errors.push({ field: 'agentId', message: 'Agent ID is required and must be a string' });
    } else if (input.agentId.length < 1 || input.agentId.length > 100) {
        errors.push({ field: 'agentId', message: 'Agent ID must be between 1 and 100 characters' });
    }

    // Capabilities validation
    if (!isArray(input.capabilities)) {
        errors.push({ field: 'capabilities', message: 'Capabilities must be an array' });
    } else if (input.capabilities.length === 0) {
        errors.push({ field: 'capabilities', message: 'At least one capability is required' });
    } else if (input.capabilities.length > 10) {
        errors.push({ field: 'capabilities', message: 'Cannot request more than 10 capabilities at once' });
    } else {
        const validCapabilities = [
            'HITL_MODIFY', 'TRUST_REWARD', 'TRUST_PENALIZE', 'SPAWN_AGENT',
            'VIEW_AUDIT_LOG', 'SYSTEM_CONFIG', 'BLACKBOARD_POST', 'BLACKBOARD_RESOLVE', 'AGENT_TERMINATE'
        ];
        for (const cap of input.capabilities) {
            if (!isString(cap) || !validCapabilities.includes(cap)) {
                errors.push({
                    field: 'capabilities',
                    message: `Invalid capability: ${cap}. Valid: ${validCapabilities.join(', ')}`
                });
                break;
            }
        }
    }

    // Reason validation
    if (!isString(input.reason)) {
        errors.push({ field: 'reason', message: 'Reason is required and must be a string' });
    } else if (input.reason.length < 10) {
        errors.push({ field: 'reason', message: 'Reason must be at least 10 characters' });
    } else if (input.reason.length > 500) {
        errors.push({ field: 'reason', message: 'Reason cannot exceed 500 characters' });
    }

    // Duration validation
    if (!isNumber(input.duration)) {
        errors.push({ field: 'duration', message: 'Duration is required and must be a number (milliseconds)' });
    } else if (input.duration < 60000) { // Min 1 minute
        errors.push({ field: 'duration', message: 'Duration must be at least 1 minute (60000ms)' });
    } else if (input.duration > 24 * 60 * 60 * 1000) { // Max 24 hours
        errors.push({ field: 'duration', message: 'Duration cannot exceed 24 hours' });
    }

    if (errors.length > 0) {
        return { success: false, errors };
    }

    return {
        success: true,
        data: {
            agentId: (input.agentId as string).trim(),
            capabilities: input.capabilities as string[],
            reason: (input.reason as string).trim(),
            duration: input.duration as number,
        },
    };
}

// ============================================================================
// Vote Validation
// ============================================================================

export interface VoteInput {
    agentId: string;
    vote: 'approve' | 'reject' | 'abstain';
    reasoning: string;
    confidence: number;
}

export function validateVote(input: unknown): ValidationResult<VoteInput> {
    const errors: ValidationError[] = [];

    if (!isObject(input)) {
        return { success: false, errors: [{ field: 'body', message: 'Request body must be an object' }] };
    }

    // AgentId validation
    if (!isString(input.agentId)) {
        errors.push({ field: 'agentId', message: 'Agent ID is required and must be a string' });
    }

    // Vote validation
    const validVotes = ['approve', 'reject', 'abstain'];
    if (!isString(input.vote) || !validVotes.includes(input.vote)) {
        errors.push({
            field: 'vote',
            message: `Vote must be one of: ${validVotes.join(', ')}`
        });
    }

    // Reasoning validation
    if (!isString(input.reasoning)) {
        errors.push({ field: 'reasoning', message: 'Reasoning is required and must be a string' });
    } else if (input.reasoning.length < 10) {
        errors.push({ field: 'reasoning', message: 'Reasoning must be at least 10 characters' });
    } else if (input.reasoning.length > 1000) {
        errors.push({ field: 'reasoning', message: 'Reasoning cannot exceed 1000 characters' });
    }

    // Confidence validation
    if (!isNumber(input.confidence)) {
        errors.push({ field: 'confidence', message: 'Confidence is required and must be a number' });
    } else if (input.confidence < 0 || input.confidence > 1) {
        errors.push({ field: 'confidence', message: 'Confidence must be between 0 and 1' });
    }

    if (errors.length > 0) {
        return { success: false, errors };
    }

    return {
        success: true,
        data: {
            agentId: (input.agentId as string).trim(),
            vote: input.vote as VoteInput['vote'],
            reasoning: (input.reasoning as string).trim(),
            confidence: input.confidence as number,
        },
    };
}

// ============================================================================
// Auth Validation
// ============================================================================

export interface AuthInput {
    masterKey: string;
}

export function validateAuth(input: unknown): ValidationResult<AuthInput> {
    const errors: ValidationError[] = [];

    if (!isObject(input)) {
        return { success: false, errors: [{ field: 'body', message: 'Request body must be an object' }] };
    }

    if (!isString(input.masterKey)) {
        errors.push({ field: 'masterKey', message: 'Master key is required and must be a string' });
    } else if (input.masterKey.length < 8) {
        errors.push({ field: 'masterKey', message: 'Master key must be at least 8 characters' });
    }

    if (errors.length > 0) {
        return { success: false, errors };
    }

    return {
        success: true,
        data: {
            masterKey: input.masterKey as string,
        },
    };
}

// ============================================================================
// Aggressiveness Validation
// ============================================================================

export interface AggressivenessInput {
    level: number;
    tokenId: string;
}

export function validateAggressiveness(input: unknown): ValidationResult<AggressivenessInput> {
    const errors: ValidationError[] = [];

    if (!isObject(input)) {
        return { success: false, errors: [{ field: 'body', message: 'Request body must be an object' }] };
    }

    if (!isNumber(input.level)) {
        errors.push({ field: 'level', message: 'Level is required and must be a number' });
    } else if (input.level < 0 || input.level > 100) {
        errors.push({ field: 'level', message: 'Level must be between 0 and 100' });
    }

    if (!isString(input.tokenId)) {
        errors.push({ field: 'tokenId', message: 'Token ID is required and must be a string' });
    }

    if (errors.length > 0) {
        return { success: false, errors };
    }

    return {
        success: true,
        data: {
            level: input.level as number,
            tokenId: input.tokenId as string,
        },
    };
}

// ============================================================================
// AI Provider Validation
// ============================================================================

export interface AIConfigureInput {
    provider: 'claude' | 'grok' | 'openai' | 'gemini';
    apiKey: string;
    model?: string;
    setAsDefault?: boolean;
}

export function validateAIConfigure(input: unknown): ValidationResult<AIConfigureInput> {
    const errors: ValidationError[] = [];

    if (!isObject(input)) {
        return { success: false, errors: [{ field: 'body', message: 'Request body must be an object' }] };
    }

    const validProviders = ['claude', 'grok', 'openai', 'gemini'];
    if (!isString(input.provider) || !validProviders.includes(input.provider)) {
        errors.push({
            field: 'provider',
            message: `Provider must be one of: ${validProviders.join(', ')}`
        });
    }

    if (!isString(input.apiKey)) {
        errors.push({ field: 'apiKey', message: 'API key is required and must be a string' });
    } else if (input.apiKey.length < 10) {
        errors.push({ field: 'apiKey', message: 'API key seems too short' });
    }

    if (input.model !== undefined && !isString(input.model)) {
        errors.push({ field: 'model', message: 'Model must be a string if provided' });
    }

    if (errors.length > 0) {
        return { success: false, errors };
    }

    return {
        success: true,
        data: {
            provider: input.provider as AIConfigureInput['provider'],
            apiKey: input.apiKey as string,
            model: input.model as string | undefined,
            setAsDefault: isBoolean(input.setAsDefault) ? input.setAsDefault : false,
        },
    };
}

// ============================================================================
// Advisor Validation
// ============================================================================

export interface AdvisorInput {
    name: string;
    provider: 'claude' | 'grok' | 'openai' | 'gemini';
    aliases?: string[];
    personality?: string;
    icon?: string;
    enabled?: boolean;
}

export function validateAdvisor(input: unknown): ValidationResult<AdvisorInput> {
    const errors: ValidationError[] = [];

    if (!isObject(input)) {
        return { success: false, errors: [{ field: 'body', message: 'Request body must be an object' }] };
    }

    if (!isString(input.name)) {
        errors.push({ field: 'name', message: 'Name is required and must be a string' });
    } else if (input.name.length < 1 || input.name.length > 30) {
        errors.push({ field: 'name', message: 'Name must be between 1 and 30 characters' });
    }

    const validProviders = ['claude', 'grok', 'openai', 'gemini'];
    if (!isString(input.provider) || !validProviders.includes(input.provider)) {
        errors.push({
            field: 'provider',
            message: `Provider must be one of: ${validProviders.join(', ')}`
        });
    }

    if (input.aliases !== undefined) {
        if (!isArray(input.aliases)) {
            errors.push({ field: 'aliases', message: 'Aliases must be an array if provided' });
        } else if (input.aliases.some(a => !isString(a))) {
            errors.push({ field: 'aliases', message: 'All aliases must be strings' });
        }
    }

    if (input.personality !== undefined && !isString(input.personality)) {
        errors.push({ field: 'personality', message: 'Personality must be a string if provided' });
    }

    if (errors.length > 0) {
        return { success: false, errors };
    }

    return {
        success: true,
        data: {
            name: (input.name as string).trim(),
            provider: input.provider as AdvisorInput['provider'],
            aliases: input.aliases as string[] | undefined,
            personality: input.personality as string | undefined,
            icon: isString(input.icon) ? input.icon : undefined,
            enabled: isBoolean(input.enabled) ? input.enabled : true,
        },
    };
}

// ============================================================================
// Validation Middleware Factory
// ============================================================================

export function validate<T>(
    validator: (input: unknown) => ValidationResult<T>
) {
    return async (c: Context, next: Next): Promise<Response | void> => {
        try {
            const body = await c.req.json();
            const result = validator(body);

            if (!result.success) {
                return c.json({
                    error: 'Validation failed',
                    details: result.errors,
                }, 400);
            }

            // Attach validated data to context
            c.set('validatedBody', result.data);
            await next();
        } catch (error) {
            return c.json({
                error: 'Invalid JSON body',
                message: (error as Error).message,
            }, 400);
        }
    };
}

// ============================================================================
// Query Parameter Validation
// ============================================================================

export function validateQueryParam(
    param: string,
    validator: (value: string | undefined) => string | number | undefined,
    required: boolean = false
) {
    return async (c: Context, next: Next): Promise<Response | void> => {
        const value = c.req.query(param);

        if (required && !value) {
            return c.json({
                error: 'Validation failed',
                details: [{ field: param, message: `Query parameter '${param}' is required` }],
            }, 400);
        }

        try {
            const validated = validator(value);
            c.set(`query_${param}`, validated);
            await next();
        } catch (error) {
            return c.json({
                error: 'Validation failed',
                details: [{ field: param, message: (error as Error).message }],
            }, 400);
        }
    };
}

// ============================================================================
// Common Query Validators
// ============================================================================

export function parseIntParam(min?: number, max?: number) {
    return (value: string | undefined): number | undefined => {
        if (!value) return undefined;
        const num = parseInt(value, 10);
        if (isNaN(num)) throw new Error('Must be a valid integer');
        if (min !== undefined && num < min) throw new Error(`Must be at least ${min}`);
        if (max !== undefined && num > max) throw new Error(`Must be at most ${max}`);
        return num;
    };
}

export function parseBoolParam() {
    return (value: string | undefined): boolean | undefined => {
        if (!value) return undefined;
        if (value === 'true' || value === '1') return true;
        if (value === 'false' || value === '0') return false;
        throw new Error('Must be true or false');
    };
}
