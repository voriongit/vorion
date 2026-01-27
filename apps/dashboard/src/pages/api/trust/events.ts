/**
 * Trust Telemetry Events API
 *
 * POST /api/trust/events - Record a trust event
 * GET /api/trust/events - Get recent events
 *
 * This endpoint allows agents and external systems to record
 * trust-affecting events that update dimension scores.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import * as path from 'path';
import * as fs from 'fs';

interface TelemetryEventRequest {
    agentId: string;
    eventType: string;
    dimension?: string;
    delta?: number;
    source: string;
    metadata?: Record<string, unknown>;
}

interface EventResponse {
    status: 'ok' | 'error';
    event?: TelemetryEventRequest;
    newScore?: number;
    error?: string;
}

async function loadTelemetryModule() {
    try {
        const councilPath = path.join(process.cwd(), '..', '..', 'packages', 'council', 'src', 'trust');
        return await import(path.join(councilPath, 'telemetry'));
    } catch (err) {
        console.error('[TelemetryEvents] Failed to load module:', err);
        return null;
    }
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<EventResponse | { events: any[]; total: number } | { error: string }>
) {
    const trustPath = path.join(process.cwd(), '..', '..', '.vorion', 'trust');

    // Ensure directory exists
    if (!fs.existsSync(trustPath)) {
        fs.mkdirSync(trustPath, { recursive: true });
    }

    if (req.method === 'POST') {
        const telemetryModule = await loadTelemetryModule();

        if (!telemetryModule) {
            return res.status(500).json({
                status: 'error',
                error: 'Failed to load telemetry module',
            });
        }

        const event: TelemetryEventRequest = req.body;

        // Validate required fields
        if (!event.agentId || !event.eventType || !event.source) {
            return res.status(400).json({
                status: 'error',
                error: 'Missing required fields: agentId, eventType, source',
            });
        }

        try {
            const collector = telemetryModule.getTelemetryCollector(trustPath);

            // Record the event
            collector.recordEvent({
                agentId: event.agentId,
                eventType: event.eventType as any,
                dimension: event.dimension || '',
                delta: event.delta ?? 0,
                source: event.source,
                metadata: event.metadata,
            });

            // Get updated state
            const state = collector.getState(event.agentId);
            const dimScore = state?.dimensions[event.dimension || '']?.score;

            return res.status(200).json({
                status: 'ok',
                event,
                newScore: dimScore,
            });
        } catch (err: any) {
            return res.status(500).json({
                status: 'error',
                error: err.message || 'Failed to record event',
            });
        }
    }

    if (req.method === 'GET') {
        const { agentId, limit = '50' } = req.query;
        const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 50));

        const telemetryModule = await loadTelemetryModule();

        if (!telemetryModule) {
            return res.status(500).json({
                error: 'Failed to load telemetry module',
            });
        }

        try {
            const collector = telemetryModule.getTelemetryCollector(trustPath);

            if (agentId && typeof agentId === 'string') {
                // Get events for specific agent
                const state = collector.getState(agentId);
                const events = state?.eventLog?.slice(0, limitNum) || [];
                return res.status(200).json({
                    events,
                    total: state?.eventLog?.length || 0,
                });
            }

            // Get events for all agents
            const allStates = collector.getAllStates();
            const allEvents: any[] = [];

            for (const state of allStates) {
                for (const event of state.eventLog || []) {
                    allEvents.push(event);
                }
            }

            // Sort by timestamp descending
            allEvents.sort((a, b) => b.timestamp - a.timestamp);

            return res.status(200).json({
                events: allEvents.slice(0, limitNum),
                total: allEvents.length,
            });
        } catch (err: any) {
            return res.status(500).json({
                error: err.message || 'Failed to get events',
            });
        }
    }

    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).json({ error: `Method ${req.method} not allowed` });
}
