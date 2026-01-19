/**
 * Heartbeat Monitor Service
 *
 * Epic 10: Agent Connection Layer
 * Story 10.3: Agent Heartbeat System
 *
 * Tracks agent health through heartbeat signals:
 * - 30-second heartbeat interval
 * - 3 missed heartbeats → OFFLINE
 * - Status change notifications via WebSocket
 * - Last seen timestamp tracking
 */

import { EventEmitter } from 'eventemitter3';
import { getWebSocketHub } from '../api/ws/index.js';
import { getSupabasePersistence, hasSupabaseConfig } from '../core/SupabasePersistence.js';

// ============================================================================
// Types
// ============================================================================

export type AgentHealthStatus = 'online' | 'degraded' | 'offline' | 'unknown';

export interface AgentHeartbeat {
    agentId: string;
    timestamp: Date;
    status: 'healthy' | 'degraded' | 'unhealthy';
    metrics?: {
        cpuUsage?: number;
        memoryUsage?: number;
        taskQueue?: number;
        responseTime?: number;
    };
}

export interface AgentHealthState {
    agentId: string;
    status: AgentHealthStatus;
    lastHeartbeat: Date | null;
    missedHeartbeats: number;
    consecutiveHealthy: number;
    lastStatusChange: Date;
    metrics?: AgentHeartbeat['metrics'];
}

export interface HeartbeatMonitorConfig {
    heartbeatInterval: number;      // Expected interval between heartbeats (ms)
    missedThreshold: number;        // Number of missed heartbeats before OFFLINE
    degradedThreshold: number;      // Number of missed heartbeats before DEGRADED
    checkInterval: number;          // How often to check for stale heartbeats (ms)
    recoveryThreshold: number;      // Consecutive healthy heartbeats for recovery
}

interface MonitorEvents {
    'status:changed': (agentId: string, oldStatus: AgentHealthStatus, newStatus: AgentHealthStatus) => void;
    'heartbeat:received': (heartbeat: AgentHeartbeat) => void;
    'heartbeat:missed': (agentId: string, missedCount: number) => void;
    'agent:online': (agentId: string) => void;
    'agent:offline': (agentId: string) => void;
    'agent:degraded': (agentId: string) => void;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG: HeartbeatMonitorConfig = {
    heartbeatInterval: 30000,    // 30 seconds
    missedThreshold: 3,          // 3 missed = offline (90 seconds)
    degradedThreshold: 1,        // 1 missed = degraded (30-60 seconds)
    checkInterval: 10000,        // Check every 10 seconds
    recoveryThreshold: 2,        // 2 healthy heartbeats to recover
};

// ============================================================================
// Heartbeat Monitor Service
// ============================================================================

export class HeartbeatMonitor extends EventEmitter<MonitorEvents> {
    private agentStates: Map<string, AgentHealthState> = new Map();
    private checkTimer: NodeJS.Timeout | null = null;
    private config: HeartbeatMonitorConfig;
    private isRunning: boolean = false;

    constructor(config: Partial<HeartbeatMonitorConfig> = {}) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    // -------------------------------------------------------------------------
    // Lifecycle
    // -------------------------------------------------------------------------

    /**
     * Start the heartbeat monitor
     */
    start(): void {
        if (this.isRunning) return;

        this.isRunning = true;
        this.checkTimer = setInterval(() => {
            this.checkHeartbeats();
        }, this.config.checkInterval);

        console.log('[HeartbeatMonitor] Started with config:', {
            heartbeatInterval: `${this.config.heartbeatInterval / 1000}s`,
            missedThreshold: this.config.missedThreshold,
            checkInterval: `${this.config.checkInterval / 1000}s`,
        });
    }

    /**
     * Stop the heartbeat monitor
     */
    stop(): void {
        if (this.checkTimer) {
            clearInterval(this.checkTimer);
            this.checkTimer = null;
        }
        this.isRunning = false;
        console.log('[HeartbeatMonitor] Stopped');
    }

    /**
     * Check if monitor is running
     */
    isActive(): boolean {
        return this.isRunning;
    }

    // -------------------------------------------------------------------------
    // Heartbeat Processing
    // -------------------------------------------------------------------------

    /**
     * Record a heartbeat from an agent
     */
    recordHeartbeat(heartbeat: AgentHeartbeat): void {
        const { agentId, timestamp, status, metrics } = heartbeat;

        let state = this.agentStates.get(agentId);
        const previousStatus = state?.status ?? 'unknown';

        if (!state) {
            // New agent
            state = {
                agentId,
                status: 'online',
                lastHeartbeat: timestamp,
                missedHeartbeats: 0,
                consecutiveHealthy: 1,
                lastStatusChange: timestamp,
                metrics,
            };
            this.agentStates.set(agentId, state);
            this.emit('agent:online', agentId);
            this.emit('status:changed', agentId, 'unknown', 'online');
            this.notifyStatusChange(agentId, 'unknown', 'online');
        } else {
            // Update existing agent
            state.lastHeartbeat = timestamp;
            state.metrics = metrics;

            // Track healthy heartbeats for recovery
            if (status === 'healthy') {
                state.consecutiveHealthy++;
            } else {
                state.consecutiveHealthy = 0;
            }

            // Reset missed count on heartbeat
            state.missedHeartbeats = 0;

            // Recover from degraded/offline if enough healthy heartbeats
            if (state.status !== 'online' && state.consecutiveHealthy >= this.config.recoveryThreshold) {
                this.updateAgentStatus(agentId, 'online');
            }
        }

        this.emit('heartbeat:received', heartbeat);

        // Persist to database
        this.persistHeartbeat(agentId, timestamp);
    }

    /**
     * Register an agent (called on WebSocket connection)
     */
    registerAgent(agentId: string): void {
        if (!this.agentStates.has(agentId)) {
            const now = new Date();
            this.agentStates.set(agentId, {
                agentId,
                status: 'online',
                lastHeartbeat: now,
                missedHeartbeats: 0,
                consecutiveHealthy: 0,
                lastStatusChange: now,
            });
            this.emit('agent:online', agentId);
            this.emit('status:changed', agentId, 'unknown', 'online');
            this.notifyStatusChange(agentId, 'unknown', 'online');
        }
    }

    /**
     * Unregister an agent (called on WebSocket disconnection)
     */
    unregisterAgent(agentId: string): void {
        const state = this.agentStates.get(agentId);
        if (state && state.status !== 'offline') {
            this.updateAgentStatus(agentId, 'offline');
        }
    }

    // -------------------------------------------------------------------------
    // Health Checking
    // -------------------------------------------------------------------------

    /**
     * Check all agents for missed heartbeats
     */
    private checkHeartbeats(): void {
        const now = Date.now();

        for (const [agentId, state] of this.agentStates) {
            if (!state.lastHeartbeat) continue;

            const timeSinceLastHeartbeat = now - state.lastHeartbeat.getTime();
            const expectedHeartbeats = Math.floor(timeSinceLastHeartbeat / this.config.heartbeatInterval);

            if (expectedHeartbeats > state.missedHeartbeats) {
                state.missedHeartbeats = expectedHeartbeats;
                state.consecutiveHealthy = 0;

                this.emit('heartbeat:missed', agentId, state.missedHeartbeats);

                // Update status based on missed count
                if (state.missedHeartbeats >= this.config.missedThreshold && state.status !== 'offline') {
                    this.updateAgentStatus(agentId, 'offline');
                } else if (state.missedHeartbeats >= this.config.degradedThreshold && state.status === 'online') {
                    this.updateAgentStatus(agentId, 'degraded');
                }
            }
        }
    }

    /**
     * Update agent status and emit events
     */
    private updateAgentStatus(agentId: string, newStatus: AgentHealthStatus): void {
        const state = this.agentStates.get(agentId);
        if (!state) return;

        const oldStatus = state.status;
        if (oldStatus === newStatus) return;

        state.status = newStatus;
        state.lastStatusChange = new Date();

        this.emit('status:changed', agentId, oldStatus, newStatus);

        if (newStatus === 'online') {
            this.emit('agent:online', agentId);
        } else if (newStatus === 'offline') {
            this.emit('agent:offline', agentId);
        } else if (newStatus === 'degraded') {
            this.emit('agent:degraded', agentId);
        }

        // Notify via WebSocket and persist
        this.notifyStatusChange(agentId, oldStatus, newStatus);
        this.persistStatusChange(agentId, newStatus);
    }

    // -------------------------------------------------------------------------
    // Notifications
    // -------------------------------------------------------------------------

    /**
     * Broadcast status change via WebSocket
     */
    private notifyStatusChange(agentId: string, oldStatus: AgentHealthStatus, newStatus: AgentHealthStatus): void {
        try {
            const hub = getWebSocketHub();
            hub.broadcast('config:updated', {
                type: 'agent:status_changed',
                agentId,
                oldStatus,
                newStatus,
                timestamp: Date.now(),
            });
        } catch (error) {
            // WebSocket hub may not be initialized
        }
    }

    // -------------------------------------------------------------------------
    // Persistence
    // -------------------------------------------------------------------------

    /**
     * Persist heartbeat timestamp to database
     */
    private async persistHeartbeat(agentId: string, timestamp: Date): Promise<void> {
        if (!hasSupabaseConfig()) return;

        try {
            const supabase = getSupabasePersistence();
            const client = supabase.getClient();

            await client
                .from('agents')
                .update({
                    updated_at: timestamp.toISOString(),
                    status: 'online',
                })
                .eq('id', agentId);
        } catch (error) {
            console.error('[HeartbeatMonitor] Failed to persist heartbeat:', error);
        }
    }

    /**
     * Persist status change to database
     */
    private async persistStatusChange(agentId: string, status: AgentHealthStatus): Promise<void> {
        if (!hasSupabaseConfig()) return;

        try {
            const supabase = getSupabasePersistence();
            const client = supabase.getClient();

            await client
                .from('agents')
                .update({
                    status,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', agentId);
        } catch (error) {
            console.error('[HeartbeatMonitor] Failed to persist status:', error);
        }
    }

    // -------------------------------------------------------------------------
    // Queries
    // -------------------------------------------------------------------------

    /**
     * Get health state for an agent
     */
    getAgentHealth(agentId: string): AgentHealthState | null {
        return this.agentStates.get(agentId) ?? null;
    }

    /**
     * Get all agent health states
     */
    getAllAgentHealth(): AgentHealthState[] {
        return Array.from(this.agentStates.values());
    }

    /**
     * Get agents by status
     */
    getAgentsByStatus(status: AgentHealthStatus): AgentHealthState[] {
        return Array.from(this.agentStates.values())
            .filter(state => state.status === status);
    }

    /**
     * Get online agent count
     */
    getOnlineCount(): number {
        return this.getAgentsByStatus('online').length;
    }

    /**
     * Get offline agent count
     */
    getOfflineCount(): number {
        return this.getAgentsByStatus('offline').length;
    }

    /**
     * Get summary statistics
     */
    getStats(): {
        total: number;
        online: number;
        degraded: number;
        offline: number;
        unknown: number;
    } {
        const states = Array.from(this.agentStates.values());
        return {
            total: states.length,
            online: states.filter(s => s.status === 'online').length,
            degraded: states.filter(s => s.status === 'degraded').length,
            offline: states.filter(s => s.status === 'offline').length,
            unknown: states.filter(s => s.status === 'unknown').length,
        };
    }

    /**
     * Check if agent is online
     */
    isAgentOnline(agentId: string): boolean {
        const state = this.agentStates.get(agentId);
        return state?.status === 'online';
    }

    /**
     * Get last seen timestamp
     */
    getLastSeen(agentId: string): Date | null {
        return this.agentStates.get(agentId)?.lastHeartbeat ?? null;
    }

    /**
     * Clear all agent states (for testing)
     */
    clear(): void {
        this.agentStates.clear();
    }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let monitorInstance: HeartbeatMonitor | null = null;

export function getHeartbeatMonitor(config?: Partial<HeartbeatMonitorConfig>): HeartbeatMonitor {
    if (!monitorInstance) {
        monitorInstance = new HeartbeatMonitor(config);
    }
    return monitorInstance;
}

export function resetHeartbeatMonitor(): void {
    if (monitorInstance) {
        monitorInstance.stop();
        monitorInstance = null;
    }
}
