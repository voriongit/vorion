/**
 * Memory API Routes
 *
 * REST endpoints for Aria's memory system.
 *
 * Epic: Aria Memory & Knowledge System
 */

import { Hono } from 'hono';
import {
    getConversationMemoryService,
    getKnowledgeStoreService,
    getEmbeddingService,
    getDecisionPatternService,
    getUserPreferencesService,
} from '../../core/memory/index.js';
import type {
    ConversationEntryInput,
    KnowledgeEntryInput,
    KnowledgeSearchOptions,
    DecisionPatternInput,
    DecisionPatternType,
    DecisionOutcome,
    UserPreferencesInput,
} from '../../core/memory/types.js';

const memoryRoutes = new Hono();

// ============================================================================
// Helper: Check embedding service availability
// ============================================================================

/**
 * Check if embedding service is available and return 503 if not
 */
function checkEmbeddingAvailability(c: any): Response | null {
    const embeddingService = getEmbeddingService();
    if (!embeddingService.isAvailable()) {
        return c.json(
            {
                error: 'Embedding service not available',
                message: 'Semantic search requires OPENAI_API_KEY to be configured',
                code: 'EMBEDDING_SERVICE_UNAVAILABLE'
            },
            503
        );
    }
    return null;
}

// ============================================================================
// Conversation Endpoints
// ============================================================================

/**
 * Store a conversation message
 */
memoryRoutes.post('/conversations', async (c) => {
    try {
        const body = await c.req.json<ConversationEntryInput>();
        const service = getConversationMemoryService();
        const entry = await service.storeMessage(body);
        return c.json(entry, 201);
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

/**
 * Get session history
 */
memoryRoutes.get('/conversations/session/:sessionId', async (c) => {
    try {
        const sessionId = c.req.param('sessionId');
        const limit = parseInt(c.req.query('limit') || '50');
        const service = getConversationMemoryService();
        const history = await service.getSessionHistory(sessionId, limit);
        return c.json(history);
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

/**
 * Get user history
 */
memoryRoutes.get('/conversations/user/:userId', async (c) => {
    try {
        const userId = c.req.param('userId');
        const limit = parseInt(c.req.query('limit') || '100');
        const service = getConversationMemoryService();
        const history = await service.getUserHistory(userId, limit);
        return c.json(history);
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

/**
 * Search conversations semantically
 */
memoryRoutes.post('/conversations/search', async (c) => {
    // Check if embedding service is available
    const unavailableResponse = checkEmbeddingAvailability(c);
    if (unavailableResponse) return unavailableResponse;

    try {
        const { query, userId, sessionId, limit, similarityThreshold } = await c.req.json();
        const service = getConversationMemoryService();
        const results = await service.searchConversations(query, {
            userId,
            sessionId,
            limit,
            similarityThreshold,
        });
        return c.json(results);
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

/**
 * Get recent context for RAG
 */
memoryRoutes.get('/conversations/context/:userId', async (c) => {
    try {
        const userId = c.req.param('userId');
        const maxTokens = parseInt(c.req.query('maxTokens') || '1000');
        const sessionId = c.req.query('sessionId');
        const service = getConversationMemoryService();
        const context = await service.getRecentContext(userId, maxTokens, sessionId);
        return c.json(context);
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

/**
 * Get conversation statistics
 */
memoryRoutes.get('/conversations/stats', async (c) => {
    try {
        const userId = c.req.query('userId');
        const service = getConversationMemoryService();
        const stats = await service.getStats(userId);
        return c.json(stats);
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// ============================================================================
// Knowledge Endpoints
// ============================================================================

/**
 * Store knowledge entry
 */
memoryRoutes.post('/knowledge', async (c) => {
    try {
        const body = await c.req.json<KnowledgeEntryInput>();
        const service = getKnowledgeStoreService();
        const entry = await service.store(body);
        return c.json(entry, 201);
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

/**
 * Search knowledge semantically
 */
memoryRoutes.post('/knowledge/search', async (c) => {
    // Check if embedding service is available
    const unavailableResponse = checkEmbeddingAvailability(c);
    if (unavailableResponse) return unavailableResponse;

    try {
        const { query, ...options } = await c.req.json<{ query: string } & KnowledgeSearchOptions>();
        const service = getKnowledgeStoreService();
        const results = await service.search(query, options);
        return c.json(results);
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

/**
 * Get knowledge by category
 */
memoryRoutes.get('/knowledge/category/:category', async (c) => {
    try {
        const category = c.req.param('category') as any;
        const subcategory = c.req.query('subcategory');
        const limit = parseInt(c.req.query('limit') || '50');
        const service = getKnowledgeStoreService();
        const entries = await service.getByCategory(category, subcategory, limit);
        return c.json(entries);
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

/**
 * Get knowledge entry by ID
 */
memoryRoutes.get('/knowledge/:id', async (c) => {
    try {
        const id = c.req.param('id');
        const service = getKnowledgeStoreService();
        const entry = await service.getById(id);
        if (!entry) {
            return c.json({ error: 'Knowledge entry not found' }, 404);
        }
        return c.json(entry);
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

/**
 * Update knowledge entry
 */
memoryRoutes.patch('/knowledge/:id', async (c) => {
    try {
        const id = c.req.param('id');
        const updates = await c.req.json<Partial<KnowledgeEntryInput>>();
        const service = getKnowledgeStoreService();
        const entry = await service.update(id, updates);
        return c.json(entry);
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

/**
 * Verify knowledge entry (HITL)
 */
memoryRoutes.post('/knowledge/:id/verify', async (c) => {
    try {
        const id = c.req.param('id');
        const { verifiedBy } = await c.req.json<{ verifiedBy: string }>();
        const service = getKnowledgeStoreService();
        const entry = await service.verify(id, verifiedBy);
        return c.json(entry);
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

/**
 * Archive knowledge entry
 */
memoryRoutes.delete('/knowledge/:id', async (c) => {
    try {
        const id = c.req.param('id');
        const service = getKnowledgeStoreService();
        await service.archive(id);
        return c.json({ success: true });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

/**
 * Get agent-specific knowledge
 */
memoryRoutes.get('/knowledge/agent/:agentId', async (c) => {
    try {
        const agentId = c.req.param('agentId');
        const service = getKnowledgeStoreService();
        const entries = await service.getAgentKnowledge(agentId);
        return c.json(entries);
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

/**
 * Get system architecture knowledge
 */
memoryRoutes.get('/knowledge/system/architecture', async (c) => {
    try {
        const service = getKnowledgeStoreService();
        const entries = await service.getSystemArchitecture();
        return c.json(entries);
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

/**
 * Get knowledge statistics
 */
memoryRoutes.get('/knowledge/stats', async (c) => {
    try {
        const service = getKnowledgeStoreService();
        const stats = await service.getStats();
        return c.json(stats);
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

/**
 * Seed system knowledge
 */
memoryRoutes.post('/knowledge/seed', async (c) => {
    try {
        const service = getKnowledgeStoreService();
        const count = await service.seedSystemKnowledge();
        return c.json({ seeded: count });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// ============================================================================
// Embedding Endpoints
// ============================================================================

/**
 * Generate embedding for text
 */
memoryRoutes.post('/embed', async (c) => {
    try {
        const { text } = await c.req.json<{ text: string }>();
        const service = getEmbeddingService();
        const result = await service.embed(text);
        return c.json({
            embedding: result.embedding,
            tokensUsed: result.tokensUsed,
            cached: result.cached,
            dimensions: result.embedding.length,
        });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

/**
 * Get embedding service stats
 */
memoryRoutes.get('/embed/stats', async (c) => {
    try {
        const service = getEmbeddingService();
        const stats = service.getCacheStats();
        return c.json(stats);
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// ============================================================================
// Decision Pattern Endpoints
// ============================================================================

/**
 * Record a decision pattern
 */
memoryRoutes.post('/patterns', async (c) => {
    try {
        const body = await c.req.json<DecisionPatternInput>();
        const service = getDecisionPatternService();
        const pattern = await service.record(body);
        return c.json(pattern, 201);
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

/**
 * Find similar decision patterns
 */
memoryRoutes.post('/patterns/similar', async (c) => {
    try {
        const { context, options } = await c.req.json<{
            context: {
                agentType?: string;
                agentTier?: number;
                actionType?: string;
                contextSummary: string;
            };
            options?: {
                patternType?: DecisionPatternType;
                limit?: number;
                minSimilarity?: number;
            };
        }>();
        const service = getDecisionPatternService();
        const patterns = await service.findSimilar(context, options);
        return c.json(patterns);
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

/**
 * Predict decision based on similar patterns
 */
memoryRoutes.post('/patterns/predict', async (c) => {
    try {
        const context = await c.req.json<{
            agentType?: string;
            agentTier?: number;
            actionType?: string;
            contextSummary: string;
        }>();
        const service = getDecisionPatternService();
        const prediction = await service.predictDecision(context);
        return c.json(prediction);
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

/**
 * Get patterns by type
 */
memoryRoutes.get('/patterns/type/:type', async (c) => {
    try {
        const patternType = c.req.param('type') as DecisionPatternType;
        const limit = parseInt(c.req.query('limit') || '50');
        const minFrequency = parseInt(c.req.query('minFrequency') || '1');
        const service = getDecisionPatternService();
        const patterns = await service.getByType(patternType, { limit, minFrequency });
        return c.json(patterns);
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

/**
 * Get patterns by HITL user
 */
memoryRoutes.get('/patterns/user/:userId', async (c) => {
    try {
        const userId = c.req.param('userId');
        const limit = parseInt(c.req.query('limit') || '50');
        const service = getDecisionPatternService();
        const patterns = await service.getByUser(userId, { limit });
        return c.json(patterns);
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

/**
 * Get top patterns by frequency
 */
memoryRoutes.get('/patterns/top', async (c) => {
    try {
        const limit = parseInt(c.req.query('limit') || '20');
        const patternType = c.req.query('type') as DecisionPatternType | undefined;
        const service = getDecisionPatternService();
        const patterns = await service.getTopPatterns({ limit, patternType });
        return c.json(patterns);
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

/**
 * Get pattern statistics
 * NOTE: Must be before /:id to avoid matching "stats" as an ID
 */
memoryRoutes.get('/patterns/stats', async (c) => {
    try {
        const service = getDecisionPatternService();
        const stats = await service.getStats();
        return c.json(stats);
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

/**
 * Get pattern by ID
 */
memoryRoutes.get('/patterns/:id', async (c) => {
    try {
        const id = c.req.param('id');
        const service = getDecisionPatternService();
        const pattern = await service.getById(id);
        return c.json(pattern);
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

/**
 * Update pattern outcome
 */
memoryRoutes.patch('/patterns/:id/outcome', async (c) => {
    try {
        const id = c.req.param('id');
        const { outcome, details } = await c.req.json<{
            outcome: DecisionOutcome;
            details?: string;
        }>();
        const service = getDecisionPatternService();
        const pattern = await service.updateOutcome(id, outcome, details);
        return c.json(pattern);
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// ============================================================================
// User Preferences Endpoints
// ============================================================================

/**
 * Get most active users
 * NOTE: Must be before /:userId to avoid matching "active" as a userId
 */
memoryRoutes.get('/preferences/active', async (c) => {
    try {
        const limit = parseInt(c.req.query('limit') || '10');
        const service = getUserPreferencesService();
        const users = await service.getMostActiveUsers(limit);
        return c.json(users);
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

/**
 * Get all users for an organization
 * NOTE: Must be before /:userId to avoid matching "org" as a userId
 */
memoryRoutes.get('/preferences/org/:orgId', async (c) => {
    try {
        const orgId = c.req.param('orgId');
        const service = getUserPreferencesService();
        const users = await service.getOrgUsers(orgId);
        return c.json(users);
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

/**
 * Get or create user preferences
 */
memoryRoutes.get('/preferences/:userId', async (c) => {
    try {
        const userId = c.req.param('userId');
        const orgId = c.req.query('orgId');
        const service = getUserPreferencesService();
        const prefs = await service.getOrCreate(userId, orgId);
        return c.json(prefs);
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

/**
 * Update user preferences
 */
memoryRoutes.patch('/preferences/:userId', async (c) => {
    try {
        const userId = c.req.param('userId');
        const updates = await c.req.json<Partial<UserPreferencesInput>>();
        const service = getUserPreferencesService();
        const prefs = await service.update(userId, updates);
        return c.json(prefs);
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

/**
 * Update notification preferences
 */
memoryRoutes.patch('/preferences/:userId/notifications', async (c) => {
    try {
        const userId = c.req.param('userId');
        const notifications = await c.req.json();
        const service = getUserPreferencesService();
        const prefs = await service.updateNotifications(userId, notifications);
        return c.json(prefs);
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

/**
 * Update learned preferences (from Shadow Bot)
 */
memoryRoutes.patch('/preferences/:userId/learned', async (c) => {
    try {
        const userId = c.req.param('userId');
        const learned = await c.req.json();
        const service = getUserPreferencesService();
        const prefs = await service.updateLearnedPreferences(userId, learned);
        return c.json(prefs);
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

/**
 * Record user interaction
 */
memoryRoutes.post('/preferences/:userId/interaction', async (c) => {
    try {
        const userId = c.req.param('userId');
        const { sessionId } = await c.req.json<{ sessionId: string }>();
        const service = getUserPreferencesService();
        await service.recordInteraction(userId, sessionId);
        return c.json({ success: true });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

/**
 * Record approval/denial decision
 */
memoryRoutes.post('/preferences/:userId/decision', async (c) => {
    try {
        const userId = c.req.param('userId');
        const { approved } = await c.req.json<{ approved: boolean }>();
        const service = getUserPreferencesService();
        await service.recordDecision(userId, approved);
        return c.json({ success: true });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

/**
 * Analyze user's approval tendency
 */
memoryRoutes.get('/preferences/:userId/tendency', async (c) => {
    try {
        const userId = c.req.param('userId');
        const service = getUserPreferencesService();
        const analysis = await service.analyzeApprovalTendency(userId);
        return c.json(analysis);
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// ============================================================================
// Health Check
// ============================================================================

memoryRoutes.get('/health', async (c) => {
    try {
        // Quick health check - verify all services initialize
        getConversationMemoryService();
        getKnowledgeStoreService();
        getDecisionPatternService();
        getUserPreferencesService();

        const embeddingService = getEmbeddingService();
        const embeddingsAvailable = embeddingService.isAvailable();

        return c.json({
            status: embeddingsAvailable ? 'ok' : 'degraded',
            services: {
                conversations: 'ready',
                knowledge: 'ready',
                embeddings: embeddingsAvailable ? 'ready' : 'unavailable (OPENAI_API_KEY not configured)',
                patterns: 'ready',
                preferences: 'ready',
            },
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        return c.json(
            {
                status: 'error',
                error: error.message,
            },
            500
        );
    }
});

export { memoryRoutes };
