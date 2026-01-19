/**
 * Conversation Memory Service
 *
 * Stores and retrieves Aria conversation history with semantic search.
 *
 * Epic: Aria Memory & Knowledge System
 * Phase 1: Foundation
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { EmbeddingService, getEmbeddingService } from './EmbeddingService.js';
import type {
    ConversationEntry,
    ConversationEntryInput,
    ConversationSearchResult,
} from './types.js';

// ============================================================================
// Types
// ============================================================================

export interface ConversationSearchOptions {
    userId?: string;
    sessionId?: string;
    limit?: number;
    similarityThreshold?: number;
    startDate?: Date;
    endDate?: Date;
}

export interface SessionSummary {
    sessionId: string;
    userId?: string;
    messageCount: number;
    firstMessage: Date;
    lastMessage: Date;
    topicsDiscussed: string[];
}

// ============================================================================
// Conversation Memory Service
// ============================================================================

export class ConversationMemoryService {
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
     * Store a new conversation message
     */
    async storeMessage(input: ConversationEntryInput): Promise<ConversationEntry> {
        // Generate embedding for the message
        const { embedding, tokensUsed } = await this.embeddingService.embed(input.content);

        const { data, error } = await this.supabase
            .from('aria_conversations')
            .insert({
                session_id: input.sessionId,
                user_id: input.userId,
                org_id: input.orgId,
                role: input.role,
                content: input.content,
                embedding: embedding,
                tokens_used: tokensUsed,
                provider: input.provider,
                model: input.model,
                metadata: input.metadata || {},
            })
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to store conversation: ${error.message}`);
        }

        return this.mapToConversationEntry(data);
    }

    /**
     * Store multiple messages in batch
     */
    async storeMessages(inputs: ConversationEntryInput[]): Promise<ConversationEntry[]> {
        // Generate embeddings in batch
        const { embeddings } = await this.embeddingService.embedBatch(
            inputs.map((i) => i.content)
        );

        const records = inputs.map((input, index) => ({
            session_id: input.sessionId,
            user_id: input.userId,
            org_id: input.orgId,
            role: input.role,
            content: input.content,
            embedding: embeddings[index],
            provider: input.provider,
            model: input.model,
            metadata: input.metadata || {},
        }));

        const { data, error } = await this.supabase
            .from('aria_conversations')
            .insert(records)
            .select();

        if (error) {
            throw new Error(`Failed to store conversations: ${error.message}`);
        }

        return data.map(this.mapToConversationEntry);
    }

    /**
     * Get conversation history for a session
     */
    async getSessionHistory(sessionId: string, limit: number = 50): Promise<ConversationEntry[]> {
        const { data, error } = await this.supabase
            .from('aria_conversations')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: true })
            .limit(limit);

        if (error) {
            throw new Error(`Failed to get session history: ${error.message}`);
        }

        return data.map(this.mapToConversationEntry);
    }

    /**
     * Get recent conversations for a user
     */
    async getUserHistory(userId: string, limit: number = 100): Promise<ConversationEntry[]> {
        const { data, error } = await this.supabase
            .from('aria_conversations')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            throw new Error(`Failed to get user history: ${error.message}`);
        }

        return data.map(this.mapToConversationEntry).reverse();
    }

    /**
     * Search conversations by semantic similarity
     */
    async searchConversations(
        query: string,
        options: ConversationSearchOptions = {}
    ): Promise<ConversationSearchResult[]> {
        const {
            userId,
            sessionId,
            limit = 10,
            similarityThreshold = 0.7,
        } = options;

        // Generate embedding for query
        const { embedding } = await this.embeddingService.embed(query);

        // Use Supabase RPC function for vector search
        const { data, error } = await this.supabase.rpc('search_conversations', {
            query_embedding: embedding,
            match_threshold: similarityThreshold,
            match_count: limit,
            filter_user_id: userId || null,
            filter_session_id: sessionId || null,
        });

        if (error) {
            throw new Error(`Failed to search conversations: ${error.message}`);
        }

        return data.map((row: any) => ({
            ...this.mapToConversationEntry(row),
            similarity: row.similarity,
        }));
    }

    /**
     * Get recent context for building prompts (optimized for token limits)
     */
    async getRecentContext(
        userId: string,
        maxTokens: number = 1000,
        sessionId?: string
    ): Promise<ConversationEntry[]> {
        // Get recent messages, prioritizing current session
        let query = this.supabase
            .from('aria_conversations')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(50);

        if (sessionId) {
            // Prioritize current session
            query = query.or(`session_id.eq.${sessionId}`);
        }

        const { data, error } = await query;

        if (error) {
            throw new Error(`Failed to get recent context: ${error.message}`);
        }

        // Trim to fit token limit
        const entries: ConversationEntry[] = [];
        let totalTokens = 0;

        for (const row of data) {
            const entry = this.mapToConversationEntry(row);
            const estimatedTokens = Math.ceil(entry.content.length / 4); // Rough estimate

            if (totalTokens + estimatedTokens > maxTokens) {
                break;
            }

            entries.push(entry);
            totalTokens += estimatedTokens;
        }

        return entries.reverse(); // Chronological order
    }

    /**
     * Get session summaries for a user
     */
    async getUserSessions(userId: string, limit: number = 10): Promise<SessionSummary[]> {
        const { data, error } = await this.supabase
            .from('aria_conversations')
            .select('session_id, user_id, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            throw new Error(`Failed to get user sessions: ${error.message}`);
        }

        // Group by session
        const sessions = new Map<string, { messages: any[]; userId?: string }>();

        for (const row of data) {
            const existing = sessions.get(row.session_id);
            if (existing) {
                existing.messages.push(row);
            } else {
                sessions.set(row.session_id, {
                    messages: [row],
                    userId: row.user_id,
                });
            }
        }

        // Convert to summaries
        const summaries: SessionSummary[] = [];

        const sessionEntries = Array.from(sessions.entries());
        for (let i = 0; i < sessionEntries.length && summaries.length < limit; i++) {
            const [sessionId, session] = sessionEntries[i]!;
            const messages = session.messages;
            summaries.push({
                sessionId,
                userId: session.userId,
                messageCount: messages.length,
                firstMessage: new Date(messages[messages.length - 1].created_at),
                lastMessage: new Date(messages[0].created_at),
                topicsDiscussed: [], // Would need AI extraction
            });
        }

        return summaries;
    }

    /**
     * Delete old conversations (for cleanup)
     */
    async deleteOldConversations(olderThanDays: number = 90): Promise<number> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

        const { data, error } = await this.supabase
            .from('aria_conversations')
            .delete()
            .lt('created_at', cutoffDate.toISOString())
            .select('id');

        if (error) {
            throw new Error(`Failed to delete old conversations: ${error.message}`);
        }

        return data?.length || 0;
    }

    /**
     * Get conversation statistics
     */
    async getStats(userId?: string): Promise<{
        totalMessages: number;
        totalSessions: number;
        avgMessagesPerSession: number;
        messagesByRole: Record<string, number>;
    }> {
        let query = this.supabase
            .from('aria_conversations')
            .select('id, session_id, role', { count: 'exact' });

        if (userId) {
            query = query.eq('user_id', userId);
        }

        const { data, count, error } = await query;

        if (error) {
            throw new Error(`Failed to get stats: ${error.message}`);
        }

        const sessions = new Set(data?.map((d) => d.session_id) || []);
        const roleCount: Record<string, number> = {};

        for (const row of data || []) {
            roleCount[row.role] = (roleCount[row.role] || 0) + 1;
        }

        return {
            totalMessages: count || 0,
            totalSessions: sessions.size,
            avgMessagesPerSession: sessions.size > 0 ? (count || 0) / sessions.size : 0,
            messagesByRole: roleCount,
        };
    }

    // ========================================================================
    // Private Methods
    // ========================================================================

    private mapToConversationEntry(row: any): ConversationEntry {
        return {
            id: row.id,
            sessionId: row.session_id,
            userId: row.user_id,
            orgId: row.org_id,
            role: row.role,
            content: row.content,
            embedding: row.embedding,
            tokensUsed: row.tokens_used,
            provider: row.provider,
            model: row.model,
            metadata: row.metadata,
            createdAt: new Date(row.created_at),
        };
    }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let conversationMemoryInstance: ConversationMemoryService | null = null;

export function getConversationMemoryService(): ConversationMemoryService {
    if (!conversationMemoryInstance) {
        conversationMemoryInstance = new ConversationMemoryService();
    }
    return conversationMemoryInstance;
}

export function resetConversationMemoryService(): void {
    conversationMemoryInstance = null;
}
