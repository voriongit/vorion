/**
 * Behavioral Monitoring Extension
 *
 * Provides continuous behavioral monitoring, anomaly detection, and
 * metrics collection for AI agents. Detects drift from certified
 * behavior patterns.
 *
 * @packageDocumentation
 * @module @vorion/aci-extensions/builtin-extensions/monitoring
 * @license Apache-2.0
 */

import { createLogger } from '../../common/logger.js';
import type {
  ACIExtension,
  AgentIdentity,
  ActionRequest,
  ActionRecord,
  BehaviorMetrics,
  BehaviorVerificationResult,
  MetricsReport,
  AnomalyReport,
  AnomalyResponse,
  FailureResponse,
} from '../types.js';

const logger = createLogger({ component: 'aci-ext-monitoring' });

/**
 * Configuration for monitoring thresholds
 */
interface MonitoringConfig {
  /** Maximum acceptable error rate (0-1) */
  maxErrorRate: number;
  /** Maximum acceptable response time (ms) */
  maxResponseTime: number;
  /** Anomaly detection sensitivity (0-1, higher = more sensitive) */
  anomalySensitivity: number;
  /** Metrics retention period (ms) */
  metricsRetentionMs: number;
  /** Health check interval (ms) */
  healthCheckIntervalMs: number;
}

const DEFAULT_CONFIG: MonitoringConfig = {
  maxErrorRate: 0.1,
  maxResponseTime: 5000,
  anomalySensitivity: 0.5,
  metricsRetentionMs: 24 * 60 * 60 * 1000, // 24 hours
  healthCheckIntervalMs: 60000, // 1 minute
};

/**
 * Time series data point
 */
interface DataPoint {
  timestamp: Date;
  value: number;
}

/**
 * Agent metrics storage
 */
interface AgentMetricsStore {
  responseTimes: DataPoint[];
  errorCounts: DataPoint[];
  requestCounts: DataPoint[];
  actionsByType: Map<string, number>;
  domainsAccessed: Set<number>;
  maxLevelUsed: number;
  lastUpdated: Date;
  health: 'healthy' | 'degraded' | 'unhealthy';
}

/**
 * In-memory metrics storage (in production, use time-series database)
 */
const metricsStore: Map<string, AgentMetricsStore> = new Map();

/**
 * Anomaly history for pattern detection
 */
const anomalyHistory: Map<string, AnomalyReport[]> = new Map();

/**
 * Get or create metrics store for an agent
 */
function getOrCreateStore(agentDid: string): AgentMetricsStore {
  let store = metricsStore.get(agentDid);
  if (!store) {
    store = {
      responseTimes: [],
      errorCounts: [],
      requestCounts: [],
      actionsByType: new Map(),
      domainsAccessed: new Set(),
      maxLevelUsed: 0,
      lastUpdated: new Date(),
      health: 'healthy',
    };
    metricsStore.set(agentDid, store);
  }
  return store;
}

/**
 * Clean old data points from array
 */
function cleanOldDataPoints(
  points: DataPoint[],
  retentionMs: number
): DataPoint[] {
  const cutoff = new Date(Date.now() - retentionMs);
  return points.filter((p) => p.timestamp > cutoff);
}

/**
 * Calculate percentile from sorted array
 */
function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.ceil((p / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, index)]!;
}

/**
 * Calculate average
 */
function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Calculate standard deviation
 */
function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = average(values);
  const squareDiffs = values.map((v) => Math.pow(v - avg, 2));
  return Math.sqrt(average(squareDiffs));
}

/**
 * Detect anomalies using z-score
 */
function detectAnomaly(
  value: number,
  history: number[],
  sensitivity: number
): boolean {
  if (history.length < 10) return false;

  const mean = average(history);
  const sd = stdDev(history);
  if (sd === 0) return false;

  const zScore = Math.abs((value - mean) / sd);
  const threshold = 3 - sensitivity * 2; // Sensitivity 0 = 3, Sensitivity 1 = 1

  return zScore > threshold;
}

/**
 * Record an action and update metrics
 */
function recordAction(
  agentDid: string,
  action: ActionRecord,
  config: MonitoringConfig
): void {
  const store = getOrCreateStore(agentDid);
  const now = new Date();

  // Clean old data
  store.responseTimes = cleanOldDataPoints(
    store.responseTimes,
    config.metricsRetentionMs
  );
  store.errorCounts = cleanOldDataPoints(
    store.errorCounts,
    config.metricsRetentionMs
  );
  store.requestCounts = cleanOldDataPoints(
    store.requestCounts,
    config.metricsRetentionMs
  );

  // Record request
  store.requestCounts.push({ timestamp: now, value: 1 });

  // Record response time if completed
  if (action.completedAt) {
    const duration =
      new Date(action.completedAt).getTime() - new Date(action.startedAt).getTime();
    store.responseTimes.push({ timestamp: now, value: duration });
  }

  // Record errors
  if (action.error || (action.result && !action.result.success)) {
    store.errorCounts.push({ timestamp: now, value: 1 });
  }

  // Track action types
  const currentCount = store.actionsByType.get(action.type) ?? 0;
  store.actionsByType.set(action.type, currentCount + 1);

  store.lastUpdated = now;
}

/**
 * Determine agent health status
 */
function calculateHealth(
  store: AgentMetricsStore,
  config: MonitoringConfig
): 'healthy' | 'degraded' | 'unhealthy' {
  const responseTimes = store.responseTimes.map((p) => p.value);
  const avgResponseTime = average(responseTimes);

  const totalRequests = store.requestCounts.length;
  const totalErrors = store.errorCounts.length;
  const errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;

  if (errorRate > config.maxErrorRate * 2 || avgResponseTime > config.maxResponseTime * 2) {
    return 'unhealthy';
  }

  if (errorRate > config.maxErrorRate || avgResponseTime > config.maxResponseTime) {
    return 'degraded';
  }

  return 'healthy';
}

/**
 * Build behavior metrics from store
 */
function buildBehaviorMetrics(
  store: AgentMetricsStore,
  windowStart: Date,
  windowEnd: Date
): BehaviorMetrics {
  const windowedResponseTimes = store.responseTimes
    .filter((p) => p.timestamp >= windowStart && p.timestamp <= windowEnd)
    .map((p) => p.value);

  const sortedResponseTimes = [...windowedResponseTimes].sort((a, b) => a - b);

  const windowedRequests = store.requestCounts.filter(
    (p) => p.timestamp >= windowStart && p.timestamp <= windowEnd
  );

  const windowedErrors = store.errorCounts.filter(
    (p) => p.timestamp >= windowStart && p.timestamp <= windowEnd
  );

  return {
    windowStart,
    windowEnd,
    requestCount: windowedRequests.length,
    errorCount: windowedErrors.length,
    avgResponseTime: average(windowedResponseTimes),
    p99ResponseTime: percentile(sortedResponseTimes, 99),
    actionsByType: Object.fromEntries(store.actionsByType),
    domainsAccessed: Array.from(store.domainsAccessed),
    maxLevelUsed: store.maxLevelUsed,
    custom: {
      totalRecordedResponseTimes: store.responseTimes.length,
      totalRecordedRequests: store.requestCounts.length,
    },
  };
}

/**
 * Behavioral Monitoring Extension
 *
 * Provides:
 * - Continuous metrics collection
 * - Behavioral drift detection
 * - Anomaly detection and alerting
 * - Health status tracking
 */
export const monitoringExtension: ACIExtension = {
  extensionId: 'aci-ext-monitoring-v1',
  name: 'Behavioral Monitoring',
  version: '1.0.0',
  shortcode: 'mon',
  publisher: 'did:web:agentanchor.io',
  description:
    'Continuous behavioral monitoring and anomaly detection for AI agents. ' +
    'Tracks metrics, detects drift, and alerts on anomalous behavior.',
  requiredACIVersion: '>=1.0.0',

  hooks: {
    onLoad: async () => {
      logger.info('Behavioral Monitoring extension loaded');
    },

    onUnload: async () => {
      logger.info('Behavioral Monitoring extension unloading');
      metricsStore.clear();
      anomalyHistory.clear();
    },
  },

  action: {
    /**
     * Track action initiation for metrics
     */
    preAction: async (
      agent: AgentIdentity,
      action: ActionRequest
    ) => {
      // Update domains accessed
      const store = getOrCreateStore(agent.did);
      store.domainsAccessed.add(agent.domains);

      // Track max level used
      if (agent.level > store.maxLevelUsed) {
        store.maxLevelUsed = agent.level;
      }

      // Always allow - monitoring doesn't block
      return { proceed: true };
    },

    /**
     * Record action completion for metrics
     */
    postAction: async (
      agent: AgentIdentity,
      action: ActionRecord
    ): Promise<void> => {
      recordAction(agent.did, action, DEFAULT_CONFIG);

      // Check for response time anomaly
      const store = getOrCreateStore(agent.did);
      if (action.completedAt) {
        const duration =
          new Date(action.completedAt).getTime() -
          new Date(action.startedAt).getTime();
        const historicalTimes = store.responseTimes
          .slice(-100)
          .map((p) => p.value);

        if (
          detectAnomaly(
            duration,
            historicalTimes,
            DEFAULT_CONFIG.anomalySensitivity
          )
        ) {
          logger.warn(
            {
              agentDid: agent.did,
              actionId: action.id,
              duration,
              avgDuration: average(historicalTimes),
            },
            'Response time anomaly detected'
          );
        }
      }

      // Update health status
      store.health = calculateHealth(store, DEFAULT_CONFIG);
    },

    /**
     * Track failures for anomaly detection
     */
    onFailure: async (
      agent: AgentIdentity,
      action: ActionRecord,
      error: Error
    ): Promise<FailureResponse> => {
      const store = getOrCreateStore(agent.did);

      // Record the error
      store.errorCounts.push({ timestamp: new Date(), value: 1 });

      // Check if error rate is anomalous
      const recentErrors = store.errorCounts.filter(
        (p) => p.timestamp > new Date(Date.now() - 60000)
      ).length;
      const recentRequests = store.requestCounts.filter(
        (p) => p.timestamp > new Date(Date.now() - 60000)
      ).length;

      const recentErrorRate =
        recentRequests > 0 ? recentErrors / recentRequests : 0;

      if (recentErrorRate > DEFAULT_CONFIG.maxErrorRate * 2) {
        logger.error(
          {
            agentDid: agent.did,
            recentErrorRate,
            threshold: DEFAULT_CONFIG.maxErrorRate * 2,
          },
          'Critical error rate detected'
        );

        // Don't retry on high error rate - circuit breaker pattern
        return {
          retry: false,
        };
      }

      // Allow retry for transient errors
      return {
        retry: true,
        retryDelay: 1000,
        maxRetries: 3,
      };
    },
  },

  monitoring: {
    /**
     * Verify behavior against baseline
     */
    verifyBehavior: async (
      agent: AgentIdentity,
      metrics: BehaviorMetrics
    ): Promise<BehaviorVerificationResult> => {
      const store = getOrCreateStore(agent.did);
      const driftCategories: string[] = [];
      let driftScore = 0;

      // Check error rate drift
      const currentErrorRate =
        metrics.requestCount > 0
          ? metrics.errorCount / metrics.requestCount
          : 0;

      if (currentErrorRate > DEFAULT_CONFIG.maxErrorRate) {
        driftCategories.push('error_rate');
        driftScore += Math.min(
          (currentErrorRate / DEFAULT_CONFIG.maxErrorRate) * 30,
          40
        );
      }

      // Check response time drift
      if (metrics.avgResponseTime > DEFAULT_CONFIG.maxResponseTime) {
        driftCategories.push('response_time');
        driftScore += Math.min(
          (metrics.avgResponseTime / DEFAULT_CONFIG.maxResponseTime) * 20,
          30
        );
      }

      // Check for unusual action patterns
      const historicalActionTypes = store.actionsByType;
      for (const [actionType, count] of Object.entries(metrics.actionsByType)) {
        const historicalCount = historicalActionTypes.get(actionType) ?? 0;
        if (count > historicalCount * 5 && count > 10) {
          driftCategories.push(`action_spike:${actionType}`);
          driftScore += 10;
        }
      }

      // Check for new action types
      for (const actionType of Object.keys(metrics.actionsByType)) {
        if (!historicalActionTypes.has(actionType)) {
          driftCategories.push(`new_action_type:${actionType}`);
          driftScore += 5;
        }
      }

      // Cap drift score
      driftScore = Math.min(driftScore, 100);

      // Determine recommendation
      let recommendation: BehaviorVerificationResult['recommendation'];
      if (driftScore < 25) {
        recommendation = 'continue';
      } else if (driftScore < 50) {
        recommendation = 'warn';
      } else if (driftScore < 75) {
        recommendation = 'suspend';
      } else {
        recommendation = 'revoke';
      }

      logger.debug(
        {
          agentDid: agent.did,
          driftScore,
          driftCategories,
          recommendation,
        },
        'Behavior verification completed'
      );

      return {
        inBounds: driftScore < 50,
        driftScore,
        driftCategories,
        recommendation,
        details:
          driftCategories.length > 0
            ? `Behavioral drift detected in: ${driftCategories.join(', ')}`
            : 'Behavior within normal parameters',
      };
    },

    /**
     * Collect metrics for the agent
     */
    collectMetrics: async (agent: AgentIdentity): Promise<MetricsReport> => {
      const store = getOrCreateStore(agent.did);
      const now = new Date();
      const windowStart = new Date(now.getTime() - 60 * 60 * 1000); // Last hour

      // Build metrics
      const metrics = buildBehaviorMetrics(store, windowStart, now);

      // Update health
      store.health = calculateHealth(store, DEFAULT_CONFIG);

      logger.debug(
        {
          agentDid: agent.did,
          health: store.health,
          requestCount: metrics.requestCount,
          errorCount: metrics.errorCount,
        },
        'Metrics collected'
      );

      return {
        timestamp: now,
        aci: agent.aci,
        metrics,
        health: store.health,
      };
    },

    /**
     * Handle detected anomalies
     */
    onAnomaly: async (
      agent: AgentIdentity,
      anomaly: AnomalyReport
    ): Promise<AnomalyResponse> => {
      // Store anomaly for pattern detection
      let agentAnomalies = anomalyHistory.get(agent.did);
      if (!agentAnomalies) {
        agentAnomalies = [];
        anomalyHistory.set(agent.did, agentAnomalies);
      }
      agentAnomalies.push(anomaly);

      // Keep only recent anomalies
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      anomalyHistory.set(
        agent.did,
        agentAnomalies.filter((a) => a.detectedAt > cutoff)
      );

      // Check for anomaly patterns (repeated anomalies)
      const recentAnomalies = agentAnomalies.filter(
        (a) => a.detectedAt > new Date(Date.now() - 60 * 60 * 1000)
      );

      logger.info(
        {
          agentDid: agent.did,
          anomalyId: anomaly.id,
          anomalyType: anomaly.type,
          severity: anomaly.severity,
          recentCount: recentAnomalies.length,
        },
        'Processing anomaly'
      );

      // Determine response based on severity and frequency
      let action: AnomalyResponse['action'];
      let escalated = false;
      const notified: string[] = [];

      if (anomaly.severity === 'critical') {
        action = 'suspend';
        escalated = true;
        notified.push('security-team', 'operations');
      } else if (
        anomaly.severity === 'high' ||
        recentAnomalies.length >= 5
      ) {
        action = 'alert';
        notified.push('operations');
      } else if (anomaly.severity === 'medium') {
        action = 'log';
      } else {
        action = 'ignore';
      }

      return {
        action,
        notified: notified.length > 0 ? notified : undefined,
        escalated,
      };
    },
  },
};

/**
 * Create monitoring extension with custom configuration
 */
export function createMonitoringExtension(
  config?: Partial<MonitoringConfig>
): ACIExtension {
  // Could be extended to use custom config
  return monitoringExtension;
}

export default monitoringExtension;
