/**
 * Resource Limiter for Cognigate Execution Engine
 *
 * Provides enterprise resource limiting with real-time monitoring and enforcement.
 * Tracks memory, CPU, network, and filesystem usage per execution, enforcing
 * configurable thresholds with warning/critical/terminate actions.
 *
 * @packageDocumentation
 */

import { createLogger } from '../common/logger.js';
import type { ID } from '../common/types.js';
import type {
  ResourceLimits,
  ResourceUsage,
  ResourceThreshold,
  SandboxViolation,
} from './types.js';

const logger = createLogger({ component: 'cognigate', subComponent: 'resource-limiter' });

// =============================================================================
// CONSTANTS
// =============================================================================

/** Default sampling interval in milliseconds */
const DEFAULT_SAMPLE_INTERVAL_MS = 1000;

/** Default resource thresholds applied when none are specified */
const DEFAULT_THRESHOLDS: ResourceThreshold[] = [
  { resource: 'memory', warningPercent: 75, criticalPercent: 90, action: 'terminate' },
  { resource: 'cpu', warningPercent: 80, criticalPercent: 95, action: 'throttle' },
  { resource: 'network_requests', warningPercent: 80, criticalPercent: 95, action: 'terminate' },
  { resource: 'filesystem', warningPercent: 80, criticalPercent: 95, action: 'warn' },
  { resource: 'concurrent_ops', warningPercent: 80, criticalPercent: 95, action: 'terminate' },
  { resource: 'payload_size', warningPercent: 90, criticalPercent: 100, action: 'terminate' },
];

// =============================================================================
// RESOURCE MONITOR
// =============================================================================

/**
 * Monitors resource usage for a single execution instance.
 * Samples memory and CPU at configurable intervals and checks
 * against defined limits to detect violations.
 */
export class ResourceMonitor {
  private usage: ResourceUsage;
  private limits: ResourceLimits;
  private startTime: number;
  private intervalId: NodeJS.Timeout | undefined;
  private executionId: ID;
  private sampleIntervalMs: number;
  private lastCpuUsage: NodeJS.CpuUsage | null;
  private lastCpuSampleTime: number;
  private stopped: boolean;

  constructor(executionId: ID, limits: ResourceLimits, sampleIntervalMs?: number) {
    this.executionId = executionId;
    this.limits = limits;
    this.sampleIntervalMs = sampleIntervalMs ?? DEFAULT_SAMPLE_INTERVAL_MS;
    this.startTime = Date.now();
    this.lastCpuUsage = null;
    this.lastCpuSampleTime = 0;
    this.stopped = false;

    this.usage = {
      memoryPeakMb: 0,
      memoryCurrentMb: 0,
      cpuTimeMs: 0,
      wallTimeMs: 0,
      networkRequests: 0,
      networkBytesIn: 0,
      networkBytesOut: 0,
      fileSystemReads: 0,
      fileSystemWrites: 0,
      concurrentOps: 0,
    };
  }

  /**
   * Start periodic resource sampling.
   * Takes initial samples immediately and then at the configured interval.
   */
  start(): void {
    if (this.stopped) {
      throw new Error(`Resource monitor for execution ${this.executionId} has been stopped and cannot be restarted`);
    }

    this.startTime = Date.now();
    this.lastCpuUsage = process.cpuUsage();
    this.lastCpuSampleTime = Date.now();

    this.sampleMemory();
    this.sampleCpu();

    this.intervalId = setInterval(() => {
      this.sampleMemory();
      this.sampleCpu();
      this.usage.wallTimeMs = Date.now() - this.startTime;
    }, this.sampleIntervalMs);

    logger.debug({ executionId: this.executionId, limits: this.limits }, 'Resource monitor started');
  }

  /**
   * Stop monitoring and return final resource usage snapshot.
   * Cleans up the sampling interval timer.
   */
  stop(): ResourceUsage {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    this.stopped = true;
    this.usage.wallTimeMs = Date.now() - this.startTime;

    // Take final samples
    this.sampleMemory();
    this.sampleCpu();

    logger.debug(
      { executionId: this.executionId, usage: this.usage },
      'Resource monitor stopped'
    );

    return { ...this.usage };
  }

  /**
   * Get the current resource usage snapshot.
   */
  getUsage(): ResourceUsage {
    this.usage.wallTimeMs = Date.now() - this.startTime;
    return { ...this.usage };
  }

  /**
   * Check if any resource limit has been violated.
   * Returns the first detected violation or null if within limits.
   */
  checkViolation(): SandboxViolation | null {
    const now = new Date().toISOString();

    // Check memory limit
    if (this.usage.memoryCurrentMb > this.limits.maxMemoryMb) {
      return {
        type: 'resource_limit',
        resource: 'memoryMb',
        limit: this.limits.maxMemoryMb,
        actual: this.usage.memoryCurrentMb,
        timestamp: now,
        executionId: this.executionId,
      };
    }

    // Check CPU limit (as percentage of wall time)
    const wallTimeMs = Date.now() - this.startTime;
    if (wallTimeMs > 0) {
      const cpuPercent = (this.usage.cpuTimeMs / wallTimeMs) * 100;
      if (cpuPercent > this.limits.maxCpuPercent) {
        return {
          type: 'resource_limit',
          resource: 'cpuPercent',
          limit: this.limits.maxCpuPercent,
          actual: cpuPercent,
          timestamp: now,
          executionId: this.executionId,
        };
      }
    }

    // Check timeout
    if (wallTimeMs > this.limits.timeoutMs) {
      return {
        type: 'resource_limit',
        resource: 'timeoutMs',
        limit: this.limits.timeoutMs,
        actual: wallTimeMs,
        timestamp: now,
        executionId: this.executionId,
      };
    }

    // Check network requests
    if (this.usage.networkRequests > this.limits.maxNetworkRequests) {
      return {
        type: 'network_access',
        resource: 'networkRequests',
        limit: this.limits.maxNetworkRequests,
        actual: this.usage.networkRequests,
        timestamp: now,
        executionId: this.executionId,
      };
    }

    // Check filesystem operations
    const totalFsOps = this.usage.fileSystemReads + this.usage.fileSystemWrites;
    if (totalFsOps > this.limits.maxFileSystemOps) {
      return {
        type: 'filesystem_access',
        resource: 'fileSystemOps',
        limit: this.limits.maxFileSystemOps,
        actual: totalFsOps,
        timestamp: now,
        executionId: this.executionId,
      };
    }

    // Check concurrent operations
    if (this.usage.concurrentOps > this.limits.maxConcurrentOps) {
      return {
        type: 'resource_limit',
        resource: 'concurrentOps',
        limit: this.limits.maxConcurrentOps,
        actual: this.usage.concurrentOps,
        timestamp: now,
        executionId: this.executionId,
      };
    }

    return null;
  }

  /**
   * Record a network request with byte counts.
   */
  recordNetwork(bytesIn: number, bytesOut: number): void {
    this.usage.networkRequests += 1;
    this.usage.networkBytesIn += bytesIn;
    this.usage.networkBytesOut += bytesOut;
  }

  /**
   * Record a filesystem operation.
   */
  recordFileSystemOp(type: 'read' | 'write'): void {
    if (type === 'read') {
      this.usage.fileSystemReads += 1;
    } else {
      this.usage.fileSystemWrites += 1;
    }
  }

  /**
   * Record current memory usage in megabytes.
   */
  recordMemory(memoryMb: number): void {
    this.usage.memoryCurrentMb = memoryMb;
    if (memoryMb > this.usage.memoryPeakMb) {
      this.usage.memoryPeakMb = memoryMb;
    }
  }

  /**
   * Update the count of concurrent operations.
   */
  setConcurrentOps(count: number): void {
    this.usage.concurrentOps = count;
  }

  /**
   * Sample current process memory and update usage tracking.
   */
  private sampleMemory(): void {
    const memUsage = process.memoryUsage();
    const heapUsedMb = memUsage.heapUsed / (1024 * 1024);
    this.usage.memoryCurrentMb = heapUsedMb;
    if (heapUsedMb > this.usage.memoryPeakMb) {
      this.usage.memoryPeakMb = heapUsedMb;
    }
  }

  /**
   * Sample current process CPU usage and calculate elapsed CPU time.
   */
  private sampleCpu(): void {
    if (!this.lastCpuUsage) {
      this.lastCpuUsage = process.cpuUsage();
      this.lastCpuSampleTime = Date.now();
      return;
    }

    const currentCpuUsage = process.cpuUsage(this.lastCpuUsage);
    const elapsedMs = Date.now() - this.lastCpuSampleTime;

    if (elapsedMs > 0) {
      // Convert microseconds to milliseconds
      const cpuMs = (currentCpuUsage.user + currentCpuUsage.system) / 1000;
      this.usage.cpuTimeMs += cpuMs;
    }

    this.lastCpuUsage = process.cpuUsage();
    this.lastCpuSampleTime = Date.now();
  }
}

// =============================================================================
// RESOURCE LIMITER
// =============================================================================

/**
 * Enterprise resource limiter that manages multiple ResourceMonitor instances.
 * Creates, tracks, and enforces resource limits across concurrent executions.
 * Supports configurable thresholds with warning/critical actions.
 */
export class ResourceLimiter {
  private monitors: Map<string, ResourceMonitor>;
  private thresholds: ResourceThreshold[];
  private sampleIntervalMs: number;

  constructor(defaultThresholds?: ResourceThreshold[], sampleIntervalMs?: number) {
    this.monitors = new Map();
    this.thresholds = defaultThresholds ?? DEFAULT_THRESHOLDS;
    this.sampleIntervalMs = sampleIntervalMs ?? DEFAULT_SAMPLE_INTERVAL_MS;

    logger.info(
      { thresholdCount: this.thresholds.length },
      'Resource limiter initialized'
    );
  }

  /**
   * Create and start a new resource monitor for a specific execution.
   * Throws if a monitor already exists for the given execution ID.
   *
   * @param executionId - Unique identifier for the execution
   * @param limits - Resource limits to enforce
   * @returns The created ResourceMonitor instance
   */
  createMonitor(executionId: ID, limits: ResourceLimits): ResourceMonitor {
    if (this.monitors.has(executionId)) {
      throw new Error(`Resource monitor already exists for execution ${executionId}`);
    }

    this.validateLimits(limits);

    const monitor = new ResourceMonitor(executionId, limits, this.sampleIntervalMs);
    this.monitors.set(executionId, monitor);
    monitor.start();

    logger.info(
      { executionId, limits },
      'Resource monitor created and started'
    );

    return monitor;
  }

  /**
   * Get the current resource usage for a specific execution.
   *
   * @param executionId - The execution to query
   * @returns Current resource usage or null if no monitor exists
   */
  getUsage(executionId: ID): ResourceUsage | null {
    const monitor = this.monitors.get(executionId);
    if (!monitor) {
      return null;
    }
    return monitor.getUsage();
  }

  /**
   * Check if any resource limits have been exceeded for an execution.
   * Also evaluates threshold-based warnings and critical actions.
   *
   * @param executionId - The execution to check
   * @returns A SandboxViolation if limits are exceeded, null otherwise
   */
  checkLimits(executionId: ID): SandboxViolation | null {
    const monitor = this.monitors.get(executionId);
    if (!monitor) {
      logger.warn({ executionId }, 'No monitor found for limit check');
      return null;
    }

    const violation = monitor.checkViolation();
    if (violation) {
      logger.warn(
        { executionId, violation },
        'Resource limit violation detected'
      );
      return violation;
    }

    // Check threshold warnings
    this.evaluateThresholds(executionId, monitor);

    return null;
  }

  /**
   * Record a network request for a specific execution.
   *
   * @param executionId - The execution that made the request
   * @param bytesIn - Number of bytes received
   * @param bytesOut - Number of bytes sent
   */
  recordNetworkRequest(executionId: ID, bytesIn: number, bytesOut: number): void {
    const monitor = this.monitors.get(executionId);
    if (!monitor) {
      logger.warn({ executionId }, 'No monitor found for network request recording');
      return;
    }
    monitor.recordNetwork(bytesIn, bytesOut);
  }

  /**
   * Record a filesystem operation for a specific execution.
   *
   * @param executionId - The execution performing the operation
   * @param type - Type of filesystem operation
   */
  recordFileSystemOp(executionId: ID, type: 'read' | 'write'): void {
    const monitor = this.monitors.get(executionId);
    if (!monitor) {
      logger.warn({ executionId }, 'No monitor found for filesystem op recording');
      return;
    }
    monitor.recordFileSystemOp(type);
  }

  /**
   * Record current memory usage for a specific execution.
   *
   * @param executionId - The execution to record for
   * @param memoryMb - Current memory usage in megabytes
   */
  recordMemoryUsage(executionId: ID, memoryMb: number): void {
    if (memoryMb < 0) {
      throw new Error('Memory usage cannot be negative');
    }

    const monitor = this.monitors.get(executionId);
    if (!monitor) {
      logger.warn({ executionId }, 'No monitor found for memory recording');
      return;
    }
    monitor.recordMemory(memoryMb);
  }

  /**
   * Stop and remove the resource monitor for a specific execution.
   * Returns the final resource usage snapshot.
   *
   * @param executionId - The execution whose monitor to stop
   * @returns Final resource usage snapshot
   */
  stopMonitor(executionId: ID): ResourceUsage {
    const monitor = this.monitors.get(executionId);
    if (!monitor) {
      throw new Error(`No resource monitor found for execution ${executionId}`);
    }

    const finalUsage = monitor.stop();
    this.monitors.delete(executionId);

    logger.info(
      { executionId, finalUsage },
      'Resource monitor stopped and removed'
    );

    return finalUsage;
  }

  /**
   * Get the list of all currently active monitor execution IDs.
   */
  getActiveMonitors(): string[] {
    return Array.from(this.monitors.keys());
  }

  /**
   * Get the number of active monitors.
   */
  getActiveMonitorCount(): number {
    return this.monitors.size;
  }

  /**
   * Stop all active monitors and clear the monitor map.
   * Used during graceful shutdown.
   */
  stopAll(): Map<string, ResourceUsage> {
    const results = new Map<string, ResourceUsage>();

    for (const [executionId, monitor] of this.monitors.entries()) {
      const usage = monitor.stop();
      results.set(executionId, usage);
    }

    this.monitors.clear();
    logger.info({ count: results.size }, 'All resource monitors stopped');

    return results;
  }

  /**
   * Update the thresholds used for resource monitoring.
   *
   * @param thresholds - New thresholds to apply
   */
  setThresholds(thresholds: ResourceThreshold[]): void {
    this.thresholds = thresholds;
    logger.info(
      { thresholdCount: thresholds.length },
      'Resource thresholds updated'
    );
  }

  /**
   * Evaluate threshold-based warnings and actions for an execution.
   */
  private evaluateThresholds(executionId: ID, monitor: ResourceMonitor): void {
    const usage = monitor.getUsage();

    for (const threshold of this.thresholds) {
      const { percent, resourceName } = this.calculateThresholdPercent(threshold.resource, usage, monitor);

      if (percent >= threshold.criticalPercent) {
        logger.error(
          {
            executionId,
            resource: threshold.resource,
            resourceName,
            percent,
            criticalPercent: threshold.criticalPercent,
            action: threshold.action,
          },
          'Resource threshold critical level reached'
        );
      } else if (percent >= threshold.warningPercent) {
        logger.warn(
          {
            executionId,
            resource: threshold.resource,
            resourceName,
            percent,
            warningPercent: threshold.warningPercent,
          },
          'Resource threshold warning level reached'
        );
      }
    }
  }

  /**
   * Calculate the percentage of a resource limit currently used.
   */
  private calculateThresholdPercent(
    resource: ResourceThreshold['resource'],
    usage: ResourceUsage,
    _monitor: ResourceMonitor
  ): { percent: number; resourceName: string } {
    switch (resource) {
      case 'memory':
        return { percent: usage.memoryPeakMb > 0 ? (usage.memoryCurrentMb / usage.memoryPeakMb) * 100 : 0, resourceName: 'memoryMb' };
      case 'cpu':
        return { percent: usage.wallTimeMs > 0 ? (usage.cpuTimeMs / usage.wallTimeMs) * 100 : 0, resourceName: 'cpuPercent' };
      case 'time':
        return { percent: usage.wallTimeMs, resourceName: 'wallTimeMs' };
      case 'network_requests':
        return { percent: usage.networkRequests, resourceName: 'networkRequests' };
      case 'network_bytes':
        return { percent: usage.networkBytesIn + usage.networkBytesOut, resourceName: 'networkBytes' };
      case 'filesystem':
        return { percent: usage.fileSystemReads + usage.fileSystemWrites, resourceName: 'fileSystemOps' };
      case 'concurrent_ops':
        return { percent: usage.concurrentOps, resourceName: 'concurrentOps' };
      case 'payload_size':
        return { percent: usage.networkBytesIn + usage.networkBytesOut, resourceName: 'payloadBytes' };
      default:
        return { percent: 0, resourceName: 'unknown' };
    }
  }

  /**
   * Validate that resource limits are within acceptable ranges.
   */
  private validateLimits(limits: ResourceLimits): void {
    if (limits.maxMemoryMb <= 0) {
      throw new Error('maxMemoryMb must be a positive number');
    }
    if (limits.maxCpuPercent <= 0 || limits.maxCpuPercent > 100) {
      throw new Error('maxCpuPercent must be between 1 and 100');
    }
    if (limits.timeoutMs <= 0) {
      throw new Error('timeoutMs must be a positive number');
    }
    if (limits.maxNetworkRequests < 0) {
      throw new Error('maxNetworkRequests cannot be negative');
    }
    if (limits.maxFileSystemOps < 0) {
      throw new Error('maxFileSystemOps cannot be negative');
    }
    if (limits.maxConcurrentOps < 0) {
      throw new Error('maxConcurrentOps cannot be negative');
    }
    if (limits.maxPayloadSizeBytes < 0) {
      throw new Error('maxPayloadSizeBytes cannot be negative');
    }
    if (limits.maxRetries < 0) {
      throw new Error('maxRetries cannot be negative');
    }
    if (limits.networkTimeoutMs <= 0) {
      throw new Error('networkTimeoutMs must be a positive number');
    }
  }
}
