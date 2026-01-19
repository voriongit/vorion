/**
 * Knowledge Store Service
 *
 * Manages Aria's knowledge base with semantic search and categorization.
 *
 * Epic: Aria Memory & Knowledge System
 * Phase 2: Knowledge Store
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { EmbeddingService, getEmbeddingService } from './EmbeddingService.js';
import type {
    KnowledgeEntry,
    KnowledgeEntryInput,
    KnowledgeSearchResult,
    KnowledgeSearchOptions,
    KnowledgeCategory,
} from './types.js';

// ============================================================================
// Knowledge Store Service
// ============================================================================

export class KnowledgeStoreService {
    private supabase: SupabaseClient;
    private embeddingService: EmbeddingService;

    constructor(supabaseUrl?: string, supabaseKey?: string) {
        const url = supabaseUrl || process.env.SUPABASE_URL;
        const key = supabaseKey || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

        if (!url || !key) {
            throw new Error('Supabase URL and key are required');
        }

        this.supabase = createClient(url, key);
        this.embeddingService = getEmbeddingService();
    }

    /**
     * Store a new knowledge entry
     */
    async store(input: KnowledgeEntryInput): Promise<KnowledgeEntry> {
        // Generate embedding for the content
        const fullText = `${input.title}\n\n${input.content}`;
        const { embedding } = await this.embeddingService.embed(fullText);

        const { data, error } = await this.supabase
            .from('aria_knowledge')
            .insert({
                org_id: input.orgId,
                category: input.category,
                subcategory: input.subcategory,
                title: input.title,
                content: input.content,
                embedding: embedding,
                source_type: input.sourceType,
                source_id: input.sourceId,
                confidence: input.confidence ?? 0.8,
                expires_at: input.expiresAt?.toISOString(),
                tags: input.tags || [],
                related_ids: input.relatedIds || [],
                metadata: input.metadata || {},
            })
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to store knowledge: ${error.message}`);
        }

        return this.mapToKnowledgeEntry(data);
    }

    /**
     * Search knowledge by semantic similarity
     */
    async search(
        query: string,
        options: KnowledgeSearchOptions = {}
    ): Promise<KnowledgeSearchResult[]> {
        const {
            categories,
            minConfidence = 0.5,
            includeArchived = false,
            limit = 10,
        } = options;

        // Generate embedding for query
        const { embedding } = await this.embeddingService.embed(query);

        // Use Supabase RPC function for vector search
        const { data, error } = await this.supabase.rpc('search_knowledge', {
            query_embedding: embedding,
            match_threshold: 0.7,
            match_count: limit,
            filter_categories: categories || null,
            min_confidence: minConfidence,
        });

        if (error) {
            throw new Error(`Failed to search knowledge: ${error.message}`);
        }

        // Filter archived if needed
        const results = includeArchived
            ? data
            : data.filter((row: any) => !row.is_archived);

        return results.map((row: any) => ({
            ...this.mapToKnowledgeEntry(row),
            similarity: row.similarity,
        }));
    }

    /**
     * Get knowledge by category
     */
    async getByCategory(
        category: KnowledgeCategory,
        subcategory?: string,
        limit: number = 50
    ): Promise<KnowledgeEntry[]> {
        let query = this.supabase
            .from('aria_knowledge')
            .select('*')
            .eq('category', category)
            .eq('is_archived', false)
            .order('confidence', { ascending: false })
            .limit(limit);

        if (subcategory) {
            query = query.eq('subcategory', subcategory);
        }

        const { data, error } = await query;

        if (error) {
            throw new Error(`Failed to get knowledge by category: ${error.message}`);
        }

        return data.map(this.mapToKnowledgeEntry);
    }

    /**
     * Get knowledge entry by ID
     */
    async getById(id: string): Promise<KnowledgeEntry | null> {
        const { data, error } = await this.supabase
            .from('aria_knowledge')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null; // Not found
            throw new Error(`Failed to get knowledge: ${error.message}`);
        }

        // Increment access count
        await this.incrementAccessCount(id);

        return this.mapToKnowledgeEntry(data);
    }

    /**
     * Get knowledge about a specific agent
     */
    async getAgentKnowledge(agentId: string): Promise<KnowledgeEntry[]> {
        const { data, error } = await this.supabase
            .from('aria_knowledge')
            .select('*')
            .eq('category', 'agent')
            .or(`source_id.eq.${agentId},metadata->agentId.eq.${agentId}`)
            .eq('is_archived', false)
            .order('confidence', { ascending: false });

        if (error) {
            throw new Error(`Failed to get agent knowledge: ${error.message}`);
        }

        return data.map(this.mapToKnowledgeEntry);
    }

    /**
     * Get system architecture knowledge
     */
    async getSystemArchitecture(): Promise<KnowledgeEntry[]> {
        const { data, error } = await this.supabase
            .from('aria_knowledge')
            .select('*')
            .eq('category', 'system')
            .eq('is_archived', false)
            .order('confidence', { ascending: false });

        if (error) {
            throw new Error(`Failed to get system architecture: ${error.message}`);
        }

        return data.map(this.mapToKnowledgeEntry);
    }

    /**
     * Update knowledge entry
     */
    async update(id: string, updates: Partial<KnowledgeEntryInput>): Promise<KnowledgeEntry> {
        const updateData: Record<string, any> = {};

        if (updates.title !== undefined) updateData.title = updates.title;
        if (updates.content !== undefined) updateData.content = updates.content;
        if (updates.category !== undefined) updateData.category = updates.category;
        if (updates.subcategory !== undefined) updateData.subcategory = updates.subcategory;
        if (updates.confidence !== undefined) updateData.confidence = updates.confidence;
        if (updates.tags !== undefined) updateData.tags = updates.tags;
        if (updates.relatedIds !== undefined) updateData.related_ids = updates.relatedIds;
        if (updates.metadata !== undefined) updateData.metadata = updates.metadata;
        if (updates.expiresAt !== undefined) updateData.expires_at = updates.expiresAt?.toISOString();

        // Re-generate embedding if content changed
        if (updates.title !== undefined || updates.content !== undefined) {
            const existing = await this.getById(id);
            if (existing) {
                const fullText = `${updates.title ?? existing.title}\n\n${updates.content ?? existing.content}`;
                const { embedding } = await this.embeddingService.embed(fullText);
                updateData.embedding = embedding;
            }
        }

        const { data, error } = await this.supabase
            .from('aria_knowledge')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to update knowledge: ${error.message}`);
        }

        return this.mapToKnowledgeEntry(data);
    }

    /**
     * Verify a knowledge entry (HITL verification)
     */
    async verify(id: string, verifiedBy: string): Promise<KnowledgeEntry> {
        const { data, error } = await this.supabase
            .from('aria_knowledge')
            .update({
                verified_by: verifiedBy,
                verified_at: new Date().toISOString(),
                confidence: 1.0, // Verified entries get max confidence
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to verify knowledge: ${error.message}`);
        }

        return this.mapToKnowledgeEntry(data);
    }

    /**
     * Archive a knowledge entry (soft delete)
     */
    async archive(id: string): Promise<void> {
        const { error } = await this.supabase
            .from('aria_knowledge')
            .update({ is_archived: true })
            .eq('id', id);

        if (error) {
            throw new Error(`Failed to archive knowledge: ${error.message}`);
        }
    }

    /**
     * Find duplicate or similar knowledge entries
     */
    async findDuplicates(
        entry: KnowledgeEntryInput,
        similarityThreshold: number = 0.9
    ): Promise<KnowledgeSearchResult[]> {
        const fullText = `${entry.title}\n\n${entry.content}`;
        const { embedding } = await this.embeddingService.embed(fullText);

        const { data, error } = await this.supabase.rpc('search_knowledge', {
            query_embedding: embedding,
            match_threshold: similarityThreshold,
            match_count: 5,
            filter_categories: [entry.category],
            min_confidence: 0,
        });

        if (error) {
            throw new Error(`Failed to find duplicates: ${error.message}`);
        }

        return data.map((row: any) => ({
            ...this.mapToKnowledgeEntry(row),
            similarity: row.similarity,
        }));
    }

    /**
     * Get knowledge statistics
     */
    async getStats(): Promise<{
        totalEntries: number;
        byCategory: Record<KnowledgeCategory, number>;
        bySourceType: Record<string, number>;
        verifiedCount: number;
        avgConfidence: number;
    }> {
        const { data, error } = await this.supabase
            .from('aria_knowledge')
            .select('category, source_type, confidence, verified_by')
            .eq('is_archived', false);

        if (error) {
            throw new Error(`Failed to get stats: ${error.message}`);
        }

        const byCategory: Record<string, number> = {};
        const bySourceType: Record<string, number> = {};
        let totalConfidence = 0;
        let verifiedCount = 0;

        for (const row of data || []) {
            byCategory[row.category] = (byCategory[row.category] || 0) + 1;
            bySourceType[row.source_type] = (bySourceType[row.source_type] || 0) + 1;
            totalConfidence += row.confidence;
            if (row.verified_by) verifiedCount++;
        }

        return {
            totalEntries: data?.length || 0,
            byCategory: byCategory as Record<KnowledgeCategory, number>,
            bySourceType,
            verifiedCount,
            avgConfidence: data?.length ? totalConfidence / data.length : 0,
        };
    }

    /**
     * Seed initial system knowledge
     */
    async seedSystemKnowledge(): Promise<number> {
        const systemKnowledge: KnowledgeEntryInput[] = [
            {
                category: 'system',
                subcategory: 'architecture',
                title: 'Aurais Agent Hierarchy',
                content: `Aurais uses a 6-tier trust hierarchy (T0-T5):
- T5 (SOVEREIGN): System orchestrators with full autonomy
- T4 (EXECUTIVE): Domain orchestrators with high autonomy
- T3 (TACTICAL): Task orchestrators managing projects
- T2 (OPERATIONAL): Specialists executing tasks
- T1 (WORKER): Basic task execution
- T0 (PASSIVE): Observers and listeners only`,
                sourceType: 'manual',
                confidence: 1.0,
                tags: ['tiers', 'hierarchy', 'trust'],
            },
            {
                category: 'governance',
                subcategory: 'trust',
                title: 'Trust Score Calculation',
                content: `Trust scores range from 0-1000 and consist of:
- Inherited trust (80% from parent agent)
- Earned trust (from successful task completion)
- Penalties (from violations, propagates 50% to parent)
Tier thresholds: T5 900+, T4 700-899, T3 500-699, T2 300-499, T1 100-299, T0 0-99`,
                sourceType: 'manual',
                confidence: 1.0,
                tags: ['trust', 'scoring', 'tiers'],
            },
            {
                category: 'governance',
                subcategory: 'hitl',
                title: 'Human-in-the-Loop (HITL) Levels',
                content: `HITL level (0-100) controls human oversight:
- 0-25: Minimal oversight, most actions auto-approved
- 26-50: Moderate oversight, high-impact actions need approval
- 51-75: High oversight, most delegations need approval
- 76-100: Maximum oversight, all significant actions need approval
Directors can adjust HITL level based on operational risk.`,
                sourceType: 'manual',
                confidence: 1.0,
                tags: ['hitl', 'oversight', 'governance'],
            },
            {
                category: 'workflow',
                subcategory: 'approval',
                title: 'Approval Request Flow',
                content: `When an agent requests an action requiring approval:
1. Request enters the decision queue
2. Classified by urgency (immediate vs morning review)
3. Trust Gate rules evaluated
4. HITL operator reviews with context
5. Approve/Deny with optional rationale
6. Decision logged with trust impact
7. Agent notified and action executed (if approved)`,
                sourceType: 'manual',
                confidence: 1.0,
                tags: ['approval', 'workflow', 'hitl'],
            },
            {
                category: 'agent',
                subcategory: 'types',
                title: 'Core Agent Types',
                content: `Aurais includes specialized agent types:
- T5-Spawner: Creates new agents
- T5-Validator: Quality assurance
- T5-Executor: Task execution orchestration
- T5-Evolver: Continuous improvement
- T5-Planner: Strategic planning
- DOMAIN_ORCHESTRATOR (T4): Strategic coordination
- TASK_ORCHESTRATOR (T3): Project management
- SPECIALIST (T2): Domain experts
- WORKER (T1): Basic execution
- LISTENER/OBSERVER (T0): Monitoring`,
                sourceType: 'manual',
                confidence: 1.0,
                tags: ['agents', 'types', 'roles'],
            },
        ];

        let seeded = 0;
        for (const knowledge of systemKnowledge) {
            // Check if already exists
            const duplicates = await this.findDuplicates(knowledge, 0.95);
            if (duplicates.length === 0) {
                await this.store(knowledge);
                seeded++;
            }
        }

        return seeded;
    }

    // ========================================================================
    // Private Methods
    // ========================================================================

    private async incrementAccessCount(id: string): Promise<void> {
        await this.supabase.rpc('increment_knowledge_access', { knowledge_id: id });
    }

    private mapToKnowledgeEntry(row: any): KnowledgeEntry {
        return {
            id: row.id,
            orgId: row.org_id,
            category: row.category,
            subcategory: row.subcategory,
            title: row.title,
            content: row.content,
            embedding: row.embedding,
            sourceType: row.source_type,
            sourceId: row.source_id,
            confidence: row.confidence,
            accessCount: row.access_count,
            lastAccessedAt: row.last_accessed_at ? new Date(row.last_accessed_at) : undefined,
            verifiedBy: row.verified_by,
            verifiedAt: row.verified_at ? new Date(row.verified_at) : undefined,
            expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
            isArchived: row.is_archived,
            tags: row.tags || [],
            relatedIds: row.related_ids || [],
            metadata: row.metadata,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
        };
    }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let knowledgeStoreInstance: KnowledgeStoreService | null = null;

export function getKnowledgeStoreService(): KnowledgeStoreService {
    if (!knowledgeStoreInstance) {
        knowledgeStoreInstance = new KnowledgeStoreService();
    }
    return knowledgeStoreInstance;
}

export function resetKnowledgeStoreService(): void {
    knowledgeStoreInstance = null;
}
