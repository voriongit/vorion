import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface AuditEvent {
    id: string;
    timestamp: number;
    eventType: 'action' | 'decision' | 'escalation' | 'approval' | 'rejection' | 'error' | 'system';
    agentId: string;
    action: string;
    details: string;
    input?: any;
    output?: any;
    success: boolean;
    duration?: number;
    risk?: 'HIGH' | 'MEDIUM' | 'LOW';
    hash: string;
    prevHash: string;
    verified?: boolean;
}

const EVENT_STYLES: Record<AuditEvent['eventType'], { bg: string; icon: string; color: string }> = {
    action: { bg: 'bg-indigo-500/20', icon: '⚡', color: 'text-indigo-400' },
    decision: { bg: 'bg-blue-500/20', icon: '🎯', color: 'text-blue-400' },
    escalation: { bg: 'bg-amber-500/20', icon: '⚠️', color: 'text-amber-400' },
    approval: { bg: 'bg-emerald-500/20', icon: '✓', color: 'text-emerald-400' },
    rejection: { bg: 'bg-red-500/20', icon: '✕', color: 'text-red-400' },
    error: { bg: 'bg-red-500/20', icon: '💥', color: 'text-red-400' },
    system: { bg: 'bg-slate-500/20', icon: '🔧', color: 'text-slate-400' },
};

// Bootstrap Agents (5-agent model) + Governance
const AGENT_COLORS: Record<string, string> = {
    // Bootstrap Agents
    architect: 'border-amber-500',
    scribe: 'border-purple-500',
    sentinel: 'border-blue-500',
    builder: 'border-emerald-500',
    tester: 'border-cyan-500',
    // Governance Layer
    council: 'border-orange-500',
    // Legacy mappings (backward compatibility)
    herald: 'border-emerald-500',      // → builder
    watchman: 'border-blue-500',       // → sentinel
    envoy: 'border-emerald-500',       // → builder
    librarian: 'border-amber-500',     // → architect
    curator: 'border-purple-500',      // → scribe
    'ts-fixer': 'border-emerald-500',  // → builder
};

function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function groupByDate(events: AuditEvent[]): Map<string, AuditEvent[]> {
    const groups = new Map<string, AuditEvent[]>();
    for (const event of events) {
        const dateKey = formatDate(event.timestamp);
        if (!groups.has(dateKey)) {
            groups.set(dateKey, []);
        }
        groups.get(dateKey)!.push(event);
    }
    return groups;
}

interface EventCardProps {
    event: AuditEvent;
    expanded: boolean;
    onToggle: () => void;
}

function EventCard({ event, expanded, onToggle }: EventCardProps) {
    const style = EVENT_STYLES[event.eventType];
    const agentColor = AGENT_COLORS[event.agentId] || 'border-slate-500';

    // Stop propagation for text selection/copying
    const handleContentClick = (e: React.MouseEvent) => {
        e.stopPropagation();
    };

    return (
        <motion.div
            layout
            className={`relative pl-8 pb-6 group`}
        >
            {/* Timeline line */}
            <div className="absolute left-[11px] top-6 bottom-0 w-px bg-white/10 group-last:hidden" />

            {/* Timeline dot */}
            <div className={`absolute left-0 top-1 w-6 h-6 rounded-full ${style.bg} border-2 ${agentColor} flex items-center justify-center text-xs`}>
                {style.icon}
            </div>

            {/* Content */}
            <div className={`bg-white/5 rounded-xl p-4 border border-white/5 hover:border-white/10 transition-colors ${!event.success ? 'border-red-500/30' : ''}`}>
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0" onClick={handleContentClick}>
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs font-bold uppercase ${style.color}`}>
                                {event.agentId}
                            </span>
                            <span className="text-xs text-slate-600">•</span>
                            <span className="text-xs text-slate-500 font-mono">
                                {formatTime(event.timestamp)}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-500/20 text-slate-400`}>
                                {event.eventType}
                            </span>
                            {event.risk && (
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    event.risk === 'HIGH' ? 'bg-red-500/20 text-red-400' :
                                    event.risk === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400' :
                                    'bg-green-500/20 text-green-400'
                                }`}>
                                    {event.risk}
                                </span>
                            )}
                        </div>
                        <div className="font-medium text-slate-200">{event.action}</div>
                        <div className="text-sm text-slate-400 mt-1">{event.details}</div>

                        {/* Always visible: duration and ID */}
                        <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                            {event.duration && (
                                <span className="font-mono">Duration: {event.duration}ms</span>
                            )}
                            <span className="font-mono">ID: {event.id.slice(0, 8)}</span>
                            {event.verified && (
                                <span className="text-emerald-400 flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                    </svg>
                                    Verified
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {event.success ? (
                            <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                        ) : (
                            <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center">
                                <svg className="w-3 h-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </div>
                        )}
                        {/* Expand/Collapse Arrow Button */}
                        <button
                            onClick={onToggle}
                            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                            title={expanded ? 'Collapse' : 'Expand'}
                        >
                            <svg
                                className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Expanded details */}
                <AnimatePresence mode="wait">
                    {expanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: 'easeInOut' }}
                            onClick={handleContentClick}
                            className="overflow-hidden"
                        >
                            <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
                                {/* Event metadata */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                    <div className="bg-black/30 rounded-lg p-2">
                                        <div className="text-slate-600 mb-0.5">Event ID</div>
                                        <code className="text-slate-400 font-mono break-all">{event.id}</code>
                                    </div>
                                    <div className="bg-black/30 rounded-lg p-2">
                                        <div className="text-slate-600 mb-0.5">Agent</div>
                                        <span className="text-slate-300 font-medium">{event.agentId}</span>
                                    </div>
                                    <div className="bg-black/30 rounded-lg p-2">
                                        <div className="text-slate-600 mb-0.5">Type</div>
                                        <span className={`font-medium ${EVENT_STYLES[event.eventType]?.color || 'text-slate-400'}`}>
                                            {event.eventType}
                                        </span>
                                    </div>
                                    <div className="bg-black/30 rounded-lg p-2">
                                        <div className="text-slate-600 mb-0.5">Timestamp</div>
                                        <span className="text-slate-400 font-mono">{new Date(event.timestamp).toISOString()}</span>
                                    </div>
                                </div>

                                {/* Hash chain info */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="bg-black/30 rounded-lg p-3 overflow-hidden">
                                        <div className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                            </svg>
                                            Current Hash
                                        </div>
                                        <code className="font-mono text-xs text-slate-400 break-all select-all block max-h-16 overflow-y-auto">
                                            {event.hash}
                                        </code>
                                    </div>
                                    <div className="bg-black/30 rounded-lg p-3 overflow-hidden">
                                        <div className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                                            </svg>
                                            Previous Hash
                                        </div>
                                        <code className="font-mono text-xs text-slate-500 break-all select-all block max-h-16 overflow-y-auto">
                                            {event.prevHash}
                                        </code>
                                    </div>
                                </div>

                                {/* Input/Output */}
                                {event.input && (
                                    <div className="bg-black/30 rounded-lg p-3 overflow-hidden">
                                        <div className="text-xs text-slate-500 mb-2 font-medium flex items-center gap-1">
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14" />
                                            </svg>
                                            Input
                                        </div>
                                        <pre className="text-xs text-slate-400 select-all whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                                            {JSON.stringify(event.input, null, 2)}
                                        </pre>
                                    </div>
                                )}
                                {event.output && (
                                    <div className="bg-black/30 rounded-lg p-3 overflow-hidden">
                                        <div className="text-xs text-slate-500 mb-2 font-medium flex items-center gap-1">
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l4 4m0 0l-4 4m4-4H3" />
                                            </svg>
                                            Output
                                        </div>
                                        <pre className="text-xs text-slate-400 select-all whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                                            {typeof event.output === 'string' ? event.output : JSON.stringify(event.output, null, 2)}
                                        </pre>
                                    </div>
                                )}

                                {/* Action buttons */}
                                <div className="flex flex-wrap items-center gap-3 pt-2">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigator.clipboard.writeText(JSON.stringify(event, null, 2));
                                        }}
                                        className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1.5 px-2 py-1 bg-black/20 rounded hover:bg-black/30 transition-colors"
                                    >
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                        Copy JSON
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigator.clipboard.writeText(event.hash);
                                        }}
                                        className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1.5 px-2 py-1 bg-black/20 rounded hover:bg-black/30 transition-colors"
                                    >
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                                        </svg>
                                        Copy Hash
                                    </button>
                                    <a
                                        href={`/agents/${event.agentId}`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 px-2 py-1 bg-indigo-500/10 rounded hover:bg-indigo-500/20 transition-colors"
                                    >
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                        View Agent
                                    </a>
                                    <a
                                        href={`/trust?agent=${event.agentId}`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 px-2 py-1 bg-cyan-500/10 rounded hover:bg-cyan-500/20 transition-colors"
                                    >
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                        </svg>
                                        Trust Score
                                    </a>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}

interface AuditTimelineProps {
    agentFilter?: string;
    typeFilter?: string;
    limit?: number;
}

export function AuditTimeline({ agentFilter, typeFilter, limit = 50 }: AuditTimelineProps) {
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const queryParams = new URLSearchParams();
    if (agentFilter) queryParams.set('agent', agentFilter);
    if (typeFilter) queryParams.set('type', typeFilter);
    queryParams.set('limit', limit.toString());
    queryParams.set('verify', 'true');

    const { data, error, isLoading } = useSWR(
        `/api/audit/events?${queryParams.toString()}`,
        fetcher,
        { refreshInterval: 10000 }
    );

    if (isLoading) {
        return (
            <div className="space-y-4">
                {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="animate-pulse pl-8">
                        <div className="bg-white/5 rounded-xl h-24" />
                    </div>
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-8 text-red-400">
                Failed to load audit events
            </div>
        );
    }

    const events: AuditEvent[] = data?.events || [];
    const grouped = groupByDate(events);

    return (
        <div className="space-y-8">
            {/* Chain status */}
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${
                data?.chainValid ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
            }`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={
                        data?.chainValid
                            ? "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                            : "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    } />
                </svg>
                {data?.chainValid ? 'Hash chain verified - all events are authentic' : 'Hash chain verification failed - possible tampering detected'}
            </div>

            {/* Timeline */}
            {Array.from(grouped.entries()).map(([date, dateEvents]) => (
                <div key={date}>
                    <div className="text-xs font-bold uppercase text-slate-500 mb-4 pl-8">
                        {date}
                    </div>
                    <div>
                        {dateEvents.map(event => (
                            <EventCard
                                key={event.id}
                                event={event}
                                expanded={expandedId === event.id}
                                onToggle={() => setExpandedId(expandedId === event.id ? null : event.id)}
                            />
                        ))}
                    </div>
                </div>
            ))}

            {events.length === 0 && (
                <div className="text-center py-12">
                    <div className="text-4xl mb-4">📋</div>
                    <div className="text-slate-500">No audit events found</div>
                </div>
            )}
        </div>
    );
}
