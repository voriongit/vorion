/**
 * API Routes - Route definitions for A3I HTTP API
 */

import { Hono } from 'hono';
import {
  apiKeyAuth,
  timing,
  requestId,
  errorHandler,
  rateLimit,
  cors,
  bodyLimit,
  type ApiKeyConfig,
  type RateLimitConfig,
  type CorsConfig,
} from './middleware.js';
import { createHandlers, type HandlerContext } from './handlers.js';
import { TrustProfileService } from '../trust/profile-service.js';
import { AuthorizationEngine } from '../authorization/engine.js';

/**
 * API configuration options
 */
export interface ApiConfig {
  /** API key configuration */
  apiKey?: Partial<ApiKeyConfig>;
  /** Rate limiting configuration */
  rateLimit?: RateLimitConfig;
  /** CORS configuration */
  cors?: CorsConfig;
  /** Maximum request body size in bytes */
  maxBodySize?: number;
  /** Handler context with services */
  context?: Partial<HandlerContext>;
  /** Base path for all routes (default: /api/v1) */
  basePath?: string;
}

/**
 * Default API configuration
 */
export const DEFAULT_API_CONFIG: Required<ApiConfig> = {
  apiKey: {
    headerName: 'X-API-Key',
    validKeys: new Set(['development-key']),
    allowUnauthenticated: true,
  },
  rateLimit: {
    limit: 100,
    windowMs: 60000, // 1 minute
  },
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: false,
  },
  maxBodySize: 1024 * 1024, // 1MB
  context: {},
  basePath: '/api/v1',
};

/**
 * Create the A3I API application
 */
export function createApi(config: ApiConfig = {}): Hono {
  const mergedConfig = {
    ...DEFAULT_API_CONFIG,
    ...config,
    apiKey: { ...DEFAULT_API_CONFIG.apiKey, ...config.apiKey },
    cors: { ...DEFAULT_API_CONFIG.cors, ...config.cors },
  };

  // Create services if not provided
  const profileService = config.context?.profileService ?? new TrustProfileService();
  const authEngine = config.context?.authEngine ?? new AuthorizationEngine({ profileService });

  const context: HandlerContext = {
    profileService,
    authEngine,
  };

  const handlers = createHandlers(context);
  const app = new Hono();

  // Apply global middleware
  app.use('*', cors(mergedConfig.cors));
  app.use('*', timing);
  app.use('*', requestId);
  app.use('*', errorHandler);
  app.use('*', bodyLimit(mergedConfig.maxBodySize));
  app.use('*', rateLimit(mergedConfig.rateLimit));
  app.use('*', apiKeyAuth(mergedConfig.apiKey as ApiKeyConfig));

  const basePath = mergedConfig.basePath;

  // Health check (no auth required)
  app.get(`${basePath}/health`, handlers.health);

  // Service info
  app.get(`${basePath}/info`, handlers.info);

  // Authorization endpoint
  app.post(`${basePath}/authorize`, handlers.authorize);

  // Trust profile endpoints
  app.get(`${basePath}/trust`, handlers.listTrustProfiles);
  app.get(`${basePath}/trust/:agentId`, handlers.getTrustProfile);
  app.get(`${basePath}/trust/:agentId/history`, handlers.getTrustHistory);
  app.post(`${basePath}/trust/calculate`, handlers.calculateTrust);
  app.delete(`${basePath}/trust/:agentId`, handlers.deleteTrustProfile);

  // Band configuration
  app.get(`${basePath}/bands`, handlers.getBands);

  // 404 handler
  app.notFound((c) => {
    return c.json({
      error: {
        code: 'NOT_FOUND',
        message: `Route ${c.req.method} ${c.req.path} not found`,
      },
    }, 404);
  });

  return app;
}

/**
 * Create API with handler context (for testing)
 */
export function createApiWithContext(
  context: HandlerContext,
  config: Omit<ApiConfig, 'context'> = {}
): Hono {
  return createApi({ ...config, context });
}

/**
 * Export types for consumers
 */
export type { HandlerContext };
export { createHandlers, type Handlers } from './handlers.js';
