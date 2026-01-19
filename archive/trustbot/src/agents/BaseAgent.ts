/**
 * Base Agent
 * 
 * Abstract base class for all agents in the Aurais system.
 * Provides common functionality for lifecycle, communication,
 * memory, and trust management.
 */

import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'eventemitter3';
import type {
    AgentId,
    AgentBlueprint,
    AgentType,
    AgentTier,
    AgentStatus,
    AgentLocation,
    Capability,
    TrustScore,
    TrustPolicy,
    Task,
    Message,
    BlackboardEntry,
    Meeting,
} from '../types.js';
import { trustEngine } from '../core/TrustEngine.js';
import { messageBus } from '../core/MessageBus.js';
import { memoryStore } from '../core/MemoryStore.js';
import { blackboard } from '../core/Blackboard.js';

// ============================================================================
// Events
// ============================================================================

interface BaseAgentEvents {
    'status:changed': (oldStatus: AgentStatus, newStatus: AgentStatus) => void;
    'location:changed': (oldLocation: AgentLocation, newLocation: AgentLocation) => void;
    'task:started': (task: Task) => void;
    'task:completed': (task: Task) => void;
    'decision:made': (decision: { summary: string; reasoning: string }) => void;
    'meeting:joined': (meeting: Meeting) => void;
    'meeting:left': (meeting: Meeting) => void;
}

// ============================================================================
// Base Agent Class
// ============================================================================

export abstract class BaseAgent extends EventEmitter<BaseAgentEvents> {
    readonly id: AgentId;
    readonly name: string;
    readonly type: AgentType;
    readonly tier: AgentTier;

    protected _status: AgentStatus = 'INITIALIZING';
    protected _location: AgentLocation;
    protected _parentId: AgentId | null;
    protected _childIds: AgentId[] = [];
    protected _capabilities: Capability[] = [];
    protected _currentTask: Task | null = null;
    protected _currentMeeting: Meeting | null = null;

    readonly createdAt: Date = new Date();
    protected lastActiveAt: Date = new Date();
    protected metadata: Record<string, unknown> = {};

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(params: {
        name: string;
        type: AgentType;
        tier: AgentTier;
        parentId: AgentId | null;
        location: AgentLocation;
        capabilities?: Capability[];
    }) {
        super();

        this.id = uuidv4();
        this.name = params.name;
        this.type = params.type;
        this.tier = params.tier;
        this._parentId = params.parentId;
        this._location = params.location;
        this._capabilities = params.capabilities ?? [];

        // Register with systems
        messageBus.registerAgent(this.id, this.tier);
        trustEngine.createTrust(this.id, {
            tier: this.tier,
            parentId: params.parentId,
        });
    }

    // -------------------------------------------------------------------------
    // Lifecycle
    // -------------------------------------------------------------------------

    /**
     * Initialize the agent
     */
    async initialize(): Promise<void> {
        this.setStatus('IDLE');
        this.remember('INITIALIZATION', 'Agent initialized successfully', true);
    }

    /**
     * Main execution loop - override in subclasses
     */
    abstract execute(): Promise<void>;

    /**
     * Terminate the agent
     */
    async terminate(): Promise<void> {
        this.setStatus('TERMINATED');
        messageBus.unregisterAgent(this.id);
    }

    // -------------------------------------------------------------------------
    // Status & Location
    // -------------------------------------------------------------------------

    get status(): AgentStatus {
        return this._status;
    }

    get location(): AgentLocation {
        return this._location;
    }

    protected setStatus(newStatus: AgentStatus): void {
        const oldStatus = this._status;
        this._status = newStatus;
        this.lastActiveAt = new Date();
        this.emit('status:changed', oldStatus, newStatus);
    }

    moveTo(newLocation: AgentLocation): void {
        const oldLocation = this._location;
        this._location = newLocation;
        this.emit('location:changed', oldLocation, newLocation);
        this.remember('MOVEMENT', `Moved from ${oldLocation.room} to ${newLocation.room}`);
    }

    // -------------------------------------------------------------------------
    // Trust
    // -------------------------------------------------------------------------

    get trustScore(): TrustScore | undefined {
        return trustEngine.getTrust(this.id);
    }

    get trustPolicy(): TrustPolicy | undefined {
        return trustEngine.getPolicy(this.id);
    }

    // -------------------------------------------------------------------------
    // Communication
    // -------------------------------------------------------------------------

    /**
     * Send a direct message to another agent
     */
    sendMessage(to: AgentId, subject: string, content: unknown): Message {
        return messageBus.sendDirect({
            from: this.id,
            to,
            subject,
            content,
        });
    }

    /**
     * Broadcast to all agents
     */
    broadcast(to: AgentId[], subject: string, content: unknown): Message {
        return messageBus.broadcast({
            from: this.id,
            to,
            subject,
            content,
        });
    }

    /**
     * Send request and wait for response
     */
    async request(to: AgentId, subject: string, content: unknown): Promise<Message | null> {
        return messageBus.request({
            from: this.id,
            to,
            subject,
            content,
        });
    }

    /**
     * Get messages in inbox
     */
    getMessages(): Message[] {
        return messageBus.getInbox(this.id);
    }

    /**
     * Get pending requests (require response)
     */
    getPendingRequests(): Message[] {
        return messageBus.getPendingRequests(this.id);
    }

    /**
     * Respond to a request
     */
    respond(messageId: string, content: unknown): Message | null {
        return messageBus.respond(messageId, { from: this.id, content });
    }

    // -------------------------------------------------------------------------
    // Memory
    // -------------------------------------------------------------------------

    /**
     * Remember something
     */
    remember(category: string, content: unknown, important: boolean = false): void {
        memoryStore.store({
            agentId: this.id,
            type: important ? 'LONG_TERM' : 'SHORT_TERM',
            category,
            content,
            importance: important ? 70 : 30,
            expiresIn: important ? undefined : 3600000, // 1 hour for short-term
        });
    }

    /**
     * Recall memories by category
     */
    recall(category: string): unknown[] {
        return memoryStore.getByCategory(this.id, category)
            .map(m => m.content);
    }

    /**
     * Search memories
     */
    searchMemory(keyword: string): unknown[] {
        return memoryStore.search(this.id, keyword)
            .map(m => m.content);
    }

    /**
     * Get most important memories
     */
    getImportantMemories(count: number = 10): unknown[] {
        return memoryStore.getMostImportant(this.id, count)
            .map(m => m.content);
    }

    // -------------------------------------------------------------------------
    // Blackboard
    // -------------------------------------------------------------------------

    /**
     * Post to the blackboard
     */
    postToBlackboard(params: {
        type: BlackboardEntry['type'];
        title: string;
        content: unknown;
        priority?: BlackboardEntry['priority'];
    }): BlackboardEntry {
        return blackboard.post({
            ...params,
            author: this.id,
        });
    }

    /**
     * Contribute to a blackboard entry
     */
    contributeToEntry(entryId: string, content: string, confidence: number): BlackboardEntry | null {
        return blackboard.contribute(entryId, {
            agentId: this.id,
            content,
            confidence,
        });
    }

    /**
     * Get visible blackboard entries
     */
    getBlackboardEntries(): BlackboardEntry[] {
        return blackboard.getVisibleTo(this.id, this.tier);
    }

    /**
     * Get open problems from blackboard
     */
    getOpenProblems(): BlackboardEntry[] {
        return blackboard.getOpenProblems();
    }

    // -------------------------------------------------------------------------
    // Tasks
    // -------------------------------------------------------------------------

    get currentTask(): Task | null {
        return this._currentTask;
    }

    protected startTask(task: Task): void {
        this._currentTask = task;
        this.setStatus('WORKING');
        this.emit('task:started', task);
        this.remember('TASK', { action: 'started', task: task.title });
    }

    protected completeTask(result?: { summary: string; confidence?: number; data?: Record<string, unknown> }): void {
        if (this._currentTask) {
            this._currentTask.status = 'COMPLETED';
            this._currentTask.completedAt = new Date();

            // Build structured TaskResult
            const startTime = this._currentTask.startedAt ?? this._currentTask.createdAt;
            const durationMs = Date.now() - startTime.getTime();
            const durationStr = durationMs >= 60000
                ? `${Math.floor(durationMs / 60000)}m ${Math.floor((durationMs % 60000) / 1000)}s`
                : `${Math.floor(durationMs / 1000)}s`;

            this._currentTask.result = {
                summary: result?.summary ?? 'Task completed',
                completedBy: this.id,
                duration: durationStr,
                confidence: result?.confidence ?? 100,
                data: result?.data,
            };

            this.emit('task:completed', this._currentTask);
            this.remember('TASK', {
                action: 'completed',
                task: this._currentTask.title,
                result: this._currentTask.result
            }, true);
            this._currentTask = null;
        }
        this.setStatus('IDLE');
    }

    // -------------------------------------------------------------------------
    // Decisions
    // -------------------------------------------------------------------------

    /**
     * Record a decision for transparency
     */
    protected makeDecision(summary: string, reasoning: string): void {
        this.emit('decision:made', { summary, reasoning });
        this.postToBlackboard({
            type: 'DECISION',
            title: summary,
            content: { summary, reasoning, agent: this.name },
            priority: 'MEDIUM',
        });
        this.remember('DECISION', { summary, reasoning }, true);
    }

    // -------------------------------------------------------------------------
    // Meetings
    // -------------------------------------------------------------------------

    get currentMeeting(): Meeting | null {
        return this._currentMeeting;
    }

    joinMeeting(meeting: Meeting): void {
        this._currentMeeting = meeting;
        this.setStatus('IN_MEETING');
        this.moveTo({
            floor: 'EXECUTIVE',
            room: meeting.location,
        });
        this.emit('meeting:joined', meeting);
    }

    leaveMeeting(): void {
        if (this._currentMeeting) {
            this.emit('meeting:left', this._currentMeeting);
            this._currentMeeting = null;
        }
        this.setStatus('IDLE');
        // Return to office
        this.moveTo(this.getDefaultLocation());
    }

    protected abstract getDefaultLocation(): AgentLocation;

    // -------------------------------------------------------------------------
    // Blueprint
    // -------------------------------------------------------------------------

    /**
     * Get agent as blueprint (for serialization/display)
     */
    toBlueprint(): AgentBlueprint {
        return {
            id: this.id,
            name: this.name,
            type: this.type,
            tier: this.tier,
            trustScore: this.trustScore!,
            trustPolicy: this.trustPolicy!,
            capabilities: this._capabilities,
            location: this._location,
            status: this._status,
            parentId: this._parentId,
            childIds: this._childIds,
            createdAt: this.createdAt,
            lastActiveAt: this.lastActiveAt,
            metadata: this.metadata,
        };
    }

    // -------------------------------------------------------------------------
    // Children
    // -------------------------------------------------------------------------

    get parentId(): AgentId | null {
        return this._parentId;
    }

    get childIds(): AgentId[] {
        return [...this._childIds];
    }

    registerChild(childId: AgentId): void {
        if (!this._childIds.includes(childId)) {
            this._childIds.push(childId);
        }
    }

    // -------------------------------------------------------------------------
    // Capabilities
    // -------------------------------------------------------------------------

    get capabilities(): Capability[] {
        return [...this._capabilities];
    }

    hasCapability(capabilityId: string): boolean {
        return this._capabilities.some(c => c.id === capabilityId);
    }

    addCapability(capability: Capability): void {
        if (!this.hasCapability(capability.id)) {
            this._capabilities.push(capability);
        }
    }
}
