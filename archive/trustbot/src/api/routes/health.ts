/**
 * Health Check Routes
 *
 * Provides Kubernetes-compatible health check endpoints for:
 * - /health - General system health with detailed info
 * - /ready  - Readiness probe (checks dependencies like DB)
 * - /live   - Liveness probe (simple process check)
 *
 * Epic 9: Production Hardening
 * Story 9.1: Health Check Endpoints
 * FR56: Health check endpoints for liveness and readiness probes
 */

import { Hono } from 'hono';
import v8 from 'v8';

// ============================================================================
// Types
// ============================================================================

export interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    version: string;
    uptime: number;
    uptimeFormatted: string;
    checks: HealthCheck[];
}

export interface HealthCheck {
    name: string;
    status: 'pass' | 'warn' | 'fail';
    message?: string;
    latencyMs?: number;
    lastChecked?: string;
}

export interface ReadinessStatus {
    ready: boolean;
    timestamp: string;
    checks: HealthCheck[];
}

export interface LivenessStatus {
    alive: boolean;
    timestamp: string;
    pid: number;
    memoryUsageMB: number;
}

// ============================================================================
// State
// ============================================================================

const startTime = Date.now();
let lastDbCheckTime: Date | null = null;
let lastDbCheckStatus: 'pass' | 'fail' = 'pass';
let dbCheckLatencyMs = 0;

// Version from package.json (fallback to env or default)
const VERSION = process.env.npm_package_version || process.env.APP_VERSION || '1.0.0';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format uptime in human-readable format
 */
function formatUptime(uptimeMs: number): string {
    const seconds = Math.floor(uptimeMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
        return `${days}d ${hours % 24}h ${minutes % 60}m`;
    }
    if (hours > 0) {
        return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    }
    if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
}

/**
 * Get memory usage in MB
 */
function getMemoryUsageMB(): number {
    const usage = process.memoryUsage();
    return Math.round(usage.heapUsed / 1024 / 1024);
}

/**
 * Check database connectivity
 */
async function checkDatabase(supabase: any): Promise<HealthCheck> {
    if (!supabase) {
        return {
            name: 'database',
            status: 'warn',
            message: 'Running in file-based mode (no Supabase)',
        };
    }

    const startTime = Date.now();
    try {
        // Simple query to check connectivity
        const { error } = await supabase
            .from('agents')
            .select('id')
            .limit(1);

        const latencyMs = Date.now() - startTime;
        dbCheckLatencyMs = latencyMs;
        lastDbCheckTime = new Date();

        if (error) {
            lastDbCheckStatus = 'fail';
            return {
                name: 'database',
                status: 'fail',
                message: `Database query failed: ${error.message}`,
                latencyMs,
                lastChecked: lastDbCheckTime.toISOString(),
            };
        }

        lastDbCheckStatus = 'pass';

        // Warn if latency is high
        if (latencyMs > 1000) {
            return {
                name: 'database',
                status: 'warn',
                message: `Database responding slowly (${latencyMs}ms)`,
                latencyMs,
                lastChecked: lastDbCheckTime.toISOString(),
            };
        }

        return {
            name: 'database',
            status: 'pass',
            message: 'Connected to Supabase',
            latencyMs,
            lastChecked: lastDbCheckTime.toISOString(),
        };
    } catch (err) {
        const latencyMs = Date.now() - startTime;
        lastDbCheckStatus = 'fail';
        lastDbCheckTime = new Date();

        return {
            name: 'database',
            status: 'fail',
            message: `Database connection error: ${err instanceof Error ? err.message : 'Unknown error'}`,
            latencyMs,
            lastChecked: lastDbCheckTime.toISOString(),
        };
    }
}

/**
 * Check memory usage
 * Uses V8 heap size limit for accurate percentage calculation
 */
function checkMemory(): HealthCheck {
    const usageMB = getMemoryUsageMB();
    // Use V8's actual heap size limit, not the dynamic heapTotal
    const heapStats = v8.getHeapStatistics();
    const maxHeapMB = Math.round(heapStats.heap_size_limit / 1024 / 1024);
    const usagePercent = Math.round((usageMB / maxHeapMB) * 100);

    if (usagePercent > 90) {
        return {
            name: 'memory',
            status: 'fail',
            message: `Critical memory usage: ${usageMB}MB/${maxHeapMB}MB (${usagePercent}%)`,
        };
    }

    if (usagePercent > 75) {
        return {
            name: 'memory',
            status: 'warn',
            message: `High memory usage: ${usageMB}MB/${maxHeapMB}MB (${usagePercent}%)`,
        };
    }

    return {
        name: 'memory',
        status: 'pass',
        message: `Memory usage: ${usageMB}MB/${maxHeapMB}MB (${usagePercent}%)`,
    };
}

/**
 * Check event loop responsiveness
 */
async function checkEventLoop(): Promise<HealthCheck> {
    const start = Date.now();

    return new Promise((resolve) => {
        setImmediate(() => {
            const latencyMs = Date.now() - start;

            if (latencyMs > 100) {
                resolve({
                    name: 'event_loop',
                    status: 'warn',
                    message: `Event loop lag: ${latencyMs}ms`,
                    latencyMs,
                });
            } else {
                resolve({
                    name: 'event_loop',
                    status: 'pass',
                    message: `Event loop responsive (${latencyMs}ms)`,
                    latencyMs,
                });
            }
        });
    });
}

// ============================================================================
// Route Factory
// ============================================================================

export interface HealthRoutesConfig {
    supabase?: any;
    getConnectionCount?: () => number;
    getActiveAgentCount?: () => number;
}

/**
 * Create health check routes
 */
export function createHealthRoutes(config: HealthRoutesConfig = {}): Hono {
    const app = new Hono();
    const { supabase, getConnectionCount, getActiveAgentCount } = config;

    // =========================================================================
    // GET /health - Comprehensive health check
    // =========================================================================
    app.get('/health', async (c) => {
        const uptimeMs = Date.now() - startTime;
        const checks: HealthCheck[] = [];

        // Run all health checks
        const [dbCheck, eventLoopCheck] = await Promise.all([
            checkDatabase(supabase),
            checkEventLoop(),
        ]);

        checks.push(dbCheck);
        checks.push(checkMemory());
        checks.push(eventLoopCheck);

        // Add connection count if available
        if (getConnectionCount) {
            const count = getConnectionCount();
            checks.push({
                name: 'websocket_connections',
                status: 'pass',
                message: `${count} active connections`,
            });
        }

        // Add active agent count if available
        if (getActiveAgentCount) {
            const count = getActiveAgentCount();
            checks.push({
                name: 'active_agents',
                status: 'pass',
                message: `${count} agents online`,
            });
        }

        // Determine overall status
        const hasFailure = checks.some(c => c.status === 'fail');
        const hasWarning = checks.some(c => c.status === 'warn');

        let overallStatus: HealthStatus['status'] = 'healthy';
        if (hasFailure) {
            overallStatus = 'unhealthy';
        } else if (hasWarning) {
            overallStatus = 'degraded';
        }

        const response: HealthStatus = {
            status: overallStatus,
            timestamp: new Date().toISOString(),
            version: VERSION,
            uptime: uptimeMs,
            uptimeFormatted: formatUptime(uptimeMs),
            checks,
        };

        const statusCode = overallStatus === 'unhealthy' ? 503 : 200;
        return c.json(response, statusCode);
    });

    // =========================================================================
    // GET /ready - Kubernetes readiness probe
    // =========================================================================
    app.get('/ready', async (c) => {
        const checks: HealthCheck[] = [];

        // Check database connectivity (required for readiness)
        const dbCheck = await checkDatabase(supabase);
        checks.push(dbCheck);

        // Ready only if database is available
        const ready = dbCheck.status !== 'fail';

        const response: ReadinessStatus = {
            ready,
            timestamp: new Date().toISOString(),
            checks,
        };

        return c.json(response, ready ? 200 : 503);
    });

    // =========================================================================
    // GET /live - Kubernetes liveness probe
    // =========================================================================
    app.get('/live', (c) => {
        // Simple liveness check - if this responds, the process is alive
        const response: LivenessStatus = {
            alive: true,
            timestamp: new Date().toISOString(),
            pid: process.pid,
            memoryUsageMB: getMemoryUsageMB(),
        };

        return c.json(response, 200);
    });

    // =========================================================================
    // GET /health/db - Database-specific health check
    // =========================================================================
    app.get('/health/db', async (c) => {
        const dbCheck = await checkDatabase(supabase);

        return c.json({
            ...dbCheck,
            timestamp: new Date().toISOString(),
        }, dbCheck.status === 'fail' ? 503 : 200);
    });

    return app;
}

// ============================================================================
// Exports
// ============================================================================

export { formatUptime, getMemoryUsageMB };
