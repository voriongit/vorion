/**
 * Aurais System - Core Type Definitions
 *
 * These types define the fundamental structures used throughout
 * the holonic swarm intelligence system.
 */

// Import structured ID types
export * from './types/agentId.js';
import {
  AgentRole,
  AgentCategory,
  HITLAuthority,
  HITLArea,
  ParsedAgentId,
  ParsedHITLId,
} from './types/agentId.js';

// ============================================================================
// Trust System Types
// ============================================================================

export type TrustLevel =
    | 'SOVEREIGN'    // T5 - Full autonomy, system creators
    | 'EXECUTIVE'    // T4 - Domain autonomy
    | 'TACTICAL'     // T3 - Project scope
    | 'OPERATIONAL'  // T2 - Task execution
    | 'WORKER'       // T1 - Single task focus
    | 'PASSIVE';     // T0 - Observation only

export type AgentTier = 0 | 1 | 2 | 3 | 4 | 5;

export interface TrustScore {
    level: TrustLevel;
    numeric: number;           // 0-1000
    inherited: number;         // Trust inherited from parent
    earned: number;            // Trust earned through performance
    penalties: number;         // Trust lost through violations
    lastVerified: Date;
    parentId: string | null;   // Lineage tracking (null for T5)
}

export interface TrustPolicy {
    minScoreToSpawn: number;        // Minimum score to create children
    maxChildTier: AgentTier;        // Highest tier this agent can spawn
    requiresValidation: boolean;    // Must pass T5-Validator check
    canSelfModify: boolean;         // T5 only
    autonomyLevel: number;          // 0-100, affected by fading HITL
}

// ============================================================================
// Agent Types
// ============================================================================

export type AgentId = string;
export type AgentType =
    | 'EXECUTOR' | 'PLANNER' | 'VALIDATOR' | 'EVOLVER' | 'SPAWNER'  // T5
    | 'DOMAIN_ORCHESTRATOR'                                          // T4
    | 'TASK_ORCHESTRATOR'                                            // T3
    | 'SPECIALIST'                                                   // T2
    | 'WORKER'                                                       // T1
    | 'LISTENER' | 'OBSERVER';                                       // T0

export type AgentStatus =
    | 'INITIALIZING'
    | 'IDLE'
    | 'WORKING'
    | 'IN_MEETING'
    | 'WAITING_APPROVAL'
    | 'ERROR'
    | 'TERMINATED';

export interface AgentLocation {
    floor: 'EXECUTIVE' | 'OPERATIONS' | 'WORKSPACE';
    room: string;            // e.g., "OFFICE_A", "CONFERENCE_ROOM_1"
    position?: { x: number; y: number };
}

export interface Capability {
    id: string;
    name: string;
    description: string;
    requiredTier: AgentTier;
    parameters?: Record<string, unknown>;
}

export interface AgentBlueprint {
    id: AgentId;                          // UUID for internal references
    structuredId?: string;                // 6-digit ID (TRCCII format) - optional for backwards compat
    parsedId?: ParsedAgentId;             // Parsed structured ID components
    name: string;
    type: AgentType;
    role?: AgentRole;                     // Operational role (1-9)
    category?: AgentCategory;             // Functional category (10-99)
    tier: AgentTier;
    trustScore: TrustScore;
    trustPolicy: TrustPolicy;
    capabilities: Capability[];
    location: AgentLocation;
    status: AgentStatus;
    parentId: AgentId | null;
    parentStructuredId?: string | null;   // Parent's structured ID
    childIds: AgentId[];
    childStructuredIds?: string[];        // Children's structured IDs
    createdAt: Date;
    createdByStructuredId?: string;       // Creator's structured ID (HITL or agent)
    lastActiveAt: Date;
    metadata: Record<string, unknown>;
}

// ============================================================================
// Blackboard System Types
// ============================================================================

export type BlackboardEntryType =
    | 'PROBLEM'
    | 'HYPOTHESIS'
    | 'PARTIAL_SOLUTION'
    | 'SOLUTION'
    | 'DECISION'
    | 'PATTERN'
    | 'ANTI_PATTERN'
    | 'OBSERVATION'
    | 'TASK'
    | 'MEETING_REQUEST'
    | 'VOTING_SESSION';  // Tribunal peer review sessions

export type BlackboardEntryStatus =
    | 'OPEN'
    | 'IN_PROGRESS'
    | 'RESOLVED'
    | 'ARCHIVED'
    | 'BLOCKED';

export type BlackboardVisibility =
    | 'ALL'
    | 'SAME_TIER'
    | 'HIGHER_TIERS'
    | 'SPECIFIC_AGENTS';

export interface Contribution {
    agentId: AgentId;
    content: string;
    confidence: number;
    timestamp: Date;
}

export interface BlackboardEntry {
    id: string;
    type: BlackboardEntryType;
    title: string;
    author: AgentId;
    content: unknown;
    confidence: number;           // 0-100
    dependencies: string[];       // References to other entries
    contributions: Contribution[];
    status: BlackboardEntryStatus;
    visibility: BlackboardVisibility;
    visibleTo?: AgentId[];        // Only if visibility is SPECIFIC_AGENTS
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    createdAt: Date;
    updatedAt: Date;
    resolvedAt?: Date;
    resolution?: string;
}

// ============================================================================
// Communication Types
// ============================================================================

export type MessageType =
    | 'DIRECT'           // 1-to-1
    | 'BROADCAST'        // 1-to-many
    | 'TIER_BROADCAST'   // To all agents of a tier
    | 'REQUEST'          // Expecting response
    | 'RESPONSE'         // Reply to request
    | 'EMERGENCY';       // High priority

export interface Message {
    id: string;
    type: MessageType;
    from: AgentId;
    to: AgentId | AgentId[] | AgentTier;
    subject: string;
    content: unknown;
    requiresResponse: boolean;
    responseDeadline?: Date;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    timestamp: Date;
    threadId?: string;        // For conversation tracking
    replyTo?: string;         // Message ID being replied to
}

// ============================================================================
// Spawn System Types
// ============================================================================

export interface SpawnConstraint {
    type: 'TRUST_MINIMUM' | 'APPROVAL_REQUIRED' | 'DOMAIN_LOCK' | 'TIME_LIMIT';
    value: unknown;
}

export interface SpawnRequest {
    id: string;
    requestor: AgentId;
    template: AgentType;
    purpose: string;
    name: string;
    capabilities: Capability[];
    trustBudget: number;
    constraints: SpawnConstraint[];
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    requestedAt: Date;
    metadata?: Record<string, unknown>;
}

export interface ValidationReport {
    isValid: boolean;
    trustScore: number;
    warnings: string[];
    errors: string[];
    recommendations: string[];
    validatedBy: AgentId;
    validatedAt: Date;
}

export interface SpawnResult {
    success: boolean;
    agent?: AgentBlueprint;
    trustAllocation?: number;
    validationReport: ValidationReport;
    rejectionReason?: string;
    spawnedAt?: Date;
}

// ============================================================================
// HITL Types
// ============================================================================

/**
 * Human-In-The-Loop Entity
 *
 * HITL ID Format: 9XAI (4 digits)
 * - 9:  HITL marker (always 9)
 * - X:  Authority level (9=CEO, 8=Exec, 7=Manager, etc.)
 * - A:  Area of guidance (0=All, 1=Strategy, etc.)
 * - I:  Instance number
 */
export interface HITLEntity {
    id: string;                           // UUID for internal references
    structuredId: string;                 // 4-digit HITL ID (9XAI format)
    parsedId?: ParsedHITLId;              // Parsed structured ID components
    name: string;
    authority: HITLAuthority;             // Authority level (1-9, 9=CEO)
    area: HITLArea;                       // Area of guidance
    email?: string;
    createdAt: Date;
    lastActiveAt: Date;
    spawnedAgentIds: string[];            // Structured IDs of agents spawned by this HITL
    metadata: Record<string, unknown>;
}

export interface HITLApproval {
    id: string;
    type: 'SPAWN' | 'DECISION' | 'STRATEGY' | 'EMERGENCY';
    requestor: AgentId;
    summary: string;
    details: unknown;
    urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    requestedAt: Date;
    deadline?: Date;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
    response?: {
        decision: 'APPROVED' | 'REJECTED';
        reason?: string;
        respondedAt: Date;
    };
}

export interface DailyReport {
    id: string;
    date: Date;
    generatedBy: AgentId;
    generatedAt: Date;

    // Activity Summary
    decisions: Array<{
        id: string;
        agent: AgentId;
        summary: string;
        reasoning: string;
        outcome?: string;
    }>;

    meetings: Array<{
        id: string;
        participants: AgentId[];
        topic: string;
        outcome: string;
        duration: number; // minutes
    }>;

    spawns: Array<{
        parentId: AgentId;
        childId: AgentId;
        childName: string;
        purpose: string;
    }>;

    // Metrics
    metrics: {
        totalDecisions: number;
        totalMeetings: number;
        totalSpawns: number;
        activeAgents: number;
        blackboardEntries: number;
        resolvedProblems: number;
        pendingApprovals: number;
    };

    // Future Plans
    tomorrowPlan: {
        objectives: string[];
        scheduledMeetings: Array<{ time: string; topic: string; participants: AgentId[] }>;
        pendingDecisions: string[];
    };

    // Recommendations
    recommendations: string[];
    anomalies: string[];

    // HITL Metrics
    hitlMetrics: {
        currentLevel: number;      // 0-100
        approvalsRequested: number;
        approvalsGranted: number;
        approvalsRejected: number;
        suggestedAdjustment?: number;
    };
}

// ============================================================================
// Meeting Types
// ============================================================================

export interface Meeting {
    id: string;
    title: string;
    organizer: AgentId;
    participants: AgentId[];
    location: 'CONFERENCE_ROOM_A' | 'CONFERENCE_ROOM_B' | 'VIDEO_CONFERENCE';
    status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
    agenda: string[];
    scheduledAt: Date;
    startedAt?: Date;
    endedAt?: Date;
    transcript: Array<{
        speaker: AgentId;
        content: string;
        timestamp: Date;
    }>;
    decisions: string[];
    actionItems: Array<{
        assignee: AgentId;
        task: string;
        deadline?: Date;
    }>;
}

// ============================================================================
// Memory Types
// ============================================================================

export interface MemoryEntry {
    id: string;
    agentId: AgentId;
    type: 'SHORT_TERM' | 'LONG_TERM' | 'EPISODIC' | 'SEMANTIC';
    category: string;
    content: unknown;
    importance: number;        // 0-100
    accessCount: number;
    createdAt: Date;
    lastAccessedAt: Date;
    expiresAt?: Date;          // For short-term memories
    associations: string[];    // Links to related memories
}

// ============================================================================
// Task Types
// ============================================================================

export type TaskStatus =
    | 'PENDING'
    | 'ASSIGNED'
    | 'IN_PROGRESS'
    | 'BLOCKED'
    | 'REVIEW'
    | 'COMPLETED'
    | 'FAILED';

/**
 * Structured task result for frontend/backend contract alignment.
 * Supports both success and failure cases.
 */
export interface TaskResult {
    /** Human-readable summary of what was accomplished */
    summary: string;
    /** Agent ID that completed the task */
    completedBy: string;
    /** Human-readable duration (e.g., "2m 30s") */
    duration: string;
    /** Confidence level 0-100 */
    confidence: number;
    /** Error message if task failed */
    error?: string;
    /** Additional result data (for extensibility) */
    data?: Record<string, unknown>;
}

export interface Task {
    id: string;
    title: string;
    description: string;
    createdBy: AgentId;
    assignedTo?: AgentId;
    collaborators: AgentId[];
    status: TaskStatus;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    tier: AgentTier;           // Minimum tier required
    dependencies: string[];    // Task IDs
    deadline?: Date;
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    result?: TaskResult;
    logs: Array<{
        timestamp: Date;
        agent: AgentId;
        action: string;
        details?: string;
    }>;
}

// ============================================================================
// Event Types
// ============================================================================

export type SystemEventType =
    | 'AGENT_SPAWNED'
    | 'AGENT_TERMINATED'
    | 'AGENT_MOVED'
    | 'DECISION_MADE'
    | 'MEETING_STARTED'
    | 'MEETING_ENDED'
    | 'BLACKBOARD_POSTED'
    | 'BLACKBOARD_RESOLVED'
    | 'TRUST_CHANGED'
    | 'HITL_REQUESTED'
    | 'HITL_RESPONDED'
    | 'DAILY_CHECKIN'
    | 'DAILY_REPORT'
    | 'ERROR'
    | 'WARNING';

export interface SystemEvent {
    id: string;
    type: SystemEventType;
    source: AgentId | 'SYSTEM';
    data: unknown;
    timestamp: Date;
}

// ============================================================================
// Enhanced Trust Scoring Types (TRUST-1.1)
// ============================================================================

export * from './core/types/trust.js';

// ============================================================================
// Cryptographic Audit Types (TRUST-2.1)
// ============================================================================

export * from './core/types/audit.js';

// ============================================================================
// Artifact Types
// ============================================================================

export * from './types/artifact.js';
