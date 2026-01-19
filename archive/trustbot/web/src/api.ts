/**
 * API Hooks for React
 *
 * Provides data fetching and mutation hooks for the Aurais API.
 * Supports both legacy API (port 3001) and Unified Workflow API (port 3003).
 */

// Fly.io API Server URL (auto-starts on request, scales to 0 when idle)
const FLY_API_URL = 'https://aurais-api.fly.dev';

// Unified API Server - Hono (serves both legacy /api/* and workflow endpoints)
const API_BASE = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? `${FLY_API_URL}/api`  // Production - Fly.io hosted API
    : 'http://127.0.0.1:3003/api';  // Local dev - Unified Hono server (IPv4)

// Unified Workflow API - Same server, different path
const WORKFLOW_API_BASE = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? FLY_API_URL  // Production - Fly.io hosted API
    : 'http://127.0.0.1:3003';  // Local dev - Unified Hono server (IPv4)

// ============================================================================
// Types
// ============================================================================
import type { Agent, BlackboardEntry, ApprovalRequest, Task, ChatMessage, TaskResult } from './types';

// Re-export types for consumers that import from api.ts
export type { Agent, BlackboardEntry, ApprovalRequest, Task, ChatMessage } from './types';

// Export base URL for direct API access
export const API_URL = WORKFLOW_API_BASE;

// API Response type (matches actual API shape, differs from frontend SystemState)
export interface APISystemState {
    agents: Array<Agent & { childIds?: string[]; skills?: string[] }>;
    blackboard: Array<{
        id: string;
        type: string;
        title: string;
        content: unknown;
        author: string;
        priority: string;
        status: string;
        createdAt: string;
        comments?: Array<{ author: string; text: string; timestamp: string }>;
    }>;
    hitlLevel: number;
    avgTrust: number;
    day?: number;
    events?: string[];
    persistenceMode?: 'postgres' | 'memory';
}

// ============================================================================
// Auth Helper
// ============================================================================

function getAuthToken(): string | null {
    // Get the Google credential from session storage
    const credential = sessionStorage.getItem('aurais_credential');
    return credential;
}

function getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    const token = getAuthToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}

// ============================================================================
// Fetch Helpers
// ============================================================================

async function fetchAPI<T>(path: string): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
        headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
}

async function postAPI<T>(path: string, data: unknown): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
}

// ============================================================================
// API Functions
// ============================================================================

export const api = {
    // GET
    getState: () => fetchAPI<APISystemState>('/state'),
    getAgents: () => fetchAPI<Agent[]>('/agents'),
    getAgent: (id: string) => fetchAPI<Agent>(`/agent/${id}`),
    getBlackboard: () => fetchAPI<BlackboardEntry[]>('/blackboard'),
    getApprovals: () => fetchAPI<ApprovalRequest[]>('/approvals'),
    getStats: () => fetchAPI<{ hitlLevel: number; avgTrust: number; agentCount: number; day: number }>('/stats'),
    getUptime: () => fetchAPI<{ uptime: number; formatted: string; startTimeISO: string }>('/uptime'),
    getTasks: () => fetchAPI<{ tasks: Task[] }>('/tasks'),
    postComment: (entryId: string, comment: string, author: string) =>
        postAPI<{ success: boolean; entry: any }>('/state', { action: 'comment', entryId, comment, author }),

    // POST
    spawnAgent: (params: { name: string; type: string; tier: number }) =>
        postAPI<Agent>('/spawn', params),

    // Agent Control Actions
    deleteAgent: async (agentId: string): Promise<{ success: boolean; message: string; archived: boolean }> => {
        const res = await fetch(`${API_BASE}/agents/${agentId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
    },

    pauseAgent: (agentId: string) =>
        postAPI<{ success: boolean; status: string }>('/agent/pause', { agentId }),

    resumeAgent: async (agentId: string) => {
        // Resume agent and trigger a tick to get it working
        const result = await postAPI<{ success: boolean; status: string }>('/agent/resume', { agentId });
        // Also trigger tick for this agent
        try {
            await postAPI<{ success: boolean }>('/agent/tick', { agentId });
        } catch {
            // Tick endpoint might not exist, that's ok
        }
        return result;
    },

    // Tick a specific agent (trigger work cycle)
    tickAgent: (agentId: string) =>
        postAPI<{ success: boolean; agentId: string; processed: boolean; result?: string }>('/agent/tick', { agentId }),

    adjustTrust: (agentId: string, delta: number, reason: string) =>
        postAPI<{ success: boolean; newScore: number; newTier: number }>('/agent/trust', { agentId, delta, reason }),

    // Agent Task Management
    getAgentTasks: (agentId: string) =>
        fetchAPI<{ tasks: Array<{ id: string; title: string; description?: string; priority: string; status: string; createdAt: string; progress?: number }> }>(`/agent/${agentId}/tasks`),

    addAgentTask: (agentId: string, task: { title: string; description?: string; priority: string }) =>
        postAPI<{ success: boolean; task: any }>(`/agent/${agentId}/tasks`, { action: 'add', ...task }),

    updateAgentTask: (agentId: string, taskId: string, updates: { status?: string; progress?: number }) =>
        postAPI<{ success: boolean; task: any }>(`/agent/${agentId}/tasks`, { action: 'update', taskId, ...updates }),

    deleteAgentTask: (agentId: string, taskId: string) =>
        postAPI<{ success: boolean }>(`/agent/${agentId}/tasks`, { action: 'delete', taskId }),

    setHITL: (level: number) =>
        postAPI<{ success: boolean; hitlLevel: number }>('/hitl', { level }),

    sendCommand: (target: string, command: string, agent?: { name: string; type: string; status: string; trustScore: number }) =>
        postAPI<{ success: boolean; command: string; response: string; agentType: string; timestamp: string }>('/command', { target, command, agent }),

    broadcast: (target: string, message: string) =>
        postAPI<{ success: boolean; message: string }>('/broadcast', { target, message }),

    scheduleMeeting: (room: string, topic: string, duration: number) =>
        postAPI<{ success: boolean; message: string }>('/meetings', { room, topic, duration }),

    approve: (id: string, approved: boolean) =>
        postAPI<ApprovalRequest>('/approve', { id, approved }),

    postToBlackboard: (params: { type: string; title: string; content: unknown; priority: string }) =>
        postAPI<BlackboardEntry>('/blackboard/post', params),

    postSettings: (category: string, key: string, value: any) =>
        postAPI<{ success: boolean }>('/settings', { category, key, value }),

    getSettings: () => fetchAPI<Record<string, any>>('/settings'),

    advanceDay: () =>
        postAPI<{ success: boolean; day: number }>('/advance-day', {}),

    getSkills: () => fetchAPI<any[]>('/skills'),
    createSkill: (skill: any) => postAPI<any>('/skills', { action: 'create', skill }),

    getChatMessages: (channelId?: string) => fetchAPI<ChatMessage[]>((channelId ? `/chat?channelId=${channelId}` : '/chat')),
    sendChatMessage: (message: Partial<ChatMessage>) => postAPI<ChatMessage>('/chat', { message }),

    // Agent Tick System - triggers the agent work loop with task assignment
    tick: () => fetchAPI<{
        success: boolean;
        tick: number;
        timestamp: string;
        processed: number;
        assigned: number;
        completed: number;
        queue: { pending: number; inProgress: number; awaitingApproval: number; totalTasks: number };
        assignments?: Array<{ taskId: string; taskTitle: string; agentId: string; agentName: string }>;
        pendingSummary?: {
            queued: number;
            awaitingApproval: number;
            inProgress: number;
            items: Array<{ id: string; title: string; status: string; reason: string }>;
        };
        trustSystem?: {
            avgTrust: number;
            agentsByTier: Record<string, number>;
        };
        events: string[];
        idleAgentsAvailable?: number;
    }>('/tick'),

    // Create a new task for agents to work on
    createTask: (description: string, creator: string, priority?: string) =>
        postAPI<{ success: boolean; task: any; message: string }>('/tasks', {
            action: 'create',
            description,
            creator,
            priority: priority || 'NORMAL',
        }),

    // Claude API Executor - real LLM reasoning for agents
    executeAgent: (agentId: string, taskId: string, mode: 'auto' | 'real' | 'simulation' = 'auto') =>
        postAPI<{
            success: boolean;
            mode: string;
            action: string;
            message: string;
            agent: { id: string; name: string; trustScore: number; tier: string };
            task: { id: string; status: string; result?: any };
        }>('/executor', { agentId, taskId, mode }),

    // SSE Stream - real-time updates (returns snapshot if not SSE)
    getStreamSnapshot: () => fetchAPI<{
        connected: boolean;
        mode: string;
        state: APISystemState | null;
        tasks: any[];
        trustSystem: {
            distribution: Record<string, number>;
            avgTrust: number;
        };
        timestamp: string;
    }>('/stream'),

    // Task Delegation API
    getDelegationRules: () => fetchAPI<{
        rules: { maxDelegations: number; minTierToDelegate: string; penalties: Record<string, number> };
        tiers: Array<{ level: number; name: string; threshold: number; canDelegate: boolean }>;
    }>('/delegate'),

    getTaskDelegationStatus: (taskId: string) => fetchAPI<{
        taskId: string;
        description: string;
        currentDelegations: number;
        maxDelegations: number;
        remainingDelegations: number;
        canDelegate: boolean;
        delegationHistory: Array<{
            id: string;
            from: { id: string; name: string; trustScore: number; tier: string };
            to: { id: string; name: string; trustScore: number; tier: string };
            reason: string;
            timestamp: string;
            delegationNumber: number;
        }>;
        currentAssignee: string;
    }>(`/delegate?taskId=${taskId}`),

    delegateTask: (taskId: string, fromAgentId: string, toAgentId: string, reason?: string) =>
        postAPI<{
            success: boolean;
            delegation: any;
            task: { id: string; status: string; assignee: string; currentDelegations: number; remainingDelegations: number; canDelegateAgain: boolean };
            message: string;
        }>('/delegate', { taskId, fromAgentId, toAgentId, reason }),

    // MCP Server API
    getMCPTools: () => fetchAPI<{
        name: string;
        version: string;
        description: string;
        tools: Array<{ name: string; description: string; inputSchema: any }>;
    }>('/mcp'),

    callMCPTool: (tool: string, params: Record<string, any> = {}) =>
        postAPI<{ success: boolean; result: any }>('/mcp', { tool, params }),

    // Aria AI Interpretation - natural language understanding
    interpretMessage: (message: string, context?: {
        agents?: Array<{ id: string; name: string; type: string; tier: number; status: string }>;
        pendingApprovals?: number;
        hitlLevel?: number;
        recentTasks?: Array<{ title: string; status: string }>;
    }) => postAPI<{
        success: boolean;
        error?: string;
        interpretation: {
            action: 'SPAWN' | 'TASK' | 'STATUS' | 'AGENTS' | 'AGENT_DETAIL' | 'APPROVE' | 'DENY' | 'HITL' | 'TICK' | 'HELP' | 'CHAT';
            params: Record<string, any>;
            response: string;
            confidence: number;
        };
        provider?: string;
        model?: string;
    }>('/ai/aria/interpret', { message, context }),

    // Aria Multi-Provider - gather perspectives from all available AIs
    gatherPerspectives: (question: string, context?: string, synthesize = true) =>
        postAPI<{
            success: boolean;
            error?: string;
            question: string;
            perspectives: Array<{
                provider: 'claude' | 'grok' | 'openai' | 'gemini';
                perspective: string;
                model: string;
                success: boolean;
                error?: string;
            }>;
            synthesis?: string;
            providers: Array<'claude' | 'grok' | 'openai' | 'gemini'>;
            providersQueried: number;
            providersSucceeded: number;
        }>('/ai/aria/gather', { question, context, synthesize }),

    // Aria Consult - ask a specific AI provider
    consultProvider: (question: string, provider: 'claude' | 'grok' | 'openai' | 'gemini', role?: string, context?: string) =>
        postAPI<{
            success: boolean;
            error?: string;
            provider: string;
            model?: string;
            response?: string;
            availableProviders?: string[];
        }>('/ai/aria/consult', { question, provider, role, context }),

    // Get available AI providers
    getAIProviders: () => fetchAPI<{
        available: Array<'claude' | 'grok' | 'openai' | 'gemini'>;
        default: string | null;
        models: Record<string, string>;
    }>('/ai/providers'),

    // Aria Settings
    getAriaSettings: () => fetchAPI<{
        success: boolean;
        settings: {
            enabled: boolean;
            mode: 'single' | 'all' | 'select';
            defaultProvider?: 'claude' | 'grok' | 'openai' | 'gemini';
            enabledProviders: Array<'claude' | 'grok' | 'openai' | 'gemini'>;
            synthesize: boolean;
            maxTokensPerQuery: number;
            dailyQueryLimit: number;
            queriesUsedToday: number;
        };
        availableProviders: Array<'claude' | 'grok' | 'openai' | 'gemini'>;
        defaultProvider: string | null;
    }>('/ai/aria/settings'),

    setAriaSettings: (settings: Partial<{
        enabled: boolean;
        mode: 'single' | 'all' | 'select';
        defaultProvider: 'claude' | 'grok' | 'openai' | 'gemini';
        enabledProviders: Array<'claude' | 'grok' | 'openai' | 'gemini'>;
        synthesize: boolean;
        maxTokensPerQuery: number;
        dailyQueryLimit: number;
    }>) => postAPI<{
        success: boolean;
        settings: {
            enabled: boolean;
            mode: 'single' | 'all' | 'select';
            defaultProvider?: 'claude' | 'grok' | 'openai' | 'gemini';
            enabledProviders: Array<'claude' | 'grok' | 'openai' | 'gemini'>;
            synthesize: boolean;
            maxTokensPerQuery: number;
            dailyQueryLimit: number;
            queriesUsedToday: number;
        };
    }>('/ai/aria/settings', settings),

    // Advisor Configuration
    getAdvisors: () => fetchAPI<{
        success: boolean;
        advisors: Array<{
            name: string;
            provider: 'claude' | 'grok' | 'openai' | 'gemini';
            aliases: string[];
            personality?: string;
            icon?: string;
            enabled: boolean;
            available?: boolean;
        }>;
        councilName: string;
        councilAliases: string[];
        availableProviders: string[];
    }>('/ai/aria/advisors'),

    addAdvisor: (advisor: {
        name: string;
        provider: 'claude' | 'grok' | 'openai' | 'gemini';
        aliases?: string[];
        personality?: string;
        icon?: string;
        enabled?: boolean;
    }) => postAPI<{
        success: boolean;
        advisor: {
            name: string;
            provider: 'claude' | 'grok' | 'openai' | 'gemini';
            aliases: string[];
            personality?: string;
            icon?: string;
            enabled: boolean;
        };
        action: 'created' | 'updated';
    }>('/ai/aria/advisors', advisor),

    removeAdvisor: (name: string) => fetch(`${API_BASE}/ai/aria/advisors/${encodeURIComponent(name)}`, {
        method: 'DELETE',
    }).then(res => res.json()) as Promise<{
        success: boolean;
        removed?: { name: string };
        error?: string;
    }>,

    setCouncilConfig: (config: {
        name?: string;
        aliases?: string[];
    }) => postAPI<{
        success: boolean;
        councilName: string;
        councilAliases: string[];
    }>('/ai/aria/council', config),

    // ========================================================================
    // Memory API - Aria's persistent memory and knowledge system
    // ========================================================================

    // Store a conversation message
    storeConversation: (message: {
        sessionId: string;
        role: 'user' | 'aria';
        content: string;
        userId?: string;
        orgId?: string;
        provider?: string;
        model?: string;
        metadata?: Record<string, unknown>;
    }) => postAPI<{
        id: string;
        sessionId: string;
        role: string;
        content: string;
        createdAt: string;
    }>('/memory/conversations', message),

    // Search conversations semantically
    searchConversations: (query: string, options?: {
        userId?: string;
        sessionId?: string;
        limit?: number;
        similarityThreshold?: number;
    }) => postAPI<Array<{
        id: string;
        sessionId: string;
        role: string;
        content: string;
        similarity: number;
        createdAt: string;
    }>>('/memory/conversations/search', { query, ...options }),

    // Get session history
    getSessionHistory: (sessionId: string, limit?: number) =>
        fetchAPI<Array<{
            id: string;
            role: string;
            content: string;
            createdAt: string;
        }>>(`/memory/conversations/session/${sessionId}${limit ? `?limit=${limit}` : ''}`),

    // Search knowledge semantically
    searchKnowledge: (query: string, options?: {
        categories?: string[];
        minConfidence?: number;
        limit?: number;
    }) => postAPI<Array<{
        id: string;
        category: string;
        title: string;
        content: string;
        confidence: number;
        similarity: number;
    }>>('/memory/knowledge/search', { query, ...options }),

    // Store knowledge entry
    storeKnowledge: (entry: {
        category: string;
        subcategory?: string;
        title: string;
        content: string;
        sourceType?: string;
        sourceId?: string;
        confidence?: number;
        tags?: string[];
    }) => postAPI<{
        id: string;
        category: string;
        title: string;
        createdAt: string;
    }>('/memory/knowledge', entry),

    // Get knowledge by category
    getKnowledgeByCategory: (category: string, subcategory?: string) =>
        fetchAPI<Array<{
            id: string;
            title: string;
            content: string;
            confidence: number;
        }>>(`/memory/knowledge/category/${category}${subcategory ? `?subcategory=${subcategory}` : ''}`),

    // Verify knowledge entry (HITL)
    verifyKnowledge: (id: string, verifiedBy: string) =>
        postAPI<{
            id: string;
            verifiedBy: string;
            verifiedAt: string;
            confidence: number;
        }>(`/memory/knowledge/${id}/verify`, { verifiedBy }),

    // Seed system knowledge
    seedKnowledge: () => postAPI<{ seeded: number }>('/memory/knowledge/seed', {}),

    // Get memory system health
    getMemoryHealth: () => fetchAPI<{
        status: string;
        services: { conversations: string; knowledge: string; embeddings: string };
        timestamp: string;
    }>('/memory/health'),

    // Get embedding stats
    getEmbeddingStats: () => fetchAPI<{
        size: number;
        memoryBytes: number;
    }>('/memory/embed/stats'),
};

// ============================================================================
// Unified Workflow API
// ============================================================================

export interface CompletedTodaySummary {
    date: string;
    totalCompleted: number;
    totalFailed: number;
    totalPending: number;
    byAgent: Record<string, number>;
    byPriority: Record<string, number>;
    avgCompletionTimeMs: number;
    trustChanges: {
        rewards: number;
        penalties: number;
        netChange: number;
    };
    autonomyMetrics: {
        autoApproved: number;
        humanApproved: number;
        humanRejected: number;
    };
}

export interface AggressivenessConfig {
    level: number;
    autoApproveUpToTier: number;
    maxDelegationDepth: number;
    trustRewardMultiplier: number;
    trustPenaltyMultiplier: number;
}

export interface WorkflowTask {
    id: string;
    title: string;
    description: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    status: 'QUEUED' | 'PENDING_APPROVAL' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
    assignedTo?: string;
    delegationCount: number;
    requiredTier: number;
    createdAt: string;
    startedAt?: string;
    completedAt?: string;
    result?: TaskResult;
    approvalRequired: boolean;
    approvedBy?: string;
}

async function fetchWorkflowAPI<T>(path: string): Promise<T> {
    const res = await fetch(`${WORKFLOW_API_BASE}${path}`);
    if (!res.ok) throw new Error(`Workflow API error: ${res.status}`);
    return res.json();
}

async function postWorkflowAPI<T>(path: string, data: unknown): Promise<T> {
    const res = await fetch(`${WORKFLOW_API_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Workflow API error: ${res.status}`);
    return res.json();
}

export const workflowApi = {
    // Dashboard
    getCompletedToday: () => fetchWorkflowAPI<CompletedTodaySummary>('/dashboard/today'),
    getAggressiveness: () => fetchWorkflowAPI<AggressivenessConfig>('/dashboard/aggressiveness'),
    setAggressiveness: (level: number, tokenId: string) =>
        postWorkflowAPI<AggressivenessConfig>('/dashboard/aggressiveness', { level, tokenId }),

    // Tasks
    getTasks: () => fetchWorkflowAPI<WorkflowTask[]>('/tasks'),
    getTask: (id: string) => fetchWorkflowAPI<WorkflowTask>(`/tasks/${id}`),
    createTask: (title: string, description: string, priority?: string, requiredTier?: number) =>
        postWorkflowAPI<WorkflowTask>('/tasks', { title, description, priority, requiredTier }),
    assignTask: (taskId: string, agentId: string, tokenId: string) =>
        postWorkflowAPI<WorkflowTask>(`/tasks/${taskId}/assign`, { agentId, tokenId }),
    completeTask: (taskId: string, result: unknown, tokenId: string) =>
        postWorkflowAPI<WorkflowTask>(`/tasks/${taskId}/complete`, { result, tokenId }),
    failTask: (taskId: string, reason: string, tokenId: string) =>
        postWorkflowAPI<WorkflowTask>(`/tasks/${taskId}/fail`, { reason, tokenId }),

    // Approvals
    getPendingApprovals: () => fetchWorkflowAPI<WorkflowTask[]>('/approvals'),
    approveTask: (taskId: string, approve: boolean, tokenId: string) =>
        postWorkflowAPI<WorkflowTask>(`/approvals/${taskId}`, { approve, tokenId }),

    // Trust & Security
    getTrustStats: () => fetchWorkflowAPI<{
        totalAgents: number;
        byLevel: Record<string, number>;
        avgTrust: number;
        hitlLevel: number;
    }>('/trust/stats'),
    getAuditLog: (limit?: number) =>
        fetchWorkflowAPI<Array<{
            id: string;
            timestamp: string;
            action: string;
            actor: { type: string; id: string; tier?: number };
            outcome: string;
            details: Record<string, unknown>;
        }>>(`/security/audit${limit ? `?limit=${limit}` : ''}`),

    // Auth
    getHumanToken: (masterKey: string) =>
        postWorkflowAPI<{ tokenId: string; expiresAt: string }>('/auth/human', { masterKey }),

    // Health
    health: () => fetchWorkflowAPI<{ status: string; timestamp: string }>('/health'),
};

// ============================================================================
// Artifact Types
// ============================================================================

export type ArtifactType = 'CODE' | 'DOCUMENT' | 'IMAGE' | 'DATA' | 'REPORT' | 'CONFIG' | 'LOG' | 'ARCHIVE';
export type ArtifactStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';

export interface Artifact {
    id: string;
    name: string;
    type: ArtifactType;
    mimeType: string;
    content?: string;
    size: number;
    checksum?: string;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    taskId?: string;
    visibility: 'PUBLIC' | 'PRIVATE' | 'TASK_PARTICIPANTS' | 'TIER_RESTRICTED';
    minTierRequired?: number;
    status: ArtifactStatus;
    tags: string[];
    description?: string;
    version: number;
    isLatest: boolean;
    parentArtifactId?: string;
    previousVersionId?: string;
    reviewedBy?: string;
    reviewedAt?: string;
    reviewNotes?: string;
}

export interface ArtifactStats {
    total: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    totalSizeBytes: number;
}

export interface ArtifactListResponse {
    artifacts: Artifact[];
    total: number;
    hasMore: boolean;
}

// ============================================================================
// Artifact API
// ============================================================================

async function fetchArtifactAPI<T>(path: string): Promise<T> {
    const res = await fetch(`${API_BASE}/artifacts${path}`);
    if (!res.ok) throw new Error(`Artifact API error: ${res.status}`);
    return res.json();
}

async function postArtifactAPI<T>(path: string, data: unknown): Promise<T> {
    const res = await fetch(`${API_BASE}/artifacts${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Artifact API error: ${res.status}`);
    return res.json();
}

async function putArtifactAPI<T>(path: string, data: unknown): Promise<T> {
    const res = await fetch(`${API_BASE}/artifacts${path}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Artifact API error: ${res.status}`);
    return res.json();
}

async function deleteArtifactAPI<T>(path: string): Promise<T> {
    const res = await fetch(`${API_BASE}/artifacts${path}`, {
        method: 'DELETE',
    });
    if (!res.ok) throw new Error(`Artifact API error: ${res.status}`);
    return res.json();
}

export const artifactApi = {
    // List artifacts with optional filters
    list: (params?: {
        taskId?: string;
        createdBy?: string;
        type?: ArtifactType;
        status?: ArtifactStatus;
        tags?: string[];
        latestOnly?: boolean;
        limit?: number;
        offset?: number;
    }) => {
        const searchParams = new URLSearchParams();
        if (params?.taskId) searchParams.set('taskId', params.taskId);
        if (params?.createdBy) searchParams.set('createdBy', params.createdBy);
        if (params?.type) searchParams.set('type', params.type);
        if (params?.status) searchParams.set('status', params.status);
        if (params?.tags?.length) searchParams.set('tags', params.tags.join(','));
        if (params?.latestOnly) searchParams.set('latestOnly', 'true');
        if (params?.limit) searchParams.set('limit', String(params.limit));
        if (params?.offset) searchParams.set('offset', String(params.offset));
        const query = searchParams.toString();
        return fetchArtifactAPI<ArtifactListResponse>(query ? `?${query}` : '');
    },

    // Get artifact by ID
    get: (id: string) => fetchArtifactAPI<Artifact>(`/${id}`),

    // Get artifact content (returns blob for binary, text for text)
    getContent: async (id: string): Promise<{ content: string | Blob; mimeType: string }> => {
        const res = await fetch(`${API_BASE}/artifacts/${id}/content`);
        if (!res.ok) throw new Error(`Artifact API error: ${res.status}`);
        const mimeType = res.headers.get('content-type') || 'application/octet-stream';
        if (mimeType.startsWith('text/') || mimeType === 'application/json') {
            return { content: await res.text(), mimeType };
        }
        return { content: await res.blob(), mimeType };
    },

    // Create artifact
    create: (data: {
        name: string;
        type: ArtifactType;
        content?: string;
        mimeType?: string;
        taskId?: string;
        tags?: string[];
        description?: string;
        createdBy: string;
    }) => postArtifactAPI<Artifact>('', data),

    // Update artifact metadata
    update: (id: string, data: {
        name?: string;
        tags?: string[];
        description?: string;
        visibility?: string;
    }) => putArtifactAPI<Artifact>(`/${id}`, data),

    // Delete artifact
    delete: (id: string) => deleteArtifactAPI<{ success: boolean }>(`/${id}`),

    // Get version history
    getVersions: (id: string) => fetchArtifactAPI<{
        artifactId: string;
        versions: Artifact[];
        count: number;
    }>(`/${id}/versions`),

    // Create new version
    createVersion: (id: string, data: {
        content?: string;
        notes?: string;
        createdBy: string;
    }) => postArtifactAPI<Artifact>(`/${id}/versions`, data),

    // Submit for review
    submitForReview: (id: string) => postArtifactAPI<Artifact>(`/${id}/submit-review`, {}),

    // Review artifact
    review: (id: string, data: {
        decision: 'APPROVE' | 'REJECT';
        notes?: string;
        reviewedBy: string;
    }) => postArtifactAPI<Artifact>(`/${id}/review`, data),

    // Get stats
    getStats: () => fetchArtifactAPI<ArtifactStats>('/stats'),

    // Get artifacts for a task
    getByTask: (taskId: string) => fetchArtifactAPI<{
        taskId: string;
        artifacts: Artifact[];
        count: number;
    }>(`/task/${taskId}`),
};

// ============================================================================
// React Hooks
// ============================================================================

import { useState, useEffect, useCallback } from 'react';

export function useSystemState(pollInterval = 2000) {
    const [state, setState] = useState<APISystemState | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        try {
            const data = await api.getState();
            setState(data);
            setError(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
        const interval = setInterval(refresh, pollInterval);
        return () => clearInterval(interval);
    }, [refresh, pollInterval]);

    return { state, error, loading, refresh };
}

export function useApprovals(pollInterval = 3000) {
    const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);

    useEffect(() => {
        const fetch = async () => {
            try {
                // Fetch both action requests (legacy/governance) and workflow tasks
                const [actionRequests, workflowApprovals] = await Promise.all([
                    api.getApprovals(),
                    workflowApi.getPendingApprovals()
                ]);

                // Map workflow approvals to the generic format if needed, or simply merge if compatible
                // For now, let's just use the legacy ones as primary, but logged to see if we're missing connections
                console.log('Action Requests:', actionRequests);
                console.log('Workflow Approvals:', workflowApprovals);
                
                // TODO: Unify these types properly in a future refactor
                // For now, we return the actionRequests which drives the main HITLExplanation
                setApprovals(actionRequests);
            } catch {
                // Ignore errors
            }
        };

        fetch();
        const interval = setInterval(fetch, pollInterval);
        return () => clearInterval(interval);
    }, [pollInterval]);

    return approvals;
}

// ============================================================================
// Unified Workflow Hooks
// ============================================================================

export function useCompletedToday(pollInterval = 5000) {
    const [summary, setSummary] = useState<CompletedTodaySummary | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        try {
            const data = await workflowApi.getCompletedToday();
            setSummary(data);
            setError(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Workflow API unavailable');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
        const interval = setInterval(refresh, pollInterval);
        return () => clearInterval(interval);
    }, [refresh, pollInterval]);

    return { summary, error, loading, refresh };
}

export function useAggressiveness() {
    const [config, setConfig] = useState<AggressivenessConfig | null>(null);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        try {
            const data = await workflowApi.getAggressiveness();
            setConfig(data);
        } catch {
            // Workflow API might not be running
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const setLevel = useCallback(async (level: number, tokenId: string) => {
        try {
            const updated = await workflowApi.setAggressiveness(level, tokenId);
            setConfig(updated);
            return updated;
        } catch (e) {
            throw e;
        }
    }, []);

    return { config, loading, refresh, setLevel };
}

export function useWorkflowTasks(pollInterval = 3000) {
    const [tasks, setTasks] = useState<WorkflowTask[]>([]);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        try {
            const data = await workflowApi.getTasks();
            setTasks(data);
        } catch {
            // Workflow API might not be running
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
        const interval = setInterval(refresh, pollInterval);
        return () => clearInterval(interval);
    }, [refresh, pollInterval]);

    return { tasks, loading, refresh };
}

export function useWorkflowApprovals(pollInterval = 2000) {
    const [approvals, setApprovals] = useState<WorkflowTask[]>([]);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        try {
            const data = await workflowApi.getPendingApprovals();
            setApprovals(data);
        } catch {
            // Workflow API might not be running
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
        const interval = setInterval(refresh, pollInterval);
        return () => clearInterval(interval);
    }, [refresh, pollInterval]);

    return { approvals, loading, refresh };
}

export function useArtifacts(pollInterval = 5000) {
    const [artifacts, setArtifacts] = useState<Artifact[]>([]);
    const [stats, setStats] = useState<ArtifactStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        try {
            const [listData, statsData] = await Promise.all([
                artifactApi.list({ latestOnly: true }),
                artifactApi.getStats(),
            ]);
            setArtifacts(listData.artifacts);
            setStats(statsData);
            setError(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load artifacts');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
        const interval = setInterval(refresh, pollInterval);
        return () => clearInterval(interval);
    }, [refresh, pollInterval]);

    return { artifacts, stats, loading, error, refresh };
}
