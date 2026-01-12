/**
 * Telemetry Collector - Collects performance metrics and operational data
 *
 * Metrics tracked:
 * - Request/response times
 * - Error rates
 * - Token usage
 * - Cache hit rates
 * - Concurrent requests
 * - Memory usage
 * - Custom business metrics
 */

import { createClient } from '@supabase/supabase-js';
import logger from '@/lib/logger';
import { TelemetryMetric } from './types';

export class TelemetryCollector {
  private supabase;
  private metricsBuffer: TelemetryMetric[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly BUFFER_SIZE = 100;
  private readonly FLUSH_INTERVAL_MS = 5000; // 5 seconds

  constructor(supabaseUrl?: string, supabaseKey?: string) {
    this.supabase = createClient(
      supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Auto-flush metrics periodically
    this.startAutoFlush();
  }

  /**
   * Start automatic flushing of metrics buffer
   */
  private startAutoFlush(): void {
    this.flushInterval = setInterval(() => {
      if (this.metricsBuffer.length > 0) {
        this.flushMetrics().catch((error) => {
          logger.error('auto_flush_failed', { error });
        });
      }
    }, this.FLUSH_INTERVAL_MS);
  }

  /**
   * Stop automatic flushing
   */
  stopAutoFlush(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }

  /**
   * Record a metric
   */
  async recordMetric(
    botId: string,
    metricName: string,
    metricValue: number,
    metricUnit: string,
    tags?: Record<string, string>
  ): Promise<void> {
    try {
      const metric: TelemetryMetric = {
        bot_id: botId,
        metric_name: metricName,
        metric_value: metricValue,
        metric_unit: metricUnit,
        tags: tags || {},
        timestamp: new Date(),
      };

      this.metricsBuffer.push(metric);

      // Flush if buffer is full
      if (this.metricsBuffer.length >= this.BUFFER_SIZE) {
        await this.flushMetrics();
      }
    } catch (error) {
      logger.error('record_metric_failed', { error, botId, metricName });
    }
  }

  /**
   * Flush metrics buffer to database
   */
  private async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) return;

    const metricsToFlush = [...this.metricsBuffer];
    this.metricsBuffer = [];

    try {
      const { error } = await this.supabase
        .from('bot_telemetry')
        .insert(metricsToFlush);

      if (error) throw error;

      logger.debug('metrics_flushed', { count: metricsToFlush.length });
    } catch (error) {
      logger.error('flush_metrics_failed', { error });
      // Re-add to buffer on failure
      this.metricsBuffer.unshift(...metricsToFlush);
    }
  }

  /**
   * Record request metrics
   */
  async recordRequest(
    botId: string,
    responseTimeMs: number,
    success: boolean,
    tags?: Record<string, string>
  ): Promise<void> {
    await Promise.all([
      this.recordMetric(
        botId,
        'request_count',
        1,
        'count',
        { ...tags, success: success.toString() }
      ),
      this.recordMetric(
        botId,
        'response_time_ms',
        responseTimeMs,
        'milliseconds',
        tags
      ),
      success
        ? null
        : this.recordMetric(botId, 'error_count', 1, 'count', tags),
    ]);
  }

  /**
   * Record token usage
   */
  async recordTokenUsage(
    botId: string,
    inputTokens: number,
    outputTokens: number,
    modelName: string
  ): Promise<void> {
    await Promise.all([
      this.recordMetric(botId, 'input_tokens', inputTokens, 'tokens', {
        model: modelName,
      }),
      this.recordMetric(botId, 'output_tokens', outputTokens, 'tokens', {
        model: modelName,
      }),
      this.recordMetric(
        botId,
        'total_tokens',
        inputTokens + outputTokens,
        'tokens',
        { model: modelName }
      ),
    ]);
  }

  /**
   * Record cache metrics
   */
  async recordCacheMetric(
    botId: string,
    hit: boolean,
    cacheType: string
  ): Promise<void> {
    await this.recordMetric(
      botId,
      hit ? 'cache_hit' : 'cache_miss',
      1,
      'count',
      { cache_type: cacheType }
    );
  }

  /**
   * Record memory usage
   */
  async recordMemoryUsage(botId: string, memoryMB: number): Promise<void> {
    await this.recordMetric(botId, 'memory_usage', memoryMB, 'megabytes');
  }

  /**
   * Record concurrent requests
   */
  async recordConcurrency(botId: string, count: number): Promise<void> {
    await this.recordMetric(
      botId,
      'concurrent_requests',
      count,
      'count'
    );
  }

  /**
   * Get metrics for a specific time range
   */
  async getMetrics(
    botId: string,
    metricName: string,
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ timestamp: Date; value: number }>> {
    try {
      const { data, error } = await this.supabase
        .from('bot_telemetry')
        .select('timestamp, metric_value')
        .eq('bot_id', botId)
        .eq('metric_name', metricName)
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString())
        .order('timestamp', { ascending: true });

      if (error) throw error;

      return (
        data?.map((record) => ({
          timestamp: new Date(record.timestamp),
          value: record.metric_value,
        })) || []
      );
    } catch (error) {
      logger.error('get_metrics_failed', { error, botId, metricName });
      throw new Error(`Failed to get metrics: ${error}`);
    }
  }

  /**
   * Get aggregated metrics (avg, min, max, sum)
   */
  async getAggregatedMetrics(
    botId: string,
    metricName: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    avg: number;
    min: number;
    max: number;
    sum: number;
    count: number;
  }> {
    try {
      const metrics = await this.getMetrics(
        botId,
        metricName,
        startDate,
        endDate
      );

      if (metrics.length === 0) {
        return { avg: 0, min: 0, max: 0, sum: 0, count: 0 };
      }

      const values = metrics.map((m) => m.value);
      const sum = values.reduce((a, b) => a + b, 0);

      return {
        avg: sum / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        sum,
        count: values.length,
      };
    } catch (error) {
      logger.error('get_aggregated_metrics_failed', {
        error,
        botId,
        metricName,
      });
      throw new Error(`Failed to get aggregated metrics: ${error}`);
    }
  }

  /**
   * Get real-time performance snapshot
   */
  async getPerformanceSnapshot(botId: string): Promise<{
    avg_response_time_ms: number;
    error_rate: number;
    requests_last_hour: number;
    cache_hit_rate: number;
    tokens_last_hour: number;
  }> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const now = new Date();

      const [responseTime, requests, cacheHits, cacheMisses, tokens] =
        await Promise.all([
          this.getAggregatedMetrics(
            botId,
            'response_time_ms',
            oneHourAgo,
            now
          ),
          this.getAggregatedMetrics(
            botId,
            'request_count',
            oneHourAgo,
            now
          ),
          this.getAggregatedMetrics(
            botId,
            'cache_hit',
            oneHourAgo,
            now
          ),
          this.getAggregatedMetrics(
            botId,
            'cache_miss',
            oneHourAgo,
            now
          ),
          this.getAggregatedMetrics(
            botId,
            'total_tokens',
            oneHourAgo,
            now
          ),
        ]);

      const totalCacheRequests = cacheHits.count + cacheMisses.count;
      const cacheHitRate =
        totalCacheRequests > 0 ? cacheHits.count / totalCacheRequests : 0;

      const errors = await this.getAggregatedMetrics(
        botId,
        'error_count',
        oneHourAgo,
        now
      );
      const errorRate = requests.sum > 0 ? errors.sum / requests.sum : 0;

      return {
        avg_response_time_ms: responseTime.avg,
        error_rate: errorRate,
        requests_last_hour: requests.sum,
        cache_hit_rate: cacheHitRate,
        tokens_last_hour: tokens.sum,
      };
    } catch (error) {
      logger.error('get_performance_snapshot_failed', { error, botId });
      throw new Error(`Failed to get performance snapshot: ${error}`);
    }
  }

  /**
   * Get time-series data for charting
   */
  async getTimeSeriesData(
    botId: string,
    metricName: string,
    startDate: Date,
    endDate: Date,
    intervalMinutes: number = 60
  ): Promise<Array<{ timestamp: Date; value: number }>> {
    try {
      const metrics = await this.getMetrics(
        botId,
        metricName,
        startDate,
        endDate
      );

      if (metrics.length === 0) return [];

      // Group by interval
      const intervalMs = intervalMinutes * 60 * 1000;
      const grouped: Record<string, number[]> = {};

      metrics.forEach((metric) => {
        const intervalKey = new Date(
          Math.floor(metric.timestamp.getTime() / intervalMs) * intervalMs
        ).toISOString();

        if (!grouped[intervalKey]) {
          grouped[intervalKey] = [];
        }
        grouped[intervalKey].push(metric.value);
      });

      // Calculate average for each interval
      return Object.entries(grouped)
        .map(([timestamp, values]) => ({
          timestamp: new Date(timestamp),
          value: values.reduce((a, b) => a + b, 0) / values.length,
        }))
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    } catch (error) {
      logger.error('get_time_series_data_failed', { error, botId, metricName });
      throw new Error(`Failed to get time series data: ${error}`);
    }
  }

  /**
   * Clean up old metrics (for data retention policies)
   */
  async cleanupOldMetrics(daysToKeep: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date(
        Date.now() - daysToKeep * 24 * 60 * 60 * 1000
      );

      const { data, error } = await this.supabase
        .from('bot_telemetry')
        .delete()
        .lt('timestamp', cutoffDate.toISOString())
        .select();

      if (error) throw error;

      const deletedCount = data?.length || 0;

      logger.info('old_metrics_cleaned', {
        deleted_count: deletedCount,
        cutoff_date: cutoffDate.toISOString(),
      });

      return deletedCount;
    } catch (error) {
      logger.error('cleanup_old_metrics_failed', { error, daysToKeep });
      throw new Error(`Failed to cleanup old metrics: ${error}`);
    }
  }

  /**
   * Ensure metrics are flushed before shutdown
   */
  async shutdown(): Promise<void> {
    this.stopAutoFlush();
    await this.flushMetrics();
  }
}

// Export singleton instance
export const telemetryCollector = new TelemetryCollector();

// Cleanup on process exit
process.on('beforeExit', () => {
  telemetryCollector.shutdown().catch((error) => {
    logger.error('telemetry_shutdown_failed', { error });
  });
});
