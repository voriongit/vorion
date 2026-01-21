/**
 * Carbon-Aware Router
 *
 * Routes AI requests to lower-carbon regions when possible, considering
 * provider availability, latency requirements, and cost constraints.
 *
 * @packageDocumentation
 */

import { EventEmitter } from 'events';
import { createLogger } from '../common/logger.js';
import { CarbonIntensityClient, createCarbonIntensityClient } from './carbon-intensity-client.js';
import { CarbonMetrics, createCarbonMetrics } from './carbon-metrics.js';
import type {
  CarbonRouterConfig,
  RoutingRequest,
  RoutingDecision,
  RoutingConstraints,
  CloudRegion,
  AIProvider,
  CarbonIntensity,
  ProviderAvailability,
  AlternativeRoute,
  RoutingReason,
  RequestRoutedEvent,
} from './types.js';
import {
  DEFAULT_PROVIDER_AVAILABILITY,
  DEFAULT_REGION_LATENCIES,
  DEFAULT_COST_MULTIPLIERS,
  ENERGY_PER_1000_TOKENS_KWH,
} from './types.js';

const logger = createLogger({ component: 'carbon-router' });

/**
 * Default routing constraints
 */
const DEFAULT_CONSTRAINTS: RoutingConstraints = {
  maxLatencyMs: 500,
  maxCostMultiplier: 1.5,
  preferGreen: true,
};

/**
 * Carbon-Aware Router
 *
 * Intelligently routes AI requests to minimize carbon footprint while
 * respecting performance and cost constraints.
 */
export class CarbonRouter extends EventEmitter {
  private _client: CarbonIntensityClient;
  private _metrics: CarbonMetrics;
  private _defaultConstraints: RoutingConstraints;
  private _providerAvailability: Map<CloudRegion, ProviderAvailability[]>;
  private _regionLatencies: Map<CloudRegion, number>;
  private _costMultipliers: Map<CloudRegion, number>;
  private _enableMetrics: boolean;

  constructor(config: CarbonRouterConfig = {}) {
    super();

    this._client = config.clientConfig
      ? createCarbonIntensityClient(config.clientConfig)
      : createCarbonIntensityClient({ useMockData: true });

    this._metrics = createCarbonMetrics();
    this._defaultConstraints = { ...DEFAULT_CONSTRAINTS, ...config.defaultConstraints };
    this._enableMetrics = config.enableMetrics ?? true;

    // Initialize provider configuration
    this._providerAvailability = config.providerConfig?.availability ?? this.createDefaultAvailability();
    this._regionLatencies = config.providerConfig?.defaultLatencies ?? new Map(Object.entries(DEFAULT_REGION_LATENCIES) as [CloudRegion, number][]);
    this._costMultipliers = config.providerConfig?.costMultipliers ?? new Map(Object.entries(DEFAULT_COST_MULTIPLIERS) as [CloudRegion, number][]);

    // Forward client events to metrics
    if (this._enableMetrics) {
      this._client.on('carbon:*', (event) => this._metrics.emit(event.type, event));
    }
  }

  /**
   * Get the carbon intensity client
   */
  get client(): CarbonIntensityClient {
    return this._client;
  }

  /**
   * Get the metrics collector
   */
  get metrics(): CarbonMetrics {
    return this._metrics;
  }

  /**
   * Route a request to the optimal region based on carbon intensity
   */
  async route(request: RoutingRequest): Promise<RoutingDecision> {
    const constraints = { ...this._defaultConstraints, ...request.constraints };
    const startTime = Date.now();

    logger.debug({ requestId: request.requestId, constraints }, 'Routing request');

    // If required region is specified, use it directly
    if (constraints.requiredRegion) {
      return this.routeToRequired(request, constraints);
    }

    // Get carbon intensities for all regions
    const intensities = await this._client.getAllIntensities();

    // Get eligible routes (filtered by constraints)
    const eligibleRoutes = this.getEligibleRoutes(intensities, constraints);

    if (eligibleRoutes.length === 0) {
      logger.warn({ requestId: request.requestId }, 'No eligible routes found, using fallback');
      return this.routeFallback(request, intensities);
    }

    // Sort by carbon intensity (lowest first)
    eligibleRoutes.sort((a, b) => a.carbonIntensity - b.carbonIntensity);

    // Select the best route
    const bestRoute = eligibleRoutes[0]!;
    const alternatives = eligibleRoutes.slice(1, 4).map(r => this.toAlternativeRoute(r));

    // Calculate CO2 savings
    const highestIntensity = Math.max(...Array.from(intensities.values()).map(i => i.intensity));
    const estimatedCO2Grams = this.calculateCO2(bestRoute.carbonIntensity, request.estimatedTokens ?? 1000);
    const baselineCO2Grams = this.calculateCO2(highestIntensity, request.estimatedTokens ?? 1000);
    const savingsGrams = baselineCO2Grams - estimatedCO2Grams;

    const decision: RoutingDecision = {
      id: `route-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      provider: bestRoute.provider,
      region: bestRoute.region,
      carbonIntensity: intensities.get(bestRoute.region)!,
      estimatedLatencyMs: bestRoute.latencyMs,
      costMultiplier: bestRoute.costMultiplier,
      reason: this.determineReason(bestRoute, constraints),
      alternatives,
      estimatedCO2SavingsGrams: Math.max(0, savingsGrams),
      decidedAt: new Date().toISOString(),
    };

    // Record metrics
    if (this._enableMetrics) {
      this.emitRoutedEvent(request, decision);
      this._metrics.recordRouting(decision, request.estimatedTokens ?? 1000);
    }

    const routingTimeMs = Date.now() - startTime;
    logger.info(
      {
        requestId: request.requestId,
        region: decision.region,
        provider: decision.provider,
        carbonIntensity: decision.carbonIntensity.intensity,
        savingsGrams: decision.estimatedCO2SavingsGrams,
        routingTimeMs,
      },
      'Request routed'
    );

    return decision;
  }

  /**
   * Get the best provider for a specific region
   */
  async getProviderForRegion(
    region: CloudRegion,
    preferredProviders?: AIProvider[]
  ): Promise<AIProvider | undefined> {
    const availability = this._providerAvailability.get(region);
    if (!availability || availability.length === 0) {
      return undefined;
    }

    // Filter to available providers
    const available = availability.filter(a => a.available);
    if (available.length === 0) {
      return undefined;
    }

    // If preferred providers specified, try them first
    if (preferredProviders && preferredProviders.length > 0) {
      for (const preferred of preferredProviders) {
        const match = available.find(a => a.provider === preferred);
        if (match) {
          return match.provider;
        }
      }
    }

    // Return first available
    return available[0]!.provider;
  }

  /**
   * Get carbon intensity for all regions
   */
  async getRegionIntensities(): Promise<Map<CloudRegion, CarbonIntensity>> {
    return this._client.getAllIntensities();
  }

  /**
   * Get the lowest carbon regions
   */
  async getGreenRegions(count: number = 3): Promise<CarbonIntensity[]> {
    return this._client.getLowestCarbonRegions(count);
  }

  /**
   * Check if a region meets carbon constraints
   */
  async isGreenRegion(region: CloudRegion, maxIntensity?: number): Promise<boolean> {
    const intensity = await this._client.getIntensity(region);
    const threshold = maxIntensity ?? 150; // Default to "low" carbon threshold
    return intensity.intensity <= threshold;
  }

  /**
   * Update provider availability
   */
  updateProviderAvailability(region: CloudRegion, provider: AIProvider, available: boolean): void {
    const existing = this._providerAvailability.get(region);
    if (existing) {
      const providerEntry = existing.find(p => p.provider === provider);
      if (providerEntry) {
        providerEntry.available = available;
        logger.info({ region, provider, available }, 'Provider availability updated');
      }
    }
  }

  /**
   * Calculate estimated CO2 for a request
   */
  calculateCO2(intensityGCO2: number, tokens: number): number {
    // Energy (kWh) = tokens / 1000 * ENERGY_PER_1000_TOKENS_KWH
    // CO2 (grams) = Energy * intensity (gCO2/kWh)
    const energyKWh = (tokens / 1000) * ENERGY_PER_1000_TOKENS_KWH;
    return energyKWh * intensityGCO2;
  }

  /**
   * Close the router and release resources
   */
  async close(): Promise<void> {
    this._client.removeAllListeners();
    this._metrics.removeAllListeners();
    this.removeAllListeners();
    logger.info('Carbon router closed');
  }

  /**
   * Route to a required region
   */
  private async routeToRequired(
    request: RoutingRequest,
    constraints: RoutingConstraints
  ): Promise<RoutingDecision> {
    const region = constraints.requiredRegion!;
    const intensity = await this._client.getIntensity(region);
    const provider = await this.getProviderForRegion(region, constraints.preferredProviders);

    if (!provider) {
      throw new Error(`No provider available in required region: ${region}`);
    }

    const decision: RoutingDecision = {
      id: `route-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      provider,
      region,
      carbonIntensity: intensity,
      estimatedLatencyMs: this._regionLatencies.get(region) ?? 100,
      costMultiplier: this._costMultipliers.get(region) ?? 1.0,
      reason: 'required_region',
      alternatives: [],
      estimatedCO2SavingsGrams: 0,
      decidedAt: new Date().toISOString(),
    };

    if (this._enableMetrics) {
      this.emitRoutedEvent(request, decision);
      this._metrics.recordRouting(decision, request.estimatedTokens ?? 1000);
    }

    return decision;
  }

  /**
   * Route using fallback when no eligible routes found
   */
  private async routeFallback(
    request: RoutingRequest,
    intensities: Map<CloudRegion, CarbonIntensity>
  ): Promise<RoutingDecision> {
    // Find any available region/provider combination
    const providerEntries = Array.from(this._providerAvailability.entries());
    for (const [region, availability] of providerEntries) {
      const available = availability.find(a => a.available);
      if (available) {
        const intensity = intensities.get(region) ?? await this._client.getIntensity(region);

        const decision: RoutingDecision = {
          id: `route-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          provider: available.provider,
          region,
          carbonIntensity: intensity,
          estimatedLatencyMs: this._regionLatencies.get(region) ?? 100,
          costMultiplier: this._costMultipliers.get(region) ?? 1.0,
          reason: 'fallback',
          alternatives: [],
          estimatedCO2SavingsGrams: 0,
          decidedAt: new Date().toISOString(),
        };

        if (this._enableMetrics) {
          this.emitRoutedEvent(request, decision);
          this._metrics.recordRouting(decision, request.estimatedTokens ?? 1000);
        }

        return decision;
      }
    }

    throw new Error('No providers available in any region');
  }

  /**
   * Get eligible routes based on constraints
   */
  private getEligibleRoutes(
    intensities: Map<CloudRegion, CarbonIntensity>,
    constraints: RoutingConstraints
  ): EligibleRoute[] {
    const routes: EligibleRoute[] = [];
    const intensityEntries = Array.from(intensities.entries());

    for (const [region, intensity] of intensityEntries) {
      // Check carbon intensity constraint
      if (constraints.maxCarbonIntensity && intensity.intensity > constraints.maxCarbonIntensity) {
        continue;
      }

      // Check renewable percentage constraint
      if (constraints.minRenewablePercentage && intensity.renewablePercentage !== undefined) {
        if (intensity.renewablePercentage < constraints.minRenewablePercentage) {
          continue;
        }
      }

      // Check latency constraint
      const latency = this._regionLatencies.get(region) ?? 200;
      if (constraints.maxLatencyMs && latency > constraints.maxLatencyMs) {
        continue;
      }

      // Check cost constraint
      const cost = this._costMultipliers.get(region) ?? 1.0;
      if (constraints.maxCostMultiplier && cost > constraints.maxCostMultiplier) {
        continue;
      }

      // Get available providers
      const availability = this._providerAvailability.get(region);
      if (!availability) continue;

      const availableProviders = availability.filter(a => a.available);
      if (availableProviders.length === 0) continue;

      // Filter by preferred providers if specified
      let selectedProvider: ProviderAvailability | undefined;
      if (constraints.preferredProviders && constraints.preferredProviders.length > 0) {
        for (const preferred of constraints.preferredProviders) {
          selectedProvider = availableProviders.find(a => a.provider === preferred);
          if (selectedProvider) break;
        }
        // Skip this region if no preferred provider is available
        if (!selectedProvider) {
          continue;
        }
      } else {
        // Use first available if no preferred providers specified
        selectedProvider = availableProviders[0];
      }

      if (selectedProvider) {
        routes.push({
          region,
          provider: selectedProvider.provider,
          carbonIntensity: intensity.intensity,
          latencyMs: selectedProvider.latencyMs ?? latency,
          costMultiplier: selectedProvider.costMultiplier ?? cost,
          renewablePercentage: intensity.renewablePercentage,
        });
      }
    }

    return routes;
  }

  /**
   * Determine routing reason
   */
  private determineReason(route: EligibleRoute, constraints: RoutingConstraints): RoutingReason {
    // Check if this is the lowest carbon option
    if (route.carbonIntensity <= 50) {
      return 'lowest_carbon';
    }

    // Check if renewable preference was a factor
    if (constraints.minRenewablePercentage && route.renewablePercentage) {
      if (route.renewablePercentage >= constraints.minRenewablePercentage) {
        return 'renewable_preference';
      }
    }

    // Check if latency was the primary factor
    if (constraints.maxLatencyMs && route.latencyMs <= constraints.maxLatencyMs * 0.5) {
      return 'latency_constraint';
    }

    // Check if cost was the primary factor
    if (constraints.maxCostMultiplier && route.costMultiplier <= 1.0) {
      return 'cost_constraint';
    }

    return 'lowest_carbon';
  }

  /**
   * Convert eligible route to alternative route format
   */
  private toAlternativeRoute(route: EligibleRoute): AlternativeRoute {
    return {
      provider: route.provider,
      region: route.region,
      carbonIntensity: route.carbonIntensity,
      estimatedLatencyMs: route.latencyMs,
      costMultiplier: route.costMultiplier,
    };
  }

  /**
   * Create default provider availability map
   */
  private createDefaultAvailability(): Map<CloudRegion, ProviderAvailability[]> {
    const map = new Map<CloudRegion, ProviderAvailability[]>();

    for (const [region, providers] of Object.entries(DEFAULT_PROVIDER_AVAILABILITY) as [CloudRegion, AIProvider[]][]) {
      const availability: ProviderAvailability[] = providers.map(provider => ({
        provider,
        region,
        available: true,
        latencyMs: DEFAULT_REGION_LATENCIES[region] ?? 100,
        costMultiplier: DEFAULT_COST_MULTIPLIERS[region] ?? 1.0,
      }));
      map.set(region, availability);
    }

    return map;
  }

  /**
   * Emit request routed event
   */
  private emitRoutedEvent(request: RoutingRequest, decision: RoutingDecision): void {
    const event: RequestRoutedEvent = {
      type: 'carbon:request_routed',
      timestamp: new Date().toISOString(),
      requestId: request.requestId,
      selectedRegion: decision.region,
      selectedProvider: decision.provider,
      carbonIntensity: decision.carbonIntensity.intensity,
      estimatedCO2Grams: this.calculateCO2(decision.carbonIntensity.intensity, request.estimatedTokens ?? 1000),
      routingReason: decision.reason,
      latencyMs: decision.estimatedLatencyMs,
    };
    this.emit(event.type, event);
    this.emit('carbon:*', event);
  }
}

/**
 * Internal type for eligible routes
 */
interface EligibleRoute {
  region: CloudRegion;
  provider: AIProvider;
  carbonIntensity: number;
  latencyMs: number;
  costMultiplier: number;
  renewablePercentage?: number;
}

/**
 * Create a carbon-aware router
 */
export function createCarbonRouter(config?: CarbonRouterConfig): CarbonRouter {
  return new CarbonRouter(config);
}
