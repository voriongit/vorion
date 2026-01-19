/**
 * HITL Gateway
 * 
 * Human-in-the-Loop interface for governance. Manages approval requests,
 * daily reports, and the fading autonomy model where human oversight
 * gradually decreases as trust is established.
 */

import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'eventemitter3';
import type {
    AgentId,
    HITLApproval,
    DailyReport,
    SystemEvent,
} from '../types.js';
import { trustEngine } from './TrustEngine.js';

// ============================================================================
// Events
// ============================================================================

interface HITLGatewayEvents {
    'approval:requested': (approval: HITLApproval) => void;
    'approval:granted': (approval: HITLApproval) => void;
    'approval:rejected': (approval: HITLApproval) => void;
    'approval:expired': (approval: HITLApproval) => void;
    'report:generated': (report: DailyReport) => void;
    'governance:level-changed': (oldLevel: number, newLevel: number) => void;
}

// ============================================================================
// HITL Gateway Class
// ============================================================================

export class HITLGateway extends EventEmitter<HITLGatewayEvents> {
    private approvals: Map<string, HITLApproval> = new Map();
    private reports: Map<string, DailyReport> = new Map();
    private eventLog: SystemEvent[] = [];

    // -------------------------------------------------------------------------
    // Approval Management
    // -------------------------------------------------------------------------

    /**
     * Request human approval for an action
     */
    requestApproval(params: {
        type: 'SPAWN' | 'DECISION' | 'STRATEGY' | 'EMERGENCY';
        requestor: AgentId;
        summary: string;
        details: unknown;
        urgency?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        deadline?: Date;
    }): HITLApproval {
        const approval: HITLApproval = {
            id: uuidv4(),
            type: params.type,
            requestor: params.requestor,
            summary: params.summary,
            details: params.details,
            urgency: params.urgency ?? 'MEDIUM',
            requestedAt: new Date(),
            deadline: params.deadline,
            status: 'PENDING',
        };

        this.approvals.set(approval.id, approval);
        this.emit('approval:requested', approval);

        return approval;
    }

    /**
     * Grant approval (human action)
     */
    approve(approvalId: string, reason?: string): HITLApproval | null {
        const approval = this.approvals.get(approvalId);
        if (!approval || approval.status !== 'PENDING') return null;

        approval.status = 'APPROVED';
        approval.response = {
            decision: 'APPROVED',
            reason,
            respondedAt: new Date(),
        };

        // Reward the requestor for good judgment
        trustEngine.reward(approval.requestor, 5, 'HITL approval granted');

        this.emit('approval:granted', approval);

        return approval;
    }

    /**
     * Reject approval (human action)
     */
    reject(approvalId: string, reason: string): HITLApproval | null {
        const approval = this.approvals.get(approvalId);
        if (!approval || approval.status !== 'PENDING') return null;

        approval.status = 'REJECTED';
        approval.response = {
            decision: 'REJECTED',
            reason,
            respondedAt: new Date(),
        };

        // Small penalty for wasting human time (if not emergency)
        if (approval.type !== 'EMERGENCY') {
            trustEngine.penalize(approval.requestor, 2, 'HITL approval rejected');
        }

        this.emit('approval:rejected', approval);

        return approval;
    }

    /**
     * Get pending approvals
     */
    getPending(): HITLApproval[] {
        return Array.from(this.approvals.values())
            .filter(a => a.status === 'PENDING')
            .sort((a, b) => {
                // Sort by urgency, then by date
                const urgencyOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
                const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
                if (urgencyDiff !== 0) return urgencyDiff;
                return a.requestedAt.getTime() - b.requestedAt.getTime();
            });
    }

    /**
     * Get approval by ID
     */
    getApproval(approvalId: string): HITLApproval | undefined {
        return this.approvals.get(approvalId);
    }

    /**
     * Check for expired approvals
     */
    checkExpired(): HITLApproval[] {
        const now = new Date();
        const expired: HITLApproval[] = [];

        for (const approval of this.approvals.values()) {
            if (
                approval.status === 'PENDING' &&
                approval.deadline &&
                approval.deadline < now
            ) {
                approval.status = 'EXPIRED';
                expired.push(approval);
                this.emit('approval:expired', approval);
            }
        }

        return expired;
    }

    // -------------------------------------------------------------------------
    // Daily Reports
    // -------------------------------------------------------------------------

    /**
     * Generate a daily report
     */
    generateReport(params: {
        generatedBy: AgentId;
        decisions: DailyReport['decisions'];
        meetings: DailyReport['meetings'];
        spawns: DailyReport['spawns'];
        tomorrowPlan: DailyReport['tomorrowPlan'];
        recommendations?: string[];
        anomalies?: string[];
    }): DailyReport {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const report: DailyReport = {
            id: uuidv4(),
            date: today,
            generatedBy: params.generatedBy,
            generatedAt: new Date(),
            decisions: params.decisions,
            meetings: params.meetings,
            spawns: params.spawns,
            metrics: {
                totalDecisions: params.decisions.length,
                totalMeetings: params.meetings.length,
                totalSpawns: params.spawns.length,
                activeAgents: this.countActiveAgents(),
                blackboardEntries: 0, // Would be populated from Blackboard
                resolvedProblems: 0,
                pendingApprovals: this.getPending().length,
            },
            tomorrowPlan: params.tomorrowPlan,
            recommendations: params.recommendations ?? [],
            anomalies: params.anomalies ?? [],
            hitlMetrics: this.getHITLMetrics(),
        };

        this.reports.set(report.id, report);
        this.emit('report:generated', report);

        return report;
    }

    /**
     * Get today's report
     */
    getTodaysReport(): DailyReport | undefined {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return Array.from(this.reports.values()).find(r =>
            r.date.getTime() === today.getTime()
        );
    }

    /**
     * Get reports for a date range
     */
    getReports(startDate: Date, endDate: Date): DailyReport[] {
        return Array.from(this.reports.values())
            .filter(r => r.date >= startDate && r.date <= endDate)
            .sort((a, b) => b.date.getTime() - a.date.getTime());
    }

    // -------------------------------------------------------------------------
    // Event Logging
    // -------------------------------------------------------------------------

    /**
     * Log a system event
     */
    logEvent(event: SystemEvent): void {
        this.eventLog.push(event);

        // Keep only last 10000 events
        if (this.eventLog.length > 10000) {
            this.eventLog = this.eventLog.slice(-10000);
        }
    }

    /**
     * Get recent events
     */
    getRecentEvents(count: number = 100): SystemEvent[] {
        return this.eventLog.slice(-count);
    }

    /**
     * Get events by type
     */
    getEventsByType(type: SystemEvent['type'], count: number = 50): SystemEvent[] {
        return this.eventLog
            .filter(e => e.type === type)
            .slice(-count);
    }

    // -------------------------------------------------------------------------
    // Governance Level
    // -------------------------------------------------------------------------

    /**
     * Get current HITL governance level (0-100)
     */
    getGovernanceLevel(): number {
        return trustEngine.getHITLLevel();
    }

    /**
     * Adjust governance level (fading HITL)
     */
    adjustGovernanceLevel(newLevel: number): void {
        const oldLevel = trustEngine.getHITLLevel();
        trustEngine.setHITLLevel(newLevel);
        this.emit('governance:level-changed', oldLevel, newLevel);
    }

    /**
     * Suggest governance adjustment based on performance
     */
    suggestGovernanceAdjustment(): {
        currentLevel: number;
        suggestedLevel: number;
        reason: string;
    } {
        const currentLevel = trustEngine.getHITLLevel();
        const stats = trustEngine.getStats();

        // Calculate suggestion based on trust and approval history
        const approvals = Array.from(this.approvals.values());
        const recentApprovals = approvals.filter(a =>
            a.response?.respondedAt &&
            Date.now() - a.response.respondedAt.getTime() < 7 * 24 * 60 * 60 * 1000 // Last 7 days
        );

        const approvalRate = recentApprovals.length > 0
            ? recentApprovals.filter(a => a.status === 'APPROVED').length / recentApprovals.length
            : 0.5;

        let suggestedLevel = currentLevel;
        let reason = 'Maintaining current governance level';

        if (approvalRate > 0.9 && stats.avgTrust > 600 && currentLevel > 10) {
            suggestedLevel = Math.max(10, currentLevel - 5);
            reason = `High approval rate (${Math.round(approvalRate * 100)}%) and strong trust (${stats.avgTrust}) suggest reducing oversight`;
        } else if (approvalRate < 0.5 || stats.avgTrust < 400) {
            suggestedLevel = Math.min(100, currentLevel + 10);
            reason = `Low approval rate or trust suggests increasing oversight`;
        }

        return { currentLevel, suggestedLevel, reason };
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private countActiveAgents(): number {
        return trustEngine.getStats().totalAgents;
    }

    private getHITLMetrics(): DailyReport['hitlMetrics'] {
        const approvals = Array.from(this.approvals.values());
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todaysApprovals = approvals.filter(a =>
            a.requestedAt >= today
        );

        const suggestion = this.suggestGovernanceAdjustment();

        return {
            currentLevel: trustEngine.getHITLLevel(),
            approvalsRequested: todaysApprovals.length,
            approvalsGranted: todaysApprovals.filter(a => a.status === 'APPROVED').length,
            approvalsRejected: todaysApprovals.filter(a => a.status === 'REJECTED').length,
            suggestedAdjustment: suggestion.suggestedLevel !== suggestion.currentLevel
                ? suggestion.suggestedLevel
                : undefined,
        };
    }

    // -------------------------------------------------------------------------
    // Statistics
    // -------------------------------------------------------------------------

    /**
     * Get HITL statistics
     */
    getStats(): {
        governanceLevel: number;
        totalApprovals: number;
        pendingApprovals: number;
        approvalRate: number;
        totalReports: number;
        totalEvents: number;
    } {
        const approvals = Array.from(this.approvals.values());
        const responded = approvals.filter(a => a.response);
        const approved = responded.filter(a => a.status === 'APPROVED');

        return {
            governanceLevel: trustEngine.getHITLLevel(),
            totalApprovals: approvals.length,
            pendingApprovals: approvals.filter(a => a.status === 'PENDING').length,
            approvalRate: responded.length > 0
                ? Math.round((approved.length / responded.length) * 100)
                : 0,
            totalReports: this.reports.size,
            totalEvents: this.eventLog.length,
        };
    }
}

// Singleton instance
export const hitlGateway = new HITLGateway();
