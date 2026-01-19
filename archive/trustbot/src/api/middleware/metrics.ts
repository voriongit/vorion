/**
 * Prometheus Metrics Middleware
 *
 * Epic 13: Observability & Monitoring
 * Story 13.1: Prometheus Metrics
 *
 * Exposes Prometheus metrics for monitoring system health:
 * - http_requests_total: Counter by method, path, status
 * - http_request_duration_seconds: Histogram for latency
 * - websocket_connections_current: Gauge for active connections
 * - trust_score_changes_total: Counter for trust score updates
 * - decisions_processed_total: Counter by type and outcome
 */

import { Context, Next } from 'hono';
import * as promClient from 'prom-client';

// ============================================================================
// Types
// ============================================================================

export interface MetricsConfig {
    /** Prefix for all metrics */
    prefix?: string;
    /** Default labels to add to all metrics */
    defaultLabels?: Record<string, string>;
    /** Enable default Node.js metrics collection */
    collectDefaultMetrics?: boolean;
    /** Paths to exclude from metrics */
    excludePaths?: string[];
    /** Custom buckets for duration histogram */
    durationBuckets?: number[];
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: MetricsConfig = {
    prefix: 'aurais_',
    defaultLabels: {
        service: 'mission-control',
    },
    collectDefaultMetrics: true,
    excludePaths: ['/metrics', '/health', '/live', '/ready'],
    durationBuckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
};

// ============================================================================
// Metrics Registry
// ============================================================================

class MetricsRegistry {
    private registry: promClient.Registry;
    private config: MetricsConfig;
    private initialized = false;

    // HTTP Metrics
    private httpRequestsTotal!: promClient.Counter<string>;
    private httpRequestDuration!: promClient.Histogram<string>;
    private httpRequestSize!: promClient.Histogram<string>;
    private httpResponseSize!: promClient.Histogram<string>;

    // WebSocket Metrics
    private wsConnectionsCurrent!: promClient.Gauge<string>;
    private wsMessagesTotal!: promClient.Counter<string>;

    // Trust Score Metrics
    private trustScoreChangesTotal!: promClient.Counter<string>;
    private trustScoreCurrent!: promClient.Gauge<string>;
    private trustTierChangesTotal!: promClient.Counter<string>;

    // Decision Metrics
    private decisionsProcessedTotal!: promClient.Counter<string>;
    private decisionDuration!: promClient.Histogram<string>;
    private decisionQueueDepth!: promClient.Gauge<string>;

    // Agent Metrics
    private agentsConnected!: promClient.Gauge<string>;
    private agentHeartbeatLatency!: promClient.Histogram<string>;

    // System Metrics
    private uptime!: promClient.Gauge<string>;

    constructor(config: MetricsConfig = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.registry = new promClient.Registry();

        if (this.config.defaultLabels) {
            this.registry.setDefaultLabels(this.config.defaultLabels);
        }
    }

    initialize(): void {
        if (this.initialized) return;

        const prefix = this.config.prefix || '';

        // Collect default Node.js metrics
        if (this.config.collectDefaultMetrics) {
            promClient.collectDefaultMetrics({
                register: this.registry,
                prefix,
            });
        }

        // HTTP Metrics
        this.httpRequestsTotal = new promClient.Counter({
            name: `${prefix}http_requests_total`,
            help: 'Total number of HTTP requests',
            labelNames: ['method', 'path', 'status_code'],
            registers: [this.registry],
        });

        this.httpRequestDuration = new promClient.Histogram({
            name: `${prefix}http_request_duration_seconds`,
            help: 'HTTP request duration in seconds',
            labelNames: ['method', 'path', 'status_code'],
            buckets: this.config.durationBuckets,
            registers: [this.registry],
        });

        this.httpRequestSize = new promClient.Histogram({
            name: `${prefix}http_request_size_bytes`,
            help: 'HTTP request size in bytes',
            labelNames: ['method', 'path'],
            buckets: [100, 1000, 10000, 100000, 1000000],
            registers: [this.registry],
        });

        this.httpResponseSize = new promClient.Histogram({
            name: `${prefix}http_response_size_bytes`,
            help: 'HTTP response size in bytes',
            labelNames: ['method', 'path', 'status_code'],
            buckets: [100, 1000, 10000, 100000, 1000000],
            registers: [this.registry],
        });

        // WebSocket Metrics
        this.wsConnectionsCurrent = new promClient.Gauge({
            name: `${prefix}websocket_connections_current`,
            help: 'Current number of WebSocket connections',
            labelNames: ['type'],
            registers: [this.registry],
        });

        this.wsMessagesTotal = new promClient.Counter({
            name: `${prefix}websocket_messages_total`,
            help: 'Total WebSocket messages',
            labelNames: ['direction', 'type'],
            registers: [this.registry],
        });

        // Trust Score Metrics
        this.trustScoreChangesTotal = new promClient.Counter({
            name: `${prefix}trust_score_changes_total`,
            help: 'Total trust score changes',
            labelNames: ['direction', 'event_type', 'org_id'],
            registers: [this.registry],
        });

        this.trustScoreCurrent = new promClient.Gauge({
            name: `${prefix}trust_score_current`,
            help: 'Current trust score by agent',
            labelNames: ['agent_id', 'org_id'],
            registers: [this.registry],
        });

        this.trustTierChangesTotal = new promClient.Counter({
            name: `${prefix}trust_tier_changes_total`,
            help: 'Total trust tier changes',
            labelNames: ['from_tier', 'to_tier', 'org_id'],
            registers: [this.registry],
        });

        // Decision Metrics
        this.decisionsProcessedTotal = new promClient.Counter({
            name: `${prefix}decisions_processed_total`,
            help: 'Total decisions processed',
            labelNames: ['type', 'outcome', 'source', 'org_id'],
            registers: [this.registry],
        });

        this.decisionDuration = new promClient.Histogram({
            name: `${prefix}decision_duration_seconds`,
            help: 'Decision processing duration in seconds',
            labelNames: ['type', 'source'],
            buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 300, 600],
            registers: [this.registry],
        });

        this.decisionQueueDepth = new promClient.Gauge({
            name: `${prefix}decision_queue_depth`,
            help: 'Current decision queue depth',
            labelNames: ['urgency', 'org_id'],
            registers: [this.registry],
        });

        // Agent Metrics
        this.agentsConnected = new promClient.Gauge({
            name: `${prefix}agents_connected`,
            help: 'Number of connected agents',
            labelNames: ['status', 'org_id'],
            registers: [this.registry],
        });

        this.agentHeartbeatLatency = new promClient.Histogram({
            name: `${prefix}agent_heartbeat_latency_seconds`,
            help: 'Agent heartbeat latency in seconds',
            labelNames: ['agent_id'],
            buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
            registers: [this.registry],
        });

        // System Metrics
        this.uptime = new promClient.Gauge({
            name: `${prefix}uptime_seconds`,
            help: 'Process uptime in seconds',
            registers: [this.registry],
        });

        // Update uptime periodically
        const startTime = Date.now();
        setInterval(() => {
            this.uptime.set((Date.now() - startTime) / 1000);
        }, 5000);

        this.initialized = true;
    }

    // =========================================================================
    // HTTP Metrics
    // =========================================================================

    recordHttpRequest(method: string, path: string, statusCode: number, durationSec: number): void {
        const normalizedPath = this.normalizePath(path);
        this.httpRequestsTotal.inc({ method, path: normalizedPath, status_code: String(statusCode) });
        this.httpRequestDuration.observe({ method, path: normalizedPath, status_code: String(statusCode) }, durationSec);
    }

    recordHttpRequestSize(method: string, path: string, bytes: number): void {
        const normalizedPath = this.normalizePath(path);
        this.httpRequestSize.observe({ method, path: normalizedPath }, bytes);
    }

    recordHttpResponseSize(method: string, path: string, statusCode: number, bytes: number): void {
        const normalizedPath = this.normalizePath(path);
        this.httpResponseSize.observe({ method, path: normalizedPath, status_code: String(statusCode) }, bytes);
    }

    // =========================================================================
    // WebSocket Metrics
    // =========================================================================

    setWsConnections(type: string, count: number): void {
        this.wsConnectionsCurrent.set({ type }, count);
    }

    incWsConnections(type: string): void {
        this.wsConnectionsCurrent.inc({ type });
    }

    decWsConnections(type: string): void {
        this.wsConnectionsCurrent.dec({ type });
    }

    recordWsMessage(direction: 'inbound' | 'outbound', type: string): void {
        this.wsMessagesTotal.inc({ direction, type });
    }

    // =========================================================================
    // Trust Score Metrics
    // =========================================================================

    recordTrustScoreChange(
        direction: 'increase' | 'decrease',
        eventType: string,
        orgId: string
    ): void {
        this.trustScoreChangesTotal.inc({ direction, event_type: eventType, org_id: orgId });
    }

    setTrustScore(agentId: string, orgId: string, score: number): void {
        this.trustScoreCurrent.set({ agent_id: agentId, org_id: orgId }, score);
    }

    recordTierChange(fromTier: string, toTier: string, orgId: string): void {
        this.trustTierChangesTotal.inc({ from_tier: fromTier, to_tier: toTier, org_id: orgId });
    }

    // =========================================================================
    // Decision Metrics
    // =========================================================================

    recordDecisionProcessed(
        type: string,
        outcome: string,
        source: string,
        orgId: string
    ): void {
        this.decisionsProcessedTotal.inc({
            type,
            outcome,
            source,
            org_id: orgId,
        });
    }

    recordDecisionDuration(type: string, source: string, durationSec: number): void {
        this.decisionDuration.observe({ type, source }, durationSec);
    }

    setDecisionQueueDepth(urgency: string, orgId: string, depth: number): void {
        this.decisionQueueDepth.set({ urgency, org_id: orgId }, depth);
    }

    // =========================================================================
    // Agent Metrics
    // =========================================================================

    setAgentsConnected(status: string, orgId: string, count: number): void {
        this.agentsConnected.set({ status, org_id: orgId }, count);
    }

    recordHeartbeatLatency(agentId: string, latencySec: number): void {
        this.agentHeartbeatLatency.observe({ agent_id: agentId }, latencySec);
    }

    // =========================================================================
    // Registry Access
    // =========================================================================

    getRegistry(): promClient.Registry {
        return this.registry;
    }

    async getMetrics(): Promise<string> {
        return this.registry.metrics();
    }

    getContentType(): string {
        return this.registry.contentType;
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private normalizePath(path: string): string {
        // Normalize paths with IDs to reduce cardinality
        // /api/v1/agents/abc123 -> /api/v1/agents/:id
        // /api/v1/decisions/dec_456/approve -> /api/v1/decisions/:id/approve
        return path
            .replace(/\/[a-f0-9-]{36}/gi, '/:uuid')
            .replace(/\/[a-z]+_[a-zA-Z0-9]+/g, '/:id')
            .replace(/\/\d+/g, '/:id')
            .replace(/\/org_[a-zA-Z0-9]+/g, '/:orgId')
            .replace(/\/agent_[a-zA-Z0-9]+/g, '/:agentId');
    }

    shouldExcludePath(path: string): boolean {
        return this.config.excludePaths?.some(p => path.startsWith(p)) || false;
    }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let metricsRegistry: MetricsRegistry | null = null;

export function getMetricsRegistry(config?: MetricsConfig): MetricsRegistry {
    if (!metricsRegistry) {
        metricsRegistry = new MetricsRegistry(config);
        metricsRegistry.initialize();
    }
    return metricsRegistry;
}

export function resetMetricsRegistry(): void {
    metricsRegistry = null;
}

// ============================================================================
// Metrics Middleware
// ============================================================================

export function metricsMiddleware(config?: MetricsConfig) {
    const registry = getMetricsRegistry(config);

    return async (c: Context, next: Next) => {
        const path = c.req.path;

        // Skip excluded paths
        if (registry.shouldExcludePath(path)) {
            await next();
            return;
        }

        const startTime = process.hrtime.bigint();
        const method = c.req.method;

        // Record request size if available
        const contentLength = c.req.header('content-length');
        if (contentLength) {
            registry.recordHttpRequestSize(method, path, parseInt(contentLength, 10));
        }

        try {
            await next();
        } finally {
            // Calculate duration
            const endTime = process.hrtime.bigint();
            const durationNs = Number(endTime - startTime);
            const durationSec = durationNs / 1e9;

            const statusCode = c.res.status;

            // Record HTTP metrics
            registry.recordHttpRequest(method, path, statusCode, durationSec);

            // Record response size if available
            const responseLength = c.res.headers.get('content-length');
            if (responseLength) {
                registry.recordHttpResponseSize(method, path, statusCode, parseInt(responseLength, 10));
            }
        }
    };
}

// ============================================================================
// Metrics Endpoint Handler
// ============================================================================

export async function metricsHandler(c: Context) {
    const registry = getMetricsRegistry();
    const metrics = await registry.getMetrics();
    return c.text(metrics, 200, {
        'Content-Type': registry.getContentType(),
    });
}

// ============================================================================
// Convenience Functions
// ============================================================================

export const metrics = {
    http: {
        record: (method: string, path: string, statusCode: number, durationSec: number) =>
            getMetricsRegistry().recordHttpRequest(method, path, statusCode, durationSec),
    },
    websocket: {
        setConnections: (type: string, count: number) =>
            getMetricsRegistry().setWsConnections(type, count),
        incConnections: (type: string) =>
            getMetricsRegistry().incWsConnections(type),
        decConnections: (type: string) =>
            getMetricsRegistry().decWsConnections(type),
        recordMessage: (direction: 'inbound' | 'outbound', type: string) =>
            getMetricsRegistry().recordWsMessage(direction, type),
    },
    trust: {
        recordChange: (direction: 'increase' | 'decrease', eventType: string, orgId: string) =>
            getMetricsRegistry().recordTrustScoreChange(direction, eventType, orgId),
        setScore: (agentId: string, orgId: string, score: number) =>
            getMetricsRegistry().setTrustScore(agentId, orgId, score),
        recordTierChange: (fromTier: string, toTier: string, orgId: string) =>
            getMetricsRegistry().recordTierChange(fromTier, toTier, orgId),
    },
    decisions: {
        recordProcessed: (type: string, outcome: string, source: string, orgId: string) =>
            getMetricsRegistry().recordDecisionProcessed(type, outcome, source, orgId),
        recordDuration: (type: string, source: string, durationSec: number) =>
            getMetricsRegistry().recordDecisionDuration(type, source, durationSec),
        setQueueDepth: (urgency: string, orgId: string, depth: number) =>
            getMetricsRegistry().setDecisionQueueDepth(urgency, orgId, depth),
    },
    agents: {
        setConnected: (status: string, orgId: string, count: number) =>
            getMetricsRegistry().setAgentsConnected(status, orgId, count),
        recordHeartbeatLatency: (agentId: string, latencySec: number) =>
            getMetricsRegistry().recordHeartbeatLatency(agentId, latencySec),
    },
};

export default metricsMiddleware;
