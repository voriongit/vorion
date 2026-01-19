/**
 * @vorion/ai-gateway
 *
 * Multi-provider AI Gateway with intelligent routing, sustainability, and self-reflection
 * Extracted from BAI Command Center for the Vorion AI Governance Platform
 */

export { AIGateway, createGateway } from './gateway.js'
export type {
  GatewayMessage,
  GatewayRequest,
  GatewayResponse,
  RoutingDecision
} from './gateway.js'

// Sustainability modules
export { carbonTracker, CarbonTracker } from './sustainability/carbon-tracker.js'
export { greenRouter, GreenRouter } from './sustainability/green-route.js'
export type {
  CarbonMetrics,
  ModelEnergyProfile
} from './sustainability/carbon-tracker.js'
export type {
  GreenRoutingPolicy,
  GreenRouteDecision
} from './sustainability/green-route.js'

// Semantic routing with self-reflection
export { semanticRouter, SemanticRouter } from './routing/semantic-router.js'
export type {
  SemanticRoute,
  RoutingDecision as SemanticRoutingDecision,
  ReflectionResult
} from './routing/semantic-router.js'
