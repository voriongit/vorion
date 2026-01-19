/**
 * Aurais Infrastructure - Message Bus Service
 * 
 * Trust-gated inter-agent communication:
 * - UNTRUSTED: Receive only, cannot initiate
 * - PROBATIONARY: Message supervisor only, structured protocol
 * - TRUSTED: Peer messaging within tier, subscribe to topics
 * - VERIFIED: Publish to topics, message any lower tier
 * - CERTIFIED: Create private channels, cross-tier messaging
 * - ELITE: Broadcast, impersonate (with audit)
 */

import {
  AgentId,
  TrustState,
  TrustTier,
  ChannelId,
  Message,
  MessagePriority,
  MessageProtocol,
  Channel,
  ChannelType,
  ChannelSubscription,
  ObserverEvent,
  ObserverEventType,
  Timestamp,
  TickNumber,
} from '../types/core.js';
import { CapabilityResolver, capabilityResolver } from './CapabilityResolver.js';

// ============================================================================
// MESSAGE SCHEMAS
// ============================================================================

/**
 * Predefined message schemas for structured communication.
 * Lower tiers must use these; higher tiers can send free-form.
 */
export const MESSAGE_SCHEMAS = {
  // Task-related
  'task.status_update': {
    type: 'object',
    properties: {
      taskId: { type: 'string' },
      status: { type: 'string', enum: ['started', 'progress', 'completed', 'failed', 'blocked'] },
      progress: { type: 'number', minimum: 0, maximum: 100 },
      message: { type: 'string', maxLength: 500 },
    },
    required: ['taskId', 'status'],
  },

  'task.help_request': {
    type: 'object',
    properties: {
      taskId: { type: 'string' },
      helpType: { type: 'string', enum: ['clarification', 'capability', 'resource', 'escalation'] },
      description: { type: 'string', maxLength: 1000 },
    },
    required: ['taskId', 'helpType', 'description'],
  },

  'task.delegation': {
    type: 'object',
    properties: {
      taskId: { type: 'string' },
      delegatedTo: { type: 'string' },
      reason: { type: 'string', maxLength: 500 },
      deadline: { type: 'number' },
    },
    required: ['taskId', 'delegatedTo'],
  },

  // Coordination
  'coordination.heartbeat': {
    type: 'object',
    properties: {
      agentId: { type: 'string' },
      status: { type: 'string', enum: ['idle', 'working', 'waiting', 'overloaded'] },
      currentTasks: { type: 'number' },
      capacity: { type: 'number' },
    },
    required: ['agentId', 'status'],
  },

  'coordination.capability_query': {
    type: 'object',
    properties: {
      requiredCapabilities: { type: 'array', items: { type: 'string' } },
      taskType: { type: 'string' },
    },
    required: ['requiredCapabilities'],
  },

  // Knowledge sharing
  'knowledge.fact_assertion': {
    type: 'object',
    properties: {
      subject: { type: 'string' },
      predicate: { type: 'string' },
      object: { type: 'string' },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      source: { type: 'string' },
    },
    required: ['subject', 'predicate', 'object'],
  },

  'knowledge.query': {
    type: 'object',
    properties: {
      queryType: { type: 'string', enum: ['fact', 'entity', 'relationship'] },
      subject: { type: 'string' },
      predicate: { type: 'string' },
    },
    required: ['queryType'],
  },
} as const;

// ============================================================================
// INTERFACES
// ============================================================================

export interface SendOptions {
  correlationId?: string;
  ttl?: number;
  priority?: MessagePriority;
  requiresAck?: boolean;
  impersonating?: AgentId;  // Elite only
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  validationErrors?: string[];
}

export interface SubscribeResult {
  success: boolean;
  subscriptionId?: string;
  error?: string;
}

export interface PublishResult {
  success: boolean;
  messageId?: string;
  recipientCount?: number;
  error?: string;
}

export interface CreateChannelResult {
  success: boolean;
  channelId?: ChannelId;
  error?: string;
}

export type MessageHandler = (message: Message) => void | Promise<void>;

// ============================================================================
// IMPLEMENTATION
// ============================================================================

export class MessageBusService {
  private channels: Map<ChannelId, Channel> = new Map();
  private subscriptions: Map<string, { channelId: ChannelId; handler: MessageHandler }> = new Map();
  private messageQueue: Map<AgentId, Message[]> = new Map();
  private pendingAcks: Map<string, { message: Message; expiresTick: TickNumber }> = new Map();

  // Agent trust state cache (would be injected from trust service in real impl)
  private agentTrustStates: Map<AgentId, TrustState> = new Map();

  private eventEmitter: (event: ObserverEvent) => void;
  private currentTick: () => TickNumber;

  constructor(
    private resolver: CapabilityResolver = capabilityResolver,
    eventEmitter?: (event: ObserverEvent) => void,
    tickProvider?: () => TickNumber
  ) {
    this.eventEmitter = eventEmitter || (() => { });
    this.currentTick = tickProvider || (() => 0);

    // Create default system channels
    this.createSystemChannels();
  }

  // --------------------------------------------------------------------------
  // Direct Messaging
  // --------------------------------------------------------------------------

  send(
    fromAgent: AgentId,
    fromTrustState: TrustState,
    toAgent: AgentId,
    schema: string,
    payload: unknown,
    options: SendOptions = {}
  ): SendResult {
    // Check if can initiate messages
    const capabilities = this.resolver.getCapabilities(fromTrustState);
    if (!capabilities.communication.canInitiateMessages) {
      this.emitCapabilityDenied(fromAgent, 'send_message', 'Cannot initiate messages at this tier');
      return { success: false, error: 'Cannot initiate messages at UNTRUSTED tier' };
    }

    // Handle impersonation (Elite only)
    let effectiveFrom = fromAgent;
    if (options.impersonating) {
      if (!capabilities.communication.canImpersonate) {
        return { success: false, error: 'Impersonation requires ELITE tier' };
      }
      effectiveFrom = options.impersonating;
    }

    // Get target trust state to check messaging rules
    const toTrustState = this.agentTrustStates.get(toAgent);
    if (!toTrustState) {
      return { success: false, error: `Unknown target agent: ${toAgent}` };
    }

    // Determine target type and check permission
    const targetTier = this.resolver.getEffectiveTier(toTrustState);
    const fromTier = this.resolver.getEffectiveTier(fromTrustState);
    const targetType = this.determineTargetType(fromTier, targetTier);

    const matchingRule = capabilities.communication.messageTargets.find(rule => {
      if (rule.targetType !== 'any' && rule.targetType !== targetType) return false;
      if (rule.tierRange) {
        if (targetTier < rule.tierRange.min || targetTier > rule.tierRange.max) return false;
      }
      return true;
    });

    if (!matchingRule) {
      return {
        success: false,
        error: `No permission to message ${targetType} at ${TrustTier[targetTier]} tier`
      };
    }

    // Validate message against schema
    const validationErrors = this.validateMessage(schema, payload, matchingRule.protocolRequired);
    if (validationErrors.length > 0) {
      return { success: false, error: 'Message validation failed', validationErrors };
    }

    // Create and queue message
    const messageId = this.generateId('msg');
    const message: Message = {
      id: messageId,
      correlationId: options.correlationId,
      fromAgent: effectiveFrom,
      toAgent,
      protocol: matchingRule.protocolRequired,
      schema,
      payload,
      timestamp: Date.now(),
      tick: this.currentTick(),
      ttl: options.ttl || 1000,
      priority: options.priority || MessagePriority.NORMAL,
      requiresAck: options.requiresAck || false,
      metadata: options.impersonating ? { impersonatedBy: fromAgent } : undefined,
    };

    this.queueMessage(toAgent, message);

    this.emitEvent({
      agentId: fromAgent,
      eventType: ObserverEventType.MESSAGE_SENT,
      payload: {
        messageId,
        toAgent,
        schema,
        impersonating: options.impersonating,
      },
    });

    return { success: true, messageId };
  }

  receive(agentId: AgentId): Message[] {
    const queue = this.messageQueue.get(agentId) || [];
    this.messageQueue.set(agentId, []);

    // Emit receive events
    for (const message of queue) {
      this.emitEvent({
        agentId,
        eventType: ObserverEventType.MESSAGE_RECEIVED,
        payload: {
          messageId: message.id,
          fromAgent: message.fromAgent,
          schema: message.schema,
        },
      });
    }

    return queue;
  }

  acknowledge(agentId: AgentId, messageId: string): boolean {
    const pending = this.pendingAcks.get(messageId);
    if (!pending) return false;
    if (pending.message.toAgent !== agentId) return false;

    this.pendingAcks.delete(messageId);
    return true;
  }

  // --------------------------------------------------------------------------
  // Channel Operations
  // --------------------------------------------------------------------------

  subscribe(
    agentId: AgentId,
    trustState: TrustState,
    channelId: ChannelId,
    handler: MessageHandler
  ): SubscribeResult {
    const capabilities = this.resolver.getCapabilities(trustState);
    if (!capabilities.communication.canSubscribeToTopics) {
      return { success: false, error: 'Topic subscription requires TRUSTED tier' };
    }

    const channel = this.channels.get(channelId);
    if (!channel) {
      return { success: false, error: `Channel not found: ${channelId}` };
    }

    // Check channel access
    if (!this.hasChannelAccess(agentId, trustState, channel, 'subscribe')) {
      return { success: false, error: 'No subscribe access to channel' };
    }

    const subscriptionId = this.generateId('sub');
    this.subscriptions.set(subscriptionId, { channelId, handler });

    // Add to channel subscribers
    channel.subscribers.push({
      agentId,
      subscribedAt: Date.now(),
      lastReadTick: this.currentTick(),
    });

    return { success: true, subscriptionId };
  }

  unsubscribe(agentId: AgentId, subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return false;

    const channel = this.channels.get(subscription.channelId);
    if (channel) {
      channel.subscribers = channel.subscribers.filter(s => s.agentId !== agentId);
    }

    this.subscriptions.delete(subscriptionId);
    return true;
  }

  publish(
    agentId: AgentId,
    trustState: TrustState,
    channelId: ChannelId,
    schema: string,
    payload: unknown,
    options: SendOptions = {}
  ): PublishResult {
    const capabilities = this.resolver.getCapabilities(trustState);
    if (!capabilities.communication.canPublishToTopics) {
      return { success: false, error: 'Topic publishing requires VERIFIED tier' };
    }

    const channel = this.channels.get(channelId);
    if (!channel) {
      return { success: false, error: `Channel not found: ${channelId}` };
    }

    // Check channel access
    if (!this.hasChannelAccess(agentId, trustState, channel, 'publish')) {
      return { success: false, error: 'No publish access to channel' };
    }

    const messageId = this.generateId('pub');
    const message: Message = {
      id: messageId,
      fromAgent: agentId,
      toAgent: channelId,
      protocol: MessageProtocol.FREE_FORM,
      schema,
      payload,
      timestamp: Date.now(),
      tick: this.currentTick(),
      ttl: options.ttl || 1000,
      priority: options.priority || MessagePriority.NORMAL,
      requiresAck: false,
    };

    // Deliver to all subscribers
    let recipientCount = 0;
    for (const subscriber of channel.subscribers) {
      this.queueMessage(subscriber.agentId, message);
      recipientCount++;
    }

    this.emitEvent({
      agentId,
      eventType: ObserverEventType.MESSAGE_SENT,
      payload: {
        messageId,
        channelId,
        schema,
        recipientCount,
      },
    });

    return { success: true, messageId, recipientCount };
  }

  broadcast(
    agentId: AgentId,
    trustState: TrustState,
    schema: string,
    payload: unknown,
    options: SendOptions = {}
  ): PublishResult {
    const capabilities = this.resolver.getCapabilities(trustState);
    if (!capabilities.communication.canBroadcast) {
      return { success: false, error: 'Broadcast requires ELITE tier' };
    }

    const messageId = this.generateId('bcast');
    const message: Message = {
      id: messageId,
      fromAgent: agentId,
      toAgent: 'BROADCAST' as ChannelId,
      protocol: MessageProtocol.FREE_FORM,
      schema,
      payload,
      timestamp: Date.now(),
      tick: this.currentTick(),
      ttl: options.ttl || 100,
      priority: options.priority || MessagePriority.URGENT,
      requiresAck: false,
    };

    // Deliver to all agents
    let recipientCount = 0;
    for (const targetId of this.agentTrustStates.keys()) {
      if (targetId !== agentId) {
        this.queueMessage(targetId, message);
        recipientCount++;
      }
    }

    this.emitEvent({
      agentId,
      eventType: ObserverEventType.MESSAGE_SENT,
      payload: {
        messageId,
        type: 'broadcast',
        schema,
        recipientCount,
      },
    });

    return { success: true, messageId, recipientCount };
  }

  createChannel(
    agentId: AgentId,
    trustState: TrustState,
    config: {
      name: string;
      type: ChannelType;
      accessRules: Channel['accessRules'];
      messageRetention?: number;
    }
  ): CreateChannelResult {
    const capabilities = this.resolver.getCapabilities(trustState);
    if (!capabilities.communication.canCreateChannels) {
      return { success: false, error: 'Channel creation requires CERTIFIED tier' };
    }

    const channelId = this.generateId('ch') as ChannelId;
    const channel: Channel = {
      id: channelId,
      name: config.name,
      type: config.type,
      createdBy: agentId,
      createdAt: Date.now(),
      subscribers: [],
      accessRules: config.accessRules,
      messageRetention: config.messageRetention || 10000,
    };

    this.channels.set(channelId, channel);

    return { success: true, channelId };
  }

  // --------------------------------------------------------------------------
  // Agent Registration
  // --------------------------------------------------------------------------

  registerAgent(agentId: AgentId, trustState: TrustState): void {
    this.agentTrustStates.set(agentId, trustState);
    if (!this.messageQueue.has(agentId)) {
      this.messageQueue.set(agentId, []);
    }
  }

  updateAgentTrust(agentId: AgentId, trustState: TrustState): void {
    this.agentTrustStates.set(agentId, trustState);
  }

  unregisterAgent(agentId: AgentId): void {
    this.agentTrustStates.delete(agentId);
    this.messageQueue.delete(agentId);

    // Remove from all channel subscriptions
    for (const channel of this.channels.values()) {
      channel.subscribers = channel.subscribers.filter(s => s.agentId !== agentId);
    }
  }

  // --------------------------------------------------------------------------
  // Internal Helpers
  // --------------------------------------------------------------------------

  private createSystemChannels(): void {
    // System announcements channel
    const systemChannel: Channel = {
      id: 'system.announcements' as ChannelId,
      name: 'System Announcements',
      type: ChannelType.TOPIC,
      createdBy: 'SYSTEM' as AgentId,
      createdAt: Date.now(),
      subscribers: [],
      accessRules: [
        { tierMin: TrustTier.PROBATIONARY, permissions: ['subscribe'] },
        { tierMin: TrustTier.ELITE, permissions: ['subscribe', 'publish'] },
      ],
      messageRetention: 100000,
    };
    this.channels.set(systemChannel.id, systemChannel);

    // Task coordination channel
    const taskChannel: Channel = {
      id: 'tasks.coordination' as ChannelId,
      name: 'Task Coordination',
      type: ChannelType.TOPIC,
      createdBy: 'SYSTEM' as AgentId,
      createdAt: Date.now(),
      subscribers: [],
      accessRules: [
        { tierMin: TrustTier.TRUSTED, permissions: ['subscribe'] },
        { tierMin: TrustTier.VERIFIED, permissions: ['subscribe', 'publish'] },
      ],
      messageRetention: 10000,
    };
    this.channels.set(taskChannel.id, taskChannel);

    // Knowledge sharing channel
    const knowledgeChannel: Channel = {
      id: 'knowledge.shared' as ChannelId,
      name: 'Shared Knowledge',
      type: ChannelType.TOPIC,
      createdBy: 'SYSTEM' as AgentId,
      createdAt: Date.now(),
      subscribers: [],
      accessRules: [
        { tierMin: TrustTier.VERIFIED, permissions: ['subscribe'] },
        { tierMin: TrustTier.CERTIFIED, permissions: ['subscribe', 'publish'] },
      ],
      messageRetention: 50000,
    };
    this.channels.set(knowledgeChannel.id, knowledgeChannel);
  }

  private determineTargetType(
    fromTier: TrustTier,
    targetTier: TrustTier
  ): 'supervisor' | 'peer' | 'subordinate' | 'any' {
    if (targetTier > fromTier) return 'supervisor';
    if (targetTier === fromTier) return 'peer';
    return 'subordinate';
  }

  private validateMessage(
    schema: string,
    payload: unknown,
    requiredProtocol: MessageProtocol
  ): string[] {
    const errors: string[] = [];

    // Free-form allows anything
    if (requiredProtocol === MessageProtocol.FREE_FORM) {
      return [];
    }

    // Check if schema exists for structured protocols
    const schemaDefinition = MESSAGE_SCHEMAS[schema as keyof typeof MESSAGE_SCHEMAS];
    if (!schemaDefinition && requiredProtocol === MessageProtocol.STRUCTURED_ONLY) {
      errors.push(`Unknown schema: ${schema}. Structured protocol requires known schemas.`);
      return errors;
    }

    // Validate against schema (simplified validation)
    if (schemaDefinition && typeof payload === 'object' && payload !== null) {
      const payloadObj = payload as Record<string, unknown>;
      const required = (schemaDefinition as any).required || [];

      for (const field of required) {
        if (!(field in payloadObj)) {
          errors.push(`Missing required field: ${field}`);
        }
      }
    }

    return errors;
  }

  private hasChannelAccess(
    agentId: AgentId,
    trustState: TrustState,
    channel: Channel,
    permission: 'subscribe' | 'publish' | 'admin'
  ): boolean {
    // Creator always has access
    if (channel.createdBy === agentId) {
      return true;
    }

    const effectiveTier = this.resolver.getEffectiveTier(trustState);

    for (const rule of channel.accessRules) {
      // Check agent-specific rule
      if (rule.agentId === agentId && rule.permissions.includes(permission)) {
        return true;
      }

      // Check tier-based rule
      if (!rule.agentId) {
        const tierMatch =
          (!rule.tierMin || effectiveTier >= rule.tierMin) &&
          (!rule.tierMax || effectiveTier <= rule.tierMax);
        if (tierMatch && rule.permissions.includes(permission)) {
          return true;
        }
      }
    }

    return false;
  }

  private queueMessage(agentId: AgentId, message: Message): void {
    if (!this.messageQueue.has(agentId)) {
      this.messageQueue.set(agentId, []);
    }

    const queue = this.messageQueue.get(agentId)!;

    // Insert by priority
    const insertIndex = queue.findIndex(m => m.priority < message.priority);
    if (insertIndex === -1) {
      queue.push(message);
    } else {
      queue.splice(insertIndex, 0, message);
    }

    // Track for acknowledgment if required
    if (message.requiresAck) {
      this.pendingAcks.set(message.id, {
        message,
        expiresTick: this.currentTick() + message.ttl,
      });
    }
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private emitEvent(partial: Omit<ObserverEvent, 'id' | 'timestamp' | 'tick' | 'hash'>): void {
    const event: ObserverEvent = {
      id: this.generateId('evt') as any,
      timestamp: Date.now(),
      tick: this.currentTick(),
      hash: '',
      ...partial,
    };
    this.eventEmitter(event);
  }

  private emitCapabilityDenied(agentId: AgentId, action: string, reason?: string): void {
    this.emitEvent({
      agentId,
      eventType: ObserverEventType.CAPABILITY_DENIED,
      payload: { action, reason },
    });
  }

  // --------------------------------------------------------------------------
  // Maintenance
  // --------------------------------------------------------------------------

  processTick(): void {
    const currentTick = this.currentTick();

    // Expire messages
    for (const queue of this.messageQueue.values()) {
      const validMessages = queue.filter(m => m.tick + m.ttl > currentTick);
      queue.length = 0;
      queue.push(...validMessages);
    }

    // Handle expired acknowledgments
    for (const [messageId, pending] of this.pendingAcks.entries()) {
      if (pending.expiresTick <= currentTick) {
        this.emitEvent({
          agentId: pending.message.fromAgent,
          eventType: ObserverEventType.MESSAGE_SENT,
          payload: {
            messageId,
            status: 'ack_timeout',
            toAgent: pending.message.toAgent,
          },
        });
        this.pendingAcks.delete(messageId);
      }
    }
  }
}

export const messageBusService = new MessageBusService();
