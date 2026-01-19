/**
 * Memory Store
 * 
 * Persistent memory system for agents. Supports short-term, long-term,
 * episodic, and semantic memories with importance scoring and associations.
 */

import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'eventemitter3';
import type { AgentId, MemoryEntry } from '../types.js';

// ============================================================================
// Events
// ============================================================================

interface MemoryStoreEvents {
    'memory:stored': (entry: MemoryEntry) => void;
    'memory:accessed': (entry: MemoryEntry) => void;
    'memory:expired': (entry: MemoryEntry) => void;
    'memory:forgotten': (entry: MemoryEntry) => void;
}

// ============================================================================
// Memory Store Class
// ============================================================================

export class MemoryStore extends EventEmitter<MemoryStoreEvents> {
    private memories: Map<string, MemoryEntry> = new Map();
    private agentMemories: Map<AgentId, Set<string>> = new Map();

    // Memory limits
    private readonly SHORT_TERM_LIMIT = 100;
    private readonly LONG_TERM_LIMIT = 1000;

    // -------------------------------------------------------------------------
    // Storing Memories
    // -------------------------------------------------------------------------

    /**
     * Store a new memory
     */
    store(params: {
        agentId: AgentId;
        type: 'SHORT_TERM' | 'LONG_TERM' | 'EPISODIC' | 'SEMANTIC';
        category: string;
        content: unknown;
        importance?: number;
        expiresIn?: number; // milliseconds, for short-term
        associations?: string[];
    }): MemoryEntry {
        const entry: MemoryEntry = {
            id: uuidv4(),
            agentId: params.agentId,
            type: params.type,
            category: params.category,
            content: params.content,
            importance: params.importance ?? 50,
            accessCount: 0,
            createdAt: new Date(),
            lastAccessedAt: new Date(),
            expiresAt: params.expiresIn
                ? new Date(Date.now() + params.expiresIn)
                : undefined,
            associations: params.associations ?? [],
        };

        this.memories.set(entry.id, entry);

        // Track by agent
        let agentMems = this.agentMemories.get(params.agentId);
        if (!agentMems) {
            agentMems = new Set();
            this.agentMemories.set(params.agentId, agentMems);
        }
        agentMems.add(entry.id);

        // Enforce limits
        this.enforceLimits(params.agentId, params.type);

        this.emit('memory:stored', entry);

        return entry;
    }

    /**
     * Store a short-term memory (auto-expires)
     */
    storeShortTerm(agentId: AgentId, category: string, content: unknown, expiresIn: number = 300000): MemoryEntry {
        return this.store({
            agentId,
            type: 'SHORT_TERM',
            category,
            content,
            importance: 30,
            expiresIn,
        });
    }

    /**
     * Store a long-term memory
     */
    storeLongTerm(agentId: AgentId, category: string, content: unknown, importance: number = 70): MemoryEntry {
        return this.store({
            agentId,
            type: 'LONG_TERM',
            category,
            content,
            importance,
        });
    }

    /**
     * Store an episodic memory (specific event)
     */
    storeEpisodic(agentId: AgentId, event: {
        what: string;
        when: Date;
        where?: string;
        who?: AgentId[];
        outcome?: string;
    }): MemoryEntry {
        return this.store({
            agentId,
            type: 'EPISODIC',
            category: 'EVENT',
            content: event,
            importance: 60,
            associations: event.who ?? [],
        });
    }

    /**
     * Store a semantic memory (general knowledge)
     */
    storeSemantic(agentId: AgentId, fact: {
        subject: string;
        predicate: string;
        object: string;
        confidence: number;
    }): MemoryEntry {
        return this.store({
            agentId,
            type: 'SEMANTIC',
            category: 'FACT',
            content: fact,
            importance: fact.confidence,
        });
    }

    // -------------------------------------------------------------------------
    // Retrieving Memories
    // -------------------------------------------------------------------------

    /**
     * Get a specific memory by ID
     */
    get(memoryId: string): MemoryEntry | undefined {
        const entry = this.memories.get(memoryId);
        if (entry) {
            entry.accessCount++;
            entry.lastAccessedAt = new Date();
            this.emit('memory:accessed', entry);
        }
        return entry;
    }

    /**
     * Get all memories for an agent
     */
    getAgentMemories(agentId: AgentId): MemoryEntry[] {
        const memIds = this.agentMemories.get(agentId);
        if (!memIds) return [];

        return Array.from(memIds)
            .map(id => this.memories.get(id))
            .filter((m): m is MemoryEntry => m !== undefined);
    }

    /**
     * Get memories by type
     */
    getByType(agentId: AgentId, type: MemoryEntry['type']): MemoryEntry[] {
        return this.getAgentMemories(agentId).filter(m => m.type === type);
    }

    /**
     * Get memories by category
     */
    getByCategory(agentId: AgentId, category: string): MemoryEntry[] {
        return this.getAgentMemories(agentId).filter(m => m.category === category);
    }

    /**
     * Get most important memories
     */
    getMostImportant(agentId: AgentId, limit: number = 10): MemoryEntry[] {
        return this.getAgentMemories(agentId)
            .sort((a, b) => b.importance - a.importance)
            .slice(0, limit);
    }

    /**
     * Get most accessed memories
     */
    getMostAccessed(agentId: AgentId, limit: number = 10): MemoryEntry[] {
        return this.getAgentMemories(agentId)
            .sort((a, b) => b.accessCount - a.accessCount)
            .slice(0, limit);
    }

    /**
     * Get recent memories
     */
    getRecent(agentId: AgentId, limit: number = 10): MemoryEntry[] {
        return this.getAgentMemories(agentId)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, limit);
    }

    /**
     * Search memories by keyword
     */
    search(agentId: AgentId, keyword: string): MemoryEntry[] {
        const lower = keyword.toLowerCase();
        return this.getAgentMemories(agentId).filter(m => {
            const content = JSON.stringify(m.content).toLowerCase();
            return content.includes(lower) || m.category.toLowerCase().includes(lower);
        });
    }

    /**
     * Get associated memories
     */
    getAssociated(memoryId: string): MemoryEntry[] {
        const memory = this.memories.get(memoryId);
        if (!memory) return [];

        return memory.associations
            .map(id => this.memories.get(id))
            .filter((m): m is MemoryEntry => m !== undefined);
    }

    // -------------------------------------------------------------------------
    // Memory Management
    // -------------------------------------------------------------------------

    /**
     * Forget a specific memory
     */
    forget(memoryId: string): boolean {
        const entry = this.memories.get(memoryId);
        if (!entry) return false;

        this.memories.delete(memoryId);

        const agentMems = this.agentMemories.get(entry.agentId);
        if (agentMems) {
            agentMems.delete(memoryId);
        }

        this.emit('memory:forgotten', entry);
        return true;
    }

    /**
     * Add association between memories
     */
    associate(memoryId1: string, memoryId2: string): boolean {
        const mem1 = this.memories.get(memoryId1);
        const mem2 = this.memories.get(memoryId2);

        if (!mem1 || !mem2) return false;

        if (!mem1.associations.includes(memoryId2)) {
            mem1.associations.push(memoryId2);
        }
        if (!mem2.associations.includes(memoryId1)) {
            mem2.associations.push(memoryId1);
        }

        return true;
    }

    /**
     * Consolidate short-term to long-term (based on importance)
     */
    consolidate(agentId: AgentId, importanceThreshold: number = 60): number {
        const shortTerm = this.getByType(agentId, 'SHORT_TERM');
        let consolidated = 0;

        for (const mem of shortTerm) {
            if (mem.importance >= importanceThreshold) {
                mem.type = 'LONG_TERM';
                mem.expiresAt = undefined;
                consolidated++;
            }
        }

        return consolidated;
    }

    /**
     * Clean up expired memories
     */
    cleanup(): number {
        const now = new Date();
        let removed = 0;

        for (const [id, entry] of this.memories) {
            if (entry.expiresAt && entry.expiresAt < now) {
                this.forget(id);
                this.emit('memory:expired', entry);
                removed++;
            }
        }

        return removed;
    }

    /**
     * Enforce memory limits per agent
     */
    private enforceLimits(agentId: AgentId, type: MemoryEntry['type']): void {
        const memories = this.getByType(agentId, type);
        const limit = type === 'SHORT_TERM' ? this.SHORT_TERM_LIMIT : this.LONG_TERM_LIMIT;

        if (memories.length > limit) {
            // Remove least important, oldest memories
            const toRemove = memories
                .sort((a, b) => {
                    const importanceDiff = a.importance - b.importance;
                    if (importanceDiff !== 0) return importanceDiff;
                    return a.lastAccessedAt.getTime() - b.lastAccessedAt.getTime();
                })
                .slice(0, memories.length - limit);

            for (const mem of toRemove) {
                this.forget(mem.id);
            }
        }
    }

    // -------------------------------------------------------------------------
    // Statistics
    // -------------------------------------------------------------------------

    /**
     * Get memory statistics for an agent
     */
    getStats(agentId: AgentId): {
        total: number;
        byType: Record<string, number>;
        avgImportance: number;
        avgAccessCount: number;
    } {
        const memories = this.getAgentMemories(agentId);

        const byType = memories.reduce((acc, m) => {
            acc[m.type] = (acc[m.type] ?? 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const avgImportance = memories.length > 0
            ? memories.reduce((sum, m) => sum + m.importance, 0) / memories.length
            : 0;

        const avgAccessCount = memories.length > 0
            ? memories.reduce((sum, m) => sum + m.accessCount, 0) / memories.length
            : 0;

        return {
            total: memories.length,
            byType,
            avgImportance: Math.round(avgImportance),
            avgAccessCount: Math.round(avgAccessCount * 10) / 10,
        };
    }

    /**
     * Export all memories (for persistence)
     */
    export(): MemoryEntry[] {
        return Array.from(this.memories.values());
    }

    /**
     * Import memories (from persistence)
     */
    import(entries: MemoryEntry[]): void {
        for (const entry of entries) {
            this.memories.set(entry.id, entry);

            let agentMems = this.agentMemories.get(entry.agentId);
            if (!agentMems) {
                agentMems = new Set();
                this.agentMemories.set(entry.agentId, agentMems);
            }
            agentMems.add(entry.id);
        }
    }
}

// Singleton instance
export const memoryStore = new MemoryStore();
