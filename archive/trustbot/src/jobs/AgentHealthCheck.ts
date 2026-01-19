/**
 * Agent Health Check Job
 *
 * Epic 10: Agent Connection Layer
 * Story 10.3: Agent Heartbeat System
 *
 * Periodic job that:
 * - Checks agent health states
 * - Reconciles WebSocket connections with heartbeat data
 * - Generates health reports
 * - Triggers alerts for unhealthy agents
 */

import { getHeartbeatMonitor, type AgentHealthState, type AgentHealthStatus } from '../services/HeartbeatMonitor.js';
import { getWebSocketHub } from '../api/ws/index.js';
import { getSupabasePersistence, hasSupabaseConfig } from '../core/SupabasePersistence.js';

// ============================================================================
// Types
// ============================================================================

export interface HealthCheckResult {
    timestamp: Date;
    duration: number;
    stats: {
        total: number;
        online: number;
        degraded: number;
        offline: number;
    };
    issues: HealthIssue[];
    reconciled: number;
}

export interface HealthIssue {
    agentId: string;
    type: 'stale_connection' | 'heartbeat_mismatch' | 'extended_offline' | 'degraded_performance';
    severity: 'low' | 'medium' | 'high';
    message: string;
    lastSeen?: Date;
}

export interface AgentHealthCheckConfig {
    checkInterval: number;           // How often to run the job (ms)
    staleConnectionThreshold: number; // Time before connection is considered stale (ms)
    extendedOfflineThreshold: number; // Time before offline is extended offline (ms)
    enableReconciliation: boolean;    // Whether to reconcile DB with live state
    enableAlerts: boolean;            // Whether to emit alerts
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG: AgentHealthCheckConfig = {
    checkInterval: 60000,            // 1 minute
    staleConnectionThreshold: 120000, // 2 minutes
    extendedOfflineThreshold: 300000, // 5 minutes
    enableReconciliation: true,
    enableAlerts: true,
};

// ============================================================================
// Agent Health Check Job
// ============================================================================

export class AgentHealthCheckJob {
    private timer: NodeJS.Timeout | null = null;
    private isRunning: boolean = false;
    private lastResult: HealthCheckResult | null = null;
    private config: AgentHealthCheckConfig;

    constructor(config: Partial<AgentHealthCheckConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    // -------------------------------------------------------------------------
    // Lifecycle
    // -------------------------------------------------------------------------

    /**
     * Start the health check job
     */
    start(): void {
        if (this.isRunning) return;

        this.isRunning = true;

        // Run immediately, then on interval
        this.runCheck();

        this.timer = setInterval(() => {
            this.runCheck();
        }, this.config.checkInterval);

        console.log('[AgentHealthCheck] Started with interval:', `${this.config.checkInterval / 1000}s`);
    }

    /**
     * Stop the health check job
     */
    stop(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.isRunning = false;
        console.log('[AgentHealthCheck] Stopped');
    }

    /**
     * Check if job is running
     */
    isActive(): boolean {
        return this.isRunning;
    }

    /**
     * Get last check result
     */
    getLastResult(): HealthCheckResult | null {
        return this.lastResult;
    }

    // -------------------------------------------------------------------------
    // Health Check Logic
    // -------------------------------------------------------------------------

    /**
     * Run a health check
     */
    async runCheck(): Promise<HealthCheckResult> {
        const startTime = Date.now();
        const issues: HealthIssue[] = [];
        let reconciled = 0;

        const monitor = getHeartbeatMonitor();
        const hub = getWebSocketHub();

        // Get current states
        const healthStates = monitor.getAllAgentHealth();
        const connectedAgents = new Set(hub.getConnectedAgents());

        // Check for issues
        for (const state of healthStates) {
            const agentIssues = this.checkAgentHealth(state, connectedAgents.has(state.agentId));
            issues.push(...agentIssues);
        }

        // Check for stale connections (connected but no heartbeat)
        for (const agentId of connectedAgents) {
            const state = monitor.getAgentHealth(agentId);
            if (!state) {
                // Connected but not tracked - register it
                monitor.registerAgent(agentId);
                reconciled++;
            }
        }

        // Reconcile with database if enabled
        if (this.config.enableReconciliation) {
            reconciled += await this.reconcileWithDatabase(healthStates);
        }

        // Get final stats
        const stats = monitor.getStats();

        const result: HealthCheckResult = {
            timestamp: new Date(),
            duration: Date.now() - startTime,
            stats: {
                total: stats.total,
                online: stats.online,
                degraded: stats.degraded,
                offline: stats.offline,
            },
            issues,
            reconciled,
        };

        this.lastResult = result;

        // Log summary
        if (issues.length > 0) {
            console.log(`[AgentHealthCheck] Completed: ${stats.online}/${stats.total} online, ${issues.length} issues`);
        }

        // Emit alerts for high severity issues
        if (this.config.enableAlerts) {
            this.emitAlerts(issues);
        }

        return result;
    }

    /**
     * Check individual agent health
     */
    private checkAgentHealth(state: AgentHealthState, isConnected: boolean): HealthIssue[] {
        const issues: HealthIssue[] = [];
        const now = Date.now();

        // Check for heartbeat/connection mismatch
        if (isConnected && state.status === 'offline') {
            issues.push({
                agentId: state.agentId,
                type: 'heartbeat_mismatch',
                severity: 'medium',
                message: 'Agent is connected but marked offline',
                lastSeen: state.lastHeartbeat ?? undefined,
            });
        }

        // Check for stale connection
        if (state.lastHeartbeat) {
            const timeSinceHeartbeat = now - state.lastHeartbeat.getTime();

            if (isConnected && timeSinceHeartbeat > this.config.staleConnectionThreshold) {
                issues.push({
                    agentId: state.agentId,
                    type: 'stale_connection',
                    severity: 'medium',
                    message: `No heartbeat for ${Math.floor(timeSinceHeartbeat / 1000)}s despite active connection`,
                    lastSeen: state.lastHeartbeat,
                });
            }

            // Check for extended offline
            if (state.status === 'offline' && timeSinceHeartbeat > this.config.extendedOfflineThreshold) {
                issues.push({
                    agentId: state.agentId,
                    type: 'extended_offline',
                    severity: 'high',
                    message: `Agent offline for ${Math.floor(timeSinceHeartbeat / 60000)} minutes`,
                    lastSeen: state.lastHeartbeat,
                });
            }
        }

        // Check for degraded performance
        if (state.status === 'degraded') {
            issues.push({
                agentId: state.agentId,
                type: 'degraded_performance',
                severity: 'low',
                message: 'Agent reporting degraded status',
                lastSeen: state.lastHeartbeat ?? undefined,
            });
        }

        return issues;
    }

    /**
     * Reconcile health states with database
     */
    private async reconcileWithDatabase(healthStates: AgentHealthState[]): Promise<number> {
        if (!hasSupabaseConfig()) return 0;

        let reconciled = 0;

        try {
            const supabase = getSupabasePersistence();
            const client = supabase.getClient();

            // Get agents from database
            const { data: dbAgents, error } = await client
                .from('agents')
                .select('id, status, updated_at');

            if (error || !dbAgents) return 0;

            const monitor = getHeartbeatMonitor();

            for (const dbAgent of dbAgents) {
                const memoryState = healthStates.find(s => s.agentId === dbAgent.id);

                if (!memoryState) {
                    // Agent in DB but not in memory - check if recently active
                    const lastUpdate = new Date(dbAgent.updated_at);
                    const isRecent = Date.now() - lastUpdate.getTime() < this.config.staleConnectionThreshold;

                    if (isRecent && dbAgent.status === 'online') {
                        // Recently active, register it
                        monitor.registerAgent(dbAgent.id);
                        reconciled++;
                    }
                } else if (memoryState.status !== dbAgent.status) {
                    // Status mismatch - update DB to match memory (memory is source of truth)
                    await client
                        .from('agents')
                        .update({ status: memoryState.status })
                        .eq('id', dbAgent.id);
                    reconciled++;
                }
            }
        } catch (error) {
            console.error('[AgentHealthCheck] Reconciliation error:', error);
        }

        return reconciled;
    }

    /**
     * Emit alerts for high severity issues
     */
    private emitAlerts(issues: HealthIssue[]): void {
        const highSeverity = issues.filter(i => i.severity === 'high');

        if (highSeverity.length > 0) {
            console.warn(`[AgentHealthCheck] ${highSeverity.length} high severity issues detected:`);
            for (const issue of highSeverity) {
                console.warn(`  - ${issue.agentId}: ${issue.message}`);
            }

            // Broadcast alert via WebSocket
            try {
                const hub = getWebSocketHub();
                hub.broadcast('config:updated', {
                    type: 'health:alert',
                    severity: 'high',
                    issues: highSeverity,
                    timestamp: Date.now(),
                });
            } catch (error) {
                // WebSocket may not be initialized
            }
        }
    }

    // -------------------------------------------------------------------------
    // Manual Triggers
    // -------------------------------------------------------------------------

    /**
     * Force check a specific agent
     */
    async checkAgent(agentId: string): Promise<HealthIssue[]> {
        const monitor = getHeartbeatMonitor();
        const hub = getWebSocketHub();

        const state = monitor.getAgentHealth(agentId);
        if (!state) {
            return [{
                agentId,
                type: 'extended_offline',
                severity: 'medium',
                message: 'Agent not found in health monitor',
            }];
        }

        return this.checkAgentHealth(state, hub.isAgentConnected(agentId));
    }

    /**
     * Get health report
     */
    async getHealthReport(): Promise<{
        summary: HealthCheckResult['stats'];
        agents: Array<AgentHealthState & { issues: HealthIssue[] }>;
    }> {
        const result = await this.runCheck();
        const monitor = getHeartbeatMonitor();
        const hub = getWebSocketHub();

        const agents = monitor.getAllAgentHealth().map(state => ({
            ...state,
            issues: this.checkAgentHealth(state, hub.isAgentConnected(state.agentId)),
        }));

        return {
            summary: result.stats,
            agents,
        };
    }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let jobInstance: AgentHealthCheckJob | null = null;

export function getAgentHealthCheckJob(config?: Partial<AgentHealthCheckConfig>): AgentHealthCheckJob {
    if (!jobInstance) {
        jobInstance = new AgentHealthCheckJob(config);
    }
    return jobInstance;
}

export function resetAgentHealthCheckJob(): void {
    if (jobInstance) {
        jobInstance.stop();
        jobInstance = null;
    }
}
