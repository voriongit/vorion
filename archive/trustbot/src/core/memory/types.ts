/**
 * Aria Memory System - Type Definitions
 *
 * Epic: Aria Memory & Knowledge System
 * Phase 1: Foundation
 */

// ============================================================================
// Core Enums
// ============================================================================

export type ConversationRole = 'user' | 'aria' | 'system';

export type KnowledgeCategory =
    | 'agent'      // Agent profiles, capabilities, purposes
    | 'workflow'   // Task workflows, processes
    | 'governance' // Rules, policies, trust gates
    | 'pattern'    // Learned behavioral patterns
    | 'decision'   // Past decisions and rationales
    | 'system';    // System architecture, components

export type KnowledgeSourceType =
    | 'observation'  // Shadow Bot extracted
    | 'extraction'   // AI-extracted from conversations
    | 'manual'       // Human-entered
    | 'inferred';    // Derived from patterns

export type DecisionPatternType =
    | 'approval'
    | 'denial'
    | 'delegation'
    | 'escalation'
    | 'modification';

export type DecisionOutcome = 'success' | 'failure' | 'pending' | 'unknown';

export type VerbosityLevel = 'concise' | 'normal' | 'detailed';

export type MemoryAgentType = 'librarian' | 'shadow_bot' | 'archivist';

export type MemoryAgentAction =
    // Librarian actions
    | 'indexed'
    | 'consolidated'
    | 'expired'
    | 'archived'
    | 'quality_assessed'
    | 'deduplicated'
    // Shadow Bot actions
    | 'observed'
    | 'extracted'
    | 'learned'
    | 'pattern_detected'
    // Archivist actions
    | 'retrieved'
    | 'ranked'
    | 'summarized'
    | 'context_built';

// ============================================================================
// Conversation Types
// ============================================================================

export interface ConversationEntry {
    id: string;
    sessionId: string;
    userId?: string;
    orgId?: string;
    role: ConversationRole;
    content: string;
    embedding?: number[];
    tokensUsed?: number;
    provider?: string;
    model?: string;
    metadata?: Record<string, unknown>;
    createdAt: Date;
}

export interface ConversationEntryInput {
    sessionId: string;
    userId?: string;
    orgId?: string;
    role: ConversationRole;
    content: string;
    provider?: string;
    model?: string;
    metadata?: Record<string, unknown>;
}

export interface ConversationSearchResult extends ConversationEntry {
    similarity: number;
}

// ============================================================================
// Knowledge Types
// ============================================================================

export interface KnowledgeEntry {
    id: string;
    orgId?: string;
    category: KnowledgeCategory;
    subcategory?: string;
    title: string;
    content: string;
    embedding?: number[];
    sourceType: KnowledgeSourceType;
    sourceId?: string;
    confidence: number;
    accessCount: number;
    lastAccessedAt?: Date;
    verifiedBy?: string;
    verifiedAt?: Date;
    expiresAt?: Date;
    isArchived: boolean;
    tags: string[];
    relatedIds: string[];
    metadata?: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
}

export interface KnowledgeEntryInput {
    orgId?: string;
    category: KnowledgeCategory;
    subcategory?: string;
    title: string;
    content: string;
    sourceType: KnowledgeSourceType;
    sourceId?: string;
    confidence?: number;
    expiresAt?: Date;
    tags?: string[];
    relatedIds?: string[];
    metadata?: Record<string, unknown>;
}

export interface KnowledgeSearchResult extends KnowledgeEntry {
    similarity: number;
}

export interface KnowledgeSearchOptions {
    categories?: KnowledgeCategory[];
    minConfidence?: number;
    includeArchived?: boolean;
    limit?: number;
    tags?: string[];
}

// ============================================================================
// Decision Pattern Types
// ============================================================================

export interface DecisionPattern {
    id: string;
    orgId?: string;
    patternType: DecisionPatternType;
    contextSignature: string;
    contextEmbedding?: number[];
    contextSummary?: string;
    agentType?: string;
    agentTier?: number;
    actionType?: string;
    decision: string;
    rationale?: string;
    outcome?: DecisionOutcome;
    outcomeDetails?: string;
    hitlUserId?: string;
    frequency: number;
    successRate: number;
    lastOccurredAt: Date;
    metadata?: Record<string, unknown>;
    createdAt: Date;
}

export interface DecisionPatternInput {
    orgId?: string;
    patternType: DecisionPatternType;
    contextSignature: string;
    contextSummary?: string;
    agentType?: string;
    agentTier?: number;
    actionType?: string;
    decision: string;
    rationale?: string;
    hitlUserId?: string;
    metadata?: Record<string, unknown>;
}

export interface DecisionPatternSearchResult extends DecisionPattern {
    similarity: number;
}

// ============================================================================
// User Preferences Types
// ============================================================================

export interface NotificationPreferences {
    approvals: boolean;
    alerts: boolean;
    agentUpdates: boolean;
    dailySummary: boolean;
}

export interface LearnedPreferences {
    approvalTendency?: 'cautious' | 'moderate' | 'permissive';
    preferredExplanations?: 'brief' | 'detailed';
    commonQueries?: string[];
    activeHours?: { start: number; end: number };
    responseStyle?: 'technical' | 'conversational';
    [key: string]: unknown;
}

export interface UserPreferences {
    id: string;
    userId: string;
    orgId?: string;
    displayName?: string;
    avatarUrl?: string;
    preferredProvider: string;
    voiceEnabled: boolean;
    voiceName?: string;
    verbosityLevel: VerbosityLevel;
    notificationPreferences: NotificationPreferences;
    learnedPreferences: LearnedPreferences;
    lastSessionId?: string;
    lastActiveAt?: Date;
    totalInteractions: number;
    totalApprovals: number;
    totalDenials: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface UserPreferencesInput {
    userId: string;
    orgId?: string;
    displayName?: string;
    preferredProvider?: string;
    voiceEnabled?: boolean;
    verbosityLevel?: VerbosityLevel;
    notificationPreferences?: Partial<NotificationPreferences>;
}

// ============================================================================
// Memory Agent Types
// ============================================================================

export interface MemoryAgentLog {
    id: string;
    orgId?: string;
    agentType: MemoryAgentType;
    agentId?: string;
    action: MemoryAgentAction;
    targetType?: string;
    targetId?: string;
    success: boolean;
    details?: Record<string, unknown>;
    durationMs?: number;
    tokensUsed?: number;
    createdAt: Date;
}

export interface MemoryAgentStats {
    agentType: MemoryAgentType;
    action: MemoryAgentAction;
    totalActions: number;
    successful: number;
    failed: number;
    avgDurationMs: number;
    totalTokens: number;
    lastActivity: Date;
}

// ============================================================================
// RAG & Context Types
// ============================================================================

export interface MemoryContext {
    recentConversations: ConversationEntry[];
    relevantKnowledge: KnowledgeSearchResult[];
    matchingPatterns: DecisionPatternSearchResult[];
    userPreferences?: UserPreferences;
    systemState: {
        agentCount: number;
        pendingApprovals: number;
        hitlLevel: number;
        avgTrust: number;
    };
}

export interface RAGSource {
    type: 'conversation' | 'knowledge' | 'pattern';
    id: string;
    title: string;
    relevance: number;
    snippet?: string;
}

export interface RAGResult {
    context: string;
    sources: RAGSource[];
    tokenCount: number;
    retrievalTimeMs: number;
}

export interface ContextRequest {
    query: string;
    userId?: string;
    sessionId?: string;
    maxTokens?: number;
    includeConversations?: boolean;
    includeKnowledge?: boolean;
    includePatterns?: boolean;
    knowledgeCategories?: KnowledgeCategory[];
    minConfidence?: number;
}

export interface ContextPriority {
    level: 1 | 2 | 3 | 4 | 5;
    category: string;
    maxTokens: number;
}

// ============================================================================
// Extraction Types (for Shadow Bot)
// ============================================================================

export interface ExtractionResult {
    type: 'fact' | 'preference' | 'pattern' | 'relationship';
    category: KnowledgeCategory;
    title: string;
    content: string;
    confidence: number;
    sourceConversationId: string;
}

export interface PatternInsight {
    pattern: string;
    frequency: number;
    examples: string[];
    confidence: number;
}

export interface OperatorTendencies {
    userId: string;
    approvalRate: number;
    avgReviewTime: number;
    commonRationales: string[];
    preferredAgentTypes: string[];
    riskTolerance: 'low' | 'medium' | 'high';
}

// ============================================================================
// Service Configuration
// ============================================================================

export interface EmbeddingConfig {
    provider: 'openai' | 'claude';
    model: string;
    dimensions: number;
    batchSize: number;
    cacheEnabled: boolean;
}

export interface MemoryServiceConfig {
    embedding: EmbeddingConfig;
    retrieval: {
        defaultLimit: number;
        similarityThreshold: number;
        maxContextTokens: number;
    };
    learning: {
        extractionEnabled: boolean;
        minConfidenceThreshold: number;
        sessionIdleTimeoutMs: number;
    };
}

export const DEFAULT_MEMORY_CONFIG: MemoryServiceConfig = {
    embedding: {
        provider: 'openai',
        model: 'text-embedding-ada-002',
        dimensions: 1536,
        batchSize: 100,
        cacheEnabled: true,
    },
    retrieval: {
        defaultLimit: 10,
        similarityThreshold: 0.7,
        maxContextTokens: 4000,
    },
    learning: {
        extractionEnabled: true,
        minConfidenceThreshold: 0.6,
        sessionIdleTimeoutMs: 5 * 60 * 1000, // 5 minutes
    },
};

// ============================================================================
// Context Window Constants
// ============================================================================

export const CONTEXT_PRIORITIES: ContextPriority[] = [
    { level: 1, category: 'system_state', maxTokens: 500 },
    { level: 2, category: 'recent_conversation', maxTokens: 1000 },
    { level: 3, category: 'relevant_knowledge', maxTokens: 1500 },
    { level: 4, category: 'decision_patterns', maxTokens: 500 },
    { level: 5, category: 'user_preferences', maxTokens: 200 },
];

export const MAX_CONTEXT_TOKENS = 4000;
