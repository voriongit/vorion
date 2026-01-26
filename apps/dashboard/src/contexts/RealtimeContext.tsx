/**
 * Realtime Context Provider
 * Manages SSE connection for real-time updates across the dashboard
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';

export interface RealtimeEvent {
    type: 'agent_status' | 'task_update' | 'alert' | 'telemetry' | 'audit' | 'trust_change' | 'connected';
    agentId?: string;
    data: any;
    timestamp: number;
}

interface RealtimeContextValue {
    connected: boolean;
    lastEvent: RealtimeEvent | null;
    events: RealtimeEvent[];
    alerts: RealtimeEvent[];
    subscribe: (type: RealtimeEvent['type'], callback: (event: RealtimeEvent) => void) => () => void;
    clearAlerts: () => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

interface RealtimeProviderProps {
    children: ReactNode;
    maxEvents?: number;
}

export function RealtimeProvider({ children, maxEvents = 100 }: RealtimeProviderProps) {
    const [connected, setConnected] = useState(false);
    const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
    const [events, setEvents] = useState<RealtimeEvent[]>([]);
    const [alerts, setAlerts] = useState<RealtimeEvent[]>([]);
    const [subscribers, setSubscribers] = useState<Map<string, Set<(event: RealtimeEvent) => void>>>(new Map());

    // Use ref for subscribers to avoid dependency cycle
    const subscribersRef = useRef(subscribers);
    subscribersRef.current = subscribers;

    useEffect(() => {
        let eventSource: EventSource | null = null;
        let reconnectTimeout: NodeJS.Timeout;

        const connect = () => {
            try {
                eventSource = new EventSource('/api/events');

                eventSource.onopen = () => {
                    setConnected(true);
                };

                eventSource.onmessage = (e) => {
                    try {
                        const event: RealtimeEvent = JSON.parse(e.data);
                        setLastEvent(event);

                        if (event.type === 'connected') {
                            return;
                        }

                        // Add to events list
                        setEvents(prev => {
                            const updated = [event, ...prev];
                            return updated.slice(0, maxEvents);
                        });

                        // Track alerts separately
                        if (event.type === 'alert') {
                            setAlerts(prev => [event, ...prev].slice(0, 20));
                        }

                        // Use ref to get current subscribers without triggering re-render
                        const currentSubscribers = subscribersRef.current;

                        // Notify type subscribers
                        const typeSubscribers = currentSubscribers.get(event.type);
                        if (typeSubscribers) {
                            typeSubscribers.forEach(callback => callback(event));
                        }

                        // Notify wildcard subscribers
                        const wildcardSubscribers = currentSubscribers.get('*');
                        if (wildcardSubscribers) {
                            wildcardSubscribers.forEach(callback => callback(event));
                        }
                    } catch (error) {
                        console.error('Failed to parse event:', error);
                    }
                };

                eventSource.onerror = () => {
                    setConnected(false);
                    eventSource?.close();

                    // Reconnect after delay
                    reconnectTimeout = setTimeout(connect, 5000);
                };
            } catch (error) {
                console.error('Failed to connect to event stream:', error);
                reconnectTimeout = setTimeout(connect, 5000);
            }
        };

        connect();

        return () => {
            eventSource?.close();
            clearTimeout(reconnectTimeout);
        };
    }, [maxEvents]);

    const subscribe = useCallback((type: RealtimeEvent['type'] | '*', callback: (event: RealtimeEvent) => void) => {
        setSubscribers(prev => {
            const updated = new Map(prev);
            if (!updated.has(type)) {
                updated.set(type, new Set());
            }
            updated.get(type)!.add(callback);
            return updated;
        });

        // Return unsubscribe function
        return () => {
            setSubscribers(prev => {
                const updated = new Map(prev);
                updated.get(type)?.delete(callback);
                return updated;
            });
        };
    }, []);

    const clearAlerts = useCallback(() => {
        setAlerts([]);
    }, []);

    return (
        <RealtimeContext.Provider
            value={{
                connected,
                lastEvent,
                events,
                alerts,
                subscribe,
                clearAlerts,
            }}
        >
            {children}
        </RealtimeContext.Provider>
    );
}

export function useRealtime() {
    const context = useContext(RealtimeContext);
    if (!context) {
        throw new Error('useRealtime must be used within a RealtimeProvider');
    }
    return context;
}

export default RealtimeContext;
