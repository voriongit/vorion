/**
 * Skill Block Schema
 *
 * Skills are composable capability modules that can be assigned to agents.
 * Each skill has tier requirements, resource costs, and defined behaviors.
 */

export type SkillCategory =
    | 'RESEARCH'      // Information gathering and analysis
    | 'DEVELOPMENT'   // Code writing and modification
    | 'REVIEW'        // Code review, auditing, validation
    | 'PLANNING'      // Strategic planning and task breakdown
    | 'COMMUNICATION' // Inter-agent and human communication
    | 'INTEGRATION'   // External API and service integration
    | 'AUTOMATION'    // Workflow automation and scripting
    | 'SECURITY';     // Security scanning and compliance

export type SkillRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface SkillRequirement {
    minTier: number;           // Minimum trust tier required
    minTrustScore?: number;    // Minimum trust score required
    prerequisiteSkills?: string[]; // Skills that must be learned first
    cooldownMs?: number;       // Cooldown between uses
}

export interface SkillResource {
    type: 'API_CALL' | 'COMPUTE' | 'MEMORY' | 'TOKEN' | 'TIME';
    amount: number;
    unit: string;
}

export interface SkillInput {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    description: string;
    required: boolean;
    default?: unknown;
}

export interface SkillOutput {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    description: string;
}

export interface SkillBlock {
    id: string;
    name: string;
    description: string;
    category: SkillCategory;
    rarity: SkillRarity;
    icon: string;

    // Requirements
    requirements: SkillRequirement;

    // Resource costs per execution
    resourceCost: SkillResource[];

    // Trust impact
    trustReward: number;      // Trust points gained on success
    trustPenalty: number;     // Trust points lost on failure

    // I/O Schema
    inputs: SkillInput[];
    outputs: SkillOutput[];

    // Behavioral flags
    requiresApproval: boolean;  // Needs HITL approval
    canDelegate: boolean;       // Can be delegated to lower tiers
    isAutonomous: boolean;      // Can run without supervision

    // Metadata
    version: string;
    author: string;
    tags: string[];

    // Execution stats (runtime)
    stats?: {
        totalExecutions: number;
        successRate: number;
        avgDurationMs: number;
        lastUsed?: string;
    };
}

export interface SkillAssignment {
    skillId: string;
    agentId: string;
    assignedAt: string;
    assignedBy: string;
    proficiency: number;  // 0-100, improves with use
    usageCount: number;
    lastUsed?: string;
}

export interface SkillExecution {
    id: string;
    skillId: string;
    agentId: string;
    startedAt: string;
    completedAt?: string;
    status: 'pending' | 'running' | 'success' | 'failure' | 'cancelled';
    inputs: Record<string, unknown>;
    outputs?: Record<string, unknown>;
    error?: string;
    trustDelta: number;
    resourcesUsed: SkillResource[];
}

// Skill Registry Types
export interface SkillRegistry {
    skills: Map<string, SkillBlock>;
    assignments: Map<string, SkillAssignment[]>; // agentId -> assignments
    executions: SkillExecution[];
}

// Rarity colors for UI
export const RARITY_COLORS: Record<SkillRarity, { bg: string; border: string; text: string }> = {
    common: { bg: '#374151', border: '#6b7280', text: '#9ca3af' },
    uncommon: { bg: '#065f46', border: '#10b981', text: '#6ee7b7' },
    rare: { bg: '#1e3a8a', border: '#3b82f6', text: '#93c5fd' },
    epic: { bg: '#581c87', border: '#8b5cf6', text: '#c4b5fd' },
    legendary: { bg: '#78350f', border: '#f59e0b', text: '#fcd34d' },
};

// Category icons
export const CATEGORY_ICONS: Record<SkillCategory, string> = {
    RESEARCH: '🔍',
    DEVELOPMENT: '💻',
    REVIEW: '👁️',
    PLANNING: '📋',
    COMMUNICATION: '💬',
    INTEGRATION: '🔗',
    AUTOMATION: '⚡',
    SECURITY: '🛡️',
};
