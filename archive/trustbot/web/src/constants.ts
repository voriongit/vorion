/**
 * Aurais Unified Constants
 * Single source of truth for all system configuration
 * Trust tiers aligned with Vorion BASIS specification
 */

// =============================================================================
// TRUST TIERS (BASIS Specification)
// =============================================================================

export const TIERS = {
    0: { name: 'SANDBOX', label: 'Sandbox', threshold: 0, maxScore: 99, color: '#ef4444', gradient: 'linear-gradient(135deg, #dc2626, #ef4444)', canDelegate: false },
    1: { name: 'PROVISIONAL', label: 'Provisional', threshold: 100, maxScore: 299, color: '#f97316', gradient: 'linear-gradient(135deg, #ea580c, #f97316)', canDelegate: false },
    2: { name: 'STANDARD', label: 'Standard', threshold: 300, maxScore: 499, color: '#eab308', gradient: 'linear-gradient(135deg, #ca8a04, #eab308)', canDelegate: false },
    3: { name: 'TRUSTED', label: 'Trusted', threshold: 500, maxScore: 699, color: '#22c55e', gradient: 'linear-gradient(135deg, #16a34a, #22c55e)', canDelegate: true },
    4: { name: 'CERTIFIED', label: 'Certified', threshold: 700, maxScore: 899, color: '#3b82f6', gradient: 'linear-gradient(135deg, #2563eb, #3b82f6)', canDelegate: true },
    5: { name: 'AUTONOMOUS', label: 'Autonomous', threshold: 900, maxScore: 1000, color: '#a855f7', gradient: 'linear-gradient(135deg, #9333ea, #a855f7)', canDelegate: true },
} as const;

export type TierLevel = keyof typeof TIERS;

export function getTierFromScore(score: number): TierLevel {
    if (score >= 900) return 5;
    if (score >= 700) return 4;
    if (score >= 500) return 3;
    if (score >= 300) return 2;
    if (score >= 100) return 1;
    return 0;
}

export function getTierConfig(tier: TierLevel) {
    return TIERS[tier];
}

// =============================================================================
// AGENT TYPES
// =============================================================================

export const AGENT_TYPES = {
    EXECUTOR: { icon: '🎖️', label: 'Executor', description: 'Executes approved actions' },
    PLANNER: { icon: '🧠', label: 'Planner', description: 'Strategic planning and coordination' },
    VALIDATOR: { icon: '🛡️', label: 'Validator', description: 'Validates and audits work' },
    EVOLVER: { icon: '🧬', label: 'Evolver', description: 'System optimization and evolution' },
    SPAWNER: { icon: '🏭', label: 'Spawner', description: 'Creates new agents' },
    LISTENER: { icon: '👂', label: 'Listener', description: 'Monitors and observes' },
    WORKER: { icon: '🤖', label: 'Worker', description: 'General task execution' },
    SPECIALIST: { icon: '🔧', label: 'Specialist', description: 'Domain-specific expertise' },
    ORCHESTRATOR: { icon: '📋', label: 'Orchestrator', description: 'Coordinates workflows' },
} as const;

export type AgentType = keyof typeof AGENT_TYPES;

export function getAgentIcon(type: string): string {
    return AGENT_TYPES[type as AgentType]?.icon ?? '🤖';
}

// =============================================================================
// AGENT STATUS
// =============================================================================

export const AGENT_STATUS = {
    IDLE: { icon: '⚪', label: 'Idle', color: 'var(--text-muted)', description: 'Waiting for tasks' },
    WORKING: { icon: '🟢', label: 'Working', color: 'var(--accent-green)', description: 'Processing task' },
    WAITING: { icon: '🟡', label: 'Waiting', color: 'var(--accent-gold)', description: 'Awaiting approval' },
    IN_MEETING: { icon: '🔵', label: 'In Meeting', color: 'var(--accent-blue)', description: 'Collaborating' },
    SUSPENDED: { icon: '🔴', label: 'Suspended', color: 'var(--accent-red)', description: 'Temporarily disabled' },
    ERROR: { icon: '❌', label: 'Error', color: 'var(--accent-red)', description: 'Encountered error' },
} as const;

export type AgentStatus = keyof typeof AGENT_STATUS;

// =============================================================================
// BLACKBOARD ENTRY TYPES
// =============================================================================

export const ENTRY_TYPES = {
    TASK: { icon: '📋', label: 'Task', color: 'var(--accent-blue)', description: 'Work to be done' },
    OBSERVATION: { icon: '👁️', label: 'Observation', color: 'var(--accent-cyan)', description: 'Something noticed' },
    DECISION: { icon: '⚖️', label: 'Decision', color: 'var(--accent-gold)', description: 'Choice made' },
    PROBLEM: { icon: '⚠️', label: 'Problem', color: 'var(--accent-red)', description: 'Issue identified' },
    SOLUTION: { icon: '✅', label: 'Solution', color: 'var(--accent-green)', description: 'Resolution proposed' },
    PATTERN: { icon: '🔮', label: 'Pattern', color: 'var(--accent-purple)', description: 'Recurring behavior' },
} as const;

export type EntryType = keyof typeof ENTRY_TYPES;

export function getEntryConfig(type: string) {
    return ENTRY_TYPES[type as EntryType] ?? ENTRY_TYPES.OBSERVATION;
}

// =============================================================================
// ENTRY STATUS
// =============================================================================

export const ENTRY_STATUS = {
    OPEN: { icon: '🔵', label: 'Open', color: 'var(--accent-blue)' },
    IN_PROGRESS: { icon: '🟡', label: 'In Progress', color: 'var(--accent-gold)' },
    RESOLVED: { icon: '🟢', label: 'Resolved', color: 'var(--accent-green)' },
    ARCHIVED: { icon: '⚫', label: 'Archived', color: 'var(--text-muted)' },
} as const;

export type EntryStatus = keyof typeof ENTRY_STATUS;

// =============================================================================
// TASK STATUS
// =============================================================================

export const TASK_STATUS = {
    QUEUED: { icon: '📥', label: 'Queued', color: 'var(--text-muted)' },
    PENDING_APPROVAL: { icon: '⏳', label: 'Pending Approval', color: 'var(--accent-gold)' },
    IN_PROGRESS: { icon: '🔄', label: 'In Progress', color: 'var(--accent-blue)' },
    COMPLETED: { icon: '✅', label: 'Completed', color: 'var(--accent-green)' },
    FAILED: { icon: '❌', label: 'Failed', color: 'var(--accent-red)' },
} as const;

export type TaskStatus = keyof typeof TASK_STATUS;

// =============================================================================
// HITL (GOVERNANCE) LEVELS
// =============================================================================

export const HITL_LEVELS = {
    FULL_AUTONOMY: { min: 0, max: 19, label: 'Full Autonomy', icon: '🚀', description: 'System operates independently' },
    MOSTLY_AUTONOMOUS: { min: 20, max: 49, label: 'Mostly Autonomous', icon: '🤖', description: 'Only critical decisions escalate' },
    SHARED_CONTROL: { min: 50, max: 79, label: 'Shared Control', icon: '🤝', description: 'Major decisions need approval' },
    FULL_OVERSIGHT: { min: 80, max: 100, label: 'Full Oversight', icon: '🔒', description: 'All decisions require approval' },
} as const;

export function getHITLLevel(value: number) {
    if (value >= 80) return HITL_LEVELS.FULL_OVERSIGHT;
    if (value >= 50) return HITL_LEVELS.SHARED_CONTROL;
    if (value >= 20) return HITL_LEVELS.MOSTLY_AUTONOMOUS;
    return HITL_LEVELS.FULL_AUTONOMY;
}

// =============================================================================
// PRIORITY LEVELS
// =============================================================================

export const PRIORITIES = {
    LOW: { icon: '🔽', label: 'Low', color: 'var(--text-muted)', weight: 1 },
    NORMAL: { icon: '➖', label: 'Normal', color: 'var(--accent-blue)', weight: 2 },
    HIGH: { icon: '🔼', label: 'High', color: 'var(--accent-gold)', weight: 3 },
    CRITICAL: { icon: '🔺', label: 'Critical', color: 'var(--accent-red)', weight: 4 },
} as const;

export type Priority = keyof typeof PRIORITIES;

// =============================================================================
// CLI COMMANDS
// =============================================================================

export const CLI_COMMANDS = {
    spawn: {
        usage: 'spawn <type> "<name>" [tier=N]',
        description: 'Create a new agent',
        examples: ['spawn worker "DataAnalyst" tier=2', 'spawn planner "Strategist"'],
    },
    task: {
        usage: 'task "<description>" [priority=normal|high|critical]',
        description: 'Create a new task for agents',
        examples: ['task "Analyze Q4 sales data" priority=high'],
    },
    approve: {
        usage: 'approve <id>',
        description: 'Approve a pending request',
        examples: ['approve req-123'],
    },
    deny: {
        usage: 'deny <id> [reason]',
        description: 'Deny a pending request',
        examples: ['deny req-123 "Insufficient context"'],
    },
    status: {
        usage: 'status',
        description: 'Show system overview',
        examples: ['status'],
    },
    agents: {
        usage: 'agents [filter]',
        description: 'List all agents',
        examples: ['agents', 'agents working', 'agents tier=3'],
    },
    agent: {
        usage: 'agent <id|name>',
        description: 'Show agent details',
        examples: ['agent exec-1', 'agent "T5-EXECUTOR"'],
    },
    hitl: {
        usage: 'hitl <level>',
        description: 'Set governance level (0-100)',
        examples: ['hitl 50', 'hitl 80'],
    },
    tick: {
        usage: 'tick',
        description: 'Run agent work cycle',
        examples: ['tick'],
    },
    clear: {
        usage: 'clear',
        description: 'Clear console output',
        examples: ['clear'],
    },
    help: {
        usage: 'help [command]',
        description: 'Show available commands',
        examples: ['help', 'help spawn'],
    },
} as const;

export type CLICommand = keyof typeof CLI_COMMANDS;

// =============================================================================
// APPROVAL TYPES
// =============================================================================

export const APPROVAL_TYPES = {
    SPAWN: { icon: '🏭', label: 'Spawn Agent', riskLevel: 'medium' },
    DECISION: { icon: '⚖️', label: 'Decision', riskLevel: 'low' },
    STRATEGY: { icon: '🎯', label: 'Strategy', riskLevel: 'high' },
    CODE_CHANGE: { icon: '💻', label: 'Code Change', riskLevel: 'high' },
    DELEGATION: { icon: '🔀', label: 'Delegation', riskLevel: 'medium' },
    CAPABILITY: { icon: '🔑', label: 'Capability Grant', riskLevel: 'high' },
} as const;

export type ApprovalType = keyof typeof APPROVAL_TYPES;

// =============================================================================
// RISK LEVELS
// =============================================================================

export const RISK_LEVELS = {
    low: { color: 'var(--accent-green)', label: 'Low Risk' },
    medium: { color: 'var(--accent-gold)', label: 'Medium Risk' },
    high: { color: 'var(--accent-red)', label: 'High Risk' },
} as const;

// =============================================================================
// TIME FORMATTING
// =============================================================================

export function formatTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function formatUptime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function formatRelativeTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 60) return 'just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
}
