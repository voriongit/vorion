/**
 * Carbon Metrics
 *
 * Tracks and reports carbon-related metrics including estimated CO2 per request,
 * carbon savings from routing decisions, and regional intensity history.
 *
 * @packageDocumentation
 */

import { EventEmitter } from 'events';
import { createLogger } from '../common/logger.js';
import type {
  CloudRegion,
  AIProvider,
  CarbonMetricsSnapshot,
  IntensityHistoryEntry,
  RoutingDecision,
  SavingsCalculatedEvent,
  IntensityFetchedEvent,
  FallbackUsedEvent,
} from './types.js';
import { ENERGY_PER_1000_TOKENS_KWH } from './types.js';

const logger = createLogger({ component: 'carbon-metrics' });

/**
 * Default history retention (24 hours worth at 5-minute intervals)
 */
const DEFAULT_HISTORY_SIZE = 288;

/**
 * Default baseline carbon intensity for savings calculation (gCO2eq/kWh)
 * Based on global average grid intensity
 */
const DEFAULT_BASELINE_INTENSITY = 450;

/**
 * Carbon Metrics Collector
 *
 * Aggregates and reports carbon-related metrics for the AI Gateway.
 */
export class CarbonMetrics extends EventEmitter {
  private _totalRequests = 0;
  private _totalEstimatedCO2Grams = 0;
  private _totalSavingsGrams = 0;
  private _totalIntensitySum = 0;
  private _cacheHits = 0;
  private _cacheMisses = 0;
  private _fallbackCount = 0;
  private _totalFetches = 0;

  private _requestsByRegion: Map<CloudRegion, number> = new Map();
  private _requestsByProvider: Map<AIProvider, number> = new Map();
  private _co2ByRegion: Map<CloudRegion, number> = new Map();

  private _intensityHistory: IntensityHistoryEntry[] = [];
  private _historySize: number;
  private _baselineIntensity: number;

  private _periodStart: string;

  constructor(config: CarbonMetricsConfig = {}) {
    super();
    this._historySize = config.historySize ?? DEFAULT_HISTORY_SIZE;
    this._baselineIntensity = config.baselineIntensity ?? DEFAULT_BASELINE_INTENSITY;
    this._periodStart = new Date().toISOString();
  }

  /**
   * Get total requests routed
   */
  get totalRequests(): number {
    return this._totalRequests;
  }

  /**
   * Get total estimated CO2 (grams)
   */
  get totalEstimatedCO2Grams(): number {
    return this._totalEstimatedCO2Grams;
  }

  /**
   * Get total CO2 savings (grams)
   */
  get totalSavingsGrams(): number {
    return this._totalSavingsGrams;
  }

  /**
   * Get average carbon intensity
   */
  get averageIntensity(): number {
    return this._totalRequests > 0 ? this._totalIntensitySum / this._totalRequests : 0;
  }

  /**
   * Get green routing percentage
   */
  get greenRoutingPercentage(): number {
    if (this._totalRequests === 0) return 0;

    let greenCount = 0;
    Array.from(this._requestsByRegion.entries()).forEach(([region, count]) => {
      // Consider regions with intensity <= 150 as "green"
      const avgIntensity = this.getAverageRegionIntensity(region);
      if (avgIntensity <= 150) {
        greenCount += count;
      }
    });
    return (greenCount / this._totalRequests) * 100;
  }

  /**
   * Get cache hit rate
   */
  get cacheHitRate(): number {
    const total = this._cacheHits + this._cacheMisses;
    return total > 0 ? this._cacheHits / total : 0;
  }

  /**
   * Get fallback rate
   */
  get fallbackRate(): number {
    return this._totalFetches > 0 ? this._fallbackCount / this._totalFetches : 0;
  }

  /**
   * Record a routing decision
   */
  recordRouting(decision: RoutingDecision, estimatedTokens: number): void {
    this._totalRequests++;

    // Calculate CO2
    const co2Grams = this.calculateCO2(decision.carbonIntensity.intensity, estimatedTokens);
    this._totalEstimatedCO2Grams += co2Grams;
    this._totalIntensitySum += decision.carbonIntensity.intensity;

    // Calculate savings vs baseline
    const baselineCO2 = this.calculateCO2(this._baselineIntensity, estimatedTokens);
    const savings = Math.max(0, baselineCO2 - co2Grams);
    this._totalSavingsGrams += savings;

    // Update region counts
    const regionCount = this._requestsByRegion.get(decision.region) ?? 0;
    this._requestsByRegion.set(decision.region, regionCount + 1);

    // Update provider counts
    const providerCount = this._requestsByProvider.get(decision.provider) ?? 0;
    this._requestsByProvider.set(decision.provider, providerCount + 1);

    // Update CO2 by region
    const regionCO2 = this._co2ByRegion.get(decision.region) ?? 0;
    this._co2ByRegion.set(decision.region, regionCO2 + co2Grams);

    // Track intensity history for green routing percentage calculation
    this.addToHistory({
      region: decision.region,
      intensity: decision.carbonIntensity.intensity,
      timestamp: decision.decidedAt,
      source: 'routing_decision',
    });

    // Emit savings event
    this.emitSavingsEvent(decision.id, co2Grams, baselineCO2, savings);

    logger.debug(
      {
        requestId: decision.id,
        region: decision.region,
        co2Grams,
        savingsGrams: savings,
        totalRequests: this._totalRequests,
      },
      'Routing recorded'
    );
  }

  /**
   * Record intensity fetch result
   */
  recordIntensityFetch(event: IntensityFetchedEvent): void {
    this._totalFetches++;
    if (event.cacheHit) {
      this._cacheHits++;
    } else {
      this._cacheMisses++;
    }

    // Add to history
    this.addToHistory({
      region: event.region,
      intensity: event.intensity,
      timestamp: event.timestamp,
      source: event.source,
    });
  }

  /**
   * Record fallback usage
   */
  recordFallback(event: FallbackUsedEvent): void {
    this._fallbackCount++;
    logger.debug(
      {
        region: event.region,
        primarySource: event.primarySource,
        fallbackSource: event.fallbackSource,
        reason: event.reason,
      },
      'Fallback recorded'
    );
  }

  /**
   * Get a snapshot of all metrics
   */
  getSnapshot(): CarbonMetricsSnapshot {
    return {
      totalRequests: this._totalRequests,
      totalEstimatedCO2Grams: this._totalEstimatedCO2Grams,
      totalSavingsGrams: this._totalSavingsGrams,
      averageIntensity: this.averageIntensity,
      requestsByRegion: new Map(this._requestsByRegion),
      requestsByProvider: new Map(this._requestsByProvider),
      co2ByRegion: new Map(this._co2ByRegion),
      greenRoutingPercentage: this.greenRoutingPercentage,
      cacheHitRate: this.cacheHitRate,
      fallbackRate: this.fallbackRate,
      periodStart: this._periodStart,
      periodEnd: new Date().toISOString(),
    };
  }

  /**
   * Get intensity history for a region
   */
  getIntensityHistory(region?: CloudRegion): IntensityHistoryEntry[] {
    if (region) {
      return this._intensityHistory.filter(e => e.region === region);
    }
    return [...this._intensityHistory];
  }

  /**
   * Get average intensity for a region over the history period
   */
  getAverageRegionIntensity(region: CloudRegion): number {
    const regionHistory = this.getIntensityHistory(region);
    if (regionHistory.length === 0) return this._baselineIntensity;

    const sum = regionHistory.reduce((acc, e) => acc + e.intensity, 0);
    return sum / regionHistory.length;
  }

  /**
   * Get regions sorted by average intensity (greenest first)
   */
  getRegionsByIntensity(): Array<{ region: CloudRegion; averageIntensity: number }> {
    const regions = new Set(this._intensityHistory.map(e => e.region));
    const result: Array<{ region: CloudRegion; averageIntensity: number }> = [];

    Array.from(regions).forEach((region) => {
      result.push({
        region,
        averageIntensity: this.getAverageRegionIntensity(region),
      });
    });

    return result.sort((a, b) => a.averageIntensity - b.averageIntensity);
  }

  /**
   * Get CO2 savings breakdown by region
   */
  getSavingsByRegion(): Map<CloudRegion, number> {
    const savings = new Map<CloudRegion, number>();

    Array.from(this._co2ByRegion.entries()).forEach(([region, totalCO2]) => {
      const requests = this._requestsByRegion.get(region) ?? 0;
      if (requests > 0) {
        // Estimate what the CO2 would have been at baseline
        const avgCO2PerRequest = totalCO2 / requests;
        const baselineCO2PerRequest = avgCO2PerRequest * (this._baselineIntensity / this.getAverageRegionIntensity(region));
        const regionSavings = (baselineCO2PerRequest - avgCO2PerRequest) * requests;
        savings.set(region, Math.max(0, regionSavings));
      }
    });

    return savings;
  }

  /**
   * Get sustainability report
   */
  getSustainabilityReport(): SustainabilityReport {
    const snapshot = this.getSnapshot();
    const savingsByRegion = this.getSavingsByRegion();
    const regionsByIntensity = this.getRegionsByIntensity();

    // Calculate equivalent metrics
    const treesEquivalent = this._totalSavingsGrams / 21000; // ~21kg CO2 per tree per year
    const milesDrivenEquivalent = this._totalSavingsGrams / 404; // ~404g CO2 per mile

    // Find greenest and dirtiest routes used
    let greenestRegion: CloudRegion | undefined;
    let dirtiestRegion: CloudRegion | undefined;
    let minIntensity = Infinity;
    let maxIntensity = 0;

    for (const { region, averageIntensity } of regionsByIntensity) {
      if (this._requestsByRegion.get(region)) {
        if (averageIntensity < minIntensity) {
          minIntensity = averageIntensity;
          greenestRegion = region;
        }
        if (averageIntensity > maxIntensity) {
          maxIntensity = averageIntensity;
          dirtiestRegion = region;
        }
      }
    }

    return {
      ...snapshot,
      savingsByRegion,
      treesEquivalent,
      milesDrivenEquivalent,
      greenestRegion,
      dirtiestRegion,
      recommendations: this.generateRecommendations(snapshot, regionsByIntensity),
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this._totalRequests = 0;
    this._totalEstimatedCO2Grams = 0;
    this._totalSavingsGrams = 0;
    this._totalIntensitySum = 0;
    this._cacheHits = 0;
    this._cacheMisses = 0;
    this._fallbackCount = 0;
    this._totalFetches = 0;
    this._requestsByRegion.clear();
    this._requestsByProvider.clear();
    this._co2ByRegion.clear();
    this._intensityHistory = [];
    this._periodStart = new Date().toISOString();
    logger.info('Carbon metrics reset');
  }

  /**
   * Calculate CO2 for a request
   */
  private calculateCO2(intensityGCO2: number, tokens: number): number {
    const energyKWh = (tokens / 1000) * ENERGY_PER_1000_TOKENS_KWH;
    return energyKWh * intensityGCO2;
  }

  /**
   * Add entry to intensity history
   */
  private addToHistory(entry: IntensityHistoryEntry): void {
    this._intensityHistory.push(entry);

    // Trim if over size limit
    if (this._intensityHistory.length > this._historySize) {
      this._intensityHistory = this._intensityHistory.slice(-this._historySize);
    }
  }

  /**
   * Generate sustainability recommendations
   */
  private generateRecommendations(
    snapshot: CarbonMetricsSnapshot,
    regionsByIntensity: Array<{ region: CloudRegion; averageIntensity: number }>
  ): string[] {
    const recommendations: string[] = [];

    // Check green routing percentage
    if (snapshot.greenRoutingPercentage < 50) {
      recommendations.push(
        'Consider relaxing latency constraints to allow more routing to low-carbon regions.'
      );
    }

    // Check if high-carbon regions are being used frequently
    const highCarbonRegions = regionsByIntensity.filter(r => r.averageIntensity > 300);
    for (const { region } of highCarbonRegions) {
      const requests = snapshot.requestsByRegion.get(region) ?? 0;
      if (requests > snapshot.totalRequests * 0.1) {
        recommendations.push(
          `Region ${region} has high carbon intensity. Consider alternative regions if latency permits.`
        );
      }
    }

    // Check cache hit rate
    if (snapshot.cacheHitRate < 0.5) {
      recommendations.push(
        'Low cache hit rate detected. Consider increasing cache TTL for carbon intensity data.'
      );
    }

    // Check fallback rate
    if (snapshot.fallbackRate > 0.1) {
      recommendations.push(
        'High fallback rate detected. Check primary carbon data source connectivity.'
      );
    }

    // Recommend greenest regions
    const greenestRegions = regionsByIntensity.slice(0, 3);
    if (greenestRegions.length > 0) {
      const regionNames = greenestRegions.map(r => r.region).join(', ');
      recommendations.push(
        `Greenest available regions: ${regionNames}. Consider prioritizing these when possible.`
      );
    }

    return recommendations;
  }

  /**
   * Emit savings calculated event
   */
  private emitSavingsEvent(
    requestId: string,
    actualCO2Grams: number,
    baselineCO2Grams: number,
    savingsGrams: number
  ): void {
    const event: SavingsCalculatedEvent = {
      type: 'carbon:savings_calculated',
      timestamp: new Date().toISOString(),
      requestId,
      actualCO2Grams,
      baselineCO2Grams,
      savingsGrams,
      savingsPercentage: baselineCO2Grams > 0 ? (savingsGrams / baselineCO2Grams) * 100 : 0,
    };
    this.emit(event.type, event);
    this.emit('carbon:*', event);
  }
}

/**
 * Configuration for carbon metrics
 */
export interface CarbonMetricsConfig {
  /** Maximum number of history entries to retain */
  historySize?: number;
  /** Baseline carbon intensity for savings calculation (gCO2eq/kWh) */
  baselineIntensity?: number;
}

/**
 * Sustainability report
 */
export interface SustainabilityReport extends CarbonMetricsSnapshot {
  /** CO2 savings by region */
  savingsByRegion: Map<CloudRegion, number>;
  /** Equivalent number of trees (annual CO2 absorption) */
  treesEquivalent: number;
  /** Equivalent miles driven in an average car */
  milesDrivenEquivalent: number;
  /** Greenest region used */
  greenestRegion?: CloudRegion;
  /** Highest-carbon region used */
  dirtiestRegion?: CloudRegion;
  /** Recommendations for improving sustainability */
  recommendations: string[];
}

/**
 * Create a carbon metrics collector
 */
export function createCarbonMetrics(config?: CarbonMetricsConfig): CarbonMetrics {
  return new CarbonMetrics(config);
}
