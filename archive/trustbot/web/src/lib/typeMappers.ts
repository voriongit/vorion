/**
 * Type Mappers - Convert Backend API responses to Frontend types
 *
 * This module bridges the gap between backend (src/types.ts) and frontend (web/src/types.ts)
 * by providing transformation functions that normalize data shapes.
 */

import type {
    Agent,
    Task,
    BlackboardEntry,
    AgentTrustTrend
} from '../types';

// ============================================================================
// Backend Types (matching src/types.ts for reference)
// ============================================================================

interface BackendTrustScore {
    level: string;
    numeric: number;
    inherited: number;
    earned: number;
    penalties: number;
    lastVerified: string | Date;
    parentId: string | null;
}

interface BackendCapability {
    id: string;
    name: string;
    description: string;
    requiredTier: number;
    parameters?: Record<string, unknown>;
}

interface BackendAgentBlueprint {
    id: string;
    structuredId?: string;
    name: string;
    type: string;
    tier: number;
    trustScore: BackendTrustScore | number;
    trustPolicy?: {
        minScoreToSpawn: number;
        maxChildTier: number;
        requiresValidation: boolean;
        canSelfModify: boolean;
        autonomyLevel: number;
    };
    capabilities: BackendCapability[] | string[];
    location: { floor: string; room: string; position?: { x: number; y: number } };
    status: string;
    parentId: string | null;
    parentStructuredId?: string;
    childIds: string[];
    childStructuredIds?: string[];
    createdAt: string | Date;
    createdByStructuredId?: string;
    lastActiveAt: string | Date;
    metadata: Record<string, unknown>;
    skills?: string[];
}

interface BackendContribution {
    agentId: string;
    content: string;
    confidence: number;
    timestamp: string | Date;
}

interface BackendBlackboardEntry {
    id: string;
    type: string;
    title: string;
    author: string;
    content: unknown;
    confidence?: number;
    dependencies?: string[];
    contributions?: BackendContribution[];
    status: string;
    visibility?: string;
    visibleTo?: string[];
    priority: string;
    createdAt: string | Date;
    updatedAt: string | Date;
    resolvedAt?: string | Date;
    resolution?: string;
    // Legacy field from some API responses
    comments?: Array<{ author: string; text: string; timestamp: string | Date }>;
}

interface BackendTask {
    id: string;
    title?: string;
    description: string;
    createdBy?: string;
    creator?: string;
    assignedTo?: string;
    assignee?: string | null;
    collaborators?: string[];
    status: string;
    priority: string;
    tier?: number;
    requiredTier?: number;
    dependencies?: string[];
    deadline?: string | Date;
    createdAt: string | Date;
    startedAt?: string | Date;
    completedAt?: string | Date;
    result?: unknown;
    logs?: Array<{
        timestamp: string | Date;
        agent: string;
        action: string;
        details?: string;
    }>;
    // Frontend-expected fields that might come from API
    type?: string;
    progress?: number;
    nextSteps?: string;
    maxDelegations?: number;
    currentDelegations?: number;
    delegationHistory?: Array<{ from: string; to: string; timestamp: string }>;
    assigneeName?: string | null;
    updatedAt?: string | Date;
}

// ============================================================================
// Mapper Functions
// ============================================================================

/**
 * Map backend agent to frontend Agent type
 */
export function mapAgent(backend: BackendAgentBlueprint): Agent {
    // Extract numeric trust score
    let trustScore: number;
    if (typeof backend.trustScore === 'object' && backend.trustScore !== null) {
        trustScore = backend.trustScore.numeric;
    } else {
        trustScore = backend.trustScore as number;
    }

    // Extract capability IDs
    const capabilities: string[] = Array.isArray(backend.capabilities)
        ? backend.capabilities.map(c => typeof c === 'string' ? c : c.id)
        : [];

    // Calculate trust trend (simplified - would need historical data)
    const trustTrend: AgentTrustTrend = {
        direction: 'stable',
        percentChange: 0,
    };

    return {
        id: backend.id,
        structuredId: backend.structuredId,
        name: backend.name,
        type: backend.type as Agent['type'],
        tier: backend.tier,
        status: backend.status as Agent['status'],
        location: {
            floor: backend.location.floor as Agent['location']['floor'],
            room: backend.location.room,
        },
        trustScore,
        trustTrend,
        capabilities,
        skills: backend.skills,
        parentId: backend.parentId,
        parentStructuredId: backend.parentStructuredId,
        childIds: backend.childIds,
        createdByStructuredId: backend.createdByStructuredId,
    };
}

/**
 * Map backend task to frontend Task type
 */
export function mapTask(backend: BackendTask): Task {
    // Compute progress from status if not provided
    let progress = backend.progress ?? 0;
    if (!backend.progress) {
        switch (backend.status) {
            case 'COMPLETED': progress = 100; break;
            case 'IN_PROGRESS': progress = 50; break;
            case 'ASSIGNED': progress = 10; break;
            case 'QUEUED':
            case 'PENDING': progress = 0; break;
            case 'FAILED': progress = 0; break;
            default: progress = 0;
        }
    }

    // Generate next steps from logs if not provided
    let nextSteps = backend.nextSteps ?? '';
    if (!nextSteps && backend.logs && backend.logs.length > 0) {
        const lastLog = backend.logs[backend.logs.length - 1];
        nextSteps = lastLog.details || lastLog.action;
    }

    // Map result to frontend format
    let result: Task['result'] | undefined;
    if (backend.result !== undefined) {
        if (typeof backend.result === 'object' && backend.result !== null) {
            const r = backend.result as Record<string, unknown>;
            result = {
                summary: String(r.summary || r.message || JSON.stringify(backend.result)),
                completedBy: String(r.completedBy || backend.assignedTo || backend.assignee || 'unknown'),
                duration: String(r.duration || 'N/A'),
                confidence: Number(r.confidence || 0),
            };
        } else {
            result = {
                summary: String(backend.result),
                completedBy: backend.assignedTo || backend.assignee || 'unknown',
                duration: 'N/A',
                confidence: 0,
            };
        }
    }

    return {
        id: backend.id,
        description: backend.description || backend.title || '',
        type: backend.type || 'TASK',
        creator: backend.creator || backend.createdBy || 'SYSTEM',
        priority: backend.priority,
        status: backend.status,
        assignee: backend.assignee ?? backend.assignedTo ?? null,
        assigneeName: backend.assigneeName ?? null,
        progress,
        nextSteps,
        createdAt: typeof backend.createdAt === 'string'
            ? backend.createdAt
            : new Date(backend.createdAt).toISOString(),
        updatedAt: backend.updatedAt
            ? (typeof backend.updatedAt === 'string' ? backend.updatedAt : new Date(backend.updatedAt).toISOString())
            : (typeof backend.createdAt === 'string' ? backend.createdAt : new Date(backend.createdAt).toISOString()),
        requiredTier: backend.requiredTier ?? backend.tier,
        maxDelegations: backend.maxDelegations ?? 2,
        currentDelegations: backend.currentDelegations ?? 0,
        delegationHistory: backend.delegationHistory ?? [],
        result,
        startedAt: backend.startedAt
            ? (typeof backend.startedAt === 'string' ? backend.startedAt : new Date(backend.startedAt).toISOString())
            : undefined,
        completedAt: backend.completedAt
            ? (typeof backend.completedAt === 'string' ? backend.completedAt : new Date(backend.completedAt).toISOString())
            : undefined,
    };
}

/**
 * Map backend blackboard entry to frontend BlackboardEntry type
 */
export function mapBlackboardEntry(backend: BackendBlackboardEntry): BlackboardEntry {
    // Convert contributions to comments format for frontend compatibility
    const comments = backend.comments ?? (backend.contributions?.map(c => ({
        author: c.agentId,
        text: c.content,
        timestamp: typeof c.timestamp === 'string' ? c.timestamp : new Date(c.timestamp).toISOString(),
    })) ?? []);

    // Map type - frontend has fewer types
    const typeMap: Record<string, BlackboardEntry['type']> = {
        'PROBLEM': 'PROBLEM',
        'HYPOTHESIS': 'OBSERVATION',
        'PARTIAL_SOLUTION': 'SOLUTION',
        'SOLUTION': 'SOLUTION',
        'DECISION': 'DECISION',
        'PATTERN': 'PATTERN',
        'ANTI_PATTERN': 'PATTERN',
        'OBSERVATION': 'OBSERVATION',
        'TASK': 'TASK',
        'MEETING_REQUEST': 'TASK',
    };

    return {
        id: backend.id,
        type: typeMap[backend.type] || 'OBSERVATION',
        title: backend.title,
        author: backend.author,
        content: typeof backend.content === 'string'
            ? backend.content
            : JSON.stringify(backend.content),
        priority: backend.priority as BlackboardEntry['priority'],
        status: backend.status as BlackboardEntry['status'],
        timestamp: typeof backend.createdAt === 'string'
            ? new Date(backend.createdAt)
            : backend.createdAt as Date,
        comments,
    };
}

/**
 * Batch map agents
 */
export function mapAgents(backends: BackendAgentBlueprint[]): Agent[] {
    return backends.map(mapAgent);
}

/**
 * Batch map tasks
 */
export function mapTasks(backends: BackendTask[]): Task[] {
    return backends.map(mapTask);
}

/**
 * Batch map blackboard entries
 */
export function mapBlackboardEntries(backends: BackendBlackboardEntry[]): BlackboardEntry[] {
    return backends.map(mapBlackboardEntry);
}
