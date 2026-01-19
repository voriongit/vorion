/**
 * Connection Pool Manager
 *
 * Epic 10: Agent Connection Layer
 * Story 10.6: Connection Pool Management
 *
 * Provides efficient connection management for scaling to 1000+ concurrent agents:
 * - Global and per-org connection limits
 * - Connection storm protection with rate limiting
 * - Memory-efficient connection tracking
 * - Connection lifecycle management
 */

import { EventEmitter } from 'eventemitter3';

// ============================================================================
// Types
// ============================================================================

export interface ConnectionInfo {
    connectionId: string;
    agentId: string;
    orgId: string;
    connectedAt: Date;
    lastActivityAt: Date;
    remoteAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
}

export interface ConnectionPoolConfig {
    /** Maximum total connections across all orgs (default: 10000) */
    maxConnections: number;
    /** Maximum connections per organization (default: 500) */
    maxConnectionsPerOrg: number;
    /** Maximum connections per agent (default: 3) */
    maxConnectionsPerAgent: number;
    /** Connection rate limit per org (connections per second, default: 50) */
    connectionRateLimitPerOrg: number;
    /** Global connection rate limit (connections per second, default: 200) */
    connectionRateLimitGlobal: number;
    /** Rate limit window in ms (default: 1000) */
    rateLimitWindowMs: number;
    /** Idle connection timeout in ms (default: 5 minutes) */
    idleTimeoutMs: number;
    /** Enable connection storm protection (default: true) */
    stormProtection: boolean;
    /** Storm detection threshold (connections in window, default: 100) */
    stormThreshold: number;
    /** Storm cooldown period in ms (default: 10 seconds) */
    stormCooldownMs: number;
}

export interface ConnectionPoolStats {
    totalConnections: number;
    connectionsByOrg: Map<string, number>;
    connectionsByAgent: Map<string, number>;
    connectionsPerSecond: number;
    peakConnections: number;
    totalConnectionsServed: number;
    rejectedConnections: number;
    stormEvents: number;
    isInStormMode: boolean;
}

export interface ConnectionResult {
    allowed: boolean;
    connectionId?: string;
    reason?: ConnectionRejectionReason;
}

export type ConnectionRejectionReason =
    | 'max_connections_reached'
    | 'max_org_connections_reached'
    | 'max_agent_connections_reached'
    | 'rate_limit_exceeded'
    | 'org_rate_limit_exceeded'
    | 'storm_protection_active'
    | 'pool_shutting_down';

interface PoolEvents {
    'connection:added': (info: ConnectionInfo) => void;
    'connection:removed': (connectionId: string, agentId: string, reason: string) => void;
    'connection:rejected': (agentId: string, orgId: string, reason: ConnectionRejectionReason) => void;
    'limit:approaching': (type: 'global' | 'org', current: number, max: number, orgId?: string) => void;
    'storm:detected': (connectionsInWindow: number) => void;
    'storm:cleared': () => void;
    'stats:updated': (stats: ConnectionPoolStats) => void;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG: ConnectionPoolConfig = {
    maxConnections: 10000,
    maxConnectionsPerOrg: 500,
    maxConnectionsPerAgent: 3,
    connectionRateLimitPerOrg: 50,
    connectionRateLimitGlobal: 200,
    rateLimitWindowMs: 1000,
    idleTimeoutMs: 5 * 60 * 1000, // 5 minutes
    stormProtection: true,
    stormThreshold: 100,
    stormCooldownMs: 10 * 1000, // 10 seconds
};

// ============================================================================
// Connection Pool Manager
// ============================================================================

export class ConnectionPool extends EventEmitter<PoolEvents> {
    private config: ConnectionPoolConfig;

    // Connection tracking (memory-efficient maps)
    private connections: Map<string, ConnectionInfo> = new Map(); // connectionId -> info
    private agentConnections: Map<string, Set<string>> = new Map(); // agentId -> Set<connectionId>
    private orgConnections: Map<string, Set<string>> = new Map(); // orgId -> Set<connectionId>

    // Rate limiting
    private globalRateWindow: number[] = []; // timestamps
    private orgRateWindows: Map<string, number[]> = new Map(); // orgId -> timestamps

    // Storm protection
    private isInStormMode = false;
    private stormCooldownTimer: ReturnType<typeof setTimeout> | null = null;
    private recentConnectionTimestamps: number[] = [];

    // Stats tracking
    private peakConnections = 0;
    private totalConnectionsServed = 0;
    private rejectedConnections = 0;
    private stormEvents = 0;

    // Lifecycle
    private isShuttingDown = false;
    private idleCheckTimer: ReturnType<typeof setInterval> | null = null;

    constructor(config: Partial<ConnectionPoolConfig> = {}) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    // =========================================================================
    // Connection Management
    // =========================================================================

    /**
     * Request a new connection
     */
    requestConnection(
        agentId: string,
        orgId: string,
        metadata?: Partial<Pick<ConnectionInfo, 'remoteAddress' | 'userAgent' | 'metadata'>>
    ): ConnectionResult {
        if (this.isShuttingDown) {
            this.rejectConnection(agentId, orgId, 'pool_shutting_down');
            return { allowed: false, reason: 'pool_shutting_down' };
        }

        // Check storm protection
        if (this.config.stormProtection && this.isInStormMode) {
            this.rejectConnection(agentId, orgId, 'storm_protection_active');
            return { allowed: false, reason: 'storm_protection_active' };
        }

        // Check global limit
        if (this.connections.size >= this.config.maxConnections) {
            this.rejectConnection(agentId, orgId, 'max_connections_reached');
            return { allowed: false, reason: 'max_connections_reached' };
        }

        // Check org limit
        const orgConnectionCount = this.orgConnections.get(orgId)?.size ?? 0;
        if (orgConnectionCount >= this.config.maxConnectionsPerOrg) {
            this.rejectConnection(agentId, orgId, 'max_org_connections_reached');
            return { allowed: false, reason: 'max_org_connections_reached' };
        }

        // Check agent limit
        const agentConnectionCount = this.agentConnections.get(agentId)?.size ?? 0;
        if (agentConnectionCount >= this.config.maxConnectionsPerAgent) {
            this.rejectConnection(agentId, orgId, 'max_agent_connections_reached');
            return { allowed: false, reason: 'max_agent_connections_reached' };
        }

        // Check global rate limit
        if (!this.checkGlobalRateLimit()) {
            this.rejectConnection(agentId, orgId, 'rate_limit_exceeded');
            return { allowed: false, reason: 'rate_limit_exceeded' };
        }

        // Check org rate limit
        if (!this.checkOrgRateLimit(orgId)) {
            this.rejectConnection(agentId, orgId, 'org_rate_limit_exceeded');
            return { allowed: false, reason: 'org_rate_limit_exceeded' };
        }

        // Check for storm
        if (this.config.stormProtection) {
            this.checkForStorm();
            if (this.isInStormMode) {
                this.rejectConnection(agentId, orgId, 'storm_protection_active');
                return { allowed: false, reason: 'storm_protection_active' };
            }
        }

        // Create connection
        const connectionId = this.generateConnectionId();
        const now = new Date();

        const connectionInfo: ConnectionInfo = {
            connectionId,
            agentId,
            orgId,
            connectedAt: now,
            lastActivityAt: now,
            remoteAddress: metadata?.remoteAddress,
            userAgent: metadata?.userAgent,
            metadata: metadata?.metadata,
        };

        // Track connection
        this.connections.set(connectionId, connectionInfo);

        // Track by agent
        if (!this.agentConnections.has(agentId)) {
            this.agentConnections.set(agentId, new Set());
        }
        this.agentConnections.get(agentId)!.add(connectionId);

        // Track by org
        if (!this.orgConnections.has(orgId)) {
            this.orgConnections.set(orgId, new Set());
        }
        this.orgConnections.get(orgId)!.add(connectionId);

        // Update stats
        this.totalConnectionsServed++;
        if (this.connections.size > this.peakConnections) {
            this.peakConnections = this.connections.size;
        }

        // Record for rate limiting
        this.recordConnectionTimestamp(orgId);

        // Emit events
        this.emit('connection:added', connectionInfo);
        this.checkLimitWarnings(orgId);

        return { allowed: true, connectionId };
    }

    /**
     * Release a connection
     */
    releaseConnection(connectionId: string, reason: string = 'normal_close'): boolean {
        const info = this.connections.get(connectionId);
        if (!info) {
            return false;
        }

        // Remove from all tracking maps
        this.connections.delete(connectionId);

        const agentConns = this.agentConnections.get(info.agentId);
        if (agentConns) {
            agentConns.delete(connectionId);
            if (agentConns.size === 0) {
                this.agentConnections.delete(info.agentId);
            }
        }

        const orgConns = this.orgConnections.get(info.orgId);
        if (orgConns) {
            orgConns.delete(connectionId);
            if (orgConns.size === 0) {
                this.orgConnections.delete(info.orgId);
            }
        }

        this.emit('connection:removed', connectionId, info.agentId, reason);

        return true;
    }

    /**
     * Update connection activity timestamp
     */
    touchConnection(connectionId: string): boolean {
        const info = this.connections.get(connectionId);
        if (!info) {
            return false;
        }

        info.lastActivityAt = new Date();
        return true;
    }

    /**
     * Get connection info
     */
    getConnection(connectionId: string): ConnectionInfo | null {
        return this.connections.get(connectionId) ?? null;
    }

    /**
     * Get all connections for an agent
     */
    getAgentConnections(agentId: string): ConnectionInfo[] {
        const connectionIds = this.agentConnections.get(agentId);
        if (!connectionIds) return [];

        return Array.from(connectionIds)
            .map(id => this.connections.get(id))
            .filter((c): c is ConnectionInfo => c !== undefined);
    }

    /**
     * Get all connections for an organization
     */
    getOrgConnections(orgId: string): ConnectionInfo[] {
        const connectionIds = this.orgConnections.get(orgId);
        if (!connectionIds) return [];

        return Array.from(connectionIds)
            .map(id => this.connections.get(id))
            .filter((c): c is ConnectionInfo => c !== undefined);
    }

    /**
     * Disconnect all connections for an agent
     */
    disconnectAgent(agentId: string, reason: string = 'agent_disconnected'): number {
        const connectionIds = this.agentConnections.get(agentId);
        if (!connectionIds) return 0;

        let count = 0;
        for (const connectionId of Array.from(connectionIds)) {
            if (this.releaseConnection(connectionId, reason)) {
                count++;
            }
        }

        return count;
    }

    /**
     * Disconnect all connections for an organization
     */
    disconnectOrg(orgId: string, reason: string = 'org_disconnected'): number {
        const connectionIds = this.orgConnections.get(orgId);
        if (!connectionIds) return 0;

        let count = 0;
        for (const connectionId of Array.from(connectionIds)) {
            if (this.releaseConnection(connectionId, reason)) {
                count++;
            }
        }

        return count;
    }

    // =========================================================================
    // Rate Limiting
    // =========================================================================

    private checkGlobalRateLimit(): boolean {
        const now = Date.now();
        const windowStart = now - this.config.rateLimitWindowMs;

        // Clean old entries
        this.globalRateWindow = this.globalRateWindow.filter(t => t > windowStart);

        return this.globalRateWindow.length < this.config.connectionRateLimitGlobal;
    }

    private checkOrgRateLimit(orgId: string): boolean {
        const now = Date.now();
        const windowStart = now - this.config.rateLimitWindowMs;

        let orgWindow = this.orgRateWindows.get(orgId);
        if (!orgWindow) {
            orgWindow = [];
            this.orgRateWindows.set(orgId, orgWindow);
        }

        // Clean old entries
        const filtered = orgWindow.filter(t => t > windowStart);
        this.orgRateWindows.set(orgId, filtered);

        return filtered.length < this.config.connectionRateLimitPerOrg;
    }

    private recordConnectionTimestamp(orgId: string): void {
        const now = Date.now();

        // Global tracking
        this.globalRateWindow.push(now);

        // Org tracking
        let orgWindow = this.orgRateWindows.get(orgId);
        if (!orgWindow) {
            orgWindow = [];
            this.orgRateWindows.set(orgId, orgWindow);
        }
        orgWindow.push(now);

        // Storm detection tracking
        this.recentConnectionTimestamps.push(now);
    }

    // =========================================================================
    // Storm Protection
    // =========================================================================

    private checkForStorm(): void {
        const now = Date.now();
        const windowStart = now - this.config.rateLimitWindowMs;

        // Clean old timestamps
        this.recentConnectionTimestamps = this.recentConnectionTimestamps.filter(t => t > windowStart);

        if (this.recentConnectionTimestamps.length >= this.config.stormThreshold) {
            this.activateStormMode();
        }
    }

    private activateStormMode(): void {
        if (this.isInStormMode) return;

        this.isInStormMode = true;
        this.stormEvents++;

        this.emit('storm:detected', this.recentConnectionTimestamps.length);

        // Set cooldown timer
        if (this.stormCooldownTimer) {
            clearTimeout(this.stormCooldownTimer);
        }

        this.stormCooldownTimer = setTimeout(() => {
            this.deactivateStormMode();
        }, this.config.stormCooldownMs);
    }

    private deactivateStormMode(): void {
        if (!this.isInStormMode) return;

        this.isInStormMode = false;
        this.stormCooldownTimer = null;
        this.recentConnectionTimestamps = [];

        this.emit('storm:cleared');
    }

    // =========================================================================
    // Limit Warnings
    // =========================================================================

    private checkLimitWarnings(orgId: string): void {
        // Global limit warning (80% threshold)
        const globalThreshold = this.config.maxConnections * 0.8;
        if (this.connections.size >= globalThreshold) {
            this.emit('limit:approaching', 'global', this.connections.size, this.config.maxConnections);
        }

        // Org limit warning (80% threshold)
        const orgConnCount = this.orgConnections.get(orgId)?.size ?? 0;
        const orgThreshold = this.config.maxConnectionsPerOrg * 0.8;
        if (orgConnCount >= orgThreshold) {
            this.emit('limit:approaching', 'org', orgConnCount, this.config.maxConnectionsPerOrg, orgId);
        }
    }

    private rejectConnection(agentId: string, orgId: string, reason: ConnectionRejectionReason): void {
        this.rejectedConnections++;
        this.emit('connection:rejected', agentId, orgId, reason);
    }

    // =========================================================================
    // Idle Connection Management
    // =========================================================================

    /**
     * Start idle connection cleanup
     */
    startIdleCheck(intervalMs: number = 60000): void {
        this.stopIdleCheck();

        this.idleCheckTimer = setInterval(() => {
            this.cleanupIdleConnections();
        }, intervalMs);
    }

    /**
     * Stop idle connection cleanup
     */
    stopIdleCheck(): void {
        if (this.idleCheckTimer) {
            clearInterval(this.idleCheckTimer);
            this.idleCheckTimer = null;
        }
    }

    /**
     * Cleanup idle connections
     */
    cleanupIdleConnections(): number {
        const now = Date.now();
        const idleThreshold = now - this.config.idleTimeoutMs;
        let cleaned = 0;

        for (const [connectionId, info] of this.connections) {
            if (info.lastActivityAt.getTime() < idleThreshold) {
                if (this.releaseConnection(connectionId, 'idle_timeout')) {
                    cleaned++;
                }
            }
        }

        return cleaned;
    }

    // =========================================================================
    // Stats & Queries
    // =========================================================================

    /**
     * Get pool statistics
     */
    getStats(): ConnectionPoolStats {
        const now = Date.now();
        const windowStart = now - 1000; // Last second

        // Calculate connections per second
        const recentConnections = this.recentConnectionTimestamps.filter(t => t > windowStart);

        const connectionsByOrg = new Map<string, number>();
        for (const [orgId, connSet] of this.orgConnections) {
            connectionsByOrg.set(orgId, connSet.size);
        }

        const connectionsByAgent = new Map<string, number>();
        for (const [agentId, connSet] of this.agentConnections) {
            connectionsByAgent.set(agentId, connSet.size);
        }

        return {
            totalConnections: this.connections.size,
            connectionsByOrg,
            connectionsByAgent,
            connectionsPerSecond: recentConnections.length,
            peakConnections: this.peakConnections,
            totalConnectionsServed: this.totalConnectionsServed,
            rejectedConnections: this.rejectedConnections,
            stormEvents: this.stormEvents,
            isInStormMode: this.isInStormMode,
        };
    }

    /**
     * Get connection count
     */
    getConnectionCount(): number {
        return this.connections.size;
    }

    /**
     * Get connection count for an org
     */
    getOrgConnectionCount(orgId: string): number {
        return this.orgConnections.get(orgId)?.size ?? 0;
    }

    /**
     * Get connection count for an agent
     */
    getAgentConnectionCount(agentId: string): number {
        return this.agentConnections.get(agentId)?.size ?? 0;
    }

    /**
     * Check if pool is at capacity
     */
    isAtCapacity(): boolean {
        return this.connections.size >= this.config.maxConnections;
    }

    /**
     * Check if org is at capacity
     */
    isOrgAtCapacity(orgId: string): boolean {
        return this.getOrgConnectionCount(orgId) >= this.config.maxConnectionsPerOrg;
    }

    // =========================================================================
    // Lifecycle
    // =========================================================================

    /**
     * Shutdown the pool gracefully
     */
    async shutdown(gracePeriodMs: number = 5000): Promise<void> {
        this.isShuttingDown = true;
        this.stopIdleCheck();

        if (this.stormCooldownTimer) {
            clearTimeout(this.stormCooldownTimer);
            this.stormCooldownTimer = null;
        }

        // Wait for grace period
        await new Promise(resolve => setTimeout(resolve, gracePeriodMs));

        // Force disconnect all remaining connections
        for (const connectionId of Array.from(this.connections.keys())) {
            this.releaseConnection(connectionId, 'pool_shutdown');
        }

        this.clear();
    }

    /**
     * Clear all connections and reset state
     */
    clear(): void {
        this.connections.clear();
        this.agentConnections.clear();
        this.orgConnections.clear();
        this.globalRateWindow = [];
        this.orgRateWindows.clear();
        this.recentConnectionTimestamps = [];
        this.isInStormMode = false;
        this.isShuttingDown = false;
    }

    // =========================================================================
    // Utilities
    // =========================================================================

    private generateConnectionId(): string {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 10);
        return `conn_${timestamp}_${random}`;
    }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let poolInstance: ConnectionPool | null = null;

export function getConnectionPool(config?: Partial<ConnectionPoolConfig>): ConnectionPool {
    if (!poolInstance) {
        poolInstance = new ConnectionPool(config);
    }
    return poolInstance;
}

export function resetConnectionPool(): void {
    if (poolInstance) {
        poolInstance.clear();
    }
    poolInstance = null;
}
