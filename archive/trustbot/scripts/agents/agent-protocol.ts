/**
 * Agent Communication Protocol for TrustBot
 *
 * Defines message types and protocols for agent-to-agent communication.
 */

// Message types for inter-agent communication
export type MessageType =
    | 'REQUEST_HELP'      // Ask another agent for assistance
    | 'PROVIDE_HELP'      // Respond with assistance
    | 'SHARE_CONTEXT'     // Share relevant context/data
    | 'DELEGATE_TASK'     // Delegate a subtask to another agent
    | 'TASK_RESULT'       // Share task completion results
    | 'BROADCAST'         // Broadcast to all agents
    | 'QUERY'             // Ask a question
    | 'RESPONSE'          // Answer a query
    | 'HANDOFF'           // Transfer task ownership
    | 'STATUS_UPDATE';    // Share status information

export interface AgentMessage {
    id: string;
    type: MessageType;
    from: string;           // Sender agent ID
    to: string | 'ALL';     // Recipient agent ID or broadcast
    subject: string;
    content: string;
    context?: Record<string, unknown>;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    timestamp: Date;
    replyTo?: string;       // ID of message being replied to
    expiresAt?: Date;       // Message expiration
}

export interface CollaborationRequest {
    id: string;
    requesterId: string;
    requesterName: string;
    taskId?: string;
    taskTitle: string;
    description: string;
    requiredSkills: string[];
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    deadline?: Date;
    context?: Record<string, unknown>;
    status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'COMPLETED';
    acceptedBy?: string;
    result?: CollaborationResult;
}

export interface CollaborationResult {
    success: boolean;
    summary: string;
    data?: Record<string, unknown>;
    confidence: number;
    duration: number;
}

export interface AgentCapability {
    agentId: string;
    agentName: string;
    provider: string;
    skills: string[];
    capabilities: string[];
    currentLoad: number;     // 0-100 percentage
    available: boolean;
    tier: number;
}

export interface ConversationThread {
    id: string;
    participants: string[];
    topic: string;
    messages: AgentMessage[];
    status: 'ACTIVE' | 'RESOLVED' | 'ARCHIVED';
    createdAt: Date;
    updatedAt: Date;
}

// Events for real-time coordination
export type CoordinatorEvent =
    | { type: 'AGENT_JOINED'; agent: AgentCapability }
    | { type: 'AGENT_LEFT'; agentId: string }
    | { type: 'MESSAGE_RECEIVED'; message: AgentMessage }
    | { type: 'COLLABORATION_REQUEST'; request: CollaborationRequest }
    | { type: 'COLLABORATION_ACCEPTED'; requestId: string; acceptedBy: string }
    | { type: 'COLLABORATION_COMPLETED'; requestId: string; result: CollaborationResult }
    | { type: 'BROADCAST'; message: AgentMessage };

// Callback types
export type MessageHandler = (message: AgentMessage) => Promise<void>;
export type CollaborationHandler = (request: CollaborationRequest) => Promise<boolean>;
export type EventHandler = (event: CoordinatorEvent) => void;

/**
 * Generate a unique message ID
 */
export function generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate a unique collaboration request ID
 */
export function generateCollaborationId(): string {
    return `collab-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a new agent message
 */
export function createMessage(
    type: MessageType,
    from: string,
    to: string | 'ALL',
    subject: string,
    content: string,
    options?: {
        priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
        context?: Record<string, unknown>;
        replyTo?: string;
        expiresIn?: number; // milliseconds
    }
): AgentMessage {
    return {
        id: generateMessageId(),
        type,
        from,
        to,
        subject,
        content,
        priority: options?.priority || 'MEDIUM',
        context: options?.context,
        replyTo: options?.replyTo,
        timestamp: new Date(),
        expiresAt: options?.expiresIn
            ? new Date(Date.now() + options.expiresIn)
            : undefined,
    };
}

/**
 * Create a collaboration request
 */
export function createCollaborationRequest(
    requesterId: string,
    requesterName: string,
    taskTitle: string,
    description: string,
    requiredSkills: string[],
    options?: {
        taskId?: string;
        priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
        deadline?: Date;
        context?: Record<string, unknown>;
    }
): CollaborationRequest {
    return {
        id: generateCollaborationId(),
        requesterId,
        requesterName,
        taskId: options?.taskId,
        taskTitle,
        description,
        requiredSkills,
        priority: options?.priority || 'MEDIUM',
        deadline: options?.deadline,
        context: options?.context,
        status: 'PENDING',
    };
}
