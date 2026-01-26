/**
 * Realtime Hooks
 * Specialized hooks for consuming real-time data
 */

import { useEffect, useState, useMemo } from 'react';
import { useRealtime, RealtimeEvent } from '../contexts/RealtimeContext';

/**
 * Subscribe to specific event types
 */
export function useRealtimeEvents(
    types: RealtimeEvent['type'][] | '*',
    limit = 50
): RealtimeEvent[] {
    const { events } = useRealtime();

    return useMemo(() => {
        if (types === '*') {
            return events.slice(0, limit);
        }
        return events
            .filter(e => types.includes(e.type))
            .slice(0, limit);
    }, [events, types, limit]);
}

/**
 * Get real-time agent status
 */
export function useAgentStatus(agentId?: string) {
    const { events } = useRealtime();

    return useMemo(() => {
        const statusEvents = events.filter(
            e => e.type === 'agent_status' && (!agentId || e.agentId === agentId)
        );

        if (!agentId) {
            // Return all agent statuses
            const statusMap = new Map<string, RealtimeEvent>();
            for (const event of statusEvents) {
                if (event.agentId && !statusMap.has(event.agentId)) {
                    statusMap.set(event.agentId, event);
                }
            }
            return Array.from(statusMap.values());
        }

        return statusEvents[0] || null;
    }, [events, agentId]);
}

/**
 * Get unread alerts count and list
 */
export function useAlerts() {
    const { alerts, clearAlerts } = useRealtime();
    const [acknowledged, setAcknowledged] = useState<Set<number>>(new Set());

    const unreadAlerts = useMemo(
        () => alerts.filter(a => !acknowledged.has(a.timestamp)),
        [alerts, acknowledged]
    );

    const acknowledge = (timestamp: number) => {
        setAcknowledged(prev => new Set([...prev, timestamp]));
    };

    const acknowledgeAll = () => {
        setAcknowledged(new Set(alerts.map(a => a.timestamp)));
    };

    return {
        alerts,
        unreadAlerts,
        unreadCount: unreadAlerts.length,
        acknowledge,
        acknowledgeAll,
        clearAlerts,
    };
}

/**
 * Get real-time telemetry for an agent
 */
export function useAgentTelemetry(agentId: string) {
    const { subscribe } = useRealtime();
    const [telemetry, setTelemetry] = useState<any>(null);

    useEffect(() => {
        const unsubscribe = subscribe('telemetry', (event) => {
            if (event.agentId === agentId) {
                setTelemetry(event.data);
            }
        });

        return unsubscribe;
    }, [agentId, subscribe]);

    return telemetry;
}

/**
 * Track task updates in real-time
 */
export function useTaskUpdates(agentId?: string) {
    const { events } = useRealtime();

    return useMemo(() => {
        return events
            .filter(e => e.type === 'task_update' && (!agentId || e.agentId === agentId))
            .slice(0, 20);
    }, [events, agentId]);
}

/**
 * Connection status indicator
 */
export function useConnectionStatus() {
    const { connected, lastEvent } = useRealtime();

    const [connectionQuality, setConnectionQuality] = useState<'good' | 'degraded' | 'disconnected'>('disconnected');

    useEffect(() => {
        if (!connected) {
            setConnectionQuality('disconnected');
            return;
        }

        // Check if we've received events recently
        const checkQuality = () => {
            if (!lastEvent) {
                setConnectionQuality('degraded');
                return;
            }

            const timeSinceLastEvent = Date.now() - lastEvent.timestamp;
            if (timeSinceLastEvent < 30000) {
                setConnectionQuality('good');
            } else if (timeSinceLastEvent < 60000) {
                setConnectionQuality('degraded');
            } else {
                setConnectionQuality('disconnected');
            }
        };

        checkQuality();
        const interval = setInterval(checkQuality, 10000);

        return () => clearInterval(interval);
    }, [connected, lastEvent]);

    return {
        connected,
        quality: connectionQuality,
        lastEventTime: lastEvent?.timestamp,
    };
}

/**
 * Real-time metrics aggregation
 */
export function useRealtimeMetrics() {
    const { events } = useRealtime();

    return useMemo(() => {
        const last5Minutes = Date.now() - 5 * 60 * 1000;
        const recentEvents = events.filter(e => e.timestamp > last5Minutes);

        const metrics = {
            totalEvents: recentEvents.length,
            byType: {} as Record<string, number>,
            byAgent: {} as Record<string, number>,
            alertCount: 0,
            avgResponseTime: 0,
        };

        let responseTimes: number[] = [];

        for (const event of recentEvents) {
            // Count by type
            metrics.byType[event.type] = (metrics.byType[event.type] || 0) + 1;

            // Count by agent
            if (event.agentId) {
                metrics.byAgent[event.agentId] = (metrics.byAgent[event.agentId] || 0) + 1;
            }

            // Track alerts
            if (event.type === 'alert') {
                metrics.alertCount++;
            }

            // Track response times
            if (event.type === 'telemetry' && event.data?.responseTime) {
                responseTimes.push(event.data.responseTime);
            }
        }

        if (responseTimes.length > 0) {
            metrics.avgResponseTime = Math.round(
                responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
            );
        }

        return metrics;
    }, [events]);
}
