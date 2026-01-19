/**
 * T5-Validator: Trust Guardian
 * 
 * Ensures all agents meet trust requirements. Validates spawn requests,
 * monitors trust scores, and maintains audit trails for HITL review.
 * 
 * Responsibilities:
 * - Validate all spawn requests
 * - Monitor trust scores across all tiers
 * - Escalate trust violations
 * - Maintain audit trail
 * - Dynamic trust adjustment
 */

import { BaseAgent } from '../agents/BaseAgent.js';
import type {
    AgentId,
    AgentLocation,
    SpawnRequest,
    ValidationReport,
    TrustScore,
} from '../types.js';
import { trustEngine } from '../core/TrustEngine.js';
import { blackboard } from '../core/Blackboard.js';
import { hitlGateway } from '../core/HITLGateway.js';

// ============================================================================
// Knowledge Base
// ============================================================================

const VALIDATOR_KNOWLEDGE = {
    role: 'Trust Guardian',
    tier: 5,

    trustPolicies: [
        {
            name: 'Spawn Validation',
            rules: [
                'Requestor must have minimum trust score of 300',
                'Requested tier must be at most one level below requestor',
                'Trust budget must not exceed 50% of requestor\'s trust',
                'Purpose must be clearly defined',
            ],
        },
        {
            name: 'Trust Inheritance',
            rules: [
                'Children inherit 80% of parent trust',
                'Child penalties propagate 50% to parent',
                'Trust chain must be verifiable',
            ],
        },
        {
            name: 'Violation Handling',
            rules: [
                'Minor violations: Warning + 10 trust penalty',
                'Moderate violations: 50 trust penalty + HITL notification',
                'Severe violations: Immediate suspension + HITL escalation',
                'Repeated violations: Trust revocation consideration',
            ],
        },
    ],

    riskAssessment: {
        factors: [
            { name: 'Trust Score', weight: 0.3 },
            { name: 'Historical Performance', weight: 0.25 },
            { name: 'Request Complexity', weight: 0.2 },
            { name: 'Resource Requirements', weight: 0.15 },
            { name: 'Time Sensitivity', weight: 0.1 },
        ],
        thresholds: {
            LOW: { min: 0, max: 30 },
            MEDIUM: { min: 31, max: 60 },
            HIGH: { min: 61, max: 80 },
            CRITICAL: { min: 81, max: 100 },
        },
    },

    complianceFrameworks: [
        {
            name: 'Internal Trust Policy',
            requirements: ['Valid trust chain', 'Approved spawn', 'Active monitoring'],
        },
        {
            name: 'HITL Governance',
            requirements: ['Daily reports', 'Approval tracking', 'Escalation protocols'],
        },
        {
            name: 'Audit Trail',
            requirements: ['All decisions logged', 'Reasoning documented', 'Timestamps verified'],
        },
    ],

    antiPatterns: [
        {
            name: 'Trust Hoarding',
            description: 'Agent accumulating trust without productive output',
            detection: 'High trust score with low task completion',
            action: 'Review and redistribute trust if warranted',
        },
        {
            name: 'Spawn Explosion',
            description: 'Agent spawning many children rapidly',
            detection: 'Multiple spawn requests in short timeframe',
            action: 'Rate limit spawns, investigate intent',
        },
        {
            name: 'Trust Laundering',
            description: 'Moving trust through intermediaries to avoid limits',
            detection: 'Unusual trust transfer patterns',
            action: 'Freeze transfers, audit chain',
        },
    ],
};

// ============================================================================
// T5-Validator Class
// ============================================================================

export class T5Validator extends BaseAgent {
    private validationLog: ValidationEntry[] = [];
    private watchList: Set<AgentId> = new Set();
    private violationCounts: Map<AgentId, number> = new Map();

    constructor() {
        super({
            name: 'T5-VALIDATOR',
            type: 'VALIDATOR',
            tier: 5,
            parentId: null,
            location: {
                floor: 'EXECUTIVE',
                room: 'VALIDATOR_OFFICE',
            },
            capabilities: [
                { id: 'spawn_validation', name: 'Spawn Validation', description: 'Validate all agent spawn requests', requiredTier: 5 },
                { id: 'trust_monitoring', name: 'Trust Monitoring', description: 'Monitor trust scores system-wide', requiredTier: 5 },
                { id: 'violation_handling', name: 'Violation Handling', description: 'Handle trust violations and escalations', requiredTier: 5 },
                { id: 'audit_trail', name: 'Audit Trail', description: 'Maintain comprehensive audit logs', requiredTier: 5 },
                { id: 'risk_assessment', name: 'Risk Assessment', description: 'Assess risk of agent actions', requiredTier: 5 },
            ],
        });

        this.metadata['knowledge'] = VALIDATOR_KNOWLEDGE;

        // Subscribe to trust events
        trustEngine.on('trust:violation', (agentId, reason, penalty) => {
            this.handleViolation(agentId, reason, penalty);
        });
    }

    protected getDefaultLocation(): AgentLocation {
        return { floor: 'EXECUTIVE', room: 'VALIDATOR_OFFICE' };
    }

    // -------------------------------------------------------------------------
    // Lifecycle
    // -------------------------------------------------------------------------

    async initialize(): Promise<void> {
        await super.initialize();

        this.postToBlackboard({
            type: 'OBSERVATION',
            title: 'T5-VALIDATOR Online',
            content: {
                message: 'Trust Guardian initialized',
                policies: VALIDATOR_KNOWLEDGE.trustPolicies.map(p => p.name),
                complianceFrameworks: VALIDATOR_KNOWLEDGE.complianceFrameworks.map(f => f.name),
            },
            priority: 'HIGH',
        });
    }

    async execute(): Promise<void> {
        while (this.status !== 'TERMINATED') {
            // Handle validation requests
            const requests = this.getPendingRequests();
            for (const req of requests) {
                await this.handleRequest(req);
            }

            // Monitor trust levels
            await this.monitorTrustLevels();

            // Check for anti-patterns
            await this.detectAntiPatterns();

            // Review watch list
            await this.reviewWatchList();

            await this.pause(1000);
        }
    }

    private async pause(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // -------------------------------------------------------------------------
    // Spawn Validation
    // -------------------------------------------------------------------------

    /**
     * Validate a spawn request
     */
    validateSpawnRequest(request: SpawnRequest): ValidationReport {
        const warnings: string[] = [];
        const errors: string[] = [];
        const recommendations: string[] = [];

        // Get requestor's trust
        const requestorTrust = trustEngine.getTrust(request.requestor);

        if (!requestorTrust) {
            errors.push('Requestor not found in trust registry');
            return this.createReport(false, 0, warnings, errors, recommendations);
        }

        // Policy checks
        const policies = VALIDATOR_KNOWLEDGE.trustPolicies[0]!; // Spawn Validation

        // Check 1: Minimum trust score
        if (requestorTrust.numeric < 300) {
            errors.push(`Trust score ${requestorTrust.numeric} below minimum 300`);
        }

        // Check 2: Trust budget
        const maxBudget = requestorTrust.numeric * 0.5;
        if (request.trustBudget > maxBudget) {
            errors.push(`Trust budget ${request.trustBudget} exceeds maximum ${maxBudget}`);
        }

        // Check 3: Purpose defined
        if (!request.purpose || request.purpose.length < 10) {
            errors.push('Purpose not clearly defined (minimum 10 characters)');
        }

        // Check 4: Agent on watch list
        if (this.watchList.has(request.requestor)) {
            warnings.push('Requestor is on watch list - extra scrutiny applied');
        }

        // Risk assessment
        const riskScore = this.assessRisk(request, requestorTrust);
        if (riskScore > 60) {
            warnings.push(`High risk score: ${riskScore}`);
            if (riskScore > 80) {
                recommendations.push('Consider HITL review before approval');
            }
        }

        // Recommendations
        if (requestorTrust.numeric < 500) {
            recommendations.push('Requestor has moderate trust - consider smaller trust allocation');
        }

        const isValid = errors.length === 0;

        // Log validation
        this.logValidation({
            requestId: request.id,
            requestor: request.requestor,
            isValid,
            trustScore: requestorTrust.numeric,
            riskScore,
            warnings,
            errors,
            timestamp: new Date(),
        });

        this.makeDecision(
            `Spawn validation: ${isValid ? 'APPROVED' : 'REJECTED'} - ${request.name}`,
            isValid
                ? `Trust score ${requestorTrust.numeric}, risk score ${riskScore}`
                : `Errors: ${errors.join(', ')}`
        );

        return this.createReport(isValid, requestorTrust.numeric, warnings, errors, recommendations);
    }

    private createReport(
        isValid: boolean,
        trustScore: number,
        warnings: string[],
        errors: string[],
        recommendations: string[]
    ): ValidationReport {
        return {
            isValid,
            trustScore,
            warnings,
            errors,
            recommendations,
            validatedBy: this.id,
            validatedAt: new Date(),
        };
    }

    private assessRisk(request: SpawnRequest, trust: TrustScore): number {
        const factors = VALIDATOR_KNOWLEDGE.riskAssessment.factors;
        let riskScore = 0;

        // Trust Score factor (lower trust = higher risk)
        const trustRisk = (1000 - trust.numeric) / 10; // 0-100
        riskScore += trustRisk * factors[0]!.weight;

        // Historical Performance (based on violations)
        const violations = this.violationCounts.get(request.requestor) ?? 0;
        const violationRisk = Math.min(100, violations * 20);
        riskScore += violationRisk * factors[1]!.weight;

        // Request Complexity (based on capabilities)
        const complexityRisk = Math.min(100, request.capabilities.length * 15);
        riskScore += complexityRisk * factors[2]!.weight;

        // Resource Requirements (trust budget percentage)
        const budgetRatio = request.trustBudget / (trust.numeric * 0.5);
        const resourceRisk = Math.min(100, budgetRatio * 100);
        riskScore += resourceRisk * factors[3]!.weight;

        // Time Sensitivity (priority based)
        const priorityRisk = request.priority === 'CRITICAL' ? 80 :
            request.priority === 'HIGH' ? 50 : 20;
        riskScore += priorityRisk * factors[4]!.weight;

        return Math.round(riskScore);
    }

    // -------------------------------------------------------------------------
    // Trust Monitoring
    // -------------------------------------------------------------------------

    private async monitorTrustLevels(): Promise<void> {
        const stats = trustEngine.getStats();

        // Alert if average trust drops
        if (stats.avgTrust < 400) {
            this.postToBlackboard({
                type: 'PROBLEM',
                title: 'Low System Trust Level',
                content: {
                    avgTrust: stats.avgTrust,
                    threshold: 400,
                    recommendation: 'Review recent violations and consider trust recovery actions',
                },
                priority: 'HIGH',
            });
        }

        // Alert if many agents at low trust
        const lowTrustCount = (stats.byLevel['PASSIVE'] ?? 0) + (stats.byLevel['WORKER'] ?? 0);
        const totalAgents = stats.totalAgents;

        if (totalAgents > 0 && lowTrustCount / totalAgents > 0.5) {
            this.postToBlackboard({
                type: 'PROBLEM',
                title: 'High Proportion of Low-Trust Agents',
                content: {
                    lowTrustCount,
                    totalAgents,
                    percentage: Math.round((lowTrustCount / totalAgents) * 100),
                },
                priority: 'MEDIUM',
            });
        }
    }

    // -------------------------------------------------------------------------
    // Violation Handling
    // -------------------------------------------------------------------------

    private handleViolation(agentId: AgentId, reason: string, penalty: number): void {
        // Increment violation count
        const count = (this.violationCounts.get(agentId) ?? 0) + 1;
        this.violationCounts.set(agentId, count);

        // Determine severity
        let severity: 'MINOR' | 'MODERATE' | 'SEVERE';
        if (penalty < 20) {
            severity = 'MINOR';
        } else if (penalty < 50) {
            severity = 'MODERATE';
        } else {
            severity = 'SEVERE';
        }

        // Add to watch list if multiple violations
        if (count >= 3) {
            this.watchList.add(agentId);
        }

        // Post to blackboard
        this.postToBlackboard({
            type: 'ANTI_PATTERN',
            title: `Trust Violation: ${severity}`,
            content: {
                agentId,
                reason,
                penalty,
                totalViolations: count,
                onWatchList: this.watchList.has(agentId),
            },
            priority: severity === 'SEVERE' ? 'CRITICAL' : 'HIGH',
        });

        // Escalate severe violations to HITL
        if (severity === 'SEVERE') {
            hitlGateway.requestApproval({
                type: 'DECISION',
                requestor: this.id,
                summary: `Severe trust violation by ${agentId}`,
                details: { agentId, reason, penalty, count },
                urgency: 'HIGH',
            });
        }

        this.makeDecision(
            `Trust violation recorded: ${severity}`,
            `Agent ${agentId}: ${reason} (penalty: ${penalty}, total: ${count})`
        );
    }

    // -------------------------------------------------------------------------
    // Anti-Pattern Detection
    // -------------------------------------------------------------------------

    private async detectAntiPatterns(): Promise<void> {
        // This would analyze agent behavior patterns
        // For now, just record that detection ran
        this.remember('ANTI_PATTERN_SCAN', { timestamp: new Date(), status: 'completed' });
    }

    // -------------------------------------------------------------------------
    // Watch List
    // -------------------------------------------------------------------------

    private async reviewWatchList(): Promise<void> {
        for (const agentId of this.watchList) {
            const trust = trustEngine.getTrust(agentId);

            // Remove from watch list if trust has recovered
            if (trust && trust.numeric > 600) {
                this.watchList.delete(agentId);
                this.postToBlackboard({
                    type: 'OBSERVATION',
                    title: 'Agent Removed from Watch List',
                    content: { agentId, reason: 'Trust recovered above 600' },
                    priority: 'LOW',
                });
            }
        }
    }

    /**
     * Add agent to watch list
     */
    addToWatchList(agentId: AgentId, reason: string): void {
        this.watchList.add(agentId);
        this.remember('WATCH_LIST', { action: 'added', agentId, reason }, true);
    }

    /**
     * Remove agent from watch list
     */
    removeFromWatchList(agentId: AgentId): void {
        this.watchList.delete(agentId);
        this.remember('WATCH_LIST', { action: 'removed', agentId });
    }

    // -------------------------------------------------------------------------
    // Audit Trail
    // -------------------------------------------------------------------------

    private logValidation(entry: ValidationEntry): void {
        this.validationLog.push(entry);

        // Keep only last 1000 entries
        if (this.validationLog.length > 1000) {
            this.validationLog = this.validationLog.slice(-1000);
        }
    }

    /**
     * Get validation history for an agent
     */
    getValidationHistory(agentId: AgentId): ValidationEntry[] {
        return this.validationLog.filter(e => e.requestor === agentId);
    }

    /**
     * Get recent validations
     */
    getRecentValidations(count: number = 50): ValidationEntry[] {
        return this.validationLog.slice(-count);
    }

    // -------------------------------------------------------------------------
    // Request Handling
    // -------------------------------------------------------------------------

    private async handleRequest(msg: any): Promise<void> {
        switch (msg.subject) {
            case 'Validate Spawn':
                const report = this.validateSpawnRequest(msg.content as SpawnRequest);
                this.respond(msg.id, { report });
                break;

            case 'Trust Status':
                const trust = trustEngine.getTrust(msg.content.agentId);
                this.respond(msg.id, { trust });
                break;

            case 'Watch List Check':
                const onList = this.watchList.has(msg.content.agentId);
                this.respond(msg.id, { onWatchList: onList });
                break;

            default:
                this.respond(msg.id, { error: 'Unknown request type' });
        }
    }
}

// ============================================================================
// Supporting Types
// ============================================================================

interface ValidationEntry {
    requestId: string;
    requestor: AgentId;
    isValid: boolean;
    trustScore: number;
    riskScore: number;
    warnings: string[];
    errors: string[];
    timestamp: Date;
}
