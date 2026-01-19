/**
 * WebSocket Message Handlers
 *
 * Epic 10: Agent Connection Layer
 * Story 10.2: WebSocket Hub
 *
 * Handlers for different WebSocket message types
 */

import type { WebSocketHub } from '../WebSocketHub.js';
import type {
    StatusUpdatePayload,
    HeartbeatPayload,
    ActionRequestPayload,
    TaskCompletedPayload,
} from '../types.js';

// ============================================================================
// Handler Types
// ============================================================================

export interface HandlerContext {
    hub: WebSocketHub;
    agentId: string;
}

export type MessageHandler<T> = (context: HandlerContext, payload: T) => Promise<void> | void;

// ============================================================================
// Status Update Handler
// ============================================================================

export const handleStatusUpdate: MessageHandler<StatusUpdatePayload> = async (context, payload) => {
    const { agentId } = context;
    const { status, progress, currentTask, message } = payload;

    console.log(`[WS] Agent ${agentId} status update:`, {
        status,
        progress,
        currentTask,
        message,
    });

    // Future: Update agent status in database
    // Future: Broadcast to Mission Control dashboard
};

// ============================================================================
// Heartbeat Handler
// ============================================================================

export const handleHeartbeat: MessageHandler<HeartbeatPayload> = async (context, payload) => {
    const { agentId } = context;
    const { timestamp, status, metrics } = payload;

    // Log heartbeat (verbose mode only)
    if (process.env.VERBOSE_LOGGING === 'true') {
        console.log(`[WS] Agent ${agentId} heartbeat:`, {
            timestamp,
            status,
            metrics,
        });
    }

    // Future: Update last_seen in database
    // Future: Track agent health metrics
};

// ============================================================================
// Action Request Handler
// ============================================================================

export const handleActionRequest: MessageHandler<ActionRequestPayload> = async (context, payload) => {
    const { agentId } = context;
    const { action, reason, riskLevel, sampleData, timeout } = payload;

    console.log(`[WS] Agent ${agentId} action request:`, {
        action,
        reason,
        riskLevel,
    });

    // Future: Create approval request in database
    // Future: Route to appropriate approval workflow
    // Future: Notify Mission Control dashboard
};

// ============================================================================
// Task Completed Handler
// ============================================================================

export const handleTaskCompleted: MessageHandler<TaskCompletedPayload> = async (context, payload) => {
    const { agentId } = context;
    const { taskId, result, output, error, duration } = payload;

    console.log(`[WS] Agent ${agentId} task completed:`, {
        taskId,
        result,
        duration,
        error: error || undefined,
    });

    // Future: Update task status in database
    // Future: Trigger post-task workflows
    // Future: Update agent metrics
};

// ============================================================================
// Handler Registration
// ============================================================================

export function registerHandlers(hub: WebSocketHub): void {
    hub.on('status:update', (agentId, payload) => {
        handleStatusUpdate({ hub, agentId }, payload);
    });

    hub.on('heartbeat', (agentId, payload) => {
        handleHeartbeat({ hub, agentId }, payload);
    });

    hub.on('action:request', (agentId, payload) => {
        handleActionRequest({ hub, agentId }, payload as ActionRequestPayload);
    });

    hub.on('task:completed', (agentId, payload) => {
        handleTaskCompleted({ hub, agentId }, payload as TaskCompletedPayload);
    });

    hub.on('connection', (connectionId, agentId) => {
        console.log(`[WS] Agent connected: ${agentId} (${connectionId})`);
    });

    hub.on('disconnection', (connectionId, agentId, reason) => {
        console.log(`[WS] Agent disconnected: ${agentId} (${connectionId}) - ${reason}`);
    });

    hub.on('error', (error) => {
        console.error('[WS] Hub error:', error.message);
    });
}
