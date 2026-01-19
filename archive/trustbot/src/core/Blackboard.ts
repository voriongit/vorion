/**
 * Blackboard System
 * 
 * A shared knowledge space where agents post problems, solutions, patterns,
 * and observations. Other agents can read, contribute, and build upon entries.
 * This enables stigmergic coordination - indirect collaboration through
 * environment modification.
 */

import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'eventemitter3';
import type {
    AgentId,
    AgentTier,
    BlackboardEntry,
    BlackboardEntryType,
    BlackboardEntryStatus,
    BlackboardVisibility,
    Contribution,
} from '../types.js';

// ============================================================================
// Events
// ============================================================================

interface BlackboardEvents {
    'entry:posted': (entry: BlackboardEntry) => void;
    'entry:updated': (entry: BlackboardEntry) => void;
    'entry:resolved': (entry: BlackboardEntry) => void;
    'entry:contributed': (entry: BlackboardEntry, contribution: Contribution) => void;
    'entry:archived': (entry: BlackboardEntry) => void;
}

// ============================================================================
// Blackboard Class
// ============================================================================

export class Blackboard extends EventEmitter<BlackboardEvents> {
    private entries: Map<string, BlackboardEntry> = new Map();

    // -------------------------------------------------------------------------
    // Core Operations
    // -------------------------------------------------------------------------

    /**
     * Post a new entry to the blackboard
     */
    post(params: {
        type: BlackboardEntryType;
        title: string;
        author: AgentId;
        content: unknown;
        confidence?: number;
        dependencies?: string[];
        visibility?: BlackboardVisibility;
        visibleTo?: AgentId[];
        priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    }): BlackboardEntry {
        const entry: BlackboardEntry = {
            id: uuidv4(),
            type: params.type,
            title: params.title,
            author: params.author,
            content: params.content,
            confidence: params.confidence ?? 50,
            dependencies: params.dependencies ?? [],
            contributions: [],
            status: 'OPEN',
            visibility: params.visibility ?? 'ALL',
            visibleTo: params.visibleTo,
            priority: params.priority ?? 'MEDIUM',
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        this.entries.set(entry.id, entry);
        this.emit('entry:posted', entry);

        return entry;
    }

    /**
     * Add a contribution to an existing entry
     */
    contribute(entryId: string, contribution: {
        agentId: AgentId;
        content: string;
        confidence: number;
    }): BlackboardEntry | null {
        const entry = this.entries.get(entryId);
        if (!entry) return null;

        const newContribution: Contribution = {
            ...contribution,
            timestamp: new Date(),
        };

        entry.contributions.push(newContribution);
        entry.updatedAt = new Date();

        // Update overall confidence based on contributions
        const avgConfidence = entry.contributions.reduce(
            (sum, c) => sum + c.confidence, entry.confidence
        ) / (entry.contributions.length + 1);
        entry.confidence = Math.round(avgConfidence);

        this.emit('entry:contributed', entry, newContribution);

        return entry;
    }

    /**
     * Resolve an entry with a final resolution
     */
    resolve(entryId: string, resolution: {
        resolution: string;
        resolvedBy: AgentId;
    }): BlackboardEntry | null {
        const entry = this.entries.get(entryId);
        if (!entry) return null;

        entry.status = 'RESOLVED';
        entry.resolution = resolution.resolution;
        entry.resolvedAt = new Date();
        entry.updatedAt = new Date();

        this.emit('entry:resolved', entry);

        return entry;
    }

    /**
     * Update entry status
     */
    updateStatus(entryId: string, status: BlackboardEntryStatus): BlackboardEntry | null {
        const entry = this.entries.get(entryId);
        if (!entry) return null;

        entry.status = status;
        entry.updatedAt = new Date();

        if (status === 'ARCHIVED') {
            this.emit('entry:archived', entry);
        } else {
            this.emit('entry:updated', entry);
        }

        return entry;
    }

    /**
     * Update entry content (e.g., adding results to a task)
     */
    updateContent(entryId: string, content: unknown): BlackboardEntry | null {
        const entry = this.entries.get(entryId);
        if (!entry) return null;

        entry.content = content;
        entry.updatedAt = new Date();

        this.emit('entry:updated', entry);

        return entry;
    }

    // -------------------------------------------------------------------------
    // Query Operations
    // -------------------------------------------------------------------------

    /**
     * Get a specific entry by ID
     */
    get(entryId: string): BlackboardEntry | undefined {
        return this.entries.get(entryId);
    }

    /**
     * Get all entries visible to a specific agent
     */
    getVisibleTo(agentId: AgentId, agentTier: AgentTier): BlackboardEntry[] {
        return Array.from(this.entries.values()).filter(entry => {
            switch (entry.visibility) {
                case 'ALL':
                    return true;
                case 'SAME_TIER':
                    // This would need the author's tier info - simplified for now
                    return true;
                case 'HIGHER_TIERS':
                    return agentTier >= 3; // T3 and above
                case 'SPECIFIC_AGENTS':
                    return entry.visibleTo?.includes(agentId) ?? false;
                default:
                    return true;
            }
        });
    }

    /**
     * Get entries by type
     */
    getByType(type: BlackboardEntryType): BlackboardEntry[] {
        return Array.from(this.entries.values()).filter(e => e.type === type);
    }

    /**
     * Get entries by status
     */
    getByStatus(status: BlackboardEntryStatus): BlackboardEntry[] {
        return Array.from(this.entries.values()).filter(e => e.status === status);
    }

    /**
     * Get open problems
     */
    getOpenProblems(): BlackboardEntry[] {
        return this.getByType('PROBLEM').filter(e => e.status === 'OPEN');
    }

    /**
     * Get established patterns
     */
    getPatterns(): BlackboardEntry[] {
        return this.getByType('PATTERN').filter(e => e.status === 'RESOLVED');
    }

    /**
     * Get anti-patterns (things to avoid)
     */
    getAntiPatterns(): BlackboardEntry[] {
        return this.getByType('ANTI_PATTERN');
    }

    /**
     * Get pending decisions
     */
    getPendingDecisions(): BlackboardEntry[] {
        return this.getByType('DECISION').filter(e => e.status === 'OPEN');
    }

    /**
     * Search entries by keyword in title or content
     */
    search(keyword: string): BlackboardEntry[] {
        const lower = keyword.toLowerCase();
        return Array.from(this.entries.values()).filter(entry => {
            const titleMatch = entry.title.toLowerCase().includes(lower);
            const contentMatch = typeof entry.content === 'string'
                && entry.content.toLowerCase().includes(lower);
            return titleMatch || contentMatch;
        });
    }

    /**
     * Get entries that depend on a specific entry
     */
    getDependents(entryId: string): BlackboardEntry[] {
        return Array.from(this.entries.values()).filter(
            e => e.dependencies.includes(entryId)
        );
    }

    /**
     * Get entries by author
     */
    getByAuthor(agentId: AgentId): BlackboardEntry[] {
        return Array.from(this.entries.values()).filter(e => e.author === agentId);
    }

    /**
     * Get recent entries (last N)
     */
    getRecent(count: number = 10): BlackboardEntry[] {
        return Array.from(this.entries.values())
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
            .slice(0, count);
    }

    /**
     * Get high priority entries
     */
    getCritical(): BlackboardEntry[] {
        return Array.from(this.entries.values()).filter(
            e => e.priority === 'CRITICAL' && e.status !== 'RESOLVED'
        );
    }

    // -------------------------------------------------------------------------
    // Statistics
    // -------------------------------------------------------------------------

    /**
     * Get all blackboard entries
     */
    getAllEntries(): BlackboardEntry[] {
        return Array.from(this.entries.values());
    }

    /**
     * Get blackboard statistics
     */
    getStats(): {
        total: number;
        byType: Record<BlackboardEntryType, number>;
        byStatus: Record<BlackboardEntryStatus, number>;
        byPriority: Record<string, number>;
        avgConfidence: number;
        totalContributions: number;
    } {
        const entries = Array.from(this.entries.values());

        const byType = entries.reduce((acc, e) => {
            acc[e.type] = (acc[e.type] ?? 0) + 1;
            return acc;
        }, {} as Record<BlackboardEntryType, number>);

        const byStatus = entries.reduce((acc, e) => {
            acc[e.status] = (acc[e.status] ?? 0) + 1;
            return acc;
        }, {} as Record<BlackboardEntryStatus, number>);

        const byPriority = entries.reduce((acc, e) => {
            acc[e.priority] = (acc[e.priority] ?? 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const avgConfidence = entries.length > 0
            ? entries.reduce((sum, e) => sum + e.confidence, 0) / entries.length
            : 0;

        const totalContributions = entries.reduce(
            (sum, e) => sum + e.contributions.length, 0
        );

        return {
            total: entries.length,
            byType,
            byStatus,
            byPriority,
            avgConfidence: Math.round(avgConfidence),
            totalContributions,
        };
    }

    /**
     * Export all entries (for persistence)
     */
    export(): BlackboardEntry[] {
        return Array.from(this.entries.values());
    }

    /**
     * Import entries (from persistence)
     */
    import(entries: BlackboardEntry[]): void {
        for (const entry of entries) {
            this.entries.set(entry.id, entry);
        }
    }

    /**
     * Clear all entries
     */
    clear(): void {
        this.entries.clear();
    }
}

// Singleton instance
export const blackboard = new Blackboard();
