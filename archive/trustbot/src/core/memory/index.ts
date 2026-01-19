/**
 * Aria Memory System
 *
 * Provides persistent memory for Aria with RAG-based knowledge retrieval.
 *
 * Epic: Aria Memory & Knowledge System
 */

// Types
export * from './types.js';

// Services
export { EmbeddingService, getEmbeddingService, resetEmbeddingService } from './EmbeddingService.js';
export {
    ConversationMemoryService,
    getConversationMemoryService,
    resetConversationMemoryService,
} from './ConversationMemoryService.js';
export {
    KnowledgeStoreService,
    getKnowledgeStoreService,
    resetKnowledgeStoreService,
} from './KnowledgeStoreService.js';
export {
    DecisionPatternService,
    getDecisionPatternService,
    resetDecisionPatternService,
} from './DecisionPatternService.js';
export {
    UserPreferencesService,
    getUserPreferencesService,
    resetUserPreferencesService,
} from './UserPreferencesService.js';
