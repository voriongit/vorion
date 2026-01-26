/**
 * Server-Sent Events API for Real-Time Updates
 * Provides push notifications for agent activity, status changes, and alerts
 */

import type { NextApiRequest, NextApiResponse } from 'next';

export interface RealtimeEvent {
    type: 'agent_status' | 'task_update' | 'alert' | 'telemetry' | 'audit' | 'trust_change';
    agentId?: string;
    data: any;
    timestamp: number;
}

// In-memory event queue (in production, use Redis pub/sub)
const eventQueue: RealtimeEvent[] = [];
const subscribers = new Set<(event: RealtimeEvent) => void>();

// Helper to broadcast events
export function broadcastEvent(event: RealtimeEvent) {
    eventQueue.push(event);
    // Keep only last 100 events
    if (eventQueue.length > 100) {
        eventQueue.shift();
    }
    subscribers.forEach(callback => callback(event));
}

// Generate simulated events for demo
function generateSimulatedEvents() {
    const agents = ['herald', 'sentinel', 'watchman', 'envoy', 'scribe', 'librarian', 'curator', 'ts-fixer', 'council'];
    const statuses = ['active', 'busy', 'idle'] as const;
    const alertTypes = ['info', 'warning', 'error'] as const;

    setInterval(() => {
        const eventType = Math.random();

        if (eventType < 0.3) {
            // Agent status change
            broadcastEvent({
                type: 'agent_status',
                agentId: agents[Math.floor(Math.random() * agents.length)],
                data: {
                    status: statuses[Math.floor(Math.random() * statuses.length)],
                    queueDepth: Math.floor(Math.random() * 10),
                },
                timestamp: Date.now(),
            });
        } else if (eventType < 0.5) {
            // Task update
            broadcastEvent({
                type: 'task_update',
                agentId: agents[Math.floor(Math.random() * agents.length)],
                data: {
                    taskId: `task_${Date.now()}`,
                    status: Math.random() > 0.5 ? 'completed' : 'in_progress',
                    action: ['code_review', 'document', 'fix_type_error', 'monitor'][Math.floor(Math.random() * 4)],
                },
                timestamp: Date.now(),
            });
        } else if (eventType < 0.6) {
            // Alert
            broadcastEvent({
                type: 'alert',
                agentId: agents[Math.floor(Math.random() * agents.length)],
                data: {
                    level: alertTypes[Math.floor(Math.random() * alertTypes.length)],
                    message: ['High queue depth', 'Task timeout warning', 'Escalation required', 'Policy violation detected'][Math.floor(Math.random() * 4)],
                },
                timestamp: Date.now(),
            });
        } else if (eventType < 0.8) {
            // Telemetry update
            broadcastEvent({
                type: 'telemetry',
                agentId: agents[Math.floor(Math.random() * agents.length)],
                data: {
                    responseTime: Math.floor(Math.random() * 500) + 100,
                    memoryUsage: Math.floor(Math.random() * 100),
                    tasksCompleted: Math.floor(Math.random() * 50),
                },
                timestamp: Date.now(),
            });
        }
    }, 5000); // Every 5 seconds
}

// Start simulation on first request
let simulationStarted = false;

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).end('Method Not Allowed');
    }

    // Start simulation if not already running
    if (!simulationStarted) {
        simulationStarted = true;
        generateSimulatedEvents();
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Send initial connection event
    res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`);

    // Send recent events as backfill
    for (const event of eventQueue.slice(-10)) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
    }

    // Subscribe to new events
    const callback = (event: RealtimeEvent) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
    };
    subscribers.add(callback);

    // Heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
        res.write(`: heartbeat\n\n`);
    }, 30000);

    // Cleanup on disconnect
    req.on('close', () => {
        clearInterval(heartbeat);
        subscribers.delete(callback);
    });
}

export const config = {
    api: {
        bodyParser: false,
    },
};
