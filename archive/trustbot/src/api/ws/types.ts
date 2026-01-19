/**
 * WebSocket Types
 *
 * Epic 10: Agent Connection Layer
 * Story 10.2: WebSocket Hub
 */

// ============================================================================
// Message Types
// ============================================================================

/**
 * Inbound message types (to agent from server)
 */
export type InboundMessageType =
    | 'task:assigned'
    | 'decision:required'
    | 'config:updated'
    | 'pong'
    | 'error'
    | 'connected'
    | 'disconnecting';

/**
 * Outbound message types (from agent to server)
 */
export type OutboundMessageType =
    | 'status:update'
    | 'action:request'
    | 'task:completed'
    | 'ping'
    | 'heartbeat';

/**
 * All message types
 */
export type MessageType = InboundMessageType | OutboundMessageType;

// ============================================================================
// Message Payloads
// ============================================================================

export interface TaskPayload {
    id: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    requiredTier: number;
    deadline?: string;
    context?: Record<string, unknown>;
}

export interface DecisionPayload {
    id: string;
    agentId: string;
    action: string;
    reason: string;
    riskLevel: 'low' | 'medium' | 'high';
    urgency: 'low' | 'normal' | 'high' | 'critical';
    sampleData?: Record<string, unknown>;
    expiresAt?: string;
}

export interface ConfigPayload {
    settings: Record<string, unknown>;
    version: string;
}

export interface StatusUpdatePayload {
    status: 'idle' | 'busy' | 'processing' | 'error';
    progress?: number;
    currentTask?: string;
    message?: string;
}

export interface ActionRequestPayload {
    action: string;
    reason: string;
    riskLevel: 'low' | 'medium' | 'high';
    sampleData?: Record<string, unknown>;
    timeout?: number;
}

export interface TaskCompletedPayload {
    taskId: string;
    result: 'success' | 'failure' | 'partial';
    output?: unknown;
    error?: string;
    duration?: number;
}

export interface HeartbeatPayload {
    timestamp: number;
    status: 'healthy' | 'degraded' | 'unhealthy';
    metrics?: {
        cpuUsage?: number;
        memoryUsage?: number;
        taskQueue?: number;
    };
}

export interface ErrorPayload {
    code: string;
    message: string;
    details?: unknown;
}

// ============================================================================
// Message Structures
// ============================================================================

export interface WebSocketMessage<T = unknown> {
    type: MessageType;
    payload: T;
    timestamp: number;
    messageId: string;
    correlationId?: string;
}

export interface InboundMessage<T = unknown> extends WebSocketMessage<T> {
    type: InboundMessageType;
}

export interface OutboundMessage<T = unknown> extends WebSocketMessage<T> {
    type: OutboundMessageType;
}

// ============================================================================
// Connection Types
// ============================================================================

export interface AgentConnection {
    id: string;
    agentId: string;
    structuredId?: string;
    connectedAt: Date;
    lastHeartbeat: Date;
    status: 'connected' | 'authenticated' | 'disconnecting';
    metadata?: Record<string, unknown>;
}

export interface ConnectionStats {
    totalConnections: number;
    authenticatedConnections: number;
    messagesSent: number;
    messagesReceived: number;
    uptime: number;
}

// ============================================================================
// Auth Types
// ============================================================================

export interface AuthResult {
    authenticated: boolean;
    agentId?: string;
    permissions?: string[];
    error?: string;
}
