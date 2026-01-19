export type AgentStatus = 'IDLE' | 'WORKING' | 'IN_MEETING' | 'ERROR' | 'TERMINATED';
export type AgentType = 'EXECUTOR' | 'PLANNER' | 'VALIDATOR' | 'EVOLVER' | 'SPAWNER' | 'LISTENER' | 'WORKER' | 'SITTER' | 'SPECIALIST' | 'ORCHESTRATOR';

// ============================================================================
// TRUST TIER SYSTEM - Anti-Delegation Rules
// ============================================================================

export enum TrustTier {
    UNTRUSTED = 0,
    PROBATIONARY = 1,
    TRUSTED = 2,
    VERIFIED = 3,
    CERTIFIED = 4,
    ELITE = 5,
}

export const TIER_CONFIG = {
    [TrustTier.UNTRUSTED]: {
        name: 'Untrusted',
        color: '#6b7280',
        threshold: 0,
        canDelegate: false,
        canSpawn: false,
        maxConcurrentTasks: 1,
    },
    [TrustTier.PROBATIONARY]: {
        name: 'Probationary',
        color: '#f59e0b',
        threshold: 200,
        canDelegate: false,
        canSpawn: false,
        maxConcurrentTasks: 1,
    },
    [TrustTier.TRUSTED]: {
        name: 'Trusted',
        color: '#3b82f6',
        threshold: 400,
        canDelegate: false,
        canSpawn: false,
        maxConcurrentTasks: 3,
    },
    [TrustTier.VERIFIED]: {
        name: 'Verified',
        color: '#8b5cf6',
        threshold: 600,
        canDelegate: true,
        canSpawn: false,
        maxConcurrentTasks: 5,
    },
    [TrustTier.CERTIFIED]: {
        name: 'Certified',
        color: '#10b981',
        threshold: 800,
        canDelegate: true,
        canSpawn: true,
        maxConcurrentTasks: 10,
    },
    [TrustTier.ELITE]: {
        name: 'Elite',
        color: '#f43f5e',
        threshold: 950,
        canDelegate: true,
        canSpawn: true,
        maxConcurrentTasks: Infinity,
    },
} as const;

export const EXECUTION_RULES = {
    MAX_DELEGATIONS: 2,
    TRUST_REWARDS: {
        TASK_COMPLETED: 10,
        TASK_REVIEWED_GOOD: 5,
        SUBTASK_COMPLETED: 3,
    },
    TRUST_PENALTIES: {
        TASK_FAILED: -15,
        TASK_TIMEOUT: -10,
        INVALID_DELEGATION: -20,
        EXCESSIVE_DELEGATION: -25,
    },
} as const;

// ============================================================================
// AGENT CAPABILITIES - 8 Core Capabilities
// ============================================================================

export type CapabilityId = 
    | 'execute'    // Run tasks directly
    | 'delegate'   // Assign tasks to others
    | 'spawn'      // Create new agents
    | 'approve'    // Approve other agents' actions
    | 'enhance'    // Train/upgrade other agents
    | 'external'   // Call external APIs
    | 'write'      // Modify system data
    | 'sensitive'; // Access sensitive data

export interface AgentCapability {
    id: CapabilityId;
    name: string;
    icon: string;
    description: string;
    requiredTier: number;      // Minimum tier (1-5)
    requiredTrust?: number;    // Minimum trust score (0-100)
}

export const CAPABILITIES: Record<CapabilityId, AgentCapability> = {
    execute: {
        id: 'execute',
        name: 'Execute',
        icon: '⚡',
        description: 'Run tasks directly',
        requiredTier: 1,
    },
    delegate: {
        id: 'delegate',
        name: 'Delegate',
        icon: '🔀',
        description: 'Assign tasks to others',
        requiredTier: 3,
    },
    spawn: {
        id: 'spawn',
        name: 'Spawn',
        icon: '🥚',
        description: 'Create new agents',
        requiredTier: 4,
    },
    approve: {
        id: 'approve',
        name: 'Approve',
        icon: '✅',
        description: 'Approve other actions',
        requiredTier: 4,
    },
    enhance: {
        id: 'enhance',
        name: 'Enhance',
        icon: '🎓',
        description: 'Train/upgrade agents',
        requiredTier: 3,
    },
    external: {
        id: 'external',
        name: 'External',
        icon: '🌐',
        description: 'Call external APIs',
        requiredTier: 1,
        requiredTrust: 70,
    },
    write: {
        id: 'write',
        name: 'Write',
        icon: '💾',
        description: 'Modify system data',
        requiredTier: 1,
        requiredTrust: 50,
    },
    sensitive: {
        id: 'sensitive',
        name: 'Sensitive',
        icon: '🔐',
        description: 'Access sensitive data',
        requiredTier: 3,
    },
};

// Helper: Get all capabilities with enabled/disabled status for an agent
export function getAgentCapabilities(tier: number, trustScore: number): Array<AgentCapability & { enabled: boolean }> {
    return Object.values(CAPABILITIES).map(cap => ({
        ...cap,
        enabled: tier >= cap.requiredTier && (!cap.requiredTrust || trustScore >= cap.requiredTrust),
    }));
}

// ============================================================================
// SKILLS & SPECIALIZATIONS
// ============================================================================

export type SkillCategory = 'DOMAIN' | 'TECHNICAL' | 'OPERATIONS' | 'INTEGRATION';

export interface Skill {
    id: string;
    category: SkillCategory;
    name: string;
    description: string;
    icon: string;
    requiredTier: number;
}

export const SKILLS: Record<string, Skill> = {
    'web-dev': { id: 'web-dev', category: 'TECHNICAL', name: 'Web Development', description: 'Frontend/backend web', icon: '🌐', requiredTier: 1 },
    'data-analysis': { id: 'data-analysis', category: 'TECHNICAL', name: 'Data Analysis', description: 'Data processing/insights', icon: '📊', requiredTier: 2 },
    'api-integration': { id: 'api-integration', category: 'INTEGRATION', name: 'API Integration', description: 'Connect external APIs', icon: '🔌', requiredTier: 2 },
    'doc-writing': { id: 'doc-writing', category: 'OPERATIONS', name: 'Documentation', description: 'Write docs/reports', icon: '📝', requiredTier: 1 },
    'code-review': { id: 'code-review', category: 'OPERATIONS', name: 'Code Review', description: 'Review/improve code', icon: '🔍', requiredTier: 2 },
    'security': { id: 'security', category: 'TECHNICAL', name: 'Security', description: 'Security scanning', icon: '🛡️', requiredTier: 3 },
    'finance': { id: 'finance', category: 'DOMAIN', name: 'Finance', description: 'Financial operations', icon: '💰', requiredTier: 3 },
    'marketing': { id: 'marketing', category: 'DOMAIN', name: 'Marketing', description: 'Marketing tasks', icon: '📣', requiredTier: 2 },
    'customer-service': { id: 'customer-service', category: 'DOMAIN', name: 'Customer Service', description: 'Support tasks', icon: '🎧', requiredTier: 1 },
    'llm-prompting': { id: 'llm-prompting', category: 'TECHNICAL', name: 'LLM Prompting', description: 'Optimize AI prompts', icon: '🤖', requiredTier: 2 },
};

// Helper: Get skill by ID
export function getSkill(skillId: string): Skill | undefined {
    return SKILLS[skillId];
}

// Helper: Get skills by category
export function getSkillsByCategory(category: SkillCategory): Skill[] {
    return Object.values(SKILLS).filter(s => s.category === category);
}

// Helper: Get tier from trust score
export function getTierFromScore(score: number): TrustTier {
    for (const tier of [
        TrustTier.ELITE,
        TrustTier.CERTIFIED,
        TrustTier.VERIFIED,
        TrustTier.TRUSTED,
        TrustTier.PROBATIONARY,
    ]) {
        if (score >= TIER_CONFIG[tier].threshold) {
            return tier;
        }
    }
    return TrustTier.UNTRUSTED;
}

// Helper: Check if agent must execute (cannot delegate)
export function mustAgentExecute(agent: Agent, task: Task): boolean {
    const tier = getTierFromScore(agent.trustScore);
    // Low tiers must execute
    if (!TIER_CONFIG[tier].canDelegate) return true;
    // Max delegations reached
    if ((task.currentDelegations || 0) >= EXECUTION_RULES.MAX_DELEGATIONS) return true;
    return false;
}

export interface AgentLocation {
    floor: 'EXECUTIVE' | 'OPERATIONS' | 'WORKSPACE';
    room: string;
}

export interface AgentTrustTrend {
    direction: 'rising' | 'stable' | 'falling';
    percentChange: number;
    history?: number[];             // 7-day history for trend calculation
}

export interface Agent {
    id: string;
    structuredId?: string;          // 6-digit ID (TRCCII format)
    name: string;
    type: AgentType;
    tier: number;
    status: AgentStatus;
    location: AgentLocation;
    trustScore: number;
    trustTrend?: AgentTrustTrend;   // Optional trust score trend data
    capabilities: string[];
    skills?: string[];
    parentId: string | null;
    parentStructuredId?: string;
    childIds?: string[];
    createdByStructuredId?: string; // HITL or agent that created this
}

// ============================================================================
// HITL (Human-In-The-Loop) Entity
// ============================================================================

export interface HITLUser {
    id: string;
    structuredId: string;           // 4-digit ID (9XAI format)
    name: string;
    authority: number;              // 1-9 (9=CEO)
    area: number;                   // 0=All, 1-9 specific areas
    status: 'ONLINE' | 'AWAY' | 'OFFLINE';
    spawnedAgentIds?: string[];
}

export interface BlackboardEntry {
    id: string;
    type: 'PROBLEM' | 'SOLUTION' | 'DECISION' | 'OBSERVATION' | 'TASK' | 'PATTERN';
    title: string;
    author: string;
    content: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'ARCHIVED';
    timestamp: Date;
    comments?: { author: string; text: string; timestamp: Date | string }[];
}

export interface ChatMessage {
    id: string;
    channelId: string;
    senderId: string;
    content: string;
    timestamp: string;
    type: 'TEXT' | 'CODE' | 'ALERT';
}

export interface ChatChannel {
    id: string;
    name: string;
    type: 'PUBLIC' | 'DM';
    participants?: string[];
}

export interface Meeting {
    id: string;
    title: string;
    participants: string[];
    location: string;
    status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED';
}

export interface SystemState {
    agents: Agent[];
    blackboardEntries: BlackboardEntry[];
    meetings: Meeting[];
    hitlLevel: number;
    avgTrust: number;
    totalAgents: number;
    uptime: number;
    persistenceMode?: 'postgres' | 'memory';
}

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
    description: string;
    type: string;
    creator: string;
    priority: string;
    status: string;
    assignee: string | null;
    assigneeName: string | null;
    progress: number;
    nextSteps: string;
    createdAt: string;
    updatedAt: string;
    // Anti-delegation tracking
    requiredTier?: TrustTier;
    maxDelegations?: number;
    currentDelegations?: number;
    delegationHistory?: Array<{ from: string; to: string; timestamp: string }>;
    // Execution results
    result?: TaskResult;
    startedAt?: string;
    completedAt?: string;
}

export interface ApprovalRequest {
    id: string;
    type: 'SPAWN' | 'DECISION' | 'STRATEGY';
    requestor: string;
    summary: string;
    details: unknown;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    createdAt: string;
}

// ============================================================================
// ACTION REQUEST (Story 2.1 - Task Pipeline Module)
// ============================================================================

export type ActionRequestUrgency = 'immediate' | 'queued';
export type ActionRequestStatus = 'pending' | 'approved' | 'denied' | 'cancelled' | 'expired';

export interface ActionRequest {
    id: string;
    orgId: string;
    agentId: string;
    agentName: string;
    actionType: string;
    actionPayload?: Record<string, unknown>;
    status: ActionRequestStatus;
    urgency: ActionRequestUrgency;
    queuedReason?: string;
    trustGateRules?: string[];
    priority: number;

    // Decision tracking
    decidedBy?: string;
    decidedAt?: string;
    decisionReason?: string;

    // Timestamps
    createdAt: string;
    updatedAt: string;

    // Computed fields (from API)
    timeInQueue?: string;
}

export interface ActionRequestCounts {
    immediate: number;
    queued: number;
    total: number;
}

export interface QueueResponse {
    queue: ActionRequest[];
    counts: ActionRequestCounts;
}

// ============================================================================
// EXECUTING TASK (Story 2.7 - Task Execution Progress)
// ============================================================================

export type ExecutingTaskStatus = 'executing' | 'completed' | 'failed' | 'cancelled';

export interface ExecutingTask {
    id: string;
    decisionId: string;
    agentId: string;
    agentName: string;
    actionType: string;
    status: ExecutingTaskStatus;
    progress: number; // 0-100
    startedAt: string;
    completedAt?: string;
    estimatedCompletion?: string;
    currentStep?: string;
    error?: string;
    duration?: string; // Human-readable duration
}

export interface ExecutingTaskCounts {
    executing: number;
    completed: number;
    failed: number;
}

export interface ExecutingTasksResponse {
    tasks: ExecutingTask[];
    counts: ExecutingTaskCounts;
}

// ============================================================================
// BOT TRIBUNAL (Story 3.1 - Tribunal Voting Records)
// ============================================================================

export type TribunalVoteType = 'approve' | 'deny' | 'abstain';
export type TribunalConsensus = 'unanimous' | 'majority' | 'split' | 'deadlock';
export type TribunalStatus = 'pending' | 'completed' | 'overridden';

export interface TribunalVote {
    id: string;
    agentId: string;
    agentName: string;
    vote: TribunalVoteType;
    reasoning: string;
    confidence: number; // 0.00 to 1.00
    votedAt: string;
    dissenting?: boolean;
}

export interface TribunalSummary {
    approveCount: number;
    denyCount: number;
    abstainCount: number;
    totalVotes: number;
    averageConfidence: number;
}

export interface TribunalRecord {
    decisionId: string;
    tribunalId: string;
    status: TribunalStatus;
    finalRecommendation: TribunalVoteType;
    consensus: TribunalConsensus;
    votedAt: string;
    votes: TribunalVote[];
    summary: TribunalSummary;
}

// ============================================================================
// TRUST GATE (Story 3.2 - Trust Gate Decision Explanations)
// ============================================================================

export type TrustGateRuleType =
    | 'trust_score_threshold'
    | 'risk_level'
    | 'action_type'
    | 'tier_permission'
    | 'rate_limit'
    | 'first_time_action';

export interface TrustGateRule {
    id: string;
    type: TrustGateRuleType;
    name: string;
    description: string;
    threshold?: number;
    currentValue?: number;
    exceeded: boolean;
    isPrimary?: boolean;
}

export interface TrustGateExplanation {
    decisionId: string;
    agentId: string;
    agentName: string;
    agentTier: number;
    agentTrustScore: number;
    rules: TrustGateRule[];
    summary: string;
}

// ============================================================================
// HITL OVERRIDE (Story 3.3 - Override with Rationale)
// ============================================================================

export type OverrideType = 'approve' | 'deny';

export interface OverrideRequest {
    decisionId: string;
    rationale: string;
    overrideType: OverrideType;
}

export interface OverrideRecord {
    id: string;
    decisionId: string;
    tribunalId: string;
    overriddenBy: string;
    overriddenByName: string;
    overrideType: OverrideType;
    originalRecommendation: TribunalVoteType;
    rationale: string;
    overriddenAt: string;
}

export interface TribunalRecordWithOverride extends TribunalRecord {
    override?: OverrideRecord;
}

// ============================================================================
// GOVERNANCE RULES (Story 3.4 - Director Rule Approval)
// ============================================================================

export type GovernanceRuleType =
    | 'trust_threshold'
    | 'action_permission'
    | 'rate_limit'
    | 'tier_requirement'
    | 'time_restriction';

export type GovernanceRuleStatus = 'draft' | 'pending' | 'approved' | 'denied' | 'archived';

export interface GovernanceRuleDefinition {
    type: GovernanceRuleType;
    threshold?: number;
    actions?: string[];
    tierRequired?: number;
    schedule?: { start: string; end: string };
    description: string;
}

export interface GovernanceRuleImpact {
    affectedAgentCount: number;
    estimatedApprovalRateChange: number; // -100 to +100
    affectedActionTypes: string[];
    riskLevel: 'low' | 'medium' | 'high';
}

export interface GovernanceRule {
    id: string;
    orgId: string;
    name: string;
    status: GovernanceRuleStatus;
    version: number;
    currentDefinition: GovernanceRuleDefinition;
    proposedDefinition?: GovernanceRuleDefinition;
    impact?: GovernanceRuleImpact;

    // Proposal tracking
    proposedBy: string;
    proposedByName: string;
    proposedAt: string;
    proposalReason: string;

    // Decision tracking
    decidedBy?: string;
    decidedByName?: string;
    decidedAt?: string;
    decisionReason?: string;

    createdAt: string;
    updatedAt: string;
}

export interface GovernanceRuleDecision {
    ruleId: string;
    action: 'approve' | 'deny';
    reason: string;
}

export interface GovernanceRuleCounts {
    pending: number;
    approved: number;
    denied: number;
}

export interface GovernanceRulesResponse {
    rules: GovernanceRule[];
    counts: GovernanceRuleCounts;
}

// ============================================================================
// AUDIT TRAIL (Story 4.1 - Record Review Module)
// ============================================================================

export type AuditActionType =
    | 'decision_approved'
    | 'decision_denied'
    | 'task_started'
    | 'task_completed'
    | 'task_failed'
    | 'agent_spawned'
    | 'agent_terminated'
    | 'trust_changed'
    | 'override_applied'
    | 'investigation_started';

export type AuditOutcome = 'success' | 'failure' | 'pending' | 'cancelled';

export type HashStatus = 'verified' | 'unverified' | 'invalid' | 'checking';

export interface AuditEntry {
    id: string;
    orgId: string;
    timestamp: string;
    agentId: string;
    agentName: string;
    actionType: AuditActionType;
    actionDetails: string;
    outcome: AuditOutcome;
    hashStatus: HashStatus;
    currentHash: string;
    previousHash: string;
    hashAlgorithm: string;
    // Accountability chain
    actingAgentId: string;
    supervisingAgentId?: string;
    hitlReviewerId?: string;
    tribunalIds?: string[];
    governanceOwnerId?: string;
}

export interface AuditFilters {
    startDate?: string;
    endDate?: string;
    agentId?: string;
    actionType?: AuditActionType;
    outcome?: AuditOutcome;
}

export interface AuditResponse {
    entries: AuditEntry[];
    cursor?: string;
    hasMore: boolean;
    total: number;
}

// ============================================================================
// HASH CHAIN VERIFICATION (Story 4.2 - Hash Badges)
// ============================================================================

export interface HashVerification {
    entryId: string;
    status: HashStatus;
    currentHash: string;
    previousHash: string;
    expectedHash: string;
    algorithm: string;
    verifiedAt?: string;
    chainIntact: boolean;
    error?: string;
}

// ============================================================================
// ACCOUNTABILITY CHAIN (Story 4.3 - Five-Level Display)
// ============================================================================

export interface AccountabilityLevel {
    level: 1 | 2 | 3 | 4 | 5;
    title: string;
    entityId?: string;
    entityName?: string;
    entityType: 'agent' | 'hitl' | 'tribunal' | 'governance' | 'na';
    applicable: boolean;
    reason?: string;
}

export interface AccountabilityChain {
    entryId: string;
    levels: AccountabilityLevel[];
}

// ============================================================================
// HITL QUALITY METRICS (Story 4.4 - Quality Dashboard)
// ============================================================================

export interface HITLQualityMetrics {
    userId: string;
    userName: string;
    period: string;
    avgReviewTimeMs: number;
    detailViewRate: number;
    sampleDataViewRate: number;
    avgScrollDepth: number;
    totalDecisions: number;
    automationBiasRisk: 'low' | 'medium' | 'high';
}

export interface HITLMetricsSummary {
    orgId: string;
    period: string;
    avgReviewTimeMs: number;
    detailViewRate: number;
    avgDetailViewRate: number;
    sampleDataViewRate: number;
    operatorCount: number;
    totalOperators: number;
    totalDecisions: number;
    biasAlertCount: number;
    operatorsByRisk: {
        low: number;
        medium: number;
        high: number;
    };
}

// ============================================================================
// AUTOMATION BIAS ALERTS (Story 4.5 - Tamper-Proof Indicators)
// ============================================================================

export type BiasAlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type BiasAlertStatus = 'active' | 'acknowledged' | 'resolved' | 'dismissed';

export interface AutomationBiasAlert {
    id: string;
    orgId: string;
    userId: string;
    userName: string;
    severity: BiasAlertSeverity;
    status: BiasAlertStatus;
    reason: string;
    metrics: {
        avgReviewTimeMs: number;
        decisionCount: number;
        detailViewRate: number;
    };
    detectedAt: string;
    acknowledgedAt?: string;
    resolvedAt?: string;
}

export interface TamperProofIndicator {
    entryId: string;
    protected: boolean;
    hashVerified: boolean;
    serverTimestamp: string;
    chainIntact: boolean;
    lastVerifiedAt?: string;
}

// ============================================================================
// CUSTOMER DATA TRAIL SEARCH (Story 5.1)
// ============================================================================

export interface CustomerDataTrailEntry {
    id: string;
    timestamp: string;
    actionType: AuditActionType;
    agentId: string;
    agentName: string;
    customerId: string;
    dataCategory: string;
    operation: 'read' | 'write' | 'delete' | 'export';
    recordCount: number;
    hashStatus: HashStatus;
    accountabilityChainId: string;
}

export interface CustomerDataTrailFilters {
    customerId: string;
    startDate?: string;
    endDate?: string;
    dataCategory?: string;
    operation?: 'read' | 'write' | 'delete' | 'export';
    agentId?: string;
}

export interface CustomerDataTrailResponse {
    entries: CustomerDataTrailEntry[];
    cursor?: string;
    hasMore: boolean;
    total: number;
    customerId: string;
    searchedFrom: string;
    searchedTo: string;
}

// ============================================================================
// EVIDENCE PACKAGE (Story 5.2)
// ============================================================================

export type EvidencePackageStatus = 'generating' | 'ready' | 'expired' | 'failed';
export type EvidencePackageFormat = 'pdf' | 'json' | 'csv';

export interface EvidencePackageRequest {
    customerId: string;
    startDate: string;
    endDate: string;
    includeRawData: boolean;
    format: EvidencePackageFormat;
    requestedBy: string;
    reason: string;
}

export interface HashIntegrityReport {
    totalEntries: number;
    verifiedCount: number;
    unverifiedCount: number;
    invalidCount: number;
    chainIntact: boolean;
    firstEntryHash: string;
    lastEntryHash: string;
    verificationTimestamp: string;
}

export interface EvidencePackage {
    id: string;
    orgId: string;
    customerId: string;
    status: EvidencePackageStatus;
    format: EvidencePackageFormat;
    requestedAt: string;
    generatedAt?: string;
    expiresAt?: string;
    downloadUrl?: string;
    requestedBy: string;
    reason: string;
    period: {
        startDate: string;
        endDate: string;
    };
    summary: {
        totalActions: number;
        agentsInvolved: number;
        dataCategories: string[];
        hitlDecisions: number;
    };
    hashIntegrity: HashIntegrityReport;
    error?: string;
}

export interface EvidencePackageListResponse {
    packages: EvidencePackage[];
    total: number;
}

// ============================================================================
// INVESTIGATION MANAGEMENT (Epic 6)
// Story 6.1: Initiate Investigation (FR31)
// Story 6.2: Expand Investigation Scope (FR32)
// Story 6.3: Link Related Events (FR33)
// Story 6.4: Rollback Review Capability (FR34)
// Story 6.5: Pattern Anomaly Detection (FR35)
// ============================================================================

export type InvestigationStatus = 'open' | 'in_progress' | 'pending_review' | 'closed' | 'merged';
export type InvestigationPriority = 'low' | 'medium' | 'high' | 'critical';
export type InvestigationType = 'suspicious_activity' | 'trust_violation' | 'data_anomaly' | 'pattern_alert' | 'manual';

export interface Investigation {
    id: string;
    orgId: string;
    title: string;
    description: string;
    type: InvestigationType;
    status: InvestigationStatus;
    priority: InvestigationPriority;
    createdAt: string;
    updatedAt: string;
    createdBy: string;
    assignedTo?: string;
    triggerEventId?: string;
    scope: InvestigationScope;
    linkedEvents: LinkedEvent[];
    findings: InvestigationFinding[];
    rollbacks: RollbackRecord[];
    anomalies: PatternAnomaly[];
    mergedInto?: string;
}

export interface InvestigationScope {
    agentIds: string[];
    timeRange: {
        start: string;
        end: string;
    };
    actionTypes: AuditActionType[];
    dataCategories?: string[];
    expanded: boolean;
    expansionHistory: ScopeExpansion[];
}

export interface ScopeExpansion {
    id: string;
    expandedAt: string;
    expandedBy: string;
    reason: string;
    addedAgents: string[];
    addedTimeRange?: { start: string; end: string };
    addedActionTypes?: AuditActionType[];
}

export interface LinkedEvent {
    id: string;
    eventId: string;
    eventType: 'audit_entry' | 'decision' | 'alert' | 'other_investigation';
    linkedAt: string;
    linkedBy: string;
    relationship: 'related' | 'cause' | 'effect' | 'duplicate';
    notes?: string;
}

export interface InvestigationFinding {
    id: string;
    timestamp: string;
    author: string;
    severity: 'info' | 'warning' | 'critical';
    title: string;
    description: string;
    affectedEntities: string[];
    recommendedAction?: string;
}

export interface RollbackRecord {
    id: string;
    investigationId: string;
    decisionId: string;
    originalOutcome: 'approved' | 'denied';
    rolledBackAt: string;
    rolledBackBy: string;
    reason: string;
    status: 'pending' | 'completed' | 'failed';
    affectedRecords: number;
    undoAvailable: boolean;
}

export interface PatternAnomaly {
    id: string;
    detectedAt: string;
    pattern: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    affectedAgents: string[];
    baseline: {
        metric: string;
        expectedValue: number;
        actualValue: number;
        deviationPercent: number;
    };
    status: 'new' | 'investigating' | 'confirmed' | 'dismissed';
}

export interface InvestigationListResponse {
    investigations: Investigation[];
    total: number;
    cursor?: string;
    hasMore: boolean;
}

export interface InvestigationCreateRequest {
    title: string;
    description: string;
    type: InvestigationType;
    priority: InvestigationPriority;
    triggerEventId?: string;
    initialAgentIds: string[];
    timeRange: { start: string; end: string };
}

// ============================================================================
// TEAM & EXECUTIVE DASHBOARDS (Epic 7)
// Story 7.1: Supervisor View - Team Operators (FR36)
// Story 7.2: Cross-Operator Activity Patterns (FR37)
// Story 7.3: Team Decision Metrics (FR38)
// Story 7.4: Executive View - Fleet Health KPIs (FR39, FR40, FR41)
// Story 7.5: HITL Load & Autonomous Rate Metrics (FR42, FR43)
// Story 7.6: Active Incidents & Cost Avoided (FR44, FR45)
// ============================================================================

// Story 7.1: Team Operators
export interface TeamOperator {
    id: string;
    name: string;
    role: string;
    status: 'online' | 'away' | 'offline';
    lastActive: string;
    pendingReviews: number;
    completedToday: number;
    avgResponseTime: number; // ms
    qualityScore: number; // 0-100
}

export interface SupervisorTeamView {
    supervisorId: string;
    supervisorName: string;
    teamSize: number;
    operators: TeamOperator[];
    onlineCount: number;
    pendingTotal: number;
    avgTeamQuality: number;
}

// Story 7.2: Cross-Operator Activity Patterns
export interface OperatorActivityPattern {
    operatorId: string;
    operatorName: string;
    timeBlock: string; // e.g., "09:00-10:00"
    reviewCount: number;
    approvalRate: number;
    avgReviewTime: number;
    deviationFromTeamAvg: number; // percent deviation
}

export interface CrossOperatorPatterns {
    period: { start: string; end: string };
    patterns: OperatorActivityPattern[];
    teamAverages: {
        avgApprovalRate: number;
        avgReviewTime: number;
        avgReviewsPerHour: number;
    };
    outliers: Array<{
        operatorId: string;
        operatorName: string;
        metric: string;
        deviation: number;
        severity: 'low' | 'medium' | 'high';
    }>;
}

// Story 7.3: Team Decision Metrics
export interface TeamDecisionMetrics {
    period: { start: string; end: string };
    totalDecisions: number;
    approvalRate: number;
    denialRate: number;
    avgReviewTime: number;
    byOperator: Array<{
        operatorId: string;
        operatorName: string;
        decisions: number;
        approvalRate: number;
        avgReviewTime: number;
    }>;
    byDecisionType: Array<{
        type: string;
        count: number;
        approvalRate: number;
    }>;
    trend: Array<{
        date: string;
        decisions: number;
        approvalRate: number;
    }>;
}

// Story 7.4: Executive Fleet Health KPIs
export interface FleetHealthKPIs {
    timestamp: string;
    totalAgents: number;
    activeAgents: number;
    avgTrustScore: number;
    trustDistribution: Record<string, number>; // tier -> count
    healthIndicators: {
        overall: 'healthy' | 'warning' | 'critical';
        trustTrend: 'improving' | 'stable' | 'declining';
        riskLevel: 'low' | 'medium' | 'high';
    };
    kpis: Array<{
        name: string;
        value: number;
        unit: string;
        target: number;
        status: 'above_target' | 'on_target' | 'below_target';
        trend: number; // percent change
    }>;
}

// Story 7.5: HITL Load & Autonomous Rate
export interface HITLLoadMetrics {
    period: { start: string; end: string };
    totalDecisions: number;
    hitlRequired: number;
    autonomousDecisions: number;
    autonomousRate: number; // 0-100
    hitlLoadByHour: Array<{
        hour: string;
        count: number;
        avgWaitTime: number;
    }>;
    capacityUtilization: number;
    queueHealth: 'healthy' | 'backlogged' | 'overloaded';
}

// Story 7.6: Active Incidents & Cost Avoided
export interface ActiveIncident {
    id: string;
    title: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    status: 'active' | 'investigating' | 'mitigating' | 'resolved';
    startedAt: string;
    assignedTo: string;
    affectedAgents: number;
    potentialImpact: number; // estimated cost
}

export interface CostAvoidedMetrics {
    period: { start: string; end: string };
    totalCostAvoided: number;
    byCategory: Array<{
        category: string;
        amount: number;
        incidents: number;
    }>;
    byMonth: Array<{
        month: string;
        amount: number;
    }>;
    topPreventedIncidents: Array<{
        type: string;
        estimatedCost: number;
        preventedCount: number;
    }>;
}

export interface IncidentSummary {
    activeCount: number;
    resolvingCount: number;
    resolvedLast24h: number;
    incidents: ActiveIncident[];
    costAvoided: CostAvoidedMetrics;
}

export interface ExecutiveDashboard {
    fleetHealth: FleetHealthKPIs;
    hitlLoad: HITLLoadMetrics;
    incidents: IncidentSummary;
    lastUpdated: string;
}

// ============================================================================
// ONBOARDING & EDUCATION (Epic 8)
// Story 8.1: Guided Tooltip Tour (FR46)
// Story 8.2: First Denial Learning Popup (FR47)
// Story 8.3: First Approval Request Learning (FR48)
// Story 8.4: Tier Change Learning (FR49)
// Story 8.5: On-Demand Trust Explanations (FR50)
// Story 8.6: Urgency Rule Configuration (FR54)
// ============================================================================

// Story 8.1: Tooltip Tour
export interface TourStep {
    id: string;
    target: string; // CSS selector
    title: string;
    content: string;
    placement: 'top' | 'bottom' | 'left' | 'right';
    order: number;
    spotlightPadding?: number;
}

export interface TourState {
    tourId: string;
    currentStep: number;
    completed: boolean;
    skipped: boolean;
    stepsViewed: string[];
}

export interface TourConfig {
    id: string;
    name: string;
    steps: TourStep[];
    autoStart: boolean;
    completionReward?: string;
}

// Story 8.2-8.4: Learning Popups
export type LearningEventType =
    | 'first_denial'
    | 'first_approval'
    | 'tier_change_up'
    | 'tier_change_down'
    | 'first_override'
    | 'first_investigation';

export interface LearningPopup {
    id: string;
    eventType: LearningEventType;
    title: string;
    content: string;
    tips: string[];
    learnMoreUrl?: string;
    dismissable: boolean;
    showOnce: boolean;
}

export interface UserLearningProgress {
    userId: string;
    seenPopups: string[];
    completedTours: string[];
    lastLearningEvent?: string;
    preferHints: boolean;
}

// Story 8.5: Trust Explanations
export interface TrustExplanation {
    topic: string;
    title: string;
    summary: string;
    details: string;
    relatedTopics: string[];
    examples?: Array<{
        scenario: string;
        explanation: string;
    }>;
}

export interface HelpPanelContent {
    contextId: string;
    explanations: TrustExplanation[];
    faqs: Array<{
        question: string;
        answer: string;
    }>;
}

// Story 8.6: Urgency Rules
export interface UrgencyRule {
    id: string;
    name: string;
    description: string;
    condition: {
        field: string;
        operator: 'equals' | 'greater_than' | 'less_than' | 'contains' | 'matches';
        value: string | number;
    };
    urgencyLevel: 'low' | 'medium' | 'high' | 'immediate';
    enabled: boolean;
    priority: number;
}

export interface UrgencyRuleConfig {
    orgId: string;
    defaultUrgency: 'low' | 'medium' | 'high';
    rules: UrgencyRule[];
    escalationTimeouts: {
        low: number;
        medium: number;
        high: number;
    };
}

export interface OnboardingState {
    tourState?: TourState;
    learningProgress: UserLearningProgress;
    activePopup?: LearningPopup;
    helpPanelOpen: boolean;
    helpPanelContext?: string;
}
