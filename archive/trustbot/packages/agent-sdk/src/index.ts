/**
 * Aurais Agent SDK
 *
 * Epic 10: Agent Connection Layer
 * Story 10.5: Agent SDK (TypeScript)
 *
 * @packageDocumentation
 */

// Main class
export { AuraisAgent } from './AuraisAgent.js';

// All types
export type {
    // Configuration
    AuraisAgentConfig,
    AgentCapability,
    AgentStatus,
    ConnectionState,

    // Tasks
    Task,
    TaskPriority,
    TaskResult,
    TaskMetrics,
    TaskProgress,

    // Action Requests
    ActionRequest,
    ActionRequestSubmission,
    ActionDecision,
    RiskLevel,
    Urgency,

    // Configuration
    AgentConfig,

    // Messages
    InboundMessage,
    OutboundMessage,
    TaskAssignedMessage,
    DecisionRequiredMessage,
    DecisionResultMessage,
    ConfigUpdatedMessage,
    PingMessage,
    ErrorMessage,
    AcknowledgeMessage,
    StatusUpdateMessage,
    ActionRequestMessage,
    TaskCompletedMessage,
    TaskProgressMessage,
    HeartbeatMessage,
    PongMessage,
    RegisterMessage,

    // Metrics
    AgentMetrics,

    // Events
    AgentEvents,

    // Registration
    RegistrationResponse,
} from './types.js';
