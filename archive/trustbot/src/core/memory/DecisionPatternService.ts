/**
 * Decision Pattern Service
 *
 * Manages Aria's decision pattern learning for predicting HITL preferences.
 * Uses semantic matching to find similar past decisions.
 *
 * Epic: Aria Memory & Knowledge System
 * Phase 2: Decision Pattern Learning
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { EmbeddingService, getEmbeddingService } from './EmbeddingService.js';
import type {
    DecisionPattern,
    DecisionPatternInput,
    DecisionPatternSearchResult,
    DecisionPatternType,
    DecisionOutcome,
} from './types.js';

// ============================================================================
// Decision Pattern Service
// ============================================================================

export class DecisionPatternService {
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
     * Record a new decision pattern or update existing one
     */
    async record(input: DecisionPatternInput): Promise<DecisionPattern> {
        // Generate context signature for exact matching
        const contextSignature = this.generateContextSignature(input);

        // Generate embedding for semantic matching
        const contextText = this.buildContextText(input);
        const { embedding } = await this.embeddingService.embed(contextText);

        // Use Supabase RPC function for upsert
        const { data, error } = await this.supabase.rpc('upsert_decision_pattern', {
            p_context_signature: contextSignature,
            p_pattern_type: input.patternType,
            p_agent_type: input.agentType,
            p_agent_tier: input.agentTier,
            p_action_type: input.actionType,
            p_decision: input.decision,
            p_rationale: input.rationale,
            p_hitl_user_id: input.hitlUserId,
            p_context_embedding: embedding,
            p_context_summary: input.contextSummary,
            p_org_id: input.orgId,
        });

        if (error) {
            throw new Error(`Failed to record decision pattern: ${error.message}`);
        }

        // Fetch the created/updated pattern
        return this.getById(data);
    }

    /**
     * Find similar decision patterns using semantic search
     */
    async findSimilar(
        context: {
            agentType?: string;
            agentTier?: number;
            actionType?: string;
            contextSummary: string;
        },
        options: {
            patternType?: DecisionPatternType;
            limit?: number;
            minSimilarity?: number;
        } = {}
    ): Promise<DecisionPatternSearchResult[]> {
        const { patternType, limit = 5, minSimilarity = 0.75 } = options;

        // Generate embedding for search query
        const contextText = this.buildContextText(context);
        const { embedding } = await this.embeddingService.embed(contextText);

        // Use Supabase RPC function for vector search
        const { data, error } = await this.supabase.rpc('find_similar_patterns', {
            query_embedding: embedding,
            match_threshold: minSimilarity,
            match_count: limit,
            filter_pattern_type: patternType || null,
            filter_agent_type: context.agentType || null,
        });

        if (error) {
            throw new Error(`Failed to find similar patterns: ${error.message}`);
        }

        return data.map((row: any) => this.mapToDecisionPattern(row));
    }

    /**
     * Get pattern by ID
     */
    async getById(id: string): Promise<DecisionPattern> {
        const { data, error } = await this.supabase
            .from('aria_decision_patterns')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            throw new Error(`Failed to get decision pattern: ${error.message}`);
        }

        return this.mapToDecisionPattern(data);
    }

    /**
     * Get patterns by type
     */
    async getByType(
        patternType: DecisionPatternType,
        options: { limit?: number; minFrequency?: number } = {}
    ): Promise<DecisionPattern[]> {
        const { limit = 50, minFrequency = 1 } = options;

        const { data, error } = await this.supabase
            .from('aria_decision_patterns')
            .select('*')
            .eq('pattern_type', patternType)
            .gte('frequency', minFrequency)
            .order('frequency', { ascending: false })
            .limit(limit);

        if (error) {
            throw new Error(`Failed to get patterns by type: ${error.message}`);
        }

        return data.map(this.mapToDecisionPattern);
    }

    /**
     * Get patterns for a specific HITL user
     */
    async getByUser(
        hitlUserId: string,
        options: { limit?: number } = {}
    ): Promise<DecisionPattern[]> {
        const { limit = 50 } = options;

        const { data, error } = await this.supabase
            .from('aria_decision_patterns')
            .select('*')
            .eq('hitl_user_id', hitlUserId)
            .order('last_occurred_at', { ascending: false })
            .limit(limit);

        if (error) {
            throw new Error(`Failed to get patterns by user: ${error.message}`);
        }

        return data.map(this.mapToDecisionPattern);
    }

    /**
     * Get top patterns by frequency
     */
    async getTopPatterns(
        options: { limit?: number; patternType?: DecisionPatternType } = {}
    ): Promise<DecisionPattern[]> {
        const { limit = 20, patternType } = options;

        let query = this.supabase
            .from('aria_decision_patterns')
            .select('*')
            .order('frequency', { ascending: false })
            .limit(limit);

        if (patternType) {
            query = query.eq('pattern_type', patternType);
        }

        const { data, error } = await query;

        if (error) {
            throw new Error(`Failed to get top patterns: ${error.message}`);
        }

        return data.map(this.mapToDecisionPattern);
    }

    /**
     * Update pattern outcome
     */
    async updateOutcome(
        id: string,
        outcome: DecisionOutcome,
        details?: string
    ): Promise<DecisionPattern> {
        // Get current pattern to calculate new success rate
        const current = await this.getById(id);
        const totalOutcomes = current.frequency;
        const currentSuccessRate = current.successRate;

        // Calculate new success rate
        const wasSuccess = outcome === 'success';
        const newSuccessRate = wasSuccess
            ? (currentSuccessRate * (totalOutcomes - 1) + 1) / totalOutcomes
            : (currentSuccessRate * (totalOutcomes - 1)) / totalOutcomes;

        const { data, error } = await this.supabase
            .from('aria_decision_patterns')
            .update({
                outcome,
                outcome_details: details,
                success_rate: newSuccessRate,
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to update pattern outcome: ${error.message}`);
        }

        return this.mapToDecisionPattern(data);
    }

    /**
     * Predict decision based on similar patterns
     */
    async predictDecision(context: {
        agentType?: string;
        agentTier?: number;
        actionType?: string;
        contextSummary: string;
    }): Promise<{
        recommendedDecision: DecisionPatternType | null;
        confidence: number;
        basedOn: DecisionPatternSearchResult[];
    }> {
        const similarPatterns = await this.findSimilar(context, {
            limit: 10,
            minSimilarity: 0.7,
        });

        if (similarPatterns.length === 0) {
            return {
                recommendedDecision: null,
                confidence: 0,
                basedOn: [],
            };
        }

        // Weight by similarity and success rate
        const decisionScores = new Map<DecisionPatternType, number>();

        for (const pattern of similarPatterns) {
            const weight = pattern.similarity * pattern.successRate * pattern.frequency;
            const currentScore = decisionScores.get(pattern.patternType) || 0;
            decisionScores.set(pattern.patternType, currentScore + weight);
        }

        // Find best decision
        let bestDecision: DecisionPatternType | null = null;
        let bestScore = 0;
        let totalScore = 0;

        for (const [decision, score] of decisionScores) {
            totalScore += score;
            if (score > bestScore) {
                bestScore = score;
                bestDecision = decision;
            }
        }

        // Calculate confidence
        const confidence = totalScore > 0 ? bestScore / totalScore : 0;

        return {
            recommendedDecision: bestDecision,
            confidence: Math.min(1, confidence),
            basedOn: similarPatterns.slice(0, 5),
        };
    }

    /**
     * Get pattern statistics
     */
    async getStats(): Promise<{
        totalPatterns: number;
        byType: Record<DecisionPatternType, number>;
        avgSuccessRate: number;
        topAgentTypes: Array<{ agentType: string; count: number }>;
    }> {
        const { data, error } = await this.supabase
            .from('aria_decision_patterns')
            .select('pattern_type, agent_type, success_rate, frequency');

        if (error) {
            throw new Error(`Failed to get stats: ${error.message}`);
        }

        const byType: Record<string, number> = {};
        const agentTypeCounts: Record<string, number> = {};
        let totalSuccessRate = 0;
        let totalFrequency = 0;

        for (const row of data || []) {
            byType[row.pattern_type] = (byType[row.pattern_type] || 0) + 1;
            if (row.agent_type) {
                agentTypeCounts[row.agent_type] = (agentTypeCounts[row.agent_type] || 0) + row.frequency;
            }
            totalSuccessRate += row.success_rate * row.frequency;
            totalFrequency += row.frequency;
        }

        // Sort agent types by count
        const topAgentTypes = Object.entries(agentTypeCounts)
            .map(([agentType, count]) => ({ agentType, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        return {
            totalPatterns: data?.length || 0,
            byType: byType as Record<DecisionPatternType, number>,
            avgSuccessRate: totalFrequency > 0 ? totalSuccessRate / totalFrequency : 0,
            topAgentTypes,
        };
    }

    // ========================================================================
    // Private Methods
    // ========================================================================

    private generateContextSignature(context: Partial<DecisionPatternInput>): string {
        const signatureData = JSON.stringify({
            agentType: context.agentType,
            agentTier: context.agentTier,
            actionType: context.actionType,
            patternType: context.patternType,
        });
        return createHash('sha256').update(signatureData).digest('hex');
    }

    private buildContextText(context: {
        agentType?: string;
        agentTier?: number;
        actionType?: string;
        contextSummary?: string;
    }): string {
        const parts = [];
        if (context.agentType) parts.push(`Agent: ${context.agentType}`);
        if (context.agentTier !== undefined) parts.push(`Tier: T${context.agentTier}`);
        if (context.actionType) parts.push(`Action: ${context.actionType}`);
        if (context.contextSummary) parts.push(context.contextSummary);
        return parts.join(' | ');
    }

    private mapToDecisionPattern(row: any): DecisionPattern | DecisionPatternSearchResult {
        const base: DecisionPattern = {
            id: row.id,
            orgId: row.org_id,
            patternType: row.pattern_type,
            contextSignature: row.context_signature,
            contextEmbedding: row.context_embedding,
            contextSummary: row.context_summary,
            agentType: row.agent_type,
            agentTier: row.agent_tier,
            actionType: row.action_type,
            decision: row.decision,
            rationale: row.rationale,
            outcome: row.outcome,
            outcomeDetails: row.outcome_details,
            hitlUserId: row.hitl_user_id,
            frequency: row.frequency,
            successRate: row.success_rate,
            lastOccurredAt: new Date(row.last_occurred_at),
            metadata: row.metadata,
            createdAt: new Date(row.created_at),
        };

        // Add similarity if present (for search results)
        if (row.similarity !== undefined) {
            return { ...base, similarity: row.similarity } as DecisionPatternSearchResult;
        }

        return base;
    }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let decisionPatternInstance: DecisionPatternService | null = null;

export function getDecisionPatternService(): DecisionPatternService {
    if (!decisionPatternInstance) {
        decisionPatternInstance = new DecisionPatternService();
    }
    return decisionPatternInstance;
}

export function resetDecisionPatternService(): void {
    decisionPatternInstance = null;
}
