import { motion } from 'framer-motion';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface AgentMetrics {
    agentId: string;
    status: 'healthy' | 'degraded' | 'unhealthy' | 'offline';
    lastHeartbeat: number;
    uptime: number;
    requestCount: number;
    successCount: number;
    failureCount: number;
    avgResponseTime: number;
    p95ResponseTime: number;
    queueDepth: number;
    memoryUsage?: number;
    cpuUsage?: number;
    trustScore?: number;
    lastError?: string;
    lastErrorTime?: number;
}

interface TelemetrySnapshot {
    timestamp: number;
    agents: Record<string, AgentMetrics>;
    systemHealth: 'green' | 'yellow' | 'red';
    totalRequests: number;
    overallSuccessRate: number;
}

const STATUS_STYLES = {
    healthy: {
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/30',
        dot: 'bg-emerald-500',
        text: 'text-emerald-400',
    },
    degraded: {
        bg: 'bg-yellow-500/10',
        border: 'border-yellow-500/30',
        dot: 'bg-yellow-500',
        text: 'text-yellow-400',
    },
    unhealthy: {
        bg: 'bg-red-500/10',
        border: 'border-red-500/30',
        dot: 'bg-red-500',
        text: 'text-red-400',
    },
    offline: {
        bg: 'bg-slate-500/10',
        border: 'border-slate-500/30',
        dot: 'bg-slate-500',
        text: 'text-slate-400',
    },
};

const AGENT_NAMES: Record<string, string> = {
    'herald': 'Herald',
    'sentinel': 'Sentinel',
    'watchman': 'Watchman',
    'envoy': 'Envoy',
    'scribe': 'Scribe',
    'librarian': 'Librarian',
    'curator': 'Curator',
    'ts-fixer': 'TS-Fixer',
    'steward': 'Steward',
};

function formatUptime(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
}

function formatNumber(n: number): string {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toString();
}

interface SingleAgentCardProps {
    metrics: AgentMetrics;
    expanded?: boolean;
    onToggle?: () => void;
}

export function SingleAgentCard({ metrics, expanded = false, onToggle }: SingleAgentCardProps) {
    const style = STATUS_STYLES[metrics.status];
    const successRate = metrics.requestCount > 0
        ? ((metrics.successCount / metrics.requestCount) * 100).toFixed(1)
        : '100';

    return (
        <div
            onClick={onToggle}
            className={`p-4 rounded-xl border ${style.bg} ${style.border} cursor-pointer transition-all hover:scale-[1.02]`}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${style.dot} ${metrics.status === 'healthy' ? 'animate-pulse' : ''}`} />
                    <span className="font-bold text-slate-200">
                        {AGENT_NAMES[metrics.agentId] || metrics.agentId}
                    </span>
                </div>
                <span className={`text-xs font-mono uppercase ${style.text}`}>
                    {metrics.status}
                </span>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                    <div className="text-xs text-slate-500">Requests</div>
                    <div className="font-mono text-sm text-slate-300">{formatNumber(metrics.requestCount)}</div>
                </div>
                <div>
                    <div className="text-xs text-slate-500">Success</div>
                    <div className={`font-mono text-sm ${parseFloat(successRate) >= 90 ? 'text-emerald-400' : parseFloat(successRate) >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {successRate}%
                    </div>
                </div>
                <div>
                    <div className="text-xs text-slate-500">Avg RT</div>
                    <div className="font-mono text-sm text-slate-300">{metrics.avgResponseTime}ms</div>
                </div>
            </div>

            {/* Expanded Details */}
            {expanded && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 pt-4 border-t border-white/10 space-y-3"
                >
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                            <span className="text-slate-500">Uptime:</span>
                            <span className="ml-2 font-mono text-slate-300">{formatUptime(metrics.uptime)}</span>
                        </div>
                        <div>
                            <span className="text-slate-500">Queue:</span>
                            <span className="ml-2 font-mono text-slate-300">{metrics.queueDepth}</span>
                        </div>
                        <div>
                            <span className="text-slate-500">P95 RT:</span>
                            <span className="ml-2 font-mono text-slate-300">{metrics.p95ResponseTime}ms</span>
                        </div>
                        {metrics.trustScore !== undefined && (
                            <div>
                                <span className="text-slate-500">Trust:</span>
                                <span className={`ml-2 font-mono ${metrics.trustScore >= 80 ? 'text-emerald-400' : metrics.trustScore >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                                    {metrics.trustScore}
                                </span>
                            </div>
                        )}
                        {metrics.memoryUsage !== undefined && (
                            <div>
                                <span className="text-slate-500">Memory:</span>
                                <span className="ml-2 font-mono text-slate-300">{metrics.memoryUsage}MB</span>
                            </div>
                        )}
                        {metrics.cpuUsage !== undefined && (
                            <div>
                                <span className="text-slate-500">CPU:</span>
                                <span className="ml-2 font-mono text-slate-300">{metrics.cpuUsage}%</span>
                            </div>
                        )}
                    </div>

                    {metrics.lastError && (
                        <div className="bg-red-500/10 rounded-lg p-2 text-xs">
                            <div className="text-red-400 font-medium">Last Error</div>
                            <div className="text-red-300/80 truncate">{metrics.lastError}</div>
                        </div>
                    )}
                </motion.div>
            )}
        </div>
    );
}

interface TelemetryGridProps {
    compact?: boolean;
}

export function TelemetryGrid({ compact = false }: TelemetryGridProps) {
    const { data, error, isLoading } = useSWR<TelemetrySnapshot>('/api/telemetry', fetcher, {
        refreshInterval: 5000,
    });

    if (isLoading) {
        return (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="animate-pulse bg-white/5 h-32 rounded-xl" />
                ))}
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="text-center py-8 text-slate-500">
                Failed to load telemetry data
            </div>
        );
    }

    const agents = Object.values(data.agents);

    return (
        <div className={`grid gap-4 ${compact ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'}`}>
            {agents.map(agent => (
                <SingleAgentCard
                    key={agent.agentId}
                    metrics={agent}
                />
            ))}
        </div>
    );
}

export function TelemetrySummary() {
    const { data } = useSWR<TelemetrySnapshot>('/api/telemetry', fetcher, {
        refreshInterval: 5000,
    });

    if (!data) return null;

    const healthColors = {
        green: 'bg-emerald-500',
        yellow: 'bg-yellow-500',
        red: 'bg-red-500',
    };

    const agents = Object.values(data.agents);
    const healthyCount = agents.filter(a => a.status === 'healthy').length;
    const totalAgents = agents.length;

    return (
        <div className="flex items-center gap-4 bg-white/5 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
            <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${healthColors[data.systemHealth]} ${data.systemHealth === 'green' ? 'animate-pulse' : ''}`} />
                <span className="text-xs font-mono text-slate-400">
                    {healthyCount}/{totalAgents} AGENTS
                </span>
            </div>
            <div className="text-xs text-slate-500 border-l border-white/10 pl-4">
                {(data.overallSuccessRate * 100).toFixed(1)}% SUCCESS
            </div>
            <div className="text-xs text-slate-500 border-l border-white/10 pl-4">
                {formatNumber(data.totalRequests)} REQUESTS
            </div>
        </div>
    );
}
