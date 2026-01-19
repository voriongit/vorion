/**
 * Core Module Index
 *
 * Exports all core systems for the Aurais System.
 */

export { Blackboard, blackboard } from './Blackboard.js';
export { TrustEngine, trustEngine } from './TrustEngine.js';
export { MessageBus, messageBus } from './MessageBus.js';
export { MemoryStore, memoryStore } from './MemoryStore.js';
export { HITLGateway, hitlGateway } from './HITLGateway.js';

// Security Layer
export {
    SecurityLayer,
    securityLayer,
    UnauthorizedError,
    AuthenticationError,
    type AuthToken,
    type Permission,
    type AuditEntry,
    type AuditAction,
} from './SecurityLayer.js';

export {
    SecureTrustEngine,
    createSecureTrustEngine,
} from './SecureTrustEngine.js';

export {
    PersistenceLayer,
    persistenceLayer,
    type PersistedState,
    type PersistenceConfig,
} from './PersistenceLayer.js';
