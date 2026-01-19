/**
 * Unified Workflow API
 *
 * Single source of truth for all workflows - from task creation through
 * agent execution. Implements the "Completed Today" dashboard and
 * "Aggressiveness Slider" for human-controlled autonomy levels.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'eventemitter3';

import { TrustEngine } from '../core/TrustEngine.js';
import { Blackboard } from '../core/Blackboard.js';
import { SecurityLayer, type AuthToken, type AuditAction, type AuditEntry, type Permission } from '../core/SecurityLayer.js';
// Security middleware imports
import {
    corsMiddleware,
    rateLimitMiddleware,
    securityHeadersMiddleware,
    requestIdMiddleware,
    googleAuthMiddleware,
    type CORSConfig,
    type RateLimitConfig,
    type GoogleUser,
} from './middleware/security.js';
import {
    validate,
    validateCreateTask,
    validateSpawnAgent,
    validateDelegationRequest,
    validateVote,
    validateAuth,
    validateAggressiveness,
} from './middleware/validation.js';
import { loggingMiddleware, getRequestLogger } from './middleware/logging.js';
import { logger } from '../lib/logger.js';
import { PersistenceLayer, type PersistedState } from '../core/PersistenceLayer.js';
import { SupabasePersistence, hasSupabaseConfig, getSupabasePersistence, type Agent as SupabaseAgent } from '../core/SupabasePersistence.js';
// Epic 5: Import new core services
import { CryptographicAuditLogger } from '../core/CryptographicAuditLogger.js';
import { CouncilService } from '../core/council/CouncilService.js';
import { CouncilMemberRegistry } from '../core/council/CouncilMemberRegistry.js';
import { DelegationManager } from '../core/delegation/DelegationManager.js';
import { AutonomyBudgetService } from '../core/autonomy/AutonomyBudget.js';
import type { AgentId, AgentTier, AgentType, TrustLevel, BlackboardEntry, TaskResult } from '../types.js';
import {
    AgentRole,
    AgentCategory,
    generateAgentId,
    getNextInstance,
    getRoleFromType,
    getCategoryFromCapabilities,
} from '../types/agentId.js';
import type { CryptographicAuditEntry } from '../core/types/audit.js';
// Skills library integration
import {
    getAgentSkills,
    canAgentUseSkill,
    getSpawnSkillRequirements,
    exportAgentSkillManifest,
    getSkillsSummary,
} from '../skills/integration.js';
import {
    SKILLS,
    getSkillById,
    searchSkills,
    getSkillsByCategory,
    validateSkillComposition,
    getSkillStats,
    SKILL_CATEGORIES,
} from '../skills/index.js';
// Memory system
import { memoryRoutes } from './routes/memory.js';
import { createHealthRoutes } from './routes/health.js';
// Artifact system
import { artifactRoutes } from './routes/artifacts.js';
// Work loop system (autonomous agent execution)
import workLoopRoutes from './routes/work-loop.js';
// Agent discovery system
import { agentDiscoveryRoutes } from './routes/agent-discovery.js';
// Orchestrators and Time
import { T5Planner } from '../orchestrators/T5-Planner.js';
import { timeService } from '../core/TimeService.js';

// ============================================================================
// Types
// ============================================================================

// Advisor configuration - maps custom names to providers
export interface AdvisorConfig {
    name: string;                        // Display name (e.g., "Jarvis")
    provider: 'claude' | 'grok' | 'openai' | 'gemini';
    aliases: string[];                   // Alternative names (e.g., ["j", "jarv"])
    personality?: string;                // Custom system prompt/personality
    icon?: string;                       // Custom emoji icon
    enabled: boolean;                    // Is this advisor available?
}

export interface AriaSettings {
    enabled: boolean;                    // Is Aria AI enabled?
    mode: 'single' | 'all' | 'select';   // Use single provider, all, or selected ones
    defaultProvider?: 'claude' | 'grok' | 'openai' | 'gemini';
    enabledProviders: Array<'claude' | 'grok' | 'openai' | 'gemini'>;
    synthesize: boolean;                 // Auto-synthesize multi-provider responses
    maxTokensPerQuery: number;           // Token limit per query
    dailyQueryLimit: number;             // Max queries per day (0 = unlimited)
    queriesUsedToday: number;            // Counter for daily queries
    // Configurable advisors
    advisors: AdvisorConfig[];           // Custom advisor configurations
    councilName: string;                 // Name for the group (default: "council")
    councilAliases: string[];            // Aliases for the group (e.g., ["advisors", "team"])
}

// Default advisor configurations
const defaultAdvisors: AdvisorConfig[] = [
    {
        name: 'Claude',
        provider: 'claude',
        aliases: ['anthropic', 'sonnet', 'opus'],
        personality: 'You are Claude, a thoughtful and analytical AI assistant. You excel at nuanced reasoning and careful consideration of complex topics.',
        icon: '🧠',
        enabled: true,
    },
    {
        name: 'Grok',
        provider: 'grok',
        aliases: ['x', 'xai', 'elon'],
        personality: 'You are Grok, a witty and irreverent AI with a sense of humor. You provide insightful answers with occasional dry wit.',
        icon: '⚡',
        enabled: true,
    },
    {
        name: 'GPT',
        provider: 'openai',
        aliases: ['openai', 'chatgpt', 'o1'],
        personality: 'You are GPT, a helpful and versatile AI assistant. You aim to be clear, accurate, and comprehensive.',
        icon: '🤖',
        enabled: true,
    },
    {
        name: 'Gemini',
        provider: 'gemini',
        aliases: ['google', 'bard', 'deepmind'],
        personality: 'You are Gemini, a knowledgeable AI with access to broad information. You excel at research and comprehensive answers.',
        icon: '💎',
        enabled: true,
    },
];

// Default Aria settings
const defaultAriaSettings: AriaSettings = {
    enabled: true,
    mode: 'single',
    defaultProvider: 'claude',
    enabledProviders: ['claude', 'grok', 'openai', 'gemini'],
    synthesize: true,
    maxTokensPerQuery: 2000,
    dailyQueryLimit: 0,  // unlimited
    queriesUsedToday: 0,
    advisors: defaultAdvisors,
    councilName: 'council',
    councilAliases: ['advisors', 'team', 'minds', 'ais', 'everyone', 'all'],
};

// In-memory settings (would be persisted in real implementation)
let ariaSettings: AriaSettings = { ...defaultAriaSettings };

export interface WorkflowTask {
    id: string;
    title: string;
    description: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    status: 'QUEUED' | 'PENDING_APPROVAL' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
    assignedTo?: string;
    delegationCount: number;
    requiredTier: number;
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    result?: TaskResult;
    approvalRequired: boolean;
    approvedBy?: string;
    blackboardEntryId?: string;  // ID of the corresponding Blackboard entry for sync
}

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
    level: number;              // 0-100 (maps to inverse of HITL level)
    autoApproveUpToTier: number;  // Auto-approve tasks below this tier
    maxDelegationDepth: number;   // Max delegation chain length
    trustRewardMultiplier: number;  // Higher = faster trust building
    trustPenaltyMultiplier: number; // Higher = stricter penalties
}

// ============================================================================
// Events
// ============================================================================

interface WorkflowEvents {
    'task:created': (task: WorkflowTask) => void;
    'task:assigned': (task: WorkflowTask, agentId: string) => void;
    'task:completed': (task: WorkflowTask) => void;
    'task:failed': (task: WorkflowTask, reason: string) => void;
    'aggressiveness:changed': (oldLevel: number, newLevel: number) => void;
    'approval:required': (task: WorkflowTask) => void;
    'approval:granted': (taskId: string, approver: string) => void;
}

// ============================================================================
// Unified Workflow Engine
// ============================================================================

export class UnifiedWorkflowEngine extends EventEmitter<WorkflowEvents> {
    private tasks: Map<string, WorkflowTask> = new Map();
    private completedToday: WorkflowTask[] = [];
    private aggressiveness: AggressivenessConfig;
    private trustEngine: TrustEngine;
    private blackboard: Blackboard;
    private security: SecurityLayer;
    private persistence: PersistenceLayer | null;
    private lastDayReset: Date;

    constructor(
        trustEngine?: TrustEngine,
        blackboard?: Blackboard,
        security?: SecurityLayer,
        persistence?: PersistenceLayer
    ) {
        super();
        this.trustEngine = trustEngine ?? new TrustEngine();
        this.blackboard = blackboard ?? new Blackboard();
        this.security = security ?? new SecurityLayer();
        this.persistence = persistence ?? null;
        this.lastDayReset = new Date();
        this.lastDayReset.setHours(0, 0, 0, 0);

        // Default aggressiveness (conservative start)
        // Default aggressiveness (conservative start)
        this.aggressiveness = {
            level: 40,                   // Moderate autonomy (60% HITL)
            autoApproveUpToTier: 2,      // Auto-approve T1 and T2 tasks (Operational/Tactical)
            maxDelegationDepth: 5,
            trustRewardMultiplier: 1.2,
            trustPenaltyMultiplier: 1.0,
        };

        // Load persisted state if available
        if (this.persistence) {
            this.loadPersistedState();
        }
    }

    /**
     * Load state from persistence layer
     */
    private loadPersistedState(): void {
        if (!this.persistence) return;

        if (this.persistence.load()) {
            // Restore tasks
            const tasks = this.persistence.getTasks();
            tasks.forEach(task => this.tasks.set(task.id, task));

            // Restore aggressiveness
            this.aggressiveness = this.persistence.getAggressiveness();

            // Restore completed today
            this.completedToday = this.persistence.getCompletedToday();

            console.log(`📂 Loaded persisted state: ${tasks.length} tasks, aggressiveness=${this.aggressiveness.level}`);
        }
    }

    /**
     * Persist current state
     */
    private persistState(): void {
        if (!this.persistence) return;

        this.persistence.setTasks(Array.from(this.tasks.values()));
        this.persistence.setAggressiveness(this.aggressiveness);
        this.persistence.markDirty();
    }

    /**
     * Get persistence layer for manual operations
     */
    getPersistence(): PersistenceLayer | null {
        return this.persistence;
    }

    // -------------------------------------------------------------------------
    // Task Management
    // -------------------------------------------------------------------------

    createTask(params: {
        title: string;
        description: string;
        priority?: WorkflowTask['priority'];
        requiredTier?: number;
    }): WorkflowTask {
        const task: WorkflowTask = {
            id: uuidv4(),
            title: params.title,
            description: params.description,
            priority: params.priority ?? 'MEDIUM',
            status: 'QUEUED',
            delegationCount: 0,
            requiredTier: params.requiredTier ?? 2,
            createdAt: new Date(),
            approvalRequired: this.requiresApproval(params.requiredTier ?? 2),
        };

        this.tasks.set(task.id, task);

        // Post to blackboard and store entry ID for sync
        const blackboardEntry = this.blackboard.post({
            type: 'TASK',
            title: task.title,
            author: 'WORKFLOW_ENGINE',
            content: { taskId: task.id, description: task.description },
            priority: task.priority,
        });
        task.blackboardEntryId = blackboardEntry.id;

        this.emit('task:created', task);

        // Check if needs approval
        if (task.approvalRequired) {
            task.status = 'PENDING_APPROVAL';
            this.emit('approval:required', task);
        }

        // Persist state
        this.persistState();

        return task;
    }

    assignTask(taskId: string, agentId: string, tokenId: string): WorkflowTask | null {
        const task = this.tasks.get(taskId);
        if (!task) return null;

        // Verify agent has permission
        this.security.requireAuth(tokenId, 'BLACKBOARD_POST', 'ASSIGN_TASK');

        task.assignedTo = agentId;
        task.status = 'IN_PROGRESS';
        task.startedAt = new Date();

        this.emit('task:assigned', task, agentId);

        return task;
    }

    completeTask(taskId: string, result: Partial<TaskResult> | unknown, tokenId: string): WorkflowTask | null {
        const task = this.tasks.get(taskId);
        if (!task) return null;

        task.status = 'COMPLETED';
        task.completedAt = new Date();

        // Build structured TaskResult
        const startTime = task.startedAt ?? task.createdAt;
        const durationMs = Date.now() - startTime.getTime();
        const durationStr = durationMs >= 60000
            ? `${Math.floor(durationMs / 60000)}m ${Math.floor((durationMs % 60000) / 1000)}s`
            : `${Math.floor(durationMs / 1000)}s`;

        // Normalize result to TaskResult structure
        const inputResult = result as Partial<TaskResult> | undefined;
        task.result = {
            summary: inputResult?.summary ?? 'Task completed successfully',
            completedBy: inputResult?.completedBy ?? task.assignedTo ?? 'WORKFLOW_ENGINE',
            duration: inputResult?.duration ?? durationStr,
            confidence: inputResult?.confidence ?? 100,
            error: inputResult?.error,
            data: inputResult?.data,
        };

        // Sync to Blackboard: update content with result and mark as RESOLVED
        if (task.blackboardEntryId) {
            this.blackboard.updateContent(task.blackboardEntryId, {
                taskId: task.id,
                description: task.description,
                result: result,
                completedAt: task.completedAt,
                completedBy: task.assignedTo,
            });
            this.blackboard.resolve(task.blackboardEntryId, {
                resolution: `Task completed successfully`,
                resolvedBy: task.assignedTo ?? 'WORKFLOW_ENGINE',
            });
        } else {
            // No direct link - try to find matching Blackboard entry by title
            const matchingEntry = this.findMatchingBlackboardEntry(task.title);
            if (matchingEntry) {
                // Link found - update it
                task.blackboardEntryId = matchingEntry.id;
                this.blackboard.updateContent(matchingEntry.id, {
                    taskId: task.id,
                    description: task.description,
                    result: result,
                    completedAt: task.completedAt,
                    completedBy: task.assignedTo,
                    linkedLate: true,  // Flag that link was made after task creation
                });
                this.blackboard.resolve(matchingEntry.id, {
                    resolution: `Task completed successfully (linked retrospectively)`,
                    resolvedBy: task.assignedTo ?? 'WORKFLOW_ENGINE',
                });
            } else {
                // No matching entry - post a new SOLUTION entry for visibility
                const resultEntry = this.blackboard.post({
                    type: 'SOLUTION',
                    title: `Completed: ${task.title}`,
                    author: task.assignedTo ?? 'WORKFLOW_ENGINE',
                    content: {
                        taskId: task.id,
                        description: task.description,
                        result: result,
                        completedAt: task.completedAt,
                        completedBy: task.assignedTo,
                        priority: task.priority,
                    },
                    priority: task.priority,
                });
                task.blackboardEntryId = resultEntry.id;
            }
        }

        // Add to completed today
        this.checkDayReset();
        this.completedToday.push(task);

        // Reward the agent
        if (task.assignedTo) {
            const rewardAmount = this.calculateReward(task);
            this.trustEngine.reward(task.assignedTo, rewardAmount, `Completed task: ${task.title}`);
        }

        this.emit('task:completed', task);

        // Persist state
        this.persistState();

        return task;
    }

    /**
     * Find a matching Blackboard entry by task title.
     * This enables late-linking of tasks that were created outside the workflow API.
     */
    private findMatchingBlackboardEntry(taskTitle: string): BlackboardEntry | null {
        const taskEntries = this.blackboard.getByType('TASK');
        // Look for open entries that match the title
        return taskEntries.find(
            entry => entry.status === 'OPEN' && entry.title.includes(taskTitle)
        ) || null;
    }

    failTask(taskId: string, reason: string, tokenId: string): WorkflowTask | null {
        const task = this.tasks.get(taskId);
        if (!task) return null;

        task.status = 'FAILED';
        task.completedAt = new Date();

        // Build structured TaskResult for failure
        const startTime = task.startedAt ?? task.createdAt;
        const durationMs = Date.now() - startTime.getTime();
        const durationStr = durationMs >= 60000
            ? `${Math.floor(durationMs / 60000)}m ${Math.floor((durationMs % 60000) / 1000)}s`
            : `${Math.floor(durationMs / 1000)}s`;

        task.result = {
            summary: `Task failed: ${reason}`,
            completedBy: task.assignedTo ?? 'WORKFLOW_ENGINE',
            duration: durationStr,
            confidence: 0,
            error: reason,
        };

        // Sync to Blackboard: update content with failure info and mark as BLOCKED
        if (task.blackboardEntryId) {
            this.blackboard.updateContent(task.blackboardEntryId, {
                taskId: task.id,
                description: task.description,
                error: reason,
                failedAt: task.completedAt,
                failedBy: task.assignedTo,
            });
            this.blackboard.updateStatus(task.blackboardEntryId, 'BLOCKED');
        }

        // Penalize the agent
        if (task.assignedTo) {
            const penaltyAmount = this.calculatePenalty(task);
            this.trustEngine.penalize(task.assignedTo, penaltyAmount, `Failed task: ${task.title} - ${reason}`);
        }

        this.emit('task:failed', task, reason);

        // Persist state
        this.persistState();

        return task;
    }

    approveTask(taskId: string, approver: string): WorkflowTask | null {
        const task = this.tasks.get(taskId);
        if (!task || task.status !== 'PENDING_APPROVAL') return null;

        task.approvedBy = approver;
        task.status = 'QUEUED';

        this.emit('approval:granted', taskId, approver);

        // Persist state
        this.persistState();

        return task;
    }

    // -------------------------------------------------------------------------
    // Aggressiveness Slider
    // -------------------------------------------------------------------------

    setAggressiveness(level: number, tokenId: string): AggressivenessConfig {
        // Only human can change aggressiveness
        this.security.requireAuth(tokenId, 'HITL_MODIFY', 'SET_AGGRESSIVENESS');

        const oldLevel = this.aggressiveness.level;
        const newLevel = Math.max(0, Math.min(100, level));

        this.aggressiveness = {
            level: newLevel,
            autoApproveUpToTier: Math.floor(newLevel / 20) + 1,  // 0-20: T1, 21-40: T2, etc.
            maxDelegationDepth: Math.floor(newLevel / 25) + 2,   // 2-6 based on level
            trustRewardMultiplier: 1 + (newLevel / 100),          // 1.0 - 2.0
            trustPenaltyMultiplier: 2 - (newLevel / 100),         // 2.0 - 1.0 (stricter when conservative)
        };

        // Sync with HITL level (inverse relationship)
        this.trustEngine.setHITLLevel(100 - newLevel);

        this.security.logAudit({
            action: 'CONFIG_CHANGE',
            actor: { type: 'HUMAN', id: 'OPERATOR' },
            details: {
                setting: 'AGGRESSIVENESS',
                oldLevel,
                newLevel,
                newConfig: this.aggressiveness,
            },
            outcome: 'SUCCESS',
        });

        this.emit('aggressiveness:changed', oldLevel, newLevel);

        // Persist state
        this.persistState();

        return this.aggressiveness;
    }

    getAggressiveness(): AggressivenessConfig {
        return { ...this.aggressiveness };
    }

    // -------------------------------------------------------------------------
    // Completed Today Dashboard
    // -------------------------------------------------------------------------

    getCompletedToday(): CompletedTodaySummary {
        this.checkDayReset();

        const completed = this.completedToday.filter(t => t.status === 'COMPLETED');
        const failed = this.completedToday.filter(t => t.status === 'FAILED');
        const pending = Array.from(this.tasks.values()).filter(
            t => t.status === 'QUEUED' || t.status === 'PENDING_APPROVAL' || t.status === 'IN_PROGRESS'
        );

        // Calculate by agent
        const byAgent: Record<string, number> = {};
        completed.forEach(t => {
            if (t.assignedTo) {
                byAgent[t.assignedTo] = (byAgent[t.assignedTo] ?? 0) + 1;
            }
        });

        // Calculate by priority
        const byPriority: Record<string, number> = {};
        completed.forEach(t => {
            byPriority[t.priority] = (byPriority[t.priority] ?? 0) + 1;
        });

        // Average completion time
        const completionTimes = completed
            .filter(t => t.startedAt && t.completedAt)
            .map(t => t.completedAt!.getTime() - t.startedAt!.getTime());
        const avgCompletionTimeMs = completionTimes.length > 0
            ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length
            : 0;

        // Autonomy metrics
        const autoApproved = completed.filter(t => !t.approvalRequired).length;
        const humanApproved = completed.filter(t => t.approvalRequired && t.approvedBy).length;
        const humanRejected = failed.filter(t => t.approvalRequired).length;

        return {
            date: this.lastDayReset.toISOString().split('T')[0]!,
            totalCompleted: completed.length,
            totalFailed: failed.length,
            totalPending: pending.length,
            byAgent,
            byPriority,
            avgCompletionTimeMs: Math.round(avgCompletionTimeMs),
            trustChanges: {
                rewards: completed.length * 10 * this.aggressiveness.trustRewardMultiplier,
                penalties: failed.length * 15 * this.aggressiveness.trustPenaltyMultiplier,
                netChange: (completed.length * 10) - (failed.length * 15),
            },
            autonomyMetrics: {
                autoApproved,
                humanApproved,
                humanRejected,
            },
        };
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private requiresApproval(tier: number): boolean {
        return tier > this.aggressiveness.autoApproveUpToTier;
    }

    private calculateReward(task: WorkflowTask): number {
        const baseReward = 10;
        const priorityMultiplier = { LOW: 0.5, MEDIUM: 1, HIGH: 1.5, CRITICAL: 2 };
        return Math.floor(
            baseReward *
            priorityMultiplier[task.priority] *
            this.aggressiveness.trustRewardMultiplier
        );
    }

    private calculatePenalty(task: WorkflowTask): number {
        const basePenalty = 15;
        const priorityMultiplier = { LOW: 0.5, MEDIUM: 1, HIGH: 1.5, CRITICAL: 2 };
        return Math.floor(
            basePenalty *
            priorityMultiplier[task.priority] *
            this.aggressiveness.trustPenaltyMultiplier
        );
    }

    private checkDayReset(): void {
        const now = new Date();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);

        if (todayStart > this.lastDayReset) {
            // New day - archive old tasks
            this.completedToday = [];
            this.lastDayReset = todayStart;
        }
    }

    // -------------------------------------------------------------------------
    // Getters
    // -------------------------------------------------------------------------

    getTasks(): WorkflowTask[] {
        return Array.from(this.tasks.values());
    }

    getTask(id: string): WorkflowTask | undefined {
        return this.tasks.get(id);
    }

    getPendingApprovals(): WorkflowTask[] {
        return Array.from(this.tasks.values()).filter(t => t.status === 'PENDING_APPROVAL');
    }

    getSecurityLayer(): SecurityLayer {
        return this.security;
    }

    getTrustEngine(): TrustEngine {
        return this.trustEngine;
    }

    getBlackboard(): Blackboard {
        return this.blackboard;
    }

    logAudit(entry: Omit<AuditEntry, 'id' | 'timestamp'>): void {
        this.security.logAudit(entry);
    }
}

// ============================================================================
// Hono API Routes
// ============================================================================

export function createWorkflowAPI(engine: UnifiedWorkflowEngine, supabase: SupabasePersistence | null = null): Hono {
    const app = new Hono();

    // Security middleware stack
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
        // All local development ports
        '*', // Allow all for local dev to prevent CORS issues
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
        'http://localhost:3003',
        'http://localhost:3005',
        'http://localhost:5173',
        'http://localhost:5174',
        // Production
        'https://web-626.vercel.app',
        'https://web-banquetai.vercel.app',
        'https://*.vercel.app',
        'https://aurais-api.fly.dev',
    ];

    app.use('*', requestIdMiddleware());
    app.use('*', loggingMiddleware({
        skipPaths: ['/health', '/live', '/ready', '/favicon.ico'],
    }));
    app.use('*', corsMiddleware({ allowedOrigins }));
    app.use('*', securityHeadersMiddleware());
    app.use('*', rateLimitMiddleware({
        windowMs: 60000,     // 1 minute
        maxRequests: 1000,   // 1000 requests per minute (increased for dev/polling)
        skipPaths: ['/health', '/api/health'],
    }));

    // Google OAuth authentication (optional - sets user if token provided)
    app.use('*', googleAuthMiddleware({
        skipPaths: ['/health', '/api/health'],
        optional: true,  // Don't require auth, but validate if token provided
    }));

    // Health check routes (Kubernetes-compatible liveness/readiness probes)
    // FR56: Health check endpoints for liveness and readiness probes
    const healthRoutes = createHealthRoutes({
        supabase: supabase?.getClient(),
        getConnectionCount: () => engine.getTasks().filter(t => t.status === 'IN_PROGRESS').length,
        getActiveAgentCount: () => engine.getTasks().filter(t => t.assignedTo).length,
    });
    app.route('/', healthRoutes);  // Mount at root for /health, /ready, /live

    // -------------------------------------------------------------------------
    // Legacy API Compatibility Layer (/api/*)
    // Enables web UI to work with unified server on single port
    // -------------------------------------------------------------------------

    // Agent type for API responses
    type APIAgent = {
        id: string;
        structuredId?: string;  // 6-digit ID (TRCCII format)
        name: string;
        type: string;
        tier: number;
        status: string;
        location: { floor: string; room: string };
        trustScore: number;
        capabilities: string[];
        skills: string[];
        parentId: string | null;
        childIds: string[];
        createdAt: string;
    };

    // Demo agents for fallback when no Supabase
    // structuredId format: TRCCII (Tier, Role, Category, Instance)
    const demoAgents: APIAgent[] = [
        { id: 'exec-1', structuredId: '550001', name: 'T5-EXECUTOR', type: 'EXECUTOR', tier: 5, status: 'IDLE', location: { floor: 'EXECUTIVE', room: 'EXECUTOR_OFFICE' }, trustScore: 1000, capabilities: ['execution'], skills: [], parentId: null, childIds: [], createdAt: new Date().toISOString() },
        { id: 'plan-1', structuredId: '530001', name: 'T5-PLANNER', type: 'PLANNER', tier: 5, status: 'WORKING', location: { floor: 'EXECUTIVE', room: 'PLANNER_OFFICE' }, trustScore: 980, capabilities: ['strategy'], skills: [], parentId: null, childIds: [], createdAt: new Date().toISOString() },
        { id: 'valid-1', structuredId: '570001', name: 'T5-VALIDATOR', type: 'VALIDATOR', tier: 5, status: 'IDLE', location: { floor: 'EXECUTIVE', room: 'VALIDATOR_OFFICE' }, trustScore: 990, capabilities: ['audit'], skills: [], parentId: null, childIds: [], createdAt: new Date().toISOString() },
        { id: 'evolve-1', structuredId: '560001', name: 'T5-EVOLVER', type: 'EVOLVER', tier: 5, status: 'WORKING', location: { floor: 'EXECUTIVE', room: 'EVOLVER_OFFICE' }, trustScore: 970, capabilities: ['optimize'], skills: [], parentId: null, childIds: [], createdAt: new Date().toISOString() },
        { id: 'spawn-1', structuredId: '580001', name: 'T5-SPAWNER', type: 'SPAWNER', tier: 5, status: 'IDLE', location: { floor: 'EXECUTIVE', room: 'SPAWNER_OFFICE' }, trustScore: 985, capabilities: ['spawn'], skills: [], parentId: null, childIds: [], createdAt: new Date().toISOString() },
    ];

    // Structured ID generation for agents
    // Format: TRCCII where T=Tier, R=Role, CC=Category, II=Instance
    // Uses centralized TYPE_TO_ROLE and CAPABILITY_TO_CATEGORY from agentId.ts

    /**
     * Generate structured ID using centralized utilities from agentId.ts.
     * Now properly derives category from capabilities instead of hardcoding OPERATIONS.
     *
     * @param tier - Agent tier (0-8)
     * @param type - Agent type string
     * @param existingAgents - Existing agents for instance calculation
     * @param capabilities - Optional agent capabilities for category derivation
     */
    const generateStructuredId = (
        tier: number,
        type: string,
        existingAgents: Array<{ structuredId?: string; type: string; tier: number }>,
        capabilities: string[] = []
    ): string => {
        // Use centralized mappings from agentId.ts
        const role = getRoleFromType(type);
        const category = getCategoryFromCapabilities(capabilities);

        // Get existing structured IDs for instance calculation
        const existingIds = existingAgents
            .map(a => a.structuredId)
            .filter((id): id is string => !!id);

        const instance = getNextInstance(existingIds, tier, role, category);

        return generateAgentId(tier, role, category, instance);
    };

    // Helper to convert Supabase agent to API format
    const formatAgent = (a: SupabaseAgent): APIAgent => ({
        id: a.id,
        structuredId: (a as any).structured_id || undefined,
        name: a.name,
        type: a.type,
        tier: a.tier,
        status: a.status,
        location: { floor: a.floor, room: a.room },
        trustScore: a.trust_score,
        capabilities: a.capabilities,
        skills: a.skills,
        parentId: a.parent_id,
        childIds: [],
        createdAt: a.created_at,
    });

    // GET /api/state - Full system state (legacy format)
    app.get('/api/state', async (c) => {
        const trustStats = engine.getTrustEngine().getStats();
        const blackboard = engine.getBlackboard();

        // Get agents from Supabase or use demo
        let agents: APIAgent[] = demoAgents;
        let persistenceMode = 'file';
        if (supabase) {
            try {
                const dbAgents = await supabase.getAgents();
                if (dbAgents.length > 0) {
                    agents = dbAgents.map(formatAgent);
                }
                persistenceMode = 'supabase';
            } catch (e) {
                console.error('Supabase agents error:', e);
            }
        }

        return c.json({
            agents,
            blackboard: blackboard.getAllEntries().map((e: any) => ({
                id: e.id,
                type: e.type,
                title: e.title,
                content: e.content,
                author: e.author,
                priority: e.priority,
                status: e.status,
                createdAt: e.createdAt.toISOString(),
            })),
            hitlLevel: trustStats.hitlLevel,
            avgTrust: trustStats.avgTrust,
            day: 1,
            events: [],
            persistenceMode,
        });
    });

    // GET /api/tick - Trigger agent work loop with REAL task assignment
    app.get('/api/tick', async (c) => {
        const timestamp = new Date().toISOString();
        const events: string[] = [];

        // Advance global time service (wakes up T5-Planner)
        const tickResult = await timeService.tick();
        events.push(`⏰ Time Tick: ${tickResult}`);

        let assignedCount = 0;
        let completedCount = 0;

        // Get all tasks
        const allTasks = engine.getTasks();
        const queuedTasks = allTasks.filter((t: { status: string }) => t.status === 'QUEUED');
        const pendingApproval = allTasks.filter((t: { status: string }) => t.status === 'PENDING_APPROVAL');
        const inProgressTasks = allTasks.filter((t: { status: string }) => t.status === 'IN_PROGRESS');
        const completedTasks = allTasks.filter((t: { status: string }) => t.status === 'COMPLETED');

        // Get agents (from supabase or demo) - use flexible type for both sources
        type TickAgent = { id: string; name: string; type: string; tier: number; status: string };
        let agents: TickAgent[] = [];
        if (supabase) {
            try {
                const dbAgents = await supabase.getAgents();
                agents = dbAgents.length > 0 ? dbAgents : demoAgents;
            } catch {
                agents = demoAgents;
            }
        } else {
            agents = demoAgents;
        }

        // Find IDLE agents available for work
        const idleAgents = agents.filter(a => a.status === 'IDLE' && a.tier >= 2);

        // Sort tasks by priority (HIGH > MEDIUM > LOW)
        const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
        const sortedTasks = [...queuedTasks].sort((a, b) =>
            (priorityOrder[a.priority as keyof typeof priorityOrder] || 1) -
            (priorityOrder[b.priority as keyof typeof priorityOrder] || 1)
        );

        // ---------------------------------------------------------------------
        // 1. Process System Decisions (e.g. Auto-Spawn from T5-Planner)`
        // ---------------------------------------------------------------------
        const spawnDecisions = engine.getBlackboard().getByType('DECISION').filter(d => 
             d.status === 'OPEN' && (d.content as any)?.action === 'SPAWN_AGENT'
        );

        for (const decision of spawnDecisions) {
            const content = decision.content as any;
            const name = `Worker-${content.suggestedType}-${Math.floor(Math.random()*1000)}`;
             
            // Perform the spawn
            if (supabase) {
                try {
                     await supabase.createAgent({
                        id: uuidv4(),
                        name: name,
                        type: content.suggestedType || 'WORKER',
                        tier: content.suggestedTier || 2,
                        status: 'IDLE',
                        trust_score: 100,
                        capabilities: ['general_task_execution'],
                        skills: [],
                        floor: 'OPERATIONS',
                        room: 'GENERAL_WORKSPACE',
                        parent_id: null
                    });
                    events.push(`✨ System auto-spawned ${name} based on planner request`);
                } catch (e) {
                    console.error('Auto-spawn failed:', e);
                }
            } else {
                 // Demo mode spawn
                 agents.push({
                    id: uuidv4(),
                    name: name,
                    type: content.suggestedType || 'WORKER',
                    tier: content.suggestedTier || 2,
                    status: 'IDLE'
                 });
                 events.push(`✨ [DEMO] System auto-spawned ${name}`);
            }

            // Resolve the decision
            engine.getBlackboard().resolve(decision.id, {
                resolution: 'SPAWNED',
                resolvedBy: 'SYSTEM_AUTOSCALER'
            });
        }


        // ---------------------------------------------------------------------
        // 2. Assign Tasks
        // ---------------------------------------------------------------------
        const assignments: Array<{ taskId: string; taskTitle: string; agentId: string; agentName: string }> = [];

        for (const task of sortedTasks) {
            if (idleAgents.length === 0) break;

            // Find best matching agent
            // Logic: Must meet Tier requirement. 
            // Prefer: specific role match > any role
            
            let agentIndex = -1;
            
            // Try specific match first
            agentIndex = idleAgents.findIndex(a =>
                a.tier >= (task.requiredTier || 2) &&
                (a.type === 'WORKER' || a.type === 'ANALYST' || a.type === 'EXECUTOR')
            );
            
            // Fallback: Any agent of sufficient tier (Universal Assignment)
            if (agentIndex === -1) {
                 agentIndex = idleAgents.findIndex(a => a.tier >= (task.requiredTier || 2));
            }

            if (agentIndex !== -1) {
                const agent = idleAgents[agentIndex];
                if (!agent) continue;

                // Assign the task
                task.assignedTo = agent.id;
                task.status = 'IN_PROGRESS';
                task.startedAt = new Date();

                // Update agent status
                agent.status = 'WORKING';
                if (supabase) {
                    await supabase.updateAgent(agent.id, { status: 'WORKING' });
                }

                assignments.push({
                    taskId: task.id,
                    taskTitle: task.title,
                    agentId: agent.id,
                    agentName: agent.name,
                });

                events.push(`📋 Assigned "${task.title}" to ${agent.name}`);
                assignedCount++;

                // Remove agent from idle pool
                idleAgents.splice(agentIndex, 1);
            }
        }

        // ---------------------------------------------------------------------
        // 3. Simulate Work Progress
        // ---------------------------------------------------------------------
        for (const task of inProgressTasks) {
            // 30% chance of completing on each tick (for demo purposes)
            if (Math.random() < 0.3) {
                task.status = 'COMPLETED';
                task.completedAt = new Date();
                completedCount++;

                // Free up the agent
                if (task.assignedTo) {
                    const agent = agents.find(a => a.id === task.assignedTo);
                    if (agent) {
                        agent.status = 'IDLE';
                        if (supabase) {
                            await supabase.updateAgent(agent.id, { status: 'IDLE' });
                        }
                        events.push(`✅ ${agent.name} completed "${task.title}"`);
                    }
                }
            }
        }

        // Get trust stats
        const trustStats = engine.getTrustEngine().getStats();

        // Build detailed pending summary
        const pendingSummary = {
            queued: queuedTasks.length - assignedCount,
            awaitingApproval: pendingApproval.length,
            inProgress: inProgressTasks.length + assignedCount - completedCount,
            items: [
                ...pendingApproval.map(t => ({ id: t.id, title: t.title, status: 'PENDING_APPROVAL', reason: 'Requires human approval' })),
                ...queuedTasks.filter(t => t.status === 'QUEUED').map(t => ({ id: t.id, title: t.title, status: 'QUEUED', reason: 'Waiting for available agent' })),
            ],
        };

        return c.json({
            success: true,
            tick: Date.now(),
            timestamp,
            processed: inProgressTasks.length,
            assigned: assignedCount,
            completed: completedCount,
            queue: {
                pending: queuedTasks.length - assignedCount,
                inProgress: inProgressTasks.length + assignedCount - completedCount,
                awaitingApproval: pendingApproval.length,
                totalTasks: allTasks.length,
            },
            assignments,
            pendingSummary,
            trustSystem: {
                avgTrust: trustStats.avgTrust,
                agentsByTier: trustStats.byLevel,
            },
            events,
            idleAgentsAvailable: idleAgents.length,
        });
    });

    // GET /api/agents - List all agents
    app.get('/api/agents', async (c) => {
        if (supabase) {
            try {
                const dbAgents = await supabase.getAgents();
                if (dbAgents.length > 0) {
                    return c.json(dbAgents.map(formatAgent));
                }
            } catch (e) {
                console.error('Supabase agents error:', e);
            }
        }
        return c.json(demoAgents);
    });

    // DELETE /api/agents/:id - Archive and remove an agent
    app.delete('/api/agents/:id', async (c) => {
        const agentId = c.req.param('id');

        if (supabase) {
            try {
                // Get agent name for response message
                const agent = await supabase.getAgent(agentId);
                if (!agent) {
                    return c.json({ error: 'Agent not found' }, 404);
                }

                // Use the deleteAgent method which handles archiving
                const result = await supabase.deleteAgent(agentId, '9901');

                return c.json({
                    success: result.success,
                    message: `Agent ${agent.name} has been archived and removed`,
                    archived: result.archived,
                    agentId,
                });
            } catch (e) {
                console.error('Supabase delete error:', e);
                return c.json({ error: (e as Error).message }, 500);
            }
        }

        // Fallback for demo mode - just remove from demo array
        const idx = demoAgents.findIndex(a => a.id === agentId);
        if (idx === -1) {
            return c.json({ error: 'Agent not found' }, 404);
        }
        const removed = demoAgents.splice(idx, 1);
        const removedAgent = removed[0];
        return c.json({
            success: true,
            message: `Agent ${removedAgent?.name || 'Unknown'} removed (demo mode - not archived)`,
            archived: false,
            agentId,
        });
    });

    // POST /api/spawn - Spawn a new agent
    app.post('/api/spawn', async (c) => {
        const body = await c.req.json<{
            name: string;
            type: string;
            tier: number;
            capabilities?: string[];
            skills?: string[];
        }>();

        // Capabilities now affect structured ID category derivation
        const capabilities = body.capabilities || [];
        const skills = body.skills || [];

        if (supabase) {
            try {
                // Get existing agents to generate structured ID
                const existingAgents = await supabase.getAgents();
                // Pass capabilities for proper category derivation
                const structuredId = generateStructuredId(body.tier, body.type, existingAgents, capabilities);

                const agent = await supabase.createAgent({
                    id: uuidv4(),
                    name: body.name,
                    type: body.type,
                    tier: body.tier,
                    status: 'IDLE',
                    trust_score: body.tier * 150 + 100,
                    floor: body.tier >= 4 ? 'EXECUTIVE' : 'OPERATIONS',
                    room: 'SPAWN_BAY',
                    capabilities,
                    skills,
                    parent_id: null,
                });

                // Add structured ID to the formatted response
                const formattedAgent = formatAgent(agent);
                formattedAgent.structuredId = structuredId;

                return c.json({ success: true, agent: formattedAgent });
            } catch (e) {
                console.error('Supabase spawn error:', e);
                return c.json({ error: (e as Error).message }, 500);
            }
        }

        // Fallback to demo response with structured ID
        // Pass capabilities for proper category derivation
        const structuredId = generateStructuredId(body.tier, body.type, demoAgents, capabilities);
        const newAgent: APIAgent = {
            id: uuidv4(),
            structuredId,
            name: body.name,
            type: body.type,
            tier: body.tier,
            status: 'IDLE',
            location: { floor: body.tier >= 4 ? 'EXECUTIVE' : 'OPERATIONS', room: 'SPAWN_BAY' },
            trustScore: body.tier * 150 + 100,
            capabilities,
            skills,
            parentId: null,
            childIds: [],
            createdAt: new Date().toISOString(),
        };
        demoAgents.push(newAgent);
        return c.json({ success: true, agent: newAgent });
    });

    // -------------------------------------------------------------------------
    // Agent Control Endpoints
    // -------------------------------------------------------------------------

    // POST /api/agent/pause - Pause an agent
    app.post('/api/agent/pause', async (c) => {
        const body = await c.req.json<{ agentId: string }>();
        const agentId = body.agentId;

        if (supabase) {
            try {
                await supabase.updateAgent(agentId, { status: 'IDLE' });
                return c.json({ success: true, status: 'PAUSED', agentId });
            } catch (e) {
                console.error('Supabase pause error:', e);
                return c.json({ error: (e as Error).message }, 500);
            }
        }

        // Demo mode fallback
        const agent = demoAgents.find(a => a.id === agentId);
        if (agent) {
            agent.status = 'IDLE';
            return c.json({ success: true, status: 'PAUSED', agentId });
        }
        return c.json({ error: 'Agent not found' }, 404);
    });

    // POST /api/agent/resume - Resume an agent (and trigger tick)
    app.post('/api/agent/resume', async (c) => {
        const body = await c.req.json<{ agentId: string }>();
        const agentId = body.agentId;

        if (supabase) {
            try {
                await supabase.updateAgent(agentId, { status: 'WORKING' });
                return c.json({ success: true, status: 'WORKING', agentId });
            } catch (e) {
                console.error('Supabase resume error:', e);
                return c.json({ error: (e as Error).message }, 500);
            }
        }

        // Demo mode fallback
        const agent = demoAgents.find(a => a.id === agentId);
        if (agent) {
            agent.status = 'WORKING';
            return c.json({ success: true, status: 'WORKING', agentId });
        }
        return c.json({ error: 'Agent not found' }, 404);
    });

    // POST /api/agent/tick - Tick a specific agent (trigger work cycle)
    app.post('/api/agent/tick', async (c) => {
        const body = await c.req.json<{ agentId: string }>();
        const agentId = body.agentId;

        // Find the agent
        let agentName = 'Unknown';
        if (supabase) {
            try {
                const agent = await supabase.getAgent(agentId);
                if (agent) {
                    agentName = agent.name;
                    // Update status to WORKING if IDLE
                    if (agent.status === 'IDLE') {
                        await supabase.updateAgent(agentId, { status: 'WORKING' });
                    }
                }
            } catch (e) {
                console.error('Supabase tick error:', e);
            }
        } else {
            const agent = demoAgents.find(a => a.id === agentId);
            if (agent) {
                agentName = agent.name;
                if (agent.status === 'IDLE') {
                    agent.status = 'WORKING';
                }
            }
        }

        // Simulate processing a task
        return c.json({
            success: true,
            agentId,
            agentName,
            processed: true,
            result: `Agent ${agentName} processed tick cycle`,
            timestamp: new Date().toISOString(),
        });
    });

    // POST /api/agent/trust - Adjust agent trust score
    app.post('/api/agent/trust', async (c) => {
        const body = await c.req.json<{ agentId: string; delta: number; reason: string }>();
        const { agentId, delta, reason } = body;

        if (supabase) {
            try {
                const agent = await supabase.getAgent(agentId);
                if (!agent) {
                    return c.json({ error: 'Agent not found' }, 404);
                }

                const newScore = Math.max(0, Math.min(1000, agent.trust_score + delta));
                const newTier = newScore >= 950 ? 5 : newScore >= 800 ? 4 : newScore >= 600 ? 3 : newScore >= 400 ? 2 : newScore >= 200 ? 1 : 0;

                await supabase.updateAgent(agentId, { trust_score: newScore, tier: newTier });

                // Log the trust change
                engine.logAudit({
                    action: delta > 0 ? 'TRUST_REWARD' : 'TRUST_PENALIZE',
                    actor: { type: 'HUMAN', id: 'OPERATOR' },
                    outcome: 'SUCCESS',
                    details: {
                        agentId,
                        agentName: agent.name,
                        delta,
                        reason,
                        oldScore: agent.trust_score,
                        newScore,
                        newTier,
                    },
                });

                return c.json({ success: true, newScore, newTier, agentId });
            } catch (e) {
                console.error('Supabase trust adjust error:', e);
                return c.json({ error: (e as Error).message }, 500);
            }
        }

        // Demo mode fallback
        const agent = demoAgents.find(a => a.id === agentId);
        if (agent) {
            const newScore = Math.max(0, Math.min(1000, agent.trustScore + delta));
            const newTier = newScore >= 950 ? 5 : newScore >= 800 ? 4 : newScore >= 600 ? 3 : newScore >= 400 ? 2 : newScore >= 200 ? 1 : 0;
            agent.trustScore = newScore;
            agent.tier = newTier;
            return c.json({ success: true, newScore, newTier, agentId });
        }
        return c.json({ error: 'Agent not found' }, 404);
    });

    // In-memory task storage for demo mode
    const agentTasksMap = new Map<string, Array<{
        id: string;
        title: string;
        description?: string;
        priority: string;
        status: string;
        createdAt: string;
        progress?: number;
        assignedBy?: string;
    }>>();

    // GET /api/agent/:id/tasks - Get agent's task queue
    app.get('/api/agent/:id/tasks', async (c) => {
        const agentId = c.req.param('id');

        // Get from in-memory store or create empty list
        let tasks = agentTasksMap.get(agentId) || [];

        return c.json({ tasks, agentId });
    });

    // POST /api/agent/:id/tasks - Manage agent tasks (add, update, delete)
    app.post('/api/agent/:id/tasks', async (c) => {
        const agentId = c.req.param('id');
        const body = await c.req.json<{
            action: 'add' | 'update' | 'delete';
            taskId?: string;
            title?: string;
            description?: string;
            priority?: string;
            status?: string;
            progress?: number;
        }>();

        // Get or create task list
        let tasks = agentTasksMap.get(agentId) || [];

        switch (body.action) {
            case 'add': {
                const newTask = {
                    id: `task-${Date.now()}`,
                    title: body.title || 'Untitled Task',
                    description: body.description,
                    priority: body.priority || 'medium',
                    status: 'pending',
                    createdAt: new Date().toISOString(),
                    assignedBy: 'HITL-9901',
                };
                tasks.unshift(newTask);
                agentTasksMap.set(agentId, tasks);
                return c.json({ success: true, task: newTask });
            }

            case 'update': {
                const taskIdx = tasks.findIndex(t => t.id === body.taskId);
                if (taskIdx === -1) {
                    return c.json({ error: 'Task not found' }, 404);
                }
                const task = tasks[taskIdx]!;
                if (body.status) task.status = body.status;
                if (body.progress !== undefined) task.progress = body.progress;
                agentTasksMap.set(agentId, tasks);
                return c.json({ success: true, task });
            }

            case 'delete': {
                tasks = tasks.filter(t => t.id !== body.taskId);
                agentTasksMap.set(agentId, tasks);
                return c.json({ success: true });
            }

            default:
                return c.json({ error: 'Invalid action' }, 400);
        }
    });

    // POST /api/command - Send command to agent
    app.post('/api/command', async (c) => {
        const body = await c.req.json<{
            target: string;
            command: string;
            agent?: { name: string; type: string; status: string; trustScore: number };
        }>();

        const agentName = body.agent?.name || 'Agent';
        const command = body.command.toLowerCase().trim();

        // Generate context-aware response
        let response = '';
        if (command === 'status') {
            response = `${agentName} is ${body.agent?.status || 'IDLE'}. Trust score: ${body.agent?.trustScore || 0}`;
        } else if (command === 'report') {
            response = `Activity Report for ${agentName}:\n- Status: ${body.agent?.status}\n- Trust: ${body.agent?.trustScore}\n- Type: ${body.agent?.type}`;
        } else if (command === 'help') {
            response = 'Available commands: status, report, pause, resume, prioritize <task>, collaborate <agent>';
        } else {
            response = `Command "${body.command}" received by ${agentName}. Processing...`;
        }

        return c.json({
            success: true,
            command: body.command,
            response,
            agentType: body.agent?.type || 'WORKER',
            timestamp: new Date().toISOString(),
        });
    });

    // GET /api/stats - Quick stats
    app.get('/api/stats', (c) => {
        const trustStats = engine.getTrustEngine().getStats();
        return c.json({
            hitlLevel: trustStats.hitlLevel,
            avgTrust: trustStats.avgTrust,
            agentCount: demoAgents.length,
            day: 1,
        });
    });

    // GET /api/uptime - Server uptime
    const serverStartTime = Date.now();
    app.get('/api/uptime', (c) => {
        const uptime = Math.floor((Date.now() - serverStartTime) / 1000);
        return c.json({
            uptime,
            formatted: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
            startTimeISO: new Date(serverStartTime).toISOString(),
        });
    });

    // GET /api/blackboard - Blackboard entries
    app.get('/api/blackboard', (c) => {
        const blackboard = engine.getBlackboard();
        return c.json(blackboard.getAllEntries().map((e: any) => ({
            id: e.id,
            type: e.type,
            title: e.title,
            content: e.content,
            author: e.author,
            priority: e.priority,
            status: e.status,
            createdAt: e.createdAt.toISOString(),
        })));
    });

    // POST /api/hitl - Set HITL level
    app.post('/api/hitl', async (c) => {
        const body = await c.req.json<{ level: number }>();
        engine.getTrustEngine().setHITLLevel(body.level);
        return c.json({ success: true, hitlLevel: body.level });
    });

    // GET /api/approvals - Pending approvals (legacy format)
    app.get('/api/approvals', (c) => c.json([]));

    // POST /api/tasks - Create task (legacy format for Console compatibility)
    app.post('/api/tasks', async (c) => {
        const body = await c.req.json<{
            action?: string;
            description: string;
            creator?: string;
            priority?: string;
            title?: string;
        }>();

        // Support both legacy format (description, creator) and new format (title, description)
        const title = body.title || body.description.slice(0, 100);
        const description = body.description;
        const priority = (body.priority?.toUpperCase() || 'MEDIUM') as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

        const task = engine.createTask({ title, description, priority });

        return c.json({
            success: true,
            task: {
                id: task.id,
                title: task.title,
                description: task.description,
                status: task.status,
                priority: task.priority,
                createdAt: task.createdAt.toISOString(),
            },
            message: `Task "${task.title}" created successfully`,
        });
    });

    // GET /api/settings - System settings
    app.get('/api/settings', (c) => c.json({}));

    // POST /api/settings - Update settings
    app.post('/api/settings', (c) => c.json({ success: true }));

    // -------------------------------------------------------------------------
    // Dashboard Endpoints
    // -------------------------------------------------------------------------

    // GET /dashboard/today - Completed today summary
    app.get('/dashboard/today', (c) => {
        return c.json(engine.getCompletedToday());
    });

    // GET /dashboard/aggressiveness - Current aggressiveness config
    app.get('/dashboard/aggressiveness', (c) => {
        return c.json(engine.getAggressiveness());
    });

    // POST /dashboard/aggressiveness - Set aggressiveness level
    app.post('/dashboard/aggressiveness', async (c) => {
        const body = await c.req.json<{ level: number; tokenId: string }>();
        try {
            const config = engine.setAggressiveness(body.level, body.tokenId);
            return c.json(config);
        } catch (error) {
            return c.json({ error: (error as Error).message }, 403);
        }
    });

    // -------------------------------------------------------------------------
    // Task Endpoints
    // -------------------------------------------------------------------------

    // GET /tasks - List all tasks
    app.get('/tasks', (c) => {
        return c.json(engine.getTasks());
    });

    // GET /tasks/:id - Get single task
    app.get('/tasks/:id', (c) => {
        const task = engine.getTask(c.req.param('id'));
        if (!task) return c.json({ error: 'Task not found' }, 404);
        return c.json(task);
    });

    // POST /tasks - Create new task
    app.post('/tasks', async (c) => {
        const body = await c.req.json<{
            title: string;
            description: string;
            priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
            requiredTier?: number;
        }>();
        const task = engine.createTask(body);
        return c.json(task, 201);
    });

    // POST /tasks/:id/assign - Assign task to agent
    app.post('/tasks/:id/assign', async (c) => {
        const body = await c.req.json<{ agentId: string; tokenId: string }>();
        try {
            const task = engine.assignTask(c.req.param('id'), body.agentId, body.tokenId);
            if (!task) return c.json({ error: 'Task not found' }, 404);
            return c.json(task);
        } catch (error) {
            return c.json({ error: (error as Error).message }, 403);
        }
    });

    // POST /tasks/:id/complete - Mark task complete
    app.post('/tasks/:id/complete', async (c) => {
        const body = await c.req.json<{ result: unknown; tokenId: string }>();
        try {
            const task = engine.completeTask(c.req.param('id'), body.result, body.tokenId);
            if (!task) return c.json({ error: 'Task not found' }, 404);
            return c.json(task);
        } catch (error) {
            return c.json({ error: (error as Error).message }, 403);
        }
    });

    // POST /tasks/:id/fail - Mark task failed
    app.post('/tasks/:id/fail', async (c) => {
        const body = await c.req.json<{ reason: string; tokenId: string }>();
        try {
            const task = engine.failTask(c.req.param('id'), body.reason, body.tokenId);
            if (!task) return c.json({ error: 'Task not found' }, 404);
            return c.json(task);
        } catch (error) {
            return c.json({ error: (error as Error).message }, 403);
        }
    });

    // POST /tasks/:id/delegate - Delegate task to another agent
    app.post('/tasks/:id/delegate', async (c) => {
        const body = await c.req.json<{ fromAgentId: string; toAgentId: string; reason?: string; tokenId: string }>();
        try {
            const task = engine.getTask(c.req.param('id'));
            if (!task) return c.json({ error: 'Task not found' }, 404);

            const config = engine.getAggressiveness();
            if (task.delegationCount >= config.maxDelegationDepth) {
                return c.json({ error: `Max delegation depth (${config.maxDelegationDepth}) reached` }, 400);
            }

            // Update task with new assignee and increment delegation count
            task.assignedTo = body.toAgentId;
            task.delegationCount++;

            // Log delegation
            engine.logAudit({
                action: 'TASK_DELEGATED',
                actor: { type: 'AGENT', id: body.fromAgentId },
                outcome: 'SUCCESS',
                details: {
                    taskId: task.id,
                    fromAgent: body.fromAgentId,
                    toAgent: body.toAgentId,
                    reason: body.reason || 'No reason provided',
                    delegationNumber: task.delegationCount,
                },
            });

            return c.json({
                success: true,
                task: {
                    id: task.id,
                    status: task.status,
                    assignee: task.assignedTo,
                    delegationCount: task.delegationCount,
                    remainingDelegations: config.maxDelegationDepth - task.delegationCount,
                    canDelegateAgain: task.delegationCount < config.maxDelegationDepth,
                },
                message: `Task delegated from ${body.fromAgentId} to ${body.toAgentId}`,
            });
        } catch (error) {
            return c.json({ error: (error as Error).message }, 403);
        }
    });

    // GET /delegate - Get delegation rules
    app.get('/delegate', (c) => {
        const config = engine.getAggressiveness();
        return c.json({
            rules: {
                maxDelegations: config.maxDelegationDepth,
                minTierToDelegate: 'T3',
                penalties: { excessiveDelegation: -20, delegationToUnqualified: -50 },
            },
            tiers: [
                { level: 5, name: 'ELITE', threshold: 950, canDelegate: true },
                { level: 4, name: 'CERTIFIED', threshold: 800, canDelegate: true },
                { level: 3, name: 'VERIFIED', threshold: 600, canDelegate: true },
                { level: 2, name: 'TRUSTED', threshold: 400, canDelegate: false },
                { level: 1, name: 'PROBATIONARY', threshold: 200, canDelegate: false },
                { level: 0, name: 'UNTRUSTED', threshold: 0, canDelegate: false },
            ],
        });
    });

    // -------------------------------------------------------------------------
    // Approval Endpoints
    // -------------------------------------------------------------------------

    // GET /approvals - List pending approvals
    app.get('/approvals', (c) => {
        return c.json(engine.getPendingApprovals());
    });

    // POST /approvals/:id - Approve/reject task
    app.post('/approvals/:id', async (c) => {
        const body = await c.req.json<{ approve: boolean; tokenId: string }>();
        const security = engine.getSecurityLayer();

        try {
            security.requireAuth(body.tokenId, 'HITL_MODIFY', 'APPROVE_TASK');

            if (body.approve) {
                const task = engine.approveTask(c.req.param('id'), 'HUMAN_OPERATOR');
                if (!task) return c.json({ error: 'Task not found or not pending' }, 404);
                return c.json(task);
            } else {
                const task = engine.failTask(c.req.param('id'), 'Rejected by human operator', body.tokenId);
                if (!task) return c.json({ error: 'Task not found' }, 404);
                return c.json(task);
            }
        } catch (error) {
            return c.json({ error: (error as Error).message }, 403);
        }
    });

    // -------------------------------------------------------------------------
    // Trust & Security Endpoints
    // -------------------------------------------------------------------------

    // GET /trust/stats - Trust statistics
    app.get('/trust/stats', (c) => {
        return c.json(engine.getTrustEngine().getStats());
    });

    // GET /security/audit - Audit log
    app.get('/security/audit', async (c) => {
        const security = engine.getSecurityLayer();
        const limit = parseInt(c.req.query('limit') ?? '50');
        return c.json(security.getAuditLog({ limit }));
    });

    // POST /auth/human - Issue human token
    app.post('/auth/human', async (c) => {
        const body = await c.req.json<{ masterKey: string }>();
        const security = engine.getSecurityLayer();
        try {
            const token = security.issueHumanToken(body.masterKey);
            return c.json({ tokenId: token.id, expiresAt: token.expiresAt });
        } catch (error) {
            return c.json({ error: 'Invalid master key' }, 401);
        }
    });

    // -------------------------------------------------------------------------
    // TRUST-5.1: Trust Component Endpoints
    // -------------------------------------------------------------------------

    // GET /trust/:agentId/components - Get trust component breakdown
    app.get('/trust/:agentId/components', (c) => {
        const agentId = c.req.param('agentId') as AgentId;
        const trustEngine = engine.getTrustEngine();

        const trust = trustEngine.getTrust(agentId);
        if (!trust) {
            return c.json({ error: 'Agent not found' }, 404);
        }

        const enhanced = trustEngine.getEnhancedTrust(agentId);

        if (enhanced) {
            return c.json({
                agentId,
                finalScore: enhanced.ficoScore,
                tier: enhanced.level,
                components: enhanced.components,
                trend: enhanced.ficoScore > trust.numeric ? 'rising' :
                       enhanced.ficoScore < trust.numeric ? 'falling' : 'stable',
                lastUpdated: enhanced.lastCalculated.toISOString(),
            });
        }

        // Fallback for legacy scoring
        return c.json({
            agentId,
            finalScore: trust.numeric,
            tier: trust.level,
            components: null,
            trend: 'stable',
            lastUpdated: trust.lastVerified.toISOString(),
        });
    });

    // GET /trust/:agentId/history - Get trust score history
    app.get('/trust/:agentId/history', (c) => {
        const agentId = c.req.param('agentId') as AgentId;
        const days = parseInt(c.req.query('days') ?? '30');
        const trustEngine = engine.getTrustEngine();

        const trust = trustEngine.getTrust(agentId);
        if (!trust) {
            return c.json({ error: 'Agent not found' }, 404);
        }

        // For now, return current snapshot (history would require persistence)
        // In production, this would query stored historical data
        return c.json([{
            date: new Date().toISOString().split('T')[0],
            score: trust.numeric,
            level: trust.level,
            earned: trust.earned,
            penalties: trust.penalties,
        }]);
    });

    // -------------------------------------------------------------------------
    // TRUST-5.2: Audit Verification Endpoints
    // -------------------------------------------------------------------------

    // Cryptographic audit logger instance
    const auditLogger = new CryptographicAuditLogger();

    // GET /audit/verify - Verify audit chain integrity
    app.get('/audit/verify', async (c) => {
        const start = c.req.query('start') ? parseInt(c.req.query('start')!) : undefined;
        const end = c.req.query('end') ? parseInt(c.req.query('end')!) : undefined;

        const status = await auditLogger.verifyChain({ startSequence: start, endSequence: end });

        return c.json({
            isValid: status.isValid,
            lastVerified: new Date().toISOString(),
            entriesVerified: status.entriesVerified,
            brokenAt: status.brokenAt,
            error: status.error,
        });
    });

    // GET /audit/export - Export audit log
    app.get('/audit/export', async (c) => {
        const startDate = c.req.query('startDate');
        const endDate = c.req.query('endDate');
        const format = c.req.query('format') ?? 'json';

        // Get all entries and filter by date if specified
        let entries: CryptographicAuditEntry[] = auditLogger.getAllEntries();

        if (startDate) {
            const start = new Date(startDate);
            entries = entries.filter(e => e.timestamp >= start);
        }
        if (endDate) {
            const end = new Date(endDate);
            entries = entries.filter(e => e.timestamp <= end);
        }

        // Verify chain for export
        const verification = await auditLogger.verifyChain();

        if (format === 'csv') {
            const headers = 'timestamp,action,actorType,actorId,outcome,hash\n';
            const rows = entries.map(e =>
                `${e.timestamp.toISOString()},${e.action},${e.actor.type},${e.actor.id},${e.outcome},${e.entryHash}`
            ).join('\n');

            c.header('Content-Type', 'text/csv');
            c.header('Content-Disposition', 'attachment; filename="audit-export.csv"');
            return c.body(headers + rows);
        }

        return c.json({
            exported: new Date().toISOString(),
            chainValid: verification.isValid,
            entriesCount: entries.length,
            entries: entries.map(e => ({
                id: e.id,
                timestamp: e.timestamp.toISOString(),
                action: e.action,
                actor: e.actor,
                target: e.target,
                outcome: e.outcome,
                hash: e.entryHash,
            })),
        });
    });

    // -------------------------------------------------------------------------
    // TRUST-5.3: Council Endpoints
    // -------------------------------------------------------------------------

    // Council service and member registry instances
    const memberRegistry = new CouncilMemberRegistry();
    const councilService = new CouncilService(memberRegistry);

    // GET /council/reviews - List pending reviews
    app.get('/council/reviews', (c) => {
        const reviews = councilService.getPendingReviews();
        return c.json(reviews.map(r => ({
            id: r.id,
            type: r.requestType,
            requesterId: r.requesterId,
            status: r.status,
            createdAt: r.createdAt.toISOString(),
            expiresAt: r.expiresAt.toISOString(),
            votesReceived: r.votes.size,
            requiredVotes: r.requiredVotes,
            priority: r.priority,
        })));
    });

    // GET /council/reviews/:id - Get review details
    app.get('/council/reviews/:id', (c) => {
        const reviewId = c.req.param('id');
        const review = councilService.getReview(reviewId);

        if (!review) {
            return c.json({ error: 'Review not found' }, 404);
        }

        // Convert votes Map to array
        const votesArray = Array.from(review.votes.entries()).map(([agentId, v]) => ({
            agentId,
            vote: v.vote,
            reasoning: v.reasoning,
            confidence: v.confidence,
            timestamp: v.timestamp.toISOString(),
        }));

        return c.json({
            id: review.id,
            type: review.requestType,
            requesterId: review.requesterId,
            status: review.status,
            context: review.context,
            createdAt: review.createdAt.toISOString(),
            expiresAt: review.expiresAt.toISOString(),
            votes: votesArray,
            outcome: review.outcome,
            requiredVotes: review.requiredVotes,
            priority: review.priority,
            reviewers: review.reviewers.map(r => r.agentId),
        });
    });

    // POST /council/reviews/:id/vote - Submit vote
    app.post('/council/reviews/:id/vote', async (c) => {
        const reviewId = c.req.param('id');
        const body = await c.req.json<{
            agentId: string;
            vote: 'approve' | 'reject' | 'abstain';
            reasoning: string;
            confidence: number;
        }>();

        try {
            const review = await councilService.submitVote({
                reviewId,
                voterId: body.agentId as AgentId,
                vote: body.vote,
                reasoning: body.reasoning,
                confidence: body.confidence,
            });

            return c.json({
                success: true,
                reviewId: review.id,
                status: review.status,
                outcome: review.outcome,
                votesReceived: review.votes.size,
            });
        } catch (error) {
            return c.json({ error: (error as Error).message }, 400);
        }
    });

    // GET /council/members - List council members
    app.get('/council/members', (c) => {
        const members = memberRegistry.getMembers();
        return c.json(members.map(m => ({
            agentId: m.agentId,
            tier: m.tier,
            specialization: m.specialization,
            joinedAt: m.joinedAt.toISOString(),
            activeReviews: m.activeReviews,
            totalVotes: m.totalVotes,
            agreementRate: m.agreementRate,
        })));
    });

    // -------------------------------------------------------------------------
    // TRUST-5.4: Delegation & Budget Endpoints
    // -------------------------------------------------------------------------

    // Delegation manager and autonomy budget instances
    const delegationManager = new DelegationManager();
    const autonomyBudget = new AutonomyBudgetService();

    // POST /delegation/request - Create delegation request
    app.post('/delegation/request', async (c) => {
        const body = await c.req.json<{
            agentId: string;
            capabilities: string[];
            reason: string;
            duration: number;
        }>();

        try {
            const request = await delegationManager.requestCapabilities({
                agentId: body.agentId as AgentId,
                capabilities: body.capabilities as Permission[],
                reason: body.reason,
                duration: body.duration,
            });

            return c.json({
                id: request.id,
                status: request.status,
                capabilities: request.requestedCapabilities,
                duration: request.duration,
                approvedBy: request.approvedBy,
                expiresAt: request.expiresAt?.toISOString(),
                autoApproved: request.approvedBy === 'AUTO',
            });
        } catch (error) {
            return c.json({ error: (error as Error).message }, 400);
        }
    });

    // GET /delegation/:agentId/active - List active delegations
    app.get('/delegation/:agentId/active', (c) => {
        const agentId = c.req.param('agentId') as AgentId;
        const delegations = delegationManager.getActiveDelegations(agentId);

        return c.json(delegations.map(d => ({
            id: d.id,
            capabilities: d.capabilities,
            grantedAt: d.grantedAt.toISOString(),
            expiresAt: d.expiresAt.toISOString(),
            reason: d.reason,
            approvedBy: d.approvedBy,
            usageCount: d.usageCount,
        })));
    });

    // DELETE /delegation/:id - Revoke delegation (human only)
    app.delete('/delegation/:id', async (c) => {
        const delegationId = c.req.param('id');
        const body = await c.req.json<{ reason: string; tokenId: string }>();

        try {
            // Verify human auth
            engine.getSecurityLayer().requireAuth(body.tokenId, 'HITL_MODIFY', 'REVOKE_DELEGATION');

            const revoked = await delegationManager.revokeDelegation(delegationId, body.reason);

            if (!revoked) {
                return c.json({ error: 'Delegation not found' }, 404);
            }

            return c.json({ success: true, revoked: delegationId });
        } catch (error) {
            return c.json({ error: (error as Error).message }, 403);
        }
    });

    // GET /autonomy/:agentId/budget - Get current budget status
    app.get('/autonomy/:agentId/budget', async (c) => {
        const agentId = c.req.param('agentId') as AgentId;

        try {
            const summary = await autonomyBudget.getBudgetSummary(agentId);

            // Calculate time until reset (midnight UTC)
            const now = new Date();
            const tomorrow = new Date(now);
            tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
            tomorrow.setUTCHours(0, 0, 0, 0);
            const resetsIn = tomorrow.getTime() - now.getTime();

            return c.json({
                agentId: summary.agentId,
                tier: summary.tier,
                actions: {
                    used: summary.actions.used,
                    max: summary.actions.max,
                    remaining: summary.actions.remaining,
                    percentage: summary.actions.percentUsed,
                },
                delegations: {
                    used: summary.delegations.used,
                    max: summary.delegations.max,
                    remaining: summary.delegations.remaining,
                },
                tokens: {
                    spent: summary.tokens.spent,
                    max: summary.tokens.max,
                    remaining: summary.tokens.remaining,
                },
                resetsIn,
                resetsAt: tomorrow.toISOString(),
            });
        } catch (error) {
            return c.json({ error: (error as Error).message }, 400);
        }
    });

    // POST /autonomy/:agentId/action - Record action (internal use)
    app.post('/autonomy/:agentId/action', async (c) => {
        const agentId = c.req.param('agentId') as AgentId;
        const body = await c.req.json<{
            actionType: string;
            cost?: number;
            tokenCost?: number;
        }>();

        try {
            await autonomyBudget.recordAction({
                agentId,
                actionType: body.actionType,
                cost: body.cost,
                tokenCost: body.tokenCost,
            });

            const summary = await autonomyBudget.getBudgetSummary(agentId);

            return c.json({
                success: true,
                remaining: summary.actions.remaining,
                percentUsed: summary.actions.percentUsed,
            });
        } catch (error) {
            return c.json({ error: (error as Error).message }, 400);
        }
    });

    // -------------------------------------------------------------------------
    // AI Provider Endpoints
    // -------------------------------------------------------------------------

    // GET /ai/providers - List available AI providers
    app.get('/api/ai/providers', async (c) => {
        try {
            const { getAIClient } = await import('../core/AIProvider.js');
            const client = getAIClient();
            return c.json({
                available: client.getAvailableProviders(),
                default: client.getDefaultProvider(),
                models: {
                    claude: process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-20250514',
                    grok: process.env.GROK_MODEL ?? 'grok-beta',
                    openai: process.env.OPENAI_MODEL ?? 'gpt-4-turbo-preview',
                    gemini: process.env.GEMINI_MODEL ?? 'gemini-pro',
                },
            });
        } catch (error) {
            return c.json({ available: [], default: null, error: (error as Error).message });
        }
    });

    // POST /ai/complete - Send completion request to AI
    app.post('/api/ai/complete', async (c) => {
        try {
            const { getAIClient } = await import('../core/AIProvider.js');
            const client = getAIClient();
            const body = await c.req.json<{
                messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
                provider?: 'claude' | 'grok' | 'openai' | 'gemini';
                model?: string;
                maxTokens?: number;
                temperature?: number;
            }>();

            const result = await client.complete(body.messages, {
                provider: body.provider,
                model: body.model,
                maxTokens: body.maxTokens,
                temperature: body.temperature,
            });

            return c.json(result);
        } catch (error) {
            return c.json({ error: (error as Error).message }, 500);
        }
    });

    // POST /ai/ask - Simple question/answer
    app.post('/api/ai/ask', async (c) => {
        try {
            const { getAIClient } = await import('../core/AIProvider.js');
            const client = getAIClient();
            const body = await c.req.json<{
                prompt: string;
                provider?: 'claude' | 'grok' | 'openai' | 'gemini';
            }>();

            const response = await client.ask(body.prompt, { provider: body.provider });
            return c.json({ response, provider: body.provider ?? client.getDefaultProvider() });
        } catch (error) {
            return c.json({ error: (error as Error).message }, 500);
        }
    });

    // POST /ai/agent-reason - Agent reasoning endpoint
    app.post('/api/ai/agent-reason', async (c) => {
        try {
            const { getAIClient } = await import('../core/AIProvider.js');
            const client = getAIClient();
            const body = await c.req.json<{
                agentName: string;
                agentRole: string;
                task: string;
                context?: string;
                provider?: 'claude' | 'grok' | 'openai' | 'gemini';
            }>();

            const result = await client.agentReason(body);
            return c.json(result);
        } catch (error) {
            return c.json({ error: (error as Error).message }, 500);
        }
    });

    // POST /ai/set-default - Set default AI provider
    app.post('/api/ai/set-default', async (c) => {
        try {
            const { getAIClient } = await import('../core/AIProvider.js');
            const client = getAIClient();
            const body = await c.req.json<{ provider: 'claude' | 'grok' | 'openai' | 'gemini' }>();

            client.setDefaultProvider(body.provider);
            return c.json({ success: true, default: body.provider });
        } catch (error) {
            return c.json({ error: (error as Error).message }, 400);
        }
    });

    // POST /ai/configure - Configure a provider with API key
    app.post('/api/ai/configure', async (c) => {
        try {
            const { getAIClient } = await import('../core/AIProvider.js');
            const client = getAIClient();
            const body = await c.req.json<{
                provider: 'claude' | 'grok' | 'openai' | 'gemini';
                apiKey: string;
                model?: string;
                setAsDefault?: boolean;
            }>();

            if (!body.provider || !body.apiKey) {
                return c.json({ error: 'provider and apiKey are required' }, 400);
            }

            client.configureProvider(body.provider, body.apiKey, body.model);

            if (body.setAsDefault) {
                client.setDefaultProvider(body.provider);
            }

            return c.json({
                success: true,
                provider: body.provider,
                isDefault: client.getDefaultProvider() === body.provider,
                available: client.getAvailableProviders(),
            });
        } catch (error) {
            return c.json({ error: (error as Error).message }, 500);
        }
    });

    // POST /ai/test - Test a provider connection
    app.post('/api/ai/test', async (c) => {
        try {
            const { getAIClient } = await import('../core/AIProvider.js');
            const client = getAIClient();
            const body = await c.req.json<{ provider: 'claude' | 'grok' | 'openai' | 'gemini' }>();

            const result = await client.testProvider(body.provider);
            return c.json(result);
        } catch (error) {
            return c.json({ success: false, error: (error as Error).message }, 500);
        }
    });

    // DELETE /ai/provider/:type - Remove a provider
    app.delete('/api/ai/provider/:type', async (c) => {
        try {
            const { getAIClient } = await import('../core/AIProvider.js');
            const client = getAIClient();
            const providerType = c.req.param('type') as 'claude' | 'grok' | 'openai' | 'gemini';

            client.removeProvider(providerType);
            return c.json({
                success: true,
                removed: providerType,
                available: client.getAvailableProviders(),
                default: client.getDefaultProvider(),
            });
        } catch (error) {
            return c.json({ error: (error as Error).message }, 500);
        }
    });

    // GET /ai/info - Get detailed provider info
    app.get('/api/ai/info', async (c) => {
        try {
            const { getAIClient } = await import('../core/AIProvider.js');
            const client = getAIClient();
            return c.json({
                providers: client.getProviderInfo(),
                default: client.getDefaultProvider(),
                allProviderTypes: ['claude', 'grok', 'openai', 'gemini'],
            });
        } catch (error) {
            return c.json({ error: (error as Error).message }, 500);
        }
    });

    // -------------------------------------------------------------------------
    // Aria AI Interpretation Endpoint
    // -------------------------------------------------------------------------

    // POST /ai/aria/interpret - Interpret user message for agent routing
    app.post('/api/ai/aria/interpret', async (c) => {
        try {
            // Check if Aria AI is enabled
            if (!ariaSettings.enabled) {
                return c.json({
                    success: false,
                    error: 'Aria AI is disabled',
                    interpretation: {
                        action: 'CHAT',
                        params: {},
                        response: "Aria AI is currently disabled. You can enable it in settings, or use direct commands like `help`, `status`, or `agents`.",
                        confidence: 0,
                    },
                });
            }

            // Check daily limit
            if (ariaSettings.dailyQueryLimit > 0 && ariaSettings.queriesUsedToday >= ariaSettings.dailyQueryLimit) {
                return c.json({
                    success: false,
                    error: 'Daily query limit reached',
                    interpretation: {
                        action: 'CHAT',
                        params: {},
                        response: `Daily query limit (${ariaSettings.dailyQueryLimit}) reached. Please use direct commands or wait until tomorrow.`,
                        confidence: 0,
                    },
                });
            }

            const { getAIClient } = await import('../core/AIProvider.js');
            const client = getAIClient();
            const body = await c.req.json<{
                message: string;
                context?: {
                    agents?: Array<{ id: string; name: string; type: string; tier: number; status: string }>;
                    pendingApprovals?: number;
                    hitlLevel?: number;
                    recentTasks?: Array<{ title: string; status: string }>;
                };
            }>();

            // Increment query counter
            ariaSettings.queriesUsedToday++;

            // Build context string for the AI
            const contextParts: string[] = [];
            if (body.context?.agents) {
                const agentSummary = body.context.agents.map(a => `${a.name} (${a.type}, T${a.tier}, ${a.status})`).join(', ');
                contextParts.push(`Active agents: ${agentSummary}`);
            }
            if (body.context?.pendingApprovals) {
                contextParts.push(`Pending approvals: ${body.context.pendingApprovals}`);
            }
            if (body.context?.hitlLevel !== undefined) {
                contextParts.push(`HITL level: ${body.context.hitlLevel}%`);
            }

            const systemPrompt = `You are Aria, an AI assistant for Aurais - an autonomous agent orchestration system.
Your job is to interpret user messages and determine what action they want to take.

Available actions:
- SPAWN: Create a new agent (needs: name, type, tier)
- TASK: Create a new task (needs: description, priority?)
- STATUS: Show system status
- AGENTS: List agents (optional: filter)
- AGENT_DETAIL: Show specific agent (needs: agent identifier)
- APPROVE: Approve a request (needs: id)
- DENY: Deny a request (needs: id, reason?)
- HITL: Set governance level (needs: level 0-100)
- TICK: Run agent work cycle
- HELP: Show help
- CHAT: General conversation/question (no specific action)

Agent types: EXECUTOR, PLANNER, VALIDATOR, EVOLVER, SPAWNER, LISTENER, WORKER, SPECIALIST, ORCHESTRATOR
Priority levels: LOW, NORMAL, HIGH, CRITICAL
Tiers: 0-5 (0=Untrusted, 5=Elite)

${contextParts.length > 0 ? '\nCurrent context:\n' + contextParts.join('\n') : ''}

Respond with a JSON object containing:
{
  "action": "<ACTION_TYPE>",
  "params": { <action-specific parameters> },
  "response": "<friendly message to show the user>",
  "confidence": <0.0-1.0>
}

If the user's intent is unclear or just conversational, use action "CHAT" and respond naturally.`;

            const result = await client.complete([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: body.message },
            ], {
                maxTokens: 500,
                temperature: 0.3,
            });

            // Parse the AI response
            try {
                // Try to extract JSON from the response
                const jsonMatch = result.content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    return c.json({
                        success: true,
                        interpretation: parsed,
                        provider: result.provider,
                        model: result.model,
                    });
                }
            } catch {
                // If JSON parsing fails, treat as chat response
            }

            // Fallback: treat as conversational
            return c.json({
                success: true,
                interpretation: {
                    action: 'CHAT',
                    params: {},
                    response: result.content,
                    confidence: 0.5,
                },
                provider: result.provider,
                model: result.model,
            });
        } catch (error) {
            // Fallback when AI is unavailable
            return c.json({
                success: false,
                error: (error as Error).message,
                interpretation: {
                    action: 'CHAT',
                    params: {},
                    response: "I'm having trouble connecting to my AI backend. Please try using direct commands like `help`, `status`, or `agents`.",
                    confidence: 0,
                },
            });
        }
    });

    // POST /ai/aria/gather - Gather perspectives from all AI providers
    app.post('/api/ai/aria/gather', async (c) => {
        try {
            const { getAIClient } = await import('../core/AIProvider.js');
            const client = getAIClient();
            const body = await c.req.json<{
                question: string;
                context?: string;
                synthesize?: boolean;
            }>();

            const availableProviders = client.getAvailableProviders();

            if (availableProviders.length === 0) {
                return c.json({
                    success: false,
                    error: 'No AI providers configured',
                    perspectives: [],
                    providers: [],
                });
            }

            const result = await client.gatherPerspectives(
                body.question,
                body.context,
                body.synthesize ?? true
            );

            return c.json({
                success: true,
                question: body.question,
                perspectives: result.perspectives,
                synthesis: result.synthesis,
                providers: result.providers,
                providersQueried: result.perspectives.length,
                providersSucceeded: result.perspectives.filter(p => p.success).length,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: (error as Error).message,
                perspectives: [],
                providers: [],
            });
        }
    });

    // GET /ai/aria/settings - Get Aria AI settings
    app.get('/api/ai/aria/settings', async (c) => {
        try {
            const { getAIClient } = await import('../core/AIProvider.js');
            const client = getAIClient();

            return c.json({
                success: true,
                settings: ariaSettings,
                availableProviders: client.getAvailableProviders(),
                defaultProvider: client.getDefaultProvider(),
            });
        } catch (error) {
            return c.json({
                success: false,
                error: (error as Error).message,
                settings: ariaSettings,
            });
        }
    });

    // POST /ai/aria/settings - Update Aria AI settings
    app.post('/api/ai/aria/settings', async (c) => {
        try {
            const body = await c.req.json<Partial<AriaSettings>>();

            // Update settings
            ariaSettings = {
                ...ariaSettings,
                ...body,
                // Ensure arrays are properly handled
                enabledProviders: body.enabledProviders ?? ariaSettings.enabledProviders,
            };

            return c.json({
                success: true,
                settings: ariaSettings,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: (error as Error).message,
            });
        }
    });

    // GET /ai/aria/advisors - Get all configured advisors
    app.get('/api/ai/aria/advisors', async (c) => {
        try {
            const { getAIClient } = await import('../core/AIProvider.js');
            const client = getAIClient();
            const available = client.getAvailableProviders();

            // Mark which advisors have available providers
            const advisorsWithStatus = ariaSettings.advisors.map(advisor => ({
                ...advisor,
                available: available.includes(advisor.provider),
            }));

            return c.json({
                success: true,
                advisors: advisorsWithStatus,
                councilName: ariaSettings.councilName,
                councilAliases: ariaSettings.councilAliases,
                availableProviders: available,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: (error as Error).message,
                advisors: ariaSettings.advisors,
            });
        }
    });

    // POST /ai/aria/advisors - Add or update an advisor
    app.post('/api/ai/aria/advisors', async (c) => {
        try {
            const body = await c.req.json<AdvisorConfig>();

            // Validate required fields
            if (!body.name || !body.provider) {
                return c.json({
                    success: false,
                    error: 'Advisor requires name and provider',
                }, 400);
            }

            // Validate provider is valid
            const validProviders = ['claude', 'grok', 'openai', 'gemini'];
            if (!validProviders.includes(body.provider)) {
                return c.json({
                    success: false,
                    error: `Invalid provider. Valid providers: ${validProviders.join(', ')}`,
                }, 400);
            }

            // Find existing advisor by name (case-insensitive)
            const existingIndex = ariaSettings.advisors.findIndex(
                a => a.name.toLowerCase() === body.name.toLowerCase()
            );

            const newAdvisor: AdvisorConfig = {
                name: body.name,
                provider: body.provider,
                aliases: body.aliases || [],
                personality: body.personality,
                icon: body.icon || '🤖',
                enabled: body.enabled !== false,
            };

            if (existingIndex >= 0) {
                // Update existing
                ariaSettings.advisors[existingIndex] = newAdvisor;
            } else {
                // Add new
                ariaSettings.advisors.push(newAdvisor);
            }

            return c.json({
                success: true,
                advisor: newAdvisor,
                action: existingIndex >= 0 ? 'updated' : 'created',
                advisors: ariaSettings.advisors,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: (error as Error).message,
            });
        }
    });

    // DELETE /ai/aria/advisors/:name - Remove an advisor
    app.delete('/api/ai/aria/advisors/:name', async (c) => {
        try {
            const name = c.req.param('name');

            const existingIndex = ariaSettings.advisors.findIndex(
                a => a.name.toLowerCase() === name.toLowerCase()
            );

            if (existingIndex < 0) {
                return c.json({
                    success: false,
                    error: `Advisor "${name}" not found`,
                }, 404);
            }

            const removed = ariaSettings.advisors.splice(existingIndex, 1)[0];

            return c.json({
                success: true,
                removed: removed,
                advisors: ariaSettings.advisors,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: (error as Error).message,
            });
        }
    });

    // POST /ai/aria/council - Update council settings (name and aliases)
    app.post('/api/ai/aria/council', async (c) => {
        try {
            const body = await c.req.json<{
                name?: string;
                aliases?: string[];
            }>();

            if (body.name) {
                ariaSettings.councilName = body.name;
            }
            if (body.aliases) {
                ariaSettings.councilAliases = body.aliases;
            }

            return c.json({
                success: true,
                councilName: ariaSettings.councilName,
                councilAliases: ariaSettings.councilAliases,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: (error as Error).message,
            });
        }
    });

    // POST /ai/aria/consult - Ask a specific provider for targeted knowledge
    app.post('/api/ai/aria/consult', async (c) => {
        try {
            const { getAIClient } = await import('../core/AIProvider.js');
            const client = getAIClient();
            const body = await c.req.json<{
                question: string;
                provider: 'claude' | 'grok' | 'openai' | 'gemini';
                advisorName?: string;  // Optional: use named advisor's personality
                role?: string;
                context?: string;
            }>();

            if (!client.hasProvider(body.provider)) {
                return c.json({
                    success: false,
                    error: `Provider ${body.provider} is not configured`,
                    availableProviders: client.getAvailableProviders(),
                });
            }

            // Find advisor config if specified or matching provider
            let advisorPersonality = '';
            let advisorIcon = '🤖';
            let advisorName = body.provider.toUpperCase();

            if (body.advisorName) {
                const advisor = ariaSettings.advisors.find(
                    a => a.name.toLowerCase() === body.advisorName!.toLowerCase() ||
                         a.aliases.some(alias => alias.toLowerCase() === body.advisorName!.toLowerCase())
                );
                if (advisor) {
                    advisorPersonality = advisor.personality || '';
                    advisorIcon = advisor.icon || '🤖';
                    advisorName = advisor.name;
                }
            } else {
                // Use personality from advisor matching this provider
                const advisor = ariaSettings.advisors.find(a => a.provider === body.provider);
                if (advisor) {
                    advisorPersonality = advisor.personality || '';
                    advisorIcon = advisor.icon || '🤖';
                    advisorName = advisor.name;
                }
            }

            const rolePrompt = body.role
                ? `You are acting as ${body.role}. `
                : advisorPersonality
                    ? advisorPersonality + ' '
                    : '';

            const result = await client.complete([
                { role: 'system', content: `${rolePrompt}Provide helpful, accurate, and actionable information.` },
                { role: 'user', content: body.context ? `Context: ${body.context}\n\nQuestion: ${body.question}` : body.question },
            ], {
                provider: body.provider,
                maxTokens: 1500,
                temperature: 0.7,
            });

            return c.json({
                success: true,
                provider: body.provider,
                advisorName,
                advisorIcon,
                model: result.model,
                response: result.content,
                usage: result.usage,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: (error as Error).message,
            });
        }
    });

    // ========================================================================
    // Skills Library API
    // ========================================================================

    // GET /api/skills - Get all skills or filter by query
    app.get('/api/skills', (c) => {
        const query = c.req.query('query');
        const category = c.req.query('category');
        const trustLevel = c.req.query('trustLevel');

        let skills = SKILLS;

        if (query) {
            skills = searchSkills(query);
        }

        if (category) {
            skills = skills.filter(s => s.category === category);
        }

        if (trustLevel) {
            const level = parseInt(trustLevel, 10);
            if (level >= 1 && level <= 5) {
                skills = skills.filter(s => s.trustLevelRequired <= level);
            }
        }

        return c.json({
            success: true,
            count: skills.length,
            skills: skills.map(s => ({
                id: s.id,
                name: s.name,
                tier: s.tier,
                category: s.category,
                subcategory: s.subcategory,
                trustLevelRequired: s.trustLevelRequired,
                riskCategory: s.riskCategory,
                requiresHumanApproval: s.requiresHumanApproval,
                description: s.description,
                tags: s.tags,
            })),
        });
    });

    // GET /api/skills/stats - Get skills statistics
    // NOTE: Specific routes MUST be defined BEFORE parameterized routes
    app.get('/api/skills/stats', (c) => {
        const stats = getSkillStats();
        const summary = getSkillsSummary();

        return c.json({
            success: true,
            stats,
            summary,
        });
    });

    // GET /api/skills/categories - Get skill categories
    app.get('/api/skills/categories', (c) => {
        const categories = Object.entries(SKILL_CATEGORIES).map(([key, value]) => ({
            key,
            name: value,
            count: SKILLS.filter(s => s.category === value).length,
        })).filter(cat => cat.count > 0);

        return c.json({
            success: true,
            categories,
        });
    });

    // GET /api/skills/validate - Validate skill dependencies
    app.get('/api/skills/validate', (c) => {
        const result = validateSkillComposition();

        return c.json({
            success: true,
            validation: result,
        });
    });

    // GET /api/skills/:id - Get skill details
    // NOTE: Parameterized route MUST come AFTER specific routes
    app.get('/api/skills/:id', (c) => {
        const id = c.req.param('id');
        const skill = getSkillById(id);

        if (!skill) {
            return c.json({ success: false, error: `Skill "${id}" not found` }, 404);
        }

        return c.json({
            success: true,
            skill,
        });
    });

    // GET /api/agent/:id/skills - Get skills available to a specific agent
    app.get('/api/agent/:id/skills', async (c) => {
        const agentId = c.req.param('id');
        let agent: { type: string; tier: number } | undefined;

        if (supabase) {
            try {
                const dbAgent = await supabase.getAgent(agentId);
                if (dbAgent) {
                    agent = { type: dbAgent.type, tier: dbAgent.tier };
                }
            } catch (e) {
                console.error('Supabase getAgent error:', e);
            }
        }

        if (!agent) {
            const demoAgent = demoAgents.find(a => a.id === agentId);
            if (demoAgent) {
                agent = { type: demoAgent.type, tier: demoAgent.tier };
            }
        }

        if (!agent) {
            return c.json({ success: false, error: `Agent "${agentId}" not found` }, 404);
        }

        const trustLevelNames: TrustLevel[] = [
            'PASSIVE', 'WORKER', 'OPERATIONAL', 'TACTICAL', 'EXECUTIVE', 'SOVEREIGN'
        ];
        const trustLevel = trustLevelNames[agent.tier] || 'WORKER';
        const manifest = exportAgentSkillManifest(agent.type as AgentType, trustLevel);

        return c.json({
            success: true,
            agentId,
            agentType: agent.type,
            trustLevel,
            manifest,
        });
    });

    // POST /api/agent/:id/skills/check - Check if agent can use a skill
    app.post('/api/agent/:id/skills/check', async (c) => {
        const agentId = c.req.param('id');
        let agent: { type: string; tier: number } | undefined;

        if (supabase) {
            try {
                const dbAgent = await supabase.getAgent(agentId);
                if (dbAgent) {
                    agent = { type: dbAgent.type, tier: dbAgent.tier };
                }
            } catch (e) {
                console.error('Supabase getAgent error:', e);
            }
        }

        if (!agent) {
            const demoAgent = demoAgents.find(a => a.id === agentId);
            if (demoAgent) {
                agent = { type: demoAgent.type, tier: demoAgent.tier };
            }
        }

        if (!agent) {
            return c.json({ success: false, error: `Agent "${agentId}" not found` }, 404);
        }

        const body = await c.req.json<{ skillId: string }>();
        const trustLevelNames: TrustLevel[] = [
            'PASSIVE', 'WORKER', 'OPERATIONAL', 'TACTICAL', 'EXECUTIVE', 'SOVEREIGN'
        ];
        const trustLevel = trustLevelNames[agent.tier] || 'WORKER';
        const result = canAgentUseSkill(agent.type as AgentType, trustLevel, body.skillId);

        return c.json({
            success: true,
            agentId,
            skillId: body.skillId,
            ...result,
        });
    });

    // GET /api/spawn/skill-requirements - Get skill requirements for spawning
    app.get('/api/spawn/skill-requirements', (c) => {
        const parentType = c.req.query('parentType') as AgentType;
        const parentTrustLevel = c.req.query('parentTrustLevel') as TrustLevel;
        const childType = c.req.query('childType') as AgentType;

        if (!parentType || !parentTrustLevel || !childType) {
            return c.json({
                success: false,
                error: 'Missing required parameters: parentType, parentTrustLevel, childType',
            }, 400);
        }

        const requirements = getSpawnSkillRequirements(parentType, parentTrustLevel, childType);

        return c.json({
            success: true,
            parentType,
            parentTrustLevel,
            childType,
            ...requirements,
        });
    });

    // ========================================================================
    // Memory System Routes
    // ========================================================================
    app.route('/api/memory', memoryRoutes);

    // ========================================================================
    // Artifact System Routes
    // ========================================================================
    app.route('/api/artifacts', artifactRoutes);

    // ========================================================================
    // Agent Discovery Routes (Fleet Management & Communication)
    // ========================================================================
    app.route('/api/agent-discovery', agentDiscoveryRoutes);

    // ========================================================================
    // Work Loop Routes (Autonomous Agent Execution)
    // ========================================================================
    app.route('/work-loop', workLoopRoutes);

    return app;
}

// ============================================================================
// Server Factory
// ============================================================================

export async function startUnifiedWorkflowServer(port: number = 3002): Promise<{
    engine: UnifiedWorkflowEngine;
    masterKey: string;
    persistence: PersistenceLayer;
    supabase: SupabasePersistence | null;
}> {
    const security = new SecurityLayer();
    const persistence = new PersistenceLayer();
    let supabase: SupabasePersistence | null = null;

    // Try to connect to Supabase if configured
    if (hasSupabaseConfig()) {
        console.log('🔌 Supabase configured, connecting...');
        try {
            supabase = getSupabasePersistence();
            const connected = await supabase.connect();
            if (connected) {
                console.log('✅ Supabase connected successfully!');
            } else {
                console.log('⚠️  Supabase connection failed, falling back to file storage');
                supabase = null;
            }
        } catch (error) {
            console.log('⚠️  Supabase error:', (error as Error).message);
            console.log('📁 Falling back to file-based persistence');
            supabase = null;
        }
    } else {
        console.log('📁 No Supabase config found, using file-based persistence');
    }

    const engine = new UnifiedWorkflowEngine(
        new TrustEngine(),
        new Blackboard(),
        security,
        persistence
    );

    // Initialize T5-Planner (The Architect)
    const planner = new T5Planner();
    await planner.initialize();
    console.log('🏛️  T5-Planner (Architect) Initialized');

    // Start auto-save for file persistence
    persistence.startAutoSave();

    const app = createWorkflowAPI(engine, supabase);

    serve({ fetch: app.fetch, port }, () => {
        // Structured logging for server startup
        logger.info('Server started', {
            component: 'server',
            port,
            persistence: supabase ? 'supabase' : 'file',
            dataDir: supabase ? undefined : persistence.getDataDir(),
        });

        // Also log to console for development visibility
        console.log(`\n🚀 Unified Workflow API running on http://localhost:${port}`);
        console.log(`\n📊 Dashboard: http://localhost:${port}/dashboard/today`);
        console.log(`🎚️  Aggressiveness: http://localhost:${port}/dashboard/aggressiveness`);
        console.log(`📋 Tasks: http://localhost:${port}/tasks`);
        console.log(`✅ Approvals: http://localhost:${port}/approvals`);
        console.log(`\n💾 Persistence: ${supabase ? 'Supabase (Postgres)' : persistence.getDataDir()}`);
        console.log(`\n🔑 Master Key for human auth: ${security.getMasterKey()}\n`);
    });

    return { engine, masterKey: security.getMasterKey(), persistence, supabase };
}
