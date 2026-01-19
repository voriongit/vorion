/**
 * Message Bus
 * 
 * Inter-agent communication system supporting direct messages, broadcasts,
 * tier-specific broadcasts, request/response patterns, and emergency alerts.
 */

import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'eventemitter3';
import type {
    AgentId,
    AgentTier,
    Message,
    MessageType,
} from '../types.js';

// ============================================================================
// Events
// ============================================================================

interface MessageBusEvents {
    'message:sent': (message: Message) => void;
    'message:received': (message: Message, recipientId: AgentId) => void;
    'message:emergency': (message: Message) => void;
    'message:response': (originalId: string, response: Message) => void;
}

// ============================================================================
// Message Bus Class
// ============================================================================

export class MessageBus extends EventEmitter<MessageBusEvents> {
    private messages: Map<string, Message> = new Map();
    private inbox: Map<AgentId, Message[]> = new Map();
    private pendingResponses: Map<string, (response: Message) => void> = new Map();

    // Agent tier registry (for tier broadcasts)
    private agentTiers: Map<AgentId, AgentTier> = new Map();

    // -------------------------------------------------------------------------
    // Registration
    // -------------------------------------------------------------------------

    /**
     * Register an agent with their tier
     */
    registerAgent(agentId: AgentId, tier: AgentTier): void {
        this.agentTiers.set(agentId, tier);
        this.inbox.set(agentId, []);
    }

    /**
     * Unregister an agent
     */
    unregisterAgent(agentId: AgentId): void {
        this.agentTiers.delete(agentId);
        this.inbox.delete(agentId);
    }

    // -------------------------------------------------------------------------
    // Sending Messages
    // -------------------------------------------------------------------------

    /**
     * Send a direct message to a specific agent
     */
    sendDirect(params: {
        from: AgentId;
        to: AgentId;
        subject: string;
        content: unknown;
        priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        requiresResponse?: boolean;
        responseDeadline?: Date;
        threadId?: string;
    }): Message {
        const message: Message = {
            id: uuidv4(),
            type: 'DIRECT',
            from: params.from,
            to: params.to,
            subject: params.subject,
            content: params.content,
            requiresResponse: params.requiresResponse ?? false,
            responseDeadline: params.responseDeadline,
            priority: params.priority ?? 'MEDIUM',
            timestamp: new Date(),
            threadId: params.threadId,
        };

        this.deliverToAgent(params.to, message);
        this.messages.set(message.id, message);
        this.emit('message:sent', message);

        return message;
    }

    /**
     * Broadcast a message to multiple agents
     */
    broadcast(params: {
        from: AgentId;
        to: AgentId[];
        subject: string;
        content: unknown;
        priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    }): Message {
        const message: Message = {
            id: uuidv4(),
            type: 'BROADCAST',
            from: params.from,
            to: params.to,
            subject: params.subject,
            content: params.content,
            requiresResponse: false,
            priority: params.priority ?? 'MEDIUM',
            timestamp: new Date(),
        };

        for (const recipient of params.to) {
            this.deliverToAgent(recipient, message);
        }

        this.messages.set(message.id, message);
        this.emit('message:sent', message);

        return message;
    }

    /**
     * Broadcast to all agents of a specific tier
     */
    broadcastToTier(params: {
        from: AgentId;
        tier: AgentTier;
        subject: string;
        content: unknown;
        priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    }): Message {
        const recipients = Array.from(this.agentTiers.entries())
            .filter(([_, tier]) => tier === params.tier)
            .map(([id, _]) => id);

        const message: Message = {
            id: uuidv4(),
            type: 'TIER_BROADCAST',
            from: params.from,
            to: params.tier,
            subject: params.subject,
            content: params.content,
            requiresResponse: false,
            priority: params.priority ?? 'MEDIUM',
            timestamp: new Date(),
        };

        for (const recipient of recipients) {
            this.deliverToAgent(recipient, message);
        }

        this.messages.set(message.id, message);
        this.emit('message:sent', message);

        return message;
    }

    /**
     * Send a request expecting a response
     */
    async request(params: {
        from: AgentId;
        to: AgentId;
        subject: string;
        content: unknown;
        timeout?: number; // milliseconds
    }): Promise<Message | null> {
        const message: Message = {
            id: uuidv4(),
            type: 'REQUEST',
            from: params.from,
            to: params.to,
            subject: params.subject,
            content: params.content,
            requiresResponse: true,
            responseDeadline: new Date(Date.now() + (params.timeout ?? 30000)),
            priority: 'HIGH',
            timestamp: new Date(),
        };

        this.deliverToAgent(params.to, message);
        this.messages.set(message.id, message);
        this.emit('message:sent', message);

        // Wait for response
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                this.pendingResponses.delete(message.id);
                resolve(null);
            }, params.timeout ?? 30000);

            this.pendingResponses.set(message.id, (response) => {
                clearTimeout(timeout);
                this.pendingResponses.delete(message.id);
                resolve(response);
            });
        });
    }

    /**
     * Respond to a request
     */
    respond(originalMessageId: string, params: {
        from: AgentId;
        content: unknown;
    }): Message | null {
        const original = this.messages.get(originalMessageId);
        if (!original || original.type !== 'REQUEST') {
            return null;
        }

        const response: Message = {
            id: uuidv4(),
            type: 'RESPONSE',
            from: params.from,
            to: original.from,
            subject: `RE: ${original.subject}`,
            content: params.content,
            requiresResponse: false,
            priority: original.priority,
            timestamp: new Date(),
            replyTo: originalMessageId,
            threadId: original.threadId ?? originalMessageId,
        };

        this.deliverToAgent(original.from, response);
        this.messages.set(response.id, response);

        // Resolve pending request
        const resolver = this.pendingResponses.get(originalMessageId);
        if (resolver) {
            resolver(response);
        }

        this.emit('message:response', originalMessageId, response);

        return response;
    }

    /**
     * Send an emergency alert to all agents
     */
    emergency(params: {
        from: AgentId;
        subject: string;
        content: unknown;
    }): Message {
        const message: Message = {
            id: uuidv4(),
            type: 'EMERGENCY',
            from: params.from,
            to: Array.from(this.agentTiers.keys()),
            subject: `🚨 EMERGENCY: ${params.subject}`,
            content: params.content,
            requiresResponse: false,
            priority: 'CRITICAL',
            timestamp: new Date(),
        };

        // Deliver to ALL agents immediately
        for (const agentId of this.agentTiers.keys()) {
            this.deliverToAgent(agentId, message);
        }

        this.messages.set(message.id, message);
        this.emit('message:emergency', message);

        return message;
    }

    // -------------------------------------------------------------------------
    // Receiving Messages
    // -------------------------------------------------------------------------

    /**
     * Get all messages for an agent
     */
    getInbox(agentId: AgentId): Message[] {
        return this.inbox.get(agentId) ?? [];
    }

    /**
     * Get unread messages (messages received in last N minutes)
     */
    getRecent(agentId: AgentId, minutes: number = 5): Message[] {
        const cutoff = new Date(Date.now() - minutes * 60 * 1000);
        return this.getInbox(agentId).filter(m => m.timestamp > cutoff);
    }

    /**
     * Get messages requiring response
     */
    getPendingRequests(agentId: AgentId): Message[] {
        return this.getInbox(agentId).filter(m =>
            m.type === 'REQUEST' &&
            m.requiresResponse &&
            (!m.responseDeadline || m.responseDeadline > new Date())
        );
    }

    /**
     * Clear inbox for an agent
     */
    clearInbox(agentId: AgentId): void {
        this.inbox.set(agentId, []);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private deliverToAgent(agentId: AgentId, message: Message): void {
        const inbox = this.inbox.get(agentId);
        if (inbox) {
            inbox.push(message);
            this.emit('message:received', message, agentId);
        }
    }

    // -------------------------------------------------------------------------
    // Statistics
    // -------------------------------------------------------------------------

    /**
     * Get message statistics
     */
    getStats(): {
        totalMessages: number;
        byType: Record<MessageType, number>;
        pendingResponses: number;
        registeredAgents: number;
    } {
        const messages = Array.from(this.messages.values());

        const byType = messages.reduce((acc, m) => {
            acc[m.type] = (acc[m.type] ?? 0) + 1;
            return acc;
        }, {} as Record<MessageType, number>);

        return {
            totalMessages: messages.length,
            byType,
            pendingResponses: this.pendingResponses.size,
            registeredAgents: this.agentTiers.size,
        };
    }
}

// Singleton instance
export const messageBus = new MessageBus();
