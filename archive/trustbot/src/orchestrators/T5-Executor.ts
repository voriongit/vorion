/**
 * T5-Executor: Supreme Commander
 * 
 * The highest authority in the Aurais system. Final decision-maker,
 * coordinator of all T5 orchestrators, and interface with HITL governance.
 * 
 * Responsibilities:
 * - Final approval on strategic decisions
 * - Cross-tier coordination
 * - Emergency shutdown authority
 * - Daily check-in coordination
 * - HITL escalation handling
 */

import { BaseAgent } from '../agents/BaseAgent.js';
import type {
    AgentId,
    AgentLocation,
    Task,
    Meeting,
    DailyReport,
    HITLApproval,
    SpawnRequest,
    SpawnResult,
} from '../types.js';
import { hitlGateway } from '../core/HITLGateway.js';
import { trustEngine } from '../core/TrustEngine.js';
import { blackboard } from '../core/Blackboard.js';

// ============================================================================
// Knowledge Base
// ============================================================================

const EXECUTOR_KNOWLEDGE = {
    role: 'Supreme Commander',
    tier: 5,

    decisionFrameworks: [
        {
            name: 'RAPID',
            description: 'Recommend, Agree, Perform, Input, Decide',
            steps: ['Gather recommendations', 'Seek agreement', 'Define performers', 'Collect input', 'Make decision'],
        },
        {
            name: 'OODA',
            description: 'Observe, Orient, Decide, Act',
            steps: ['Observe situation', 'Orient to context', 'Decide on action', 'Act decisively'],
        },
        {
            name: 'Consensus',
            description: 'Democratic decision with T5 council',
            steps: ['Propose action', 'Collect votes', 'Resolve conflicts', 'Execute decision'],
        },
    ],

    emergencyProtocols: [
        {
            level: 'YELLOW',
            trigger: 'Trust violation detected',
            actions: ['Alert T5-Validator', 'Suspend affected agent', 'Log incident'],
        },
        {
            level: 'ORANGE',
            trigger: 'Multiple trust violations or system anomaly',
            actions: ['Halt new spawns', 'Increase HITL level', 'Convene emergency meeting'],
        },
        {
            level: 'RED',
            trigger: 'Critical system failure or security breach',
            actions: ['Emergency shutdown', 'Preserve state', 'Notify HITL immediately'],
        },
    ],

    coordinationPatterns: [
        'Morning briefing with all T5 orchestrators',
        'Real-time status updates via blackboard',
        'Escalation path: T4 → T5-Planner → T5-Executor',
        'Cross-domain coordination through T5-Planner',
    ],

    hitlPolicies: [
        'All strategic decisions require HITL approval above 50% governance',
        'Emergency actions bypass HITL but require immediate notification',
        'Daily reports summarize all decisions for HITL review',
        'Governance level adjustments require HITL approval',
    ],
};

// ============================================================================
// T5-Executor Class
// ============================================================================

export class T5Executor extends BaseAgent {
    private t5Agents: Map<string, AgentId> = new Map(); // role -> agentId
    private pendingApprovals: Map<string, SpawnRequest> = new Map();
    private dailyPlan: string[] = [];
    private emergencyLevel: 'NORMAL' | 'YELLOW' | 'ORANGE' | 'RED' = 'NORMAL';

    constructor() {
        super({
            name: 'T5-EXECUTOR',
            type: 'EXECUTOR',
            tier: 5,
            parentId: null, // No parent - sovereign
            location: {
                floor: 'EXECUTIVE',
                room: 'EXECUTOR_OFFICE',
            },
            capabilities: [
                { id: 'strategic_decision', name: 'Strategic Decision Making', description: 'Final authority on all strategic decisions', requiredTier: 5 },
                { id: 'emergency_control', name: 'Emergency Control', description: 'Emergency shutdown and escalation authority', requiredTier: 5 },
                { id: 'spawn_approval', name: 'Spawn Approval', description: 'Final approval on T4 agent spawns', requiredTier: 5 },
                { id: 'hitl_interface', name: 'HITL Interface', description: 'Primary interface with human governance', requiredTier: 5 },
                { id: 'coordination', name: 'Cross-Tier Coordination', description: 'Coordinate all T5 orchestrators', requiredTier: 5 },
            ],
        });

        // Store knowledge base
        this.metadata['knowledge'] = EXECUTOR_KNOWLEDGE;
    }

    protected getDefaultLocation(): AgentLocation {
        return { floor: 'EXECUTIVE', room: 'EXECUTOR_OFFICE' };
    }

    // -------------------------------------------------------------------------
    // Lifecycle
    // -------------------------------------------------------------------------

    async initialize(): Promise<void> {
        await super.initialize();

        // Post initialization to blackboard
        this.postToBlackboard({
            type: 'OBSERVATION',
            title: 'T5-EXECUTOR Online',
            content: {
                message: 'Supreme Commander initialized and ready',
                capabilities: this.capabilities.map(c => c.name),
                governanceLevel: trustEngine.getHITLLevel(),
            },
            priority: 'HIGH',
        });

        this.remember('INITIALIZATION', 'T5-EXECUTOR online as Supreme Commander', true);
    }

    async execute(): Promise<void> {
        // Main execution loop
        while (this.status !== 'TERMINATED') {
            // Check for messages
            const messages = this.getMessages();
            for (const msg of messages) {
                await this.handleMessage(msg);
            }

            // Check for pending approvals
            await this.processPendingApprovals();

            // Check for emergencies
            await this.checkEmergencyConditions();

            // Process blackboard
            await this.processBlackboard();

            // Short pause before next cycle
            await this.pause(1000);
        }
    }

    private async pause(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // -------------------------------------------------------------------------
    // T5 Coordination
    // -------------------------------------------------------------------------

    /**
     * Register a T5 orchestrator
     */
    registerT5Agent(role: string, agentId: AgentId): void {
        this.t5Agents.set(role, agentId);
        this.registerChild(agentId);
        this.remember('T5_REGISTRATION', { role, agentId }, true);
    }

    /**
     * Get all T5 agent IDs
     */
    getT5Agents(): Map<string, AgentId> {
        return new Map(this.t5Agents);
    }

    /**
     * Convene T5 council meeting
     */
    async conveneT5Council(topic: string, agenda: string[]): Promise<Meeting> {
        const meeting: Meeting = {
            id: `meeting-${Date.now()}`,
            title: `T5 Council: ${topic}`,
            organizer: this.id,
            participants: [this.id, ...this.t5Agents.values()],
            location: 'CONFERENCE_ROOM_A',
            status: 'IN_PROGRESS',
            agenda,
            scheduledAt: new Date(),
            startedAt: new Date(),
            transcript: [],
            decisions: [],
            actionItems: [],
        };

        // Notify all T5 agents
        for (const agentId of this.t5Agents.values()) {
            this.sendMessage(agentId, `T5 Council Convened: ${topic}`, {
                meetingId: meeting.id,
                agenda,
                location: meeting.location,
            });
        }

        this.joinMeeting(meeting);

        this.postToBlackboard({
            type: 'MEETING_REQUEST',
            title: `T5 Council: ${topic}`,
            content: meeting,
            priority: 'HIGH',
        });

        return meeting;
    }

    // -------------------------------------------------------------------------
    // Spawn Approval
    // -------------------------------------------------------------------------

    /**
     * Submit a spawn request for approval
     */
    submitSpawnRequest(request: SpawnRequest): string {
        this.pendingApprovals.set(request.id, request);

        // Check if HITL approval is needed
        if (trustEngine.requiresHITL('SPAWN')) {
            hitlGateway.requestApproval({
                type: 'SPAWN',
                requestor: request.requestor,
                summary: `Spawn ${request.name} (${request.template})`,
                details: request,
            });
        }

        this.remember('SPAWN_REQUEST', { requestId: request.id, name: request.name });

        return request.id;
    }

    /**
     * Approve a spawn request
     */
    approveSpawn(requestId: string): SpawnResult {
        const request = this.pendingApprovals.get(requestId);
        if (!request) {
            return {
                success: false,
                rejectionReason: 'Spawn request not found',
                validationReport: {
                    isValid: false,
                    trustScore: 0,
                    warnings: [],
                    errors: ['Request not found'],
                    recommendations: [],
                    validatedBy: this.id,
                    validatedAt: new Date(),
                },
            };
        }

        this.pendingApprovals.delete(requestId);

        this.makeDecision(
            `Approved spawn of ${request.name}`,
            `Request from ${request.requestor} for ${request.template} agent approved after validation`
        );

        return {
            success: true,
            trustAllocation: request.trustBudget,
            validationReport: {
                isValid: true,
                trustScore: request.trustBudget,
                warnings: [],
                errors: [],
                recommendations: [],
                validatedBy: this.id,
                validatedAt: new Date(),
            },
            spawnedAt: new Date(),
        };
    }

    /**
     * Reject a spawn request
     */
    rejectSpawn(requestId: string, reason: string): SpawnResult {
        const request = this.pendingApprovals.get(requestId);
        this.pendingApprovals.delete(requestId);

        if (request) {
            this.makeDecision(
                `Rejected spawn of ${request.name}`,
                reason
            );
        }

        return {
            success: false,
            rejectionReason: reason,
            validationReport: {
                isValid: false,
                trustScore: 0,
                warnings: [],
                errors: [reason],
                recommendations: [],
                validatedBy: this.id,
                validatedAt: new Date(),
            },
        };
    }

    private async processPendingApprovals(): Promise<void> {
        for (const [requestId, request] of this.pendingApprovals) {
            // Auto-approve if governance level is low and trust is high
            if (trustEngine.getHITLLevel() < 30) {
                const requestorTrust = trustEngine.getTrust(request.requestor);
                if (requestorTrust && requestorTrust.numeric > 700) {
                    this.approveSpawn(requestId);
                }
            }
        }
    }

    // -------------------------------------------------------------------------
    // Emergency Control
    // -------------------------------------------------------------------------

    /**
     * Raise emergency level
     */
    raiseEmergency(level: 'YELLOW' | 'ORANGE' | 'RED', reason: string): void {
        const oldLevel = this.emergencyLevel;
        this.emergencyLevel = level;

        const protocol = EXECUTOR_KNOWLEDGE.emergencyProtocols.find(p => p.level === level);

        this.postToBlackboard({
            type: 'OBSERVATION',
            title: `🚨 EMERGENCY LEVEL: ${level}`,
            content: {
                reason,
                previousLevel: oldLevel,
                actions: protocol?.actions ?? [],
                raisedBy: this.id,
                timestamp: new Date(),
            },
            priority: 'CRITICAL',
        });

        // Execute emergency actions
        if (protocol) {
            for (const action of protocol.actions) {
                this.remember('EMERGENCY_ACTION', action, true);
            }
        }

        // Notify HITL immediately for RED
        if (level === 'RED') {
            hitlGateway.requestApproval({
                type: 'EMERGENCY',
                requestor: this.id,
                summary: `CRITICAL: ${reason}`,
                details: { level, reason, protocol },
                urgency: 'CRITICAL',
            });
        }

        this.makeDecision(
            `Emergency level raised to ${level}`,
            reason
        );
    }

    /**
     * Clear emergency status
     */
    clearEmergency(): void {
        if (this.emergencyLevel !== 'NORMAL') {
            const oldLevel = this.emergencyLevel;
            this.emergencyLevel = 'NORMAL';

            this.postToBlackboard({
                type: 'OBSERVATION',
                title: '✅ Emergency Cleared',
                content: {
                    previousLevel: oldLevel,
                    clearedBy: this.id,
                    timestamp: new Date(),
                },
                priority: 'HIGH',
            });

            this.makeDecision('Emergency cleared', `Returned to normal operations from ${oldLevel}`);
        }
    }

    private async checkEmergencyConditions(): Promise<void> {
        // Check trust violations
        const trustStats = trustEngine.getStats();

        if (trustStats.avgTrust < 300 && this.emergencyLevel === 'NORMAL') {
            this.raiseEmergency('YELLOW', 'Average trust score below threshold');
        }

        // Check blackboard for critical issues
        const critical = blackboard.getCritical();
        if (critical.length > 5 && this.emergencyLevel === 'NORMAL') {
            this.raiseEmergency('YELLOW', 'Multiple critical issues on blackboard');
        }
    }

    // -------------------------------------------------------------------------
    // Daily Operations
    // -------------------------------------------------------------------------

    /**
     * Conduct morning check-in
     */
    async conductMorningCheckin(): Promise<void> {
        this.makeDecision(
            'Morning check-in initiated',
            'Starting daily operations cycle'
        );

        // Get plan from Planner
        const plannerId = this.t5Agents.get('PLANNER');
        if (plannerId) {
            const response = await this.request(plannerId, 'Daily Plan Request', {
                date: new Date(),
                previousDayMetrics: hitlGateway.getStats(),
            });

            if (response) {
                this.dailyPlan = (response.content as { plan: string[] }).plan;
            }
        }

        // Approve plan with HITL if needed
        if (trustEngine.requiresHITL('STRATEGY') && this.dailyPlan.length > 0) {
            hitlGateway.requestApproval({
                type: 'STRATEGY',
                requestor: this.id,
                summary: 'Daily Plan Approval',
                details: { plan: this.dailyPlan, date: new Date() },
            });
        }

        // Post to blackboard
        this.postToBlackboard({
            type: 'TASK',
            title: 'Daily Plan',
            content: this.dailyPlan,
            priority: 'HIGH',
        });
    }

    /**
     * Generate evening report
     */
    async generateEveningReport(): Promise<DailyReport> {
        // Collect data from blackboard
        const decisions = blackboard.getByType('DECISION')
            .filter(e => e.createdAt.toDateString() === new Date().toDateString())
            .map(e => ({
                id: e.id,
                agent: e.author,
                summary: e.title,
                reasoning: String(e.content),
            }));

        const report = hitlGateway.generateReport({
            generatedBy: this.id,
            decisions,
            meetings: [], // Would be populated from meeting tracker
            spawns: [], // Would be populated from spawn log
            tomorrowPlan: {
                objectives: this.dailyPlan,
                scheduledMeetings: [],
                pendingDecisions: blackboard.getPendingDecisions().map(e => e.title),
            },
        });

        this.makeDecision(
            'Evening report generated',
            `Report ${report.id} submitted for HITL review`
        );

        return report;
    }

    // -------------------------------------------------------------------------
    // Message Handling
    // -------------------------------------------------------------------------

    private async handleMessage(msg: any): Promise<void> {
        switch (msg.subject) {
            case 'SPAWN_REQUEST':
                this.submitSpawnRequest(msg.content as SpawnRequest);
                break;
            case 'EMERGENCY':
                this.raiseEmergency(msg.content.level, msg.content.reason);
                break;
            case 'STATUS_UPDATE':
                this.remember('STATUS_UPDATE', msg.content);
                break;
            default:
                // Log unknown message types
                this.remember('UNKNOWN_MESSAGE', msg);
        }
    }

    // -------------------------------------------------------------------------
    // Blackboard Processing
    // -------------------------------------------------------------------------

    private async processBlackboard(): Promise<void> {
        // Review critical entries
        const critical = blackboard.getCritical();
        for (const entry of critical) {
            if (entry.type === 'PROBLEM' && entry.status === 'OPEN') {
                // Post observation about addressing the problem
                this.contributeToEntry(
                    entry.id,
                    `T5-EXECUTOR aware. Prioritizing resolution.`,
                    80
                );
            }
        }
    }
}
